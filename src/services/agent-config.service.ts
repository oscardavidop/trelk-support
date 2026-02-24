/**
 * Agent Config Service - Central configuration resolver with Redis caching
 *
 * Responsibilities:
 *  1. Load global / team / agent configs from DB
 *  2. Cache them in Redis (TTL configurable, invalidated on update)
 *  3. Resolve effective config: agent > team > global > ENGINE_DEFAULTS
 *  4. Provide typed getters for every parameter
 *  5. Rebuild cache on demand
 */

import * as redis from './redis.js';
import { AgentEngineConfig, ENGINE_DEFAULTS, type IAgentEngineConfig } from '../database/models/AgentEngineConfig.js';
import { Agent } from '../database/models/Agent.js';
import { logger } from './logger.js';

// ─── Redis key helpers ────────────────────────────────────────────────────────

const CACHE_TTL        = 300;     // 5 min
const globalConfigKey  = () => 'engine:config:global';
const teamConfigKey    = (teamId: string) => `engine:config:team:${teamId}`;
const agentConfigKey   = (agentId: string) => `engine:config:agent:${agentId}`;
const resolvedKey      = (agentId: string) => `engine:resolved:${agentId}`;
const versionKey       = () => 'engine:config:version';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The resolved (merged) config an agent actually runs under */
export type ResolvedConfig = typeof ENGINE_DEFAULTS;

// ─── Low-level loaders ────────────────────────────────────────────────────────

async function loadFromDB(scope: string, scopeRef: string | null): Promise<Partial<ResolvedConfig> | null> {
  const doc = await AgentEngineConfig.findOne({ scope, scopeRef }).lean() as any;
  if (!doc) return null;
  // Strip Mongoose metadata
  const { _id, __v, scope: _s, scopeRef: _r, label, version, createdAt, updatedAt, ...rest } = doc;
  return rest as Partial<ResolvedConfig>;
}

async function loadCachedOrDB(
  cacheKey: string,
  scope: string,
  scopeRef: string | null
): Promise<Partial<ResolvedConfig> | null> {
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const doc = await loadFromDB(scope, scopeRef);
  if (doc) {
    await redis.set(cacheKey, JSON.stringify(doc), CACHE_TTL);
  }
  return doc;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the raw global config (or null if not yet created – will use ENGINE_DEFAULTS).
 */
export async function getGlobalConfig(): Promise<Partial<ResolvedConfig> | null> {
  return loadCachedOrDB(globalConfigKey(), 'global', null);
}

/**
 * Get the raw team override config.
 */
export async function getTeamConfig(teamId: string): Promise<Partial<ResolvedConfig> | null> {
  return loadCachedOrDB(teamConfigKey(teamId), 'team', teamId);
}

/**
 * Get the raw agent override config.
 */
export async function getAgentConfig(agentId: string): Promise<Partial<ResolvedConfig> | null> {
  return loadCachedOrDB(agentConfigKey(agentId), 'agent', agentId);
}

/**
 * Resolve the effective config for an agent: agent > team > global > defaults.
 * Uses Redis cache with short TTL.
 */
export async function resolveConfig(agentId: string): Promise<ResolvedConfig> {
  // 1. Try resolved cache
  const rCached = await redis.get(resolvedKey(agentId));
  if (rCached) return JSON.parse(rCached);

  // 2. Load each layer in parallel
  const agent = await Agent.findById(agentId).select('teamId').lean() as any;
  const teamId = agent?.teamId ? String(agent.teamId) : null;

  const [globalCfg, teamCfg, agentCfg] = await Promise.all([
    getGlobalConfig(),
    teamId ? getTeamConfig(teamId) : null,
    getAgentConfig(agentId),
  ]);

  // 3. Merge: defaults ← global ← team ← agent
  const resolved: ResolvedConfig = {
    ...ENGINE_DEFAULTS,
    ...(globalCfg ?? {}),
    ...(teamCfg ?? {}),
    ...(agentCfg ?? {}),
  } as ResolvedConfig;

  // 4. Cache
  await redis.set(resolvedKey(agentId), JSON.stringify(resolved), CACHE_TTL);
  return resolved;
}

/**
 * Shortcut: resolve a single config key for an agent.
 */
export async function resolveConfigValue<K extends keyof ResolvedConfig>(
  agentId: string,
  key: K
): Promise<ResolvedConfig[K]> {
  const cfg = await resolveConfig(agentId);
  return cfg[key];
}

// ─── Dynamic Capacity Resolver ────────────────────────────────────────────────

/**
 * Resolve the actual max-chats for an agent, considering:
 *  1. Agent.maxChatsOverride (set by supervisor)
 *  2. Engine config maxChatsDefault (agent > team > global)
 *  3. Dynamic capacity adjustments (if enableDynamicCapacity)
 */
export async function resolveAgentCapacity(agentId: string): Promise<number> {
  const agent = await Agent.findById(agentId)
    .select('maxChatsOverride activeChats auxiliaryStateCode')
    .lean() as any;
  if (!agent) return 1;

  const cfg = await resolveConfig(agentId);

  // Supervisor override takes precedence
  if (agent.maxChatsOverride != null && agent.maxChatsOverride > 0) {
    return agent.maxChatsOverride;
  }

  let capacity = cfg.maxChatsDefault;

  // Dynamic capacity: could scale based on performance, time of day, etc.
  if (cfg.enableDynamicCapacity) {
    // Simple heuristic: if agent has been available for a while with no chats, keep base.
    // If agent is under load, slightly increase capacity dynamically (max +2).
    const load = (agent.activeChats || 0) / capacity;
    if (load >= 0.9 && capacity < 10) {
      capacity = Math.min(capacity + 1, 10);
    }
  }

  return capacity;
}

// ─── Write Helpers (Dashboard CRUD) ───────────────────────────────────────────

export async function upsertConfig(
  scope: 'global' | 'team' | 'agent',
  scopeRef: string | null,
  data: Partial<ResolvedConfig> & { label?: string }
): Promise<IAgentEngineConfig> {
  const existing = await AgentEngineConfig.findOne({ scope, scopeRef });
  if (existing) {
    Object.assign(existing, data);
    await existing.save();
    await invalidateScope(scope, scopeRef);
    return existing;
  }

  const doc = await AgentEngineConfig.create({
    scope,
    scopeRef,
    label: data.label ?? (scope === 'global' ? 'Global Config' : `${scope} config`),
    ...data,
  });
  await invalidateScope(scope, scopeRef);
  return doc;
}

export async function getConfigDoc(
  scope: 'global' | 'team' | 'agent',
  scopeRef: string | null
): Promise<IAgentEngineConfig | null> {
  return AgentEngineConfig.findOne({ scope, scopeRef }).lean() as any;
}

export async function listConfigs(): Promise<IAgentEngineConfig[]> {
  return AgentEngineConfig.find().sort({ scope: 1, label: 1 }).lean() as any;
}

// ─── Cache Invalidation ──────────────────────────────────────────────────────

async function invalidateScope(scope: string, scopeRef: string | null): Promise<void> {
  if (scope === 'global') {
    await redis.del(globalConfigKey());
  } else if (scope === 'team' && scopeRef) {
    await redis.del(teamConfigKey(scopeRef));
  } else if (scope === 'agent' && scopeRef) {
    await redis.del([agentConfigKey(scopeRef), resolvedKey(scopeRef)]);
  }
  // Bump global version to tell other services to refresh
  const ver = await redis.get(versionKey());
  await redis.set(versionKey(), String((ver ? parseInt(ver) : 0) + 1), 86400);
  logger.info('presence', { action: 'config_invalidated', scope, scopeRef });
}

/**
 * Full cache rebuild: wipe all engine:* keys and re-warm global.
 * Called from dashboard "Rebuild Cache" button.
 */
export async function rebuildAllCache(): Promise<{ ok: boolean; version: number }> {
  // Delete all resolved caches (agent-specific)
  // Since we can't scan easily, just bump version – short TTL means caches will expire soon
  const ver = await redis.get(versionKey());
  const newVer = (ver ? parseInt(ver) : 0) + 1;
  await redis.set(versionKey(), String(newVer), 86400);

  // Re-warm global
  await redis.del(globalConfigKey());
  await getGlobalConfig();

  logger.info('presence', { action: 'cache_rebuild', version: newVer });
  return { ok: true, version: newVer };
}

/**
 * Get current engine version (for dashboard display).
 */
export async function getEngineVersion(): Promise<number> {
  const ver = await redis.get(versionKey());
  return ver ? parseInt(ver) : 1;
}

// ─── Boot: ensure global config exists ────────────────────────────────────────

export async function ensureGlobalConfig(): Promise<void> {
  const existing = await AgentEngineConfig.findOne({ scope: 'global', scopeRef: null });
  if (!existing) {
    await AgentEngineConfig.create({
      scope: 'global',
      scopeRef: null,
      label: 'Global Config',
      ...ENGINE_DEFAULTS,
    });
    logger.info('presence', { action: 'global_config_created' });
  }
}

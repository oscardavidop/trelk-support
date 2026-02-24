/**
 * Presence Service - Core Agent Status Engine
 * 
 * Responsibilities:
 * - State changes with validation (State Guard)
 * - Heartbeat anti-fraud
 * - Redis caching of current state
 * - Immutable audit log writes
 * - Break quota enforcement
 * - Idle detection
 * - Auto-expiry of states with timers
 * - Anti-busy-fraud (validates busy state vs active chats)
 * - Time reconciliation on server startup
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { Server as SocketIOServer } from 'socket.io';

import * as redis from './redis.js';
import { Agent }  from '../database/models/Agent.js';
import { AgentStatusLog, type StatusChangeTrigger } from '../database/models/AgentStatusLog.js';
import { AuxiliaryState, type IAuxiliaryState } from '../database/models/AuxiliaryState.js';
import { logger } from './logger.js';
import {
  validateStateChange as ruleEngineValidate,
  recordBreakTime,
  checkIdleAutoBreak,
  checkAutoBusyAfterAssignment,
} from './agent-rule-engine.js';
import { resolveConfig, resolveAgentCapacity, ensureGlobalConfig } from './agent-config.service.js';
import { ENGINE_DEFAULTS } from '../database/models/AgentEngineConfig.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS  = 30_000;   // Expect heartbeat every 30s
const HEARTBEAT_TIMEOUT_MS   = ENGINE_DEFAULTS.heartbeatTimeoutSeconds * 1000; // fallback for quick paths
const IDLE_ALERT_MS          = 15 * 60 * 1000;  // 15 min without activity → idle-risk
const BUSY_VALIDATE_INTERVAL = 60_000;   // Validate busy state every 60s

// Redis key helpers
const presenceKey     = (agentId: string) => `presence:${agentId}`;
const heartbeatKey    = (agentId: string) => `heartbeat:${agentId}`;
const autoExpireKey   = (agentId: string) => `presence:expire:${agentId}`;
const breakTodayKey   = (agentId: string, date: string) => `presence:break_today:${agentId}:${date}`;
const auxCacheKey     = () => `presence:aux_states`;

let _io: SocketIOServer | null = null;

// ─── IO init ─────────────────────────────────────────────────────────────────

export function initPresenceService(io: SocketIOServer): void {
  _io = io;
  startHeartbeatMonitor();
  startBusyValidator();
  reconcileOpenLogs().catch(err =>
    logger.error('presence', { action: 'reconciliation_error', error: String(err) })
  );
  seedDefaultStates().catch(err =>
    logger.error('presence', { action: 'seed_error', error: String(err) })
  );
  ensureGlobalConfig().catch(err =>
    logger.error('presence', { action: 'global_config_seed_error', error: String(err) })
  );
  logger.info('presence', { action: 'initialized' });
}

// ─── Aux state cache ─────────────────────────────────────────────────────────

let _auxCache: Map<string, IAuxiliaryState> = new Map();
let _auxCacheTs = 0;

async function getAuxStates(): Promise<Map<string, IAuxiliaryState>> {
  const now = Date.now();
  if (now - _auxCacheTs < 30_000 && _auxCache.size > 0) return _auxCache;

  // Try Redis first
  const cached = await redis.get(auxCacheKey());
  if (cached) {
    const arr: IAuxiliaryState[] = JSON.parse(cached);
    _auxCache = new Map(arr.map(s => [s.code, s]));
    _auxCacheTs = now;
    return _auxCache;
  }

  // Fallback to DB
  const states = await AuxiliaryState.find({ isActive: true }).lean<IAuxiliaryState[]>();
  _auxCache = new Map(states.map(s => [s.code, s]));
  await redis.set(auxCacheKey(), JSON.stringify(states), 300);
  _auxCacheTs = now;
  return _auxCache;
}

export async function invalidateAuxCache(): Promise<void> {
  _auxCacheTs = 0;
  _auxCache.clear();
  await redis.del(auxCacheKey());
}

// ─── State Guard ─────────────────────────────────────────────────────────────

/**
 * Returns null if transition is valid, or an error message if invalid.
 */
export function validateStateTransition(
  current: string,
  next: string,
  hasActiveChats: boolean
): string | null {
  // Cannot set busy without active chats (anti-fraud)
  if (next === 'busy' && !hasActiveChats) {
    return 'Cannot set busy state without active chats';
  }
  // Cannot go directly offline → busy or break
  if (current === 'offline' && (next === 'busy')) {
    return 'Cannot transition from offline to busy. Go available first.';
  }
  return null; // valid
}

// ─── Core: Change Agent State ─────────────────────────────────────────────────

export interface StateChangeOptions {
  reason?: string;
  triggeredBy: StatusChangeTrigger;
  supervisorId?: string;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  skipValidation?: boolean;
  isUnexpected?: boolean;
}

export async function setAgentState(
  agentId: string,
  newStateCode: string,
  opts: StateChangeOptions
): Promise<{ ok: boolean; error?: string }> {
  const {
    reason,
    triggeredBy,
    supervisorId,
    ip = '0.0.0.0',
    userAgent = 'system',
    sessionId,
    skipValidation = false,
    isUnexpected = false,
  } = opts;

  // 1. Load aux states
  const auxStates = await getAuxStates();
  const nextState = auxStates.get(newStateCode);
  if (!nextState) {
    return { ok: false, error: `Unknown auxiliary state: ${newStateCode}` };
  }

  // 2. Load agent
  const agent = await Agent.findById(agentId).lean() as any;
  if (!agent) return { ok: false, error: 'Agent not found' };

  const currentCode: string = agent.auxiliaryStateCode || 'offline';

  // 3. Guard: Rule Engine validation (transition rules, break quota, permissions)
  if (!skipValidation) {
    const hasActiveChats = (agent.activeChats || 0) > 0;
    const ruleResult = await ruleEngineValidate({
      agentId,
      currentStateCode: currentCode,
      nextStateCode: newStateCode,
      hasActiveChats,
      reason,
      triggeredBy,
      supervisorId,
    });
    if (!ruleResult.allowed) return { ok: false, error: ruleResult.reason };
  }

  // 4. Break quota enforcement (already checked in rule engine, kept for Redis accumulation)
  if (newStateCode.startsWith('break') || nextState.maxDailyMinutes) {
    const quotaError = await checkBreakQuota(agentId, nextState);
    if (quotaError) return { ok: false, error: quotaError };
  }

  const now = new Date();

  // 5. Close previous log entry
  await closePreviousLog(agentId, now);

  // 6. Cancel any pending auto-expire for old state
  await cancelAutoExpire(agentId);

  // 7. Create new immutable log entry
  await createStatusLog({
    agentId,
    stateCode: newStateCode,
    stateLabel: nextState.label,
    reason,
    startedAt: now,
    ip,
    userAgent,
    sessionId,
    triggeredBy,
    triggeredByAgentId: supervisorId,
    isUnexpected,
  });

  // 8. Update agent in DB (minimal write)
  const agentUpdate: Record<string, any> = {
    auxiliaryStateCode: newStateCode,
    lastActivity: now,
  };
  // Map to legacy onlineStatus for backward compatibility
  if (newStateCode === 'offline') agentUpdate.onlineStatus = 'offline';
  else if (newStateCode === 'available') agentUpdate.onlineStatus = 'online';
  else agentUpdate.onlineStatus = 'online'; // busy, break → still technically "online"

  await Agent.updateOne({ _id: agentId }, { $set: agentUpdate });

  // 9. Cache in Redis
  const presenceData = {
    agentId,
    stateCode: newStateCode,
    label: nextState.label,
    color: nextState.color,
    receivesChats: nextState.receivesChats,
    changedAt: now.toISOString(),
    ip,
  };
  await redis.set(presenceKey(agentId), JSON.stringify(presenceData), 86400);

  // 10. Schedule auto-expire if applicable
  if (nextState.autoExpireMinutes) {
    await scheduleAutoExpire(agentId, nextState, now);
  }

  // 11. Emit socket event to supervisors + the agent's own room
  emitStateChange(agentId, presenceData);

  logger.info('presence', { action: 'state_changed', agentId, newStateCode, triggeredBy });
  return { ok: true };
}

// ─── Heartbeat ───────────────────────────────────────────────────────────────

export async function handleHeartbeat(
  agentId: string,
  opts: { ip?: string; userAgent?: string; sessionId?: string }
): Promise<void> {
  const now = Date.now();
  await redis.set(heartbeatKey(agentId), String(now), Math.ceil(HEARTBEAT_TIMEOUT_MS / 1000) + 10);

  // Update lastActivity in DB (throttled: only if > 60s since last update)
  const lastActKey = `presence:lastact:${agentId}`;
  const last = await redis.get(lastActKey);
  if (!last || now - parseInt(last) > 60_000) {
    await Agent.updateOne({ _id: agentId }, { $set: { lastActivity: new Date() } });
    await redis.set(lastActKey, String(now), 120);
  }

  // Detect idle risk: reset if heartbeat came in
  await redis.del(`presence:idle:${agentId}`);
}

/**
 * Called internally each second to check for missed heartbeats.
 */
async function startHeartbeatMonitor(): Promise<void> {
  setInterval(async () => {
    try {
      // Get all agents that are NOT offline
      const agents = await Agent.find({
        auxiliaryStateCode: { $ne: 'offline' },
        isActive: true,
      }).select('_id auxiliaryStateCode lastActivity presenceSessionId').lean() as any[];

      const now = Date.now();
      for (const agent of agents) {
        const agentId = String(agent._id);

        // Resolve heartbeat timeout from config (agent > team > global)
        const cfg = await resolveConfig(agentId);
        const timeoutMs = cfg.heartbeatTimeoutSeconds * 1000;

        const lastBeat = await redis.get(heartbeatKey(agentId));
        if (!lastBeat) {
          // No heartbeat key → might be fresh or missed
          continue;
        }
        const elapsed = now - parseInt(lastBeat);
        if (elapsed > timeoutMs) {
          logger.warn('presence', { action: 'heartbeat_timeout', agentId });
          await setAgentState(agentId, 'offline', {
            triggeredBy: 'heartbeat_timeout',
            isUnexpected: true,
            ip: '0.0.0.0',
            userAgent: 'system',
          });
          // Alert supervisors
          emitSystemAlert(agentId, 'heartbeat_timeout', 'Agent went offline due to missed heartbeat');
        } else if (elapsed > IDLE_ALERT_MS) {
          // Rule-engine idle auto-break
          const autoBreakCode = await checkIdleAutoBreak(agentId);
          if (autoBreakCode) {
            logger.info('presence', { action: 'idle_auto_break', agentId, targetState: autoBreakCode });
            await setAgentState(agentId, autoBreakCode, {
              triggeredBy: 'system_auto',
              skipValidation: true,
              reason: 'Idle timeout auto-break',
              ip: '0.0.0.0',
              userAgent: 'system',
            });
            emitSystemAlert(agentId, 'idle_auto_break', `Agent moved to ${autoBreakCode} due to idle timeout`);
          } else {
            // Idle risk: flag agent
            const idleKey = `presence:idle:${agentId}`;
            const alreadyFlagged = await redis.get(idleKey);
            if (!alreadyFlagged) {
              await redis.set(idleKey, '1', 3600);
              emitSystemAlert(agentId, 'idle_risk', 'Agent may be idle - no recent activity');
            }
          }
        }
      }
    } catch (err) {
      logger.error('presence', { action: 'heartbeat_monitor_error', error: String(err) });
    }
  }, HEARTBEAT_INTERVAL_MS);
}

// ─── Busy Validator ───────────────────────────────────────────────────────────

/**
 * Periodically validate busy state is legitimate (agent must have active chats).
 */
async function startBusyValidator(): Promise<void> {
  setInterval(async () => {
    try {
      const busyAgents = await Agent.find({
        auxiliaryStateCode: 'busy',
        isActive: true,
      }).select('_id activeChats').lean() as any[];

      for (const agent of busyAgents) {
        if ((agent.activeChats || 0) === 0) {
          logger.warn('presence', { action: 'anti_fraud_busy', agentId: String(agent._id) });
          await setAgentState(String(agent._id), 'available', {
            triggeredBy: 'system_auto',
            skipValidation: true,
            ip: '0.0.0.0',
            userAgent: 'system',
          });
        }
      }
    } catch (err) {
      logger.error('presence', { action: 'busy_validator_error', error: String(err) });
    }
  }, BUSY_VALIDATE_INTERVAL);
}

// ─── Auto-Expire ─────────────────────────────────────────────────────────────

async function scheduleAutoExpire(
  agentId: string,
  state: IAuxiliaryState,
  changedAt: Date
): Promise<void> {
  if (!state.autoExpireMinutes) return;
  const expireAt = new Date(changedAt.getTime() + state.autoExpireMinutes * 60_000);
  const ttlMs = expireAt.getTime() - Date.now();
  if (ttlMs <= 0) return;

  // Store expiry info
  await redis.set(
    autoExpireKey(agentId),
    JSON.stringify({ code: state.code, transitionTo: state.transitionToCode || 'available', expireAt: expireAt.toISOString() }),
    Math.ceil(ttlMs / 1000) + 5
  );

  // Schedule the transition
  setTimeout(async () => {
    try {
      // Verify agent is still in this state (wasn't changed manually)
      const current = await redis.get(presenceKey(agentId));
      if (!current) return;
      const p = JSON.parse(current);
      if (p.stateCode !== state.code) return; // Already changed

      logger.info('presence', { action: 'auto_expire', stateCode: state.code, agentId, transitionTo: state.transitionToCode });
      await setAgentState(agentId, state.transitionToCode || 'available', {
        triggeredBy: 'auto_expire',
        skipValidation: true,
        ip: '0.0.0.0',
        userAgent: 'system',
      });
    } catch (err) {
      logger.error('presence', { action: 'auto_expire_error', error: String(err) });
    }
  }, ttlMs);
}

async function cancelAutoExpire(agentId: string): Promise<void> {
  await redis.del(autoExpireKey(agentId));
}

// ─── Break Quota ─────────────────────────────────────────────────────────────

async function checkBreakQuota(
  agentId: string,
  state: IAuxiliaryState
): Promise<string | null> {
  if (!state.maxDailyMinutes) return null;

  const date = new Date().toISOString().split('T')[0];
  const key = breakTodayKey(agentId, date);
  const usedStr = await redis.get(key);
  const usedMs = usedStr ? parseInt(usedStr) : 0;
  const usedMinutes = usedMs / 60_000;

  if (usedMinutes >= state.maxDailyMinutes) {
    return `Break quota exceeded: ${Math.floor(usedMinutes)}/${state.maxDailyMinutes} min used today for ${state.label}`;
  }
  return null;
}

async function accumulateBreakTime(agentId: string, stateCode: string, durationMs: number): Promise<void> {
  const states = await getAuxStates();
  const state = states.get(stateCode);
  if (!state?.maxDailyMinutes) return;

  const date = new Date().toISOString().split('T')[0];
  const key = breakTodayKey(agentId, date);
  const current = await redis.get(key);
  const newVal = (current ? parseInt(current) : 0) + durationMs;
  // TTL: expire at end of day + 1h
  const secondsUntilEndOfDay = 86400 - (Math.floor(Date.now() / 1000) % 86400) + 3600;
  await redis.set(key, String(newVal), secondsUntilEndOfDay);

  // Check if quota now exceeded → emit alert
  const states2 = await getAuxStates();
  const s = states2.get(stateCode);
  if (s?.maxDailyMinutes && newVal / 60_000 >= s.maxDailyMinutes * 0.8) {
    emitSystemAlert(agentId, 'break_quota_warning', `Agent has used ${Math.floor(newVal / 60_000)}/${s.maxDailyMinutes} min of ${s.label} today`);
  }
}

// ─── Log Helpers ─────────────────────────────────────────────────────────────

async function closePreviousLog(agentId: string, endedAt: Date): Promise<void> {
  const openLog = await AgentStatusLog.findOne({
    agentId,
    endedAt: { $exists: false },
  }).sort({ startedAt: -1 });

  if (!openLog) return;

  const durationMs = endedAt.getTime() - openLog.startedAt.getTime();

  // Use direct update (bypass our immutability guard via updateOne on the collection)
  await (AgentStatusLog as any).collection.updateOne(
    { _id: openLog._id },
    { $set: { endedAt, durationMs } }
  );

  // Accumulate break time via rule engine (daily + weekly + monthly tracking)
  await recordBreakTime(agentId, openLog.auxiliaryStateCode, durationMs);
}

interface CreateLogParams {
  agentId: string;
  stateCode: string;
  stateLabel: string;
  reason?: string;
  startedAt: Date;
  ip: string;
  userAgent: string;
  sessionId?: string;
  triggeredBy: StatusChangeTrigger;
  triggeredByAgentId?: string;
  isUnexpected: boolean;
}

function buildIntegrityHash(params: CreateLogParams): string {
  const payload = `${params.agentId}|${params.stateCode}|${params.startedAt.toISOString()}|${params.ip}|${params.triggeredBy}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function createStatusLog(params: CreateLogParams): Promise<void> {
  const hash = buildIntegrityHash(params);
  await AgentStatusLog.create({
    agentId: params.agentId,
    auxiliaryStateCode: params.stateCode,
    auxiliaryStateLabel: params.stateLabel,
    reason: params.reason,
    startedAt: params.startedAt,
    ip: params.ip,
    userAgent: params.userAgent,
    sessionId: params.sessionId,
    triggeredBy: params.triggeredBy,
    triggeredByAgentId: params.triggeredByAgentId,
    isUnexpected: params.isUnexpected,
    integrityHash: hash,
  });
}

// ─── Presence Queries ─────────────────────────────────────────────────────────

export async function getAgentPresence(agentId: string): Promise<any | null> {
  const cached = await redis.get(presenceKey(agentId));
  if (cached) return JSON.parse(cached);

  // Fallback to DB
  const agent = await Agent.findById(agentId)
    .select('auxiliaryStateCode onlineStatus lastActivity')
    .lean() as any;
  if (!agent) return null;

  return {
    agentId,
    stateCode: agent.auxiliaryStateCode || 'offline',
    changedAt: agent.lastActivity?.toISOString() || null,
  };
}

export async function getAllPresences(): Promise<any[]> {
  // Get all online/active agents quickly
  const agents = await Agent.find({ isActive: true })
    .select('_id name email auxiliaryStateCode activeChats maxChatsOverride')
    .lean() as any[];

  // Load aux states once for color + label lookup
  const auxStates = await getAuxStates();

  const results = [];
  for (const agent of agents) {
    const cached = await redis.get(presenceKey(String(agent._id)));
    const presence = cached ? JSON.parse(cached) : null;

    // Determine stateCode: Redis > DB field > default offline
    const stateCode = presence?.stateCode || agent.auxiliaryStateCode || 'offline';

    // Determine color: Redis > AuxState config > default gray
    const auxState = auxStates.get(stateCode);
    const color = presence?.color || auxState?.color || '#6b7280';

    results.push({
      agentId: String(agent._id),
      name: agent.name,
      email: agent.email,
      stateCode,
      color,
      label: auxState?.label || stateCode,
      changedAt: presence?.changedAt || null,
      activeChats: agent.activeChats || 0,
      maxChats: agent.maxChatsOverride ?? 5,
    });
  }
  return results;
}

// ─── Login / Logout ───────────────────────────────────────────────────────────

export async function handleAgentLogin(
  agentId: string,
  opts: { ip: string; userAgent: string; sessionId?: string }
): Promise<void> {
  const sessionId = opts.sessionId || uuidv4();
  await Agent.updateOne({ _id: agentId }, { $set: { presenceSessionId: sessionId } });

  // Set initial heartbeat
  await redis.set(heartbeatKey(agentId), String(Date.now()), Math.ceil(HEARTBEAT_TIMEOUT_MS / 1000) + 10);

  await setAgentState(agentId, 'available', {
    triggeredBy: 'login',
    ip: opts.ip,
    userAgent: opts.userAgent,
    sessionId,
  });
}

export async function handleAgentLogout(
  agentId: string,
  opts: { ip?: string; userAgent?: string; sessionId?: string }
): Promise<void> {
  await redis.del(heartbeatKey(agentId));
  await redis.del(presenceKey(agentId));

  await setAgentState(agentId, 'offline', {
    triggeredBy: 'logout',
    skipValidation: true,
    ip: opts.ip || '0.0.0.0',
    userAgent: opts.userAgent || 'system',
    sessionId: opts.sessionId,
  });

  await Agent.updateOne({ _id: agentId }, { $set: { presenceSessionId: null } });
}

// ─── Time Reconciliation on boot ──────────────────────────────────────────────

async function reconcileOpenLogs(): Promise<void> {
  // Close all logs that have no endedAt (server crash / unexpected shutdown)
  const openLogs = await (AgentStatusLog as any).collection
    .find({ endedAt: { $exists: false } })
    .toArray();

  if (openLogs.length === 0) return;

  const now = new Date();
  logger.info('presence', { action: 'reconciling_logs', count: openLogs.length });

  for (const log of openLogs) {
    const durationMs = now.getTime() - new Date(log.startedAt).getTime();
    await (AgentStatusLog as any).collection.updateOne(
      { _id: log._id },
      { $set: { endedAt: now, durationMs } }
    );
  }

  // Force all non-offline agents that have no Redis heartbeat to offline
  // (They were connected before crash but Redis was wiped)
  const onlineAgents = await Agent.find({
    auxiliaryStateCode: { $ne: 'offline' },
    isActive: true,
  }).select('_id').lean() as any[];

  for (const a of onlineAgents) {
    const beat = await redis.get(heartbeatKey(String(a._id)));
    if (!beat) {
      await Agent.updateOne({ _id: a._id }, { $set: { auxiliaryStateCode: 'offline', onlineStatus: 'offline' } });
    }
  }

  logger.info('presence', { action: 'reconciliation_complete' });
}

// ─── Default State Seeding ────────────────────────────────────────────────────

async function seedDefaultStates(): Promise<void> {
  const { DEFAULT_AUXILIARY_STATES } = await import('../database/models/AuxiliaryState.js');
  for (const state of DEFAULT_AUXILIARY_STATES) {
    await AuxiliaryState.updateOne(
      { code: state.code },
      { $setOnInsert: state },
      { upsert: true }
    );
  }
}

// ─── Socket Helpers ───────────────────────────────────────────────────────────

function emitStateChange(agentId: string, data: any): void {
  if (!_io) return;
  _io.emit('agent:state_changed', { agentId, ...data });
}

function emitSystemAlert(agentId: string, type: string, message: string): void {
  if (!_io) return;
  _io.emit('presence:alert', { agentId, type, message, timestamp: new Date() });
}

// ─── Dynamic Capacity ─────────────────────────────────────────────────────────

export async function setAgentMaxChats(
  agentId: string,
  maxChats: number,
  supervisorId: string
): Promise<void> {
  await Agent.updateOne({ _id: agentId }, { $set: { maxChatsOverride: maxChats } });
  if (_io) {
    _io.emit('agent:capacity_changed', { agentId, maxChats, changedBy: supervisorId });
  }
  logger.info('presence', { action: 'max_chats_updated', agentId, maxChats, supervisorId });
}

// ─── Export helpers ───────────────────────────────────────────────────────────

export { createStatusLog };

/**
 * Determines if an agent can receive chats right now.
 * This is the SINGLE source of truth for chat assignment.
 * Delegates to the Rule Engine's validateAssignment for full validation.
 * All assignment code MUST call this instead of checking onlineStatus.
 */
export async function canReceiveChats(agentId: string): Promise<boolean> {
  // Delegate entirely to the Rule Engine — it checks:
  //  - Live state from Redis (stateCode, receivesChats, blocksAssignment)
  //  - Heartbeat (blockAssignmentIfNoHeartbeat + heartbeatTimeoutSeconds from config)
  //  - Session (presenceSessionId)
  //  - Break quota block
  //  - Capacity (resolveAgentCapacity from config — not hardcoded)
  const { validateAssignment } = await import('./agent-rule-engine.js');
  const result = await validateAssignment({ agentId });
  return result.allowed;
}

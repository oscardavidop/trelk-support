/**
 * Cache Service
 * High-level caching with automatic invalidation and DB fallback
 * 
 * Strategy: Write-through with precise invalidation
 * - DB is ALWAYS source of truth
 * - Cache accelerates reads
 * - Invalidate on any write
 */

import * as redis from './redis.js';
import { logger } from './logger.js';

// ============= CACHE KEY BUILDERS =============

export const CacheKeys = {
  // Flows
  flow: (flowId: string) => `flow:${flowId}`,
  flowPublished: (flowId: string) => `flow:${flowId}:published`,
  flowByTrigger: (triggerType: string) => `flow:trigger:${triggerType}`,
  flowByKeyword: (keyword: string) => `flow:keyword:${keyword.toLowerCase()}`,
  flowActiveList: () => `flow:active:list`,
  
  // Flow Executions (hot cache for active executions)
  flowExecution: (executionId: string) => `flowexec:${executionId}`,
  flowExecutionBySession: (sessionId: string) => `flowexec:session:${sessionId}`,
  flowExecutionActive: (chatId: number) => `flowexec:active:${chatId}`,
  flowExecutionPending: () => `flowexec:pending:sync`, // List of IDs pending DB sync
  
  // Sessions
  session: (sessionId: string) => `session:${sessionId}`,
  sessionByChat: (chatId: number) => `session:chat:${chatId}`,
  
  // Agents
  agent: (agentId: string) => `agent:${agentId}`,
  agentOnline: () => `agents:online`,
  
  // Bot settings
  botSettings: () => `settings:bot`,
  queueSettings: () => `settings:queue`,
  
  // Scheduled messages
  scheduledPending: () => `scheduled:pending`,
  scheduledBySession: (sessionId: string) => `scheduled:session:${sessionId}`,
  
  // User data
  user: (telegramId: number) => `user:${telegramId}`,
  userCustomFields: (telegramId: number) => `user:${telegramId}:fields`,
  userCustomFieldsPending: () => `ucf:pending:sync`, // List of pending syncs
  
  // Custom Field Definitions (rarely change, cache longer)
  customFieldDefinitions: () => `cfd:all`,
  customFieldDefinition: (fieldId: string) => `cfd:${fieldId}`,
  customFieldByKey: (key: string) => `cfd:key:${key}`,
  
  // Saved replies
  savedReplies: () => `saved:replies:all`,
  savedReply: (id: string) => `saved:reply:${id}`,
  
  // Tags
  tags: () => `tags:all`,
  
  // Contacts PRO
  contact: (telegramId: number) => `contact:${telegramId}`,
  contactProfile: (telegramId: number) => `contact:profile:${telegramId}`,
  contactList: (page: number, hash: string) => `contacts:list:${page}:${hash}`,
  contactStats: () => `contacts:stats`,
  
  // Segments
  segments: () => `segments:all`,
  segment: (segmentId: string) => `segment:${segmentId}`,
  segmentContacts: (segmentId: string, page: number) => `segment:${segmentId}:contacts:${page}`,
  segmentCount: (segmentId: string) => `segment:${segmentId}:count`,
  
  // Saved Views
  savedViews: (userId?: string) => userId ? `views:${userId}` : `views:global`,
  
  // Stats
  stats: (type: string) => `stats:${type}`,
} as const;

// ============= CACHE TTLs (in seconds) =============

export const CacheTTL = {
  SHORT: 60,           // 1 minute - for frequently changing data
  MEDIUM: 300,         // 5 minutes - for semi-stable data
  LONG: 3600,          // 1 hour - for stable data
  VERY_LONG: 86400,    // 24 hours - for rarely changing data
  
  // Specific TTLs
  FLOW: 1800,          // 30 min - flows change occasionally
  FLOW_EXECUTION: 900, // 15 min - active executions, refreshed on activity
  SESSION: 300,        // 5 min - session data changes frequently
  AGENT: 600,          // 10 min - agent data is semi-stable
  SETTINGS: 3600,      // 1 hour - settings rarely change
  USER: 1800,          // 30 min - user data is semi-stable
  USER_CUSTOM_FIELDS: 600, // 10 min - user custom fields
  CUSTOM_FIELD_DEFS: 7200, // 2 hours - field definitions rarely change
  STATS: 60,           // 1 min - stats update frequently
} as const;

// ============= GENERIC CACHE OPERATIONS =============

export interface CacheOptions {
  ttl?: number;
  skipCache?: boolean;
  forceRefresh?: boolean;
}

/**
 * Get from cache or fetch from DB
 * Pattern: Cache-aside with automatic population
 */
export async function getOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = CacheTTL.MEDIUM, skipCache = false, forceRefresh = false } = options;

  // Skip cache if requested
  if (skipCache) {
    return fetcher();
  }

  // Try cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await redis.getJSON<T>(key);
    if (cached !== null) {
      return cached;
    }
  }

  // Fetch from DB
  const data = await fetcher();

  // Cache the result (async, don't wait)
  if (data !== null && data !== undefined) {
    redis.setJSON(key, data, ttl).catch(err => {
      logger.warn('cache', { action: 'cache_set_failed', key, error: String(err) });
    });
  }

  return data;
}

/**
 * Invalidate cache key(s)
 */
export async function invalidate(keys: string | string[]): Promise<void> {
  const keyArray = Array.isArray(keys) ? keys : [keys];
  
  for (const key of keyArray) {
    await redis.del(key);
  }

  logger.debug('cache', { action: 'invalidated', keys: keyArray });
}

/**
 * Invalidate by pattern
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  const count = await redis.delByPattern(pattern);
  logger.debug('cache', { action: 'invalidated_pattern', pattern, count });
  return count;
}

// ============= FLOW CACHE =============

/**
 * Strip versions array from flow to reduce cache size
 * Versions can be very large and are not needed for execution
 */
function stripFlowVersions(flow: any): any {
  if (!flow) return flow;
  const { versions, ...flowWithoutVersions } = flow;
  return flowWithoutVersions;
}

export const FlowCache = {
  /**
   * Get cached flow by ID
   */
  async get(flowId: string): Promise<any | null> {
    return redis.getJSON(CacheKeys.flow(flowId));
  },

  /**
   * Cache a flow (without versions to save space)
   */
  async set(flowId: string, flow: any): Promise<boolean> {
    const flowToCache = stripFlowVersions(flow);
    return redis.setJSON(CacheKeys.flow(flowId), flowToCache, CacheTTL.FLOW);
  },

  /**
   * Update flow in cache and invalidate trigger caches
   * Use this when a flow is updated to keep cache fresh
   */
  async updateFlowCache(flow: any): Promise<void> {
    if (!flow || !flow._id) return;
    
    const flowId = flow._id.toString();
    const flowToCache = stripFlowVersions(
      typeof flow.toObject === 'function' ? flow.toObject() : flow
    );
    
    // Update the flow cache
    await redis.setJSON(CacheKeys.flow(flowId), flowToCache, CacheTTL.FLOW);
    
    // Invalidate trigger-based caches so they get refreshed with new flow data
    await invalidatePattern('flow:trigger:*');
    await invalidatePattern('flow:keyword:*');
    await invalidate([CacheKeys.flowActiveList()]);
    
    // Publish event for other workers
    await redis.publish('cache:invalidate', { type: 'flow_updated', flowId });
    
    logger.info('cache', { action: 'flow_cache_updated', flowId });
  },

  /**
   * Invalidate all cache for a flow
   */
  async invalidateFlow(flowId: string): Promise<void> {
    await invalidate([
      CacheKeys.flow(flowId),
      CacheKeys.flowPublished(flowId),
      CacheKeys.flowActiveList(),
    ]);
    
    // Also invalidate trigger-based caches (we don't know which triggers this flow had)
    await invalidatePattern('flow:trigger:*');
    await invalidatePattern('flow:keyword:*');
    
    // Publish event for other workers
    await redis.publish('cache:invalidate', { type: 'flow', flowId });
    
    logger.info('cache', { action: 'flow_invalidated', flowId });
  },

  /**
   * Invalidate all flow caches
   */
  async invalidateAllFlows(): Promise<void> {
    await invalidatePattern('flow:*');
    await redis.publish('cache:invalidate', { type: 'all_flows' });
    logger.info('cache', { action: 'all_flows_invalidated' });
  },
};

// ============= SESSION CACHE =============

export const SessionCache = {
  /**
   * Invalidate session cache
   */
  async invalidateSession(sessionId: string, chatId?: number): Promise<void> {
    const keys = [CacheKeys.session(sessionId)];
    if (chatId) {
      keys.push(CacheKeys.sessionByChat(chatId));
    }
    await invalidate(keys);
  },
};

// ============= SETTINGS CACHE =============

export const SettingsCache = {
  /**
   * Invalidate bot settings
   */
  async invalidateBotSettings(): Promise<void> {
    await invalidate(CacheKeys.botSettings());
    await redis.publish('cache:invalidate', { type: 'bot_settings' });
  },

  /**
   * Invalidate queue settings
   */
  async invalidateQueueSettings(): Promise<void> {
    await invalidate(CacheKeys.queueSettings());
    await redis.publish('cache:invalidate', { type: 'queue_settings' });
  },
};

// ============= USER CACHE =============

export const UserCache = {
  /**
   * Invalidate user cache
   */
  async invalidateUser(telegramId: number): Promise<void> {
    await invalidate([
      CacheKeys.user(telegramId),
      CacheKeys.userCustomFields(telegramId),
    ]);
  },
};

// ============= SAVED REPLIES CACHE =============

export const SavedRepliesCache = {
  /**
   * Invalidate all saved replies
   */
  async invalidate(): Promise<void> {
    await invalidatePattern('saved:*');
  },
};

// ============= CACHE WARMING =============

/**
 * Warm up critical caches on startup
 * Called after Redis connects
 */
export async function warmupCache(): Promise<void> {
  if (!redis.isRedisAvailable()) {
    logger.warn('cache', { action: 'warmup_skipped', reason: 'redis_unavailable' });
    return;
  }

  logger.info('cache', { action: 'warmup_started' });

  try {
    // Note: Actual warming would import and cache flows, settings, etc.
    // For now, we just log that warmup is ready
    // The actual caching happens on first access (lazy warming)
    
    logger.info('cache', { action: 'warmup_completed' });
  } catch (error) {
    logger.error('cache', { 
      action: 'warmup_failed', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

// ============= CACHE STATS =============

export function getCacheStats() {
  return redis.getRedisHealth();
}

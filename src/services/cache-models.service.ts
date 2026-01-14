/**
 * Cache Models Service
 * Write-behind caching for high-frequency models
 * 
 * Strategy:
 * - FlowExecutions: Write to Redis immediately, sync to MongoDB in background
 * - CustomFieldDefinitions: Read-through cache (rarely change)
 * - UserCustomFields: Write-behind per user
 * 
 * Benefits:
 * - Super fast reads/writes during flow execution
 * - MongoDB not overwhelmed during high traffic
 * - Data eventually persisted to DB
 */

import * as redis from './redis.js';
import { CacheKeys, CacheTTL, invalidate, getOrFetch } from './cache.js';
import { logger } from './logger.js';
import { FlowExecution, type IFlowExecution } from '../database/models/FlowExecution.js';
import { CustomFieldDefinition, UserCustomField } from '../database/models/CustomField.js';
import mongoose from 'mongoose';

// ============= WRITE-BEHIND QUEUE =============

// In-memory queue for pending DB writes (backup if Redis list fails)
const pendingWrites = new Map<string, { type: string; data: any; timestamp: number }>();

// Sync interval (5 seconds for flow executions, 30 seconds for user fields)
const SYNC_INTERVAL_MS = 5000;
const USER_FIELDS_SYNC_INTERVAL_MS = 30000;

let syncIntervalId: NodeJS.Timeout | null = null;
let userFieldsSyncIntervalId: NodeJS.Timeout | null = null;

// ============= FLOW EXECUTION CACHE =============

export const FlowExecutionCache = {
  /**
   * Get execution from cache or DB
   */
  async get(executionId: string): Promise<IFlowExecution | null> {
    // Try Redis first
    const cached = await redis.getJSON<any>(CacheKeys.flowExecution(executionId));
    if (cached) {
      // Reconstruct dates
      return this.hydrateExecution(cached);
    }

    // Fall back to DB
    const execution = await FlowExecution.findById(executionId);
    if (execution) {
      // Cache it
      await this.set(execution);
    }
    return execution;
  },

  /**
   * Get active execution for a chat
   */
  async getActiveForChat(chatId: number): Promise<IFlowExecution | null> {
    // Try to get from Redis index
    const executionId = await redis.get(CacheKeys.flowExecutionActive(chatId));
    if (executionId) {
      return this.get(executionId);
    }

    // Fall back to DB
    const execution = await FlowExecution.findOne({
      chatId,
      status: { $in: ['running', 'waiting', 'paused'] },
    }).sort({ createdAt: -1 });

    if (execution) {
      await this.set(execution);
    }
    return execution;
  },

  /**
   * Get execution by session
   */
  async getBySession(sessionId: string, statuses?: string[]): Promise<IFlowExecution | null> {
    // Try cache first
    const executionId = await redis.get(CacheKeys.flowExecutionBySession(sessionId));
    if (executionId) {
      const execution = await this.get(executionId);
      if (execution && (!statuses || statuses.includes(execution.status))) {
        return execution;
      }
    }

    // Fall back to DB
    const query: any = { sessionId };
    if (statuses) {
      query.status = { $in: statuses };
    }
    const execution = await FlowExecution.findOne(query).sort({ createdAt: -1 });
    if (execution) {
      await this.set(execution);
    }
    return execution;
  },

  /**
   * Save execution to cache (write-behind to DB)
   */
  async set(execution: IFlowExecution, skipDbSync = false): Promise<void> {
    const executionId = execution._id.toString();
    const plain = typeof execution.toObject === 'function' ? execution.toObject() : execution;
    
    // Convert ObjectIds to strings for JSON serialization
    const serializable = {
      ...plain,
      _id: executionId,
      flowId: plain.flowId?.toString?.() || plain.flowId,
    };

    // Save to Redis
    await redis.setJSON(CacheKeys.flowExecution(executionId), serializable, CacheTTL.FLOW_EXECUTION);

    // Update indexes
    if (plain.chatId) {
      if (['running', 'waiting', 'paused'].includes(plain.status)) {
        await redis.set(CacheKeys.flowExecutionActive(plain.chatId), executionId, CacheTTL.FLOW_EXECUTION);
      } else {
        // Clear active index if completed/failed
        await redis.del(CacheKeys.flowExecutionActive(plain.chatId));
      }
    }
    if (plain.sessionId) {
      await redis.set(CacheKeys.flowExecutionBySession(plain.sessionId), executionId, CacheTTL.FLOW_EXECUTION);
    }

    // Queue for DB sync (unless skipped)
    if (!skipDbSync) {
      await this.queueForSync(executionId, serializable);
    }
  },

  /**
   * Create new execution (always writes to DB immediately for ID generation)
   */
  async create(data: Partial<IFlowExecution>): Promise<IFlowExecution> {
    // Create in DB to get _id
    const execution = await FlowExecution.create(data);
    // Cache it
    await this.set(execution, true); // Skip DB sync since we just created it
    return execution;
  },

  /**
   * Update execution (cache first, DB async)
   */
  async update(executionId: string, updates: Partial<IFlowExecution>): Promise<IFlowExecution | null> {
    // Get current state
    let execution = await this.get(executionId);
    if (!execution) {
      return null;
    }

    // Merge updates
    const plain = typeof execution.toObject === 'function' ? execution.toObject() : execution;
    const updated = { ...plain, ...updates, updatedAt: new Date() };
    
    // Save to cache
    await this.set(updated as IFlowExecution);

    return updated as IFlowExecution;
  },

  /**
   * Queue execution for DB sync
   */
  async queueForSync(executionId: string, data: any): Promise<void> {
    // Add to Redis list for persistence
    const queueKey = CacheKeys.flowExecutionPending();
    const entry = JSON.stringify({ id: executionId, ts: Date.now() });
    
    try {
      const client = redis.getRedisClient();
      if (client) {
        // Use SADD for deduplication
        await client.sadd(queueKey, executionId);
      }
    } catch (error) {
      // Fallback to in-memory queue
      pendingWrites.set(`exec:${executionId}`, {
        type: 'flow_execution',
        data,
        timestamp: Date.now(),
      });
    }
  },

  /**
   * Sync pending executions to DB (called by background job)
   */
  async syncToDb(): Promise<number> {
    let synced = 0;
    const client = redis.getRedisClient();
    
    if (!client) {
      // Sync from in-memory queue
      for (const [key, entry] of pendingWrites) {
        if (entry.type === 'flow_execution') {
          try {
            await this.persistToDb(entry.data._id || key.replace('exec:', ''), entry.data);
            pendingWrites.delete(key);
            synced++;
          } catch (error) {
            logger.error('cache-models', { action: 'sync_error', key, error: String(error) });
          }
        }
      }
      return synced;
    }

    // Get pending IDs from Redis
    const queueKey = CacheKeys.flowExecutionPending();
    const pendingIds = await client.smembers(queueKey);

    for (const executionId of pendingIds) {
      try {
        // Get cached data
        const cached = await redis.getJSON<any>(CacheKeys.flowExecution(executionId));
        if (cached) {
          await this.persistToDb(executionId, cached);
          synced++;
        }
        // Remove from pending set
        await client.srem(queueKey, executionId);
      } catch (error) {
        logger.error('cache-models', { 
          action: 'sync_execution_error', 
          executionId, 
          error: String(error) 
        });
      }
    }

    if (synced > 0) {
      logger.debug('cache-models', { action: 'sync_executions', count: synced });
    }

    return synced;
  },

  /**
   * Persist single execution to DB
   */
  async persistToDb(executionId: string, data: any): Promise<void> {
    // Convert string IDs back to ObjectIds
    const dbData = { ...data };
    if (typeof dbData.flowId === 'string') {
      dbData.flowId = new mongoose.Types.ObjectId(dbData.flowId);
    }
    delete dbData._id; // Don't try to update _id

    await FlowExecution.findByIdAndUpdate(
      executionId,
      { $set: dbData },
      { upsert: false }
    );
  },

  /**
   * Invalidate execution cache
   */
  async invalidate(executionId: string, chatId?: number, sessionId?: string): Promise<void> {
    const keys = [CacheKeys.flowExecution(executionId)];
    if (chatId) keys.push(CacheKeys.flowExecutionActive(chatId));
    if (sessionId) keys.push(CacheKeys.flowExecutionBySession(sessionId));
    await invalidate(keys);
  },

  /**
   * Hydrate execution from JSON (convert dates, etc.)
   */
  hydrateExecution(data: any): IFlowExecution {
    // Convert date strings back to Date objects
    const dates = ['startedAt', 'completedAt', 'pausedAt', 'cancelledAt', 'waitingUntil', 'createdAt', 'updatedAt'];
    for (const field of dates) {
      if (data[field] && typeof data[field] === 'string') {
        data[field] = new Date(data[field]);
      }
    }
    if (data.context) {
      if (data.context.startedAt) data.context.startedAt = new Date(data.context.startedAt);
      if (data.context.lastActiveAt) data.context.lastActiveAt = new Date(data.context.lastActiveAt);
    }
    if (data.steps) {
      for (const step of data.steps) {
        if (step.startedAt) step.startedAt = new Date(step.startedAt);
        if (step.completedAt) step.completedAt = new Date(step.completedAt);
      }
    }
    return data as IFlowExecution;
  },
};

// ============= CUSTOM FIELD DEFINITIONS CACHE =============

export const CustomFieldDefinitionCache = {
  /**
   * Get all active field definitions (cached)
   */
  async getAll(activeOnly = true): Promise<any[]> {
    const key = CacheKeys.customFieldDefinitions();
    
    return getOrFetch(
      key,
      async () => {
        const query = activeOnly ? { isActive: true } : {};
        const fields = await CustomFieldDefinition.find(query).sort({ order: 1, name: 1 }).lean();
        return fields.map(f => ({
          ...f,
          _id: f._id.toString(),
          createdBy: f.createdBy?.toString(),
        }));
      },
      { ttl: CacheTTL.CUSTOM_FIELD_DEFS }
    );
  },

  /**
   * Get field by key (cached)
   */
  async getByKey(key: string): Promise<any | null> {
    const cacheKey = CacheKeys.customFieldByKey(key.toLowerCase());
    
    return getOrFetch(
      cacheKey,
      async () => {
        const field = await CustomFieldDefinition.findOne({ key: key.toLowerCase() }).lean();
        if (!field) return null;
        return {
          ...field,
          _id: field._id.toString(),
          createdBy: field.createdBy?.toString(),
        };
      },
      { ttl: CacheTTL.CUSTOM_FIELD_DEFS }
    );
  },

  /**
   * Invalidate all field definition caches
   */
  async invalidateAll(): Promise<void> {
    await invalidate(CacheKeys.customFieldDefinitions());
    // Also invalidate by-key caches
    await redis.delByPattern('cfd:key:*');
    logger.info('cache-models', { action: 'cfd_invalidated' });
  },

  /**
   * Invalidate specific field
   */
  async invalidate(fieldId: string, key?: string): Promise<void> {
    const keys = [
      CacheKeys.customFieldDefinition(fieldId),
      CacheKeys.customFieldDefinitions(),
    ];
    if (key) {
      keys.push(CacheKeys.customFieldByKey(key));
    }
    await invalidate(keys);
  },
};

// ============= USER CUSTOM FIELDS CACHE =============

export const UserCustomFieldsCache = {
  /**
   * Get all custom fields for a user
   */
  async get(userId: string | mongoose.Types.ObjectId): Promise<any[]> {
    const userIdStr = userId.toString();
    const cacheKey = CacheKeys.userCustomFields(parseInt(userIdStr) || 0);
    
    return getOrFetch(
      cacheKey,
      async () => {
        const fields = await UserCustomField.find({ user: userId })
          .populate('field')
          .lean();
        return fields.map(f => ({
          ...f,
          _id: f._id.toString(),
          user: f.user?.toString(),
          field: f.field ? { ...f.field, _id: (f.field as any)._id?.toString() } : null,
          updatedBy: f.updatedBy?.toString(),
        }));
      },
      { ttl: CacheTTL.USER_CUSTOM_FIELDS }
    );
  },

  /**
   * Set a user custom field value (cache + async DB)
   */
  async set(
    userId: string | mongoose.Types.ObjectId,
    fieldId: string | mongoose.Types.ObjectId,
    value: any,
    updatedBy: string | mongoose.Types.ObjectId
  ): Promise<void> {
    const userIdStr = userId.toString();
    const fieldIdStr = fieldId.toString();
    const updatedByStr = updatedBy.toString();

    // Invalidate cache immediately
    await this.invalidate(userIdStr);

    // Queue for DB write
    await this.queueForSync(userIdStr, fieldIdStr, value, updatedByStr);
  },

  /**
   * Queue user field update for DB sync
   */
  async queueForSync(
    userId: string,
    fieldId: string,
    value: any,
    updatedBy: string
  ): Promise<void> {
    const queueKey = CacheKeys.userCustomFieldsPending();
    const entry = JSON.stringify({ userId, fieldId, value, updatedBy, ts: Date.now() });
    
    const client = redis.getRedisClient();
    if (client) {
      try {
        // Use list for FIFO processing
        await client.rpush(queueKey, entry);
      } catch (error) {
        // Direct DB write as fallback
        await this.persistToDb(userId, fieldId, value, updatedBy);
      }
    } else {
      // Direct DB write
      await this.persistToDb(userId, fieldId, value, updatedBy);
    }
  },

  /**
   * Sync pending user field updates to DB
   */
  async syncToDb(): Promise<number> {
    const client = redis.getRedisClient();
    if (!client) return 0;

    const queueKey = CacheKeys.userCustomFieldsPending();
    let synced = 0;
    
    // Process up to 100 entries per cycle
    for (let i = 0; i < 100; i++) {
      const entry = await client.lpop(queueKey);
      if (!entry) break;

      try {
        const { userId, fieldId, value, updatedBy } = JSON.parse(entry);
        await this.persistToDb(userId, fieldId, value, updatedBy);
        synced++;
      } catch (error) {
        logger.error('cache-models', { 
          action: 'sync_user_field_error', 
          error: String(error) 
        });
      }
    }

    if (synced > 0) {
      logger.debug('cache-models', { action: 'sync_user_fields', count: synced });
    }

    return synced;
  },

  /**
   * Persist user field to DB
   */
  async persistToDb(
    userId: string,
    fieldId: string,
    value: any,
    updatedBy: string
  ): Promise<void> {
    await UserCustomField.findOneAndUpdate(
      { 
        user: new mongoose.Types.ObjectId(userId), 
        field: new mongoose.Types.ObjectId(fieldId) 
      },
      { 
        $set: { 
          value, 
          updatedBy: new mongoose.Types.ObjectId(updatedBy) 
        } 
      },
      { upsert: true }
    );
  },

  /**
   * Invalidate user's field cache
   */
  async invalidate(userId: string | number): Promise<void> {
    const telegramId = typeof userId === 'string' ? parseInt(userId) || 0 : userId;
    await invalidate(CacheKeys.userCustomFields(telegramId));
  },
};

// ============= BACKGROUND SYNC JOBS =============

/**
 * Start background sync jobs
 */
export function startCacheSync(): void {
  if (syncIntervalId) return;

  // Flow executions sync (every 5 seconds)
  syncIntervalId = setInterval(async () => {
    try {
      await FlowExecutionCache.syncToDb();
    } catch (error) {
      logger.error('cache-models', { action: 'sync_interval_error', error: String(error) });
    }
  }, SYNC_INTERVAL_MS);

  // User fields sync (every 30 seconds)
  userFieldsSyncIntervalId = setInterval(async () => {
    try {
      await UserCustomFieldsCache.syncToDb();
    } catch (error) {
      logger.error('cache-models', { action: 'user_fields_sync_error', error: String(error) });
    }
  }, USER_FIELDS_SYNC_INTERVAL_MS);

  logger.info('cache-models', { action: 'sync_started' });
}

/**
 * Stop background sync jobs
 */
export function stopCacheSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  if (userFieldsSyncIntervalId) {
    clearInterval(userFieldsSyncIntervalId);
    userFieldsSyncIntervalId = null;
  }
  logger.info('cache-models', { action: 'sync_stopped' });
}

/**
 * Flush all pending writes to DB (call before shutdown)
 */
export async function flushPendingWrites(): Promise<{ executions: number; userFields: number }> {
  const executions = await FlowExecutionCache.syncToDb();
  const userFields = await UserCustomFieldsCache.syncToDb();
  
  logger.info('cache-models', { 
    action: 'flush_completed', 
    executions, 
    userFields 
  });

  return { executions, userFields };
}

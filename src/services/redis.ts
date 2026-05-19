/**
 * Redis Service
 * Centralized Redis connection management with graceful degradation
 * 
 * Features:
 * - Connection pooling
 * - Automatic reconnection
 * - Graceful fallback when Redis unavailable
 * - Health monitoring
 * - Pub/Sub support
 */

import { Redis } from 'ioredis';
import { logger } from './logger.js';

// Type for Redis instance
type RedisClient = InstanceType<typeof Redis>;

// ============= CONFIGURATION =============

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  enableOfflineQueue?: boolean;
  connectTimeout?: number;
  lazyConnect?: boolean;
}

const DEFAULT_CONFIG: RedisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: 'trelk:support:',
  maxRetriesPerRequest: 3,
  enableOfflineQueue: false,
  connectTimeout: 5000,
  lazyConnect: true,
};

// ============= STATE =============

let redisClient: RedisClient | null = null;
let subscriberClient: RedisClient | null = null;
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

// Health metrics
let lastSuccessfulOperation = Date.now();
let operationCount = 0;
let cacheHits = 0;
let cacheMisses = 0;
let errorCount = 0;

// ============= CONNECTION MANAGEMENT =============

/**
 * Create a new Redis client instance
 */
function createClient(config: RedisConfig = DEFAULT_CONFIG): RedisClient {
  const client = new Redis({
    host: config.host,
    port: config.port,
    password: config.password,
    db: config.db,
    keyPrefix: config.keyPrefix,
    maxRetriesPerRequest: config.maxRetriesPerRequest,
    enableOfflineQueue: config.enableOfflineQueue,
    connectTimeout: config.connectTimeout,
    lazyConnect: config.lazyConnect,
    retryStrategy(times: number) {
      if (times > MAX_CONNECTION_ATTEMPTS) {
        logger.error('redis', { 
          action: 'max_retries_exceeded', 
          attempts: times 
        });
        return null; // Stop retrying
      }
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
  });

  // Event handlers
  client.on('connect', () => {
    logger.info('redis', { action: 'connecting' });
  });

  client.on('ready', () => {
    isConnected = true;
    connectionAttempts = 0;
    logger.info('redis', { action: 'ready' });
  });

  client.on('error', (error: Error) => {
    errorCount++;
    logger.error('redis', { 
      action: 'error', 
      error: error.message 
    });
  });

  client.on('close', () => {
    isConnected = false;
    logger.warn('redis', { action: 'connection_closed' });
  });

  client.on('reconnecting', () => {
    connectionAttempts++;
    logger.info('redis', { 
      action: 'reconnecting', 
      attempt: connectionAttempts 
    });
  });

  return client;
}

/**
 * Initialize Redis connection
 */
export async function initializeRedis(config?: Partial<RedisConfig>): Promise<boolean> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    // Main client for commands
    redisClient = createClient(mergedConfig);
    
    // Separate client for pub/sub
    subscriberClient = createClient({
      ...mergedConfig,
      keyPrefix: undefined, // Pub/sub doesn't use key prefix
    });

    // Connect both clients
    await Promise.all([
      redisClient.connect(),
      subscriberClient.connect(),
    ]);

    logger.info('redis', { action: 'both_clients_connected' });
    return true;
  } catch (error) {
    logger.warn('redis', {
      action: 'init_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    isConnected = false;
    return false;
  }
}

/**
 * Gracefully disconnect Redis
 */
export async function disconnectRedis(): Promise<void> {
  try {
    if (subscriberClient) {
      await subscriberClient.quit();
      subscriberClient = null;
    }
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
    }
    isConnected = false;
    logger.info('redis', { action: 'disconnected' });
  } catch (error) {
    logger.error('redis', {
      action: 'disconnect_error',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Alias for disconnectRedis (used in server.ts)
 */
export const closeRedis = disconnectRedis;

/**
 * Check if Redis is connected
 */
export function isRedisConnected(): boolean {
  return isConnected && redisClient !== null;
}

// ============= BASIC OPERATIONS =============

/**
 * Check if Redis is available
 */
export function isRedisAvailable(): boolean {
  return isConnected && redisClient !== null;
}

/**
 * Get Redis client (for direct operations)
 */
export function getRedisClient(): RedisClient | null {
  return redisClient;
}

/**
 * Get subscriber client (for pub/sub)
 */
export function getSubscriberClient(): RedisClient | null {
  return subscriberClient;
}

/**
 * Safe GET with fallback
 */
export async function get(key: string): Promise<string | null> {
  if (!isRedisAvailable()) return null;
  
  try {
    operationCount++;
    const value = await redisClient!.get(key);
    if (value) {
      cacheHits++;
      lastSuccessfulOperation = Date.now();
    } else {
      cacheMisses++;
    }
    return value;
  } catch (error) {
    errorCount++;
    logger.error('redis', { action: 'get_error', key, error: String(error) });
    return null;
  }
}

/**
 * Safe SET with TTL
 */
export async function set(
  key: string, 
  value: string, 
  ttlSeconds?: number
): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  
  try {
    operationCount++;
    if (ttlSeconds) {
      await redisClient!.setex(key, ttlSeconds, value);
    } else {
      await redisClient!.set(key, value);
    }
    lastSuccessfulOperation = Date.now();
    return true;
  } catch (error) {
    errorCount++;
    logger.error('redis', { action: 'set_error', key, error: String(error) });
    return false;
  }
}

/**
 * Safe DELETE
 */
export async function del(key: string | string[]): Promise<number> {
  if (!isRedisAvailable()) return 0;
  
  try {
    operationCount++;
    const keys = Array.isArray(key) ? key : [key];
    const count = await redisClient!.del(...keys);
    lastSuccessfulOperation = Date.now();
    return count;
  } catch (error) {
    errorCount++;
    logger.error('redis', { action: 'del_error', key, error: String(error) });
    return 0;
  }
}

/**
 * Get TTL (Time To Live) of a key in seconds
 * Returns -1 if key has no TTL, -2 if key doesn't exist
 */
export async function getTTL(key: string): Promise<number> {
  if (!isRedisAvailable()) return -2;
  
  try {
    operationCount++;
    const ttl = await redisClient!.ttl(key);
    lastSuccessfulOperation = Date.now();
    return ttl;
  } catch (error) {
    errorCount++;
    logger.error('redis', { action: 'ttl_error', key, error: String(error) });
    return -2;
  }
}

/**
 * Delete by pattern (for invalidation)
 */
export async function delByPattern(pattern: string): Promise<number> {
  if (!isRedisAvailable()) return 0;
  
  try {
    operationCount++;
    // Use SCAN instead of KEYS for production safety
    let cursor = '0';
    let deleted = 0;
    
    // Add prefix to pattern for SCAN to find keys correctly
    const prefix = DEFAULT_CONFIG.keyPrefix || '';
    const fullPattern = prefix + pattern;
    
    do {
      const [nextCursor, keys] = await redisClient!.scan(
        cursor, 
        'MATCH', 
        fullPattern, 
        'COUNT', 
        100
      );
      cursor = nextCursor;
      
      if (keys.length > 0) {
        // Remove prefix from keys since del will add it again via ioredis keyPrefix
        const keysWithoutPrefix = keys.map((k: string) => 
          k.startsWith(prefix) ? k.slice(prefix.length) : k
        );
        deleted += await redisClient!.del(...keysWithoutPrefix);
      }
    } while (cursor !== '0');
    
    lastSuccessfulOperation = Date.now();
    logger.debug('redis', { action: 'del_by_pattern', pattern: fullPattern, deleted });
    return deleted;
  } catch (error) {
    errorCount++;
    logger.error('redis', { action: 'del_pattern_error', pattern, error: String(error) });
    return 0;
  }
}

/**
 * Get JSON value
 */
export async function getJSON<T>(key: string): Promise<T | null> {
  const value = await get(key);
  if (!value) return null;
  
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Set JSON value
 */
export async function setJSON<T>(
  key: string, 
  value: T, 
  ttlSeconds?: number
): Promise<boolean> {
  try {
    return await set(key, JSON.stringify(value), ttlSeconds);
  } catch {
    return false;
  }
}

// ============= PUB/SUB =============

/**
 * Publish message to channel
 */
export async function publish(channel: string, message: string | object): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  
  try {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    await redisClient!.publish(channel, msg);
    return true;
  } catch (error) {
    logger.error('redis', { action: 'publish_error', channel, error: String(error) });
    return false;
  }
}

/**
 * Subscribe to channel
 */
export async function subscribe(
  channel: string, 
  callback: (message: string, channel: string) => void
): Promise<boolean> {
  if (!subscriberClient) return false;
  
  try {
    await subscriberClient.subscribe(channel);
    subscriberClient.on('message', (ch: string, msg: string) => {
      if (ch === channel) {
        callback(msg, ch);
      }
    });
    return true;
  } catch (error) {
    logger.error('redis', { action: 'subscribe_error', channel, error: String(error) });
    return false;
  }
}

// ============= LOCKING =============

/**
 * Acquire distributed lock
 */
export async function acquireLock(
  lockKey: string, 
  ttlSeconds: number = 30,
  lockValue?: string
): Promise<string | null> {
  if (!isRedisAvailable()) return null;
  
  const value = lockValue || `lock:${process.pid}:${Date.now()}`;
  
  try {
    const result = await redisClient!.set(
      `lock:${lockKey}`, 
      value, 
      'EX', 
      ttlSeconds, 
      'NX'
    );
    return result === 'OK' ? value : null;
  } catch (error) {
    logger.error('redis', { action: 'lock_acquire_error', lockKey, error: String(error) });
    return null;
  }
}

/**
 * Release distributed lock
 */
export async function releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  
  try {
    // Use Lua script for atomic check-and-delete
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    const result = await redisClient!.eval(script, 1, `lock:${lockKey}`, lockValue);
    return result === 1;
  } catch (error) {
    logger.error('redis', { action: 'lock_release_error', lockKey, error: String(error) });
    return false;
  }
}

// ============= HEALTH & METRICS =============

/**
 * Get Redis health stats
 */
export function getRedisHealth(): {
  connected: boolean;
  lastSuccessfulOperation: Date | null;
  operationCount: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  errorCount: number;
} {
  const hitRate = operationCount > 0 
    ? (cacheHits / (cacheHits + cacheMisses)) * 100 
    : 0;

  return {
    connected: isConnected,
    lastSuccessfulOperation: lastSuccessfulOperation ? new Date(lastSuccessfulOperation) : null,
    operationCount,
    cacheHits,
    cacheMisses,
    hitRate: Math.round(hitRate * 100) / 100,
    errorCount,
  };
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
  operationCount = 0;
  cacheHits = 0;
  cacheMisses = 0;
  errorCount = 0;
}

/**
 * Ping Redis to check connectivity
 */
export async function ping(): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  
  try {
    const result = await redisClient!.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// ============= ATOMIC OPERATIONS (for fraud detection, rate limiting) =============

/**
 * Atomic increment (INCR) - returns new value
 */
export async function increment(key: string): Promise<number> {
  if (!isRedisAvailable()) return 0;
  try {
    operationCount++;
    const result = await redisClient!.incr(key);
    lastSuccessfulOperation = Date.now();
    return result;
  } catch (error) {
    errorCount++;
    logger.error('redis', { action: 'incr_error', key, error: String(error) });
    return 0;
  }
}

/**
 * Set expiration time on key (seconds)
 */
export async function expire(key: string, seconds: number): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  try {
    await redisClient!.expire(key, seconds);
    return true;
  } catch (error) {
    errorCount++;
    logger.error('redis', { action: 'expire_error', key, error: String(error) });
    return false;
  }
}

/**
 * Add member to set (SADD)
 */
export async function sadd(key: string, ...members: string[]): Promise<number> {
  if (!isRedisAvailable()) return 0;
  try {
    operationCount++;
    const result = await redisClient!.sadd(key, ...members);
    lastSuccessfulOperation = Date.now();
    return result;
  } catch (error) {
    errorCount++;
    logger.error('redis', { action: 'sadd_error', key, error: String(error) });
    return 0;
  }
}

/**
 * Get all members of set (SMEMBERS)
 */
export async function smembers(key: string): Promise<string[]> {
  if (!isRedisAvailable()) return [];
  try {
    operationCount++;
    const result = await redisClient!.smembers(key);
    lastSuccessfulOperation = Date.now();
    return result;
  } catch (error) {
    errorCount++;
    logger.error('redis', { action: 'smembers_error', key, error: String(error) });
    return [];
  }
}

/**
 * Set value only if key does not exist (SETNX)
 * Returns true if set, false if key already exists
 */
export async function setnx(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  if (!isRedisAvailable()) return false;
  try {
    operationCount++;
    let result: string | null;
    if (ttlSeconds) {
      result = await redisClient!.set(key, value, 'EX', ttlSeconds, 'NX');
    } else {
      result = await redisClient!.set(key, value, 'NX');
    }
    lastSuccessfulOperation = Date.now();
    return result === 'OK';
  } catch (error) {
    errorCount++;
    logger.error('redis', { action: 'setnx_error', key, error: String(error) });
    return false;
  }
}

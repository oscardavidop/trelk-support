/**
 * Session Guard Service
 * Ensures single active session per user (like WhatsApp Web)
 * 
 * Uses Redis to track active sessions and enforce single-session policy
 */

import { Redis } from 'ioredis';
import { logger } from './logger.js';

// ============= REDIS CONNECTION =============

const redis = new Redis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

let redisConnected = false;

redis.on('connect', () => {
  redisConnected = true;
  logger.info('session-guard', { action: 'redis_connected' });
});

redis.on('error', (err) => {
  logger.error('session-guard', { action: 'redis_error', error: err.message });
});

redis.on('close', () => {
  redisConnected = false;
});

// Try to connect
redis.connect().catch((err) => {
  logger.warn('session-guard', { action: 'redis_connect_failed', error: err.message });
});

// ============= TYPES =============

export interface ActiveSession {
  sessionId: string;     // Unique ID for this browser session (generated on login)
  socketId: string;      // Current socket.io ID
  agentId: string;       // Agent ID
  device: string;        // Browser/device info
  ip: string;            // IP address
  connectedAt: string;   // ISO timestamp
  lastActivity: string;  // ISO timestamp
  tabId?: string;        // For multi-tab tracking
}

export interface SessionValidation {
  valid: boolean;
  replaced?: boolean;
  previousSession?: ActiveSession;
  currentSession?: ActiveSession;
}

// ============= REDIS KEYS =============

const KEYS = {
  SESSION: (agentId: string) => `session:active:${agentId}`,
  SESSION_HISTORY: (agentId: string) => `session:history:${agentId}`,
  TAB_LOCK: (agentId: string) => `session:tab:${agentId}`,
};

const SESSION_TTL = 24 * 60 * 60; // 24 hours
const HISTORY_MAX_LENGTH = 10;

// ============= CORE FUNCTIONS =============

/**
 * Register a new session, replacing any existing one
 * Returns info about the replaced session if any
 */
export async function registerSession(
  agentId: string,
  socketId: string,
  sessionId: string,
  deviceInfo: { device: string; ip: string; tabId?: string }
): Promise<{ replaced: boolean; previousSession?: ActiveSession }> {
  if (!redisConnected) {
    logger.warn('session-guard', { action: 'register_skipped_no_redis', agentId });
    return { replaced: false };
  }

  const key = KEYS.SESSION(agentId);
  
  try {
    // Get existing session
    const existingRaw = await redis.get(key);
    const existing: ActiveSession | null = existingRaw ? JSON.parse(existingRaw) : null;
    
    // Create new session
    const newSession: ActiveSession = {
      sessionId,
      socketId,
      agentId,
      device: deviceInfo.device,
      ip: deviceInfo.ip,
      connectedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      tabId: deviceInfo.tabId,
    };
    
    // Save new session
    await redis.setex(key, SESSION_TTL, JSON.stringify(newSession));
    
    // If there was an existing session, add to history
    if (existing && existing.sessionId !== sessionId) {
      await addToSessionHistory(agentId, existing);
      
      logger.info('session-guard', {
        action: 'session_replaced',
        agentId,
        oldSessionId: existing.sessionId,
        newSessionId: sessionId,
        oldDevice: existing.device,
        newDevice: deviceInfo.device,
      });
      
      return { replaced: true, previousSession: existing };
    }
    
    logger.info('session-guard', {
      action: 'session_registered',
      agentId,
      sessionId,
      device: deviceInfo.device,
    });
    
    return { replaced: false };
  } catch (error) {
    logger.error('session-guard', {
      action: 'register_error',
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { replaced: false };
  }
}

/**
 * Validate if the given session is still the active one
 */
export async function validateSession(
  agentId: string,
  sessionId: string
): Promise<SessionValidation> {
  if (!redisConnected) {
    // Graceful degradation - allow if Redis is down
    return { valid: true };
  }

  const key = KEYS.SESSION(agentId);
  
  try {
    const raw = await redis.get(key);
    
    if (!raw) {
      // No active session - this one is invalid (or expired)
      return { valid: false };
    }
    
    const current: ActiveSession = JSON.parse(raw);
    
    if (current.sessionId === sessionId) {
      return { valid: true, currentSession: current };
    }
    
    // Session was replaced
    return {
      valid: false,
      replaced: true,
      currentSession: current,
    };
  } catch (error) {
    logger.error('session-guard', {
      action: 'validate_error',
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail open on error
    return { valid: true };
  }
}

/**
 * Get the active session for an agent
 */
export async function getActiveSession(agentId: string): Promise<ActiveSession | null> {
  if (!redisConnected) {
    return null;
  }

  try {
    const raw = await redis.get(KEYS.SESSION(agentId));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    logger.error('session-guard', {
      action: 'get_session_error',
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Update socket ID for an existing session (on reconnect)
 */
export async function updateSocketId(
  agentId: string,
  sessionId: string,
  newSocketId: string
): Promise<boolean> {
  if (!redisConnected) {
    return false;
  }

  const key = KEYS.SESSION(agentId);
  
  try {
    const raw = await redis.get(key);
    if (!raw) return false;
    
    const session: ActiveSession = JSON.parse(raw);
    
    // Only update if this is the active session
    if (session.sessionId !== sessionId) {
      return false;
    }
    
    session.socketId = newSocketId;
    session.lastActivity = new Date().toISOString();
    
    await redis.setex(key, SESSION_TTL, JSON.stringify(session));
    
    logger.debug('session-guard', {
      action: 'socket_id_updated',
      agentId,
      sessionId,
      newSocketId,
    });
    
    return true;
  } catch (error) {
    logger.error('session-guard', {
      action: 'update_socket_error',
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Update last activity timestamp
 */
export async function touchSession(agentId: string): Promise<void> {
  if (!redisConnected) return;

  const key = KEYS.SESSION(agentId);
  
  try {
    const raw = await redis.get(key);
    if (!raw) return;
    
    const session: ActiveSession = JSON.parse(raw);
    session.lastActivity = new Date().toISOString();
    
    await redis.setex(key, SESSION_TTL, JSON.stringify(session));
  } catch (error) {
    // Silent fail for touch
  }
}

/**
 * Remove session on logout
 */
export async function removeSession(agentId: string, sessionId?: string): Promise<boolean> {
  if (!redisConnected) {
    return false;
  }

  const key = KEYS.SESSION(agentId);
  
  try {
    // If sessionId provided, only remove if it matches
    if (sessionId) {
      const raw = await redis.get(key);
      if (raw) {
        const current: ActiveSession = JSON.parse(raw);
        if (current.sessionId !== sessionId) {
          // Don't remove - this is a different session
          return false;
        }
      }
    }
    
    await redis.del(key);
    
    logger.info('session-guard', {
      action: 'session_removed',
      agentId,
      sessionId,
    });
    
    return true;
  } catch (error) {
    logger.error('session-guard', {
      action: 'remove_error',
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Get session history for an agent
 */
export async function getSessionHistory(agentId: string): Promise<ActiveSession[]> {
  if (!redisConnected) {
    return [];
  }

  try {
    const raw = await redis.lrange(KEYS.SESSION_HISTORY(agentId), 0, -1);
    return raw.map(item => JSON.parse(item));
  } catch (error) {
    logger.error('session-guard', {
      action: 'history_error',
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// ============= HELPER FUNCTIONS =============

async function addToSessionHistory(agentId: string, session: ActiveSession): Promise<void> {
  const key = KEYS.SESSION_HISTORY(agentId);
  
  try {
    // Add to front of list
    await redis.lpush(key, JSON.stringify({
      ...session,
      terminatedAt: new Date().toISOString(),
    }));
    
    // Trim to max length
    await redis.ltrim(key, 0, HISTORY_MAX_LENGTH - 1);
    
    // Set TTL
    await redis.expire(key, SESSION_TTL * 7); // Keep history for 7 days
  } catch (error) {
    // Silent fail for history
  }
}

// ============= TAB TRACKING =============

/**
 * Register active tab for /chat page
 */
export async function registerChatTab(
  agentId: string,
  tabId: string,
  socketId: string
): Promise<{ isBlocked: boolean; activeTabId?: string }> {
  if (!redisConnected) {
    return { isBlocked: false };
  }

  const key = KEYS.TAB_LOCK(agentId);
  
  try {
    const raw = await redis.get(key);
    const existing = raw ? JSON.parse(raw) : null;
    
    // If there's an existing tab with a different tabId, block this one
    if (existing && existing.tabId !== tabId) {
      return { isBlocked: true, activeTabId: existing.tabId };
    }
    
    // Register this tab as active
    await redis.setex(key, 60, JSON.stringify({ tabId, socketId, lastSeen: Date.now() }));
    
    return { isBlocked: false };
  } catch (error) {
    logger.error('session-guard', {
      action: 'register_tab_error',
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { isBlocked: false };
  }
}

/**
 * Update tab heartbeat
 */
export async function heartbeatTab(agentId: string, tabId: string): Promise<boolean> {
  if (!redisConnected) return true;

  const key = KEYS.TAB_LOCK(agentId);
  
  try {
    const raw = await redis.get(key);
    if (!raw) {
      // Tab lock expired, re-register
      await redis.setex(key, 60, JSON.stringify({ tabId, lastSeen: Date.now() }));
      return true;
    }
    
    const existing = JSON.parse(raw);
    
    // Only the active tab can heartbeat
    if (existing.tabId !== tabId) {
      return false;
    }
    
    await redis.setex(key, 60, JSON.stringify({ ...existing, lastSeen: Date.now() }));
    return true;
  } catch (error) {
    return true; // Fail open
  }
}

/**
 * Release tab lock
 */
export async function releaseChatTab(agentId: string, tabId: string): Promise<void> {
  if (!redisConnected) return;

  const key = KEYS.TAB_LOCK(agentId);
  
  try {
    const raw = await redis.get(key);
    if (raw) {
      const existing = JSON.parse(raw);
      if (existing.tabId === tabId) {
        await redis.del(key);
      }
    }
  } catch (error) {
    // Silent fail
  }
}

/**
 * Force close all other sessions (for "close other sessions" button)
 */
export async function closeOtherSessions(agentId: string, currentSessionId: string): Promise<number> {
  // In this implementation, there's only one active session at a time
  // This function would just clear history or do nothing
  return 0;
}

// ============= CLEANUP =============

export async function cleanup(): Promise<void> {
  try {
    await redis.quit();
  } catch (error) {
    // Ignore cleanup errors
  }
}

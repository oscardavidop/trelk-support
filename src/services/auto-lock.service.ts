/**
 * Auto-Lock Service
 * Handles session locking by inactivity and re-authentication
 */

import { getRedisClient } from './redis.js';
import { getSecuritySettings } from './settings-cache.service.js';
import { findAgentById, findAgentByEmail } from './agent.service.js';
import { Agent } from '../database/models/Agent.js';
import { logAuditFromRequest } from './audit-log.service.js';
import { logger } from './logger.js';
import { getIO, agentSockets } from './socket.js';
import type { FastifyRequest } from 'fastify';
import type { IAgent } from '../database/index.js';

// Redis key prefixes
const LOCK_STATE_KEY = 'autolock:state:';
const LOCK_ATTEMPTS_KEY = 'autolock:attempts:';
const REMOTE_LOCK_KEY = 'autolock:remote:';

// Constants
const MAX_UNLOCK_ATTEMPTS = 5;
const UNLOCK_LOCKOUT_MINUTES = 15;
const LOCK_STATE_TTL = 86400; // 24 hours

export interface LockState {
  isLocked: boolean;
  lockedAt?: string;
  reason: 'inactivity' | 'remote' | 'manual' | 'security';
  lockedBy?: string;          // For remote locks - who initiated it
  lastActivityAt?: string;
  unlockAttempts?: number;
  lockedUntil?: string;       // If locked out due to failed attempts
}

export interface UnlockResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
  lockoutUntil?: string;
}

export interface AutoLockSettings {
  enabled: boolean;
  timeoutMinutes: number;
  requirePassword: boolean;
  requireMFA: boolean;
  showLastActivity: boolean;
  gracePeriodSeconds: number;
  roleTimeouts: {
    admin: number;
    supervisor: number;
    agent: number;
  };
  exemptRoles: string[];
}

/**
 * Get auto-lock settings from security settings
 */
export async function getAutoLockSettings(): Promise<AutoLockSettings> {
  const security = await getSecuritySettings();
  
  return {
    enabled: security.autoLockEnabled ?? false,
    timeoutMinutes: security.autoLockTimeoutMinutes ?? 15,
    requirePassword: security.autoLockRequirePassword ?? true,
    requireMFA: security.autoLockRequireMFA ?? false,
    showLastActivity: security.autoLockShowLastActivity ?? true,
    gracePeriodSeconds: security.autoLockGracePeriodSeconds ?? 30,
    roleTimeouts: {
      admin: security.autoLockRoleTimeouts?.admin ?? 5,
      supervisor: security.autoLockRoleTimeouts?.supervisor ?? 10,
      agent: security.autoLockRoleTimeouts?.agent ?? 15,
    },
    exemptRoles: security.autoLockExemptRoles ?? [],
  };
}

/**
 * Get timeout for a specific agent based on their role
 */
export async function getTimeoutForAgent(agent: IAgent): Promise<number | null> {
  const settings = await getAutoLockSettings();
  
  if (!settings.enabled) {
    return null; // Auto-lock disabled
  }
  
  // Check if role is exempt
  if (settings.exemptRoles.includes(agent.role)) {
    return null;
  }
  
  // Get role-specific timeout or default
  const roleTimeouts = settings.roleTimeouts as Record<string, number>;
  return roleTimeouts[agent.role] ?? settings.timeoutMinutes;
}

/**
 * Check if agent is currently locked
 */
export async function isAgentLocked(agentId: string): Promise<LockState | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  
  try {
    const stateJson = await redis.get(`${LOCK_STATE_KEY}${agentId}`);
    if (!stateJson) return null;
    
    return JSON.parse(stateJson) as LockState;
  } catch (error) {
    logger.error('auto-lock', { message: 'Failed to get lock state', agentId, error: String(error) });
    return null;
  }
}

/**
 * Lock an agent's session
 */
export async function lockAgent(
  agentId: string,
  reason: LockState['reason'],
  lockedBy?: string,
  request?: FastifyRequest
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  
  const now = new Date().toISOString();
  const lockState: LockState = {
    isLocked: true,
    lockedAt: now,
    reason,
    lockedBy,
    lastActivityAt: now,
    unlockAttempts: 0,
  };
  
  try {
    await redis.setex(
      `${LOCK_STATE_KEY}${agentId}`,
      LOCK_STATE_TTL,
      JSON.stringify(lockState)
    );
    
    // Log audit event
    if (request) {
      await logAuditFromRequest({
        request,
        action: 'session.lock',
        category: 'security',
        targetType: 'session',
        targetId: agentId,
        targetDescription: `Session locked - ${reason}`,
        newValue: { reason, lockedBy },
        severity: reason === 'security' ? 'high' : 'medium',
      });
    }
    
    logger.info('auto-lock', {
      message: 'Agent session locked',
      agentId,
      reason,
      lockedBy,
    });
    
    return true;
  } catch (error) {
    logger.error('auto-lock', { message: 'Failed to lock agent', agentId, error: String(error) });
    return false;
  }
}

/**
 * Unlock agent with password verification
 */
export async function unlockWithPassword(
  agentId: string,
  password: string,
  request?: FastifyRequest
): Promise<UnlockResult> {
  const redis = getRedisClient();
  if (!redis) {
    return { success: false, error: 'Service unavailable' };
  }
  
  // Get current lock state
  const lockState = await isAgentLocked(agentId);
  if (!lockState?.isLocked) {
    return { success: true }; // Already unlocked
  }
  
  // Check for lockout
  if (lockState.lockedUntil) {
    const lockoutTime = new Date(lockState.lockedUntil);
    if (lockoutTime > new Date()) {
      return {
        success: false,
        error: 'Demasiados intentos fallidos. Intenta de nuevo más tarde.',
        lockoutUntil: lockState.lockedUntil,
      };
    }
  }
  
  // Get agent and verify password - need to include password field
  const agent = await Agent.findById(agentId).select('+password');
  if (!agent) {
    return { success: false, error: 'Agente no encontrado' };
  }
  
  const isValidPassword = await agent.comparePassword(password);
  
  if (!isValidPassword) {
    // Increment failed attempts
    const attempts = (lockState.unlockAttempts || 0) + 1;
    const remainingAttempts = MAX_UNLOCK_ATTEMPTS - attempts;
    
    if (attempts >= MAX_UNLOCK_ATTEMPTS) {
      // Apply lockout
      const lockoutUntil = new Date(Date.now() + UNLOCK_LOCKOUT_MINUTES * 60 * 1000).toISOString();
      lockState.lockedUntil = lockoutUntil;
      lockState.unlockAttempts = attempts;
      
      await redis.setex(
        `${LOCK_STATE_KEY}${agentId}`,
        LOCK_STATE_TTL,
        JSON.stringify(lockState)
      );
      
      // Log security event
      if (request) {
        await logAuditFromRequest({
          request,
          action: 'session.unlock_lockout',
          category: 'security',
          targetType: 'session',
          targetId: agentId,
          targetDescription: 'Session unlock locked out due to failed attempts',
          newValue: { attempts, lockoutUntil },
          severity: 'high',
          isAnomaly: true,
          anomalyReason: 'Multiple failed unlock attempts',
        });
      }
      
      return {
        success: false,
        error: 'Demasiados intentos fallidos. Cuenta bloqueada temporalmente.',
        lockoutUntil,
        remainingAttempts: 0,
      };
    }
    
    // Update attempts count
    lockState.unlockAttempts = attempts;
    await redis.setex(
      `${LOCK_STATE_KEY}${agentId}`,
      LOCK_STATE_TTL,
      JSON.stringify(lockState)
    );
    
    // Log failed attempt
    if (request) {
      await logAuditFromRequest({
        request,
        action: 'session.unlock_failed',
        category: 'security',
        targetType: 'session',
        targetId: agentId,
        targetDescription: 'Failed unlock attempt',
        newValue: { attempts, remainingAttempts },
        severity: 'medium',
      });
    }
    
    return {
      success: false,
      error: 'Contraseña incorrecta',
      remainingAttempts,
    };
  }
  
  // Password is correct - unlock
  await redis.del(`${LOCK_STATE_KEY}${agentId}`);
  
  // Log successful unlock
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'session.unlock',
      category: 'security',
      targetType: 'session',
      targetId: agentId,
      targetDescription: 'Session unlocked successfully',
      previousValue: { lockedAt: lockState.lockedAt, reason: lockState.reason },
      severity: 'low',
    });
  }
  
  logger.info('auto-lock', {
    message: 'Agent session unlocked',
    agentId,
    previousLockReason: lockState.reason,
  });
  
  return { success: true };
}

/**
 * Unlock agent with MFA verification
 * This is called after MFA has been verified separately
 */
export async function unlockWithMFA(
  agentId: string,
  mfaVerified: boolean,
  request?: FastifyRequest
): Promise<UnlockResult> {
  if (!mfaVerified) {
    return { success: false, error: 'MFA verification failed' };
  }
  
  const redis = getRedisClient();
  if (!redis) {
    return { success: false, error: 'Service unavailable' };
  }
  
  const lockState = await isAgentLocked(agentId);
  if (!lockState?.isLocked) {
    return { success: true };
  }
  
  // MFA verified - unlock
  await redis.del(`${LOCK_STATE_KEY}${agentId}`);
  
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'session.unlock_mfa',
      category: 'security',
      targetType: 'session',
      targetId: agentId,
      targetDescription: 'Session unlocked via MFA',
      previousValue: { lockedAt: lockState.lockedAt, reason: lockState.reason },
      severity: 'low',
    });
  }
  
  logger.info('auto-lock', {
    message: 'Agent session unlocked via MFA',
    agentId,
  });
  
  return { success: true };
}

/**
 * Remote lock by admin
 */
export async function remoteLockAgent(
  targetAgentId: string,
  adminAgentId: string,
  adminName: string,
  request?: FastifyRequest
): Promise<{ success: boolean; error?: string }> {
  // Verify target agent exists
  const targetAgent = await findAgentById(targetAgentId);
  if (!targetAgent) {
    return { success: false, error: 'Agente no encontrado' };
  }
  
  // Verify admin is not locking themselves
  if (targetAgentId === adminAgentId) {
    return { success: false, error: 'No puedes bloquearte a ti mismo' };
  }
  
  const locked = await lockAgent(
    targetAgentId,
    'remote',
    adminName,
    request
  );
  
  if (!locked) {
    return { success: false, error: 'Error al bloquear la sesión' };
  }
  
  // Set flag for immediate lock notification
  const redis = getRedisClient();
  if (redis) {
    await redis.setex(`${REMOTE_LOCK_KEY}${targetAgentId}`, 300, 'true');
  }
  
  return { success: true };
}

/**
 * Check if there's a pending remote lock for an agent
 */
export async function checkRemoteLock(agentId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  
  const hasRemoteLock = await redis.get(`${REMOTE_LOCK_KEY}${agentId}`);
  if (hasRemoteLock) {
    // Clear the flag after checking
    await redis.del(`${REMOTE_LOCK_KEY}${agentId}`);
    return true;
  }
  return false;
}

/**
 * Update last activity timestamp (called from heartbeat)
 */
export async function updateLastActivity(agentId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  
  const lockState = await isAgentLocked(agentId);
  if (lockState?.isLocked) {
    // Don't update activity while locked
    return;
  }
  
  // Store last activity (lightweight, just the timestamp)
  await redis.setex(
    `autolock:activity:${agentId}`,
    3600, // 1 hour TTL
    new Date().toISOString()
  );
}

/**
 * Get last activity timestamp
 */
export async function getLastActivity(agentId: string): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  
  return await redis.get(`autolock:activity:${agentId}`);
}

/**
 * Force unlock (admin only, bypasses all checks)
 */
export async function forceUnlock(
  targetAgentId: string,
  adminAgentId: string,
  request?: FastifyRequest
): Promise<{ success: boolean; error?: string }> {
  const redis = getRedisClient();
  if (!redis) {
    return { success: false, error: 'Service unavailable' };
  }
  
  const lockState = await isAgentLocked(targetAgentId);
  
  await redis.del(`${LOCK_STATE_KEY}${targetAgentId}`);
  
  // Emit socket event to notify agent in real-time
  emitToAgent(targetAgentId, 'session:unlocked', { unlockedBy: adminAgentId, reason: 'admin_force' });
  
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'session.force_unlock',
      category: 'security',
      targetType: 'session',
      targetId: targetAgentId,
      targetDescription: 'Session force-unlocked by admin',
      previousValue: lockState ? { lockedAt: lockState.lockedAt, reason: lockState.reason } : undefined,
      newValue: { unlockedBy: adminAgentId },
      severity: 'high',
    });
  }
  
  logger.info('auto-lock', {
    message: 'Agent session force-unlocked by admin',
    targetAgentId,
    adminAgentId,
  });
  
  return { success: true };
}

/**
 * Clear lock state on logout (should be called when agent logs out)
 */
export async function clearLockOnLogout(agentId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  
  try {
    await redis.del(`${LOCK_STATE_KEY}${agentId}`);
    await redis.del(`${REMOTE_LOCK_KEY}${agentId}`);
    await redis.del(`autolock:activity:${agentId}`);
    
    logger.info('auto-lock', {
      message: 'Lock state cleared on logout',
      agentId,
    });
  } catch (error) {
    logger.error('auto-lock', { 
      message: 'Failed to clear lock state on logout', 
      agentId, 
      error: String(error) 
    });
  }
}

/**
 * Emit socket event to a specific agent
 */
function emitToAgent(agentId: string, event: string, data: unknown): void {
  try {
    const socket = agentSockets.get(agentId);
    if (socket) {
      socket.emit(event as any, data);
    }
  } catch (error) {
    logger.error('auto-lock', { 
      message: 'Failed to emit socket event', 
      agentId, 
      event, 
      error: String(error) 
    });
  }
}

/**
 * Remote lock with real-time notification via socket
 */
export async function remoteLockWithSocket(
  targetAgentId: string,
  adminAgentId: string,
  adminName: string,
  request?: FastifyRequest
): Promise<{ success: boolean; error?: string }> {
  const result = await remoteLockAgent(targetAgentId, adminAgentId, adminName, request);
  
  if (result.success) {
    // Emit real-time lock event to the agent
    emitToAgent(targetAgentId, 'session:locked', {
      reason: 'remote',
      lockedBy: adminName,
      lockedAt: new Date().toISOString(),
    });
  }
  
  return result;
}

/**
 * Force logout an agent via socket (for deactivation, security, etc.)
 */
export function forceLogoutAgent(agentId: string, reason: string): void {
  emitToAgent(agentId, 'session:force_logout', { reason });
  
  logger.info('auto-lock', {
    message: 'Force logout emitted',
    agentId,
    reason,
  });
}

/**
 * Notify agent that their account was deactivated
 */
export function notifyAgentDeactivated(agentId: string): void {
  emitToAgent(agentId, 'session:force_logout', { 
    reason: 'Tu cuenta ha sido desactivada por un administrador' 
  });
  
  // Also emit a more specific event
  emitToAgent(agentId, 'account:deactivated', {
    deactivatedAt: new Date().toISOString(),
  });
}

/**
 * Check if agent is currently online (has socket connection)
 */
export function isAgentOnline(agentId: string): boolean {
  return agentSockets.has(agentId);}
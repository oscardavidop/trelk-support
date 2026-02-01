/**
 * Password Reset Service
 * Complete password reset flow with security features
 * 
 * Features:
 * - Secure token generation and validation
 * - Rate limiting (Redis + DB fallback)
 * - Telegram notifications
 * - Audit logging
 * - Force password change support
 */

import { Types } from 'mongoose';
import { FastifyRequest } from 'fastify';
import {
  Agent,
  type IAgent,
  createResetToken,
  validateAndConsumeToken,
  validateTokenOnly,
  revokeAllTokensForAgent,
  getPendingTokensCount,
  invalidateAllAgentSessions,
} from '../database/index.js';
import { sendPasswordResetTelegram, sendPasswordChangedAlertTelegram } from './telegram-notifications.js';
import { logAudit, logAuditFromRequest } from './audit-log.service.js';
import { logger } from './logger.js';
import * as redis from './redis.js';
import { ENV } from '../config/index.js';

// ============= CONFIGURATION =============

const RATE_LIMIT = {
  // Per-agent limits (stored in DB)
  maxRequestsPerHour: 3,
  blockDurationHours: 1,
  
  // Per-IP limits (stored in Redis)
  maxRequestsPerIpPerWindow: 5,
  ipWindowMinutes: 15,
  
  // Token limits
  tokenExpirationMinutes: 15,
  maxPendingTokensPerAgent: 3,
};

// Dashboard URL for reset links
const getDashboardUrl = () => {
  return process.env.DASHBOARD_PUBLIC_URL || ENV.DASHBOARD_PUBLIC_URL || 'https://dash.trelk.site';
};

// ============= RATE LIMITING =============

interface RateLimitResult {
  allowed: boolean;
  remainingAttempts?: number;
  blockedUntil?: Date;
  error?: string;
}

/**
 * Check and update rate limit for password reset requests (per agent)
 */
async function checkAgentRateLimit(agentId: string): Promise<RateLimitResult> {
  const agent = await Agent.findById(agentId);
  if (!agent) {
    return { allowed: false, error: 'Agente no encontrado' };
  }

  const now = new Date();

  // Check if blocked
  if (agent.security.password.resetBlockedUntil && agent.security.password.resetBlockedUntil > now) {
    return {
      allowed: false,
      blockedUntil: agent.security.password.resetBlockedUntil,
      error: `Demasiados intentos. Intenta de nuevo después de ${agent.security.password.resetBlockedUntil.toLocaleTimeString('es-ES')}`,
    };
  }

  // Reset counter if window expired
  const windowStart = agent.security.password.resetAttemptsResetAt || new Date(0);
  const windowExpired = now.getTime() - windowStart.getTime() > 60 * 60 * 1000; // 1 hour

  let attempts = windowExpired ? 0 : (agent.security.password.resetAttempts || 0);
  
  // Check if rate limited
  if (attempts >= RATE_LIMIT.maxRequestsPerHour) {
    const blockedUntil = new Date(now.getTime() + RATE_LIMIT.blockDurationHours * 60 * 60 * 1000);
    
    await Agent.updateOne(
      { _id: agentId },
      { 
        'security.password.resetBlockedUntil': blockedUntil,
        'security.password.resetAttempts': 0,
        'security.password.resetAttemptsResetAt': blockedUntil,
      }
    );

    return {
      allowed: false,
      blockedUntil,
      error: `Demasiados intentos. Intenta de nuevo en ${RATE_LIMIT.blockDurationHours} hora(s).`,
    };
  }

  // Increment counter
  await Agent.updateOne(
    { _id: agentId },
    {
      $inc: { 'security.password.resetAttempts': 1 },
      ...(windowExpired ? { 'security.password.resetAttemptsResetAt': now } : {}),
    }
  );

  return {
    allowed: true,
    remainingAttempts: RATE_LIMIT.maxRequestsPerHour - attempts - 1,
  };
}

/**
 * Check IP-based rate limit (Redis)
 */
async function checkIpRateLimit(ip: string): Promise<RateLimitResult> {
  const key = `password_reset:ip:${ip}`;
  
  if (!redis.isRedisAvailable()) {
    // Fallback: allow if Redis is unavailable (rely on agent-level limits)
    return { allowed: true };
  }

  try {
    const current = await redis.get(key);
    const attempts = current ? parseInt(current, 10) : 0;

    if (attempts >= RATE_LIMIT.maxRequestsPerIpPerWindow) {
      return {
        allowed: false,
        error: 'Demasiadas solicitudes desde esta IP. Intenta más tarde.',
      };
    }

    // Increment with TTL
    await redis.set(
      key,
      String(attempts + 1),
      RATE_LIMIT.ipWindowMinutes * 60
    );

    return {
      allowed: true,
      remainingAttempts: RATE_LIMIT.maxRequestsPerIpPerWindow - attempts - 1,
    };
  } catch (error) {
    logger.error('password-reset', {
      action: 'ip_rate_limit_error',
      ip,
      error: String(error),
    });
    return { allowed: true }; // Allow on error
  }
}

// ============= REQUEST PASSWORD RESET =============

export interface RequestResetResult {
  success: boolean;
  message?: string;
  error?: string;
  blockedUntil?: Date;
}

/**
 * Request password reset for an agent
 * Called from admin dashboard or bot command
 */
export async function requestPasswordReset(
  agentId: string,
  options: {
    requestSource: 'telegram' | 'dashboard' | 'api' | 'admin';
    requestedBy?: string;
    ip?: string;
    userAgent?: string;
    sendViaTelegram?: boolean;
  }
): Promise<RequestResetResult> {
  try {
    // 1. Find agent
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    // 2. Check agent has Telegram (required for reset via Telegram)
    if (options.sendViaTelegram !== false && !agent.telegramId) {
      return { 
        success: false, 
        error: 'El agente no tiene Telegram vinculado. No se puede enviar el enlace de recuperación.' 
      };
    }

    // 3. Check IP rate limit
    if (options.ip) {
      const ipLimit = await checkIpRateLimit(options.ip);
      if (!ipLimit.allowed) {
        return { success: false, error: ipLimit.error };
      }
    }

    // 4. Check agent rate limit
    const agentLimit = await checkAgentRateLimit(agentId);
    if (!agentLimit.allowed) {
      return { 
        success: false, 
        error: agentLimit.error,
        blockedUntil: agentLimit.blockedUntil,
      };
    }

    // 5. Create reset token
    const { token, record } = await createResetToken(agentId, {
      requestSource: options.requestSource,
      requestedBy: options.requestedBy,
      ip: options.ip,
      userAgent: options.userAgent,
      expiresInMinutes: RATE_LIMIT.tokenExpirationMinutes,
    });

    // 6. Generate reset URL
    const resetUrl = `${getDashboardUrl()}/reset-password?token=${token}`;

    // 7. Send via Telegram (if agent has telegramId)
    if (options.sendViaTelegram !== false && agent.telegramId) {
      await sendPasswordResetTelegram(agent.telegramId, resetUrl, agent.name);
    }

    // 8. Log audit
    await logAudit({
      action: 'password_reset_requested',
      category: 'security',
      actorId: options.requestedBy || agentId,
      actorType: options.requestedBy ? 'admin' : 'agent',
      actorName: options.requestedBy ? 'Admin' : agent.name,
      targetType: 'agent',
      targetId: agentId,
      targetDescription: `Password reset for ${agent.email}`,
      severity: 'medium',
      ip: options.ip || 'unknown',
      userAgent: options.userAgent,
    });

    logger.info('password-reset', {
      action: 'reset_requested',
      agentId,
      source: options.requestSource,
      requestedBy: options.requestedBy,
      tokenId: record._id.toString(),
    });

    return {
      success: true,
      message: agent.telegramId
        ? 'Se envió un enlace de recuperación a tu Telegram'
        : 'Token de recuperación creado (no se pudo enviar: sin Telegram vinculado)',
    };
  } catch (error) {
    logger.error('password-reset', {
      action: 'request_error',
      agentId,
      error: String(error),
    });
    return { success: false, error: 'Error interno. Intenta más tarde.' };
  }
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Sanitize email input
 */
function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim().slice(0, 254);
}

/**
 * Request password reset by email (find agent, then request)
 */
export async function requestPasswordResetByEmail(
  email: string,
  options: {
    ip?: string;
    userAgent?: string;
    requestSource: 'telegram' | 'dashboard' | 'api';
  }
): Promise<RequestResetResult> {
  // Validate and sanitize email
  const sanitizedEmail = sanitizeEmail(email);
  
  if (!isValidEmail(sanitizedEmail)) {
    // Don't reveal that the format is invalid - return generic message
    logger.warn('password-reset', {
      action: 'reset_requested_invalid_email_format',
      ip: options.ip,
    });
    return {
      success: true,
      message: 'Si el correo existe, recibirás un enlace de recuperación en tu Telegram',
    };
  }
  
  const agent = await Agent.findOne({ email: sanitizedEmail });
  
  // Always return success to prevent email enumeration
  if (!agent) {
    // Log the attempt but return generic success
    logger.warn('password-reset', {
      action: 'reset_requested_unknown_email',
      email,
      ip: options.ip,
    });
    return {
      success: true,
      message: 'Si el correo existe, recibirás un enlace de recuperación en tu Telegram',
    };
  }

  return requestPasswordReset(agent._id.toString(), {
    ...options,
    sendViaTelegram: true,
  });
}

// ============= VALIDATE TOKEN =============

export interface ValidateTokenResult {
  valid: boolean;
  error?: string;
  expiresAt?: Date;
  agentId?: string;
  agentName?: string;
  agentEmail?: string;
}

/**
 * Validate a reset token (without consuming it)
 * Used for UI preview before showing password form
 */
export async function validateResetToken(token: string): Promise<ValidateTokenResult> {
  try {
    const result = await validateTokenOnly(token);
    
    if (!result.valid) {
      return { valid: false, error: result.error };
    }

    // Get agent info for display
    const agent = await Agent.findById(result.agentId);
    if (!agent) {
      return { valid: false, error: 'Agente no encontrado' };
    }

    return {
      valid: true,
      expiresAt: result.expiresAt,
      agentId: result.agentId,
      agentName: agent.name,
      agentEmail: agent.email,
    };
  } catch (error) {
    logger.error('password-reset', {
      action: 'validate_error',
      error: String(error),
    });
    return { valid: false, error: 'Error al validar el token' };
  }
}

// ============= COMPLETE PASSWORD RESET =============

export interface CompleteResetResult {
  success: boolean;
  message?: string;
  error?: string;
  sessionsInvalidated?: number;
}

/**
 * Complete password reset with new password
 */
export async function completePasswordReset(
  token: string,
  newPassword: string,
  options: {
    ip?: string;
    userAgent?: string;
  }
): Promise<CompleteResetResult> {
  try {
    // 1. Validate and consume token
    const tokenResult = await validateAndConsumeToken(
      token,
      options.ip,
      options.userAgent
    );

    if (!tokenResult.valid || !tokenResult.record) {
      return { success: false, error: tokenResult.error || 'Token inválido' };
    }

    const agentId = tokenResult.record.agentId.toString();

    // 2. Find agent
    const agent = await Agent.findById(agentId).select('+password');
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    // 3. Validate password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return { success: false, error: passwordValidation.error };
    }

    // 3.5 Check password is not the same as current (if we can verify)
    const isSamePassword = await agent.comparePassword(newPassword);
    if (isSamePassword) {
      return { success: false, error: 'La nueva contraseña no puede ser igual a la anterior' };
    }

    // 4. Update password
    agent.password = newPassword;
    agent.security.password.forceChange = false;
    agent.security.password.lastChangedAt = new Date();
    agent.security.password.resetAttempts = 0;
    agent.security.password.resetBlockedUntil = undefined;
    await agent.save();

    // 5. Invalidate all existing sessions
    const sessionsInvalidated = await invalidateAllAgentSessions(agentId);

    // 6. Revoke any remaining reset tokens
    await revokeAllTokensForAgent(agentId, undefined, 'password_changed');

    // 7. Send alert via Telegram
    if (agent.telegramId) {
      await sendPasswordChangedAlertTelegram(agent.telegramId, agent.name);
    }

    // 8. Log audit
    await logAudit({
      action: 'password_reset_completed',
      category: 'security',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent.name,
      actorEmail: agent.email,
      targetType: 'agent',
      targetId: agentId,
      targetDescription: `Password changed via reset link`,
      severity: 'high',
      ip: options.ip || 'unknown',
      userAgent: options.userAgent,
    });

    logger.info('password-reset', {
      action: 'reset_completed',
      agentId,
      sessionsInvalidated,
      tokenId: tokenResult.record._id.toString(),
    });

    return {
      success: true,
      message: 'Contraseña actualizada correctamente. Todas las sesiones han sido cerradas.',
      sessionsInvalidated,
    };
  } catch (error) {
    logger.error('password-reset', {
      action: 'complete_error',
      error: String(error),
    });
    return { success: false, error: 'Error interno. Intenta más tarde.' };
  }
}

// ============= FORCE PASSWORD CHANGE =============

/**
 * Force an agent to change password on next login
 */
export async function forcePasswordChange(
  agentId: string,
  adminId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = await Agent.findByIdAndUpdate(
      agentId,
      { 'security.password.forceChange': true },
      { new: true }
    );

    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    // Log audit
    if (adminId) {
      await logAudit({
        action: 'force_password_change_enabled',
        category: 'security',
        actorId: adminId,
        actorType: 'admin',
        actorName: 'Admin',
        targetType: 'agent',
        targetId: agentId,
        targetDescription: `Forced password change for ${agent.email}`,
        severity: 'medium',
        ip: 'system',
      });
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Complete forced password change
 */
export async function completeForcedPasswordChange(
  agentId: string,
  newPassword: string,
  options: {
    ip?: string;
    userAgent?: string;
  }
): Promise<CompleteResetResult> {
  try {
    // 1. Find agent
    const agent = await Agent.findById(agentId).select('+password');
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    // 2. Check if force change is required
    if (!agent.security.password.forceChange) {
      return { success: false, error: 'No se requiere cambio de contraseña' };
    }

    // 3. Validate password
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return { success: false, error: passwordValidation.error };
    }

    // 3.5 Check password is not the same as current
    const isSamePassword = await agent.comparePassword(newPassword);
    if (isSamePassword) {
      return { success: false, error: 'La nueva contraseña no puede ser igual a la anterior' };
    }

    // 4. Update password
    agent.password = newPassword;
    agent.security.password.forceChange = false;
    agent.security.password.lastChangedAt = new Date();
    await agent.save();

    // 5. Log audit
    await logAudit({
      action: 'forced_password_change_completed',
      category: 'security',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent.name,
      actorEmail: agent.email,
      targetType: 'agent',
      targetId: agentId,
      targetDescription: `Forced password change completed`,
      severity: 'medium',
      ip: options.ip || 'unknown',
      userAgent: options.userAgent,
    });

    logger.info('password-reset', {
      action: 'forced_change_completed',
      agentId,
    });

    return {
      success: true,
      message: 'Contraseña actualizada correctamente',
    };
  } catch (error) {
    logger.error('password-reset', {
      action: 'forced_change_error',
      agentId,
      error: String(error),
    });
    return { success: false, error: 'Error interno. Intenta más tarde.' };
  }
}

// ============= ADMIN: REVOKE TOKENS =============

/**
 * Admin: Revoke all pending reset tokens for an agent
 */
export async function adminRevokeResetTokens(
  agentId: string,
  adminId: string,
  reason?: string
): Promise<{ success: boolean; revokedCount: number; error?: string }> {
  try {
    const revokedCount = await revokeAllTokensForAgent(agentId, adminId, reason);
    
    // Log audit
    await logAudit({
      action: 'password_reset_tokens_revoked',
      category: 'security',
      actorId: adminId,
      actorType: 'admin',
      actorName: 'Admin',
      targetType: 'agent',
      targetId: agentId,
      targetDescription: `Revoked ${revokedCount} password reset tokens`,
      newValue: { reason, revokedCount },
      severity: 'medium',
      ip: 'admin_action',
    });

    return { success: true, revokedCount };
  } catch (error) {
    return { success: false, revokedCount: 0, error: String(error) };
  }
}

// ============= PASSWORD VALIDATION =============

interface PasswordValidation {
  valid: boolean;
  error?: string;
}

// Common weak passwords to reject
const WEAK_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  'qwerty123', 'qwertyui', 'admin123', 'letmein1', 'welcome1',
  'abc12345', 'iloveyou', 'sunshine1', 'princess1', 'monkey123',
  'dragon123', 'master123', 'football1', 'shadow123', 'superman1',
  'trelk123', 'support1', 'support123', 'agent123', 'admin1234',
]);

/**
 * Validate password strength
 */
function validatePasswordStrength(password: string): PasswordValidation {
  if (!password || password.length < 8) {
    return { valid: false, error: 'La contraseña debe tener al menos 8 caracteres' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'La contraseña es demasiado larga' };
  }

  // Check for at least one letter and one number
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos una letra' };
  }

  if (!/\d/.test(password)) {
    return { valid: false, error: 'La contraseña debe contener al menos un número' };
  }

  // Check for common weak passwords
  if (WEAK_PASSWORDS.has(password.toLowerCase())) {
    return { valid: false, error: 'Esta contraseña es demasiado común. Elige una más segura.' };
  }

  // Check for sequential or repeated characters
  if (/(.)\1{3,}/.test(password)) {
    return { valid: false, error: 'La contraseña no puede tener más de 3 caracteres repetidos consecutivos' };
  }

  return { valid: true };
}

// ============= HELPER: Check if password change required =============

/**
 * Check if agent needs to change password
 */
export async function checkPasswordChangeRequired(agentId: string): Promise<boolean> {
  const agent = await Agent.findById(agentId);
  return agent?.security?.password?.forceChange === true;
}

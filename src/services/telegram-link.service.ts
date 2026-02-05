/**
 * Telegram Link Service
 * Secure validation of Telegram Login Widget data
 * 
 * Implements HMAC-SHA256 verification as per Telegram documentation:
 * https://core.telegram.org/widgets/login
 * 
 * Security features:
 * - Cryptographic signature validation
 * - Time-based expiration (5 min)
 * - One-time token usage
 * - Replay attack prevention
 * - Account binding protection
 */

import crypto from 'crypto';
import { ENV } from '../config/index.js';
import { Agent } from '../database/index.js';
import { logAudit } from './audit-log.service.js';
import { logger } from './logger.js';
import * as redis from './redis.js';

// Configuration
const TELEGRAM_AUTH_TTL_SECONDS = 300; // 5 minutes max age for auth data
const LINK_TOKEN_TTL_SECONDS = 600; // 10 minutes for link token

// Telegram widget data structure
export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

// Result types
export interface TelegramLinkResult {
  success: boolean;
  error?: string;
  telegramId?: number;
  telegramUsername?: string;
}

export interface LinkTokenResult {
  success: boolean;
  token?: string;
  expiresIn?: number;
  error?: string;
}

/**
 * Generate a secure link token for the Telegram widget flow
 * This prevents CSRF and ensures the widget callback is tied to a session
 */
export async function generateLinkToken(
  agentId: string,
  sessionId: string
): Promise<LinkTokenResult> {
  try {
    // Generate cryptographically secure token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store in Redis with expiration
    const key = `telegram_link:${token}`;
    const data = JSON.stringify({
      agentId,
      sessionId,
      createdAt: Date.now(),
    });
    
    await redis.set(key, data, LINK_TOKEN_TTL_SECONDS);
    
    logger.info('telegram-link', {
      action: 'link_token_generated',
      agentId,
    });
    
    return {
      success: true,
      token,
      expiresIn: LINK_TOKEN_TTL_SECONDS,
    };
  } catch (error) {
    logger.error('telegram-link', {
      action: 'link_token_error',
      error: String(error),
    });
    return { success: false, error: 'Error al generar token de vinculación' };
  }
}

/**
 * Validate and consume a link token
 * Returns the associated agent ID if valid, null otherwise
 */
async function validateAndConsumeLinkToken(
  token: string,
  expectedSessionId?: string
): Promise<{ valid: boolean; agentId?: string; error?: string }> {
  try {
    const key = `telegram_link:${token}`;
    const data = await redis.get(key);
    
    if (!data) {
      return { valid: false, error: 'Token de vinculación inválido o expirado' };
    }
    
    const parsed = JSON.parse(data);
    
    // Validate session if provided
    if (expectedSessionId && parsed.sessionId !== expectedSessionId) {
      logger.warn('telegram-link', {
        action: 'session_mismatch',
        expected: expectedSessionId,
        actual: parsed.sessionId,
      });
      return { valid: false, error: 'Sesión inválida' };
    }
    
    // Consume the token (one-time use)
    await redis.del(key);
    
    return { valid: true, agentId: parsed.agentId };
  } catch (error) {
    logger.error('telegram-link', {
      action: 'token_validation_error',
      error: String(error),
    });
    return { valid: false, error: 'Error al validar token' };
  }
}

/**
 * Verify Telegram Login Widget data using HMAC-SHA256
 * 
 * As per Telegram documentation:
 * 1. Sort all fields except hash alphabetically
 * 2. Create data-check-string: key=value\nkey=value...
 * 3. secret_key = SHA256(bot_token)
 * 4. hash = HMAC-SHA256(data-check-string, secret_key)
 * 5. Compare with provided hash
 */
export function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  try {
    // Extract hash and create data object without it
    const { hash, ...authData } = data;
    
    // Sort keys alphabetically and create data-check-string
    const dataCheckString = Object.keys(authData)
      .sort()
      .map(key => `${key}=${authData[key as keyof typeof authData]}`)
      .join('\n');
    
    // Create secret key: SHA256(bot_token)
    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest();
    
    // Calculate HMAC-SHA256
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    
    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(calculatedHash, 'hex')
    );
  } catch (error) {
    logger.error('telegram-link', {
      action: 'verify_auth_error',
      error: String(error),
    });
    return false;
  }
}

/**
 * Check if Telegram auth data is expired
 */
function isAuthExpired(authDate: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return (now - authDate) > TELEGRAM_AUTH_TTL_SECONDS;
}

/**
 * Check if Telegram ID is already linked to another account
 */
async function isTelegramIdTaken(
  telegramId: number,
  excludeAgentId?: string
): Promise<boolean> {
  const query: Record<string, unknown> = { telegramId };
  if (excludeAgentId) {
    query._id = { $ne: excludeAgentId };
  }
  const existing = await Agent.findOne(query);
  return !!existing;
}

/**
 * Check if a Telegram ID was recently unlinked (replay protection)
 */
async function wasRecentlyUnlinked(telegramId: number): Promise<boolean> {
  const key = `telegram_unlinked:${telegramId}`;
  const data = await redis.get(key);
  return !!data;
}

/**
 * Mark a Telegram ID as recently unlinked (replay protection)
 */
async function markAsUnlinked(telegramId: number): Promise<void> {
  const key = `telegram_unlinked:${telegramId}`;
  await redis.set(key, '1', 3600); // 1 hour cooldown
}

/**
 * Link Telegram account to agent
 * Full security validation flow
 */
export async function linkTelegramAccount(
  linkToken: string,
  authData: TelegramAuthData,
  options: {
    ip: string;
    userAgent?: string;
    sessionId?: string;
  }
): Promise<TelegramLinkResult> {
  try {
    // 1. Validate and consume link token
    const tokenResult = await validateAndConsumeLinkToken(linkToken, options.sessionId);
    if (!tokenResult.valid || !tokenResult.agentId) {
      await logLinkAttempt(null, authData.id, 'failed', 'invalid_token', options);
      return { success: false, error: tokenResult.error };
    }
    
    const agentId = tokenResult.agentId;
    
    // 2. Verify Telegram signature
    if (!verifyTelegramAuth(authData, ENV.BOT_TOKEN)) {
      await logLinkAttempt(agentId, authData.id, 'failed', 'invalid_signature', options);
      logger.warn('telegram-link', {
        action: 'invalid_signature',
        agentId,
        telegramId: authData.id,
        ip: options.ip,
      });
      return { success: false, error: 'Firma de Telegram inválida' };
    }
    
    // 3. Check auth expiration
    if (isAuthExpired(authData.auth_date)) {
      await logLinkAttempt(agentId, authData.id, 'failed', 'auth_expired', options);
      return { success: false, error: 'Autorización de Telegram expirada. Intenta de nuevo.' };
    }
    
    // 4. Check if Telegram ID is already taken
    if (await isTelegramIdTaken(authData.id, agentId)) {
      await logLinkAttempt(agentId, authData.id, 'failed', 'telegram_id_taken', options);
      return { success: false, error: 'Esta cuenta de Telegram ya está vinculada a otro usuario' };
    }
    
    // 5. Check for recent unlink (replay protection)
    if (await wasRecentlyUnlinked(authData.id)) {
      await logLinkAttempt(agentId, authData.id, 'failed', 'recently_unlinked', options);
      return { success: false, error: 'Esta cuenta de Telegram fue desvinculada recientemente. Espera unos minutos.' };
    }
    
    // 6. Get agent and verify they don't already have Telegram linked
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }
    
    if (agent.telegramId && agent.telegramId !== authData.id) {
      await logLinkAttempt(agentId, authData.id, 'failed', 'already_linked', options);
      return { success: false, error: 'Ya tienes una cuenta de Telegram vinculada. Desvincúlala primero.' };
    }
    
    // 7. Link Telegram account
    await Agent.updateOne(
      { _id: agentId },
      {
        $set: {
          telegramId: authData.id,
          telegramUsername: authData.username,
          telegramLinkedAt: new Date(),
          telegramVerified: true,
        }
      }
    );
    
    // 8. Log success
    await logLinkAttempt(agentId, authData.id, 'success', 'linked', options);
    
    logger.info('telegram-link', {
      action: 'telegram_linked',
      agentId,
      telegramId: authData.id,
      username: authData.username,
    });
    
    return {
      success: true,
      telegramId: authData.id,
      telegramUsername: authData.username,
    };
  } catch (error) {
    logger.error('telegram-link', {
      action: 'link_error',
      error: String(error),
    });
    return { success: false, error: 'Error al vincular cuenta de Telegram' };
  }
}

/**
 * Unlink Telegram account from agent
 * Requires additional verification if MFA is enabled
 */
export async function unlinkTelegramAccount(
  agentId: string,
  options: {
    ip: string;
    userAgent?: string;
    byAdmin?: boolean;
    adminId?: string;
    mark?: boolean; 
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }
    
    if (!agent.telegramId) {
      return { success: false, error: 'No hay cuenta de Telegram vinculada' };
    }
    
    // Check if MFA via Telegram is active
    if (agent.security?.mfa?.enabled && agent.security?.mfa?.methods?.telegram) {
      // Check if there's another MFA method
      if (!agent.security.mfa.methods.totp) {
        return { 
          success: false, 
          error: 'No puedes desvincular Telegram porque es tu único método MFA activo. Configura otro método primero.' 
        };
      }
    }
    
    const oldTelegramId = agent.telegramId;
    
    // Unlink
    await Agent.updateOne(
      { _id: agentId },
      {
        $unset: {
          telegramId: 1,
          telegramUsername: 1,
          telegramLinkedAt: 1,
          telegramVerified: 1,
        },
        $set: {
          'security.mfa.methods.telegram': false,
          // If telegram was preferred, switch to TOTP if available
          ...(agent.security?.mfa?.preferredMethod === 'telegram' && agent.security?.mfa?.methods?.totp
            ? { 'security.mfa.preferredMethod': 'totp' }
            : {}
          ),
        }
      }
    );
    
    // Mark as recently unlinked (replay protection)
    if (options.mark) {
    await markAsUnlinked(oldTelegramId);
    }
    // Audit log
    await logAudit({
      action: options.byAdmin ? 'telegram_unlinked_by_admin' : 'telegram_unlinked',
      category: 'security',
      actorId: options.byAdmin ? options.adminId! : agentId,
      actorType: options.byAdmin ? 'admin' : 'agent',
      actorName: options.byAdmin ? 'Admin' : agent.name,
      targetType: 'agent',
      targetId: agentId,
      severity: 'high',
      ip: options.ip,
      userAgent: options.userAgent,
      metadata: { telegramId: oldTelegramId },
    });
    
    logger.info('telegram-link', {
      action: 'telegram_unlinked',
      agentId,
      telegramId: oldTelegramId,
      byAdmin: options.byAdmin,
    });
    
    return { success: true };
  } catch (error) {
    logger.error('telegram-link', {
      action: 'unlink_error',
      error: String(error),
    });
    return { success: false, error: 'Error al desvincular cuenta de Telegram' };
  }
}

/**
 * Admin link Telegram by ID directly (bypass widget)
 */
export async function adminLinkTelegram(
  agentId: string,
  telegramId: number,
  options: {
    ip: string;
    userAgent?: string;
    adminId: string;
    adminName: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if ID is taken
    if (await isTelegramIdTaken(telegramId, agentId)) {
      return { success: false, error: 'Este Telegram ID ya está vinculado a otro usuario' };
    }
    
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }
    
    await Agent.updateOne(
      { _id: agentId },
      {
        $set: {
          telegramId,
          telegramLinkedAt: new Date(),
          telegramVerified: false, // Not verified via widget
        }
      }
    );
    
    await logAudit({
      action: 'telegram_linked_by_admin',
      category: 'security',
      actorId: options.adminId,
      actorType: 'admin',
      actorName: options.adminName,
      targetType: 'agent',
      targetId: agentId,
      severity: 'high',
      ip: options.ip,
      userAgent: options.userAgent,
      metadata: { telegramId },
    });
    
    return { success: true };
  } catch (error) {
    logger.error('telegram-link', {
      action: 'admin_link_error',
      error: String(error),
    });
    return { success: false, error: 'Error al vincular Telegram' };
  }
}

/**
 * Check if agent requires Telegram linking
 */
export async function requiresTelegramLink(agent: {
  telegramId?: number;
  security?: {
    mfa?: {
      enabled?: boolean;
      methods?: { telegram?: boolean };
    };
  };
  role: string;
}): Promise<boolean> {
  // Always required if MFA Telegram is enabled but no telegramId
  if (agent.security?.mfa?.enabled && agent.security?.mfa?.methods?.telegram && !agent.telegramId) {
    return true;
  }
  
  // Check global policy - could be extended to require for all agents
  // For now, only required for MFA
  return false;
}

/**
 * Log link attempt for audit
 */
async function logLinkAttempt(
  agentId: string | null,
  telegramId: number,
  status: 'success' | 'failed',
  reason: string,
  options: { ip: string; userAgent?: string }
): Promise<void> {
  await logAudit({
    action: `telegram_link_${status}`,
    category: 'security',
    actorId: agentId || 'unknown',
    actorType: 'agent',
    actorName: 'Unknown',
    targetType: 'agent',
    targetId: agentId || 'unknown',
    severity: status === 'failed' ? 'medium' : 'low',
    ip: options.ip,
    userAgent: options.userAgent,
    metadata: { telegramId, reason },
  });
}

/**
 * Get bot info for widget configuration
 */
export function getTelegramBotInfo(): { botId: string; botUsername: string } {
  // Extract bot ID from token (format: BOT_ID:SECRET)
  const botId = ENV.BOT_TOKEN.split(':')[0];
  // Bot username should be configured in env, default to known bot
  const botUsername = process.env.BOT_USERNAME || 'TrelkSupportBot';
  
  return { botId, botUsername };
}

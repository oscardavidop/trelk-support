/**
 * QR Login Service
 * WhatsApp Web-style login via Telegram QR code
 * 
 * Flow:
 * 1. Frontend requests QR token → Returns QR URL (t.me/TrelkAlertsBot?start=qr_login_{token})
 * 2. User scans QR → Bot receives /start qr_login_{token}
 * 3. Bot sends confirmation message with device info + approve/reject buttons
 * 4. User approves → Status changes to 'approved' with userId
 * 5. Frontend polling detects approved status → Completes login
 */

import { randomBytes } from 'crypto';
import * as redis from './redis.js';
import { logger } from './logger.js';
import { findAgentByTelegramId, findAgentById } from './agent.service.js';
import { completeLoginAfterMFA } from './auth.service.js';
import { getSecuritySettings } from './settings-cache.service.js';
import type { IAgent } from '../database/index.js';

// ============= CONFIGURATION =============

const QR_TOKEN_TTL = 90; // 90 seconds TTL for QR token
const QR_APPROVED_TTL = 30; // 30 seconds to complete login after approval
const NOTIFICATION_BOT_TOKEN = process.env.NOTIFICATION_BOT_TOKEN || '7588166869:AAGroOeWsYbM_QmovwQmf6RvYFZ_maalwI0';
const NOTIFICATION_BOT_USERNAME = 'TrelkAlertsBot';
const TELEGRAM_API_BASE = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';

// ============= TYPES =============

export type QRLoginStatus = 'pending' | 'scanned' | 'approved' | 'rejected' | 'expired' | 'consumed';

export interface QRLoginSession {
  status: QRLoginStatus;
  telegramId?: number;
  userId?: string;
  agentName?: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  trustDevice?: boolean;
}

export interface QRStartResult {
  success: boolean;
  token?: string;
  qrUrl?: string;
  expiresIn?: number;
  error?: string;
}

export interface QRStatusResult {
  success: boolean;
  status?: QRLoginStatus;
  remainingSeconds?: number;
  agentName?: string;
  error?: string;
  // Only present when status is 'approved' and consumed
  loginResult?: {
    token: string;
    agent: IAgent;
    permissions: string[];
    forcePasswordChange?: boolean;
    telegramLinkRequired?: boolean;
    mfaSetupRequired?: boolean;
  };
}

// ============= REDIS KEY HELPERS =============

function getQRKey(token: string): string {
  return `qr_login:${token}`;
}

function getRateLimitKey(ip: string): string {
  return `qr_login_rate:${ip}`;
}

// ============= TELEGRAM API HELPER =============

async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: {
    parseMode?: 'Markdown' | 'HTML';
    replyMarkup?: object;
  }
): Promise<boolean> {
  const url = `${TELEGRAM_API_BASE}/bot${NOTIFICATION_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options?.parseMode || 'Markdown',
        reply_markup: options?.replyMarkup,
      }),
    });

    const data = await response.json() as { ok: boolean; description?: string };
    
    if (!data.ok) {
      logger.error('qr-login', {
        action: 'telegram_send_error',
        chatId,
        error: data.description,
      });
    }
    
    return data.ok;
  } catch (error) {
    logger.error('qr-login', {
      action: 'telegram_request_error',
      chatId,
      error: String(error),
    });
    return false;
  }
}

async function editTelegramMessage(
  chatId: number,
  messageId: number,
  text: string,
  options?: {
    parseMode?: 'Markdown' | 'HTML';
    replyMarkup?: object;
  }
): Promise<boolean> {
  const url = `${TELEGRAM_API_BASE}/bot${NOTIFICATION_BOT_TOKEN}/editMessageText`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: options?.parseMode || 'Markdown',
        reply_markup: options?.replyMarkup,
      }),
    });

    const data = await response.json() as { ok: boolean };
    return data.ok;
  } catch (error) {
    logger.error('qr-login', {
      action: 'telegram_edit_error',
      chatId,
      messageId,
      error: String(error),
    });
    return false;
  }
}

async function answerTelegramCallback(
  callbackQueryId: string,
  text?: string,
  showAlert?: boolean
): Promise<boolean> {
  const url = `${TELEGRAM_API_BASE}/bot${NOTIFICATION_BOT_TOKEN}/answerCallbackQuery`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      }),
    });

    const data = await response.json() as { ok: boolean };
    return data.ok;
  } catch (error) {
    return false;
  }
}

// ============= RATE LIMITING =============

async function checkRateLimit(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
  const key = getRateLimitKey(ip);
  const count = await redis.get(key);
  
  if (count && parseInt(count) >= 5) {
    const ttl = await redis.getTTL(key);
    return { allowed: false, retryAfter: ttl > 0 ? ttl : 60 };
  }
  
  // Increment counter
  const client = redis.getRedisClient();
  if (client) {
    await client.incr(key);
    if (!count) {
      await client.expire(key, 60); // 1 minute window
    }
  }
  
  return { allowed: true };
}

// ============= CORE FUNCTIONS =============

/**
 * Generate a new QR login token
 */
export async function startQRLogin(
  ip: string,
  userAgent: string,
  deviceInfo?: {
    deviceType?: string;
    browser?: string;
    os?: string;
  }
): Promise<QRStartResult> {
  // Check rate limit
  const rateCheck = await checkRateLimit(ip);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Demasiados intentos. Espera ${rateCheck.retryAfter} segundos.`,
    };
  }

  // Check if Redis is available
  if (!redis.isRedisAvailable()) {
    return {
      success: false,
      error: 'Servicio no disponible temporalmente.',
    };
  }

  // Generate unique token
  const token = randomBytes(24).toString('hex');
  const now = Date.now();
  
  const session: QRLoginSession = {
    status: 'pending',
    createdAt: now,
    expiresAt: now + (QR_TOKEN_TTL * 1000),
    ip,
    userAgent,
    deviceType: deviceInfo?.deviceType,
    browser: deviceInfo?.browser,
    os: deviceInfo?.os,
  };

  // Store in Redis with TTL
  const stored = await redis.set(
    getQRKey(token),
    JSON.stringify(session),
    QR_TOKEN_TTL
  );

  if (!stored) {
    return {
      success: false,
      error: 'Error al generar código QR.',
    };
  }

  // Generate QR URL for Telegram deep link
  const qrUrl = `https://t.me/${NOTIFICATION_BOT_USERNAME}?start=qr_login_${token}`;

  logger.info('qr-login', {
    action: 'qr_generated',
    token: token.substring(0, 8) + '...',
    ip,
    expiresIn: QR_TOKEN_TTL,
  });

  return {
    success: true,
    token,
    qrUrl,
    expiresIn: QR_TOKEN_TTL,
  };
}

/**
 * Get QR login status (for polling)
 */
export async function getQRStatus(
  token: string,
  clientIp: string,
  deviceInfo?: {
    deviceType?: string;
    browser?: string;
    os?: string;
    deviceFingerprint?: string;
  }
): Promise<QRStatusResult> {
  if (!redis.isRedisAvailable()) {
    return {
      success: false,
      error: 'Servicio no disponible.',
    };
  }

  const key = getQRKey(token);
  const data = await redis.get(key);

  if (!data) {
    return {
      success: true,
      status: 'expired',
      remainingSeconds: 0,
    };
  }

  const session: QRLoginSession = JSON.parse(data);

  // Check if token was created from same IP (security)
  if (session.ip !== clientIp) {
    logger.warn('qr-login', {
      action: 'ip_mismatch',
      token: token.substring(0, 8) + '...',
      originalIp: session.ip,
      requestIp: clientIp,
    });
    // Allow but log - some users may have dynamic IPs
  }

  // Calculate remaining time
  const remainingMs = session.expiresAt - Date.now();
  const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

  // If approved, consume and complete login
  if (session.status === 'approved' && session.userId) {
    // Atomically mark as consumed to prevent replay
    session.status = 'consumed';
    await redis.set(key, JSON.stringify(session), 5); // Short TTL for consumed

    // Complete login
    const loginResult = await completeLoginAfterMFA(session.userId, {
      deviceType: deviceInfo?.deviceType || session.deviceType,
      browser: deviceInfo?.browser || session.browser,
      os: deviceInfo?.os || session.os,
      ip: clientIp,
    });

    if (!loginResult.success) {
      return {
        success: false,
        error: loginResult.error || 'Error al completar login.',
      };
    }

    // Delete QR session
    await redis.del(key);

    logger.info('qr-login', {
      action: 'login_completed',
      token: token.substring(0, 8) + '...',
      userId: session.userId,
    });

    return {
      success: true,
      status: 'approved',
      agentName: session.agentName,
      loginResult: {
        token: loginResult.token!,
        agent: loginResult.agent!,
        permissions: loginResult.permissions || [],
        forcePasswordChange: loginResult.forcePasswordChange,
        telegramLinkRequired: loginResult.telegramLinkRequired,
        mfaSetupRequired: loginResult.mfaSetupRequired,
      },
    };
  }

  return {
    success: true,
    status: session.status,
    remainingSeconds,
    agentName: session.agentName,
  };
}

/**
 * Handle QR scan from Telegram bot
 * Called when user sends /start qr_login_{token}
 */
export async function handleQRScan(
  token: string,
  telegramId: number,
  telegramUsername?: string
): Promise<{ success: boolean; error?: string; messageId?: number }> {
  if (!redis.isRedisAvailable()) {
    return { success: false, error: 'Servicio no disponible.' };
  }

  const key = getQRKey(token);
  const data = await redis.get(key);

  if (!data) {
    return { success: false, error: 'Código QR expirado o inválido.' };
  }

  const session: QRLoginSession = JSON.parse(data);

  // Check if already scanned/used
  if (session.status !== 'pending') {
    return { success: false, error: 'Este código QR ya fue utilizado.' };
  }

  // Find agent by Telegram ID
  const agent = await findAgentByTelegramId(telegramId);
  
  if (!agent) {
    return { 
      success: false, 
      error: 'Tu cuenta de Telegram no está vinculada a ningún agente. Vincula tu cuenta primero desde el panel.' 
    };
  }

  if (agent.isActive === false) {
    return { success: false, error: 'Tu cuenta está desactivada.' };
  }

  // Update session to scanned
  session.status = 'scanned';
  session.telegramId = telegramId;
  session.userId = agent._id.toString();
  session.agentName = agent.name;

  // Extend TTL for approval window
  const newExpiresAt = Date.now() + (QR_APPROVED_TTL * 1000);
  session.expiresAt = newExpiresAt;

  await redis.set(key, JSON.stringify(session), QR_APPROVED_TTL + 20);

  // Format device info for display
  const deviceDisplay = formatDeviceInfo(session);
  const now = new Date().toLocaleString('es-ES', { 
    timeZone: 'America/Bogota',
    dateStyle: 'short',
    timeStyle: 'short'
  });

  // Send confirmation message with inline keyboard
  const message = `🔐 *Solicitud de Inicio de Sesión*

Hola *${escapeMarkdown(agent.name)}*,

Se ha solicitado acceso a tu cuenta desde:

📱 *Dispositivo:* ${escapeMarkdown(deviceDisplay.device)}
🌐 *Navegador:* ${escapeMarkdown(deviceDisplay.browser)}
💻 *Sistema:* ${escapeMarkdown(deviceDisplay.os)}
🕐 *Fecha:* ${now}

⚠️ *¿Autorizas este inicio de sesión?*

_Si no reconoces esta solicitud, presiona "Rechazar"._`;

  const sent = await sendTelegramMessage(telegramId, message, {
    parseMode: 'Markdown',
    replyMarkup: {
      inline_keyboard: [
        [
          { text: '✅ Aprobar', callback_data: `qr_approve:${token}` },
          { text: '❌ Rechazar', callback_data: `qr_reject:${token}` },
        ],
      ],
    },
  });

  if (!sent) {
    return { success: false, error: 'No se pudo enviar el mensaje de confirmación.' };
  }

  logger.info('qr-login', {
    action: 'qr_scanned',
    token: token.substring(0, 8) + '...',
    telegramId,
    agentId: agent._id.toString(),
  });

  return { success: true };
}

/**
 * Handle QR approval/rejection callback from Telegram
 */
export async function handleQRCallback(
  callbackQueryId: string,
  data: string,
  telegramId: number,
  messageId: number,
  chatId: number
): Promise<void> {
  // Parse callback data
  const [action, token] = data.split(':');
  
  if (!token || (action !== 'qr_approve' && action !== 'qr_reject')) {
    await answerTelegramCallback(callbackQueryId, 'Acción no válida.', true);
    return;
  }

  const key = getQRKey(token);
  const sessionData = await redis.get(key);

  if (!sessionData) {
    await answerTelegramCallback(callbackQueryId, 'Solicitud expirada.', true);
    await editTelegramMessage(chatId, messageId, '⏰ *Solicitud Expirada*\n\nEsta solicitud de inicio de sesión ha expirado.');
    return;
  }

  const session: QRLoginSession = JSON.parse(sessionData);

  // Verify the telegram ID matches
  if (session.telegramId !== telegramId) {
    await answerTelegramCallback(callbackQueryId, 'No tienes permiso para esta acción.', true);
    return;
  }

  // Check if already processed
  if (session.status !== 'scanned') {
    await answerTelegramCallback(callbackQueryId, 'Esta solicitud ya fue procesada.', true);
    return;
  }

  if (action === 'qr_approve') {
    // Approve login
    session.status = 'approved';
    
    // Set extended TTL for login completion
    await redis.set(key, JSON.stringify(session), QR_APPROVED_TTL);

    await answerTelegramCallback(callbackQueryId, '✅ Inicio de sesión aprobado');
    
    await editTelegramMessage(chatId, messageId, 
      `✅ *Inicio de Sesión Aprobado*

Has autorizado el acceso a tu cuenta.

🔒 Tu sesión ha sido iniciada exitosamente.

_Si no realizaste esta acción, cambia tu contraseña inmediatamente y contacta a un administrador._`
    );

    logger.info('qr-login', {
      action: 'qr_approved',
      token: token.substring(0, 8) + '...',
      telegramId,
      userId: session.userId,
    });

  } else {
    // Reject login
    session.status = 'rejected';
    await redis.set(key, JSON.stringify(session), 10); // Short TTL for rejected

    await answerTelegramCallback(callbackQueryId, '❌ Solicitud rechazada');
    
    await editTelegramMessage(chatId, messageId,
      `❌ *Inicio de Sesión Rechazado*

Has rechazado la solicitud de inicio de sesión.

⚠️ Si no solicitaste este acceso, te recomendamos:
• Cambiar tu contraseña
• Revisar tus sesiones activas
• Contactar a un administrador si sospechas actividad inusual`
    );

    logger.warn('qr-login', {
      action: 'qr_rejected',
      token: token.substring(0, 8) + '...',
      telegramId,
      userId: session.userId,
    });
  }
}

// ============= HELPER FUNCTIONS =============

function formatDeviceInfo(session: QRLoginSession): { device: string; browser: string; os: string } {
  return {
    device: session.deviceType || 'Desconocido',
    browser: session.browser || 'Desconocido',
    os: session.os || 'Desconocido',
  };
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// ============= EXPORTS FOR BOT HANDLERS =============

export { NOTIFICATION_BOT_TOKEN, NOTIFICATION_BOT_USERNAME };

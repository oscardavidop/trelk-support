/**
 * Telegram Notifications Service
 * Specialized notifications for password reset and security alerts
 * 
 * Uses a dedicated bot token for system notifications
 * to keep it separate from the main support bot
 */

import { logger } from './logger.js';

// ============= CONFIGURATION =============

// Notification bot token (separate from main support bot)
const NOTIFICATION_BOT_TOKEN = process.env.NOTIFICATION_BOT_TOKEN || '7588166869:AAGroOeWsYbM_QmovwQmf6RvYFZ_maalwI0';

// Telegram API base URL
const TELEGRAM_API_BASE = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';

// ============= API HELPER =============

interface TelegramApiResult {
  ok: boolean;
  result?: unknown;
  description?: string;
}

async function sendTelegramRequest(
  method: string,
  body: Record<string, unknown>
): Promise<TelegramApiResult> {
  const url = `${TELEGRAM_API_BASE}/bot${NOTIFICATION_BOT_TOKEN}/${method}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json() as TelegramApiResult;

    if (!data.ok) {
      logger.error('telegram-notifications', {
        action: 'api_error',
        method,
        error: data.description,
      });
    }

    return data;
  } catch (error) {
    logger.error('telegram-notifications', {
      action: 'request_error',
      method,
      error: String(error),
    });
    return { ok: false, description: String(error) };
  }
}

// ============= PASSWORD RESET NOTIFICATION =============

/**
 * Send password reset link via Telegram
 */
export async function sendPasswordResetTelegram(
  telegramId: number,
  resetUrl: string,
  agentName?: string
): Promise<boolean> {
  const greeting = agentName ? `Hola *${escapeMarkdown(agentName)}*,` : 'Hola,';
  
  const message = `🔐 *Restablecer Contraseña*

${greeting}

Hemos recibido una solicitud para restablecer tu contraseña.

Haz clic en el enlace de abajo para crear una nueva contraseña:

👉 [Restablecer mi contraseña](${resetUrl})

⏳ *Este enlace expira en 15 minutos.*

⚠️ Si no solicitaste este cambio, ignora este mensaje. Tu contraseña actual seguirá siendo la misma.

_— Equipo de Trelk Support_`;

  const result = await sendTelegramRequest('sendMessage', {
    chat_id: telegramId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🔑 Restablecer Contraseña',
          url: resetUrl,
        }
      ]]
    }
  });

  if (result.ok) {
    logger.info('telegram-notifications', {
      action: 'password_reset_sent',
      telegramId,
    });
  }

  return result.ok;
}

// ============= PASSWORD CHANGED ALERT =============

/**
 * Send password changed alert via Telegram
 */
export async function sendPasswordChangedAlertTelegram(
  telegramId: number,
  agentName?: string
): Promise<boolean> {
  const greeting = agentName ? `Hola *${escapeMarkdown(agentName)}*,` : 'Hola,';
  const now = new Date().toLocaleString('es-ES', { 
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short'
  });

  const message = `✅ *Contraseña Actualizada*

${greeting}

Tu contraseña ha sido cambiada exitosamente.

📅 *Fecha:* ${now}

🔒 Por seguridad, todas tus sesiones anteriores han sido cerradas. Necesitarás iniciar sesión nuevamente.

⚠️ *Si no realizaste este cambio*, contacta inmediatamente a un administrador.

_— Equipo de Trelk Support_`;

  const result = await sendTelegramRequest('sendMessage', {
    chat_id: telegramId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });

  if (result.ok) {
    logger.info('telegram-notifications', {
      action: 'password_changed_alert_sent',
      telegramId,
    });
  }

  return result.ok;
}

// ============= TEMPORARY PASSWORD NOTIFICATION =============

/**
 * Send temporary password via Telegram
 */
export async function sendTemporaryPasswordTelegram(
  telegramId: number,
  temporaryPassword: string,
  agentName?: string
): Promise<boolean> {
  const greeting = agentName ? `Hola *${escapeMarkdown(agentName)}*,` : 'Hola,';
  const now = new Date().toLocaleString('es-ES', { 
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short'
  });

  const message = `🔐 *Nueva Contraseña Temporal*

${greeting}

Un administrador ha generado una nueva contraseña temporal para tu cuenta.

🔑 *Tu contraseña temporal:*
\`${temporaryPassword}\`

📅 *Fecha:* ${now}

⚠️ *Importante:* Por seguridad, deberás cambiar esta contraseña la próxima vez que inicies sesión.

💡 _Copia la contraseña haciendo clic en ella._

_— Equipo de Trelk Support_`;

  const result = await sendTelegramRequest('sendMessage', {
    chat_id: telegramId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });

  if (result.ok) {
    logger.info('telegram-notifications', {
      action: 'temporary_password_sent',
      telegramId,
    });
  }

  return result.ok;
}

// ============= SUSPICIOUS LOGIN ALERT =============

/**
 * Send suspicious login alert via Telegram
 */
export async function sendSuspiciousLoginAlert(
  telegramId: number,
  details: {
    agentName?: string;
    ip?: string;
    device?: string;
    location?: string;
  }
): Promise<boolean> {
  const greeting = details.agentName ? `Hola *${escapeMarkdown(details.agentName)}*,` : 'Hola,';
  const now = new Date().toLocaleString('es-ES', { 
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short'
  });

  const message = `🚨 *Alerta de Seguridad*

${greeting}

Detectamos un inicio de sesión inusual en tu cuenta:

📅 *Fecha:* ${now}
${details.ip ? `🌐 *IP:* \`${details.ip}\`` : ''}
${details.device ? `📱 *Dispositivo:* ${details.device}` : ''}
${details.location ? `📍 *Ubicación:* ${details.location}` : ''}

⚠️ *Si fuiste tú*, puedes ignorar este mensaje.

🔒 *Si NO fuiste tú*, te recomendamos cambiar tu contraseña inmediatamente.

_— Equipo de Trelk Support_`;

  const result = await sendTelegramRequest('sendMessage', {
    chat_id: telegramId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });

  return result.ok;
}

// ============= FORCE PASSWORD CHANGE NOTIFICATION =============

/**
 * Notify agent that they need to change password
 */
export async function sendForcePasswordChangeNotification(
  telegramId: number,
  agentName?: string,
  reason?: string
): Promise<boolean> {
  const greeting = agentName ? `Hola *${escapeMarkdown(agentName)}*,` : 'Hola,';
  
  const reasonText = reason 
    ? `\n\n📋 *Motivo:* ${escapeMarkdown(reason)}`
    : '';

  const message = `🔐 *Cambio de Contraseña Requerido*

${greeting}

Por razones de seguridad, se requiere que cambies tu contraseña en tu próximo inicio de sesión.${reasonText}

Al iniciar sesión, serás redirigido automáticamente para crear una nueva contraseña.

_— Equipo de Trelk Support_`;

  const result = await sendTelegramRequest('sendMessage', {
    chat_id: telegramId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });

  return result.ok;
}

// ============= RATE LIMIT BLOCKED NOTIFICATION =============

/**
 * Notify agent that they've been blocked due to too many attempts
 */
export async function sendRateLimitBlockedNotification(
  telegramId: number,
  blockedUntil: Date,
  agentName?: string
): Promise<boolean> {
  const greeting = agentName ? `Hola *${escapeMarkdown(agentName)}*,` : 'Hola,';
  const unblockTime = blockedUntil.toLocaleString('es-ES', {
    timeZone: 'America/Bogota',
    timeStyle: 'short',
    dateStyle: 'short'
  });

  const message = `⚠️ *Cuenta Temporalmente Bloqueada*

${greeting}

Tu cuenta ha sido temporalmente bloqueada debido a múltiples intentos fallidos de restablecer contraseña.

🕐 *Podrás intentar nuevamente:* ${unblockTime}

Si no has sido tú quien realizó estos intentos, contacta a un administrador.

_— Equipo de Trelk Support_`;

  const result = await sendTelegramRequest('sendMessage', {
    chat_id: telegramId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });

  return result.ok;
}

// ============= MFA NOTIFICATIONS =============

/**
 * Send MFA verification code via Telegram
 */
export async function sendMFACodeTelegram(
  telegramId: number,
  code: string,
  agentName?: string,
  isActivation: boolean = false
): Promise<boolean> {
  const greeting = agentName ? `Hola *${escapeMarkdown(agentName)}*,` : 'Hola,';
  const actionText = isActivation 
    ? 'Estás activando la autenticación de dos factores (2FA).'
    : 'Se ha detectado un intento de inicio de sesión en tu cuenta.';

  const message = `🔐 *Código de Verificación*

${greeting}

${actionText}

Tu código de verificación es:

\`${code}\`

⏱️ *Este código expira en 2 minutos.*

⚠️ *No compartas este código con nadie.* Si no solicitaste este código, ignora este mensaje y tu cuenta permanecerá segura.

_— Equipo de Trelk Support_`;

  const result = await sendTelegramRequest('sendMessage', {
    chat_id: telegramId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });

  if (result.ok) {
    logger.info('telegram-notifications', {
      action: 'mfa_code_sent',
      telegramId,
      isActivation,
    });
  }

  return result.ok;
}

/**
 * Send MFA status alert via Telegram
 */
export async function sendMFAAlertTelegram(
  telegramId: number,
  alertType: 'enabled' | 'disabled' | 'enforced' | 'admin_disabled' | 'bypass_granted',
  agentName?: string,
  additionalInfo?: string
): Promise<boolean> {
  const greeting = agentName ? `Hola *${escapeMarkdown(agentName)}*,` : 'Hola,';
  const now = new Date().toLocaleString('es-ES', { 
    timeZone: 'America/Bogota',
    dateStyle: 'long',
    timeStyle: 'short'
  });

  let emoji = '🔐';
  let title = '';
  let body = '';

  switch (alertType) {
    case 'enabled':
      emoji = '✅';
      title = 'Autenticación 2FA Activada';
      body = `Has activado exitosamente la autenticación de dos factores en tu cuenta.

A partir de ahora, necesitarás verificar tu identidad con un código cada vez que inicies sesión desde un nuevo dispositivo.`;
      break;

    case 'disabled':
      emoji = '⚠️';
      title = '2FA Desactivada';
      body = `Has desactivado la autenticación de dos factores en tu cuenta.

Tu cuenta es ahora más vulnerable. Te recomendamos mantener el 2FA activo para mayor seguridad.`;
      break;

    case 'enforced':
      emoji = '🛡️';
      title = '2FA Forzada por Administrador';
      body = `Un administrador ha activado la autenticación de dos factores obligatoria en tu cuenta.

A partir de ahora, necesitarás verificar tu identidad con un código cada vez que inicies sesión.

Esta configuración no puede ser desactivada por ti.`;
      break;

    case 'admin_disabled':
      emoji = '🔓';
      title = '2FA Desactivada por Administrador';
      body = `Un administrador ha desactivado la autenticación de dos factores en tu cuenta.${additionalInfo ? `\n\n📋 *Motivo:* ${escapeMarkdown(additionalInfo)}` : ''}

Contacta a tu administrador si tienes preguntas.`;
      break;

    case 'bypass_granted':
      emoji = '⏰';
      title = 'Bypass Temporal de 2FA';
      body = `Un administrador te ha concedido un bypass temporal de la autenticación de dos factores.

⏱️ *Duración:* ${additionalInfo || '30 minutos'}

Durante este tiempo podrás iniciar sesión sin necesidad de verificación 2FA.`;
      break;
  }

  const message = `${emoji} *${title}*

${greeting}

${body}

📅 *Fecha:* ${now}

_— Equipo de Trelk Support_`;

  const result = await sendTelegramRequest('sendMessage', {
    chat_id: telegramId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });

  if (result.ok) {
    logger.info('telegram-notifications', {
      action: 'mfa_alert_sent',
      telegramId,
      alertType,
    });
  }

  return result.ok;
}

// ============= HELPERS =============

/**
 * Escape special Markdown characters
 */
function escapeMarkdown(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');
}

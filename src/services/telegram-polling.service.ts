/**
 * Telegram Polling Service
 * Long polling for both support bot and notification bot
 * Used when webhook URL is not available (dev/local environments)
 */

import { ENV } from '../config/index.js';
import { logger } from './logger.js';
import type { TelegramUpdate } from '../types/index.js';
import {
  processSupportBotUpdate,
  processNotificationBotUpdate,
  type NotificationBotUpdate,
} from './update-handlers.service.js';

// ============= CONFIGURATION =============

const TELEGRAM_API_BASE = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
const SUPPORT_BOT_TOKEN = ENV.BOT_TOKEN;
const NOTIFICATION_BOT_TOKEN = ENV.NOTIFICATION_BOT_TOKEN;
const POLLING_TIMEOUT = ENV.POLLING_TIMEOUT;

// ============= STATE =============

interface PollingState {
  isRunning: boolean;
  lastUpdateId: number;
  errorCount: number;
  lastError: string | null;
  abortController: AbortController | null;
}

const supportBotState: PollingState = {
  isRunning: false,
  lastUpdateId: 0,
  errorCount: 0,
  lastError: null,
  abortController: null,
};

const notificationBotState: PollingState = {
  isRunning: false,
  lastUpdateId: 0,
  errorCount: 0,
  lastError: null,
  abortController: null,
};

// ============= HELPER FUNCTIONS =============

async function getUpdates(
  botToken: string,
  offset: number,
  timeout: number,
  signal?: AbortSignal
): Promise<{ ok: boolean; result?: TelegramUpdate[]; description?: string }> {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/getUpdates`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset,
        timeout,
        allowed_updates: ['message', 'callback_query', 'poll_answer'],
      }),
      signal,
    });

    return await response.json() as { ok: boolean; result?: TelegramUpdate[]; description?: string };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { ok: false, description: 'Polling aborted' };
    }
    throw error;
  }
}

async function deleteWebhookForPolling(botToken: string): Promise<boolean> {
  const url = `${TELEGRAM_API_BASE}/bot${botToken}/deleteWebhook`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    
    const data = await response.json() as { ok: boolean };
    return data.ok;
  } catch (error) {
    logger.error('polling', {
      action: 'delete_webhook_error',
      error: String(error),
    });
    return false;
  }
}

// ============= SUPPORT BOT POLLING =============

async function pollSupportBot(): Promise<void> {
  if (!supportBotState.isRunning) return;
  
  try {
    supportBotState.abortController = new AbortController();
    
    const data = await getUpdates(
      SUPPORT_BOT_TOKEN,
      supportBotState.lastUpdateId + 1,
      POLLING_TIMEOUT,
      supportBotState.abortController.signal
    );

    if (!data.ok) {
      supportBotState.errorCount++;
      supportBotState.lastError = data.description || 'Unknown error';
      
      // Exponential backoff on errors
      const backoffMs = Math.min(1000 * Math.pow(2, supportBotState.errorCount), 30000);
      logger.warn('polling', {
        action: 'support_bot_error',
        error: supportBotState.lastError,
        backoffMs,
        errorCount: supportBotState.errorCount,
      });
      
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    } else {
      supportBotState.errorCount = 0;
      supportBotState.lastError = null;
      
      const updates = data.result || [];
      
      for (const update of updates) {
        supportBotState.lastUpdateId = update.update_id;
        try {
          await processSupportBotUpdate(update);
        } catch {
          // Error already logged in centralized handler
        }
      }
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      supportBotState.errorCount++;
      supportBotState.lastError = String(error);
      logger.error('polling', {
        action: 'support_bot_poll_error',
        error: String(error),
      });
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Continue polling if still running
  if (supportBotState.isRunning) {
    setImmediate(pollSupportBot);
  }
}

// ============= NOTIFICATION BOT POLLING =============

async function pollNotificationBot(): Promise<void> {
  if (!notificationBotState.isRunning) return;
  
  try {
    notificationBotState.abortController = new AbortController();
    
    const url = `${TELEGRAM_API_BASE}/bot${NOTIFICATION_BOT_TOKEN}/getUpdates`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset: notificationBotState.lastUpdateId + 1,
        timeout: POLLING_TIMEOUT,
        allowed_updates: ['message', 'callback_query'],
      }),
      signal: notificationBotState.abortController.signal,
    });

    const data = await response.json() as { ok: boolean; result?: NotificationBotUpdate[]; description?: string };

    if (!data.ok) {
      notificationBotState.errorCount++;
      notificationBotState.lastError = data.description || 'Unknown error';
      
      const backoffMs = Math.min(1000 * Math.pow(2, notificationBotState.errorCount), 30000);
      logger.warn('polling', {
        action: 'notification_bot_error',
        error: notificationBotState.lastError,
        backoffMs,
        errorCount: notificationBotState.errorCount,
      });
      
      await new Promise(resolve => setTimeout(resolve, backoffMs));
    } else {
      notificationBotState.errorCount = 0;
      notificationBotState.lastError = null;
      
      const updates = data.result || [];
      
      for (const update of updates) {
        notificationBotState.lastUpdateId = update.update_id;
        try {
          await processNotificationBotUpdate(update);
        } catch {
          // Error already logged in centralized handler
        }
      }
    }
  } catch (error: any) {
    if (error.name !== 'AbortError') {
      notificationBotState.errorCount++;
      notificationBotState.lastError = String(error);
      logger.error('polling', {
        action: 'notification_bot_poll_error',
        error: String(error),
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Continue polling if still running
  if (notificationBotState.isRunning) {
    setImmediate(pollNotificationBot);
  }
}

// ============= PUBLIC API =============

/**
 * Start polling for both bots
 */
export async function startPolling(): Promise<void> {
  if (!ENV.POLLING_ENABLED) {
    logger.info('polling', { action: 'disabled', reason: 'POLLING_ENABLED=false' });
    return;
  }

  logger.info('polling', { action: 'starting', timeout: POLLING_TIMEOUT });

  // Delete webhooks before starting polling (required by Telegram API)
  const [supportDeleted, notificationDeleted] = await Promise.all([
    deleteWebhookForPolling(SUPPORT_BOT_TOKEN),
    deleteWebhookForPolling(NOTIFICATION_BOT_TOKEN),
  ]);

  if (!supportDeleted) {
    logger.warn('polling', { action: 'support_webhook_delete_failed' });
  }
  if (!notificationDeleted) {
    logger.warn('polling', { action: 'notification_webhook_delete_failed' });
  }

  // Start polling for support bot
  supportBotState.isRunning = true;
  supportBotState.errorCount = 0;
  supportBotState.lastError = null;
  pollSupportBot();

  // Start polling for notification bot
  notificationBotState.isRunning = true;
  notificationBotState.errorCount = 0;
  notificationBotState.lastError = null;
  pollNotificationBot();

  logger.info('polling', { 
    action: 'started',
    supportBot: true,
    notificationBot: true,
  });
}

/**
 * Stop polling for both bots
 */
export async function stopPolling(): Promise<void> {
  logger.info('polling', { action: 'stopping' });

  // Stop support bot polling
  supportBotState.isRunning = false;
  if (supportBotState.abortController) {
    supportBotState.abortController.abort();
    supportBotState.abortController = null;
  }

  // Stop notification bot polling
  notificationBotState.isRunning = false;
  if (notificationBotState.abortController) {
    notificationBotState.abortController.abort();
    notificationBotState.abortController = null;
  }

  logger.info('polling', { action: 'stopped' });
}

/**
 * Get polling status
 */
export function getPollingStatus(): {
  enabled: boolean;
  supportBot: { running: boolean; lastUpdateId: number; errorCount: number; lastError: string | null };
  notificationBot: { running: boolean; lastUpdateId: number; errorCount: number; lastError: string | null };
} {
  return {
    enabled: ENV.POLLING_ENABLED,
    supportBot: {
      running: supportBotState.isRunning,
      lastUpdateId: supportBotState.lastUpdateId,
      errorCount: supportBotState.errorCount,
      lastError: supportBotState.lastError,
    },
    notificationBot: {
      running: notificationBotState.isRunning,
      lastUpdateId: notificationBotState.lastUpdateId,
      errorCount: notificationBotState.errorCount,
      lastError: notificationBotState.lastError,
    },
  };
}

/**
 * Check if polling is enabled
 */
export function isPollingEnabled(): boolean {
  return ENV.POLLING_ENABLED;
}

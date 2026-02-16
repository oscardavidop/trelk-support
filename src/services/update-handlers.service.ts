/**
 * Telegram Update Handlers
 * Centralized handlers for processing Telegram updates from both webhook and polling
 * 
 * This module eliminates code duplication between server.ts (webhook) and 
 * telegram-polling.service.ts (polling) by providing a single source of truth
 * for update processing logic.
 */

import { handleMessage, handleCallbackQuery } from './bot.handlers.js';
import { handlePollAnswer } from './survey.service.js';
import { handleQRScan, handleQRCallback } from './qr-login.service.js';
import { logger } from './logger.js';
import { ENV } from '../config/index.js';
import type { TelegramUpdate } from '../types/index.js';

// ============= CONFIGURATION =============

const TELEGRAM_API_BASE = process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org';
const NOTIFICATION_BOT_TOKEN = ENV.NOTIFICATION_BOT_TOKEN;

// ============= TYPES =============

export interface NotificationBotUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string };
    chat: { id: number };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; username?: string };
    message?: { message_id: number; chat: { id: number } };
    data?: string;
  };
}

// ============= SUPPORT BOT UPDATE HANDLER =============

/**
 * Process a single update from the support bot (@TrelkSupportBot)
 * Handles messages, callback queries, and poll answers
 */
export async function processSupportBotUpdate(update: TelegramUpdate): Promise<void> {
  try {
    if (update.message) {
      await handleMessage(update.message);
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    } else if (update.poll_answer) {
      await handlePollAnswer(
        update.poll_answer.poll_id,
        update.poll_answer.option_ids,
        update.poll_answer.user.id
      );
    }
  } catch (error) {
    logger.error('api', {
      action: 'support_bot_update_error',
      updateId: update.update_id,
      error: String(error),
    });
    // Re-throw to allow caller to handle if needed
    throw error;
  }
}

// ============= NOTIFICATION BOT UPDATE HANDLER =============

/**
 * Send error message to user via notification bot
 */
async function sendNotificationBotError(chatId: number, errorMessage: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${NOTIFICATION_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `❌ *Error*\n\n${errorMessage}`,
        parse_mode: 'Markdown',
      }),
    });
  } catch (error) {
    logger.error('qr-login', {
      action: 'send_error_failed',
      chatId,
      error: String(error),
    });
  }
}

async function sendNotificationBotMessage(chatId: number, text: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${NOTIFICATION_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });
  } catch (error) {
    logger.error('qr-login', {
      action: 'send_message_failed',
      chatId,
      error: String(error),
    });
  }
}

/**
 * Process a single update from the notification bot (@TrelkAlertsBot)
 * Handles QR login deep links and approval callbacks
 */
export async function processNotificationBotUpdate(update: NotificationBotUpdate): Promise<void> {
  try {
    // Handle /start commands with QR login deep links
    if (update.message?.text?.startsWith('/start qr_login_')) {
      const token = update.message.text.replace('/start qr_login_', '').trim();
      const telegramId = update.message.from.id;
      const username = update.message.from.username;

      const result = await handleQRScan(token, telegramId, username);
      
      if (!result.success) {
        await sendNotificationBotError(update.message.chat.id, result.error || 'Error desconocido');
      }
    }
    // Handle QR login callbacks (approve/reject)
    else if (update.callback_query?.data?.startsWith('qr_')) {
      const { id, from, message, data } = update.callback_query;
      
      if (message && data) {
        await handleQRCallback(
          id,
          data,
          from.id,
          message.message_id,
          message.chat.id
        );
      }
    } else {
      await sendNotificationBotMessage(update.message?.chat.id || 0, 'Este bot no acepta mensajes directos. Ve a @TrelkBot, el bot principal de Trelk, para interactuar conmigo.');
    }
  } catch (error) {
    logger.error('qr-login', {
      action: 'notification_bot_update_error',
      updateId: update.update_id,
      error: String(error),
    });
    // Re-throw to allow caller to handle if needed
    throw error;
  }
}

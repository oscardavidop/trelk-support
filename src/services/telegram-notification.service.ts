/**
 * Telegram Notification Service
 * Sends notifications to agents via Telegram Bot API
 */

import { ENV, TELEGRAM_API } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Send a text notification to a Telegram user
 */
export async function sendTelegramNotification(
  chatId: string | number,
  message: string,
  options: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disableNotification?: boolean;
    disableWebPagePreview?: boolean;
  } = {}
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const {
    parseMode = 'Markdown',
    disableNotification = false,
    disableWebPagePreview = true,
  } = options;

  if (!ENV.BOT_TOKEN) {
    logger.warn('telegram-notification', { action: 'no_bot_token' });
    return { success: false, error: 'Bot token not configured' };
  }

  try {
    const url = TELEGRAM_API.getUrl('sendMessage');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        disable_notification: disableNotification,
        disable_web_page_preview: disableWebPagePreview,
      }),
    });

    const data = await response.json() as { ok: boolean; description?: string; result?: { message_id: number } };

    if (!data.ok) {
      logger.error('telegram-notification', {
        action: 'send_failed',
        chatId,
        error: data.description,
      });
      return { success: false, error: data.description };
    }

    logger.info('telegram-notification', {
      action: 'sent',
      chatId,
      messageId: data.result?.message_id,
    });

    return { success: true, messageId: data.result?.message_id };
  } catch (error) {
    logger.error('telegram-notification', {
      action: 'send_error',
      chatId,
      error: String(error),
    });
    return { success: false, error: 'Network error' };
  }
}

/**
 * Send a notification with inline keyboard buttons
 */
export async function sendTelegramNotificationWithButtons(
  chatId: string | number,
  message: string,
  buttons: Array<{ text: string; url?: string; callbackData?: string }[]>,
  options: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  } = {}
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const { parseMode = 'Markdown' } = options;

  if (!ENV.BOT_TOKEN) {
    return { success: false, error: 'Bot token not configured' };
  }

  try {
    const url = TELEGRAM_API.getUrl('sendMessage');
    
    // Build inline keyboard
    const inlineKeyboard = buttons.map(row =>
      row.map(button => {
        if (button.url) {
          return { text: button.text, url: button.url };
        }
        return { text: button.text, callback_data: button.callbackData || button.text };
      })
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        reply_markup: {
          inline_keyboard: inlineKeyboard,
        },
      }),
    });

    const data = await response.json() as { ok: boolean; description?: string; result?: { message_id: number } };

    if (!data.ok) {
      return { success: false, error: data.description };
    }

    return { success: true, messageId: data.result?.message_id };
  } catch (error) {
    return { success: false, error: 'Network error' };
  }
}

export default {
  sendTelegramNotification,
  sendTelegramNotificationWithButtons,
};

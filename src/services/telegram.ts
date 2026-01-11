/**
 * Telegram API Service
 * Handles all communication with Telegram Bot API
 */

import { TELEGRAM_API, ENV } from '../config/index.js';
import type { 
  SendMessageOptions, 
  EditMessageOptions,
  AnswerCallbackQueryOptions,
  ReplyMarkup,
  InlineKeyboardMarkup 
} from '../types/index.js';
import { logger } from './logger.js';

// ============= API REQUEST HELPER =============

async function apiRequest<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(TELEGRAM_API.getUrl(method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json() as { ok: boolean; result?: T; description?: string };

    if (!data.ok) {
      logger.error('api', { method, error: data.description });
      return null;
    }

    return data.result ?? null;
  } catch (error) {
    logger.error('api', { method, error: String(error) });
    return null;
  }
}

// ============= MESSAGE METHODS =============

export async function sendMessage(
  chatId: number,
  text: string,
  options?: {
    replyMarkup?: ReplyMarkup;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disablePreview?: boolean;
  }
): Promise<boolean> {
  const body: SendMessageOptions = {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode ?? 'HTML',
    disable_web_page_preview: options?.disablePreview ?? true,
  };

  if (options?.replyMarkup) {
    body.reply_markup = options.replyMarkup;
  }

  const result = await apiRequest('sendMessage', body as unknown as Record<string, unknown>);
  return result !== null;
}

export async function editMessage(
  chatId: number,
  messageId: number,
  text: string,
  options?: {
    replyMarkup?: InlineKeyboardMarkup;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  }
): Promise<boolean> {
  const body: EditMessageOptions = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: options?.parseMode ?? 'HTML',
  };

  if (options?.replyMarkup) {
    body.reply_markup = options.replyMarkup;
  }

  const result = await apiRequest('editMessageText', body as unknown as Record<string, unknown>);
  return result !== null;
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false
): Promise<boolean> {
  const body: AnswerCallbackQueryOptions = {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  };

  const result = await apiRequest('answerCallbackQuery', body as unknown as Record<string, unknown>);
  return result !== null;
}

// ============= CHAT ACTIONS =============

export type ChatAction = 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 'record_voice' | 'upload_voice' | 'upload_document' | 'find_location' | 'record_video_note' | 'upload_video_note';

export async function sendChatAction(
  chatId: number,
  action: ChatAction = 'typing'
): Promise<boolean> {
  const result = await apiRequest('sendChatAction', {
    chat_id: chatId,
    action,
  });
  return result !== null;
}

// ============= WEBHOOK MANAGEMENT =============

export async function setWebhook(url: string, secretToken: string): Promise<boolean> {
  const result = await apiRequest('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });
  return result !== null;
}

export async function deleteWebhook(): Promise<boolean> {
  const result = await apiRequest('deleteWebhook', { drop_pending_updates: true });
  return result !== null;
}

export async function getWebhookInfo(): Promise<Record<string, unknown> | null> {
  return apiRequest('getWebhookInfo', {});
}

// ============= BOT INFO =============

export async function getMe(): Promise<{ id: number; username: string } | null> {
  return apiRequest('getMe', {});
}

// ============= MEDIA METHODS =============

/**
 * Send a photo to a chat using native Node.js FormData
 */
export async function sendPhoto(
  chatId: number,
  photoPath: string,
  caption?: string,
  options?: { parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2' }
): Promise<boolean> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const fileBuffer = await fs.readFile(photoPath);
    const filename = path.basename(photoPath);
    const blob = new Blob([fileBuffer]);
    
    const form = new FormData();
    form.append('chat_id', chatId.toString());
    form.append('photo', blob, filename);
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', options?.parseMode || 'HTML');
    }

    const response = await fetch(TELEGRAM_API.getUrl('sendPhoto'), {
      method: 'POST',
      body: form,
    });

    const text = await response.text();
    if (!text) {
      logger.error('api', { method: 'sendPhoto', error: 'Empty response from Telegram' });
      return false;
    }
    
    const data = JSON.parse(text) as { ok: boolean; description?: string };
    
    if (!data.ok) {
      logger.error('api', { method: 'sendPhoto', error: data.description });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('api', { method: 'sendPhoto', error: String(error) });
    return false;
  }
}

/**
 * Send a document to a chat using native Node.js FormData
 */
export async function sendDocument(
  chatId: number,
  documentPath: string,
  caption?: string,
  originalFilename?: string
): Promise<boolean> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const fileBuffer = await fs.readFile(documentPath);
    const filename = originalFilename || path.basename(documentPath);
    const blob = new Blob([fileBuffer]);
    
    const form = new FormData();
    form.append('chat_id', chatId.toString());
    form.append('document', blob, filename);
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }

    const response = await fetch(TELEGRAM_API.getUrl('sendDocument'), {
      method: 'POST',
      body: form,
    });

    const text = await response.text();
    if (!text) {
      logger.error('api', { method: 'sendDocument', error: 'Empty response from Telegram' });
      return false;
    }
    
    const data = JSON.parse(text) as { ok: boolean; description?: string };
    
    if (!data.ok) {
      logger.error('api', { method: 'sendDocument', error: data.description });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('api', { method: 'sendDocument', error: String(error) });
    return false;
  }
}

/**
 * Send a voice message to a chat using native Node.js FormData
 */
export async function sendVoice(
  chatId: number,
  audioPath: string,
  caption?: string
): Promise<boolean> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const fileBuffer = await fs.readFile(audioPath);
    const filename = path.basename(audioPath);
    const blob = new Blob([fileBuffer]);
    
    const form = new FormData();
    form.append('chat_id', chatId.toString());
    form.append('voice', blob, filename);
    if (caption) {
      form.append('caption', caption);
    }

    const response = await fetch(TELEGRAM_API.getUrl('sendVoice'), {
      method: 'POST',
      body: form,
    });

    const text = await response.text();
    if (!text) {
      logger.error('api', { method: 'sendVoice', error: 'Empty response from Telegram' });
      return false;
    }
    
    const data = JSON.parse(text) as { ok: boolean; description?: string };
    
    if (!data.ok) {
      logger.error('api', { method: 'sendVoice', error: data.description });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('api', { method: 'sendVoice', error: String(error) });
    return false;
  }
}

/**
 * Send an audio file to a chat using native Node.js FormData
 */
export async function sendAudio(
  chatId: number,
  audioPath: string,
  caption?: string
): Promise<boolean> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const fileBuffer = await fs.readFile(audioPath);
    const filename = path.basename(audioPath);
    const blob = new Blob([fileBuffer]);
    
    const form = new FormData();
    form.append('chat_id', chatId.toString());
    form.append('audio', blob, filename);
    if (caption) {
      form.append('caption', caption);
    }

    const response = await fetch(TELEGRAM_API.getUrl('sendAudio'), {
      method: 'POST',
      body: form,
    });

    const text = await response.text();
    if (!text) {
      logger.error('api', { method: 'sendAudio', error: 'Empty response from Telegram' });
      return false;
    }
    
    const data = JSON.parse(text) as { ok: boolean; description?: string };
    
    if (!data.ok) {
      logger.error('api', { method: 'sendAudio', error: data.description });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('api', { method: 'sendAudio', error: String(error) });
    return false;
  }
}

// ============= FILE DOWNLOAD =============

interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

/**
 * Get file info from Telegram
 */
export async function getFile(fileId: string): Promise<TelegramFile | null> {
  return apiRequest<TelegramFile>('getFile', { file_id: fileId });
}

/**
 * Get full URL for a file from Telegram servers
 */
export function getFileUrl(filePath: string): string {
  return `https://api.telegram.org/file/bot${ENV.BOT_TOKEN}/${filePath}`;
}

/**
 * Resolve file_id to a downloadable URL
 */
export async function resolveFileUrl(fileId: string): Promise<string | null> {
  const file = await getFile(fileId);
  if (!file || !file.file_path) {
    return null;
  }
  return getFileUrl(file.file_path);
}

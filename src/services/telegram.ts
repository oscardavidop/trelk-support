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
    reply_to_message_id?: number;
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
  
  if (options?.reply_to_message_id) {
    (body as any).reply_to_message_id = options.reply_to_message_id;
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
  console.log('editMessage result', result);
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

// ============= POLLS =============

export interface SendPollOptions {
  type?: 'regular' | 'quiz';
  is_anonymous?: boolean;
  allows_multiple_answers?: boolean;
  open_period?: number;
  disable_notification?: boolean;
  protect_content?: boolean;
}

export interface SendPollResult {
  message_id: number;
  poll: {
    id: string;
    question: string;
    options: Array<{ text: string; voter_count: number }>;
    total_voter_count: number;
    is_closed: boolean;
    is_anonymous: boolean;
    type: string;
    allows_multiple_answers: boolean;
  };
}

export async function sendPoll(
  chatId: number,
  question: string,
  options: string[],
  pollOptions?: SendPollOptions
): Promise<SendPollResult | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    question,
    options: JSON.stringify(options),
    type: pollOptions?.type ?? 'regular',
    is_anonymous: pollOptions?.is_anonymous ?? false,
    allows_multiple_answers: pollOptions?.allows_multiple_answers ?? false,
  };

  if (pollOptions?.open_period) {
    body.open_period = pollOptions.open_period;
  }

  if (pollOptions?.disable_notification) {
    body.disable_notification = true;
  }

  if (pollOptions?.protect_content) {
    body.protect_content = true;
  }

  const result = await apiRequest<SendPollResult>('sendPoll', body);
  return result;
}

// ============= WEBHOOK MANAGEMENT =============

export async function setWebhook(url: string, secretToken: string): Promise<boolean> {
  const result = await apiRequest('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: ['message', 'callback_query', 'poll_answer'],
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
  console.log('getFile', fileId);
  const file = await apiRequest<TelegramFile>('getFile', { file_id: fileId });
  console.log('getFile result', file);
  return file;
}

/**
 * Get full URL for a file from Telegram servers (remote API)
 * @deprecated Use local file serving with getFile() for local bot-api
 */
export function getFileUrl(filePath: string): string {
  return `https://api.telegram.org/file/bot${ENV.BOT_TOKEN}/${filePath}`;
}

/**
 * Resolve file_id to a media URL for the dashboard
 * Returns the file_id to be used with /api/media/:fileId endpoint
 */
export async function resolveFileUrl(fileId: string): Promise<string | null> {
  // Verify file exists by calling getFile
  const file = await getFile(fileId);
  console.log('resolveFileUrl', fileId, file);
  if (!file || !file.file_path) {
    return null;
  }
  // Return the file_id as the media identifier
  // The frontend will use /api/media/{fileId} to fetch the file
  return fileId;
}

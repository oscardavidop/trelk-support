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
  InlineKeyboardMarkup,
  TelegramUserProfilePhotos
} from '../types/index.js';
import { logger } from './logger.js';
import { join } from 'path';

// ============= UPLOAD PATH HELPER =============

/**
 * Resolve a media source to either URL or local file path
 * Handles /uploads/... URLs by converting them to absolute file paths
 */
function resolveMediaSource(source: string): { isUrl: boolean; path: string } {
  // External URL
  if (source.startsWith('http://') || source.startsWith('https://')) {
    return { isUrl: true, path: source };
  }

  // Local upload URL - convert to file path
  if (source.startsWith('/uploads/')) {
    const localPath = join(process.cwd(), source);
    return { isUrl: false, path: localPath };
  }

  // Assume it's already a file path
  return { isUrl: false, path: source };
}

// ============= API REQUEST HELPER =============

async function apiRequest<T>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const url = TELEGRAM_API.getUrl(method);

  try {
    logger.info('api', {
      action: 'telegram_api_request',
      method,
      url,
      body: JSON.stringify(body)
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json() as { ok: boolean; result?: T; description?: string };

    logger.info('api', {
      action: 'telegram_api_response',
      method,
      ok: data.ok,
      description: data.description,
      hasResult: !!data.result,
      message_id: (data.result as any)?.message_id,
    });

    if (!data.ok) {
      logger.error('api', { method, error: data.description });
      throw new Error(data.description || 'Telegram API error');
    }

    return data.result ?? null;
  } catch (error) {
    logger.error('api', { action: 'telegram_api_error', method, url, error: String(error) });
    throw error;
  }
}

// ============= MESSAGE METHODS =============

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
  [key: string]: any;
}

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

/**
 * Send a message and return the message ID
 */
export async function sendMessageWithId(
  chatId: number,
  text: string,
  options?: {
    replyMarkup?: ReplyMarkup;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disablePreview?: boolean;
    reply_to_message_id?: number;
  }
): Promise<number | null> {
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

  const result = await apiRequest<TelegramMessage>('sendMessage', body as unknown as Record<string, unknown>);
  return result?.message_id ?? null;
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
  try {
    const result = await apiRequest('sendChatAction', {
      chat_id: chatId,
      action,
    });
    return result !== null;
  } catch (error) {
    return false;
  }
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
 * Send a photo to a chat
 * Supports both file path and URL (including /uploads/... local URLs)
 */
export async function sendPhoto(
  chatId: number,
  photoSource: string,
  options?: {
    caption?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: ReplyMarkup;
  }
): Promise<boolean> {
  try {
    // Resolve the media source (handles /uploads/... URLs)
    const { isUrl, path: resolvedPath } = resolveMediaSource(photoSource);

    if (isUrl) {
      // Send by URL using JSON API
      const body: Record<string, unknown> = {
        chat_id: chatId,
        photo: resolvedPath,
      };
      if (options?.caption) {
        body.caption = options.caption;
        body.parse_mode = options.parseMode || 'HTML';
      }
      if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }
      const result = await apiRequest('sendPhoto', body);
      return result !== null;
    } else {
      // Send by file upload
      const fs = await import('fs/promises');
      const path = await import('path');

      const fileBuffer = await fs.readFile(resolvedPath);
      const filename = path.basename(resolvedPath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('photo', blob, filename);
      if (options?.caption) {
        form.append('caption', options.caption);
        form.append('parse_mode', options.parseMode || 'HTML');
      }
      if (options?.replyMarkup) {
        form.append('reply_markup', JSON.stringify(options.replyMarkup));
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
    }
  } catch (error) {
    logger.error('api', { method: 'sendPhoto', error: String(error) });
    return false;
  }
}

/**
 * Send a photo and return the message ID
 * Supports URLs, /uploads/... local URLs, and file paths
 */
export async function sendPhotoWithId(
  chatId: number,
  photoSource: string,
  options?: {
    caption?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: ReplyMarkup;
  }
): Promise<number | null> {
  try {
    // Resolve the media source (handles /uploads/... URLs)
    const { isUrl, path: resolvedPath } = resolveMediaSource(photoSource);

    if (isUrl) {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        photo: resolvedPath,
      };
      if (options?.caption) {
        body.caption = options.caption;
        body.parse_mode = options.parseMode || 'HTML';
      }
      if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }
      const result = await apiRequest<TelegramMessage>('sendPhoto', body);
      return result?.message_id ?? null;
    } else {
      // Send by file upload
      const fs = await import('fs/promises');
      const path = await import('path');

      const fileBuffer = await fs.readFile(resolvedPath);
      const filename = path.basename(resolvedPath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('photo', blob, filename);
      if (options?.caption) {
        form.append('caption', options.caption);
        form.append('parse_mode', options.parseMode || 'HTML');
      }
      if (options?.replyMarkup) {
        form.append('reply_markup', JSON.stringify(options.replyMarkup));
      }

      const response = await fetch(TELEGRAM_API.getUrl('sendPhoto'), {
        method: 'POST',
        body: form,
      });

      const text = await response.text();
      if (!text) {
        logger.error('api', { method: 'sendPhotoWithId', error: 'Empty response from Telegram' });
        return null;
      }

      const data = JSON.parse(text) as { ok: boolean; result?: TelegramMessage; description?: string };

      if (!data.ok) {
        logger.error('api', { method: 'sendPhotoWithId', error: data.description });
        return null;
      }

      return data.result?.message_id ?? null;
    }
  } catch (error) {
    logger.error('api', { method: 'sendPhotoWithId', error: String(error) });
    return null;
  }
}

/**
 * Send a document to a chat
 * Supports both file path and URL (including /uploads/... local URLs)
 */
export async function sendDocument(
  chatId: number,
  documentSource: string,
  options?: {
    caption?: string;
    fileName?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: ReplyMarkup;
  }
): Promise<boolean> {
  try {
    // Resolve the media source (handles /uploads/... URLs)
    const { isUrl, path: resolvedPath } = resolveMediaSource(documentSource);

    if (isUrl) {
      // Send by URL using JSON API
      const body: Record<string, unknown> = {
        chat_id: chatId,
        document: resolvedPath,
      };
      if (options?.caption) {
        body.caption = options.caption;
        body.parse_mode = options.parseMode || 'HTML';
      }
      if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }
      const result = await apiRequest('sendDocument', body);
      return result !== null;
    } else {
      // Send by file upload
      const fs = await import('fs/promises');
      const path = await import('path');

      const fileBuffer = await fs.readFile(resolvedPath);
      const filename = options?.fileName || path.basename(resolvedPath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('document', blob, filename);
      if (options?.caption) {
        form.append('caption', options.caption);
        form.append('parse_mode', options.parseMode || 'HTML');
      }
      if (options?.replyMarkup) {
        form.append('reply_markup', JSON.stringify(options.replyMarkup));
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
    }
  } catch (error) {
    logger.error('api', { method: 'sendDocument', error: String(error) });
    return false;
  }
}

/**
 * Send a document and return the message ID
 * Supports URLs, /uploads/... local URLs, and file paths
 */
export async function sendDocumentWithId(
  chatId: number,
  documentSource: string,
  options?: {
    caption?: string;
    fileName?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: ReplyMarkup;
  }
): Promise<number | null> {
  try {
    // Resolve the media source (handles /uploads/... URLs)
    const { isUrl, path: resolvedPath } = resolveMediaSource(documentSource);

    if (isUrl) {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        document: resolvedPath,
      };
      if (options?.caption) {
        body.caption = options.caption;
        body.parse_mode = options.parseMode || 'HTML';
      }
      if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }
      const result = await apiRequest<TelegramMessage>('sendDocument', body);
      return result?.message_id ?? null;
    } else {
      // Send by file upload
      const fs = await import('fs/promises');
      const path = await import('path');

      const fileBuffer = await fs.readFile(resolvedPath);
      const filename = options?.fileName || path.basename(resolvedPath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('document', blob, filename);
      if (options?.caption) {
        form.append('caption', options.caption);
        form.append('parse_mode', options.parseMode || 'HTML');
      }
      if (options?.replyMarkup) {
        form.append('reply_markup', JSON.stringify(options.replyMarkup));
      }

      const response = await fetch(TELEGRAM_API.getUrl('sendDocument'), {
        method: 'POST',
        body: form,
      });

      const text = await response.text();
      if (!text) {
        logger.error('api', { method: 'sendDocumentWithId', error: 'Empty response from Telegram' });
        return null;
      }

      const data = JSON.parse(text) as { ok: boolean; result?: TelegramMessage; description?: string };

      if (!data.ok) {
        logger.error('api', { method: 'sendDocumentWithId', error: data.description });
        return null;
      }

      return data.result?.message_id ?? null;
    }
  } catch (error) {
    logger.error('api', { method: 'sendDocumentWithId', error: String(error) });
    return null;
  }
}

/**
 * Send a voice message to a chat
 * Supports both file path and URL (including /uploads/... local URLs)
 */
export async function sendVoice(
  chatId: number,
  audioSource: string,
  options?: {
    caption?: string;
    replyMarkup?: ReplyMarkup;
  }
): Promise<boolean> {
  try {
    // Resolve the media source (handles /uploads/... URLs)
    const { isUrl, path: resolvedPath } = resolveMediaSource(audioSource);

    if (isUrl) {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        voice: resolvedPath,
      };
      if (options?.caption) {
        body.caption = options.caption;
        body.parse_mode = 'HTML';
      }
      if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }
      const result = await apiRequest('sendVoice', body);
      return result !== null;
    } else {
      const fs = await import('fs/promises');
      const path = await import('path');

      const fileBuffer = await fs.readFile(resolvedPath);
      const filename = path.basename(resolvedPath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('voice', blob, filename);
      if (options?.caption) {
        form.append('caption', options.caption);
      }
      if (options?.replyMarkup) {
        form.append('reply_markup', JSON.stringify(options.replyMarkup));
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
    }
  } catch (error) {
    logger.error('api', { method: 'sendVoice', error: String(error) });
    return false;
  }
}

/**
 * Send an audio file to a chat
 * Supports both file path and URL (including /uploads/... local URLs)
 */
export async function sendAudio(
  chatId: number,
  audioSource: string,
  options?: {
    caption?: string;
    replyMarkup?: ReplyMarkup;
  }
): Promise<boolean> {
  try {
    // Resolve the media source (handles /uploads/... URLs)
    const { isUrl, path: resolvedPath } = resolveMediaSource(audioSource);

    if (isUrl) {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        audio: resolvedPath,
      };
      if (options?.caption) {
        body.caption = options.caption;
        body.parse_mode = 'HTML';
      }
      if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }
      const result = await apiRequest('sendAudio', body);
      return result !== null;
    } else {
      const fs = await import('fs/promises');
      const path = await import('path');

      const fileBuffer = await fs.readFile(resolvedPath);
      const filename = path.basename(resolvedPath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('audio', blob, filename);
      if (options?.caption) {
        form.append('caption', options.caption);
      }
      if (options?.replyMarkup) {
        form.append('reply_markup', JSON.stringify(options.replyMarkup));
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
    }
  } catch (error) {
    logger.error('api', { method: 'sendAudio', error: String(error) });
    throw error;
  }
}

/**
 * Send a video to a chat
 * Supports both file path and URL (including /uploads/... local URLs)
 */
export async function sendVideo(
  chatId: number,
  videoSource: string,
  options?: {
    caption?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: ReplyMarkup;
    width?: number;
    height?: number;
    duration?: number;
    supportsStreaming?: boolean;
  }
): Promise<boolean> {
  try {
    // Resolve the media source (handles /uploads/... URLs)
    const { isUrl, path: resolvedPath } = resolveMediaSource(videoSource);

    if (isUrl) {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        video: resolvedPath,
        supports_streaming: options?.supportsStreaming ?? true,
      };
      if (options?.caption) {
        body.caption = options.caption;
        body.parse_mode = options.parseMode || 'HTML';
      }
      if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }
      if (options?.width) body.width = options.width;
      if (options?.height) body.height = options.height;
      if (options?.duration) body.duration = options.duration;

      const result = await apiRequest('sendVideo', body);
      return result !== null;
    } else {
      const fs = await import('fs/promises');
      const path = await import('path');

      const fileBuffer = await fs.readFile(resolvedPath);
      const filename = path.basename(resolvedPath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('video', blob, filename);
      form.append('supports_streaming', 'true');
      if (options?.caption) {
        form.append('caption', options.caption);
        form.append('parse_mode', options.parseMode || 'HTML');
      }
      if (options?.replyMarkup) {
        form.append('reply_markup', JSON.stringify(options.replyMarkup));
      }

      const response = await fetch(TELEGRAM_API.getUrl('sendVideo'), {
        method: 'POST',
        body: form,
      });

      const text = await response.text();
      if (!text) {
        logger.error('api', { method: 'sendVideo', error: 'Empty response from Telegram' });
        return false;
      }

      const data = JSON.parse(text) as { ok: boolean; description?: string };

      if (!data.ok) {
        logger.error('api', { method: 'sendVideo', error: data.description });
        return false;
      }

      return true;
    }
  } catch (error) {
    logger.error('api', { method: 'sendVideo', error: String(error) });
    return false;
  }
}

/**
 * Send a video and return the message ID
 * Supports URLs, /uploads/... local URLs, and file paths
 */
export async function sendVideoWithId(
  chatId: number,
  videoSource: string,
  options?: {
    caption?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: ReplyMarkup;
    width?: number;
    height?: number;
    duration?: number;
    supportsStreaming?: boolean;
  }
): Promise<number | null> {
  try {
    // Resolve the media source (handles /uploads/... URLs)
    const { isUrl, path: resolvedPath } = resolveMediaSource(videoSource);

    if (isUrl) {
      const body: Record<string, unknown> = {
        chat_id: chatId,
        video: resolvedPath,
        supports_streaming: options?.supportsStreaming ?? true,
      };
      if (options?.caption) {
        body.caption = options.caption;
        body.parse_mode = options.parseMode || 'HTML';
      }
      if (options?.replyMarkup) {
        body.reply_markup = options.replyMarkup;
      }
      if (options?.width) body.width = options.width;
      if (options?.height) body.height = options.height;
      if (options?.duration) body.duration = options.duration;

      const result = await apiRequest<TelegramMessage>('sendVideo', body);
      return result?.message_id ?? null;
    } else {
      // Send by file upload
      const fs = await import('fs/promises');
      const path = await import('path');

      const fileBuffer = await fs.readFile(resolvedPath);
      const filename = path.basename(resolvedPath);
      const blob = new Blob([fileBuffer]);

      const form = new FormData();
      form.append('chat_id', chatId.toString());
      form.append('video', blob, filename);
      form.append('supports_streaming', 'true');
      if (options?.caption) {
        form.append('caption', options.caption);
        form.append('parse_mode', options.parseMode || 'HTML');
      }
      if (options?.replyMarkup) {
        form.append('reply_markup', JSON.stringify(options.replyMarkup));
      }

      const response = await fetch(TELEGRAM_API.getUrl('sendVideo'), {
        method: 'POST',
        body: form,
      });

      const text = await response.text();
      if (!text) {
        logger.error('api', { method: 'sendVideoWithId', error: 'Empty response from Telegram' });
        return null;
      }

      const data = JSON.parse(text) as { ok: boolean; result?: TelegramMessage; description?: string };

      if (!data.ok) {
        logger.error('api', { method: 'sendVideoWithId', error: data.description });
        return null;
      }

      return data.result?.message_id ?? null;
    }
  } catch (error) {
    logger.error('api', { method: 'sendVideoWithId', error: String(error) });
    return null;
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

export async function getFileBuffer(fileId: string) {
  const fileUrl = getFileUrl(fileId);
  const response = await fetch(fileUrl);
  console.log('getFileBuffer response', fileUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch file from Telegram: ${response.statusText}`);
  }
  return await response.arrayBuffer();
}

// ============= ADVANCED MESSAGE OPERATIONS =============

/**
 * Delete a message from a chat
 * Telegram API: deleteMessage
 */
export async function deleteMessage(
  chatId: number,
  messageId: number
): Promise<boolean> {
  const result = await apiRequest('deleteMessage', {
    chat_id: chatId,
    message_id: messageId,
  });
  return result !== null;
}

/**
 * Delete multiple messages from a chat (up to 100)
 * Telegram API: deleteMessages
 */
export async function deleteMessages(
  chatId: number,
  messageIds: number[]
): Promise<boolean> {
  if (messageIds.length === 0) return true;
  if (messageIds.length > 100) {
    // Split into chunks of 100
    const chunks = [];
    for (let i = 0; i < messageIds.length; i += 100) {
      chunks.push(messageIds.slice(i, i + 100));
    }
    const results = await Promise.all(
      chunks.map(chunk => apiRequest('deleteMessages', {
        chat_id: chatId,
        message_ids: chunk,
      }))
    );
    return results.every(r => r !== null);
  }
  const result = await apiRequest('deleteMessages', {
    chat_id: chatId,
    message_ids: messageIds,
  });
  return result !== null;
}

/**
 * Edit the reply markup (inline keyboard) of a message
 * Telegram API: editMessageReplyMarkup
 */
export async function editMessageReplyMarkup(
  chatId: number,
  messageId: number,
  replyMarkup?: InlineKeyboardMarkup
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  } else {
    // Empty object to remove keyboard
    body.reply_markup = { inline_keyboard: [] };
  }

  const result = await apiRequest('editMessageReplyMarkup', body);
  return result !== null;
}

/**
 * Edit message caption (for media messages)
 * Telegram API: editMessageCaption
 */
export async function editMessageCaption(
  chatId: number,
  messageId: number,
  caption: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: InlineKeyboardMarkup;
  }
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    caption,
    parse_mode: options?.parseMode ?? 'HTML',
  };

  if (options?.replyMarkup) {
    body.reply_markup = options.replyMarkup;
  }

  const result = await apiRequest('editMessageCaption', body);
  return result !== null;
}

/**
 * Edit message media (photo, video, document, etc.)
 * Telegram API: editMessageMedia
 */
export async function editMessageMedia(
  chatId: number,
  messageId: number,
  media: {
    type: 'photo' | 'video' | 'document' | 'audio';
    media: string; // URL or file_id
    caption?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  },
  replyMarkup?: InlineKeyboardMarkup
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    media: {
      type: media.type,
      media: media.media,
      caption: media.caption,
      parse_mode: media.parseMode ?? 'HTML',
    },
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const result = await apiRequest('editMessageMedia', body);
  return result !== null;
}

// ============= PIN/UNPIN MESSAGES =============

/**
 * Pin a message in a chat
 * Telegram API: pinChatMessage
 */
export async function pinChatMessage(
  chatId: number,
  messageId: number,
  options?: {
    disableNotification?: boolean;
  }
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: options?.disableNotification ?? true,
  };

  const result = await apiRequest('pinChatMessage', body);
  return result !== null;
}

/**
 * Unpin a specific message in a chat
 * Telegram API: unpinChatMessage
 */
export async function unpinChatMessage(
  chatId: number,
  messageId?: number
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
  };

  if (messageId) {
    body.message_id = messageId;
  }

  const result = await apiRequest('unpinChatMessage', body);
  return result !== null;
}

/**
 * Unpin all messages in a chat
 * Telegram API: unpinAllChatMessages
 */
export async function unpinAllChatMessages(
  chatId: number
): Promise<boolean> {
  const result = await apiRequest('unpinAllChatMessages', {
    chat_id: chatId,
  });
  return result !== null;
}

// ============= REPLY KEYBOARD OPERATIONS =============

/**
 * Build a ReplyKeyboardMarkup object
 */
export interface ReplyKeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  request_poll?: { type?: 'quiz' | 'regular' };
}

export interface ReplyKeyboardMarkupOptions {
  keyboard: ReplyKeyboardButton[][];
  resizeKeyboard?: boolean;
  oneTimeKeyboard?: boolean;
  inputFieldPlaceholder?: string;
  selective?: boolean;
  isPersistent?: boolean;
}

export function buildReplyKeyboard(options: ReplyKeyboardMarkupOptions): ReplyMarkup {
  return {
    keyboard: options.keyboard,
    resize_keyboard: options.resizeKeyboard ?? true,
    one_time_keyboard: options.oneTimeKeyboard ?? false,
    input_field_placeholder: options.inputFieldPlaceholder,
    selective: options.selective,
    is_persistent: options.isPersistent,
  } as ReplyMarkup;
}

/**
 * Build a ReplyKeyboardRemove object to remove reply keyboard
 */
export function buildReplyKeyboardRemove(selective?: boolean): ReplyMarkup {
  return {
    remove_keyboard: true,
    selective,
  } as ReplyMarkup;
}

/**
 * Build an InlineKeyboardMarkup from rows of buttons
 */
export interface InlineKeyboardButton {
  text: string;
  callbackData?: string;
  url?: string;
  webApp?: { url: string };
  switchInlineQuery?: string;
  switchInlineQueryCurrentChat?: string;
}

export function buildInlineKeyboard(rows: InlineKeyboardButton[][]): InlineKeyboardMarkup {
  return {
    inline_keyboard: rows.map(row =>
      row.map(btn => ({
        text: btn.text,
        callback_data: btn.callbackData,
        url: btn.url,
        web_app: btn.webApp,
        switch_inline_query: btn.switchInlineQuery,
        switch_inline_query_current_chat: btn.switchInlineQueryCurrentChat,
      }))
    ),
  };
}

// ============= COPY/FORWARD MESSAGES =============

/**
 * Copy a message to another chat
 * Telegram API: copyMessage
 */
export async function copyMessage(
  chatId: number,
  fromChatId: number,
  messageId: number,
  options?: {
    caption?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: ReplyMarkup;
    disableNotification?: boolean;
  }
): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId,
  };

  if (options?.caption !== undefined) {
    body.caption = options.caption;
    body.parse_mode = options.parseMode ?? 'HTML';
  }

  if (options?.replyMarkup) {
    body.reply_markup = options.replyMarkup;
  }

  if (options?.disableNotification) {
    body.disable_notification = true;
  }

  const result = await apiRequest<{ message_id: number }>('copyMessage', body);
  return result?.message_id ?? null;
}

/**
 * Forward a message to another chat
 * Telegram API: forwardMessage
 */
export async function forwardMessage(
  chatId: number,
  fromChatId: number,
  messageId: number,
  options?: {
    disableNotification?: boolean;
    protectContent?: boolean;
  }
): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId,
  };

  if (options?.disableNotification) {
    body.disable_notification = true;
  }

  if (options?.protectContent) {
    body.protect_content = true;
  }

  const result = await apiRequest<TelegramMessage>('forwardMessage', body);
  return result?.message_id ?? null;
}

// ============= STICKERS =============

/**
 * Send a sticker
 * Telegram API: sendSticker
 */
export async function sendSticker(
  chatId: number,
  sticker: string, // file_id or URL
  options?: {
    emoji?: string;
    replyMarkup?: ReplyMarkup;
    disableNotification?: boolean;
  }
): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    sticker,
  };

  if (options?.emoji) {
    body.emoji = options.emoji;
  }

  if (options?.replyMarkup) {
    body.reply_markup = options.replyMarkup;
  }

  if (options?.disableNotification) {
    body.disable_notification = true;
  }

  const result = await apiRequest<TelegramMessage>('sendSticker', body);
  return result?.message_id ?? null;
}

// ============= LOCATION & VENUE =============

/**
 * Send location
 * Telegram API: sendLocation
 */
export async function sendLocation(
  chatId: number,
  latitude: number,
  longitude: number,
  options?: {
    horizontalAccuracy?: number;
    livePeriod?: number; // 60-86400 seconds for live location
    heading?: number;
    proximityAlertRadius?: number;
    replyMarkup?: ReplyMarkup;
    disableNotification?: boolean;
  }
): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    latitude,
    longitude,
  };

  if (options?.horizontalAccuracy) body.horizontal_accuracy = options.horizontalAccuracy;
  if (options?.livePeriod) body.live_period = options.livePeriod;
  if (options?.heading) body.heading = options.heading;
  if (options?.proximityAlertRadius) body.proximity_alert_radius = options.proximityAlertRadius;
  if (options?.replyMarkup) body.reply_markup = options.replyMarkup;
  if (options?.disableNotification) body.disable_notification = true;

  const result = await apiRequest<TelegramMessage>('sendLocation', body);
  return result?.message_id ?? null;
}

/**
 * Send venue
 * Telegram API: sendVenue
 */
export async function sendVenue(
  chatId: number,
  latitude: number,
  longitude: number,
  title: string,
  address: string,
  options?: {
    foursquareId?: string;
    foursquareType?: string;
    googlePlaceId?: string;
    googlePlaceType?: string;
    replyMarkup?: ReplyMarkup;
    disableNotification?: boolean;
  }
): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    latitude,
    longitude,
    title,
    address,
  };

  if (options?.foursquareId) body.foursquare_id = options.foursquareId;
  if (options?.foursquareType) body.foursquare_type = options.foursquareType;
  if (options?.googlePlaceId) body.google_place_id = options.googlePlaceId;
  if (options?.googlePlaceType) body.google_place_type = options.googlePlaceType;
  if (options?.replyMarkup) body.reply_markup = options.replyMarkup;
  if (options?.disableNotification) body.disable_notification = true;

  const result = await apiRequest<TelegramMessage>('sendVenue', body);
  return result?.message_id ?? null;
}

/**
 * Send contact
 * Telegram API: sendContact
 */
export async function sendContact(
  chatId: number,
  phoneNumber: string,
  firstName: string,
  options?: {
    lastName?: string;
    vcard?: string;
    replyMarkup?: ReplyMarkup;
    disableNotification?: boolean;
  }
): Promise<number | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    phone_number: phoneNumber,
    first_name: firstName,
  };

  if (options?.lastName) body.last_name = options.lastName;
  if (options?.vcard) body.vcard = options.vcard;
  if (options?.replyMarkup) body.reply_markup = options.replyMarkup;
  if (options?.disableNotification) body.disable_notification = true;

  const result = await apiRequest<TelegramMessage>('sendContact', body);
  return result?.message_id ?? null;
}

// ============= DICE & GAMES =============

/**
 * Send dice/random animation
 * Telegram API: sendDice
 */
export async function sendDice(
  chatId: number,
  emoji?: '🎲' | '🎯' | '🏀' | '⚽' | '🎳' | '🎰',
  options?: {
    replyMarkup?: ReplyMarkup;
    disableNotification?: boolean;
  }
): Promise<{ messageId: number; value: number } | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    emoji: emoji ?? '🎲',
  };

  if (options?.replyMarkup) body.reply_markup = options.replyMarkup;
  if (options?.disableNotification) body.disable_notification = true;

  const result = await apiRequest<{ message_id: number; dice: { value: number } }>('sendDice', body);
  if (!result) return null;

  return {
    messageId: result.message_id,
    value: result.dice?.value ?? 0,
  };
}

// ============= CHAT MEMBER MANAGEMENT =============

/**
 * Get information about a chat member
 * Telegram API: getChatMember
 */
export async function getChatMember(
  chatId: number,
  userId: number
): Promise<{ status: string; user: any } | null> {
  const result = await apiRequest<{ status: string; user: any }>('getChatMember', {
    chat_id: chatId,
    user_id: userId,
  });
  return result;
}

/**
 * Get the number of members in a chat
 * Telegram API: getChatMemberCount
 */
export async function getChatMemberCount(
  chatId: number
): Promise<number | null> {
  const result = await apiRequest<number>('getChatMemberCount', {
    chat_id: chatId,
  });
  return result;
}

// ============= SET MENU BUTTON =============

/**
 * Set the bot's menu button for a specific user
 * Telegram API: setChatMenuButton
 */
export async function setChatMenuButton(
  chatId?: number,
  menuButton?: {
    type: 'commands' | 'web_app' | 'default';
    text?: string;
    webApp?: { url: string };
  }
): Promise<boolean> {
  const body: Record<string, unknown> = {};

  if (chatId) {
    body.chat_id = chatId;
  }

  if (menuButton) {
    if (menuButton.type === 'web_app' && menuButton.webApp) {
      body.menu_button = {
        type: 'web_app',
        text: menuButton.text || 'Menu',
        web_app: menuButton.webApp,
      };
    } else if (menuButton.type === 'commands') {
      body.menu_button = { type: 'commands' };
    } else {
      body.menu_button = { type: 'default' };
    }
  }

  const result = await apiRequest('setChatMenuButton', body);
  return result !== null;
}

// ============= TYPING SIMULATION =============

/**
 * Simulate typing for a duration, sending chat action periodically
 * Useful for making bot feel more natural
 */
export async function simulateTyping(
  chatId: number,
  durationMs: number = 2000
): Promise<void> {
  const startTime = Date.now();
  const interval = 4000; // Telegram chat action lasts ~5 seconds

  // Send initial action
  await sendChatAction(chatId, 'typing');

  // Continue sending until duration is reached
  while (Date.now() - startTime < durationMs - interval) {
    await new Promise(resolve => setTimeout(resolve, interval));
    if (Date.now() - startTime < durationMs) {
      await sendChatAction(chatId, 'typing');
    }
  }

  // Wait remaining time
  const remaining = durationMs - (Date.now() - startTime);
  if (remaining > 0) {
    await new Promise(resolve => setTimeout(resolve, remaining));
  }
}

// ============= USER PROFILE PHOTOS =============

/**
 * Get user profile photos
 * Telegram API: getUserProfilePhotos
 */
export async function getUserProfilePhotos(
  userId: number,
  options?: {
    offset?: number;
    limit?: number;
  }
): Promise<TelegramUserProfilePhotos | null> {
  const body: Record<string, unknown> = {
    user_id: userId,
  };

  if (options?.offset !== undefined) {
    body.offset = options.offset;
  }

  if (options?.limit !== undefined) {
    body.limit = options.limit;
  }

  const result = await apiRequest<TelegramUserProfilePhotos>('getUserProfilePhotos', body);
  return result;
}

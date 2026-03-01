/**
 * Type definitions for Trelk Support Bot
 */

import { ConversationState, TicketCategory } from '../config/index.js';

// ============= LANGUAGE =============

export type Language = string;

// ============= TELEGRAM API TYPES =============

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

// Telegram media types
export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumb?: TelegramPhotoSize;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumb?: TelegramPhotoSize;
}

export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  type: 'regular' | 'mask' | 'custom_emoji';
  width: number;
  height: number;
  is_animated: boolean;
  is_video: boolean;
  emoji?: string;
  set_name?: string;
  file_size?: number;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhotoSize[];
  document?: TelegramDocument;
  voice?: TelegramVoice;
  audio?: TelegramAudio;
  sticker?: TelegramSticker;
  entities?: TelegramMessageEntity[];
  reply_to_message?: TelegramMessage;
}

export interface TelegramMessageEntity {
  type: 'bot_command' | 'mention' | 'hashtag' | 'url' | 'email' | 'bold' | 'italic' | 'code' | 'pre' | 'text_link' | 'text_mention';
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  chat_instance: string;
  data?: string;
}

// Chat actions for sendChatAction
export type ChatAction = 
  | 'typing' 
  | 'upload_photo' 
  | 'record_video' 
  | 'upload_video' 
  | 'record_voice' 
  | 'upload_voice' 
  | 'upload_document' 
  | 'find_location' 
  | 'record_video_note' 
  | 'upload_video_note';

export interface TelegramPollAnswer {
  poll_id: string;
  user: TelegramUser;
  option_ids: number[];
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  poll_answer?: TelegramPollAnswer;
}

// ============= INLINE KEYBOARD TYPES =============

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface ReplyKeyboardRemove {
  remove_keyboard: true;
}

// Reply Keyboard for text buttons
export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
}

export type ReplyMarkup = InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove;

// ============= USER SESSION =============

export interface UserSession {
  chatId: number;
  userId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  language: Language;
  state: ConversationState;
  currentTicket?: TicketDraft;
  lastActivity: number;
  messageCount: number;
  lastMessageTime: number;
}

// ============= TICKET SYSTEM =============

export interface TicketDraft {
  category?: TicketCategory;
  description?: string;
}

export interface Ticket {
  id: string;
  odlerId: number;
  chatId: number;
  username?: string;
  firstName: string;
  category: TicketCategory;
  description: string;
  status: TicketStatus;
  createdAt: number;
  updatedAt: number;
  assignedTo?: number;
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  AWAITING_USER = 'awaiting_user',
  ESCALATED = 'escalated',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

// ============= API RESPONSE TYPES =============

export interface SendMessageOptions {
  chat_id: number;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: ReplyMarkup;
  disable_web_page_preview?: boolean;
}

export interface EditMessageOptions {
  chat_id: number;
  message_id: number;
  text: string;
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  reply_markup?: InlineKeyboardMarkup;
}

export interface AnswerCallbackQueryOptions {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
}

// ============= LOGGING =============

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  type: 'broadcast' | 'command' | 'contacts' | 'segment' | 'callback' | 'message' | 'api' | 'error' | 'ticket' | 'chat' | 'inactivity' | 'saved_reply' | 'upload' | 'survey' | 'enterprise' | 'transfer' | 'block' | 'flow' | 'settings' | 'redis' | 'cache' | 'queue' | 'workers' | 'worker:scheduled' | 'worker:flow' | 'worker:cleanup' | 'worker:inactivity' | 'worker:notifications' | 'cache-models' | 'session-guard' | 'admin' | 'admin-control' | 'settings-cache' | 'broadcast_worker' | 'telegram-error-handler' | 'password-reset' | 'telegram-notifications' | 'mfa-service' | 'auth' | 'permission' | 'agent-service' | 'rate-limit' | 'telegram-link' | 'qr-login' | 'polling' | 'auto-lock' | 'telegram-notification' | 'webchat' | 'webchat-socket' | 'webchat-routes' | 'channels' | 'webchat-security' | 'policy-engine' | 'policy' | 'policy-routes' | 'sessions' | 'media-admin' | 'media-sync' | 'translation' | 'presence' | 'security';
  userId?: number;
  chatId?: number;
  data: Record<string, unknown>;
  timestamp: number;
}

export interface TelegramUserProfilePhotos {
  total_count: number;
  photos: TelegramPhotoSize[][];
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}
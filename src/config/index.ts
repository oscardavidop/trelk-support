import 'dotenv/config';
import mongoose from 'mongoose';

/**
 * Trelk Support Platform Configuration
 * @TrelkSupportBot - Official support bot for Trelk Bot
 */

// ============= BOT INFORMATION =============

export const BOT_INFO = {
  name: 'Trelk Support',
  username: '@TrelkSupportBot',
  mainBot: '@TrelkBot',
  about: 'Official TrelkBot support 🤖 @TrelkBot',
  description: 'Fast assistance for users and subscribers.\nWe\'re here to help you 24/7.',
} as const;

// ============= ENVIRONMENT VARIABLES =============

export const ENV = {
  // Bot
  BOT_TOKEN: process.env.SUPPORT_BOT_TOKEN || '',
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'trelk-support-secret',
  WEBHOOK_URL: process.env.WEBHOOK_URL || '',
  
  // Server
  PORT: parseInt(process.env.PORT || '8443', 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/trelk_support',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-secret-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Dashboard
  DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:5173',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
} as const;

// ============= WEBHOOK CONFIGURATION =============

export const WEBHOOK_CONFIG = {
  path: '/webhook/support',
  secretHeader: 'x-telegram-bot-api-secret-token',
} as const;

// ============= CONVERSATION STATES =============

export enum ConversationState {
  IDLE = 'idle',
  ONBOARDING = 'onboarding',
  FAQ = 'faq',
  TICKET_TYPE = 'ticket_type',
  TICKET_DESCRIPTION = 'ticket_description',
  TICKET_CONFIRMATION = 'ticket_confirmation',
  AWAITING_HUMAN = 'awaiting_human',
}

// ============= TICKET CATEGORIES =============

export enum TicketCategory {
  BUG = 'bug',
  PAYMENT = 'payment',
  ACCOUNT = 'account',
  FEATURE = 'feature',
  OTHER = 'other',
}

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, { en: string; es: string }> = {
  [TicketCategory.BUG]: { en: '🐛 Bug Report', es: '🐛 Reporte de Bug' },
  [TicketCategory.PAYMENT]: { en: '💳 Payment Issue', es: '💳 Problema de Pago' },
  [TicketCategory.ACCOUNT]: { en: '👤 Account Issue', es: '👤 Problema de Cuenta' },
  [TicketCategory.FEATURE]: { en: '✨ Feature Request', es: '✨ Solicitud de Función' },
  [TicketCategory.OTHER]: { en: '❓ Other', es: '❓ Otro' },
};

// ============= RATE LIMITING =============

export const RATE_LIMIT = {
  maxMessages: 30,
  windowMs: 60000, // 1 minute
  blockDurationMs: 300000, // 5 minutes
} as const;

// ============= SPAM PROTECTION =============

export const SPAM_PROTECTION = {
  maxMessageLength: 2000,
  minTimeBetweenMessages: 500, // ms
  maxCallbacksPerMinute: 20,
} as const;

// ============= SUPPORT TEAM =============

export const SUPPORT_AGENTS: number[] = (process.env.SUPPORT_AGENT_IDS || '')
  .split(',')
  .filter(Boolean)
  .map(id => parseInt(id.trim(), 10));

export const SUPPORT_GROUP_ID = process.env.SUPPORT_GROUP_ID
  ? parseInt(process.env.SUPPORT_GROUP_ID, 10)
  : null;

// ============= TELEGRAM API =============

export const TELEGRAM_API = {
  baseUrl: process.env.TELEGRAM_API_BASE_URL || 'https://api.telegram.org',
  getUrl: (method: string) => `${TELEGRAM_API.baseUrl}/bot${ENV.BOT_TOKEN}/${method}`,
} as const;

// ============= VALIDATION =============

export function validateConfig(): void {
  if (!ENV.BOT_TOKEN) {
    throw new Error('SUPPORT_BOT_TOKEN is required');
  }
  
  if (ENV.NODE_ENV === 'production' && !ENV.WEBHOOK_URL) {
    throw new Error('WEBHOOK_URL is required in production');
  }
}

// ============= SYSTEM USERS =============

export const SYSTEM_USERS = {
  FLOW_USER_ID: new mongoose.Types.ObjectId('69657bbb7d0c78d9521ef874'),
} as const;

/**
 * Simple Logger for Trelk Support Bot (Hardened)
 * - Structured JSON output in production
 * - Sensitive field redaction
 * - Security event tracking
 */

import { ENV } from '../config/index.js';
import type { LogEntry } from '../types/index.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel =
  LOG_LEVELS[ENV.LOG_LEVEL as LogLevel] ?? LOG_LEVELS.info;

const isDev = ENV.NODE_ENV === 'development';

// Fields that must NEVER appear in logs
const SENSITIVE_KEYS = new Set([
  'password', 'currentPassword', 'newPassword', 'confirmPassword',
  'token', 'accessToken', 'refreshToken', 'jwt', 'secret',
  'apiKey', 'api_key', 'authorization', 'cookie',
  'proxyPassword', 'proxyUsername', 'credentials',
  'creditCard', 'ssn', 'socialSecurity',
  'NOTIFICATION_BOT_TOKEN', 'BOT_TOKEN', 'WEBHOOK_SECRET', 'JWT_SECRET',
]);

/**
 * Redact sensitive fields from data before logging
 */
function redactData(data: Record<string, unknown>, depth = 0): Record<string, unknown> {
  if (depth > 5) return { '[truncated]': true };
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string' && value.length > 500) {
      redacted[key] = value.slice(0, 500) + '...[truncated]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      redacted[key] = redactData(value as Record<string, unknown>, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/* ───────────── colors ───────────── */
const colors = {
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};

function colorLevel(level: LogLevel, text: string): string {
  if (!isDev) return text;

  switch (level) {
    case 'debug':
      return colors.gray(text);
    case 'info':
      return colors.blue(text);
    case 'warn':
      return colors.yellow(text);
    case 'error':
      return colors.red(text);
  }
}

/* ───────────── formatters ───────────── */

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8); // HH:mm:ss
}

function formatLog(entry: LogEntry): string {
  // 🏭 producción → JSON puro
  if (!isDev) {
    return JSON.stringify(entry);
  }

  const time = formatTime(entry.timestamp);
  const level = colorLevel(
    entry.level,
    entry.level.toUpperCase().padEnd(5)
  );
  const type = entry.type.padEnd(8);

  let msg = `${colors.gray(time)} ${level} [${type}]`;

  if (entry.userId) msg += ` user:${entry.userId}`;
  if (entry.chatId) msg += ` chat:${entry.chatId}`;

  if (Object.keys(entry.data).length > 0) {
    msg += `\n  ${JSON.stringify(entry.data, null, 2)
      .split('\n')
      .join('\n  ')}`;
  }

  return msg;
}

/* ───────────── core ───────────── */

function log(
  level: LogLevel,
  type: LogEntry['type'],
  data: Record<string, unknown>,
  userId?: number,
  chatId?: number
): void {
  if (LOG_LEVELS[level] < currentLevel) return;

  // Always redact sensitive fields
  const safeData = redactData(data);

  const entry: LogEntry = {
    level,
    type,
    userId,
    chatId,
    data: safeData,
    timestamp: Date.now(),
  };

  const formatted = formatLog(entry);

  switch (level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/* ───────────── public api ───────────── */

export const logger = {
  debug: (
    type: LogEntry['type'],
    data: Record<string, unknown>,
    userId?: number,
    chatId?: number
  ) => log('debug', type, data, userId, chatId),

  info: (
    type: LogEntry['type'],
    data: Record<string, unknown>,
    userId?: number,
    chatId?: number
  ) => log('info', type, data, userId, chatId),

  warn: (
    type: LogEntry['type'],
    data: Record<string, unknown>,
    userId?: number,
    chatId?: number
  ) => log('warn', type, data, userId, chatId),

  error: (
    type: LogEntry['type'],
    data: Record<string, unknown>,
    userId?: number,
    chatId?: number
  ) => log('error', type, data, userId, chatId),

  command: (command: string, userId: number, chatId: number) =>
    log('info', 'command', { command }, userId, chatId),

  callback: (data: string, userId: number, chatId: number) =>
    log('info', 'callback', { data }, userId, chatId),

  ticket: (action: string, ticketId: string, userId: number) =>
    log('info', 'ticket', { action, ticketId }, userId),
};

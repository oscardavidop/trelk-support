/**
 * Simple Logger for Trelk Support Bot
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

const currentLevel = LOG_LEVELS[ENV.LOG_LEVEL as LogLevel] ?? LOG_LEVELS.info;

function formatLog(entry: LogEntry): string {
  const time = new Date(entry.timestamp).toISOString();
  const level = entry.level.toUpperCase().padEnd(5);
  const type = entry.type.padEnd(8);
  
  let msg = `[${time}] ${level} [${type}]`;
  
  if (entry.userId) msg += ` user:${entry.userId}`;
  if (entry.chatId) msg += ` chat:${entry.chatId}`;
  
  if (Object.keys(entry.data).length > 0) {
    msg += ` ${JSON.stringify(entry.data)}`;
  }
  
  return msg;
}

function log(level: LogLevel, type: LogEntry['type'], data: Record<string, unknown>, userId?: number, chatId?: number): void {
  if (LOG_LEVELS[level] < currentLevel) return;
  
  const entry: LogEntry = {
    level,
    type,
    userId,
    chatId,
    data,
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

export const logger = {
  debug: (type: LogEntry['type'], data: Record<string, unknown>, userId?: number, chatId?: number) => 
    log('debug', type, data, userId, chatId),
  
  info: (type: LogEntry['type'], data: Record<string, unknown>, userId?: number, chatId?: number) => 
    log('info', type, data, userId, chatId),
  
  warn: (type: LogEntry['type'], data: Record<string, unknown>, userId?: number, chatId?: number) => 
    log('warn', type, data, userId, chatId),
  
  error: (type: LogEntry['type'], data: Record<string, unknown>, userId?: number, chatId?: number) => 
    log('error', type, data, userId, chatId),
  
  command: (command: string, userId: number, chatId: number) =>
    log('info', 'command', { command }, userId, chatId),
  
  callback: (data: string, userId: number, chatId: number) =>
    log('info', 'callback', { data }, userId, chatId),
  
  ticket: (action: string, ticketId: string, userId: number) =>
    log('info', 'ticket', { action, ticketId }, userId),
};

/**
 * Inactivity Service
 * Handles automatic chat closure due to user inactivity
 * 
 * Uses BullMQ for persistent timers that survive server restarts
 */

import { getSettings } from './settings.service.js';
import { closeSession, getSessionById } from './chat.service.js';
import { sendMessage as sendTelegramMessage } from './telegram.js';
import { emitChatClosed, emitChatWarning } from './socket.js';
import { logger } from './logger.js';
import { isRedisConnected } from './redis.js';
import {
  scheduleInactivityWarning,
  scheduleInactivityClose,
  scheduleQueuedClose,
  cancelInactivityTimers,
  removeJob,
  QUEUE_NAMES,
} from './queue.js';

// ============= FALLBACK IN-MEMORY TIMERS =============
// Used only when Redis is not available

interface InactivityTimer {
  warningTimer: NodeJS.Timeout | null;
  closeTimer: NodeJS.Timeout | null;
  sessionId: string;
  telegramChatId: number;
}

interface QueuedSessionTimer {
  closeTimer: NodeJS.Timeout;
  sessionId: string;
  telegramChatId: number;
}

const fallbackTimers = new Map<string, InactivityTimer>();
const fallbackQueuedTimers = new Map<string, QueuedSessionTimer>();

// ============= PUBLIC API =============

/**
 * Start inactivity timer for a session
 * Called when agent sends a message
 */
export async function startInactivityTimer(
  sessionId: string, 
  telegramChatId: number
): Promise<void> {
  // Clear any existing timer for this session
  await clearInactivityTimer(sessionId);
  
  const settings = await getSettings();
  const autoCloseMinutes = settings.chat.autoCloseInactiveMinutes || 10;
  const warningMinutes = Math.max(1, autoCloseMinutes - 5); // Warn 5 mins before closing
  const remainingAfterWarning = autoCloseMinutes - warningMinutes;
  
  logger.debug('inactivity', {
    action: 'timer_started',
    sessionId,
    warningMinutes,
    autoCloseMinutes,
    usingBullMQ: isRedisConnected(),
  });
  
  if (isRedisConnected()) {
    // Use BullMQ - timers persist across restarts
    await scheduleInactivityWarning(sessionId, telegramChatId, warningMinutes, remainingAfterWarning);
    await scheduleInactivityClose(sessionId, telegramChatId, autoCloseMinutes);
  } else {
    // Fallback to in-memory timers
    const warningMs = warningMinutes * 60 * 1000;
    const closeMs = autoCloseMinutes * 60 * 1000;
    
    const warningTimer = setTimeout(async () => {
      await sendWarningFallback(sessionId, telegramChatId, remainingAfterWarning);
    }, warningMs);
    
    const closeTimer = setTimeout(async () => {
      await autoCloseSessionFallback(sessionId, telegramChatId);
    }, closeMs);
    
    fallbackTimers.set(sessionId, {
      warningTimer,
      closeTimer,
      sessionId,
      telegramChatId,
    });
  }
}

/**
 * Reset inactivity timer (user responded)
 */
export async function resetInactivityTimer(sessionId: string): Promise<void> {
  if (isRedisConnected()) {
    // For BullMQ, we need the chatId to reschedule
    const session = await getSessionById(sessionId);
    if (session && session.telegramChatId) {
      logger.debug('inactivity', { action: 'timer_reset', sessionId });
      await startInactivityTimer(sessionId, session.telegramChatId);
    }
  } else {
    const timer = fallbackTimers.get(sessionId);
    if (timer) {
      logger.debug('inactivity', { action: 'timer_reset', sessionId });
      await startInactivityTimer(sessionId, timer.telegramChatId);
    }
  }
}

/**
 * Start timer for queued/waiting sessions
 */
export async function startQueuedTimer(
  sessionId: string,
  telegramChatId: number
): Promise<void> {
  await clearQueuedTimer(sessionId);
  
  const settings = await getSettings();
  const queuedTimeoutMinutes = settings.chat.queuedTimeoutMinutes || 10;
  
  logger.debug('inactivity', {
    action: 'queued_timer_started',
    sessionId,
    timeoutMinutes: queuedTimeoutMinutes,
    usingBullMQ: isRedisConnected(),
  });
  
  if (isRedisConnected()) {
    await scheduleQueuedClose(sessionId, telegramChatId, queuedTimeoutMinutes);
  } else {
    const timeoutMs = queuedTimeoutMinutes * 60 * 1000;
    
    const closeTimer = setTimeout(async () => {
      await autoCloseQueuedSessionFallback(sessionId, telegramChatId);
    }, timeoutMs);
    
    fallbackQueuedTimers.set(sessionId, {
      closeTimer,
      sessionId,
      telegramChatId,
    });
  }
}

/**
 * Clear queued session timer
 */
export async function clearQueuedTimer(sessionId: string): Promise<void> {
  if (isRedisConnected()) {
    await removeJob(QUEUE_NAMES.INACTIVITY, `inactivity-queued-${sessionId}`);
  } else {
    const timer = fallbackQueuedTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer.closeTimer);
      fallbackQueuedTimers.delete(sessionId);
    }
  }
  
  logger.debug('inactivity', { action: 'queued_timer_cleared', sessionId });
}

/**
 * Reset queued timer when user sends a message
 */
export async function resetQueuedTimer(sessionId: string): Promise<void> {
  if (isRedisConnected()) {
    const session = await getSessionById(sessionId);
    if (session && session.telegramChatId) {
      logger.debug('inactivity', { action: 'queued_timer_reset', sessionId });
      await startQueuedTimer(sessionId, session.telegramChatId);
    }
  } else {
    const timer = fallbackQueuedTimers.get(sessionId);
    if (timer) {
      logger.debug('inactivity', { action: 'queued_timer_reset', sessionId });
      await startQueuedTimer(sessionId, timer.telegramChatId);
    }
  }
}

/**
 * Clear inactivity timer
 */
export async function clearInactivityTimer(sessionId: string): Promise<void> {
  if (isRedisConnected()) {
    await cancelInactivityTimers(sessionId);
  } else {
    const timer = fallbackTimers.get(sessionId);
    if (timer) {
      if (timer.warningTimer) clearTimeout(timer.warningTimer);
      if (timer.closeTimer) clearTimeout(timer.closeTimer);
      fallbackTimers.delete(sessionId);
    }
    
    // Also clear queued timer
    const queuedTimer = fallbackQueuedTimers.get(sessionId);
    if (queuedTimer) {
      clearTimeout(queuedTimer.closeTimer);
      fallbackQueuedTimers.delete(sessionId);
    }
  }
  
  logger.debug('inactivity', { action: 'timer_cleared', sessionId });
}

/**
 * Get active timers count (for stats)
 */
export function getActiveTimersCount(): number {
  return fallbackTimers.size;
}

/**
 * Get queued timers count (for stats)
 */
export function getQueuedTimersCount(): number {
  return fallbackQueuedTimers.size;
}

/**
 * Get all active sessions with timers
 */
export function getActiveTimerSessions(): string[] {
  return Array.from(fallbackTimers.keys());
}

/**
 * Get all queued session IDs with timers
 */
export function getQueuedTimerSessions(): string[] {
  return Array.from(fallbackQueuedTimers.keys());
}

/**
 * Close chat by user request
 */
export async function closeByUserRequest(
  sessionId: string, 
  telegramChatId: number
): Promise<void> {
  await clearInactivityTimer(sessionId);
  
  const session = await getSessionById(sessionId);
  if (!session) {
    logger.warn('inactivity', { action: 'close_by_user_no_session', sessionId });
    return;
  }
  
  const agentId = session.assignedAgent 
    ? session.assignedAgent._id?.toString() || null
    : null;
  
  await closeSession(sessionId, agentId, 'Closed by user', 'user');
  
  const closeMessage = `✅ El chat ha sido cerrado. Gracias por contactar con Trelk Support.\n\n✅ Chat closed. Thank you for contacting Trelk Support.`;
  
  await sendTelegramMessage(telegramChatId, closeMessage, {
    replyMarkup: { remove_keyboard: true },
  });
  
  emitChatClosed(sessionId, 'Closed by user', 'user');
  
  logger.info('inactivity', { action: 'closed_by_user', sessionId });
}

/**
 * Close by agent (from dashboard) - clears timer
 */
export async function closeByAgent(sessionId: string): Promise<void> {
  await clearInactivityTimer(sessionId);
}

// ============= FALLBACK HANDLERS (when Redis not available) =============

async function sendWarningFallback(
  sessionId: string,
  telegramChatId: number,
  remainingMinutes: number
): Promise<void> {
  const session = await getSessionById(sessionId);
  if (!session || session.status === 'closed' || session.status !== 'human') {
    return;
  }

  const warningMessage = `⚠️ Este chat se cerrará automáticamente en ${remainingMinutes} minutos por inactividad.\n\n⚠️ This chat will close automatically in ${remainingMinutes} minutes due to inactivity.`;

  try {
    await sendTelegramMessage(telegramChatId, warningMessage);
    emitChatWarning(sessionId, remainingMinutes);
    logger.info('inactivity', { action: 'warning_sent', sessionId, remainingMinutes });
  } catch (error) {
    logger.error('inactivity', { action: 'warning_failed', sessionId, error });
  }
}

async function autoCloseSessionFallback(
  sessionId: string,
  telegramChatId: number
): Promise<void> {
  try {
    const session = await getSessionById(sessionId);
    
    if (!session || session.status === 'closed') {
      fallbackTimers.delete(sessionId);
      return;
    }
    
    if (session.status !== 'human') {
      fallbackTimers.delete(sessionId);
      return;
    }
    
    const agentId = session.assignedAgent 
      ? session.assignedAgent._id?.toString() || null
      : null;
    
    await closeSession(sessionId, agentId, 'Closed due to inactivity', 'system');
    
    const closeMessage = `✅ El chat ha sido cerrado por inactividad. Gracias por contactar con Trelk Support.\n\n✅ Chat closed due to inactivity. Thank you for contacting Trelk Support.`;
    
    await sendTelegramMessage(telegramChatId, closeMessage, {
      replyMarkup: { remove_keyboard: true },
    });
    
    emitChatClosed(sessionId, 'Closed due to inactivity', 'inactivity');
    fallbackTimers.delete(sessionId);
    
    logger.info('inactivity', { action: 'auto_closed', sessionId });
  } catch (error) {
    logger.error('inactivity', { action: 'auto_close_failed', sessionId, error });
  }
}

async function autoCloseQueuedSessionFallback(
  sessionId: string,
  telegramChatId: number
): Promise<void> {
  try {
    const session = await getSessionById(sessionId);
    
    if (!session) {
      fallbackQueuedTimers.delete(sessionId);
      return;
    }
    
    if (!['queued', 'waiting', 'bot'].includes(session.status)) {
      fallbackQueuedTimers.delete(sessionId);
      return;
    }
    
    await closeSession(sessionId, null, 'Closed due to inactivity in queue', 'system');
    
    const closeMessage = `✅ El chat ha sido cerrado automáticamente por inactividad.\n\n✅ Chat closed automatically due to inactivity.\n\nSi necesitas ayuda, inicia una nueva conversación.`;
    
    await sendTelegramMessage(telegramChatId, closeMessage, {
      replyMarkup: { remove_keyboard: true },
    });
    
    emitChatClosed(sessionId, 'Closed due to inactivity in queue', 'inactivity');
    fallbackQueuedTimers.delete(sessionId);
    
    logger.info('inactivity', { action: 'queued_auto_closed', sessionId });
  } catch (error) {
    logger.error('inactivity', { action: 'queued_auto_close_failed', sessionId, error });
  }
}

// ============= CLEANUP =============

// Graceful shutdown for fallback timers
process.on('SIGINT', () => {
  for (const [, timer] of fallbackTimers) {
    if (timer.warningTimer) clearTimeout(timer.warningTimer);
    if (timer.closeTimer) clearTimeout(timer.closeTimer);
  }
  fallbackTimers.clear();
  
  for (const [, timer] of fallbackQueuedTimers) {
    clearTimeout(timer.closeTimer);
  }
  fallbackQueuedTimers.clear();
});

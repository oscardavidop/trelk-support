/**
 * Inactivity Service
 * Handles automatic chat closure due to user inactivity
 */

import { getSettings } from './settings.service.js';
import { closeSession, getSessionById } from './chat.service.js';
import { sendMessage as sendTelegramMessage } from './telegram.js';
import { emitChatWarning, emitChatClosed } from './socket.js';
import { logger } from './logger.js';

// Survey inline keyboard
const getSurveyKeyboard = () => ({
  inline_keyboard: [
    [
      { text: '⭐', callback_data: 'survey:1' },
      { text: '⭐⭐', callback_data: 'survey:2' },
      { text: '⭐⭐⭐', callback_data: 'survey:3' },
      { text: '⭐⭐⭐⭐', callback_data: 'survey:4' },
      { text: '⭐⭐⭐⭐⭐', callback_data: 'survey:5' },
    ],
  ],
});

// Timer storage: sessionId -> { warningTimer, closeTimer, sessionId }
interface InactivityTimer {
  warningTimer: NodeJS.Timeout | null;
  closeTimer: NodeJS.Timeout | null;
  sessionId: string;
  telegramChatId: number;
  warningMessageId?: number;
}

// Separate storage for queued session timers
interface QueuedSessionTimer {
  closeTimer: NodeJS.Timeout;
  sessionId: string;
  telegramChatId: number;
  createdAt: Date;
}

const inactivityTimers = new Map<string, InactivityTimer>();
const queuedTimers = new Map<string, QueuedSessionTimer>();

/**
 * Start inactivity timer for a session
 * Called when agent sends a message
 */
export async function startInactivityTimer(
  sessionId: string, 
  telegramChatId: number
): Promise<void> {
  // Clear any existing timer for this session
  clearInactivityTimer(sessionId);
  
  const settings = await getSettings();
  const autoCloseMinutes = settings.chat.autoCloseInactiveMinutes || 10;
  const warningMinutes = Math.max(1, autoCloseMinutes - 5); // Warn 5 mins before closing
  
  const warningMs = warningMinutes * 60 * 1000;
  const closeMs = autoCloseMinutes * 60 * 1000;
  
  logger.debug('inactivity', {
    action: 'timer_started',
    sessionId,
    warningMinutes,
    autoCloseMinutes,
  });
  
  // Set warning timer
  const warningTimer = setTimeout(async () => {
    await sendWarning(sessionId, telegramChatId, 5);
  }, warningMs);
  
  // Set close timer
  const closeTimer = setTimeout(async () => {
    await autoCloseSession(sessionId, telegramChatId);
  }, closeMs);
  
  inactivityTimers.set(sessionId, {
    warningTimer,
    closeTimer,
    sessionId,
    telegramChatId,
  });
}

/**
 * Reset inactivity timer (user responded)
 */
export async function resetInactivityTimer(sessionId: string): Promise<void> {
  const timer = inactivityTimers.get(sessionId);
  
  if (timer) {
    logger.debug('inactivity', { action: 'timer_reset', sessionId });
    // User responded - restart the timer
    await startInactivityTimer(sessionId, timer.telegramChatId);
  }
}

/**
 * Start timer for queued/waiting sessions
 * These are sessions waiting for an agent or user action
 */
export async function startQueuedTimer(
  sessionId: string,
  telegramChatId: number
): Promise<void> {
  // Clear any existing queued timer
  clearQueuedTimer(sessionId);
  
  const settings = await getSettings();
  const queuedTimeoutMinutes = settings.chat.queuedTimeoutMinutes || 10;
  const timeoutMs = queuedTimeoutMinutes * 60 * 1000;
  
  logger.debug('inactivity', {
    action: 'queued_timer_started',
    sessionId,
    timeoutMinutes: queuedTimeoutMinutes,
  });
  
  const closeTimer = setTimeout(async () => {
    await autoCloseQueuedSession(sessionId, telegramChatId);
  }, timeoutMs);
  
  queuedTimers.set(sessionId, {
    closeTimer,
    sessionId,
    telegramChatId,
    createdAt: new Date(),
  });
}

/**
 * Clear queued session timer
 */
export function clearQueuedTimer(sessionId: string): void {
  const timer = queuedTimers.get(sessionId);
  
  if (timer) {
    clearTimeout(timer.closeTimer);
    queuedTimers.delete(sessionId);
    logger.debug('inactivity', { action: 'queued_timer_cleared', sessionId });
  }
}

/**
 * Reset queued timer when user sends a message
 */
export async function resetQueuedTimer(sessionId: string): Promise<void> {
  const timer = queuedTimers.get(sessionId);
  
  if (timer) {
    logger.debug('inactivity', { action: 'queued_timer_reset', sessionId });
    await startQueuedTimer(sessionId, timer.telegramChatId);
  }
}

/**
 * Auto-close queued session due to inactivity
 */
async function autoCloseQueuedSession(sessionId: string, telegramChatId: number): Promise<void> {
  try {
    const session = await getSessionById(sessionId);
    
    if (!session) {
      clearQueuedTimer(sessionId);
      return;
    }
    
    // Only close if still in queued/waiting/bot status
    if (!['queued', 'waiting', 'bot'].includes(session.status)) {
      clearQueuedTimer(sessionId);
      return;
    }
    
    // Close the session
    await closeSession(sessionId, null, 'Closed due to inactivity in queue', 'system');
    
    // Send message to user
    const closeMessage = `✅ El chat ha sido cerrado automáticamente por inactividad.\n\n✅ Chat closed automatically due to inactivity.\n\nSi necesitas ayuda, inicia una nueva conversación.`;
    
    await sendTelegramMessage(telegramChatId, closeMessage, {
      replyMarkup: { remove_keyboard: true },
    });
    
    // Emit Socket.IO event
    emitChatClosed(sessionId, 'Closed due to inactivity in queue', 'inactivity');
    
    // Clear timer
    clearQueuedTimer(sessionId);
    
    logger.info('inactivity', { action: 'queued_auto_closed', sessionId });
    
  } catch (error) {
    logger.error('inactivity', { action: 'queued_auto_close_failed', sessionId, error });
  }
}

/**
 * Clear inactivity timer
 */
export function clearInactivityTimer(sessionId: string): void {
  const timer = inactivityTimers.get(sessionId);
  
  if (timer) {
    if (timer.warningTimer) clearTimeout(timer.warningTimer);
    if (timer.closeTimer) clearTimeout(timer.closeTimer);
    inactivityTimers.delete(sessionId);
    
    logger.debug('inactivity', { action: 'timer_cleared', sessionId });
  }
  
  // Also clear queued timer if exists
  clearQueuedTimer(sessionId);
}

/**
 * Send warning message to user
 */
async function sendWarning(
  sessionId: string, 
  telegramChatId: number, 
  remainingMinutes: number
): Promise<void> {
  const warningMessage = `⚠️ Este chat se cerrará automáticamente en ${remainingMinutes} minutos por inactividad.\n\n⚠️ This chat will close automatically in ${remainingMinutes} minutes due to inactivity.`;
  
  try {
    await sendTelegramMessage(telegramChatId, warningMessage);
    
    // Emit Socket.IO event to dashboard
    emitChatWarning(sessionId, remainingMinutes);
    
    logger.info('inactivity', { action: 'warning_sent', sessionId, remainingMinutes });
  } catch (error) {
    logger.error('inactivity', { action: 'warning_failed', sessionId, error });
  }
}

/**
 * Auto-close session due to inactivity
 */
async function autoCloseSession(sessionId: string, telegramChatId: number): Promise<void> {
  try {
    // Get session to find assigned agent
    const session = await getSessionById(sessionId);
    
    if (!session || session.status === 'closed') {
      clearInactivityTimer(sessionId);
      return;
    }
    
    // Close the session (using a system agent ID or the assigned agent)
    const agentId = session.assignedAgent 
      ? session.assignedAgent._id?.toString() || null
      : null;
    
    // Close with 'system' type - survey will be sent automatically
    await closeSession(sessionId, agentId, 'Closed due to inactivity', 'system');
    
    // Send message to user - Hide keyboard
    const closeMessage = `✅ El chat ha sido cerrado por inactividad. Gracias por contactar con Trelk Support.\n\n✅ Chat closed due to inactivity. Thank you for contacting Trelk Support.`;
    
    await sendTelegramMessage(telegramChatId, closeMessage, {
      replyMarkup: { remove_keyboard: true },
    });
    
    // Note: Survey poll is now sent automatically by closeSession via survey.service
    
    // Emit Socket.IO event to dashboard
    emitChatClosed(sessionId, 'Closed due to inactivity', 'inactivity');
    
    // Clear timer
    clearInactivityTimer(sessionId);
    
    logger.info('inactivity', { action: 'auto_closed', sessionId });
    
  } catch (error) {
    logger.error('inactivity', { action: 'auto_close_failed', sessionId, error });
  }
}

/**
 * Get active timers count (for stats)
 */
export function getActiveTimersCount(): number {
  return inactivityTimers.size;
}

/**
 * Get queued timers count (for stats)
 */
export function getQueuedTimersCount(): number {
  return queuedTimers.size;
}

/**
 * Get all active sessions with timers
 */
export function getActiveTimerSessions(): string[] {
  return Array.from(inactivityTimers.keys());
}

/**
 * Restore queued timers on server restart
 * Call this after database connection is established
 */
export async function restoreQueuedTimers(): Promise<void> {
  try {
    const settings = await getSettings();
    const queuedTimeoutMinutes = settings.chat.queuedTimeoutMinutes || 10;
    
    // Import ChatSession here to avoid circular dependency
    const { ChatSession } = await import('../database/index.js');
    
    // Find all queued/waiting/bot sessions
    const queuedSessions = await ChatSession.find({
      status: { $in: ['queued', 'waiting', 'bot'] },
    }).select('sessionId telegramChatId createdAt updatedAt');
    
    const now = Date.now();
    let restored = 0;
    let closed = 0;
    
    for (const session of queuedSessions) {
      const lastActivity = session.updatedAt || session.createdAt;
      const elapsedMs = now - lastActivity.getTime();
      const timeoutMs = queuedTimeoutMinutes * 60 * 1000;
      
      if (elapsedMs >= timeoutMs) {
        // Already expired, close it now
        await autoCloseQueuedSession(session.sessionId, session.telegramChatId);
        closed++;
      } else {
        // Still has time, set timer for remaining time
        const remainingMs = timeoutMs - elapsedMs;
        
        const closeTimer = setTimeout(async () => {
          await autoCloseQueuedSession(session.sessionId, session.telegramChatId);
        }, remainingMs);
        
        queuedTimers.set(session.sessionId, {
          closeTimer,
          sessionId: session.sessionId,
          telegramChatId: session.telegramChatId,
          createdAt: lastActivity,
        });
        restored++;
      }
    }
    
    logger.info('inactivity', { 
      action: 'queued_timers_restored', 
      restored, 
      closed,
      total: queuedSessions.length,
    });
    
    console.log(`[Inactivity] Restored ${restored} queued timers, closed ${closed} expired sessions`);
    
  } catch (error) {
    logger.error('inactivity', { action: 'restore_queued_timers_failed', error });
    console.error('[Inactivity] Failed to restore queued timers:', error);
  }
}

/**
 * Manual close by user (from Telegram keyboard)
 */
export async function closeByUser(sessionId: string, telegramChatId: number): Promise<void> {
  clearInactivityTimer(sessionId);
  
  const session = await getSessionById(sessionId);
  
  if (!session || session.status === 'closed') {
    return;
  }
  
  // Close the session - survey will be sent automatically by closeSession
  const agentId = session.assignedAgent 
    ? session.assignedAgent._id?.toString() || null
    : null;
  
  await closeSession(sessionId, agentId, 'Closed by user', 'user');
  
  // Send close confirmation - Hide keyboard
  const closeMessage = `✅ El chat ha sido cerrado. Gracias por contactar con Trelk Support.\n\n✅ Chat closed. Thank you for contacting Trelk Support.`;
  
  await sendTelegramMessage(telegramChatId, closeMessage, {
    replyMarkup: { remove_keyboard: true },
  });
  
  // Note: Survey is now sent automatically by closeSession via survey.service
  // No need to send inline keyboard survey here
  
  // Emit Socket.IO event
  emitChatClosed(sessionId, 'Closed by user', 'user');
  
  logger.info('inactivity', { action: 'closed_by_user', sessionId });
}

/**
 * Close by agent (from dashboard) - clears timer
 */
export function closeByAgent(sessionId: string): void {
  clearInactivityTimer(sessionId);
}

// ============= CLEANUP =============

// Graceful shutdown
process.on('SIGINT', () => {
  for (const [, timer] of inactivityTimers) {
    if (timer.warningTimer) clearTimeout(timer.warningTimer);
    if (timer.closeTimer) clearTimeout(timer.closeTimer);
  }
  inactivityTimers.clear();
  
  for (const [, timer] of queuedTimers) {
    clearTimeout(timer.closeTimer);
  }
  queuedTimers.clear();
});

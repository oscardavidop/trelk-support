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

const inactivityTimers = new Map<string, InactivityTimer>();

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
      ? session.assignedAgent._id?.toString() || 'system'
      : 'system';
    
    await closeSession(sessionId, agentId, 'Closed due to inactivity');
    
    // Send message to user - Hide keyboard
    const closeMessage = `✅ El chat ha sido cerrado por inactividad. Gracias por contactar con Trelk Support.\n\n✅ Chat closed due to inactivity. Thank you for contacting Trelk Support.`;
    
    await sendTelegramMessage(telegramChatId, closeMessage, {
      replyMarkup: { remove_keyboard: true },
    });
    
    // Send survey request
    const surveyMessage = `📊 ¿Cómo calificarías tu experiencia?\n📊 How would you rate your experience?`;
    await sendTelegramMessage(telegramChatId, surveyMessage, {
      replyMarkup: getSurveyKeyboard(),
    });
    
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
 * Get all active sessions with timers
 */
export function getActiveTimerSessions(): string[] {
  return Array.from(inactivityTimers.keys());
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
  
  // Close the session
  const agentId = session.assignedAgent 
    ? session.assignedAgent._id?.toString() || 'system'
    : 'system';
  
  await closeSession(sessionId, agentId, 'Closed by user');
  
  // Send close confirmation - Hide keyboard
  const closeMessage = `✅ El chat ha sido cerrado. Gracias por contactar con Trelk Support.\n\n✅ Chat closed. Thank you for contacting Trelk Support.`;
  
  await sendTelegramMessage(telegramChatId, closeMessage, {
    replyMarkup: { remove_keyboard: true },
  });
  
  // Send survey request
  const surveyMessage = `📊 ¿Cómo calificarías tu experiencia?\n📊 How would you rate your experience?`;
  await sendTelegramMessage(telegramChatId, surveyMessage, {
    replyMarkup: getSurveyKeyboard(),
  });
  
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
});

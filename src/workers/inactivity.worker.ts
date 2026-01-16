/**
 * Inactivity Worker
 * Handles inactivity warnings and auto-close using BullMQ
 * 
 * Persists timers in Redis - survives server restarts
 */

import { Job, Worker } from 'bullmq';
import {
  registerWorker,
  QUEUE_NAMES,
  type InactivityJob,
} from '../services/queue.js';
import { logger } from '../services/logger.js';
import { sendMessage as sendTelegramMessage } from '../services/telegram.js';
import { emitChatWarning, emitChatClosed, getIO } from '../services/socket.js';
import { closeSession, getSessionById, addMessage } from '../services/chat.service.js';

// ============= WORKER PROCESSOR =============

async function processInactivityJob(job: Job<InactivityJob>): Promise<any> {
  const { type, sessionId, chatId, remainingMinutes } = job.data;

  logger.info('worker:inactivity', {
    action: 'processing',
    jobId: job.id,
    type,
    sessionId,
  });

  try {
    switch (type) {
      case 'warning':
        return await handleWarning(sessionId, chatId, remainingMinutes || 5);
      
      case 'close':
        return await handleClose(sessionId, chatId);
      
      case 'queued_close':
        return await handleQueuedClose(sessionId, chatId);
      
      default:
        logger.warn('worker:inactivity', {
          action: 'unknown_type',
          type,
          sessionId,
        });
        return { skipped: true, reason: 'unknown_type' };
    }
  } catch (error) {
    logger.error('worker:inactivity', {
      action: 'processing_error',
      type,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============= HANDLERS =============

async function handleWarning(
  sessionId: string,
  chatId: number,
  remainingMinutes: number
): Promise<any> {
  // Verify session is still active
  const session = await getSessionById(sessionId);
  if (!session || session.status === 'closed') {
    logger.info('worker:inactivity', {
      action: 'warning_skipped_session_closed',
      sessionId,
    });
    return { skipped: true, reason: 'session_closed' };
  }

  // Only warn if session is still with agent (human status)
  if (session.status !== 'human') {
    logger.info('worker:inactivity', {
      action: 'warning_skipped_not_human',
      sessionId,
      status: session.status,
    });
    return { skipped: true, reason: 'not_with_agent' };
  }

  const warningMessage = `⚠️ Este chat se cerrará automáticamente en ${remainingMinutes} minutos por inactividad.\n\n⚠️ This chat will close automatically in ${remainingMinutes} minutes due to inactivity.`;

  try {
    // Send to Telegram
    await sendTelegramMessage(chatId, warningMessage);
    
    // Save message in database
    const savedMessage = await addMessage(sessionId, 'bot', warningMessage, {
      messageType: 'system',
    });
    
    // Emit message:new event so it shows in real-time in the dashboard
    const io = getIO();
    if (io) {
      const messageData = {
        _id: savedMessage._id.toString(),
        session: sessionId,
        sender: 'bot',
        content: warningMessage,
        messageType: 'system' as const,
        createdAt: savedMessage.createdAt,
      };
      io.to(`session:${sessionId}`).emit('message:new', messageData);
    }
    
    // Emit warning event for UI notification
    emitChatWarning(sessionId, remainingMinutes);

    logger.info('worker:inactivity', {
      action: 'warning_sent',
      sessionId,
      remainingMinutes,
    });

    return { success: true, type: 'warning' };
  } catch (error) {
    logger.error('worker:inactivity', {
      action: 'warning_failed',
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function handleClose(sessionId: string, chatId: number): Promise<any> {
  const session = await getSessionById(sessionId);
  
  if (!session || session.status === 'closed') {
    logger.info('worker:inactivity', {
      action: 'close_skipped_already_closed',
      sessionId,
    });
    return { skipped: true, reason: 'already_closed' };
  }

  // Only close if still with agent
  if (session.status !== 'human') {
    logger.info('worker:inactivity', {
      action: 'close_skipped_not_human',
      sessionId,
      status: session.status,
    });
    return { skipped: true, reason: 'not_with_agent' };
  }

  try {
    const closeMessage = `✅ El chat ha sido cerrado por inactividad. Gracias por contactar con Trelk Support.\n\n✅ Chat closed due to inactivity. Thank you for contacting Trelk Support.`;

    // Save message in database BEFORE closing the session
    const savedMessage = await addMessage(sessionId, 'bot', closeMessage, {
      messageType: 'system',
    });
    
    // Emit message:new event so it shows in real-time in the dashboard
    const io = getIO();
    if (io) {
      const messageData = {
        _id: savedMessage._id.toString(),
        session: sessionId,
        sender: 'bot',
        content: closeMessage,
        messageType: 'system' as const,
        createdAt: savedMessage.createdAt,
      };
      io.to(`session:${sessionId}`).emit('message:new', messageData);
    }
    
    const agentId = session.assignedAgent?._id?.toString() || null;
    await closeSession(sessionId, agentId, 'Closed due to inactivity', 'system');

    await sendTelegramMessage(chatId, closeMessage, {
      replyMarkup: { remove_keyboard: true },
    });

    emitChatClosed(sessionId, 'Closed due to inactivity', 'inactivity');

    logger.info('worker:inactivity', {
      action: 'auto_closed',
      sessionId,
    });

    return { success: true, type: 'close' };
  } catch (error) {
    logger.error('worker:inactivity', {
      action: 'close_failed',
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function handleQueuedClose(sessionId: string, chatId: number): Promise<any> {
  const session = await getSessionById(sessionId);
  
  if (!session) {
    logger.info('worker:inactivity', {
      action: 'queued_close_skipped_no_session',
      sessionId,
    });
    return { skipped: true, reason: 'no_session' };
  }

  // Only close if still in queued/waiting/bot status
  if (!['queued', 'waiting', 'bot'].includes(session.status)) {
    logger.info('worker:inactivity', {
      action: 'queued_close_skipped_status_changed',
      sessionId,
      status: session.status,
    });
    return { skipped: true, reason: 'status_changed' };
  }

  try {
    const closeMessage = `✅ El chat ha sido cerrado automáticamente por inactividad.\n\n✅ Chat closed automatically due to inactivity.\n\nSi necesitas ayuda, inicia una nueva conversación.`;

    // Save message in database BEFORE closing the session
    const savedMessage = await addMessage(sessionId, 'bot', closeMessage, {
      messageType: 'system',
    });
    
    // Emit message:new event so it shows in real-time in the dashboard
    const io = getIO();
    if (io) {
      const messageData = {
        _id: savedMessage._id.toString(),
        session: sessionId,
        sender: 'bot',
        content: closeMessage,
        messageType: 'system' as const,
        createdAt: savedMessage.createdAt,
      };
      // For queued sessions, emit to all (they're visible to all agents)
      io.emit('message:new', messageData);
    }
    
    await closeSession(sessionId, null, 'Closed due to inactivity in queue', 'system');

    await sendTelegramMessage(chatId, closeMessage, {
      replyMarkup: { remove_keyboard: true },
    });

    emitChatClosed(sessionId, 'Closed due to inactivity in queue', 'inactivity');

    logger.info('worker:inactivity', {
      action: 'queued_auto_closed',
      sessionId,
    });

    return { success: true, type: 'queued_close' };
  } catch (error) {
    logger.error('worker:inactivity', {
      action: 'queued_close_failed',
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============= INITIALIZATION =============

let workerInstance: Worker<InactivityJob> | null = null;

export function initializeInactivityWorker(): void {
  if (workerInstance) {
    logger.warn('worker:inactivity', { action: 'already_initialized' });
    return;
  }

  workerInstance = registerWorker<InactivityJob>(
    QUEUE_NAMES.INACTIVITY,
    processInactivityJob,
    { concurrency: 5 }
  );

  logger.info('worker:inactivity', { action: 'initialized' });
}

export function stopInactivityWorker(): void {
  if (workerInstance) {
    workerInstance.close();
    workerInstance = null;
    logger.info('worker:inactivity', { action: 'stopped' });
  }
}

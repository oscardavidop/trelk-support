/**
 * Scheduled Messages Worker
 * Processes scheduled messages using BullMQ
 * 
 * Replaces the cron-based worker with a reliable queue-based system
 */

import { Job } from 'bullmq';
import {
  registerWorker,
  QUEUE_NAMES,
  type ScheduledMessageJob,
} from '../services/queue.js';
import { logger } from '../services/logger.js';
import { acquireLock, releaseLock } from '../services/redis.js';
import { ScheduledMessage } from '../database/models/ScheduledMessage.js';
import { ChatSession } from '../database/models/ChatSession.js';
import { getIO } from '../services/socket.js';
import { addMessage } from '../services/chat.service.js';

// ============= WORKER PROCESSOR =============

/**
 * Process a scheduled message job
 */
async function processScheduledMessage(job: Job<ScheduledMessageJob>): Promise<any> {
  const { messageId, sessionId, chatId } = job.data;
  const lockKey = `scheduled:${messageId}`;

  logger.info('worker:scheduled', {
    action: 'processing',
    jobId: job.id,
    messageId,
    sessionId,
  });

  // Acquire distributed lock to prevent double processing
  const lockValue = await acquireLock(lockKey, 30); // 30 second lock
  if (!lockValue) {
    logger.warn('worker:scheduled', {
      action: 'lock_failed',
      messageId,
      reason: 'Already being processed by another worker',
    });
    return { skipped: true, reason: 'lock_failed' };
  }

  try {
    // Fetch the scheduled message
    const scheduledMsg = await ScheduledMessage.findById(messageId);
    if (!scheduledMsg) {
      logger.warn('worker:scheduled', {
        action: 'not_found',
        messageId,
      });
      return { skipped: true, reason: 'not_found' };
    }

    // Check if already sent
    if (scheduledMsg.status === 'sent' || scheduledMsg.status === 'cancelled') {
      logger.info('worker:scheduled', {
        action: 'already_processed',
        messageId,
        status: scheduledMsg.status,
      });
      return { skipped: true, reason: 'already_processed' };
    }

    // Fetch the session by sessionId field (not _id)
    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      // Mark as failed
      await ScheduledMessage.findByIdAndUpdate(messageId, {
        status: 'failed',
        error: 'Session not found',
        processedAt: new Date(),
      });
      logger.error('worker:scheduled', {
        action: 'session_not_found',
        messageId,
        sessionId,
      });
      return { success: false, reason: 'session_not_found' };
    }

    // Check if session is still active
    if (session.status === 'closed') {
      await ScheduledMessage.findByIdAndUpdate(messageId, {
        status: 'cancelled',
        error: 'Session closed',
        processedAt: new Date(),
      });
      logger.info('worker:scheduled', {
        action: 'session_closed',
        messageId,
        sessionId,
      });
      return { skipped: true, reason: 'session_closed' };
    }

    // Send the message via Telegram
    const result = await sendScheduledMessage(scheduledMsg, session, chatId);

    if (result.success) {
      // Mark as sent
      await ScheduledMessage.findByIdAndUpdate(messageId, {
        status: 'sent',
        telegramMessageId: result.messageId,
        processedAt: new Date(),
      });

      logger.info('worker:scheduled', {
        action: 'sent',
        messageId,
        telegramMessageId: result.messageId,
      });

      // emit message sent event (if needed)
      const savedMessage = await addMessage(sessionId, 'agent', 'Se envió una advertencia de inactividad.', {
        messageType: 'text',
      });

      // Emit message:new event so it shows in real-time in the dashboard
      const io = getIO();
      if (io) {
        const messageData = {
          _id: savedMessage._id.toString(),
          session: sessionId,
          sender: 'agent',
          content: scheduledMsg.message.text || '',
          messageType: 'text' as const,
          createdAt: savedMessage.createdAt,
        };
        io.to(`session:${sessionId}`).emit('message:new', messageData);
      }

      return { success: true, telegramMessageId: result.messageId };
    } else {
      // Mark as failed
      await ScheduledMessage.findByIdAndUpdate(messageId, {
        status: 'failed',
        error: result.error,
        processedAt: new Date(),
      });

      logger.error('worker:scheduled', {
        action: 'send_failed',
        messageId,
        error: result.error,
      });

      // Throw error to trigger retry
      throw new Error(result.error);
    }
  } finally {
    // Always release the lock
    await releaseLock(lockKey, lockValue);
  }
}

// ============= TELEGRAM INTEGRATION =============

interface SendResult {
  success: boolean;
  messageId?: number;
  error?: string;
}

/**
 * Send the scheduled message via Telegram
 */
async function sendScheduledMessage(
  scheduledMsg: any,
  _session: any,
  chatId: number
): Promise<SendResult> {
  try {
    // Import telegram functions directly
    const telegram = await import('../services/telegram.js');

    let messageId: number | null = null;

    // Get message content from the correct structure
    const text = scheduledMsg.message?.text;
    const media = scheduledMsg.message?.media;

    // Determine what type of message to send based on content
    if (media?.url) {
      // Has media - send based on media type
      switch (media.type) {
        case 'photo':
          const photoSent = await telegram.sendPhoto(
            chatId,
            media.url,
            text || ''
          );
          return { success: photoSent };

        case 'document':
          const docSent = await telegram.sendDocument(
            chatId,
            media.url,
            text || ''
          );
          return { success: docSent };

        case 'voice':
          const voiceSent = await telegram.sendVoice(
            chatId,
            media.url
          );
          return { success: voiceSent };

        case 'video':
          const videoSent = await telegram.sendVideo?.(
            chatId,
            media.url,
            text || ''
          );
          return { success: !!videoSent };

        default:
          // Unknown media type, try as document
          const defaultSent = await telegram.sendDocument(
            chatId,
            media.url,
            text || ''
          );
          return { success: defaultSent };
      }
    } else if (text) {
      // Text only message
      messageId = await telegram.sendMessageWithId(chatId, text, {
        parseMode: 'HTML',
      });

      if (messageId === null) {
        return { success: false, error: 'Failed to send text message' };
      }

      return {
        success: true,
        // data: {
        //   message: 
        // },
        messageId,
      };
    } else {
      // No content to send
      return { success: false, error: 'No message content' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for permanent errors that shouldn't be retried
    const permanentErrors = [
      'chat not found',
      'bot was blocked',
      'user is deactivated',
      'chat_write_forbidden',
    ];

    const isPermanentError = permanentErrors.some(e =>
      errorMessage.toLowerCase().includes(e)
    );

    if (isPermanentError) {
      // Don't retry permanent errors
      return { success: false, error: `Permanent error: ${errorMessage}` };
    }

    // Throw for retry
    throw new Error(errorMessage);
  }
}

// ============= WORKER REGISTRATION =============

let isWorkerRegistered = false;

/**
 * Start the scheduled messages worker
 */
export function startScheduledMessagesWorker(): void {
  if (isWorkerRegistered) {
    logger.warn('worker:scheduled', { action: 'already_registered' });
    return;
  }

  registerWorker<ScheduledMessageJob>(
    QUEUE_NAMES.SCHEDULED_MESSAGES,
    processScheduledMessage,
    { concurrency: 10 } // Process 10 messages in parallel
  );

  isWorkerRegistered = true;
  console.log('✅ [Worker] Scheduled messages worker started');
}

// ============= MIGRATION HELPER =============

/**
 * Migrate existing scheduled messages to BullMQ
 * Run this once to move pending messages from MongoDB to the queue
 */
export async function migrateExistingScheduledMessages(): Promise<{
  migrated: number;
  skipped: number;
  errors: number;
}> {
  const { scheduleMessage } = await import('../services/queue.js');

  const stats = { migrated: 0, skipped: 0, errors: 0 };

  try {
    // Find all pending scheduled messages with scheduledAt in the future
    const pendingMessages = await ScheduledMessage.find({
      status: 'pending',
      scheduledAt: { $gt: new Date() },
    });

    logger.info('worker:scheduled', {
      action: 'migration_started',
      count: pendingMessages.length,
    });

    for (const msg of pendingMessages) {
      try {
        if (!msg.sessionId || !msg.chatId || !msg.scheduledAt) {
          stats.skipped++;
          continue;
        }

        const jobId = await scheduleMessage(
          msg._id.toString(),
          msg.sessionId,
          msg.chatId,
          new Date(msg.scheduledAt)
        );

        if (jobId) {
          // Update the message with the job ID
          await ScheduledMessage.findByIdAndUpdate(msg._id, {
            bullmqJobId: jobId,
          });
          stats.migrated++;
        } else {
          stats.skipped++;
        }
      } catch (error) {
        stats.errors++;
        logger.error('worker:scheduled', {
          action: 'migration_error',
          messageId: msg._id,
          error: String(error),
        });
      }
    }

    logger.info('worker:scheduled', {
      action: 'migration_completed',
      ...stats,
    });

    return stats;
  } catch (error) {
    logger.error('worker:scheduled', {
      action: 'migration_failed',
      error: String(error),
    });
    throw error;
  }
}

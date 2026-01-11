/**
 * ScheduledMessage Service
 * Handles creation, execution, cancellation, and management of scheduled messages
 * 
 * Features:
 * - Exactly-once delivery with distributed locking
 * - Automatic cancellation on user response
 * - Placeholder resolution
 * - Full audit logging
 */

import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { 
  ScheduledMessage, 
  IScheduledMessage, 
  ScheduleType, 
  TriggerEvent, 
  ScheduledMessageStatus,
  MediaType 
} from '../database/models/ScheduledMessage.js';
import { ChatSession } from '../database/models/ChatSession.js';
import { Agent } from '../database/models/Agent.js';
import { SavedReply } from '../database/models/SavedReply.js';
import { ActivityLog } from '../database/models/ActivityLog.js';
import { Message } from '../database/models/Message.js';
import { logger } from './logger.js';
import { sendMessage, sendPhoto, sendDocument, sendAudio } from './telegram.js';
import { getIO } from './socket.js';

// Worker instance ID for distributed locking
const WORKER_ID = `worker-${process.pid}-${uuidv4().slice(0, 8)}`;
const LOCK_DURATION_MS = 30000; // 30 seconds

// ============= CREATION =============

interface CreateScheduledMessageInput {
  sessionId: string;
  chatId: number;
  createdBy: string | 'system';
  createdByName?: string;
  type: ScheduleType;
  scheduledAt?: Date;
  delayMinutes?: number;
  triggerEvent?: TriggerEvent;
  message: {
    text?: string;
    media?: {
      type: MediaType;
      fileId?: string;
      url?: string;
      caption?: string;
    };
    savedReplyId?: string;
  };
  expiresAt?: Date;
  relatedRuleId?: string;
}

/**
 * Create a new scheduled message
 */
export async function createScheduledMessage(
  input: CreateScheduledMessageInput
): Promise<IScheduledMessage> {
  // Validate session exists and is active
  const session = await ChatSession.findOne({ sessionId: input.sessionId });
  if (!session) {
    throw new Error('Session not found');
  }
  if (['closed', 'expired'].includes(session.status)) {
    throw new Error('Cannot schedule message for closed session');
  }

  // Resolve saved reply if provided
  let messageText = input.message.text;
  let placeholders: Record<string, string> = {};
  
  if (input.message.savedReplyId) {
    const savedReply = await SavedReply.findById(input.message.savedReplyId);
    if (savedReply) {
      messageText = savedReply.content;
      // Pre-resolve placeholders
      placeholders = await resolvePlaceholders(input.sessionId, input.createdBy);
      messageText = applyPlaceholders(messageText, placeholders);
    }
  } else if (messageText) {
    // Resolve placeholders in custom text
    placeholders = await resolvePlaceholders(input.sessionId, input.createdBy);
    messageText = applyPlaceholders(messageText, placeholders);
  }

  // Calculate inactivity start time if needed
  let inactivityStartedAt: Date | undefined;
  if (input.type === 'after_inactivity') {
    // Get the last user message time
    const lastUserMessage = await Message.findOne({
      session: session._id,
      sender: 'user',
    }).sort({ createdAt: -1 });
    
    inactivityStartedAt = lastUserMessage?.createdAt || new Date();
  }

  // Create the scheduled message
  const scheduled = await ScheduledMessage.create({
    sessionId: input.sessionId,
    chatId: input.chatId,
    createdBy: input.createdBy === 'system' ? 'system' : new Types.ObjectId(input.createdBy),
    createdByName: input.createdByName,
    type: input.type,
    scheduledAt: input.scheduledAt,
    delayMinutes: input.delayMinutes,
    inactivityStartedAt,
    triggerEvent: input.triggerEvent,
    message: {
      text: messageText,
      media: input.message.media,
      savedReplyId: input.message.savedReplyId 
        ? new Types.ObjectId(input.message.savedReplyId) 
        : undefined,
      placeholders,
    },
    expiresAt: input.expiresAt,
    relatedRuleId: input.relatedRuleId 
      ? new Types.ObjectId(input.relatedRuleId) 
      : undefined,
  });

  // Log activity
  await logActivity(input.sessionId, 'scheduled_message_created', {
    scheduledMessageId: scheduled._id.toString(),
    type: input.type,
    createdBy: input.createdBy,
  });

  // Emit socket event
  emitScheduledMessageEvent('scheduled_message_created', scheduled);

  logger.info('api', {
    action: 'scheduled_message_created',
    sessionId: input.sessionId,
    scheduledMessageId: scheduled._id.toString(),
    type: input.type,
  });

  return scheduled;
}

// ============= CANCELLATION =============

/**
 * Cancel a scheduled message manually
 */
export async function cancelScheduledMessage(
  messageId: string,
  cancelledBy: string,
  reason?: string
): Promise<IScheduledMessage | null> {
  const message = await ScheduledMessage.findOneAndUpdate(
    {
      _id: new Types.ObjectId(messageId),
      status: { $in: ['pending', 'processing'] },
    },
    {
      status: 'cancelled',
      cancelledBy: new Types.ObjectId(cancelledBy),
      cancelledAt: new Date(),
      cancelReason: reason || 'Cancelled by agent',
    },
    { new: true }
  );

  if (message) {
    await logActivity(message.sessionId, 'scheduled_message_cancelled', {
      scheduledMessageId: messageId,
      cancelledBy,
      reason,
    });

    emitScheduledMessageEvent('scheduled_message_cancelled', message);

    logger.info('api', {
      action: 'scheduled_message_cancelled',
      scheduledMessageId: messageId,
      cancelledBy,
    });
  }

  return message;
}

/**
 * Auto-cancel all pending messages for a session
 * Called when session is closed or user responds
 */
export async function autoCancelSessionMessages(
  sessionId: string,
  reason: string
): Promise<number> {
  const result = await ScheduledMessage.updateMany(
    {
      sessionId,
      status: 'pending',
    },
    {
      status: 'cancelled',
      cancelledAt: new Date(),
      autoCancelledReason: reason,
    }
  );

  if (result.modifiedCount > 0) {
    logger.info('api', {
      action: 'scheduled_messages_auto_cancelled',
      sessionId,
      count: result.modifiedCount,
      reason,
    });

    // Emit event for each cancelled message
    const cancelled = await ScheduledMessage.find({
      sessionId,
      autoCancelledReason: reason,
    });
    for (const msg of cancelled) {
      emitScheduledMessageEvent('scheduled_message_cancelled', msg);
    }
  }

  return result.modifiedCount;
}

/**
 * Cancel inactivity-based messages when user responds
 */
export async function cancelInactivityMessagesOnUserResponse(
  sessionId: string
): Promise<number> {
  return autoCancelSessionMessages(sessionId, 'User responded');
}

// ============= EXECUTION =============

/**
 * Process and send pending scheduled messages
 * Called by cron job every 30 seconds
 */
export async function processScheduledMessages(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  expired: number;
}> {
  const now = new Date();
  const stats = { processed: 0, sent: 0, failed: 0, expired: 0 };

  // 1. Expire old messages
  const expired = await ScheduledMessage.updateMany(
    {
      status: 'pending',
      expiresAt: { $lt: now },
    },
    {
      status: 'expired',
    }
  );
  stats.expired = expired.modifiedCount;

  // 2. Release stale locks (processing too long)
  await ScheduledMessage.updateMany(
    {
      status: 'processing',
      'processingLock.expiresAt': { $lt: now },
    },
    {
      status: 'pending',
      $unset: { processingLock: 1 },
      $inc: { attempts: 1 },
    }
  );

  // 3. Find messages ready to send
  const pendingFixedTime = await ScheduledMessage.find({
    status: 'pending',
    type: 'fixed_time',
    scheduledAt: { $lte: now },
  }).limit(50);

  const pendingInactivity = await findReadyInactivityMessages(now, 50);

  const allPending = [...pendingFixedTime, ...pendingInactivity];

  // 4. Process each message
  for (const message of allPending) {
    stats.processed++;
    
    // Try to acquire lock
    const locked = await acquireLock(message._id);
    if (!locked) continue; // Another worker got it

    try {
      // Validate session is still active
      const session = await ChatSession.findOne({ sessionId: message.sessionId });
      if (!session || ['closed', 'expired'].includes(session.status)) {
        await releaseLock(message._id, 'cancelled', 'Session closed');
        continue;
      }

      // Check if user responded (for inactivity messages)
      if (message.type === 'after_inactivity') {
        const userResponded = await checkUserResponded(
          session._id,
          message.inactivityStartedAt!
        );
        if (userResponded) {
          await releaseLock(message._id, 'cancelled', 'User responded');
          continue;
        }
      }

      // Send the message
      const result = await sendScheduledMessage(message);
      
      if (result.success) {
        await ScheduledMessage.updateOne(
          { _id: message._id },
          {
            status: 'sent',
            sentAt: now,
            telegramMessageId: result.telegramMessageId,
            $unset: { processingLock: 1 },
          }
        );
        stats.sent++;

        // Log and emit
        await logActivity(message.sessionId, 'scheduled_message_sent', {
          scheduledMessageId: message._id.toString(),
          telegramMessageId: result.telegramMessageId,
        });

        const updated = await ScheduledMessage.findById(message._id);
        if (updated) {
          emitScheduledMessageEvent('scheduled_message_sent', updated);
        }
      } else {
        // Handle failure
        const newAttempts = message.attempts + 1;
        const isFinal = newAttempts >= message.maxAttempts;

        await ScheduledMessage.updateOne(
          { _id: message._id },
          {
            status: isFinal ? 'failed' : 'pending',
            error: result.error,
            attempts: newAttempts,
            lastAttemptAt: now,
            $unset: { processingLock: 1 },
          }
        );

        if (isFinal) {
          stats.failed++;
          await logActivity(message.sessionId, 'scheduled_message_failed', {
            scheduledMessageId: message._id.toString(),
            error: result.error,
            attempts: newAttempts,
          });
        }
      }
    } catch (error) {
      // Unexpected error - release lock and retry later
      await releaseLock(message._id, 'pending', String(error));
      stats.failed++;
    }
  }

  if (stats.processed > 0) {
    logger.info('api', {
      action: 'scheduled_messages_processed',
      ...stats,
    });
  }

  return stats;
}

/**
 * Trigger event-based messages
 */
export async function triggerEventMessages(
  event: TriggerEvent,
  sessionId?: string,
  metadata?: Record<string, unknown>
): Promise<number> {
  const query: Record<string, unknown> = {
    status: 'pending',
    type: 'on_event',
    triggerEvent: event,
  };
  
  if (sessionId) {
    query.sessionId = sessionId;
  }

  const messages = await ScheduledMessage.find(query);
  let triggered = 0;

  for (const message of messages) {
    // Validate session
    const session = await ChatSession.findOne({ sessionId: message.sessionId });
    if (!session || ['closed', 'expired'].includes(session.status)) {
      await ScheduledMessage.updateOne(
        { _id: message._id },
        {
          status: 'cancelled',
          autoCancelledReason: 'Session closed',
        }
      );
      continue;
    }

    // Send immediately
    const locked = await acquireLock(message._id);
    if (!locked) continue;

    const result = await sendScheduledMessage(message);
    
    if (result.success) {
      await ScheduledMessage.updateOne(
        { _id: message._id },
        {
          status: 'sent',
          sentAt: new Date(),
          telegramMessageId: result.telegramMessageId,
          triggerMetadata: metadata,
          $unset: { processingLock: 1 },
        }
      );
      triggered++;

      const updated = await ScheduledMessage.findById(message._id);
      if (updated) {
        emitScheduledMessageEvent('scheduled_message_sent', updated);
      }
    } else {
      await releaseLock(message._id, 'failed', result.error);
    }
  }

  if (triggered > 0) {
    logger.info('api', {
      action: 'event_messages_triggered',
      event,
      count: triggered,
    });
  }

  return triggered;
}

// ============= QUERIES =============

/**
 * Get scheduled messages for a session
 */
export async function getSessionScheduledMessages(
  sessionId: string,
  status?: ScheduledMessageStatus[]
): Promise<IScheduledMessage[]> {
  const query: Record<string, unknown> = { sessionId };
  
  if (status && status.length > 0) {
    query.status = { $in: status };
  }

  return ScheduledMessage.find(query)
    .sort({ createdAt: -1 })
    .populate('createdBy', 'name email')
    .populate('cancelledBy', 'name email');
}

/**
 * Get all pending messages (for admin view)
 */
export async function getAllPendingMessages(
  limit: number = 100
): Promise<IScheduledMessage[]> {
  return ScheduledMessage.find({ status: 'pending' })
    .sort({ scheduledAt: 1, createdAt: 1 })
    .limit(limit)
    .populate('createdBy', 'name email');
}

/**
 * Get scheduled message stats
 */
export async function getScheduledMessageStats(): Promise<{
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
}> {
  const stats = await ScheduledMessage.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
    cancelled: 0,
  };

  for (const stat of stats) {
    if (stat._id in result) {
      result[stat._id as keyof typeof result] = stat.count;
    }
  }

  return result;
}

// ============= HELPERS =============

async function findReadyInactivityMessages(now: Date, limit: number): Promise<IScheduledMessage[]> {
  // Find messages where: now >= inactivityStartedAt + delayMinutes
  return ScheduledMessage.aggregate([
    {
      $match: {
        status: 'pending',
        type: 'after_inactivity',
        inactivityStartedAt: { $exists: true },
        delayMinutes: { $exists: true },
      },
    },
    {
      $addFields: {
        triggerTime: {
          $add: [
            '$inactivityStartedAt',
            { $multiply: ['$delayMinutes', 60000] },
          ],
        },
      },
    },
    {
      $match: {
        triggerTime: { $lte: now },
      },
    },
    {
      $limit: limit,
    },
  ]);
}

async function checkUserResponded(
  sessionObjectId: Types.ObjectId,
  since: Date
): Promise<boolean> {
  const userMessage = await Message.findOne({
    session: sessionObjectId,
    sender: 'user',
    createdAt: { $gt: since },
  });
  return !!userMessage;
}

async function acquireLock(messageId: Types.ObjectId): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_DURATION_MS);

  const result = await ScheduledMessage.updateOne(
    {
      _id: messageId,
      status: 'pending',
      $or: [
        { processingLock: { $exists: false } },
        { 'processingLock.expiresAt': { $lt: now } },
      ],
    },
    {
      status: 'processing',
      processingLock: {
        lockedAt: now,
        lockId: WORKER_ID,
        expiresAt,
      },
    }
  );

  return result.modifiedCount > 0;
}

async function releaseLock(
  messageId: Types.ObjectId,
  newStatus: ScheduledMessageStatus,
  error?: string
): Promise<void> {
  const update: Record<string, unknown> = {
    status: newStatus,
    $unset: { processingLock: 1 },
  };

  if (newStatus === 'cancelled') {
    update.cancelledAt = new Date();
    update.autoCancelledReason = error;
  } else if (error) {
    update.error = error;
    update.$inc = { attempts: 1 };
    update.lastAttemptAt = new Date();
  }

  await ScheduledMessage.updateOne(
    { _id: messageId, 'processingLock.lockId': WORKER_ID },
    update
  );
}

async function sendScheduledMessage(
  message: IScheduledMessage
): Promise<{ success: boolean; telegramMessageId?: number; error?: string }> {
  try {
    const { chatId, message: content } = message;

    let success = false;

    if (content.media) {
      // Send media message
      switch (content.media.type) {
        case 'photo':
          success = await sendPhoto(
            chatId,
            content.media.fileId || content.media.url!,
            content.media.caption || content.text
          );
          break;
        case 'audio':
        case 'voice':
          success = await sendAudio(
            chatId,
            content.media.fileId || content.media.url!,
            content.media.caption
          );
          break;
        case 'document':
        case 'video':
          success = await sendDocument(
            chatId,
            content.media.fileId || content.media.url!,
            content.media.caption
          );
          break;
      }
    } else if (content.text) {
      // Send text message
      success = await sendMessage(chatId, content.text);
    } else {
      return { success: false, error: 'No content to send' };
    }

    if (success) {
      // Store the message in our database too
      const session = await ChatSession.findOne({ sessionId: message.sessionId });
      if (session) {
        await Message.create({
          session: session._id,
          sender: 'agent',
          senderAgent: message.createdBy !== 'system' ? message.createdBy : undefined,
          content: content.text || content.media?.caption || '[Scheduled message]',
          messageType: content.media?.type || 'text',
          mediaUrl: content.media?.url || content.media?.fileId,
          metadata: {
            scheduledMessageId: message._id.toString(),
            isScheduled: true,
          },
        });
      }

      return { success: true };
    }

    return { success: false, error: 'Failed to send message' };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('api', {
      action: 'scheduled_message_send_error',
      scheduledMessageId: message._id.toString(),
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

async function resolvePlaceholders(
  sessionId: string,
  agentId: string | 'system'
): Promise<Record<string, string>> {
  const session = await ChatSession.findOne({ sessionId })
    .populate('user')
    .populate('assignedAgent');

  const agent = agentId !== 'system' 
    ? await Agent.findById(agentId)
    : null;

  const now = new Date();

  return {
    '{userName}': (session?.user as any)?.firstName || 'Usuario',
    '{agentName}': agent?.name || (session?.assignedAgent as any)?.name || 'Agente',
    '{chatId}': sessionId,
    '{date}': now.toLocaleDateString('es'),
    '{time}': now.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }),
  };
}

function applyPlaceholders(text: string, placeholders: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(placeholders)) {
    result = result.replace(new RegExp(key, 'g'), value);
  }
  return result;
}

async function logActivity(
  sessionId: string,
  action: string,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await ActivityLog.create({
      sessionId,
      action,
      actor: {
        type: 'system',
        name: 'ScheduledMessages',
      },
      metadata,
    });
  } catch (error) {
    logger.error('api', {
      action: 'activity_log_error',
      error: String(error),
    });
  }
}

function emitScheduledMessageEvent(
  event: 'scheduled_message_created' | 'scheduled_message_cancelled' | 'scheduled_message_sent',
  message: IScheduledMessage
): void {
  try {
    const io = getIO();
    
    // Emit to session room
    io.to(`session:${message.sessionId}`).emit(event as any, {
      id: message._id.toString(),
      sessionId: message.sessionId,
      type: message.type,
      status: message.status,
      scheduledAt: message.scheduledAt,
      delayMinutes: message.delayMinutes,
      triggerEvent: message.triggerEvent,
      message: {
        text: message.message.text?.slice(0, 100),
        hasMedia: !!message.message.media,
      },
      createdBy: message.createdBy,
      createdByName: message.createdByName,
      sentAt: message.sentAt,
      createdAt: message.createdAt,
    });

    // Also emit to supervisors
    io.to('supervisors').emit(event as any, {
      id: message._id.toString(),
      sessionId: message.sessionId,
      status: message.status,
    });
  } catch (error) {
    // Ignore socket errors
  }
}

// ============= RESET INACTIVITY TIMER =============

/**
 * Reset inactivity timers when user sends a message
 * Called from message handlers
 */
export async function resetInactivityTimers(sessionId: string): Promise<void> {
  const now = new Date();
  
  // Update inactivityStartedAt for all pending inactivity messages
  await ScheduledMessage.updateMany(
    {
      sessionId,
      status: 'pending',
      type: 'after_inactivity',
    },
    {
      inactivityStartedAt: now,
    }
  );
}

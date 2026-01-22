/**
 * Broadcast Worker
 * Processes mass messaging campaigns with rate limiting
 * 
 * Handles:
 * - Recipient preparation
 * - Batch sending with rate limiting
 * - Progress tracking
 * - Error handling and retries
 * - Telegram API rate limit compliance
 * - Multiple message types (text, photo, video, document, audio, poll)
 */

import { Job } from 'bullmq';
import { registerWorker, QUEUE_NAMES, BroadcastJob } from './queue.js';
import { broadcastService } from './broadcast.service.js';
import { Broadcast, BroadcastRecipient, IBroadcastRecipientDoc, IBroadcast, BroadcastMessageType } from '../database/models/index.js';
import { 
  sendMessage as telegramSendMessage,
  sendPhoto as telegramSendPhoto,
  sendVideo as telegramSendVideo,
  sendDocument as telegramSendDocument,
  sendAudio as telegramSendAudio,
  sendPoll as telegramSendPoll,
} from './telegram.js';
import { logger } from './logger.js';

// ============= CONSTANTS =============

// Telegram rate limits (conservative estimates)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const RATE_LIMIT_DELAY_MS = 1000; // Delay between messages within a batch

// Error codes that indicate user blocked/deleted
const PERMANENT_ERROR_CODES = [
  'Forbidden: bot was blocked by the user',
  'Forbidden: user is deactivated',
  'Bad Request: chat not found',
  'Forbidden: bot can\'t initiate conversation with a user',
  'Forbidden: bot was kicked from the group chat',
];

// Error codes that indicate rate limiting
const RATE_LIMIT_ERROR_PATTERNS = [
  'Too Many Requests',
  'retry after',
  'FLOOD_WAIT',
  '429',
];

// ============= HELPER FUNCTIONS =============

/**
 * Check if error is permanent (no retry needed)
 */
function isPermanentError(errorMessage: string): boolean {
  return PERMANENT_ERROR_CODES.some((code) => errorMessage.includes(code));
}

/**
 * Check if error is rate limiting
 */
function isRateLimitError(errorMessage: string): boolean {
  return RATE_LIMIT_ERROR_PATTERNS.some((pattern) => errorMessage.includes(pattern));
}

/**
 * Extract retry-after seconds from error message
 */
function extractRetryAfter(errorMessage: string): number {
  const match = errorMessage.match(/retry after (\d+)/i);
  if (match) {
    return parseInt(match[1], 10) * 1000; // Convert to ms
  }
  return 30000; // Default 30 seconds
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Broadcast content interface for sending
 */
interface BroadcastContent {
  messageType: BroadcastMessageType;
  message?: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  mediaUrl?: string;
  mediaCaption?: string;
  pollQuestion?: string;
  pollOptions?: string[];
  pollIsAnonymous?: boolean;
  pollAllowsMultiple?: boolean;
}

/**
 * Send message to a single recipient based on message type
 */
async function sendToRecipient(
  telegramId: number,
  content: BroadcastContent
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    let success: boolean = false;
    const parseMode = content.parseMode;
    
    switch (content.messageType) {
      case 'text':
        success = await telegramSendMessage(telegramId, content.message || '', { parseMode });
        break;
        
      case 'photo':
        success = await telegramSendPhoto(
          telegramId, 
          content.mediaUrl || '', 
          { caption: content.mediaCaption }
        );
        break;
        
      case 'video':
        success = await telegramSendVideo(
          telegramId, 
          content.mediaUrl || '', 
          { caption: content.mediaCaption }
        );
        break;
        
      case 'document':
        success = await telegramSendDocument(
          telegramId, 
          content.mediaUrl || '', 
          { caption: content.mediaCaption }
        );
        break;
        
      case 'audio':
        success = await telegramSendAudio(
          telegramId, 
          content.mediaUrl || '', 
          { caption: content.mediaCaption }
        );
        break;
        
      case 'poll':
        const pollResult = await telegramSendPoll(
          telegramId,
          content.pollQuestion || 'Poll',
          content.pollOptions || [],
          {
            is_anonymous: content.pollIsAnonymous ?? true,
            allows_multiple_answers: content.pollAllowsMultiple ?? false,
          }
        );
        success = pollResult !== null;
        break;
        
      default:
        return {
          success: false,
          error: { code: 'INVALID_TYPE', message: `Unknown message type: ${content.messageType}` },
        };
    }
    
    if (success) {
      return { success: true };
    } else {
      return {
        success: false,
        error: { code: 'SEND_FAILED', message: 'Message send returned false' },
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Check for specific error types
    if (isPermanentError(errorMessage)) {
      return {
        success: false,
        error: { code: 'BLOCKED', message: errorMessage },
      };
    }
    
    if (isRateLimitError(errorMessage)) {
      return {
        success: false,
        error: { code: 'RATE_LIMITED', message: errorMessage },
      };
    }
    
    return {
      success: false,
      error: { code: 'UNKNOWN', message: errorMessage },
    };
  }
}

/**
 * Process a single batch of recipients
 */
async function processBatch(
  broadcastId: string,
  recipients: IBroadcastRecipientDoc[],
  content: BroadcastContent
): Promise<{ sent: number; failed: number; blocked: number }> {
  const stats = { sent: 0, failed: 0, blocked: 0 };
  
  for (const recipient of recipients) {
    // Check if broadcast was cancelled or paused
    const broadcast = await Broadcast.findById(broadcastId).select('status').lean();
    if (broadcast?.status === 'cancelled' || broadcast?.status === 'paused') {
      logger.info('broadcast_worker', {
        action: 'batch_interrupted',
        broadcastId,
        status: broadcast.status,
      });
      break;
    }
    
    const result = await sendToRecipient(recipient.telegramId, content);
    
    if (result.success) {
      await broadcastService.updateRecipientStatus(recipient._id.toString(), 'sent');
      stats.sent++;
    } else if (result.error?.code === 'BLOCKED') {
      await broadcastService.updateRecipientStatus(recipient._id.toString(), 'blocked', result.error);
      stats.blocked++;
    } else if (result.error?.code === 'RATE_LIMITED') {
      // Handle rate limiting - wait and retry
      const retryAfter = extractRetryAfter(result.error.message);
      logger.warn('broadcast_worker', {
        action: 'rate_limited',
        broadcastId,
        telegramId: recipient.telegramId,
        retryAfter,
      });
      
      await sleep(retryAfter);
      
      // Retry once after waiting
      const retryResult = await sendToRecipient(recipient.telegramId, content);
      if (retryResult.success) {
        await broadcastService.updateRecipientStatus(recipient._id.toString(), 'sent');
        stats.sent++;
      } else {
        const retryCount = await broadcastService.incrementRetry(recipient._id.toString());
        if (retryCount >= MAX_RETRIES) {
          await broadcastService.updateRecipientStatus(recipient._id.toString(), 'failed', retryResult.error);
          stats.failed++;
        }
        // Otherwise leave as pending for next batch
      }
    } else {
      // Other errors - check retry count
      const retryCount = await broadcastService.incrementRetry(recipient._id.toString());
      if (retryCount >= MAX_RETRIES) {
        await broadcastService.updateRecipientStatus(recipient._id.toString(), 'failed', result.error);
        stats.failed++;
      }
      // Otherwise leave as pending for next batch
    }
    
    // Small delay between messages to avoid rate limiting
    await sleep(RATE_LIMIT_DELAY_MS / 10); // 100ms between messages
  }
  
  return stats;
}

// ============= MAIN WORKER PROCESSOR =============

/**
 * Process a broadcast job
 */
async function processBroadcastJob(job: Job<BroadcastJob>): Promise<void> {
  const { broadcastId } = job.data;
  
  logger.info('broadcast_worker', {
    action: 'job_started',
    broadcastId,
    jobId: job.id,
  });
  
  // Get broadcast details
  const broadcast = await Broadcast.findById(broadcastId);
  if (!broadcast) {
    throw new Error(`Broadcast not found: ${broadcastId}`);
  }
  
  // Check status
  if (!['pending', 'sending'].includes(broadcast.status)) {
    logger.info('broadcast_worker', {
      action: 'job_skipped',
      broadcastId,
      status: broadcast.status,
    });
    return;
  }
  
  try {
    // Prepare recipients if not already done
    if (!broadcast.recipientsProcessed) {
      logger.info('broadcast_worker', { action: 'preparing_recipients', broadcastId });
      await broadcastService.prepareRecipients(broadcastId);
    }
    
    // Mark as sending
    await broadcastService.markSending(broadcastId);
    
    // Process batches
    let hasMoreBatches = true;
    let totalProcessed = 0;
    const accumulatedStats = { sent: 0, failed: 0, blocked: 0 };
    
    while (hasMoreBatches) {
      // Check current status - fetch all content fields
      const currentBroadcast = await Broadcast.findById(broadcastId)
        .select('status batchSize batchDelayMs messageType message parseMode mediaUrl mediaCaption pollQuestion pollOptions pollIsAnonymous pollAllowsMultiple')
        .lean() as IBroadcast | null;
      if (!currentBroadcast) break;
      
      if (currentBroadcast.status === 'cancelled') {
        logger.info('broadcast_worker', { action: 'broadcast_cancelled', broadcastId });
        break;
      }
      
      if (currentBroadcast.status === 'paused') {
        logger.info('broadcast_worker', { action: 'broadcast_paused', broadcastId });
        return; // Exit without completing - will be resumed later
      }
      
      // Get next batch
      const batch = await broadcastService.getNextBatch(broadcastId, currentBroadcast.batchSize);
      
      if (batch.length === 0) {
        hasMoreBatches = false;
        break;
      }
      
      // Build content for sending
      const content: BroadcastContent = {
        messageType: currentBroadcast.messageType || 'text',
        message: currentBroadcast.message,
        parseMode: currentBroadcast.parseMode,
        mediaUrl: currentBroadcast.mediaUrl,
        mediaCaption: currentBroadcast.mediaCaption,
        pollQuestion: currentBroadcast.pollQuestion,
        pollOptions: currentBroadcast.pollOptions,
        pollIsAnonymous: currentBroadcast.pollIsAnonymous,
        pollAllowsMultiple: currentBroadcast.pollAllowsMultiple,
      };
      
      // Process batch
      const batchStats = await processBatch(
        broadcastId,
        batch,
        content
      );
      
      // Update accumulated stats
      accumulatedStats.sent += batchStats.sent;
      accumulatedStats.failed += batchStats.failed;
      accumulatedStats.blocked += batchStats.blocked;
      totalProcessed += batch.length;
      
      // Update progress in database
      await broadcastService.updateProgress(broadcastId, batchStats);
      
      // Update job progress
      const total = broadcast.progress.total || 1;
      const progress = Math.min(100, Math.round((totalProcessed / total) * 100));
      await job.updateProgress(progress);
      
      logger.info('broadcast_worker', {
        action: 'batch_completed',
        broadcastId,
        batchSize: batch.length,
        totalProcessed,
        total: broadcast.progress.total,
        progress,
        stats: batchStats,
      });
      
      // Wait between batches
      if (batch.length === currentBroadcast.batchSize) {
        await sleep(currentBroadcast.batchDelayMs);
      }
    }
    
    // Check final status and mark complete
    const finalBroadcast = await Broadcast.findById(broadcastId);
    if (finalBroadcast && finalBroadcast.status === 'sending') {
      const hasFailed = accumulatedStats.failed > accumulatedStats.sent;
      await broadcastService.markComplete(broadcastId, hasFailed ? 'failed' : 'completed');
    }
    
    logger.info('broadcast_worker', {
      action: 'job_completed',
      broadcastId,
      totalProcessed,
      stats: accumulatedStats,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    logger.error('broadcast_worker', {
      action: 'job_error',
      broadcastId,
      error: errorMessage,
    });
    
    await broadcastService.setError(broadcastId, errorMessage);
    
    // Mark as failed if critical error
    if (job.attemptsMade >= (job.opts.attempts || 3) - 1) {
      await broadcastService.markComplete(broadcastId, 'failed');
    }
    
    throw error;
  }
}

// ============= WORKER REGISTRATION =============

let workerRegistered = false;

/**
 * Register the broadcast worker
 */
export function registerBroadcastWorker(): void {
  if (workerRegistered) {
    logger.warn('broadcast_worker', { action: 'already_registered' });
    return;
  }
  
  registerWorker<BroadcastJob>(
    QUEUE_NAMES.BROADCAST,
    processBroadcastJob,
    { concurrency: 2 } // Process 2 broadcasts at a time max
  );
  
  workerRegistered = true;
  console.log('✅ [Broadcast] Worker registered');
}

export default { registerBroadcastWorker };

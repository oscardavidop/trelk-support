/**
 * Cleanup Worker
 * Periodic maintenance tasks
 * 
 * Tasks:
 * - Clean expired sessions
 * - Archive old messages
 * - Clear stale locks
 * - Prune old queue jobs
 */

import { Job } from 'bullmq';
import mongoose from 'mongoose';
import {
  registerWorker,
  addJob,
  QUEUE_NAMES,
  type CleanupJob,
} from '../services/queue.js';
import { logger } from '../services/logger.js';
import * as redis from '../services/redis.js';

// ============= CONFIGURATION =============

const CLEANUP_CONFIG = {
  // Sessions older than 30 days with no activity
  sessionExpiryDays: 30,
  // Messages older than 90 days
  messageRetentionDays: 90,
  // Lock TTL for cleanup operations (5 minutes)
  cleanupLockTTL: 300,
  // Batch size for bulk operations
  batchSize: 100,
};

// ============= WORKER PROCESSOR =============

/**
 * Process a cleanup job
 */
async function processCleanupJob(job: Job<CleanupJob>): Promise<any> {
  const { type } = job.data;

  logger.info('worker:cleanup', {
    action: 'processing',
    jobId: job.id,
    type,
  });

  const lockKey = `cleanup:${type}`;
  const lockValue = await redis.acquireLock(lockKey, CLEANUP_CONFIG.cleanupLockTTL);
  
  if (!lockValue) {
    logger.warn('worker:cleanup', {
      action: 'lock_failed',
      type,
      reason: 'Another cleanup job is running',
    });
    return { skipped: true, reason: 'lock_failed' };
  }

  try {
    let result: any;

    switch (type) {
      case 'expired_sessions':
        result = await cleanupExpiredSessions();
        break;
      case 'old_messages':
        result = await cleanupOldMessages();
        break;
      case 'stale_locks':
        result = await cleanupStaleLocks();
        break;
      default:
        logger.warn('worker:cleanup', {
          action: 'unknown_type',
          type,
        });
        return { skipped: true, reason: 'unknown_type' };
    }

    logger.info('worker:cleanup', {
      action: 'completed',
      type,
      result,
    });

    return result;
  } finally {
    await redis.releaseLock(lockKey, lockValue);
  }
}

// ============= CLEANUP TASKS =============

/**
 * Clean up expired sessions
 */
async function cleanupExpiredSessions(): Promise<{ cleaned: number; archived: number }> {
  const Session = mongoose.model('Session');
  
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - CLEANUP_CONFIG.sessionExpiryDays);

  let cleaned = 0;
  let archived = 0;

  try {
    // Find expired closed sessions
    const expiredSessions = await Session.find({
      status: 'closed',
      closedAt: { $lt: expiryDate },
      archived: { $ne: true },
    })
      .limit(CLEANUP_CONFIG.batchSize)
      .select('_id');

    if (expiredSessions.length === 0) {
      return { cleaned: 0, archived: 0 };
    }

    const sessionIds = expiredSessions.map(s => s._id);

    // Archive sessions (soft delete)
    const archiveResult = await Session.updateMany(
      { _id: { $in: sessionIds } },
      {
        $set: {
          archived: true,
          archivedAt: new Date(),
        },
      }
    );

    archived = archiveResult.modifiedCount;

    // Invalidate cache for archived sessions
    for (const id of sessionIds) {
      await redis.del(`trelk:support:session:${id}`);
    }

    logger.info('worker:cleanup', {
      action: 'sessions_archived',
      count: archived,
    });

    return { cleaned, archived };
  } catch (error) {
    logger.error('worker:cleanup', {
      action: 'session_cleanup_error',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Clean up old messages
 */
async function cleanupOldMessages(): Promise<{ deleted: number }> {
  const Message = mongoose.model('Message');
  
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - CLEANUP_CONFIG.messageRetentionDays);

  try {
    // Delete old messages from archived sessions only
    const Session = mongoose.model('Session');
    const archivedSessionIds = await Session.find({ archived: true })
      .select('_id')
      .lean();

    if (archivedSessionIds.length === 0) {
      return { deleted: 0 };
    }

    const sessionIds = archivedSessionIds.map(s => s._id);

    // Delete messages in batches
    const deleteResult = await Message.deleteMany({
      session: { $in: sessionIds },
      createdAt: { $lt: retentionDate },
    });

    logger.info('worker:cleanup', {
      action: 'messages_deleted',
      count: deleteResult.deletedCount,
    });

    return { deleted: deleteResult.deletedCount };
  } catch (error) {
    logger.error('worker:cleanup', {
      action: 'message_cleanup_error',
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Clean up stale Redis locks
 */
async function cleanupStaleLocks(): Promise<{ cleared: number }> {
  try {
    // Get all lock keys
    const pattern = 'trelk:support:lock:*';
    let cleared = 0;
    
    // Note: In production, you'd use SCAN to iterate over keys
    // For now, we'll just log that we checked
    logger.info('worker:cleanup', {
      action: 'locks_checked',
      pattern,
    });

    // Locks are automatically expired by Redis TTL
    // This task is mainly for monitoring and cleanup of orphaned locks
    
    return { cleared };
  } catch (error) {
    logger.error('worker:cleanup', {
      action: 'lock_cleanup_error',
      error: error instanceof Error ? error.message : String(error),
    });
    return { cleared: 0 };
  }
}

// ============= SCHEDULING =============

/**
 * Schedule recurring cleanup jobs
 */
export async function scheduleCleanupJobs(): Promise<void> {
  const jobs = [
    {
      type: 'expired_sessions' as const,
      pattern: '0 3 * * *', // Every day at 3 AM
    },
    {
      type: 'old_messages' as const,
      pattern: '0 4 * * 0', // Every Sunday at 4 AM
    },
    {
      type: 'stale_locks' as const,
      pattern: '*/30 * * * *', // Every 30 minutes
    },
  ];

  for (const job of jobs) {
    await addJob<CleanupJob>(
      QUEUE_NAMES.CLEANUP,
      job.type,
      { type: job.type },
      {
        repeat: { pattern: job.pattern },
        jobId: `cleanup:${job.type}`,
      }
    );

    logger.info('worker:cleanup', {
      action: 'scheduled',
      type: job.type,
      pattern: job.pattern,
    });
  }

  console.log('✅ [Worker] Cleanup jobs scheduled');
}

// ============= WORKER REGISTRATION =============

let isWorkerRegistered = false;

/**
 * Start the cleanup worker
 */
export function startCleanupWorker(): void {
  if (isWorkerRegistered) {
    logger.warn('worker:cleanup', { action: 'already_registered' });
    return;
  }

  registerWorker<CleanupJob>(
    QUEUE_NAMES.CLEANUP,
    processCleanupJob,
    { concurrency: 1 } // Only one cleanup at a time
  );

  isWorkerRegistered = true;
  console.log('✅ [Worker] Cleanup worker started');
}

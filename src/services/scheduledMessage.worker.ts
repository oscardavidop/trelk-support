/**
 * Scheduled Messages Worker
 * Cron-based worker that processes scheduled messages
 * 
 * Features:
 * - Runs every 30 seconds
 * - Distributed-safe (uses locking)
 * - Graceful shutdown
 * - Health monitoring
 */

import { processScheduledMessages, getScheduledMessageStats } from './scheduledMessage.service.js';
import { logger } from './logger.js';

// Worker state
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let lastRunAt: Date | null = null;
let consecutiveErrors = 0;
const MAX_CONSECUTIVE_ERRORS = 5;
const PROCESSING_INTERVAL_MS = 30000; // 30 seconds

/**
 * Start the scheduled messages worker
 */
export function startScheduledMessagesWorker(): void {
  if (isRunning) {
    logger.warn('api', { action: 'scheduled_worker_already_running' });
    return;
  }

  isRunning = true;
  consecutiveErrors = 0;

  console.log('✅ [Scheduler] Worker started - checking every 30s');
  logger.info('api', {
    action: 'scheduled_worker_started',
    intervalMs: PROCESSING_INTERVAL_MS,
    message: 'Scheduled messages worker is now running',
  });

  // Run immediately on start
  runProcessingCycle();

  // Then run every 30 seconds
  intervalId = setInterval(runProcessingCycle, PROCESSING_INTERVAL_MS);
}

/**
 * Stop the scheduled messages worker
 */
export function stopScheduledMessagesWorker(): void {
  if (!isRunning) return;

  isRunning = false;

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  logger.info('api', { action: 'scheduled_worker_stopped' });
}

/**
 * Run a single processing cycle
 */
async function runProcessingCycle(): Promise<void> {
  if (!isRunning) return;

  const cycleStart = new Date();

  try {
    const stats = await processScheduledMessages();
    
    lastRunAt = new Date();
    consecutiveErrors = 0;

    // Log activity 
    if (stats.processed > 0 || stats.expired > 0 || stats.sent > 0) {
      console.log(`📤 [Scheduler] Cycle complete: ${stats.sent} sent, ${stats.processed} processed, ${stats.expired} expired, ${stats.failed} failed`);
      logger.info('api', {
        action: 'scheduled_worker_cycle_complete',
        ...stats,
        durationMs: Date.now() - cycleStart.getTime(),
      });
    }
  } catch (error) {
    consecutiveErrors++;
    
    console.error(`❌ [Scheduler] Cycle error (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error);
    logger.error('api', {
      action: 'scheduled_worker_cycle_error',
      error: error instanceof Error ? error.message : String(error),
      consecutiveErrors,
    });

    // If too many consecutive errors, slow down
    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
      logger.error('api', {
        action: 'scheduled_worker_too_many_errors',
        message: 'Pausing worker due to consecutive errors',
      });
      
      // Wait extra time before next run
      await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute
      consecutiveErrors = 0;
    }
  }
}

/**
 * Get worker health status
 */
export async function getWorkerHealth(): Promise<{
  isRunning: boolean;
  lastRunAt: Date | null;
  consecutiveErrors: number;
  stats: {
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
}> {
  const stats = await getScheduledMessageStats();

  return {
    isRunning,
    lastRunAt,
    consecutiveErrors,
    stats,
  };
}

/**
 * Force run a processing cycle (for testing/admin)
 */
export async function forceProcessingCycle(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  expired: number;
}> {
  logger.info('api', { action: 'scheduled_worker_force_run' });
  return processScheduledMessages();
}

/**
 * Workers Index
 * Central export and initialization for all BullMQ workers
 */

import { initializeQueues, shutdownQueues, QUEUE_NAMES } from '../services/queue.js';
import { startScheduledMessagesWorker, migrateExistingScheduledMessages } from './scheduledMessages.worker.js';
import { startFlowExecutionWorker } from './flowExecution.worker.js';
import { startCleanupWorker, scheduleCleanupJobs } from './cleanup.worker.js';
import { initializeInactivityWorker, stopInactivityWorker } from './inactivity.worker.js';
import { registerBroadcastWorker } from '../services/broadcast.worker.js';
import { logger } from '../services/logger.js';
import { set as redisSet, isRedisConnected } from '../services/redis.js';

// ============= LIFECYCLE =============

let isInitialized = false;

/**
 * Initialize all workers
 */
export async function initializeWorkers(): Promise<boolean> {
  if (isInitialized) {
    logger.warn('workers', { action: 'already_initialized' });
    return true;
  }

  try {
    logger.info('workers', { action: 'initializing' });

    // Initialize queues first
    const queuesReady = await initializeQueues();
    if (!queuesReady) {
      throw new Error('Failed to initialize queues');
    }

    // Start workers
    startScheduledMessagesWorker();
    startFlowExecutionWorker();
    startCleanupWorker();
    initializeInactivityWorker();
    registerBroadcastWorker();

    // Schedule recurring cleanup jobs
    await scheduleCleanupJobs();

    isInitialized = true;
    logger.info('workers', { action: 'initialized' });

    // Store worker start timestamps in Redis for uptime tracking
    if (isRedisConnected()) {
      const startedAt = Date.now().toString();
      await Promise.all(
        Object.values(QUEUE_NAMES).map((name) =>
          redisSet(`worker:startedAt:${name}`, startedAt)
        )
      );
    }
    
    return true;
  } catch (error) {

    logger.error('workers', {
      action: 'init_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Gracefully shutdown all workers
 */
export async function shutdownWorkers(): Promise<void> {
  if (!isInitialized) {
    return;
  }

  logger.info('workers', { action: 'shutdown_started' });
  
  stopInactivityWorker();
  await shutdownQueues();
  
  isInitialized = false;
  logger.info('workers', { action: 'shutdown_complete' });
}

/**
 * Check if workers are initialized
 */
export function areWorkersInitialized(): boolean {
  return isInitialized;
}

// ============= EXPORTS =============

export {
  startScheduledMessagesWorker,
  startFlowExecutionWorker,
  startCleanupWorker,
  scheduleCleanupJobs,
  migrateExistingScheduledMessages,
};

// Re-export queue utilities
export {
  getQueue,
  addJob,
  removeJob,
  getJobStatus,
  scheduleMessage,
  cancelScheduledMessage,
  getQueueStats,
  getAllQueueStats,
  QUEUE_NAMES,
} from '../services/queue.js';

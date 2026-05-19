/**
 * Queue Service
 * BullMQ-based job queue for async processing
 * 
 * Queues:
 * - scheduled-messages: Scheduled message delivery
 * - flow-execution: Flow trigger processing
 * - cleanup: Periodic cleanup tasks
 * - notifications: Push notifications
 */

import { Queue, Worker, Job, QueueEvents, ConnectionOptions } from 'bullmq';
import { logger } from './logger.js';

// ============= CONFIGURATION =============

const REDIS_CONNECTION: ConnectionOptions = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
};

// Queue names
export const QUEUE_NAMES = {
  SCHEDULED_MESSAGES: 'scheduled-messages',
  FLOW_EXECUTION: 'flow-execution',
  CLEANUP: 'cleanup',
  INACTIVITY: 'inactivity',
  NOTIFICATIONS: 'notifications',
  BROADCAST: 'broadcast',
} as const;

type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
export type { QueueName };

// ============= STATE =============

const queues: Map<QueueName, Queue> = new Map();
const workers: Map<QueueName, Worker> = new Map();
const queueEvents: Map<QueueName, QueueEvents> = new Map();

let isInitialized = false;

// ============= QUEUE CREATION =============

/**
 * Create a new queue
 */
function createQueue(name: QueueName): Queue {
  const queue = new Queue(name, {
    connection: REDIS_CONNECTION,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: {
        count: 1000,  // Keep last 1000 completed jobs
        age: 24 * 3600, // Or jobs older than 24 hours
      },
      removeOnFail: {
        count: 5000,  // Keep last 5000 failed jobs
        age: 7 * 24 * 3600, // Or jobs older than 7 days
      },
    },
  });

  queues.set(name, queue);
  return queue;
}

/**
 * Get or create a queue
 */
export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = createQueue(name);
  }
  return queue;
}

// ============= JOB TYPES =============

export interface ScheduledMessageJob {
  messageId: string;
  sessionId: string;
  chatId: number;
  scheduledAt: string;
}

export interface FlowExecutionJob {
  flowId: string;
  sessionId: string;
  chatId: number;
  triggerType: string;
  triggerData: Record<string, any>;
}

export interface CleanupJob {
  type: 'expired_sessions' | 'old_messages' | 'stale_locks';
}

export interface NotificationJob {
  type: 'push' | 'email' | 'telegram';
  recipient: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

export interface InactivityJob {
  type: 'warning' | 'close' | 'queued_close';
  sessionId: string;
  chatId: number;
  remainingMinutes?: number;
}

export interface BroadcastJob {
  broadcastId: string;
}

// ============= WORKER CREATION =============

/**
 * Register a worker for a queue
 */
export function registerWorker<T>(
  queueName: QueueName,
  processor: (job: Job<T>) => Promise<any>,
  options: { concurrency?: number } = {}
): Worker<T> {
  const { concurrency = 5 } = options;

  const worker = new Worker<T>(
    queueName,
    async (job) => {
      const startTime = Date.now();
      
      try {
        const result = await processor(job);
        
        logger.info('queue', {
          action: 'job_completed',
          queue: queueName,
          jobId: job.id,
          jobName: job.name,
          durationMs: Date.now() - startTime,
        });
        
        return result;
      } catch (error) {
        logger.error('queue', {
          action: 'job_failed',
          queue: queueName,
          jobId: job.id,
          jobName: job.name,
          attempt: job.attemptsMade,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
    {
      connection: REDIS_CONNECTION,
      concurrency,
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    logger.debug('queue', { action: 'worker_job_completed', queue: queueName, jobId: job.id });
  });

  worker.on('failed', (job, error) => {
    logger.error('queue', {
      action: 'worker_job_failed',
      queue: queueName,
      jobId: job?.id,
      error: error.message,
    });
  });

  worker.on('error', (error) => {
    logger.error('queue', {
      action: 'worker_error',
      queue: queueName,
      error: error.message,
    });
  });

  workers.set(queueName, worker);
  logger.info('queue', { action: 'worker_registered', queue: queueName });
  
  return worker;
}

// ============= JOB OPERATIONS =============

/**
 * Add a job to a queue
 */
export async function addJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  options: {
    delay?: number;
    priority?: number;
    jobId?: string;
    repeat?: {
      pattern?: string;  // Cron pattern
      every?: number;    // Milliseconds
      limit?: number;
    };
  } = {}
): Promise<Job<T>> {
  const queue = getQueue(queueName);
  
  const job = await queue.add(jobName, data, {
    delay: options.delay,
    priority: options.priority,
    jobId: options.jobId,
    repeat: options.repeat,
  });

  logger.debug('queue', {
    action: 'job_added',
    queue: queueName,
    jobId: job.id,
    jobName,
    delay: options.delay,
  });

  return job;
}

/**
 * Remove a job by ID
 */
export async function removeJob(queueName: QueueName, jobId: string): Promise<boolean> {
  const queue = getQueue(queueName);
  
  try {
    const job = await queue.getJob(jobId);
    if (job) {
      await job.remove();
      logger.info('queue', { action: 'job_removed', queue: queueName, jobId });
      return true;
    }
    return false;
  } catch (error) {
    logger.error('queue', { action: 'job_remove_failed', queue: queueName, jobId, error: String(error) });
    return false;
  }
}

/**
 * Get job status
 */
export async function getJobStatus(queueName: QueueName, jobId: string): Promise<string | null> {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);
  
  if (!job) return null;
  
  const state = await job.getState();
  return state;
}

// ============= SCHEDULED MESSAGES HELPERS =============

/**
 * Schedule a message for delivery
 */
export async function scheduleMessage(
  messageId: string,
  sessionId: string,
  chatId: number,
  deliverAt: Date
): Promise<string | null> {
  const delay = deliverAt.getTime() - Date.now();
  
  if (delay <= 0) {
    logger.warn('queue', { 
      action: 'schedule_in_past', 
      messageId, 
      deliverAt: deliverAt.toISOString() 
    });
    return null;
  }

  const job = await addJob<ScheduledMessageJob>(
    QUEUE_NAMES.SCHEDULED_MESSAGES,
    'deliver',
    {
      messageId,
      sessionId,
      chatId,
      scheduledAt: deliverAt.toISOString(),
    },
    {
      delay,
      jobId: `scheduled-${messageId}`,
    }
  );

  return job.id || null;
}

/**
 * Cancel a scheduled message
 */
export async function cancelScheduledMessage(messageId: string): Promise<boolean> {
  return removeJob(QUEUE_NAMES.SCHEDULED_MESSAGES, `scheduled-${messageId}`);
}

// ============= INACTIVITY QUEUE HELPERS =============

/**
 * Schedule an inactivity warning
 */
export async function scheduleInactivityWarning(
  sessionId: string,
  chatId: number,
  delayMinutes: number,
  remainingMinutes: number
): Promise<string | null> {
  const delay = delayMinutes * 60 * 1000;
  
  const job = await addJob<InactivityJob>(
    QUEUE_NAMES.INACTIVITY,
    'warning',
    {
      type: 'warning',
      sessionId,
      chatId,
      remainingMinutes,
    },
    {
      delay,
      jobId: `inactivity-warning-${sessionId}`,
    }
  );

  logger.debug('queue', {
    action: 'inactivity_warning_scheduled',
    sessionId,
    delayMinutes,
    remainingMinutes,
  });

  return job.id || null;
}

/**
 * Schedule an inactivity close
 */
export async function scheduleInactivityClose(
  sessionId: string,
  chatId: number,
  delayMinutes: number
): Promise<string | null> {
  const delay = delayMinutes * 60 * 1000;
  
  const job = await addJob<InactivityJob>(
    QUEUE_NAMES.INACTIVITY,
    'close',
    {
      type: 'close',
      sessionId,
      chatId,
    },
    {
      delay,
      jobId: `inactivity-close-${sessionId}`,
    }
  );

  logger.debug('queue', {
    action: 'inactivity_close_scheduled',
    sessionId,
    delayMinutes,
  });

  return job.id || null;
}

/**
 * Schedule queued session close
 */
export async function scheduleQueuedClose(
  sessionId: string,
  chatId: number,
  delayMinutes: number
): Promise<string | null> {
  const delay = delayMinutes * 60 * 1000;
  
  const job = await addJob<InactivityJob>(
    QUEUE_NAMES.INACTIVITY,
    'queued_close',
    {
      type: 'queued_close',
      sessionId,
      chatId,
    },
    {
      delay,
      jobId: `inactivity-queued-${sessionId}`,
    }
  );

  logger.debug('queue', {
    action: 'queued_close_scheduled',
    sessionId,
    delayMinutes,
  });

  return job.id || null;
}

/**
 * Cancel inactivity timers for a session
 */
export async function cancelInactivityTimers(sessionId: string): Promise<void> {
  await removeJob(QUEUE_NAMES.INACTIVITY, `inactivity-warning-${sessionId}`);
  await removeJob(QUEUE_NAMES.INACTIVITY, `inactivity-close-${sessionId}`);
  await removeJob(QUEUE_NAMES.INACTIVITY, `inactivity-queued-${sessionId}`);
  
  logger.debug('queue', {
    action: 'inactivity_timers_cancelled',
    sessionId,
  });
}

// ============= LIFECYCLE =============

/**
 * Initialize all queues
 */
export async function initializeQueues(): Promise<boolean> {
  if (isInitialized) {
    logger.warn('queue', { action: 'already_initialized' });
    return true;
  }

  try {
    // Create all queues
    for (const name of Object.values(QUEUE_NAMES)) {
      createQueue(name);
    }

    isInitialized = true;
    logger.info('queue', { action: 'all_queues_initialized' });
    return true;
  } catch (error) {
    logger.error('queue', {
      action: 'init_failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Gracefully shutdown all queues and workers
 */
export async function shutdownQueues(): Promise<void> {
  logger.info('queue', { action: 'shutdown_started' });

  // Close workers first
  for (const [name, worker] of workers) {
    try {
      await worker.close();
      logger.info('queue', { action: 'worker_closed', queue: name });
    } catch (error) {
      logger.error('queue', { action: 'worker_close_error', queue: name, error: String(error) });
    }
  }
  workers.clear();

  // Then close queue events
  for (const [name, events] of queueEvents) {
    try {
      await events.close();
    } catch (error) {
      logger.error('queue', { action: 'events_close_error', queue: name, error: String(error) });
    }
  }
  queueEvents.clear();

  // Finally close queues
  for (const [name, queue] of queues) {
    try {
      await queue.close();
      logger.info('queue', { action: 'queue_closed', queue: name });
    } catch (error) {
      logger.error('queue', { action: 'queue_close_error', queue: name, error: String(error) });
    }
  }
  queues.clear();

  isInitialized = false;
  logger.info('queue', { action: 'shutdown_complete' });
}

// ============= HEALTH & METRICS =============

/**
 * Get queue health stats
 */
export async function getQueueStats(queueName: QueueName): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getQueue(queueName);
  
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Get all queues stats
 */
export async function getAllQueueStats(): Promise<Record<QueueName, any>> {
  const stats: Record<string, any> = {};
  
  for (const name of Object.values(QUEUE_NAMES)) {
    stats[name] = await getQueueStats(name);
  }
  
  return stats;
}

/**
 * Check if queues are healthy
 */
export function areQueuesInitialized(): boolean {
  return isInitialized;
}

// ============= BROADCAST QUEUE HELPER =============

/**
 * Get broadcast queue instance (for direct access)
 */
export const broadcastQueue = getQueue(QUEUE_NAMES.BROADCAST);

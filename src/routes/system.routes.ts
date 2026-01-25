/**
 * System Monitoring Routes
 * Real-time monitoring for Queues, Workers, Flows, Scheduled Messages
 * 
 * Endpoints:
 * - GET /api/system/health - Overall system health
 * - GET /api/system/queues - All queue stats
 * - GET /api/system/queues/:name - Specific queue stats
 * - POST /api/system/queues/:name/pause - Pause a queue
 * - POST /api/system/queues/:name/resume - Resume a queue
 * - POST /api/system/queues/:name/clean - Clean completed/failed jobs
 * - POST /api/system/queues/:name/retry-failed - Retry all failed jobs
 * - GET /api/system/workers - Worker status
 * - GET /api/system/flows - Flow execution stats
 * - GET /api/system/scheduled - Scheduled messages stats
 * - GET /api/system/errors - Recent errors
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { 
  getQueue, 
  QUEUE_NAMES, 
  getQueueStats, 
  getAllQueueStats,
  areQueuesInitialized 
} from '../services/queue.js';
import { 
  isRedisConnected, 
  getRedisHealth, 
  ping as pingRedis 
} from '../services/redis.js';
import { ScheduledMessage } from '../database/models/ScheduledMessage.js';
import { Flow } from '../database/models/Flow.js';
import { ActivityLog } from '../database/models/ActivityLog.js';
import { logger } from '../services/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import mongoose from 'mongoose';

// ============= TYPES =============

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  services: {
    redis: { status: 'up' | 'down'; latencyMs?: number };
    mongodb: { status: 'up' | 'down'; latencyMs?: number };
    queues: { status: 'up' | 'down'; initialized: boolean };
  };
  metrics: {
    activeFlows: number;
    pendingJobs: number;
    scheduledMessages: number;
    failedJobs24h: number;
  };
}

interface QueueInfo {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

interface WorkerInfo {
  id: string;
  queue: string;
  status: 'online' | 'idle' | 'offline';
  jobsProcessed: number;
  currentJob?: string;
  startedAt: string;
  lastActivityAt: string;
}

interface FlowStats {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'disabled';
  cachedInRedis: boolean;
  triggers: string[];
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  lastExecutedAt?: string;
  avgExecutionTimeMs?: number;
}

interface ScheduledMessageInfo {
  id: string;
  sessionId: string;
  chatId: number;
  type: string;
  scheduledAt?: string;
  status: string;
  attempts: number;
  createdAt: string;
  error?: string;
}

interface ErrorLogEntry {
  id: string;
  timestamp: string;
  queue: string;
  jobId: string;
  jobName: string;
  error: string;
  stack?: string;
  attempt: number;
  resolved: boolean;
}

// ============= MIDDLEWARE =============

async function requireAdminOrSupervisor(request: FastifyRequest, reply: FastifyReply) {
  const agent = request.agent;
  if (!agent || (agent.role !== 'admin' && agent.role !== 'supervisor')) {
    return reply.status(403).send({ ok: false, error: 'Admin or Supervisor access required' });
  }
}

// ============= HELPERS =============

const validQueueNames = Object.values(QUEUE_NAMES);

function isValidQueueName(name: string): boolean {
  return validQueueNames.includes(name as any);
}

// ============= ROUTES =============

export const systemRoutes: FastifyPluginAsync = async (fastify) => {
  // ============= HEALTH (Available to all authenticated users) =============
  
  /**
   * GET /api/system/health - Overall system health
   * This endpoint only requires authentication, not admin/supervisor role
   */
  fastify.get('/health', { preHandler: authMiddleware }, async (_request, reply) => {
    try {
      const startTime = Date.now();
      
      // Check Redis
      let redisStatus: 'up' | 'down' = 'down';
      let redisLatency: number | undefined;
      if (isRedisConnected()) {
        const pingStart = Date.now();
        const pingOk = await pingRedis();
        redisLatency = Date.now() - pingStart;
        redisStatus = pingOk ? 'up' : 'down';
      }

      // Check MongoDB
      let mongoStatus: 'up' | 'down' = 'down';
      let mongoLatency: number | undefined;
      try {
        const pingStart = Date.now();
        await mongoose.connection.db?.admin().ping();
        mongoLatency = Date.now() - pingStart;
        mongoStatus = 'up';
      } catch {
        mongoStatus = 'down';
      }

      // Check Queues
      const queuesInitialized = areQueuesInitialized();

      // Get metrics
      const [activeFlows, pendingMessages, failedJobs] = await Promise.all([
        Flow.countDocuments({ status: 'active' }),
        ScheduledMessage.countDocuments({ status: 'pending' }),
        getFailedJobsCount24h(),
      ]);

      // Calculate pending jobs in queues
      let pendingJobs = 0;
      if (redisStatus === 'up' && queuesInitialized) {
        try {
          const allStats = await getAllQueueStats();
          for (const stats of Object.values(allStats)) {
            pendingJobs += (stats.waiting || 0) + (stats.delayed || 0);
          }
        } catch {
          // Ignore errors
        }
      }

      // Determine overall status
      let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
      if (mongoStatus === 'down') {
        overallStatus = 'down';
      } else if (redisStatus === 'down' || !queuesInitialized) {
        overallStatus = 'degraded';
      }

      const health: SystemHealth = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services: {
          redis: { status: redisStatus, latencyMs: redisLatency },
          mongodb: { status: mongoStatus, latencyMs: mongoLatency },
          queues: { status: queuesInitialized ? 'up' : 'down', initialized: queuesInitialized },
        },
        metrics: {
          activeFlows,
          pendingJobs,
          scheduledMessages: pendingMessages,
          failedJobs24h: failedJobs,
        },
      };

      return reply.send(health);
    } catch (error) {
      logger.error('api', { action: 'system_health_error', error: String(error) });
      return reply.status(500).send({ error: 'Failed to get system health' });
    }
  });

  // ============= ADMIN/SUPERVISOR PROTECTED ROUTES =============
  // All routes below require admin or supervisor role
  fastify.register(async (adminRoutes) => {
    adminRoutes.addHook('preHandler', authMiddleware);
    adminRoutes.addHook('preHandler', requireAdminOrSupervisor);

  // ============= QUEUES =============

  /**
   * GET /api/system/queues - All queue stats
   */
  adminRoutes.get('/queues', async (_request, reply) => {
    try {
      if (!isRedisConnected()) {
        return reply.send({ queues: [], redisConnected: false });
      }

      const queues: QueueInfo[] = [];

      for (const [key, name] of Object.entries(QUEUE_NAMES)) {
        try {
          const queue = getQueue(name as any);
          const stats = await getQueueStats(name as any);
          const isPaused = await queue.isPaused();

          queues.push({
            name,
            ...stats,
            paused: isPaused,
          });
        } catch (error) {
          logger.error('api', { action: 'queue_stats_error', queue: name, error: String(error) });
        }
      }

      return reply.send({ queues, redisConnected: true });
    } catch (error) {
      logger.error('api', { action: 'queues_list_error', error: String(error) });
      return reply.status(500).send({ error: 'Failed to get queue stats' });
    }
  });

  /**
   * GET /api/system/queues/:name - Specific queue stats with jobs
   */
  adminRoutes.get<{ Params: { name: string }; Querystring: { status?: string; limit?: number } }>(
    '/queues/:name',
    async (request, reply) => {
      const { name } = request.params;
      const { status = 'all', limit = 20 } = request.query;

      if (!isRedisConnected()) {
        return reply.status(503).send({ error: 'Redis not connected' });
      }

      // Validate queue name
      if (!isValidQueueName(name)) {
        return reply.status(400).send({ 
          error: `Invalid queue name: ${name}. Valid names: ${validQueueNames.join(', ')}` 
        });
      }

      try {
        const queue = getQueue(name as any);
        const stats = await getQueueStats(name as any);
        const isPaused = await queue.isPaused();

        // Get jobs based on status filter
        let jobs: any[] = [];
        
        if (status === 'all' || status === 'waiting') {
          const waitingJobs = await queue.getWaiting(0, limit);
          jobs.push(...waitingJobs.map(j => ({ ...formatJob(j), status: 'waiting' })));
        }
        if (status === 'all' || status === 'active') {
          const activeJobs = await queue.getActive(0, limit);
          jobs.push(...activeJobs.map(j => ({ ...formatJob(j), status: 'active' })));
        }
        if (status === 'all' || status === 'delayed') {
          const delayedJobs = await queue.getDelayed(0, limit);
          jobs.push(...delayedJobs.map(j => ({ ...formatJob(j), status: 'delayed' })));
        }
        if (status === 'all' || status === 'failed') {
          const failedJobs = await queue.getFailed(0, limit);
          jobs.push(...failedJobs.map(j => ({ ...formatJob(j), status: 'failed' })));
        }
        if (status === 'all' || status === 'completed') {
          const completedJobs = await queue.getCompleted(0, Math.min(limit, 50));
          jobs.push(...completedJobs.map(j => ({ ...formatJob(j), status: 'completed' })));
        }

        // Sort by timestamp desc and limit
        jobs.sort((a, b) => b.timestamp - a.timestamp);
        jobs = jobs.slice(0, limit);

        return reply.send({
          name,
          stats,
          paused: isPaused,
          jobs,
        });
      } catch (error) {
        logger.error('api', { action: 'queue_detail_error', queue: name, error: String(error) });
        return reply.status(500).send({ error: 'Failed to get queue details' });
      }
    }
  );

  /**
   * POST /api/system/queues/:name/pause - Pause a queue
   */
  adminRoutes.post<{ Params: { name: string } }>('/queues/:name/pause', async (request, reply) => {
    const { name } = request.params;
    const agent = request.agent;

    if (!isValidQueueName(name)) {
      return reply.status(400).send({ error: `Invalid queue name: ${name}` });
    }

    if (!isRedisConnected()) {
      return reply.status(503).send({ error: 'Redis not connected' });
    }

    try {
      const queue = getQueue(name as any);
      await queue.pause();

      logger.info('api', { 
        action: 'queue_paused', 
        queue: name, 
        by: agent?._id 
      });

      return reply.send({ success: true, message: `Queue ${name} paused` });
    } catch (error) {
      logger.error('api', { action: 'queue_pause_error', queue: name, error: String(error) });
      return reply.status(500).send({ error: 'Failed to pause queue' });
    }
  });

  /**
   * POST /api/system/queues/:name/resume - Resume a queue
   */
  adminRoutes.post<{ Params: { name: string } }>('/queues/:name/resume', async (request, reply) => {
    const { name } = request.params;
    const agent = request.agent;

    if (!isValidQueueName(name)) {
      return reply.status(400).send({ error: `Invalid queue name: ${name}` });
    }

    if (!isRedisConnected()) {
      return reply.status(503).send({ error: 'Redis not connected' });
    }

    try {
      const queue = getQueue(name as any);
      await queue.resume();

      logger.info('api', { 
        action: 'queue_resumed', 
        queue: name, 
        by: agent?._id 
      });

      return reply.send({ success: true, message: `Queue ${name} resumed` });
    } catch (error) {
      logger.error('api', { action: 'queue_resume_error', queue: name, error: String(error) });
      return reply.status(500).send({ error: 'Failed to resume queue' });
    }
  });

  /**
   * POST /api/system/queues/:name/clean - Clean completed/failed jobs
   */
  adminRoutes.post<{ Params: { name: string }; Body: { type: 'completed' | 'failed' | 'all'; grace?: number } }>(
    '/queues/:name/clean',
    async (request, reply) => {
      const { name } = request.params;
      const { type = 'completed', grace = 0 } = request.body || {};
      const agent = request.agent;

      if (!isValidQueueName(name)) {
        return reply.status(400).send({ error: `Invalid queue name: ${name}` });
      }

      if (!isRedisConnected()) {
        return reply.status(503).send({ error: 'Redis not connected' });
      }

      try {
        const queue = getQueue(name as any);
        let cleaned = 0;

        if (type === 'completed' || type === 'all') {
          const result = await queue.clean(grace, 1000, 'completed');
          cleaned += result.length;
        }
        if (type === 'failed' || type === 'all') {
          const result = await queue.clean(grace, 1000, 'failed');
          cleaned += result.length;
        }

        logger.info('api', { 
          action: 'queue_cleaned', 
          queue: name, 
          type,
          cleaned,
          by: agent?._id 
        });

        return reply.send({ success: true, cleaned, message: `Cleaned ${cleaned} jobs from ${name}` });
      } catch (error) {
        logger.error('api', { action: 'queue_clean_error', queue: name, error: String(error) });
        return reply.status(500).send({ error: 'Failed to clean queue' });
      }
    }
  );

  /**
   * POST /api/system/queues/:name/retry-failed - Retry all failed jobs
   */
  adminRoutes.post<{ Params: { name: string } }>('/queues/:name/retry-failed', async (request, reply) => {
    const { name } = request.params;
    const agent = request.agent;

    if (!isValidQueueName(name)) {
      return reply.status(400).send({ error: `Invalid queue name: ${name}` });
    }

    if (!isRedisConnected()) {
      return reply.status(503).send({ error: 'Redis not connected' });
    }

    try {
      const queue = getQueue(name as any);
      const failedJobs = await queue.getFailed(0, 1000);
      
      let retried = 0;
      for (const job of failedJobs) {
        try {
          await job.retry();
          retried++;
        } catch {
          // Job may have been removed
        }
      }

      logger.info('api', { 
        action: 'queue_retry_failed', 
        queue: name, 
        retried,
        by: agent?._id 
      });

      return reply.send({ success: true, retried, message: `Retried ${retried} failed jobs in ${name}` });
    } catch (error) {
      logger.error('api', { action: 'queue_retry_error', queue: name, error: String(error) });
      return reply.status(500).send({ error: 'Failed to retry jobs' });
    }
  });

  // ============= WORKERS =============

  /**
   * GET /api/system/workers - Get worker status
   * Note: BullMQ doesn't expose worker info directly, we track via Redis
   */
  adminRoutes.get('/workers', async (_request, reply) => {
    try {
      if (!isRedisConnected()) {
        return reply.send({ workers: [], redisConnected: false });
      }

      // Get worker info from our tracking (stored in Redis)
      const workers: WorkerInfo[] = [];

      // Check each queue for active workers
      for (const name of Object.values(QUEUE_NAMES)) {
        try {
          const queue = getQueue(name as any);
          const workerCount = await queue.getWorkersCount();
          
          if (workerCount > 0) {
            workers.push({
              id: `${name}-worker`,
              queue: name,
              status: 'online',
              jobsProcessed: 0, // Would need persistent tracking
              startedAt: new Date().toISOString(),
              lastActivityAt: new Date().toISOString(),
            });
          }
        } catch {
          // Ignore errors
        }
      }

      return reply.send({ workers, redisConnected: true });
    } catch (error) {
      logger.error('api', { action: 'workers_list_error', error: String(error) });
      return reply.status(500).send({ error: 'Failed to get workers' });
    }
  });

  // ============= FLOWS =============

  /**
   * GET /api/system/flows - Flow execution stats
   */
  adminRoutes.get('/flows', async (_request, reply) => {
    try {
      // Get all flows with their execution stats
      const flows = await Flow.find({})
        .select('name status nodes triggers executionStats updatedAt')
        .lean();

      const flowStats: FlowStats[] = flows.map((flow: any) => {
        // Extract trigger types from nodes
        const triggerNodes = (flow.nodes || []).filter((n: any) => n.type === 'trigger');
        const triggers = triggerNodes.map((n: any) => n.data?.triggerType || 'unknown');

        return {
          id: flow._id.toString(),
          name: flow.name,
          status: flow.status || 'draft',
          cachedInRedis: false, // Would check Redis cache
          triggers,
          totalExecutions: flow.executionStats?.totalExecutions || 0,
          successfulExecutions: flow.executionStats?.successfulExecutions || 0,
          failedExecutions: flow.executionStats?.failedExecutions || 0,
          lastExecutedAt: flow.executionStats?.lastExecutedAt?.toISOString(),
          avgExecutionTimeMs: flow.executionStats?.avgExecutionTimeMs,
        };
      });

      return reply.send({ flows: flowStats });
    } catch (error) {
      logger.error('api', { action: 'flows_stats_error', error: String(error) });
      return reply.status(500).send({ error: 'Failed to get flow stats' });
    }
  });

  // ============= SCHEDULED MESSAGES =============

  /**
   * GET /api/system/scheduled - Scheduled messages stats
   */
  adminRoutes.get<{ Querystring: { status?: string; limit?: number } }>(
    '/scheduled',
    async (request, reply) => {
      const { status, limit = 50 } = request.query;

      try {
        const query: any = {};
        if (status) {
          query.status = status;
        }

        const messages = await ScheduledMessage.find(query)
          .sort({ scheduledAt: -1 })
          .limit(limit)
          .lean();

        const scheduled: ScheduledMessageInfo[] = messages.map((msg: any) => ({
          id: msg._id.toString(),
          sessionId: msg.sessionId,
          chatId: msg.chatId,
          type: msg.type,
          scheduledAt: msg.scheduledAt?.toISOString(),
          status: msg.status,
          attempts: msg.attempts || 0,
          createdAt: msg.createdAt?.toISOString(),
          error: msg.error,
        }));

        // Get counts by status
        const counts = await ScheduledMessage.aggregate([
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        const statusCounts: Record<string, number> = {};
        for (const c of counts) {
          statusCounts[c._id] = c.count;
        }

        return reply.send({ 
          messages: scheduled, 
          counts: statusCounts,
          total: await ScheduledMessage.countDocuments()
        });
      } catch (error) {
        logger.error('api', { action: 'scheduled_stats_error', error: String(error) });
        return reply.status(500).send({ error: 'Failed to get scheduled messages' });
      }
    }
  );

  // ============= ERRORS =============

  /**
   * GET /api/system/errors - Recent errors from queues and activity log
   */
  adminRoutes.get<{ Querystring: { queue?: string; limit?: number; hours?: number } }>(
    '/errors',
    async (request, reply) => {
      const { queue, limit = 50, hours = 24 } = request.query;

      try {
        const errors: ErrorLogEntry[] = [];
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        // Get errors from activity log
        const activityErrors = await ActivityLog.find({
          action: { $regex: /failed|error/i },
          createdAt: { $gte: since },
        })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();

        for (const err of activityErrors) {
          errors.push({
            id: (err as any)._id.toString(),
            timestamp: (err as any).createdAt?.toISOString(),
            queue: (err as any).metadata?.queue || 'unknown',
            jobId: (err as any).metadata?.jobId || '',
            jobName: (err as any).action,
            error: (err as any).description || (err as any).action,
            stack: (err as any).metadata?.stack,
            attempt: (err as any).metadata?.attempt || 0,
            resolved: false,
          });
        }

        // Get failed jobs from BullMQ queues
        if (isRedisConnected()) {
          const queueNames = queue ? [queue] : Object.values(QUEUE_NAMES);
          
          for (const qName of queueNames) {
            try {
              const q = getQueue(qName as any);
              const failedJobs = await q.getFailed(0, Math.floor(limit / queueNames.length));
              
              for (const job of failedJobs) {
                if (job.finishedOn && job.finishedOn > since.getTime()) {
                  errors.push({
                    id: job.id || '',
                    timestamp: new Date(job.finishedOn).toISOString(),
                    queue: qName,
                    jobId: job.id || '',
                    jobName: job.name,
                    error: job.failedReason || 'Unknown error',
                    stack: job.stacktrace?.[0],
                    attempt: job.attemptsMade,
                    resolved: false,
                  });
                }
              }
            } catch {
              // Ignore queue errors
            }
          }
        }

        // Sort by timestamp desc
        errors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return reply.send({ 
          errors: errors.slice(0, limit),
          total: errors.length
        });
      } catch (error) {
        logger.error('api', { action: 'errors_list_error', error: String(error) });
        return reply.status(500).send({ error: 'Failed to get errors' });
      }
    }
  );

  // ============= METRICS =============

  /**
   * GET /api/system/metrics - Time-series metrics
   */
  adminRoutes.get<{ Querystring: { hours?: number } }>('/metrics', async (request, reply) => {
    const { hours = 24 } = request.query;

    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Get Redis health metrics
      const redisHealth = getRedisHealth();

      // Get scheduled message metrics over time
      const messageMetrics = await ScheduledMessage.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' }
            },
            created: { $sum: 1 },
            sent: { $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] } },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Get flow execution metrics
      const flowMetrics = await ActivityLog.aggregate([
        {
          $match: {
            action: { $in: ['flow_executed', 'flow_error'] },
            createdAt: { $gte: since }
          }
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' }
            },
            executions: { $sum: 1 },
            errors: { $sum: { $cond: [{ $eq: ['$action', 'flow_error'] }, 1, 0] } },
          }
        },
        { $sort: { _id: 1 } }
      ]);

      return reply.send({
        redis: redisHealth,
        scheduledMessages: messageMetrics,
        flowExecutions: flowMetrics,
      });
    } catch (error) {
      logger.error('api', { action: 'metrics_error', error: String(error) });
      return reply.status(500).send({ error: 'Failed to get metrics' });
    }
  });

  }); // End of adminRoutes register
};

// ============= HELPERS =============

function formatJob(job: any): any {
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    delay: job.delay,
  };
}

async function getFailedJobsCount24h(): Promise<number> {
  if (!isRedisConnected()) return 0;

  let total = 0;
  const since = Date.now() - 24 * 60 * 60 * 1000;

  for (const name of Object.values(QUEUE_NAMES)) {
    try {
      const queue = getQueue(name as any);
      const failedJobs = await queue.getFailed(0, 1000);
      total += failedJobs.filter(j => j.finishedOn && j.finishedOn > since).length;
    } catch {
      // Ignore
    }
  }

  return total;
}

export default systemRoutes;

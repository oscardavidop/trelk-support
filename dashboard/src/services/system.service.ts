/**
 * System Monitoring Service
 * API client for system monitoring endpoints
 */

import { api } from './api';

// ============= TYPES =============

export interface SystemHealth {
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

export interface QueueInfo {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface QueueJob {
  id: string;
  name: string;
  data: Record<string, unknown>;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
  failedReason?: string;
  delay?: number;
  status: 'waiting' | 'active' | 'delayed' | 'failed' | 'completed';
}

export interface QueueDetail {
  name: string;
  stats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  paused: boolean;
  jobs: QueueJob[];
}

export interface WorkerInfo {
  id: string;
  queue: string;
  status: 'online' | 'idle' | 'offline';
  jobsProcessed: number;
  currentJob?: string;
  startedAt: string;
  lastActivityAt: string;
}

export interface FlowStats {
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

export interface ScheduledMessageInfo {
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

export interface ErrorLogEntry {
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

export interface SystemMetrics {
  redis: {
    connected: boolean;
    operationCount: number;
    cacheHits: number;
    cacheMisses: number;
    errorCount: number;
    uptime: number;
  };
  scheduledMessages: Array<{
    _id: string;
    created: number;
    sent: number;
    failed: number;
  }>;
  flowExecutions: Array<{
    _id: string;
    executions: number;
    errors: number;
  }>;
}

// ============= API CALLS =============

/**
 * Get overall system health
 */
export async function getSystemHealth(): Promise<{ ok: boolean; data?: SystemHealth; error?: string }> {
  try {
    const response = await api.get('/api/system/health');
    return { ok: true, data: response.data as SystemHealth };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Get all queues stats
 */
export async function getQueues(): Promise<{ ok: boolean; data?: { queues: QueueInfo[]; redisConnected: boolean }; error?: string }> {
  try {
    const response = await api.get('/api/system/queues');
    return { ok: true, data: response.data as { queues: QueueInfo[]; redisConnected: boolean } };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Get specific queue details with jobs
 */
export async function getQueueDetail(
  name: string, 
  options?: { status?: string; limit?: number }
): Promise<{ ok: boolean; data?: QueueDetail; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    
    const response = await api.get(`/api/system/queues/${name}?${params}`);
    return { ok: true, data: response.data as QueueDetail };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Pause a queue
 */
export async function pauseQueue(name: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.post(`/api/system/queues/${name}/pause`);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Resume a queue
 */
export async function resumeQueue(name: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.post(`/api/system/queues/${name}/resume`);
    return { ok: true };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Clean queue (completed/failed jobs)
 */
export async function cleanQueue(
  name: string, 
  type: 'completed' | 'failed' | 'all' = 'completed'
): Promise<{ ok: boolean; cleaned?: number; error?: string }> {
  try {
    const response = await api.post(`/api/system/queues/${name}/clean`, { type });
    return { ok: true, cleaned: (response.data as { cleaned: number }).cleaned };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Retry all failed jobs in a queue
 */
export async function retryFailedJobs(name: string): Promise<{ ok: boolean; retried?: number; error?: string }> {
  try {
    const response = await api.post(`/api/system/queues/${name}/retry-failed`);
    return { ok: true, retried: (response.data as { retried: number }).retried };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Get workers status
 */
export async function getWorkers(): Promise<{ ok: boolean; data?: { workers: WorkerInfo[]; redisConnected: boolean }; error?: string }> {
  try {
    const response = await api.get('/api/system/workers');
    return { ok: true, data: response.data as { workers: WorkerInfo[]; redisConnected: boolean } };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Get flow execution stats
 */
export async function getFlowStats(): Promise<{ ok: boolean; data?: { flows: FlowStats[] }; error?: string }> {
  try {
    const response = await api.get('/api/system/flows');
    return { ok: true, data: response.data as { flows: FlowStats[] } };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Get scheduled messages
 */
export async function getScheduledMessages(
  options?: { status?: string; limit?: number }
): Promise<{ 
  ok: boolean; 
  data?: { 
    messages: ScheduledMessageInfo[]; 
    counts: Record<string, number>; 
    total: number 
  }; 
  error?: string 
}> {
  try {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    
    const response = await api.get(`/api/system/scheduled?${params}`);
    return { ok: true, data: response.data as { messages: ScheduledMessageInfo[]; counts: Record<string, number>; total: number } };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Get recent errors
 */
export async function getSystemErrors(
  options?: { queue?: string; limit?: number; hours?: number }
): Promise<{ ok: boolean; data?: { errors: ErrorLogEntry[]; total: number }; error?: string }> {
  try {
    const params = new URLSearchParams();
    if (options?.queue) params.append('queue', options.queue);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.hours) params.append('hours', options.hours.toString());
    
    const response = await api.get(`/api/system/errors?${params}`);
    return { ok: true, data: response.data as { errors: ErrorLogEntry[]; total: number } };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Get system metrics
 */
export async function getSystemMetrics(hours: number = 24): Promise<{ ok: boolean; data?: SystemMetrics; error?: string }> {
  try {
    const response = await api.get(`/api/system/metrics?hours=${hours}`);
    return { ok: true, data: response.data  as SystemMetrics };
  } catch (error: any) {
    return { ok: false, error: error.response?.data?.error || error.message };
  }
}

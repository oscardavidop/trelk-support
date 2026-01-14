/**
 * Queues Tab - BullMQ Queue Monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Server, 
  Play, 
  Pause, 
  RefreshCw, 
  Trash2, 
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { getSocket } from '../../services/socket';
import {
  getQueues,
  getQueueDetail,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  retryFailedJobs,
  type QueueInfo,
  type QueueJob
} from '../../services/system.service';
import { toast } from '../../stores/toastStore';

export function QueuesTab() {
  const [queues, setQueues] = useState<QueueInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [redisConnected, setRedisConnected] = useState(true);
  const [expandedQueue, setExpandedQueue] = useState<string | null>(null);
  const [queueJobs, setQueueJobs] = useState<QueueJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadQueues = useCallback(async () => {
    const result = await getQueues();
    if (result.ok && result.data) {
      setQueues(result.data.queues);
      setRedisConnected(result.data.redisConnected);
    }
    setLoading(false);
  }, []);

  const loadQueueJobs = useCallback(async (queueName: string) => {
    setJobsLoading(true);
    const result = await getQueueDetail(queueName, { limit: 30 });
    if (result.ok && result.data) {
      setQueueJobs(result.data.jobs || []);
    } else {
      setQueueJobs([]);
    }
    setJobsLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(loadQueues, 5000);
    return () => clearInterval(interval);
  }, [loadQueues]);

  // Socket events for real-time updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleQueueUpdate = (data: QueueInfo) => {
      setQueues(prev => prev.map(q => 
        q.name === data.name ? { ...q, ...data } : q
      ));
    };

    socket.on('system:queue:update', handleQueueUpdate);
    
    return () => {
      socket.off('system:queue:update', handleQueueUpdate);
    };
  }, []);

  // Load jobs when queue is expanded
  useEffect(() => {
    if (expandedQueue) {
      loadQueueJobs(expandedQueue);
    }
  }, [expandedQueue, loadQueueJobs]);

  const handlePause = async (queueName: string) => {
    setActionLoading(`pause-${queueName}`);
    const result = await pauseQueue(queueName);
    if (result.ok) {
      toast.success('Queue Paused', `${queueName} has been paused`);
      loadQueues();
    } else {
      toast.error('Error', result.error || 'Failed to pause queue');
    }
    setActionLoading(null);
  };

  const handleResume = async (queueName: string) => {
    setActionLoading(`resume-${queueName}`);
    const result = await resumeQueue(queueName);
    if (result.ok) {
      toast.success('Queue Resumed', `${queueName} has been resumed`);
      loadQueues();
    } else {
      toast.error('Error', result.error || 'Failed to resume queue');
    }
    setActionLoading(null);
  };

  const handleClean = async (queueName: string, type: 'completed' | 'failed' | 'all') => {
    setActionLoading(`clean-${queueName}`);
    const result = await cleanQueue(queueName, type);
    if (result.ok) {
      toast.success('Queue Cleaned', `Removed ${result.cleaned} jobs from ${queueName}`);
      loadQueues();
      if (expandedQueue === queueName) {
        loadQueueJobs(queueName);
      }
    } else {
      toast.error('Error', result.error || 'Failed to clean queue');
    }
    setActionLoading(null);
  };

  const handleRetryFailed = async (queueName: string) => {
    setActionLoading(`retry-${queueName}`);
    const result = await retryFailedJobs(queueName);
    if (result.ok) {
      toast.success('Jobs Retried', `Retried ${result.retried} failed jobs in ${queueName}`);
      loadQueues();
      if (expandedQueue === queueName) {
        loadQueueJobs(queueName);
      }
    } else {
      toast.error('Error', result.error || 'Failed to retry jobs');
    }
    setActionLoading(null);
  };

  if (!redisConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-4 text-yellow-500" />
        <p className="text-lg font-medium">Redis Not Connected</p>
        <p className="text-sm">Queue monitoring requires Redis connection</p>
      </div>
    );
  }

  if (loading && queues.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">BullMQ Queues</h2>
        <button
          onClick={loadQueues}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Queue Table */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3">Queue</th>
              <th className="px-4 py-3 text-center">Waiting</th>
              <th className="px-4 py-3 text-center">Active</th>
              <th className="px-4 py-3 text-center">Delayed</th>
              <th className="px-4 py-3 text-center">Failed</th>
              <th className="px-4 py-3 text-center">Completed</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {queues.map((queue) => (
              <QueueRow
                key={queue.name}
                queue={queue}
                expanded={expandedQueue === queue.name}
                jobs={expandedQueue === queue.name ? queueJobs : []}
                jobsLoading={jobsLoading && expandedQueue === queue.name}
                actionLoading={actionLoading}
                onToggle={() => setExpandedQueue(expandedQueue === queue.name ? null : queue.name)}
                onPause={() => handlePause(queue.name)}
                onResume={() => handleResume(queue.name)}
                onClean={(type) => handleClean(queue.name, type)}
                onRetryFailed={() => handleRetryFailed(queue.name)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Waiting</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span>Delayed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Failed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Completed</span>
        </div>
      </div>
    </div>
  );
}

// ============= QUEUE ROW COMPONENT =============

interface QueueRowProps {
  queue: QueueInfo;
  expanded: boolean;
  jobs: QueueJob[];
  jobsLoading: boolean;
  actionLoading: string | null;
  onToggle: () => void;
  onPause: () => void;
  onResume: () => void;
  onClean: (type: 'completed' | 'failed' | 'all') => void;
  onRetryFailed: () => void;
}

function QueueRow({ 
  queue, 
  expanded, 
  jobs, 
  jobsLoading,
  actionLoading,
  onToggle, 
  onPause, 
  onResume, 
  onClean,
  onRetryFailed
}: QueueRowProps) {
  const [showCleanMenu, setShowCleanMenu] = useState(false);

  return (
    <>
      <tr className="hover:bg-gray-800/50 transition-colors">
        {/* Expand Toggle */}
        <td className="px-4 py-3">
          <button onClick={onToggle} className="text-gray-400 hover:text-white">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        
        {/* Queue Name */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-white">{queue.name}</span>
          </div>
        </td>
        
        {/* Stats */}
        <td className="px-4 py-3 text-center">
          <StatBadge value={queue.waiting} color="yellow" />
        </td>
        <td className="px-4 py-3 text-center">
          <StatBadge value={queue.active} color="blue" />
        </td>
        <td className="px-4 py-3 text-center">
          <StatBadge value={queue.delayed} color="purple" />
        </td>
        <td className="px-4 py-3 text-center">
          <StatBadge value={queue.failed} color="red" />
        </td>
        <td className="px-4 py-3 text-center">
          <StatBadge value={queue.completed} color="green" />
        </td>
        
        {/* Status */}
        <td className="px-4 py-3 text-center">
          {queue.paused ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs">
              <Pause className="w-3 h-3" />
              Paused
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">
              <Play className="w-3 h-3" />
              Running
            </span>
          )}
        </td>
        
        {/* Actions */}
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {/* Pause/Resume */}
            {queue.paused ? (
              <button
                onClick={onResume}
                disabled={actionLoading === `resume-${queue.name}`}
                className="p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors disabled:opacity-50"
                title="Resume queue"
              >
                {actionLoading === `resume-${queue.name}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </button>
            ) : (
              <button
                onClick={onPause}
                disabled={actionLoading === `pause-${queue.name}`}
                className="p-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg transition-colors disabled:opacity-50"
                title="Pause queue"
              >
                {actionLoading === `pause-${queue.name}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Pause className="w-4 h-4" />
                )}
              </button>
            )}
            
            {/* Retry Failed */}
            {queue.failed > 0 && (
              <button
                onClick={onRetryFailed}
                disabled={actionLoading === `retry-${queue.name}`}
                className="p-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-colors disabled:opacity-50"
                title="Retry all failed jobs"
              >
                {actionLoading === `retry-${queue.name}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
              </button>
            )}
            
            {/* Clean */}
            <div className="relative">
              <button
                onClick={() => setShowCleanMenu(!showCleanMenu)}
                disabled={!!actionLoading?.startsWith('clean-')}
                className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                title="Clean jobs"
              >
                {actionLoading === `clean-${queue.name}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
              
              {showCleanMenu && (
                <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1 min-w-[140px]">
                  <button
                    onClick={() => { onClean('completed'); setShowCleanMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                  >
                    Clean Completed
                  </button>
                  <button
                    onClick={() => { onClean('failed'); setShowCleanMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700"
                  >
                    Clean Failed
                  </button>
                  <button
                    onClick={() => { onClean('all'); setShowCleanMenu(false); }}
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-gray-700"
                  >
                    Clean All
                  </button>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
      
      {/* Expanded Jobs List */}
      {expanded && (
        <tr>
          <td colSpan={9} className="px-4 py-0 bg-gray-950">
            <div className="py-4">
              {jobsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : !jobs || jobs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No jobs in queue
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-auto">
                  {jobs.map((job) => (
                    <JobCard key={job.id} job={job} />
                  ))}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ============= HELPER COMPONENTS =============

function StatBadge({ value, color }: { value: number; color: string }) {
  const colors: Record<string, string> = {
    yellow: 'bg-yellow-500/10 text-yellow-400',
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    red: 'bg-red-500/10 text-red-400',
    green: 'bg-green-500/10 text-green-400',
  };
  
  if (value === 0) {
    return <span className="text-gray-600">0</span>;
  }
  
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-sm font-medium ${colors[color]}`}>
      {value.toLocaleString()}
    </span>
  );
}

function JobCard({ job }: { job: QueueJob }) {
  const getStatusIcon = () => {
    switch (job.status) {
      case 'waiting':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'active':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'delayed':
        return <Clock className="w-4 h-4 text-purple-400" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      default:
        return null;
    }
  };
  
  const getStatusBg = () => {
    switch (job.status) {
      case 'waiting': return 'border-yellow-500/20';
      case 'active': return 'border-blue-500/20';
      case 'delayed': return 'border-purple-500/20';
      case 'failed': return 'border-red-500/20';
      case 'completed': return 'border-green-500/20';
      default: return 'border-gray-700';
    }
  };

  return (
    <div className={`bg-gray-900/50 border ${getStatusBg()} rounded-lg p-3`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <div>
            <span className="font-medium text-white text-sm">{job.name}</span>
            <span className="text-gray-500 text-xs ml-2">#{job.id}</span>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {job.timestamp && new Date(job.timestamp).toLocaleTimeString()}
        </div>
      </div>
      
      {job.failedReason && (
        <div className="mt-2 p-2 bg-red-500/10 rounded text-xs text-red-400 font-mono">
          {job.failedReason}
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-500">
        Attempts: {job.attemptsMade}
        {job.delay && <span className="ml-3">Delay: {job.delay}ms</span>}
      </div>
    </div>
  );
}

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
  RotateCcw,
  MoreVertical
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header & Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-500" />
            Colas de Procesamiento
          </h2>
          <p className="text-sm text-zinc-400">Estado en tiempo real de BullMQ</p>
        </div>
        <button
          onClick={loadQueues}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Queues List */}
      <div className="space-y-4">
        {queues.map((queue) => (
          <QueueCard
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

function QueueCard({ queue, expanded, jobs, jobsLoading, actionLoading, onToggle, onPause, onResume, onClean, onRetryFailed }: QueueRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const totalJobs = queue.waiting + queue.active + queue.delayed + queue.failed + queue.completed;

  // Calculate percentages for progress bar
  const getPercent = (val: number) => totalJobs > 0 ? (val / totalJobs) * 100 : 0;

  return (
    <div className={`bg-zinc-900/50 border transition-all duration-300 overflow-hidden rounded-xl ${expanded ? 'border-purple-500/30 bg-zinc-900/80' : 'border-zinc-800 hover:border-zinc-700'}`}>

      {/* Card Header (Always Visible) */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <button onClick={onToggle} className="p-1.5 rounded-lg bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 transition-colors">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-zinc-100 text-lg">{queue.name}</h3>
                {queue.paused ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                    <Pause className="w-3 h-3" /> Paused
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
                    <Play className="w-3 h-3" /> Running
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-1">Total Jobs: {totalJobs.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Actions */}
            {queue.paused ? (
              <IconButton onClick={onResume} loading={actionLoading === `resume-${queue.name}`} icon={Play} color="text-emerald-400" bg="hover:bg-emerald-500/10" tooltip="Resume" />
            ) : (
              <IconButton onClick={onPause} loading={actionLoading === `pause-${queue.name}`} icon={Pause} color="text-amber-400" bg="hover:bg-amber-500/10" tooltip="Pause" />
            )}

            {queue.failed > 0 && (
              <IconButton onClick={onRetryFailed} loading={actionLoading === `retry-${queue.name}`} icon={RotateCcw} color="text-blue-400" bg="hover:bg-blue-500/10" tooltip="Retry Failed" />
            )}

            <div className="relative">
              <IconButton onClick={() => setShowMenu(!showMenu)} icon={MoreVertical} color="text-zinc-400" bg="hover:bg-zinc-800" />
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 py-1 min-w-[160px] animate-in fade-in zoom-in-95">
                    <MenuItem onClick={() => { onClean('completed'); setShowMenu(false); }} label="Clean Completed" />
                    <MenuItem onClick={() => { onClean('failed'); setShowMenu(false); }} label="Clean Failed" />
                    <div className="h-px bg-zinc-800 my-1" />
                    <MenuItem onClick={() => { onClean('all'); setShowMenu(false); }} label="Clean All" danger />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          <StatBox label="Waiting" value={queue.waiting} color="bg-yellow-500" textColor="text-yellow-400" />
          <StatBox label="Active" value={queue.active} color="bg-blue-500" textColor="text-blue-400" />
          <StatBox label="Delayed" value={queue.delayed} color="bg-purple-500" textColor="text-purple-400" />
          <StatBox label="Failed" value={queue.failed} color="bg-red-500" textColor="text-red-400" />
          <StatBox label="Completed" value={queue.completed} color="bg-emerald-500" textColor="text-emerald-400" />
        </div>

        {/* Multi-color Progress Bar */}
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
          <div className="h-full bg-yellow-500 transition-all duration-500" style={{ width: `${getPercent(queue.waiting)}%` }} />
          <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${getPercent(queue.active)}%` }} />
          <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${getPercent(queue.delayed)}%` }} />
          <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${getPercent(queue.failed)}%` }} />
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${getPercent(queue.completed)}%` }} />
        </div>
      </div>

      {/* Expanded Jobs List */}
      {expanded && (
        <div className="border-t border-zinc-800 bg-black/20">
          <div className="p-4">
            {jobsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              </div>
            ) : !jobs || jobs.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">No jobs in queue</div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {jobs.map((job: any) => <JobCard key={job.id} job={job} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// ============= HELPER COMPONENTS =============

const IconButton = ({ onClick, loading, icon: Icon, color, bg, tooltip }: any) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    disabled={loading}
    className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${color} ${bg}`}
    title={tooltip}
  >
    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
  </button>
);

const MenuItem = ({ onClick, label, danger }: any) => (
  <button
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-800 transition-colors ${danger ? 'text-red-400 hover:text-red-300' : 'text-zinc-300 hover:text-white'}`}
  >
    {label}
  </button>
);

const StatBox = ({ label, value, color, textColor }: any) => (
  <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-950/50 border border-zinc-800">
    <span className={`text-lg font-bold ${textColor}`}>{value.toLocaleString()}</span>
    <div className="flex items-center gap-1.5 mt-1">
      <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
      <span className="text-[10px] uppercase font-bold text-zinc-500">{label}</span>
    </div>
  </div>
);

function JobCard({ job }: { job: QueueJob }) {
  const statusConfig = {
    waiting: { icon: Clock, color: 'text-yellow-400' },
    active: { icon: Loader2, color: 'text-blue-400', spin: true },
    delayed: { icon: Clock, color: 'text-purple-400' },
    failed: { icon: AlertTriangle, color: 'text-red-400' },
    completed: { icon: CheckCircle, color: 'text-emerald-400' },
  }[job.status] || { icon: Server, color: 'text-zinc-400' };

  const Icon = statusConfig.icon;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <Icon className={`w-4 h-4 ${statusConfig.color} ${statusConfig.spin ? 'animate-spin' : ''}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-200 text-sm">{job.name}</span>
              <span className="text-zinc-500 text-xs font-mono bg-zinc-950 px-1.5 rounded">#{job.id}</span>
            </div>
          </div>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">
          {job.timestamp ? new Date(job.timestamp).toLocaleTimeString() : '-'}
        </span>
      </div>

      {job.failedReason && (
        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-300 font-mono break-all">
          {job.failedReason}
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
        <span>Intentos: <span className="text-zinc-300">{job.attemptsMade}</span></span>
        {job && job.delay !== undefined && job.delay > 0 && <span>Delay: <span className="text-zinc-300">{job.delay}ms</span></span>}
      </div>
    </div>
  );
}
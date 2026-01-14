/**
 * Workers Tab - Worker Status Monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Cpu, 
  RefreshCw, 
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Server,
  Activity
} from 'lucide-react';
import { getSocket } from '../../services/socket';
import { getWorkers, type WorkerInfo } from '../../services/system.service';

export function WorkersTab() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [redisConnected, setRedisConnected] = useState(true);

  const loadWorkers = useCallback(async () => {
    const result = await getWorkers();
    if (result.ok && result.data) {
      setWorkers(result.data.workers);
      setRedisConnected(result.data.redisConnected);
    }
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadWorkers();
  }, [loadWorkers]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(loadWorkers, 5000);
    return () => clearInterval(interval);
  }, [loadWorkers]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleWorkerOnline = (data: { workerId: string; queue: string }) => {
      setWorkers(prev => {
        const existing = prev.find(w => w.id === data.workerId);
        if (existing) {
          return prev.map(w => w.id === data.workerId ? { ...w, status: 'online' as const } : w);
        }
        return [...prev, {
          id: data.workerId,
          queue: data.queue,
          status: 'online' as const,
          jobsProcessed: 0,
          startedAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
        }];
      });
    };

    const handleWorkerOffline = (data: { workerId: string }) => {
      setWorkers(prev => prev.map(w => 
        w.id === data.workerId ? { ...w, status: 'offline' as const } : w
      ));
    };

    socket.on('system:worker:online', handleWorkerOnline);
    socket.on('system:worker:offline', handleWorkerOffline);
    
    return () => {
      socket.off('system:worker:online', handleWorkerOnline);
      socket.off('system:worker:offline', handleWorkerOffline);
    };
  }, []);

  if (!redisConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-4 text-yellow-500" />
        <p className="text-lg font-medium">Redis Not Connected</p>
        <p className="text-sm">Worker monitoring requires Redis connection</p>
      </div>
    );
  }

  if (loading && workers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const onlineWorkers = workers.filter(w => w.status === 'online');
  const idleWorkers = workers.filter(w => w.status === 'idle');
  const offlineWorkers = workers.filter(w => w.status === 'offline');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Workers</h2>
        <button
          onClick={loadWorkers}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <WorkerStatsCard
          title="Online"
          count={onlineWorkers.length}
          icon={CheckCircle}
          color="green"
        />
        <WorkerStatsCard
          title="Idle"
          count={idleWorkers.length}
          icon={Clock}
          color="yellow"
        />
        <WorkerStatsCard
          title="Offline"
          count={offlineWorkers.length}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Workers Grid */}
      {workers.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-900/50 rounded-xl border border-gray-800">
          <Cpu className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No Workers Found</p>
          <p className="text-sm mt-1">Workers are registered when queues start processing</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Activity className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-400">About Workers</h4>
            <p className="text-sm text-blue-300/70 mt-1">
              Workers process jobs from BullMQ queues. Each queue can have multiple workers 
              for parallel processing. Workers are automatically registered when they start 
              processing and are shown here based on queue activity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= COMPONENTS =============

interface WorkerStatsCardProps {
  title: string;
  count: number;
  icon: typeof CheckCircle;
  color: 'green' | 'yellow' | 'red';
}

function WorkerStatsCard({ title, count, icon: Icon, color }: WorkerStatsCardProps) {
  const colors = {
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-3xl font-bold">{count}</div>
      <div className="text-sm opacity-80">{title}</div>
    </div>
  );
}

interface WorkerCardProps {
  worker: WorkerInfo;
}

function WorkerCard({ worker }: WorkerCardProps) {
  const getStatusColor = () => {
    switch (worker.status) {
      case 'online': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
    }
  };

  const getStatusText = () => {
    switch (worker.status) {
      case 'online': return 'Online';
      case 'idle': return 'Idle';
      case 'offline': return 'Offline';
    }
  };

  const getUptime = () => {
    const start = new Date(worker.startedAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return (
    <div className={`bg-gray-900/50 border rounded-xl p-5 ${
      worker.status === 'offline' ? 'border-red-500/30' : 'border-gray-800'
    }`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-800 rounded-lg">
            <Server className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">{worker.id}</h3>
            <p className="text-xs text-gray-500">{worker.queue}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStatusColor()}`}></div>
          <span className="text-xs text-gray-400">{getStatusText()}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Jobs Processed</span>
          <div className="font-medium text-white">{worker.jobsProcessed.toLocaleString()}</div>
        </div>
        <div>
          <span className="text-gray-500">Uptime</span>
          <div className="font-medium text-white">{getUptime()}</div>
        </div>
      </div>
      
      {worker.currentJob && (
        <div className="mt-4 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <span className="text-xs text-blue-400">Currently processing:</span>
          <div className="text-sm text-white font-mono truncate">{worker.currentJob}</div>
        </div>
      )}
      
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Last activity</span>
          <span>{new Date(worker.lastActivityAt).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Workers Tab - Worker Status Monitoring
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Cpu,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Server,
  Activity,
  Search,
  Zap,
  Box
} from 'lucide-react';
import { getSocket } from '../../services/socket';
import { getWorkers, type WorkerInfo } from '../../services/system.service';

export function WorkersTab() {
  const [workers, setWorkers] = useState<WorkerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [redisConnected, setRedisConnected] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Computed Stats
  const stats = useMemo(() => ({
    total: workers.length,
    online: workers.filter(w => w.status === 'online').length,
    idle: workers.filter(w => w.status === 'idle').length,
    offline: workers.filter(w => w.status === 'offline').length,
    processing: workers.filter(w => w.currentJob).length
  }), [workers]);

  // Filtered Workers
  const filteredWorkers = workers.filter(w =>
    w.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.queue.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!redisConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-4">
        <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-bold text-zinc-50">Redis Desconectado</h3>
          <p className="text-sm">El monitoreo de workers requiere conexión a Redis</p>
        </div>
      </div>
    );
  }

  if (loading && workers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-50 flex items-center gap-2">
            <Cpu className="w-5 h-5 text-blue-500" />
            Workers Activos
          </h2>
          <p className="text-sm text-zinc-400">Nodos de procesamiento en segundo plano</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por ID o Cola..."
              className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-50 focus:outline-none focus:border-blue-500 w-64 transition-all"
            />
          </div>
          <button
            onClick={loadWorkers}
            className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl overflow-x-auto w-full">
        <StatBadge icon={Server} count={stats.total} label="Total Workers" color="text-zinc-200" bg="bg-zinc-800" />
        <div className="h-6 w-px bg-white/10" />
        <StatBadge icon={Zap} count={stats.processing} label="Procesando" color="text-blue-400" bg="bg-blue-500/10" />
        <div className="h-6 w-px bg-white/10" />
        <StatBadge icon={CheckCircle} count={stats.online} label="Online" color="text-emerald-400" bg="bg-emerald-500/10" />
        <div className="h-6 w-px bg-white/10" />
        <StatBadge icon={Clock} count={stats.idle} label="En Espera" color="text-amber-400" bg="bg-amber-500/10" />
        {stats.offline > 0 && (
          <>
            <div className="h-6 w-px bg-white/10" />
            <StatBadge icon={XCircle} count={stats.offline} label="Offline" color="text-red-400" bg="bg-red-500/10" />
          </>
        )}
      </div>

      {/* Workers Grid */}
      {loading && workers.length === 0 ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : filteredWorkers.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
          <Server className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No se encontraron workers</p>
          <p className="text-sm">Los workers se registrarán automáticamente al iniciar procesos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkers.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============= COMPONENTS =============

function StatBadge({ icon: Icon, count, label, color, bg }: {
  icon: typeof CheckCircle;
  count: number;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 rounded-xl transition-all min-w-fit">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col items-start leading-none">
        <span className={`font-bold text-lg ${color}`}>{count}</span>
        <span className="text-[10px] font-bold text-zinc-500">{label}</span>
      </div>
    </div>
  );
}

function WorkerCard({ worker }: { worker: WorkerInfo }) {
  const isProcessing = !!worker.currentJob;
  const isOffline = worker.status === 'offline';

  const statusConfig = {
    online: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    idle: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    offline: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  }[worker.status] || { color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' };

  const getUptime = () => {
    const start = new Date(worker.startedAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className={`relative bg-zinc-900/40 border rounded-xl p-5 transition-all hover:bg-zinc-900/60 ${isProcessing ? 'border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' : 'border-zinc-800 hover:border-zinc-700'}`}>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-zinc-950 border border-zinc-800 ${isProcessing ? 'animate-pulse' : ''}`}>
            <Server className={`w-5 h-5 ${isProcessing ? 'text-blue-400' : 'text-zinc-500'}`} />
          </div>
          <div>
            <h3 className="font-mono text-sm text-zinc-200 font-medium truncate w-32" title={worker.id}>
              {worker.id.split(':')[0]}...
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-zinc-500">Cola:</span>
              <span className="text-xs text-zinc-300 font-medium bg-zinc-800 px-1.5 rounded">{worker.queue}</span>
            </div>
          </div>
        </div>

        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercaseborder ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${worker.status === 'online' ? 'bg-current animate-pulse' : 'bg-current'}`} />
          {worker.status}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-px bg-zinc-800/50 rounded-lg overflow-hidden border border-zinc-800/50 mb-4">
        <div className="bg-zinc-900/40 p-2.5 text-center">
          <div className="text-[10px] text-zinc-500 font-bold">Procesados</div>
          <div className="text-sm font-mono text-zinc-200">{worker.jobsProcessed.toLocaleString()}</div>
        </div>
        <div className="bg-zinc-900/40 p-2.5 text-center">
          <div className="text-[10px] text-zinc-500 font-bold">Uptime</div>
          <div className="text-sm font-mono text-zinc-200">{getUptime()}</div>
        </div>
      </div>

      {/* Current Activity Status */}
      {worker.currentJob ? (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-3 h-3 text-blue-400 animate-bounce" />
            <span className="text-[10px] font-bold text-blue-400 ">Procesando Job</span>
          </div>
          <div className="font-mono text-xs text-blue-200 truncate" title={worker.currentJob}>
            {worker.currentJob}
          </div>
        </div>
      ) : (
        <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3 flex items-center gap-2 text-zinc-500">
          <Box className="w-4 h-4" />
          <span className="text-xs italic">Esperando trabajos...</span>
        </div>
      )}

      {/* Footer Timestamp */}
      <div className="mt-3 flex justify-end">
        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Actividad: {new Date(worker.lastActivityAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
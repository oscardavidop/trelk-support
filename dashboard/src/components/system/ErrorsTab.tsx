/**
 * Errors Tab - Error Monitoring and Log View
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Clock,
  Server,
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar,
  XCircle,
  RotateCcw,
  Copy,
  CheckCircle,
  Bug,
  Terminal
} from 'lucide-react';
import { getSocket } from '../../services/socket';
import { getSystemErrors, type ErrorLogEntry } from '../../services/system.service';

export function ErrorsTab() {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState<string>('');
  const [hoursFilter, setHoursFilter] = useState<number>(24);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const loadErrors = useCallback(async () => {
    const result = await getSystemErrors({
      queue: queueFilter || undefined,
      hours: hoursFilter,
      limit: 100
    });
    if (result.ok && result.data) {
      setErrors(result.data.errors);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [queueFilter, hoursFilter]);

  // Initial load
  useEffect(() => {
    loadErrors();
  }, [loadErrors]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadErrors, 30000);
    return () => clearInterval(interval);
  }, [loadErrors]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewError = (data: { queue: string; jobId: string; error: string; attempt: number }) => {
      setErrors(prev => [{
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        queue: data.queue,
        jobId: data.jobId,
        jobName: 'unknown',
        error: data.error,
        attempt: data.attempt,
        resolved: false,
      }, ...prev.slice(0, 99)]);
    };

    socket.on('system:job:failed', handleNewError);

    return () => {
      socket.off('system:job:failed', handleNewError);
    };
  }, []);

  const stats = useMemo(() => ({
    total: total,
    uniqueJobs: new Set(errors.map(e => e.jobId)).size,
    queuesAffected: new Set(errors.map(e => e.queue)).size,
    avgRetries: errors.length > 0 ? (errors.reduce((sum, e) => sum + e.attempt, 0) / errors.length).toFixed(1) : '0'
  }), [errors, total]);

  // Get unique queues for filter
  const uniqueQueues = [...new Set(errors.map(e => e.queue))];

  if (loading && errors.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

      {/* Red Ambient Glow */}
      <div className="absolute -top-20 -right-20 w-[500px] h-[500px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-50 flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-500" />
            Registro de Errores
          </h2>
          <p className="text-sm text-zinc-400">Monitorización de fallos y reintentos en el sistema</p>
        </div>
        <button
          onClick={loadErrors}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refrescar
        </button>
      </div>

      {/* Stats Strip */}
      <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl overflow-x-auto w-full">
        <StatBadge icon={AlertTriangle} count={stats.total} label="Total Errores" color="text-red-400" bg="bg-red-500/10" />
        <div className="h-6 w-px bg-white/10" />
        <StatBadge icon={Server} count={stats.queuesAffected} label="Colas Afectadas" color="text-orange-400" bg="bg-orange-500/10" />
        <div className="h-6 w-px bg-white/10" />
        <StatBadge icon={RotateCcw} count={stats.avgRetries} label="Prom. Intentos" color="text-zinc-200" bg="bg-zinc-800" />
        <div className="h-6 w-px bg-white/10" />
        <StatBadge icon={Filter} count={stats.uniqueJobs} label="Jobs Únicos" color="text-zinc-400" bg="bg-zinc-800/50" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 p-1">
        <div className="relative group">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <select
            value={queueFilter}
            onChange={(e) => setQueueFilter(e.target.value)}
            className="pl-9 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-red-500 cursor-pointer appearance-none min-w-[160px]"
          >
            <option value="">Todas las colas</option>
            {uniqueQueues.map(q => <option key={q} value={q}>{q}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>

        <div className="relative group">
          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <select
            value={hoursFilter}
            onChange={(e) => setHoursFilter(Number(e.target.value))}
            className="pl-9 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-red-500 cursor-pointer appearance-none"
          >
            <option value={1}>Última hora</option>
            <option value={6}>Últimas 6 horas</option>
            <option value={24}>Últimas 24 horas</option>
            <option value={72}>Últimos 3 días</option>
            <option value={168}>Última semana</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>

        <div className="ml-auto text-xs text-zinc-500">
          Mostrando {errors.length} eventos
        </div>
      </div>

      {/* Errors List */}
      <div className="space-y-3">
        {loading && errors.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-8 h-8 text-red-500 animate-spin" />
          </div>
        ) : errors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
            <CheckCircle className="w-16 h-16 mb-4 stroke-1 text-emerald-500" />
            <p className="text-lg font-medium">Todo funciona correctamente</p>
            <p className="text-sm">No se han registrado errores en el periodo seleccionado</p>
          </div>
        ) : (
          errors.map((error) => (
            <ErrorCard
              key={error.id}
              error={error}
              expanded={expandedError === error.id}
              onToggle={() => setExpandedError(expandedError === error.id ? null : error.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============= COMPONENTS =============

function StatBadge({ icon: Icon, count, label, color, bg }: { icon: typeof AlertTriangle; count: number | string; label: string; color: string; bg: string }) {
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

function ErrorCard({ error, expanded, onToggle }: { error: ErrorLogEntry; expanded: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTimeAgo = (timestamp: string) => {
    const diff = new Date().getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 24) return `${Math.floor(hours / 24)}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  return (
    <div className={`group relative bg-zinc-900/40 backdrop-blur-sm border rounded-xl transition-all duration-300 overflow-hidden ${expanded ? 'border-red-500/30 bg-zinc-900/80 shadow-lg' : 'border-zinc-800 hover:border-zinc-700'}`}>

      {/* Header Clickable */}
      <button onClick={onToggle} className="w-full text-left p-4 flex items-start gap-4">
        <div className={`p-2 rounded-lg mt-0.5 transition-colors ${expanded ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-500 group-hover:text-red-400'}`}>
          <AlertTriangle className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-zinc-200 truncate pr-4 text-sm font-mono">{error.error}</h3>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-zinc-500">{getTimeAgo(error.timestamp)}</span>
              {expanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-800">
              <Server className="w-3 h-3" /> {error.queue}
            </span>
            <span className="flex items-center gap-1.5">
              <RotateCcw className="w-3 h-3" /> Intento: {error.attempt}
            </span>
          </div>
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 space-y-4 border-t border-zinc-800/50 animate-in slide-in-from-top-2">

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <InfoBox label="Job ID" value={error.jobId} />
            <InfoBox label="Job Name" value={error.jobName} />
            <InfoBox label="Timestamp" value={new Date(error.timestamp).toLocaleTimeString()} />
            <InfoBox label="Estado" value={error.resolved ? 'Resuelto' : 'Fallido'} color={error.resolved ? 'text-green-400' : 'text-red-400'} />
          </div>

          {/* Stack Trace / Error Details */}
          <div className="relative group/code">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-zinc-500 st flex items-center gap-1">
                <Terminal className="w-3 h-3" /> Stack Trace
              </span>
              <button
                onClick={() => copyToClipboard(error.stack || error.error)}
                className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-50 transition-colors"
              >
                {copied ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <div className="bg-black/50 border border-zinc-800 rounded-lg p-3 overflow-x-auto max-h-64 custom-scrollbar">
              <code className="text-xs font-mono text-red-300 leading-relaxed whitespace-pre-wrap">
                {error.stack || error.error}
              </code>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

const InfoBox = ({ label, value, color = 'text-zinc-300' }: { label: string; value: string | number; color?: string }) => (
  <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-2">
    <span className="text-[10px] text-zinc-500 font-bold block mb-0.5">{label}</span>
    <span className={`text-xs font-mono truncate block ${color}`}>{value}</span>
  </div>
);
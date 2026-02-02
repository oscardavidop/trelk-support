/**
 * Flows Tab - Flow Execution Monitoring
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Workflow,
  RefreshCw,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Zap,
  ChevronDown,
  ChevronRight,
  BarChart3,
  PauseCircle,
  Activity,
  Search,
  XCircle
} from 'lucide-react';
import { getSocket } from '../../services/socket';
import { getFlowStats, type FlowStats } from '../../services/system.service';

export function FlowsTab() {
  const [flows, setFlows] = useState<FlowStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'disabled'>('all');

  const loadFlows = useCallback(async () => {
    const result = await getFlowStats();
    if (result.ok && result.data) {
      setFlows(result.data.flows);
    }
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadFlows, 10000);
    return () => clearInterval(interval);
  }, [loadFlows]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleFlowUpdate = () => {
      loadFlows();
    };

    socket.on('flow:updated', handleFlowUpdate);

    return () => {
      socket.off('flow:updated', handleFlowUpdate);
    };
  }, [loadFlows]);


  const stats = useMemo(() => {
    const totalExecutions = flows.reduce((sum, f) => sum + f.totalExecutions, 0);
    const totalErrors = flows.reduce((sum, f) => sum + f.failedExecutions, 0);
    const successRate = totalExecutions > 0 ? Math.round(((totalExecutions - totalErrors) / totalExecutions) * 100) : 100;

    return {
      active: flows.filter(f => f.status === 'active').length,
      totalExecutions,
      totalErrors,
      successRate
    };
  }, [flows]);

  // Filtered Flows
  const filteredFlows = flows.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = statusFilter === 'all' || f.status === statusFilter;
    return matchesSearch && matchesFilter;
  });

  if (loading && flows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  // Calculate totals
  const totalExecutions = flows.reduce((sum, f) => sum + f.totalExecutions, 0);
  const totalErrors = flows.reduce((sum, f) => sum + f.failedExecutions, 0);
  const successRate = totalExecutions > 0
    ? Math.round(((totalExecutions - totalErrors) / totalExecutions) * 100)
    : 100;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Workflow className="w-5 h-5 text-cyan-500" />
            Monitoreo de Flujos
          </h2>
          <p className="text-sm text-zinc-400">Rendimiento y estado de ejecución en tiempo real</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-cyan-500 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar flujo..."
              className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500 w-full md:w-64 transition-all"
            />
          </div>
          <button
            onClick={loadFlows}
            className="p-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl overflow-x-auto w-full">
        <StatBadge icon={Activity} count={stats.active} label="Flujos Activos" color="text-zinc-200" bg="bg-zinc-800" />
        <div className="h-6 w-px bg-white/10" />
        <StatBadge icon={Play} count={stats.totalExecutions.toLocaleString()} label="Ejecuciones" color="text-cyan-400" bg="bg-cyan-500/10" />
        <div className="h-6 w-px bg-white/10" />
        <StatBadge icon={CheckCircle} count={`${stats.successRate}%`} label="Tasa de Éxito" color="text-emerald-400" bg="bg-emerald-500/10" />
        {stats.totalErrors > 0 && (
          <>
            <div className="h-6 w-px bg-white/10" />
            <StatBadge icon={XCircle} count={stats.totalErrors.toLocaleString()} label="Errores" color="text-red-400" bg="bg-red-500/10" />
          </>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 pb-2 overflow-x-auto">
        {(['all', 'active', 'draft', 'disabled'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${statusFilter === status
              ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              : 'bg-zinc-900/50 text-zinc-400 border border-transparent hover:bg-zinc-800'
              }`}
          >
            {status === 'all' ? 'Todos' : status}
          </button>
        ))}
      </div>

      {/* Flows Grid */}
      {filteredFlows.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
          <Workflow className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No se encontraron flujos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredFlows.map((flow) => (
            <FlowMonitorCard
              key={flow.id}
              flow={flow}
              expanded={expandedFlow === flow.id}
              onToggle={() => setExpandedFlow(expandedFlow === flow.id ? null : flow.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============= COMPONENTS =============

function StatBadge({ icon: Icon, count, label, color, bg }: { icon: typeof Play; count: string | number; label: string; color: string; bg: string }) {
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

function FlowMonitorCard({ flow, expanded, onToggle }: { flow: FlowStats; expanded: boolean; onToggle: () => void }) {
  const successRate = flow.totalExecutions > 0 ? Math.round((flow.successfulExecutions / flow.totalExecutions) * 100) : 0;

  const statusConfig = {
    active: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Play, label: 'Activo' },
    draft: { color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', icon: PauseCircle, label: 'Borrador' },
    disabled: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle, label: 'Desactivado' },
  }[flow.status] || { color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700', icon: Activity, label: flow.status };

  const StatusIcon = statusConfig.icon;

  return (
    <div className={`group relative bg-zinc-900/40 backdrop-blur-sm border rounded-xl transition-all duration-300 overflow-hidden ${expanded ? 'border-cyan-500/30 bg-zinc-900/80 shadow-lg' : 'border-zinc-800 hover:border-zinc-700'}`}>

      {/* Header */}
      <button onClick={onToggle} className="w-full text-left p-5 pb-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${statusConfig.bg} border ${statusConfig.border}`}>
              <Workflow className={`w-5 h-5 ${statusConfig.color}`} />
            </div>
            <div>
              <h3 className="font-semibold text-zinc-100 truncate text-base">{flow.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-bold uppercasepx-1.5 py-0.5 rounded ${statusConfig.bg} ${statusConfig.color}`}>
                  {statusConfig.label}
                </span>
                {flow.lastExecutedAt && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(flow.lastExecutedAt).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-zinc-500 hover:text-white transition-colors">
            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </div>
        </div>

        {/* Mini Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <MetricBox label="Ejecuciones" value={flow.totalExecutions} />
          <MetricBox label="Fallos" value={flow.failedExecutions} color={flow.failedExecutions > 0 ? 'text-red-400' : 'text-zinc-400'} />
          <MetricBox label="Tasa Éxito" value={flow.totalExecutions > 0 ? `${successRate}%` : '-'} color={successRate > 90 ? 'text-emerald-400' : 'text-amber-400'} />
        </div>

        {/* Health Bar */}
        <div className="mt-4 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${successRate}%` }} />
          <div className="h-full bg-red-500 transition-all duration-500 flex-1" />
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t border-zinc-800/50 bg-zinc-950/30 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-4 pt-4">

            {/* Triggers */}
            <div>
              <h4 className="text-xs font-bold text-zinc-500 st mb-2 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Triggers
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {flow.triggers.length > 0 ? flow.triggers.map((t, i) => (
                  <span key={i} className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">
                    {t}
                  </span>
                )) : <span className="text-xs text-zinc-600 italic">Manual</span>}
              </div>
            </div>

            {/* System Info */}
            <div>
              <h4 className="text-xs font-bold text-zinc-500 st mb-2 flex items-center gap-1.5">
                <Database className="w-3 h-3" /> Sistema
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Cache Redis</span>
                  <span className={flow.cachedInRedis ? 'text-emerald-400' : 'text-zinc-600'}>
                    {flow.cachedInRedis ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Tiempo Prom.</span>
                  <span className="text-zinc-300 font-mono">
                    {flow.avgExecutionTimeMs ? `${flow.avgExecutionTimeMs}ms` : '-'}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

const MetricBox = ({ label, value, color = 'text-zinc-200' }: any) => (
  <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-2 text-center">
    <div className={`text-sm font-bold ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
    <div className="text-[10px] text-zinc-500 ">{label}</div>
  </div>
);

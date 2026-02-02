/**
 * System Monitoring Page
 * Real-time monitoring for Queues, Workers, Flows, Scheduled Messages
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Server,
  Database,
  Cpu,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Workflow,
  Timer,
  Users,
  AlertCircle,
  TrendingUp,
  Zap,
  Loader2
} from 'lucide-react';
import { getSocket } from '../services/socket';
import {
  getSystemHealth,
  type SystemHealth
} from '../services/system.service';

// Import tab components
import { QueuesTab } from '../components/system/QueuesTab';
import { FlowsTab } from '../components/system/FlowsTab';
import { ScheduledTab } from '../components/system/ScheduledTab';
import { WorkersTab } from '../components/system/WorkersTab';
import { ErrorsTab } from '../components/system/ErrorsTab';

type TabId = 'overview' | 'queues' | 'flows' | 'scheduled' | 'workers' | 'errors';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Activity;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'queues', label: 'Queues', icon: Server },
  { id: 'flows', label: 'Flows', icon: Workflow },
  { id: 'scheduled', label: 'Scheduled', icon: Timer },
  { id: 'workers', label: 'Workers', icon: Cpu },
  { id: 'errors', label: 'Errors', icon: AlertTriangle },
];

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const loadHealth = useCallback(async () => {
    // Skip if access was denied (403)
    if (accessDenied) return;

    const result = await getSystemHealth();
    if (result.ok && result.data) {
      setHealth(result.data);
      setLastUpdate(new Date());
      setError(null);
    } else {
      // Check for 403 to stop polling
      if (result.error?.includes('403') || result.error?.includes('access required') || result.error?.includes('Access denied')) {
        setAccessDenied(true);
        setAutoRefresh(false);
      }
      setError(result.error || 'Error loading system health');
    }
    setLoading(false);
  }, [accessDenied]);

  // Initial load
  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(loadHealth, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadHealth]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRedisStatus = (data: { connected: boolean }) => {
      if (health) {
        setHealth({
          ...health,
          services: {
            ...health.services,
            redis: { status: data.connected ? 'up' : 'down' }
          }
        });
      }
    };

    socket.on('system:redis:status', handleRedisStatus);

    return () => {
      socket.off('system:redis:status', handleRedisStatus);
    };
  }, [health]);

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-purple-500/30">

      {/* Purple Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">

        {/* Header Section */}
        <div className="px-8 py-6 pb-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-purple-900/10">
                <Activity className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Monitor del Sistema</h1>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <span className={`w-2 h-2 rounded-full ${health?.status === 'healthy' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
                  {health?.status === 'healthy' ? 'Sistema Operativo' : 'Problemas Detectados'}
                  <span className="text-zinc-600 mx-1">•</span>
                  <Clock className="w-3.5 h-3.5" />
                  <span>Actualizado: {lastUpdate.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`p-2.5 rounded-xl border transition-all ${autoRefresh
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              >
                <RefreshCw className={`w-5 h-5 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
              </button>

              <button
                onClick={loadHealth}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl text-white font-medium transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Actualizar</span>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-zinc-800/50">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                  }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">
          {activeTab === 'overview' && (
            <OverviewContent health={health} loading={loading} error={error} />
          )}
          {/* Render other tabs here assuming they are updated or compatible */}
          {activeTab === 'queues' && <QueuesTab />}
          {activeTab === 'flows' && <FlowsTab />}
          {activeTab === 'scheduled' && <ScheduledTab />}
          {activeTab === 'workers' && <WorkersTab />}
          {activeTab === 'errors' && <ErrorsTab />}
        </div>
      </div>
    </div>
  );
}

// ============= OVERVIEW CONTENT =============

interface OverviewContentProps {
  health: SystemHealth | null;
  loading: boolean;
  error: string | null;
}

function OverviewContent({ health, loading, error }: OverviewContentProps) {
  if (loading && !health) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-4">
        <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-white font-medium text-lg">Error de conexión</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!health) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* 1. Services Status */}
      <div>
        <h3 className="text-xs font-bold text-zinc-500 st mb-4 flex items-center gap-2">
          <Server className="w-4 h-4" /> Servicios Principales
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <ServiceCard
            name="Redis Cache"
            icon={Database}
            status={health.services.redis.status}
            latency={health.services.redis.latencyMs}
            description="Cola de mensajes y almacenamiento"
          />
          <ServiceCard
            name="MongoDB Atlas"
            icon={Database}
            status={health.services.mongodb.status}
            latency={health.services.mongodb.latencyMs}
            description="Base de datos principal"
          />
          <ServiceCard
            name="BullMQ Workers"
            icon={Cpu}
            status={health.services.queues.status}
            description={health.services.queues.initialized ? 'Procesando tareas en segundo plano' : 'Inicializando...'}
          />
        </div>
      </div>

      {/* 2. Key Metrics */}
      <div>
        <h3 className="text-xs font-bold text-zinc-500 st mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Métricas Clave
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            title="Flows Activos"
            value={health.metrics.activeFlows}
            icon={Workflow}
            color="purple"
            description="En ejecución"
          />
          <MetricCard
            title="Tareas en Cola"
            value={health.metrics.pendingJobs}
            icon={Clock}
            color="blue"
            description="Esperando worker"
          />
          <MetricCard
            title="Programados"
            value={health.metrics.scheduledMessages}
            icon={Timer}
            color="amber"
            description="Mensajes futuros"
          />
          <MetricCard
            title="Fallos (24h)"
            value={health.metrics.failedJobs24h}
            icon={AlertTriangle}
            color="red"
            description="Requieren atención"
            alert={health.metrics.failedJobs24h > 0}
          />
        </div>
      </div>

      {/* 3. Quick Actions */}
      <div>
        <h3 className="text-xs font-bold text-zinc-500 st mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Mantenimiento Rápido
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction icon={RefreshCw} label="Reintentar Fallos" description="Reencolar jobs fallidos" onClick={() => { }} />
          <QuickAction icon={Zap} label="Limpiar Cache" description="Purgar Redis keys" onClick={() => { }} />
          <QuickAction icon={TrendingUp} label="Ver Métricas" description="Dashboard detallado" onClick={() => { }} />
          <QuickAction icon={Users} label="Estado Workers" description="Salud de procesos" onClick={() => { }} />
        </div>
      </div>

    </div>
  );
}

// ============= COMPONENTS =============

interface ServiceCardProps {
  name: string;
  icon: typeof Database;
  status: 'up' | 'down';
  latency?: number;
  description: string;
}
interface MetricCardProps {
  title: string;
  value: number;
  icon: typeof Activity;
  color: 'purple' | 'blue' | 'amber' | 'red' | 'green' ;
  description: string;
  alert?: boolean;
}

interface QuickActionProps {
  icon: typeof Activity;
  label: string;
  description: string;
  onClick: () => void;
}

function ServiceCard({ name, icon: Icon, status, latency, description }: ServiceCardProps) {
  const isUp = status === 'up';
  return (
    <div className={`group p-5 rounded-2xl border transition-all duration-300 ${isUp ? 'bg-zinc-900/50 border-zinc-800 hover:border-emerald-500/30' : 'bg-red-500/5 border-red-500/20'
      }`}>
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl ${isUp ? 'bg-zinc-800 group-hover:bg-emerald-500/10' : 'bg-red-500/10'}`}>
          <Icon className={`w-5 h-5 ${isUp ? 'text-zinc-400 group-hover:text-emerald-400' : 'text-red-500'}`} />
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-bold uppercasepx-2 py-1 rounded-full ${isUp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
          {isUp ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {isUp ? 'ONLINE' : 'OFFLINE'}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
        <p className="text-sm text-zinc-500 mb-3">{description}</p>
        {latency !== undefined && (
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-950/50 w-fit px-2 py-1 rounded border border-zinc-800">
            <Activity className="w-3 h-3" />
            {latency}ms
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color, description, alert }: MetricCardProps) {
  const colors = {
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };
  const theme = colors[color as keyof typeof colors];

  return (
    <div className={`relative p-5 bg-zinc-900/40 backdrop-blur-sm border rounded-2xl transition-all hover:bg-zinc-900/60 ${alert ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]' : 'border-zinc-800'}`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl border ${theme}`}>
          <Icon className="w-5 h-5" />
        </div>
        {alert && <div className="animate-pulse w-2 h-2 bg-red-500 rounded-full" />}
      </div>
      <div className="text-3xl font-bold text-white tracking-tight mb-1">{value?.toLocaleString() || 0}</div>
      <div className="text-sm font-medium text-zinc-300">{title}</div>
      <div className="text-xs text-zinc-500 mt-1">{description}</div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, description, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-3 p-5 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-2xl transition-all group text-center"
    >
      <div className="p-3 bg-zinc-950 rounded-full border border-zinc-800 group-hover:border-zinc-600 transition-colors">
        <Icon className="w-5 h-5 text-zinc-400 group-hover:text-white" />
      </div>
      <div>
        <div className="text-sm font-medium text-white mb-0.5">{label}</div>
        <div className="text-[10px] text-zinc-500">{description}</div>
      </div>
    </button>
  );
}
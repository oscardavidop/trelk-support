/**
 * AuditPage - Activity and Audit Logs Dashboard
 * Shows activity timeline, audit logs, and agent actions
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Navigate } from 'react-router-dom';
import {
  Activity,
  Search,
  Filter,
  Calendar,
  RefreshCw,
  User,
  MessageCircle,
  Settings,
  LogIn,
  LogOut,
  Eye,
  Edit,
  Trash2,
  Send,
  Download,
  Shield,
  ChevronDown,
  Clock,
  FileJson
} from 'lucide-react';

interface ActivityLog {
  _id: string;
  agentId: string;
  agentName: string;
  action: string;
  actionType: 'chat' | 'message' | 'session' | 'agent' | 'system' | 'auth';
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}

interface AuditLog {
  _id: string;
  performedBy: string;
  performedByName: string;
  action: string;
  resource: string;
  resourceId?: string;
  changes?: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  };
  ipAddress?: string;
  createdAt: string;
}

type TabType = 'activity' | 'audit';
type TimeFilter = 'today' | 'week' | 'month' | 'all';

export default function AuditPage() {
  const { agent } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('activity');
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('today');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Access control - only admin and supervisor
  const canAccess = agent?.role === 'admin' || agent?.role === 'supervisor';

  // Fetch logs
  const fetchLogs = useCallback(async () => {
    if (!canAccess) return;

    setLoading(true);
    try {
      const token = JSON.parse(localStorage.getItem('trelk-support-auth') || '{}').state?.token;

      // Fetch activity logs
      const activityRes = await fetch(`/api/activity?timeFilter=${timeFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivityLogs(data.data || []);
      }

      // Fetch audit logs
      const auditRes = await fetch(`/api/audit?timeFilter=${timeFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  }, [canAccess, timeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  // Filter logs based on search and action type
  const filteredActivityLogs = activityLogs.filter(log => {
    const matchesSearch = searchTerm === '' || log.action.toLowerCase().includes(searchTerm.toLowerCase()) || log.agentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.actionType === actionFilter;
    return matchesSearch && matchesAction;
  });

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = searchTerm === '' || log.action.toLowerCase().includes(searchTerm.toLowerCase()) || log.performedByName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-indigo-500/30">

      {/* Indigo Ambient Glow */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">

        {/* Header Section */}
        <div className="px-8 py-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-indigo-900/10">
                <Activity className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Registro de Actividad</h1>
                <p className="text-sm text-zinc-400">Monitoreo y auditoría del sistema</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex bg-zinc-900/50 rounded-xl border border-zinc-800 p-1">
                <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} icon={Clock} label="Timeline" />
                <TabButton active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} icon={Shield} label="Auditoría" />
              </div>

              <button
                onClick={fetchLogs}
                disabled={loading}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
              </button>
            </div>
          </div>

          {/* Toolbar (Search & Filters) */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[280px] max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={activeTab === 'activity' ? "Buscar actividad..." : "Buscar cambios..."}
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 cursor-pointer"
              >
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
                <option value="all">Todo</option>
              </select>

              {activeTab === 'activity' && (
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 cursor-pointer"
                >
                  <option value="all">Todas las acciones</option>
                  <option value="chat">Chat</option>
                  <option value="message">Mensajes</option>
                  <option value="session">Sesiones</option>
                  <option value="agent">Agentes</option>
                  <option value="system">Sistema</option>
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 custom-scrollbar">
          {loading ? (
            <LoadingSkeleton />
          ) : activeTab === 'activity' ? (
            <ActivityTimeline logs={filteredActivityLogs} />
          ) : (
            <AuditLogsList logs={filteredAuditLogs} />
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components


function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active
        ? 'bg-zinc-800 text-white shadow-sm'
        : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
        }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function ActivityTimeline({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) return <EmptyState icon={Activity} text="No hay actividad registrada" />;

  const groupedLogs = logs.reduce((acc, log) => {
    const date = new Date(log.createdAt).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, ActivityLog[]>);

  return (
    <div className="space-y-8 max-w-4xl">
      {Object.entries(groupedLogs).map(([date, dateLogs]) => (
        <div key={date} className="relative">
          <div className="sticky top-0 z-20 bg-zinc-950/95 backdrop-blur py-2 mb-4 border-b border-zinc-800/50 flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-indigo-500" />
            <h3 className="text-sm font-semibold text-zinc-400 ">{date}</h3>
          </div>

          <div className="space-y-0 pl-1">
            {dateLogs.map((log, idx) => (
              <ActivityItem key={log._id} log={log} isLast={idx === dateLogs.length - 1} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityItem({ log, isLast }: { log: ActivityLog; isLast: boolean }) {
  const getActionConfig = (type: string) => {
    switch (type) {
      case 'chat': return { icon: MessageCircle, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'message': return { icon: Send, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      case 'session': return { icon: User, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
      case 'agent': return { icon: Settings, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      case 'auth': return { icon: LogIn, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' };
      default: return { icon: Activity, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
    }
  };

  const config = getActionConfig(log.actionType);
  const Icon = config.icon;

  return (
    <div className="flex gap-4 group relative pb-8 last:pb-0">
      {!isLast && <div className="absolute left-5 top-10 bottom-0 w-px bg-zinc-800 group-hover:bg-zinc-700 transition-colors" />}

      <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center border ${config.bg} ${config.border} shrink-0`}>
        <Icon className={`w-5 h-5 ${config.color}`} />
      </div>

      <div className="flex-1 pt-1.5 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-zinc-200 text-sm">{log.agentName}</span>
            <span className="text-zinc-600 text-xs">•</span>
            <span className="text-zinc-400 text-xs">{log.action}</span>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {new Date(log.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {log.targetType && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 mt-1 font-mono">
            <span className="text-zinc-500">{log.targetType}:</span>
            <span className="text-zinc-300">{log.targetId}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AuditLogsList({ logs }: { logs: AuditLog[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (logs.length === 0) return <EmptyState icon={Shield} text="No hay registros de auditoría" />;

  return (
    <div className="space-y-3 max-w-5xl">
      {logs.map(log => (
        <div key={log._id} className={`bg-zinc-900/40 border transition-all duration-200 overflow-hidden rounded-xl ${expanded === log._id ? 'border-indigo-500/30 bg-zinc-900/80 shadow-lg' : 'border-zinc-800 hover:border-zinc-700'}`}>
          <button
            onClick={() => setExpanded(expanded === log._id ? null : log._id)}
            className="w-full p-4 flex items-center justify-between gap-4 text-left"
          >
            <div className="flex items-center gap-4 min-w-0">
              <AuditIcon action={log.action} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-zinc-200 text-sm">{log.action}</span>
                  <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400 uppercaseborder border-zinc-700">{log.resource}</span>
                </div>
                <p className="text-xs text-zinc-500 truncate">
                  Por <span className="text-zinc-300">{log.performedByName}</span> • {new Date(log.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${expanded === log._id ? 'rotate-180' : ''}`} />
          </button>

          {expanded === log._id && log.changes && (
            <div className="px-4 pb-4 pt-0 animate-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-4 mt-2 p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-400 ">
                    <span className="w-2 h-2 rounded-full bg-red-500/50" /> Antes
                  </div>
                  <pre className="text-xs text-red-200/70 font-mono bg-red-950/10 border border-red-500/10 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(log.changes.before, null, 2)}
                  </pre>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 ">
                    <span className="w-2 h-2 rounded-full bg-emerald-500/50" /> Después
                  </div>
                  <pre className="text-xs text-emerald-200/70 font-mono bg-emerald-950/10 border border-emerald-500/10 p-3 rounded-lg overflow-x-auto">
                    {JSON.stringify(log.changes.after, null, 2)}
                  </pre>
                </div>
              </div>
              {log.ipAddress && (
                <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500 font-mono pl-1">
                  <Shield className="w-3 h-3" /> IP: {log.ipAddress}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AuditIcon({ action }: { action: string }) {
  const act = action.toLowerCase();
  let icon = FileJson;
  let color = 'text-zinc-400';
  let bg = 'bg-zinc-800';

  if (act.includes('create') || act.includes('add')) { icon = Edit; color = 'text-emerald-400'; bg = 'bg-emerald-500/10 border-emerald-500/20'; }
  else if (act.includes('update') || act.includes('edit')) { icon = Edit; color = 'text-blue-400'; bg = 'bg-blue-500/10 border-blue-500/20'; }
  else if (act.includes('delete')) { icon = Trash2; color = 'text-red-400'; bg = 'bg-red-500/10 border-red-500/20'; }
  else if (act.includes('export')) { icon = Download; color = 'text-amber-400'; bg = 'bg-amber-500/10 border-amber-500/20'; }
  else { icon = FileJson; color = 'text-zinc-400'; bg = 'bg-zinc-800/10 border-zinc-800/50'; }

  const Icon = icon;
  return (
    <div className={`p-2 rounded-lg border ${bg} ${color}`}>
      <Icon className="w-4 h-4" />
    </div>
  );
}

function EmptyState({ icon: Icon, text }: any) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
      <Icon className="w-12 h-12 mb-3 stroke-1" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl">
      {[1, 2, 3].map(i => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="w-10 h-10 bg-zinc-800 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-800 rounded w-1/3" />
            <div className="h-3 bg-zinc-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
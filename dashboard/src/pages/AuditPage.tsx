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
  Clock
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
    const matchesSearch = searchTerm === '' || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.agentName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAction = actionFilter === 'all' || log.actionType === actionFilter;
    return matchesSearch && matchesAction;
  });

  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = searchTerm === '' ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.performedByName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/20 rounded-xl">
            <Activity className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Registros de Actividad</h1>
            <p className="text-sm text-gray-400">Historial de acciones y auditoría del sistema</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFilters ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="border-b border-gray-800 px-6 py-4 bg-gray-900/50">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por acción o agente..."
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="today">Hoy</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
                <option value="all">Todo</option>
              </select>
            </div>

            {/* Action Type Filter (for activity tab) */}
            {activeTab === 'activity' && (
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todas las acciones</option>
                <option value="chat">Chats</option>
                <option value="message">Mensajes</option>
                <option value="session">Sesiones</option>
                <option value="agent">Agentes</option>
                <option value="auth">Autenticación</option>
                <option value="system">Sistema</option>
              </select>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <TabButton
          active={activeTab === 'activity'}
          onClick={() => setActiveTab('activity')}
          icon={<Clock className="w-4 h-4" />}
          label="Timeline de Actividad"
          count={filteredActivityLogs.length}
        />
        <TabButton
          active={activeTab === 'audit'}
          onClick={() => setActiveTab('audit')}
          icon={<Shield className="w-4 h-4" />}
          label="Logs de Auditoría"
          count={filteredAuditLogs.length}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <LoadingSkeleton />
        ) : activeTab === 'activity' ? (
          <ActivityTimeline logs={filteredActivityLogs} />
        ) : (
          <AuditLogsList logs={filteredAuditLogs} />
        )}
      </div>
    </div>
  );
}

// Sub-components

function TabButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  count 
}: { 
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-indigo-500 text-indigo-400 bg-indigo-500/10'
          : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className="px-2 py-0.5 bg-gray-700 rounded-full text-xs text-gray-300">
        {count}
      </span>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="w-10 h-10 bg-gray-800 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-gray-800 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-800 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityTimeline({ logs }: { logs: ActivityLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No hay actividad registrada</p>
        <p className="text-sm mt-1">Las acciones de los agentes aparecerán aquí</p>
      </div>
    );
  }

  // Group by date
  const groupedLogs = logs.reduce((acc, log) => {
    const date = new Date(log.createdAt).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(log);
    return acc;
  }, {} as Record<string, ActivityLog[]>);

  return (
    <div className="space-y-8">
      {Object.entries(groupedLogs).map(([date, dateLogs]) => (
        <div key={date}>
          <h3 className="text-sm font-medium text-gray-400 mb-4 sticky top-0 bg-gray-950 py-2">
            {date}
          </h3>
          <div className="space-y-1">
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
  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'chat': return <MessageCircle className="w-4 h-4" />;
      case 'message': return <Send className="w-4 h-4" />;
      case 'session': return <User className="w-4 h-4" />;
      case 'agent': return <Settings className="w-4 h-4" />;
      case 'auth': return <LogIn className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'chat': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'message': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'session': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'agent': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'auth': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const time = new Date(log.createdAt).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="flex gap-4 group">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${getActionColor(log.actionType)}`}>
          {getActionIcon(log.actionType)}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-gray-800 mt-2" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-white">{log.agentName}</span>
          <span className="text-gray-500">•</span>
          <span className="text-sm text-gray-400">{time}</span>
        </div>
        <p className="text-sm text-gray-300">{log.action}</p>
        {log.targetType && (
          <p className="text-xs text-gray-500 mt-1">
            {log.targetType}: {log.targetId}
          </p>
        )}
      </div>
    </div>
  );
}

function AuditLogsList({ logs }: { logs: AuditLog[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Shield className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No hay registros de auditoría</p>
        <p className="text-sm mt-1">Los cambios de configuración y datos aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div
          key={log._id}
          className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
        >
          <button
            onClick={() => setExpanded(expanded === log._id ? null : log._id)}
            className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-4">
              <AuditActionIcon action={log.action} />
              <div>
                <p className="font-medium text-white">{log.action}</p>
                <p className="text-sm text-gray-400">
                  {log.performedByName} • {log.resource}
                  {log.resourceId && ` #${log.resourceId.slice(-6)}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {new Date(log.createdAt).toLocaleString('es-ES')}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded === log._id ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {expanded === log._id && log.changes && (
            <div className="px-4 pb-4 border-t border-gray-700 pt-4">
              <div className="grid grid-cols-2 gap-4">
                {log.changes.before && (
                  <div>
                    <p className="text-xs text-red-400 uppercase tracking-wider mb-2">Antes</p>
                    <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded-lg overflow-auto max-h-48">
                      {JSON.stringify(log.changes.before, null, 2)}
                    </pre>
                  </div>
                )}
                {log.changes.after && (
                  <div>
                    <p className="text-xs text-green-400 uppercase tracking-wider mb-2">Después</p>
                    <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded-lg overflow-auto max-h-48">
                      {JSON.stringify(log.changes.after, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              {log.ipAddress && (
                <p className="text-xs text-gray-500 mt-3">IP: {log.ipAddress}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AuditActionIcon({ action }: { action: string }) {
  const actionLower = action.toLowerCase();
  
  if (actionLower.includes('create') || actionLower.includes('add')) {
    return (
      <div className="p-2 bg-green-500/20 rounded-lg">
        <Edit className="w-4 h-4 text-green-400" />
      </div>
    );
  }
  if (actionLower.includes('update') || actionLower.includes('edit') || actionLower.includes('change')) {
    return (
      <div className="p-2 bg-blue-500/20 rounded-lg">
        <Edit className="w-4 h-4 text-blue-400" />
      </div>
    );
  }
  if (actionLower.includes('delete') || actionLower.includes('remove')) {
    return (
      <div className="p-2 bg-red-500/20 rounded-lg">
        <Trash2 className="w-4 h-4 text-red-400" />
      </div>
    );
  }
  if (actionLower.includes('view') || actionLower.includes('read') || actionLower.includes('access')) {
    return (
      <div className="p-2 bg-purple-500/20 rounded-lg">
        <Eye className="w-4 h-4 text-purple-400" />
      </div>
    );
  }
  if (actionLower.includes('export') || actionLower.includes('download')) {
    return (
      <div className="p-2 bg-yellow-500/20 rounded-lg">
        <Download className="w-4 h-4 text-yellow-400" />
      </div>
    );
  }
  
  return (
    <div className="p-2 bg-gray-500/20 rounded-lg">
      <Shield className="w-4 h-4 text-gray-400" />
    </div>
  );
}

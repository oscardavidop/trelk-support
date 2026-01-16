/**
 * System Control Page
 * DevOps/Enterprise Admin Control Panel
 * 
 * Features:
 * - Chat Control (close all, by agent, by status, delete history)
 * - Flow Control (disable all, enable, reload, delete inactive)
 * - Database Control (drop/clear collections, rebuild indexes)
 * - Cache & Queue Control (clear, flush, pause/resume)
 * - Session Control (force logout, block/unblock)
 * - Audit Logs (view all admin actions)
 * - System Stats (CPU, RAM, Redis, Mongo)
 * 
 * All actions are REAL - no mocks
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  MessageSquare,
  Workflow,
  Database,
  Clock,
  Users,
  Activity,
  AlertTriangle,
  Lock,
  Trash2,
  Power,
  RefreshCw,
  PlayCircle,
  PauseCircle,
  UserX,
  UserCheck,
  FileText,
  Server,
  HardDrive,
  Cpu,
  Wifi,
  WifiOff,
  LogOut,
  Settings,
  ChevronRight,
  X,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

// ============= TYPES =============

interface ActionResult {
  ok: boolean;
  success?: boolean;
  message?: string;
  affectedCount?: number;
  error?: string;
}

interface ChatStats {
  total: number;
  byStatus: Record<string, number>;
  byAgent: Array<{ agentId: string; agentName: string; count: number }>;
  orphan: number;
}

interface FlowStats {
  total: number;
  active: number;
  inactive: number;
  flows: Array<{ _id: string; name: string; enabled: boolean; executionCount: number; updatedAt: Date }>;
}

interface CollectionStat {
  name: string;
  count: number;
  size: string;
}

interface CacheStats {
  dbSize: number;
  usedMemory: string;
  keys: number;
  keysByPrefix: Record<string, number>;
}

interface QueueStat {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface QueueStats {
  scheduledQueue: QueueStat;
  inactivityQueue: QueueStat;
  flowQueue: QueueStat;
  cleanupQueue: QueueStat;
  notificationsQueue: QueueStat;
}

interface SessionStats {
  connectedAgents: number;
  byRole: Record<string, number>;
  agents: Array<{ id: string; name: string; email: string; role: string; connected: boolean; isActive?: boolean }>;
}

interface SystemStats {
  cpu: { usage: number; cores: number };
  memory: { total: string; used: string; free: string; usagePercent: number };
  uptime: string;
  nodeVersion: string;
  mongoConnected: boolean;
  redisConnected: boolean;
  websocketConnections: number;
}

interface MaintenanceStatus {
  enabled: boolean;
  message?: string;
  enabledBy?: string;
  enabledAt?: string;
}

interface AuditLog {
  _id: string;
  adminEmail: string;
  adminName: string;
  action: string;
  category: string;
  severity: string;
  target: string;
  affectedCount?: number;
  result: string;
  createdAt: string;
}

type SectionId = 'chats' | 'flows' | 'database' | 'cache' | 'sessions' | 'system' | 'audit';

// ============= SECTION DATA =============

const SECTIONS = [
  { id: 'chats' as SectionId, label: 'Control de Chats', icon: MessageSquare, color: 'text-blue-500' },
  { id: 'flows' as SectionId, label: 'Control de Flows', icon: Workflow, color: 'text-purple-500' },
  { id: 'database' as SectionId, label: 'Base de Datos', icon: Database, color: 'text-red-500' },
  { id: 'cache' as SectionId, label: 'Cache & Colas', icon: Server, color: 'text-orange-500' },
  { id: 'sessions' as SectionId, label: 'Sesiones', icon: Users, color: 'text-green-500' },
  { id: 'system' as SectionId, label: 'Sistema', icon: Activity, color: 'text-cyan-500' },
  { id: 'audit' as SectionId, label: 'Logs de Auditoría', icon: FileText, color: 'text-gray-500' },
];

// ============= CONFIRMATION MODAL =============

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  severity: 'warning' | 'danger' | 'critical';
  confirmPhrase?: string;
  requirePassword?: boolean;
  onConfirm: (password?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

function ConfirmModal({ 
  isOpen, 
  title, 
  message, 
  severity, 
  confirmPhrase, 
  requirePassword,
  onConfirm, 
  onCancel,
  loading 
}: ConfirmModalProps) {
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPassword('');
      setPhrase('');
      setShowPassword(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const canConfirm = 
    (!requirePassword || password.length > 0) &&
    (!confirmPhrase || phrase === confirmPhrase);

  const bgColor = severity === 'critical' 
    ? 'bg-red-900/50' 
    : severity === 'danger' 
      ? 'bg-red-800/30' 
      : 'bg-yellow-800/30';

  const borderColor = severity === 'critical' 
    ? 'border-red-500' 
    : severity === 'danger' 
      ? 'border-red-400' 
      : 'border-yellow-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`w-full max-w-md ${bgColor} ${borderColor} border-2 rounded-lg shadow-2xl p-6`}>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className={severity === 'critical' ? 'text-red-500 w-8 h-8' : severity === 'danger' ? 'text-red-400 w-7 h-7' : 'text-yellow-400 w-6 h-6'} />
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>

        <p className="text-gray-200 mb-4">{message}</p>

        {severity === 'critical' && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-4">
            <p className="text-red-300 text-sm font-medium">
              ⚠️ ACCIÓN DESTRUCTIVA: Esta operación NO puede deshacerse.
            </p>
          </div>
        )}

        {confirmPhrase && (
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-2">
              Escribe <code className="bg-gray-800 px-2 py-1 rounded text-red-400">{confirmPhrase}</code> para confirmar:
            </label>
            <input
              type="text"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
              placeholder="Escribe la frase de confirmación"
              autoComplete="off"
            />
          </div>
        )}

        {requirePassword && (
          <div className="mb-4">
            <label className="block text-sm text-gray-300 mb-2">
              Ingresa tu contraseña para confirmar:
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 pr-10 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder="Tu contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(password)}
            disabled={!canConfirm || loading}
            className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
              severity === 'critical' 
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : severity === 'danger'
                  ? 'bg-red-500 hover:bg-red-400 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-500 text-white'
            }`}
          >
            {loading ? (
              <>
                <RefreshCw className="animate-spin w-4 h-4" />
                Procesando...
              </>
            ) : (
              <>
                <Check size={18} />
                Confirmar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= ACTION BUTTON =============

interface ActionButtonProps {
  label: string;
  icon: typeof Activity;
  severity: 'info' | 'warning' | 'danger' | 'critical';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

function ActionButton({ label, icon: Icon, severity, onClick, disabled, loading }: ActionButtonProps) {
  const baseClasses = 'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const colorClasses = {
    info: 'bg-blue-600 hover:bg-blue-500 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-500 text-white',
    danger: 'bg-red-600 hover:bg-red-500 text-white',
    critical: 'bg-red-700 hover:bg-red-600 text-white border-2 border-red-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${colorClasses[severity]}`}
    >
      {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Icon size={18} />}
      {label}
    </button>
  );
}

// ============= STAT CARD =============

interface StatCardProps {
  label: string;
  value: string | number;
  icon: typeof Activity;
  color?: string;
}

function StatCard({ label, value, icon: Icon, color = 'text-blue-400' }: StatCardProps) {
  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <Icon className={`${color} w-5 h-5`} />
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ============= MAIN COMPONENT =============

export default function SystemControlPage() {
  const { agent } = useAuthStore();
  const [activeSection, setActiveSection] = useState<SectionId>('chats');
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Data states
  const [chatStats, setChatStats] = useState<ChatStats | null>(null);
  const [flowStats, setFlowStats] = useState<FlowStats | null>(null);
  const [collections, setCollections] = useState<CollectionStat[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);

  // Modal state
  const [confirmModal, setConfirmModal] = useState<Omit<ConfirmModalProps, 'onConfirm' | 'onCancel' | 'loading'> & { onConfirm: (password?: string) => Promise<void> } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Check admin role
  if (agent?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Acceso Denegado</h2>
          <p className="text-gray-400">Se requiere rol de administrador para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  // ============= API CALLS =============

  const loadChatStats = async () => {
    try {
      const response = await api.get<{ ok: boolean; data: ChatStats }>('/api/admin-control/chats/stats');
      if (response.ok && response.data?.data) {
        setChatStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading chat stats:', error);
    }
  };

  const loadFlowStats = async () => {
    try {
      const response = await api.get<{ ok: boolean; data: FlowStats }>('/api/admin-control/flows/stats');
      if (response.ok && response.data?.data) {
        setFlowStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading flow stats:', error);
    }
  };

  const loadCollections = async () => {
    try {
      const response = await api.get<{ ok: boolean; data: CollectionStat[] }>('/api/admin-control/database/collections');
      if (response.ok && response.data?.data) {
        setCollections(response.data.data);
      }
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  };

  const loadCacheStats = async () => {
    try {
      const response = await api.get<{ ok: boolean; data: CacheStats }>('/api/admin-control/cache/stats');
      if (response.ok && response.data?.data) {
        setCacheStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading cache stats:', error);
    }
  };

  const loadQueueStats = async () => {
    try {
      const response = await api.get<{ ok: boolean; data: QueueStats }>('/api/admin-control/queue/stats');
      if (response.ok && response.data?.data) {
        setQueueStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading queue stats:', error);
    }
  };

  const loadSessionStats = async () => {
    try {
      const response = await api.get<{ ok: boolean; data: SessionStats }>('/api/admin-control/sessions/stats');
      if (response.ok && response.data?.data) {
        setSessionStats(response.data.data);
      }
    } catch (error) {
      console.error('Error loading session stats:', error);
    }
  };

  const loadSystemStats = async () => {
    try {
      const [statsRes, maintenanceRes] = await Promise.all([
        api.get<{ ok: boolean; data: SystemStats }>('/api/admin-control/stats'),
        api.get<{ ok: boolean; data: MaintenanceStatus }>('/api/admin-control/maintenance/status'),
      ]);
      
      if (statsRes.ok && statsRes.data?.data) {
        setSystemStats(statsRes.data.data);
      }
      if (maintenanceRes.ok && maintenanceRes.data?.data) {
        setMaintenanceStatus(maintenanceRes.data.data);
      }
    } catch (error) {
      console.error('Error loading system stats:', error);
    }
  };

  const loadAuditLogs = async (page = 1) => {
    try {
      const response = await api.get<{ ok: boolean; data: { logs: AuditLog[]; total: number } }>(`/api/admin-control/audit/logs?page=${page}&limit=20`);
      if (response.ok && response.data?.data) {
        setAuditLogs(response.data.data.logs);
        setAuditTotal(response.data.data.total);
        setAuditPage(page);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  };

  // Load data when section changes
  useEffect(() => {
    switch (activeSection) {
      case 'chats':
        loadChatStats();
        break;
      case 'flows':
        loadFlowStats();
        break;
      case 'database':
        loadCollections();
        break;
      case 'cache':
        loadCacheStats();
        loadQueueStats();
        break;
      case 'sessions':
        loadSessionStats();
        break;
      case 'system':
        loadSystemStats();
        break;
      case 'audit':
        loadAuditLogs(1);
        break;
    }
  }, [activeSection]);

  // ============= ACTION HANDLERS =============

  const showResult = (message: string, type: 'success' | 'error') => {
    setActionResult({ message, type });
    setTimeout(() => setActionResult(null), 5000);
  };

  const verifyPassword = async (password: string): Promise<boolean> => {
    try {
      const response = await api.post<{ ok: boolean }>('/api/admin-control/verify-password', { password });
      return response.ok === true;
    } catch {
      return false;
    }
  };

  const executeAction = async (
    endpoint: string,
    body: Record<string, unknown> = {},
    options: { 
      requirePassword?: boolean; 
      confirmPhrase?: string; 
      severity?: 'warning' | 'danger' | 'critical';
      title: string;
      message: string;
    }
  ) => {
    setConfirmModal({
      isOpen: true,
      title: options.title,
      message: options.message,
      severity: options.severity || 'warning',
      confirmPhrase: options.confirmPhrase,
      requirePassword: options.requirePassword,
      onConfirm: async (password?: string) => {
        setModalLoading(true);
        try {
          if (options.requirePassword && password) {
            const valid = await verifyPassword(password);
            if (!valid) {
              showResult('Contraseña incorrecta', 'error');
              setModalLoading(false);
              return;
            }
          }

          const finalBody = options.confirmPhrase 
            ? { ...body, confirmPhrase: options.confirmPhrase }
            : body;

          const response = await api.post<ActionResult>(endpoint, finalBody);
          const result = response.data;
          
          if (response.ok && (result?.ok || result?.success)) {
            showResult(result?.message || 'Acción completada exitosamente', 'success');
            // Reload relevant data
            switch (activeSection) {
              case 'chats':
                loadChatStats();
                break;
              case 'flows':
                loadFlowStats();
                break;
              case 'database':
                loadCollections();
                break;
              case 'cache':
                loadCacheStats();
                loadQueueStats();
                break;
              case 'sessions':
                loadSessionStats();
                break;
              case 'system':
                loadSystemStats();
                break;
              case 'audit':
                loadAuditLogs(auditPage);
                break;
            }
          } else {
            showResult(result?.error || result?.message || 'Error ejecutando acción', 'error');
          }
        } catch (error) {
          showResult('Error de conexión', 'error');
        } finally {
          setModalLoading(false);
          setConfirmModal(null);
        }
      },
    });
  };

  // ============= RENDER SECTIONS =============

  const renderChatsSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="text-blue-500" />
          Control de Chats
        </h2>
        <button onClick={loadChatStats} className="text-gray-400 hover:text-white">
          <RefreshCw size={18} />
        </button>
      </div>

      {chatStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Chats" value={chatStats.total} icon={MessageSquare} color="text-blue-400" />
            <StatCard label="Activos" value={chatStats.byStatus.human || 0} icon={Users} color="text-green-400" />
            <StatCard label="En Espera" value={chatStats.byStatus.waiting || 0} icon={Clock} color="text-yellow-400" />
            <StatCard label="Huérfanos" value={chatStats.orphan} icon={AlertTriangle} color="text-red-400" />
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Acciones</h3>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                label="Cerrar Todos los Chats"
                icon={Power}
                severity="critical"
                onClick={() => executeAction('/api/admin-control/chats/close-all', { reason: 'Admin force close' }, {
                  title: '¿Cerrar TODOS los chats activos?',
                  message: 'Esta acción cerrará todos los chats con estado humano, esperando, en cola y bot.',
                  severity: 'critical',
                  requirePassword: true,
                })}
              />
              <ActionButton
                label="Eliminar Chats Huérfanos"
                icon={Trash2}
                severity="warning"
                onClick={() => executeAction('/api/admin-control/chats/delete-orphans', {}, {
                  title: '¿Eliminar chats huérfanos?',
                  message: `Se eliminarán ${chatStats.orphan} chats sin agente asignado o inactivos por más de 7 días.`,
                  severity: 'warning',
                })}
              />
              <ActionButton
                label="Eliminar Historial (24h)"
                icon={Trash2}
                severity="danger"
                onClick={() => executeAction('/api/admin-control/chats/delete-history', { period: '24h' }, {
                  title: '¿Eliminar mensajes mayores a 24 horas?',
                  message: 'Se eliminarán todos los mensajes con más de 24 horas de antigüedad.',
                  severity: 'danger',
                  requirePassword: true,
                })}
              />
              <ActionButton
                label="Eliminar Historial (7 días)"
                icon={Trash2}
                severity="danger"
                onClick={() => executeAction('/api/admin-control/chats/delete-history', { period: '7d' }, {
                  title: '¿Eliminar mensajes mayores a 7 días?',
                  message: 'Se eliminarán todos los mensajes con más de 7 días de antigüedad.',
                  severity: 'danger',
                  requirePassword: true,
                })}
              />
            </div>
          </div>

          {chatStats.byAgent.length > 0 && (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">Chats por Agente</h3>
              <div className="space-y-2">
                {chatStats.byAgent.map((a) => (
                  <div key={a.agentId} className="flex items-center justify-between bg-gray-900/50 px-4 py-2 rounded-lg">
                    <span className="text-white">{a.agentName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">{a.count} chats</span>
                      <button
                        onClick={() => executeAction('/api/admin-control/chats/close-by-agent', { agentId: a.agentId }, {
                          title: `¿Cerrar chats de ${a.agentName}?`,
                          message: `Se cerrarán ${a.count} chats asignados a este agente.`,
                          severity: 'warning',
                        })}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderFlowsSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Workflow className="text-purple-500" />
          Control de Flows
        </h2>
        <button onClick={loadFlowStats} className="text-gray-400 hover:text-white">
          <RefreshCw size={18} />
        </button>
      </div>

      {flowStats && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Flows" value={flowStats.total} icon={Workflow} color="text-purple-400" />
            <StatCard label="Activos" value={flowStats.active} icon={PlayCircle} color="text-green-400" />
            <StatCard label="Inactivos" value={flowStats.inactive} icon={PauseCircle} color="text-gray-400" />
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Acciones</h3>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                label="Desactivar Todos"
                icon={Power}
                severity="critical"
                onClick={() => executeAction('/api/admin-control/flows/disable-all', {}, {
                  title: '¿Desactivar TODOS los flows?',
                  message: 'Todos los flows activos serán desactivados. Los usuarios no recibirán respuestas automáticas.',
                  severity: 'critical',
                  requirePassword: true,
                })}
              />
              <ActionButton
                label="Recargar Cache"
                icon={RefreshCw}
                severity="info"
                onClick={() => executeAction('/api/admin-control/flows/reload', {}, {
                  title: '¿Recargar cache de flows?',
                  message: 'El cache de flows será limpiado. Se recargarán desde la base de datos en el próximo uso.',
                  severity: 'warning',
                })}
              />
              <ActionButton
                label="Eliminar Inactivos (90+ días)"
                icon={Trash2}
                severity="danger"
                onClick={() => executeAction('/api/admin-control/flows/delete-inactive', { inactiveDays: 90 }, {
                  title: '¿Eliminar flows inactivos?',
                  message: 'Se eliminarán flows que han estado inactivos por más de 90 días.',
                  severity: 'danger',
                  requirePassword: true,
                })}
              />
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Flows ({flowStats.flows.length})</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {flowStats.flows.map((f) => (
                <div key={f._id} className="flex items-center justify-between bg-gray-900/50 px-4 py-2 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${f.enabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-white">{f.name}</span>
                  </div>
                  <span className="text-gray-400 text-sm">{f.executionCount} ejecuciones</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderDatabaseSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Database className="text-red-500" />
          Control de Base de Datos
        </h2>
        <button onClick={loadCollections} className="text-gray-400 hover:text-white">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="bg-red-900/30 border-2 border-red-500 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="text-red-500" />
          <h3 className="text-lg font-bold text-red-400">⚠️ ZONA DE PELIGRO</h3>
        </div>
        <p className="text-red-200 text-sm">
          Las operaciones en esta sección pueden causar pérdida permanente de datos. 
          Asegúrate de tener backups antes de continuar.
        </p>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Colecciones ({collections.length})</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {collections.map((col) => (
            <div key={col.name} className="flex items-center justify-between bg-gray-900/50 px-4 py-3 rounded-lg">
              <div>
                <span className="text-white font-medium">{col.name}</span>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span>{col.count.toLocaleString()} docs</span>
                  <span>{col.size}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => executeAction('/api/admin-control/database/rebuild-indexes', { collectionName: col.name }, {
                    title: `¿Reconstruir índices de ${col.name}?`,
                    message: 'Los índices serán reconstruidos. Esto puede tomar tiempo en colecciones grandes.',
                    severity: 'warning',
                  })}
                  className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded"
                >
                  Rebuild Index
                </button>
                <button
                  onClick={() => {
                    const phrase = `CLEAR ${col.name.toUpperCase()}`;
                    executeAction('/api/admin-control/database/clear-collection', { collectionName: col.name, confirmPhrase: phrase }, {
                      title: `¿VACIAR ${col.name}?`,
                      message: `Se eliminarán TODOS los ${col.count.toLocaleString()} documentos de esta colección.`,
                      severity: 'critical',
                      confirmPhrase: phrase,
                      requirePassword: true,
                    });
                  }}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded"
                  disabled={col.name === 'agents' || col.name === 'adminauditlogs'}
                >
                  Clear
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCacheSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Server className="text-orange-500" />
          Cache & Colas
        </h2>
        <button onClick={() => { loadCacheStats(); loadQueueStats(); }} className="text-gray-400 hover:text-white">
          <RefreshCw size={18} />
        </button>
      </div>

      {cacheStats && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Redis Cache</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard label="Total Keys" value={cacheStats.keys} icon={Database} color="text-orange-400" />
            <StatCard label="Memoria" value={cacheStats.usedMemory} icon={HardDrive} color="text-purple-400" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {Object.entries(cacheStats.keysByPrefix).map(([prefix, count]) => (
              <div key={prefix} className="bg-gray-900/50 px-3 py-2 rounded flex justify-between">
                <span className="text-gray-400">{prefix}:</span>
                <span className="text-white">{count}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            {Object.keys(cacheStats.keysByPrefix).map((prefix) => (
              <button
                key={prefix}
                onClick={() => executeAction('/api/admin-control/cache/clear-prefix', { prefix }, {
                  title: `¿Limpiar cache ${prefix}?`,
                  message: `Se eliminarán todas las keys con prefijo "${prefix}".`,
                  severity: 'warning',
                })}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-sm rounded"
              >
                Clear {prefix}
              </button>
            ))}
            <ActionButton
              label="FLUSH ALL"
              icon={Trash2}
              severity="critical"
              onClick={() => {
                const phrase = 'FLUSH ALL CACHE';
                executeAction('/api/admin-control/cache/flush-all', { confirmPhrase: phrase }, {
                  title: '¿VACIAR TODO EL CACHE?',
                  message: 'Se eliminarán TODAS las keys de Redis. Esto afectará el rendimiento temporalmente.',
                  severity: 'critical',
                  confirmPhrase: phrase,
                  requirePassword: true,
                });
              }}
            />
          </div>
        </div>
      )}

      {queueStats && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Colas BullMQ</h3>
          <div className="space-y-4">
            {Object.entries(queueStats).map(([queueName, stats]) => (
              <div key={queueName} className="bg-gray-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-medium capitalize">{queueName.replace('Queue', '')}</h4>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const name = queueName.replace('Queue', '') as 'scheduled' | 'inactivity' | 'flow' | 'cleanup' | 'notifications';
                        executeAction('/api/admin-control/queue/pause', { queueName: name }, {
                          title: `¿Pausar cola ${name}?`,
                          message: 'Los jobs no serán procesados hasta que la cola sea reanudada.',
                          severity: 'warning',
                        });
                      }}
                      className="px-2 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded"
                    >
                      <PauseCircle size={14} />
                    </button>
                    <button
                      onClick={() => {
                        const name = queueName.replace('Queue', '') as 'scheduled' | 'inactivity' | 'flow' | 'cleanup' | 'notifications';
                        executeAction('/api/admin-control/queue/resume', { queueName: name }, {
                          title: `¿Reanudar cola ${name}?`,
                          message: 'La cola continuará procesando jobs.',
                          severity: 'warning',
                        });
                      }}
                      className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded"
                    >
                      <PlayCircle size={14} />
                    </button>
                    <button
                      onClick={() => {
                        const name = queueName.replace('Queue', '') as 'scheduled' | 'inactivity' | 'flow' | 'cleanup' | 'notifications';
                        executeAction('/api/admin-control/queue/clear-failed', { queueName: name }, {
                          title: `¿Limpiar jobs fallidos de ${name}?`,
                          message: `Se eliminarán ${stats.failed} jobs fallidos.`,
                          severity: 'warning',
                        });
                      }}
                      className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-2 text-sm">
                  <div className="text-center">
                    <p className="text-yellow-400 font-bold">{stats.waiting}</p>
                    <p className="text-gray-500 text-xs">Waiting</p>
                  </div>
                  <div className="text-center">
                    <p className="text-blue-400 font-bold">{stats.active}</p>
                    <p className="text-gray-500 text-xs">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-green-400 font-bold">{stats.completed}</p>
                    <p className="text-gray-500 text-xs">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-red-400 font-bold">{stats.failed}</p>
                    <p className="text-gray-500 text-xs">Failed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-purple-400 font-bold">{stats.delayed}</p>
                    <p className="text-gray-500 text-xs">Delayed</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderSessionsSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="text-green-500" />
          Control de Sesiones
        </h2>
        <button onClick={loadSessionStats} className="text-gray-400 hover:text-white">
          <RefreshCw size={18} />
        </button>
      </div>

      {sessionStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Conectados" value={sessionStats.connectedAgents} icon={Users} color="text-green-400" />
            {Object.entries(sessionStats.byRole).map(([role, count]) => (
              <StatCard key={role} label={role} value={count} icon={Users} color="text-blue-400" />
            ))}
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Acciones Globales</h3>
            <div className="flex flex-wrap gap-3">
              <ActionButton
                label="Cerrar Todas las Sesiones"
                icon={LogOut}
                severity="critical"
                onClick={() => {
                  const phrase = 'LOGOUT ALL USERS';
                  executeAction('/api/admin-control/sessions/logout-all', { confirmPhrase: phrase }, {
                    title: '¿Cerrar TODAS las sesiones?',
                    message: 'Todos los usuarios serán desconectados inmediatamente.',
                    severity: 'critical',
                    confirmPhrase: phrase,
                    requirePassword: true,
                  });
                }}
              />
              <ActionButton
                label="Logout Agentes"
                icon={LogOut}
                severity="warning"
                onClick={() => executeAction('/api/admin-control/sessions/logout-by-role', { role: 'support' }, {
                  title: '¿Cerrar sesiones de agentes?',
                  message: 'Todos los agentes con rol "support" serán desconectados.',
                  severity: 'warning',
                })}
              />
              <ActionButton
                label="Logout Supervisores"
                icon={LogOut}
                severity="warning"
                onClick={() => executeAction('/api/admin-control/sessions/logout-by-role', { role: 'supervisor' }, {
                  title: '¿Cerrar sesiones de supervisores?',
                  message: 'Todos los supervisores serán desconectados.',
                  severity: 'warning',
                })}
              />
            </div>
          </div>

          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-4">Usuarios ({sessionStats.agents.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sessionStats.agents.map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-gray-900/50 px-4 py-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${a.connected ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <div>
                      <span className="text-white font-medium">{a.name}</span>
                      <span className="text-gray-400 text-sm ml-2">({a.role})</span>
                      {!a.isActive && <span className="text-red-400 text-xs ml-2">[Desactivado]</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {a.isActive ? (
                      <button
                        onClick={() => executeAction('/api/admin-control/sessions/block-user', { agentId: a.id, reason: 'Bloqueado por admin' }, {
                          title: `¿Desactivar a ${a.name}?`,
                          message: 'El usuario no podrá iniciar sesión hasta ser reactivado.',
                          severity: 'warning',
                        })}
                        className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded flex items-center gap-1"
                      >
                        <UserX size={14} />
                        Desactivar
                      </button>
                    ) : (
                      <button
                        onClick={() => executeAction('/api/admin-control/sessions/unblock-user', { agentId: a.id }, {
                          title: `¿Reactivar a ${a.name}?`,
                          message: 'El usuario podrá iniciar sesión nuevamente.',
                          severity: 'warning',
                        })}
                        className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded flex items-center gap-1"
                      >
                        <UserCheck size={14} />
                        Reactivar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderSystemSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="text-cyan-500" />
          Estado del Sistema
        </h2>
        <button onClick={loadSystemStats} className="text-gray-400 hover:text-white">
          <RefreshCw size={18} />
        </button>
      </div>

      {systemStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="CPU" value={`${systemStats.cpu.usage}%`} icon={Cpu} color={systemStats.cpu.usage > 80 ? 'text-red-400' : 'text-green-400'} />
            <StatCard label="Memoria" value={`${systemStats.memory.usagePercent}%`} icon={HardDrive} color={systemStats.memory.usagePercent > 80 ? 'text-red-400' : 'text-green-400'} />
            <StatCard label="WebSockets" value={systemStats.websocketConnections} icon={Users} color="text-blue-400" />
            <StatCard label="Uptime" value={systemStats.uptime} icon={Clock} color="text-gray-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2">
                {systemStats.mongoConnected ? <Wifi className="text-green-500" /> : <WifiOff className="text-red-500" />}
                <span className="text-white">MongoDB</span>
              </div>
              <p className={`text-sm ${systemStats.mongoConnected ? 'text-green-400' : 'text-red-400'}`}>
                {systemStats.mongoConnected ? 'Conectado' : 'Desconectado'}
              </p>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2">
                {systemStats.redisConnected ? <Wifi className="text-green-500" /> : <WifiOff className="text-red-500" />}
                <span className="text-white">Redis</span>
              </div>
              <p className={`text-sm ${systemStats.redisConnected ? 'text-green-400' : 'text-red-400'}`}>
                {systemStats.redisConnected ? 'Conectado' : 'Desconectado'}
              </p>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Server className="text-gray-400" />
                <span className="text-white">Node.js</span>
              </div>
              <p className="text-sm text-gray-400">{systemStats.nodeVersion}</p>
            </div>
          </div>

          {maintenanceStatus && (
            <div className={`rounded-lg p-4 border-2 ${maintenanceStatus.enabled ? 'bg-yellow-900/30 border-yellow-500' : 'bg-gray-800/50 border-gray-700'}`}>
              <h3 className="text-lg font-semibold text-white mb-4">Modo Mantenimiento</h3>
              {maintenanceStatus.enabled ? (
                <div>
                  <p className="text-yellow-300 mb-2">🛠️ Mantenimiento ACTIVO</p>
                  <p className="text-gray-400 text-sm">Mensaje: {maintenanceStatus.message}</p>
                  <p className="text-gray-400 text-sm">Activado por: {maintenanceStatus.enabledBy}</p>
                  <ActionButton
                    label="Desactivar Mantenimiento"
                    icon={Power}
                    severity="info"
                    onClick={() => executeAction('/api/admin-control/maintenance/disable', {}, {
                      title: '¿Desactivar modo mantenimiento?',
                      message: 'El sistema volverá a operar normalmente.',
                      severity: 'warning',
                    })}
                  />
                </div>
              ) : (
                <div>
                  <p className="text-gray-400 mb-4">El sistema está operando normalmente.</p>
                  <ActionButton
                    label="Activar Modo Mantenimiento"
                    icon={Settings}
                    severity="warning"
                    onClick={() => executeAction('/api/admin-control/maintenance/enable', { message: 'Sistema en mantenimiento. Por favor espere.' }, {
                      title: '¿Activar modo mantenimiento?',
                      message: 'Los usuarios verán un mensaje de mantenimiento.',
                      severity: 'warning',
                    })}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderAuditSection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="text-gray-400" />
          Logs de Auditoría ({auditTotal})
        </h2>
        <button onClick={() => loadAuditLogs(auditPage)} className="text-gray-400 hover:text-white">
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="text-left px-4 py-3 text-gray-400 text-sm">Fecha</th>
              <th className="text-left px-4 py-3 text-gray-400 text-sm">Admin</th>
              <th className="text-left px-4 py-3 text-gray-400 text-sm">Acción</th>
              <th className="text-left px-4 py-3 text-gray-400 text-sm">Target</th>
              <th className="text-left px-4 py-3 text-gray-400 text-sm">Resultado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {auditLogs.map((log) => (
              <tr key={log._id} className="hover:bg-gray-800/50">
                <td className="px-4 py-3 text-gray-400 text-sm">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-white text-sm">{log.adminName}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    log.severity === 'critical' || log.severity === 'destructive' 
                      ? 'bg-red-900 text-red-300' 
                      : log.severity === 'warning' 
                        ? 'bg-yellow-900 text-yellow-300'
                        : 'bg-blue-900 text-blue-300'
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-sm">{log.target}</td>
                <td className="px-4 py-3">
                  <span className={`${log.result === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {log.result === 'success' ? '✓' : '✗'}
                    {log.affectedCount !== undefined && ` (${log.affectedCount})`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center gap-2">
        <button
          onClick={() => loadAuditLogs(auditPage - 1)}
          disabled={auditPage <= 1}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="px-4 py-2 text-gray-400">Página {auditPage}</span>
        <button
          onClick={() => loadAuditLogs(auditPage + 1)}
          disabled={auditLogs.length < 20}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  );

  // ============= MAIN RENDER =============

  return (
    <div className="h-full flex bg-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 p-4">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-700">
          <Shield className="text-red-500 w-8 h-8" />
          <div>
            <h1 className="text-lg font-bold text-white">Control Panel</h1>
            <p className="text-xs text-gray-400">Administración del Sistema</p>
          </div>
        </div>

        <nav className="space-y-1">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                activeSection === section.id
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              <section.icon className={section.color} size={20} />
              <span>{section.label}</span>
              {activeSection === section.id && <ChevronRight className="ml-auto" size={16} />}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Result Toast */}
        {actionResult && (
          <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
            actionResult.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          } text-white flex items-center gap-2`}>
            {actionResult.type === 'success' ? <Check size={18} /> : <X size={18} />}
            {actionResult.message}
          </div>
        )}

        {/* Render Active Section */}
        {activeSection === 'chats' && renderChatsSection()}
        {activeSection === 'flows' && renderFlowsSection()}
        {activeSection === 'database' && renderDatabaseSection()}
        {activeSection === 'cache' && renderCacheSection()}
        {activeSection === 'sessions' && renderSessionsSection()}
        {activeSection === 'system' && renderSystemSection()}
        {activeSection === 'audit' && renderAuditSection()}
      </div>

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          severity={confirmModal.severity}
          confirmPhrase={confirmModal.confirmPhrase}
          requirePassword={confirmModal.requirePassword}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
          loading={modalLoading}
        />
      )}
    </div>
  );
}

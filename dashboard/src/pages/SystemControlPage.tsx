import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, MessageSquare, Workflow, Database, Clock, Users, Activity, AlertTriangle,
  Lock, Trash2, Power, RefreshCw, PlayCircle, PauseCircle, UserX, UserCheck, FileText,
  Server, HardDrive, Cpu, Wifi, WifiOff, LogOut, Settings, ChevronRight, X, Check, Eye, EyeOff, LayoutDashboard, Search
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';

// ============= TYPES (Mantenidos intactos) =============

interface ActionResult { ok: boolean; success?: boolean; message?: string; affectedCount?: number; error?: string; }
interface ChatStats { total: number; byStatus: Record<string, number>; byAgent: Array<{ agentId: string; agentName: string; count: number }>; orphan: number; }
interface FlowStats { total: number; active: number; inactive: number; flows: Array<{ _id: string; name: string; enabled: boolean; executionCount: number; updatedAt: Date }>; }
interface CollectionStat { name: string; count: number; size: string; }
interface CacheStats { dbSize: number; usedMemory: string; keys: number; keysByPrefix: Record<string, number>; }
interface QueueStat { waiting: number; active: number; completed: number; failed: number; delayed: number; }
interface QueueStats { scheduledQueue: QueueStat; inactivityQueue: QueueStat; flowQueue: QueueStat; cleanupQueue: QueueStat; notificationsQueue: QueueStat; }
interface SessionStats { connectedAgents: number; byRole: Record<string, number>; agents: Array<{ id: string; name: string; email: string; role: string; connected: boolean; isActive?: boolean }>; }
interface SystemStats { cpu: { usage: number; cores: number }; memory: { total: string; used: string; free: string; usagePercent: number }; uptime: string; nodeVersion: string; mongoConnected: boolean; redisConnected: boolean; websocketConnections: number; }
interface MaintenanceStatus { enabled: boolean; message?: string; enabledBy?: string; enabledAt?: string; }
interface AuditLog { _id: string; adminEmail: string; adminName: string; action: string; category: string; severity: string; target: string; affectedCount?: number; result: string; createdAt: string; }

type SectionId = 'chats' | 'flows' | 'database' | 'cache' | 'sessions' | 'system' | 'audit';

// ============= CONSTANTS =============

const SECTIONS = [
  { id: 'chats' as SectionId, label: 'Control de Chats', icon: MessageSquare, color: 'text-blue-500' },
  { id: 'flows' as SectionId, label: 'Control de Flows', icon: Workflow, color: 'text-purple-500' },
  { id: 'database' as SectionId, label: 'Base de Datos', icon: Database, color: 'text-red-500' },
  { id: 'cache' as SectionId, label: 'Cache & Colas', icon: Server, color: 'text-orange-500' },
  { id: 'sessions' as SectionId, label: 'Sesiones', icon: Users, color: 'text-green-500' },
  { id: 'system' as SectionId, label: 'Sistema', icon: Activity, color: 'text-cyan-500' },
  { id: 'audit' as SectionId, label: 'Auditoría', icon: FileText, color: 'text-zinc-400' },
];

// ============= CONFIRMATION MODAL (Updated UI) =============

interface ConfirmModalProps {
  isOpen: boolean; title: string; message: string; severity: 'warning' | 'danger' | 'critical'; confirmPhrase?: string; requirePassword?: boolean; onConfirm: (password?: string) => void; onCancel: () => void; loading?: boolean;
}

function ConfirmModal({ isOpen, title, message, severity, confirmPhrase, requirePassword, onConfirm, onCancel, loading }: ConfirmModalProps) {
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { if (!isOpen) { setPassword(''); setPhrase(''); setShowPassword(false); } }, [isOpen]);

  if (!isOpen) return null;

  const canConfirm = (!requirePassword || password.length > 0) && (!confirmPhrase || phrase === confirmPhrase);

  const theme = {
    critical: { bg: 'bg-red-950', border: 'border-red-900', icon: 'text-red-500', btn: 'bg-red-600 hover:bg-red-500' },
    danger: { bg: 'bg-zinc-900', border: 'border-red-500/50', icon: 'text-red-400', btn: 'bg-red-600 hover:bg-red-500' },
    warning: { bg: 'bg-zinc-900', border: 'border-amber-500/50', icon: 'text-amber-400', btn: 'bg-amber-600 hover:bg-amber-500' },
    info: { bg: 'bg-zinc-900', border: 'border-blue-500/50', icon: 'text-blue-400', btn: 'bg-blue-600 hover:bg-blue-500' },
    default: { bg: 'bg-zinc-900', border: 'border-zinc-800', icon: 'text-zinc-400', btn: 'bg-zinc-700 hover:bg-zinc-600' },
  }[severity || 'default'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md  border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${theme.bg} ${theme.border}`}>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-full bg-black/40 border border-white/5 ${theme.icon}`}>
               <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-zinc-50">{title}</h3>
          </div>

          <p className="text-zinc-300 mb-6 leading-relaxed">{message}</p>

          {severity === 'critical' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
              <p className="text-red-400 text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4"/> ACCIÓN DESTRUCTIVA IRREVERSIBLE
              </p>
            </div>
          )}

          <div className="space-y-4">
            {confirmPhrase && (
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercasemb-2">
                  Escribe <span className="text-red-400 font-mono select-all">{confirmPhrase}</span>
                </label>
                <input
                  type="text"
                  value={phrase}
                  onChange={(e) => setPhrase(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/40 border border-zinc-700 rounded-xl text-zinc-50 focus:border-red-500 focus:outline-none transition-all placeholder-zinc-600"
                  placeholder="Confirmar frase..."
                  autoComplete="off"
                />
              </div>
            )}

            {requirePassword && (
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercasemb-2">Contraseña de Administrador</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 bg-black/40 border border-zinc-700 rounded-xl text-zinc-50 focus:border-red-500 focus:outline-none transition-all pr-10"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-zinc-400 hover:text-zinc-50 font-medium transition-colors">Cancelar</button>
          <button onClick={() => onConfirm(password)} disabled={!canConfirm || loading} className={`px-6 py-2 rounded-xl text-zinc-50 font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${theme.btn}`}>
            {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />} Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= UI COMPONENTS =============

function ActionButton({ label, icon: Icon, severity, onClick, disabled, loading }: any) {
  const styles = {
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20',
    danger: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20',
    critical: 'bg-red-600 text-zinc-50 border-red-700 hover:bg-red-700 shadow-red-900/20 shadow-lg',
  }[severity as string];

  return (
    <button onClick={onClick} disabled={disabled || loading} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${styles}`}>
      {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors">
      <div className={`p-3 rounded-xl bg-zinc-950 border border-zinc-800 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-50 tracking-tight">{value}</p>
        <p className="text-xs font-medium text-zinc-500 ">{label}</p>
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

  // States
  const [chatStats, setChatStats] = useState<ChatStats | null>(null);
  const [flowStats, setFlowStats] = useState<FlowStats | null>(null);
  const [collections, setCollections] = useState<CollectionStat[]>([]);
  const [collectionSearch, setCollectionSearch] = useState('');
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [maintenanceStatus, setMaintenanceStatus] = useState<MaintenanceStatus | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);

  const [confirmModal, setConfirmModal] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

  if (agent?.role !== 'admin') return <div className="flex items-center justify-center h-full bg-zinc-950 text-zinc-500"><Shield className="w-12 h-12 mb-4"/><p>Acceso Restringido</p></div>;

  // --- API CALLS (Misma lógica original) ---
  const loadChatStats = async () => { try { const res = await api.get<{ ok: boolean; data: ChatStats }>('/api/admin-control/chats/stats'); if (res.ok) setChatStats(res.data.data); } catch (e) { console.error(e); } };
  const loadFlowStats = async () => { try { const res = await api.get<{ ok: boolean; data: FlowStats }>('/api/admin-control/flows/stats'); if (res.ok) setFlowStats(res.data.data); } catch (e) { console.error(e); } };
  const loadCollections = async () => { try { const res = await api.get<{ ok: boolean; data: CollectionStat[] }>('/api/admin-control/database/collections'); if (res.ok) setCollections(res.data.data); } catch (e) { console.error(e); } };
  const loadCacheStats = async () => { try { const res = await api.get<{ ok: boolean; data: CacheStats }>('/api/admin-control/cache/stats'); if (res.ok) setCacheStats(res.data.data); } catch (e) { console.error(e); } };
  const loadQueueStats = async () => { try { const res = await api.get<{ ok: boolean; data: QueueStats }>('/api/admin-control/queue/stats'); if (res.ok) setQueueStats(res.data.data); } catch (e) { console.error(e); } };
  const loadSessionStats = async () => { try { const res = await api.get<{ ok: boolean; data: SessionStats }>('/api/admin-control/sessions/stats'); if (res.ok) setSessionStats(res.data.data); } catch (e) { console.error(e); } };
  const loadSystemStats = async () => { try { const [s, m] = await Promise.all([api.get<any>('/api/admin-control/stats'), api.get<any>('/api/admin-control/maintenance/status')]); if (s.ok) setSystemStats(s.data.data); if (m.ok) setMaintenanceStatus(m.data.data); } catch (e) { console.error(e); } };
  const loadAuditLogs = async (p = 1) => { try { const res = await api.get<any>(`/api/admin-control/audit/logs?page=${p}&limit=20`); if (res.ok) { setAuditLogs(res.data.data.logs); setAuditTotal(res.data.data.total); setAuditPage(p); } } catch (e) { console.error(e); } };

  useEffect(() => {
    switch (activeSection) {
      case 'chats': loadChatStats(); break;
      case 'flows': loadFlowStats(); break;
      case 'database': loadCollections(); break;
      case 'cache': loadCacheStats(); loadQueueStats(); break;
      case 'sessions': loadSessionStats(); break;
      case 'system': loadSystemStats(); break;
      case 'audit': loadAuditLogs(1); break;
    }
  }, [activeSection]);

  const showResult = (message: string, type: 'success' | 'error') => { setActionResult({ message, type }); setTimeout(() => setActionResult(null), 5000); };
  
  const executeAction = async (endpoint: string, body: any = {}, opts: any) => {
    setConfirmModal({
      ...opts, isOpen: true,
      onConfirm: async (pwd?: string) => {
        setModalLoading(true);
        try {
          if (opts.requirePassword) {
             const v = await api.post<any>('/api/admin-control/verify-password', { password: pwd });
             if (!v.ok) { showResult('Contraseña incorrecta', 'error'); setModalLoading(false); return; }
          }
          const finalBody = opts.confirmPhrase ? { ...body, confirmPhrase: opts.confirmPhrase } : body;
          const res = await api.post<ActionResult>(endpoint, finalBody);
          if (res.ok && (res.data?.ok || res.data?.success)) {
             showResult(res.data?.message || 'Acción completada', 'success');
             // Reload current section
             if (activeSection === 'chats') loadChatStats();
             if (activeSection === 'flows') loadFlowStats();
             if (activeSection === 'database') loadCollections();
             if (activeSection === 'cache') { loadCacheStats(); loadQueueStats(); }
             if (activeSection === 'sessions') loadSessionStats();
             if (activeSection === 'system') loadSystemStats();
          } else { showResult(res.data?.error || 'Error', 'error'); }
        } catch { showResult('Error de conexión', 'error'); } 
        finally { setModalLoading(false); setConfirmModal(null); }
      }
    });
  };

  // ============= RENDERERS =============

  const renderChatsSection = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-zinc-50 flex items-center gap-3"><MessageSquare className="text-blue-500 w-8 h-8" /> Control de Chats</h2>
            <p className="text-zinc-400 mt-1">Gestión masiva de conversaciones</p>
        </div>
        <button onClick={loadChatStats} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors"><RefreshCw size={20}/></button>
      </div>

      {chatStats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Chats" value={chatStats.total} icon={MessageSquare} color="text-blue-400" />
            <StatCard label="Activos" value={chatStats.byStatus.human || 0} icon={Users} color="text-emerald-400" />
            <StatCard label="En Espera" value={chatStats.byStatus.waiting || 0} icon={Clock} color="text-amber-400" />
            <StatCard label="Huérfanos" value={chatStats.orphan} icon={AlertTriangle} color="text-red-400" />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-500 st mb-6">Acciones Globales</h3>
            <div className="flex flex-wrap gap-4">
              <ActionButton label="Cerrar Todos" icon={Power} severity="critical" onClick={() => executeAction('/api/admin-control/chats/close-all', { reason: 'Force close' }, { title: 'Cerrar TODO', message: 'Se cerrarán todos los chats activos.', severity: 'critical', requirePassword: true })} />
              <ActionButton label="Purgar Huérfanos" icon={Trash2} severity="warning" onClick={() => executeAction('/api/admin-control/chats/delete-orphans', {}, { title: 'Eliminar Huérfanos', message: `Se eliminarán ${chatStats.orphan} chats rotos.`, severity: 'warning' })} />
              <ActionButton label="Borrar Historial (24h)" icon={Trash2} severity="danger" onClick={() => executeAction('/api/admin-control/chats/delete-history', { period: '24h' }, { title: 'Eliminar > 24h', message: 'Borrado permanente de mensajes.', severity: 'danger', requirePassword: true })} />
            </div>
          </div>

          {chatStats.byAgent.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h3 className="text-sm font-bold text-zinc-500 st mb-4">Chats por Agente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chatStats.byAgent.map((a) => (
                  <div key={a.agentId} className="flex items-center justify-between bg-zinc-950/50 border border-zinc-800/50 px-5 py-3 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 font-bold text-xs">{a.agentName.charAt(0)}</div>
                        <div>
                            <span className="text-zinc-50 block font-medium">{a.agentName}</span>
                            <span className="text-xs text-zinc-500">{a.count} conversaciones</span>
                        </div>
                    </div>
                    <button onClick={() => executeAction('/api/admin-control/chats/close-by-agent', { agentId: a.agentId }, { title: `Cerrar chats de ${a.agentName}`, message: 'Se cerrarán sus sesiones activas.', severity: 'warning' })} className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold rounded-lg transition-colors">Cerrar Todo</button>
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Same structure, Zinc styles */}
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-zinc-50 flex items-center gap-3"><Workflow className="text-purple-500 w-8 h-8"/> Control de Flows</h2>
            <button onClick={loadFlowStats} className="text-zinc-400 hover:text-zinc-50 p-2 hover:bg-zinc-800 rounded-lg"><RefreshCw size={20}/></button>
        </div>
        
        {flowStats && (
            <>
                <div className="grid grid-cols-3 gap-4">
                    <StatCard label="Total" value={flowStats.total} icon={Workflow} color="text-purple-400"/>
                    <StatCard label="Activos" value={flowStats.active} icon={PlayCircle} color="text-emerald-400"/>
                    <StatCard label="Inactivos" value={flowStats.inactive} icon={PauseCircle} color="text-zinc-500"/>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-zinc-500 st mb-6">Mantenimiento</h3>
                    <div className="flex gap-4">
                        <ActionButton label="Desactivar Todos" icon={Power} severity="critical" onClick={() => executeAction('/api/admin-control/flows/disable-all', {}, { title: 'Apagar Flows', message: 'Se detendrá toda automatización.', severity: 'critical', requirePassword: true })} />
                        <ActionButton label="Recargar Cache" icon={RefreshCw} severity="info" onClick={() => executeAction('/api/admin-control/flows/reload', {}, { title: 'Recargar', message: 'Refrescar cache de flows.', severity: 'info' })} />
                    </div>
                </div>
                {/* List of flows with simpler design */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-800"><h3 className="font-semibold text-zinc-50">Detalle de Flows</h3></div>
                    <div className="divide-y divide-zinc-800">
                        {flowStats.flows.map(f => (
                            <div key={f._id} className="px-6 py-3 flex justify-between items-center hover:bg-zinc-800/30">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${f.enabled ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-600'}`}/>
                                    <span className="text-zinc-300 font-medium">{f.name}</span>
                                </div>
                                <span className="text-zinc-500 text-sm font-mono">{f.executionCount} ejecs</span>
                            </div>
                        ))}
                    </div>
                </div>
            </>
        )}
    </div>
  );

  const renderSystemSection = () => (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
             <h2 className="text-2xl font-bold text-zinc-50 flex gap-3"><Activity className="text-cyan-500 w-8 h-8"/> Estado del Sistema</h2>
             <button onClick={loadSystemStats} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50"><RefreshCw size={20}/></button>
          </div>

          {systemStats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="CPU" value={`${systemStats.cpu.usage}%`} icon={Cpu} color={systemStats.cpu.usage > 80 ? 'text-red-400' : 'text-emerald-400'} />
                    <StatCard label="RAM" value={`${systemStats.memory.usagePercent}%`} icon={HardDrive} color={systemStats.memory.usagePercent > 80 ? 'text-red-400' : 'text-emerald-400'} />
                    <StatCard label="Conexiones" value={systemStats.websocketConnections} icon={Wifi} color="text-blue-400" />
                    <StatCard label="Uptime" value={systemStats.uptime} icon={Clock} color="text-zinc-400" />
                </div>

                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Database className="text-zinc-400"/>
                            <div><div className="text-zinc-50 font-medium">MongoDB</div><div className={`text-xs ${systemStats.mongoConnected ? 'text-emerald-400' : 'text-red-400'}`}>{systemStats.mongoConnected ? 'Conectado' : 'Error'}</div></div>
                        </div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Server className="text-zinc-400"/>
                            <div><div className="text-zinc-50 font-medium">Redis</div><div className={`text-xs ${systemStats.redisConnected ? 'text-emerald-400' : 'text-red-400'}`}>{systemStats.redisConnected ? 'Conectado' : 'Error'}</div></div>
                        </div>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <LayoutDashboard className="text-zinc-400"/>
                            <div><div className="text-zinc-50 font-medium">Node Version</div><div className="text-xs text-zinc-500">{systemStats.nodeVersion}</div></div>
                        </div>
                    </div>
                </div>

                {maintenanceStatus && (
                    <div className={`p-6 rounded-2xl border-2 flex items-start justify-between ${maintenanceStatus.enabled ? 'bg-amber-950/20 border-amber-600/30' : 'bg-zinc-900 border-zinc-800'}`}>
                        <div>
                            <h3 className={`text-lg font-bold mb-1 ${maintenanceStatus.enabled ? 'text-amber-400' : 'text-zinc-100'}`}>Modo Mantenimiento</h3>
                            <p className="text-zinc-400 text-sm">{maintenanceStatus.enabled ? `Activo: "${maintenanceStatus.message}"` : 'El sistema opera normalmente.'}</p>
                        </div>
                        <ActionButton 
                            label={maintenanceStatus.enabled ? "Desactivar" : "Activar"} 
                            icon={Power} 
                            severity={maintenanceStatus.enabled ? "info" : "warning"} 
                            onClick={() => executeAction(maintenanceStatus.enabled ? '/api/admin-control/maintenance/disable' : '/api/admin-control/maintenance/enable', { message: 'Mantenimiento en curso' }, { title: 'Cambiar Modo', message: 'Confirmar cambio de estado de mantenimiento.', severity: 'warning' })}
                        />
                    </div>
                )}
              </>
          )}
      </div>
  );

  const renderSessionsSection = () => (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
             <h2 className="text-2xl font-bold text-zinc-50 flex gap-3"><Users className="text-green-500 w-8 h-8"/> Sesiones</h2>
             <button onClick={loadSessionStats} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50"><RefreshCw size={20}/></button>
          </div>
          {sessionStats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Online" value={sessionStats.connectedAgents} icon={Wifi} color="text-emerald-400" />
                    {Object.entries(sessionStats.byRole).map(([r, c]) => <StatCard key={r} label={r} value={c} icon={Users} color="text-zinc-300" />)}
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-zinc-500 st mb-4">Acciones Masivas</h3>
                    <div className="flex gap-4">
                        <ActionButton label="Logout Global" icon={LogOut} severity="critical" onClick={() => executeAction('/api/admin-control/sessions/logout-all', { confirmPhrase: 'LOGOUT ALL' }, { title: 'Cerrar Sesión Global', message: 'Desconectar a TODOS los usuarios.', severity: 'critical', confirmPhrase: 'LOGOUT ALL', requirePassword: true })} />
                        <ActionButton label="Logout Agentes" icon={LogOut} severity="warning" onClick={() => executeAction('/api/admin-control/sessions/logout-by-role', { role: 'support' }, { title: 'Logout Agentes', message: 'Desconectar rol support.', severity: 'warning' })} />
                    </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                    <div className="px-6 py-4 border-b border-zinc-800"><h3 className="font-semibold text-zinc-50">Usuarios ({sessionStats.agents.length})</h3></div>
                    <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto custom-scrollbar">
                        {sessionStats.agents.map(a => (
                            <div key={a.id} className="px-6 py-3 flex justify-between items-center hover:bg-zinc-800/30">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2.5 h-2.5 rounded-full ${a.connected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-600'}`} />
                                    <div>
                                        <div className="text-zinc-200 font-medium flex items-center gap-2">{a.name} {!a.isActive && <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">Bloqueado</span>}</div>
                                        <div className="text-xs text-zinc-500">{a.role} • {a.email}</div>
                                    </div>
                                </div>
                                {a.isActive ? (
                                    <button onClick={() => executeAction('/api/admin-control/sessions/block-user', { agentId: a.id }, { title: `Bloquear a ${a.name}`, message: 'No podrá acceder.', severity: 'warning' })} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg"><UserX size={16}/></button>
                                ) : (
                                    <button onClick={() => executeAction('/api/admin-control/sessions/unblock-user', { agentId: a.id }, { title: `Desbloquear a ${a.name}`, message: 'Podrá acceder.', severity: 'info' })} className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><UserCheck size={16}/></button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
              </>
          )}
      </div>
  );

  const renderAuditSection = () => (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex justify-between items-center">
             <h2 className="text-2xl font-bold text-zinc-50 flex gap-3"><FileText className="text-zinc-400 w-8 h-8"/> Logs de Auditoría</h2>
             <button onClick={() => loadAuditLogs(auditPage)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50"><RefreshCw size={20}/></button>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm text-zinc-400">
                  <thead className="bg-zinc-950 border-b border-zinc-800 font-bold text-xstext-zinc-500">
                      <tr><th className="px-6 py-3">Fecha</th><th className="px-6 py-3">Admin</th><th className="px-6 py-3">Acción</th><th className="px-6 py-3">Target</th><th className="px-6 py-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                      {auditLogs.map(log => (
                          <tr key={log._id} className="hover:bg-zinc-800/30">
                              <td className="px-6 py-3">{new Date(log.createdAt).toLocaleString()}</td>
                              <td className="px-6 py-3 text-zinc-50">{log.adminName}</td>
                              <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-xs border ${log.severity === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>{log.action}</span></td>
                              <td className="px-6 py-3 font-mono text-xs">{log.target}</td>
                              <td className="px-6 py-3 text-xs">{log.result === 'success' ? <span className="text-emerald-400">Exitosa</span> : <span className="text-red-400">Fallida</span>}</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
              <div className="px-6 py-3 border-t border-zinc-800 flex justify-between items-center text-xs">
                  <button disabled={auditPage <= 1} onClick={() => loadAuditLogs(auditPage - 1)} className="hover:text-zinc-50 disabled:opacity-50">Anterior</button>
                  <span>Página {auditPage}</span>
                  <button disabled={auditLogs.length < 20} onClick={() => loadAuditLogs(auditPage + 1)} className="hover:text-zinc-50 disabled:opacity-50">Siguiente</button>
              </div>
          </div>
      </div>
  );

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      
      {/* Sidebar */}
      <div className="w-72 bg-zinc-900/30 border-r border-zinc-800 flex flex-col shrink-0 z-20">
        <div className="p-6 border-b border-zinc-800/50">
            <h1 className="text-xl font-bold text-zinc-50 tracking-tight flex items-center gap-3"><Shield className="text-red-500"/> Panel Admin</h1>
            <p className="text-sm text-zinc-500 mt-1 pl-9">Control DevOps</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
            {SECTIONS.map(s => (
                <button key={s.id} onClick={() => setActiveSection(s.id)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${activeSection === s.id ? 'bg-zinc-800 text-zinc-50 shadow-lg shadow-black/20' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}>
                    <s.icon className={`w-5 h-5 ${activeSection === s.id ? s.color : 'text-zinc-500'}`} />
                    <span className="text-sm font-medium">{s.label}</span>
                    {activeSection === s.id && <ChevronRight className="w-4 h-4 ml-auto text-zinc-600"/>}
                </button>
            ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
         <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {actionResult && <div className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border ${actionResult.type === 'success' ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-100' : 'bg-red-900/90 border-red-500/30 text-red-100'} animate-in slide-in-from-top-4 fade-in`}>{actionResult.type === 'success' ? <Check size={18}/> : <X size={18}/>}{actionResult.message}</div>}
            
            {activeSection === 'chats' && renderChatsSection()}
            {activeSection === 'flows' && renderFlowsSection()}
            {activeSection === 'system' && renderSystemSection()}
            {activeSection === 'sessions' && renderSessionsSection()}
            {activeSection === 'audit' && renderAuditSection()}
            {/* Database & Cache renderers reuse similar patterns, omitted for brevity but logic is above */}
            {activeSection === 'database' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-zinc-50 flex gap-3"><Database className="text-red-500 w-8 h-8"/> Base de Datos</h2>
                        <button onClick={loadCollections} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50"><RefreshCw size={20}/></button>
                    </div>
                    <div className="bg-red-950/20 border border-red-900/50 p-6 rounded-2xl flex gap-4 items-start">
                        <AlertTriangle className="text-red-500 w-6 h-6 shrink-0"/>
                        <div>
                            <h3 className="text-red-400 font-bold mb-1">Zona de Peligro</h3>
                            <p className="text-red-300/70 text-sm">Las acciones aquí eliminan datos permanentemente. Asegúrate de tener backups.</p>
                        </div>
                    </div>
                    {/* Search bar for collections */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500"/>
                        <input
                            type="text"
                            value={collectionSearch}
                            onChange={(e) => setCollectionSearch(e.target.value)}
                            placeholder="Buscar colecciones..."
                            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {collections.filter(c => c.name.toLowerCase().includes(collectionSearch.toLowerCase())).map(c => (
                            <div key={c.name} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl hover:border-zinc-700 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div><h4 className="font-bold text-zinc-200">{c.name}</h4><div className="text-xs text-zinc-500 mt-1">{c.count.toLocaleString()} docs • {c.size}</div></div>
                                    <Database className="text-zinc-700 w-5 h-5"/>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => executeAction('/api/admin-control/database/rebuild-indexes', { collectionName: c.name }, { title: 'Reconstruir Índices', message: 'Puede demorar.', severity: 'warning' })} className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors">Index</button>
                                    <button onClick={() => executeAction('/api/admin-control/database/clear-collection', { collectionName: c.name, confirmPhrase: `CLEAR ${c.name.toUpperCase()}` }, { title: `VACIAR ${c.name}`, message: 'Eliminar todos los datos.', severity: 'critical', confirmPhrase: `CLEAR ${c.name.toUpperCase()}`, requirePassword: true })} disabled={['agents', 'adminauditlogs'].includes(c.name)} className="flex-1 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 text-xs rounded-lg transition-colors disabled:opacity-30">Vaciar</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {activeSection === 'cache' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold text-zinc-50 flex gap-3"><Server className="text-orange-500 w-8 h-8"/> Cache & Colas</h2>
                        <button onClick={() => {loadCacheStats(); loadQueueStats();}} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50"><RefreshCw size={20}/></button>
                    </div>
                    {cacheStats && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                            <h3 className="text-sm font-bold text-zinc-500 st mb-4">Redis Status</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <StatCard label="Keys" value={cacheStats.keys} icon={Database} color="text-orange-400"/>
                                <StatCard label="Memoria" value={cacheStats.usedMemory} icon={HardDrive} color="text-purple-400"/>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <ActionButton label="FLUSH DB" icon={Trash2} severity="critical" onClick={() => executeAction('/api/admin-control/cache/flush-all', { confirmPhrase: 'FLUSH ALL CACHE' }, { title: 'Vaciar Redis', message: 'Se borrará toda la cache.', severity: 'critical', confirmPhrase: 'FLUSH ALL CACHE', requirePassword: true })} />
                                {Object.keys(cacheStats.keysByPrefix).map(p => (
                                    <button key={p} onClick={() => executeAction('/api/admin-control/cache/clear-prefix', { prefix: p }, { title: `Limpiar ${p}`, message: 'Borrar keys con este prefijo.', severity: 'warning' })} className="px-3 py-1.5 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-xs text-zinc-300 transition-colors">Limpiar {p}*</button>
                                ))}
                            </div>
                        </div>
                    )}
                    {queueStats && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(queueStats).map(([qName, qStats]) => (
                                <div key={qName} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-zinc-50 capitalize">{qName.replace('Queue', '')}</h4>
                                        <div className="flex gap-1">
                                            <button onClick={() => executeAction('/api/admin-control/queue/pause', { queueName: qName.replace('Queue', '') }, { title: 'Pausar Cola', message: 'Detener procesamiento.', severity: 'warning' })} className="p-1.5 hover:bg-zinc-800 rounded text-yellow-500"><PauseCircle size={16}/></button>
                                            <button onClick={() => executeAction('/api/admin-control/queue/resume', { queueName: qName.replace('Queue', '') }, { title: 'Reanudar Cola', message: 'Continuar procesamiento.', severity: 'info' })} className="p-1.5 hover:bg-zinc-800 rounded text-green-500"><PlayCircle size={16}/></button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                        <div className="bg-zinc-950 p-2 rounded-lg"><div className="text-blue-400 font-bold text-lg">{qStats.active}</div><div className="text-zinc-600">Activos</div></div>
                                        <div className="bg-zinc-950 p-2 rounded-lg"><div className="text-amber-400 font-bold text-lg">{qStats.waiting}</div><div className="text-zinc-600">Espera</div></div>
                                        <div className="bg-zinc-950 p-2 rounded-lg"><div className="text-red-400 font-bold text-lg">{qStats.failed}</div><div className="text-zinc-600">Fallidos</div></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
         </div>
      </div>

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
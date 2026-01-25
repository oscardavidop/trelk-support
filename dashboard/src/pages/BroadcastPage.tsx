/**
 * BroadcastPage - Mass Messaging System UI
 * Send messages to all users or specific segments
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Navigate } from 'react-router-dom';
import {
  Send,
  Users,
  Target,
  CheckCircle,
  Loader2,
  Clock,
  AlertCircle,
  RefreshCw,
  Trash2,
  Eye,
  Play,
  Pause,
  StopCircle,
  X,
  Megaphone,
  Filter,
  ChevronDown,
  AlertTriangle,
  BarChart3,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle, Slash, MessageSquare,
  Calendar
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { BroadcastCreateSidebar } from '../components/broadcast/BroadcastCreateSidebar';

// ============= TYPES =============

type BroadcastStatus = 'draft' | 'scheduled' | 'pending' | 'sending' | 'paused' | 'completed' | 'cancelled' | 'failed';
type BroadcastTargetType = 'all' | 'segment' | 'manual';
type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'blocked';

interface BroadcastProgress {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  blocked: number;
}

interface BroadcastJob {
  _id: string;
  title: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  targetType: BroadcastTargetType;
  segmentId?: string;
  segmentName?: string;
  status: BroadcastStatus;
  progress: BroadcastProgress;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  createdByName?: string;
}

interface BroadcastRecipient {
  _id: string;
  userId: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  status: DeliveryStatus;
  sentAt?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
}

interface Segment {
  _id: string;
  name: string;
  color: string;
  contactCount: number;
  isActive: boolean;
}

interface ErrorSummary {
  errorCode: string;
  count: number;
  message: string;
}

interface BroadcastStats {
  total: number;
  byStatus: Record<BroadcastStatus, number>;
  totalMessagesSent: number;
  last24h: number;
}

// ============= HELPERS =============

function getStatusConfig(status: BroadcastStatus) {
  const configs: Record<BroadcastStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    draft: {
      label: 'Borrador',
      color: 'text-gray-400',
      bg: 'bg-gray-500/20',
      icon: <Clock className="w-4 h-4" />
    },
    scheduled: {
      label: 'Programado',
      color: 'text-blue-400',
      bg: 'bg-blue-500/20',
      icon: <Clock className="w-4 h-4" />
    },
    pending: {
      label: 'Pendiente',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/20',
      icon: <Clock className="w-4 h-4" />
    },
    sending: {
      label: 'Enviando',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/20',
      icon: <Loader2 className="w-4 h-4 animate-spin" />
    },
    paused: {
      label: 'Pausado',
      color: 'text-orange-400',
      bg: 'bg-orange-500/20',
      icon: <Pause className="w-4 h-4" />
    },
    completed: {
      label: 'Completado',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20',
      icon: <CheckCircle className="w-4 h-4" />
    },
    cancelled: {
      label: 'Cancelado',
      color: 'text-gray-400',
      bg: 'bg-gray-500/20',
      icon: <StopCircle className="w-4 h-4" />
    },
    failed: {
      label: 'Fallido',
      color: 'text-red-400',
      bg: 'bg-red-500/20',
      icon: <AlertCircle className="w-4 h-4" />
    },
  };
  return configs[status] || configs.draft;
}

function getTargetLabel(type: BroadcastTargetType): string {
  const labels: Record<BroadcastTargetType, string> = {
    all: 'Todos los usuarios',
    segment: 'Segmento',
    manual: 'Selección manual',
  };
  return labels[type] || type;
}

function formatNumber(n: number): string {
  return n.toLocaleString('es-ES');
}

// ============= MAIN COMPONENT =============

export default function BroadcastPage() {
  const { agent, token } = useAuthStore();

  // Access control - only admin/supervisor
  const canAccess = agent?.role === 'admin' || agent?.role === 'supervisor';

  // State
  const [broadcasts, setBroadcasts] = useState<BroadcastJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<BroadcastJob | null>(null);

  // Stats
  const [stats, setStats] = useState<BroadcastStats | null>(null);

  // Segments for targeting
  const [segments, setSegments] = useState<Segment[]>([]);

  // Detail view
  const [selectedBroadcast, setSelectedBroadcast] = useState<BroadcastJob | null>(null);
  const [recipients, setRecipients] = useState<BroadcastRecipient[]>([]);
  const [recipientsPage, setRecipientsPage] = useState(1);
  const [recipientsTotal, setRecipientsTotal] = useState(0);
  const [recipientsFilter, setRecipientsFilter] = useState<DeliveryStatus | ''>('');
  const [errors, setErrors] = useState<ErrorSummary[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  // Socket ref
  const socketRef = useRef<Socket | null>(null);

  // ============= API FUNCTIONS =============

  const fetchBroadcasts = useCallback(async () => {
    if (!canAccess) return;

    setLoading(true);
    try {
      const res = await fetch('/api/broadcast', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBroadcasts(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch broadcasts:', error);
    } finally {
      setLoading(false);
    }
  }, [canAccess, token]);

  const fetchStats = useCallback(async () => {
    if (!canAccess) return;

    try {
      const res = await fetch('/api/broadcast/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [canAccess, token]);

  const fetchSegments = useCallback(async () => {
    if (!canAccess) return;

    try {
      const res = await fetch('/api/segments', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSegments(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch segments:', error);
    }
  }, [canAccess, token]);

  const fetchBroadcastDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/broadcast/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedBroadcast(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch broadcast detail:', error);
    }
  }, [token]);

  const fetchRecipients = useCallback(async (id: string, page = 1, status?: DeliveryStatus) => {
    setLoadingRecipients(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (status) params.set('status', status);

      const res = await fetch(`/api/broadcast/${id}/recipients?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecipients(data.data || []);
        setRecipientsTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch recipients:', error);
    } finally {
      setLoadingRecipients(false);
    }
  }, [token]);

  const fetchErrors = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/broadcast/${id}/errors`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setErrors(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch errors:', error);
    }
  }, [token]);

  // ============= ACTIONS =============

  // handleBroadcastCreated - Called after sidebar creates a broadcast
  const handleBroadcastCreated = async () => {
    await fetchBroadcasts();
    await fetchStats();
  };

  const handleStartBroadcast = async (id: string) => {
    try {
      const res = await fetch(`/api/broadcast/${id}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setShowConfirm(null);
        await fetchBroadcasts();
      }
    } catch (error) {
      console.error('Failed to start broadcast:', error);
    }
  };

  const handlePauseBroadcast = async (id: string) => {
    try {
      await fetch(`/api/broadcast/${id}/pause`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchBroadcasts();
    } catch (error) {
      console.error('Failed to pause broadcast:', error);
    }
  };

  const handleResumeBroadcast = async (id: string) => {
    try {
      await fetch(`/api/broadcast/${id}/resume`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchBroadcasts();
    } catch (error) {
      console.error('Failed to resume broadcast:', error);
    }
  };

  const handleCancelBroadcast = async (id: string) => {
    if (!confirm('¿Estás seguro de cancelar este broadcast? Los mensajes ya enviados no se pueden deshacer.')) {
      return;
    }

    try {
      await fetch(`/api/broadcast/${id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchBroadcasts();
      await fetchStats();
    } catch (error) {
      console.error('Failed to cancel broadcast:', error);
    }
  };

  const handleDeleteBroadcast = async (id: string) => {
    if (!confirm('¿Eliminar este broadcast? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      await fetch(`/api/broadcast/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await fetchBroadcasts();
      await fetchStats();
    } catch (error) {
      console.error('Failed to delete broadcast:', error);
    }
  };

  const openDetail = async (broadcast: BroadcastJob) => {
    setShowDetail(broadcast._id);
    setSelectedBroadcast(broadcast);
    setRecipientsPage(1);
    setRecipientsFilter('');
    await Promise.all([
      fetchBroadcastDetail(broadcast._id),
      fetchRecipients(broadcast._id),
      fetchErrors(broadcast._id),
    ]);
  };

  // ============= EFFECTS =============

  useEffect(() => {
    fetchBroadcasts();
    fetchStats();
    fetchSegments();
  }, [fetchBroadcasts, fetchStats, fetchSegments]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    if (!token) return;

    const socket = io({
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      socket.emit('join', 'admin');
    });

    socket.on('broadcast:update', (data) => {
      setBroadcasts(prev =>
        prev.map(b => b._id === data._id ? { ...b, ...data } : b)
      );

      if (selectedBroadcast?._id === data._id) {
        setSelectedBroadcast(prev => prev ? { ...prev, ...data } : null);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token, selectedBroadcast?._id]);

  // Polling for active broadcasts
  useEffect(() => {
    const hasActive = broadcasts.some(b => b.status === 'sending' || b.status === 'pending');
    if (!hasActive) return;

    const interval = setInterval(() => {
      fetchBroadcasts();
    }, 5000);

    return () => clearInterval(interval);
  }, [broadcasts, fetchBroadcasts]);

  // Fetch recipients when filter changes
  useEffect(() => {
    if (showDetail) {
      fetchRecipients(showDetail, recipientsPage, recipientsFilter || undefined);
    }
  }, [showDetail, recipientsPage, recipientsFilter, fetchRecipients]);

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  // Calculate progress percentage
  const getProgress = (p: BroadcastProgress) => {
    if (!p.total) return 0;
    return Math.round(((p.sent + p.failed + p.blocked) / p.total) * 100);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-500/20 rounded-xl">
            <Megaphone className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Broadcast</h1>
            <p className="text-sm text-gray-400">Envía mensajes masivos a tus usuarios</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchBroadcasts(); fetchStats(); }}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg text-white font-medium transition-colors"
          >
            <Send className="w-4 h-4" />
            <span>Nuevo Broadcast</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-gray-800">
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <BarChart3 className="w-4 h-4" />
              Total enviados
            </div>
            <div className="text-2xl font-bold text-white">{formatNumber(stats.totalMessagesSent)}</div>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Últimas 24h
            </div>
            <div className="text-2xl font-bold text-white">{stats.last24h}</div>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-cyan-400 text-sm mb-1">
              <Loader2 className="w-4 h-4" />
              Enviando
            </div>
            <div className="text-2xl font-bold text-white">{stats.byStatus.sending || 0}</div>
          </div>
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 text-emerald-400 text-sm mb-1">
              <CheckCircle className="w-4 h-4" />
              Completados
            </div>
            <div className="text-2xl font-bold text-white">{stats.byStatus.completed || 0}</div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && broadcasts.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Megaphone className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium">No hay broadcasts</p>
            <p className="text-sm">Crea tu primer broadcast para enviar mensajes masivos</p>
          </div>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((broadcast) => (
              <BroadcastCard
                key={broadcast._id}
                broadcast={broadcast}
                onView={() => openDetail(broadcast)}
                onStart={() => handleStartBroadcast(broadcast._id)}
                onPause={() => handlePauseBroadcast(broadcast._id)}
                onResume={() => handleResumeBroadcast(broadcast._id)}
                onCancel={() => handleCancelBroadcast(broadcast._id)}
                onDelete={() => handleDeleteBroadcast(broadcast._id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Broadcast Sidebar */}
      <BroadcastCreateSidebar
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onCreated={handleBroadcastCreated}
        segments={segments}
      />

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-amber-500/20 rounded-full">
                <AlertTriangle className="w-8 h-8 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white text-center mb-2">
                Confirmar envío
              </h2>
              <p className="text-gray-400 text-center mb-6">
                Estás a punto de enviar un mensaje a{' '}
                <span className="text-white font-semibold">
                  {formatNumber(showConfirm.progress.total)} usuarios
                </span>
                . Esta acción no se puede deshacer.
              </p>

              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-400 mb-1">Vista previa:</p>
                <p className="text-white whitespace-pre-wrap text-sm">
                  {showConfirm.message.length > 200
                    ? showConfirm.message.slice(0, 200) + '...'
                    : showConfirm.message
                  }
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirm(null)}
                  className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleStartBroadcast(showConfirm._id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-violet-500 hover:bg-violet-600 rounded-lg text-white font-medium transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Iniciar envío
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedBroadcast && (
        <BroadcastDetailModal
          broadcast={selectedBroadcast}
          recipients={recipients}
          recipientsTotal={recipientsTotal}
          recipientsPage={recipientsPage}
          recipientsFilter={recipientsFilter}
          errors={errors}
          loadingRecipients={loadingRecipients}
          onClose={() => { setShowDetail(null); setSelectedBroadcast(null); }}
          onPageChange={setRecipientsPage}
          onFilterChange={setRecipientsFilter}
          onRefresh={() => {
            fetchBroadcastDetail(showDetail);
            fetchRecipients(showDetail, recipientsPage, recipientsFilter || undefined);
            fetchErrors(showDetail);
          }}
        />
      )}
    </div>
  );
}

// ============= SUB-COMPONENTS =============

interface BroadcastCardProps {
  broadcast: BroadcastJob;
  onView: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

function BroadcastCard({ broadcast, onView, onStart, onPause, onResume, onCancel, onDelete }: BroadcastCardProps) {
  const status = getStatusConfig(broadcast.status);
  
  // Cálculo de porcentajes seguro
  const total = broadcast.progress.total || 1; // Evitar división por cero
  const sentPct = (broadcast.progress.sent / total) * 100;
  const failedPct = (broadcast.progress.failed / total) * 100;
  const blockedPct = (broadcast.progress.blocked / total) * 100;
  
  const progressPercent = broadcast.progress.total > 0
    ? Math.round(((broadcast.progress.sent + broadcast.progress.failed + broadcast.progress.blocked) / broadcast.progress.total) * 100)
    : 0;

  return (
    <div className="group relative bg-gray-900/40 backdrop-blur-sm border border-gray-800 rounded-xl p-5 hover:border-gray-700 hover:shadow-lg hover:shadow-violet-900/5 transition-all duration-300">
      
      <div className="flex flex-col sm:flex-row gap-4 sm:items-start justify-between">
        
        {/* Info Principal */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-100 truncate tracking-tight">
              {broadcast.title}
            </h3>
            <StatusBadge status={status} />
          </div>
          
          <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed max-w-2xl">
            {broadcast.message || <span className="italic opacity-50">Sin mensaje configurado</span>}
          </p>
          
          {/* Metadatos - Grid para mejor alineación */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-gray-500 pt-1">
            <div className="flex items-center gap-1.5 bg-gray-800/50 px-2.5 py-1 rounded-md">
              <Target className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-gray-300">
                {getTargetLabel(broadcast.targetType)}
                {broadcast.segmentName && <span className="text-gray-500"> • {broadcast.segmentName}</span>}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{formatNumber(broadcast.progress.total)} destinatarios</span>
            </div>

            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span className="capitalize">
                {new Date(broadcast.createdAt).toLocaleDateString('es-ES', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
          </div>
        </div>
        
        {/* Acciones - Separadas visualmente */}
        <div className="flex items-center gap-2 sm:pl-4 sm:ml-2 pt-4 sm:pt-0 self-start sm:self-center">
          <ActionButtons 
            status={broadcast.status} 
            actions={{ onStart, onPause, onResume, onCancel, onView, onDelete }} 
          />
        </div>
      </div>
      
      {/* Barra de Progreso - Solo visible cuando es relevante */}
      {['sending', 'paused', 'completed', 'cancelled'].includes(broadcast.status) && (
        <div className="mt-5 pt-4 border-t border-gray-800/50">
          <div className="flex justify-between items-end mb-2 text-xs">
            <div className="flex gap-4">
              <StatLabel color="text-emerald-400" label="Enviados" value={broadcast.progress.sent} />
              {broadcast.progress.failed > 0 && <StatLabel color="text-red-400" label="Fallidos" value={broadcast.progress.failed} />}
              {broadcast.progress.blocked > 0 && <StatLabel color="text-orange-400" label="Bloqueados" value={broadcast.progress.blocked} />}
            </div>
            <span className="font-mono font-medium text-gray-400">{progressPercent}%</span>
          </div>

          <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden flex">
            <div className="h-full bg-emerald-500 transition-all duration-700 ease-out" style={{ width: `${sentPct}%` }} />
            <div className="h-full bg-red-500 transition-all duration-700 ease-out" style={{ width: `${failedPct}%` }} />
            <div className="h-full bg-orange-500 transition-all duration-700 ease-out" style={{ width: `${blockedPct}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

const StatusBadge = ({ status }: { status: any }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${status.bg} ${status.border || 'border-transparent'} ${status.color}`}>
    {status.icon}
    {status.label}
  </span>
);

const StatLabel = ({ color, label, value }: { color: string, label: string, value: number }) => (
  <span className="flex items-center gap-1.5 text-gray-400">
    <span className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')}`} />
    {label} <span className={`font-medium ${color}`}>{formatNumber(value)}</span>
  </span>
);

const ActionButtons = ({ status, actions }: { status: string, actions: any }) => {
  return (
    <>
      {/* Controles de Estado (Play/Pause/Cancel) */}
      <div className="flex gap-1 mr-1">
        {status === 'draft' && (
          <ActionButton onClick={actions.onStart} icon={Play} title="Iniciar" colorClass="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:scale-105" />
        )}
        {status === 'sending' && (
          <ActionButton onClick={actions.onPause} icon={Pause} title="Pausar" colorClass="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20" />
        )}
        {status === 'paused' && (
          <ActionButton onClick={actions.onResume} icon={Play} title="Reanudar" colorClass="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20" />
        )}
        {['draft', 'pending', 'sending', 'paused'].includes(status) && (
          <ActionButton onClick={actions.onCancel} icon={StopCircle} title="Cancelar" colorClass="bg-red-500/10 text-red-500 hover:bg-red-500/20" />
        )}
      </div>

      {/* Acciones de Gestión (Ver/Borrar) */}
      <div className="flex gap-1 pl-2 border-l border-gray-800">
        <ActionButton onClick={actions.onView} icon={Eye} title="Ver detalles" colorClass="text-gray-400 hover:text-white hover:bg-gray-800" />
        {['completed', 'cancelled', 'failed', 'draft'].includes(status) && (
          <ActionButton onClick={actions.onDelete} icon={Trash2} title="Eliminar" colorClass="text-gray-500 hover:text-red-400 hover:bg-red-500/10" />
        )}
      </div>
    </>
  );
};


function getDeliveryStatusConfig(status: DeliveryStatus) {
  const configs: Record<DeliveryStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    pending: {
      label: 'Pendiente',
      color: 'text-gray-400',
      bg: 'bg-gray-500/20',
      icon: <Clock className="w-3 h-3" />
    },
    sent: {
      label: 'Enviado',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20',
      icon: <CheckCircle className="w-3 h-3" />
    },
    delivered: {
      label: 'Entregado',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/20',
      icon: <CheckCircle className="w-3 h-3" />
    },
    failed: {
      label: 'Fallido',
      color: 'text-red-400',
      bg: 'bg-red-500/20',
      icon: <AlertCircle className="w-3 h-3" />
    },
    blocked: {
      label: 'Bloqueado',
      color: 'text-orange-400',
      bg: 'bg-orange-500/20',
      icon: <StopCircle className="w-3 h-3" />
    },
  };
  return configs[status] || configs.pending;
}

interface BroadcastDetailModalProps {
  broadcast: BroadcastJob;
  recipients: BroadcastRecipient[];
  recipientsTotal: number;
  recipientsPage: number;
  recipientsFilter: DeliveryStatus | '';
  errors: ErrorSummary[];
  loadingRecipients: boolean;
  onClose: () => void;
  onPageChange: (page: number) => void;
  onFilterChange: (filter: DeliveryStatus | '') => void;
  onRefresh: () => void;
}

export function BroadcastDetailModal({
  broadcast,
  recipients,
  recipientsTotal,
  recipientsPage,
  recipientsFilter,
  errors,
  loadingRecipients,
  onClose,
  onPageChange,
  onFilterChange,
  onRefresh,
}: BroadcastDetailModalProps) {
  const status = getStatusConfig(broadcast.status);
  const totalPages = Math.ceil(recipientsTotal / 50);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop con Blur */}
      <div
        className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-6xl bg-gray-900 ring-1 ring-white/10 rounded-xl shadow-2xl flex flex-col max-h-[100vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* HEADER */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-800 bg-gray-900/50">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-white tracking-tight">{broadcast.title}</h2>
              <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${status.bg} ${status.color} border-transparent bg-opacity-50`}>
                {status.icon}
                {status.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="flex items-center gap-1.5 bg-gray-800/50 px-2 py-0.5 rounded">
                <Users className="w-3.5 h-3.5" />
                {getTargetLabel(broadcast.targetType)}
              </span>
              {broadcast.segmentName && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">{broadcast.segmentName}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton onClick={onRefresh} icon={RefreshCw} title="Actualizar datos" />
            <div className="w-px h-6 bg-gray-800 mx-1" />
            <ActionButton onClick={onClose} icon={X} title="Cerrar" hoverColor="hover:text-red-400 hover:bg-red-500/10" />
          </div>
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">

          {/* STATS CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-6 bg-gray-900/50">
            <StatCard
              label="Total"
              value={broadcast.progress.total}
              icon={Users}
              color="text-gray-200"
              bg="bg-gray-800"
            />
            <StatCard
              label="Enviados"
              value={broadcast.progress.sent}
              icon={Send}
              color="text-emerald-400"
              bg="bg-emerald-500/10"
            />
            <StatCard
              label="Entregados"
              value={broadcast.progress.delivered}
              icon={CheckCircle2}
              color="text-cyan-400"
              bg="bg-cyan-500/10"
            />
            <StatCard
              label="Fallidos"
              value={broadcast.progress.failed}
              icon={AlertCircle}
              color="text-red-400"
              bg="bg-red-500/10"
            />
            <StatCard
              label="Bloqueados"
              value={broadcast.progress.blocked}
              icon={Slash}
              color="text-orange-400"
              bg="bg-orange-500/10"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 pb-6">

            {/* COLUMN 1: MESSAGE & ERRORS */}
            <div className="space-y-6">
              {/* Message Preview */}
              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500 tracking-wider">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Mensaje
                </h3>
                <div className="bg-gray-950 rounded-lg border border-gray-800 p-4 relative group">
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Placeholder para botón copiar si quisieras */}
                  </div>
                  <p className="text-gray-300 whitespace-pre-wrap text-sm leading-relaxed font-sans">
                    {broadcast.message || <span className="italic text-gray-600">Sin contenido de texto</span>}
                  </p>
                </div>
              </div>

              {/* Errors Summary */}
              {errors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500 tracking-wider">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Errores Frecuentes
                  </h3>
                  <div className="space-y-2">
                    {errors.map((err) => (
                      <div key={err.errorCode} className="flex items-center justify-between p-2.5 bg-red-500/5 border border-red-500/10 rounded-md hover:bg-red-500/10 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                          <span className="text-xs text-red-300 font-medium truncate" title={err.errorCode}>
                            {err.errorCode}
                          </span>
                        </div>
                        <span className="text-xs font-mono bg-red-500/20 text-red-300 px-1.5 py-0.5 rounded">
                          {err.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* COLUMN 2 (Wider): RECIPIENTS TABLE */}
            <div className="lg:col-span-2 flex flex-col min-h-[400px] max-h-[400px] bg-gray-950/30 rounded-xl border border-gray-800 overflow-hidden">

              {/* Table Toolbar */}
              <div className="flex items-center justify-between p-3 border-b border-gray-800 bg-gray-900/40">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-300">Destinatarios</span>
                  <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
                    {formatNumber(recipientsTotal)}
                  </span>
                </div>

                <div className="relative">
                  <Filter className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={recipientsFilter}
                    onChange={(e) => {
                      onFilterChange(e.target.value as DeliveryStatus | '');
                      onPageChange(1);
                    }}
                    className="pl-8 pr-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-transparent hover:border-gray-600 rounded-md text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Todos los estados</option>
                    <option value="pending">Pendientes</option>
                    <option value="sent">Enviados</option>
                    <option value="delivered">Entregados</option>
                    <option value="failed">Fallidos</option>
                    <option value="blocked">Bloqueados</option>
                  </select>
                </div>
              </div>

              {/* Table Content */}
              <div className="flex-1 relative overflow-auto custom-scrollbar">
                {loadingRecipients ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/20 backdrop-blur-[1px]">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                  </div>
                ) : recipients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2 p-8">
                    <Users className="w-8 h-8 opacity-20" />
                    <p className="text-sm">No se encontraron destinatarios</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-900/90 text-xs font-medium text-gray-500 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                      <tr>
                        <th className="px-4 py-3 w-[30%]">Usuario</th>
                        <th className="px-4 py-3 w-[20%]">ID Telegram</th>
                        <th className="px-4 py-3 w-[15%]">Estado</th>
                        <th className="px-4 py-3 w-[15%]">Hora</th>
                        <th className="px-4 py-3 w-[20%]">Detalle</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50 text-sm">
                      {recipients.map((r) => {
                        const rStatus = getDeliveryStatusConfig(r.status);
                        return (
                          <tr key={r._id} className="hover:bg-white/[0.02] transition-colors group">
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col">
                                <span className="text-gray-200 font-medium truncate max-w-[150px]">
                                  {r.firstName || r.username || 'Desconocido'}
                                </span>
                                {r.username && (
                                  <span className="text-xs text-gray-500 group-hover:text-violet-400 transition-colors">
                                    @{r.username}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-mono text-xs text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                                {r.telegramId}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${rStatus.bg} ${rStatus.color} bg-opacity-10 border border-current border-opacity-20`}>
                                {rStatus.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-400 tabular-nums">
                              {r.sentAt ? (
                                <span className="flex items-center gap-1">
                                  {new Date(r.sentAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="px-4 py-2.5">
                              {r.errorMessage ? (
                                <span className="text-xs text-red-400 truncate block max-w-[140px]" title={r.errorMessage}>
                                  {r.errorMessage}
                                </span>
                              ) : (
                                <span className="text-gray-700">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination Footer */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-gray-800 bg-gray-900/40 text-xs">
                  <span className="text-gray-500">
                    Página <span className="text-gray-300 font-medium">{recipientsPage}</span> de {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <PaginationButton
                      onClick={() => onPageChange(recipientsPage - 1)}
                      disabled={recipientsPage <= 1}
                      icon={ChevronLeft}
                    />
                    <PaginationButton
                      onClick={() => onPageChange(recipientsPage + 1)}
                      disabled={recipientsPage >= totalPages}
                      icon={ChevronRight}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// const ActionButton = ({ onClick, icon: Icon, title, hoverColor = "hover:text-white hover:bg-gray-800" }: {
//   onClick: () => void;
//   icon: React.ComponentType<any>;
//   title: string;
//   hoverColor?: string;
// }) => (
//   <button
//     onClick={onClick}
//     className={`p-2 rounded-lg text-gray-400 transition-all duration-200 ${hoverColor}`}
//     title={title}
//   >
//     <Icon className="w-5 h-5" />
//   </button>
// );

const ActionButton = ({ onClick, icon: Icon, colorClass, title }: any) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-lg transition-all duration-200 ${colorClass}`}
    title={title}
  >
    <Icon className="w-4 h-4" />
  </button>
);

const StatCard = ({ label, value, icon: Icon, color, bg }: {
  label: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  bg: string;
}) => (
  <div className={`flex flex-col items-center justify-center p-3 rounded-xl border border-gray-800/50 ${bg} bg-opacity-5 hover:bg-opacity-10 transition-colors`}>
    <div className={`mb-1 ${color}`}>
      <Icon className="w-5 h-5 opacity-80" />
    </div>
    <span className="text-2xl font-bold text-white tracking-tight">{formatNumber(value)}</span>
    <span className="text-[10px] uppercase font-semibold text-gray-500 tracking-wider mt-0.5">{label}</span>
  </div>
);

const PaginationButton = ({ onClick, disabled, icon: Icon }: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ComponentType<any>;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="p-1.5 rounded-md bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed text-gray-300 transition-colors border border-gray-700/50"
  >
    <Icon className="w-4 h-4" />
  </button>
);

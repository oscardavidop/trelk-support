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
  const configs: Record<BroadcastStatus, { label: string; color: string; bg: string; icon: React.ReactNode, border: string }> = {
    draft: { label: 'Borrador', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', icon: <Clock className="w-3.5 h-3.5" /> },
    scheduled: { label: 'Programado', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: <Calendar className="w-3.5 h-3.5" /> },
    pending: { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: <Loader2 className="w-3.5 h-3.5" /> },
    sending: { label: 'Enviando', color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
    paused: { label: 'Pausado', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: <Pause className="w-3.5 h-3.5" /> },
    completed: { label: 'Completado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: <CheckCircle className="w-3.5 h-3.5" /> },
    cancelled: { label: 'Cancelado', color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', icon: <StopCircle className="w-3.5 h-3.5" /> },
    failed: { label: 'Fallido', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: <AlertCircle className="w-3.5 h-3.5" /> },
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
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-violet-500/30">

      {/* Violet Ambient Glow */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">

        {/* Header Section */}
        <div className="px-8 py-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-violet-900/10">
                <Megaphone className="w-6 h-6 text-violet-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Campañas de Difusión</h1>
                <p className="text-sm text-zinc-400">Envío masivo de mensajes y segmentación</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { fetchBroadcasts(); fetchStats(); }}
                disabled={loading}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
              </button>

              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium rounded-xl shadow-lg shadow-violet-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Send className="w-4 h-4" />
                <span>Nuevo Broadcast</span>
              </button>
            </div>
          </div>

          {/* Stats Bar (Glassy Strip) */}
          {stats && (
            <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6 overflow-x-auto">
              <StatBadge icon={BarChart3} count={stats.totalMessagesSent} label="Mensajes Enviados" color="text-zinc-200" bg="bg-zinc-800" />
              <div className="h-4 w-px bg-white/10" />
              <StatBadge icon={Clock} count={stats.last24h} label="Últimas 24h" color="text-violet-400" bg="bg-violet-500/10" />
              <div className="h-4 w-px bg-white/10" />
              <StatBadge icon={Loader2} count={stats.byStatus.sending || 0} label="En curso" color="text-cyan-400" bg="bg-cyan-500/10" />
              <div className="h-4 w-px bg-white/10" />
              <StatBadge icon={CheckCircle} count={stats.byStatus.completed || 0} label="Completados" color="text-emerald-400" bg="bg-emerald-500/10" />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-hidden px-8 pb-8 pt-2">
          <div className="h-full flex flex-col bg-zinc-900/40 backdrop-blur-sm border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">

            {/* Table Header */}
            <div className="grid grid-cols-[2.5fr_1fr_1.5fr_2fr_1fr_80px] gap-4 px-6 py-4 bg-zinc-900/80 border-b border-zinc-800 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <div>Campaña / Mensaje</div>
              <div>Estado</div>
              <div>Objetivo</div>
              <div>Progreso</div>
              <div>Fecha</div>
              <div className="text-right">Acciones</div>
            </div>

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {loading && broadcasts.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                </div>
              ) : broadcasts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
                  <Megaphone className="w-16 h-16 mb-4 stroke-1" />
                  <p className="text-lg font-medium">No hay broadcasts creados</p>
                  <p className="text-sm">Inicia una nueva campaña para conectar con tus usuarios</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/50">
                  {broadcasts.map((broadcast) => (
                    <BroadcastRow
                      key={broadcast._id}
                      broadcast={broadcast}
                      onView={() => openDetail(broadcast)}
                      onStart={() => setShowConfirm(broadcast)}
                      onPause={() => handlePauseBroadcast(broadcast._id)}
                      onResume={() => handleResumeBroadcast(broadcast._id)}
                      onCancel={() => handleCancelBroadcast(broadcast._id)}
                      onDelete={() => handleDeleteBroadcast(broadcast._id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 custom-scrollbar">
          {loading && broadcasts.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
          ) : broadcasts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
              <Megaphone className="w-16 h-16 mb-4 stroke-1" />
              <p className="text-lg font-medium">No hay broadcasts creados</p>
              <p className="text-sm">Inicia una nueva campaña para conectar con tus usuarios</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-5">
              {broadcasts.map((broadcast) => (
                <BroadcastCard
                  key={broadcast._id}
                  broadcast={broadcast}
                  onView={() => openDetail(broadcast)}
                  onStart={() => setShowConfirm(broadcast)}
                  onPause={() => handlePauseBroadcast(broadcast._id)}
                  onResume={() => handleResumeBroadcast(broadcast._id)}
                  onCancel={() => handleCancelBroadcast(broadcast._id)}
                  onDelete={() => handleDeleteBroadcast(broadcast._id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slide-overs & Modals */}
      <BroadcastCreateSidebar
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        onCreated={handleBroadcastCreated}
        segments={segments}
      />

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mb-4 border border-amber-500/20">
                <Send className="w-8 h-8 text-amber-500 ml-1" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Confirmar Envío</h2>
              <p className="text-zinc-400">
                Estás a punto de enviar mensajes a <strong className="text-white">{formatNumber(showConfirm.progress.total)}</strong> usuarios.
                <br /><span className="text-xs text-zinc-500">Esta acción iniciará el proceso inmediatamente.</span>
              </p>
            </div>

            <div className="bg-zinc-950/50 rounded-xl p-4 mb-6 border border-zinc-800/50">
              <p className="text-xs text-zinc-500 font-bold mb-2">Vista Previa</p>
              <p className="text-zinc-300 text-sm line-clamp-3 font-mono leading-relaxed opacity-80">
                {showConfirm.message}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(null)}
                className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300 font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleStartBroadcast(showConfirm._id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-500 rounded-xl text-white font-medium transition-colors shadow-lg shadow-violet-900/20"
              >
                <Play className="w-4 h-4 fill-current" />
                Iniciar
              </button>
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

function BroadcastRow({ broadcast, onView, onStart, onPause, onResume, onCancel, onDelete }: BroadcastCardProps) {
  const status = getStatusConfig(broadcast.status);

  // Progress calc
  const total = broadcast.progress.total || 1;
  const sentPct = (broadcast.progress.sent / total) * 100;
  const failedPct = (broadcast.progress.failed / total) * 100;
  const blockedPct = (broadcast.progress.blocked / total) * 100;
  const progressPercent = Math.round(((broadcast.progress.sent + broadcast.progress.failed + broadcast.progress.blocked) / total) * 100);

  const isActive = ['sending', 'paused', 'pending'].includes(broadcast.status);

  return (
    <div className="group grid grid-cols-[2.5fr_1fr_1.5fr_2fr_1fr_80px] gap-4 px-6 py-4 items-center hover:bg-zinc-800/30 transition-colors duration-200">

      {/* 1. Campaña e Info */}
      <div className="min-w-0 pr-4">
        <h3 className="font-semibold text-zinc-200 truncate text-sm mb-1">{broadcast.title}</h3>
        <p className="text-xs text-zinc-500 truncate font-mono opacity-80">
          {broadcast.message || <span className="italic">Sin mensaje...</span>}
        </p>
      </div>

      {/* 2. Estado */}
      <div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border uppercase ${status.bg} ${status.border} ${status.color}`}>
          {status.icon}
          {status.label}
        </span>
      </div>

      {/* 3. Objetivo (Segmento) */}
      <div className="flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-1.5 text-xs text-zinc-300">
          <Target className="w-3.5 h-3.5 text-zinc-500" />
          <span className="truncate">{getTargetLabel(broadcast.targetType)}</span>
        </div>
        {broadcast.segmentName && (
          <span className="text-[10px] text-zinc-500 pl-5 truncate">{broadcast.segmentName}</span>
        )}
      </div>

      {/* 4. Progreso (Barra Lineal) */}
      <div className="pr-4">
        {isActive || broadcast.status === 'completed' || broadcast.status === 'cancelled' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-end text-[10px]">
              <span className="text-zinc-400 font-medium">
                <span className="text-emerald-400">{formatNumber(broadcast.progress.sent)}</span>
                <span className="text-zinc-600 mx-1">/</span>
                {formatNumber(broadcast.progress.total)}
              </span>
              {broadcast.progress.failed > 0 && (
                <span className="text-red-400 font-medium">{broadcast.progress.failed} err</span>
              )}
            </div>
            {/* Progress Bar Container */}
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500/80 transition-all duration-500" style={{ width: `${sentPct}%` }} />
              <div className="h-full bg-red-500/80 transition-all duration-500" style={{ width: `${failedPct}%` }} />
              <div className="h-full bg-orange-500/80 transition-all duration-500" style={{ width: `${blockedPct}%` }} />
            </div>
          </div>
        ) : (
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {formatNumber(broadcast.progress.total)} est.
          </div>
        )}
      </div>

      {/* 5. Fecha */}
      <div className="flex flex-col">
        <span className="text-xs text-zinc-400 font-medium">
          {new Date(broadcast.createdAt).toLocaleDateString()}
        </span>
        <span className="text-[10px] text-zinc-600">
          {new Date(broadcast.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* 6. Acciones */}
      <div className="flex justify-end items-center gap-1">
        {broadcast.status === 'draft' && (
          <IconButton onClick={onStart} icon={Play} color="text-emerald-400 hover:text-emerald-300" bg="hover:bg-emerald-500/10" title="Iniciar" />
        )}
        {(broadcast.status === 'sending' || broadcast.status === 'pending') && (
          <IconButton onClick={onPause} icon={Pause} color="text-amber-400 hover:text-amber-300" bg="hover:bg-amber-500/10" title="Pausar" />
        )}
        {broadcast.status === 'paused' && (
          <IconButton onClick={onResume} icon={Play} color="text-emerald-400 hover:text-emerald-300" bg="hover:bg-emerald-500/10" title="Reanudar" />
        )}

        <IconButton onClick={onView} icon={Eye} color="text-zinc-400 hover:text-white" bg="hover:bg-zinc-700" title="Ver Detalles" />

        {['draft', 'completed', 'cancelled', 'failed'].includes(broadcast.status) && (
          <IconButton onClick={onDelete} icon={Trash2} color="text-zinc-600 hover:text-red-400" bg="hover:bg-red-500/10" title="Eliminar" />
        )}
      </div>
    </div>
  );
}



interface BroadcastCardProps {
  broadcast: BroadcastJob;
  onView: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onDelete: () => void;
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


function StatBadge({ icon: Icon, count, label, color, bg }: any) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-lg ${color}`}>{typeof count === 'number' ? formatNumber(count) : count}</span>
        <span className="text-[10px] font-bold text-zinc-500">{label}</span>
      </div>
    </div>
  );
}

function BroadcastCard({ broadcast, onView, onStart, onPause, onResume, onCancel, onDelete }: BroadcastCardProps) {
  const status = getStatusConfig(broadcast.status);

  // Progress calc
  const total = broadcast.progress.total || 1;
  const sentPct = (broadcast.progress.sent / total) * 100;
  const failedPct = (broadcast.progress.failed / total) * 100;
  const blockedPct = (broadcast.progress.blocked / total) * 100;
  const progressPercent = Math.round(((broadcast.progress.sent + broadcast.progress.failed + broadcast.progress.blocked) / total) * 100);

  return (
    <div className="group relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 flex flex-col">

      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1 pr-4 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-zinc-100 truncate text-lg">{broadcast.title}</h3>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase${status.bg} ${status.border} ${status.color}`}>
              {status.icon}
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1 bg-zinc-800/50 px-2 py-0.5 rounded border border-zinc-800">
              <Target className="w-3 h-3" />
              {getTargetLabel(broadcast.targetType)}
              {broadcast.segmentName && <span className="text-zinc-400"> : {broadcast.segmentName}</span>}
            </span>
            <span>•</span>
            <span className="font-mono">{new Date(broadcast.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {broadcast.status === 'draft' && <IconButton onClick={onStart} icon={Play} color="text-emerald-400" bg="hover:bg-emerald-500/10" />}
          {broadcast.status === 'sending' && <IconButton onClick={onPause} icon={Pause} color="text-amber-400" bg="hover:bg-amber-500/10" />}
          {broadcast.status === 'paused' && <IconButton onClick={onResume} icon={Play} color="text-emerald-400" bg="hover:bg-emerald-500/10" />}
          <IconButton onClick={onView} icon={Eye} color="text-zinc-400" bg="hover:bg-zinc-800" />
          {['draft', 'completed', 'cancelled', 'failed'].includes(broadcast.status) && (
            <IconButton onClick={onDelete} icon={Trash2} color="text-zinc-500 hover:text-red-400" bg="hover:bg-red-500/10" />
          )}
        </div>
      </div>

      <div className="relative mb-4 flex-1">
        <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50 text-sm text-zinc-400 font-mono leading-relaxed line-clamp-2 min-h-[3.5rem]">
          {broadcast.message || <span className="italic opacity-50">Sin mensaje...</span>}
        </div>
      </div>

      {/* Footer / Progress */}
      <div className="mt-auto">
        {['sending', 'paused', 'completed', 'cancelled'].includes(broadcast.status) ? (
          <div className="space-y-2">
            <div className="flex justify-between items-end text-xs">
              <div className="flex gap-3">
                <span className="text-emerald-400 font-medium">{formatNumber(broadcast.progress.sent)} <span className="text-zinc-600 font-normal">env</span></span>
                {broadcast.progress.failed > 0 && <span className="text-red-400 font-medium">{formatNumber(broadcast.progress.failed)} <span className="text-zinc-600 font-normal">err</span></span>}
              </div>
              <span className="text-zinc-500 font-mono">{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${sentPct}%` }} />
              <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${failedPct}%` }} />
              <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${blockedPct}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-zinc-500 pt-2 border-t border-zinc-800/50">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{formatNumber(broadcast.progress.total)} destinatarios</span>
            </div>
            {broadcast.scheduledAt && (
              <div className="flex items-center gap-1.5 text-blue-400/80">
                <Clock className="w-3.5 h-3.5" />
                <span>Programado</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const IconButton = ({ onClick, icon: Icon, color, bg }: any) => (
  <button onClick={onClick} className={`p-2 rounded-lg transition-colors ${color} ${bg}`}>
    <Icon className="w-4 h-4" />
  </button>
);

// ============= DETAIL MODAL (Updated) =============

function BroadcastDetailModal({ broadcast, recipients, recipientsTotal, recipientsPage, recipientsFilter, errors, loadingRecipients, onClose, onPageChange, onFilterChange, onRefresh }: BroadcastDetailModalProps) {
  const status = getStatusConfig(broadcast.status);
  const totalPages = Math.ceil(recipientsTotal / 50);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-6xl bg-zinc-900 ring-1 ring-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Modal Header */}
        <div className="flex items-start justify-between px-8 py-6 border-b border-zinc-800 bg-zinc-900">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-white">{broadcast.title}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.bg} ${status.color} ${status.border}`}>{status.label}</span>
            </div>
            <p className="text-sm text-zinc-400 flex items-center gap-2">
              <span className="bg-zinc-800 px-1.5 rounded text-zinc-300 text-xs font-mono">{broadcast._id}</span>
              • {getTargetLabel(broadcast.targetType)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"><RefreshCw className="w-5 h-5" /></button>
            <div className="w-px h-6 bg-zinc-800 mx-1" />
            <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-8 bg-zinc-900/50 border-b border-zinc-800">
            <StatCard label="Total" value={broadcast.progress.total} icon={Users} color="text-zinc-200" bg="bg-zinc-800" />
            <StatCard label="Enviados" value={broadcast.progress.sent} icon={Send} color="text-emerald-400" bg="bg-emerald-500/10" />
            <StatCard label="Entregados" value={broadcast.progress.delivered} icon={CheckCircle2} color="text-cyan-400" bg="bg-cyan-500/10" />
            <StatCard label="Fallidos" value={broadcast.progress.failed} icon={AlertCircle} color="text-red-400" bg="bg-red-500/10" />
            <StatCard label="Bloqueados" value={broadcast.progress.blocked} icon={Slash} color="text-orange-400" bg="bg-orange-500/10" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-8">
            {/* Info Column */}
            <div className="space-y-6">
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
                <h3 className="text-xs font-bold text-zinc-500 tracking-widest mb-3 flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" /> Mensaje
                </h3>
                <p className="text-zinc-300 text-sm font-mono whitespace-pre-wrap leading-relaxed opacity-90">
                  {broadcast.message}
                </p>
              </div>

              {errors.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-5">
                  <h3 className="text-xs font-bold text-red-400 tracking-widest mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" /> Errores
                  </h3>
                  <div className="space-y-2">
                    {errors.map((err: any) => (
                      <div key={err.errorCode} className="flex justify-between items-center text-sm">
                        <span className="text-red-300 font-mono bg-red-500/10 px-1.5 rounded">{err.errorCode}</span>
                        <span className="text-zinc-500">x{err.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Table Column */}
            <div className="lg:col-span-2 bg-zinc-950/30 border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-[500px]">
              <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-zinc-500" />
                  <span className="text-sm font-medium text-zinc-300">Destinatarios</span>
                  <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">{formatNumber(recipientsTotal)}</span>
                </div>
                <div className="relative">
                  <Filter className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={recipientsFilter}
                    onChange={(e: any) => { onFilterChange(e.target.value); onPageChange(1); }}
                    className="pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-violet-500 cursor-pointer appearance-none hover:bg-zinc-800 transition-colors"
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

              <div className="flex-1 overflow-auto custom-scrollbar relative">
                {loadingRecipients && (
                  <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                    <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
                  </div>
                )}
                <table className="w-full text-left border-collapse">
                  <thead className="bg-zinc-900 text-xs font-bold text-zinc-500 uppercasesticky top-0 z-0">
                    <tr>
                      <th className="px-4 py-3">Usuario</th>
                      <th className="px-4 py-3">Telegram ID</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Hora</th>
                      <th className="px-4 py-3">Error</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 text-sm">
                    {recipients.map((r: any) => {
                      const statusConfig = getDeliveryStatusConfig(r.status);
                      return (
                        <tr key={r._id} className="hover:bg-white/[0.02]">
                          <td className="px-4 py-2.5 font-medium text-zinc-300">
                            {r.firstName || r.username || 'Desconocido'}
                            {r.username && <span className="block text-xs text-zinc-500 font-normal">@{r.username}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-zinc-500 font-mono text-xs">{r.telegramId}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase${statusConfig.bg} ${statusConfig.color}`}>
                              {statusConfig.icon} {statusConfig.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-zinc-500 text-xs font-mono">
                            {r.sentAt ? new Date(r.sentAt).toLocaleTimeString() : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-red-400 max-w-[150px] truncate" title={r.errorMessage}>
                            {r.errorMessage || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-zinc-800 bg-zinc-900/50 text-xs">
                  <span className="text-zinc-500">Página {recipientsPage} de {totalPages}</span>
                  <div className="flex gap-1">
                    <button onClick={() => onPageChange(recipientsPage - 1)} disabled={recipientsPage <= 1} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-400">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => onPageChange(recipientsPage + 1)} disabled={recipientsPage >= totalPages} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-400">
                      <ChevronRight className="w-4 h-4" />
                    </button>
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

function StatCard({ label, value, icon: Icon, color, bg }: any) {
  return (
    <div className={`flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-800/50 ${bg} bg-opacity-5`}>
      <Icon className={`w-5 h-5 mb-2 ${color} opacity-80`} />
      <span className="text-2xl font-bold text-white tracking-tight">{formatNumber(value)}</span>
      <span className="text-[10px] font-bold text-zinc-500mt-1">{label}</span>
    </div>
  );
}

function getDeliveryStatusConfig(status: DeliveryStatus) {
  const configs: Record<DeliveryStatus, { label: string; color: string; bg: string; icon: any }> = {
    pending: { label: 'Pendiente', color: 'text-zinc-400', bg: 'bg-zinc-500/10', icon: <Clock className="w-3 h-3" /> },
    sent: { label: 'Enviado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle className="w-3 h-3" /> },
    delivered: { label: 'Entregado', color: 'text-cyan-400', bg: 'bg-cyan-500/10', icon: <CheckCircle2 className="w-3 h-3" /> },
    failed: { label: 'Fallido', color: 'text-red-400', bg: 'bg-red-500/10', icon: <XCircle className="w-3 h-3" /> },
    blocked: { label: 'Bloqueado', color: 'text-orange-400', bg: 'bg-orange-500/10', icon: <Slash className="w-3 h-3" /> },
  };
  return configs[status] || configs.pending;
}

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
  BarChart3
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
  const progress = broadcast.progress.total > 0
    ? Math.round(((broadcast.progress.sent + broadcast.progress.failed + broadcast.progress.blocked) / broadcast.progress.total) * 100)
    : 0;
  
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="font-medium text-white truncate">{broadcast.title}</h3>
            <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${status.bg} ${status.color}`}>
              {status.icon}
              {status.label}
            </span>
          </div>
          
          <p className="text-sm text-gray-400 truncate mb-3">
            {broadcast.message ? (broadcast.message.length > 100 ? broadcast.message.slice(0, 100) + '...' : broadcast.message) : '(Sin mensaje)'}
          </p>
          
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              {getTargetLabel(broadcast.targetType)}
              {broadcast.segmentName && `: ${broadcast.segmentName}`}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {formatNumber(broadcast.progress.total)} usuarios
            </span>
            <span>
              {new Date(broadcast.createdAt).toLocaleDateString('es-ES', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 ml-4">
          {broadcast.status === 'draft' && (
            <button
              onClick={onStart}
              className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 rounded-lg text-emerald-400 transition-colors"
              title="Iniciar"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          {broadcast.status === 'sending' && (
            <button
              onClick={onPause}
              className="p-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg text-orange-400 transition-colors"
              title="Pausar"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          {broadcast.status === 'paused' && (
            <button
              onClick={onResume}
              className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 rounded-lg text-cyan-400 transition-colors"
              title="Reanudar"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
          {['draft', 'pending', 'sending', 'paused'].includes(broadcast.status) && (
            <button
              onClick={onCancel}
              className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 transition-colors"
              title="Cancelar"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onView}
            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>
          {['completed', 'cancelled', 'failed', 'draft'].includes(broadcast.status) && (
            <button
              onClick={onDelete}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Progress bar */}
      {['sending', 'paused', 'completed', 'cancelled'].includes(broadcast.status) && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-gray-400">
              {formatNumber(broadcast.progress.sent)} enviados
              {broadcast.progress.failed > 0 && (
                <span className="text-red-400 ml-2">
                  {formatNumber(broadcast.progress.failed)} fallidos
                </span>
              )}
              {broadcast.progress.blocked > 0 && (
                <span className="text-orange-400 ml-2">
                  {formatNumber(broadcast.progress.blocked)} bloqueados
                </span>
              )}
            </span>
            <span className="text-gray-400">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full transition-all duration-500 flex"
            >
              <div 
                className="h-full bg-emerald-500" 
                style={{ width: `${(broadcast.progress.sent / Math.max(1, broadcast.progress.total)) * 100}%` }}
              />
              <div 
                className="h-full bg-red-500" 
                style={{ width: `${(broadcast.progress.failed / Math.max(1, broadcast.progress.total)) * 100}%` }}
              />
              <div 
                className="h-full bg-orange-500" 
                style={{ width: `${(broadcast.progress.blocked / Math.max(1, broadcast.progress.total)) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
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

function BroadcastDetailModal({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-bold text-white">{broadcast.title}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs ${status.bg} ${status.color}`}>
                {status.icon}
                {status.label}
              </span>
              <span className="text-sm text-gray-400">
                {getTargetLabel(broadcast.targetType)}
                {broadcast.segmentName && ` • ${broadcast.segmentName}`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 p-6 border-b border-gray-800">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{formatNumber(broadcast.progress.total)}</div>
            <div className="text-xs text-gray-400">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-400">{formatNumber(broadcast.progress.sent)}</div>
            <div className="text-xs text-gray-400">Enviados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-400">{formatNumber(broadcast.progress.delivered)}</div>
            <div className="text-xs text-gray-400">Entregados</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">{formatNumber(broadcast.progress.failed)}</div>
            <div className="text-xs text-gray-400">Fallidos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-400">{formatNumber(broadcast.progress.blocked)}</div>
            <div className="text-xs text-gray-400">Bloqueados</div>
          </div>
        </div>
        
        {/* Message preview */}
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Mensaje</h3>
          <div className="bg-gray-800 rounded-lg p-4 max-h-32 overflow-auto">
            <p className="text-white whitespace-pre-wrap text-sm">{broadcast.message || '(Sin mensaje)'}</p>
          </div>
        </div>
        
        {/* Errors summary */}
        {errors.length > 0 && (
          <div className="p-6 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Resumen de errores</h3>
            <div className="flex flex-wrap gap-2">
              {errors.map((err) => (
                <div 
                  key={err.errorCode}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm"
                >
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400">{err.errorCode}</span>
                  <span className="text-gray-400">×{err.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Recipients */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h3 className="text-sm font-medium text-gray-300">
              Destinatarios ({formatNumber(recipientsTotal)})
            </h3>
            <select
              value={recipientsFilter}
              onChange={(e) => {
                onFilterChange(e.target.value as DeliveryStatus | '');
                onPageChange(1);
              }}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
            >
              <option value="">Todos</option>
              <option value="pending">Pendientes</option>
              <option value="sent">Enviados</option>
              <option value="failed">Fallidos</option>
              <option value="blocked">Bloqueados</option>
            </select>
          </div>
          
          <div className="flex-1 overflow-auto">
            {loadingRecipients ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
              </div>
            ) : recipients.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-gray-500">
                No hay destinatarios
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-800 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Usuario</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Telegram ID</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Estado</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Enviado</th>
                    <th className="px-4 py-2 text-left text-xs text-gray-400 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {recipients.map((r) => {
                    const rStatus = getDeliveryStatusConfig(r.status);
                    return (
                      <tr key={r._id} className="hover:bg-gray-800/50">
                        <td className="px-4 py-2">
                          <div className="text-sm text-white">
                            {r.firstName || r.username || 'Usuario'}
                          </div>
                          {r.username && (
                            <div className="text-xs text-gray-500">@{r.username}</div>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-400">{r.telegramId}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${rStatus.bg} ${rStatus.color}`}>
                            {rStatus.icon}
                            {rStatus.label}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-400">
                          {r.sentAt ? new Date(r.sentAt).toLocaleTimeString('es-ES') : '-'}
                        </td>
                        <td className="px-4 py-2 text-sm text-red-400 truncate max-w-xs" title={r.errorMessage}>
                          {r.errorMessage || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-800">
              <span className="text-sm text-gray-400">
                Página {recipientsPage} de {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => onPageChange(recipientsPage - 1)}
                  disabled={recipientsPage <= 1}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-white"
                >
                  Anterior
                </button>
                <button
                  onClick={() => onPageChange(recipientsPage + 1)}
                  disabled={recipientsPage >= totalPages}
                  className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm text-white"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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

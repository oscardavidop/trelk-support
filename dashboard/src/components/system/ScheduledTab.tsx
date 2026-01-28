/**
 * Scheduled Messages Tab - Scheduled Message Monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Timer,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Calendar,
  UserX,
  Zap,
  MessageSquare,
  Filter
} from 'lucide-react';
import { getSocket } from '../../services/socket';
import { getScheduledMessages, type ScheduledMessageInfo } from '../../services/system.service';

type StatusFilter = 'all' | 'pending' | 'sent' | 'failed' | 'cancelled';

export function ScheduledTab() {
  const [messages, setMessages] = useState<ScheduledMessageInfo[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadMessages = useCallback(async () => {
    const status = statusFilter === 'all' ? undefined : statusFilter;
    const result = await getScheduledMessages({ status, limit: 100 });
    if (result.ok && result.data) {
      setMessages(result.data.messages);
      setCounts(result.data.counts);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [statusFilter]);

  // Initial load
  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUpdate = () => {
      loadMessages();
    };

    socket.on('scheduled_message_created', handleUpdate);
    socket.on('scheduled_message_sent', handleUpdate);
    socket.on('scheduled_message_cancelled', handleUpdate);

    return () => {
      socket.off('scheduled_message_created', handleUpdate);
      socket.off('scheduled_message_sent', handleUpdate);
      socket.off('scheduled_message_cancelled', handleUpdate);
    };
  }, [loadMessages]);

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Timer className="w-5 h-5 text-amber-500" />
            Mensajes Programados
          </h2>
          <p className="text-sm text-zinc-400">Monitorización de tareas en cola de tiempo</p>
        </div>
        <button
          onClick={loadMessages}
          className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Interactive Stats Strip (Acts as Filter) */}
      <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl overflow-x-auto w-full">
        <FilterBadge
          label="Pendientes"
          count={counts.pending || 0}
          icon={Clock}
          color="text-amber-400"
          bg="bg-amber-500/10"
          active={statusFilter === 'pending'}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
        />
        <div className="h-6 w-px bg-white/10" />
        <FilterBadge
          label="Procesando"
          count={counts.processing || 0}
          icon={Loader2}
          color="text-blue-400"
          bg="bg-blue-500/10"
          active={false} // Usually transient, maybe not filterable
          onClick={() => { }}
        />
        <div className="h-6 w-px bg-white/10" />
        <FilterBadge
          label="Enviados"
          count={counts.sent || 0}
          icon={CheckCircle}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
          active={statusFilter === 'sent'}
          onClick={() => setStatusFilter(statusFilter === 'sent' ? 'all' : 'sent')}
        />
        <div className="h-6 w-px bg-white/10" />
        <FilterBadge
          label="Fallidos"
          count={counts.failed || 0}
          icon={XCircle}
          color="text-red-400"
          bg="bg-red-500/10"
          active={statusFilter === 'failed'}
          onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
        />
        <div className="h-6 w-px bg-white/10" />
        <FilterBadge
          label="Cancelados"
          count={counts.cancelled || 0}
          icon={AlertTriangle}
          color="text-zinc-400"
          bg="bg-zinc-500/20"
          active={statusFilter === 'cancelled'}
          onClick={() => setStatusFilter(statusFilter === 'cancelled' ? 'all' : 'cancelled')}
        />
      </div>

      {/* Filter Status Indicator */}
      <div className="flex items-center gap-2 text-xs px-1">
        <Filter className="w-3.5 h-3.5 text-zinc-500" />
        <span className="text-zinc-500">Mostrando:</span>
        <span className="text-zinc-200 font-medium capitalize bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
          {statusFilter === 'all' ? 'Todos' : statusFilter}
        </span>
        <span className="text-zinc-500 ml-auto">
          {messages.length} de {total} registros
        </span>
      </div>

      {/* Messages List */}
      <div className="space-y-2">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
            <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
            <p>No se encontraron mensajes programados</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ScheduledMessageCard key={msg.id} message={msg} />
          ))
        )}
      </div>
    </div>
  );
}

// ============= COMPONENTS =============

interface StatusCardProps {
  label: string;
  count: number;
  color: 'yellow' | 'blue' | 'green' | 'red' | 'gray';
  active: boolean;
  onClick: () => void;
}

function FilterBadge({ label, count, icon: Icon, color, bg, active, onClick }: {
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2 rounded-xl transition-all min-w-fit ${active
          ? `bg-zinc-800 ring-1 ring-inset ${color.replace('text-', 'ring-')} shadow-lg`
          : 'hover:bg-white/5'
        }`}
    >
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col items-start leading-none">
        <span className={`font-bold text-lg ${color}`}>{count}</span>
        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">{label}</span>
      </div>
    </button>
  );
}

function ScheduledMessageCard({ message }: { message: ScheduledMessageInfo }) {
  const getTypeConfig = () => {
    switch (message.type) {
      case 'fixed_time': return { icon: Calendar, label: 'Fecha Fija', color: 'text-blue-400', bg: 'bg-blue-500/10' };
      case 'after_inactivity': return { icon: UserX, label: 'Inactividad', color: 'text-amber-400', bg: 'bg-amber-500/10' };
      case 'on_event': return { icon: Zap, label: 'Evento', color: 'text-purple-400', bg: 'bg-purple-500/10' };
      default: return { icon: Timer, label: 'Timer', color: 'text-zinc-400', bg: 'bg-zinc-500/10' };
    }
  };

  const getStatusConfig = () => {
    switch (message.status) {
      case 'pending': return { label: 'Pendiente', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      case 'processing': return { label: 'Procesando', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'sent': return { label: 'Enviado', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
      case 'failed': return { label: 'Fallido', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
      case 'cancelled': return { label: 'Cancelado', color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
      case 'expired': return { label: 'Expirado', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' };
      default: return { label: message.status, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
    }
  };

  const typeConfig = getTypeConfig();
  const statusConfig = getStatusConfig();
  const TypeIcon = typeConfig.icon;

  const getTimeRemaining = () => {
    if (message.status !== 'pending' || !message.scheduledAt) return null;
    const now = new Date();
    const scheduled = new Date(message.scheduledAt);
    const diff = scheduled.getTime() - now.getTime();

    if (diff <= 0) return <span className="text-red-400 font-bold">¡Vencido!</span>;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes} min`;
  };

  return (
    <div className="group bg-zinc-900/40 border border-zinc-800 rounded-xl p-4 hover:bg-zinc-900/60 hover:border-zinc-700 transition-all flex items-center gap-4">

      {/* Icon Type */}
      <div className={`p-3 rounded-xl ${typeConfig.bg} border border-white/5`}>
        <TypeIcon className={`w-5 h-5 ${typeConfig.color}`} />
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">

        {/* IDs & Type */}
        <div className="col-span-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${typeConfig.bg} ${typeConfig.color}`}>
              {typeConfig.label}
            </span>
            <span className="text-zinc-500 text-xs font-mono">#{message.id.slice(-6)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
            <span title="Session ID">S: {message.sessionId.slice(-6)}</span>
            <span className="text-zinc-600">/</span>
            <span title="Chat ID">C: {message?.chatId}</span>
          </div>
        </div>

        {/* Schedule Time */}
        <div className="col-span-1">
          {message.scheduledAt ? (
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 uppercase font-bold">Programado</span>
              <span className="text-sm text-zinc-200">{new Date(message.scheduledAt).toLocaleString()}</span>
              {message.status === 'pending' && (
                <span className="text-xs text-amber-400 mt-0.5">En: {getTimeRemaining()}</span>
              )}
            </div>
          ) : (
            <span className="text-zinc-600 text-xs italic">Sin fecha</span>
          )}
        </div>

        {/* Status & Attempts */}
        <div className="col-span-1 flex flex-col">
          <span className="text-xs text-zinc-500 uppercase font-bold mb-1">Estado</span>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
              {statusConfig.label}
            </span>
            {message.attempts > 0 && (
              <span className="text-xs text-zinc-500">
                Try: {message.attempts}
              </span>
            )}
          </div>
          {message.error && (
            <span className="text-[10px] text-red-400 mt-1 truncate max-w-[150px]" title={message.error}>
              {message.error}
            </span>
          )}
        </div>

        {/* Created At */}
        <div className="col-span-1 text-right">
          <span className="text-[10px] text-zinc-500 block uppercase font-bold">Creado</span>
          <span className="text-xs text-zinc-400 font-mono">
            {new Date(message.createdAt).toLocaleTimeString()}
          </span>
          <span className="text-[10px] text-zinc-600 block">
            {new Date(message.createdAt).toLocaleDateString()}
          </span>
        </div>

      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import {
  Clock, Calendar, UserX, Zap, Trash2, Loader2, RefreshCw, 
  ChevronDown, CheckCircle, XCircle, AlertCircle, Timer, MessageSquare, ArrowRight
} from 'lucide-react';
import {
  getSessionScheduledMessages,
  cancelScheduledMessage,
  formatTimeRemaining,
  getStatusDisplay,
  getScheduleTypeDisplay
} from '../../services/scheduledMessage.service';
import type { ScheduledMessage, ScheduledMessageStatus, ScheduleType } from '../../types/scheduledMessage';
import { toast } from '../../stores/toastStore';
import { getSocket } from '../../services/socket';
import usePermissions from '../../hooks/usePermissions';

interface Props {
  sessionId: string;
  onCountChange?: (count: number) => void;
}

const STATUS_CONFIG: Record<ScheduledMessageStatus, { icon: any; color: string; bg: string; border: string }> = {
  pending: { icon: Timer, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  processing: { icon: Loader2, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  sent: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  cancelled: { icon: XCircle, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
  expired: { icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
};

const TYPE_ICONS: Record<ScheduleType, any> = {
  fixed_time: Calendar,
  after_inactivity: UserX,
  on_event: Zap,
};

export function ScheduledMessagesList({ sessionId, onCountChange }: Props) {
  const { can } = usePermissions();
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    // Solo mostramos loading spinner en la carga inicial, no en refrescos
    if (messages.length === 0) setLoading(true);
    try {
      const result = await getSessionScheduledMessages(sessionId);
      if (result.ok && result.data) {
        setMessages(result.data);
        onCountChange?.(result.data.filter(m => m.status === 'pending').length);
      }
    } catch (err) {
      console.error('Error loading scheduled messages:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, onCountChange]);

  const [, setTick] = useState(0); // tick for re-rendering countdown timers

  useEffect(() => {
    loadMessages();
    // Local 10-second tick to re-render countdowns — no API call needed
    // since formatTimeRemaining() computes from scheduledAt client-side
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handleEvent = (data: { sessionId?: string }) => { if (data.sessionId === sessionId) loadMessages(); };
    socket.on('scheduled_message_created', handleEvent);
    socket.on('scheduled_message_cancelled', handleEvent);
    socket.on('scheduled_message_sent', handleEvent);
    return () => {
      socket.off('scheduled_message_created', handleEvent);
      socket.off('scheduled_message_cancelled', handleEvent);
      socket.off('scheduled_message_sent', handleEvent);
    };
  }, [sessionId, loadMessages]);

  const handleCancel = async (messageId: string) => {
    setCancellingId(messageId);
    try {
      const result = await cancelScheduledMessage(messageId);
      if (result.ok) {
        toast.success('Mensaje cancelado');
        loadMessages();
      } else toast.error(result.error || 'Error al cancelar');
    } catch { toast.error('Error de conexión'); } 
    finally { setCancellingId(null); }
  };

  if (!can('scheduled.read')) return <div className="px-4 py-3 text-xs text-zinc-500 italic">Sin permisos.</div>;

  if (loading && messages.length === 0) return <div className="p-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-indigo-500" /></div>;

  if (messages.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3 border border-zinc-800">
           <Clock className="w-5 h-5 text-zinc-600" />
        </div>
        <p className="text-sm font-medium text-zinc-400">Sin mensajes programados</p>
        <p className="text-xs text-zinc-600 mt-1">Crea uno nuevo para automatizar</p>
      </div>
    );
  }

  const pendingMessages = messages.filter(m => m.status === 'pending');
  const otherMessages = messages.filter(m => m.status !== 'pending');

  return (
    <div className="space-y-4 px-3 py-2">
      {/* Header Actions */}
      <div className="flex justify-between items-center pb-2 border-b border-zinc-800/50">
         <span className="text-[10px] font-bold text-zinc-500 ">Cola de Mensajes</span>
         <button onClick={loadMessages} disabled={loading} className="p-1.5 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
         </button>
      </div>

      {/* Pending List */}
      {pendingMessages.length > 0 && (
        <div className="space-y-2">
          {pendingMessages.map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              expanded={expandedId === msg.id}
              onToggle={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
              onCancel={() => handleCancel(msg.id)}
              cancelling={cancellingId === msg.id}
            />
          ))}
        </div>
      )}

      {/* History List */}
      {otherMessages.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-[10px] font-bold text-zinc-600  mb-2">Historial Reciente</p>
          {otherMessages.slice(0, 5).map((msg) => (
            <MessageCard
              key={msg.id}
              message={msg}
              expanded={expandedId === msg.id}
              onToggle={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== SUB-COMPONENT: CARD ====================

interface MessageCardProps {
  message: ScheduledMessage;
  expanded: boolean;
  onToggle: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
  compact?: boolean;
}

function MessageCard({ message, expanded, onToggle, onCancel, cancelling, compact }: MessageCardProps) {
  const statusCfg = STATUS_CONFIG[message.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const TypeIcon = TYPE_ICONS[message.type] || Clock;

  const timeRemaining = message.status === 'pending' && message.scheduledAt ? formatTimeRemaining(message.scheduledAt) : null;

  return (
    <div className={`group bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all duration-300 ${compact ? 'opacity-60 hover:opacity-100' : 'hover:border-zinc-700'}`}>
      
      {/* Card Header (Clickable) */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 p-3 text-left">
        {/* Icon Box */}
        <div className={`p-2 rounded-lg bg-zinc-950 border border-zinc-800 ${compact ? 'text-zinc-600' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
          <TypeIcon className="w-4 h-4" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
             <span className={`text-xs font-medium truncate ${compact ? 'text-zinc-500' : 'text-zinc-200'}`}>
                {getScheduleTypeDisplay(message.type)}
             </span>
             {/* Status Badge */}
             <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold  border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                <StatusIcon className={`w-2.5 h-2.5 ${message.status === 'processing' ? 'animate-spin' : ''}`} />
                {!compact && <span>{getStatusDisplay(message.status)}</span>}
             </div>
          </div>
          
          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
             {timeRemaining ? (
                <span className="text-amber-500 flex items-center gap-1">
                   <Timer className="w-3 h-3"/> {timeRemaining}
                </span>
             ) : (
                <span>{new Date(message.scheduledAt || message.createdAt).toLocaleDateString()}</span>
             )}
          </div>
        </div>

        {/* Chevron */}
        <div className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
           <ChevronDown className="w-4 h-4 text-zinc-600" />
        </div>
      </button>

      {/* Expanded Details */}
      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-3 pb-3 pt-0 border-t border-zinc-800/50 bg-zinc-900/50">
           
           {/* Message Content */}
           <div className="mt-3 mb-3">
              <p className="text-[10px] font-bold text-zinc-500 mb-1">Contenido</p>
              <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-300 italic">
                 "{message.message?.text || 'Sin texto'}"
              </div>
           </div>

           {/* Grid Details */}
           <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <DetailRow label="Creado" value={new Date(message.createdAt).toLocaleString()} />
              {message.scheduledAt && <DetailRow label="Programado" value={new Date(message.scheduledAt).toLocaleString()} />}
              {message.sentAt && <DetailRow label="Enviado" value={new Date(message.sentAt).toLocaleString()} highlight />}
              {message.type === 'after_inactivity' && <DetailRow label="Inactividad" value={`${message.delayMinutes} min`} />}
              {message.triggerEvent && <DetailRow label="Trigger" value={message.triggerEvent} />}
           </div>

           {/* Error if any */}
           {message.error && (
              <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 flex items-start gap-2">
                 <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0"/> {message.error}
              </div>
           )}

           {/* Cancel Action */}
           {message.status === 'pending' && onCancel && (
              <button 
                 onClick={(e) => { e.stopPropagation(); onCancel(); }}
                 disabled={cancelling}
                 className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              >
                 {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}
                 Cancelar Envío
              </button>
           )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
   return (
      <div>
         <p className="text-[10px] text-zinc-500 mb-0.5">{label}</p>
         <p className={`font-medium truncate ${highlight ? 'text-emerald-400' : 'text-zinc-300'}`}>{value}</p>
      </div>
   );
}
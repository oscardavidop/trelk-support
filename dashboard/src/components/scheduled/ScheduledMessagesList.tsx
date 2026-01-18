// /**
//  * ScheduledMessagesList - Component to display and manage scheduled messages
//  */

// import { useState, useEffect, useCallback } from 'react';
// import {
//   Clock,
//   Calendar,
//   UserX,
//   Zap,
//   Trash2,
//   Loader2,
//   RefreshCw,
//   ChevronDown,
//   ChevronUp,
//   CheckCircle,
//   XCircle,
//   AlertCircle,
//   Timer,
//   MessageSquare
// } from 'lucide-react';
// import {
//   getSessionScheduledMessages,
//   cancelScheduledMessage,
//   formatTimeRemaining,
//   getStatusDisplay,
//   getScheduleTypeDisplay
// } from '../../services/scheduledMessage.service';
// import type { ScheduledMessage, ScheduledMessageStatus, ScheduleType } from '../../types/scheduledMessage';
// import { toast } from '../../stores/toastStore';
// import { getSocket } from '../../services/socket';

// interface Props {
//   sessionId: string;
//   onCountChange?: (count: number) => void;
// }

// const STATUS_ICONS: Record<ScheduledMessageStatus, typeof Clock> = {
//   pending: Timer,
//   processing: Loader2,
//   sent: CheckCircle,
//   failed: XCircle,
//   cancelled: XCircle,
//   expired: AlertCircle,
// };

// const STATUS_COLORS: Record<ScheduledMessageStatus, string> = {
//   pending: 'text-yellow-400 bg-yellow-400/10',
//   processing: 'text-blue-400 bg-blue-400/10',
//   sent: 'text-green-400 bg-green-400/10',
//   failed: 'text-red-400 bg-red-400/10',
//   cancelled: 'text-gray-400 bg-gray-400/10',
//   expired: 'text-orange-400 bg-orange-400/10',
// };

// const TYPE_ICONS: Record<ScheduleType, typeof Clock> = {
//   fixed_time: Calendar,
//   after_inactivity: UserX,
//   on_event: Zap,
// };

// export function ScheduledMessagesList({ sessionId, onCountChange }: Props) {
//   const [messages, setMessages] = useState<ScheduledMessage[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [expandedId, setExpandedId] = useState<string | null>(null);
//   const [cancellingId, setCancellingId] = useState<string | null>(null);

//   const loadMessages = useCallback(async () => {
//     setLoading(true);
//     try {
//       const result = await getSessionScheduledMessages(sessionId);
//       if (result.ok && result.data) {
//         setMessages(result.data);
//         onCountChange?.(result.data.filter(m => m.status === 'pending').length);
//       }
//     } catch (err) {
//       console.error('Error loading scheduled messages:', err);
//     } finally {
//       setLoading(false);
//     }
//   }, [sessionId, onCountChange]);

//   useEffect(() => {
//     loadMessages();
    
//     // Refresh every 30 seconds to update time remaining
//     const interval = setInterval(loadMessages, 30000);
//     return () => clearInterval(interval);
//   }, [loadMessages]);

//   // Listen for socket events to auto-refresh
//   useEffect(() => {
//     const socket = getSocket();
//     if (!socket) return;

//     const handleScheduledEvent = (data: { sessionId?: string }) => {
//       // Reload if the event is for this session
//       if (data.sessionId === sessionId) {
//         loadMessages();
//       }
//     };

//     socket.on('scheduled_message_created', handleScheduledEvent);
//     socket.on('scheduled_message_cancelled', handleScheduledEvent);
//     socket.on('scheduled_message_sent', handleScheduledEvent);

//     return () => {
//       socket.off('scheduled_message_created', handleScheduledEvent);
//       socket.off('scheduled_message_cancelled', handleScheduledEvent);
//       socket.off('scheduled_message_sent', handleScheduledEvent);
//     };
//   }, [sessionId, loadMessages]);

//   const handleCancel = async (messageId: string) => {
//     setCancellingId(messageId);
//     try {
//       const result = await cancelScheduledMessage(messageId);
//       if (result.ok) {
//         toast.success('Mensaje cancelado', 'El mensaje programado ha sido cancelado');
//         loadMessages();
//       } else {
//         toast.error('Error', result.error || 'No se pudo cancelar el mensaje');
//       }
//     } catch (err) {
//       toast.error('Error', 'Error de conexión');
//     } finally {
//       setCancellingId(null);
//     }
//   };

//   const pendingMessages = messages.filter(m => m.status === 'pending');
//   const otherMessages = messages.filter(m => m.status !== 'pending');

//   if (loading && messages.length === 0) {
//     return (
//       <div className="p-4 flex items-center justify-center">
//         <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
//       </div>
//     );
//   }

//   if (messages.length === 0) {
//     return (
//       <div className="p-4 text-center text-gray-500">
//         <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
//         <p className="text-sm">No hay mensajes programados</p>
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-2">
//       {/* Refresh button */}
//       <div className="flex items-center justify-end px-3 pt-2">
//         <button
//           onClick={loadMessages}
//           disabled={loading}
//           className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
//           title="Actualizar"
//         >
//           <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
//         </button>
//       </div>

//       {/* Pending Messages */}
//       {pendingMessages.length > 0 && (
//         <div className="px-3 space-y-2">
//           <p className="text-xs text-gray-500 uppercase tracking-wide">Pendientes</p>
//           {pendingMessages.map((msg) => (
//             <MessageCard
//               key={msg.id}
//               message={msg}
//               expanded={expandedId === msg.id}
//               onToggle={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
//               onCancel={() => handleCancel(msg.id)}
//               cancelling={cancellingId === msg.id}
//             />
//           ))}
//         </div>
//       )}

//       {/* Other Messages */}
//       {otherMessages.length > 0 && (
//         <div className="px-3 pb-3 space-y-2">
//           <p className="text-xs text-gray-500 uppercase tracking-wide">Historial</p>
//           {otherMessages.slice(0, 5).map((msg) => (
//             <MessageCard
//               key={msg.id}
//               message={msg}
//               expanded={expandedId === msg.id}
//               onToggle={() => setExpandedId(expandedId === msg.id ? null : msg.id)}
//               compact
//             />
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// interface MessageCardProps {
//   message: ScheduledMessage;
//   expanded: boolean;
//   onToggle: () => void;
//   onCancel?: () => void;
//   cancelling?: boolean;
//   compact?: boolean;
// }

// function MessageCard({ message, expanded, onToggle, onCancel, cancelling, compact }: MessageCardProps) {
//   const StatusIcon = STATUS_ICONS[message.status];
//   const TypeIcon = TYPE_ICONS[message.type];
//   const statusColor = STATUS_COLORS[message.status];
  
//   const timeRemaining = message.status === 'pending' && message.scheduledAt
//     ? formatTimeRemaining(message.scheduledAt)
//     : null;

//   return (
//     <div className={`bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden ${compact ? 'opacity-70' : ''}`}>
//       {/* Header Row */}
//       <button
//         onClick={onToggle}
//         className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-800/80 transition-colors"
//       >
//         {/* Type Icon */}
//         <div className="p-1.5 bg-gray-700 rounded-lg">
//           <TypeIcon className="w-3.5 h-3.5 text-gray-400" />
//         </div>

//         {/* Content */}
//         <div className="flex-1 min-w-0">
//           <p className="text-sm text-white truncate">
//             {message.message?.text?.slice(0, 50) || '(multimedia)'}
//             {(message.message?.text?.length || 0) > 50 && '...'}
//           </p>
//           <div className="flex items-center gap-2 text-xs text-gray-500">
//             <span>{getScheduleTypeDisplay(message.type)}</span>
//             {timeRemaining && (
//               <>
//                 <span>•</span>
//                 <span className="text-yellow-400">{timeRemaining}</span>
//               </>
//             )}
//           </div>
//         </div>

//         {/* Status Badge */}
//         <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusColor}`}>
//           <StatusIcon className={`w-3 h-3 ${message.status === 'processing' ? 'animate-spin' : ''}`} />
//           <span className="capitalize">{getStatusDisplay(message.status)}</span>
//         </div>

//         {/* Expand Icon */}
//         {expanded ? (
//           <ChevronUp className="w-4 h-4 text-gray-500" />
//         ) : (
//           <ChevronDown className="w-4 h-4 text-gray-500" />
//         )}
//       </button>

//       {/* Expanded Content */}
//       {expanded && (
//         <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50">
//           {/* Message Preview */}
//           <div className="pt-3">
//             <p className="text-xs text-gray-500 mb-1">Mensaje:</p>
//             <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-900/50 rounded-lg p-2">
//               {message.message?.text || '(sin texto)'}
//             </p>
//           </div>

//           {/* Details */}
//           <div className="grid grid-cols-2 gap-2 text-xs">
//             <div>
//               <p className="text-gray-500">Creado:</p>
//               <p className="text-gray-300">
//                 {new Date(message.createdAt).toLocaleString('es')}
//               </p>
//             </div>
//             {message.scheduledAt && (
//               <div>
//                 <p className="text-gray-500">Programado:</p>
//                 <p className="text-gray-300">
//                   {new Date(message.scheduledAt).toLocaleString('es')}
//                 </p>
//               </div>
//             )}
//             {message.type === 'after_inactivity' && (
//               <div>
//                 <p className="text-gray-500">Espera:</p>
//                 <p className="text-gray-300">{message.delayMinutes} min</p>
//               </div>
//             )}
//             {message.triggerEvent && (
//               <div>
//                 <p className="text-gray-500">Evento:</p>
//                 <p className="text-gray-300">{message.triggerEvent}</p>
//               </div>
//             )}
//             {message.sentAt && (
//               <div>
//                 <p className="text-gray-500">Enviado:</p>
//                 <p className="text-gray-300">
//                   {new Date(message.sentAt).toLocaleString('es')}
//                 </p>
//               </div>
//             )}
//             {message.error && (
//               <div className="col-span-2">
//                 <p className="text-gray-500">Error:</p>
//                 <p className="text-red-400">{message.error}</p>
//               </div>
//             )}
//           </div>

//           {/* Cancel Button */}
//           {message.status === 'pending' && onCancel && (
//             <button
//               onClick={(e) => {
//                 e.stopPropagation();
//                 onCancel();
//               }}
//               disabled={cancelling}
//               className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
//             >
//               {cancelling ? (
//                 <Loader2 className="w-4 h-4 animate-spin" />
//               ) : (
//                 <Trash2 className="w-4 h-4" />
//               )}
//               <span>Cancelar mensaje</span>
//             </button>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// export default ScheduledMessagesList;



/**
 * ScheduledMessagesList - Component to display and manage scheduled messages
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Calendar,
  UserX,
  Zap,
  Trash2,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertCircle,
  Timer,
  MessageSquare
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

interface Props {
  sessionId: string;
  onCountChange?: (count: number) => void;
}

const STATUS_ICONS: Record<ScheduledMessageStatus, typeof Clock> = {
  pending: Timer,
  processing: Loader2,
  sent: CheckCircle,
  failed: XCircle,
  cancelled: XCircle,
  expired: AlertCircle,
};

const STATUS_COLORS: Record<ScheduledMessageStatus, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10',
  processing: 'text-blue-400 bg-blue-400/10',
  sent: 'text-green-400 bg-green-400/10',
  failed: 'text-red-400 bg-red-400/10',
  cancelled: 'text-gray-400 bg-gray-400/10',
  expired: 'text-orange-400 bg-orange-400/10',
};

const TYPE_ICONS: Record<ScheduleType, typeof Clock> = {
  fixed_time: Calendar,
  after_inactivity: UserX,
  on_event: Zap,
};

export function ScheduledMessagesList({ sessionId, onCountChange }: Props) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
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

  useEffect(() => {
    loadMessages();
    
    // Refresh every 30 seconds to update time remaining
    const interval = setInterval(loadMessages, 30000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  // Listen for socket events to auto-refresh
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleScheduledEvent = (data: { sessionId?: string }) => {
      // Reload if the event is for this session
      if (data.sessionId === sessionId) {
        loadMessages();
      }
    };

    socket.on('scheduled_message_created', handleScheduledEvent);
    socket.on('scheduled_message_cancelled', handleScheduledEvent);
    socket.on('scheduled_message_sent', handleScheduledEvent);

    return () => {
      socket.off('scheduled_message_created', handleScheduledEvent);
      socket.off('scheduled_message_cancelled', handleScheduledEvent);
      socket.off('scheduled_message_sent', handleScheduledEvent);
    };
  }, [sessionId, loadMessages]);

  const handleCancel = async (messageId: string) => {
    setCancellingId(messageId);
    try {
      const result = await cancelScheduledMessage(messageId);
      if (result.ok) {
        toast.success('Mensaje cancelado', 'El mensaje programado ha sido cancelado');
        loadMessages();
      } else {
        toast.error('Error', result.error || 'No se pudo cancelar el mensaje');
      }
    } catch (err) {
      toast.error('Error', 'Error de conexión');
    } finally {
      setCancellingId(null);
    }
  };

  const pendingMessages = messages.filter(m => m.status === 'pending');
  const otherMessages = messages.filter(m => m.status !== 'pending');

  if (loading && messages.length === 0) {
    return (
      <div className="p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No hay mensajes programados</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Refresh button */}
      <div className="flex items-center justify-end px-3 pt-2">
        <button
          onClick={loadMessages}
          disabled={loading}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          title="Actualizar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Pending Messages */}
      {pendingMessages.length > 0 && (
        <div className="px-3 space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pendientes</p>
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

      {/* Other Messages */}
      {otherMessages.length > 0 && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Historial</p>
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

interface MessageCardProps {
  message: ScheduledMessage;
  expanded: boolean;
  onToggle: () => void;
  onCancel?: () => void;
  cancelling?: boolean;
  compact?: boolean;
}

function MessageCard({ message, expanded, onToggle, onCancel, cancelling, compact }: MessageCardProps) {
  const StatusIcon = STATUS_ICONS[message.status];
  const TypeIcon = TYPE_ICONS[message.type];
  const statusColor = STATUS_COLORS[message.status];
  
  const timeRemaining = message.status === 'pending' && message.scheduledAt
    ? formatTimeRemaining(message.scheduledAt)
    : null;

  return (
    <div className={`bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden ${compact ? 'opacity-70' : ''}`}>
      {/* Header Row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-800/80 transition-colors"
      >
        {/* Type Icon */}
        <div className="p-1.5 bg-gray-700 rounded-lg">
          <TypeIcon className="w-3.5 h-3.5 text-gray-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white truncate">
            {message.message?.text?.slice(0, 50) || '(multimedia)'}
            {(message.message?.text?.length || 0) > 50 && '...'}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{getScheduleTypeDisplay(message.type)}</span>
            {timeRemaining && (
              <>
                <span>•</span>
                <span className="text-yellow-400">{timeRemaining}</span>
              </>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusColor}`}>
          <StatusIcon className={`w-3 h-3 ${message.status === 'processing' ? 'animate-spin' : ''}`} />
          <span className="capitalize">{getStatusDisplay(message.status)}</span>
        </div>

        {/* Expand Icon */}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-700/50">
          {/* Message Preview */}
          <div className="pt-3">
            <p className="text-xs text-gray-500 mb-1">Mensaje:</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-900/50 rounded-lg p-2">
              {message.message?.text || '(sin texto)'}
            </p>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-500">Creado:</p>
              <p className="text-gray-300">
                {new Date(message.createdAt).toLocaleString('es')}
              </p>
            </div>
            {message.scheduledAt && (
              <div>
                <p className="text-gray-500">Programado:</p>
                <p className="text-gray-300">
                  {new Date(message.scheduledAt).toLocaleString('es')}
                </p>
              </div>
            )}
            {message.type === 'after_inactivity' && (
              <div>
                <p className="text-gray-500">Espera:</p>
                <p className="text-gray-300">{message.delayMinutes} min</p>
              </div>
            )}
            {message.triggerEvent && (
              <div>
                <p className="text-gray-500">Evento:</p>
                <p className="text-gray-300">{message.triggerEvent}</p>
              </div>
            )}
            {message.sentAt && (
              <div>
                <p className="text-gray-500">Enviado:</p>
                <p className="text-gray-300">
                  {new Date(message.sentAt).toLocaleString('es')}
                </p>
              </div>
            )}
            {message.error && (
              <div className="col-span-2">
                <p className="text-gray-500">Error:</p>
                <p className="text-red-400">{message.error}</p>
              </div>
            )}
          </div>

          {/* Cancel Button */}
          {message.status === 'pending' && onCancel && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              disabled={cancelling}
              className="w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {cancelling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>Cancelar mensaje</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ScheduledMessagesList;


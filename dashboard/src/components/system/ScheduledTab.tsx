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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Scheduled Messages</h2>
        <button
          onClick={loadMessages}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatusCard
          label="Pending"
          count={counts.pending || 0}
          color="yellow"
          active={statusFilter === 'pending'}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
        />
        <StatusCard
          label="Processing"
          count={counts.processing || 0}
          color="blue"
          active={false}
          onClick={() => {}}
        />
        <StatusCard
          label="Sent"
          count={counts.sent || 0}
          color="green"
          active={statusFilter === 'sent'}
          onClick={() => setStatusFilter(statusFilter === 'sent' ? 'all' : 'sent')}
        />
        <StatusCard
          label="Failed"
          count={counts.failed || 0}
          color="red"
          active={statusFilter === 'failed'}
          onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
        />
        <StatusCard
          label="Cancelled"
          count={counts.cancelled || 0}
          color="gray"
          active={statusFilter === 'cancelled'}
          onClick={() => setStatusFilter(statusFilter === 'cancelled' ? 'all' : 'cancelled')}
        />
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 text-sm">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-gray-400">Showing:</span>
        <span className="text-white font-medium capitalize">{statusFilter}</span>
        <span className="text-gray-500">({messages.length} of {total})</span>
      </div>

      {/* Messages Table */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Session</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Scheduled For</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-center">Attempts</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {messages.map((msg) => (
              <MessageRow key={msg.id} message={msg} />
            ))}
          </tbody>
        </table>

        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No scheduled messages found</p>
          </div>
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

function StatusCard({ label, count, color, active, onClick }: StatusCardProps) {
  const colors = {
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    gray: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border transition-all ${colors[color]} ${
        active ? 'ring-2 ring-offset-2 ring-offset-gray-950 ring-gray-500' : ''
      }`}
    >
      <div className="text-2xl font-bold">{count.toLocaleString()}</div>
      <div className="text-sm opacity-80">{label}</div>
    </button>
  );
}

interface MessageRowProps {
  message: ScheduledMessageInfo;
}

function MessageRow({ message }: MessageRowProps) {
  const getTypeIcon = () => {
    switch (message.type) {
      case 'fixed_time':
        return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'after_inactivity':
        return <UserX className="w-4 h-4 text-yellow-400" />;
      case 'on_event':
        return <Zap className="w-4 h-4 text-purple-400" />;
      default:
        return <Timer className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = () => {
    switch (message.status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">
            <CheckCircle className="w-3 h-3" />
            Sent
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/10 text-red-400 rounded text-xs">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-500/10 text-gray-400 rounded text-xs">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/10 text-orange-400 rounded text-xs">
            <AlertTriangle className="w-3 h-3" />
            Expired
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeName = () => {
    switch (message.type) {
      case 'fixed_time': return 'Fixed Time';
      case 'after_inactivity': return 'After Inactivity';
      case 'on_event': return 'On Event';
      default: return message.type;
    }
  };

  const getTimeRemaining = () => {
    if (message.status !== 'pending' || !message.scheduledAt) return null;
    
    const now = new Date();
    const scheduled = new Date(message.scheduledAt);
    const diff = scheduled.getTime() - now.getTime();
    
    if (diff <= 0) return 'Due now';
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

  const timeRemaining = getTimeRemaining();

  return (
    <tr className="hover:bg-gray-800/50 transition-colors">
      {/* ID */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-gray-500">
          {message.id.slice(-8)}
        </span>
      </td>
      
      {/* Session */}
      <td className="px-4 py-3">
        <span className="text-white font-medium">{message.sessionId}</span>
        <div className="text-xs text-gray-500">Chat: {message.chatId}</div>
      </td>
      
      {/* Type */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {getTypeIcon()}
          <span className="text-gray-300">{getTypeName()}</span>
        </div>
      </td>
      
      {/* Scheduled For */}
      <td className="px-4 py-3">
        {message.scheduledAt ? (
          <div>
            <div className="text-white">
              {new Date(message.scheduledAt).toLocaleString()}
            </div>
            {timeRemaining && (
              <div className="text-xs text-yellow-400">
                {timeRemaining}
              </div>
            )}
          </div>
        ) : (
          <span className="text-gray-500">-</span>
        )}
      </td>
      
      {/* Status */}
      <td className="px-4 py-3">
        {getStatusBadge()}
        {message.error && (
          <div className="text-xs text-red-400 mt-1 max-w-[200px] truncate" title={message.error}>
            {message.error}
          </div>
        )}
      </td>
      
      {/* Attempts */}
      <td className="px-4 py-3 text-center">
        <span className={message.attempts > 1 ? 'text-yellow-400' : 'text-gray-400'}>
          {message.attempts}
        </span>
      </td>
      
      {/* Created */}
      <td className="px-4 py-3 text-sm text-gray-400">
        {new Date(message.createdAt).toLocaleString()}
      </td>
    </tr>
  );
}

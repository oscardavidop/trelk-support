/**
 * BroadcastBanner - Premium Zinc Refactor
 * High-fidelity system announcements displayed at the top of the dashboard.
 */

import React, { useEffect } from 'react';
import { X, AlertTriangle, Info, AlertCircle, CheckCircle2, Pin } from 'lucide-react';
import { useNotificationStore, type InternalBroadcast } from '../stores/notificationStore';

// ============= STYLES CONFIG =============

const LEVEL_STYLES: Record<InternalBroadcast['level'], {
  container: string;
  iconBg: string;
  iconColor: string;
  titleColor: string;
  buttonAck: string;
}> = {
  info: {
    container: 'bg-zinc-900/95 border-b-zinc-800',
    iconBg: 'bg-indigo-500/10 border-indigo-500/20',
    iconColor: 'text-indigo-400',
    titleColor: 'text-zinc-100',
    buttonAck: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20',
  },
  warning: {
    container: 'bg-amber-950/10 border-b-amber-500/10',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    iconColor: 'text-amber-400',
    titleColor: 'text-amber-100',
    buttonAck: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/20',
  },
  critical: {
    container: 'bg-red-950/20 border-b-red-500/20',
    iconBg: 'bg-red-500/10 border-red-500/20',
    iconColor: 'text-red-400',
    titleColor: 'text-red-100',
    buttonAck: 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20',
  },
};

// ============= COMPONENTS =============

interface SingleBannerProps {
  broadcast: InternalBroadcast;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
}

const SingleBanner: React.FC<SingleBannerProps> = ({ broadcast, onAcknowledge, onDismiss }) => {
  const styles = LEVEL_STYLES[broadcast.level];
  const { markBroadcastSeen } = useNotificationStore();

  // Mark as seen automatically
  useEffect(() => {
    if (!broadcast.receipt?.seenAt) {
      markBroadcastSeen(broadcast._id);
    }
  }, [broadcast._id, broadcast.receipt?.seenAt, markBroadcastSeen]);

  // Icon Selection
  const Icon = broadcast.level === 'critical' ? AlertCircle 
             : broadcast.level === 'warning' ? AlertTriangle 
             : Info;

  return (
    <div
      className={`
        relative w-full border-b backdrop-blur-md transition-all duration-300 animate-in slide-in-from-top-2
        ${styles.container}
        ${broadcast.level === 'critical' ? 'animate-pulse-subtle' : ''}
      `}
      role="alert"
    >
      <div className="px-4 py-3 flex items-start gap-4">
        
        {/* Icon Badge */}
        <div className={`flex-shrink-0 p-2 rounded-xl border ${styles.iconBg} ${styles.iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 mb-1">
            <p className={`text-sm font-bold tracking-tight ${styles.titleColor}`}>
              {broadcast.title}
            </p>
            {broadcast.isPinned && (
              <span className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
                <Pin className="w-3 h-3 fill-current" /> Fijado
              </span>
            )}
          </div>
          
          <p className="text-sm text-zinc-400 leading-relaxed max-w-4xl">
            {broadcast.message}
          </p>
          
          <div className="mt-2 flex items-center gap-3 text-xs text-zinc-500 font-mono">
            <span>{broadcast.createdBy.name}</span>
            <span>•</span>
            <span>{new Date(broadcast.createdAt).toLocaleDateString()} {new Date(broadcast.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 flex-shrink-0 self-center">
          {broadcast.requireAck ? (
            <button
              onClick={() => onAcknowledge(broadcast._id)}
              className={`
                inline-flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase r rounded-lg shadow-lg transition-all hover:translate-y-[-1px]
                ${styles.buttonAck}
              `}
            >
              <CheckCircle2 className="w-4 h-4" />
              Firmar
            </button>
          ) : !broadcast.isPinned && (
            <button
              onClick={() => onDismiss(broadcast._id)}
              className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              aria-label="Descartar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Critical Indicator Line */}
      {broadcast.level === 'critical' && (
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
      )}
    </div>
  );
};

export const BroadcastBanner: React.FC = () => {
  const { broadcasts, acknowledgeBroadcast, fetchBroadcasts } = useNotificationStore();

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Logic: Show unacknowledged & non-expired
  const activeBroadcasts = broadcasts.filter(b => {
    if (b.receipt?.acknowledgedAt) return false;
    if (b.expiresAt && new Date(b.expiresAt) < new Date()) return false;
    return true;
  });

  // Sort: Critical > Warning > Info (Pinned on top of their level)
  const sortedBroadcasts = [...activeBroadcasts].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const levelOrder = { critical: 0, warning: 1, info: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });

  if (sortedBroadcasts.length === 0) return null;

  return (
    <div className="flex flex-col w-full z-40 shadow-xl shadow-black/20">
      {sortedBroadcasts.map(broadcast => (
        <SingleBanner
          key={broadcast._id}
          broadcast={broadcast}
          onAcknowledge={acknowledgeBroadcast}
          onDismiss={acknowledgeBroadcast} // Non-required dismiss = ack for UI purposes
        />
      ))}
    </div>
  );
};

export default BroadcastBanner;
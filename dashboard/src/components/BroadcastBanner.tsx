/**
 * BroadcastBanner Component
 * Shows active broadcasts at the top of the dashboard
 */

import React, { useEffect } from 'react';
import { X, AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';
import { useNotificationStore, type InternalBroadcast } from '../stores/notificationStore';

// Level styles using Tailwind
const levelStyles: Record<InternalBroadcast['level'], {
  bg: string;
  border: string;
  icon: string;
  text: string;
}> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
    text: 'text-blue-800 dark:text-blue-200',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-500',
    text: 'text-yellow-800 dark:text-yellow-200',
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    text: 'text-red-800 dark:text-red-200',
  },
};

const LevelIcon: React.FC<{ level: InternalBroadcast['level']; className?: string }> = ({ level, className }) => {
  const iconClass = `w-5 h-5 ${className || ''}`;
  switch (level) {
    case 'critical':
      return <AlertCircle className={iconClass} />;
    case 'warning':
      return <AlertTriangle className={iconClass} />;
    default:
      return <Info className={iconClass} />;
  }
};

interface SingleBannerProps {
  broadcast: InternalBroadcast;
  onAcknowledge: (id: string) => void;
  onDismiss: (id: string) => void;
}

const SingleBanner: React.FC<SingleBannerProps> = ({ broadcast, onAcknowledge, onDismiss }) => {
  const styles = levelStyles[broadcast.level];
  const { markBroadcastSeen } = useNotificationStore();

  // Mark as seen when first displayed
  useEffect(() => {
    if (!broadcast.receipt?.seenAt) {
      markBroadcastSeen(broadcast._id);
    }
  }, [broadcast._id, broadcast.receipt?.seenAt, markBroadcastSeen]);

  return (
    <div
      className={`
        relative flex items-start gap-3 px-4 py-3 border-b
        ${styles.bg} ${styles.border}
        ${broadcast.level === 'critical' ? 'animate-pulse' : ''}
      `}
      role="alert"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 mt-0.5 ${styles.icon}`}>
        <LevelIcon level={broadcast.level} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold ${styles.text}`}>
          {broadcast.title}
        </p>
        <p className={`mt-1 text-sm ${styles.text} opacity-90`}>
          {broadcast.message}
        </p>
        <p className="mt-1 text-xs opacity-60">
          De: {broadcast.createdBy.name} • {new Date(broadcast.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {broadcast.requireAck && (
          <button
            onClick={() => onAcknowledge(broadcast._id)}
            className={`
              inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md
              bg-white dark:bg-gray-800 border shadow-sm
              hover:bg-gray-50 dark:hover:bg-gray-700
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
            `}
          >
            <CheckCircle className="w-4 h-4" />
            Confirmar
          </button>
        )}
        {!broadcast.requireAck && !broadcast.isPinned && (
          <button
            onClick={() => onDismiss(broadcast._id)}
            className="p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export const BroadcastBanner: React.FC = () => {
  const { broadcasts, acknowledgeBroadcast, fetchBroadcasts } = useNotificationStore();

  // Fetch broadcasts on mount
  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Filter to show only active broadcasts
  const activeBroadcasts = broadcasts.filter(b => {
    // Don't show if already acknowledged
    if (b.receipt?.acknowledgedAt) return false;
    // Don't show if expired
    if (b.expiresAt && new Date(b.expiresAt) < new Date()) return false;
    return true;
  });

  // Sort: critical first, then warning, then info. Pinned at top.
  const sortedBroadcasts = [...activeBroadcasts].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const levelOrder = { critical: 0, warning: 1, info: 2 };
    return levelOrder[a.level] - levelOrder[b.level];
  });

  if (sortedBroadcasts.length === 0) {
    return null;
  }

  const handleAcknowledge = async (id: string) => {
    await acknowledgeBroadcast(id);
  };

  const handleDismiss = async (id: string) => {
    // For non-required broadcasts, acknowledge to dismiss
    await acknowledgeBroadcast(id);
  };

  return (
    <div className="relative z-40">
      {sortedBroadcasts.map(broadcast => (
        <SingleBanner
          key={broadcast._id}
          broadcast={broadcast}
          onAcknowledge={handleAcknowledge}
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
};

export default BroadcastBanner;

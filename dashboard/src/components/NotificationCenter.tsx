/**
 * NotificationCenter Component
 * Dropdown panel showing agent notifications
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  MessageSquare,
  UserPlus,
  Clock,
  AlertTriangle,
  Star,
  ArrowUpRight,
  X,
  Loader2,
} from 'lucide-react';
import { useNotificationStore, type InternalNotification } from '../stores/notificationStore';

// Notification type icons
const typeIcons: Record<InternalNotification['type'], React.ElementType> = {
  message: MessageSquare,
  assignment: UserPlus,
  reminder: Clock,
  alert: AlertTriangle,
  vip: Star,
  escalation: ArrowUpRight,
};

// Notification type colors
const typeColors: Record<InternalNotification['type'], string> = {
  message: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  assignment: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  reminder: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  alert: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  vip: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  escalation: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
};

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString();
}

interface NotificationItemProps {
  notification: InternalNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onAction?: (url: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkRead,
  onDelete,
  onAction,
}) => {
  const Icon = typeIcons[notification.type];
  const colorClass = typeColors[notification.type];

  return (
    <div
      className={`
        relative p-3 border-b border-gray-100 dark:border-gray-800
        hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors
        ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
        ${notification.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''}
      `}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {notification.title && (
            <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
              {notification.title}
            </p>
          )}
          <p className={`text-sm text-gray-600 dark:text-gray-400 ${notification.title ? 'mt-0.5' : ''}`}>
            {notification.message}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {notification.fromAdminId.name}
            </span>
            <span className="text-xs text-gray-300 dark:text-gray-600">•</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>

          {/* Action button */}
          {notification.actionUrl && (
            <button
              onClick={() => onAction?.(notification.actionUrl!)}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              {notification.actionLabel || 'Ver más'}
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex flex-col gap-1">
          {!notification.read && (
            <button
              onClick={() => onMarkRead(notification._id)}
              className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Marcar como leído"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(notification._id)}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-blue-500 rounded-full" />
      )}
    </div>
  );
};

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  
  const {
    notifications,
    unreadCount,
    notificationsLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch notifications when opened
  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleAction = (url: string) => {
    // Navigate to URL
    window.location.href = url;
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative p-2 rounded-lg transition-colors
          hover:bg-gray-100 dark:hover:bg-gray-800
          ${isOpen ? 'bg-gray-100 dark:bg-gray-800' : ''}
        `}
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[70vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">
              Notificaciones
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar todo leído
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
            {notificationsLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell className="w-10 h-10 mb-2 opacity-50" />
                <p className="text-sm">No hay notificaciones</p>
              </div>
            ) : (
              notifications.map(notification => (
                <NotificationItem
                  key={notification._id}
                  notification={notification}
                  onMarkRead={markAsRead}
                  onDelete={deleteNotification}
                  onAction={handleAction}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;

/**
 * NotificationCenter - Premium Zinc Refactor
 * High-fidelity notification dropdown panel
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell, Check, CheckCheck, Trash2, MessageSquare, UserPlus, Clock, 
  AlertTriangle, Star, ArrowUpRight, X, Loader2, Inbox
} from 'lucide-react';
import { useNotificationStore, type InternalNotification } from '../stores/notificationStore';
import { NotificationHistoryModal } from './modals/NotificationHistoryModal';

// ============= CONFIG & STYLES =============

const TYPE_CONFIG: Record<InternalNotification['type'], { icon: React.ElementType; colorClass: string }> = {
  message: { 
    icon: MessageSquare, 
    colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20' 
  },
  assignment: { 
    icon: UserPlus, 
    colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' 
  },
  reminder: { 
    icon: Clock, 
    colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20' 
  },
  alert: { 
    icon: AlertTriangle, 
    colorClass: 'text-red-400 bg-red-500/10 border-red-500/20' 
  },
  vip: { 
    icon: Star, 
    colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20' 
  },
  escalation: { 
    icon: ArrowUpRight, 
    colorClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20' 
  },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const diffMins = Math.floor((new Date().getTime() - date.getTime()) / 60000);
  if (diffMins < 1) return 'Ahora';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

// ============= COMPONENT: NOTIFICATION ITEM =============

const NotificationItem: React.FC<{
  notification: InternalNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onAction?: (url: string) => void;
}> = ({ notification, onMarkRead, onDelete, onAction }) => {
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;

  return (
    <div className={`group relative p-4 border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors ${!notification.read ? 'bg-zinc-900/30' : ''}`}>
      
      {/* Unread Dot */}
      {!notification.read && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
      )}

      <div className="flex gap-4">
        {/* Icon Avatar */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border ${config.colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex justify-between items-start pr-4">
            <p className={`text-sm font-semibold truncate ${!notification.read ? 'text-zinc-100' : 'text-zinc-400'}`}>
              {notification.title || 'Notificación'}
            </p>
          </div>
          
          <p className="text-sm text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">
            {notification.message}
          </p>
          
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-medium text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-800">
              {notification.fromAdminId.name}
            </span>
            <span className="text-[10px] text-zinc-600">•</span>
            <span className="text-xs text-zinc-500">
              {formatRelativeTime(notification.createdAt)}
            </span>
          </div>

          {/* Action Link */}
          {notification.actionUrl && (
            <button
              onClick={() => onAction?.(notification.actionUrl!)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors group/link"
            >
              {notification.actionLabel || 'Ver detalles'}
              <ArrowUpRight className="w-3 h-3 transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* Hover Actions */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 bg-zinc-950/80 backdrop-blur-sm p-1 rounded-lg border border-zinc-800 shadow-xl">
        {!notification.read && (
          <button onClick={() => onMarkRead(notification._id)} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors" title="Marcar como leído">
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
        <button onClick={() => onDelete(notification._id)} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="Eliminar">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ============= MAIN COMPONENT =============

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, notificationsLoading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotificationStore();

  // Outside click & Keydown handlers
  useEffect(() => {
    const handleClick = (e: MouseEvent) => !panelRef.current?.contains(e.target as Node) && setIsOpen(false);
    const handleEsc = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    if (isOpen) { document.addEventListener('mousedown', handleClick); document.addEventListener('keydown', handleEsc); fetchNotifications(); }
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [isOpen, fetchNotifications]);

  const handleAction = (url: string) => { window.location.href = url; setIsOpen(false); };

  return (
    <div className="relative" ref={panelRef}>
      
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          relative p-2.5 rounded-xl transition-all duration-200 border border-transparent
          ${isOpen ? 'bg-zinc-800 text-white border-zinc-700' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}
        `}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-2 border-zinc-950"></span>
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute mt-3 w-96 origin-top-right bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-zinc-100">Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold">
                  {unreadCount} nuevas
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead()}
                  className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                  title="Marcar todo como leído"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[400px]scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            {notificationsLoading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
                <div className="p-4 bg-zinc-900 rounded-full mb-3 border border-zinc-800">
                  <Inbox className="w-8 h-8 opacity-50" />
                </div>
                <p className="text-sm font-medium">Estás al día</p>
                <p className="text-xs opacity-60">No tienes notificaciones pendientes</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {notifications.map(notification => (
                  <NotificationItem
                    key={notification._id}
                    notification={notification}
                    onMarkRead={markAsRead}
                    onDelete={deleteNotification}
                    onAction={handleAction}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="bg-zinc-900/30 border-t border-zinc-800 p-2 text-center">
             <button 
               onClick={() => { setShowHistoryModal(true); setIsOpen(false); }}
               className="text-[10px] uppercase font-bold text-zinc-500 hover:text-zinc-300 transition-colors py-1"
             >
               Ver historial completo
             </button>
          </div>
        </div>
      )}

      {/* History Modal */}
      <NotificationHistoryModal 
        isOpen={showHistoryModal} 
        onClose={() => setShowHistoryModal(false)} 
      />
    </div>
  );
};

export default NotificationCenter;
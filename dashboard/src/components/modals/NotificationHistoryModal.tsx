/**
 * NotificationHistoryModal - Full Notification History with Scroll Navigation
 * Premium Zinc Design - Full history view with infinite scroll
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Bell, Check, CheckCheck, Trash2, MessageSquare, UserPlus, Clock,
  AlertTriangle, Star, ArrowUpRight, Loader2, Inbox, Filter, ChevronDown,
  ChevronUp, Calendar, Search
} from 'lucide-react';
import api from '../../services/api';
import type { InternalNotification } from '../../stores/notificationStore';

// ============= TYPE CONFIG =============

const TYPE_CONFIG: Record<InternalNotification['type'], { icon: React.ElementType; colorClass: string; label: string }> = {
  message: { 
    icon: MessageSquare, 
    colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    label: 'Mensaje'
  },
  assignment: { 
    icon: UserPlus, 
    colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    label: 'Asignación'
  },
  reminder: { 
    icon: Clock, 
    colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    label: 'Recordatorio'
  },
  alert: { 
    icon: AlertTriangle, 
    colorClass: 'text-red-400 bg-red-500/10 border-red-500/20',
    label: 'Alerta'
  },
  vip: { 
    icon: Star, 
    colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    label: 'VIP'
  },
  escalation: { 
    icon: ArrowUpRight, 
    colorClass: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    label: 'Escalación'
  },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return date.toLocaleDateString('es-ES', { weekday: 'long' });
  
  return date.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: 'short', 
    year: diffDays > 365 ? 'numeric' : undefined 
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// ============= NOTIFICATION ITEM =============

const HistoryNotificationItem: React.FC<{
  notification: InternalNotification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onAction?: (url: string) => void;
}> = ({ notification, onMarkRead, onDelete, onAction }) => {
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;

  return (
    <div className={`
      group relative p-4 rounded-xl border transition-all duration-200
      ${notification.read 
        ? 'bg-zinc-900/30 border-zinc-800/50 hover:border-zinc-700' 
        : 'bg-zinc-900/60 border-zinc-700 hover:border-zinc-600 shadow-lg shadow-black/20'
      }
    `}>
      {/* Unread Indicator */}
      {!notification.read && (
        <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
      )}

      <div className="flex gap-4">
        {/* Icon */}
        <div className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border ${config.colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${config.colorClass}`}>
                  {config.label}
                </span>
                <span className="text-xs text-zinc-500">{formatTime(notification.createdAt)}</span>
              </div>
              
              <h4 className={`text-sm font-semibold mb-1 ${notification.read ? 'text-zinc-400' : 'text-zinc-100'}`}>
                {notification.title || 'Notificación'}
              </h4>
              
              <p className="text-sm text-zinc-500 leading-relaxed">
                {notification.message}
              </p>
              
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-zinc-500">
                  De: <span className="text-zinc-400 font-medium">{notification.fromAdminId.name}</span>
                </span>
              </div>

              {notification.actionUrl && (
                <button
                  onClick={() => onAction?.(notification.actionUrl!)}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {notification.actionLabel || 'Ver detalles'}
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {!notification.read && (
                <button 
                  onClick={() => onMarkRead(notification._id)} 
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  title="Marcar como leído"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button 
                onClick={() => onDelete(notification._id)} 
                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============= API RESPONSE TYPE =============

interface NotificationsApiResponse {
  ok: boolean;
  notifications: InternalNotification[];
}

// ============= DATE GROUP =============

interface DateGroup {
  date: string;
  label: string;
  notifications: InternalNotification[];
}

// ============= MAIN COMPONENT =============

interface NotificationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationHistoryModal: React.FC<NotificationHistoryModalProps> = ({ isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<InternalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState<InternalNotification['type'] | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentDateLabel, setCurrentDateLabel] = useState('');

  // Fetch notifications
  const fetchNotifications = useCallback(async (pageNum: number, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '30',
      });
      if (filter === 'unread') params.append('unread', 'true');
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (searchQuery) params.append('search', searchQuery);

      const { data } = await api.get<NotificationsApiResponse>(`/api/notifications?${params}`);
      
      if (data.ok) {
        setNotifications(prev => append ? [...prev, ...data.notifications] : data.notifications);
        setHasMore(data.notifications.length === 30);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, typeFilter, searchQuery]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      setPage(1);
      fetchNotifications(1);
    }
  }, [isOpen, filter, typeFilter, searchQuery, fetchNotifications]);

  // Load more on scroll
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || loadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    if (scrollHeight - scrollTop - clientHeight < 200) {
      setPage(p => p + 1);
      fetchNotifications(page + 1, true);
    }

    // Update current date label based on scroll position
    const dateHeaders = container.querySelectorAll('[data-date-label]');
    for (const header of dateHeaders) {
      const rect = header.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < 150) {
        setCurrentDateLabel((header as HTMLElement).dataset.dateLabel || '');
        break;
      }
    }
  }, [loadingMore, hasMore, page, fetchNotifications]);

  // Group notifications by date
  const groupedNotifications: DateGroup[] = React.useMemo(() => {
    const groups: Map<string, DateGroup> = new Map();
    
    notifications.forEach(notif => {
      const date = new Date(notif.createdAt).toDateString();
      if (!groups.has(date)) {
        groups.set(date, {
          date,
          label: formatDate(notif.createdAt),
          notifications: [],
        });
      }
      groups.get(date)!.notifications.push(notif);
    });

    return Array.from(groups.values());
  }, [notifications]);

  // Actions
  const handleMarkRead = async (id: string) => {
    try {
      await api.post(`/api/notifications/${id}/read`, {});
      setNotifications(prev => prev.map(n => 
        n._id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
      ));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/api/notifications/read-all', {});
      setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/notifications/${id}`, {});
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleAction = (url: string) => {
    window.location.href = url;
    onClose();
  };

  // Scroll to date
  const scrollToDate = (direction: 'up' | 'down') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const dateHeaders = Array.from(container.querySelectorAll('[data-date-label]'));
    const currentIndex = dateHeaders.findIndex(h => (h as HTMLElement).dataset.dateLabel === currentDateLabel);
    
    const targetIndex = direction === 'up' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(dateHeaders.length - 1, currentIndex + 1);

    dateHeaders[targetIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <Bell className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Historial de Notificaciones</h2>
                <p className="text-xs text-zinc-500">
                  {notifications.length} notificaciones • {unreadCount} sin leer
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-white hover:bg-indigo-500/10 rounded-lg border border-transparent hover:border-indigo-500/20 transition-all"
                >
                  <CheckCheck className="w-4 h-4" />
                  Marcar todo
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="px-5 pb-4 space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar notificaciones..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              <div className="flex p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                {(['all', 'unread'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      filter === f 
                        ? 'bg-zinc-800 text-white' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {f === 'all' ? 'Todas' : 'Sin leer'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  showFilters || typeFilter !== 'all'
                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    : 'text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filtros
                {showFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Type Filter Dropdown */}
            {showFilters && (
              <div className="flex flex-wrap gap-2 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  onClick={() => setTypeFilter('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    typeFilter === 'all'
                      ? 'bg-zinc-800 text-white border-zinc-700'
                      : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  Todos los tipos
                </button>
                {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                  <button
                    key={type}
                    onClick={() => setTypeFilter(type as InternalNotification['type'])}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      typeFilter === type
                        ? `${config.colorClass}`
                        : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'
                    }`}
                  >
                    <config.icon className="w-3.5 h-3.5" />
                    {config.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Date Navigation Floating Button */}
        {currentDateLabel && (
          <div className="absolute right-6 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1">
            <button
              onClick={() => scrollToDate('up')}
              className="p-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors backdrop-blur-sm"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <div className="px-2 py-1 bg-zinc-900/90 backdrop-blur-sm rounded-lg border border-zinc-800">
              <span className="text-[10px] font-bold text-zinc-400 uppercase whitespace-nowrap">
                {currentDateLabel}
              </span>
            </div>
            <button
              onClick={() => scrollToDate('down')}
              className="p-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition-colors backdrop-blur-sm"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="overflow-y-auto max-h-[calc(85vh-200px)] scroll-smooth"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-zinc-500">Cargando historial...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-4 bg-zinc-900 rounded-full mb-4 border border-zinc-800">
                <Inbox className="w-10 h-10 text-zinc-600" />
              </div>
              <h3 className="text-lg font-bold text-zinc-300 mb-1">Sin notificaciones</h3>
              <p className="text-sm text-zinc-500">
                {filter === 'unread' ? 'No tienes notificaciones sin leer' : 'Tu historial está vacío'}
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-6">
              {groupedNotifications.map((group) => (
                <div key={group.date}>
                  {/* Date Header */}
                  <div 
                    data-date-label={group.label}
                    className="sticky top-0 z-10 flex items-center gap-3 mb-4 py-2"
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800">
                      <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                      <span className="text-xs font-bold text-zinc-400 uppercase">
                        {group.label}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-xs text-zinc-600">{group.notifications.length}</span>
                  </div>

                  {/* Notifications */}
                  <div className="space-y-3">
                    {group.notifications.map((notification) => (
                      <HistoryNotificationItem
                        key={notification._id}
                        notification={notification}
                        onMarkRead={handleMarkRead}
                        onDelete={handleDelete}
                        onAction={handleAction}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Load More Indicator */}
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                </div>
              )}

              {!hasMore && notifications.length > 0 && (
                <div className="text-center py-6 border-t border-zinc-800 mt-6">
                  <p className="text-xs text-zinc-600">— Fin del historial —</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationHistoryModal;

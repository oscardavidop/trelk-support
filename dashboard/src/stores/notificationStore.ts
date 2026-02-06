/**
 * Internal Communications Store
 * Manages notifications and broadcasts state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { toast } from './toastStore';

// ============= TYPES =============

export interface InternalNotification {
  _id: string;
  type: 'message' | 'assignment' | 'reminder' | 'alert' | 'vip' | 'escalation';
  title?: string;
  message: string;
  priority: 'normal' | 'urgent';
  fromAdminId: {
    _id: string;
    name: string;
    avatar?: string;
    role: string;
  };
  actionUrl?: string;
  actionLabel?: string;
  relatedChatId?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export interface InternalBroadcast {
  _id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  requireAck: boolean;
  isPinned: boolean;
  createdBy: {
    _id: string;
    name: string;
    avatar?: string;
  };
  expiresAt?: string;
  createdAt: string;
  receipt?: {
    seenAt?: string;
    acknowledgedAt?: string;
  };
}

// API Response types
interface NotificationsResponse {
  ok: boolean;
  notifications: InternalNotification[];
  unreadCount: number;
}

interface UnreadCountResponse {
  ok: boolean;
  unreadCount: number;
}

interface BroadcastsResponse {
  ok: boolean;
  broadcasts: InternalBroadcast[];
}

interface ApiResponse {
  ok: boolean;
}

interface NotificationState {
  // Notifications
  notifications: InternalNotification[];
  unreadCount: number;
  notificationsLoading: boolean;
  
  // Broadcasts
  broadcasts: InternalBroadcast[];
  broadcastsLoading: boolean;
  
  // Actions
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
  
  fetchBroadcasts: () => Promise<void>;
  acknowledgeBroadcast: (broadcastId: string) => Promise<void>;
  markBroadcastSeen: (broadcastId: string) => Promise<void>;
  
  // Socket handlers
  handleNewNotification: (notification: unknown) => void;
  handleNotificationCount: (data: { unreadCount: number }) => void;
  handleNewBroadcast: (broadcast: unknown) => void;
  handleBroadcastCancelled: (data: { id: string }) => void;
  
  // Reset
  reset: () => void;
}

// ============= STORE =============

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      notifications: [],
      unreadCount: 0,
      notificationsLoading: false,
      broadcasts: [],
      broadcastsLoading: false,

      // Fetch notifications
      fetchNotifications: async () => {
        set({ notificationsLoading: true });
        try {
          const { data } = await api.get<NotificationsResponse>('/api/notifications?limit=50');
          if (data.ok) {
            set({
              notifications: data.notifications,
              unreadCount: data.unreadCount,
            });
          }
        } catch (error) {
          console.error('Failed to fetch notifications:', error);
        } finally {
          set({ notificationsLoading: false });
        }
      },

      // Fetch unread count only
      fetchUnreadCount: async () => {
        try {
          const { data } = await api.get<UnreadCountResponse>('/api/notifications/unread-count');
          if (data.ok) {
            set({ unreadCount: data.unreadCount });
          }
        } catch (error) {
          console.error('Failed to fetch unread count:', error);
        }
      },

      // Mark notification as read
      markAsRead: async (notificationId: string) => {
        try {
          const { data } = await api.post<ApiResponse>(`/api/notifications/${notificationId}/read`, {});
          if (data.ok) {
            set(state => ({
              notifications: state.notifications.map(n =>
                n._id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n
              ),
              unreadCount: Math.max(0, state.unreadCount - 1),
            }));
          }
        } catch (error) {
          console.error('Failed to mark notification as read:', error);
        }
      },

      // Mark all as read
      markAllAsRead: async () => {
        try {
          const { data } = await api.post<ApiResponse>('/api/notifications/read-all', {});
          if (data.ok) {
            set(state => ({
              notifications: state.notifications.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })),
              unreadCount: 0,
            }));
          }
        } catch (error) {
          console.error('Failed to mark all notifications as read:', error);
        }
      },

      // Delete notification
      deleteNotification: async (notificationId: string) => {
        try {
          const { data } = await api.delete<ApiResponse>(`/api/notifications/${notificationId}`, {});
          if (data.ok) {
            const notif = get().notifications.find(n => n._id === notificationId);
            set(state => ({
              notifications: state.notifications.filter(n => n._id !== notificationId),
              unreadCount: notif && !notif.read ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
            }));
          }
        } catch (error) {
          console.error('Failed to delete notification:', error);
        }
      },

      // Fetch broadcasts
      fetchBroadcasts: async () => {
        set({ broadcastsLoading: true });
        try {
          const { data } = await api.get<BroadcastsResponse>('/api/internal-broadcasts/pending');
          if (data.ok) {
            set({ broadcasts: data.broadcasts });
          }
        } catch (error) {
          console.error('Failed to fetch broadcasts:', error);
        } finally {
          set({ broadcastsLoading: false });
        }
      },

      // Acknowledge broadcast
      acknowledgeBroadcast: async (broadcastId: string) => {
        try {
          const { data } = await api.post<ApiResponse>(`/api/internal-broadcasts/${broadcastId}/acknowledge`, {});
          if (data.ok) {
            set(state => ({
              broadcasts: state.broadcasts.filter(b => b._id !== broadcastId),
            }));
          }
        } catch (error) {
          console.error('Failed to acknowledge broadcast:', error);
        }
      },

      // Mark broadcast as seen
      markBroadcastSeen: async (broadcastId: string) => {
        try {
          await api.post(`/api/internal-broadcasts/${broadcastId}/seen`, {});
        } catch (error) {
          console.error('Failed to mark broadcast as seen:', error);
        }
      },

      // Socket handler: new notification
      handleNewNotification: (notification: unknown) => {
        const notif = notification as Record<string, unknown>;
        
        // Show toast notification
        const fromName = (notif.from as { name?: string })?.name || 'Sistema';
        const notifTitle = notif.title as string || 'Nueva notificación';
        const notifMessage = notif.message as string;
        const isUrgent = notif.priority === 'urgent';
        
        toast[isUrgent ? 'warning' : 'info'](
          notifTitle,
          `${fromName}: ${notifMessage.slice(0, 80)}${notifMessage.length > 80 ? '...' : ''}`,
          { 
            duration: isUrgent ? 8000 : 5000,
            priority: isUrgent ? 'high' : 'normal',
          }
        );
        
        // Play sound for urgent
        if (isUrgent) {
          try {
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {});
          } catch {
            // Ignore audio errors
          }
        }

        set(state => ({
          notifications: [
            {
              _id: notif.id as string,
              type: notif.type as InternalNotification['type'],
              title: notif.title as string | undefined,
              message: notif.message as string,
              priority: notif.priority as 'normal' | 'urgent',
              fromAdminId: notif.from as InternalNotification['fromAdminId'],
              actionUrl: notif.actionUrl as string | undefined,
              actionLabel: notif.actionLabel as string | undefined,
              relatedChatId: notif.relatedChatId as string | undefined,
              read: false,
              createdAt: notif.createdAt as string,
            },
            ...state.notifications,
          ].slice(0, 100), // Keep last 100
          unreadCount: state.unreadCount + 1,
        }));
      },

      // Socket handler: notification count update
      handleNotificationCount: (data: { unreadCount: number }) => {
        set({ unreadCount: data.unreadCount });
      },

      // Socket handler: new broadcast
      handleNewBroadcast: (broadcast: unknown) => {
        const bc = broadcast as Record<string, unknown>;
        const bcLevel = bc.level as string;
        const bcTitle = bc.title as string;
        const bcMessage = bc.message as string;
        
        // Show toast for broadcast
        const toastType = bcLevel === 'critical' ? 'error' : bcLevel === 'warning' ? 'warning' : 'info';
        toast[toastType](
          `📢 ${bcTitle}`,
          bcMessage.slice(0, 100) + (bcMessage.length > 100 ? '...' : ''),
          { 
            duration: bcLevel === 'critical' ? 0 : 8000, // Critical is persistent
            priority: bcLevel === 'critical' ? 'critical' : 'high',
          }
        );
        
        // Play sound for critical
        if (bcLevel === 'critical') {
          try {
            const audio = new Audio('/sounds/alert.mp3');
            audio.volume = 0.7;
            audio.play().catch(() => {});
          } catch {
            // Ignore audio errors
          }
        }

        set(state => {
          // Don't add if already exists
          if (state.broadcasts.some(b => b._id === bc.id)) {
            return state;
          }
          return {
            broadcasts: [
              {
                _id: bc.id as string,
                title: bc.title as string,
                message: bc.message as string,
                level: bc.level as 'info' | 'warning' | 'critical',
                requireAck: bc.requireAck as boolean,
                isPinned: bc.isPinned as boolean,
                createdBy: bc.createdBy as InternalBroadcast['createdBy'],
                expiresAt: bc.expiresAt as string | undefined,
                createdAt: bc.createdAt as string,
              },
              ...state.broadcasts,
            ],
          };
        });
      },

      // Socket handler: broadcast cancelled
      handleBroadcastCancelled: (data: { id: string }) => {
        set(state => ({
          broadcasts: state.broadcasts.filter(b => b._id !== data.id),
        }));
      },

      // Reset state
      reset: () => {
        set({
          notifications: [],
          unreadCount: 0,
          notificationsLoading: false,
          broadcasts: [],
          broadcastsLoading: false,
        });
      },
    }),
    {
      name: 'notification-store',
      partialize: (state) => ({
        // Only persist unread count for badge display
        unreadCount: state.unreadCount,
      }),
    }
  )
);

// ============= SOCKET INTEGRATION =============

export function initNotificationSocket() {
  const socket = getSocket();
  if (!socket) return;

  const store = useNotificationStore.getState();

  socket.on('agent.notification', store.handleNewNotification);
  socket.on('notification.count', store.handleNotificationCount);
  socket.on('broadcast.new', store.handleNewBroadcast);
  socket.on('broadcast.cancelled', store.handleBroadcastCancelled);

  // Fetch initial data
  store.fetchUnreadCount();
  store.fetchBroadcasts();
}

export function cleanupNotificationSocket() {
  const socket = getSocket();
  if (!socket) return;

  socket.off('agent.notification');
  socket.off('notification.count');
  socket.off('broadcast.new');
  socket.off('broadcast.cancelled');
}

export default useNotificationStore;

/**
 * Settings Store
 * Manages application settings with persistence and real-time sync
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============= TYPES =============

export interface NotificationSettings {
  emailNotifications: boolean;
  newChatSound: boolean;
  newMessageSound: boolean;
  desktopNotifications: boolean;
  escalationAlerts: boolean;
  dailyReportEmail: boolean;
  volume: number;
}

export interface AppSettings {
  notifications: NotificationSettings;
  // Add other settings sections as needed
}

interface SettingsState {
  settings: AppSettings;
  isLoaded: boolean;
  
  // Actions
  setSettings: (settings: Partial<AppSettings>) => void;
  setNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  loadFromServer: (serverSettings: Record<string, unknown>) => void;
  reset: () => void;
}

// ============= DEFAULTS =============

const defaultNotificationSettings: NotificationSettings = {
  emailNotifications: true,
  newChatSound: true,
  newMessageSound: true,
  desktopNotifications: true,
  escalationAlerts: true,
  dailyReportEmail: false,
  volume: 0.5,
};

const defaultSettings: AppSettings = {
  notifications: defaultNotificationSettings,
};

// ============= STORE =============

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      isLoaded: false,

      setSettings: (newSettings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            ...newSettings,
          },
        }));
      },

      setNotificationSettings: (notifSettings) => {
        set((state) => ({
          settings: {
            ...state.settings,
            notifications: {
              ...state.settings.notifications,
              ...notifSettings,
            },
          },
        }));
      },

      loadFromServer: (serverSettings) => {
        // Map server settings to client format
        if (serverSettings.notifications) {
          const notif = serverSettings.notifications as Record<string, unknown>;
          set((state) => ({
            settings: {
              ...state.settings,
              notifications: {
                emailNotifications: notif.emailNotifications as boolean ?? state.settings.notifications.emailNotifications,
                newChatSound: notif.newChatSound as boolean ?? state.settings.notifications.newChatSound,
                newMessageSound: notif.newMessageSound as boolean ?? state.settings.notifications.newMessageSound,
                desktopNotifications: notif.desktopNotifications as boolean ?? state.settings.notifications.desktopNotifications,
                escalationAlerts: notif.escalationAlerts as boolean ?? state.settings.notifications.escalationAlerts,
                dailyReportEmail: notif.dailyReportEmail as boolean ?? state.settings.notifications.dailyReportEmail,
                volume: (notif.volume as number) ?? state.settings.notifications.volume,
              },
            },
            isLoaded: true,
          }));
        }
      },

      reset: () => {
        set({
          settings: defaultSettings,
          isLoaded: false,
        });
      },
    }),
    {
      name: 'trelk-support-settings',
      partialize: (state) => ({
        settings: state.settings,
      }),
    }
  )
);

// ============= HELPERS =============

/**
 * Check if new chat sound is enabled
 */
export function shouldPlayNewChatSound(): boolean {
  return useSettingsStore.getState().settings.notifications.newChatSound;
}

/**
 * Check if new message sound is enabled
 */
export function shouldPlayNewMessageSound(): boolean {
  return useSettingsStore.getState().settings.notifications.newMessageSound;
}

/**
 * Get notification volume (0-1)
 */
export function getNotificationVolume(): number {
  return useSettingsStore.getState().settings.notifications.volume;
}

/**
 * Check if desktop notifications are enabled
 */
export function shouldShowDesktopNotifications(): boolean {
  return useSettingsStore.getState().settings.notifications.desktopNotifications;
}

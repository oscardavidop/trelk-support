/**
 * Theme Hook - Manages theme state and persistence
 * 
 * Features:
 * - Dark/Light/System theme modes
 * - Persists to localStorage and server
 * - Syncs with system preferences
 * - Prevents flash on load
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as settingsService from '../services/settings.service';
import useFocusModeStore from './useFocusMode';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  isLoaded: boolean;
  setTheme: (theme: Theme) => void;
  loadThemeFromServer: () => Promise<void>;
  saveThemeToServer: (theme: Theme) => Promise<void>;
}

// Get system preference
const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// Resolve theme (convert 'system' to actual theme)
const resolveTheme = (theme: Theme): ResolvedTheme => {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
};

// Apply theme to DOM
const applyTheme = (resolvedTheme: ResolvedTheme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolvedTheme);
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      resolvedTheme: 'dark',
      isLoaded: false,

      setTheme: (theme: Theme) => {
        const resolvedTheme = resolveTheme(theme);
        applyTheme(resolvedTheme);
        set({ theme, resolvedTheme });

        // Save to server in background
        get().saveThemeToServer(theme);
      },

      loadThemeFromServer: async () => {
        try {
          const prefs = await settingsService.getPreferences();
          const theme = (prefs?.theme as Theme) || 'dark';
          const resolvedTheme = resolveTheme(theme);
          useFocusModeStore.setState({
            isEnabled: Boolean(prefs?.organizationSettings?.agentRules?.focusModeEnabled || prefs?.focusMode), // Legacy support for individual focus mode setting
            isForce: Boolean(prefs?.organizationSettings?.agentRules?.focusModeEnabled),
          });
          applyTheme(resolvedTheme);
          set({ theme, resolvedTheme, isLoaded: true });
        } catch {
          // Use stored theme if server fails
          const { theme } = get();
          const resolvedTheme = resolveTheme(theme);
          applyTheme(resolvedTheme);
          set({ resolvedTheme, isLoaded: true });
        }
      },

      saveThemeToServer: async (theme: Theme) => {
        try {
          await settingsService.updatePreferences({ theme });
        } catch (error) {
          console.error('Failed to save theme:', error);
        }
      },
    }),
    {
      name: 'trelk-theme',
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        // Apply theme immediately on rehydration to prevent flash
        if (state) {
          const resolvedTheme = resolveTheme(state.theme);
          applyTheme(resolvedTheme);
          state.resolvedTheme = resolvedTheme;
        }
      },
    }
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const state = useThemeStore.getState();
    if (state.theme === 'system') {
      const resolvedTheme = e.matches ? 'dark' : 'light';
      applyTheme(resolvedTheme);
      useThemeStore.setState({ resolvedTheme });
    }
  });
}

// Convenience hook
export const useTheme = () => {
  const theme = useThemeStore((s) => s.theme);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const isLoaded = useThemeStore((s) => s.isLoaded);

  return { theme, resolvedTheme, setTheme, isLoaded };
};

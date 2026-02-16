/**
 * ThemeProvider Component
 * 
 * Wraps the app and manages theme initialization
 * - Loads theme from server on auth
 * - Applies theme before first render to prevent flash
 * - Smooth transition animation when switching themes
 * - Auto-sync with system preference changes
 * - Cross-tab synchronization via storage events
 */

import { useEffect, useCallback, type ReactNode } from 'react';
import { useThemeStore, type ResolvedTheme } from '../hooks/useTheme';
import { useAuthStore } from '../stores/authStore';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadThemeFromServer = useThemeStore((s) => s.loadThemeFromServer);
  const theme = useThemeStore((s) => s.theme);

  const applyThemeWithTransition = useCallback((resolved: ResolvedTheme) => {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    if (current === resolved) return;

    // Add transition class for smooth animation
    html.classList.add('theme-transitioning');
    html.setAttribute('data-theme', resolved);

    // Remove transition class after animation completes
    const timeout = setTimeout(() => {
      html.classList.remove('theme-transitioning');
    }, 350);

    return () => clearTimeout(timeout);
  }, []);

  // Load theme from server when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadThemeFromServer();
    }
  }, [isAuthenticated, loadThemeFromServer]);

  // Apply resolved theme and handle system preference changes
  useEffect(() => {
    const resolve = (): ResolvedTheme =>
      theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;

    applyThemeWithTransition(resolve());

    // Listen for system theme changes (only relevant when theme === 'system')
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      if (useThemeStore.getState().theme === 'system') {
        const resolved = mql.matches ? 'dark' : 'light';
        applyThemeWithTransition(resolved);
        useThemeStore.setState({ resolvedTheme: resolved });
      }
    };
    mql.addEventListener('change', handleSystemChange);

    return () => mql.removeEventListener('change', handleSystemChange);
  }, [theme, applyThemeWithTransition]);

  // Cross-tab synchronization via localStorage changes
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'trelk-theme' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          const newTheme = parsed?.state?.theme;
          if (newTheme && newTheme !== useThemeStore.getState().theme) {
            useThemeStore.getState().setTheme(newTheme);
          }
        } catch { /* ignore parse errors */ }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  return <>{children}</>;
}

export default ThemeProvider;

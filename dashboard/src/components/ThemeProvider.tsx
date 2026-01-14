/**
 * ThemeProvider Component
 * 
 * Wraps the app and manages theme initialization
 * - Loads theme from server on auth
 * - Applies theme before first render to prevent flash
 */

import { useEffect, type ReactNode } from 'react';
import { useThemeStore } from '../hooks/useTheme';
import { useAuthStore } from '../stores/authStore';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadThemeFromServer = useThemeStore((s) => s.loadThemeFromServer);
  const theme = useThemeStore((s) => s.theme);

  // Load theme from server when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadThemeFromServer();
    }
  }, [isAuthenticated, loadThemeFromServer]);

  // Apply theme on mount (for unauthenticated users using localStorage theme)
  useEffect(() => {
    const resolvedTheme = theme === 'system' 
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [theme]);

  return <>{children}</>;
}

export default ThemeProvider;

/**
 * AutoLockProvider Component
 * Wraps the application to provide auto-lock functionality
 * 
 * Features:
 * - Integrates useIdleDetector hook
 * - Renders LockScreenOverlay when locked
 * - Shows IdleWarningToast before lock
 * - Handles logout from lock screen
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIdleDetector } from '../hooks/useIdleDetector';
import { useAuthStore } from '../stores/authStore';
import LockScreenOverlay from './LockScreenOverlay';
import IdleWarningToast from './IdleWarningToast';

interface AutoLockProviderProps {
  children: React.ReactNode;
}

export default function AutoLockProvider({ children }: AutoLockProviderProps) {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const handleLock = useCallback(() => {
    console.log('[AutoLock] Session locked');
  }, []);

  const handleUnlock = useCallback(() => {
    console.log('[AutoLock] Session unlocked');
  }, []);

  const handleWarning = useCallback((secondsLeft: number) => {
    console.log('[AutoLock] Warning:', secondsLeft, 'seconds left');
  }, []);

  const [state, actions] = useIdleDetector({
    onLock: handleLock,
    onUnlock: handleUnlock,
    onWarning: handleWarning,
  });

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('[AutoLock] Logout failed:', error);
      // Force navigation anyway
      navigate('/login');
    }
  }, [logout, navigate]);

  // Only render auto-lock components if authenticated
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      
      {/* Idle Warning Toast */}
      <IdleWarningToast
        visible={state.warningActive && !state.isLocked}
        secondsLeft={state.warningSecondsLeft}
        onDismiss={actions.dismissWarning}
      />
      
      {/* Lock Screen Overlay */}
      <LockScreenOverlay
        state={state}
        actions={actions}
        onLogout={handleLogout}
      />
    </>
  );
}

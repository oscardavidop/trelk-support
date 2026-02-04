/**
 * useIdleDetector Hook
 * Detects user inactivity and triggers auto-lock functionality
 * 
 * Features:
 * - Detects various user interactions (mouse, keyboard, touch, scroll)
 * - Configurable timeout per role
 * - Grace period warning before locking
 * - Multi-tab synchronization via BroadcastChannel
 * - Remote lock detection via polling
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuthStore } from '../stores/authStore';

// Events to track for activity
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'keyup',
  'scroll',
  'touchstart',
  'touchmove',
  'click',
  'wheel',
  'focus',
  'visibilitychange',
] as const;

// BroadcastChannel for multi-tab sync
const LOCK_CHANNEL_NAME = 'trelk-auto-lock';

export interface AutoLockSettings {
  enabled: boolean;
  timeoutMinutes: number | null;
  requirePassword: boolean;
  requireMFA: boolean;
  showLastActivity: boolean;
  gracePeriodSeconds: number;
}

export interface IdleDetectorState {
  isIdle: boolean;
  isLocked: boolean;
  lockReason: 'inactivity' | 'remote' | 'manual' | 'security' | null;
  lastActivity: Date | null;
  warningActive: boolean;
  warningSecondsLeft: number;
  settings: AutoLockSettings | null;
}

export interface IdleDetectorActions {
  resetActivity: () => void;
  manualLock: () => Promise<void>;
  unlock: (password?: string, mfaCode?: string) => Promise<{ success: boolean; error?: string; remainingAttempts?: number }>;
  dismissWarning: () => void;
}

interface UseIdleDetectorOptions {
  onLock?: () => void;
  onUnlock?: () => void;
  onWarning?: (secondsLeft: number) => void;
}

const defaultSettings: AutoLockSettings = {
  enabled: false,
  timeoutMinutes: null,
  requirePassword: true,
  requireMFA: false,
  showLastActivity: true,
  gracePeriodSeconds: 30,
};

export function useIdleDetector(options: UseIdleDetectorOptions = {}): [IdleDetectorState, IdleDetectorActions] {
  const { onLock, onUnlock, onWarning } = options;
  
  const agent = useAuthStore((state) => state.agent);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  const [state, setState] = useState<IdleDetectorState>({
    isIdle: false,
    isLocked: false,
    lockReason: null,
    lastActivity: null,
    warningActive: false,
    warningSecondsLeft: 0,
    settings: null,
  });
  
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const lastActivityRef = useRef<Date>(new Date());
  const settingsRef = useRef<AutoLockSettings>(defaultSettings);

  // Fetch auto-lock settings and status from server
  const fetchLockStatus = useCallback(async () => {
    if (!isAuthenticated || !agent) return;
    
    try {
      const response = await fetch('/api/auth/lock/status', {
        credentials: 'include',
      });
      
      if (!response.ok) return;
      
      const data = await response.json();
      
      if (data.ok) {
        const newSettings: AutoLockSettings = {
          enabled: data.settings?.enabled ?? false,
          timeoutMinutes: data.settings?.timeoutMinutes ?? null,
          requirePassword: data.settings?.requirePassword ?? true,
          requireMFA: data.settings?.requireMFA ?? false,
          showLastActivity: data.settings?.showLastActivity ?? true,
          gracePeriodSeconds: data.settings?.gracePeriodSeconds ?? 30,
        };
        
        settingsRef.current = newSettings;
        
        // Check for remote lock
        if (data.hasRemoteLock || data.lockState?.isLocked) {
          setState(prev => ({
            ...prev,
            settings: newSettings,
            isLocked: true,
            lockReason: data.lockState?.reason || 'remote',
            lastActivity: data.lastActivity ? new Date(data.lastActivity) : prev.lastActivity,
          }));
          onLock?.();
        } else {
          setState(prev => ({
            ...prev,
            settings: newSettings,
            lastActivity: data.lastActivity ? new Date(data.lastActivity) : prev.lastActivity,
          }));
        }
      }
    } catch (error) {
      console.error('[IdleDetector] Failed to fetch lock status:', error);
    }
  }, [isAuthenticated, agent, onLock]);

  // Send activity heartbeat to server
  const sendActivityHeartbeat = useCallback(async () => {
    if (!isAuthenticated || state.isLocked) return;
    
    try {
      const response = await fetch('/api/auth/activity', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check for remote lock
        if (data.hasRemoteLock || data.isLocked) {
          setState(prev => ({
            ...prev,
            isLocked: true,
            lockReason: data.lockReason || 'remote',
          }));
          onLock?.();
        }
      }
    } catch (error) {
      console.error('[IdleDetector] Activity heartbeat failed:', error);
    }
  }, [isAuthenticated, state.isLocked, onLock]);

  // Reset activity timer
  const resetActivity = useCallback(() => {
    const now = new Date();
    lastActivityRef.current = now;
    
    setState(prev => ({
      ...prev,
      isIdle: false,
      lastActivity: now,
      warningActive: false,
      warningSecondsLeft: 0,
    }));
    
    // Clear existing timers
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    if (warningIntervalRef.current) {
      clearInterval(warningIntervalRef.current);
    }
    
    // Don't set new timer if locked or disabled
    if (state.isLocked || !settingsRef.current.enabled || !settingsRef.current.timeoutMinutes) {
      return;
    }
    
    const timeoutMs = settingsRef.current.timeoutMinutes * 60 * 1000;
    const gracePeriodMs = settingsRef.current.gracePeriodSeconds * 1000;
    
    // Set warning timer (before lock)
    if (gracePeriodMs > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          warningActive: true,
          warningSecondsLeft: settingsRef.current.gracePeriodSeconds,
        }));
        
        // Countdown interval
        warningIntervalRef.current = setInterval(() => {
          setState(prev => {
            const newSeconds = prev.warningSecondsLeft - 1;
            if (newSeconds <= 0) {
              clearInterval(warningIntervalRef.current!);
            }
            onWarning?.(newSeconds);
            return { ...prev, warningSecondsLeft: newSeconds };
          });
        }, 1000);
      }, timeoutMs - gracePeriodMs);
    }
    
    // Set lock timer
    idleTimeoutRef.current = setTimeout(() => {
      triggerLock('inactivity');
    }, timeoutMs);
    
    // Broadcast activity to other tabs
    broadcastChannelRef.current?.postMessage({
      type: 'ACTIVITY',
      timestamp: now.toISOString(),
    });
  }, [state.isLocked, onWarning]);

  // Trigger lock
  const triggerLock = useCallback(async (reason: IdleDetectorState['lockReason']) => {
    // Clear all timers
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    
    // Notify server
    try {
      await fetch('/api/auth/lock', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('[IdleDetector] Failed to notify server of lock:', error);
    }
    
    setState(prev => ({
      ...prev,
      isIdle: true,
      isLocked: true,
      lockReason: reason,
      warningActive: false,
      warningSecondsLeft: 0,
    }));
    
    // Broadcast to other tabs
    broadcastChannelRef.current?.postMessage({
      type: 'LOCK',
      reason,
      timestamp: new Date().toISOString(),
    });
    
    onLock?.();
  }, [onLock]);

  // Manual lock
  const manualLock = useCallback(async () => {
    await triggerLock('manual');
  }, [triggerLock]);

  // Unlock
  const unlock = useCallback(async (password?: string, mfaCode?: string): Promise<{ success: boolean; error?: string; remainingAttempts?: number }> => {
    if (!state.isLocked) {
      return { success: true };
    }
    
    try {
      // Try password unlock first
      if (password && settingsRef.current.requirePassword) {
        const response = await fetch('/api/auth/unlock', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        
        const data = await response.json();
        
        if (!data.ok) {
          return {
            success: false,
            error: data.error,
            remainingAttempts: data.remainingAttempts,
          };
        }
      }
      
      // Try MFA unlock if required
      if (mfaCode && settingsRef.current.requireMFA) {
        const response = await fetch('/api/auth/unlock/mfa', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: mfaCode }),
        });
        
        const data = await response.json();
        
        if (!data.ok) {
          return {
            success: false,
            error: data.error,
          };
        }
      }
      
      setState(prev => ({
        ...prev,
        isIdle: false,
        isLocked: false,
        lockReason: null,
        warningActive: false,
        warningSecondsLeft: 0,
      }));
      
      // Broadcast unlock to other tabs
      broadcastChannelRef.current?.postMessage({
        type: 'UNLOCK',
        timestamp: new Date().toISOString(),
      });
      
      onUnlock?.();
      resetActivity();
      
      return { success: true };
    } catch (error) {
      console.error('[IdleDetector] Unlock failed:', error);
      return { success: false, error: 'Error de conexión' };
    }
  }, [state.isLocked, onUnlock, resetActivity]);

  // Dismiss warning (reset timer)
  const dismissWarning = useCallback(() => {
    resetActivity();
  }, [resetActivity]);

  // Activity event handler
  const handleActivity = useCallback(() => {
    if (!state.isLocked && settingsRef.current.enabled) {
      resetActivity();
    }
  }, [state.isLocked, resetActivity]);

  // Initialize BroadcastChannel for multi-tab sync
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannelRef.current = new BroadcastChannel(LOCK_CHANNEL_NAME);
      
      broadcastChannelRef.current.onmessage = (event) => {
        const { type, reason, timestamp } = event.data;
        
        switch (type) {
          case 'LOCK':
            setState(prev => ({
              ...prev,
              isIdle: true,
              isLocked: true,
              lockReason: reason,
              warningActive: false,
              warningSecondsLeft: 0,
            }));
            onLock?.();
            break;
            
          case 'UNLOCK':
            setState(prev => ({
              ...prev,
              isIdle: false,
              isLocked: false,
              lockReason: null,
            }));
            onUnlock?.();
            resetActivity();
            break;
            
          case 'ACTIVITY':
            // Another tab had activity, reset our timer too
            lastActivityRef.current = new Date(timestamp);
            if (!state.isLocked) {
              resetActivity();
            }
            break;
        }
      };
    }
    
    return () => {
      broadcastChannelRef.current?.close();
    };
  }, [onLock, onUnlock, resetActivity, state.isLocked]);

  // Setup activity event listeners
  useEffect(() => {
    if (!isAuthenticated || !agent) return;
    
    // Add event listeners
    ACTIVITY_EVENTS.forEach((event) => {
      if (event === 'visibilitychange') {
        document.addEventListener(event, handleActivity);
      } else {
        window.addEventListener(event, handleActivity, { passive: true });
      }
    });
    
    // Cleanup
    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        if (event === 'visibilitychange') {
          document.removeEventListener(event, handleActivity);
        } else {
          window.removeEventListener(event, handleActivity);
        }
      });
    };
  }, [isAuthenticated, agent, handleActivity]);

  // Fetch initial settings and setup polling
  useEffect(() => {
    if (!isAuthenticated || !agent) return;
    
    // Initial fetch
    fetchLockStatus();
    
    // Poll for remote lock and settings changes
    pollingIntervalRef.current = setInterval(() => {
      fetchLockStatus();
    }, 30000); // Every 30 seconds
    
    // Activity heartbeat
    const heartbeatInterval = setInterval(() => {
      if (!state.isLocked) {
        sendActivityHeartbeat();
      }
    }, 60000); // Every minute
    
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      clearInterval(heartbeatInterval);
    };
  }, [isAuthenticated, agent, fetchLockStatus, sendActivityHeartbeat, state.isLocked]);

  // Initialize activity tracking when settings are loaded
  useEffect(() => {
    if (settingsRef.current.enabled && isAuthenticated && !state.isLocked) {
      resetActivity();
    }
  }, [state.settings?.enabled, isAuthenticated, state.isLocked, resetActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  return [
    state,
    {
      resetActivity,
      manualLock,
      unlock,
      dismissWarning,
    },
  ];
}

export default useIdleDetector;

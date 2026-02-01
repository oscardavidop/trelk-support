// Auth store using Zustand
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent } from '../types';
import { usePermissionStore } from './permissionStore';
import { clearBrowserSessionId } from '../services/sessionGuard.service';

interface AuthState {
  agent: Agent | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  forcePasswordChange: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setAgent: (agent: Agent | null) => void;
  updateAgentFields: (fields: Partial<Agent>) => void;
  setToken: (token: string | null) => void;
  setForcePasswordChange: (value: boolean) => void;
  checkAuth: () => Promise<void>;
}

const API_URL = '/api';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      agent: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      forcePasswordChange: false,

      login: async (email: string, password: string) => {
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include',
          });

          const data = await res.json();

          if (data.ok) {
            set({
              agent: data.agent,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              forcePasswordChange: data.forcePasswordChange || false,
            });
            
            // Store permissions from login response
            if (data.permissions) {
              usePermissionStore.getState().setPermissions(
                data.permissions,
                data.agent?.permissionVersion || 1
              );
            }
            
            return true;
          }

          return false;
        } catch (error) {
          console.error('Login error:', error);
          return false;
        }
      },

      logout: async () => {
        try {
          const { token } = get();
          await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
          });
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          // Clear permissions on logout
          usePermissionStore.getState().clearPermissions();
          
          // Clear browser session ID so next login gets a new session
          clearBrowserSessionId();
          
          set({
            agent: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            forcePasswordChange: false,
          });
        }
      },

      setAgent: (agent) => set({ agent, isAuthenticated: !!agent }),
      updateAgentFields: (fields) => set((state) => ({
        agent: state.agent ? { ...state.agent, ...fields } : null,
      })),
      setToken: (token) => set({ token }),
      setForcePasswordChange: (value) => set({ forcePasswordChange: value }),

      checkAuth: async () => {
        const { token } = get();
        
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const res = await fetch(`${API_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                ok: true,
            }),
            credentials: 'include',
          });

          const data = await res.json();

          if (data.ok) {
            set({
              agent: data.agent,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              forcePasswordChange: data.forcePasswordChange || false,
            });
            
            // Refresh permissions on auth check
            if (data.permissions) {
              usePermissionStore.getState().setPermissions(
                data.permissions,
                data.agent?.permissionVersion || 1
              );
            } else {
              // Fetch permissions if not in response
              usePermissionStore.getState().refreshPermissions();
            }
          } else {
            // Clear permissions on auth failure
            usePermissionStore.getState().clearPermissions();
            
            set({
              agent: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch {
          usePermissionStore.getState().clearPermissions();
          
          set({
            agent: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },
    }),
    {
      name: 'trelk-support-auth',
      partialize: (state) => ({ token: state.token, forcePasswordChange: state.forcePasswordChange }),
    }
  )
);

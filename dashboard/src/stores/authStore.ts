// Auth store using Zustand
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent } from '../types';
import { usePermissionStore } from './permissionStore';
import { clearBrowserSessionId } from '../services/sessionGuard.service';

// Authentication states for the auth flow
export type AuthFlowState = 
  | 'loading'
  | 'unauthenticated'
  | 'password_ok'
  | 'mfa_pending'
  | 'mfa_setup_required'
  | 'telegram_link_required'
  | 'force_password_change'
  | 'authenticated';

interface AuthState {
  agent: Agent | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  forcePasswordChange: boolean;
  telegramLinkRequired: boolean;
  mfaSetupRequired: boolean;
  authFlowState: AuthFlowState;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setAgent: (agent: Agent | null) => void;
  updateAgentFields: (fields: Partial<Agent>) => void;
  setToken: (token: string | null) => void;
  setForcePasswordChange: (value: boolean) => void;
  setTelegramLinkRequired: (value: boolean) => void;
  setMfaSetupRequired: (value: boolean) => void;
  setAuthFlowState: (state: AuthFlowState) => void;
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
      telegramLinkRequired: false,
      mfaSetupRequired: false,
      authFlowState: 'loading',

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
            // Determine auth flow state based on response
            let authFlowState: AuthFlowState = 'authenticated';
            let telegramLinkRequired = false;
            let mfaSetupRequired = false;
            
            if (data.forcePasswordChange) {
              authFlowState = 'force_password_change';
            } else if (data.mfaSetupRequired) {
              authFlowState = 'mfa_setup_required';
              mfaSetupRequired = true;
            } else if (data.telegramLinkRequired) {
              authFlowState = 'telegram_link_required';
              telegramLinkRequired = true;
            }
            
            set({
              agent: data.agent,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              forcePasswordChange: data.forcePasswordChange || false,
              telegramLinkRequired,
              mfaSetupRequired,
              authFlowState,
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
            body: JSON.stringify({ ok: true})
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
            telegramLinkRequired: false,
            mfaSetupRequired: false,
            authFlowState: 'unauthenticated',
          });
        }
      },

      setAgent: (agent) => set({ agent, isAuthenticated: !!agent }),
      updateAgentFields: (fields) => set((state) => ({
        agent: state.agent ? { ...state.agent, ...fields } : null,
      })),
      setToken: (token) => set({ token }),
      setForcePasswordChange: (value) => set({ forcePasswordChange: value }),
      setTelegramLinkRequired: (value) => set({ 
        telegramLinkRequired: value,
        authFlowState: value ? 'telegram_link_required' : 'authenticated',
      }),
      setMfaSetupRequired: (value) => set({ 
        mfaSetupRequired: value,
        authFlowState: value ? 'mfa_setup_required' : 'authenticated',
      }),
      setAuthFlowState: (authFlowState) => set({ authFlowState }),

      checkAuth: async () => {
        const { token } = get();
        
        if (!token) {
          set({ isLoading: false, isAuthenticated: false, authFlowState: 'unauthenticated' });
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
            console.log("Auth check successful, agent data:", data);
            // Determine auth flow state
            let authFlowState: AuthFlowState = 'authenticated';
            let telegramLinkRequired = false;
            let mfaSetupRequired = false;
            
            if (data.forcePasswordChange) {
              authFlowState = 'force_password_change';
            } else if (data.telegramLinkRequired) {
              authFlowState = 'telegram_link_required';
              telegramLinkRequired = true;
            } else if (data.mfaSetupRequired) {
              authFlowState = 'mfa_setup_required';
              mfaSetupRequired = true;
            } 
            
            set({
              agent: data.agent,
              token: data.token,
              isAuthenticated: true,
              isLoading: false,
              forcePasswordChange: data.forcePasswordChange || false,
              telegramLinkRequired,
              mfaSetupRequired,
              authFlowState,
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
              authFlowState: 'unauthenticated',
            });
          }
        } catch {
          usePermissionStore.getState().clearPermissions();
          
          set({
            agent: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            authFlowState: 'unauthenticated',
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

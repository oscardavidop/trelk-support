// Auth store using Zustand
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Agent } from '../types';

interface AuthState {
  agent: Agent | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  setAgent: (agent: Agent | null) => void;
  setToken: (token: string | null) => void;
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
            });
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
          set({
            agent: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      setAgent: (agent) => set({ agent, isAuthenticated: !!agent }),
      setToken: (token) => set({ token }),

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
            });
          } else {
            set({
              agent: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch {
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
      partialize: (state) => ({ token: state.token }),
    }
  )
);

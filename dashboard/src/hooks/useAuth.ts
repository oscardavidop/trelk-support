/**
 * Auth Hook
 * Provides access to authentication state
 */

import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const agent = useAuthStore((state) => state.agent);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  return { agent, token, isAuthenticated };
}

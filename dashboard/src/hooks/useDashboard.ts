/**
 * Dashboard Hooks
 * Custom hooks for fetching and managing dashboard data
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useDashboardStore } from '../stores/dashboardStore';
import { useSocket } from './useSocket';
import type {
  AdminDashboardData,
  SupervisorDashboardData,
  AgentDashboardData,
  QuickStats,
  Alert,
} from '../types/dashboard';

const API_BASE = '/api/dashboard';

/**
 * Hook for fetching admin dashboard data
 */
export function useAdminDashboard() {
  const token = useAuthStore((s) => s.token);
  const adminData = useDashboardStore((s) => s.adminData);
  const filters = useDashboardStore((s) => s.filters);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const isRefreshing = useDashboardStore((s) => s.isRefreshing);
  const error = useDashboardStore((s) => s.error);
  const acknowledgedAlerts = useDashboardStore((s) => s.acknowledgedAlerts);
  const acknowledgeAlert = useDashboardStore((s) => s.acknowledgeAlert);

  // Track fetch state with refs to prevent re-renders causing loops
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);
  const prevFiltersKeyRef = useRef<string>('');

  // Stable fetch function using refs - no dependencies that change
  const fetchData = async (refresh = false) => {
    const store = useDashboardStore.getState();
    const authStore = useAuthStore.getState();
    const currentToken = authStore.token;
    
    if (!currentToken || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    
    if (refresh) {
      store.setRefreshing(true);
    } else {
      store.setLoading(true);
    }
    store.setError(null);

    try {
      const currentFilters = store.filters;
      const params = new URLSearchParams();
      if (currentFilters.startDate) params.set('startDate', currentFilters.startDate);
      if (currentFilters.endDate) params.set('endDate', currentFilters.endDate);
      if (currentFilters.channel) params.set('channel', currentFilters.channel);
      if (currentFilters.category) params.set('category', currentFilters.category);

      const response = await fetch(`${API_BASE}/admin?${params}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch admin dashboard');
      }

      const data = await response.json();
      if (data.ok) {
        store.setAdminData(data as AdminDashboardData);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      store.setError(err.message);
    } finally {
      store.setLoading(false);
      store.setRefreshing(false);
      isFetchingRef.current = false;
    }
  };

  // Initial fetch - run only once
  useEffect(() => {
    if (!hasFetchedRef.current && token) {
      hasFetchedRef.current = true;
      prevFiltersKeyRef.current = JSON.stringify(filters);
      fetchData();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refetch when filters change
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    if (hasFetchedRef.current && prevFiltersKeyRef.current !== filtersKey) {
      prevFiltersKeyRef.current = filtersKey;
      fetchData(true);
    }
  }, [filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter unacknowledged alerts
  const activeAlerts = adminData?.alerts.filter(
    (a) => !acknowledgedAlerts.has(a.id)
  ) || [];

  return {
    data: adminData,
    activeAlerts,
    isLoading,
    isRefreshing,
    error,
    refresh: () => fetchData(true),
    acknowledgeAlert,
  };
}

/**
 * Hook for fetching supervisor dashboard data
 */
export function useSupervisorDashboard() {
  const token = useAuthStore((s) => s.token);
  const supervisorData = useDashboardStore((s) => s.supervisorData);
  const filters = useDashboardStore((s) => s.filters);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const isRefreshing = useDashboardStore((s) => s.isRefreshing);
  const error = useDashboardStore((s) => s.error);

  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);
  const prevFiltersKeyRef = useRef<string>('');

  const fetchData = async (refresh = false) => {
    const store = useDashboardStore.getState();
    const authStore = useAuthStore.getState();
    const currentToken = authStore.token;
    
    if (!currentToken || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    
    if (refresh) {
      store.setRefreshing(true);
    } else {
      store.setLoading(true);
    }
    store.setError(null);

    try {
      const currentFilters = store.filters;
      const params = new URLSearchParams();
      if (currentFilters.startDate) params.set('startDate', currentFilters.startDate);
      if (currentFilters.endDate) params.set('endDate', currentFilters.endDate);
      if (currentFilters.channel) params.set('channel', currentFilters.channel);
      if (currentFilters.category) params.set('category', currentFilters.category);

      const response = await fetch(`${API_BASE}/supervisor?${params}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch supervisor dashboard');
      }

      const data = await response.json();
      if (data.ok) {
        store.setSupervisorData(data as SupervisorDashboardData);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      store.setError(err.message);
    } finally {
      store.setLoading(false);
      store.setRefreshing(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!hasFetchedRef.current && token) {
      hasFetchedRef.current = true;
      prevFiltersKeyRef.current = JSON.stringify(filters);
      fetchData();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    if (hasFetchedRef.current && prevFiltersKeyRef.current !== filtersKey) {
      prevFiltersKeyRef.current = filtersKey;
      fetchData(true);
    }
  }, [filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data: supervisorData,
    isLoading,
    isRefreshing,
    error,
    refresh: () => fetchData(true),
  };
}

/**
 * Hook for fetching agent personal dashboard data
 */
export function useAgentDashboard() {
  const token = useAuthStore((s) => s.token);
  const agentData = useDashboardStore((s) => s.agentData);
  const isLoading = useDashboardStore((s) => s.isLoading);
  const isRefreshing = useDashboardStore((s) => s.isRefreshing);
  const error = useDashboardStore((s) => s.error);

  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  const fetchData = async (refresh = false) => {
    const store = useDashboardStore.getState();
    const authStore = useAuthStore.getState();
    const currentToken = authStore.token;
    
    if (!currentToken || isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    
    if (refresh) {
      store.setRefreshing(true);
    } else {
      store.setLoading(true);
    }
    store.setError(null);

    try {
      const response = await fetch(`${API_BASE}/agent`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch agent dashboard');
      }

      const data = await response.json();
      if (data.ok) {
        store.setAgentData(data as AgentDashboardData);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      store.setError(err.message);
    } finally {
      store.setLoading(false);
      store.setRefreshing(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    if (!hasFetchedRef.current && token) {
      hasFetchedRef.current = true;
      fetchData();
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data: agentData,
    isLoading,
    isRefreshing,
    error,
    refresh: () => fetchData(true),
  };
}

/**
 * Hook for real-time quick stats
 */
export function useQuickStats(pollInterval = 10000) {
  const token = useAuthStore((s) => s.token);
  const quickStats = useDashboardStore((s) => s.quickStats);
  const updateQuickStat = useDashboardStore((s) => s.updateQuickStat);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(false);

  const fetchQuickStats = async () => {
    const authStore = useAuthStore.getState();
    const currentToken = authStore.token;
    if (!currentToken) return;

    try {
      const response = await fetch(`${API_BASE}/quick-stats`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.ok) {
          useDashboardStore.getState().setQuickStats(data as QuickStats);
        }
      }
    } catch {
      // Silent fail for quick stats
    }
  };

  useEffect(() => {
    if (isMountedRef.current) return;
    isMountedRef.current = true;
    
    fetchQuickStats();
    
    intervalRef.current = setInterval(fetchQuickStats, pollInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    stats: quickStats,
    updateStat: updateQuickStat,
  };
}

/**
 * Hook for dashboard real-time socket events
 */
export function useDashboardSocket() {
  const updateQuickStat = useDashboardStore((s) => s.updateQuickStat);
  const addAlert = useDashboardStore((s) => s.addAlert);
  const { socket } = useSocket();
  const isConnected = socket?.connected ?? false;

  useEffect(() => {
    if (!socket) return;

    // Listen for stat updates
    const handleStatsUpdate = (data: Partial<QuickStats>) => {
      const store = useDashboardStore.getState();
      if (data.activeChats !== undefined) store.updateQuickStat('activeChats', data.activeChats);
      if (data.queueLength !== undefined) store.updateQuickStat('queueLength', data.queueLength);
      if (data.onlineAgents !== undefined) store.updateQuickStat('onlineAgents', data.onlineAgents);
      if (data.slaAtRisk !== undefined) store.updateQuickStat('slaAtRisk', data.slaAtRisk);
    };

    // Listen for alerts
    const handleAlert = (alert: Alert) => {
      useDashboardStore.getState().addAlert(alert);
    };

    socket.on('stats:update', handleStatsUpdate);
    socket.on('dashboard:alert', handleAlert);

    return () => {
      socket.off('stats:update', handleStatsUpdate);
      socket.off('dashboard:alert', handleAlert);
    };
  }, [socket]);

  return { isConnected };
}

/**
 * Combined dashboard hook based on user role
 */
export function useDashboard() {
  const agent = useAuthStore((s) => s.agent);
  const role = agent?.role || 'support';

  // Determine which dashboard to show
  const isAdmin = role === 'admin';
  const isSupervisor = role === 'admin' || role === 'supervisor';

  return {
    role,
    isAdmin,
    isSupervisor,
  };
}

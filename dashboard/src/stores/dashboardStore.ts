/**
 * Dashboard Store
 * Manages dashboard state including filters, real-time updates, and role-based data
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AdminDashboardData,
  SupervisorDashboardData,
  AgentDashboardData,
  QuickStats,
  DashboardFilters,
  Alert,
} from '../types/dashboard';

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface DashboardState {
  // Data states
  adminData: AdminDashboardData | null;
  supervisorData: SupervisorDashboardData | null;
  agentData: AgentDashboardData | null;
  quickStats: QuickStats | null;

  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;

  // Filters
  filters: DashboardFilters;
  datePreset: DatePreset;

  // Alerts
  acknowledgedAlerts: Set<string>;

  // Last update timestamps
  lastAdminUpdate: number | null;
  lastSupervisorUpdate: number | null;
  lastAgentUpdate: number | null;
  lastQuickStatsUpdate: number | null;

  // Actions
  setAdminData: (data: AdminDashboardData) => void;
  setSupervisorData: (data: SupervisorDashboardData) => void;
  setAgentData: (data: AgentDashboardData) => void;
  setQuickStats: (stats: QuickStats) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  setDatePreset: (preset: DatePreset) => void;
  acknowledgeAlert: (alertId: string) => void;
  clearData: () => void;

  // Real-time update handlers
  updateQuickStat: (key: keyof QuickStats, value: number) => void;
  addAlert: (alert: Alert) => void;
  removeAlert: (alertId: string) => void;
}

// Helper to get date range from preset
function getDateRangeFromPreset(preset: DatePreset): { startDate?: string; endDate?: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (preset) {
    case 'today':
      return {
        startDate: today.toISOString(),
        endDate: now.toISOString(),
      };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: yesterday.toISOString(),
        endDate: today.toISOString(),
      };
    }
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        startDate: weekAgo.toISOString(),
        endDate: now.toISOString(),
      };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return {
        startDate: monthAgo.toISOString(),
        endDate: now.toISOString(),
      };
    }
    default:
      return {};
  }
}

// Initial filters with today's date range
const initialFilters = getDateRangeFromPreset('today');

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      // Initial states
      adminData: null,
      supervisorData: null,
      agentData: null,
      quickStats: null,
      isLoading: false,
      isRefreshing: false,
      error: null,
      filters: initialFilters,
      datePreset: 'today',
      acknowledgedAlerts: new Set(),
      lastAdminUpdate: null,
      lastSupervisorUpdate: null,
      lastAgentUpdate: null,
      lastQuickStatsUpdate: null,

      // Setters
      setAdminData: (data) => set({ 
        adminData: data, 
        lastAdminUpdate: Date.now(),
        error: null,
      }),
      
      setSupervisorData: (data) => set({ 
        supervisorData: data,
        lastSupervisorUpdate: Date.now(),
        error: null,
      }),
      
      setAgentData: (data) => set({ 
        agentData: data,
        lastAgentUpdate: Date.now(),
        error: null,
      }),
      
      setQuickStats: (stats) => set({ 
        quickStats: stats,
        lastQuickStatsUpdate: Date.now(),
      }),
      
      setLoading: (isLoading) => set({ isLoading }),
      setRefreshing: (isRefreshing) => set({ isRefreshing }),
      setError: (error) => set({ error }),
      
      setFilters: (newFilters) => set((state) => ({
        filters: { ...state.filters, ...newFilters },
      })),
      
      setDatePreset: (preset) => {
        const dateRange = getDateRangeFromPreset(preset);
        set((state) => ({
          datePreset: preset,
          filters: { ...state.filters, ...dateRange },
        }));
      },
      
      acknowledgeAlert: (alertId) => set((state) => {
        const newAcknowledged = new Set(state.acknowledgedAlerts);
        newAcknowledged.add(alertId);
        return { acknowledgedAlerts: newAcknowledged };
      }),
      
      clearData: () => set({
        adminData: null,
        supervisorData: null,
        agentData: null,
        quickStats: null,
        error: null,
      }),

      // Real-time handlers
      updateQuickStat: (key, value) => set((state) => ({
        quickStats: state.quickStats 
          ? { ...state.quickStats, [key]: value }
          : null,
      })),
      
      addAlert: (alert) => set((state) => {
        if (!state.adminData) return state;
        return {
          adminData: {
            ...state.adminData,
            alerts: [alert, ...state.adminData.alerts],
          },
        };
      }),
      
      removeAlert: (alertId) => set((state) => {
        if (!state.adminData) return state;
        return {
          adminData: {
            ...state.adminData,
            alerts: state.adminData.alerts.filter(a => a.id !== alertId),
          },
        };
      }),
    }),
    {
      name: 'dashboard-storage',
      partialize: (state) => ({
        datePreset: state.datePreset,
        acknowledgedAlerts: Array.from(state.acknowledgedAlerts),
        // Note: We don't persist filters to avoid stale date ranges
      }),
      merge: (persisted: any, current) => {
        // Recalculate filters from persisted preset
        const preset = persisted?.datePreset || 'today';
        const freshFilters = getDateRangeFromPreset(preset);
        
        return {
          ...current,
          datePreset: preset,
          filters: freshFilters,
          acknowledgedAlerts: new Set(persisted?.acknowledgedAlerts || []),
        };
      },
    }
  )
);

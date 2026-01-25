/**
 * Permission Store - Centralized RBAC state management
 * 
 * This store is the SINGLE SOURCE OF TRUTH for permissions in the frontend.
 * It syncs with the backend and provides helpers for permission checks.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../services/api';

// ============= TYPES =============

export interface PermissionCategory {
  name: string;
  permissions: Array<{
    key: string;
    label: string;
    description: string;
  }>;
}

export interface AgentWithPermissions {
  _id: string;
  name: string;
  email: string;
  role: string;
  roleId?: string;
  isActive: boolean;
  permissions: string[];
  permissionsOverride?: {
    allow: string[];
    deny: string[];
  };
  permissionVersion?: number;
}

export interface Role {
  _id: string;
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  isActive: boolean;
  priority: number;
  color?: string;
  icon?: string;
}

interface PermissionState {
  // Current user's permissions
  permissions: string[];
  permissionVersion: number;
  
  // All permission categories (for admin UI)
  categories: Record<string, PermissionCategory>;
  allPermissions: string[];
  
  // Roles list (for admin UI)
  roles: Role[];
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  
  // Actions
  setPermissions: (permissions: string[], version?: number) => void;
  refreshPermissions: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadRoles: () => Promise<void>;
  clearPermissions: () => void;
  
  // Permission check helpers
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;
}

// ============= STORE =============

export const usePermissionStore = create<PermissionState>()(
  persist(
    (set, get) => ({
      permissions: [],
      permissionVersion: 0,
      categories: {},
      allPermissions: [],
      roles: [],
      isLoading: false,
      isInitialized: false,

      setPermissions: (permissions, version = 1) => {
        set({ 
          permissions, 
          permissionVersion: version,
          isInitialized: true,
        });
      },

      refreshPermissions: async () => {
        set({ isLoading: true });
        try {
          const response = await api.get<{
            ok: boolean;
            agent: AgentWithPermissions;
          }>('/api/permissions/me');
          
          if (response.data.ok) {
            set({
              permissions: response.data.agent.permissions,
              permissionVersion: response.data.agent.permissionVersion || 1,
              isLoading: false,
              isInitialized: true,
            });
          }
        } catch (error) {
          console.error('Failed to refresh permissions:', error);
          set({ isLoading: false });
        }
      },

      loadCategories: async () => {
        try {
          const response = await api.get<{
            ok: boolean;
            categories: Record<string, PermissionCategory>;
            allPermissions: string[];
          }>('/api/permissions/categories');
          
          if (response.data.ok) {
            set({
              categories: response.data.categories,
              allPermissions: response.data.allPermissions,
            });
          }
        } catch (error) {
          console.error('Failed to load permission categories:', error);
        }
      },

      loadRoles: async () => {
        try {
          const response = await api.get<{
            ok: boolean;
            roles: Role[];
          }>('/api/permissions/roles');
          
          if (response.data.ok) {
            set({ roles: response.data.roles });
          }
        } catch (error) {
          console.error('Failed to load roles:', error);
        }
      },

      clearPermissions: () => {
        set({
          permissions: [],
          permissionVersion: 0,
          isInitialized: false,
        });
      },

      // Check if user has a specific permission
      can: (permission: string) => {
        const { permissions } = get();
        
        // Admin wildcard
        if (permissions.includes('*')) return true;
        
        // Direct match
        if (permissions.includes(permission)) return true;
        
        // Category wildcard (e.g., 'chats.*')
        const category = permission.split('.')[0];
        if (permissions.includes(`${category}.*`)) return true;
        
        return false;
      },

      // Check if user has any of the permissions
      canAny: (perms: string[]) => {
        const { can } = get();
        return perms.some(p => can(p));
      },

      // Check if user has all permissions
      canAll: (perms: string[]) => {
        const { can } = get();
        return perms.every(p => can(p));
      },
    }),
    {
      name: 'trelk-permissions',
      partialize: (state) => ({
        permissions: state.permissions,
        permissionVersion: state.permissionVersion,
      }),
    }
  )
);

// ============= SELECTORS =============

export const selectCan = (permission: string) => 
  usePermissionStore.getState().can(permission);

export const selectCanAny = (permissions: string[]) => 
  usePermissionStore.getState().canAny(permissions);

export const selectCanAll = (permissions: string[]) => 
  usePermissionStore.getState().canAll(permissions);

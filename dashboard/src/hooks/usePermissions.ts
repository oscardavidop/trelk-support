/**
 * usePermissions Hook - Easy access to permission checks
 * 
 * Usage:
 * const { can, canAny, canAll } = usePermissions();
 * 
 * if (can('contacts.read')) { ... }
 * if (canAny(['contacts.read', 'contacts.write'])) { ... }
 */

import { useCallback } from 'react';
import { usePermissionStore } from '../stores/permissionStore';

export function usePermissions() {
  const permissions = usePermissionStore((state) => state.permissions);
  const isInitialized = usePermissionStore((state) => state.isInitialized);
  const isLoading = usePermissionStore((state) => state.isLoading);
  const refreshPermissions = usePermissionStore((state) => state.refreshPermissions);

  /**
   * Check if user has a specific permission
   */
  const can = useCallback((permission: string): boolean => {
    // Admin wildcard
    if (permissions.includes('*')) return true;
    
    // Direct match
    if (permissions.includes(permission)) return true;
    
    // Category wildcard (e.g., 'chats.*')
    const category = permission.split('.')[0];
    if (permissions.includes(`${category}.*`)) return true;
    
    return false;
  }, [permissions]);

  /**
   * Check if user has any of the permissions
   */
  const canAny = useCallback((perms: string[]): boolean => {
    return perms.some(p => can(p));
  }, [can]);

  /**
   * Check if user has all permissions
   */
  const canAll = useCallback((perms: string[]): boolean => {
    return perms.every(p => can(p));
  }, [can]);

  /**
   * Check if user is admin (has wildcard permission)
   */
  const isAdmin = useCallback((): boolean => {
    return permissions.includes('*');
  }, [permissions]);

  return {
    permissions,
    isInitialized,
    isLoading,
    can,
    canAny,
    canAll,
    isAdmin,
    refreshPermissions,
  };
}

export default usePermissions;

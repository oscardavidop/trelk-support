/**
 * ProtectedRoute - Permission-based route protection
 * 
 * Usage:
 * <ProtectedRoute permission="contacts.read">
 *   <ContactsPage />
 * </ProtectedRoute>
 * 
 * <ProtectedRoute permissions={['contacts.read', 'contacts.write']} requireAll>
 *   <ContactsEditPage />
 * </ProtectedRoute>
 */

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import AccessDeniedPage from '../pages/AccessDeniedPage';

interface ProtectedRouteProps {
  children: ReactNode;
  
  /** Single permission to check */
  permission?: string;
  
  /** Multiple permissions to check */
  permissions?: string[];
  
  /** If true, all permissions are required. If false, any permission is sufficient */
  requireAll?: boolean;
  
  /** Custom fallback component instead of AccessDeniedPage */
  fallback?: ReactNode;
  
  /** Redirect to this path instead of showing AccessDeniedPage */
  redirectTo?: string;
  
  /** Show loading state while permissions load */
  showLoading?: boolean;
}

export function ProtectedRoute({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback,
  redirectTo,
  showLoading = true,
}: ProtectedRouteProps) {
  const { can, canAny, canAll, isInitialized, isLoading } = usePermissions();
  const location = useLocation();

  // Show loading while permissions are being fetched
  if (!isInitialized || isLoading) {
    if (showLoading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Verificando permisos...
            </span>
          </div>
        </div>
      );
    }
    return null;
  }

  // Determine if access is allowed and collect denied permissions
  let hasAccess = false;
  const deniedPermissions: string[] = [];

  if (permission) {
    // Single permission check
    hasAccess = can(permission);
    if (!hasAccess) {
      deniedPermissions.push(permission);
    }
  } else if (permissions && permissions.length > 0) {
    // Multiple permissions check
    if (requireAll) {
      hasAccess = canAll(permissions);
      if (!hasAccess) {
        // Find which permissions are missing
        permissions.forEach(p => {
          if (!can(p)) deniedPermissions.push(p);
        });
      }
    } else {
      hasAccess = canAny(permissions);
      if (!hasAccess) {
        // All permissions are denied
        deniedPermissions.push(...permissions);
      }
    }
  } else {
    // No permission specified = allow access
    hasAccess = true;
  }

  // Access denied
  if (!hasAccess) {
    // Redirect option
    if (redirectTo) {
      return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    // Custom fallback
    if (fallback) {
      return <>{fallback}</>;
    }

    // Default: AccessDeniedPage with permission info
    return (
      <AccessDeniedPage 
        requiredPermissions={deniedPermissions}
        currentPage={location.pathname}
      />
    );
  }

  // Access granted
  return <>{children}</>;
}

/**
 * Higher-order component version for class components or external use
 */
export function withPermission<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  permission: string
) {
  return function WithPermissionComponent(props: P) {
    return (
      <ProtectedRoute permission={permission}>
        <WrappedComponent {...props} />
      </ProtectedRoute>
    );
  };
}

/**
 * Conditional render based on permission
 * 
 * Usage:
 * <PermissionGate permission="contacts.delete">
 *   <DeleteButton />
 * </PermissionGate>
 */
export function PermissionGate({
  children,
  permission,
  permissions,
  requireAll = false,
  fallback = null,
}: {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
}) {
  const { can, canAny, canAll } = usePermissions();

  let hasAccess = false;

  if (permission) {
    hasAccess = can(permission);
  } else if (permissions && permissions.length > 0) {
    hasAccess = requireAll ? canAll(permissions) : canAny(permissions);
  } else {
    hasAccess = true;
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

export default ProtectedRoute;

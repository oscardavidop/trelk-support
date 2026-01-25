/**
 * AccessDeniedPage - Full-page access denied screen with permission request form
 * 
 * Features:
 * - Shows which permission is required
 * - Collapsible form to request access
 * - Shows pending/blocked status for permissions
 * - Prevents duplicate requests
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldX, 
  ArrowLeft, 
  Home, 
  Send, 
  Loader2, 
  Clock, 
  Ban, 
  ChevronDown, 
  ChevronUp,
  CheckCircle,
  AlertCircle,
  Lock
} from 'lucide-react';
import api from '../services/api';

// Permission labels for better UX
const PERMISSION_LABELS: Record<string, string> = {
  'chats.read': 'Ver chats propios',
  'chats.read_all': 'Ver todos los chats',
  'chats.respond': 'Responder en chats',
  'chats.close': 'Cerrar chats',
  'chats.reopen': 'Reabrir chats',
  'chats.transfer': 'Transferir chats',
  'chats.takeover': 'Tomar chats de otros',
  'chats.delete': 'Eliminar chats propios',
  'chats.delete_all': 'Eliminar cualquier chat',
  'chats.monitor': 'Monitorear chats',
  'chats.export': 'Exportar chats',
  'contacts.read': 'Ver contactos',
  'contacts.write': 'Editar contactos',
  'contacts.delete': 'Eliminar contactos',
  'contacts.export': 'Exportar contactos',
  'contacts.import': 'Importar contactos',
  'contacts.bulk': 'Acciones masivas',
  'tags.read': 'Ver etiquetas',
  'tags.write': 'Gestionar etiquetas',
  'customFields.read': 'Ver campos personalizados',
  'customFields.write': 'Gestionar campos personalizados',
  'savedReplies.read': 'Ver respuestas guardadas',
  'savedReplies.write': 'Gestionar respuestas guardadas',
  'broadcasts.read': 'Ver difusiones',
  'broadcasts.write': 'Crear difusiones',
  'broadcasts.send': 'Enviar difusiones',
  'flows.read': 'Ver flujos',
  'flows.write': 'Editar flujos',
  'flows.execute': 'Ejecutar flujos',
  'scheduledMessages.read': 'Ver mensajes programados',
  'scheduledMessages.write': 'Gestionar mensajes programados',
  'agents.read': 'Ver agentes',
  'agents.write': 'Gestionar agentes',
  'agents.delete': 'Eliminar agentes',
  'roles.read': 'Ver roles',
  'roles.write': 'Gestionar roles',
  'permissions.read': 'Ver permisos',
  'permissions.write': 'Asignar permisos',
  'settings.read': 'Ver configuración',
  'settings.write': 'Modificar configuración',
  'analytics.read': 'Ver analíticas',
  'analytics.export': 'Exportar analíticas',
  'system.admin': 'Administración del sistema',
  'audit.read': 'Ver registros de auditoría',
  'audit.export': 'Exportar auditoría',
};

interface PermissionStatus {
  permission: string;
  isPending: boolean;
  isBlocked: boolean;
  canRequest: boolean;
}

interface AccessDeniedPageProps {
  requiredPermissions?: string[];
  currentPage?: string;
}

export default function AccessDeniedPage({ 
  requiredPermissions = [], 
  currentPage 
}: AccessDeniedPageProps) {
  const navigate = useNavigate();
  
  // State
  const [isExpanded, setIsExpanded] = useState(false);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [permissionStatuses, setPermissionStatuses] = useState<PermissionStatus[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Check permission statuses
  const checkPermissionStatuses = useCallback(async () => {
    if (requiredPermissions.length === 0) {
      setLoadingStatus(false);
      return;
    }

    try {
      const statuses: PermissionStatus[] = await Promise.all(
        requiredPermissions.map(async (perm) => {
          try {
            const response = await api.get<{
              isPending: boolean;
              isBlocked: boolean;
              canRequest: boolean;
            }>(`/api/permission-requests/check/${perm}`);
            return {
              permission: perm,
              isPending: response.data.isPending,
              isBlocked: response.data.isBlocked,
              canRequest: response.data.canRequest,
            };
          } catch {
            return {
              permission: perm,
              isPending: false,
              isBlocked: false,
              canRequest: true,
            };
          }
        })
      );
      setPermissionStatuses(statuses);
    } catch (error) {
      console.error('Error checking permission statuses:', error);
    } finally {
      setLoadingStatus(false);
    }
  }, [requiredPermissions]);

  useEffect(() => {
    checkPermissionStatuses();
  }, [checkPermissionStatuses]);

  // Get label for permission
  const getPermissionLabel = (perm: string): string => {
    return PERMISSION_LABELS[perm] || perm;
  };

  // Check if any permission can be requested
  const canRequestAny = permissionStatuses.some(s => s.canRequest);
  const allPending = permissionStatuses.length > 0 && permissionStatuses.every(s => s.isPending);
  const allBlocked = permissionStatuses.length > 0 && permissionStatuses.every(s => s.isBlocked);

  // Submit request
  const handleSubmit = async () => {
    if (!reason.trim() || reason.length < 10) {
      setSubmitError('La razón debe tener al menos 10 caracteres');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Request each permission that can be requested
      for (const status of permissionStatuses) {
        if (status.canRequest) {
          await api.post('/api/permission-requests', {
            permission: status.permission,
            reason: reason.trim(),
            page: currentPage
          });
        }
      }
      
      setSubmitSuccess(true);
      setReason('');
      
      // Refresh statuses
      await checkPermissionStatuses();
    } catch (error: any) {
      setSubmitError(error.response?.data?.error || 'Error al enviar la solicitud');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      {/* Icon */}
      <div className="w-24 h-24 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-6">
        <ShieldX className="w-12 h-12 text-red-500" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Acceso Restringido
      </h1>

      {/* Description */}
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-4">
        No tienes permiso para acceder a esta sección.
      </p>

      {/* Required Permissions */}
      {requiredPermissions.length > 0 && (
        <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Permisos requeridos:
          </p>
          <div className="flex flex-wrap gap-2">
            {requiredPermissions.map((perm) => {
              const status = permissionStatuses.find(s => s.permission === perm);
              return (
                <span
                  key={perm}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded-md ${
                    status?.isPending 
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                      : status?.isBlocked
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {status?.isPending && <Clock className="w-3 h-3" />}
                  {status?.isBlocked && <Ban className="w-3 h-3" />}
                  {!status?.isPending && !status?.isBlocked && <Lock className="w-3 h-3" />}
                  {getPermissionLabel(perm)}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>
        
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
        >
          <Home className="w-4 h-4" />
          Ir al Dashboard
        </button>
      </div>

      {/* Permission Request Section */}
      {requiredPermissions.length > 0 && (
        <div className="w-full max-w-md">
          {/* Collapsible Header */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                ¿Necesitas acceso?
              </span>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            )}
          </button>

          {/* Collapsible Content */}
          {isExpanded && (
            <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              {loadingStatus ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : allPending ? (
                // All permissions already requested
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-3">
                    <Clock className="w-6 h-6 text-amber-500" />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Solicitud Pendiente
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Ya tienes una solicitud pendiente para estos permisos.
                    Un administrador la revisará pronto.
                  </p>
                </div>
              ) : allBlocked ? (
                // All permissions blocked
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                    <Ban className="w-6 h-6 text-red-500" />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Acceso Bloqueado
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No puedes solicitar estos permisos en este momento.
                    Contacta directamente con un administrador.
                  </p>
                </div>
              ) : submitSuccess ? (
                // Success message
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    ¡Solicitud Enviada!
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tu solicitud ha sido enviada. Un administrador la revisará pronto.
                  </p>
                </div>
              ) : (
                // Request form
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Solicita acceso explicando por qué necesitas estos permisos.
                  </p>

                  {/* Permission status indicators */}
                  {permissionStatuses.some(s => s.isPending || s.isBlocked) && (
                    <div className="mb-4 space-y-2">
                      {permissionStatuses.map(status => (
                        <div
                          key={status.permission}
                          className={`flex items-center gap-2 text-xs p-2 rounded ${
                            status.isPending
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                              : status.isBlocked
                                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                          }`}
                        >
                          {status.isPending && <Clock className="w-3.5 h-3.5" />}
                          {status.isBlocked && <Ban className="w-3.5 h-3.5" />}
                          {status.canRequest && <CheckCircle className="w-3.5 h-3.5" />}
                          <span>{getPermissionLabel(status.permission)}</span>
                          <span className="ml-auto opacity-75">
                            {status.isPending && 'Pendiente'}
                            {status.isBlocked && 'Bloqueado'}
                            {status.canRequest && 'Disponible'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reason textarea */}
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      ¿Por qué necesitas este acceso?
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Explica brevemente por qué necesitas acceso a esta funcionalidad..."
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none transition-colors"
                      rows={3}
                      maxLength={500}
                      disabled={!canRequestAny || isSubmitting}
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-400">
                        Mínimo 10 caracteres
                      </span>
                      <span className="text-xs text-gray-400">
                        {reason.length}/500
                      </span>
                    </div>
                  </div>

                  {/* Error message */}
                  {submitError && (
                    <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {submitError}
                    </div>
                  )}

                  {/* Submit button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!canRequestAny || isSubmitting || reason.length < 10}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Enviar Solicitud
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fallback contact info if no permissions specified */}
      {requiredPermissions.length === 0 && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg max-w-md">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            ¿Necesitas acceso?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Contacta a un administrador del sistema para solicitar los permisos 
            necesarios para acceder a esta funcionalidad.
          </p>
        </div>
      )}
    </div>
  );
}

// Named export for compatibility
export { AccessDeniedPage };

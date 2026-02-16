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
    Lock,
    KeyRound,
    ChevronRight,
    ShieldAlert,
    ShieldBan,
    Check
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
    isBanned: boolean;
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
                            isBanned: boolean;
                            canRequest: boolean;
                        }>(`/api/permission-requests/check/${perm}`);
                        return {
                            permission: perm,
                            isPending: response.data.isPending,
                            isBlocked: response.data.isBlocked,
                            isBanned: response.data.isBanned,
                            canRequest: response.data.canRequest,
                        };
                    } catch {
                        return {
                            permission: perm,
                            isPending: false,
                            isBlocked: false,
                            isBanned: false,
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
    const isBannedGlobally = permissionStatuses.some(s => s.isBanned);

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
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-black text-gray-900 dark:text-gray-100 p-6 overflow-hidden">
      
      {/* Background Glow Effects (Ambiental) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/10 dark:bg-red-900/20 blur-[100px] rounded-full pointer-events-none" />
      
      <div className="relative z-10 w-full max-w-2xl flex flex-col items-center text-center space-y-8">
        
        {/* 1. Header Section */}
        <div className="space-y-4">
          <div className="mx-auto w-24 h-24 bg-gradient-to-b from-red-100 to-transparent dark:from-red-900/30 dark:to-transparent rounded-3xl flex items-center justify-center mb-6">
            <ShieldAlert className="w-10 h-10 text-red-600 dark:text-red-500" strokeWidth={1.5} />
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-zinc-50">
            Acceso Restringido
          </h1>
          
          <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md mx-auto leading-relaxed">
            Esta área requiere permisos específicos que tu cuenta no posee actualmente.
          </p>
        </div>

        {/* 2. Permission Details (List View, No Box) */}
        {requiredPermissions.length > 0 && (
          <div className="w-full max-w-md mx-auto py-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <span className="text-xs font-medium st text-gray-400">Requerimientos</span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
            </div>

            <div className="space-y-3 text-left">
              {requiredPermissions.map((perm) => {
                const status = permissionStatuses.find(s => s.permission === perm);
                return (
                  <div key={perm} className="group flex items-center justify-between py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-900/50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        status?.isPending ? 'bg-amber-500' : status?.isBlocked ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'
                      }`} />
                      <span className="font-mono text-sm text-gray-600 dark:text-gray-300">
                        {getPermissionLabel(perm)}
                      </span>
                    </div>
                    
                    {/* Status Indicator Text */}
                    <span className={`text-xs font-medium ${
                      status?.isPending ? 'text-amber-600' : status?.isBlocked ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {status?.isPending ? 'Pendiente' : status?.isBlocked ? 'Denegado' : 'Faltante'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Primary Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-xs mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 px-6 rounded-xl bg-transparent border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 px-6 rounded-xl bg-gray-900 dark:bg-white text-zinc-50 dark:text-black hover:opacity-90 text-sm font-medium transition-opacity flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>

        {/* 4. Request Form (Inline/Minimal - Logic Updated) */}
        {requiredPermissions.length > 0 && (
          <div className="w-full max-w-md pt-8">
            {!isExpanded ? (
              <button
                onClick={() => setIsExpanded(true)}
                className="group flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors mx-auto"
              >
                <span>Solicitar desbloqueo de acceso</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            ) : (
              <div className="animate-in slide-in-from-bottom-4 fade-in duration-500">
                
                {/* === LOGIC FLOW START === */}
                {loadingStatus ? (
                  // STATE: LOADING
                  <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    <span className="text-xs">Verificando estado...</span>
                  </div>
                ) : submitSuccess ? (
                  // STATE: SUCCESS
                  <div className="flex flex-col items-center justify-center p-6 bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <Check className="w-8 h-8 text-emerald-500 mb-2" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Solicitud enviada correctamente</p>
                  </div>
                ) : isBannedGlobally ? (
                  // STATE: GLOBALLY BANNED
                  <div className="flex flex-col items-center text-center py-6 px-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
                      <ShieldBan className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-50 mb-1">
                      Solicitudes Bloqueadas
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                      Tu cuenta ha sido bloqueada para solicitar permisos. Contacta a un administrador si crees que esto es un error.
                    </p>
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      Cerrar
                    </button>
                  </div>
                ) : allBlocked ? (
                  // STATE: BLOCKED (specific permissions)
                  <div className="flex flex-col items-center text-center py-6 px-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-3">
                      <Ban className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-50 mb-1">
                      Permisos Denegados
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                      Estos permisos específicos han sido denegados para tu cuenta. Contacta a un administrador.
                    </p>
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      Cerrar
                    </button>
                  </div>
                ) : allPending ? (
                  // STATE: PENDING
                  <div className="flex flex-col items-center text-center py-6 px-4">
                    <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-3">
                      <Clock className="w-6 h-6 text-amber-500" />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-50 mb-1">
                      Solicitud en Revisión
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
                      Ya existe una solicitud pendiente. Te notificaremos al ser aprobada.
                    </p>
                    <button
                      onClick={() => setIsExpanded(false)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      Entendido
                    </button>
                  </div>
                ) : (
                  // STATE: FORM
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-50/80 dark:to-black/80 pointer-events-none -z-10" />
                    
                    <label className="block text-left text-xs font-medium text-gray-400 mb-2 pl-1">
                      Motivo de la solicitud
                    </label>
                    
                    <div className="relative group">
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={isSubmitting}
                        placeholder="Describe por qué necesitas estos permisos..."
                        className="w-full bg-transparent border-b-2 border-gray-200 dark:border-gray-800 focus:border-red-500 dark:focus:border-red-500 px-1 py-3 text-sm outline-none resize-none transition-colors placeholder:text-gray-400/50 min-h-[100px]"
                      />
                      
                      {/* Character Count */}
                      <div className="absolute bottom-3 right-0 text-[10px] text-gray-400">
                        {reason.length}/500
                      </div>
                    </div>

                    {submitError && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-red-500">
                        <AlertCircle className="w-3 h-3" />
                        {submitError}
                      </div>
                    )}

                    <div className="mt-6 flex justify-end gap-3">
                      <button
                        onClick={() => setIsExpanded(false)}
                        className="text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-3 py-2"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || reason.length < 10}
                        className="bg-red-600 hover:bg-red-700 text-zinc-50 px-5 py-2 rounded-full text-xs font-medium transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                        Enviar
                      </button>
                    </div>
                  </div>
                )}
                {/* === LOGIC FLOW END === */}

              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
function StatusMessage({ icon: Icon, iconColor, bgColor, title, desc }: any) {
    return (
        <div className="flex flex-col items-center text-center py-2 animate-in fade-in zoom-in duration-300">
            <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center mb-3`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-zinc-50 mb-1">{title}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">{desc}</p>
        </div>
    );
}
// Named export for compatibility
export { AccessDeniedPage };

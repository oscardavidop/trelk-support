/**
 * ConfirmDestructiveAction Component
 * Modal de confirmación para acciones destructivas o peligrosas
 * Requiere que el usuario escriba una frase de confirmación para acciones muy críticas
 */

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Shield, Trash2, X, Loader2 } from 'lucide-react';
import { usePermissions } from '../hooks/usePermissions';

// Niveles de severidad para acciones destructivas
export type DestructiveSeverity = 'warning' | 'danger' | 'critical';

interface ConfirmDestructiveActionProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  
  // Contenido
  title: string;
  description: string;
  
  // Configuración de severidad
  severity?: DestructiveSeverity;
  
  // Para acciones críticas - requiere escribir frase
  confirmPhrase?: string;
  
  // Permiso requerido (verificación adicional)
  requiredPermission?: string;
  
  // Texto de botones
  confirmText?: string;
  cancelText?: string;
  
  // Loading state
  isLoading?: boolean;
}

// Configuración visual por severidad
const SEVERITY_CONFIG = {
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    buttonColor: 'bg-yellow-600 hover:bg-yellow-700',
  },
  danger: {
    icon: Trash2,
    iconColor: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    buttonColor: 'bg-red-600 hover:bg-red-700',
  },
  critical: {
    icon: Shield,
    iconColor: 'text-red-600',
    bgColor: 'bg-red-600/10',
    borderColor: 'border-red-600/50',
    buttonColor: 'bg-red-700 hover:bg-red-800',
  },
};

export function ConfirmDestructiveAction({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  severity = 'warning',
  confirmPhrase,
  requiredPermission,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isLoading = false,
}: ConfirmDestructiveActionProps) {
  const [inputValue, setInputValue] = useState('');
  const [internalLoading, setInternalLoading] = useState(false);
  const { can } = usePermissions();

  // Reset input when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
      setInternalLoading(false);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading && !internalLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isLoading, internalLoading, onClose]);

  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;

  // Check if user has required permission
  const hasPermission = requiredPermission ? can(requiredPermission) : true;

  // Check if confirmation is valid
  const isConfirmValid = confirmPhrase 
    ? inputValue.toLowerCase().trim() === confirmPhrase.toLowerCase().trim()
    : true;

  const canConfirm = hasPermission && isConfirmValid && !isLoading && !internalLoading;

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;
    
    setInternalLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      console.error('Error in destructive action:', error);
      // Keep modal open on error
    } finally {
      setInternalLoading(false);
    }
  }, [canConfirm, onConfirm, onClose]);

  if (!isOpen) return null;

  const loading = isLoading || internalLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={loading ? undefined : onClose}
      />

      {/* Modal */}
      <div className={`
        relative w-full max-w-md mx-4 rounded-xl border shadow-2xl
        ${config.bgColor} ${config.borderColor}
        bg-gray-900
      `}>
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/10 
                     transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        <div className="p-6">
          {/* Icon */}
          <div className={`
            w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4
            ${config.bgColor}
          `}>
            <Icon className={`w-7 h-7 ${config.iconColor}`} />
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold text-center text-zinc-50 mb-2">
            {title}
          </h3>

          {/* Description */}
          <p className="text-gray-300 text-center text-sm leading-relaxed mb-6">
            {description}
          </p>

          {/* Permission warning */}
          {requiredPermission && !hasPermission && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <Shield className="w-4 h-4 flex-shrink-0" />
                <span>No tienes permiso para realizar esta acción</span>
              </div>
            </div>
          )}

          {/* Confirmation phrase input (for critical actions) */}
          {confirmPhrase && hasPermission && (
            <div className="mb-6">
              <label className="block text-sm text-gray-400 mb-2">
                Escribe <span className="font-mono font-semibold text-red-400">
                  {confirmPhrase}
                </span> para confirmar:
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={confirmPhrase}
                disabled={loading}
                className="w-full px-4 py-2 rounded-lg border border-gray-700 
                         bg-gray-800 text-zinc-50 placeholder-gray-500
                         focus:outline-none focus:ring-2 focus:ring-red-500/50
                         disabled:opacity-50"
                autoFocus
              />
              {inputValue && !isConfirmValid && (
                <p className="mt-1 text-xs text-red-400">
                  La frase no coincide
                </p>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600
                       text-gray-300 hover:bg-gray-800 transition-colors
                       disabled:opacity-50 font-medium"
            >
              {cancelText}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={`
                flex-1 px-4 py-2.5 rounded-lg text-zinc-50 font-medium
                transition-colors flex items-center justify-center gap-2
                disabled:opacity-50 disabled:cursor-not-allowed
                ${config.buttonColor}
              `}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        </div>

        {/* Severity indicator bar */}
        <div className={`
          h-1 w-full rounded-b-xl
          ${severity === 'critical' ? 'bg-red-600' : 
            severity === 'danger' ? 'bg-red-500' : 'bg-yellow-500'}
        `} />
      </div>
    </div>
  );
}

// ============= HOOK FOR EASIER USAGE =============

interface UseConfirmDestructiveOptions {
  title: string;
  description: string;
  severity?: DestructiveSeverity;
  confirmPhrase?: string;
  requiredPermission?: string;
  confirmText?: string;
}

interface UseConfirmDestructiveReturn {
  confirm: () => Promise<boolean>;
  ConfirmDialog: React.FC;
}

export function useConfirmDestructive(
  options: UseConfirmDestructiveOptions
): UseConfirmDestructiveReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      setResolvePromise(() => resolve);
      setIsOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    resolvePromise?.(true);
    setIsOpen(false);
    setResolvePromise(null);
  }, [resolvePromise]);

  const handleClose = useCallback(() => {
    resolvePromise?.(false);
    setIsOpen(false);
    setResolvePromise(null);
  }, [resolvePromise]);

  const ConfirmDialog: React.FC = useCallback(() => (
    <ConfirmDestructiveAction
      isOpen={isOpen}
      onClose={handleClose}
      onConfirm={handleConfirm}
      {...options}
    />
  ), [isOpen, handleClose, handleConfirm, options]);

  return { confirm, ConfirmDialog };
}

// ============= PRESET DIALOGS =============

interface PresetDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  itemName?: string;
}

/**
 * Preset: Delete confirmation
 */
export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  itemName = 'este elemento',
}: PresetDialogProps) {
  return (
    <ConfirmDestructiveAction
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title="¿Eliminar elemento?"
      description={`Estás a punto de eliminar ${itemName}. Esta acción no se puede deshacer.`}
      severity="danger"
      confirmText="Eliminar"
    />
  );
}

/**
 * Preset: Revoke permission
 */
export function RevokePermissionDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  itemName = 'este permiso',
}: PresetDialogProps) {
  return (
    <ConfirmDestructiveAction
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title="¿Revocar permiso?"
      description={`El agente perderá acceso a ${itemName}. Podrás restaurarlo después.`}
      severity="warning"
      requiredPermission="permissions.manage"
      confirmText="Revocar"
    />
  );
}

/**
 * Preset: Critical system action (requires typing confirmation)
 */
export function CriticalActionDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  itemName = 'CONFIRMAR',
}: PresetDialogProps & { description?: string }) {
  return (
    <ConfirmDestructiveAction
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      title="Acción crítica"
      description="Esta es una acción del sistema que no se puede deshacer y puede afectar a múltiples usuarios."
      severity="critical"
      confirmPhrase={itemName}
      requiredPermission="system.admin"
      confirmText="Ejecutar"
    />
  );
}

export default ConfirmDestructiveAction;

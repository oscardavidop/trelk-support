/**
 * Toast Container Component
 * Renders stacked toast notifications with animations
 */

import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore, type Toast, type ToastType } from '../stores/toastStore';
import { 
  X, 
  Bell, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  MessageSquare,
  UserPlus,
  RefreshCw,
  Wifi,
  WifiOff
} from 'lucide-react';

// Icon mapping
const TOAST_ICONS: Record<ToastType, React.ComponentType<{ className?: string }>> = {
  info: Bell,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

// Color mapping
const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  info: {
    bg: 'bg-gray-800',
    border: 'border-blue-500',
    icon: 'text-blue-400',
    text: 'text-gray-100',
  },
  success: {
    bg: 'bg-gray-800',
    border: 'border-green-500',
    icon: 'text-green-400',
    text: 'text-gray-100',
  },
  warning: {
    bg: 'bg-gray-800',
    border: 'border-yellow-500',
    icon: 'text-yellow-400',
    text: 'text-gray-100',
  },
  error: {
    bg: 'bg-gray-800',
    border: 'border-red-500',
    icon: 'text-red-400',
    text: 'text-gray-100',
  },
};

// Special icons for specific toast types
function getSpecialIcon(toast: Toast): React.ComponentType<{ className?: string }> | null {
  if (toast.groupKey?.includes('session:new')) return MessageSquare;
  if (toast.groupKey?.includes('session:assigned')) return UserPlus;
  if (toast.groupKey?.includes('reconnect')) return RefreshCw;
  if (toast.groupKey?.includes('connected')) return Wifi;
  if (toast.groupKey?.includes('disconnected')) return WifiOff;
  return null;
}

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
  onClick?: () => void;
}

function ToastItem({ toast, onClose, onClick }: ToastItemProps) {
  const colors = TOAST_COLORS[toast.type];
  const SpecialIcon = getSpecialIcon(toast);
  const DefaultIcon = TOAST_ICONS[toast.type];
  const Icon = SpecialIcon || DefaultIcon;
  
  return (
    <div
      onClick={onClick}
      className={`
        relative flex items-start gap-3 p-4 rounded-lg shadow-xl border-l-4
        ${colors.bg} ${colors.border}
        animate-slide-in-right
        ${onClick ? 'cursor-pointer hover:bg-gray-700 transition-colors' : ''}
        min-w-[320px] max-w-[420px]
      `}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${colors.icon}`}>
        <Icon className="w-5 h-5" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${colors.text}`}>
          {toast.title}
        </p>
        {toast.message && (
          <p className="mt-1 text-sm text-gray-400 line-clamp-2">
            {toast.message}
          </p>
        )}
        {toast.action && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toast.action?.onClick();
              onClose();
            }}
            className="mt-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="flex-shrink-0 p-1 rounded-full hover:bg-gray-600 transition-colors"
        aria-label="Cerrar notificación"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>
      
      {/* Progress bar for auto-dismiss */}
      {(toast.duration ?? 0) > 0 && (
        <div 
          className="absolute bottom-0 left-0 h-0.5 bg-white/20 rounded-b-lg"
          style={{
            animation: `shrink-width ${toast.duration}ms linear forwards`,
          }}
        />
      )}
    </div>
  );
}

export function ToastContainer() {
  const navigate = useNavigate();
  const { toasts, maxVisible, removeToast } = useToastStore();
  
  // Visible toasts (limited by maxVisible)
  const visibleToasts = toasts.slice(0, maxVisible);
  const hiddenCount = Math.max(0, toasts.length - maxVisible);
  
  const handleToastClick = useCallback((toast: Toast) => {
    if (toast.link) {
      navigate(toast.link);
      removeToast(toast.id);
    } else if (toast.sessionId) {
      navigate(`/dashboard/chat?session=${toast.sessionId}`);
      removeToast(toast.id);
    }
  }, [navigate, removeToast]);
  
  return (
    <div 
      className="fixed bottom-4 right-4 z-50 flex flex-col-reverse gap-2"
      aria-label="Notificaciones"
    >
      {/* Hidden count indicator */}
      {hiddenCount > 0 && (
        <div className="text-center text-sm text-gray-400 bg-gray-800 rounded-lg px-3 py-1.5">
          +{hiddenCount} más
        </div>
      )}
      
      {/* Toast stack */}
      {visibleToasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
          onClick={toast.link || toast.sessionId ? () => handleToastClick(toast) : undefined}
        />
      ))}
    </div>
  );
}

// CSS for animations (add to your global CSS or Tailwind config)
// @keyframes slide-in-right {
//   from { transform: translateX(100%); opacity: 0; }
//   to { transform: translateX(0); opacity: 1; }
// }
// @keyframes shrink-width {
//   from { width: 100%; }
//   to { width: 0%; }
// }
// .animate-slide-in-right { animation: slide-in-right 0.3s ease-out; }

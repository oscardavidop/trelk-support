/**
 * ToastContainer - Premium Zinc Refactor
 * Stacked notification system with refined visuals
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore, type Toast, type ToastType } from '../stores/toastStore';
import { 
  X, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle,
  MessageSquare,
  UserPlus,
  RefreshCw,
  Wifi,
  WifiOff,
  ExternalLink
} from 'lucide-react';

// --- Configuration ---

const TOAST_ICONS: Record<ToastType, React.ElementType> = {
  info: Bell,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const TOAST_STYLES: Record<ToastType, string> = {
  info: 'bg-zinc-900/90 border-zinc-800 text-zinc-100',
  success: 'bg-zinc-900/90 border-emerald-500/30 text-emerald-50',
  warning: 'bg-zinc-900/90 border-amber-500/30 text-amber-50',
  error: 'bg-zinc-900/90 border-red-500/30 text-red-50',
};

const ICON_STYLES: Record<ToastType, string> = {
  info: 'text-indigo-400 bg-indigo-500/10',
  success: 'text-emerald-400 bg-emerald-500/10',
  warning: 'text-amber-400 bg-amber-500/10',
  error: 'text-red-400 bg-red-500/10',
};

// --- Helpers ---

function getSpecialIcon(toast: Toast) {
  if (toast.groupKey?.includes('session:new')) return MessageSquare;
  if (toast.groupKey?.includes('session:assigned')) return UserPlus;
  if (toast.groupKey?.includes('reconnect')) return RefreshCw;
  if (toast.groupKey?.includes('connected')) return Wifi;
  if (toast.groupKey?.includes('disconnected')) return WifiOff;
  return null;
}

// --- Components ---

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
  onClick?: () => void;
}

function ToastItem({ toast, onClose, onClick }: ToastItemProps) {
  const Icon = getSpecialIcon(toast) || TOAST_ICONS[toast.type];
  const containerStyle = TOAST_STYLES[toast.type];
  const iconStyle = ICON_STYLES[toast.type];
  const isClickable = !!onClick || !!toast.action;

  return (
    <div
      onClick={onClick}
      className={`
        group relative flex items-start gap-3 p-4 rounded-xl shadow-2xl backdrop-blur-md border
        animate-in slide-in-from-right-full fade-in duration-300 border-l-6
        min-w-[320px] max-w-[400px] cursor-default
        ${containerStyle}
        ${isClickable ? 'cursor-pointer hover:scale-[1.02] transition-transform' : ''}
      `}
      role="alert"
    >
      {/* Icon */}
      <div className={`flex-shrink-0 p-2 rounded-lg ${iconStyle}`}>
        <Icon className="w-5 h-5" />
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-sm leading-tight">
            {toast.title}
          </p>
          {isClickable && !toast.action && (
            <ExternalLink className="w-3 h-3 opacity-50" />
          )}
        </div>
        
        {toast.message && (
          <p className="mt-1 text-xs opacity-80 leading-relaxed line-clamp-2">
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
            className="mt-3 text-xs font-bold uppercase  px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      
      {/* Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="flex-shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all text-current"
      >
        <X className="w-4 h-4" />
      </button>
      
      {/* Progress Bar */}
      {(toast.duration ?? 0) > 0 && (
        <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-current opacity-50 origin-left"
            style={{
              animation: `shrink-width ${toast.duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastContainer() {
  const navigate = useNavigate();
  const { toasts, maxVisible, removeToast } = useToastStore();
  
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
      className="fixed bottom-6 right-6 z-[100] flex flex-col-reverse gap-3 pointer-events-none"
      aria-live="polite"
    >
      {/* Hidden Count Badge */}
      {hiddenCount > 0 && (
        <div className="mx-auto bg-zinc-800/90 text-zinc-400 text-xs font-medium px-3 py-1 rounded-full shadow-lg border border-zinc-700 backdrop-blur pointer-events-auto animate-in fade-in zoom-in">
          +{hiddenCount} notificaciones
        </div>
      )}
      
      {/* Toasts Stack */}
      <div className="flex flex-col-reverse gap-3 pointer-events-auto">
        {visibleToasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
            onClick={toast.link || toast.sessionId ? () => handleToastClick(toast) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
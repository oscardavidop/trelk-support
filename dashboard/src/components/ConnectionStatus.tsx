/**
 * ConnectionStatus - Premium Zinc Refactor
 * High-fidelity WebSocket status indicators
 */

import { useConnectionStore, type ConnectionStatus } from '../stores/connectionStore';
import { Wifi, WifiOff, RefreshCw, Activity, Layers, ArchiveRestore } from 'lucide-react';

// ============= CONFIG =============

const STATUS_CONFIG: Record<ConnectionStatus, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  dot: string;
  label: string;
  description: string;
}> = {
  ready: {
    icon: Wifi,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-500',
    label: 'En línea',
    description: 'Conexión estable y sincronizada',
  },
  reconnecting: {
    icon: RefreshCw,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
    label: 'Reconectando',
    description: 'Restableciendo enlace...',
  },
  disconnected: {
    icon: WifiOff,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
    label: 'Desconectado',
    description: 'Sin conexión al servidor',
  },
};

// ============= COMPONENT: STATUS INDICATOR =============

interface ConnectionStatusProps {
  variant?: 'compact' | 'full';
  showLabel?: boolean;
}

export default function ConnectionStatus({ 
  variant = 'compact', 
  showLabel = true 
}: ConnectionStatusProps) {
  const { status, reconnectAttempt, syncState } = useConnectionStore();
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  
  // Compact Variant (Header/Navbar)
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bg} ${config.border} transition-all duration-300`}>
        
        {/* Pulse Indicator */}
        <span className="relative flex h-2 w-2">
          {status === 'ready' && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
        </span>
        
        {/* Icon (Spin if reconnecting) */}
        <Icon className={`w-3.5 h-3.5 ${config.color} ${status === 'reconnecting' ? 'animate-spin' : ''}`} />
        
        {/* Label */}
        {showLabel && (
          <span className={`text-[10px] font-bold uppercase r ${config.color}`}>
            {config.label}
            {status === 'reconnecting' && reconnectAttempt > 0 && (
              <span className="ml-1 opacity-70">({reconnectAttempt})</span>
            )}
          </span>
        )}
      </div>
    );
  }
  
  // Full Variant (Sidebar/Settings)
  return (
    <div className={`relative overflow-hidden p-4 rounded-xl border transition-all duration-300 ${config.bg} ${config.border}`}>
      
      {/* Background Pulse Effect */}
      {status === 'ready' && (
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />
      )}

      <div className="flex items-start gap-4 relative z-10">
        
        {/* Status Icon Ring */}
        <div className={`p-2.5 rounded-xl border ${config.bg} ${config.border} ${config.color}`}>
          <Icon className={`w-5 h-5 ${status === 'reconnecting' ? 'animate-spin' : ''}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-sm font-bold ${config.color}`}>
              {config.label}
            </span>
            
            {/* Status Dot */}
            <span className="relative flex h-2 w-2">
              {status === 'ready' && <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
            </span>
          </div>
          
          <p className="text-xs text-zinc-400 leading-relaxed">
            {status === 'reconnecting' && reconnectAttempt > 0 
              ? `Intento ${reconnectAttempt} de reconexión...` 
              : config.description}
          </p>

          {/* Sync Stats (Only when Ready) */}
          {syncState && status === 'ready' && (
            <div className="mt-3 pt-3 border-t border-zinc-800/30 grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-950/30 border border-zinc-800/30">
                <Activity className="w-3 h-3 text-zinc-500 mb-1" />
                <span className="text-xs font-mono text-zinc-300">{syncState.mySessions}</span>
                <span className="text-[9px] text-zinc-600 uppercase">Activos</span>
              </div>
              <div className="flex flex-col items-center p-2 rounded-lg bg-zinc-950/30 border border-zinc-800/30">
                <Layers className="w-3 h-3 text-zinc-500 mb-1" />
                <span className="text-xs font-mono text-zinc-300">{syncState.queuedSessions}</span>
                <span className="text-[9px] text-zinc-600 uppercase">Cola</span>
              </div>
              {syncState.recoveredSessions > 0 && (
                <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/10">
                  <ArchiveRestore className="w-3 h-3 text-emerald-500 mb-1" />
                  <span className="text-xs font-mono text-emerald-400">{syncState.recoveredSessions}</span>
                  <span className="text-[9px] text-emerald-600/70 uppercase">Recup.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= COMPONENT: BANNER =============

export function ConnectionBanner() {
  const { status, reconnectAttempt } = useConnectionStore();
  
  if (status === 'ready') return null;
  
  const config = STATUS_CONFIG[status];
  
  return (
    <div className={`relative z-[100] border-b backdrop-blur-sm animate-in slide-in-from-top-full duration-300 ${config.bg} ${config.border}`}>
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-3">
        
        {/* Animated Icon */}
        <div className={`p-1.5 rounded-lg ${status === 'reconnecting' ? 'bg-amber-500/20' : 'bg-red-500/20'}`}>
          {status === 'reconnecting' ? (
            <RefreshCw className={`w-3.5 h-3.5 ${config.color} animate-spin`} />
          ) : (
            <WifiOff className={`w-3.5 h-3.5 ${config.color}`} />
          )}
        </div>

        <span className={`text-xs font-medium  ${config.color}`}>
          {status === 'reconnecting' 
            ? `Intentando reconectar con el servidor... (Intento ${reconnectAttempt})`
            : 'Conexión perdida. Verificando red...'
          }
        </span>

        {/* Pulse Dot */}
        <span className="relative flex h-2 w-2 ml-1">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dot}`} />
        </span>
      </div>
      
      {/* Progress Line (Visual cue for activity) */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-zinc-800/20 overflow-hidden">
        <div className={`h-full w-1/3 ${config.dot} opacity-50 animate-indeterminate-bar`} />
      </div>
    </div>
  );
}
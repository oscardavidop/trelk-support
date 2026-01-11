/**
 * Connection Status Indicator
 * Shows real-time WebSocket connection status in the UI
 * 
 * States:
 * - ready: 🟢 Connected
 * - reconnecting: 🟡 Reconnecting...
 * - disconnected: 🔴 Disconnected
 */

import { useConnectionStore, type ConnectionStatus } from '../stores/connectionStore';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

const statusConfig: Record<ConnectionStatus, {
  icon: typeof Wifi;
  color: string;
  bgColor: string;
  pulseColor: string;
  label: string;
  description: string;
}> = {
  ready: {
    icon: Wifi,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    pulseColor: 'bg-green-500',
    label: 'Conectado',
    description: 'Conexión en tiempo real activa',
  },
  reconnecting: {
    icon: RefreshCw,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    pulseColor: 'bg-yellow-500',
    label: 'Reconectando',
    description: 'Intentando restablecer conexión...',
  },
  disconnected: {
    icon: WifiOff,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    pulseColor: 'bg-red-500',
    label: 'Sin conexión',
    description: 'No hay conexión con el servidor',
  },
};

interface ConnectionStatusProps {
  variant?: 'compact' | 'full';
  showLabel?: boolean;
}

export default function ConnectionStatus({ 
  variant = 'compact', 
  showLabel = true 
}: ConnectionStatusProps) {
  const { status, reconnectAttempt, syncState } = useConnectionStore();
  const config = statusConfig[status];
  const Icon = config.icon;
  
  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bgColor}`}>
        {/* Pulse indicator */}
        <span className="relative flex h-2.5 w-2.5">
          {status === 'ready' && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.pulseColor} opacity-75`} />
          )}
          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.pulseColor}`} />
        </span>
        
        <Icon className={`w-4 h-4 ${config.color} ${status === 'reconnecting' ? 'animate-spin' : ''}`} />
        
        {showLabel && (
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
            {status === 'reconnecting' && reconnectAttempt > 0 && (
              <span className="ml-1 opacity-75">({reconnectAttempt})</span>
            )}
          </span>
        )}
      </div>
    );
  }
  
  // Full variant with more details
  return (
    <div className={`flex items-center gap-3 px-4 py-2 rounded-lg ${config.bgColor} border border-current/10`}>
      {/* Pulse indicator */}
      <span className="relative flex h-3 w-3">
        {status === 'ready' && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.pulseColor} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-3 w-3 ${config.pulseColor}`} />
      </span>
      
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${config.color} ${status === 'reconnecting' ? 'animate-spin' : ''}`} />
          <span className={`text-sm font-medium ${config.color}`}>
            {config.label}
            {status === 'reconnecting' && reconnectAttempt > 0 && (
              <span className="ml-1 opacity-75">(intento {reconnectAttempt})</span>
            )}
          </span>
        </div>
        <span className="text-xs text-gray-500">{config.description}</span>
        
        {/* Sync state info */}
        {syncState && status === 'ready' && (
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
            <span>📬 {syncState.mySessions} chats</span>
            <span>📋 {syncState.queuedSessions} en cola</span>
            {syncState.recoveredSessions > 0 && (
              <span className="text-green-400">
                ✨ {syncState.recoveredSessions} recuperados
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Banner that appears at the top when disconnected
 */
export function ConnectionBanner() {
  const { status, reconnectAttempt } = useConnectionStore();
  
  if (status === 'ready') return null;
  
  const config = statusConfig[status];
  
  return (
    <div className={`top-0 left-0 right-0 z-50 ${config.bgColor} border-b border-current/20`}>
      <div className="flex items-center justify-center gap-3 px-4 py-2">
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.pulseColor} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${config.pulseColor}`} />
        </span>
        
        <span className={`text-sm font-medium ${config.color}`}>
          {status === 'reconnecting' 
            ? `Reconectando al servidor... (intento ${reconnectAttempt})`
            : 'Sin conexión con el servidor. Los mensajes no se actualizarán en tiempo real.'
          }
        </span>
        
        {status === 'reconnecting' && (
          <RefreshCw className={`w-4 h-4 ${config.color} animate-spin`} />
        )}
      </div>
    </div>
  );
}

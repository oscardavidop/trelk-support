// Live Contact Timer component
import { Clock, PlayCircle, PauseCircle } from 'lucide-react';
import { useLiveTimer } from '../../hooks/useLiveTimer';

interface LiveContactTimerProps {
  startTime: string | Date | null | undefined;
  messageCount?: number;
  isClosed?: boolean;
  endTime?: string | Date | null;
}

export function LiveContactTimer({ 
  startTime, 
  messageCount = 0, 
  isClosed = false,
  endTime 
}: LiveContactTimerProps) {
  // For closed sessions, calculate fixed duration
  const { elapsed, formatted, isActive } = useLiveTimer(
    isClosed ? null : startTime
  );

  // Calculate static duration for closed sessions
  const getClosedDuration = () => {
    if (!startTime || !endTime) return 'Desconocido';
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const seconds = Math.max(0, Math.floor((end - start) / 1000));
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  };

  // Get color based on elapsed time
  const getTimerColor = () => {
    if (isClosed) return 'text-gray-500';
    if (elapsed < 300) return 'text-green-500'; // < 5 min
    if (elapsed < 900) return 'text-yellow-500'; // < 15 min
    if (elapsed < 1800) return 'text-orange-500'; // < 30 min
    return 'text-red-500'; // > 30 min
  };

  const displayDuration = isClosed ? getClosedDuration() : formatted;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        {/* Timer icon with status */}
        <div className={`relative ${getTimerColor()}`}>
          <Clock className="w-5 h-5" />
          {!isClosed && (
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
        
        <div className="flex-1">
          {/* Main timer display */}
          <div className={`text-lg font-mono font-semibold ${getTimerColor()} tabular-nums`}>
            {displayDuration}
          </div>
          
          {/* Status indicator */}
          <div className="flex items-center gap-2 mt-0.5">
            {isClosed ? (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <PauseCircle className="w-3 h-3" />
                <span>Sesión cerrada</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <PlayCircle className="w-3 h-3" />
                <span>En curso</span>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Message count */}
      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">{messageCount}</span>
          {' '}mensajes en esta sesión
        </div>
      </div>
      
      {/* Time progress indicator for active sessions */}
      {!isClosed && elapsed > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Tiempo de respuesta</span>
            <span className={getTimerColor()}>
              {elapsed < 300 ? 'Excelente' : 
               elapsed < 900 ? 'Normal' : 
               elapsed < 1800 ? 'Largo' : 'Muy largo'}
            </span>
          </div>
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${
                elapsed < 300 ? 'bg-green-500' :
                elapsed < 900 ? 'bg-yellow-500' :
                elapsed < 1800 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ 
                width: `${Math.min(100, (elapsed / 1800) * 100)}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

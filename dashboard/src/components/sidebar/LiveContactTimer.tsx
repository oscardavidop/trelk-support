// // Live Contact Timer component
// import { Clock, PlayCircle, PauseCircle } from 'lucide-react';
// import { useLiveTimer } from '../../hooks/useLiveTimer';

// interface LiveContactTimerProps {
//   startTime: string | Date | null | undefined;
//   messageCount?: number;
//   isClosed?: boolean;
//   endTime?: string | Date | null;
// }

// export function LiveContactTimer({ 
//   startTime, 
//   messageCount = 0, 
//   isClosed = false,
//   endTime 
// }: LiveContactTimerProps) {
//   // For closed sessions, calculate fixed duration
//   const { elapsed, formatted, isActive } = useLiveTimer(
//     isClosed ? null : startTime
//   );

//   // Calculate static duration for closed sessions
//   const getClosedDuration = () => {
//     if (!startTime || !endTime) return 'Desconocido';
//     const start = new Date(startTime).getTime();
//     const end = new Date(endTime).getTime();
//     const seconds = Math.max(0, Math.floor((end - start) / 1000));
    
//     const hours = Math.floor(seconds / 3600);
//     const minutes = Math.floor((seconds % 3600) / 60);
//     const secs = seconds % 60;
    
//     const parts: string[] = [];
//     if (hours > 0) parts.push(`${hours}h`);
//     if (minutes > 0) parts.push(`${minutes}m`);
//     if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
//     return parts.join(' ');
//   };

//   // Get color based on elapsed time
//   const getTimerColor = () => {
//     if (isClosed) return 'text-gray-500';
//     if (elapsed < 300) return 'text-green-500'; // < 5 min
//     if (elapsed < 900) return 'text-yellow-500'; // < 15 min
//     if (elapsed < 1800) return 'text-orange-500'; // < 30 min
//     return 'text-red-500'; // > 30 min
//   };

//   const displayDuration = isClosed ? getClosedDuration() : formatted;

//   return (
//     <div className="px-4 py-3">
//       <div className="flex items-center gap-3">
//         {/* Timer icon with status */}
//         <div className={`relative ${getTimerColor()}`}>
//           <Clock className="w-5 h-5" />
//           {!isClosed && (
//             <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
//           )}
//         </div>
        
//         <div className="flex-1">
//           {/* Main timer display */}
//           <div className={`text-lg font-mono font-semibold ${getTimerColor()} tabular-nums`}>
//             {displayDuration}
//           </div>
          
//           {/* Status indicator */}
//           <div className="flex items-center gap-2 mt-0.5">
//             {isClosed ? (
//               <div className="flex items-center gap-1 text-xs text-gray-500">
//                 <PauseCircle className="w-3 h-3" />
//                 <span>Sesión cerrada</span>
//               </div>
//             ) : (
//               <div className="flex items-center gap-1 text-xs text-green-500">
//                 <PlayCircle className="w-3 h-3" />
//                 <span>En curso</span>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
      
//       {/* Message count */}
//       <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
//         <div className="text-xs text-gray-500 dark:text-gray-400">
//           <span className="font-medium text-gray-700 dark:text-gray-300">{messageCount}</span>
//           {' '}mensajes en esta sesión
//         </div>
//       </div>
      
//       {/* Time progress indicator for active sessions */}
//       {!isClosed && elapsed > 0 && (
//         <div className="mt-3">
//           <div className="flex justify-between text-xs text-gray-500 mb-1">
//             <span>Tiempo de respuesta</span>
//             <span className={getTimerColor()}>
//               {elapsed < 300 ? 'Excelente' : 
//                elapsed < 900 ? 'Normal' : 
//                elapsed < 1800 ? 'Largo' : 'Muy largo'}
//             </span>
//           </div>
//           <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
//             <div 
//               className={`h-full transition-all duration-1000 ${
//                 elapsed < 300 ? 'bg-green-500' :
//                 elapsed < 900 ? 'bg-yellow-500' :
//                 elapsed < 1800 ? 'bg-orange-500' : 'bg-red-500'
//               }`}
//               style={{ 
//                 width: `${Math.min(100, (elapsed / 1800) * 100)}%` 
//               }}
//             />
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
// LiveContactTimer.tsx - Refactored UI
import { Clock, Play, Pause, MessageSquare, Activity } from 'lucide-react';
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
  const { elapsed, formatted } = useLiveTimer(isClosed ? null : startTime);

  // Calcular duración estática para sesiones cerradas
  const getClosedDuration = () => {
    if (!startTime || !endTime) return '00:00:00';
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    // Forzamos formato HH:MM:SS para consistencia visual
    return `${hours > 0 ? pad(hours) + ':' : ''}${pad(minutes)}:${pad(seconds)}`;
  };

  const displayDuration = isClosed ? getClosedDuration() : formatted;

  // Configuración de estado visual basada en el tiempo
  const getStatusConfig = () => {
    if (isClosed) return {
      color: 'text-gray-500 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      bar: 'bg-gray-400',
      label: 'Finalizado'
    };

    if (elapsed < 300) return { // < 5 min (Excelente)
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      border: 'border-emerald-100 dark:border-emerald-800/30',
      bar: 'bg-emerald-500',
      label: 'Tiempo óptimo'
    };
    
    if (elapsed < 900) return { // < 15 min (Atención)
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      border: 'border-amber-100 dark:border-amber-800/30',
      bar: 'bg-amber-500',
      label: 'Tiempo medio'
    };
    
    // > 15 min (Crítico)
    return {
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-900/10',
      border: 'border-rose-100 dark:border-rose-800/30',
      bar: 'bg-rose-500',
      label: 'Tiempo excedido'
    };
  };

  const config = getStatusConfig();

  return (
    <div className="px-3 py-2">
      <div className={`rounded-xl border ${config.border} ${config.bg} p-4 transition-colors duration-500`}>
        
        {/* Header: Status Badge & Icon */}
        <div className="flex justify-between items-center mb-2">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${config.border} bg-white/50 dark:bg-black/20 ${config.color}`}>
            {isClosed ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {config.label}
          </div>
          
          {!isClosed && (
            <div className="flex items-center gap-1">
               <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.bar}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.bar}`}></span>
                </span>
            </div>
          )}
        </div>

        {/* Main Timer Display */}
        <div className="text-center py-2">
          <div className={`text-4xl font-mono font-bold tracking-tight tabular-nums ${config.color}`}>
            {displayDuration}
          </div>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium mt-1">
            Duración de sesión
          </p>
        </div>

        {/* Progress Bar (Visual urgency meter) */}
        {!isClosed && (
          <div className="mt-3 mb-4">
            <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700/50 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${config.bar}`}
                style={{ width: `${Math.min(100, (elapsed / 1800) * 100)}%` }} // 30 mins max scale
              />
            </div>
          </div>
        )}

        {/* Footer Metrics */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200/50 dark:border-gray-700/50 mt-1">
           <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-md bg-white dark:bg-black/20 ${config.color}`}>
                 <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                 <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{messageCount}</span>
                 <span className="text-[9px] text-gray-500 uppercase">Mensajes</span>
              </div>
           </div>

           <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-md bg-white dark:bg-black/20 text-gray-400`}>
                 <Activity className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col text-right">
                 <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    {isClosed ? 'Inactivo' : 'Activo'}
                 </span>
                 <span className="text-[9px] text-gray-500 uppercase">Estado</span>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
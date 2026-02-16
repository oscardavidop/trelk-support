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
    return `${hours > 0 ? pad(hours) + ':' : ''}${pad(minutes)}:${pad(seconds)}`;
  };

  const displayDuration = isClosed ? getClosedDuration() : formatted;

  // Configuración de estado visual basada en el tiempo (Premium Zinc)
  const getStatusConfig = () => {
    if (isClosed) return {
      color: 'text-zinc-400',
      bg: 'bg-zinc-800/50',
      border: 'border-zinc-700',
      bar: 'bg-zinc-600',
      label: 'Finalizado',
      iconBg: 'bg-zinc-800'
    };

    if (elapsed < 300) return { // < 5 min (Excelente)
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      bar: 'bg-emerald-500',
      label: 'Tiempo óptimo',
      iconBg: 'bg-emerald-500/20'
    };
    
    if (elapsed < 900) return { // < 15 min (Atención)
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      bar: 'bg-amber-500',
      label: 'Tiempo medio',
      iconBg: 'bg-amber-500/20'
    };
    
    // > 15 min (Crítico)
    return {
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      bar: 'bg-rose-500',
      label: 'Excedido',
      iconBg: 'bg-rose-500/20'
    };
  };

  const config = getStatusConfig();

  return (
    <div className="px-3 py-2">
      <div className={`rounded-xl border ${config.border} bg-zinc-900 p-4 transition-colors duration-500`}>
        
        {/* Header: Status Badge */}
        <div className="flex justify-between items-center mb-4">
          <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold  border ${config.border} ${config.bg} ${config.color}`}>
            {isClosed ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {config.label}
          </div>
          
          {!isClosed && (
            <div className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.bar}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${config.bar}`}></span>
                </span>
            </div>
          )}
        </div>

        {/* Timer Display */}
        <div className="text-center mb-4">
          <div className={`text-4xl font-mono font-bold tracking-tighter tabular-nums ${config.color} drop-shadow-sm`}>
            {displayDuration}
          </div>
          <p className="text-[10px] text-zinc-500 st font-bold mt-1">
            Tiempo de Sesión
          </p>
        </div>

        {/* Progress Bar */}
        {!isClosed && (
          <div className="mb-5">
            <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ease-linear ${config.bar} shadow-[0_0_8px_rgba(0,0,0,0.3)]`}
                style={{ width: `${Math.min(100, (elapsed / 1800) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
           <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-400`}>
                 <MessageSquare className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                 <span className="text-sm font-bold text-zinc-50 leading-none">{messageCount}</span>
                 <span className="text-[9px] text-zinc-500 font-medium mt-0.5">Mensajes</span>
              </div>
           </div>

           <div className="flex items-center gap-3 justify-end">
              <div className="flex flex-col text-right">
                 <span className={`text-sm font-bold leading-none ${isClosed ? 'text-zinc-400' : 'text-emerald-400'}`}>
                    {isClosed ? 'OFF' : 'ON'}
                 </span>
                 <span className="text-[9px] text-zinc-500 font-medium mt-0.5">Actividad</span>
              </div>
              <div className={`p-2 rounded-lg bg-zinc-950 border border-zinc-800 ${isClosed ? 'text-zinc-600' : 'text-emerald-500'}`}>
                 <Activity className="w-4 h-4" />
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
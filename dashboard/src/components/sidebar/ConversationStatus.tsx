
// SidebarConversationStatus.tsx - Refactored UI
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Bot, Clock, MessageCircle, CheckCircle2, Calendar, UserX, AlertCircle, Activity } from 'lucide-react';

interface ConversationStatusProps {
  status: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  closureReason?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: any }> = {
  bot: { 
    label: 'Bot Activo', 
    color: 'text-blue-400', 
    bg: 'bg-blue-500/10', 
    border: 'border-blue-500/20', 
    icon: Bot 
  },
  waiting: { 
    label: 'En Espera', 
    color: 'text-amber-400', 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/20', 
    icon: Clock 
  },
  human: { 
    label: 'Agente Activo', 
    color: 'text-emerald-400', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/20', 
    icon: MessageCircle 
  },
  closed: { 
    label: 'Finalizado', 
    color: 'text-zinc-400', 
    bg: 'bg-zinc-500/10', 
    border: 'border-zinc-500/20', 
    icon: CheckCircle2 
  },
};

export function SidebarConversationStatus({
  status,
  createdAt,
  updatedAt,
  closedAt,
  closedBy,
  closureReason,
}: ConversationStatusProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.bot;
  const lastEventDate = closedAt || updatedAt;
  const StatusIcon = config.icon;

  return (
    <div className="px-3 py-2 space-y-4">
      
      {/* 1. Main Status Card */}
      <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${config.bg} ${config.border}`}>
        <div className={`p-2 rounded-lg bg-zinc-950/50 border border-white/5 ${config.color}`}>
          <StatusIcon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-zinc-500 ">Estado Actual</p>
          <p className={`text-sm font-bold ${config.color}`}>{config.label}</p>
        </div>
      </div>

      {/* 2. Timeline Details */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
        
        {/* Created At */}
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-zinc-950 rounded-md border border-zinc-800 text-zinc-500">
             <Calendar className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-zinc-400">Inicio de sesión</p>
            <p className="text-xs text-zinc-300 font-mono mt-0.5">
              {format(new Date(createdAt), "d MMM yyyy, HH:mm", { locale: es })}
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-zinc-800 w-full" />

        {/* Last Activity */}
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-zinc-950 rounded-md border border-zinc-800 text-zinc-500">
             <Activity className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-zinc-400">Última actividad</p>
            <p className="text-xs text-zinc-300 font-mono mt-0.5 capitalize">
              {formatDistanceToNow(new Date(lastEventDate), { addSuffix: true, locale: es })}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Closure Report (Conditional) */}
      {status === 'closed' && closedAt && (
        <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/50">
          <div className="bg-zinc-900 px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-[10px] font-bold text-zinc-500 ">Detalles de Cierre</span>
          </div>
          
          <div className="p-4 space-y-3">
            {closedBy && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-400">
                   <UserX className="w-3.5 h-3.5" />
                   <span className="text-xs">Cerrado por:</span>
                </div>
                <span className="text-xs font-medium text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">{closedBy}</span>
              </div>
            )}
            
            {closureReason && (
              <div className="pt-1">
                <div className="flex items-center gap-2 mb-1.5 text-zinc-400">
                   <AlertCircle className="w-3.5 h-3.5" />
                   <span className="text-xs">Motivo:</span>
                </div>
                <div className="text-xs italic text-zinc-300 bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 leading-relaxed">
                  "{closureReason}"
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
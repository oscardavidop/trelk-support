// // Conversation Status Section
// import { formatDistanceToNow, format } from 'date-fns';
// import { es } from 'date-fns/locale';

// interface ConversationStatusProps {
//   status: string;
//   createdAt: string;
//   updatedAt: string;
//   closedAt?: string;
//   closedBy?: string;
//   closureReason?: string;
// }

// const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
//   bot: { label: 'Bot', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: '🤖' },
//   waiting: { label: 'En espera', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: '⏳' },
//   human: { label: 'Abierto', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: '💬' },
//   closed: { label: 'Cerrado', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: '✅' },
// };

// export function SidebarConversationStatus({
//   status,
//   createdAt,
//   updatedAt,
//   closedAt,
//   closedBy,
//   closureReason,
// }: ConversationStatusProps) {
//   const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.bot;
//   const lastEventDate = closedAt || updatedAt;

//   return (
//     <div className="px-4 py-2 space-y-3">
//       {/* Status badge */}
//       <div className="flex items-center gap-2">
//         <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusConfig.color}`}>
//           {statusConfig.icon} {statusConfig.label}
//         </span>
//       </div>

//       {/* Last event */}
//       <div className="text-xs text-gray-500 dark:text-gray-400">
//         <div className="flex items-center justify-between">
//           <span>Última actividad:</span>
//           <span className="font-medium text-gray-700 dark:text-gray-300">
//             {formatDistanceToNow(new Date(lastEventDate), { addSuffix: true, locale: es })}
//           </span>
//         </div>
//         <div className="text-right text-[10px] text-gray-400 mt-0.5">
//           {format(new Date(lastEventDate), "dd MMM yyyy, HH:mm", { locale: es })}
//         </div>
//       </div>

//       {/* Created at */}
//       <div className="text-xs text-gray-500 dark:text-gray-400">
//         <div className="flex items-center justify-between">
//           <span>Iniciado:</span>
//           <span className="text-gray-700 dark:text-gray-300">
//             {format(new Date(createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
//           </span>
//         </div>
//       </div>

//       {/* Closure info */}
//       {status === 'closed' && closedAt && (
//         <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-xs space-y-1">
//           {closedBy && (
//             <div className="flex items-center justify-between">
//               <span className="text-gray-500 dark:text-gray-400">Cerrado por:</span>
//               <span className="font-medium text-gray-700 dark:text-gray-300">{closedBy}</span>
//             </div>
//           )}
//           {closureReason && (
//             <div className="text-gray-600 dark:text-gray-400 italic">
//               "{closureReason}"
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any; border: string }> = {
  bot: { 
    label: 'Bot Activo', 
    color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', 
    border: 'border-blue-200 dark:border-blue-800',
    icon: Bot 
  },
  waiting: { 
    label: 'En Espera', 
    color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400', 
    border: 'border-amber-200 dark:border-amber-800',
    icon: Clock 
  },
  human: { 
    label: 'Agente Activo', 
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400', 
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: MessageCircle 
  },
  closed: { 
    label: 'Finalizado', 
    color: 'bg-slate-50 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400', 
    border: 'border-slate-200 dark:border-slate-700',
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
    <div className="px-3 py-2 space-y-3">
      
      {/* 1. Main Status Card */}
      <div className={`flex items-center gap-3 p-3 rounded-lg border ${config.border} ${config.color}`}>
        <div className="p-2 bg-white/50 dark:bg-black/20 rounded-full shadow-sm">
          <StatusIcon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] opacity-80 uppercase tracking-wider font-bold">Estado Actual</p>
          <p className="text-sm font-bold">{config.label}</p>
        </div>
      </div>

      {/* 2. Timeline Details */}
      <div className="bg-white dark:bg-[#1a1d26] border border-gray-100 dark:border-gray-800 rounded-lg p-3 space-y-3">
        
        {/* Created At */}
        <div className="flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Inicio de sesión</p>
            <p className="text-xs font-medium text-gray-900 dark:text-gray-200">
              {format(new Date(createdAt), "d MMM yyyy, HH:mm", { locale: es })}
            </p>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-gray-100 dark:bg-gray-800 w-full" />

        {/* Last Activity */}
        <div className="flex items-start gap-2.5">
          <Activity className="w-4 h-4 text-gray-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Última actividad</p>
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-gray-900 dark:text-gray-200">
                {formatDistanceToNow(new Date(lastEventDate), { addSuffix: true, locale: es })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Closure Report (Conditional) */}
      {status === 'closed' && closedAt && (
        <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gray-50 dark:bg-gray-800 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Detalles de Cierre
            </span>
          </div>
          
          <div className="p-3 bg-white dark:bg-[#1a1d26] space-y-2">
            {closedBy && (
              <div className="flex items-center gap-2">
                <UserX className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 dark:text-gray-400">Cerrado por:</span>
                <span className="text-xs font-medium text-gray-900 dark:text-gray-200">{closedBy}</span>
              </div>
            )}
            
            {closureReason && (
              <div className="flex items-start gap-2 pt-1">
                <AlertCircle className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Motivo:</span>
                  <p className="text-xs italic text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-1.5 rounded border border-gray-100 dark:border-gray-800">
                    "{closureReason}"
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
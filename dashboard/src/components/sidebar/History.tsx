// // History Section - User's chat history
// import { useState } from 'react';
// import { ExternalLink, Loader2, MessageSquare } from 'lucide-react';
// import { formatDistanceToNow, format } from 'date-fns';
// import { es } from 'date-fns/locale';
// import type { UserHistorySession } from '../../types';
// import { getUserHistory } from '../../services/contactApi';

// interface HistoryProps {
//   userId: string;
//   totalSessions: number;
//   currentSessionId: string;
// }

// const STATUS_COLORS: Record<string, string> = {
//   bot: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
//   waiting: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
//   human: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
//   closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
// };

// export function SidebarHistory({ userId, totalSessions, currentSessionId }: HistoryProps) {
//   const [history, setHistory] = useState<UserHistorySession[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [showHistory, setShowHistory] = useState(false);

//   const loadHistory = async () => {
//     if (showHistory) {
//       setShowHistory(false);
//       return;
//     }
    
//     setIsLoading(true);
//     try {
//       const sessions = await getUserHistory(userId);
//       setHistory(sessions);
//       setShowHistory(true);
//     } catch (error) {
//       console.error('Error loading history:', error);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   return (
//     <div className="px-4 py-2 space-y-3">
//       {/* Summary */}
//       <div className="flex items-center justify-between text-xs">
//         <span className="text-gray-500 dark:text-gray-400">Total de conversaciones:</span>
//         <span className="font-medium text-gray-700 dark:text-gray-300">{totalSessions}</span>
//       </div>

//       {/* View history button */}
//       <button
//         onClick={loadHistory}
//         disabled={isLoading}
//         className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
//       >
//         {isLoading ? (
//           <Loader2 className="w-3 h-3 animate-spin" />
//         ) : (
//           <ExternalLink className="w-3 h-3" />
//         )}
//         {showHistory ? 'Ocultar historial' : 'Todo el historial de canales'}
//       </button>

//       {/* History list */}
//       {showHistory && history.length > 0 && (
//         <div className="space-y-2 max-h-60 overflow-y-auto">
//           {history.map((session) => (
//             <div
//               key={session.sessionId}
//               className={`p-2 rounded-md text-xs border ${
//                 session.sessionId === currentSessionId
//                   ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20'
//                   : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
//               }`}
//             >
//               <div className="flex items-center justify-between mb-1">
//                 <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
//                   STATUS_COLORS[session.status] || STATUS_COLORS.closed
//                 }`}>
//                   {session.status === 'bot' ? '🤖' : session.status === 'waiting' ? '⏳' : session.status === 'human' ? '💬' : '✅'}
//                   {' '}{session.status}
//                 </span>
//                 {session.sessionId === currentSessionId && (
//                   <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
//                     Actual
//                   </span>
//                 )}
//               </div>
              
//               <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
//                 <span className="flex items-center gap-1">
//                   <MessageSquare className="w-3 h-3" />
//                   {session.messageCount} msgs
//                 </span>
//                 <span>{format(new Date(session.createdAt), "dd MMM", { locale: es })}</span>
//               </div>
              
//               {session.category && (
//                 <div className="mt-1">
//                   <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px] text-gray-600 dark:text-gray-300">
//                     {session.category}
//                   </span>
//                 </div>
//               )}
//             </div>
//           ))}
//         </div>
//       )}

//       {showHistory && history.length === 0 && (
//         <p className="text-xs text-gray-400 italic">No hay historial previo</p>
//       )}
//     </div>
//   );
// }

// SidebarHistory.tsx - Refactored UI
import { useState } from 'react';
import { ExternalLink, Loader2, MessageSquare, Calendar, ChevronRight, History } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { UserHistorySession } from '../../types';
import { getUserHistory } from '../../services/contactApi';

interface HistoryProps {
  userId: string;
  totalSessions: number;
  currentSessionId: string;
}

const STATUS_CONFIG: Record<string, { color: string, label: string, icon: string }> = {
  bot: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', label: 'Bot', icon: '🤖' },
  waiting: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', label: 'Espera', icon: '⏳' },
  human: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', label: 'Humano', icon: '💬' },
  closed: { color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', label: 'Cerrado', icon: '✅' },
};

export function SidebarHistory({ userId, totalSessions, currentSessionId }: HistoryProps) {
  const [history, setHistory] = useState<UserHistorySession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loadHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    setIsLoading(true);
    try {
      const sessions = await getUserHistory(userId);
      setHistory(sessions);
      setShowHistory(true);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="px-3 py-2 space-y-3">
      
      {/* 1. Summary Header */}
      <div className="flex items-center justify-between px-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">Total de conversaciones</span>
        <span className="text-sm font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md">
          {totalSessions}
        </span>
      </div>

      {/* 2. Load Action Button */}
      {!showHistory && (
        <button
          onClick={loadHistory}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-[#1a1d26] border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all group shadow-sm"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
          ) : (
            <History className="w-3.5 h-3.5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
          )}
          <span>Ver historial completo</span>
        </button>
      )}

      {/* 3. History Timeline List */}
      {showHistory && (
        <div className="relative pl-2">
          {/* Vertical Line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700"></div>

          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
            
            {/* Header: Hide button when open */}
            <div className="flex justify-end mb-2">
               <button onClick={() => setShowHistory(false)} className="text-[10px] text-gray-400 hover:text-gray-600 underline">Ocultar</button>
            </div>

            {history.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-4 italic bg-gray-50 dark:bg-gray-800/30 rounded-lg">No hay historial disponible</p>
            ) : (
                history.map((session) => {
                const config = STATUS_CONFIG[session.status] || STATUS_CONFIG.closed;
                const isCurrent = session.sessionId === currentSessionId;

                return (
                    <div key={session.sessionId} className="relative pl-6 group">
                        {/* Timeline Dot */}
                        <div className={`
                            absolute left-0 top-3 w-2.5 h-2.5 rounded-full border-2 
                            ${isCurrent ? 'bg-indigo-500 border-indigo-100 dark:border-indigo-900' : 'bg-gray-300 dark:bg-gray-600 border-white dark:border-[#0f1117]'}
                            z-10
                        `}></div>

                        <div className={`
                            p-2.5 rounded-lg border transition-all
                            ${isCurrent 
                                ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' 
                                : 'bg-white dark:bg-[#1a1d26] border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm'}
                        `}>
                            {/* Header: Date & Status */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                                    <Calendar className="w-3 h-3" />
                                    <span>{format(new Date(session.createdAt), "dd MMM yyyy", { locale: es })}</span>
                                </div>
                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase${config.color}`}>
                                    {config.label}
                                </span>
                            </div>

                            {/* Metrics Row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                                    <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                                    <span className="font-medium">{session.messageCount}</span>
                                    <span className="text-gray-400 text-[10px]">msgs</span>
                                </div>
                                
                                {session.category && (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-300 truncate max-w-[80px]">
                                        {session.category}
                                    </span>
                                )}
                            </div>

                            {/* View Link (If needed later) */}
                            {/* <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                            </div> */}
                        </div>
                    </div>
                );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
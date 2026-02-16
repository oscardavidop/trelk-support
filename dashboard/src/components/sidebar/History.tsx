/**
 * SidebarHistory - Premium Zinc Refactor
 * Vertical timeline history with high-fidelity status badges.
 */

import { useState } from 'react';
import { ExternalLink, Loader2, MessageSquare, Calendar, ChevronRight, History, Clock, Bot, User, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { UserHistorySession } from '../../types';
import { getUserHistory } from '../../services/contactApi';

interface HistoryProps {
  userId: string;
  totalSessions: number;
  currentSessionId: string;
}

// ============= CONFIGURATION =============

const STATUS_CONFIG: Record<string, { color: string, bg: string, border: string, label: string, icon: React.ElementType }> = {
  bot: { 
    color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', 
    label: 'Bot', icon: Bot 
  },
  waiting: { 
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', 
    label: 'En Espera', icon: Clock 
  },
  human: { 
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', 
    label: 'Agente', icon: User 
  },
  closed: { 
    color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700', 
    label: 'Finalizado', icon: CheckCircle2 
  },
};

// ============= COMPONENT =============

export function SidebarHistory({ userId, totalSessions, currentSessionId }: HistoryProps) {
  const [history, setHistory] = useState<UserHistorySession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const toggleHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    
    // Load if empty
    if (history.length === 0) {
      setIsLoading(true);
      try {
        const sessions = await getUserHistory(userId);
        setHistory(sessions);
      } catch (error) {
        console.error('Error loading history:', error);
      } finally {
        setIsLoading(false);
      }
    }
    setShowHistory(true);
  };

  return (
    <div className="px-4 py-3 border-t border-zinc-800/50">
      
      {/* 1. Header & Trigger */}
      <button 
        onClick={toggleHistory}
        className="w-full flex items-center justify-between group"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase  group-hover:text-zinc-300 transition-colors">
          <History className="w-3.5 h-3.5" />
          Historial
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
            {totalSessions}
          </span>
          <ChevronRight className={`w-3.5 h-3.5 text-zinc-600 transition-transform duration-200 ${showHistory ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* 2. Timeline Content */}
      {showHistory && (
        <div className="mt-4 animate-in slide-in-from-top-2 fade-in duration-200">
          
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-4 px-2 bg-zinc-900/50 border border-zinc-800 border-dashed rounded-lg">
              <p className="text-xs text-zinc-500">No hay conversaciones previas.</p>
            </div>
          ) : (
            <div className="relative pl-3 space-y-4">
              
              {/* Vertical Guide Line */}
              <div className="absolute left-[15px] top-2 bottom-4 w-px bg-zinc-800" />

              <div className="max-h-[320px] overflow-y-auto pr-1 -mr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent space-y-4 pt-1">
                {history.map((session) => {
                  const status = STATUS_CONFIG[session.status] || STATUS_CONFIG.closed;
                  const StatusIcon = status.icon;
                  const isCurrent = session.sessionId === currentSessionId;

                  return (
                    <div key={session.sessionId} className="relative pl-8 group">
                      
                      {/* Timeline Node */}
                      <div className={`
                        absolute left-0 top-3 w-2.5 h-2.5 rounded-full border-2 z-10 transition-colors
                        ${isCurrent 
                          ? 'bg-indigo-500 border-indigo-900 ring-2 ring-indigo-500/20' 
                          : 'bg-zinc-950 border-zinc-600 group-hover:border-zinc-400'
                        }
                      `} />

                      {/* Card */}
                      <div className={`
                        p-3 rounded-xl border transition-all duration-200 relative overflow-hidden
                        ${isCurrent 
                          ? 'bg-indigo-500/5 border-indigo-500/30' 
                          : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'
                        }
                      `}>
                        {/* Current Session Indicator */}
                        {isCurrent && (
                          <div className="absolute right-0 top-0 p-1">
                            <span className="flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                          </div>
                        )}

                        {/* Top Row: Date & Status */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <Calendar className="w-3 h-3" />
                            <span className="text-[10px] font-medium font-mono">
                              {format(new Date(session.createdAt), "d MMM yyyy", { locale: es })}
                            </span>
                          </div>
                          
                          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${status.bg} ${status.color} ${status.border}`}>
                            <StatusIcon className="w-2.5 h-2.5" />
                            {status.label}
                          </div>
                        </div>

                        {/* Bottom Row: Stats & Category */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                              <MessageSquare className="w-3 h-3" />
                              <span className="font-mono text-zinc-300">{session.messageCount}</span>
                            </div>
                            
                            {session.category && (
                              <span className="text-[10px] text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700 truncate max-w-[100px]">
                                {session.category}
                              </span>
                            )}
                          </div>

                          {/* Hover Action (Visual hint) */}
                          {!isCurrent && (
                            <ExternalLink className="w-3 h-3 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
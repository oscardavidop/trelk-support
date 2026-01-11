// History Section - User's chat history
import { useState } from 'react';
import { ExternalLink, Loader2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { UserHistorySession } from '../../types';
import { getUserHistory } from '../../services/contactApi';

interface HistoryProps {
  userId: string;
  totalSessions: number;
  currentSessionId: string;
}

const STATUS_COLORS: Record<string, string> = {
  bot: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  waiting: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  human: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
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
    <div className="px-4 py-2 space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">Total de conversaciones:</span>
        <span className="font-medium text-gray-700 dark:text-gray-300">{totalSessions}</span>
      </div>

      {/* View history button */}
      <button
        onClick={loadHistory}
        disabled={isLoading}
        className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <ExternalLink className="w-3 h-3" />
        )}
        {showHistory ? 'Ocultar historial' : 'Todo el historial de canales'}
      </button>

      {/* History list */}
      {showHistory && history.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {history.map((session) => (
            <div
              key={session.sessionId}
              className={`p-2 rounded-md text-xs border ${
                session.sessionId === currentSessionId
                  ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20'
                  : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  STATUS_COLORS[session.status] || STATUS_COLORS.closed
                }`}>
                  {session.status === 'bot' ? '🤖' : session.status === 'waiting' ? '⏳' : session.status === 'human' ? '💬' : '✅'}
                  {' '}{session.status}
                </span>
                {session.sessionId === currentSessionId && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                    Actual
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {session.messageCount} msgs
                </span>
                <span>{format(new Date(session.createdAt), "dd MMM", { locale: es })}</span>
              </div>
              
              {session.category && (
                <div className="mt-1">
                  <span className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-[10px] text-gray-600 dark:text-gray-300">
                    {session.category}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showHistory && history.length === 0 && (
        <p className="text-xs text-gray-400 italic">No hay historial previo</p>
      )}
    </div>
  );
}

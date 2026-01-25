/**
 * WhisperDisplay - Shows whispers from supervisors within the chat view
 * Only visible to the agent handling the chat
 */

import { useState, useEffect } from 'react';
import { Eye, X, MessageSquare, Clock } from 'lucide-react';

interface Whisper {
  _id: string;
  sessionId: string;
  fromSupervisor: {
    _id: string;
    name: string;
  };
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface WhisperDisplayProps {
  sessionId: string;
  whispers: Whisper[];
  onMarkAsRead?: (whisperId: string) => void;
  onDismiss?: (whisperId: string) => void;
}

export function WhisperDisplay({ sessionId, whispers, onMarkAsRead, onDismiss }: WhisperDisplayProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  
  const activeWhispers = whispers.filter(w => 
    w.sessionId === sessionId && !dismissed.has(w._id)
  );
  
  if (activeWhispers.length === 0) return null;

  const handleDismiss = (whisperId: string) => {
    setDismissed(prev => new Set([...prev, whisperId]));
    onDismiss?.(whisperId);
  };

  const handleMarkRead = (whisper: Whisper) => {
    if (!whisper.isRead) {
      onMarkAsRead?.(whisper._id);
    }
  };

  return (
    <div className="px-4 py-2 space-y-2">
      {activeWhispers.map(whisper => (
        <WhisperCard
          key={whisper._id}
          whisper={whisper}
          onDismiss={() => handleDismiss(whisper._id)}
          onRead={() => handleMarkRead(whisper)}
        />
      ))}
    </div>
  );
}

interface WhisperCardProps {
  whisper: Whisper;
  onDismiss: () => void;
  onRead: () => void;
}

function WhisperCard({ whisper, onDismiss, onRead }: WhisperCardProps) {
  useEffect(() => {
    // Auto-mark as read after 2 seconds
    const timer = setTimeout(onRead, 2000);
    return () => clearTimeout(timer);
  }, [onRead]);

  const timeAgo = getTimeAgo(whisper.createdAt);

  // sticket top 
  return (
    <div className="relative bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 animate-in slide-in-from-top duration-300 sticky top-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-500/20 rounded-lg">
            <Eye className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-sm font-medium text-purple-400">
            Whisper de {whisper.fromSupervisor.name}
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {timeAgo}
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message */}
      <div className="flex items-start gap-3">
        <MessageSquare className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-gray-200 leading-relaxed">{whisper.message}</p>
      </div>

      {/* Private indicator */}
      <div className="mt-3 pt-2 border-t border-purple-500/20">
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Eye className="w-3 h-3" />
          Solo tú puedes ver este mensaje
        </p>
      </div>
    </div>
  );
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'hace un momento';
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  return date.toLocaleDateString('es-ES');
}

// Inline whisper component for within the message stream
export function InlineWhisper({ whisper }: { whisper: Whisper }) {
  return (
    <div className="mx-4 my-2">
      <div className="max-w-md mx-auto bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/40 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-purple-500/30 rounded-full flex items-center justify-center">
            <Eye className="w-3 h-3 text-purple-300" />
          </div>
          <span className="text-xs font-medium text-purple-300">
            Whisper de {whisper.fromSupervisor.name}
          </span>
        </div>
        <p className="text-sm text-gray-200 pl-8">{whisper.message}</p>
        <p className="text-xs text-gray-500 pl-8 mt-1">
          {new Date(whisper.createdAt).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>
    </div>
  );
}

export default WhisperDisplay;

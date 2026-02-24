/**
 * WhisperDisplay - Premium Zinc Refactor
 * High-fidelity private message display for supervisor-to-agent communication.
 */

import { useState, useEffect } from 'react';
import { Eye, X, MessageSquare, Clock, ShieldAlert } from 'lucide-react';

// ============= INTERFACES =============

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

// ============= MAIN DISPLAY COMPONENT =============

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
    <div className="px-4 py-3 space-y-3 sticky top-0 z-40">
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

// ============= WHISPER CARD (FLOATING) =============

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

  return (
    <div className="relative overflow-hidden bg-zinc-950/90 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-900/10 animate-in fade-in slide-in-from-top-4 duration-300 group">
      
      {/* Top Accent Gradient Line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 opacity-80" />
      
      {/* Background Ambient Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg shadow-inner">
              <Eye className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">
                  Whisper Interno
                </span>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span className="text-xs font-medium text-zinc-300">
                  {whisper.fromSupervisor.name}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" /> {timeAgo}
              </span>
            </div>
          </div>
          
          <button
            onClick={onDismiss}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Descartar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Content */}
        <div className="relative pl-11 pr-2 relative z-10">
          {/* Visual track line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-purple-500/20" />
          <p className="text-sm text-zinc-200 leading-relaxed">
            {whisper.message}
          </p>
        </div>

        {/* Footer Note */}
        <div className="mt-4 pt-3 border-t border-zinc-800/50 flex items-center justify-between relative z-10">
          <p className="text-[10px] text-zinc-500 flex items-center gap-1.5 uppercase tracking-wider font-medium">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-500/70" />
            Mensaje Privado (Invisible para el cliente)
          </p>
        </div>
      </div>
    </div>
  );
}

// ============= INLINE WHISPER (STREAM) =============

export function InlineWhisper({ whisper }: { whisper: Whisper }) {
  return (
    <div className="flex justify-center w-full my-4 animate-in fade-in slide-in-from-bottom-2 duration-300 px-4">
      <div className="relative max-w-md w-full bg-zinc-950/50 backdrop-blur-md border border-purple-500/20 rounded-2xl p-4 shadow-sm">
        
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-purple-500/10 border border-purple-500/20 rounded-full flex items-center justify-center">
            <Eye className="w-3 h-3 text-purple-400" />
          </div>
          <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
            Nota de {whisper.fromSupervisor.name}
          </span>
          <span className="ml-auto text-[10px] font-mono text-zinc-600">
            {new Date(whisper.createdAt).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        
        <div className="pl-8">
          <p className="text-sm text-zinc-300 italic">
            "{whisper.message}"
          </p>
        </div>

      </div>
    </div>
  );
}

// ============= UTILS =============

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Hace un momento';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return date.toLocaleDateString('es-ES');
}

export default WhisperDisplay;
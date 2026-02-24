/**
 * WhisperNotifications - Premium Zinc Refactor
 * High-fidelity floating toast notifications for private supervisor messages.
 */

import { useState, useEffect } from 'react';
import { useSupervisorStore, type Whisper } from '../../stores/supervisorStore';
import { supervisorService } from '../../services/supervisor.service';
import { Eye, X, Clock, ShieldAlert } from 'lucide-react';

interface Props {
  whisper: Whisper;
  onDismiss: (id: string) => void;
}

// ============= SINGLE NOTIFICATION ITEM =============

function WhisperItem({ whisper, onDismiss }: Props) {
  const { markWhisperAsRead } = useSupervisorStore();
  
  const handleDismiss = async () => {
    console.log('Marking whisper as read and dismissing:', whisper);
    await supervisorService.markWhisperAsRead(whisper._id);
    markWhisperAsRead(whisper.id);
    onDismiss(whisper.id);
  };
  
  return (
    <div className="relative overflow-hidden bg-zinc-950/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-900/20 p-4 w-80 pointer-events-auto animate-in fade-in slide-in-from-right-8 duration-300 group">
      
      {/* Top Accent Gradient Line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-500 opacity-80" />
      
      {/* Background Ambient Glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg shadow-inner">
              <Eye className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest leading-none mb-1">
                Whisper Interno
              </p>
              <p className="text-xs font-medium text-zinc-400">
                De: <span className="text-zinc-200 font-bold">{whisper.supervisorName}</span>
              </p>
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            title="Marcar como leído"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Content */}
        <div className="relative pl-11 pr-2">
          {/* Visual track line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-purple-500/20" />
          <p className="text-sm text-zinc-200 leading-relaxed">
            {whisper.content}
          </p>
        </div>
        
        {/* Footer / Meta */}
        <div className="mt-4 pt-3 border-t border-zinc-800/50 flex items-center justify-between">
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-500/70" />
            Solo para ti
          </span>
          <span className="text-[10px] text-zinc-500 font-mono flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(whisper.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============= NOTIFICATION MANAGER =============

export function WhisperNotifications() {
  const { whispers, addWhisper } = useSupervisorStore();
  const [visibleWhispers, setVisibleWhispers] = useState<Whisper[]>([]);
  
  // Show unread whispers
  useEffect(() => {
    const unread = whispers.filter(w => !w.isRead);
    setVisibleWhispers(unread.slice(0, 3)); // Show max 3 at a time
  }, [whispers]);
  
  // Load unread whispers on mount
  useEffect(() => {
    const loadWhispers = async () => {
      const res = await supervisorService.getUnreadWhispers();
      if (res.success && res.data.length > 0) {
        res.data.forEach(w => addWhisper(w));
      }
    };
    loadWhispers();
  }, [addWhisper]);
  
  const handleDismiss = (id: string) => {
    setVisibleWhispers(prev => prev.filter(w => w.id !== id));
  };
  
  if (visibleWhispers.length === 0) {
    return null;
  }
  
  return (
    // pointer-events-none ensures you can click the chat behind the empty spaces of the container
    <div className="fixed bottom-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      {visibleWhispers.map(whisper => (
        <WhisperItem 
          key={whisper.id} 
          whisper={whisper} 
          onDismiss={handleDismiss}
        />
      ))}
    </div>
  );
}

export default WhisperNotifications;
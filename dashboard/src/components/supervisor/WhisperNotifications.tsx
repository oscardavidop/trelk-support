/**
 * WhisperNotification - Shows whisper messages from supervisors
 * Appears as a floating notification that can be dismissed
 */

import { useState, useEffect } from 'react';
import { useSupervisorStore, type Whisper } from '../../stores/supervisorStore';
import { supervisorService } from '../../services/supervisor.service';

interface Props {
  whisper: Whisper;
  onDismiss: (id: string) => void;
}

function WhisperItem({ whisper, onDismiss }: Props) {
  const { markWhisperAsRead } = useSupervisorStore();
  
  const handleDismiss = async () => {
    await supervisorService.markWhisperAsRead(whisper.id);
    markWhisperAsRead(whisper.id);
    onDismiss(whisper.id);
  };
  
  return (
    <div className="bg-purple-900/90 backdrop-blur border border-purple-500/50 rounded-lg shadow-xl p-4 max-w-sm animate-slide-in-right">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="p-2 bg-purple-500/20 rounded-full">
          <svg className="w-5 h-5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-purple-300 font-medium">
              Whisper de {whisper.supervisorName}
            </p>
            <button
              onClick={handleDismiss}
              className="p-1 text-purple-300 hover:text-white rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Content */}
          <p className="text-sm text-white">{whisper.content}</p>
          
          {/* Time */}
          <p className="text-xs text-purple-400 mt-2">
            {new Date(whisper.createdAt).toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
}

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
    <div className="fixed bottom-20 right-4 z-50 space-y-3">
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

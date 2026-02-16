/**
 * Pinned Message Banner
 * Shows the pinned message at the top of the chat
 * 
 * Features:
 * - Fixed at top of chat
 * - Soft info/warning color
 * - 📌 Icon
 * - Editable (if permitted)
 * - Visible to agents
 * - Subtle animation on pin
 */

import { useState, useEffect } from 'react';
import { Pin, X, Edit2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { unpinMessage } from '../../services/socket';
import type { Message } from '../../types';

interface PinnedMessageBannerProps {
  sessionId: string;
  canEdit?: boolean;
  onScrollToMessage?: (messageId: string) => void;
}

export default function PinnedMessageBanner({ 
  sessionId, 
  canEdit = true,
  onScrollToMessage 
}: PinnedMessageBannerProps) {
  const pinnedMessages = useChatStore((state) => state.pinnedMessages);
  const pinnedMessage = pinnedMessages[sessionId];
  
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isUnpinning, setIsUnpinning] = useState(false);

  // Animate in when pinned message appears
  useEffect(() => {
    if (pinnedMessage) {
      // Small delay for animation
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [pinnedMessage]);

  if (!pinnedMessage) return null;

  const handleUnpin = async () => {
    setIsUnpinning(true);
    unpinMessage(pinnedMessage._id, sessionId, (result) => {
      if (!result.ok) {
        console.error('Failed to unpin:', result.error);
      }
      setIsUnpinning(false);
    });
  };

  const handleScrollToMessage = () => {
    onScrollToMessage?.(pinnedMessage._id);
  };

  const formatPinTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    if (diff < 3600000) return `hace ${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `hace ${Math.floor(diff / 3600000)}h`;
    return d.toLocaleDateString();
  };

  const isLongMessage = pinnedMessage.content.length > 100;
  const displayContent = isExpanded || !isLongMessage 
    ? pinnedMessage.content 
    : pinnedMessage.content.slice(0, 100) + '...';

  return (
    <div 
      className={`
        sticky top-0 z-20 
        transform transition-all duration-300 ease-out
        ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}
      `}
    >
      <div className="mx-2 mt-2 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 shadow-lg backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-blue-500/10">
          <div className="flex items-center gap-2">
            <Pin className="w-4 h-4 text-blue-400 animate-pulse" />
            <span className="text-xs font-medium text-blue-400">Mensaje Fijado</span>
            {pinnedMessage.senderAgent && (
              <span className="text-xs text-gray-500">
                por {pinnedMessage.senderAgent.name}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              {formatPinTime(pinnedMessage.createdAt)}
            </span>
            
            {canEdit && (
              <button
                onClick={handleUnpin}
                disabled={isUnpinning}
                className="p-1 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                title="Desfijar mensaje"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Content */}
        <div 
          className="px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={handleScrollToMessage}
        >
          <p className="text-sm text-gray-200 whitespace-pre-wrap">
            {displayContent}
          </p>
          
          {isLongMessage && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="flex items-center gap-1 mt-1 text-xs text-blue-400 hover:text-blue-300"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Mostrar menos
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Mostrar más
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Pin Message History Modal
 * Shows history of pinned messages for a session
 */
export function PinHistoryModal({ 
  sessionId, 
  onClose 
}: { 
  sessionId: string; 
  onClose: () => void;
}) {
  const [history, setHistory] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real implementation, fetch pin history from API
    // For now, we'll just show a placeholder
    setIsLoading(false);
  }, [sessionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-gray-900 rounded-xl shadow-2xl border border-gray-700">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Pin className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold text-zinc-50">Historial de Mensajes Fijados</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-700 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No hay historial de mensajes fijados
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((msg) => (
                <div 
                  key={msg._id}
                  className="p-3 rounded-lg bg-gray-800 border border-gray-700"
                >
                  <p className="text-sm text-gray-200">{msg.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Fijado {new Date(msg.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

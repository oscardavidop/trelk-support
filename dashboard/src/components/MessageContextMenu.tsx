/**
 * Message Context Menu
 * Floating menu with dynamic actions based on message type and sender
 */

import { useRef, useEffect, useCallback } from 'react';
import { 
  Reply, 
  Copy, 
  Pin, 
  Link2, 
  Pencil, 
  Trash2, 
  Star,
  Ban,
  Tag,
  FileText,
  AlertTriangle,
  X
} from 'lucide-react';
import type { Message } from '../types';
import { useAuthStore } from '../stores/authStore';

// ============= TYPES =============

export interface MessageAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'warning';
  disabled?: boolean;
}

interface MessageContextMenuProps {
  message: Message;
  position: { x: number; y: number };
  isPinned?: boolean;
  onClose: () => void;
  onReply: (message: Message) => void;
  onCopy: (message: Message) => void;
  onPin: (message: Message) => void;
  onUnpin: (message: Message) => void;
  onCopyLink: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  onSaveQuickReply?: (message: Message) => void;
  onBlockUser?: (message: Message) => void;
  onAddTag?: (message: Message) => void;
  onAddNote?: (message: Message) => void;
  onReportSpam?: (message: Message) => void;
}

// ============= CONSTANTS =============

const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in ms

// ============= COMPONENT =============

export default function MessageContextMenu({
  message,
  position,
  isPinned,
  onClose,
  onReply,
  onCopy,
  onPin,
  onUnpin,
  onCopyLink,
  onEdit,
  onDelete,
  onSaveQuickReply,
  onBlockUser,
  onAddTag,
  onAddNote,
  onReportSpam,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const agent = useAuthStore((state) => state.agent);
  
  // ============= PERMISSION CHECKS =============
  
  const isAgentMessage = message.sender === 'agent';
  const isUserMessage = message.sender === 'user';
  const isSystemMessage = message.sender === 'bot' && message.messageType === 'system';
  const isBotMessage = message.sender === 'bot' && message.messageType !== 'system';
  
  // Check if current agent sent this message
  const isOwnMessage = isAgentMessage && message.senderAgent?.name === agent?.name;
  
  // Check if message is editable (< 24h old)
  const messageAge = Date.now() - new Date(message.createdAt).getTime();
  const isEditable = isOwnMessage && messageAge < ONE_DAY_MS;
  
  // Admin can do more
  const isAdmin = agent?.role === 'admin';
  
  // ============= BUILD ACTIONS =============
  
  const actions: MessageAction[] = [];
  
  // === COMMON ACTIONS (all message types except system) ===
  if (!isSystemMessage) {
    actions.push({
      id: 'reply',
      label: 'Responder',
      icon: <Reply className="w-4 h-4" />,
      onClick: () => { onReply(message); onClose(); },
    });
  }
  
  // Copy - for all messages
  actions.push({
    id: 'copy',
    label: 'Copiar texto',
    icon: <Copy className="w-4 h-4" />,
    onClick: () => { onCopy(message); onClose(); },
  });
  
  // Pin/Unpin - for all except system
  if (!isSystemMessage) {
    if (isPinned) {
      actions.push({
        id: 'unpin',
        label: 'Desfijar mensaje',
        icon: <Pin className="w-4 h-4" />,
        onClick: () => { onUnpin(message); onClose(); },
      });
    } else {
      actions.push({
        id: 'pin',
        label: 'Fijar mensaje',
        icon: <Pin className="w-4 h-4" />,
        onClick: () => { onPin(message); onClose(); },
      });
    }
  }
  
  // Copy link - for all
  actions.push({
    id: 'copy-link',
    label: 'Copiar enlace',
    icon: <Link2 className="w-4 h-4" />,
    onClick: () => { onCopyLink(message); onClose(); },
  });
  
  // === AGENT MESSAGE ACTIONS ===
  if (isAgentMessage && isOwnMessage) {
    // Edit - only if < 24h
    if (isEditable && onEdit) {
      actions.push({
        id: 'edit',
        label: 'Editar mensaje',
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => { onEdit(message); onClose(); },
      });
    }
    
    // Delete - only own messages
    if (onDelete) {
      actions.push({
        id: 'delete',
        label: 'Eliminar mensaje',
        icon: <Trash2 className="w-4 h-4" />,
        onClick: () => { onDelete(message); onClose(); },
        variant: 'danger',
      });
    }
    
    // Save as quick reply
    if (onSaveQuickReply) {
      actions.push({
        id: 'save-reply',
        label: 'Guardar como respuesta rápida',
        icon: <Star className="w-4 h-4" />,
        onClick: () => { onSaveQuickReply(message); onClose(); },
      });
    }
  }
  
  // === USER MESSAGE ACTIONS ===
  if (isUserMessage) {
    if (onBlockUser) {
      actions.push({
        id: 'block',
        label: 'Bloquear usuario',
        icon: <Ban className="w-4 h-4" />,
        onClick: () => { onBlockUser(message); onClose(); },
        variant: 'danger',
      });
    }
    
    if (onAddTag) {
      actions.push({
        id: 'tag',
        label: 'Añadir etiqueta',
        icon: <Tag className="w-4 h-4" />,
        onClick: () => { onAddTag(message); onClose(); },
      });
    }
    
    if (onAddNote) {
      actions.push({
        id: 'note',
        label: 'Agregar nota interna',
        icon: <FileText className="w-4 h-4" />,
        onClick: () => { onAddNote(message); onClose(); },
      });
    }
    
    if (onReportSpam) {
      actions.push({
        id: 'spam',
        label: 'Reportar como spam',
        icon: <AlertTriangle className="w-4 h-4" />,
        onClick: () => { onReportSpam(message); onClose(); },
        variant: 'warning',
      });
    }
  }
  
  // ============= EFFECTS =============
  
  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    // Add listeners with a small delay to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 10);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);
  
  // Adjust position to stay in viewport
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Adjust horizontal position
      if (rect.right > viewportWidth) {
        menuRef.current.style.left = `${position.x - rect.width}px`;
      }
      
      // Adjust vertical position
      if (rect.bottom > viewportHeight) {
        menuRef.current.style.top = `${position.y - rect.height}px`;
      }
    }
  }, [position]);
  
  // ============= RENDER =============
  
  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[200px] py-2 bg-gray-900 border border-gray-700 rounded-lg shadow-xl animate-context-menu"
      style={{ 
        left: position.x, 
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header - message preview */}
      <div className="px-3 py-2 border-b border-gray-700 mb-1">
        <p className="text-xs text-gray-500 truncate max-w-[200px]">
          {message.content.substring(0, 50)}{message.content.length > 50 ? '...' : ''}
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex flex-col">
        {actions.map((action, index) => (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`
              flex items-center gap-3 px-3 py-2 text-sm transition-colors w-full text-left
              ${action.variant === 'danger' 
                ? 'text-red-400 hover:bg-red-500/10' 
                : action.variant === 'warning'
                ? 'text-yellow-400 hover:bg-yellow-500/10'
                : 'text-gray-300 hover:bg-gray-800'
              }
              ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============= HOOK FOR MESSAGE ACTIONS =============

export function useMessageActions(sessionId: string) {
  const handleCopy = useCallback(async (message: Message) => {
    const textToCopy = message.mediaUrl || message.content;
    try {
      await navigator.clipboard.writeText(textToCopy);
      // TODO: Show toast notification
      console.log('Copied to clipboard:', textToCopy.substring(0, 50));
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);
  
  const handleCopyLink = useCallback(async (message: Message) => {
    const link = `${window.location.origin}/chat/${sessionId}#message-${message._id}`;
    try {
      await navigator.clipboard.writeText(link);
      console.log('Copied link:', link);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }, [sessionId]);
  
  return {
    handleCopy,
    handleCopyLink,
  };
}

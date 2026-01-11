// Chat Window component
import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { 
  acceptSession, 
  closeSession, 
  joinSession, 
  leaveSession,
  editMessage,
  deleteMessage,
  pinMessage,
  unpinMessage,
  reportSpam
} from '../services/socket';
import { toast } from '../stores/toastStore';
import { 
  X, 
  CheckCircle, 
  Clock, 
  User,
  Bot,
  Headphones,
  Loader2,
  ExternalLink,
  PanelRightOpen,
  PanelRightClose,
  Lock,
  AlertCircle,
  Archive,
  Image as ImageIcon,
  FileText,
  Mic,
  Music,
  Download,
  Play,
  Pause,
  Maximize2,
  ArrowRightLeft,
  Ban,
  Pin
} from 'lucide-react';
import type { ChatSession, Message, TypingEvent, ChatCategory } from '../types';
import AgentComposer from './AgentComposer';
import { TypingIndicator, TransferModal, BlockUserModal, CategorySelector, ReopenChatButton, SurveyDisplay } from './enterprise';
import MessageContextMenu from './MessageContextMenu';
import { EditMessageModal, DeleteMessageModal, SaveQuickReplyModal, AddNoteModal, TagSelectorModal } from './MessageActionModals';

interface ChatWindowProps {
  session: ChatSession;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function ChatWindow({ session, onToggleSidebar, isSidebarOpen }: ChatWindowProps) {
  const agent = useAuthStore((state) => state.agent);
  const { messages, setMessages, isLoadingMessages, setLoadingMessages, updateMessage, deleteMessage: removeMessage, pinnedMessages, setPinnedMessage, clearPinnedMessage } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Enterprise states
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [survey, setSurvey] = useState<{ rating: number; comment?: string } | null>(null);
  
  // Context menu states
  const [contextMenu, setContextMenu] = useState<{
    message: Message;
    position: { x: number; y: number };
  } | null>(null);
  
  // Modal states
  const [editModal, setEditModal] = useState<{ message: Message } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ message: Message } | null>(null);
  const [saveQuickReplyModal, setSaveQuickReplyModal] = useState<{ message: Message } | null>(null);
  const [addNoteModal, setAddNoteModal] = useState<{ message: Message } | null>(null);
  const [tagSelectorModal, setTagSelectorModal] = useState<{ message: Message } | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  // Join session room and load messages
  useEffect(() => {
    let isMounted = true;
    
    // Clear previous messages immediately to avoid showing stale data
    setMessages([]);
    
    const loadSessionMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/sessions/${session.sessionId}/messages`, {
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().token}`,
          },
        });
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        
        // Only update if component is still mounted and session hasn't changed
        if (isMounted && data.ok) {
          setMessages(data.messages);
        } else if (isMounted && !data.ok) {
          console.error('Failed to load messages:', data.error);
          toast.error('Error', 'No se pudieron cargar los mensajes');
        }
      } catch (error) {
        console.error('Failed to load messages:', error);
        if (isMounted) {
          toast.error('Error de conexión', 'No se pudieron cargar los mensajes');
        }
      } finally {
        if (isMounted) {
          setLoadingMessages(false);
        }
      }
    };
    
    joinSession(session.sessionId);
    loadSessionMessages();
    
    // Load survey for closed sessions
    if (session.status === 'closed') {
      loadSurvey();
    }

    return () => {
      isMounted = false;
      leaveSession(session.sessionId);
    };
  }, [session.sessionId, session.status, setMessages, setLoadingMessages]);
  
  // Typing indicator listeners
  useEffect(() => {
    const handleTypingStart = (e: CustomEvent<TypingEvent>) => {
      if (e.detail.sessionId === session.sessionId && e.detail.userId) {
        setIsUserTyping(true);
      }
    };
    
    const handleTypingStop = (e: CustomEvent<TypingEvent>) => {
      if (e.detail.sessionId === session.sessionId) {
        setIsUserTyping(false);
      }
    };
    
    window.addEventListener('typing:start', handleTypingStart as EventListener);
    window.addEventListener('typing:stop', handleTypingStop as EventListener);
    
    return () => {
      window.removeEventListener('typing:start', handleTypingStart as EventListener);
      window.removeEventListener('typing:stop', handleTypingStop as EventListener);
    };
  }, [session.sessionId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Scroll to specific message if URL has hash (e.g. #message-123)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#message-') && messages.length > 0) {
      const messageId = hash.replace('#message-', '');
      const element = document.getElementById(`message-${messageId}`);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight effect
          element.classList.add('ring-2', 'ring-primary', 'ring-opacity-50');
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-primary', 'ring-opacity-50');
          }, 2000);
        }, 100);
      }
    }
  }, [messages]);

  const loadSurvey = async () => {
    try {
      const res = await fetch(`/api/sessions/${session.sessionId}/survey`, {
        headers: {
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
      });
      const data = await res.json();
      if (data.ok && data.survey) {
        setSurvey(data.survey);
      }
    } catch (error) {
      console.error('Failed to load survey:', error);
    }
  };
  
  // Context menu handlers
  const handleMessageClick = useCallback((message: Message, event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      message,
      position: { x: event.clientX, y: event.clientY }
    });
  }, []);
  
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  
  // Message action handlers
  const handleReply = useCallback((message: Message) => {
    setReplyTo(message);
    closeContextMenu();
  }, [closeContextMenu]);
  
  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);
  
  const handleCopy = useCallback(async (message: Message) => {
    await navigator.clipboard.writeText(message.content);
    closeContextMenu();
  }, [closeContextMenu]);
  
  const handleCopyLink = useCallback(async (message: Message) => {
    const link = `${window.location.origin}/chat/${session.sessionId}#message-${message._id}`;
    await navigator.clipboard.writeText(link);
    closeContextMenu();
  }, [session.sessionId, closeContextMenu]);
  
  const handlePin = useCallback((message: Message) => {
    pinMessage(message._id, session.sessionId, (result) => {
      if (result.ok) {
        setPinnedMessage(session.sessionId, message);
      }
    });
    closeContextMenu();
  }, [session.sessionId, setPinnedMessage, closeContextMenu]);
  
  const handleUnpin = useCallback((message: Message) => {
    unpinMessage(message._id, session.sessionId, (result) => {
      if (result.ok) {
        clearPinnedMessage(session.sessionId);
      }
    });
    closeContextMenu();
  }, [session.sessionId, clearPinnedMessage, closeContextMenu]);
  
  const handleEdit = useCallback((message: Message) => {
    setEditModal({ message });
    closeContextMenu();
  }, [closeContextMenu]);
  
  const handleEditSave = useCallback((messageId: string, newContent: string) => {
    editMessage(messageId, session.sessionId, newContent, (result) => {
      if (result.ok) {
        updateMessage(messageId, { content: newContent, isEdited: true });
      }
    });
    setEditModal(null);
  }, [session.sessionId, updateMessage]);
  
  const handleDelete = useCallback((message: Message) => {
    setDeleteModal({ message });
    closeContextMenu();
  }, [closeContextMenu]);
  
  const handleDeleteConfirm = useCallback((messageId: string) => {
    deleteMessage(messageId, session.sessionId, (result) => {
      if (result.ok) {
        removeMessage(messageId);
      }
    });
    setDeleteModal(null);
  }, [session.sessionId, removeMessage]);
  
  const handleSaveQuickReply = useCallback((message: Message) => {
    setSaveQuickReplyModal({ message });
    closeContextMenu();
  }, [closeContextMenu]);
  
  const handleSaveQuickReplyConfirm = useCallback(async (data: { title: string; content: string; category?: string; shortcut?: string }) => {
    try {
      await fetch('/api/quick-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
        body: JSON.stringify(data),
      });
    } catch (error) {
      console.error('Failed to save quick reply:', error);
    }
    setSaveQuickReplyModal(null);
  }, []);
  
  const handleBlockUser = useCallback(() => {
    setShowBlockModal(true);
    closeContextMenu();
  }, [closeContextMenu]);
  
  const handleAddTag = useCallback((message: Message) => {
    setTagSelectorModal({ message });
    closeContextMenu();
  }, [closeContextMenu]);
  
  const handleTagSelect = useCallback(async (messageId: string, tags: string[]) => {
    try {
      await fetch(`/api/messages/${messageId}/tags`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
        body: JSON.stringify({ tags }),
      });
      updateMessage(messageId, { tags });
    } catch (error) {
      console.error('Failed to update tags:', error);
    }
    setTagSelectorModal(null);
  }, [updateMessage]);
  
  const handleAddNote = useCallback((message: Message) => {
    setAddNoteModal({ message });
    closeContextMenu();
  }, [closeContextMenu]);
  
  const handleNoteSave = useCallback(async (messageId: string, note: string) => {
    try {
      await fetch(`/api/messages/${messageId}/note`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
        body: JSON.stringify({ note }),
      });
      updateMessage(messageId, { internalNote: note });
    } catch (error) {
      console.error('Failed to save note:', error);
    }
    setAddNoteModal(null);
  }, [updateMessage]);
  
  const handleReportSpam = useCallback((message: Message) => {
    if (confirm('¿Reportar este mensaje como spam?')) {
      reportSpam(message._id, session.sessionId);
    }
    closeContextMenu();
  }, [session.sessionId, closeContextMenu]);
  
  // Get pinned message for this session
  const pinnedMessage = pinnedMessages[session.sessionId];

  const handleAccept = () => {
    acceptSession(session.sessionId, (result) => {
      if (!result.ok) {
        console.error('Failed to accept session:', result.error);
      }
    });
  };

  const handleClose = () => {
    if (confirm('Are you sure you want to close this conversation?')) {
      closeSession(session.sessionId, 'Agent closed conversation', (result) => {
        if (!result.ok) {
          console.error('Failed to close session:', result.error);
        }
      });
    }
  };

  const isMySession = session.assignedAgent?._id === agent?._id;
  const isClosed = session.status === 'closed';

  const getCloseReasonLabel = () => {
    if (!session.closeReason) return 'Conversación cerrada';
    const labels: Record<string, string> = {
      manual: session.closedByType === 'agent' ? 'Cerrado por agente' : 'Cerrado por usuario',
      inactivity: 'Cerrado por inactividad',
      resolved: 'Marcado como resuelto',
      spam: 'Marcado como spam',
    };
    return labels[session.closeReason] || 'Conversación cerrada';
  };

  const formatClosedDate = () => {
    if (!session.closedAt) return '';
    const d = new Date(session.closedAt);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Closed Banner */}
      {isClosed && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700 text-gray-400 text-sm">
          <Lock className="w-4 h-4" />
          <span>Modo solo lectura</span>
          <span className="text-gray-600">•</span>
          <span>{getCloseReasonLabel()}</span>
          {session.closedAt && (
            <>
              <span className="text-gray-600">•</span>
              <span>{formatClosedDate()}</span>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div className={`flex items-center justify-between p-4 border-b border-gray-800 ${isClosed ? 'bg-gray-900/30' : 'bg-gray-900/50'}`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-medium">
            {session.user.firstName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-medium text-white">
              {session.user.firstName} {session.user.lastName || ''}
              {session.user.username && (
                <span className="text-gray-500 font-normal ml-2">@{session.user.username}</span>
              )}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Telegram ID: {session.user.telegramId}</span>
              <span>•</span>
              <span className="uppercase">{session.user.language}</span>
              {session.user.isSubscriber && (
                <>
                  <span>•</span>
                  <span className="text-secondary">Premium</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session.status === 'waiting' && (
            <button
              onClick={handleAccept}
              className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-white rounded-lg transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Accept
            </button>
          )}
          
          {session.status === 'human' && isMySession && (
            <button
              onClick={handleClose}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          )}
          
          {/* Enterprise Actions */}
          {session.status === 'human' && isMySession && (
            <>
              <CategorySelector 
                sessionId={session.sessionId} 
                currentCategory={(session as any).category}
                compact 
              />
              <button
                onClick={() => setShowTransferModal(true)}
                className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Transferir chat"
              >
                <ArrowRightLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setShowBlockModal(true)}
                className="p-2 text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors"
                title="Bloquear usuario"
              >
                <Ban className="w-5 h-5" />
              </button>
            </>
          )}
          
          {/* Reopen button for closed chats */}
          {isClosed && (
            <ReopenChatButton 
              sessionId={session.sessionId}
              reopenCount={(session as any).reopenCount || 0}
            />
          )}
          
          <a
            href={`https://t.me/${session.user.username || ''}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
          
          {/* Toggle Sidebar Button */}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className={`p-2 rounded-lg transition-colors ${
                isSidebarOpen 
                  ? 'text-primary bg-primary/10' 
                  : 'text-gray-500 hover:text-white hover:bg-gray-800'
              }`}
              title={isSidebarOpen ? 'Ocultar información' : 'Mostrar información'}
            >
              {isSidebarOpen ? (
                <PanelRightClose className="w-5 h-5" />
              ) : (
                <PanelRightOpen className="w-5 h-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 chat-messages-scroll">
        {/* Pinned Message Bar */}
        {pinnedMessage && (
          <div className="sticky top-0 z-10 mb-2">
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg">
              <Pin className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{pinnedMessage.content}</p>
                <p className="text-xs text-gray-500">
                  {pinnedMessage.senderAgent?.name || pinnedMessage.sender}
                </p>
              </div>
              <button
                onClick={() => handleUnpin(pinnedMessage)}
                className="p-1 text-gray-500 hover:text-white transition-colors"
                title="Desfijar mensaje"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            No messages yet
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble 
              key={message._id} 
              message={message}
              onContextMenu={(e) => handleMessageClick(message, e)}
              isPinned={pinnedMessage?._id === message._id}
            />
          ))
        )}
        
        {/* Typing Indicator */}
        {isUserTyping && <TypingIndicator name={session.user.firstName} />}
        
        {/* Survey for closed sessions */}
        {isClosed && survey && (
          <div className="mt-4">
            <SurveyDisplay survey={survey as any} />
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {session.status === 'human' && isMySession ? (
        <AgentComposer 
          session={session} 
          replyTo={replyTo}
          onCancelReply={handleCancelReply}
        />
      ) : session.status === 'waiting' ? (
        <div className="p-4 border-t border-gray-800 bg-warning/10 text-center">
          <p className="text-warning text-sm">
            <Clock className="w-4 h-4 inline-block mr-2" />
            This session is waiting for an agent. Click "Accept" to start chatting.
          </p>
        </div>
      ) : session.status === 'human' && !isMySession ? (
        <div className="p-4 border-t border-gray-800 bg-gray-800/50 text-center">
          <p className="text-gray-500 text-sm">
            <Headphones className="w-4 h-4 inline-block mr-2" />
            This session is assigned to {session.assignedAgent?.name}
          </p>
        </div>
      ) : isClosed ? (
        <div className="p-4 border-t border-gray-800 bg-gray-800/30">
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <Archive className="w-5 h-5" />
            <div className="text-center">
              <p className="text-sm font-medium">Conversación cerrada</p>
              <p className="text-xs text-gray-600 mt-0.5">
                {getCloseReasonLabel()}
                {session.closedAt && ` • ${formatClosedDate()}`}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-gray-800 bg-gray-800/50 text-center">
          <p className="text-gray-500 text-sm">
            <Bot className="w-4 h-4 inline-block mr-2" />
            Bot mode - waiting for user action
          </p>
        </div>
      )}
      
      {/* Enterprise Modals */}
      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        sessionId={session.sessionId}
        currentAgentId={session.assignedAgent?._id}
      />
      
      <BlockUserModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        telegramId={session.user.telegramId}
        username={session.user.username}
        firstName={session.user.firstName}
      />
      
      {/* Context Menu */}
      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          isPinned={pinnedMessage?._id === contextMenu.message._id}
          onClose={closeContextMenu}
          onReply={handleReply}
          onCopy={handleCopy}
          onCopyLink={handleCopyLink}
          onPin={handlePin}
          onUnpin={handleUnpin}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onSaveQuickReply={handleSaveQuickReply}
          onBlockUser={handleBlockUser}
          onAddTag={handleAddTag}
          onAddNote={handleAddNote}
          onReportSpam={handleReportSpam}
        />
      )}
      
      {/* Message Action Modals */}
      {editModal && (
        <EditMessageModal
          isOpen={true}
          message={editModal.message}
          onClose={() => setEditModal(null)}
          onSave={handleEditSave}
        />
      )}
      
      {deleteModal && (
        <DeleteMessageModal
          isOpen={true}
          message={deleteModal.message}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
      
      {saveQuickReplyModal && (
        <SaveQuickReplyModal
          isOpen={true}
          message={saveQuickReplyModal.message}
          onClose={() => setSaveQuickReplyModal(null)}
          onSave={handleSaveQuickReplyConfirm}
        />
      )}
      
      {addNoteModal && (
        <AddNoteModal
          isOpen={true}
          onClose={() => setAddNoteModal(null)}
          onSave={(note) => handleNoteSave(addNoteModal.message._id, note)}
        />
      )}
      
      {tagSelectorModal && (
        <TagSelectorModal
          isOpen={true}
          onClose={() => setTagSelectorModal(null)}
          onSelect={(tag) => handleTagSelect(tagSelectorModal.message._id, [tag])}
        />
      )}
    </div>
  );
}

// Message Bubble component
interface MessageBubbleProps {
  message: Message;
  onContextMenu?: (e: React.MouseEvent) => void;
  isPinned?: boolean;
}

function MessageBubble({ message, onContextMenu, isPinned }: MessageBubbleProps) {
  const isAgent = message.sender === 'agent';
  const isBot = message.sender === 'bot';
  const isSystem = message.messageType === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <span className="px-3 py-1 bg-gray-800 text-gray-500 text-sm rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  // Helper to convert media reference to proxy URL
  const getProxyMediaUrl = (mediaRef: string | undefined): string | undefined => {
    if (!mediaRef) return undefined;
    
    // If it's already a full URL path, return as-is
    if (mediaRef.startsWith('/api/media/') || mediaRef.startsWith('/api/download/') || mediaRef.startsWith('/uploads/')) {
      return mediaRef;
    }
    
    // If it starts with http, it might be an old-style Telegram URL - convert it
    if (mediaRef.startsWith('http')) {
      const telegramMatch = mediaRef.match(/api\.telegram\.org\/file\/bot[^/]+\/(.+)$/);
      if (telegramMatch) {
        return `/api/media/${telegramMatch[1]}`;
      }
      return mediaRef;
    }
    
    // Otherwise, treat it as a file_id from telegram-bot-api local mode
    // The backend will resolve it via getFile() API
    return `/api/media/${encodeURIComponent(mediaRef)}`;
  };

  // Render media content based on type
  const renderMediaContent = () => {
    const mediaUrl = getProxyMediaUrl(message.mediaUrl);
    
    if (!mediaUrl) {
      return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
    }

    switch (message.messageType) {
      case 'image':
        return (
          <MediaImage 
            url={mediaUrl} 
            alt={message.content} 
            isAgent={isAgent}
          />
        );
      
      case 'voice':
      case 'audio':
        return (
          <MediaAudio 
            url={mediaUrl} 
            title={message.content}
            isAgent={isAgent}
          />
        );
      
      case 'document':
      case 'file':
        return (
          <MediaFile 
            url={mediaUrl} 
            fileName={message.fileName || message.content}
            isAgent={isAgent}
          />
        );
      
      case 'sticker':
        return (
          <MediaSticker url={mediaUrl} />
        );
      
      default:
        return <p className="whitespace-pre-wrap break-words">{message.content}</p>;
    }
  };

  return (
    <div 
      id={`message-${message._id}`}
      className={`flex ${isAgent ? 'justify-end' : 'justify-start'} group`}
    >
      <div className={`flex items-end gap-2 max-w-[70%] ${isAgent ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isAgent ? 'bg-primary' : isBot ? 'bg-gray-700' : 'bg-gray-600'
        }`}>
          {isAgent ? (
            <Headphones className="w-4 h-4 text-white" />
          ) : isBot ? (
            <Bot className="w-4 h-4 text-white" />
          ) : (
            <User className="w-4 h-4 text-white" />
          )}
        </div>

        {/* Bubble */}
        <div 
          onContextMenu={onContextMenu}
          className={`px-4 py-2.5 rounded-2xl cursor-context-menu select-none transition-all ${
            isAgent 
              ? 'bg-primary text-white rounded-br-md hover:bg-primary/90' 
              : 'bg-gray-800 text-white rounded-bl-md hover:bg-gray-700'
          } ${isPinned ? 'ring-2 ring-primary/50' : ''}`}
        >
          {/* Reply Quote */}
          {message.replyToMessage && (
            <div className={`flex items-start gap-2 mb-2 pb-2 border-b ${
              isAgent ? 'border-white/20' : 'border-gray-600'
            }`}>
              <div className={`w-0.5 h-full min-h-[24px] rounded-full flex-shrink-0 ${
                isAgent ? 'bg-white/40' : 'bg-primary'
              }`} />
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium ${isAgent ? 'text-white/70' : 'text-primary'}`}>
                  {message.replyToMessage.sender === 'user' 
                    ? 'Usuario' 
                    : message.replyToMessage.senderAgent?.name || 'Agente'}
                </p>
                <p className={`text-xs truncate ${isAgent ? 'text-white/50' : 'text-gray-500'}`}>
                  {message.replyToMessage.content}
                </p>
              </div>
            </div>
          )}
          
          {/* Pinned indicator */}
          {isPinned && (
            <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
              <Pin className="w-3 h-3" />
              <span>Fijado</span>
            </div>
          )}
          
          {message.senderAgent && (
            <p className="text-xs opacity-70 mb-1">{message.senderAgent.name}</p>
          )}
          {renderMediaContent()}
          
          <div className={`flex items-center gap-2 mt-1 ${isAgent ? 'text-white/60' : 'text-gray-500'}`}>
            <span className="text-xs">
              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {(message as any).isEdited && (
              <span className="text-xs italic">(editado)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============= MEDIA COMPONENTS =============

// Image Media Component
function MediaImage({ url, alt, isAgent }: { url: string; alt: string; isAgent: boolean }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (hasError) {
    return (
      <div className="flex items-center gap-2 py-2">
        <ImageIcon className="w-5 h-5 opacity-60" />
        <span className="text-sm opacity-80">{alt || 'Image failed to load'}</span>
      </div>
    );
  }

  return (
    <>
      <div className="relative group">
        {isLoading && (
          <div className="w-48 h-32 bg-gray-700/50 rounded-lg animate-pulse flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin opacity-50" />
          </div>
        )}
        <img
          src={url}
          alt={alt}
          className={`max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${
            isLoading ? 'hidden' : 'block'
          }`}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
          onClick={() => setIsFullscreen(true)}
        />
        {!isLoading && (
          <button
            onClick={() => setIsFullscreen(true)}
            className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Fullscreen Modal */}
      {isFullscreen && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsFullscreen(false)}
        >
          <img
            src={url}
            alt={alt}
            className="max-w-full max-h-full object-contain"
          />
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </a>
        </div>
      )}
    </>
  );
}

// Audio Media Component
function MediaAudio({ url, title, isAgent }: { url: string; title: string; isAgent: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (hasError) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Mic className="w-5 h-5 opacity-60" />
        <span className="text-sm opacity-80">Audio failed to load</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 min-w-[200px] py-1">
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setHasError(true)}
        preload="metadata"
      />
      
      <button
        onClick={togglePlay}
        className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
          isAgent 
            ? 'bg-white/20 hover:bg-white/30' 
            : 'bg-primary/80 hover:bg-primary'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </button>
      
      <div className="flex-1">
        <div className="flex items-center justify-between text-xs opacity-70 mb-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="relative h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div 
            className={`absolute h-full transition-all ${isAgent ? 'bg-white/60' : 'bg-primary'}`}
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          />
        </div>
      </div>
    </div>
  );
}

// File Media Component
function MediaFile({ url, fileName, isAgent }: { url: string; fileName: string; isAgent: boolean }) {
  const getFileIcon = () => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext || '')) return <FileText className="w-5 h-5" />;
    if (['mp3', 'wav', 'ogg'].includes(ext || '')) return <Music className="w-5 h-5" />;
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return <ImageIcon className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
        isAgent 
          ? 'bg-white/10 hover:bg-white/20' 
          : 'bg-gray-700/50 hover:bg-gray-700'
      }`}
    >
      {getFileIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{fileName}</p>
        <p className="text-xs opacity-60">Click to download</p>
      </div>
      <Download className="w-4 h-4 opacity-60" />
    </a>
  );
}

// Sticker Media Component  
function MediaSticker({ url }: { url: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="w-24 h-24 bg-gray-700/30 rounded-lg flex items-center justify-center">
        <span className="text-2xl">🎨</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt="Sticker"
      className="w-32 h-32 object-contain"
      onError={() => setHasError(true)}
    />
  );
}

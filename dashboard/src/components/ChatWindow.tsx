// Chat Window component
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { usePermissions } from '../hooks/usePermissions';
import type { ElementType } from 'react';

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
  Pin,
  Eye,
  Volume2,
  VolumeX,
  Code,
  CheckCheck,
  CheckCircle2
} from 'lucide-react';
import {
  File as FileIcon,
  Languages,
} from 'lucide-react';
import type { ChatSession, Message, TypingEvent, ChatCategory } from '../types';
import AgentComposer from './AgentComposer';
import { TypingIndicator, TransferModal, BlockUserModal, CategorySelector, ReopenChatButton, SurveyDisplay } from './enterprise';
import MessageContextMenu from './MessageContextMenu';
import { EditMessageModal, DeleteMessageModal, SaveQuickReplyModal, AddNoteModal, TagSelectorModal, PinnedMessageConfirmationModal } from './MessageActionModals';
import { useMessageTranslation, TranslationBubble } from './translation/MessageTranslation';
import TranslationReportModal from './translation/TranslationReportModal';
import { updateSessionIncomingTranslation, getIncomingConfig } from '../services/translation.service';
import { DispositionModal } from './DispositionModal';
import { WhisperDisplay } from './chat/WhisperDisplay';
import ChatReplayModal from './ChatReplayModal';
import { useSupervisorStore } from '../stores/supervisorStore';
import { markWhisperAsRead as markWhisperReadApi } from '../services/socket';
import { usePlaybookStore } from '../stores/playbookStore';
import { formatFileSize, useFileDownload, useFileSize } from '../hooks/useFileSize';
import { set } from 'date-fns';

interface ChatWindowProps {
  session: ChatSession;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  targetMessageId?: string | null;
}

export default function ChatWindow({ session, onToggleSidebar, isSidebarOpen, targetMessageId }: ChatWindowProps) {
  const agent = useAuthStore((state) => state.agent);
  const { can } = usePermissions();

  // Permission checks for chat actions
  const canClose = can('chats.close');
  const canTransfer = can('chats.transfer');
  const canReopen = can('chats.reopen');

  const {
    messages,
    setMessages,
    prependMessages,
    isLoadingMessages,
    setLoadingMessages,
    isLoadingOlderMessages,
    setLoadingOlderMessages,
    hasMoreMessages,
    oldestMessageTimestamp,
    updateMessage,
    deleteMessage: removeMessage,
    pinnedMessages,
    setPinnedMessage,
    clearPinnedMessage
  } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);

  // Highlighted message state
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Flag to track initial load vs new messages
  const isInitialLoadRef = useRef(true);
  const shouldScrollToBottomRef = useRef(false);

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
  const [addNoteModal, setAddNoteModal] = useState<
    {
      userId: string;
      onComplete?: () => void;
    }
    | null>(null);
  const [closeChatModal, setCloseChatModal] = useState(false);
  const [closingChat, setClosingChat] = useState(false);
  const [playbookBlockModal, setPlaybookBlockModal] = useState<{ pendingSteps: string[]; playbookNames: string[] } | null>(null);
  const [tagSelectorModal, setTagSelectorModal] = useState<{ message: Message } | null>(null);
  const [pinnedMessageConfirmation, setPinnedMessageConfirmation] = useState<{ message: Message } | null>(null);

  // Translation hook
  const { translations: messageTranslations, loading: translationLoading, failed: translationFailed, translateMessage, retryTranslation, clearTranslation } = useMessageTranslation();
  const [showOriginalMap, setShowOriginalMap] = useState<Map<string, string>>(new Map());
  const [incomingTranslateEnabled, setIncomingTranslateEnabled] = useState<boolean | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [pinForUser, setPinForUser] = useState<boolean>(false);

  // Whispers from supervisor
  const { whispers, markWhisperAsRead: markWhisperReadStore } = useSupervisorStore();
  const sessionWhispers = whispers.filter(w => w.sessionId === session.sessionId);

  // Handle whisper read
  const handleWhisperRead = useCallback((whisperId: string) => {
    markWhisperReadApi(whisperId);
    markWhisperReadStore(whisperId);
  }, [markWhisperReadStore]);

  // Listen for "Ver original" events from context menu
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.messageId && detail?.originalContent) {
        setShowOriginalMap(prev => {
          const next = new Map(prev);
          if (next.has(detail.messageId)) {
            next.delete(detail.messageId);
          } else {
            next.set(detail.messageId, detail.originalContent);
          }
          return next;
        });
      }
    };
    window.addEventListener('translation:showOriginal', handler);
    return () => window.removeEventListener('translation:showOriginal', handler);
  }, []);

  // Load incoming translation status for quick toggle
  useEffect(() => {
    let cancelled = false;
    getIncomingConfig(session.sessionId)
      .then(cfg => { if (!cancelled) setIncomingTranslateEnabled(cfg.enabled); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, [session.sessionId]);

  // Join session room and load messages
  useEffect(() => {
    let isMounted = true;

    // Clear previous messages immediately to avoid showing stale data
    setMessages([], false, null);
    clearPinnedMessage(session.sessionId);

    // Mark as initial load
    isInitialLoadRef.current = true;
    shouldScrollToBottomRef.current = true;

    const loadSessionMessages = async () => {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/sessions/${session.sessionId}/messages?limit=20`, {
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
          setMessages(data.messages, data.hasMore, data.oldestTimestamp);
          // Load pinned message if exists
          if (data.pinnedMessage) {
            setPinnedMessage(session.sessionId, data.pinnedMessage);
          }

          // Schedule scroll to bottom after messages render
          shouldScrollToBottomRef.current = true;
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

  // Scroll to target message when messages are loaded
  useEffect(() => {
    if (targetMessageId && messages.length > 0 && !isLoadingMessages) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        const element = document.getElementById(`message-${targetMessageId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightedMessageId(targetMessageId);
          // Remove highlight after animation
          setTimeout(() => setHighlightedMessageId(null), 3000);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [targetMessageId, messages.length, isLoadingMessages]);

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

  // Scroll to bottom on initial load (instant) and new messages (smooth)
  const prevMessagesLengthRef = useRef(0);
  useEffect(() => {
    // Don't scroll when loading older messages (prepending)
    if (isLoadingOlderMessages) return;

    const container = messagesContainerRef.current;

    // Initial load: scroll instantly to bottom
    if (isInitialLoadRef.current && messages.length > 0 && !isLoadingMessages) {
      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
        isInitialLoadRef.current = false;
      });
      prevMessagesLengthRef.current = messages.length;
      return;
    }

    // New messages added at the end (not a prepend)
    if (messages.length > prevMessagesLengthRef.current && !isInitialLoadRef.current) {
      // Scroll immediately if user is near bottom — don't wait for next render
      if (container) {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
        if (isNearBottom) {
          requestAnimationFrame(() => {
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          });
        }
      }
    }

    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, isLoadingOlderMessages, isLoadingMessages]);

  // Maintain scroll position after loading older messages
  useEffect(() => {
    if (scrollPositionRef.current && messagesContainerRef.current && !isLoadingOlderMessages) {
      const { scrollHeight: prevScrollHeight, scrollTop: prevScrollTop } = scrollPositionRef.current;
      const newScrollHeight = messagesContainerRef.current.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeight;
      messagesContainerRef.current.scrollTop = prevScrollTop + scrollDiff;
      scrollPositionRef.current = null;
    }
  }, [messages, isLoadingOlderMessages]);

  // Load older messages when scrolling up (infinite scroll)
  const loadOlderMessages = useCallback(async () => {
    if (isLoadingOlderMessages || !hasMoreMessages || !oldestMessageTimestamp) return;

    // Save scroll position before loading
    if (messagesContainerRef.current) {
      scrollPositionRef.current = {
        scrollHeight: messagesContainerRef.current.scrollHeight,
        scrollTop: messagesContainerRef.current.scrollTop
      };
    }

    setLoadingOlderMessages(true);
    try {
      const res = await fetch(
        `/api/sessions/${session.sessionId}/messages?limit=30&before=${encodeURIComponent(oldestMessageTimestamp)}`,
        {
          headers: {
            Authorization: `Bearer ${useAuthStore.getState().token}`,
          },
        }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      if (data.ok && data.messages.length > 0) {
        prependMessages(data.messages, data.hasMore, data.oldestTimestamp);
      }
    } catch (error) {
      console.error('Failed to load older messages:', error);
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [session.sessionId, oldestMessageTimestamp, hasMoreMessages, isLoadingOlderMessages, prependMessages, setLoadingOlderMessages]);

  // Handle scroll event for infinite scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    // Load more when scrolled near top (within 100px)
    if (target.scrollTop < 100 && hasMoreMessages && !isLoadingOlderMessages) {
      loadOlderMessages();
    }
  }, [hasMoreMessages, isLoadingOlderMessages, loadOlderMessages]);

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
    setPinnedMessageConfirmation({ message });
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
    setAddNoteModal({ userId: session.user._id, onComplete: () => setCloseChatModal(true) });
    closeContextMenu();
  }, [closeContextMenu]);

  const handleNoteSave = useCallback(async (note: string) => {
    try {
      await fetch(`/api/users/${session.user._id}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${useAuthStore.getState().token}`,
        },
        body: JSON.stringify({ content: note, sessionId: session.sessionId }),
      });
      // updateMessage(sessionId, { internalNote: note });
    } catch (error) {
      console.error('Failed to save note:', error);
    } finally { setAddNoteModal(null); if (addNoteModal?.onComplete) addNoteModal.onComplete(); }
  }, [session?.user?._id, setAddNoteModal, addNoteModal]);

  const handleReportSpam = useCallback((message: Message) => {
    if (confirm('¿Reportar este mensaje como spam?')) {
      reportSpam(message._id, session.sessionId);
    }
    closeContextMenu();
  }, [session.sessionId, closeContextMenu]);

  // Translate a message from the context menu
  const handleTranslateMessage = useCallback((message: Message, targetLang: string) => {
    if (message.content) {
      translateMessage(message._id, message.content, targetLang, session.sessionId);
    }
    closeContextMenu();
  }, [session.sessionId, translateMessage, closeContextMenu]);

  // Disable incoming auto-translate for this chat from context menu
  const handleDisableIncomingTranslate = useCallback(async (message: Message) => {
    try {
      await updateSessionIncomingTranslation(session.sessionId, { incomingEnabled: false });
      toast.info('Auto-translate desactivado', 'La traducción entrante fue desactivada para este chat.');
    } catch {
      toast.error('Error', 'No se pudo desactivar el auto-translate.');
    }
    closeContextMenu();
  }, [session.sessionId, closeContextMenu]);

  // Report bad incoming translation
  const [reportModal, setReportModal] = useState<{ message: Message } | null>(null);
  const handleReportTranslation = useCallback((message: Message) => {
    setReportModal({ message });
    closeContextMenu();
  }, [closeContextMenu]);

  // Get pinned message for this session
  const pinnedMessage = pinnedMessages[session.sessionId];

  const handleAccept = () => {
    acceptSession(session.sessionId, (result: { ok: boolean; error?: string; data?: { code?: string; reason?: string; sessionClosed?: boolean } }) => {
      if (!result.ok) {
        console.error('Failed to accept session:', result.error);
        // Check if user blocked the bot
        if (result.data?.code === 'USER_BLOCKED') {
          toast.error('Chat no disponible', result.error || 'El usuario bloqueó el bot. El chat ha sido cerrado.', { duration: 8000 });
        } else {
          toast.error('Error', result.error || 'No se pudo aceptar la sesión', { duration: 5000 });
        }
      }
    });
  };

  /* Componente auxiliar pequeño para los botones de icono */
  const TooltipButton = ({ onClick, icon, label, danger }: any) => (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors group relative ${danger
        ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
        : 'text-gray-400 hover:text-zinc-50 hover:bg-gray-800'
        }`}
      title={label}
    >
      {icon}
    </button>
  );

  const handleClose = (disposition?: {
    categoryId: string;
    subcategoryId?: string;
    comment?: string;
    tags?: string[];
  }) => {
    setClosingChat(true);
    closeSession(session.sessionId, 'Agent closed conversation', disposition, (result: any) => {
      if (!result.ok) {
        setCloseChatModal(false);
        if (result.code === 'DISPOSITION_REQUIRED') {
          toast.error('Tipificación requerida', 'Debes completar la tipificación para cerrar el chat', { duration: 5000 });
        } else {
          toast.error('No se pudo cerrar la sesión', result.error || 'No se pudo cerrar la sesión', { duration: 5000 });
          // handleRuleError(result.data);
        }
      } else {
        setCloseChatModal(false);
        toast.success('Chat cerrado', 'La conversación ha sido cerrada correctamente');
      }
      setClosingChat(false);
    });
  };

  const handleRuleError = useCallback((data: {
    ruleId: string;
  }) => {
    const rule = data.ruleId; // Aquí podrías mapear el ID de la regla a un nombre más amigable si tienes esa información disponible
    switch (rule) {
      case "close_requires_note":
        setAddNoteModal({ userId: session.user._id, onComplete: () => setCloseChatModal(true) });
        break;

      default:
        break;
    }

  }, [session?.user?._id]);

  const [showReplay, setShowReplay] = useState(false);
  const isMySession = session.assignedAgent?._id === agent?._id;
  const isClosed = session.status === 'closed';
  const isAdmin = agent?.role === 'admin';
  const isSupervisor = agent?.role === 'supervisor';
  const isAuditMode = !isMySession && !isClosed && session.assignedAgent && (isAdmin || isSupervisor);

  const getCloseReasonLabel = () => {
    const labels: Record<string, string> = {
      manual: session.closedByType === 'agent' ? 'Cerrado por agente' : 'Cerrado por usuario',
      inactivity: 'Cerrado por inactividad',
      resolved: 'Marcado como resuelto',
      spam: 'Marcado como spam',
      system: session.closureReason ? session.closureReason : 'Cerrado por el sistema',
    };
    return (session as any).closureReason || labels[session.closeReason || 'manual'] || 'Conversación cerrada';
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
  // Helper: Simple Badge
  const Badge = ({ text, className = "" }: { text: string, icon?: boolean, className?: string }) => (
    <span className={`inline-flex items-center px-1.5 py-[1px] rounded text-[10px] font-medium bg-gray-800 text-gray-400 border border-gray-700/50 ${className}`}>
      {text}
    </span>
  );

  // Helper: Icon Button with Hover Effects
  const IconButton = ({ onClick, icon, tooltip, danger }: any) => (
    <button
      onClick={onClick}
      className={`
      p-2 rounded-lg transition-all duration-200 active:scale-95 relative group
      ${danger
          ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10'
          : 'text-gray-400 hover:text-zinc-50 hover:bg-white/5'
        }
    `}
      title={tooltip}
    >
      {icon}
    </button>
  );
  return (
    <div className="flex flex-col h-full">
      {/* Audit Mode Banner - Viewing another agent's chat */}
      {/* Audit Mode Banner - Premium Zinc */}
      {isAuditMode && (
        <div className="relative flex items-center justify-center px-4 py-2.5 bg-zinc-950/90 backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300 z-10 h-[56px]">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent pointer-events-none" />
          <div className="relative flex items-center gap-3 z-10">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-400 shadow-inner">
              <Eye className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Auditoría</span>
            </div>
            <span className="text-xs font-medium text-zinc-300">
              Supervisando sesión de <span className="text-purple-300 font-bold">{session.assignedAgent?.name || 'Agente'}</span>
            </span>
            <div className="w-px h-3 bg-zinc-700/50 mx-1" />
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </div>
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest drop-shadow-sm">
                En Vivo
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Closed Banner (Read Only Mode) */}
      {isClosed && (
        <div className="relative z-10 flex items-center justify-center w-full h-[56px] border-b border-zinc-800 bg-zinc-900/90 overflow-hidden">


          <div className="relative flex items-center gap-3 text-xs text-zinc-500">

            {/* Icon Badge */}
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 shadow-sm">
              <Lock className="w-3 h-3" />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-400 ">Solo Lectura</span>

              <span className="w-1 h-1 rounded-full bg-zinc-800" />

              <span className="text-zinc-500">
                Razón: <span className="text-zinc-400">{getCloseReasonLabel()}</span>
              </span>

              {session.closedAt && (
                <>
                  <span className="w-1 h-1 rounded-full bg-zinc-800" />
                  <span className="font-mono text-zinc-600">
                    {formatClosedDate()}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header Component - Fixed Height [56px] */}
      <div className={`
  relative z-20 flex items-center justify-between px-4 h-[56px] w-full
  border-b border-zinc-800/50 backdrop-blur-md transition-all duration-300
  ${isClosed ? 'bg-zinc-900/50 grayscale-[0.5]' : 'bg-zinc-900/90'}
`}>

        {/* --- LEFT: User Profile --- */}
        <div className="flex items-center gap-3.5 min-w-0 h-full overflow-hidden">

          {/* Avatar Container */}
          <div className="relative shrink-0">
            <div className={`
        w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-zinc-50 shadow-lg overflow-hidden
        ${session?.user?.isSubscriber
                ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-[2px]' // Borde gradiente
                : 'bg-zinc-800 ring-1 ring-white/10'
              }
      `}>
              <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center overflow-hidden relative">
                {session.user?.photoFileId ? (
                  <img
                    src={`/api/media/${session.user.photoFileId}`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-zinc-300 select-none">
                    {session.user?.firstName?.charAt(0)?.toUpperCase() ||
                      session.channelMetadata?.visitorName?.charAt(0)?.toUpperCase() ||
                      'V'}
                  </span>
                )}
              </div>
            </div>

            {/* Platform Indicator */}
            {session.channel === 'web' ? (
              <div className="absolute -bottom-0.5 -right-0.5 bg-indigo-500 rounded-full p-[3px] ring-2 ring-zinc-900 shadow-sm z-10">
                <svg className="w-2 h-2 text-zinc-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
            ) : (
              <div className="absolute -bottom-0.5 -right-0.5 bg-[#1d98dc] rounded-full p-[3px] ring-2 ring-zinc-900 shadow-sm z-10">
                <svg className="w-2 h-2 text-zinc-50" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
              </div>
            )}
          </div>

          {/* User Info Text */}
          <div className="flex flex-col justify-center gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-100 truncate max-w-[150px]">
                {session.user?.firstName
                  ? `${session.user.firstName} ${session.user.lastName || ''}`.trim()
                  : session.channelMetadata?.visitorName || 'Web Visitor'}
              </h3>
              {session.user?.isSubscriber && (
                <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-[9px] font-bold text-indigo-300uppercase">
                  PRO
                </span>
              )}
              {session.channel === 'web' && (
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-500/30 text-[9px] font-bold text-indigo-300">
                  WEB
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-zinc-500">
              {session.user?.username ? (
                <>
                  <span className="truncate hover:text-zinc-300 transition-colors">@{session.user.username}</span>
                  <span className="w-1 h-1 rounded-full bg-zinc-700" />
                  <span className="font-mono opacity-80">{session.user.language?.toUpperCase() || 'UNK'}</span>
                </>
              ) : session.channel === 'web' ? (
                <>
                  {session.channelMetadata?.visitorEmail && (
                    <>
                      <span className="truncate hover:text-zinc-300 transition-colors">{session.channelMetadata.visitorEmail}</span>
                      <span className="w-1 h-1 rounded-full bg-zinc-700" />
                    </>
                  )}
                  <span className="font-mono opacity-80 truncate max-w-[100px]" title={session.channelMetadata?.pageUrl}>
                    {session.channelMetadata?.browserName || session.channelMetadata?.device || 'Web'}
                  </span>
                </>
              ) : (
                <span className="font-mono opacity-80">Unknown</span>
              )}
            </div>
          </div>
        </div>

        {/* --- RIGHT: Actions Toolbar --- */}
        <div className="flex items-center gap-1">

          {/* GROUP 1: Primary Actions (Accept/Close/Reopen) - Premium Zinc */}
          <div className="flex items-center gap-2 mr-2 animate-in fade-in duration-300">

            {/* Accept Button */}
            {session.status === 'waiting' && (
              <button
                onClick={handleAccept}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Aceptar</span>
              </button>
            )}

            {/* Reopen Button */}
            {isClosed && canReopen && (
              <div className="animate-in zoom-in-95 duration-200">
                <ReopenChatButton
                  sessionId={session.sessionId}
                  reopenCount={(session as any).reopenCount || 0}
                />
              </div>
            )}

            {/* QA Replay Button */}
            {isClosed && (isAdmin || isSupervisor) && (
              <button
                onClick={() => setShowReplay(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:text-purple-300 text-xs font-bold rounded-lg transition-all hover:shadow-[0_0_12px_rgba(168,85,247,0.15)] active:scale-95"
                title="Reproducir conversación (QA)"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Replay</span>
              </button>
            )}

            {/* Close Session Button */}
            {session.status === 'human' && isMySession && canClose && (
              <button
                onClick={setCloseChatModal.bind(null, true)}
                className="group flex items-center gap-1.5 px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-red-500/10 hover:border-red-500/30 text-zinc-400 hover:text-red-400 text-xs font-bold rounded-lg transition-all shadow-sm active:scale-95"
                title="Finalizar sesión"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cerrar</span>
              </button>
            )}
          </div>

          {/* Separator */}
          <div className="h-5 w-px bg-zinc-800 mx-1 hidden sm:block" />

          {/* GROUP 2: Tools (Category, Transfer, Block) */}
          {session.status === 'human' && isMySession && (
            <div className="flex items-center gap-1">
              <CategorySelector
                sessionId={session.sessionId}
                currentCategory={(session as any).category}
                compact
              />

              {canTransfer && (
                <button onClick={() => setShowTransferModal(true)} className="p-2 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors" title="Transferir">
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              )}

              {/* Block button - solo para Telegram */}
              {session.user && (
                <button onClick={() => setShowBlockModal(true)} className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Bloquear">
                  <Ban className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Separator */}
          {(session.status === 'human' && isMySession) && <div className="h-5 w-px bg-zinc-800 mx-1 hidden sm:block" />}

          {/* GROUP 3: Utilities & Sidebar Toggle */}
          <div className="flex items-center gap-1">
            {/* Quick translation toggle */}
            {incomingTranslateEnabled !== null && (
              <button
                onClick={async () => {
                  const newVal = !incomingTranslateEnabled;
                  setIncomingTranslateEnabled(newVal);
                  try {
                    await updateSessionIncomingTranslation(session.sessionId, { incomingEnabled: newVal });
                    window.dispatchEvent(new CustomEvent('translation:sessionUpdated', { detail: { sessionId: session.sessionId } }));
                  } catch { setIncomingTranslateEnabled(!newVal); }
                }}
                className={`p-2 rounded-lg transition-all ${incomingTranslateEnabled
                  ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                title={incomingTranslateEnabled ? `Auto-traducción activa (click para desactivar)` : `Auto-traducción inactiva (click para activar)`}
              >
                <Languages className="w-4 h-4" />
              </button>
            )}
            {session.user?.username && (
              <a
                href={`https://t.me/${session.user.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-zinc-400 hover:text-[#229ED9] hover:bg-[#229ED9]/10 rounded-lg transition-colors"
                title="Abrir en Telegram"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}

            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className={`p-2 rounded-lg transition-all ${isSidebarOpen
                  ? 'text-indigo-400 bg-indigo-500/10'
                  : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800'
                  }`}
                title={isSidebarOpen ? 'Ocultar detalles' : 'Ver info del usuario'}
              >
                {isSidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-5 bg-zinc-950 scrollbar-hover"
      >
        {/* Load More Indicator */}
        {hasMoreMessages && (
          <div className="flex justify-center py-2">
            {isLoadingOlderMessages ? (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Cargando mensajes anteriores...</span>
              </div>
            ) : (
              <button
                onClick={loadOlderMessages}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-full bg-gray-800/50 hover:bg-gray-800"
              >
                Cargar mensajes anteriores
              </button>
            )}
          </div>
        )}

        {/* Pinned Message Bar */}
        {pinnedMessage && (
          <div className="sticky top-2 z-10">
            <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 backdrop-blur border border-primary/30 rounded-xl shadow-sm">
              <Pin className="w-4 h-4 text-primary shrink-0" />

              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-50 font-medium truncate">
                  {pinnedMessage.content}
                </p>
                <p className="text-xs text-gray-400">
                  {pinnedMessage.senderAgent?.name || pinnedMessage.sender}
                </p>
              </div>

              <button
                onClick={() => handleUnpin(pinnedMessage)}
                className="p-1.5 rounded-md text-gray-400 hover:text-zinc-50 hover:bg-white/10 transition"
                title="Desfijar mensaje"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Whispers from Supervisor */}
        {sessionWhispers.length > 0 && (
          <div className="space-y-2">
            <WhisperDisplay
              sessionId={session.sessionId}
              whispers={sessionWhispers.map(w => ({
                _id: w.id,
                sessionId: w.sessionId,
                fromSupervisor: {
                  _id: w.supervisorId,
                  name: w.supervisorName,
                },
                message: w.content,
                isRead: w.isRead,
                createdAt: w.createdAt.toString(),
              }))}
              onMarkAsRead={handleWhisperRead}
            />
          </div>
        )}

        {/* Loading / Empty / Messages */}
        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="text-sm">Cargando mensajes…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-1 select-none">
            <span className="text-sm">Aún no hay mensajes</span>
            <span className="text-xs text-gray-600">
              Inicia la conversación cuando quieras
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, index) => {
              const prev = messages[index - 1];
              const showDate =
                !prev ||
                new Date(prev.createdAt).toDateString() !==
                new Date(msg.createdAt).toDateString();

              return (
                <React.Fragment key={msg._id}>
                  {showDate && <DateSeparator date={new Date(msg.createdAt)} />}
                  <MessageBubble
                    message={msg}
                    onContextMenu={(e) => handleMessageClick(msg, e)}
                    isPinned={pinnedMessage?._id === msg._id}
                    isHighlighted={highlightedMessageId === msg._id}
                    session={session}
                  />
                  {/* Inline Translation Bubble */}
                  {messageTranslations.has(msg._id) && (
                    <div className={`px-4 ${msg.sender === 'user' ? 'pr-16' : 'pl-16'}`}>
                      <TranslationBubble
                        translatedText={messageTranslations.get(msg._id)!.text}
                        detectedLang={messageTranslations.get(msg._id)!.detectedLang}
                        targetLang={messageTranslations.get(msg._id)!.targetLang}
                        provider={messageTranslations.get(msg._id)!.provider}
                        latencyMs={messageTranslations.get(msg._id)!.latencyMs}
                        onClose={() => clearTranslation(msg._id)}
                      />
                    </div>
                  )}
                  {translationLoading.has(msg._id) && (
                    <div className={`px-4 ${msg.sender === 'user' ? 'pr-16' : 'pl-16'}`}>
                      <div className="mt-1 flex items-center gap-2 text-xs text-indigo-400/60 animate-pulse">
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.416" strokeDashoffset="10.472" /></svg>
                        Traduciendo…
                      </div>
                    </div>
                  )}
                  {/* Retry failed translation */}
                  {translationFailed.has(msg._id) && !translationLoading.has(msg._id) && (
                    <div className={`px-4 ${msg.sender === 'user' ? 'pr-16' : 'pl-16'}`}>
                      <div className="mt-1 flex items-center gap-2 text-xs text-red-400/70">
                        <AlertCircle className="w-3 h-3" />
                        <span>Traducción falló</span>
                        <button onClick={() => retryTranslation(msg._id)} className="text-indigo-400 hover:text-indigo-300 underline font-bold">Reintentar</button>
                      </div>
                    </div>
                  )}
                  {/* Show original content for auto-translated messages */}
                  {showOriginalMap.has(msg._id) && (
                    <div className={`px-4 ${msg.sender === 'agent' ? 'pl-16' : 'pr-16'}`}>
                      <div className="mt-1 p-3 bg-zinc-800/60 backdrop-blur-sm border border-zinc-700/50 rounded-xl text-sm relative">
                        <div className="flex items-center gap-1.5 mb-1.5 text-[10px] text-zinc-400 font-bold uppercase ">
                          <Eye className="w-3 h-3" />
                          Original
                          <button
                            onClick={() => setShowOriginalMap(prev => {
                              const next = new Map(prev);
                              next.delete(msg._id);
                              return next;
                            })}
                            className="ml-auto text-zinc-500 hover:text-zinc-300 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-zinc-300 whitespace-pre-wrap break-words">{showOriginalMap.get(msg._id)}</p>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

          </div>
        )}
        {/* Typing Indicator */}
        {isUserTyping && (
          <div className="pt-1">
            <TypingIndicator name={session.user?.firstName || session.channelMetadata?.visitorName || 'Visitante'} />
          </div>
        )}

        {/* Survey for closed sessions */}
        {isClosed && survey && (
          <div className="mt-6">
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
          onRequestClose={async () => {
            // Check playbook validation before allowing close
            try {
              const validation = await usePlaybookStore.getState().validateClose(session.sessionId);
              if (validation && !validation.canClose) {
                setPlaybookBlockModal({
                  pendingSteps: validation.pendingCriticalSteps?.map((s: any) => s.label || s.stepId) || [],
                  playbookNames: validation.mandatoryPlaybooks?.map((p: any) => p.name || p) || [],
                });
                return;
              }
            } catch { /* if validation fails, allow close anyway */ }
            setCloseChatModal(true);
          }}
        />
      ) : session.status === 'waiting' ? (
        <div className="p-4 border-t border-amber-700/50 bg-amber-500/10 text-center">
          <p className="text-amber-500 text-sm">
            <Clock className="w-4 h-4 inline-block mr-2" />
            This session is waiting for an agent. Click "Accept" to start chatting.
          </p>
        </div>
      ) : session.status === 'human' && !isMySession ? (
        <div className="p-4 border-t text-center border-zinc-800 bg-zinc-900/50">
          <p className="text-gray-500 text-sm">
            <Headphones className="w-4 h-4 inline-block mr-2" />
            This session is assigned to {session.assignedAgent?.name}
          </p>
        </div>
      ) : isClosed ? (
        <div className="p-4 border-t border-zinc-800/50 bg-zinc-900/50 grayscale-[0.5] text-center">
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

      {session.user && (
        <BlockUserModal
          isOpen={showBlockModal}
          onClose={() => setShowBlockModal(false)}
          telegramId={session.user.telegramId}
          username={session.user.username}
          firstName={session.user.firstName}
        />
      )}

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
          onTranslate={handleTranslateMessage}
          onDisableIncomingTranslate={handleDisableIncomingTranslate}
          onReportTranslation={handleReportTranslation}
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

      {pinnedMessageConfirmation && (
        <PinnedMessageConfirmationModal
          isOpen={true}
          message={pinnedMessageConfirmation.message}
          pinForUser={pinForUser}
          onPinForUserChange={setPinForUser}
          onCancel={() => setPinnedMessageConfirmation(null)}
          onConfirm={() => {
            pinMessage(pinnedMessageConfirmation.message._id, session.sessionId, pinForUser, (result) => {
              if (result.ok) {
                setPinnedMessage(session.sessionId, pinnedMessageConfirmation.message);
              }
            });
            setPinnedMessageConfirmation(null);
          }}
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
          onSave={(note) => handleNoteSave(note)}
        />
      )}

      {/* Chat Replay Modal */}
      <ChatReplayModal
        session={session}
        isOpen={showReplay}
        onClose={() => setShowReplay(false)}
      />

      {/* Translation Report Modal */}
      {reportModal && (
        <TranslationReportModal
          isOpen={true}
          message={reportModal.message}
          session={session}
          onClose={() => setReportModal(null)}
        />
      )}

      {
        closeChatModal && (
          <DispositionModal
            isOpen={true}
            onClose={() => setCloseChatModal(false)}
            onConfirm={handleClose}
            sessionId={session.sessionId}
            contactName={session.user?.firstName || session.user?.username || 'Usuario'}
            isLoading={closingChat}
          />
        )
      }

      {/* Playbook Block Modal — prevents close when mandatory playbooks incomplete */}
      {playbookBlockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPlaybookBlockModal(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/10 rounded-xl"><AlertCircle className="w-5 h-5 text-amber-400" /></div>
              <h3 className="text-lg font-bold text-zinc-100">Playbook Incompleto</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-3">No puedes cerrar este chat hasta completar los pasos críticos del playbook.</p>
            {playbookBlockModal.playbookNames.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-zinc-500 mb-1">Playbooks pendientes:</p>
                <ul className="space-y-1">
                  {playbookBlockModal.playbookNames.map((name, i) => (
                    <li key={i} className="text-xs text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">• {name}</li>
                  ))}
                </ul>
              </div>
            )}
            {playbookBlockModal.pendingSteps.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-zinc-500 mb-1">Pasos críticos pendientes:</p>
                <ul className="space-y-1">
                  {playbookBlockModal.pendingSteps.map((step, i) => (
                    <li key={i} className="text-xs text-red-300 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">• {step}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => setPlaybookBlockModal(null)} className="px-4 py-2 text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all">Entendido</button>
            </div>
          </div>
        </div>
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
  isHighlighted?: boolean;
  session: ChatSession;
}

function DateSeparator({ date }: { date: Date }) {
  const label = date.toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="flex justify-center my-4 sticky top-1 z-[1]">
      <span className="px-4 py-1 text-xs font-medium rounded-full text-gray-400 backdrop-blur border border-zinc-700/70 min-w-[200px] text-center bg-zinc-900/70">
        {label}
      </span>
    </div>
  );
}


function MessageBubble({
  message,
  onContextMenu,
  isPinned,
  isHighlighted,
  session,
}: MessageBubbleProps) {
  const isAgent = message.sender === 'agent';
  const isBot = message.sender === 'bot';
  const isSystem = message.messageType === 'system';

  /* ───────── SYSTEM MESSAGE ───────── */
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="px-4 py-1.5 text-xs rounded-full bg-zinc-800/70 text-gray-500 backdrop-blur">
          {message.content}
        </span>
      </div>
    );
  }

  /* ───────── MEDIA HELPERS ───────── */
  const getProxyMediaUrl = (mediaRef?: string) => {
    if (!mediaRef) return;
    if (
      mediaRef.startsWith('/api/media/') ||
      mediaRef.startsWith('/api/download/') ||
      mediaRef.startsWith('/uploads/')
    ) {
      return mediaRef;
    }
    if (mediaRef.startsWith('http')) {
      const match = mediaRef.match(/api\.telegram\.org\/file\/bot[^/]+\/(.+)$/);
      return match ? `/api/media/${match[1]}` : mediaRef;
    }
    return `/api/media/${encodeURIComponent(mediaRef)}`;
  };

  const renderMediaContent = () => {
    const mediaUrl = getProxyMediaUrl(message.mediaUrl);
    if (!mediaUrl) {
      return (
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>
      );
    }

    switch (message.messageType) {
      case 'image':
        return <MediaImage url={mediaUrl} alt={message.content} isAgent={isAgent} />;
      case 'audio':
      case 'voice':
        return <MediaAudio url={mediaUrl} title={message.content} isAgent={isAgent} />;
      case 'file':
      case 'document':
        return (
          <MediaFile
            url={mediaUrl}
            fileName={message.fileName || message.content}
            isAgent={isAgent}
          />
        );
      case 'sticker':
        return <MediaSticker url={mediaUrl} />;
      default:
        return null;
    }
  };

  return (
    <div
      id={`message-${message._id}`}
      className={`flex ${isAgent ? 'justify-end' : 'justify-start'} group`}
    >
      <div
        className={`flex items-end gap-2 max-w-[72%] ${isAgent ? 'flex-row-reverse' : ''
          }`}
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm overflow-hidden bg-gray-700 shrink-0">
          {isAgent ? (
            message.senderAgent?.avatar ? (
              <img
                src={message.senderAgent.avatar}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold text-zinc-50">
                {message.senderAgent?.name?.[0]?.toUpperCase()}
              </span>
            )
          ) : isBot ? (
            <Bot className="w-4 h-4 text-zinc-50" />
          ) : session.user?.photoFileId ? (
            <img
              src={`/api/media/${session.user.photoFileId}`}
              className="w-full h-full object-cover"
            />
          ) : session.channelMetadata?.visitorName ? (
            <span className="text-xs font-semibold text-zinc-50">
              {session.channelMetadata.visitorName.charAt(0).toUpperCase()}
            </span>
          ) : (
            <User className="w-4 h-4 text-zinc-50" />
          )}
        </div>

        {/* Bubble */}
        <div
          onContextMenu={onContextMenu}
          className={`
            relative px-4 py-2.5 rounded-2xl transition
            ${isAgent
              ? 'bg-primary text-zinc-50 rounded-br-md'
              : 'bg-primary/40 text-zinc-50 rounded-bl-md'}
            ${isPinned ? 'ring-2 ring-primary/40' : ''}
            ${isHighlighted ? 'ring-2 ring-primary shadow-lg' : ''}
            hover:shadow-md
          `}
        >
          {/* Sender name */}
          {message.senderAgent && (
            <p className="text-xs font-medium opacity-70 mb-1">
              {message.senderAgent.name}
            </p>
          )}

          {/* Reply */}
          {message.replyToMessage && (
            <div className={`mb-2 rounded-lg overflow-hidden border-l-4 ${isAgent
                ? 'border-white/40 bg-white/10'
                : 'border-primary bg-primary/15'
              }`}>
              <div className="px-2.5 py-1.5">
                <p className={`text-[11px] font-semibold mb-0.5 ${isAgent ? 'text-white/80' : 'text-primary'
                  }`}>
                  {message.replyToMessage.sender === 'user'
                    ? 'Usuario'
                    : message.replyToMessage.senderAgent?.name || 'Agente'}
                </p>
                <p className="text-xs text-zinc-300 truncate leading-relaxed">
                  {message.replyToMessage.content}
                </p>
              </div>
            </div>
          )}

          {/* Content */}
          {renderMediaContent()}

          {/* Incoming auto-translation (inline in bubble) */}
          {!isAgent && message.incomingTranslation?.translatedContent && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words text-zinc-100">
                {message.incomingTranslation.translatedContent}
              </p>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-cyan-400/50 font-medium">
                <Languages className="w-2.5 h-2.5" />
                <span>{message.incomingTranslation.sourceLang} → {message.incomingTranslation.targetLang}</span>
                {message.incomingTranslation.cached && (
                  <span className="px-1 py-0 bg-cyan-500/10 rounded text-[9px]">cache</span>
                )}
                <span className="ml-auto text-[9px] text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {message.incomingTranslation.provider} · {message.incomingTranslation.latencyMs}ms
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 mt-1 text-[11px] opacity-60">
            <span>
              {new Date(message.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {(message as any).isEdited && <span>(editado)</span>}
            {isAgent && <CheckCheck className="w-3 h-3 opacity-80" />}

            {isPinned && <Pin className="w-3 h-3" />}
          </div>

          {/* Auto-translated indicator */}
          {message.translation?.isTranslated && isAgent && (
            <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-white/10 text-[10px] text-yellow-400/80 font-medium">
              <Languages className="w-3 h-3" />
              <span>Auto-traducido · {message.translation.sourceLang} → {message.translation.targetLang}</span>
            </div>
          )}


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
          className={`max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${isLoading ? 'hidden' : 'block'
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
          style={
            {
              zIndex: 9999
            }
          }
          className="fixed inset-0 bg-black/90 flex items-center justify-center p-4"
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
            href={`${url}?download=true`}
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

function MediaAudio({
  url,
  title,
  isAgent,
}: {
  url: string;
  title?: string;
  isAgent: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  /* ───────── PLAY / PAUSE + AUTO PAUSE ───────── */
  const togglePlay = async () => {
    if (!audioRef.current) return;

    try {
      if (!isPlaying) {
        registerAudio(audioRef.current);
        await audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
      setIsPlaying(!isPlaying);
    } catch {
      setHasError(true);
    }
  };

  /* ───────── VOLUME CONTROL ───────── */
  const changeVolume = (v: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = v;
    audioRef.current.muted = v === 0;
    setVolume(v);
    setIsMuted(v === 0);
  };

  const toggleMute = () => changeVolume(isMuted ? 0.8 : 0);

  /* ───────── SEEK ───────── */
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * duration;
  };

  const formatTime = (t: number) => {
    if (!isFinite(t) || isNaN(t) || t < 0) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  /* ───────── WAVE ANIMATION ───────── */
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      barsRef.current.forEach(bar => {
        if (!bar) return;
        bar.style.height = `${20 + Math.random() * 80}%`;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying]);

  if (hasError) {
    return (
      <div className="flex items-center gap-2 text-sm opacity-70">
        <Mic className="w-4 h-4" />
        <span>Error al cargar audio</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-xl min-w-[280px]
        ${isAgent ? 'bg-white/10' : 'bg-primary/10'}
      `}
    >
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          setIsLoading(false);
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setHasError(true)}
      />

      {/* ▶ Play */}
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={`w-10 h-10 rounded-full flex items-center justify-center
          ${isAgent ? 'bg-white/20' : 'bg-primary text-zinc-50'}
        `}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </button>

      {/* 🌊 Waveform */}
      <div className="flex items-end gap-[2px] h-8 w-20">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            ref={(el) => {
              if (el) barsRef.current[i] = el;
            }}
            className={`w-[3px] rounded-full transition-all duration-150
              ${isAgent ? 'bg-white/60' : 'bg-primary'}
            `}
            style={{ height: '30%' }}
          />
        ))}
      </div>

      {/* ⏱ Time + Seek */}
      <div className="flex-1">
        <div
          onClick={seek}
          className="h-2 rounded-full bg-white/20 cursor-pointer overflow-hidden"
        >
          <div
            className={`${isAgent ? 'bg-white/70' : 'bg-primary'} h-full`}
            style={{
              width: duration ? `${(currentTime / duration) * 100}%` : '0%',
            }}
          />
        </div>
        <div className="flex justify-between text-[11px] opacity-70 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* 🎚 Controls */}
      <div className="flex items-center gap-2">
        <button onClick={toggleMute}>
          {isMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => changeVolume(Number(e.target.value))}
          className="w-16 accent-primary"
        />

        {/* ⬇ Download */}
        <a
          href={url}
          download
          className="p-1.5 rounded-md hover:bg-white/10 transition"
          title="Descargar audio"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
let currentPlayingAudio: HTMLAudioElement | null = null;

function registerAudio(audio: HTMLAudioElement) {
  if (currentPlayingAudio && currentPlayingAudio !== audio) {
    currentPlayingAudio.pause();
  }
  currentPlayingAudio = audio;
}

function FilePreviewModal({
  url,
  type,
  onClose,
}: {
  url: string;
  type: 'image' | 'pdf';
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20"
      >
        <X className="w-5 h-5 text-zinc-50" />
      </button>

      {type === 'image' ? (
        <img
          src={url}
          className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-xl"
        />
      ) : (
        <iframe
          src={url}
          className="w-[90vw] h-[90vh] rounded-lg bg-white"
        />
      )}
    </div>
  );
}

function MediaFile({
  url,
  fileName,
  isAgent,
}: {
  url: string;
  fileName: string;
  isAgent: boolean;
}) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
  const isPdf = ext === 'pdf';
  const isJson = ext === 'json';
  const isText = ['txt', 'md', 'csv', 'log'].includes(ext || '');

  const { download, progress, isDownloading } = useFileDownload(url);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { size, loading: sizeLoading } = useFileSize(url);

  const getMeta = (): {
    icon: ElementType;
    color: string;
    label: string;
  } => {
    if (isImage)
      return { icon: ImageIcon, color: 'text-blue-400', label: 'Imagen' };

    if (isPdf)
      return { icon: FileText, color: 'text-red-400', label: 'PDF' };

    if (['zip', 'rar', '7z'].includes(ext || ''))
      return { icon: Archive, color: 'text-yellow-400', label: 'ZIP' };

    if (isJson)
      return { icon: Code, color: 'text-green-400', label: 'JSON' };

    if (isText)
      return { icon: FileText, color: 'text-gray-400', label: 'Texto' };


    return { icon: FileIcon, color: 'text-gray-400', label: 'Archivo' };
  };


  const { icon: Icon, color, label } = getMeta();

  return (
    <>
      <div
        className={`relative group flex items-center gap-3 px-3 py-2.5 rounded-xl transition
          ${isAgent ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-800 hover:bg-gray-700'}
        `}
      >
        {/* Icon */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-black/20 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          <p className="text-xs opacity-60 flex items-center gap-1">
            {label}
            {!sizeLoading && size !== null && (
              <span>• {formatFileSize(size)}</span>
            )}
          </p>

          {isDownloading && (
            <div className="mt-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          {(isImage || isPdf) && (
            <button
              onClick={() => setPreviewOpen(true)}
              className="p-1.5 rounded-md hover:bg-white/10"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => download(fileName)}
            className="p-1.5 rounded-md hover:bg-white/10"
            title="Descargar"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {previewOpen && (
        <FilePreviewModal
          url={url}
          type={isImage ? 'image' : 'pdf'}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
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


// Agent Composer - Full-featured message composer for support agents
// Features: Text, Images, Files, Audio recording, Quick replies, Save as reply, Schedule messages
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
  type DragEvent
} from 'react';
import {
  Send,
  SendHorizontal,
  Smile,
  Image as ImageIcon, // Renombrado para evitar conflicto con el constructor Image nativo
  Paperclip,
  Mic,
  Bookmark,
  Loader2,
  Check,
  AlertCircle,
  X,
  XCircle, // Nuevo icono añadido para cerrar ticket
  Zap,
  FileText,
  Trash2,
  Upload,
  Clock,
  Lock,
  Tag,
  Globe,
  Languages,
  Eye
} from 'lucide-react';

// Tus imports originales intactos
import { useAuthStore } from '../stores/authStore';
import { usePermissions } from '../hooks/usePermissions';
import {
  sendMessage,
  sendImage,
  sendFile,
  sendVoice,
  startTyping,
  stopTyping
} from '../services/socket';
import type { SavedReply, ChatSession } from '../types';
import EmojiPicker from './EmojiPicker';
import SaveReplyModal from './SaveReplyModal';
import AudioRecorder from './AudioRecorder';
import { ScheduleMessageModal } from './scheduled';
import TranslateDropdown from './translation/TranslateDropdown';
import {
  getOutgoingConfig,
  previewOutgoingTranslation,
  updateSessionTranslation,
  type OutgoingConfig,
} from '../services/translation.service';

// Types originales
type SendStatus = 'idle' | 'sending' | 'sent' | 'error';
type UploadType = 'image' | 'file' | 'audio';

interface UploadProgress {
  type: UploadType;
  filename: string;
  progress: number;
  preview?: string;
}

interface AgentComposerProps {
  session: ChatSession;
  disabled?: boolean;
  placeholder?: string;
  replyTo?: { _id: string; sender: string; senderAgent?: { name: string }; content: string } | null;
  onCancelReply?: () => void;
  onRequestClose?: () => void; // Callback to request closing with disposition modal
}

// Constantes originales
const PLACEHOLDERS = [
  { key: '{agentName}', description: 'Tu nombre de agente' },
  { key: '{userName}', description: 'Nombre del usuario' },
  { key: '{userUsername}', description: 'Username de Telegram' },
  { key: '{chatId}', description: 'ID del chat' },
  { key: '{sessionId}', description: 'ID de la sesión' },
  { key: '{date}', description: 'Fecha actual (YYYY-MM-DD)' },
  { key: '{time}', description: 'Hora actual (HH:MM)' },
];

function replacePlaceholders(
  content: string,
  context: {
    agentName: string;
    userName: string;
    userUsername?: string;
    chatId: string;
    sessionId: string;
  }
): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0, 5);

  let result = content;
  result = result.replace(/\{agentName\}/g, context.agentName);
  result = result.replace(/\{userName\}/g, context.userName);
  result = result.replace(/\{userUsername\}/g, context.userUsername ? `@${context.userUsername}` : 'N/A');
  result = result.replace(/\{chatId\}/g, context.chatId);
  result = result.replace(/\{sessionId\}/g, context.sessionId);
  result = result.replace(/\{date\}/g, dateStr);
  result = result.replace(/\{time\}/g, timeStr);

  return result;
}

export default function AgentComposer({
  session,
  disabled = false,
  placeholder = 'Escribe un mensaje o usa / para respuestas rápidas…',
  replyTo,
  onCancelReply,
  onRequestClose
}: AgentComposerProps) {
  const agent = useAuthStore((state) => state.agent);
  const token = useAuthStore((state) => state.token);
  const { can } = usePermissions();

  // Permission checks
  const canRespond = can('chats.respond');
  const canClose = can('chats.close');

  // State original
  const [message, setMessage] = useState('');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [filteredReplies, setFilteredReplies] = useState<SavedReply[]>([]);
  const [selectedReplyIndex, setSelectedReplyIndex] = useState(0);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; file: File } | null>(null);
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string; size: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // State NUEVO solo para UI (foco del borde)
  const [isFocused, setIsFocused] = useState(false);

  // === Auto-Translate Outgoing State ===
  const [outgoingConfig, setOutgoingConfig] = useState<OutgoingConfig | null>(null);
  const [translationPreview, setTranslationPreview] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [showTranslationPreview, setShowTranslationPreview] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs originales
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // ============= EFFECTS (Tus efectos originales) =============

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${Math.max(newHeight, 56)}px`; // Ajustado mínimo para UI nueva
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  useEffect(() => {
    loadSavedReplies();
  }, []);

  useEffect(() => {
    const shouldShow = message.startsWith('/') && !message.includes(' ');
    setShowQuickReplies(shouldShow);

    if (shouldShow) {
      const query = message.slice(1).toLowerCase();
      const filtered = savedReplies.filter(r =>
        r.title.toLowerCase().includes(query) ||
        r.content.toLowerCase().includes(query) ||
        (r.shortcut?.toLowerCase().includes(query)) ||
        (r.category?.toLowerCase().includes(query))
      ).slice(0, 8);
      setFilteredReplies(filtered);
      setSelectedReplyIndex(0);
    }
  }, [message, savedReplies]);

  useEffect(() => {
    if (sendStatus === 'sent' || sendStatus === 'error') {
      const timer = setTimeout(() => setSendStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [sendStatus]);

  // Auto-focus textarea when session changes or component mounts
  useEffect(() => {
    if (!disabled) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [session.sessionId, disabled]);

  // Listen for playbook:insertText events to inject template text into the composer
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent).detail?.text;
      if (typeof text === 'string' && text) {
        setMessage(prev => prev ? prev + '\n' + text : text);
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    };
    window.addEventListener('playbook:insertText', handler);
    return () => window.removeEventListener('playbook:insertText', handler);
  }, []);

  // ─── Load outgoing translation config when session changes ───
  useEffect(() => {
    let cancelled = false;
    setOutgoingConfig(null);
    setTranslationPreview(null);
    setShowTranslationPreview(false);
    getOutgoingConfig(session.sessionId)
      .then(cfg => { if (!cancelled) setOutgoingConfig(cfg); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [session.sessionId]);

  // ─── Debounced translation preview ───
  useEffect(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);

    if (!outgoingConfig?.enabled || !outgoingConfig.showPreview || !message.trim() || !showTranslationPreview) {
      setTranslationPreview(null);
      return;
    }

    setIsPreviewLoading(true);
    previewTimerRef.current = setTimeout(async () => {
      try {
        const result = await previewOutgoingTranslation(message.trim(), session.sessionId);
        if (result.shouldTranslate) {
          setTranslationPreview(result.translatedContent);
        } else {
          setTranslationPreview(null);
        }
      } catch {
        setTranslationPreview(null);
      }
      setIsPreviewLoading(false);
    }, 800);

    return () => { if (previewTimerRef.current) clearTimeout(previewTimerRef.current); };
  }, [message, outgoingConfig?.enabled, outgoingConfig?.showPreview, showTranslationPreview, session.sessionId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowQuickReplies(false);
        // setShowEmojiPicker(false); // Comentado para permitir click en el picker si está fuera
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (message.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        startTyping(session.sessionId);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          stopTyping(session.sessionId);
        }
      }, 2000);
    } else {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        stopTyping(session.sessionId);
      }
    }
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, session.sessionId]);

  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        stopTyping(session.sessionId);
      }
    };
  }, [session.sessionId]);

  // ============= FUNCTIONS (Tu lógica original) =============

  const scrollToBottom = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth' // Esto hace la transición fluida
      });
    }
  };

  const loadSavedReplies = async () => {
    setIsLoadingReplies(true);
    try {
      const res = await fetch('/api/saved-replies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSavedReplies(data.replies.filter((r: SavedReply) => r.isActive));
      }
    } catch (error) {
      console.error('Failed to load saved replies:', error);
    } finally {
      setIsLoadingReplies(false);
    }
  };

  const getPlaceholderContext = () => ({
    agentName: agent?.name || 'Agent',
    userName: session.user?.firstName,
    userUsername: session.user?.username,
    chatId: session.user?.telegramId?.toString?.(),
    sessionId: session.sessionId,
  });

  const handleSend = async (closeAfter = false) => {
    if (!message.trim() || sendStatus === 'sending') return;

    // Si quiere cerrar pero no tiene permiso, solo enviar sin cerrar
    const shouldClose = closeAfter && canClose && onRequestClose;

    const processedMessage = replacePlaceholders(message.trim(), getPlaceholderContext());

    setSendStatus('sending');

    sendMessage(
      session.sessionId,
      processedMessage,
      { replyToMessageId: replyTo?._id },
      (result) => {
        if (result.ok) {
          setMessage('');
          setSendStatus('sent');
          onCancelReply?.();
          // Re-focus textarea after sending
          setTimeout(() => { textareaRef.current?.focus(); scrollToBottom(); scrollToBottom(); }, 50);
          // Request close via disposition modal (parent handles the modal)
          if (shouldClose) {
            onRequestClose();
          }

        } else {
          setSendStatus('error');
        }
      }
    );
  };

  const uploadFile = async (file: File, type: UploadType): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);

    setUploadProgress({ type, filename: file.name, progress: 0 });

    try {
      const endpoint = type === 'image' ? '/api/upload/image'
        : type === 'audio' ? '/api/upload/audio'
          : '/api/upload/file';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      setUploadProgress(prev => prev ? { ...prev, progress: 100 } : null);

      const data = await res.json();

      setTimeout(() => setUploadProgress(null), 500);

      if (data.ok) {
        return data.url;
      }

      console.error('Upload failed:', data.error);
      return null;
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress(null);
      return null;
    }
  };

  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage({ url: reader.result as string, file });
    };
    reader.readAsDataURL(file);

    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleSendImage = async () => {
    if (!previewImage) return;

    setSendStatus('sending');

    const url = await uploadFile(previewImage.file, 'image');

    if (url) {
      sendImage(session.sessionId, url, message.trim() || undefined, (result) => {
        if (result.ok) {
          setPreviewImage(null);
          setMessage('');
          setSendStatus('sent');
        } else {
          setSendStatus('error');
        }
      });
    } else {
      setSendStatus('error');
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert('El archivo es demasiado grande. Máximo 50MB');
      return;
    }

    setSendStatus('sending');

    const url = await uploadFile(file, 'file');

    if (url) {
      setPendingFile({ url, name: file.name, size: file.size });
      setSendStatus('idle');
    } else {
      setSendStatus('error');
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendFile = () => {
    if (!pendingFile) return;

    setSendStatus('sending');

    sendFile(session.sessionId, pendingFile.url, pendingFile.name, message.trim() || undefined, (result) => {
      if (result.ok) {
        setPendingFile(null);
        setMessage('');
        setSendStatus('sent');
      } else {
        setSendStatus('error');
      }
    });
  };

  const handleAudioComplete = async (audioBlob: Blob) => {
    setShowAudioRecorder(false);
    setSendStatus('sending');

    const file = new File([audioBlob], `voice-${Date.now()}.ogg`, { type: audioBlob.type });

    const url = await uploadFile(file, 'audio');

    if (url) {
      sendVoice(session.sessionId, url, (result) => {
        if (result.ok) {
          setSendStatus('sent');
        } else {
          setSendStatus('error');
        }
      });
    } else {
      setSendStatus('error');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showQuickReplies) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedReplyIndex(prev => Math.min(prev + 1, filteredReplies.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedReplyIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && filteredReplies.length > 0) {
        e.preventDefault();
        selectQuickReply(filteredReplies[selectedReplyIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowQuickReplies(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      if (e.shiftKey) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSend(true);
        return;
      }
      e.preventDefault();
      handleSend(false);
    }
  };

  const selectQuickReply = (reply: SavedReply) => {
    setMessage(reply.content);
    setShowQuickReplies(false);
    textareaRef.current?.focus();

    fetch(`/api/saved-replies/${reply._id}/use`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => { });
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newMessage);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
        textarea.focus();
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  const insertPlaceholder = (placeholderKey: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + placeholderKey + message.slice(end);
      setMessage(newMessage);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + placeholderKey.length;
        textarea.focus();
      }, 0);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewImage({ url: reader.result as string, file });
      };
      reader.readAsDataURL(file);
    } else {
      const url = await uploadFile(file, 'file');
      if (url) {
        setPendingFile({ url, name: file.name, size: file.size });
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const hasContent = message.trim().length > 0 || previewImage || pendingFile;

  // ============= NUEVA UI MEJORADA (Misma lógica, mejor diseño) =============

  // Si no tiene permiso para responder, mostrar mensaje de bloqueo
  if (!canRespond) {
    return (
      <div className="relative w-full border-t border-gray-800 bg-gray-900/95 backdrop-blur-md">
        <div className="flex items-center justify-center gap-3 px-4 py-6 bg-amber-900/10 border-t border-amber-600/20">
          <div className="flex items-center gap-2 text-amber-500">
            <Lock className="w-5 h-5" />
            <span className="text-sm font-medium">No tienes permiso para enviar mensajes en los chats</span>
          </div>
          <span className="text-xs text-gray-500">(chats.respond)</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full transition-all duration-200 ease-in-out border-t border-gray-800 bg-zinc-900/95 backdrop-blur-md ${isDragging ? 'bg-zinc-800/5 ring-2 ring-primary/50' : ''
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* --- ZONA 1: Contexto y Previsualizaciones --- */}

      {/* Reply Preview (Telegram Style) */}
      {replyTo && (
        <div className="px-4 pt-2 pb-2 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="relative flex items-start justify-between gap-3 group">

            {/* The Accent Line & Content Wrapper */}
            <div className="relative flex-1 min-w-0 pl-3.5 py-0.5">

              {/* Vertical Accent Bar */}
              <div className="absolute left-0 top-0.5 bottom-0.5 w-[3px] bg-indigo-500 rounded-full" />

              <div className="flex flex-col">
                {/* Sender Name */}
                <span className="text-xs font-bold text-indigo-400 truncate mb-0.5">
                  {replyTo.sender === 'user'
                    ? session?.user?.firstName || 'Usuario'
                    : replyTo.senderAgent?.name || 'Agente'}
                </span>

                {/* Message Content */}
                <p className="text-sm text-zinc-300/90 truncate leading-snug">
                  {replyTo.content}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onCancelReply}
              className="mt-1 p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Media/File Upload Preview Container - Premium Zinc */}
      {(previewImage || pendingFile) && (
        <div className="px-4 pt-4 pb-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="relative group flex flex-col md:flex-row items-stretch gap-4 p-4 bg-zinc-950/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl">

            {/* === IMAGE PREVIEW === */}
            {previewImage && (
              <div className="relative shrink-0 self-start">
                <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-zinc-700 shadow-lg group-hover:border-zinc-500 transition-colors">
                  <img
                    src={previewImage.url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay Gradient for better visibility */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
                </div>

                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute -top-2 -right-2 p-1.5 bg-zinc-800 text-zinc-400 hover:text-zinc-50 hover:bg-red-500 rounded-full border border-zinc-700 hover:border-red-500 shadow-md transition-all z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* === FILE PREVIEW === */}
            {pendingFile && (
              <div className="relative flex items-center gap-3 bg-zinc-900 border border-zinc-800 p-3 rounded-xl w-full max-w-sm hover:border-zinc-700 transition-colors">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200 truncate">{pendingFile.name}</p>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">{formatFileSize(pendingFile.size)}</p>
                </div>
                <button
                  onClick={() => setPendingFile(null)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* === UPLOAD PROGRESS OVERLAY === */}
            {uploadProgress && (
              <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3 z-30">
                <div className="relative">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full" />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-zinc-200">Subiendo archivo...</span>
                  <span className="text-xs text-zinc-500 font-mono">{uploadProgress.progress}%</span>
                </div>
                <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    style={{ width: `${uploadProgress.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* === CAPTION & SEND ACTION === */}
            {!uploadProgress && (previewImage || pendingFile) && (
              <div className="flex-1 flex flex-col justify-center gap-3 min-w-0">

                {/* Caption Input */}
                <div className="relative group/input">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Añadir un comentario..."
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-zinc-900 focus:ring-1 focus:ring-indigo-500/20 transition-all"
                    autoFocus
                  />
                </div>

                {/* Action Bar */}
                <div className="flex justify-end">
                  <button
                    onClick={previewImage ? handleSendImage : handleSendFile}
                    disabled={sendStatus === 'sending'}
                    className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendStatus === 'sending' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                      </>
                    ) : (
                      <>
                        Enviar <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Inputs Ocultos */}
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.zip,.xlsx,.xls,.txt,.csv" onChange={handleFileSelect} className="hidden" />

      {/* Drag & Drop Overlay - Premium Zinc */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950/95 backdrop-blur-md rounded-t-2xl border-2 border-dashed border-indigo-500/30 animate-in fade-in duration-300">
          <div className="flex flex-col items-center pointer-events-none">
            {/* Animated Icon Wrapper */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
              <div className="relative w-20 h-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center shadow-2xl ring-1 ring-indigo-500/20">
                <Upload className="w-8 h-8 text-indigo-400 animate-bounce" />
              </div>
            </div>
            {/* Text Content */}
            <h3 className="text-xl font-bold text-zinc-50 tracking-tight drop-shadow-md">
              Suelta tus archivos aquí
            </h3>
            <p className="text-sm text-zinc-500 mt-2 font-medium">
              Se adjuntarán automáticamente al chat
            </p>
          </div>
        </div>
      )}

      {/* --- ZONA 2: Área Principal de Input --- */}
      {/* Solo se muestra si no estamos en modo "Solo Preview" (con botones dedicados) */}
      {!previewImage && !pendingFile && (
        <div className="">
          {/* Auto-Translate Outgoing Banner + Preview */}
          {outgoingConfig?.enabled && (
            <div className="border-b border-zinc-800/50">
              {/* Status badge row */}
              <div className="flex items-center justify-between px-4 py-1.5 bg-indigo-500/5">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] font-bold text-indigo-400">
                    Auto-Translate → {outgoingConfig.targetLang?.toUpperCase() || '??'}
                  </span>
                  {outgoingConfig.deliveryMode === 'both' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-mono">both</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {outgoingConfig.showPreview && (
                    <button
                      onClick={() => setShowTranslationPreview(p => !p)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-colors ${showTranslationPreview ? 'bg-indigo-500/20 text-indigo-300' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Eye className="w-3 h-3 inline mr-1" />Preview
                    </button>
                  )}
                  {outgoingConfig.agentOverrideAllowed && (
                    <button
                      onClick={async () => {
                        try {
                          await updateSessionTranslation(session.sessionId, { outgoingEnabled: false });
                          setOutgoingConfig(prev => prev ? { ...prev, enabled: false } : prev);
                        } catch { /* silent */ }
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 font-bold transition-colors"
                    >
                      Desactivar
                    </button>
                  )}
                </div>
              </div>

              {/* Live preview */}
              {showTranslationPreview && message.trim() && (
                <div className="px-4 py-2 bg-zinc-900/50 border-t border-zinc-800/30">
                  {isPreviewLoading ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Traduciendo…</span>
                    </div>
                  ) : translationPreview ? (
                    <div className="flex items-start gap-2">
                      <Languages className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      <p className="text-xs text-zinc-300 leading-relaxed">{translationPreview}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600 italic">Sin traducción disponible</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Re-enable button when auto-translate was disabled for this chat */}
          {outgoingConfig && !outgoingConfig.enabled && outgoingConfig.agentOverrideAllowed && outgoingConfig.targetLang && (
            <div className="flex items-center justify-between px-4 py-1.5 bg-zinc-900/30 border-b border-zinc-800/50">
              <span className="text-[11px] text-zinc-600">
                <Globe className="w-3 h-3 inline mr-1" />Auto-Translate desactivado para este chat
              </span>
              <button
                onClick={async () => {
                  try {
                    await updateSessionTranslation(session.sessionId, { outgoingEnabled: true });
                    setOutgoingConfig(prev => prev ? { ...prev, enabled: true } : prev);
                  } catch { /* silent */ }
                }}
                className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-indigo-400 hover:bg-indigo-500/10 font-bold transition-colors"
              >
                Reactivar
              </button>
            </div>
          )}

          <div className={`relative flex flex-col bg-zinc-800/50 transition-all duration-200 ${isFocused ? 'border-zinc/50 bg-zinc-800' : ''
            }`}>

            {/* 2.1 Textarea (Auto-growing) */}
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              disabled={disabled || sendStatus === 'sending'}
              placeholder={placeholder}
              rows={1}
              className="w-full px-4 py-3 bg-transparent text-zinc-50 placeholder-gray-500 resize-none focus:outline-none max-h-64 overflow-y-auto scrollbar-thin"
              style={{ minHeight: '56px' }}
            />

            {/* 2.2 Toolbar & Actions (Bottom Bar) */}
            <div className="flex items-center justify-between px-2 pb-2 mt-1">

              {/* Left Tools */}
              <div className="flex items-center gap-0.5">
                {
                  can('uploads.upload') && (
                    <>
                      <ToolButton icon={<ImageIcon className="w-4 h-4" />} tooltip="Imagen" onClick={() => imageInputRef.current?.click()} />
                      <ToolButton icon={<Paperclip className="w-4 h-4" />} tooltip="Archivo" onClick={() => fileInputRef.current?.click()} />
                      <ToolButton
                        icon={<Mic className="w-4 h-4" />}
                        tooltip="Audio"
                        onClick={() => setShowAudioRecorder(true)}
                        active={showAudioRecorder}
                      />
                      <div className="w-px h-4 bg-gray-700 mx-1.5" /> {/* Separator */}
                    </>
                  )
                }
                <ToolButton
                  icon={<Smile className="w-4 h-4" />}
                  tooltip="Emoji"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  active={showEmojiPicker}
                />
                {/* Variables Dropdown - Premium Zinc */}
                <div className="relative group">
                  {/* Trigger Button */}
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all"
                  >
                    <span className="font-mono text-[11px] bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-700/50 text-zinc-400 group-hover:border-indigo-500/30 group-hover:text-indigo-400 group-hover:bg-indigo-500/5 transition-all">
                      {'{ }'}
                    </span>
                    <span>Variables</span>
                  </button>

                  {/* Dropdown Menu */}
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-2 group-hover:translate-y-0 z-50 overflow-hidden">

                    {/* Header */}
                    <div className="px-4 py-2.5 bg-zinc-900/50 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase  flex items-center gap-2">
                      Insertar Variable Dinámica
                    </div>

                    {/* Variables List */}
                    <div className="max-h-48 overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                      {PLACEHOLDERS.map(p => (
                        <button
                          key={p.key}
                          type="button"
                          // onMouseDown evita que el input pierda foco antes del click
                          onMouseDown={(e) => { e.preventDefault(); insertPlaceholder(p.key); }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-zinc-900 transition-all group/item border border-transparent hover:border-zinc-800"
                        >
                          <div className="text-xs font-mono font-bold text-indigo-400 group-hover/item:text-indigo-300 mb-0.5">
                            {p.key}
                          </div>
                          <div className="text-[10px] text-zinc-500 group-hover/item:text-zinc-400 line-clamp-1 leading-tight">
                            {p.description}
                          </div>
                        </button>
                      ))}
                    </div>

                  </div>
                </div>

                <ToolButton
                  icon={<Bookmark className="w-4 h-4" />}
                  tooltip="Guardar respuesta"
                  onClick={() => setShowSaveModal(true)}
                  disabled={!message.trim()}
                />

                {/* Translation Dropdown */}
                <div className="w-px h-4 bg-gray-700 mx-1" />
                <TranslateDropdown
                  message={message}
                  onReplace={(text) => setMessage(text)}
                  sessionId={session.sessionId}
                  disabled={disabled}
                />


              </div>


            </div>
            {/* Footer Hints */}
            <div className="flex justify-between items-center px-3 pb-2">
              <div className="flex gap-4 text-[12px] text-gray-500">
                <span className="hidden sm:inline"><b>Enter</b> enviar</span>
                <span className="hidden sm:inline"><b>Shift+Enter</b> línea</span>
                <span className="hidden sm:inline"><b>Ctrl+Enter</b> enviar y cerrar</span>

                <div className="flex items-center gap-2 ml-4">
                  <SendStatusIndicator status={sendStatus} />
                </div>
              </div>
              {/* Right Actions (Send) */}
              <div className="flex items-center gap-1.5">

                {/* Character Count */}
                {message.trim().length > 0 && (
                  <span className="text-[12px] text-zinc-500 font-mono mr-2 hidden sm:inline-block">
                    {message.length}
                  </span>
                )}

                {/* Schedule Action */}
                {can('scheduled.write') && (
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    title="Programar envío"
                    className="p-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors"
                  >
                    <Clock className="w-5 h-5" />
                  </button>
                )}

                {/* Secondary Action: Send & Close */}
                <button
                  onClick={() => handleSend(true)}
                  disabled={!hasContent || disabled}
                  title="Enviar y cerrar ticket"
                  className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-500"
                >
                  <XCircle className="w-5 h-5" />
                </button>

                {/* Primary Action: Send */}
                <button
                  onClick={() => handleSend(false)}
                  disabled={!hasContent || disabled || sendStatus === 'sending'}
                  className={`
                    flex items-center justify-center gap-2 ml-1 px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 outline-none border border-transparent
                    ${hasContent && !disabled && sendStatus !== 'sending'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-zinc-50 shadow-lg shadow-indigo-500/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'}
                  `}
                >
                  {sendStatus === 'sending' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span className="hidden outline-none sm:inline">Enviar</span>
                      <SendHorizontal className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* --- MODALES Y POPUPS --- */}

      {showQuickReplies && (
        <QuickReplyDropdown
          isLoading={isLoadingReplies}
          replies={filteredReplies}
          selectedIndex={selectedReplyIndex}
          onSelect={selectQuickReply}
        />
      )}

      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 mb-2 z-50 animate-in slide-in-from-bottom-2 fade-in">
          <EmojiPicker
            onSelect={insertEmoji}
            onClose={() => setShowEmojiPicker(false)}
          />
        </div>
      )}

      {showAudioRecorder && (
        <AudioRecorder
          onComplete={handleAudioComplete}
          onCancel={() => setShowAudioRecorder(false)}
        />
      )}

      {showSaveModal && (
        <SaveReplyModal
          content={message}
          onSave={() => {
            setShowSaveModal(false);
            loadSavedReplies();
          }}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      <ScheduleMessageModal
        sessionId={session.sessionId}
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onCreated={() => {
        }}
        defaultText={message}
      />
    </div>
  );
}

// === HELPER COMPONENTS (Estilos mejorados) ===

interface ToolButtonProps {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  tooltip?: string;
  disabled?: boolean;
}

const ToolButton: React.FC<ToolButtonProps> = ({ icon, onClick, active, tooltip, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    title={tooltip}
    disabled={disabled}
    className={`p-2 rounded-lg transition-all ${active
      ? 'text-primary bg-primary/10'
      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
  >
    {icon}
  </button>
);

function SendStatusIndicator({ status }: { status: SendStatus }) {
  if (status === 'idle') return null;

  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full transition-all ${status === 'sending' ? 'text-gray-400 bg-gray-800' :
      status === 'sent' ? 'text-green-400 bg-green-900/30' :
        status === 'error' ? 'text-red-400 bg-red-900/30' : ''
      }`}>
      {status === 'sending' && (
        <>
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Enviando…</span>
        </>
      )}
      {status === 'sent' && (
        <>
          <Check className="w-3 h-3" />
          <span>Enviado</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="w-3 h-3" />
          <span>Error</span>
        </>
      )}
    </div>
  );
}
interface QuickReplyDropdownProps {
  isLoading: boolean;
  replies: SavedReply[];
  selectedIndex: number;
  onSelect: (reply: SavedReply) => void;
}

function QuickReplyDropdown({ isLoading, replies, selectedIndex, onSelect }: QuickReplyDropdownProps) {
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 ">
          <Zap className="w-3 h-3 text-amber-500" />
          <span>Respuestas Rápidas</span>
        </div>
        <div className="flex gap-2 text-[10px] text-zinc-600 font-mono">
          <span>↵ SELECCIONAR</span>
          <span>ESC CERRAR</span>
        </div>
      </div>

      {/* List Content */}
      <div className="max-h-64 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
          </div>
        ) : replies.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">No se encontraron respuestas</p>
          </div>
        ) : (
          replies.map((reply, index) => (
            <button
              type="button"
              key={reply._id}
              onClick={() => onSelect(reply)}
              className={`w-full text-left px-4 py-3 border-l-2 transition-all duration-150 group ${index === selectedIndex
                ? 'bg-zinc-800 border-indigo-500'
                : 'hover:bg-zinc-800/50 border-transparent'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-medium truncate ${index === selectedIndex ? 'text-zinc-50' : 'text-zinc-300'}`}>
                      {reply.title}
                    </span>
                    {reply.shortcut && (
                      <code className="text-[10px] bg-zinc-950 text-zinc-500 px-1.5 py-0.5 rounded border border-zinc-800 font-mono">
                        /{reply.shortcut}
                      </code>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate pr-2 group-hover:text-zinc-400 transition-colors">
                    {reply.content}
                  </p>
                </div>

                {reply.category && (
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 whitespace-nowrap">
                    <Tag className="w-2.5 h-2.5" />
                    {reply.category}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
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
  Clock
} from 'lucide-react';

// Tus imports originales intactos
import { useAuthStore } from '../stores/authStore';
import {
  sendMessage,
  sendImage,
  sendFile,
  sendVoice,
  closeSession,
  startTyping,
  stopTyping
} from '../services/socket';
import type { SavedReply, ChatSession } from '../types';
import EmojiPicker from './EmojiPicker';
import SaveReplyModal from './SaveReplyModal';
import AudioRecorder from './AudioRecorder';
import { ScheduleMessageModal } from './scheduled';

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
  onCancelReply
}: AgentComposerProps) {
  const agent = useAuthStore((state) => state.agent);
  const token = useAuthStore((state) => state.token);

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
      container.scrollTop = container.scrollHeight - container.clientHeight;
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
    userName: session.user.firstName,
    userUsername: session.user.username,
    chatId: session.user.telegramId.toString(),
    sessionId: session.sessionId,
  });

  const handleSend = async (closeAfter = false) => {
    if (!message.trim() || sendStatus === 'sending') return;

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
          setTimeout(() => {textareaRef.current?.focus(); scrollToBottom(); }, 50);
          // añade auto scroll to bottom could be handled by parent component on new message event:
          if (closeAfter) {
            closeSession(session.sessionId, 'Agent closed conversation');
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

  return (
    <div
      ref={containerRef}
      className={`relative w-full transition-all duration-200 ease-in-out border-t border-gray-800 bg-gray-900/95 backdrop-blur-md ${isDragging ? 'bg-primary/5 ring-2 ring-primary/50' : ''
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* --- ZONA 1: Contexto y Previsualizaciones --- */}

      {/* Reply Preview */}
      {replyTo && (
        <div className="px-4 pt-3 pb-1 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-800/60 border-l-4 border-primary rounded-r-lg">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-primary">
                  ↪ Respondiendo a {replyTo.sender === 'user' ? 'Usuario' : replyTo.senderAgent?.name || 'Agente'}
                </span>
              </div>
              <p className="text-sm text-gray-300 truncate opacity-90">{replyTo.content}</p>
            </div>
            <button
              onClick={onCancelReply}
              className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700/50 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Image/File Preview Container */}
      {(previewImage || pendingFile) && (
        <div className="px-4 pt-3 pb-1 animate-in zoom-in-95 duration-200">
          <div className="relative group flex items-start gap-4 p-3 bg-gray-800 rounded-xl border border-gray-700/50">

            {/* Image Preview */}
            {previewImage && (
              <div className="relative shrink-0">
                <img
                  src={previewImage.url}
                  alt="Preview"
                  className="w-24 h-24 object-cover rounded-lg border border-gray-600 shadow-sm"
                />
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute -top-2 -right-2 p-1 bg-gray-900 text-white rounded-full border border-gray-600 hover:bg-red-500 hover:border-red-500 transition-colors shadow-md z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* File Preview */}
            {pendingFile && (
              <div className="relative flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg border border-gray-700 w-full max-w-md">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{pendingFile.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(pendingFile.size)}</p>
                </div>
                <button
                  onClick={() => setPendingFile(null)}
                  className="p-1.5 hover:bg-gray-700 rounded-full text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Upload Progress Bar */}
            {uploadProgress && (
              <div className="absolute inset-0 bg-gray-900/80 rounded-xl flex flex-col items-center justify-center gap-2 z-20">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-sm font-medium text-white">Subiendo {uploadProgress.progress}%</span>
                <div className="w-32 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Caption Input for attachments (only if image/file present and no upload in progress) */}
            {!uploadProgress && (previewImage || pendingFile) && (
              <div className="flex-1 mt-1 self-center">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Añadir un comentario..."
                  className="w-full bg-transparent border-b border-gray-700 focus:border-primary px-0 py-1 text-sm text-white placeholder-gray-500 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
            )}

            {/* Send Button for Attachment Mode */}
            {!uploadProgress && (
              <div className="self-end ml-auto">
                <button
                  onClick={previewImage ? handleSendImage : handleSendFile}
                  disabled={sendStatus === 'sending'}
                  className="p-2 bg-primary hover:bg-primary-dark text-white rounded-lg shadow-lg transition-all"
                >
                  {sendStatus === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inputs Ocultos */}
      <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.zip,.xlsx,.xls,.txt,.csv" onChange={handleFileSelect} className="hidden" />

      {/* Drag Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-gray-900/90 backdrop-blur-sm rounded-t-xl border-t border-primary/30">
          <div className="flex flex-col items-center animate-bounce-slow">
            <div className="p-4 bg-primary/20 rounded-full mb-3 text-primary">
              <Upload className="w-8 h-8" />
            </div>
            <p className="text-lg font-medium text-white">Suelta tus archivos aquí</p>
          </div>
        </div>
      )}

      {/* --- ZONA 2: Área Principal de Input --- */}
      {/* Solo se muestra si no estamos en modo "Solo Preview" (con botones dedicados) */}
      {!previewImage && !pendingFile && (
        <div className="">
          <div className={`relative flex flex-col bg-gray-800/50 transition-all duration-200 ${isFocused ? 'border-primary/50 bg-gray-800' : ''
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
              className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600"
              style={{ minHeight: '56px' }}
            />

            {/* 2.2 Toolbar & Actions (Bottom Bar) */}
            <div className="flex items-center justify-between px-2 pb-2 mt-1">

              {/* Left Tools */}
              <div className="flex items-center gap-0.5">
                <ToolButton icon={<ImageIcon className="w-4 h-4" />} tooltip="Imagen" onClick={() => imageInputRef.current?.click()} />
                <ToolButton icon={<Paperclip className="w-4 h-4" />} tooltip="Archivo" onClick={() => fileInputRef.current?.click()} />
                <ToolButton
                  icon={<Smile className="w-4 h-4" />}
                  tooltip="Emoji"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  active={showEmojiPicker}
                />
                <ToolButton
                  icon={<Mic className="w-4 h-4" />}
                  tooltip="Audio"
                  onClick={() => setShowAudioRecorder(true)}
                  active={showAudioRecorder}
                />

                <div className="w-px h-4 bg-gray-700 mx-1.5" /> {/* Separator */}

                {/* Variables Dropdown */}
                <div className="relative group">
                  <button
                    type="button"
                    className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-400 hover:text-primary hover:bg-primary/10 rounded-md transition-all"
                  >
                    <span className="font-mono text-[10px] font-bold">{'{ }'}</span>
                    <span>Vars</span>
                  </button>
                  <div className="absolute bottom-full left-0 mb-2 w-60 bg-gray-800 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-900/50 border-b border-gray-700 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                      Insertar variable
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {PLACEHOLDERS.map(p => (
                        <button
                          key={p.key}
                          type="button"
                          // Usamos onMouseDown para evitar que el botón pierda foco antes del click
                          onMouseDown={(e) => { e.preventDefault(); insertPlaceholder(p.key); }}
                          className="w-full text-left px-3 py-2 hover:bg-primary/10 border-l-2 border-transparent hover:border-primary transition-colors"
                        >
                          <div className="text-xs font-mono text-primary font-medium">{p.key}</div>
                          <div className="text-[10px] text-gray-400 truncate">{p.description}</div>
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

                {/* Footer Hints */}
                <div className="flex justify-between items-center">
                  <div className="flex gap-4 text-[12px] text-gray-500">
                    <span className="hidden sm:inline"><b>Enter</b> enviar</span>
                    <span className="hidden sm:inline"><b>Shift+Enter</b> línea</span>
                    <span className="hidden sm:inline"><b>Ctrl+Enter</b> enviar y cerrar</span>

                    <div className="flex items-center gap-2 ml-4">
                      <SendStatusIndicator status={sendStatus} />
                    </div>
                  </div>
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className={`flex items-center gap-1 text-[12px] ${showScheduleModal ? 'text-primary' : 'text-gray-500 hover:text-gray-300'} transition-colors`}
                  >
                    <Clock className="w-3 h-3" />
                    Programar envío
                  </button>
                </div>
              </div>

              {/* Right Actions (Send) */}
              <div className="flex items-center gap-2">
                {message.trim().length > 0 && (
                  <span className="text-[12px] text-gray-500 font-medium mr-2 hidden sm:inline-block">
                    {message.length} chars
                  </span>
                )}

                {/* Secondary Action: Send & Close */}
                <button
                  onClick={() => handleSend(true)}
                  disabled={!hasContent || disabled}
                  title="Enviar y cerrar ticket"
                  className="p-2 text-gray-500 hover:text-white hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-30"
                >
                  <XCircle className="w-5 h-5" />
                </button>

                {/* Primary Action: Send */}
                <button
                  onClick={() => handleSend(false)}
                  disabled={!hasContent || disabled || sendStatus === 'sending'}
                  className={`
                    flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-all shadow-lg
                    ${hasContent
                      ? 'bg-primary hover:bg-primary-dark shadow-primary/20 hover:shadow-primary/40 transform active:scale-95'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed'}
                  `}
                >
                  {sendStatus === 'sending' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Enviar</span>
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
          // Could refresh a scheduled messages list here
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
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2">
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between bg-gray-900/90">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Zap className="w-4 h-4 text-primary" />
          <span>Respuestas Rápidas</span>
        </div>
        <span className="text-xs text-gray-600">
          Enter Seleccionar • Esc Cerrar
        </span>
      </div>

      <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : replies.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No se encontraron respuestas</p>
          </div>
        ) : (
          replies.map((reply, index) => (
            <button
              type="button"
              key={reply._id}
              onClick={() => onSelect(reply)}
              className={`w-full text-left px-4 py-3 border-b border-gray-800/50 last:border-b-0 transition-all ${index === selectedIndex
                ? 'bg-primary/10 border-l-2 border-l-primary'
                : 'hover:bg-gray-800/50 border-l-2 border-l-transparent'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm truncate">{reply.title}</span>
                    {reply.shortcut && (
                      <code className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700">
                        /{reply.shortcut}
                      </code>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{reply.content}</p>
                </div>
                {reply.category && (
                  <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded shrink-0 border border-gray-700">
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
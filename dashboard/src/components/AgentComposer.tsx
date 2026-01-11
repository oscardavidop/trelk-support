// Agent Composer - Full-featured message composer for support agents
// Features: Text, Images, Files, Audio recording, Quick replies, Save as reply
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
  Image, 
  Paperclip, 
  Mic,
  MicOff,
  Bookmark,
  Loader2,
  Check,
  AlertCircle,
  X,
  Zap,
  FileText,
  Trash2,
  Play,
  Pause,
  Square,
  Upload
} from 'lucide-react';
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

// Types
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
}

// Placeholder definitions
const PLACEHOLDERS = [
  { key: '{agentName}', description: 'Tu nombre de agente' },
  { key: '{userName}', description: 'Nombre del usuario' },
  { key: '{userUsername}', description: 'Username de Telegram' },
  { key: '{chatId}', description: 'ID del chat' },
  { key: '{sessionId}', description: 'ID de la sesión' },
  { key: '{date}', description: 'Fecha actual (YYYY-MM-DD)' },
  { key: '{time}', description: 'Hora actual (HH:MM)' },
];

// Placeholder replacement
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
  placeholder = 'Escribe un mensaje o usa / para respuestas rápidas…'
}: AgentComposerProps) {
  const agent = useAuthStore((state) => state.agent);
  const token = useAuthStore((state) => state.token);
  
  // State
  const [message, setMessage] = useState('');
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [savedReplies, setSavedReplies] = useState<SavedReply[]>([]);
  const [filteredReplies, setFilteredReplies] = useState<SavedReply[]>([]);
  const [selectedReplyIndex, setSelectedReplyIndex] = useState(0);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; file: File } | null>(null);
  const [pendingFile, setPendingFile] = useState<{ url: string; name: string; size: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // ============= EFFECTS =============

  // Auto-expand textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 200);
      textarea.style.height = `${newHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [message, adjustTextareaHeight]);

  // Load saved replies
  useEffect(() => {
    loadSavedReplies();
  }, []);

  // Quick reply dropdown
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

  // Reset send status
  useEffect(() => {
    if (sendStatus === 'sent' || sendStatus === 'error') {
      const timer = setTimeout(() => setSendStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [sendStatus]);

  // Click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowQuickReplies(false);
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Typing indicator
  useEffect(() => {
    if (message.trim()) {
      // Start typing if not already
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        startTyping(session.sessionId);
      }
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of no activity
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          isTypingRef.current = false;
          stopTyping(session.sessionId);
        }
      }, 2000);
    } else {
      // Empty message - stop typing
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
  
  // Cleanup typing on unmount
  useEffect(() => {
    return () => {
      if (isTypingRef.current) {
        stopTyping(session.sessionId);
      }
    };
  }, [session.sessionId]);

  // ============= FUNCTIONS =============

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

  // Send text message
  const handleSend = async (closeAfter = false) => {
    if (!message.trim() || sendStatus === 'sending') return;
    
    const processedMessage = replacePlaceholders(message.trim(), getPlaceholderContext());
    
    setSendStatus('sending');
    
    sendMessage(session.sessionId, processedMessage, (result) => {
      if (result.ok) {
        setMessage('');
        setSendStatus('sent');
        if (closeAfter) {
          closeSession(session.sessionId, 'Agent closed conversation');
        }
      } else {
        setSendStatus('error');
      }
    });
  };

  // Upload file to server
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

  // Handle image selection
  const handleImageSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona una imagen válida');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewImage({ url: reader.result as string, file });
    };
    reader.readAsDataURL(file);

    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Send image
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

  // Handle file selection
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (50MB)
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

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send file
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

  // Handle audio recording complete
  const handleAudioComplete = async (audioBlob: Blob) => {
    setShowAudioRecorder(false);
    setSendStatus('sending');

    // Create a File from the Blob
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

  // Keyboard handler
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Quick reply navigation
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

    // Send shortcuts
    if (e.key === 'Enter') {
      if (e.shiftKey) return; // New line
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        handleSend(true); // Send and close
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
    
    // Track usage
    fetch(`/api/saved-replies/${reply._id}/use`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
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

  const insertPlaceholder = (placeholder: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newMessage = message.slice(0, start) + placeholder + message.slice(end);
      setMessage(newMessage);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + placeholder.length;
        textarea.focus();
      }, 0);
    }
  };

  // Drag and drop
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
      // Handle as document
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

  // ============= RENDER =============

  return (
    <div 
      ref={containerRef} 
      className={`relative border-t border-gray-800 bg-gray-900/80 backdrop-blur-sm transition-all ${
        isDragging ? 'ring-2 ring-primary ring-inset' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.zip,.xlsx,.xls,.txt,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Quick Reply Dropdown */}
      {showQuickReplies && (
        <QuickReplyDropdown
          isLoading={isLoadingReplies}
          replies={filteredReplies}
          selectedIndex={selectedReplyIndex}
          onSelect={selectQuickReply}
        />
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <EmojiPicker
          onSelect={insertEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {/* Audio Recorder */}
      {showAudioRecorder && (
        <AudioRecorder
          onComplete={handleAudioComplete}
          onCancel={() => setShowAudioRecorder(false)}
        />
      )}

      {/* Save Reply Modal */}
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

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-3">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-sm text-gray-300">
            Subiendo {uploadProgress.filename}...
          </span>
          <div className="flex-1 bg-gray-700 rounded-full h-1.5">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Image Preview */}
      {previewImage && (
        <div className="p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-start gap-4">
            <div className="relative">
              <img 
                src={previewImage.url} 
                alt="Preview" 
                className="w-32 h-32 object-cover rounded-lg border border-gray-700"
              />
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-2 -right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-400 mb-2">Imagen lista para enviar</p>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Agregar caption (opcional)..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSendImage}
              disabled={sendStatus === 'sending'}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {sendStatus === 'sending' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar imagen
            </button>
          </div>
        </div>
      )}

      {/* File Preview */}
      {pendingFile && (
        <div className="p-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-800 rounded-lg">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{pendingFile.name}</p>
              <p className="text-xs text-gray-500">{formatFileSize(pendingFile.size)}</p>
            </div>
            <button
              onClick={() => setPendingFile(null)}
              className="p-2 text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSendFile}
              disabled={sendStatus === 'sending'}
              className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {sendStatus === 'sending' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Enviar archivo
            </button>
          </div>
        </div>
      )}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="w-8 h-8" />
            <span className="text-sm font-medium">Suelta el archivo aquí</span>
          </div>
        </div>
      )}

      {/* Main Input Area */}
      {!previewImage && !pendingFile && (
        <div className="p-4">
          {/* Action Icons Row */}
          <div className="flex items-center gap-1 mb-2">
            <ActionButton 
              icon={<Smile className="w-4 h-4" />} 
              label="Emojis"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              active={showEmojiPicker}
            />
            <ActionButton 
              icon={<Image className="w-4 h-4" />} 
              label="Imagen"
              onClick={() => imageInputRef.current?.click()}
            />
            <ActionButton 
              icon={<Paperclip className="w-4 h-4" />} 
              label="Archivo"
              onClick={() => fileInputRef.current?.click()}
            />
            <ActionButton 
              icon={<Mic className="w-4 h-4" />} 
              label="Audio"
              onClick={() => setShowAudioRecorder(true)}
              active={showAudioRecorder}
            />
            
            <div className="flex-1" />
            
            {/* Placeholder Dropdown */}
            <div className="relative group">
              <ActionButton 
                icon={<span className="text-xs font-mono">{'{}'}</span>}
                label="Variables"
                onClick={() => {}}
              />
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-gray-900 border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-2 text-xs text-gray-500 border-b border-gray-800">
                  Insertar variable
                </div>
                {PLACEHOLDERS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => insertPlaceholder(p.key)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 transition-colors flex items-center justify-between text-sm"
                  >
                    <code className="text-primary">{p.key}</code>
                    <span className="text-xs text-gray-500">{p.description}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <ActionButton 
              icon={<Bookmark className="w-4 h-4" />} 
              label="Guardar respuesta"
              onClick={() => setShowSaveModal(true)}
              disabled={!message.trim()}
            />
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || sendStatus === 'sending'}
            placeholder={placeholder}
            rows={1}
            className="w-full px-3 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 
                       focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary 
                       transition-all resize-none disabled:opacity-50 disabled:cursor-not-allowed
                       scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
            style={{ minHeight: '48px' }}
          />

          {/* Bottom Row */}
          <div className="flex items-center justify-between mt-3">
            {/* Keyboard Hints */}
            <div className="flex items-center gap-3 text-xs text-gray-600">
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 mr-1">Enter</kbd>
                Enviar
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 mr-1">Shift+Enter</kbd>
                Nueva línea
              </span>
              <span className="hidden sm:inline">
                <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-gray-400 mr-1">Ctrl+Enter</kbd>
                Enviar y cerrar
              </span>
            </div>

            {/* Send Buttons */}
            <div className="flex items-center gap-2">
              <SendStatusIndicator status={sendStatus} />
              
              <button
                onClick={() => handleSend(true)}
                disabled={!hasContent || disabled || sendStatus === 'sending'}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 
                           disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm 
                           rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Enviar y cerrar</span>
              </button>

              <button
                onClick={() => handleSend(false)}
                disabled={!message.trim() || disabled || sendStatus === 'sending'}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark 
                           disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium 
                           rounded-lg transition-colors shadow-lg shadow-primary/20"
              >
                {sendStatus === 'sending' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <SendHorizontal className="w-4 h-4" />
                )}
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Quick Reply Dropdown Component
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
          ↑↓ Navegar • Enter Seleccionar • Esc Cerrar
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
              key={reply._id}
              onClick={() => onSelect(reply)}
              className={`w-full text-left px-4 py-3 border-b border-gray-800/50 last:border-b-0 transition-all ${
                index === selectedIndex
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : 'hover:bg-gray-800/50 border-l-2 border-l-transparent'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm truncate">{reply.title}</span>
                    {reply.shortcut && (
                      <code className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">
                        /{reply.shortcut}
                      </code>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{reply.content}</p>
                </div>
                {reply.category && (
                  <span className="text-[10px] bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded shrink-0">
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

// Action Button Component
interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}

function ActionButton({ icon, label, onClick, active, disabled }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-2 rounded-lg transition-colors ${
        active 
          ? 'bg-primary/20 text-primary' 
          : 'text-gray-500 hover:text-white hover:bg-gray-800'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {icon}
    </button>
  );
}

// Send Status Indicator
function SendStatusIndicator({ status }: { status: SendStatus }) {
  if (status === 'idle') return null;
  
  return (
    <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-all ${
      status === 'sending' ? 'text-gray-400 bg-gray-800' :
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

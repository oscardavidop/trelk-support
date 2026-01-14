/**
 * ChatPreview - Real-time read-only chat preview for supervisors
 * Shows live messages as they come in with full media support
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { getSocket, joinSession, leaveSession } from '../../services/socket';
import { User, Bot, Headphones, Loader2, Eye, X, Download, Maximize2, FileText, Play, Pause } from 'lucide-react';
import type { Message } from '../../types';

interface ChatPreviewProps {
  sessionId: string;
  userName: string;
  agentName: string;
}

export function ChatPreview({ sessionId, userName, agentName }: ChatPreviewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = useAuthStore((s) => s.token);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load initial messages
  useEffect(() => {
    let isMounted = true;

    const loadMessages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/messages?limit=100`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) {
          setMessages(data.messages || []);
          setTimeout(scrollToBottom, 100);
        }
      } catch (err) {
        if (isMounted) {
          setError('Error loading messages');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadMessages();
    return () => { isMounted = false; };
  }, [sessionId, token, scrollToBottom]);

  // Subscribe to real-time updates
  useEffect(() => {
    let isSubscribed = true;
    let checkConnectionInterval: ReturnType<typeof setInterval> | null = null;
    
    // Define handlers outside so we can clean up properly
    const handleNewMessage = (message: Message) => {
      console.log('📨 ChatPreview: Received message:new', message._id, 'for session:', message.session, 'current:', sessionId);
      if (message.session === sessionId && isSubscribed) {
        console.log('✅ ChatPreview: Adding message to list');
        setMessages((prev) => {
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        scrollToBottom();
      }
    };

    const handleMessageEdited = (message: Message) => {
      if (message.session === sessionId && isSubscribed) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === message._id
              ? { ...m, content: message.content, editedAt: message.editedAt || new Date().toISOString() }
              : m
          )
        );
      }
    };

    const handleMessageDeleted = (data: { sessionId: string; messageId: string }) => {
      if (data.sessionId === sessionId && isSubscribed) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId ? { ...m, isDeleted: true } : m
          )
        );
      }
    };

    const setupListeners = (socket: ReturnType<typeof getSocket>) => {
      if (!socket) return;
      console.log('🚪 ChatPreview: Joining session room and setting up listeners:', sessionId);
      joinSession(sessionId);
      socket.on('message:new', handleNewMessage);
      socket.on('message:updated', handleMessageEdited);
      socket.on('message:deleted', handleMessageDeleted);
    };

    const socket = getSocket();
    console.log('🔌 ChatPreview: Setting up realtime for session:', sessionId, 'Socket connected:', socket?.connected);
    
    if (socket?.connected) {
      setupListeners(socket);
    } else {
      console.warn('⚠️ ChatPreview: Socket not connected, waiting...');
      checkConnectionInterval = setInterval(() => {
        const s = getSocket();
        if (s?.connected && isSubscribed) {
          console.log('✅ ChatPreview: Socket now connected');
          setupListeners(s);
          if (checkConnectionInterval) {
            clearInterval(checkConnectionInterval);
            checkConnectionInterval = null;
          }
        }
      }, 500);
      
      // Stop trying after 10 seconds
      setTimeout(() => {
        if (checkConnectionInterval) {
          clearInterval(checkConnectionInterval);
          checkConnectionInterval = null;
        }
      }, 10000);
    }

    return () => {
      console.log('🔌 ChatPreview: Cleaning up, leaving session:', sessionId);
      isSubscribed = false;
      if (checkConnectionInterval) {
        clearInterval(checkConnectionInterval);
      }
      const s = getSocket();
      if (s) {
        s.off('message:new', handleNewMessage);
        s.off('message:updated', handleMessageEdited);
        s.off('message:deleted', handleMessageDeleted);
      }
      leaveSession(sessionId);
    };
  }, [sessionId, scrollToBottom]);

  // Scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center text-red-400">
        <p>{error}</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Eye className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No hay mensajes aún</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4 space-y-3">
      {/* Header indicator */}
      <div className="sticky top-0 z-10 mb-2 flex items-center justify-center">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 border border-purple-500/30 rounded-full">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-purple-300">Vista en vivo</span>
        </div>
      </div>

      {/* Messages */}
      {messages.map((message) => (
        <MessagePreviewBubble
          key={message._id}
          message={message}
          userName={userName}
          agentName={agentName}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

interface MessagePreviewBubbleProps {
  message: Message;
  userName: string;
  agentName: string;
}

function MessagePreviewBubble({ message, userName, agentName }: MessagePreviewBubbleProps) {
  const isUser = message.sender === 'user';
  const isBot = message.sender === 'bot';
  const isAgent = message.sender === 'agent';

  const getSenderIcon = () => {
    if (isUser) return <User className="w-3 h-3" />;
    if (isBot) return <Bot className="w-3 h-3" />;
    return <Headphones className="w-3 h-3" />;
  };

  const getSenderName = () => {
    if (isUser) return userName;
    if (isBot) return 'Bot';
    return message.senderAgent?.name || agentName;
  };

  const time = new Date(message.createdAt).toLocaleTimeString('es', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Handle deleted messages
  if (message.isDeleted) {
    return (
      <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
        <div className="max-w-[70%] px-3 py-2 bg-gray-800/50 rounded-lg text-gray-500 italic text-sm">
          Mensaje eliminado
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[70%] rounded-xl px-3 py-2 ${
          isUser
            ? 'bg-gray-700/50 border border-gray-600'
            : isBot
            ? 'bg-blue-500/20 border border-blue-500/30'
            : 'bg-primary/20 border border-primary/30'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center gap-1 mb-1 text-xs ${
          isUser ? 'text-gray-400' : isBot ? 'text-blue-400' : 'text-primary'
        }`}>
          {getSenderIcon()}
          <span className="font-medium">{getSenderName()}</span>
          <span className="text-gray-500 ml-auto">{time}</span>
        </div>
        
        {/* Media Content */}
        <MediaContent message={message} />

        {/* Text content (if any and not just media) */}
        {message.content && !['image', 'voice', 'audio', 'document', 'file', 'sticker'].includes(message.messageType || '') && (
          <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
            {message.content}
            {message.editedAt && (
              <span className="text-xs text-gray-500 ml-1">(editado)</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// Helper to convert media reference to proxy URL
function getProxyMediaUrl(mediaRef: string | undefined): string | undefined {
  if (!mediaRef) return undefined;
  if (mediaRef.startsWith('/api/media/') || mediaRef.startsWith('/api/download/') || mediaRef.startsWith('/uploads/')) {
    return mediaRef;
  }
  if (mediaRef.startsWith('http')) {
    const telegramMatch = mediaRef.match(/api\.telegram\.org\/file\/bot[^/]+\/(.+)$/);
    if (telegramMatch) {
      return `/api/media/${telegramMatch[1]}`;
    }
    return mediaRef;
  }
  return `/api/media/${encodeURIComponent(mediaRef)}`;
}

// Media Content Component
function MediaContent({ message }: { message: Message }) {
  const mediaUrl = getProxyMediaUrl(message.mediaUrl);
  
  if (!mediaUrl) return null;

  switch (message.messageType) {
    case 'image':
      return <PreviewImage url={mediaUrl} alt={message.content} />;
    case 'voice':
    case 'audio':
      return <PreviewAudio url={mediaUrl} title={message.content} />;
    case 'document':
    case 'file':
      return <PreviewFile url={mediaUrl} fileName={message.fileName || message.content} />;
    case 'sticker':
      return <PreviewSticker url={mediaUrl} />;
    default:
      return null;
  }
}

// Image Preview with fullscreen
function PreviewImage({ url, alt }: { url: string; alt: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (hasError) {
    return (
      <div className="flex items-center gap-2 py-2 text-gray-400">
        <FileText className="w-4 h-4" />
        <span className="text-xs">{alt || 'Error al cargar imagen'}</span>
      </div>
    );
  }

  return (
    <>
      <div className="relative group">
        {isLoading && (
          <div className="w-40 h-28 bg-gray-700/50 rounded-lg animate-pulse flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin opacity-50" />
          </div>
        )}
        <img
          src={url}
          alt={alt}
          className={`max-w-[200px] max-h-48 rounded-lg cursor-pointer hover:opacity-90 transition-opacity ${isLoading ? 'hidden' : 'block'}`}
          onLoad={() => setIsLoading(false)}
          onError={() => { setIsLoading(false); setHasError(true); }}
          onClick={() => setIsFullscreen(true)}
        />
        {!isLoading && (
          <button
            onClick={() => setIsFullscreen(true)}
            className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
        )}
      </div>
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setIsFullscreen(false)}>
          <img src={url} alt={alt} className="max-w-full max-h-full object-contain" />
          <button onClick={() => setIsFullscreen(false)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full">
            <X className="w-6 h-6" />
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg">
            <Download className="w-4 h-4" /> Descargar
          </a>
        </div>
      )}
    </>
  );
}

// Audio Preview with player
function PreviewAudio({ url, title }: { url: string; title: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg min-w-[180px]">
      <audio
        ref={audioRef}
        src={url}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onEnded={() => setIsPlaying(false)}
      />
      <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-primary/80 hover:bg-primary flex items-center justify-center flex-shrink-0">
        {isPlaying ? <Pause className="w-3 h-3 text-white" /> : <Play className="w-3 h-3 text-white ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// File Preview with download
function PreviewFile({ url, fileName }: { url: string; fileName: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 transition-colors">
      <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
        <FileText className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{fileName}</p>
        <p className="text-xs text-gray-500">Documento</p>
      </div>
      <Download className="w-4 h-4 text-gray-400" />
    </a>
  );
}

// Sticker Preview
function PreviewSticker({ url }: { url: string }) {
  const [hasError, setHasError] = useState(false);
  
  if (hasError) {
    return <div className="text-xs text-gray-500">🎭 Sticker</div>;
  }

  return (
    <img
      src={url}
      alt="Sticker"
      className="w-24 h-24 object-contain"
      onError={() => setHasError(true)}
    />
  );
}

export default ChatPreview;

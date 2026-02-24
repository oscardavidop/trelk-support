import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { getSocket, joinSession, leaveSession } from '../../services/socket';
import { 
  User, Bot, Headphones, Loader2, Eye, X, Download, Maximize2, 
  FileText, Play, Pause, Image as ImageIcon, Music, Sticker, AlertCircle,
  MessageSquare
} from 'lucide-react';
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const token = useAuthStore((s) => s.token);

  // Auto-scroll: directly set scrollTop on the container for reliability
  // within a constrained overflow-y-auto element.
  const scrollToBottom = useCallback((force = false) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (force || isNearBottom) {
      // Use requestAnimationFrame so layout is complete before measuring
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      });
    }
  }, []);

  // Load initial messages
  useEffect(() => {
    let isMounted = true;
    const loadMessages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/messages?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (isMounted) {
          setMessages(data.messages || []);
          setTimeout(() => scrollToBottom(true), 100);
        }
      } catch (err) {
        if (isMounted) setError('Error cargando historial');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadMessages();
    return () => { isMounted = false; };
  }, [sessionId, token, scrollToBottom]);

  // Real-time subscription (Misma lógica robusta que tenías)
  useEffect(() => {
    let isSubscribed = true;
    const socket = getSocket();
    
    const handleNewMessage = (message: Message) => {
      if (message.session === sessionId && isSubscribed) {
        setMessages(prev => {
          if (prev.some(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        setTimeout(() => scrollToBottom(), 50);
      }
    };

    if (socket) {
      joinSession(sessionId);
      socket.on('message:new', handleNewMessage);
    }

    return () => {
      isSubscribed = false;
      if (socket) {
        socket.off('message:new', handleNewMessage);
        leaveSession(sessionId);
      }
    };
  }, [sessionId, scrollToBottom]);

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-purple-500 animate-spin" /></div>;
  if (error) return <div className="flex-1 flex items-center justify-center text-red-400 gap-2"><AlertCircle className="w-5 h-5"/> {error}</div>;
  if (messages.length === 0) return <EmptyState />;

  return (
    <div className="flex flex-col h-full bg-zinc-950/50">
      {/* Live Indicator */}
      <div className="flex items-center justify-center py-2 bg-zinc-900/80 border-b border-zinc-800 backdrop-blur-sm z-10 sticky top-0">
        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
          </span>
          <span className="text-[10px] font-bold text-red-400 ">En Vivo</span>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
      >
        {messages.map((message, index) => {
          const isSequence = index > 0 && messages[index - 1].sender === message.sender;
          return (
            <MessageBubble
              key={message._id}
              message={message}
              userName={userName}
              agentName={agentName}
              isSequence={isSequence}
            />
          );
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

// ============= MESSAGE BUBBLE =============

function MessageBubble({ message, userName, agentName, isSequence }: { message: Message, userName: string, agentName: string, isSequence: boolean }) {
  const isUser = message.sender === 'user';
  const isBot = message.sender === 'bot';
  const isAgent = message.sender === 'agent';

  if (message.isDeleted) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-zinc-600 italic bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800">
          Mensaje eliminado
        </span>
      </div>
    );
  }

  // Estilos dinámicos según el remitente
  const bubbleStyle = isUser 
    ? "bg-zinc-800 text-zinc-100 rounded-tl-none border-zinc-700"
    : isAgent
      ? "bg-purple-600 text-zinc-50 rounded-tr-none border-purple-500"
      : "bg-blue-600/10 text-blue-200 border-blue-500/20 rounded-xl mx-auto max-w-[85%]"; // Bot style

  const alignClass = isUser ? 'justify-start' : isAgent ? 'justify-end' : 'justify-center';

  return (
    <div className={`flex ${alignClass} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      {/* Avatar (Solo si no es secuencia) */}
      {!isSequence && !isBot && (
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border border-white/5 mr-2 ${isUser ? 'bg-zinc-700 text-zinc-300' : 'order-last ml-2 bg-purple-900 text-purple-200'}`}>
          {isUser ? <User className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
        </div>
      )}
      
      {/* Spacer for sequence */}
      {isSequence && !isBot && <div className={`w-8 mr-2 ${isAgent ? 'order-last ml-2 mr-0' : ''}`} />}

      <div className={`relative px-4 py-2.5 rounded-2xl border max-w-[70%] shadow-sm ${bubbleStyle}`}>
        
        {/* Sender Name (Non-sequential) */}
        {!isSequence && !isBot && (
          <div className={`text-[10px] font-bold mb-1 opacity-70 ${isUser ? 'text-zinc-400' : 'text-purple-200 text-right'}`}>
            {isUser ? userName : agentName}
          </div>
        )}

        {/* Media Content */}
        <MediaContent message={message} />

        {/* Text Content */}
        {message.content && !isMediaOnly(message) && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
            {message.editedAt && <span className="text-[10px] opacity-60 ml-1 italic">(editado)</span>}
          </p>
        )}

        {/* Timestamp */}
        <div className={`text-[9px] mt-1 opacity-60 flex items-center gap-1 ${isAgent ? 'justify-end' : 'justify-start'}`}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {isBot && <Bot className="w-3 h-3" />}
        </div>
      </div>
    </div>
  );
}

// ============= MEDIA COMPONENTS =============

function MediaContent({ message }: { message: Message }) {
  const url = getProxyMediaUrl(message.mediaUrl);
  if (!url) return null;

  switch (message.messageType) {
    case 'image': return <ImagePreview url={url} alt={message.content} />;
    case 'voice':
    case 'audio': return <AudioPlayer url={url} />;
    case 'document': 
    case 'file': return <FileDownload url={url} name={message.fileName || 'Archivo adjunto'} />;
    case 'sticker': return <img src={url} className="w-32 h-32 object-contain drop-shadow-md" />;
    default: return null;
  }
}

function ImagePreview({ url, alt }: any) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <div className="relative group cursor-pointer mb-1 overflow-hidden rounded-lg bg-black/20" onClick={() => setIsOpen(true)}>
        <img src={url} alt={alt} className="max-w-full h-auto object-cover max-h-60 w-full" loading="lazy" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Maximize2 className="w-8 h-8 text-zinc-50 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        </div>
      </div>
      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4" onClick={() => setIsOpen(false)}>
          <img src={url} className="max-w-full max-h-full object-contain rounded shadow-2xl" />
          <button className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-zinc-50">
            <X className="w-6 h-6" />
          </button>
        </div>
      )}
    </>
  );
}

function AudioPlayer({ url }: any) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if(!audioRef.current) return;
    playing ? audioRef.current.pause() : audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-3 p-2 bg-black/20 rounded-lg min-w-[200px] border border-white/5">
      <button onClick={toggle} className="w-8 h-8 rounded-full bg-white text-zinc-900 flex items-center justify-center hover:scale-105 transition-transform">
        {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
        <div className="h-full bg-white w-1/3 animate-pulse" /> {/* Mock progress */}
      </div>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  );
}

function FileDownload({ url, name }: any) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors group">
      <div className="p-2 bg-zinc-800 rounded group-hover:bg-zinc-700">
        <FileText className="w-5 h-5 text-zinc-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate">{name}</p>
        <p className="text-[10px] text-zinc-500 font-bold">Documento</p>
      </div>
      <Download className="w-4 h-4 text-zinc-500 group-hover:text-zinc-50" />
    </a>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 opacity-60">
      <MessageSquare className="w-16 h-16 mb-4 stroke-1" />
      <p className="text-lg font-medium">Chat Vacío</p>
      <p className="text-sm">Esperando mensajes...</p>
    </div>
  );
}

// Helpers
function isMediaOnly(msg: Message) {
  return !msg.content && ['image','video','sticker'].includes(msg.messageType || '');
}

function getProxyMediaUrl(mediaRef: string | undefined): string | undefined {
  if (!mediaRef) return undefined;
  if (mediaRef.startsWith('/api/') || mediaRef.startsWith('/uploads/')) return mediaRef;
  if (mediaRef.startsWith('http')) {
    const match = mediaRef.match(/api\.telegram\.org\/file\/bot[^/]+\/(.+)$/);
    return match ? `/api/media/${match[1]}` : mediaRef;
  }
  return `/api/media/${encodeURIComponent(mediaRef)}`;
}
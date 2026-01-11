/**
 * ChatPreview - Real-time read-only chat preview for supervisors
 * Shows live messages as they come in
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { getSocket, joinSession, leaveSession } from '../../services/socket';
import { User, Bot, Headphones, Loader2, Eye } from 'lucide-react';
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
    const socket = getSocket();
    if (!socket) return;

    // Join the session room
    joinSession(sessionId);

    // Listen for new messages
    const handleNewMessage = (data: { sessionId: string; message: Message }) => {
      if (data.sessionId === sessionId) {
        setMessages((prev) => [...prev, data.message]);
        scrollToBottom();
      }
    };

    // Listen for message edits
    const handleMessageEdited = (data: { sessionId: string; messageId: string; newContent: string }) => {
      if (data.sessionId === sessionId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId
              ? { ...m, content: data.newContent, editedAt: new Date().toISOString() }
              : m
          )
        );
      }
    };

    // Listen for message deletions
    const handleMessageDeleted = (data: { sessionId: string; messageId: string }) => {
      if (data.sessionId === sessionId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId ? { ...m, isDeleted: true } : m
          )
        );
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:edited', handleMessageEdited);
    socket.on('message:deleted', handleMessageDeleted);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:edited', handleMessageEdited);
      socket.off('message:deleted', handleMessageDeleted);
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
        
        {/* Content */}
        <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
          {message.content}
          {message.editedAt && (
            <span className="text-xs text-gray-500 ml-1">(editado)</span>
          )}
        </p>

        {/* Media indicators */}
        {message.mediaUrl && (
          <div className="mt-1 text-xs text-gray-400 italic">
            📎 {message.mediaType || 'Adjunto'}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPreview;

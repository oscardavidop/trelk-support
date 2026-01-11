// Socket.IO client service
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { useAgentsStore } from '../stores/agentsStore';
import type { ChatSession, Message, DashboardStats, Agent, TypingEvent, TransferEvent, ReopenEvent, BlockEvent, UnblockEvent } from '../types';

let socket: Socket | null = null;

export function initializeSocket(): Socket {
  const token = useAuthStore.getState().token;
  
  if (socket?.connected) {
    return socket;
  }

  socket = io('/', {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Connection events
  socket.on('connect', () => {
    console.log('🔌 Socket connected');
    requestStats();
    requestSessions();
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔌 Socket connection error:', error.message);
  });

  // Session events
  socket.on('session:new', (session: ChatSession) => {
    console.log('📥 New session:', session.sessionId);
    useChatStore.getState().addSession(session);
    playNotificationSound();
  });

  socket.on('session:updated', (session: ChatSession) => {
    console.log('📝 Session updated:', session.sessionId);
    useChatStore.getState().updateSession(session);
  });

  socket.on('session:closed', (sessionId: string) => {
    console.log('❌ Session closed:', sessionId);
    useChatStore.getState().removeSession(sessionId);
  });

  // Message events
  socket.on('message:new', (message: Message) => {
    console.log('💬 New message:', message._id);
    useChatStore.getState().addMessage(message);
    
    // Play sound for user messages
    if (message.sender === 'user') {
      playNotificationSound();
    }
  });

  // Stats events
  socket.on('stats:update', (stats: DashboardStats) => {
    useChatStore.getState().setStats(stats);
  });

  // Agent events - real-time status updates
  socket.on('agent:online', (agent: Agent) => {
    console.log('👤 Agent online:', agent.name);
    useAgentsStore.getState().setAgentOnline(agent._id);
  });

  socket.on('agent:offline', (agentId: string) => {
    console.log('👤 Agent offline:', agentId);
    useAgentsStore.getState().setAgentOffline(agentId);
  });

  socket.on('agent:status', (data: { agentId: string; status: Agent['onlineStatus'] }) => {
    console.log('👤 Agent status:', data.agentId, data.status);
    useAgentsStore.getState().updateAgentStatus(data.agentId, data.status);
  });

  // Chat warning events (inactivity)
  socket.on('chat:warning', (data: { sessionId: string; message: string; minutesRemaining: number }) => {
    console.log('⚠️ Chat warning:', data.sessionId, `${data.minutesRemaining} min remaining`);
    // Could show a toast notification here
    const event = new CustomEvent('chat:warning', { detail: data });
    window.dispatchEvent(event);
  });

  // Chat closed events
  socket.on('chat:closed', (data: { 
    sessionId: string; 
    reason: string; 
    closedBy: 'inactivity' | 'user' | 'agent';
    closedAt?: string;
    session?: ChatSession;
  }) => {
    console.log('🔒 Chat closed:', data.sessionId, data.closedBy);
    
    // If we have the full session, move it to closed list
    if (data.session) {
      useChatStore.getState().moveToClosedSessions(data.sessionId, data.session);
    } else {
      useChatStore.getState().removeSession(data.sessionId);
    }
    
    // Dispatch custom event for UI components
    const event = new CustomEvent('chat:closed', { detail: data });
    window.dispatchEvent(event);
  });

  // Error handling
  socket.on('error', (error: { message: string }) => {
    console.error('🔌 Socket error:', error.message);
  });

  // ============= ENTERPRISE EVENTS =============

  // Typing indicators
  socket.on('typing:start', (data: TypingEvent) => {
    console.log('⌨️ Typing start:', data.sessionId, data.userId || data.agentName);
    const event = new CustomEvent('typing:start', { detail: data });
    window.dispatchEvent(event);
  });

  socket.on('typing:stop', (data: TypingEvent) => {
    console.log('⌨️ Typing stop:', data.sessionId);
    const event = new CustomEvent('typing:stop', { detail: data });
    window.dispatchEvent(event);
  });

  // Session transferred
  socket.on('session:transferred', (data: TransferEvent) => {
    console.log('🔄 Session transferred:', data.sessionId, `${data.fromAgentName} → ${data.toAgentName}`);
    const event = new CustomEvent('session:transferred', { detail: data });
    window.dispatchEvent(event);
    // Request updated sessions
    requestSessions();
  });

  // Session reopened
  socket.on('session:reopened', (data: ReopenEvent) => {
    console.log('🔓 Session reopened:', data.sessionId, data.agentName);
    const event = new CustomEvent('session:reopened', { detail: data });
    window.dispatchEvent(event);
    // Request updated sessions
    requestSessions();
  });

  // User blocked
  socket.on('user:blocked', (data: BlockEvent) => {
    console.log('🚫 User blocked:', data.telegramId, data.blockType);
    const event = new CustomEvent('user:blocked', { detail: data });
    window.dispatchEvent(event);
  });

  // User unblocked
  socket.on('user:unblocked', (data: UnblockEvent) => {
    console.log('✅ User unblocked:', data.telegramId);
    const event = new CustomEvent('user:unblocked', { detail: data });
    window.dispatchEvent(event);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

// ============= ACTIONS =============

export function acceptSession(
  sessionId: string, 
  callback?: (result: { ok: boolean; error?: string }) => void
): void {
  socket?.emit('session:accept', sessionId, callback || (() => {}));
}

export function closeSession(
  sessionId: string, 
  reason?: string,
  callback?: (result: { ok: boolean; error?: string }) => void
): void {
  socket?.emit('session:close', { sessionId, reason }, callback || (() => {}));
}

export function sendMessage(
  sessionId: string, 
  content: string,
  callback?: (result: { ok: boolean; error?: string; data?: Message }) => void
): void {
  socket?.emit('message:send', { sessionId, content }, callback || (() => {}));
}

export function sendImage(
  sessionId: string,
  url: string,
  caption?: string,
  callback?: (result: { ok: boolean; error?: string; data?: Message }) => void
): void {
  socket?.emit('message:sendImage', { sessionId, url, caption }, callback || (() => {}));
}

export function sendFile(
  sessionId: string,
  url: string,
  filename: string,
  caption?: string,
  callback?: (result: { ok: boolean; error?: string; data?: Message }) => void
): void {
  socket?.emit('message:sendFile', { sessionId, url, filename, caption }, callback || (() => {}));
}

export function sendVoice(
  sessionId: string,
  url: string,
  callback?: (result: { ok: boolean; error?: string; data?: Message }) => void
): void {
  socket?.emit('message:sendVoice', { sessionId, url }, callback || (() => {}));
}

export function joinSession(sessionId: string): void {
  socket?.emit('session:join', sessionId);
}

export function leaveSession(sessionId: string): void {
  socket?.emit('session:leave', sessionId);
}

export function updateAgentStatus(status: 'online' | 'away' | 'offline'): void {
  socket?.emit('agent:status', status);
}

export function requestStats(): void {
  socket?.emit('stats:request', (stats: DashboardStats) => {
    useChatStore.getState().setStats(stats);
  });
}

export function requestSessions(): void {
  socket?.emit('sessions:request', (sessions: ChatSession[]) => {
    useChatStore.getState().setSessions(sessions);
  });
}

// ============= ENTERPRISE ACTIONS =============

export function startTyping(sessionId: string): void {
  socket?.emit('typing:start', { sessionId });
}

export function stopTyping(sessionId: string): void {
  socket?.emit('typing:stop', { sessionId });
}

export function transferSession(
  sessionId: string,
  toAgentId: string,
  reason: string
): void {
  socket?.emit('session:transfer', { sessionId, toAgentId, reason });
}

export function reopenSession(sessionId: string): void {
  socket?.emit('session:reopen', { sessionId });
}

export function setSessionCategory(
  sessionId: string,
  category: string
): void {
  socket?.emit('session:setCategory', { sessionId, category });
}

export function blockUser(
  telegramId: number,
  blockType: 'temporary' | 'permanent',
  reason: string,
  durationHours?: number
): void {
  socket?.emit('user:block', { telegramId, blockType, reason, durationHours });
}

export function unblockUser(telegramId: number): void {
  socket?.emit('user:unblock', { telegramId });
}

// ============= HELPERS =============

function playNotificationSound(): void {
  try {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore autoplay errors
    });
  } catch {
    // Ignore errors
  }
}

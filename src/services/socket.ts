/**
 * Socket.IO Real-time Events
 * Handles real-time communication between dashboard and server
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ENV } from '../config/index.js';
import { verifyToken } from './auth.service.js';
import { updateAgentStatus, getOnlineAgents, findAgentById } from './agent.service.js';
import { 
  getSessionById, 
  getWaitingSessions, 
  getAllActiveSessions,
  assignAgent,
  closeSession,
  closeSessionDetailed,
  getSessionCounts,
  addMessage,
  getSessionMessages,
  markMessagesAsRead,
  getSessionStats,
} from './chat.service.js';
import { getAgentStats } from './agent.service.js';
import { sendMessage as sendTelegramMessage, sendPhoto, sendDocument, sendVoice, sendChatAction } from './telegram.js';
import { logger } from './logger.js';
import { startInactivityTimer, closeByAgent } from './inactivity.service.js';
import { getAbsolutePath } from './upload.service.js';
import { 
  transferSession, 
  blockUser, 
  unblockUser, 
  reopenSession, 
  setSessionCategory,
  recordFirstResponse,
} from './enterprise.service.js';
import type { ChatCategory } from '../database/models/ChatSession.js';

// Socket.IO event types
export interface ServerToClientEvents {
  // Session events
  'session:new': (session: SessionData) => void;
  'session:updated': (session: SessionData) => void;
  'session:closed': (sessionId: string) => void;
  'session:transferred': (data: { 
    sessionId: string; 
    fromAgent: { id: string; name: string }; 
    toAgent: { id: string; name: string }; 
    reason: string 
  }) => void;
  'session:reopened': (data: { sessionId: string; reopenedBy: string }) => void;
  
  // Message events
  'message:new': (message: MessageData) => void;
  'message:read': (data: { sessionId: string; messageId: string }) => void;
  
  // Typing indicators
  'typing:start': (data: { sessionId: string; userId?: number; agentId?: string; agentName?: string }) => void;
  'typing:stop': (data: { sessionId: string; userId?: number; agentId?: string }) => void;
  
  // Agent events
  'agent:online': (agent: AgentData) => void;
  'agent:offline': (agentId: string) => void;
  'agent:status': (data: { agentId: string; status: string }) => void;
  
  // Stats events
  'stats:update': (stats: DashboardStats) => void;
  
  // Notifications
  'notification': (notification: NotificationData) => void;
  
  // Chat events (inactivity)
  'chat:warning': (data: { sessionId: string; message: string; minutesRemaining: number }) => void;
  'chat:closed': (data: { 
    sessionId: string; 
    reason: string; 
    closedBy: 'inactivity' | 'user' | 'agent';
    closedAt?: string;
    session?: unknown;
  }) => void;
  
  // User block events
  'user:blocked': (data: { telegramId: number; reason: string; blockType: string }) => void;
  'user:unblocked': (data: { telegramId: number }) => void;
  
  // Contact sidebar events
  'contact:note:added': (data: { userId: string; note: NoteData }) => void;
  'contact:note:deleted': (data: { userId: string; noteId: string }) => void;
  'contact:tag:added': (data: { userId: string; tag: TagData }) => void;
  'contact:tag:removed': (data: { userId: string; tagId: string }) => void;
  'contact:field:updated': (data: { userId: string; fieldKey: string; value: unknown }) => void;
  
  // Errors
  'error': (error: { message: string }) => void;
}

// Contact data types
interface NoteData {
  id: string;
  content: string;
  createdAt: Date;
  createdBy: { id: string; name: string };
}

interface TagData {
  id: string;
  name: string;
  color: string;
}

export interface ClientToServerEvents {
  // Session actions
  'session:accept': (sessionId: string, callback: (result: ResultData) => void) => void;
  'session:close': (data: { sessionId: string; reason?: string }, callback: (result: ResultData) => void) => void;
  'session:join': (sessionId: string) => void;
  'session:leave': (sessionId: string) => void;
  'session:transfer': (data: { sessionId: string; toAgentId: string; reason: string }, callback?: (result: ResultData) => void) => void;
  'session:reopen': (data: { sessionId: string }, callback?: (result: ResultData) => void) => void;
  'session:setCategory': (data: { sessionId: string; category: string }, callback?: (result: ResultData) => void) => void;
  
  // Message actions
  'message:send': (data: { sessionId: string; content: string }, callback: (result: ResultData) => void) => void;
  'message:read': (data: { sessionId: string; messageId: string }) => void;
  
  // Media message actions
  'message:sendImage': (data: { sessionId: string; url: string; caption?: string }, callback: (result: ResultData) => void) => void;
  'message:sendFile': (data: { sessionId: string; url: string; filename: string; caption?: string }, callback: (result: ResultData) => void) => void;
  'message:sendVoice': (data: { sessionId: string; url: string }, callback: (result: ResultData) => void) => void;
  
  // Typing indicators
  'typing:start': (data: { sessionId: string }) => void;
  'typing:stop': (data: { sessionId: string }) => void;
  
  // User actions
  'user:block': (data: { telegramId: number; blockType: 'temporary' | 'permanent'; reason: string; durationHours?: number }, callback?: (result: ResultData) => void) => void;
  'user:unblock': (data: { telegramId: number }, callback?: (result: ResultData) => void) => void;
  
  // Agent actions
  'agent:status': (status: 'online' | 'away' | 'offline') => void;
  
  // Request data
  'stats:request': (callback: (stats: DashboardStats) => void) => void;
  'sessions:request': (callback: (sessions: SessionData[]) => void) => void;
}

interface SocketData {
  agentId: string;
  email: string;
  role: string;
}

// Data types
interface SessionData {
  sessionId: string;
  user: {
    telegramId: number;
    username?: string;
    firstName: string;
  };
  status: string;
  assignedAgent?: {
    _id: string;
    name: string;
  };
  category?: string;
  unreadCount?: number;
  lastMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageData {
  _id: string;
  session: string;
  sender: string;
  senderAgent?: { name: string };
  content: string;
  messageType?: 'text' | 'image' | 'document' | 'file' | 'sticker' | 'voice' | 'audio' | 'system';
  mediaUrl?: string;
  fileName?: string;
  createdAt: Date;
}

interface AgentData {
  _id: string;
  name: string;
  email: string;
  role: string;
  onlineStatus: string;
  avatar?: string;
}

interface DashboardStats {
  sessions: {
    total: number;
    bot: number;
    waiting: number;
    human: number;
    closed: number;
  };
  agents: {
    total: number;
    online: number;
    away: number;
    offline: number;
  };
}

interface NotificationData {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
}

interface ResultData {
  ok: boolean;
  error?: string;
  data?: unknown;
}

// Store active connections
const agentSockets = new Map<string, Socket>();
const sessionRooms = new Map<string, Set<string>>(); // sessionId -> Set of agentIds

let io: SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Initialize Socket.IO server
 */
export function initializeSocketIO(httpServer: HttpServer): SocketServer {
  io = new SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: {
      origin: ENV.CORS_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });
  
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication required'));
      }
      
      const payload = verifyToken(token);
      if (!payload) {
        return next(new Error('Invalid token'));
      }
      
      socket.data.agentId = payload.agentId;
      socket.data.email = payload.email;
      socket.data.role = payload.role;
      
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });
  
  // Connection handler
  io.on('connection', handleConnection);
  
  logger.info('api', { action: 'socketio_initialized' });
  
  return io;
}

/**
 * Handle new socket connection
 */
async function handleConnection(socket: Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>): Promise<void> {
  const { agentId, email } = socket.data;
  
  logger.info('api', { action: 'agent_connected', agentId, email });
  
  // Store socket reference
  agentSockets.set(agentId, socket);
  
  // Set agent online
  await updateAgentStatus(agentId, 'online');
  
  // Notify other agents
  const agent = await findAgentById(agentId);
  if (agent) {
    socket.broadcast.emit('agent:online', {
      _id: agent._id.toString(),
      name: agent.name,
      email: agent.email,
      role: agent.role,
      onlineStatus: 'online',
      avatar: agent.avatar,
    });
  }
  
  // Broadcast updated stats
  await broadcastStats();
  
  // ============= SESSION HANDLERS =============
  
  // Accept waiting session
  socket.on('session:accept', async (sessionId, callback) => {
    try {
      const session = await assignAgent(sessionId, agentId);
      
      if (!session) {
        return callback({ ok: false, error: 'Session not found' });
      }
      
      // Join session room
      socket.join(`session:${sessionId}`);
      
      // Notify all agents of update
      io.emit('session:updated', formatSessionData(session));
      
      // Send system message
      await addMessage(sessionId, 'agent', `Agent ${agent?.name} joined the conversation`, {
        senderAgentId: agentId,
        messageType: 'system',
      });
      
      // Notify user via Telegram - Show close keyboard
      const userMessage = session.user && 'language' in session.user
        ? (session.user as unknown as { language: string }).language === 'es'
          ? '✅ Un agente de soporte se ha unido a la conversación.\n\nPuedes cerrar el chat en cualquier momento usando el botón de abajo.'
          : '✅ A support agent has joined the conversation.\n\nYou can close the chat at any time using the button below.'
        : '✅ A support agent has joined the conversation.\n\nYou can close the chat at any time using the button below.';
      
      // Show ReplyKeyboard with close button
      await sendTelegramMessage(session.telegramChatId, userMessage, {
        replyMarkup: {
          keyboard: [[{ text: '🔒 Cerrar chat' }]],
          resize_keyboard: true,
          one_time_keyboard: false,
        },
      });
      
      await broadcastStats();
      callback({ ok: true, data: session });
    } catch (error) {
      logger.error('api', { action: 'session_accept_error', error: String(error) });
      callback({ ok: false, error: 'Failed to accept session' });
    }
  });
  
  // Close session
  socket.on('session:close', async ({ sessionId, reason }, callback) => {
    try {
      const session = await closeSessionDetailed(
        sessionId,
        'agent',
        'manual',
        agentId,
        reason
      );
      
      if (!session) {
        return callback({ ok: false, error: 'Session not found' });
      }
      
      // Clear inactivity timer
      closeByAgent(sessionId);
      
      // Leave room
      socket.leave(`session:${sessionId}`);
      
      // Notify all agents - session closed
      io.emit('session:closed', sessionId);
      
      // Emit detailed chat:closed event for real-time tab updates
      io.emit('chat:closed', {
        sessionId,
        reason: reason || 'Cerrado por agente',
        closedBy: 'agent',
        closedAt: new Date().toISOString(),
        session: {
          _id: session._id?.toString(),
          sessionId: session.sessionId,
          status: session.status,
          closedAt: session.closedAt,
          closedByType: 'agent',
          closeReason: 'manual',
        },
      });
      
      // Notify user via Telegram - remove keyboard
      const lang = session.user && 'language' in session.user
        ? (session.user as unknown as { language: string }).language
        : 'en';
      const userMessage = lang === 'es'
        ? '✅ Esta conversación de soporte ha sido cerrada. ¡Gracias por contactarnos!'
        : '✅ This support conversation has been closed. Thank you for contacting us!';
      
      await sendTelegramMessage(session.telegramChatId, userMessage, {
        replyMarkup: { remove_keyboard: true },
      });
      
      // Send survey request
      const surveyMessage = lang === 'es'
        ? '📊 ¿Cómo calificarías tu experiencia?'
        : '📊 How would you rate your experience?';
      await sendTelegramMessage(session.telegramChatId, surveyMessage, {
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '⭐', callback_data: 'survey:1' },
              { text: '⭐⭐', callback_data: 'survey:2' },
              { text: '⭐⭐⭐', callback_data: 'survey:3' },
              { text: '⭐⭐⭐⭐', callback_data: 'survey:4' },
              { text: '⭐⭐⭐⭐⭐', callback_data: 'survey:5' },
            ],
          ],
        },
      });
      
      await broadcastStats();
      callback({ ok: true });
    } catch (error) {
      logger.error('api', { action: 'session_close_error', error: String(error) });
      callback({ ok: false, error: 'Failed to close session' });
    }
  });
  
  // Join session room (for viewing)
  socket.on('session:join', (sessionId) => {
    socket.join(`session:${sessionId}`);
    
    // Track which agents are viewing this session
    if (!sessionRooms.has(sessionId)) {
      sessionRooms.set(sessionId, new Set());
    }
    sessionRooms.get(sessionId)!.add(agentId);
  });
  
  // Leave session room
  socket.on('session:leave', (sessionId) => {
    socket.leave(`session:${sessionId}`);
    sessionRooms.get(sessionId)?.delete(agentId);
  });
  
  // ============= MESSAGE HANDLERS =============
  
  // Send message to user
  socket.on('message:send', async ({ sessionId, content }, callback) => {
    try {
      const session = await getSessionById(sessionId);
      
      if (!session) {
        return callback({ ok: false, error: 'Session not found' });
      }
      
      // Save message to DB
      const message = await addMessage(sessionId, 'agent', content, {
        senderAgentId: agentId,
      });
      
      // Send to user via Telegram
      await sendTelegramMessage(session.telegramChatId, content);
      
      // Start/restart inactivity timer - agent sent message, waiting for user response
      await startInactivityTimer(sessionId, session.telegramChatId);
      
      // Broadcast to session room
      io.to(`session:${sessionId}`).emit('message:new', {
        _id: message._id.toString(),
        session: sessionId,
        sender: 'agent',
        senderAgent: { name: agent?.name || 'Agent' },
        content,
        createdAt: message.createdAt,
      });
      
      callback({ ok: true, data: message });
    } catch (error) {
      logger.error('api', { action: 'message_send_error', error: String(error) });
      callback({ ok: false, error: 'Failed to send message' });
    }
  });
  
  // Mark messages as read
  socket.on('message:read', async ({ sessionId, messageId }) => {
    await markMessagesAsRead(sessionId, messageId);
    io.to(`session:${sessionId}`).emit('message:read', { sessionId, messageId });
  });

  // ============= MEDIA MESSAGE HANDLERS =============

  // Send image to user
  socket.on('message:sendImage', async ({ sessionId, url, caption }, callback) => {
    try {
      const session = await getSessionById(sessionId);
      
      if (!session) {
        return callback({ ok: false, error: 'Session not found' });
      }
      
      // Get absolute path for the image
      const imagePath = getAbsolutePath(url);
      
      // Send to Telegram
      const sent = await sendPhoto(session.telegramChatId, imagePath, caption);
      
      if (!sent) {
        return callback({ ok: false, error: 'Failed to send image to Telegram' });
      }
      
      // Save message to DB
      const message = await addMessage(sessionId, 'agent', caption || '📷 Image', {
        senderAgentId: agentId,
        messageType: 'image',
        mediaUrl: url,
      });
      
      // Start inactivity timer
      await startInactivityTimer(sessionId, session.telegramChatId);
      
      // Broadcast to session room
      io.to(`session:${sessionId}`).emit('message:new', {
        _id: message._id.toString(),
        session: sessionId,
        sender: 'agent',
        senderAgent: { name: agent?.name || 'Agent' },
        content: caption || '📷 Image',
        messageType: 'image',
        mediaUrl: url,
        createdAt: message.createdAt,
      });
      
      callback({ ok: true, data: message });
    } catch (error) {
      logger.error('api', { action: 'message_send_image_error', error: String(error) });
      callback({ ok: false, error: 'Failed to send image' });
    }
  });

  // Send file/document to user
  socket.on('message:sendFile', async ({ sessionId, url, filename, caption }, callback) => {
    try {
      const session = await getSessionById(sessionId);
      
      if (!session) {
        return callback({ ok: false, error: 'Session not found' });
      }
      
      // Get absolute path for the file
      const filePath = getAbsolutePath(url);
      
      // Send to Telegram
      const sent = await sendDocument(session.telegramChatId, filePath, caption, filename);
      
      if (!sent) {
        return callback({ ok: false, error: 'Failed to send file to Telegram' });
      }
      
      // Save message to DB
      const message = await addMessage(sessionId, 'agent', caption || `📎 ${filename}`, {
        senderAgentId: agentId,
        messageType: 'file',
        mediaUrl: url,
      });
      
      // Start inactivity timer
      await startInactivityTimer(sessionId, session.telegramChatId);
      
      // Broadcast to session room
      io.to(`session:${sessionId}`).emit('message:new', {
        _id: message._id.toString(),
        session: sessionId,
        sender: 'agent',
        senderAgent: { name: agent?.name || 'Agent' },
        content: caption || `📎 ${filename}`,
        messageType: 'file',
        mediaUrl: url,
        fileName: filename,
        createdAt: message.createdAt,
      });
      
      callback({ ok: true, data: message });
    } catch (error) {
      logger.error('api', { action: 'message_send_file_error', error: String(error) });
      callback({ ok: false, error: 'Failed to send file' });
    }
  });

  // Send voice message to user
  socket.on('message:sendVoice', async ({ sessionId, url }, callback) => {
    try {
      const session = await getSessionById(sessionId);
      
      if (!session) {
        return callback({ ok: false, error: 'Session not found' });
      }
      
      // Get absolute path for the audio
      const audioPath = getAbsolutePath(url);
      
      // Send to Telegram
      const sent = await sendVoice(session.telegramChatId, audioPath);
      
      if (!sent) {
        return callback({ ok: false, error: 'Failed to send voice to Telegram' });
      }
      
      // Save message to DB
      const message = await addMessage(sessionId, 'agent', '🎤 Voice message', {
        senderAgentId: agentId,
        messageType: 'voice',
        mediaUrl: url,
      });
      
      // Start inactivity timer
      await startInactivityTimer(sessionId, session.telegramChatId);
      
      // Broadcast to session room
      io.to(`session:${sessionId}`).emit('message:new', {
        _id: message._id.toString(),
        session: sessionId,
        sender: 'agent',
        senderAgent: { name: agent?.name || 'Agent' },
        content: '🎤 Voice message',
        messageType: 'voice',
        mediaUrl: url,
        createdAt: message.createdAt,
      });
      
      callback({ ok: true, data: message });
    } catch (error) {
      logger.error('api', { action: 'message_send_voice_error', error: String(error) });
      callback({ ok: false, error: 'Failed to send voice' });
    }
  });

  // ============= TYPING INDICATORS =============
  
  socket.on('typing:start', async ({ sessionId }) => {
    // Broadcast to session room that agent is typing
    socket.to(`session:${sessionId}`).emit('typing:start', {
      sessionId,
      agentId,
      agentName: agent?.name,
    });
    
    // Send typing indicator to Telegram
    const session = await getSessionById(sessionId);
    if (session?.telegramChatId) {
      await sendChatAction(session.telegramChatId, 'typing');
    }
  });
  
  socket.on('typing:stop', ({ sessionId }) => {
    socket.to(`session:${sessionId}`).emit('typing:stop', {
      sessionId,
      agentId,
    });
  });

  // ============= TRANSFER HANDLERS =============
  
  socket.on('session:transfer', async ({ sessionId, toAgentId, reason }, callback?) => {
    try {
      const result = await transferSession({
        sessionId,
        fromAgentId: agentId,
        toAgentId,
        reason,
      });
      
      if (!result) {
        callback?.({ ok: false, error: 'Session not found' });
        return;
      }
      
      const fromAgent = await findAgentById(agentId);
      const toAgent = await findAgentById(toAgentId);
      
      // Notify all agents about transfer
      io.emit('session:transferred', {
        sessionId,
        fromAgent: { id: agentId, name: fromAgent?.name || 'Agent' },
        toAgent: { id: toAgentId, name: toAgent?.name || 'Agent' },
        reason,
      });
      
      // Send notification to target agent
      const targetSocket = agentSockets.get(toAgentId);
      if (targetSocket) {
        targetSocket.emit('notification', {
          type: 'info',
          title: 'Chat Transferred',
          message: `${fromAgent?.name || 'An agent'} transferred a chat to you. Reason: ${reason}`,
        });
      }
      
      // Update session for all
      io.emit('session:updated', formatSessionData(result.session));
      
      callback?.({ ok: true, data: result });
    } catch (error) {
      logger.error('api', { action: 'transfer_error', error: String(error) });
      callback?.({ ok: false, error: String(error) });
    }
  });

  // ============= REOPEN HANDLER =============
  
  socket.on('session:reopen', async ({ sessionId }, callback?) => {
    try {
      const { role } = socket.data;
      const session = await reopenSession(sessionId, agentId, role);
      
      if (!session) {
        callback?.({ ok: false, error: 'Session not found' });
        return;
      }
      
      // Notify all agents
      io.emit('session:reopened', { sessionId, reopenedBy: agent?.name || 'Admin' });
      io.emit('session:new', formatSessionData(session));
      
      await broadcastStats();
      
      callback?.({ ok: true, data: session });
    } catch (error) {
      logger.error('api', { action: 'reopen_error', error: String(error) });
      callback?.({ ok: false, error: String(error) });
    }
  });

  // ============= CATEGORY HANDLER =============
  
  socket.on('session:setCategory', async ({ sessionId, category }, callback?) => {
    try {
      const session = await setSessionCategory(sessionId, category as ChatCategory);
      
      if (!session) {
        callback?.({ ok: false, error: 'Session not found' });
        return;
      }
      
      io.emit('session:updated', formatSessionData(session));
      
      callback?.({ ok: true, data: session });
    } catch (error) {
      logger.error('api', { action: 'category_error', error: String(error) });
      callback?.({ ok: false, error: String(error) });
    }
  });

  // ============= USER BLOCK HANDLERS =============
  
  socket.on('user:block', async ({ telegramId, blockType, reason, durationHours }, callback?) => {
    try {
      const block = await blockUser({
        telegramId,
        blockType,
        reason,
        blockedByAgentId: agentId,
        durationHours,
      });
      
      if (!block) {
        callback?.({ ok: false, error: 'User not found' });
        return;
      }
      
      // Notify all agents
      io.emit('user:blocked', { telegramId, reason, blockType });
      
      callback?.({ ok: true, data: block });
    } catch (error) {
      logger.error('api', { action: 'block_error', error: String(error) });
      callback?.({ ok: false, error: String(error) });
    }
  });
  
  socket.on('user:unblock', async ({ telegramId }, callback?) => {
    try {
      const success = await unblockUser(telegramId, agentId);
      
      if (!success) {
        callback?.({ ok: false, error: 'Block not found' });
        return;
      }
      
      io.emit('user:unblocked', { telegramId });
      
      callback?.({ ok: true });
    } catch (error) {
      logger.error('api', { action: 'unblock_error', error: String(error) });
      callback?.({ ok: false, error: String(error) });
    }
  });

  // ============= AGENT STATUS =============
  
  socket.on('agent:status', async (status) => {
    await updateAgentStatus(agentId, status);
    io.emit('agent:status', { agentId, status });
    await broadcastStats();
  });
  
  // ============= DATA REQUESTS =============
  
  socket.on('stats:request', async (callback) => {
    const stats = await getDashboardStats();
    callback(stats);
  });
  
  socket.on('sessions:request', async (callback) => {
    const sessions = await getAllActiveSessions();
    callback(sessions.map(formatSessionData));
  });
  
  // ============= DISCONNECTION =============
  
  socket.on('disconnect', async () => {
    logger.info('api', { action: 'agent_disconnected', agentId, email });
    
    agentSockets.delete(agentId);
    await updateAgentStatus(agentId, 'offline');
    
    socket.broadcast.emit('agent:offline', agentId);
    await broadcastStats();
  });
}

// ============= HELPER FUNCTIONS =============

function formatSessionData(session: any): SessionData {
  return {
    sessionId: session.sessionId,
    user: {
      telegramId: session.user?.telegramId || session.telegramChatId,
      username: session.user?.username,
      firstName: session.user?.firstName || 'Unknown',
    },
    status: session.status,
    assignedAgent: session.assignedAgent ? {
      _id: session.assignedAgent._id.toString(),
      name: session.assignedAgent.name,
    } : undefined,
    category: session.category,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

async function getDashboardStats(): Promise<DashboardStats> {
  const [sessions, agents] = await Promise.all([
    getSessionStats(),
    getAgentStats(),
  ]);
  
  return { sessions, agents };
}

async function broadcastStats(): Promise<void> {
  const stats = await getDashboardStats();
  io.emit('stats:update', stats);
}

// ============= EXPORTED FUNCTIONS FOR BOT =============

/**
 * Notify agents of new waiting session
 */
export async function notifyNewSession(session: any): Promise<void> {
  if (!io) return;
  
  io.emit('session:new', formatSessionData(session));
  await broadcastStats();
}

/**
 * Broadcast new message from user
 */
export async function notifyNewMessage(sessionId: string, content: string, telegramMessageId?: number): Promise<void> {
  if (!io) return;
  
  const session = await getSessionById(sessionId);
  if (!session) return;
  
  // Save message
  const message = await addMessage(sessionId, 'user', content, {
    telegramMessageId,
  });
  
  // Build message data with all fields
  const messageData: MessageData = {
    _id: message._id.toString(),
    session: sessionId,
    sender: 'user',
    content,
    messageType: 'text',
    createdAt: message.createdAt,
  };
  
  // Emit to session room and all agents if waiting
  if (session.status === 'human') {
    io.to(`session:${sessionId}`).emit('message:new', messageData);
  } else if (session.status === 'waiting') {
    io.emit('message:new', messageData);
  }
}

/**
 * Broadcast new media message from user
 */
export async function notifyNewMediaMessage(
  sessionId: string, 
  options: {
    content: string;
    messageType: 'image' | 'document' | 'voice' | 'audio' | 'sticker';
    mediaUrl: string;
    fileName?: string;
    telegramMessageId?: number;
  }
): Promise<void> {
  if (!io) return;
  
  const session = await getSessionById(sessionId);
  if (!session) return;
  
  // Save message with media info
  const message = await addMessage(sessionId, 'user', options.content, {
    telegramMessageId: options.telegramMessageId,
    messageType: options.messageType,
    mediaUrl: options.mediaUrl,
  });
  
  // Build message data with all fields including media
  const messageData: MessageData = {
    _id: message._id.toString(),
    session: sessionId,
    sender: 'user',
    content: options.content,
    messageType: options.messageType,
    mediaUrl: options.mediaUrl,
    fileName: options.fileName,
    createdAt: message.createdAt,
  };
  
  // Emit to session room and all agents if waiting
  if (session.status === 'human') {
    io.to(`session:${sessionId}`).emit('message:new', messageData);
  } else if (session.status === 'waiting') {
    io.emit('message:new', messageData);
  }
}

/**
 * Get Socket.IO instance
 */
export function getIO(): SocketServer | null {
  return io || null;
}

/**
 * Emit chat warning event (inactivity)
 */
export function emitChatWarning(sessionId: string, minutesRemaining: number): void {
  if (!io) return;
  
  io.emit('chat:warning', {
    sessionId,
    message: `Chat will close in ${minutesRemaining} minutes due to inactivity`,
    minutesRemaining,
  });
}

/**
 * Emit chat closed event
 */
export function emitChatClosed(
  sessionId: string, 
  reason: string, 
  closedBy: 'inactivity' | 'user' | 'agent'
): void {
  if (!io) return;
  
  io.emit('chat:closed', { sessionId, reason, closedBy });
  io.emit('session:closed', sessionId);
  
  // Also broadcast updated stats
  broadcastStats();
}

// ============= CONTACT SIDEBAR EVENTS =============

/**
 * Emit note added event
 */
export function emitNoteAdded(
  userId: string, 
  note: { id: string; content: string; createdAt: Date; createdBy: { id: string; name: string } }
): void {
  if (!io) return;
  io.emit('contact:note:added', { userId, note });
}

/**
 * Emit note deleted event
 */
export function emitNoteDeleted(userId: string, noteId: string): void {
  if (!io) return;
  io.emit('contact:note:deleted', { userId, noteId });
}

/**
 * Emit tag added event
 */
export function emitTagAdded(userId: string, tag: { id: string; name: string; color: string }): void {
  if (!io) return;
  io.emit('contact:tag:added', { userId, tag });
}

/**
 * Emit tag removed event
 */
export function emitTagRemoved(userId: string, tagId: string): void {
  if (!io) return;
  io.emit('contact:tag:removed', { userId, tagId });
}

/**
 * Emit custom field updated event
 */
export function emitFieldUpdated(userId: string, fieldKey: string, value: unknown): void {
  if (!io) return;
  io.emit('contact:field:updated', { userId, fieldKey, value });
}

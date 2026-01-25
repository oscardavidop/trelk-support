/**
 * Socket.IO Real-time Events
 * Handles real-time communication between dashboard and server
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { ENV } from '../config/index.js';
import { verifyToken } from './auth.service.js';
import { Agent } from '../database/models/Agent.js';
import {
  updateAgentStatus,
  getOnlineAgents,
  findAgentById,
  setAgentSocketId,
  incrementActiveChats,
  decrementActiveChats,
  getAvailabilityStatus,
  MAX_CONCURRENT_CHATS,
} from './agent.service.js';
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
  canAgentAccessSession,
  autoAssignFromQueue,
  getVisibleSessionsForAgent,
  getQueuedSessions,
  addToQueue,
} from './chat.service.js';
import { getAgentStats } from './agent.service.js';
import { sendMessage as sendTelegramMessage, sendMessageWithId, sendPhoto, sendDocument, sendVoice, sendChatAction, editMessage as editTelegramMessage, deleteMessage as deleteTelegramMessage, pinChatMessage } from './telegram.js';
import { logger } from './logger.js';
import { startInactivityTimer, closeByAgent, clearQueuedTimer } from './inactivity.service.js';
import { getAbsolutePath } from './upload.service.js';
import {
  triggerChatClosed,
  triggerChatAssigned,
  triggerAgentMessageSent,
  triggerFirstResponse,
} from './flowTriggers.service.js';
import {
  transferSession,
  blockUser,
  unblockUser,
  reopenSession,
  setSessionCategory,
  recordFirstResponse,
} from './enterprise.service.js';
import {
  handleAgentDisconnection,
  handleAgentReconnection,
  getAgentSyncState,
  tryAssignSession,
} from './reconciliation.service.js';
import {
  registerSession,
  validateSession,
  getActiveSession,
  updateSocketId,
  removeSession,
  registerChatTab,
  heartbeatTab,
  releaseChatTab,
  type ActiveSession,
} from './session-guard.service.js';
import { triggerEventMessages } from './scheduledMessage.service.js';
import { telegramErrorHandler } from './telegram-error-handler.js';
import { hasPermission } from './permission.service.js';
import type { ChatCategory } from '../database/models/ChatSession.js';
import { Message } from '../database/models/Message.js';
import type { AvailabilityStatus } from '../database/models/Agent.js';

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

  // Queue and assignment events (visibility-aware)
  'session:queued': (session: SessionData) => void;
  'session:assigned': (data: { sessionId: string; agentId: string; agentName: string }) => void;
  'session:unassigned': (data: { sessionId: string }) => void;
  'session:accessDenied': (data: { sessionId: string; reason: string }) => void;

  // Message events
  'message:new': (message: MessageData) => void;
  'message:read': (data: { sessionId: string; messageId: string }) => void;
  'message:updated': (message: MessageData) => void;
  'message:deleted': (data: { messageId: string; sessionId: string }) => void;
  'message:pinned': (data: { messageId: string; sessionId: string; message: MessageData, pinForUser: boolean }) => void;
  'message:unpinned': (data: { sessionId: string }) => void;

  // Typing indicators
  'typing:start': (data: { sessionId: string; userId?: number; agentId?: string; agentName?: string }) => void;
  'typing:stop': (data: { sessionId: string; userId?: number; agentId?: string }) => void;

  // Agent events
  'agent:online': (agent: AgentData) => void;
  'agent:offline': (agentId: string) => void;
  'agent:status': (data: { agentId: string; status: string }) => void;
  'agent:availability': (data: { agentId: string; availability: AvailabilityStatus; activeChats: number; maxChats: number }) => void;

  // Sync events (for reconnection)
  'sync:state': (data: SyncStateData) => void;
  'sync:error': (data: { message: string }) => void;

  // Stats events
  'stats:update': (stats: DashboardStats) => void;

  // Notifications
  'notification': (notification: NotificationData) => void;

  // Chat events (inactivity)
  'chat:warning': (data: { sessionId: string; message: string; minutesRemaining: number }) => void;
  'chat:closed': (data: {
    sessionId: string;
    reason: string;
    closedBy: 'inactivity' | 'user' | 'agent' | 'automation' | 'system';
    closedAt?: string;
    session?: unknown;
    message?: string;
  }) => void;
  'chat:user_blocked': (data: {
    sessionId: string;
    reason: string;
    message: string;
    messageEn: string;
  }) => void;

  // Session guard events (single session/tab enforcement)
  'session:replaced': (data: {
    reason: string;
    newDevice: string;
    newIp: string;
    replacedAt: string;
  }) => void;
  'session:terminated': (data: {
    reason: string;
  }) => void;
  'tab:duplicate_detected': (data: {
    activeTabId: string;
    message: string;
  }) => void;
  'session:force_logout': (data: {
    reason: string;
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

  // Supervisor & Whisper events
  'whisper:new': (whisper: {
    id: string;
    sessionId: string;
    supervisorId: string;
    supervisorName: string;
    content: string;
    createdAt: Date;
    isRead: boolean;
  }) => void;
  'whisper:received': (whisper: {
    id: string;
    sessionId: string;
    fromSupervisor: { id: string; name: string };
    content: string;
    createdAt: Date;
  }) => void;
  'whisper:read': (data: { whisperId: string }) => void;
  'session:watched': (data: {
    sessionId: string;
    supervisorId: string;
    supervisorName: string;
    action: 'start' | 'stop';
  }) => void;
  'supervisor:watching': (data: {
    supervisorId: string;
    supervisorName: string;
    action: 'start' | 'stop';
  }) => void;
  'session:takenOver': (data: {
    sessionId: string;
    takenBy: { id: string; name: string };
    reason: string;
    bySupervisor?: { id: string; name: string };
  }) => void;
  'session:update': (data: {
    sessionId: string;
    [key: string]: unknown;
  }) => void;
  'agent:statsUpdate': (data: {
    agentId: string;
    activeChats: number;
    resolvedToday: number;
    avgResponseTime: number;
  }) => void;
  'activity:new': (data: {
    sessionId: string;
    type: string;
    description: string;
    agentId?: string;
    agentName?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  }) => void;

  // AI Copilot events
  'copilot:suggestion': (data: {
    sessionId: string;
    id: string;
    type: 'response' | 'summary' | 'category';
    content: string;
    confidence: number;
  }) => void;

  // Automation events
  'automation:triggered': (data: {
    sessionId: string;
    id: string;
    name: string;
    action: string;
    result: 'success' | 'failure';
  }) => void;

  // Scheduled message events
  'scheduled_message_created': (data: {
    id: string;
    sessionId: string;
    type: string;
    status: string;
    scheduledAt?: Date;
    delayMinutes?: number;
    triggerEvent?: string;
    message: { text?: string; hasMedia: boolean };
    createdBy: string;
    createdByName?: string;
    sentAt?: Date;
    createdAt: Date;
  }) => void;
  'scheduled_message_cancelled': (data: {
    id: string;
    sessionId: string;
    status: string;
  }) => void;
  'scheduled_message_sent': (data: {
    id: string;
    sessionId: string;
    type: string;
    status: string;
    sentAt?: Date;
  }) => void;

  // Escalation events
  'escalation:new': (data: {
    sessionId: string;
    reason?: string;
    priority?: string;
    from?: string;
    [key: string]: unknown;
  }) => void;

  // Alert events
  'alert:automation': (data: {
    type: string;
    message?: string;
    [key: string]: unknown;
  }) => void;
  'alert:low-rating': (data: {
    sessionId: string;
    agentId: string;
    agentName: string;
    rating: number;
    ratingLabel: string;
    userName: string;
    answeredAt: Date;
  }) => void;

  // Survey events
  'survey:sent': (data: {
    sessionId: string;
    pollId: string;
    sentAt: Date;
  }) => void;
  'survey:answered': (data: {
    sessionId: string;
    rating: number;
    satisfaction: string;
    label: string;
    answeredAt: Date;
  }) => void;

  // Flow events
  'flow:updated': (data: {
    flowId: string;
    action: 'published' | 'unpublished' | 'updated' | 'deleted';
    version?: number;
    flowName?: string;
  }) => void;

  // System monitoring events (admin only)
  'system:queue:update': (data: {
    queue: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }) => void;
  'system:job:added': (data: {
    queue: string;
    jobId: string;
    jobName: string;
    delay?: number;
  }) => void;
  'system:job:completed': (data: {
    queue: string;
    jobId: string;
    jobName: string;
    durationMs: number;
  }) => void;
  'system:job:failed': (data: {
    queue: string;
    jobId: string;
    jobName: string;
    error: string;
    attempt: number;
  }) => void;
  'system:worker:online': (data: {
    workerId: string;
    queue: string;
  }) => void;
  'system:worker:offline': (data: {
    workerId: string;
    queue: string;
  }) => void;
  'system:redis:status': (data: {
    connected: boolean;
    latencyMs?: number;
  }) => void;

  // Admin Control Panel events
  'system:chats_force_closed': (data: {
    reason: string;
    closedBy: string;
    count: number;
  }) => void;
  'system:your_chats_closed': (data: {
    reason: string;
    closedBy: string;
    count: number;
  }) => void;
  'chats:reassigned_away': (data: {
    count: number;
    toAgent: string;
  }) => void;
  'chats:reassigned_to_you': (data: {
    count: number;
    fromAgent: string;
  }) => void;
  'system:flows_disabled': (data: {
    disabledBy: string;
    count: number;
  }) => void;
  'system:maintenance_mode': (data: {
    enabled: boolean;
    message?: string;
  }) => void;

  // Settings events
  'settings:updated': (data: {
    timestamp: string;
    settings: Record<string, unknown>;
  }) => void;

  // Permission/RBAC events
  'permissions:updated': (data: {
    agentId: string;
    permissions: string[];
    role: string;
    permissionVersion: number;
    updatedBy: { id: string; name: string };
    timestamp: string;
  }) => void;
  'permissions:role_changed': (data: {
    agentId: string;
    oldRole: string;
    newRole: string;
    permissions: string[];
    permissionVersion: number;
    updatedBy: { id: string; name: string };
    timestamp: string;
  }) => void;

  // Text Registry events
  'texts:updated': (data: {
    action: 'created' | 'updated' | 'deleted';
    key: string;
    timestamp: string;
  }) => void;

  // Broadcast events
  'broadcast:update': (data: {
    _id: string;
    status: string;
    progress: {
      total: number;
      sent: number;
      delivered: number;
      failed: number;
      blocked: number;
    };
    completedAt?: Date;
    pausedAt?: Date;
    cancelledAt?: Date;
  }) => void;

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
  'session:takeFromQueue': (data: { sessionId: string }, callback?: (result: ResultData) => void) => void;
  'session:returnToQueue': (data: { sessionId: string; reason?: string }, callback?: (result: ResultData) => void) => void;

  // Message actions
  'message:send': (data: { sessionId: string; content: string; replyToMessageId?: string }, callback: (result: ResultData) => void) => void;
  'message:read': (data: { sessionId: string; messageId: string }) => void;
  'message:edit': (data: { messageId: string; sessionId: string; newContent: string }, callback?: (result: ResultData) => void) => void;
  'message:delete': (data: { messageId: string; sessionId: string }, callback?: (result: ResultData) => void) => void;
  'message:pin': (data: { messageId: string; sessionId: string, pinForUser: boolean }, callback?: (result: ResultData) => void) => void;
  'message:unpin': (data: { messageId: string; sessionId: string }, callback?: (result: ResultData) => void) => void;
  'message:reportSpam': (data: { messageId: string; sessionId: string }, callback?: (result: ResultData) => void) => void;

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
  'agent:requestSync': (callback: (result: ResultData) => void) => void;

  // Supervisor actions
  'supervisor:sendWhisper': (data: { sessionId: string; targetAgentId: string; content: string }, callback?: (result: ResultData) => void) => void;
  'supervisor:watchSession': (data: { sessionId: string }, callback?: (result: ResultData) => void) => void;
  'supervisor:unwatchSession': (data: { sessionId: string }, callback?: (result: ResultData) => void) => void;
  'supervisor:takeover': (data: { sessionId: string; reason: string }, callback?: (result: ResultData) => void) => void;

  // Request data
  'stats:request': (callback: (stats: DashboardStats) => void) => void;
  'sessions:request': (callback: (sessions: SessionData[]) => void) => void;

  // Session guard actions
  'session:register': (data: { browserSessionId: string; device: string }, callback: (result: ResultData) => void) => void;
  'session:validate': (data: { browserSessionId: string }, callback: (result: ResultData) => void) => void;
  'tab:register': (data: { tabId: string }, callback: (result: ResultData) => void) => void;
  'tab:heartbeat': (data: { tabId: string }, callback: (result: ResultData) => void) => void;
  'tab:release': (data: { tabId: string }) => void;
}

interface SocketData {
  agentId: string;
  email: string;
  role: string;
  browserSessionId?: string;
}

// Data types
interface SessionData {
  sessionId: string;
  user: {
    telegramId: number;
    username?: string;
    firstName: string;
    photoFileId?: string;
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
  isEdited?: boolean;
  editedAt?: Date;
  isPinned?: boolean;
  replyToMessage?: {
    _id: string;
    sender: string;
    senderAgent?: { name: string };
    content: string;
  };
  senderUser?: {
    telegramId: number;
    username?: string;
    firstName: string;
    photoFileId?: string;
  };
}

interface AgentData {
  _id: string;
  name: string;
  email: string;
  role: string;
  onlineStatus: string;
  availability?: AvailabilityStatus;
  activeChats?: number;
  avatar?: string;
}

interface DashboardStats {
  sessions: {
    total: number;
    bot: number;
    waiting: number;
    queued: number;
    human: number;
    closed: number;
  };
  agents: {
    total: number;
    online: number;
    away: number;
    offline: number;
    available: number;
    busy: number;
  };
}

interface SyncStateData {
  agent: AgentData;
  mySessions: SessionData[];
  queuedSessions: SessionData[];
  stats: {
    myActive: number;
    queue: number;
  };
  reconnected: boolean;
  recoveredSessions: number;
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
export const agentSockets = new Map<string, Socket>();
const sessionRooms = new Map<string, Set<string>>(); // sessionId -> Set of agentIds

let io: SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

/**
 * Get the Socket.IO server instance
 */
export function getIO(): SocketServer<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData> {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
  }
  return io;
}

// Re-export io for backward compatibility (will throw if accessed before init)
export { io };

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
    transports: ['websocket'],
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

  logger.info('api', { action: 'agent_connected', agentId, email, socketId: socket.id });

  // Store socket reference
  agentSockets.set(agentId, socket);

  // Handle reconnection (checks grace period, recovers sessions if applicable)
  const reconnectionResult = await handleAgentReconnection(agentId, socket.id);

  // Get full sync state
  const syncState = await getAgentSyncState(agentId);
  const agent = syncState.agent;

  if (!agent) {
    socket.emit('sync:error', { message: 'Agent not found' });
    socket.disconnect();
    return;
  }

  // Calculate availability
  const availability = getAvailabilityStatus(agent);

  // Send sync state to the connecting agent
  socket.emit('sync:state', {
    agent: {
      _id: agent._id.toString(),
      name: agent.name,
      email: agent.email,
      role: agent.role,
      onlineStatus: agent.onlineStatus,
      availability,
      activeChats: agent.activeChats,
      avatar: agent.avatar,
    },
    mySessions: syncState.mySessions.map(formatSessionData),
    queuedSessions: syncState.queuedSessions.map(formatSessionData),
    stats: syncState.stats,
    reconnected: reconnectionResult.isGracePeriodRecovery,
    recoveredSessions: reconnectionResult.recoveredSessions.length,
  });

  // Notify other agents
  socket.broadcast.emit('agent:online', {
    _id: agent._id.toString(),
    name: agent.name,
    email: agent.email,
    role: agent.role,
    onlineStatus: 'online',
    availability,
    activeChats: agent.activeChats,
    avatar: agent.avatar,
  });

  // Broadcast availability update
  io.emit('agent:availability', {
    agentId: agent._id.toString(),
    availability,
    activeChats: agent.activeChats,
    maxChats: MAX_CONCURRENT_CHATS,
  });

  // Broadcast updated stats
  await broadcastStats();

  // 🔔 Trigger scheduled messages for agent_online event
  triggerEventMessages('agent_online', undefined, { agentId: agent._id.toString() })
    .then(count => {
      if (count > 0) {
        logger.info('api', {
          action: 'scheduled_messages_triggered_on_agent_online',
          agentId: agent._id.toString(),
          count
        });
      }
    })
    .catch(err => logger.error('api', {
      action: 'scheduled_messages_trigger_error',
      event: 'agent_online',
      error: String(err)
    }));

  // ============= SESSION HANDLERS =============

  // Accept waiting session (from queue or waiting list)
  socket.on('session:accept', async (sessionId, callback) => {
    try {
      const session = await getSessionById(sessionId);

      if (!session) {
        return callback({ ok: false, error: 'Session not found' });
      }

      // Verify session is available (queued or waiting, not assigned to another agent)
      const isAdmin = socket.data.role === 'admin';
      if (!isAdmin) {
        // Check if session is already assigned to another agent
        if (session.assignedAgent && session.assignedAgent._id.toString() !== agentId) {
          return callback({ ok: false, error: 'Session is already assigned to another agent' });
        }
        // Check if session is available for taking
        if (!['queued', 'waiting', 'bot'].includes(session.status)) {
          return callback({ ok: false, error: 'Session is not available for assignment' });
        }
      }

      const assignedSession = await assignAgent(sessionId, agentId);

      if (!assignedSession) {
        return callback({ ok: false, error: 'Failed to assign session' });
      }

      // Trigger flow: chat assigned
      await triggerChatAssigned(assignedSession, agentId, agent?.name || 'Agent');

      // 🔔 Trigger scheduled messages for chat_assigned event
      triggerEventMessages('chat_assigned', sessionId, { agentId })
        .catch(err => logger.error('api', {
          action: 'scheduled_messages_trigger_error',
          event: 'chat_assigned',
          sessionId,
          error: String(err)
        }));

      // Clear queued timer and start regular inactivity timer
      clearQueuedTimer(sessionId);
      await startInactivityTimer(sessionId, assignedSession.telegramChatId);

      // Join session room
      socket.join(`session:${sessionId}`);

      // Emit session:assigned to notify the specific agent
      socket.emit('session:assigned', {
        sessionId,
        agentId,
        agentName: agent?.name || 'Agent',
      });

      // Emit session:updated to the assigned agent
      socket.emit('session:updated', formatSessionData(assignedSession));

      // For admins, broadcast update to all
      if (isAdmin) {
        socket.broadcast.emit('session:updated', formatSessionData(assignedSession));
      } else {
        // For other agents, emit session:unassigned so they remove it from their queue view
        socket.broadcast.emit('session:unassigned', { sessionId });
      }

      // Send system message
      await addMessage(sessionId, 'agent', `Agent ${agent?.name} joined the conversation`, {
        senderAgentId: agentId,
        messageType: 'system',
      });

      // Notify user via Telegram - Show close keyboard
      const userMessage =
        assignedSession.user && 'language' in assignedSession.user
          ? (assignedSession.user as { language: string }).language === 'es'
            ? '👋 ¡Hola! Un agente del equipo de soporte ya se unió a la conversación.\n\nPuedes escribirnos con normalidad'
            : '👋 Hi! A member of our support team has joined the conversation.\n\nYou can chat normally or close the conversation anytime using the button below 😊'
          : '👋 Hi! A member of our support team has joined the conversation.\n\nYou can chat normally or close the conversation anytime using the button below 😊';

      // Show ReplyKeyboard with close button - with error handling for blocked users
      try {
        await sendTelegramMessage(assignedSession.telegramChatId, userMessage);
      } catch (telegramError) {
        // Check if this is a blocking error (user blocked bot, etc.)
        const { handled, reason } = await telegramErrorHandler.handleError(
          telegramError as Error,
          assignedSession.telegramChatId,
          sessionId
        );

        if (handled) {
          // The telegramErrorHandler already closed the session and notified via socket
          // Return specific error for blocked user so agent knows what happened
          const errorMsg = reason === 'bot_blocked'
            ? 'El usuario bloqueó el bot. El chat ha sido cerrado automáticamente.'
            : reason === 'user_deactivated'
              ? 'La cuenta del usuario fue desactivada. El chat ha sido cerrado automáticamente.'
              : 'No se puede contactar al usuario. El chat ha sido cerrado automáticamente.';

          logger.warn('api', {
            action: 'session_accept_user_blocked',
            sessionId,
            telegramChatId: assignedSession.telegramChatId,
            reason
          });

          return callback({
            ok: false,
            error: errorMsg,
            data: { code: 'USER_BLOCKED', reason, sessionClosed: true },
          });
        }

        // Re-throw if not a blocking error
        throw telegramError;
      }

      await broadcastStats();
      callback({ ok: true, data: assignedSession });
    } catch (error) {
      logger.error('api', { action: 'session_accept_error', error: String(error) });
      callback({ ok: false, error: 'Failed to accept session' });
    }
  });

  // Close session
  socket.on('session:close', async ({ sessionId, reason }, callback) => {
    try {
      // Permission check: chats.close
      const canClose = await hasPermission(agentId, 'chats.close');
      if (!canClose) {
        return callback({ ok: false, error: 'No tienes permiso para cerrar chats (chats.close)' });
      }

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

      // Trigger flow: chat closed
      await triggerChatClosed(session, 'agent', reason);

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
        ? '✅ Hemos cerrado esta conversación. ¡Gracias por escribirnos! Si necesitas algo más, aquí estaremos 😊'
        : '✅ We’ve closed this conversation. Thanks for reaching out! If you need anything else, we’ll be here 😊';

      await sendTelegramMessage(session.telegramChatId, userMessage, {
        replyMarkup: { remove_keyboard: true },
      });

      // Send survey request
      const surveyMessage = lang === 'es'
        ? '📊 ¿Nos cuentas cómo te fue? Tu experiencia nos ayuda a mejorar 💙'
        : '📊 Would you like to tell us how it went? Your experience helps us improve 💙';

      await sendTelegramMessage(session.telegramChatId, surveyMessage, {
        replyMarkup: {
          inline_keyboard: [
            [
              { text: '⭐', callback_data: 'survey:1' },
              { text: '⭐⭐', callback_data: 'survey:2' },
              { text: '⭐⭐⭐', callback_data: 'survey:3' },
            ],
            [
              { text: '⭐⭐⭐⭐', callback_data: 'survey:4' },
              { text: '⭐⭐⭐⭐⭐', callback_data: 'survey:5' }
            ]
          ],
        },
      });

      await broadcastStats();

      // Auto-assign next session from queue to this agent
      const nextSession = await autoAssignFromQueue(agentId);
      if (nextSession) {
        // Notify this agent about new assignment
        socket.emit('session:assigned', {
          sessionId: nextSession.sessionId,
          agentId,
          agentName: agent?.name || 'Agent',
        });
        socket.emit('session:updated', formatSessionData(nextSession));

        // Notify other agents that this session is no longer in queue
        socket.broadcast.emit('session:unassigned', { sessionId: nextSession.sessionId });

        logger.info('chat', {
          action: 'auto_assigned_from_queue',
          sessionId: nextSession.sessionId,
          agentId
        });
      }

      callback({ ok: true });
    } catch (error) {
      logger.error('api', { action: 'session_close_error', error: String(error) });
      callback({ ok: false, error: 'Failed to close session' });
    }
  });

  // Join session room (for viewing) - with access control
  socket.on('session:join', async (sessionId) => {
    const isAdmin = socket.data.role === 'admin';
    const isSupervisor = socket.data.role === 'supervisor';

    logger.info('api', {
      action: 'session_join_request',
      sessionId,
      agentId,
      isAdmin,
      isSupervisor
    });

    const canAccess = await canAgentAccessSession(sessionId, agentId, isAdmin, isSupervisor);

    if (!canAccess) {
      logger.warn('api', {
        action: 'session_join_denied',
        sessionId,
        agentId
      });
      socket.emit('session:accessDenied', {
        sessionId,
        reason: 'You do not have access to this session'
      });
      return;
    }

    socket.join(`session:${sessionId}`);

    logger.info('api', {
      action: 'session_joined',
      sessionId,
      agentId,
      rooms: Array.from(socket.rooms)
    });

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

  // ============= QUEUE MANAGEMENT =============

  // Take session from queue (explicit action)
  socket.on('session:takeFromQueue', async ({ sessionId }, callback?) => {
    try {
      const session = await getSessionById(sessionId);

      if (!session) {
        callback?.({ ok: false, error: 'Session not found' });
        return;
      }

      // Verify session is in queue
      if (session.status !== 'queued' && session.status !== 'waiting') {
        callback?.({ ok: false, error: 'Session is not in queue' });
        return;
      }

      // Assign to this agent
      const assignedSession = await assignAgent(sessionId, agentId);

      if (!assignedSession) {
        callback?.({ ok: false, error: 'Failed to take session from queue' });
        return;
      }

      // Join session room
      socket.join(`session:${sessionId}`);

      // Notify this agent
      socket.emit('session:assigned', {
        sessionId,
        agentId,
        agentName: agent?.name || 'Agent',
      });
      socket.emit('session:updated', formatSessionData(assignedSession));

      // Notify other agents to remove from queue view
      socket.broadcast.emit('session:unassigned', { sessionId });

      await broadcastStats();
      callback?.({ ok: true, data: assignedSession });
    } catch (error) {
      logger.error('api', { action: 'take_from_queue_error', error: String(error) });
      callback?.({ ok: false, error: 'Failed to take session from queue' });
    }
  });

  // Return session to queue (agent releases the session)
  socket.on('session:returnToQueue', async ({ sessionId, reason }, callback?) => {
    try {
      const session = await getSessionById(sessionId);

      if (!session) {
        callback?.({ ok: false, error: 'Session not found' });
        return;
      }

      const isAdmin = socket.data.role === 'admin';

      // Verify agent has access to this session
      if (!isAdmin && session.assignedAgent?._id.toString() !== agentId) {
        callback?.({ ok: false, error: 'Not authorized to return this session' });
        return;
      }

      // Return to queue
      const queuedSession = await addToQueue(sessionId);

      if (!queuedSession) {
        callback?.({ ok: false, error: 'Failed to return session to queue' });
        return;
      }

      // Leave session room
      socket.leave(`session:${sessionId}`);

      // Log the action
      await addMessage(sessionId, 'agent', `Agent ${agent?.name} returned the session to queue. Reason: ${reason || 'No reason provided'}`, {
        senderAgentId: agentId,
        messageType: 'system',
      });

      // Notify all agents about queue update (session now available)
      io.emit('session:queued', formatSessionData(queuedSession));

      await broadcastStats();
      callback?.({ ok: true });
    } catch (error) {
      logger.error('api', { action: 'return_to_queue_error', error: String(error) });
      callback?.({ ok: false, error: 'Failed to return session to queue' });
    }
  });

  // ============= MESSAGE HANDLERS =============

  // Send message to user
  socket.on('message:send', async ({ sessionId, content, replyToMessageId }, callback) => {
    try {
      // Permission check: chats.respond
      const canRespond = await hasPermission(agentId, 'chats.respond');
      if (!canRespond) {
        return callback({ ok: false, error: 'No tienes permiso para responder en los chats (chats.respond)' });
      }

      const session = await getSessionById(sessionId);

      if (!session) {
        return callback({ ok: false, error: 'Session not found' });
      }

      // Verify agent has access to this session
      const isAdmin = socket.data.role === 'admin';
      const isSupervisor = socket.data.role === 'supervisor';
      const canAccess = await canAgentAccessSession(sessionId, agentId, isAdmin, isSupervisor);
      if (!canAccess) {
        return callback({ ok: false, error: 'Access denied to this session' });
      }

      // Get reply message if exists
      let replyToMessage: { _id: string; sender: string; senderAgent?: { name: string }; content: string } | undefined;
      let telegramReplyToMessageId: number | undefined;
      if (replyToMessageId) {
        const replyMsg = await Message.findById(replyToMessageId);
        if (replyMsg) {
          replyToMessage = {
            _id: replyMsg._id.toString(),
            sender: replyMsg.sender,
            senderAgent: (replyMsg as any).senderAgent,
            content: replyMsg.content,
          };
          telegramReplyToMessageId = replyMsg.telegramMessageId;
        }
      }

      // Send to user via Telegram FIRST to get the telegram message ID
      let telegramMessageId: number | null = null;
      try {
        telegramMessageId = await sendMessageWithId(session.telegramChatId, content, {
          reply_to_message_id: telegramReplyToMessageId,
        });
      } catch (telegramError) {
        // Check if this is a blocking error (user blocked bot, etc.)
        const { handled, reason } = await telegramErrorHandler.handleError(
          telegramError as Error,
          session.telegramChatId,
          sessionId
        );

        if (handled) {
          // Return specific error for blocked user
          return callback({
            ok: false,
            error: `No se puede enviar el mensaje: ${reason === 'bot_blocked' ? 'El usuario bloqueó el bot' : 'Usuario no disponible'}`,
            data: { code: 'USER_BLOCKED', reason },
          });
        }

        // Re-throw if not a blocking error
        throw telegramError;
      }

      // Save message to DB with telegram message ID (needed for edit/delete)
      const message = await addMessage(sessionId, 'agent', content, {
        senderAgentId: agentId,
        replyToMessageId,
        telegramMessageId: telegramMessageId || undefined,
      });

      // Trigger flow: agent message sent
      await triggerAgentMessageSent(session, {
        content,
        agentId,
        agentName: agent?.name || 'Agent',
      });

      // Start/restart inactivity timer - agent sent message, waiting for user response
      await startInactivityTimer(sessionId, session.telegramChatId);

      // Ensure this socket is in the session room
      const room = `session:${sessionId}`;
      if (!socket.rooms.has(room)) {
        socket.join(room);
        logger.debug('api', { action: 'auto_joined_session_room', sessionId, socketId: socket.id });
      }

      // Broadcast to session room (including this socket)
      io.to(room).emit('message:new', {
        _id: message._id.toString(),
        session: sessionId,
        sender: 'agent',
        senderAgent: { name: agent?.name || 'Agent' },
        content,
        createdAt: message.createdAt,
        replyToMessage,
      });

      callback({ ok: true, data: message });
    } catch (error) {
      logger.error('api', { action: 'message_send_error', error: String(error) });
      callback({ ok: false, error: error instanceof Error ? error.message : 'Failed to send message' });
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
      // Permission check: chats.respond
      const canRespond = await hasPermission(agentId, 'chats.respond');
      if (!canRespond) {
        return callback({ ok: false, error: 'No tienes permiso para responder en los chats (chats.respond)' });
      }

      const session = await getSessionById(sessionId);

      if (!session) {
        return callback({ ok: false, error: 'Session not found' });
      }

      // Get absolute path for the image
      const imagePath = getAbsolutePath(url);

      // Send to Telegram with error handling
      let sent = false;
      try {
        sent = await sendPhoto(session.telegramChatId, imagePath, { caption });
      } catch (telegramError) {
        const { handled, reason } = await telegramErrorHandler.handleError(
          telegramError as Error,
          session.telegramChatId,
          sessionId
        );

        if (handled) {
          return callback({
            ok: false,
            error: `No se puede enviar: ${reason === 'bot_blocked' ? 'El usuario bloqueó el bot' : 'Usuario no disponible'}`,
            data: { code: 'USER_BLOCKED', reason },
          });
        }
        throw telegramError;
      }

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

      // Ensure this socket is in the session room
      const room = `session:${sessionId}`;
      if (!socket.rooms.has(room)) {
        socket.join(room);
      }

      // Broadcast to session room
      io.to(room).emit('message:new', {
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
      callback({ ok: false, error: error instanceof Error ? error.message : 'Failed to send image' });
    }
  });

  // Send file/document to user
  socket.on('message:sendFile', async ({ sessionId, url, filename, caption }, callback) => {
    try {
      // Permission check: chats.respond
      const canRespond = await hasPermission(agentId, 'chats.respond');
      if (!canRespond) {
        return callback({ ok: false, error: 'No tienes permiso para responder en los chats (chats.respond)' });
      }

      const session = await getSessionById(sessionId);

      if (!session) {
        return callback({ ok: false, error: 'Session not found' });
      }

      // Get absolute path for the file
      const filePath = getAbsolutePath(url);

      // Send to Telegram with error handling
      let sent = false;
      try {
        sent = await sendDocument(session.telegramChatId, filePath, { caption, fileName: filename });
      } catch (telegramError) {
        const { handled, reason } = await telegramErrorHandler.handleError(
          telegramError as Error,
          session.telegramChatId,
          sessionId
        );

        if (handled) {
          return callback({
            ok: false,
            error: `No se puede enviar: ${reason === 'bot_blocked' ? 'El usuario bloqueó el bot' : 'Usuario no disponible'}`,
            data: { code: 'USER_BLOCKED', reason },
          });
        }
        throw telegramError;
      }

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

      // Ensure socket is in session room before broadcasting
      const room = `session:${sessionId}`;
      if (!socket.rooms.has(room)) {
        socket.join(room);
        logger.debug('api', { action: 'auto_joined_session_room', sessionId, socketId: socket.id });
      }

      // Broadcast to session room
      io.to(room).emit('message:new', {
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
      callback({ ok: false, error: error instanceof Error ? error.message : 'Failed to send file' });
    }
  });

  // Send voice message to user
  socket.on('message:sendVoice', async ({ sessionId, url }, callback) => {
    try {
      // Permission check: chats.respond
      const canRespond = await hasPermission(agentId, 'chats.respond');
      if (!canRespond) {
        return callback({ ok: false, error: 'No tienes permiso para responder en los chats (chats.respond)' });
      }

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

      // Ensure socket is in session room before broadcasting
      const room = `session:${sessionId}`;
      if (!socket.rooms.has(room)) {
        socket.join(room);
        logger.debug('api', { action: 'auto_joined_session_room', sessionId, socketId: socket.id });
      }

      // Broadcast to session room
      io.to(room).emit('message:new', {
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
      callback({ ok: false, error: error instanceof Error ? error.message : 'Failed to send voice' });
    }
  });

  // ============= MESSAGE ACTIONS =============

  // Edit message
  socket.on('message:edit', async ({ messageId, sessionId, newContent }, callback?) => {
    try {
      const message = await Message.findById(messageId).populate('session');

      if (!message) {
        callback?.({ ok: false, error: 'Message not found' });
        return;
      }

      // Verify ownership - only the agent who sent can edit
      const senderAgent = message.senderAgent as any;
      if (message.sender !== 'agent' || senderAgent?._id?.toString() !== agentId) {
        callback?.({ ok: false, error: 'Not authorized to edit this message' });
        return;
      }

      // Check if message is less than 48h old (Telegram limit is 48h)
      const messageAge = Date.now() - new Date(message.createdAt).getTime();
      if (messageAge > 48 * 60 * 60 * 1000) {
        callback?.({ ok: false, error: 'Cannot edit messages older than 48 hours' });
        return;
      }

      // Store previous version
      const previousContent = message.content;

      // Try to edit in Telegram if we have the telegram message ID
      const session = message.session as any;
      if (message.telegramMessageId && session?.telegramChatId) {
        try {
          await editTelegramMessage(
            session.telegramChatId,
            message.telegramMessageId,
            newContent
          );
        } catch (telegramError) {
          logger.warn('chat', {
            action: 'telegram_edit_failed',
            messageId,
            error: String(telegramError)
          });
          // Continue with DB update even if Telegram edit fails
        }
      }

      // Update message in database
      message.content = newContent;
      message.isEdited = true;
      message.editedAt = new Date();
      message.previousContent = previousContent;
      await message.save();

      // Broadcast update
      io.to(`session:${sessionId}`).emit('message:updated', {
        _id: message._id.toString(),
        session: sessionId,
        sender: message.sender,
        senderAgent: { name: agent?.name || 'Agent' },
        content: message.content,
        messageType: message.messageType,
        isEdited: true,
        editedAt: message.editedAt,
        createdAt: message.createdAt,
      });

      logger.info('chat', { action: 'message_edited', messageId, agentId });
      callback?.({ ok: true, data: message });
    } catch (error) {
      logger.error('api', { action: 'message_edit_error', error: String(error) });
      callback?.({ ok: false, error: 'Failed to edit message' });
    }
  });

  // Delete message
  socket.on('message:delete', async ({ messageId, sessionId }, callback?) => {
    try {
      const message = await Message.findById(messageId).populate('session');

      if (!message) {
        callback?.({ ok: false, error: 'Message not found' });
        return;
      }

      // Verify ownership
      const senderAgent = message.senderAgent as any;
      if (message.sender !== 'agent' || senderAgent?._id?.toString() !== agentId) {
        callback?.({ ok: false, error: 'Not authorized to delete this message' });
        return;
      }

      // Try to delete in Telegram if we have the telegram message ID
      const session = message.session as any;
      if (message.telegramMessageId && session?.telegramChatId) {
        try {
          await deleteTelegramMessage(session.telegramChatId, message.telegramMessageId);
          logger.info('chat', { action: 'telegram_message_deleted', messageId, telegramMessageId: message.telegramMessageId });
        } catch (telegramError) {
          logger.warn('chat', {
            action: 'telegram_delete_failed',
            messageId,
            error: String(telegramError)
          });
          // Continue with DB update even if Telegram delete fails
        }
      }

      // Soft delete - replace content
      message.content = 'Mensaje eliminado por el agente';
      message.messageType = 'system';
      (message as any).isDeleted = true;
      (message as any).deletedAt = new Date();
      (message as any).deletedBy = agentId;
      await message.save();

      // Broadcast deletion
      io.to(`session:${sessionId}`).emit('message:deleted', { messageId, sessionId });

      logger.info('chat', { action: 'message_deleted', messageId, agentId });
      callback?.({ ok: true });
    } catch (error) {
      logger.error('api', { action: 'message_delete_error', error: String(error) });
      callback?.({ ok: false, error: 'Failed to delete message' });
    }
  });

  // Pin message
  socket.on('message:pin', async ({ messageId, sessionId, pinForUser }, callback?) => {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        callback?.({ ok: false, error: 'Message not found' });
        return;
      }

      // Unpin any existing pinned message in this session
      await Message.updateMany(
        { session: message.session, isPinned: true },
        { isPinned: false }
      );

      // Pin this message
      (message as any).isPinned = true;
      (message as any).pinnedAt = new Date();
      (message as any).pinnedBy = agentId;
      await message.save();

      // Broadcast pin
      io.to(`session:${sessionId}`).emit('message:pinned', {
        messageId,
        sessionId,
        pinForUser,
        message: {
          _id: message._id.toString(),
          session: sessionId,
          sender: message.sender,
          content: message.content,
          createdAt: message.createdAt,
        },
      });

      const addMessageResult = await addMessage(sessionId, 'agent', `Agent ${agent?.name} pinned a message`, {
        senderAgentId: agentId,
        messageType: 'system',
      });
      
      const messageData = {
        _id: addMessageResult && addMessageResult._id ? addMessageResult._id.toString() : '',
        session: sessionId,
        sender: 'bot',
        content: `Agent ${agent?.name} pinned a message`,
        messageType: 'system' as const,
        createdAt: addMessageResult && addMessageResult.createdAt ? addMessageResult.createdAt : new Date(),
      };
      
      io.to(`session:${sessionId}`).emit('message:new', messageData);

      if (pinForUser && message && message.telegramMessageId) {
        const session = await getSessionById(sessionId);
        if (session?.telegramChatId) {
          await pinChatMessage(session.telegramChatId, message?.telegramMessageId);
        }
      }
      
      logger.info('chat', { action: 'message_pinned', messageId, agentId });
      callback?.({ ok: true });
    } catch (error) {
      logger.error('api', { action: 'message_pin_error', error: String(error) });
      callback?.({ ok: false, error: 'Failed to pin message' });
    }
  });

  // Unpin message
  socket.on('message:unpin', async ({ messageId, sessionId }, callback?) => {
    try {
      const message = await Message.findById(messageId);

      if (!message) {
        callback?.({ ok: false, error: 'Message not found' });
        return;
      }

      (message as any).isPinned = false;
      await message.save();

      io.to(`session:${sessionId}`).emit('message:unpinned', { sessionId });

      logger.info('chat', { action: 'message_unpinned', messageId, agentId });
      callback?.({ ok: true });
    } catch (error) {
      logger.error('api', { action: 'message_unpin_error', error: String(error) });
      callback?.({ ok: false, error: 'Failed to unpin message' });
    }
  });

  // Report spam
  socket.on('message:reportSpam', async ({ messageId, sessionId }, callback?) => {
    try {
      const message = await Message.findById(messageId);
      const session = await getSessionById(sessionId);

      if (!message || !session) {
        callback?.({ ok: false, error: 'Message or session not found' });
        return;
      }

      // Mark message as spam
      (message as any).isSpam = true;
      (message as any).reportedAt = new Date();
      (message as any).reportedBy = agentId;
      await message.save();

      // Optionally block user
      logger.warn('api', {
        action: 'spam_reported',
        messageId,
        sessionId,
        agentId,
        userId: session.user,
      });

      callback?.({ ok: true });
    } catch (error) {
      logger.error('api', { action: 'report_spam_error', error: String(error) });
      callback?.({ ok: false, error: 'Failed to report spam' });
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
      // Permission check: chats.transfer
      const canTransfer = await hasPermission(agentId, 'chats.transfer');
      if (!canTransfer) {
        callback?.({ ok: false, error: 'No tienes permiso para transferir chats (chats.transfer)' });
        return;
      }

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

      // 🔔 Trigger scheduled messages for chat_transferred event
      triggerEventMessages('chat_transferred', sessionId, {
        fromAgentId: agentId,
        toAgentId
      }).catch(err => logger.error('api', {
        action: 'scheduled_messages_trigger_error',
        event: 'chat_transferred',
        sessionId,
        error: String(err)
      }));

      callback?.({ ok: true, data: result });
    } catch (error) {
      logger.error('api', { action: 'transfer_error', error: String(error) });
      callback?.({ ok: false, error: String(error) });
    }
  });

  // ============= REOPEN HANDLER =============

  socket.on('session:reopen', async ({ sessionId }, callback?) => {
    try {
      // Permission check: chats.reopen
      const canReopen = await hasPermission(agentId, 'chats.reopen');
      if (!canReopen) {
        callback?.({ ok: false, error: 'No tienes permiso para reabrir chats (chats.reopen)' });
        return;
      }

      const { role } = socket.data;
      const session = await reopenSession(sessionId, agentId, role);

      if (!session) {
        callback?.({ ok: false, error: 'Session not found' });
        return;
      }

      // Notify all agents
      io.emit('session:reopened', { sessionId, reopenedBy: agent?.name || 'Admin' });
      io.emit('session:new', formatSessionData(session));

      // 🔔 Trigger scheduled messages for chat_reopened event
      triggerEventMessages('chat_reopened', sessionId, {
        reopenedBy: agentId
      }).catch(err => logger.error('api', {
        action: 'scheduled_messages_trigger_error',
        event: 'chat_reopened',
        sessionId,
        error: String(err)
      }));

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
    const oldAgent = await Agent.findById(agentId);
    const oldStatus = oldAgent?.onlineStatus;

    await updateAgentStatus(agentId, status);
    io.emit('agent:status', { agentId, status });
    await broadcastStats();

    // Log status change activity
    if (oldStatus !== status) {
      const { logActivity } = await import('../database/models/AgentActivity.js');
      await logActivity(agentId, 'status_change', `Changed status from ${oldStatus} to ${status}`, {
        metadata: { from: oldStatus, to: status }
      });
    }
  });

  // Request full sync (for manual refresh)
  socket.on('agent:requestSync', async (callback) => {
    try {
      const syncState = await getAgentSyncState(agentId);
      if (!syncState.agent) {
        return callback({ ok: false, error: 'Agent not found' });
      }

      const availability = getAvailabilityStatus(syncState.agent);

      socket.emit('sync:state', {
        agent: {
          _id: syncState.agent._id.toString(),
          name: syncState.agent.name,
          email: syncState.agent.email,
          role: syncState.agent.role,
          onlineStatus: syncState.agent.onlineStatus,
          availability,
          activeChats: syncState.agent.activeChats,
          avatar: syncState.agent.avatar,
        },
        mySessions: syncState.mySessions.map(formatSessionData),
        queuedSessions: syncState.queuedSessions.map(formatSessionData),
        stats: syncState.stats,
        reconnected: false,
        recoveredSessions: 0,
      });

      callback({ ok: true });
    } catch (error) {
      callback({ ok: false, error: 'Failed to sync state' });
    }
  });

  // ============= DATA REQUESTS =============

  socket.on('stats:request', async (callback) => {
    const stats = await getDashboardStats();
    callback(stats);
  });

  socket.on('sessions:request', async (callback) => {
    const isAdmin = socket.data.role === 'admin';
    const sessions = await getVisibleSessionsForAgent(agentId, isAdmin);
    callback(sessions.map(formatSessionData));
  });

  // ============= SESSION GUARD (SINGLE SESSION/TAB) =============

  // Register browser session - called after login
  socket.on('session:register', async ({ browserSessionId, device }, callback) => {
    try {
      // Get IP from socket handshake
      const ip = socket.handshake.headers['x-forwarded-for'] as string ||
        socket.handshake.address ||
        'unknown';

      // IMPORTANT: Get old socket BEFORE registering (it was stored before this handler)
      // We need to find the old socket by checking all sockets for this agent
      let oldSocketToDisconnect: typeof socket | null = null;

      // Find any other socket for this agent that isn't the current one
      for (const [, s] of io.sockets.sockets) {
        if (s.data.agentId === agentId && s.id !== socket.id) {
          oldSocketToDisconnect = s as typeof socket;
          break;
        }
      }

      // Register the session
      const result = await registerSession(agentId, socket.id, browserSessionId, {
        device,
        ip: Array.isArray(ip) ? ip[0] : ip,
      });

      // Store browserSessionId in socket data for validation
      socket.data.browserSessionId = browserSessionId;

      // If there's an old socket, notify and disconnect it
      if (oldSocketToDisconnect) {
        logger.info('api', {
          action: 'forcing_old_session_disconnect',
          agentId,
          oldSocketId: oldSocketToDisconnect.id,
          newSocketId: socket.id,
        });

        // Emit to the old socket
        oldSocketToDisconnect.emit('session:replaced', {
          reason: 'Sesión iniciada en otro dispositivo',
          newDevice: device,
          newIp: Array.isArray(ip) ? ip[0] : ip,
          replacedAt: new Date().toISOString(),
        });

        // Force disconnect the old socket after a short delay
        setTimeout(() => {
          oldSocketToDisconnect?.emit('session:force_logout', { reason: 'Sesión reemplazada por nuevo inicio' });
          oldSocketToDisconnect?.disconnect(true);
        }, 500);
      }

      // Update socket reference to new socket
      agentSockets.set(agentId, socket);

      logger.info('api', {
        action: 'session_registered',
        agentId,
        browserSessionId,
        replaced: result.replaced || !!oldSocketToDisconnect,
      });

      callback({ ok: true, data: { replaced: result.replaced || !!oldSocketToDisconnect } });
    } catch (error) {
      logger.error('api', {
        action: 'session_register_error',
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      callback({ ok: false, error: 'Failed to register session' });
    }
  });

  // Validate session is still active
  socket.on('session:validate', async ({ browserSessionId }, callback) => {
    try {
      const result = await validateSession(agentId, browserSessionId);

      if (!result.valid && result.replaced) {
        // Session was replaced, force logout
        socket.emit('session:force_logout', { reason: 'Sesión reemplazada' });
        callback({ ok: false, error: 'Session replaced' });
        return;
      }

      callback({ ok: result.valid });
    } catch (error) {
      callback({ ok: false, error: 'Validation failed' });
    }
  });

  // Register tab for /chat page (multi-tab prevention)
  // socket.on('tab:register', async ({ tabId }, callback) => {
  //   try {
  //     const result = await registerChatTab(agentId, tabId, socket.id);

  //     if (result.isBlocked) {
  //       // Another tab is active
  //       socket.emit('tab:duplicate_detected', {
  //         activeTabId: result.activeTabId || 'unknown',
  //         message: 'Chat abierto en otra pestaña',
  //       });
  //       callback({ ok: false, error: 'duplicate_tab', data: { blocked: true } });
  //       return;
  //     }

  //     callback({ ok: true });
  //   } catch (error) {
  //     callback({ ok: false, error: 'Tab registration failed' });
  //   }
  // });

  // // Tab heartbeat
  // socket.on('tab:heartbeat', async ({ tabId }, callback) => {
  //   try {
  //     const isActive = await heartbeatTab(agentId, tabId);

  //     if (!isActive) {
  //       // This tab is no longer active
  //       socket.emit('tab:duplicate_detected', {
  //         activeTabId: 'another',
  //         message: 'Otra pestaña tomó el control',
  //       });
  //       callback({ ok: false, error: 'not_active_tab' });
  //       return;
  //     }

  //     callback({ ok: true });
  //   } catch (error) {
  //     callback({ ok: false, error: 'Heartbeat failed' });
  //   }
  // });

  // // Release tab lock
  // socket.on('tab:release', async ({ tabId }) => {
  //   try {
  //     await releaseChatTab(agentId, tabId);
  //   } catch (error) {
  //     // Silent fail
  //   }
  // });

  // ============= DISCONNECTION =============

  socket.on('disconnect', async () => {
    logger.info('api', { action: 'agent_disconnected', agentId, email, socketId: socket.id });

    agentSockets.delete(agentId);

    // Handle disconnection with chat reassignment
    const { affectedSessions } = await handleAgentDisconnection(agentId);

    // Notify about affected sessions going to queue
    for (const session of affectedSessions) {
      io.emit('session:queued', formatSessionData(session));
    }

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
      photoFileId: session.user?.photoFileId,
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
  const [sessionStats, agentStats] = await Promise.all([
    getSessionStats(),
    getAgentStats(),
  ]);

  // Extend agent stats with availability info
  const agents = {
    ...agentStats,
    available: 0, // Will be calculated
    busy: 0,
  };

  // Calculate available vs busy agents
  const { Agent } = await import('../database/models/Agent.js');
  const onlineAgents = await Agent.find({ onlineStatus: { $in: ['online', 'away'] } });
  for (const agent of onlineAgents) {
    if (agent.activeChats >= MAX_CONCURRENT_CHATS) {
      agents.busy++;
    } else {
      agents.available++;
    }
  }

  return { sessions: sessionStats, agents };
}

async function broadcastStats(): Promise<void> {
  const stats = await getDashboardStats();
  io.emit('stats:update', stats);
}

// ============= EXPORTED FUNCTIONS FOR BOT =============

/**
 * Notify agents of new waiting/queued session
 * All agents can see sessions in queue
 */
export async function notifyNewSession(session: any): Promise<void> {
  if (!io) return;

  // For sessions entering queue, emit session:queued
  if (session.status === 'queued' || session.status === 'waiting') {
    io.emit('session:queued', formatSessionData(session));
  } else {
    io.emit('session:new', formatSessionData(session));
  }

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

  // Emit to session room if assigned, or to all agents if in queue (waiting/queued)
  if (session.status === 'human') {
    const room = `session:${sessionId}`;
    const socketsInRoom = await io.in(room).fetchSockets();
    logger.info('api', {
      action: 'emit_message_to_room',
      sessionId,
      room,
      socketsCount: socketsInRoom.length,
      socketIds: socketsInRoom.map(s => s.id)
    });
    io.to(room).emit('message:new', messageData);
  } else if (session.status === 'waiting' || session.status === 'queued') {
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

  // Emit to session room if assigned, or to all agents if in queue (waiting/queued)
  if (session.status === 'human') {
    io.to(`session:${sessionId}`).emit('message:new', messageData);
  } else if (session.status === 'waiting' || session.status === 'queued') {
    io.emit('message:new', messageData);
  }
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
  closedBy: 'inactivity' | 'user' | 'agent' | 'automation' | 'system'
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

// ============= SUPERVISOR & WHISPER EVENTS =============

/**
 * Emit whisper to specific agent
 * Whispers are private messages from supervisors to agents
 */
export function emitWhisper(
  targetAgentId: string,
  whisper: {
    id: string;
    sessionId: string;
    supervisorId: string;
    supervisorName: string;
    content: string;
    createdAt: Date;
  }
): void {
  if (!io) return;

  const targetSocket = agentSockets.get(targetAgentId);
  if (targetSocket) {
    targetSocket.emit('whisper:new' as any, whisper);
  }
}

/**
 * Emit session watch event (supervisor started watching)
 */
export function emitSessionWatch(
  sessionId: string,
  data: {
    supervisorId: string;
    supervisorName: string;
    action: 'start' | 'stop';
  }
): void {
  if (!io) return;

  // Emit to session room
  io.to(`session:${sessionId}`).emit('session:watched' as any, {
    sessionId,
    ...data,
  });
}

/**
 * Emit session takeover event (supervisor took over)
 */
export function emitSessionTakeover(
  sessionId: string,
  data: {
    previousAgentId: string;
    previousAgentName: string;
    newAgentId: string;
    newAgentName: string;
    reason: string;
  }
): void {
  if (!io) return;

  // Notify previous agent
  const prevSocket = agentSockets.get(data.previousAgentId);
  if (prevSocket) {
    prevSocket.emit('session:takenOver' as any, {
      sessionId,
      takenBy: { id: data.newAgentId, name: data.newAgentName },
      reason: data.reason,
    });
  }

  // Broadcast assignment update
  io.emit('session:assigned', {
    sessionId,
    agentId: data.newAgentId,
    agentName: data.newAgentName,
  });

  // Update stats
  broadcastStats();
}

/**
 * Emit agent stats update (for supervisor dashboard)
 */
export function emitAgentStatsUpdate(agentId: string, stats: {
  activeChats: number;
  resolvedToday: number;
  avgResponseTime: number;
}): void {
  if (!io) return;

  // Only emit to supervisors/admins
  io.fetchSockets().then(sockets => {
    sockets.forEach(socket => {
      if (socket.data.role === 'admin' || socket.data.role === 'supervisor') {
        socket.emit('agent:statsUpdate' as any, { agentId, ...stats });
      }
    });
  });
}

/**
 * Emit activity log event (for sidebar timeline)
 */
export function emitActivityLog(
  sessionId: string,
  activity: {
    type: string;
    description: string;
    agentId?: string;
    agentName?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  }
): void {
  if (!io) return;

  io.to(`session:${sessionId}`).emit('activity:new' as any, {
    sessionId,
    ...activity,
  });
}

/**
 * Emit copilot suggestion (AI suggestion for agent)
 */
export function emitCopilotSuggestion(
  agentId: string,
  sessionId: string,
  suggestion: {
    id: string;
    type: 'response' | 'summary' | 'category';
    content: string;
    confidence: number;
  }
): void {
  if (!io) return;

  const targetSocket = agentSockets.get(agentId);
  if (targetSocket) {
    targetSocket.emit('copilot:suggestion' as any, {
      sessionId,
      ...suggestion,
    });
  }
}

/**
 * Emit automation rule triggered event
 */
export function emitRuleTriggered(
  sessionId: string,
  rule: {
    id: string;
    name: string;
    action: string;
    result: 'success' | 'failure';
  }
): void {
  if (!io) return;

  // Emit to admins and session room
  io.to(`session:${sessionId}`).emit('automation:triggered' as any, {
    sessionId,
    ...rule,
  });
}

/**
 * Emit flow updated event (for hot-reload)
 * Notifies all connected admins/supervisors when a flow is published/updated
 */
export function emitFlowUpdated(
  flowId: string,
  action: 'published' | 'unpublished' | 'updated' | 'deleted',
  version?: number,
  flowName?: string
): void {
  if (!io) return;

  // Emit to all connected clients (admins/supervisors will handle it)
  io.emit('flow:updated', {
    flowId,
    action,
    version,
    flowName,
  });

  logger.info('flow', {
    event: 'flow:updated',
    flowId,
    action,
    version
  });
}

// ============= SYSTEM MONITORING EVENTS =============

/**
 * Emit queue stats update (for admin monitoring dashboard)
 */
export function emitSystemQueueUpdate(data: {
  queue: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}): void {
  if (!io) return;

  // Only emit to admin/supervisor sockets
  io.emit('system:queue:update', data);
}

/**
 * Emit job added event
 */
export function emitSystemJobAdded(data: {
  queue: string;
  jobId: string;
  jobName: string;
  delay?: number;
}): void {
  if (!io) return;
  io.emit('system:job:added', data);
}

/**
 * Emit job completed event
 */
export function emitSystemJobCompleted(data: {
  queue: string;
  jobId: string;
  jobName: string;
  durationMs: number;
}): void {
  if (!io) return;
  io.emit('system:job:completed', data);
}

/**
 * Emit job failed event
 */
export function emitSystemJobFailed(data: {
  queue: string;
  jobId: string;
  jobName: string;
  error: string;
  attempt: number;
}): void {
  if (!io) return;
  io.emit('system:job:failed', data);
}

/**
 * Emit worker online event
 */
export function emitSystemWorkerOnline(workerId: string, queue: string): void {
  if (!io) return;
  io.emit('system:worker:online', { workerId, queue });
}

/**
 * Emit worker offline event
 */
export function emitSystemWorkerOffline(workerId: string, queue: string): void {
  if (!io) return;
  io.emit('system:worker:offline', { workerId, queue });
}

/**
 * Emit Redis status change
 */
export function emitSystemRedisStatus(connected: boolean, latencyMs?: number): void {
  if (!io) return;
  io.emit('system:redis:status', { connected, latencyMs });
}

/**
 * Emit permissions updated event to a specific agent
 * Used when an agent's permission overrides are changed
 */
export async function emitPermissionsUpdated(
  agentId: string,
  data: {
    permissions: string[];
    role: string;
    permissionVersion: number;
    updatedBy: { id: string; name: string };
  }
): Promise<void> {
  if (!io) return;
  
  const eventData = {
    agentId,
    permissions: data.permissions,
    role: data.role,
    permissionVersion: data.permissionVersion,
    updatedBy: data.updatedBy,
    timestamp: new Date().toISOString(),
  };
  
  // Find the agent's socket by their agentId in socket.data
  const sockets = await io.fetchSockets();
  const agentSocket = sockets.find(s => s.data.agentId === agentId);
  
  if (agentSocket) {
    // Emit directly to the agent's socket
    agentSocket.emit('permissions:updated', eventData);
  }
  
  // Also emit to admin room for monitoring
  io.to('admin').emit('permissions:updated', eventData);
}

/**
 * Emit role changed event to a specific agent
 * Used when an agent's role is changed (affects base permissions)
 */
export async function emitRoleChanged(
  agentId: string,
  data: {
    oldRole: string;
    newRole: string;
    permissions: string[];
    permissionVersion: number;
    updatedBy: { id: string; name: string };
  }
): Promise<void> {
  if (!io) return;
  
  const eventData = {
    agentId,
    oldRole: data.oldRole,
    newRole: data.newRole,
    permissions: data.permissions,
    permissionVersion: data.permissionVersion,
    updatedBy: data.updatedBy,
    timestamp: new Date().toISOString(),
  };
  
  // Find the agent's socket by their agentId in socket.data
  const sockets = await io.fetchSockets();
  const agentSocket = sockets.find(s => s.data.agentId === agentId);
  
  if (agentSocket) {
    // Emit directly to the agent's socket
    agentSocket.emit('permissions:role_changed', eventData);
  }
  
  // Also emit to admin room for monitoring
  io.to('admin').emit('permissions:role_changed', eventData);
}

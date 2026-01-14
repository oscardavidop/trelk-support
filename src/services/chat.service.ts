/**
 * Chat Session Database Service
 * Manages chat sessions between users and support
 */

import { v4 as uuidv4 } from 'uuid';
import { ChatSession, Message, type IChatSession, type IMessage, type SessionStatus, type MessageSender, type ClosedByType } from '../database/index.js';
import type { IUser } from '../database/models/User.js';
import { Types } from 'mongoose';
import { sendPostChatSurvey } from './survey.service.js';
import { logActivity } from './activity-log.service.js';

/**
 * Get or create active session for a user
 */
export async function getOrCreateSession(user: IUser, telegramChatId: number): Promise<IChatSession> {
  // Find existing active session
  let session = await ChatSession.findOne({
    user: user._id,
    status: { $in: ['bot', 'waiting', 'human'] },
  });
  
  if (session) {
    return session;
  }
  
  // Create new session
  session = await ChatSession.create({
    sessionId: generateSessionId(),
    user: user._id,
    telegramChatId,
    status: 'bot',
  });

  // Log session creation
  await logActivity({
    sessionId: session.sessionId,
    action: 'session_created',
    actorType: 'user',
    actorId: user._id.toString(),
    actorName: user.firstName || 'User',
    metadata: { userId: user._id.toString(), telegramChatId },
    description: `Session started by ${user.firstName || 'user'}`,
  });
  
  return session;
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().slice(0, 6).toUpperCase();
  return `CS-${timestamp.slice(-4)}-${random}`;
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  sessionId: string, 
  status: SessionStatus,
  agentId?: string
): Promise<IChatSession | null> {
  const update: Record<string, unknown> = { status };
  
  if (status === 'human' && agentId) {
    update.assignedAgent = new Types.ObjectId(agentId);
  }
  
  if (status === 'closed') {
    update.closedAt = new Date();
  }
  
  return ChatSession.findOneAndUpdate(
    { sessionId },
    update,
    { new: true }
  ).populate('user').populate('assignedAgent');
}

/**
 * Transfer session to human support
 */
export async function transferToHuman(sessionId: string, category?: string): Promise<IChatSession | null> {
  return ChatSession.findOneAndUpdate(
    { sessionId },
    { 
      status: 'waiting',
      category,
    },
    { new: true }
  );
}

/**
 * Assign agent to session
 */
export async function assignAgent(sessionId: string, agentId: string, agentName?: string): Promise<IChatSession | null> {
  const session = await ChatSession.findOneAndUpdate(
    { sessionId },
    { 
      status: 'human',
      assignedAgent: new Types.ObjectId(agentId),
    },
    { new: true }
  ).populate('user').populate('assignedAgent');

  // Log the assignment activity
  if (session) {
    const agent = session.assignedAgent as any;
    await logActivity({
      sessionId,
      action: 'session_assigned',
      actorType: 'agent',
      actorId: agentId,
      actorName: agentName || agent?.name || 'Agent',
      metadata: { agentId, agentName: agentName || agent?.name },
      description: `Assigned to ${agentName || agent?.name || 'agent'}`,
    });
  }

  return session;
}

/**
 * Close session
 */
export async function closeSession(
  sessionId: string, 
  agentId: string | null, 
  reason?: string,
  closedByType: ClosedByType = 'agent',
  agentName?: string
): Promise<IChatSession | null> {
  const updateData: Record<string, unknown> = { 
    status: 'closed',
    closedAt: new Date(),
    closureReason: reason,
    closedByType,
  };

  if (agentId) {
    updateData.closedBy = new Types.ObjectId(agentId);
  }

  const session = await ChatSession.findOneAndUpdate(
    { sessionId },
    updateData,
    { new: true }
  );

  // Log the close activity
  if (session) {
    await logActivity({
      sessionId,
      action: 'session_closed',
      actorType: closedByType === 'system' ? 'system' : closedByType === 'user' ? 'user' : 'agent',
      actorId: agentId || undefined,
      actorName: agentName || (closedByType === 'system' ? 'System' : closedByType === 'user' ? 'User' : 'Agent'),
      metadata: { reason, closedByType },
      description: `Session closed${reason ? `: ${reason}` : ''}`,
    });
  }

  // Send post-chat satisfaction survey
  if (session && (closedByType === 'agent' || closedByType === 'system' || closedByType == 'user')) {
    // Delay slightly to allow close message to be sent first
    setTimeout(async () => {
      await sendPostChatSurvey(sessionId);
    }, 2000);
  }

  return session;
}

/**
 * Get session by ID
 */
export async function getSessionById(sessionId: string): Promise<IChatSession | null> {
  return ChatSession.findOne({ sessionId })
    .populate('user')
    .populate('assignedAgent');
}

/**
 * Get session by Telegram chat ID
 */
export async function getActiveSessionByTelegramChatId(telegramChatId: number): Promise<IChatSession | null> {
  return ChatSession.findOne({
    telegramChatId,
    status: { $in: ['bot', 'waiting', 'human'] },
  }).populate('user').populate('assignedAgent');
}

/**
 * Get sessions by status
 */
export async function getSessionsByStatus(status: SessionStatus, limit = 50): Promise<IChatSession[]> {
  return ChatSession.find({ status })
    .populate('user')
    .populate('assignedAgent')
    .sort({ updatedAt: -1 })
    .limit(limit);
}

/**
 * Get waiting sessions (for agent queue)
 */
export async function getWaitingSessions(): Promise<IChatSession[]> {
  return ChatSession.find({ status: 'waiting' })
    .populate('user')
    .sort({ createdAt: 1 }); // Oldest first (FIFO)
}

/**
 * Get agent's active sessions
 */
export async function getAgentSessions(agentId: string): Promise<IChatSession[]> {
  return ChatSession.find({ 
    assignedAgent: new Types.ObjectId(agentId),
    status: 'human',
  })
    .populate('user')
    .sort({ updatedAt: -1 });
}

/**
 * Get all active sessions (for dashboard)
 */
export async function getAllActiveSessions(): Promise<IChatSession[]> {
  return ChatSession.find({ 
    status: { $in: ['bot', 'queued', 'waiting', 'human'] },
  })
    .populate('user')
    .populate('assignedAgent')
    .sort({ updatedAt: -1 });
}

// ============= AGENT-FILTERED SESSION QUERIES =============

/**
 * Get visible sessions for a specific agent
 * An agent can only see:
 * - Sessions assigned to them
 * - Sessions in queue (waiting for assignment)
 */
export async function getVisibleSessionsForAgent(agentId: string, isAdmin = false): Promise<IChatSession[]> {
  // Admins see everything
  if (isAdmin) {
    return ChatSession.find({ 
      status: { $in: ['bot', 'queued', 'waiting', 'human'] },
    })
      .populate('user')
      .populate('assignedAgent')
      .sort({ updatedAt: -1 });
  }
  
  // Regular agents see only their sessions + queue
  return ChatSession.find({
    $or: [
      { assignedAgent: new Types.ObjectId(agentId), status: 'human' },
      { status: { $in: ['queued', 'waiting'] } },
    ],
  })
    .populate('user')
    .populate('assignedAgent')
    .sort({ updatedAt: -1 });
}

/**
 * Get queue - sessions waiting for assignment
 */
export async function getQueuedSessions(): Promise<IChatSession[]> {
  return ChatSession.find({ 
    status: { $in: ['queued', 'waiting'] },
    assignedAgent: { $exists: false },
  })
    .populate('user')
    .sort({ createdAt: 1 }); // FIFO - oldest first
}

/**
 * Get queue count
 */
export async function getQueueCount(): Promise<number> {
  return ChatSession.countDocuments({ 
    status: { $in: ['queued', 'waiting'] },
    assignedAgent: { $exists: false },
  });
}

/**
 * Add session to queue
 */
export async function addToQueue(sessionId: string, category?: string): Promise<IChatSession | null> {
  return ChatSession.findOneAndUpdate(
    { sessionId },
    { 
      status: 'queued',
      category,
      assignedAgent: undefined, // Clear any previous assignment
    },
    { new: true }
  ).populate('user');
}

/**
 * Get next session from queue (FIFO)
 */
export async function getNextFromQueue(): Promise<IChatSession | null> {
  return ChatSession.findOne({ 
    status: { $in: ['queued', 'waiting'] },
    assignedAgent: { $exists: false },
  })
    .sort({ createdAt: 1 }) // Oldest first
    .populate('user');
}

/**
 * Auto-assign next queued session to agent
 */
export async function autoAssignFromQueue(agentId: string): Promise<IChatSession | null> {
  const nextSession = await getNextFromQueue();
  
  if (!nextSession) {
    return null;
  }
  
  return ChatSession.findOneAndUpdate(
    { 
      _id: nextSession._id,
      status: { $in: ['queued', 'waiting'] }, // Double-check status
      assignedAgent: { $exists: false }, // Ensure still unassigned
    },
    { 
      status: 'human',
      assignedAgent: new Types.ObjectId(agentId),
    },
    { new: true }
  ).populate('user').populate('assignedAgent');
}

/**
 * Get closed sessions visible to agent
 * Regular agents only see sessions they closed
 * Admins see all
 */
export async function getClosedSessionsForAgent(
  agentId: string, 
  isAdmin = false,
  filters?: { page?: number; limit?: number; search?: string }
): Promise<PaginatedSessions> {
  const { page = 1, limit = 50, search } = filters || {};
  
  // Build query
  const query: Record<string, unknown> = { status: 'closed' };
  
  // Non-admins only see their own closed sessions
  if (!isAdmin) {
    query.closedBy = new Types.ObjectId(agentId);
  }
  
  let totalCount: number;
  let sessions: IChatSession[];
  
  if (search) {
    // Search with user lookup
    const pipeline: any[] = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: '$userDoc' },
      {
        $match: {
          $or: [
            { 'userDoc.username': { $regex: search, $options: 'i' } },
            { 'userDoc.firstName': { $regex: search, $options: 'i' } },
            { sessionId: { $regex: search, $options: 'i' } },
          ],
        },
      },
    ];
    
    const countResult = await ChatSession.aggregate([...pipeline, { $count: 'total' }]);
    totalCount = countResult[0]?.total || 0;
    
    const dataPipeline = [
      ...pipeline,
      { $sort: { closedAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: 'agents',
          localField: 'assignedAgent',
          foreignField: '_id',
          as: 'agentDoc',
        },
      },
      {
        $lookup: {
          from: 'agents',
          localField: 'closedBy',
          foreignField: '_id',
          as: 'closedByDoc',
        },
      },
      {
        $addFields: {
          user: '$userDoc',
          assignedAgent: { $arrayElemAt: ['$agentDoc', 0] },
          closedBy: { $arrayElemAt: ['$closedByDoc', 0] },
        },
      },
      { $project: { userDoc: 0, agentDoc: 0, closedByDoc: 0 } },
    ];
    
    sessions = await ChatSession.aggregate(dataPipeline);
  } else {
    totalCount = await ChatSession.countDocuments(query);
    sessions = await ChatSession.find(query)
      .populate('user')
      .populate('assignedAgent')
      .populate('closedBy')
      .sort({ closedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }
  
  const totalPages = Math.ceil(totalCount / limit);
  
  return {
    sessions,
    total: totalCount,
    page,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Check if agent can access a session
 */
export async function canAgentAccessSession(
  sessionId: string, 
  agentId: string, 
  isAdmin = false,
  isSupervisor = false
): Promise<boolean> {
  const session = await ChatSession.findOne({ sessionId });
  
  if (!session) {
    return false;
  }
  
  // Admins and supervisors can access all sessions
  if (isAdmin || isSupervisor) {
    return true;
  }
  
  // Queued/waiting sessions are accessible to all agents
  if (session.status === 'queued' || session.status === 'waiting') {
    return true;
  }
  
  // Active sessions only accessible to assigned agent
  if (session.status === 'human') {
    return session.assignedAgent?.toString() === agentId;
  }
  
  // Closed sessions only accessible to the agent who closed them
  if (session.status === 'closed') {
    return session.closedBy?.toString() === agentId;
  }
  
  return false;
}

/**
 * Get session statistics
 */
export async function getSessionStats(): Promise<{
  total: number;
  bot: number;
  queued: number;
  waiting: number;
  human: number;
  closed: number;
}> {
  const stats = await ChatSession.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
  
  const result = {
    total: 0,
    bot: 0,
    queued: 0,
    waiting: 0,
    human: 0,
    closed: 0,
  };
  
  for (const stat of stats) {
    result[stat._id as keyof typeof result] = stat.count;
    result.total += stat.count;
  }
  
  return result;
}

// ============= MESSAGE OPERATIONS =============

/**
 * Add message to session
 */
export async function addMessage(
  sessionId: string,
  sender: MessageSender,
  content: string,
  options?: {
    senderAgentId?: string;
    telegramMessageId?: number;
    messageType?: 'text' | 'image' | 'document' | 'file' | 'sticker' | 'voice' | 'audio' | 'system';
    mediaUrl?: string;
    replyToMessageId?: string;
  }
): Promise<IMessage> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session) {
    throw new Error('Session not found');
  }
  
  const message = await Message.create({
    session: session._id,
    sender,
    content,
    messageType: options?.messageType || 'text',
    mediaUrl: options?.mediaUrl,
    telegramMessageId: options?.telegramMessageId,
    senderAgent: options?.senderAgentId ? new Types.ObjectId(options.senderAgentId) : undefined,
    replyTo: options?.replyToMessageId ? new Types.ObjectId(options.replyToMessageId) : undefined,
  });
  
  // Update session's updatedAt
  session.updatedAt = new Date();
  await session.save();
  
  return message;
}

/**
 * Get messages for a session
 */
export async function getSessionMessages(
  sessionId: string, 
  limit = 100,
  before?: Date
): Promise<IMessage[]> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session) return [];
  
  const query: Record<string, unknown> = { session: session._id };
  if (before) {
    query.createdAt = { $lt: before };
  }
  
  return Message.find(query)
    .populate('senderAgent', 'name avatar')
    .populate('replyTo', 'sender content senderAgent')
    .sort({ createdAt: 1 })
    .limit(limit);
}

/**
 * Mark messages as read
 */
export async function markMessagesAsRead(sessionId: string, upToMessageId: string): Promise<void> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session) return;
  
  await Message.updateMany(
    { 
      session: session._id,
      _id: { $lte: new Types.ObjectId(upToMessageId) },
      isRead: false,
    },
    { 
      isRead: true,
      readAt: new Date(),
    }
  );
}

/**
 * Get unread message count for agent
 */
export async function getUnreadCount(sessionId: string): Promise<number> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session) return 0;
  
  return Message.countDocuments({
    session: session._id,
    sender: 'user',
    isRead: false,
  });
}

// ============= FILTERED SESSION QUERIES =============

export interface SessionFilters {
  status?: 'open' | 'closed';
  search?: string;
  dateFilter?: 'today' | 'week' | 'month' | 'all';
  agentId?: string; // The requesting agent
  isAdmin?: boolean; // Whether agent is admin
  page?: number;
  limit?: number;
}

export interface PaginatedSessions {
  sessions: IChatSession[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Get sessions with filters and pagination
 * IMPORTANT: Respects agent visibility rules
 */
export async function getFilteredSessions(filters: SessionFilters): Promise<PaginatedSessions> {
  const { 
    status = 'open', 
    search, 
    dateFilter = 'all',
    agentId,
    isAdmin = false,
    page = 1, 
    limit = 50 
  } = filters;

  // Build base query
  const query: Record<string, unknown> = {};

  // Status filter with visibility rules
  if (status === 'open') {
    // Exclude 'bot' status - those are automated interactions that don't need human attention
    query.status = { $in: ['queued', 'waiting', 'human'] };
    
    // Apply visibility rules for non-admins
    if (!isAdmin && agentId) {
      // Non-admin agents can only see:
      // 1. Sessions assigned to them
      // 2. Sessions in queue (not assigned)
      query.$or = [
        { assignedAgent: new Types.ObjectId(agentId) },
        { status: { $in: ['queued', 'waiting'] }, assignedAgent: { $exists: false } },
      ];
      delete query.status; // Remove status filter, handled in $or
    }
  } else {
    // Closed sessions
    query.status = 'closed';
    
    // Non-admin agents only see their own closed sessions
    if (!isAdmin && agentId) {
      query.closedBy = new Types.ObjectId(agentId);
    }
  }

  // Date filter
  const now = new Date();
  if (dateFilter === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    query.updatedAt = { $gte: startOfDay };
  } else if (dateFilter === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    query.updatedAt = { $gte: weekAgo };
  } else if (dateFilter === 'month') {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    query.updatedAt = { $gte: monthAgo };
  }

  // Get total count first
  let totalCount: number;
  let sessions: IChatSession[];

  if (search) {
    // Search requires aggregation with user lookup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pipeline: any[] = [
      { $match: query },
      {
        $lookup: {
          from: 'users',
          localField: 'user',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: '$userDoc' },
      {
        $match: {
          $or: [
            { 'userDoc.username': { $regex: search, $options: 'i' } },
            { 'userDoc.firstName': { $regex: search, $options: 'i' } },
            { 'userDoc.lastName': { $regex: search, $options: 'i' } },
            { sessionId: { $regex: search, $options: 'i' } },
            { 'userDoc.telegramId': parseInt(search) || -1 },
          ],
        },
      },
    ];

    // Count pipeline
    const countResult = await ChatSession.aggregate([...pipeline, { $count: 'total' }]);
    totalCount = countResult[0]?.total || 0;

    // Data pipeline with pagination
    const dataPipeline = [
      ...pipeline,
      { $sort: { updatedAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $lookup: {
          from: 'agents',
          localField: 'assignedAgent',
          foreignField: '_id',
          as: 'agentDoc',
        },
      },
      {
        $addFields: {
          user: '$userDoc',
          assignedAgent: { $arrayElemAt: ['$agentDoc', 0] },
        },
      },
      {
        $project: {
          userDoc: 0,
          agentDoc: 0,
        },
      },
    ];

    sessions = await ChatSession.aggregate(dataPipeline);
  } else {
    // Simple query without search
    totalCount = await ChatSession.countDocuments(query);
    sessions = await ChatSession.find(query)
      .populate('user')
      .populate('assignedAgent')
      .populate('closedBy')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  const totalPages = Math.ceil(totalCount / limit);

  return {
    sessions,
    total: totalCount,
    page,
    totalPages,
    hasMore: page < totalPages,
  };
}

/**
 * Get session counts by status (with optional agent filtering)
 */
export async function getSessionCounts(agentId?: string, isAdmin = false): Promise<{ 
  open: number; 
  closed: number; 
  queue: number;
  myActive: number;
}> {
  const openQuery: Record<string, unknown> = { status: { $in: ['bot', 'queued', 'waiting', 'human'] } };
  const closedQuery: Record<string, unknown> = { status: 'closed' };
  const queuedQuery: Record<string, unknown> = { 
    status: { $in: ['queued', 'waiting'] },
    assignedAgent: { $exists: false },
  };
  const myActiveQuery: Record<string, unknown> = { 
    status: 'human',
    assignedAgent: agentId ? new Types.ObjectId(agentId) : undefined,
  };
  
  // Non-admin visibility restrictions
  if (!isAdmin && agentId) {
    closedQuery.closedBy = new Types.ObjectId(agentId);
  }
  
  const [openCount, closedCount, queuedCount, myActiveCount] = await Promise.all([
    isAdmin ? ChatSession.countDocuments(openQuery) : 
      ChatSession.countDocuments({
        $or: [
          { assignedAgent: new Types.ObjectId(agentId!), status: 'human' },
          { status: { $in: ['queued', 'waiting'] }, assignedAgent: { $exists: false } },
        ],
      }),
    ChatSession.countDocuments(closedQuery),
    ChatSession.countDocuments(queuedQuery),
    agentId ? ChatSession.countDocuments(myActiveQuery) : 0,
  ]);

  return { open: openCount, closed: closedCount, queue: queuedCount, myActive: myActiveCount };
}

/**
 * Close session with detailed info
 */
export async function closeSessionDetailed(
  sessionId: string,
  closedByType: 'user' | 'agent' | 'system',
  closeReason: 'manual' | 'inactivity' | 'resolved' | 'spam',
  agentId?: string,
  closureReason?: string
): Promise<IChatSession | null> {
  const update: Record<string, unknown> = {
    status: 'closed',
    closedAt: new Date(),
    closedByType,
    closeReason,
  };

  if (agentId) {
    update.closedBy = new Types.ObjectId(agentId);
  }
  if (closureReason) {
    update.closureReason = closureReason;
  }

  return ChatSession.findOneAndUpdate(
    { sessionId },
    update,
    { new: true }
  ).populate('user').populate('assignedAgent').populate('closedBy');
}

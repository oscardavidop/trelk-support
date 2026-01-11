/**
 * Chat Session Database Service
 * Manages chat sessions between users and support
 */

import { v4 as uuidv4 } from 'uuid';
import { ChatSession, Message, type IChatSession, type IMessage, type SessionStatus, type MessageSender } from '../database/index.js';
import type { IUser } from '../database/models/User.js';
import { Types } from 'mongoose';

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
export async function assignAgent(sessionId: string, agentId: string): Promise<IChatSession | null> {
  return ChatSession.findOneAndUpdate(
    { sessionId },
    { 
      status: 'human',
      assignedAgent: new Types.ObjectId(agentId),
    },
    { new: true }
  ).populate('user').populate('assignedAgent');
}

/**
 * Close session
 */
export async function closeSession(
  sessionId: string, 
  agentId: string, 
  reason?: string
): Promise<IChatSession | null> {
  return ChatSession.findOneAndUpdate(
    { sessionId },
    { 
      status: 'closed',
      closedAt: new Date(),
      closedBy: new Types.ObjectId(agentId),
      closureReason: reason,
    },
    { new: true }
  );
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
    status: { $in: ['bot', 'waiting', 'human'] },
  })
    .populate('user')
    .populate('assignedAgent')
    .sort({ updatedAt: -1 });
}

/**
 * Get session statistics
 */
export async function getSessionStats(): Promise<{
  total: number;
  bot: number;
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
  agentId?: string;
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
 */
export async function getFilteredSessions(filters: SessionFilters): Promise<PaginatedSessions> {
  const { 
    status = 'open', 
    search, 
    dateFilter = 'all',
    agentId,
    page = 1, 
    limit = 50 
  } = filters;

  // Build base query
  const query: Record<string, unknown> = {};

  // Status filter
  if (status === 'open') {
    query.status = { $in: ['bot', 'waiting', 'human'] };
  } else {
    query.status = 'closed';
  }

  // Agent filter
  if (agentId) {
    query.assignedAgent = new Types.ObjectId(agentId);
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
 * Get session counts by status
 */
export async function getSessionCounts(): Promise<{ open: number; closed: number }> {
  const [openCount, closedCount] = await Promise.all([
    ChatSession.countDocuments({ status: { $in: ['bot', 'waiting', 'human'] } }),
    ChatSession.countDocuments({ status: 'closed' }),
  ]);

  return { open: openCount, closed: closedCount };
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

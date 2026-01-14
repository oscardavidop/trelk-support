/**
 * Enterprise Features Service
 * Transfers, Blocks, Surveys, Metrics, Categories
 */

import { Types } from 'mongoose';
import { ChatSession, type IChatSession, type ChatCategory } from '../database/models/ChatSession.js';
import { Transfer, type ITransfer } from '../database/models/Transfer.js';
import { UserBlock, type IUserBlock } from '../database/models/UserBlock.js';
import { Survey, type ISurvey } from '../database/models/Survey.js';
import { User } from '../database/models/User.js';
import { Message } from '../database/models/Message.js';
import { Agent } from '../database/models/Agent.js';
import { logger } from './logger.js';
import { logActivity } from './activity-log.service.js';

// ============= TRANSFER SERVICE =============

export interface TransferData {
  sessionId: string;
  fromAgentId: string;
  toAgentId: string;
  reason: string;
}

/**
 * Transfer a session to another agent
 */
export async function transferSession(data: TransferData): Promise<{
  transfer: ITransfer;
  session: IChatSession;
} | null> {
  const session = await ChatSession.findOne({ sessionId: data.sessionId });
  if (!session) return null;

  // Only open sessions can be transferred
  if (session.status === 'closed') {
    throw new Error('Cannot transfer a closed session');
  }

  // Create transfer record
  const transfer = await Transfer.create({
    session: session._id,
    fromAgent: new Types.ObjectId(data.fromAgentId),
    toAgent: new Types.ObjectId(data.toAgentId),
    reason: data.reason,
    status: 'accepted',
    transferredAt: new Date(),
    acceptedAt: new Date(),
  });

  // Update session assignment
  session.assignedAgent = new Types.ObjectId(data.toAgentId);
  session.status = 'human';
  await session.save();

  // Add system message
  const fromAgent = await Agent.findById(data.fromAgentId);
  const toAgent = await Agent.findById(data.toAgentId);
  
  await Message.create({
    session: session._id,
    sender: 'bot',
    content: `Chat transferred from ${fromAgent?.name || 'Agent'} to ${toAgent?.name || 'Agent'}. Reason: ${data.reason}`,
    messageType: 'system',
  });

  logger.info('chat', { 
    action: 'session_transferred', 
    sessionId: data.sessionId,
    from: data.fromAgentId,
    to: data.toAgentId,
  });

  // Log activity for timeline
  await logActivity({
    sessionId: data.sessionId,
    action: 'session_transferred',
    actorType: 'agent',
    actorId: data.fromAgentId,
    actorName: fromAgent?.name || 'Agent',
    metadata: { 
      fromAgentId: data.fromAgentId, 
      toAgentId: data.toAgentId,
      fromAgentName: fromAgent?.name,
      toAgentName: toAgent?.name,
      reason: data.reason,
    },
    description: `Transferred to ${toAgent?.name || 'agent'}: ${data.reason}`,
  });

  // Return populated session
  const populatedSession = await ChatSession.findById(session._id)
    .populate('user')
    .populate('assignedAgent');

  return { transfer, session: populatedSession! };
}

/**
 * Get transfer history for a session
 */
export async function getSessionTransfers(sessionId: string): Promise<ITransfer[]> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session) return [];

  return Transfer.find({ session: session._id })
    .populate('fromAgent', 'name email')
    .populate('toAgent', 'name email')
    .sort({ transferredAt: -1 });
}

// ============= BLOCK SERVICE =============

export interface BlockUserData {
  telegramId: number;
  blockType: 'temporary' | 'permanent';
  reason: string;
  blockedByAgentId: string;
  durationHours?: number; // For temporary blocks
}

/**
 * Block a user
 */
export async function blockUser(data: BlockUserData): Promise<IUserBlock | null> {
  const user = await User.findOne({ telegramId: data.telegramId });
  if (!user) return null;

  // Check if already blocked
  const existingBlock = await UserBlock.findOne({
    telegramId: data.telegramId,
    isActive: true,
  });

  if (existingBlock) {
    throw new Error('User is already blocked');
  }

  const expiresAt = data.blockType === 'temporary' && data.durationHours
    ? new Date(Date.now() + data.durationHours * 60 * 60 * 1000)
    : undefined;

  const block = await UserBlock.create({
    user: user._id,
    telegramId: data.telegramId,
    blockType: data.blockType,
    reason: data.reason,
    blockedBy: new Types.ObjectId(data.blockedByAgentId),
    expiresAt,
    isActive: true,
  });

  // Update user
  user.isBlocked = true;
  user.blockExpiresAt = expiresAt;
  await user.save();

  logger.info('chat', { 
    action: 'user_blocked', 
    telegramId: data.telegramId,
    blockType: data.blockType,
    expiresAt,
  });

  return block;
}

/**
 * Unblock a user
 */
export async function unblockUser(telegramId: number, unblockedByAgentId: string): Promise<boolean> {
  const block = await UserBlock.findOne({
    telegramId,
    isActive: true,
  });

  if (!block) return false;

  block.isActive = false;
  block.unblockedAt = new Date();
  block.unblockedBy = new Types.ObjectId(unblockedByAgentId);
  await block.save();

  // Update user
  await User.updateOne(
    { telegramId },
    { isBlocked: false, blockExpiresAt: undefined }
  );

  logger.info('chat', { 
    action: 'user_unblocked', 
    telegramId,
  });

  return true;
}

/**
 * Check if user is blocked
 */
export async function isUserBlocked(telegramId: number): Promise<{
  blocked: boolean;
  block?: IUserBlock;
}> {
  const block = await UserBlock.findOne({
    telegramId,
    isActive: true,
  });

  if (!block) return { blocked: false };

  // Check if temporary block expired
  if (block.blockType === 'temporary' && block.expiresAt && block.expiresAt < new Date()) {
    block.isActive = false;
    await block.save();
    
    await User.updateOne(
      { telegramId },
      { isBlocked: false, blockExpiresAt: undefined }
    );
    
    return { blocked: false };
  }

  return { blocked: true, block };
}

/**
 * Get block info for a user
 */
export async function getUserBlockInfo(telegramId: number): Promise<IUserBlock | null> {
  return UserBlock.findOne({ telegramId, isActive: true })
    .populate('blockedBy', 'name email');
}

/**
 * Get block history for a user
 */
export async function getUserBlockHistory(telegramId: number): Promise<IUserBlock[]> {
  return UserBlock.find({ telegramId })
    .populate('blockedBy', 'name email')
    .populate('unblockedBy', 'name email')
    .sort({ blockedAt: -1 });
}

// ============= CATEGORY SERVICE =============

const CATEGORY_KEYWORDS: Record<ChatCategory, string[]> = {
  bug: ['bug', 'error', 'crash', 'broken', 'not working', 'no funciona', 'falla', 'problema'],
  billing: ['billing', 'payment', 'invoice', 'refund', 'subscription', 'pago', 'factura', 'suscripción'],
  feedback: ['feedback', 'suggestion', 'idea', 'improve', 'feature request', 'sugerencia', 'mejora'],
  support: ['help', 'how to', 'question', 'ayuda', 'cómo', 'pregunta'],
  other: [],
};

/**
 * Set session category manually
 */
export async function setSessionCategory(sessionId: string, category: ChatCategory): Promise<IChatSession | null> {
  const session = await ChatSession.findOneAndUpdate(
    { sessionId },
    { category },
    { new: true }
  ).populate('user').populate('assignedAgent');

  if (session) {
    logger.info('chat', { action: 'category_set', sessionId, category });
  }

  return session;
}

/**
 * Auto-detect category from message content
 */
export function detectCategory(content: string): ChatCategory | null {
  const lowerContent = content.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'other') continue;
    
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        return category as ChatCategory;
      }
    }
  }

  return null;
}

/**
 * Auto-categorize session based on messages
 */
export async function autoCategorizeSession(sessionId: string): Promise<ChatCategory | null> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session || session.category) return session?.category || null;

  // Get first few messages
  const messages = await Message.find({ session: session._id })
    .sort({ createdAt: 1 })
    .limit(5);

  for (const msg of messages) {
    const detected = detectCategory(msg.content);
    if (detected) {
      session.category = detected;
      await session.save();
      return detected;
    }
  }

  return null;
}

// ============= SURVEY SERVICE =============

/**
 * Create or update survey response
 */
export async function submitSurvey(
  sessionId: string,
  rating: number,
  comment?: string
): Promise<ISurvey | null> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session) return null;

  // Update session with rating
  session.rating = rating;
  session.feedback = comment;
  await session.save();

  // Upsert survey
  const survey = await Survey.findOneAndUpdate(
    { session: session._id },
    {
      session: session._id,
      user: session.user,
      agent: session.assignedAgent,
      rating,
      comment,
      submittedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  logger.info('chat', { action: 'survey_submitted', sessionId, rating });

  return survey;
}

/**
 * Get survey for a session
 */
export async function getSessionSurvey(sessionId: string): Promise<ISurvey | null> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session) return null;

  return Survey.findOne({ session: session._id });
}

// ============= REOPEN SERVICE =============

/**
 * Reopen a closed session
 */
export async function reopenSession(
  sessionId: string, 
  agentId: string,
  agentRole: string
): Promise<IChatSession | null> {
  // Only admin or senior agents can reopen
  if (agentRole !== 'admin') {
    throw new Error('Only admin agents can reopen sessions');
  }

  const session = await ChatSession.findOne({ sessionId });
  if (!session) return null;

  if (session.status !== 'closed') {
    throw new Error('Session is not closed');
  }

  // Check if user already has an open session
  const existingOpenSession = await ChatSession.findOne({
    user: session.user,
    status: { $in: ['waiting', 'active'] },
  });

  if (existingOpenSession) {
    throw new Error(`User already has an open chat: ${existingOpenSession.sessionId}`);
  }

  // Reopen session
  session.status = 'waiting';
  session.reopenedAt = new Date();
  session.reopenedBy = new Types.ObjectId(agentId);
  session.reopenCount = (session.reopenCount || 0) + 1;
  session.closedAt = undefined;
  session.closedBy = undefined;
  session.closedByType = undefined;
  session.closeReason = undefined;
  await session.save();

  // Add system message
  const agent = await Agent.findById(agentId);
  await Message.create({
    session: session._id,
    sender: 'bot',
    content: `Chat reopened by ${agent?.name || 'Admin'}`,
    messageType: 'system',
  });

  logger.info('chat', { 
    action: 'session_reopened', 
    sessionId,
    reopenedBy: agentId,
    reopenCount: session.reopenCount,
  });

  return ChatSession.findById(session._id)
    .populate('user')
    .populate('assignedAgent');
}

// ============= METRICS SERVICE =============

export interface MetricsFilter {
  startDate?: Date;
  endDate?: Date;
  agentId?: string;
}

export interface DashboardMetrics {
  avgFirstResponseTime: number; // in minutes
  totalChats: number;
  chatsByAgent: { agentId: string; agentName: string; count: number }[];
  closedByInactivity: number;
  peakHours: { hour: number; count: number }[];
  avgRating: number;
  ratingDistribution: { rating: number; count: number }[];
  categoryDistribution: { category: string; count: number }[];
}

/**
 * Get dashboard metrics
 */
export async function getMetrics(filter: MetricsFilter = {}): Promise<DashboardMetrics> {
  const { startDate, endDate, agentId } = filter;
  
  const dateFilter: Record<string, unknown> = {};
  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;
  
  const matchStage: Record<string, unknown> = {};
  if (Object.keys(dateFilter).length) matchStage.createdAt = dateFilter;
  if (agentId) matchStage.assignedAgent = new Types.ObjectId(agentId);

  // Average first response time
  const firstResponseAgg = await ChatSession.aggregate([
    { $match: { ...matchStage, firstResponseAt: { $exists: true } } },
    {
      $project: {
        responseTime: { $subtract: ['$firstResponseAt', '$createdAt'] },
      },
    },
    {
      $group: {
        _id: null,
        avgTime: { $avg: '$responseTime' },
      },
    },
  ]);
  const avgFirstResponseTime = firstResponseAgg[0]?.avgTime 
    ? Math.round(firstResponseAgg[0].avgTime / 60000) 
    : 0;

  // Total chats
  const totalChats = await ChatSession.countDocuments(matchStage);

  // Chats by agent
  const chatsByAgentAgg = await ChatSession.aggregate([
    { $match: { ...matchStage, assignedAgent: { $exists: true } } },
    {
      $group: {
        _id: '$assignedAgent',
        count: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: 'agents',
        localField: '_id',
        foreignField: '_id',
        as: 'agent',
      },
    },
    { $unwind: '$agent' },
    {
      $project: {
        agentId: '$_id',
        agentName: '$agent.name',
        count: 1,
      },
    },
    { $sort: { count: -1 } },
  ]);
  const chatsByAgent = chatsByAgentAgg.map(a => ({
    agentId: a.agentId.toString(),
    agentName: a.agentName,
    count: a.count,
  }));

  // Closed by inactivity
  const closedByInactivity = await ChatSession.countDocuments({
    ...matchStage,
    closeReason: 'inactivity',
  });

  // Peak hours
  const peakHoursAgg = await ChatSession.aggregate([
    { $match: matchStage },
    {
      $project: {
        hour: { $hour: '$createdAt' },
      },
    },
    {
      $group: {
        _id: '$hour',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const peakHours = peakHoursAgg.map(h => ({
    hour: h._id,
    count: h.count,
  }));

  // Average rating
  const ratingAgg = await ChatSession.aggregate([
    { $match: { ...matchStage, rating: { $exists: true } } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  const avgRating = ratingAgg[0]?.avgRating 
    ? Math.round(ratingAgg[0].avgRating * 10) / 10 
    : 0;

  // Rating distribution
  const ratingDistAgg = await ChatSession.aggregate([
    { $match: { ...matchStage, rating: { $exists: true } } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  const ratingDistribution = ratingDistAgg.map(r => ({
    rating: r._id,
    count: r.count,
  }));

  // Category distribution
  const categoryAgg = await ChatSession.aggregate([
    { $match: { ...matchStage, category: { $exists: true } } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
  const categoryDistribution = categoryAgg.map(c => ({
    category: c._id,
    count: c.count,
  }));

  return {
    avgFirstResponseTime,
    totalChats,
    chatsByAgent,
    closedByInactivity,
    peakHours,
    avgRating,
    ratingDistribution,
    categoryDistribution,
  };
}

// ============= FIRST RESPONSE TRACKING =============

/**
 * Record first response time
 */
export async function recordFirstResponse(sessionId: string, agentId: string): Promise<void> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session || session.firstResponseAt) return;

  session.firstResponseAt = new Date();
  session.firstResponseBy = new Types.ObjectId(agentId);
  await session.save();
}

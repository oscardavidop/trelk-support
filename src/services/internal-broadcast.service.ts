/**
 * Internal Broadcast Service
 * Handles admin announcements to agents
 */

import { Types } from 'mongoose';
import { InternalBroadcast, type IInternalBroadcast, type BroadcastLevel, type BroadcastTarget, AuditLog } from '../database/models/index.js';
import { BroadcastReceipt } from '../database/models/BroadcastReceipt.js';
import { Agent, type IAgent } from '../database/models/Agent.js';
import { getIO } from './socket.js';
import { sendTelegramNotification } from './telegram-notification.service.js';
import { getOnlineAgents } from './agent.service.js';

// ============= TYPES =============

interface CreateBroadcastParams {
  title: string;
  message: string;
  level?: BroadcastLevel;
  target?: BroadcastTarget;
  targetTeamId?: string;
  targetAgentIds?: string[];
  requireAck?: boolean;
  isPinned?: boolean;
  expiresAt?: Date;
  createdBy: string;
  metadata?: Record<string, any>;
}

interface BroadcastResult {
  broadcast: IInternalBroadcast;
  deliveredCount: number;
  telegramFallbackCount: number;
}

// ============= SERVICE =============

class InternalBroadcastService {
  /**
   * Create and send a broadcast announcement
   */
  async createBroadcast(params: CreateBroadcastParams): Promise<BroadcastResult> {
    const {
      title,
      message,
      level = 'info',
      target = 'all',
      targetTeamId,
      targetAgentIds,
      requireAck = false,
      isPinned = false,
      expiresAt,
      createdBy,
      metadata,
    } = params;

    // Get target agents
    const targetedAgents = await this.getTargetAgents(target, targetTeamId, targetAgentIds);

    // Create broadcast
    const broadcast = await InternalBroadcast.create({
      title,
      message,
      level,
      target,
      targetTeamId: targetTeamId ? new Types.ObjectId(targetTeamId) : undefined,
      targetAgentIds: targetAgentIds?.map(id => new Types.ObjectId(id)),
      requireAck,
      isPinned,
      expiresAt,
      createdBy: new Types.ObjectId(createdBy),
      stats: {
        totalTargeted: targetedAgents.length,
        delivered: 0,
        seen: 0,
        acknowledged: 0,
      },
      metadata,
    });

    // Populate creator info
    await broadcast.populate('createdBy', 'name avatar');

    // Create receipts for all targeted agents
    const receipts = targetedAgents.map(agent => ({
      broadcastId: broadcast._id,
      agentId: agent._id,
      pendingDelivery: true,
    }));

    if (receipts.length > 0) {
      await BroadcastReceipt.insertMany(receipts, { ordered: false });
    }

    // Send via socket and track delivery
    const io = getIO();
    let deliveredCount = 0;
    let telegramFallbackCount = 0;
    const offlineAgents: (IAgent & { _id: Types.ObjectId })[] = [];
    
    // Get creator info for emit
    const creator = broadcast.createdBy as any;
    const createdByData = {
      _id: creator._id?.toString() || createdBy,
      name: creator.name || 'Admin',
      avatar: creator.avatar,
    };

    for (const agent of targetedAgents) {
      const agentIdStr = agent._id.toString();
      let delivered = false;

      if (io) {
        const agentRoom = io.sockets.adapter.rooms.get(`agent:${agentIdStr}`);
        if (agentRoom && agentRoom.size > 0) {
          io.to(`agent:${agentIdStr}`).emit('broadcast.new', {
            id: broadcast._id.toString(),
            title: broadcast.title,
            message: broadcast.message,
            level: broadcast.level,
            requireAck: broadcast.requireAck,
            isPinned: broadcast.isPinned,
            createdBy: createdByData,
            createdAt: broadcast.createdAt,
            expiresAt: broadcast.expiresAt,
          });
          delivered = true;
          deliveredCount++;

          // Update receipt
          await BroadcastReceipt.updateOne(
            { broadcastId: broadcast._id, agentId: agent._id },
            { deliveredAt: new Date(), deliveredVia: 'socket', pendingDelivery: false }
          );
        }
      }

      if (!delivered) {
        offlineAgents.push(agent);
      }
    }

    // Send Telegram fallback for critical broadcasts to offline agents
    if (level === 'critical' && offlineAgents.length > 0) {
      const emoji = level === 'critical' ? '🚨' : level === 'warning' ? '⚠️' : 'ℹ️';
      const telegramMessage = `${emoji} *${title}*\n\n${message}`;

      for (const agent of offlineAgents) {
        if (agent.telegramId) {
          try {
            await sendTelegramNotification(agent.telegramId.toString(), telegramMessage);
            telegramFallbackCount++;

            // Update receipt
            await BroadcastReceipt.updateOne(
              { broadcastId: broadcast._id, agentId: agent._id },
              { deliveredAt: new Date(), deliveredVia: 'telegram', pendingDelivery: false }
            );
          } catch (error) {
            console.error('[InternalBroadcast] Telegram fallback failed:', error);
          }
        }
      }
    }

    // Update broadcast stats
    broadcast.stats.delivered = deliveredCount + telegramFallbackCount;
    await broadcast.save();

    // Audit log
    try {
      const creatorInfo = await Agent.findById(createdBy).select('name email role').lean();
      await AuditLog.create({
        action: 'CREATE_BROADCAST',
        category: 'communication',
        severity: level === 'critical' ? 'high' : level === 'warning' ? 'medium' : 'low',
        actorId: new Types.ObjectId(createdBy),
        actorType: 'admin',
        actorName: creatorInfo?.name || 'Unknown',
        actorEmail: creatorInfo?.email,
        actorIp: 'internal',
        targetType: 'system',
        targetId: broadcast._id.toString(),
        targetDescription: `Broadcast: ${title}`,
        metadata: {
          broadcastId: broadcast._id.toString(),
          title,
          level,
          target,
          totalTargeted: targetedAgents.length,
          deliveredCount,
          telegramFallbackCount,
        },
      });
    } catch (e) {
      console.error('[InternalBroadcast] Audit log failed:', e);
    }

    return { broadcast, deliveredCount, telegramFallbackCount };
  }

  /**
   * Get agents based on target type
   */
  private async getTargetAgents(
    target: BroadcastTarget,
    targetTeamId?: string,
    targetAgentIds?: string[]
  ): Promise<(IAgent & { _id: Types.ObjectId })[]> {
    let agents: (IAgent & { _id: Types.ObjectId })[];

    switch (target) {
      case 'all':
        agents = await Agent.find({ isActive: true }).select('_id name telegramId role').lean() as any;
        break;

      case 'online':
        // Get online agents using agent service
        const onlineAgents = await getOnlineAgents();
        agents = onlineAgents.map(a => ({
          _id: a._id,
          name: a.name,
          telegramId: a.telegramId,
          role: a.role,
        })) as any;
        break;

      case 'supervisors':
        agents = await Agent.find({ isActive: true, role: { $in: ['supervisor', 'admin'] } })
          .select('_id name telegramId role').lean() as any;
        break;

      case 'admins':
        agents = await Agent.find({ isActive: true, role: 'admin' })
          .select('_id name telegramId role').lean() as any;
        break;

      case 'team':
        if (!targetTeamId) return [];
        agents = await Agent.find({ isActive: true, teamId: new Types.ObjectId(targetTeamId) })
          .select('_id name telegramId role').lean() as any;
        break;

      case 'high_load':
        // Find agents with high active chat count
        const highLoadQuery = await Agent.aggregate([
          { $match: { isActive: true } },
          { $match: { $expr: { $gte: ['$activeChats', { $multiply: ['$maxConcurrentChats', 0.8] }] } } },
          { $project: { _id: 1, name: 1, telegramId: 1, role: 1 } },
        ]);
        agents = highLoadQuery as any;
        break;

      case 'custom':
        if (!targetAgentIds || targetAgentIds.length === 0) return [];
        agents = await Agent.find({ 
          isActive: true, 
          _id: { $in: targetAgentIds.map(id => new Types.ObjectId(id)) } 
        }).select('_id name telegramId role').lean() as any;
        break;

      default:
        agents = [];
    }

    return agents;
  }

  /**
   * Get active broadcasts for an agent (including pending from offline)
   */
  async getActiveBroadcastsForAgent(agentId: string) {
    const now = new Date();

    // Get receipts that haven't been acknowledged
    const receipts = await BroadcastReceipt.find({
      agentId: new Types.ObjectId(agentId),
      acknowledgedAt: { $exists: false },
    }).lean();

    if (receipts.length === 0) return [];

    // Get the actual broadcasts
    const broadcastIds = receipts.map(r => r.broadcastId);
    const broadcasts = await InternalBroadcast.find({
      _id: { $in: broadcastIds },
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: now } },
      ],
    })
      .sort({ level: -1, createdAt: -1 }) // Critical first
      .populate('createdBy', 'name avatar')
      .lean();

    // Merge receipt info with broadcasts
    const receiptMap = new Map(receipts.map(r => [r.broadcastId.toString(), r]));
    
    return broadcasts.map(broadcast => ({
      ...broadcast,
      receipt: receiptMap.get(broadcast._id.toString()),
    }));
  }

  /**
   * Mark broadcast as seen by agent
   */
  async markSeen(broadcastId: string, agentId: string) {
    const result = await BroadcastReceipt.findOneAndUpdate(
      {
        broadcastId: new Types.ObjectId(broadcastId),
        agentId: new Types.ObjectId(agentId),
        seenAt: { $exists: false },
      },
      {
        seenAt: new Date(),
        pendingDelivery: false,
      },
      { new: true }
    );

    if (result) {
      // Update broadcast stats
      await InternalBroadcast.updateOne(
        { _id: new Types.ObjectId(broadcastId) },
        { $inc: { 'stats.seen': 1 } }
      );
    }

    return result;
  }

  /**
   * Acknowledge a broadcast
   */
  async acknowledge(broadcastId: string, agentId: string) {
    const now = new Date();
    
    // First, find the receipt to check if seenAt already exists
    const existingReceipt = await BroadcastReceipt.findOne({
      broadcastId: new Types.ObjectId(broadcastId),
      agentId: new Types.ObjectId(agentId),
      acknowledgedAt: { $exists: false },
    });

    if (!existingReceipt) {
      return null;
    }

    // Build update based on whether seenAt already exists
    const updateData: any = {
      acknowledgedAt: now,
      pendingDelivery: false,
    };
    
    // Only set seenAt if it doesn't exist
    if (!existingReceipt.seenAt) {
      updateData.seenAt = now;
    }

    const receipt = await BroadcastReceipt.findOneAndUpdate(
      {
        _id: existingReceipt._id,
        acknowledgedAt: { $exists: false },
      },
      updateData,
      { new: true }
    );

    if (receipt) {
      // Update broadcast stats - increment ack, and seen if we just set seenAt
      const updateOps: any = { $inc: { 'stats.acknowledged': 1 } };
      // If seenAt was not set before (we just set it), also increment seen
      if (!existingReceipt.seenAt) {
        updateOps.$inc['stats.seen'] = 1;
      }
      await InternalBroadcast.updateOne(
        { _id: new Types.ObjectId(broadcastId) },
        updateOps
      );
    }

    return receipt;
  }

  /**
   * Get broadcast by ID with full stats
   */
  async getBroadcast(broadcastId: string) {
    const broadcast = await InternalBroadcast.findById(broadcastId)
      .populate('createdBy', 'name avatar')
      .lean();

    if (!broadcast) return null;

    // Get detailed receipt stats
    const receiptStats = await BroadcastReceipt.aggregate([
      { $match: { broadcastId: new Types.ObjectId(broadcastId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $ne: ['$deliveredAt', null] }, 1, 0] } },
          seen: { $sum: { $cond: [{ $ne: ['$seenAt', null] }, 1, 0] } },
          acknowledged: { $sum: { $cond: [{ $ne: ['$acknowledgedAt', null] }, 1, 0] } },
          avgAckTime: {
            $avg: {
              $cond: [
                { $and: [{ $ne: ['$acknowledgedAt', null] }, { $ne: ['$deliveredAt', null] }] },
                { $subtract: ['$acknowledgedAt', '$deliveredAt'] },
                null,
              ],
            },
          },
        },
      },
    ]);

    return {
      ...broadcast,
      detailedStats: receiptStats[0] || { total: 0, delivered: 0, seen: 0, acknowledged: 0, avgAckTime: null },
    };
  }

  /**
   * Get all broadcasts with pagination
   */
  async getBroadcasts(options: { page?: number; limit?: number; activeOnly?: boolean } = {}) {
    const { page = 1, limit = 20, activeOnly = false } = options;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (activeOnly) {
      const now = new Date();
      query.isActive = true;
      query.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: now } },
      ];
    }

    const [broadcasts, total] = await Promise.all([
      InternalBroadcast.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name avatar')
        .lean(),
      InternalBroadcast.countDocuments(query),
    ]);

    return {
      broadcasts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Cancel a broadcast
   */
  async cancelBroadcast(broadcastId: string, cancelledBy: string) {
    const broadcast = await InternalBroadcast.findByIdAndUpdate(
      broadcastId,
      {
        isActive: false,
        cancelledAt: new Date(),
        cancelledBy: new Types.ObjectId(cancelledBy),
      },
      { new: true }
    );

    if (broadcast) {
      // Notify agents to remove the broadcast
      const io = getIO();
      if (io) {
        io.emit('broadcast.cancelled', { id: broadcastId });
      }

      // Audit log
      try {
        const cancellerInfo = await Agent.findById(cancelledBy).select('name email role').lean();
        await AuditLog.create({
          action: 'CANCEL_BROADCAST',
          category: 'communication',
          severity: 'medium',
          actorId: new Types.ObjectId(cancelledBy),
          actorType: 'admin',
          actorName: cancellerInfo?.name || 'Unknown',
          actorEmail: cancellerInfo?.email,
          actorIp: 'internal',
          targetType: 'system',
          targetId: broadcastId,
          targetDescription: `Cancelled broadcast: ${broadcast.title}`,
        });
      } catch (e) {
        console.error('[InternalBroadcast] Audit log failed:', e);
      }
    }

    return broadcast;
  }

  /**
   * Get metrics for broadcasts
   */
  async getMetrics(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const metrics = await InternalBroadcast.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: null,
          totalBroadcasts: { $sum: 1 },
          totalTargeted: { $sum: '$stats.totalTargeted' },
          totalDelivered: { $sum: '$stats.delivered' },
          totalSeen: { $sum: '$stats.seen' },
          totalAcknowledged: { $sum: '$stats.acknowledged' },
          byLevel: {
            $push: {
              level: '$level',
              count: 1,
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          totalBroadcasts: 1,
          totalTargeted: 1,
          totalDelivered: 1,
          totalSeen: 1,
          totalAcknowledged: 1,
          deliveryRate: {
            $cond: [
              { $eq: ['$totalTargeted', 0] },
              0,
              { $multiply: [{ $divide: ['$totalDelivered', '$totalTargeted'] }, 100] },
            ],
          },
          readRate: {
            $cond: [
              { $eq: ['$totalTargeted', 0] },
              0,
              { $multiply: [{ $divide: ['$totalSeen', '$totalTargeted'] }, 100] },
            ],
          },
          ackRate: {
            $cond: [
              { $eq: ['$totalTargeted', 0] },
              0,
              { $multiply: [{ $divide: ['$totalAcknowledged', '$totalTargeted'] }, 100] },
            ],
          },
        },
      },
    ]);

    // Get level distribution
    const levelDistribution = await InternalBroadcast.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$level', count: { $sum: 1 } } },
    ]);

    return {
      ...(metrics[0] || {
        totalBroadcasts: 0,
        totalTargeted: 0,
        totalDelivered: 0,
        totalSeen: 0,
        totalAcknowledged: 0,
        deliveryRate: 0,
        readRate: 0,
        ackRate: 0,
      }),
      levelDistribution: levelDistribution.reduce((acc, { _id, count }) => {
        acc[_id] = count;
        return acc;
      }, {} as Record<string, number>),
      days,
    };
  }

  /**
   * Get broadcast stats with individual receipts
   */
  async getBroadcastStats(broadcastId: string) {
    const broadcast = await InternalBroadcast.findById(broadcastId)
      .populate('createdBy', 'name avatar')
      .lean();

    if (!broadcast) return null;

    // Get all receipts with agent info
    const receipts = await BroadcastReceipt.find({ broadcastId: new Types.ObjectId(broadcastId) })
      .populate('agentId', 'name email avatar')
      .sort({ deliveredAt: -1 })
      .lean();

    // Calculate stats
    const stats = {
      totalTargeted: receipts.length,
      delivered: receipts.filter(r => r.deliveredAt).length,
      seen: receipts.filter(r => r.seenAt).length,
      acknowledged: receipts.filter(r => r.acknowledgedAt).length,
    };

    return {
      ...broadcast,
      stats,
      receipts,
    };
  }
}

export const internalBroadcastService = new InternalBroadcastService();
export default internalBroadcastService;

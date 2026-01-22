/**
 * Broadcast Service
 * Mass messaging with rate limiting, batch processing, and tracking
 */

import { Types, FilterQuery, PipelineStage } from 'mongoose';
import {
  Broadcast,
  BroadcastRecipient,
  IBroadcast,
  IBroadcastRecipientDoc,
  BroadcastStatus,
  BroadcastTargetType,
  BroadcastMessageType,
  DeliveryStatus,
  User,
  IUser,
  Segment,
} from '../database/models/index.js';
import { buildSegmentPipeline } from './segment.service.js';
import { broadcastQueue, QUEUE_NAMES } from './queue.js';
import { getIO } from './socket.js';
import { logger } from './logger.js';

// ==================== TYPES ====================

export interface CreateBroadcastParams {
  title: string;
  messageType?: BroadcastMessageType;
  message?: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  // Media
  mediaUrl?: string;
  caption?: string;
  // Poll
  pollQuestion?: string;
  pollOptions?: string[];
  pollIsAnonymous?: boolean;
  pollAllowsMultiple?: boolean;
  // Targeting
  targetType: BroadcastTargetType;
  segmentId?: string;
  manualUserIds?: string[];
  scheduledAt?: Date;
  batchSize?: number;
  batchDelayMs?: number;
  createdBy: string;
}

export interface BroadcastListItem {
  _id: string;
  title: string;
  status: BroadcastStatus;
  targetType: BroadcastTargetType;
  progress: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    blocked: number;
  };
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdByName?: string;
}

export interface BroadcastDetails extends IBroadcast {
  segmentName?: string;
  createdByName?: string;
}

export interface BroadcastRecipientItem {
  _id: string;
  userId: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  status: DeliveryStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
}

export interface PaginatedRecipients {
  recipients: BroadcastRecipientItem[];
  total: number;
  page: number;
  totalPages: number;
}

// ==================== MAIN SERVICE ====================

export const broadcastService = {
  /**
   * Create a new broadcast campaign
   */
  async createBroadcast(params: CreateBroadcastParams): Promise<IBroadcast> {
    const {
      title,
      messageType = 'text',
      message,
      parseMode,
      mediaUrl,
      caption,
      pollQuestion,
      pollOptions,
      pollIsAnonymous = true,
      pollAllowsMultiple = false,
      targetType,
      segmentId,
      manualUserIds,
      scheduledAt,
      batchSize = 25,
      batchDelayMs = 1000,
      createdBy,
    } = params;

    // Validate message type requirements
    if (messageType === 'text' && !message?.trim()) {
      throw new Error('Message is required for text broadcasts');
    }
    if (['photo', 'video', 'document', 'audio'].includes(messageType) && !mediaUrl?.trim()) {
      throw new Error('Media URL is required for media broadcasts');
    }
    if (messageType === 'poll') {
      if (!pollQuestion?.trim()) {
        throw new Error('Poll question is required');
      }
      if (!pollOptions || pollOptions.filter(o => o.trim()).length < 2) {
        throw new Error('At least 2 poll options are required');
      }
    }

    // Validate segment if using segment targeting
    if (targetType === 'segment' && segmentId) {
      const segment = await Segment.findById(segmentId);
      if (!segment) {
        throw new Error('Segment not found');
      }
    }

    // Calculate initial recipient count
    let totalRecipients = 0;
    if (targetType === 'all') {
      totalRecipients = await User.countDocuments({ isBlocked: { $ne: true } });
    } else if (targetType === 'segment' && segmentId) {
      totalRecipients = await this.getSegmentUserCount(segmentId);
    } else if (targetType === 'manual' && manualUserIds) {
      totalRecipients = manualUserIds.length;
    }

    // Build create object based on message type
    const createData: any = {
      title,
      messageType,
      parseMode,
      targetType,
      segmentId: segmentId ? new Types.ObjectId(segmentId) : undefined,
      manualUserIds: manualUserIds?.map((id) => new Types.ObjectId(id)),
      scheduledAt,
      status: scheduledAt ? 'scheduled' : 'draft',
      progress: {
        total: totalRecipients,
        sent: 0,
        delivered: 0,
        failed: 0,
        blocked: 0,
      },
      batchSize,
      batchDelayMs,
      createdBy: new Types.ObjectId(createdBy),
    };

    // Add type-specific fields
    if (messageType === 'text') {
      createData.message = message;
    } else if (['photo', 'video', 'document', 'audio'].includes(messageType)) {
      createData.mediaUrl = mediaUrl;
      createData.mediaCaption = caption;
      createData.message = caption; // For compatibility
    } else if (messageType === 'poll' && pollOptions) {
      createData.pollQuestion = pollQuestion;
      createData.pollOptions = pollOptions.filter(o => o.trim());
      createData.pollIsAnonymous = pollIsAnonymous;
      createData.pollAllowsMultiple = pollAllowsMultiple;
    }

    // Create broadcast record
    const broadcast = await Broadcast.create(createData);

    logger.info('broadcast', {
      action: 'broadcast_created',
      broadcastId: broadcast._id.toString(),
      title,
      messageType,
      targetType,
      totalRecipients,
    });

    return broadcast.toObject();
  },

  /**
   * Start a broadcast (change status to pending and add to queue)
   */
  async startBroadcast(broadcastId: string): Promise<IBroadcast> {
    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    if (!['draft', 'scheduled', 'paused'].includes(broadcast.status)) {
      throw new Error(`Cannot start broadcast with status: ${broadcast.status}`);
    }

    // Update status
    broadcast.status = 'pending';
    await broadcast.save();

    // Add to queue for processing
    await broadcastQueue.add(
      'process-broadcast',
      { broadcastId: broadcast._id.toString() },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      }
    );

    logger.info('broadcast', {
      action: 'broadcast_started',
      broadcastId: broadcast._id.toString(),
    });

    return broadcast.toObject();
  },

  /**
   * Pause a running broadcast
   */
  async pauseBroadcast(broadcastId: string): Promise<IBroadcast> {
    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    if (broadcast.status !== 'sending') {
      throw new Error('Can only pause a sending broadcast');
    }

    broadcast.status = 'paused';
    broadcast.pausedAt = new Date();
    await broadcast.save();

    // Emit update
    this.emitBroadcastUpdate(broadcast);

    logger.info('broadcast', {
      action: 'broadcast_paused',
      broadcastId: broadcast._id.toString(),
    });

    return broadcast.toObject();
  },

  /**
   * Resume a paused broadcast
   */
  async resumeBroadcast(broadcastId: string): Promise<IBroadcast> {
    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    if (broadcast.status !== 'paused') {
      throw new Error('Can only resume a paused broadcast');
    }

    // Re-add to queue
    await broadcastQueue.add(
      'process-broadcast',
      { broadcastId: broadcast._id.toString() },
      {
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    broadcast.status = 'pending';
    await broadcast.save();

    logger.info('broadcast', {
      action: 'broadcast_resumed',
      broadcastId: broadcast._id.toString(),
    });

    return broadcast.toObject();
  },

  /**
   * Cancel a broadcast
   */
  async cancelBroadcast(broadcastId: string): Promise<IBroadcast> {
    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    if (['completed', 'cancelled', 'failed'].includes(broadcast.status)) {
      throw new Error(`Cannot cancel broadcast with status: ${broadcast.status}`);
    }

    broadcast.status = 'cancelled';
    broadcast.cancelledAt = new Date();
    await broadcast.save();

    // Delete pending recipients
    await BroadcastRecipient.deleteMany({
      broadcastId: broadcast._id,
      status: 'pending',
    });

    // Emit update
    this.emitBroadcastUpdate(broadcast);

    logger.info('broadcast', {
      action: 'broadcast_cancelled',
      broadcastId: broadcast._id.toString(),
      sentCount: broadcast.progress.sent,
    });

    return broadcast.toObject();
  },

  /**
   * Get broadcast by ID with details
   */
  async getBroadcast(broadcastId: string): Promise<BroadcastDetails | null> {
    const broadcast = await Broadcast.findById(broadcastId)
      .populate('createdBy', 'name')
      .populate('segmentId', 'name')
      .lean();

    if (!broadcast) return null;

    return {
      ...(broadcast as any),
      segmentName: (broadcast.segmentId as any)?.name,
      createdByName: (broadcast.createdBy as any)?.name,
    } as unknown as BroadcastDetails;
  },

  /**
   * List broadcasts with pagination
   */
  async listBroadcasts(params: {
    page?: number;
    limit?: number;
    status?: BroadcastStatus;
  } = {}): Promise<{ broadcasts: BroadcastListItem[]; total: number; page: number; totalPages: number }> {
    const { page = 1, limit = 20, status } = params;

    const query: FilterQuery<IBroadcast> = {};
    if (status) {
      query.status = status;
    }

    const [broadcasts, total] = await Promise.all([
      Broadcast.find(query)
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Broadcast.countDocuments(query),
    ]);

    return {
      broadcasts: broadcasts.map((b) => ({
        _id: b._id.toString(),
        title: b.title,
        status: b.status,
        targetType: b.targetType,
        progress: b.progress,
        createdAt: b.createdAt,
        startedAt: b.startedAt,
        completedAt: b.completedAt,
        createdByName: (b.createdBy as any)?.name,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get broadcast recipients with pagination and filtering
   */
  async getBroadcastRecipients(
    broadcastId: string,
    params: { page?: number; limit?: number; status?: DeliveryStatus } = {}
  ): Promise<PaginatedRecipients> {
    const { page = 1, limit = 50, status } = params;

    const query: FilterQuery<IBroadcastRecipientDoc> = {
      broadcastId: new Types.ObjectId(broadcastId),
    };
    if (status) {
      query.status = status;
    }

    const [recipients, total] = await Promise.all([
      BroadcastRecipient.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BroadcastRecipient.countDocuments(query),
    ]);

    return {
      recipients: recipients.map((r) => ({
        _id: r._id.toString(),
        userId: r.userId.toString(),
        telegramId: r.telegramId,
        username: r.username,
        firstName: r.firstName,
        status: r.status,
        sentAt: r.sentAt,
        deliveredAt: r.deliveredAt,
        errorCode: r.errorCode,
        errorMessage: r.errorMessage,
        retryCount: r.retryCount,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get error summary for a broadcast
   */
  async getErrorSummary(broadcastId: string): Promise<{ errorCode: string; count: number; message: string }[]> {
    const result = await BroadcastRecipient.aggregate([
      {
        $match: {
          broadcastId: new Types.ObjectId(broadcastId),
          status: { $in: ['failed', 'blocked'] },
        },
      },
      {
        $group: {
          _id: '$errorCode',
          count: { $sum: 1 },
          message: { $first: '$errorMessage' },
        },
      },
      { $sort: { count: -1 } },
    ]);

    return result.map((r) => ({
      errorCode: r._id || 'UNKNOWN',
      count: r.count,
      message: r.message || 'Unknown error',
    }));
  },

  // ==================== WORKER HELPERS ====================

  /**
   * Get users for a segment (used by worker)
   */
  async getSegmentUserCount(segmentId: string): Promise<number> {
    const segment = await Segment.findById(segmentId);
    if (!segment?.filters) return 0;

    const pipeline = buildSegmentPipeline(segment.filters);
    pipeline.push({ $count: 'total' });

    const result = await User.aggregate(pipeline);
    return result[0]?.total || 0;
  },

  /**
   * Prepare recipients for broadcast (called by worker)
   */
  async prepareRecipients(broadcastId: string): Promise<number> {
    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    // Skip if already processed
    if (broadcast.recipientsProcessed) {
      return await BroadcastRecipient.countDocuments({ 
        broadcastId: broadcast._id,
        status: 'pending'
      });
    }

    let users: { _id: Types.ObjectId; telegramId: number; username?: string; firstName?: string }[] = [];

    if (broadcast.targetType === 'all') {
      users = await User.find(
        { isBlocked: { $ne: true }, telegramId: { $exists: true, $ne: null } },
        { _id: 1, telegramId: 1, username: 1, firstName: 1 }
      ).lean();
    } else if (broadcast.targetType === 'segment' && broadcast.segmentId) {
      const segment = await Segment.findById(broadcast.segmentId);
      if (segment?.filters) {
        const pipeline = buildSegmentPipeline(segment.filters);
        pipeline.push({
          $match: { telegramId: { $exists: true, $ne: null } },
        });
        pipeline.push({
          $project: { _id: 1, telegramId: 1, username: 1, firstName: 1 },
        });
        users = await User.aggregate(pipeline);
      }
    } else if (broadcast.targetType === 'manual' && broadcast.manualUserIds?.length) {
      users = await User.find(
        {
          _id: { $in: broadcast.manualUserIds },
          telegramId: { $exists: true, $ne: null },
        },
        { _id: 1, telegramId: 1, username: 1, firstName: 1 }
      ).lean();
    }

    // Bulk insert recipients
    if (users.length > 0) {
      const recipientDocs = users.map((user) => ({
        broadcastId: broadcast._id,
        userId: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        status: 'pending' as DeliveryStatus,
        retryCount: 0,
      }));

      // Insert in batches of 1000
      const BATCH_SIZE = 1000;
      for (let i = 0; i < recipientDocs.length; i += BATCH_SIZE) {
        const batch = recipientDocs.slice(i, i + BATCH_SIZE);
        await BroadcastRecipient.insertMany(batch, { ordered: false }).catch((err) => {
          // Ignore duplicate key errors
          if (err.code !== 11000) throw err;
        });
      }
    }

    // Update broadcast
    await Broadcast.findByIdAndUpdate(broadcastId, {
      recipientsProcessed: true,
      'progress.total': users.length,
    });

    logger.info('broadcast', {
      action: 'recipients_prepared',
      broadcastId,
      count: users.length,
    });

    return users.length;
  },

  /**
   * Get next batch of pending recipients
   */
  async getNextBatch(broadcastId: string, batchSize: number): Promise<IBroadcastRecipientDoc[]> {
    const recipients = await BroadcastRecipient.find({
      broadcastId: new Types.ObjectId(broadcastId),
      status: 'pending',
    })
      .sort({ createdAt: 1 })
      .limit(batchSize)
      .lean();

    return recipients as unknown as IBroadcastRecipientDoc[];
  },

  /**
   * Mark recipient as sent/failed
   */
  async updateRecipientStatus(
    recipientId: string,
    status: DeliveryStatus,
    error?: { code?: string; message?: string }
  ): Promise<void> {
    const update: any = { status };

    if (status === 'sent' || status === 'delivered') {
      update.sentAt = new Date();
    }
    if (status === 'delivered') {
      update.deliveredAt = new Date();
    }
    if (error) {
      update.errorCode = error.code || 'UNKNOWN';
      update.errorMessage = error.message || 'Unknown error';
    }

    await BroadcastRecipient.findByIdAndUpdate(recipientId, update);
  }  ,

  /**
   * Increment retry count
   */
  async incrementRetry(recipientId: string): Promise<number> {
    const result = await BroadcastRecipient.findByIdAndUpdate(
      recipientId,
      { $inc: { retryCount: 1 } },
      { new: true }
    );
    return result?.retryCount || 0;
  },

  /**
   * Update broadcast progress
   */
  async updateProgress(
    broadcastId: string,
    update: Partial<IBroadcast['progress']>
  ): Promise<void> {
    const incUpdate: any = {};
    if (update.sent !== undefined) incUpdate['progress.sent'] = update.sent;
    if (update.delivered !== undefined) incUpdate['progress.delivered'] = update.delivered;
    if (update.failed !== undefined) incUpdate['progress.failed'] = update.failed;
    if (update.blocked !== undefined) incUpdate['progress.blocked'] = update.blocked;

    await Broadcast.findByIdAndUpdate(broadcastId, { $inc: incUpdate });

    // Emit progress update
    const broadcast = await Broadcast.findById(broadcastId);
    if (broadcast) {
      this.emitBroadcastUpdate(broadcast);
    }
  },

  /**
   * Mark broadcast as complete
   */
  async markComplete(broadcastId: string, status: 'completed' | 'failed' = 'completed'): Promise<void> {
    await Broadcast.findByIdAndUpdate(broadcastId, {
      status,
      completedAt: new Date(),
    });

    const broadcast = await Broadcast.findById(broadcastId);
    if (broadcast) {
      this.emitBroadcastUpdate(broadcast);
    }

    logger.info('broadcast', {
      action: 'broadcast_completed',
      broadcastId,
      status,
      progress: broadcast?.progress,
    });
  },

  /**
   * Mark broadcast as sending
   */
  async markSending(broadcastId: string): Promise<void> {
    await Broadcast.findByIdAndUpdate(broadcastId, {
      status: 'sending',
      startedAt: new Date(),
    });
  },

  /**
   * Set broadcast error
   */
  async setError(broadcastId: string, error: string): Promise<void> {
    await Broadcast.findByIdAndUpdate(broadcastId, {
      lastError: error,
      $inc: { errorCount: 1 },
    });
  },

  /**
   * Emit broadcast update via Socket.IO
   */
  emitBroadcastUpdate(broadcast: IBroadcast): void {
    try {
      const io = getIO();
      io.to('admin').emit('broadcast:update', {
        _id: broadcast._id.toString(),
        status: broadcast.status,
        progress: broadcast.progress,
        completedAt: broadcast.completedAt,
        pausedAt: broadcast.pausedAt,
        cancelledAt: broadcast.cancelledAt,
      });
    } catch (err) {
      // Socket may not be initialized
    }
  },

  /**
   * Delete a broadcast and its recipients
   */
  async deleteBroadcast(broadcastId: string): Promise<boolean> {
    const broadcast = await Broadcast.findById(broadcastId);
    if (!broadcast) {
      return false;
    }

    // Only allow deletion of completed/cancelled/failed broadcasts
    if (!['completed', 'cancelled', 'failed', 'draft'].includes(broadcast.status)) {
      throw new Error('Can only delete completed, cancelled, failed, or draft broadcasts');
    }

    // Delete recipients first
    await BroadcastRecipient.deleteMany({ broadcastId: broadcast._id });

    // Delete broadcast
    await Broadcast.findByIdAndDelete(broadcastId);

    logger.info('broadcast', {
      action: 'broadcast_deleted',
      broadcastId,
    });

    return true;
  },

  /**
   * Get broadcast statistics
   */
  async getStats(): Promise<{
    total: number;
    byStatus: Record<BroadcastStatus, number>;
    totalMessagesSent: number;
    last24h: number;
  }> {
    const [statusCounts, totalMessages, last24h] = await Promise.all([
      Broadcast.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Broadcast.aggregate([
        { $group: { _id: null, total: { $sum: '$progress.sent' } } },
      ]),
      Broadcast.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);

    const byStatus = {
      draft: 0,
      scheduled: 0,
      pending: 0,
      sending: 0,
      paused: 0,
      completed: 0,
      cancelled: 0,
      failed: 0,
    } as Record<BroadcastStatus, number>;

    statusCounts.forEach((s: any) => {
      byStatus[s._id as BroadcastStatus] = s.count;
    });

    return {
      total: Object.values(byStatus).reduce((a, b) => a + b, 0),
      byStatus,
      totalMessagesSent: totalMessages[0]?.total || 0,
      last24h,
    };
  },
};

export default broadcastService;

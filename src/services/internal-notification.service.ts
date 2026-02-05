/**
 * Internal Notification Service
 * Handles supervisor/admin to agent private messaging
 */

import { Types } from 'mongoose';
import { InternalNotification, type IInternalNotification, type NotificationPriority, type NotificationType, AuditLog } from '../database/models/index.js';
import { getIO } from './socket.js';
import { Agent } from '../database/models/Agent.js';
import { sendTelegramNotification } from './telegram-notification.service.js';

// ============= TYPES =============

interface CreateNotificationParams {
  toAgentId: string;
  fromAdminId: string;
  type?: NotificationType;
  title?: string;
  message: string;
  priority?: NotificationPriority;
  relatedChatId?: string;
  relatedUserId?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

interface NotificationResult {
  notification: IInternalNotification;
  deliveredVia: 'socket' | 'telegram' | 'both' | 'none';
}

// ============= SERVICE =============

class InternalNotificationService {
  /**
   * Send a notification to an agent
   */
  async sendNotification(params: CreateNotificationParams): Promise<NotificationResult> {
    const {
      toAgentId,
      fromAdminId,
      type = 'message',
      title,
      message,
      priority = 'normal',
      relatedChatId,
      relatedUserId,
      actionUrl,
      actionLabel,
      metadata,
    } = params;

    // Create notification in DB
    const notification = await InternalNotification.create({
      toAgentId: new Types.ObjectId(toAgentId),
      fromAdminId: new Types.ObjectId(fromAdminId),
      type,
      title,
      message,
      priority,
      relatedChatId: relatedChatId ? new Types.ObjectId(relatedChatId) : undefined,
      relatedUserId: relatedUserId ? new Types.ObjectId(relatedUserId) : undefined,
      actionUrl,
      actionLabel,
      metadata,
    });

    // Populate sender info
    await notification.populate('fromAdminId', 'name avatar role');

    // Try to deliver via socket
    let deliveredViaSocket = false;
    let deliveredViaTelegram = false;

    const io = getIO();
    if (io) {
      // Get sender info for emit
      const sender = notification.fromAdminId as any; // Already populated
      const fromData = {
        _id: sender._id?.toString() || fromAdminId,
        name: sender.name || 'Admin',
        avatar: sender.avatar,
        role: sender.role || 'admin',
      };
      
      // Emit to specific agent's room
      io.to(`agent:${toAgentId}`).emit('agent.notification', {
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        from: fromData,
        actionUrl: notification.actionUrl,
        actionLabel: notification.actionLabel,
        relatedChatId: notification.relatedChatId?.toString(),
        createdAt: notification.createdAt,
      });
      
      // Check if agent is online (has active socket connections)
      const agentRoom = io.sockets.adapter.rooms.get(`agent:${toAgentId}`);
      if (agentRoom && agentRoom.size > 0) {
        deliveredViaSocket = true;
      }
    }

    // If urgent and agent offline, send via Telegram
    if (priority === 'urgent' && !deliveredViaSocket) {
      try {
        const agent = await Agent.findById(toAgentId).select('telegramId name').lean();
        if (agent?.telegramId) {
          const senderInfo = await Agent.findById(fromAdminId).select('name').lean();
          const telegramMessage = `🔔 *Notificación Urgente*\n\nDe: ${senderInfo?.name || 'Admin'}\n${title ? `*${title}*\n` : ''}${message}`;
          
          await sendTelegramNotification(agent.telegramId.toString(), telegramMessage);
          deliveredViaTelegram = true;
        }
      } catch (error) {
        console.error('[InternalNotification] Failed to send Telegram fallback:', error);
      }
    }

    // Update delivery status
    let deliveredVia: 'socket' | 'telegram' | 'both' | 'none' = 'none';
    if (deliveredViaSocket && deliveredViaTelegram) {
      deliveredVia = 'both';
    } else if (deliveredViaSocket) {
      deliveredVia = 'socket';
    } else if (deliveredViaTelegram) {
      deliveredVia = 'telegram';
    }

    if (deliveredVia !== 'none') {
      notification.deliveredAt = new Date();
      notification.deliveredVia = deliveredVia as 'socket' | 'telegram' | 'both';
      await notification.save();
    }

    // Audit log - simple log without full structure
    try {
      const senderInfo = await Agent.findById(fromAdminId).select('name email role').lean();
      await AuditLog.create({
        action: 'SEND_INTERNAL_NOTIFICATION',
        category: 'communication',
        severity: priority === 'urgent' ? 'medium' : 'low',
        actorId: new Types.ObjectId(fromAdminId),
        actorType: senderInfo?.role === 'admin' ? 'admin' : 'agent',
        actorName: senderInfo?.name || 'Unknown',
        actorEmail: senderInfo?.email,
        actorIp: 'internal',
        targetType: 'agent',
        targetId: toAgentId,
        targetDescription: `Notification to agent`,
        metadata: {
          notificationId: notification._id.toString(),
          type,
          priority,
          deliveredVia,
        },
      });
    } catch (e) {
      console.error('[InternalNotification] Audit log failed:', e);
    }

    return { notification, deliveredVia };
  }

  /**
   * Get unread notifications for an agent
   */
  async getUnreadNotifications(agentId: string, limit = 50) {
    return InternalNotification.find({
      toAgentId: new Types.ObjectId(agentId),
      read: false,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('fromAdminId', 'name avatar role')
      .lean();
  }

  /**
   * Get all notifications for an agent with pagination
   */
  async getNotifications(agentId: string, options: { page?: number; limit?: number; unreadOnly?: boolean } = {}) {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const skip = (page - 1) * limit;

    const query: any = { toAgentId: new Types.ObjectId(agentId) };
    if (unreadOnly) {
      query.read = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      InternalNotification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('fromAdminId', 'name avatar role')
        .lean(),
      InternalNotification.countDocuments(query),
      InternalNotification.countDocuments({ toAgentId: new Types.ObjectId(agentId), read: false }),
    ]);

    return {
      notifications,
      total,
      unreadCount,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get unread count for an agent
   */
  async getUnreadCount(agentId: string): Promise<number> {
    return InternalNotification.countDocuments({
      toAgentId: new Types.ObjectId(agentId),
      read: false,
    });
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, agentId: string): Promise<IInternalNotification | null> {
    const notification = await InternalNotification.findOneAndUpdate(
      {
        _id: new Types.ObjectId(notificationId),
        toAgentId: new Types.ObjectId(agentId),
      },
      {
        read: true,
        readAt: new Date(),
      },
      { new: true }
    );

    // Emit updated count
    if (notification) {
      const io = getIO();
      if (io) {
        const unreadCount = await this.getUnreadCount(agentId);
        io.to(`agent:${agentId}`).emit('notification.count', { unreadCount });
      }
    }

    return notification;
  }

  /**
   * Mark all notifications as read for an agent
   */
  async markAllAsRead(agentId: string): Promise<number> {
    const result = await InternalNotification.updateMany(
      {
        toAgentId: new Types.ObjectId(agentId),
        read: false,
      },
      {
        read: true,
        readAt: new Date(),
      }
    );

    // Emit updated count
    const io = getIO();
    if (io) {
      io.to(`agent:${agentId}`).emit('notification.count', { unreadCount: 0 });
    }

    return result.modifiedCount;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, agentId: string): Promise<boolean> {
    const result = await InternalNotification.deleteOne({
      _id: new Types.ObjectId(notificationId),
      toAgentId: new Types.ObjectId(agentId),
    });

    if (result.deletedCount > 0) {
      const io = getIO();
      if (io) {
        const unreadCount = await this.getUnreadCount(agentId);
        io.to(`agent:${agentId}`).emit('notification.count', { unreadCount });
      }
    }

    return result.deletedCount > 0;
  }

  /**
   * Get notifications sent by an admin/supervisor
   */
  async getSentNotifications(adminId: string, options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      InternalNotification.find({ fromAdminId: new Types.ObjectId(adminId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('toAgentId', 'name avatar role')
        .lean(),
      InternalNotification.countDocuments({ fromAdminId: new Types.ObjectId(adminId) }),
    ]);

    return {
      notifications,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}

export const internalNotificationService = new InternalNotificationService();
export default internalNotificationService;

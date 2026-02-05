/**
 * Internal Notification Model
 * For supervisor/admin to agent private messages
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============= TYPES =============

export type NotificationPriority = 'normal' | 'urgent';
export type NotificationType = 
  | 'message'        // Direct message from supervisor
  | 'assignment'     // Chat/task assignment
  | 'reminder'       // Reminder
  | 'alert'          // System alert
  | 'vip'            // VIP customer notification
  | 'escalation';    // Escalation notice

// ============= INTERFACE =============

export interface IInternalNotification extends Document {
  _id: Types.ObjectId;
  
  // Participants
  toAgentId: Types.ObjectId;
  fromAdminId: Types.ObjectId;
  
  // Content
  type: NotificationType;
  title?: string;
  message: string;
  priority: NotificationPriority;
  
  // Related entities
  relatedChatId?: Types.ObjectId;
  relatedUserId?: Types.ObjectId;
  
  // Action
  actionUrl?: string;
  actionLabel?: string;
  
  // Status
  read: boolean;
  readAt?: Date;
  deliveredAt?: Date;
  deliveredVia?: 'socket' | 'telegram' | 'both';
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============= SCHEMA =============

const InternalNotificationSchema = new Schema<IInternalNotification>(
  {
    toAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    fromAdminId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
    type: {
      type: String,
      enum: ['message', 'assignment', 'reminder', 'alert', 'vip', 'escalation'],
      default: 'message',
    },
    title: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    priority: {
      type: String,
      enum: ['normal', 'urgent'],
      default: 'normal',
    },
    relatedChatId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
    },
    relatedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    actionLabel: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: Date,
    deliveredAt: Date,
    deliveredVia: {
      type: String,
      enum: ['socket', 'telegram', 'both'],
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// ============= INDEXES =============

// Primary query: unread notifications for agent
InternalNotificationSchema.index({ toAgentId: 1, read: 1, createdAt: -1 });

// For cleanup and analytics
InternalNotificationSchema.index({ createdAt: 1 });

// For sender history
InternalNotificationSchema.index({ fromAdminId: 1, createdAt: -1 });

// ============= STATICS =============

InternalNotificationSchema.statics.getUnreadCount = async function(agentId: Types.ObjectId): Promise<number> {
  return this.countDocuments({ toAgentId: agentId, read: false });
};

InternalNotificationSchema.statics.getUnreadForAgent = async function(agentId: Types.ObjectId, limit = 50) {
  return this.find({ toAgentId: agentId, read: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('fromAdminId', 'name avatar role')
    .lean();
};

InternalNotificationSchema.statics.markAsRead = async function(notificationId: Types.ObjectId, agentId: Types.ObjectId) {
  return this.findOneAndUpdate(
    { _id: notificationId, toAgentId: agentId },
    { read: true, readAt: new Date() },
    { new: true }
  );
};

InternalNotificationSchema.statics.markAllAsRead = async function(agentId: Types.ObjectId) {
  return this.updateMany(
    { toAgentId: agentId, read: false },
    { read: true, readAt: new Date() }
  );
};

// ============= EXPORT =============

export const InternalNotification = mongoose.model<IInternalNotification>(
  'InternalNotification',
  InternalNotificationSchema
);

export default InternalNotification;

/**
 * ScheduledMessage Model - Event-based and time-based scheduled messages
 * Enables automatic follow-ups, reminders, and conditional messaging
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type ScheduleType = 'immediate' | 'delayed' | 'conditional';
export type ScheduleEvent = 'userInactive' | 'agentConnected' | 'chatInQueue' | 'noResponse' | 'custom';
export type ScheduledMessageStatus = 'pending' | 'sent' | 'cancelled' | 'failed' | 'expired';
export type MessageSender = 'bot' | 'system' | 'agent';
export type MessageType = 'text' | 'image' | 'document' | 'savedReply';

export interface IScheduledMessage extends Document {
  _id: Types.ObjectId;
  
  // Target
  sessionId?: string;               // Specific session
  userId?: Types.ObjectId;          // Specific user
  
  // When to send
  schedule: {
    type: ScheduleType;
    
    // For delayed
    sendAt?: Date;
    
    // For conditional
    condition?: {
      event: ScheduleEvent;
      thresholdMinutes?: number;
      customCondition?: string;     // Expression to evaluate
    };
  };
  
  // Message content
  message: {
    content: string;
    sender: MessageSender;
    messageType: MessageType;
    mediaUrl?: string;
    savedReplyId?: Types.ObjectId;
  };
  
  // Status tracking
  status: ScheduledMessageStatus;
  sentAt?: Date;
  error?: string;
  attempts: number;
  lastAttemptAt?: Date;
  
  // Related
  relatedRuleId?: Types.ObjectId;   // If created by automation rule
  
  // Expiration
  expiresAt?: Date;                 // Auto-cancel after this time
  
  // Audit
  createdBy: Types.ObjectId;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledMessageSchema = new Schema<IScheduledMessage>(
  {
    sessionId: {
      type: String,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    schedule: {
      type: {
        type: String,
        enum: ['immediate', 'delayed', 'conditional'],
        required: true,
      },
      sendAt: Date,
      condition: {
        event: {
          type: String,
          enum: ['userInactive', 'agentConnected', 'chatInQueue', 'noResponse', 'custom'],
        },
        thresholdMinutes: Number,
        customCondition: String,
      },
    },
    message: {
      content: {
        type: String,
        required: true,
        maxlength: 4000,
      },
      sender: {
        type: String,
        enum: ['bot', 'system', 'agent'],
        default: 'bot',
      },
      messageType: {
        type: String,
        enum: ['text', 'image', 'document', 'savedReply'],
        default: 'text',
      },
      mediaUrl: String,
      savedReplyId: {
        type: Schema.Types.ObjectId,
        ref: 'SavedReply',
      },
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'cancelled', 'failed', 'expired'],
      default: 'pending',
      index: true,
    },
    sentAt: Date,
    error: String,
    attempts: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: Date,
    relatedRuleId: {
      type: Schema.Types.ObjectId,
      ref: 'AutomationRule',
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    cancelledAt: Date,
    cancelReason: String,
  },
  {
    timestamps: true,
  }
);

// Index for finding pending messages to send
ScheduledMessageSchema.index({ status: 1, 'schedule.sendAt': 1 });
ScheduledMessageSchema.index({ status: 1, 'schedule.condition.event': 1 });

export const ScheduledMessage = mongoose.model<IScheduledMessage>('ScheduledMessage', ScheduledMessageSchema);

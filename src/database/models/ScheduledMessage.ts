/**
 * ScheduledMessage Model - Robust scheduled messaging system
 * Supports: fixed time, inactivity-based, and event-based triggers
 * 
 * Features:
 * - Idempotent execution (exactly-once semantics)
 * - Persistent across server restarts
 * - Automatic cancellation on conditions
 * - Full audit trail
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Type definitions
export type ScheduleType = 'fixed_time' | 'after_inactivity' | 'on_event';
export type TriggerEvent = 'agent_online' | 'chat_assigned' | 'chat_reopened' | 'sla_warning' | 'chat_transferred';
export type ScheduledMessageStatus = 'pending' | 'processing' | 'sent' | 'cancelled' | 'failed' | 'expired';
export type MediaType = 'photo' | 'audio' | 'document' | 'video' | 'voice';

export interface IScheduledMessageMedia {
  type: MediaType;
  fileId?: string;      // Telegram file_id for already uploaded files
  url?: string;         // URL for files to be fetched
  caption?: string;
}

export interface IScheduledMessage extends Document {
  _id: Types.ObjectId;
  
  // Target session/chat
  sessionId: string;
  chatId: number;                   // Telegram chat ID for direct sending
  
  // Creator
  createdBy: Types.ObjectId | 'system';
  createdByName?: string;
  
  // Schedule configuration
  type: ScheduleType;
  
  // For fixed_time
  scheduledAt?: Date;
  
  // For after_inactivity
  delayMinutes?: number;
  inactivityStartedAt?: Date;       // When inactivity timer started
  
  // For on_event
  triggerEvent?: TriggerEvent;
  triggerMetadata?: Record<string, unknown>;
  
  // Message content
  message: {
    text?: string;
    media?: IScheduledMessageMedia;
    savedReplyId?: Types.ObjectId;
    placeholders?: Record<string, string>;  // Pre-resolved placeholders
  };
  
  // Execution tracking
  status: ScheduledMessageStatus;
  sentAt?: Date;
  telegramMessageId?: number;
  error?: string;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  
  // Lock for processing (prevents double execution)
  processingLock?: {
    lockedAt: Date;
    lockId: string;                 // Unique worker/instance ID
    expiresAt: Date;
  };
  
  // Cancellation
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  cancelReason?: string;
  autoCancelledReason?: string;     // System-generated cancellation reason
  
  // Expiration
  expiresAt?: Date;
  
  // Relations
  relatedRuleId?: Types.ObjectId;   // If created by automation
  parentMessageId?: Types.ObjectId; // For follow-up chains
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ScheduledMessageSchema = new Schema<IScheduledMessage>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    chatId: {
      type: Number,
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.Mixed,
      required: true,
    },
    createdByName: String,
    
    type: {
      type: String,
      enum: ['fixed_time', 'after_inactivity', 'on_event'],
      required: true,
      index: true,
    },
    
    // Fixed time
    scheduledAt: {
      type: Date,
      index: true,
    },
    
    // Inactivity
    delayMinutes: Number,
    inactivityStartedAt: Date,
    
    // Event-based
    triggerEvent: {
      type: String,
      enum: ['agent_online', 'chat_assigned', 'chat_reopened', 'sla_warning', 'chat_transferred'],
    },
    triggerMetadata: Schema.Types.Mixed,
    
    // Message content
    message: {
      text: {
        type: String,
        maxlength: 4096,
      },
      media: {
        type: {
          type: String,
          enum: ['photo', 'audio', 'document', 'video', 'voice'],
        },
        fileId: String,
        url: String,
        caption: String,
      },
      savedReplyId: {
        type: Schema.Types.ObjectId,
        ref: 'SavedReply',
      },
      placeholders: Schema.Types.Mixed,
    },
    
    // Status
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'cancelled', 'failed', 'expired'],
      default: 'pending',
      index: true,
    },
    sentAt: Date,
    telegramMessageId: Number,
    error: String,
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastAttemptAt: Date,
    
    // Processing lock
    processingLock: {
      lockedAt: Date,
      lockId: String,
      expiresAt: Date,
    },
    
    // Cancellation
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    cancelledAt: Date,
    cancelReason: String,
    autoCancelledReason: String,
    
    // Expiration
    expiresAt: Date,
    
    // Relations
    relatedRuleId: {
      type: Schema.Types.ObjectId,
      ref: 'AutomationRule',
    },
    parentMessageId: {
      type: Schema.Types.ObjectId,
      ref: 'ScheduledMessage',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
ScheduledMessageSchema.index({ status: 1, scheduledAt: 1 });
ScheduledMessageSchema.index({ status: 1, type: 1 });
ScheduledMessageSchema.index({ status: 1, triggerEvent: 1 });
ScheduledMessageSchema.index({ sessionId: 1, status: 1 });
ScheduledMessageSchema.index({ 'processingLock.expiresAt': 1 }, { sparse: true });
ScheduledMessageSchema.index({ expiresAt: 1 }, { sparse: true });

// Compound index for inactivity-based messages
ScheduledMessageSchema.index({ 
  status: 1, 
  type: 1, 
  inactivityStartedAt: 1,
  delayMinutes: 1 
});

export const ScheduledMessage = mongoose.model<IScheduledMessage>('ScheduledMessage', ScheduledMessageSchema);

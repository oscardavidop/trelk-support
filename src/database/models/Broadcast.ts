/**
 * Broadcast Model - Mass messaging campaigns
 * Stores broadcast jobs, progress, and delivery results
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============= TYPES =============

export type BroadcastStatus = 
  | 'draft'      // Created but not started
  | 'scheduled'  // Scheduled for future
  | 'pending'    // Ready to start
  | 'sending'    // Currently sending
  | 'paused'     // Paused by user
  | 'completed'  // All sent
  | 'cancelled'  // Cancelled by user
  | 'failed';    // Failed with error

export type BroadcastTargetType = 
  | 'all'        // All users
  | 'segment'    // Specific segment
  | 'manual';    // Manual user selection

export type DeliveryStatus = 
  | 'pending' 
  | 'sent' 
  | 'delivered' 
  | 'failed' 
  | 'blocked';

export type BroadcastMessageType = 
  | 'text'       // Text message
  | 'photo'      // Photo with optional caption
  | 'video'      // Video with optional caption
  | 'document'   // Document/file
  | 'audio'      // Audio file
  | 'poll';      // Poll/quiz

// ============= INTERFACES =============

export interface IBroadcastRecipient {
  userId: Types.ObjectId;
  telegramId: number;
  status: DeliveryStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
}

export interface IBroadcast extends Document {
  _id: Types.ObjectId;
  
  // Basic info
  title: string;                    // Internal title for reference
  messageType: BroadcastMessageType; // Type of message
  message: string;                  // Text content or caption
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  
  // Media (for photo, video, document, audio)
  mediaUrl?: string;                // URL to media file
  mediaCaption?: string;            // Caption for media
  
  // Poll (for poll type)
  pollQuestion?: string;            // Poll question
  pollOptions?: string[];           // Poll options
  pollIsAnonymous?: boolean;        // Is anonymous poll
  pollAllowsMultiple?: boolean;     // Allow multiple answers
  
  // Targeting
  targetType: BroadcastTargetType;
  segmentId?: Types.ObjectId;       // If targeting a segment
  manualUserIds?: Types.ObjectId[]; // If manual selection
  
  // Scheduling
  scheduledAt?: Date;               // When to send (null = immediate)
  
  // Status tracking
  status: BroadcastStatus;
  progress: {
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    blocked: number;
  };
  
  // Recipients (stored separately for large broadcasts)
  recipientsProcessed: boolean;
  
  // Execution details
  startedAt?: Date;
  completedAt?: Date;
  pausedAt?: Date;
  cancelledAt?: Date;
  
  // Rate limiting
  batchSize: number;               // Messages per batch
  batchDelayMs: number;            // Delay between batches
  
  // Error tracking
  lastError?: string;
  errorCount: number;
  
  // Audit
  createdBy: Types.ObjectId;       // Agent who created
  createdAt: Date;
  updatedAt: Date;
}

export interface IBroadcastRecipientDoc extends Document {
  broadcastId: Types.ObjectId;
  userId: Types.ObjectId;
  telegramId: number;
  username?: string;
  firstName?: string;
  status: DeliveryStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  errorCode?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
}

// ============= SCHEMAS =============

const BroadcastSchema = new Schema<IBroadcast>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    messageType: {
      type: String,
      enum: ['text', 'photo', 'video', 'document', 'audio', 'poll'],
      default: 'text',
    },
    message: {
      type: String,
      required: function(this: IBroadcast) {
        return this.messageType === 'text';
      },
      maxlength: 4096,  // Telegram limit
    },
    parseMode: {
      type: String,
      enum: ['HTML', 'Markdown', 'MarkdownV2'],
      default: undefined,
    },
    
    // Media fields
    mediaUrl: {
      type: String,
      maxlength: 2048,
    },
    mediaCaption: {
      type: String,
      maxlength: 1024,  // Telegram caption limit
    },
    
    // Poll fields
    pollQuestion: {
      type: String,
      maxlength: 300,
    },
    pollOptions: [{
      type: String,
      maxlength: 100,
    }],
    pollIsAnonymous: {
      type: Boolean,
      default: true,
    },
    pollAllowsMultiple: {
      type: Boolean,
      default: false,
    },
    
    // Targeting
    targetType: {
      type: String,
      enum: ['all', 'segment', 'manual'],
      required: true,
      default: 'all',
    },
    segmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Segment',
    },
    manualUserIds: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    
    // Scheduling
    scheduledAt: Date,
    
    // Status
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'pending', 'sending', 'paused', 'completed', 'cancelled', 'failed'],
      default: 'draft',
      index: true,
    },
    progress: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      blocked: { type: Number, default: 0 },
    },
    
    recipientsProcessed: {
      type: Boolean,
      default: false,
    },
    
    // Execution
    startedAt: Date,
    completedAt: Date,
    pausedAt: Date,
    cancelledAt: Date,
    
    // Rate limiting
    batchSize: {
      type: Number,
      default: 25,       // Telegram recommends ~30/sec
      min: 1,
      max: 30,
    },
    batchDelayMs: {
      type: Number,
      default: 1000,     // 1 second between batches
      min: 100,
      max: 5000,
    },
    
    // Error tracking
    lastError: String,
    errorCount: {
      type: Number,
      default: 0,
    },
    
    // Audit
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
BroadcastSchema.index({ status: 1, scheduledAt: 1 });
BroadcastSchema.index({ createdBy: 1, createdAt: -1 });
BroadcastSchema.index({ createdAt: -1 });

// ============= RECIPIENT SCHEMA (Separate collection for scalability) =============

const BroadcastRecipientSchema = new Schema<IBroadcastRecipientDoc>(
  {
    broadcastId: {
      type: Schema.Types.ObjectId,
      ref: 'Broadcast',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    telegramId: {
      type: Number,
      required: true,
    },
    username: String,
    firstName: String,
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'blocked'],
      default: 'pending',
      index: true,
    },
    sentAt: Date,
    deliveredAt: Date,
    errorCode: String,
    errorMessage: String,
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes for efficient queries
BroadcastRecipientSchema.index({ broadcastId: 1, status: 1 });
BroadcastRecipientSchema.index({ broadcastId: 1, telegramId: 1 }, { unique: true });

// ============= MODELS =============

export const Broadcast = mongoose.model<IBroadcast>('Broadcast', BroadcastSchema);
export const BroadcastRecipient = mongoose.model<IBroadcastRecipientDoc>('BroadcastRecipient', BroadcastRecipientSchema);

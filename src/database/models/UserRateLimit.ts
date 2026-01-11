/**
 * UserRateLimit Model - Rate limiting and abuse detection per user
 * Protects against spam, flooding, and malicious behavior
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type ViolationType = 'rateLimit' | 'spam' | 'largeFile' | 'blockedContent' | 'flooding' | 'harassment';
export type BlockReason = 'spam' | 'abuse' | 'manual' | 'automated';

export interface IViolation {
  type: ViolationType;
  count: number;
  lastOccurrence: Date;
  details?: string;
}

export interface IUserRateLimit extends Document {
  _id: Types.ObjectId;
  telegramId: number;
  userId?: Types.ObjectId;
  
  // Message rate limiting
  messageCount: number;
  messageWindowStart: Date;
  
  // File rate limiting
  fileCount: number;
  fileWindowStart: Date;
  
  // Request rate limiting (API calls)
  requestCount: number;
  requestWindowStart: Date;
  
  // Violations history
  violations: IViolation[];
  totalViolations: number;
  
  // Blocking status
  isTemporarilyBlocked: boolean;
  isPermanentlyBlocked: boolean;
  blockExpiresAt?: Date;
  blockReason?: BlockReason;
  blockedBy?: Types.ObjectId;
  blockedAt?: Date;
  
  // Trust score (higher = more trusted, less restrictions)
  trustScore: number;
  
  // Warnings
  warningCount: number;
  lastWarningAt?: Date;
  lastWarningMessage?: string;
  
  // Whitelist (bypass rate limits)
  isWhitelisted: boolean;
  whitelistedBy?: Types.ObjectId;
  whitelistedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const UserRateLimitSchema = new Schema<IUserRateLimit>(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    messageWindowStart: {
      type: Date,
      default: Date.now,
    },
    fileCount: {
      type: Number,
      default: 0,
    },
    fileWindowStart: {
      type: Date,
      default: Date.now,
    },
    requestCount: {
      type: Number,
      default: 0,
    },
    requestWindowStart: {
      type: Date,
      default: Date.now,
    },
    violations: [{
      type: {
        type: String,
        enum: ['rateLimit', 'spam', 'largeFile', 'blockedContent', 'flooding', 'harassment'],
        required: true,
      },
      count: { type: Number, default: 1 },
      lastOccurrence: { type: Date, default: Date.now },
      details: String,
    }],
    totalViolations: {
      type: Number,
      default: 0,
    },
    isTemporarilyBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    isPermanentlyBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    blockExpiresAt: {
      type: Date,
      index: true,
    },
    blockReason: {
      type: String,
      enum: ['spam', 'abuse', 'manual', 'automated'],
    },
    blockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    blockedAt: Date,
    trustScore: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    warningCount: {
      type: Number,
      default: 0,
    },
    lastWarningAt: Date,
    lastWarningMessage: String,
    isWhitelisted: {
      type: Boolean,
      default: false,
    },
    whitelistedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    whitelistedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Method to check if user is currently blocked
UserRateLimitSchema.methods.isBlocked = function(): boolean {
  if (this.isPermanentlyBlocked) return true;
  if (this.isTemporarilyBlocked && this.blockExpiresAt) {
    return new Date() < this.blockExpiresAt;
  }
  return false;
};

// Method to reset rate limit windows
UserRateLimitSchema.methods.resetWindows = function(): void {
  const now = new Date();
  this.messageCount = 0;
  this.messageWindowStart = now;
  this.fileCount = 0;
  this.fileWindowStart = now;
  this.requestCount = 0;
  this.requestWindowStart = now;
};

export const UserRateLimit = mongoose.model<IUserRateLimit>('UserRateLimit', UserRateLimitSchema);

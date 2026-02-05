/**
 * Internal Broadcast Model
 * For admin announcements to all agents or segments
 * Different from user-facing Broadcast.ts which is for customer campaigns
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============= TYPES =============

export type BroadcastLevel = 'info' | 'warning' | 'critical';
export type BroadcastTarget = 
  | 'all'           // All agents
  | 'online'        // Only currently online agents
  | 'supervisors'   // Only supervisors
  | 'admins'        // Only admins  
  | 'team'          // Specific team
  | 'high_load'     // Agents with high workload
  | 'custom';       // Custom agent IDs

// ============= INTERFACE =============

export interface IInternalBroadcast extends Document {
  _id: Types.ObjectId;
  
  // Content
  title: string;
  message: string;
  level: BroadcastLevel;
  
  // Targeting
  target: BroadcastTarget;
  targetTeamId?: Types.ObjectId;
  targetAgentIds?: Types.ObjectId[];
  
  // Behavior
  requireAck: boolean;          // Must acknowledge to dismiss
  isPinned: boolean;            // Stays visible until expired
  expiresAt?: Date;             // Auto-expire time
  
  // Creator
  createdBy: Types.ObjectId;
  
  // Stats (denormalized for quick access)
  stats: {
    totalTargeted: number;
    delivered: number;
    seen: number;
    acknowledged: number;
  };
  
  // Status
  isActive: boolean;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  
  // Metadata
  metadata?: Record<string, any>;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============= SCHEMA =============

const InternalBroadcastSchema = new Schema<IInternalBroadcast>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    level: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
    },
    target: {
      type: String,
      enum: ['all', 'online', 'supervisors', 'admins', 'team', 'high_load', 'custom'],
      default: 'all',
    },
    targetTeamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
    },
    targetAgentIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    }],
    requireAck: {
      type: Boolean,
      default: false,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
    stats: {
      totalTargeted: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      seen: { type: Number, default: 0 },
      acknowledged: { type: Number, default: 0 },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    cancelledAt: Date,
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
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

// Active broadcasts query
InternalBroadcastSchema.index({ isActive: 1, expiresAt: 1 });

// By creator for history
InternalBroadcastSchema.index({ createdBy: 1, createdAt: -1 });

// For cleanup
InternalBroadcastSchema.index({ createdAt: 1 });

// ============= VIRTUALS =============

InternalBroadcastSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

InternalBroadcastSchema.virtual('readRate').get(function() {
  if (this.stats.totalTargeted === 0) return 0;
  return (this.stats.seen / this.stats.totalTargeted) * 100;
});

InternalBroadcastSchema.virtual('ackRate').get(function() {
  if (this.stats.totalTargeted === 0) return 0;
  return (this.stats.acknowledged / this.stats.totalTargeted) * 100;
});

// ============= STATICS =============

InternalBroadcastSchema.statics.getActiveBroadcasts = async function() {
  const now = new Date();
  return this.find({
    isActive: true,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: now } },
    ],
  })
    .sort({ level: -1, createdAt: -1 }) // Critical first, then recent
    .populate('createdBy', 'name avatar')
    .lean();
};

// ============= EXPORT =============

export const InternalBroadcast = mongoose.model<IInternalBroadcast>(
  'InternalBroadcast',
  InternalBroadcastSchema
);

export default InternalBroadcast;

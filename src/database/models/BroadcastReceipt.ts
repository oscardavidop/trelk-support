/**
 * Broadcast Receipt Model
 * Tracks delivery and acknowledgment of internal broadcasts per agent
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============= INTERFACE =============

export interface IBroadcastReceipt extends Document {
  _id: Types.ObjectId;
  
  broadcastId: Types.ObjectId;
  agentId: Types.ObjectId;
  
  // Delivery tracking
  deliveredAt?: Date;
  deliveredVia?: 'socket' | 'telegram' | 'both';
  
  // View tracking
  seenAt?: Date;
  
  // Acknowledgment
  acknowledgedAt?: Date;
  
  // For offline delivery
  pendingDelivery: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

// ============= SCHEMA =============

const BroadcastReceiptSchema = new Schema<IBroadcastReceipt>(
  {
    broadcastId: {
      type: Schema.Types.ObjectId,
      ref: 'InternalBroadcast',
      required: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
    deliveredAt: Date,
    deliveredVia: {
      type: String,
      enum: ['socket', 'telegram', 'both'],
    },
    seenAt: Date,
    acknowledgedAt: Date,
    pendingDelivery: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ============= INDEXES =============

// Unique constraint: one receipt per broadcast per agent
BroadcastReceiptSchema.index({ broadcastId: 1, agentId: 1 }, { unique: true });

// For fetching agent's pending broadcasts
BroadcastReceiptSchema.index({ agentId: 1, acknowledgedAt: 1 });

// For fetching pending deliveries
BroadcastReceiptSchema.index({ pendingDelivery: 1 });

// For broadcast stats
BroadcastReceiptSchema.index({ broadcastId: 1, seenAt: 1 });
BroadcastReceiptSchema.index({ broadcastId: 1, acknowledgedAt: 1 });

// ============= STATICS =============

BroadcastReceiptSchema.statics.getPendingForAgent = async function(agentId: Types.ObjectId) {
  return this.find({
    agentId,
    acknowledgedAt: { $exists: false },
  })
    .populate({
      path: 'broadcastId',
      match: {
        isActive: true,
        $or: [
          { expiresAt: { $exists: false } },
          { expiresAt: { $gt: new Date() } },
        ],
      },
      populate: {
        path: 'createdBy',
        select: 'name avatar',
      },
    })
    .lean()
    .then((receipts: IBroadcastReceipt[]) => receipts.filter((r: IBroadcastReceipt) => r.broadcastId !== null));
};

BroadcastReceiptSchema.statics.markSeen = async function(
  broadcastId: Types.ObjectId, 
  agentId: Types.ObjectId
) {
  return this.findOneAndUpdate(
    { broadcastId, agentId, seenAt: { $exists: false } },
    { seenAt: new Date(), pendingDelivery: false },
    { new: true }
  );
};

BroadcastReceiptSchema.statics.markAcknowledged = async function(
  broadcastId: Types.ObjectId, 
  agentId: Types.ObjectId
) {
  const now = new Date();
  return this.findOneAndUpdate(
    { broadcastId, agentId },
    { 
      acknowledgedAt: now,
      seenAt: { $ifNull: ['$seenAt', now] },
      pendingDelivery: false,
    },
    { new: true }
  );
};

BroadcastReceiptSchema.statics.getBroadcastStats = async function(broadcastId: Types.ObjectId) {
  const [stats] = await this.aggregate([
    { $match: { broadcastId: new mongoose.Types.ObjectId(broadcastId.toString()) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        delivered: { $sum: { $cond: [{ $ne: ['$deliveredAt', null] }, 1, 0] } },
        seen: { $sum: { $cond: [{ $ne: ['$seenAt', null] }, 1, 0] } },
        acknowledged: { $sum: { $cond: [{ $ne: ['$acknowledgedAt', null] }, 1, 0] } },
      },
    },
  ]);
  
  return stats || { total: 0, delivered: 0, seen: 0, acknowledged: 0 };
};

// ============= EXPORT =============

export const BroadcastReceipt = mongoose.model<IBroadcastReceipt>(
  'BroadcastReceipt',
  BroadcastReceiptSchema
);

export default BroadcastReceipt;

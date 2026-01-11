/**
 * Transfer Model - Session transfers between agents
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITransfer extends Document {
  session: Types.ObjectId;
  fromAgent: Types.ObjectId;
  toAgent: Types.ObjectId;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  transferredAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
}

const TransferSchema = new Schema<ITransfer>(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    fromAgent: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    toAgent: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'accepted', // Auto-accept for now
    },
    transferredAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
  },
  {
    timestamps: true,
  }
);

TransferSchema.index({ session: 1, transferredAt: -1 });

export const Transfer = mongoose.model<ITransfer>('Transfer', TransferSchema);

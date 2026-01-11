/**
 * UserBlock Model - Blocked users tracking
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type BlockType = 'temporary' | 'permanent';

export interface IUserBlock extends Document {
  user: Types.ObjectId;
  telegramId: number;
  blockType: BlockType;
  reason: string;
  blockedBy: Types.ObjectId;
  blockedAt: Date;
  expiresAt?: Date; // For temporary blocks
  unblockedAt?: Date;
  unblockedBy?: Types.ObjectId;
  isActive: boolean;
}

const UserBlockSchema = new Schema<IUserBlock>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    telegramId: {
      type: Number,
      required: true,
      index: true,
    },
    blockType: {
      type: String,
      enum: ['temporary', 'permanent'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    blockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
    blockedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: Date,
    unblockedAt: Date,
    unblockedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for checking active blocks
UserBlockSchema.index({ telegramId: 1, isActive: 1 });

export const UserBlock = mongoose.model<IUserBlock>('UserBlock', UserBlockSchema);

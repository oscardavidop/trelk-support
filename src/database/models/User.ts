/**
 * User Model - Telegram users who interact with the support bot
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  language: 'en' | 'es';
  isSubscriber: boolean;
  isBlocked: boolean;
  blockExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
  metadata?: Record<string, unknown>;
}

const UserSchema = new Schema<IUser>(
  {
    telegramId: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      sparse: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: String,
    language: {
      type: String,
      enum: ['en', 'es'],
      default: 'en',
    },
    isSubscriber: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    blockExpiresAt: Date,
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Update lastActivity on each access
UserSchema.methods.touch = function () {
  this.lastActivity = new Date();
  return this.save();
};

export const User = mongoose.model<IUser>('User', UserSchema);

/**
 * User Model - Telegram users who interact with the support bot
 */

import mongoose, { Schema, Document } from 'mongoose';

// Reasons why a user can't receive messages
export type UserBlockReason = 
  | 'bot_blocked'        // User blocked the bot
  | 'user_deactivated'   // User account deactivated
  | 'chat_not_found'     // Chat doesn't exist
  | 'bot_kicked'         // Bot was kicked from group
  | 'cant_initiate'      // Bot can't initiate conversation
  | 'admin_blocked';     // Blocked by admin

export interface IUser extends Document {
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  language: 'en' | 'es';
  isSubscriber: boolean;
  isBlocked: boolean;           // Blocked by admin
  blockExpiresAt?: Date;
  // User-initiated block (user blocked the bot)
  hasBlockedBot: boolean;       // User blocked the bot
  blockReason?: UserBlockReason;
  blockedAt?: Date;
  lastBlockCheck?: Date;        // Last time we verified block status
  createdAt: Date;
  updatedAt: Date;
  lastActivity: Date;
  photoFileId?: string;
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
    photoFileId: String,
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
    // User-initiated block fields
    hasBlockedBot: {
      type: Boolean,
      default: false,
      index: true,
    },
    blockReason: {
      type: String,
      enum: ['bot_blocked', 'user_deactivated', 'chat_not_found', 'bot_kicked', 'cant_initiate', 'admin_blocked'],
    },
    blockedAt: Date,
    lastBlockCheck: Date,
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

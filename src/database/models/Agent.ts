/**
 * Agent Model - Support agents who respond via dashboard
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export type AgentRole = 'admin' | 'support';
export type OnlineStatus = 'online' | 'away' | 'offline';

export interface IAgent extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: AgentRole;
  onlineStatus: OnlineStatus;
  isActive: boolean;
  avatar?: string;
  telegramId?: number;
  lastLogin?: Date;
  lastActivity?: Date;
  activeChats: number;
  totalChatsHandled: number;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const AgentSchema = new Schema<IAgent>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'support'],
      default: 'support',
    },
    onlineStatus: {
      type: String,
      enum: ['online', 'away', 'offline'],
      default: 'offline',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    avatar: String,
    telegramId: {
      type: Number,
      sparse: true,
    },
    lastLogin: Date,
    lastActivity: Date,
    activeChats: {
      type: Number,
      default: 0,
    },
    totalChatsHandled: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
AgentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
AgentSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove sensitive data when converting to JSON
AgentSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const { password, ...rest } = ret.toObject ? ret.toObject() : ret;
    return rest;
  },
});

export const Agent = mongoose.model<IAgent>('Agent', AgentSchema);

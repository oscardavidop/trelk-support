/**
 * ChatSession Model - Support chat sessions between users and bot/agents
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type SessionStatus = 'bot' | 'queued' | 'waiting' | 'human' | 'closed';
export type ClosedByType = 'user' | 'agent' | 'system';
export type CloseReason = 'manual' | 'inactivity' | 'resolved' | 'spam';
export type SatisfactionLevel = 'positive' | 'neutral' | 'negative';

export type ChatCategory = 'support' | 'billing' | 'bug' | 'feedback' | 'other';

export interface IPostChatSurveyAnswer {
  optionIndex: number;
  label: string;
  receivedAt: Date;
}

export interface IPostChatSurvey {
  sent: boolean;
  pollId?: string;
  messageId?: number;
  sentAt?: Date;
  answered: boolean;
  answer?: IPostChatSurveyAnswer;
  failed?: boolean;
  failReason?: string;
}

export interface IChatSession extends Document {
  sessionId: string;
  user: Types.ObjectId;
  telegramChatId: number;
  status: SessionStatus;
  assignedAgent?: Types.ObjectId;
  category?: ChatCategory;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags: string[];
  closedAt?: Date;
  closedBy?: Types.ObjectId;
  closedByType?: ClosedByType;
  closeReason?: CloseReason;
  closureReason?: string; // Legacy - detailed reason text
  rating?: number;
  feedback?: string;
  // Post-chat satisfaction survey
  postChatSurvey?: IPostChatSurvey;
  satisfaction?: SatisfactionLevel;
  // Reopen tracking
  reopenedAt?: Date;
  reopenedBy?: Types.ObjectId;
  reopenCount: number;
  // First response tracking
  firstResponseAt?: Date;
  firstResponseBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSessionSchema = new Schema<IChatSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    telegramChatId: {
      type: Number,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['bot', 'queued', 'waiting', 'human', 'closed'],
      default: 'bot',
      index: true,
    },
    assignedAgent: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      index: true,
    },
    category: {
      type: String,
      enum: ['support', 'billing', 'bug', 'feedback', 'other'],
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    tags: [{
      type: String,
    }],
    closedAt: Date,
    closedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    closedByType: {
      type: String,
      enum: ['user', 'agent', 'system'],
    },
    closeReason: {
      type: String,
      enum: ['manual', 'inactivity', 'resolved', 'spam'],
    },
    closureReason: String, // Legacy - detailed text
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: String,
    // Post-chat satisfaction survey
    postChatSurvey: {
      sent: { type: Boolean, default: false },
      pollId: String,
      messageId: Number,
      sentAt: Date,
      answered: { type: Boolean, default: false },
      answer: {
        optionIndex: Number,
        label: String,
        receivedAt: Date,
      },
      failed: Boolean,
      failReason: String,
    },
    satisfaction: {
      type: String,
      enum: ['positive', 'neutral', 'negative'],
      index: true,
    },
    // Reopen tracking
    reopenedAt: Date,
    reopenedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    reopenCount: {
      type: Number,
      default: 0,
    },
    // First response tracking
    firstResponseAt: Date,
    firstResponseBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding active sessions
ChatSessionSchema.index({ status: 1, createdAt: -1 });
ChatSessionSchema.index({ assignedAgent: 1, status: 1 });

export const ChatSession = mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);

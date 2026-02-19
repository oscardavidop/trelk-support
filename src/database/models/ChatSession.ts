/**
 * ChatSession Model - Support chat sessions between users and bot/agents
 * Supports Omnichannel: Telegram, Web Chat, WhatsApp, Instagram, Email
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { IUser } from './User.js';
import type { IWebVisitor } from './WebVisitor.js';

export type SessionStatus = 'bot' | 'queued' | 'waiting' | 'human' | 'closed';
export type ClosedByType = 'user' | 'agent' | 'system';
export type CloseReason = 'manual' | 'inactivity' | 'resolved' | 'spam';
export type SatisfactionLevel = 'positive' | 'neutral' | 'negative';

export type ChatCategory = 'support' | 'billing' | 'bug' | 'feedback' | 'other';

// Omnichannel types
export type ChannelType = 'telegram' | 'web' | 'whatsapp' | 'instagram' | 'email';

export interface IChannelMetadata {
  // Telegram specific
  telegramChatId?: number;
  telegramUsername?: string;
  // Web specific
  visitorId?: string;
  projectId?: string;
  currentPageUrl?: string;
  browser?: string;
  os?: string;
  device?: string;
  country?: string;
  // WhatsApp specific
  whatsappNumber?: string;
  // Instagram specific
  instagramUsername?: string;
  // Email specific
  emailAddress?: string;
  emailSubject?: string;
}

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

// Web Survey for non-Telegram channels
export interface IWebSurvey {
  sent: boolean;
  sentAt?: Date;
  answered: boolean;
  rating?: number; // 1-5 stars
  comment?: string;
  answeredAt?: Date;
}

// Disposition (tipificación) for chat closure
export interface IChatDisposition {
  categoryId?: Types.ObjectId;
  categoryCode?: string;
  categoryName?: string;
  subcategoryId?: Types.ObjectId;
  subcategoryCode?: string;
  subcategoryName?: string;
  comment?: string;
  tags?: string[];
  completedAt?: Date;
}

export interface IChatSession extends Document {
  sessionId: string;
  // Omnichannel support
  channel: ChannelType;
  channelMetadata?: IChannelMetadata;
  // User can be from any channel
  user?: IUser; // Telegram user (optional for web)
  webVisitor?: Types.ObjectId; // Web visitor reference
  telegramChatId?: number; // Made optional - only for Telegram
  externalChatId?: string; // Generic external ID for any channel
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
  disposition?: IChatDisposition; // Enterprise tipificación
  rating?: number;
  feedback?: string;
  // Post-chat satisfaction survey (Telegram polls)
  postChatSurvey?: IPostChatSurvey;
  // Web survey (ratings for web/whatsapp/etc)
  webSurvey?: IWebSurvey;
  satisfaction?: SatisfactionLevel;
  // Reopen tracking
  reopenedAt?: Date;
  reopenedBy?: Types.ObjectId;
  reopenCount: number;
  // First response tracking
  firstResponseAt?: Date;
  firstResponseBy?: Types.ObjectId;
  // Translation per-session override
  translationOverride?: {
    outgoingEnabled?: boolean;
    outgoingTargetLang?: string;
    incomingEnabled?: boolean;
    incomingTargetLang?: string;
  };
  detectedUserLang?: string;
  // Last message preview
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount?: number;
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
    // Omnichannel fields
    channel: {
      type: String,
      enum: ['telegram', 'web', 'whatsapp', 'instagram', 'email'],
      default: 'telegram',
      index: true,
    },
    channelMetadata: {
      telegramChatId: Number,
      telegramUsername: String,
      visitorId: String,
      projectId: String,
      currentPageUrl: String,
      browser: String,
      os: String,
      device: String,
      country: String,
      whatsappNumber: String,
      instagramUsername: String,
      emailAddress: String,
      emailSubject: String,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    webVisitor: {
      type: Schema.Types.ObjectId,
      ref: 'WebVisitor',
      index: true,
    },
    telegramChatId: {
      type: Number,
      index: true,
      sparse: true, // Allow null for non-Telegram channels
    },
    externalChatId: {
      type: String,
      index: true,
      sparse: true,
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
      enum: ['support', 'billing', 'bug', 'feedback', 'other', 'refund'],
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
    // Disposition (tipificación) - Enterprise feature
    disposition: {
      categoryId: { type: Schema.Types.ObjectId, ref: 'DispositionCategory' },
      categoryCode: String,
      categoryName: String,
      subcategoryId: Schema.Types.ObjectId,
      subcategoryCode: String,
      subcategoryName: String,
      comment: String,
      tags: [String],
      completedAt: Date,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    feedback: String,
    // Post-chat satisfaction survey (Telegram)
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
    // Web survey (for non-Telegram channels)
    webSurvey: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      answered: { type: Boolean, default: false },
      rating: { type: Number, min: 1, max: 5 },
      comment: String,
      answeredAt: Date,
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
    // Translation per-session override
    translationOverride: {
      outgoingEnabled: { type: Boolean },
      outgoingTargetLang: { type: String },
      incomingEnabled: { type: Boolean },
      incomingTargetLang: { type: String },
    },
    // Detected user language (from Telegram language_code, browser, etc.)
    detectedUserLang: { type: String },
    // Last message preview (for inbox display)
    lastMessage: String,
    lastMessageAt: Date,
    unreadCount: {
      type: Number,
      default: 0,
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

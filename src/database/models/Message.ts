/**
 * Message Model - Individual messages in chat sessions
 * Supports Omnichannel: Telegram, Web Chat, WhatsApp, Instagram, Email
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type MessageSender = 'user' | 'bot' | 'agent' | 'system';
export type MessageType = 'text' | 'image' | 'document' | 'file' | 'sticker' | 'voice' | 'audio' | 'video' | 'location' | 'contact' | 'poll' | 'system';
export type ChannelType = 'telegram' | 'web' | 'whatsapp' | 'instagram' | 'email';

// Media content for attachments
export interface IMediaContent {
  type: 'image' | 'audio' | 'voice' | 'video' | 'file' | 'sticker';
  url: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  session: Types.ObjectId;
  // Omnichannel
  channel: ChannelType;
  sender: MessageSender;
  senderAgent?: Types.ObjectId;
  senderName?: string; // Display name for UI
  content: string;
  messageType: MessageType;
  // Media
  mediaUrl?: string;
  media?: IMediaContent;
  // Channel-specific message ID
  telegramMessageId?: number;
  externalMessageId?: string; // Generic for any channel
  // Reply
  replyTo?: Types.ObjectId;
  replyPreview?: string; // Preview text of replied message
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  // Edit tracking
  isEdited?: boolean;
  editedAt?: Date;
  previousContent?: string;
  // Delete tracking
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  // Delivery status
  deliveryStatus?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  deliveredAt?: Date;
  failReason?: string;
  createdAt: Date;
}

const MediaContentSchema = new Schema({
  type: {
    type: String,
    enum: ['image', 'audio', 'voice', 'video', 'file', 'sticker'],
  },
  url: String,
  thumbnailUrl: String,
  fileName: String,
  fileSize: Number,
  mimeType: String,
  duration: Number,
  width: Number,
  height: Number,
}, { _id: false });

const MessageSchema = new Schema<IMessage>(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    channel: {
      type: String,
      enum: ['telegram', 'web', 'whatsapp', 'instagram', 'email'],
      default: 'telegram',
      index: true,
    },
    sender: {
      type: String,
      enum: ['user', 'bot', 'agent', 'system'],
      required: true,
    },
    senderAgent: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    senderName: String,
    content: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'document', 'file', 'sticker', 'voice', 'audio', 'video', 'location', 'contact', 'poll', 'system'],
      default: 'text',
    },
    mediaUrl: String,
    media: MediaContentSchema,
    telegramMessageId: Number,
    externalMessageId: String,
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    replyPreview: String,
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    // Edit tracking
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    previousContent: String,
    // Delete tracking
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    // Delivery status
    deliveryStatus: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
      default: 'sent',
    },
    deliveredAt: Date,
    failReason: String,
  },
  {
    timestamps: true,
  }
);

// Indexes
MessageSchema.index({ session: 1, createdAt: 1 });
MessageSchema.index({ channel: 1, createdAt: -1 });
MessageSchema.index({ externalMessageId: 1 }, { sparse: true });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);

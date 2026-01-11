/**
 * Message Model - Individual messages in chat sessions
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type MessageSender = 'user' | 'bot' | 'agent';
export type MessageType = 'text' | 'image' | 'document' | 'file' | 'sticker' | 'voice' | 'audio' | 'system';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  session: Types.ObjectId;
  sender: MessageSender;
  senderAgent?: Types.ObjectId;
  content: string;
  messageType: MessageType;
  mediaUrl?: string;
  telegramMessageId?: number;
  replyTo?: Types.ObjectId;
  metadata?: Record<string, unknown>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    sender: {
      type: String,
      enum: ['user', 'bot', 'agent'],
      required: true,
    },
    senderAgent: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    content: {
      type: String,
      required: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'document', 'file', 'sticker', 'voice', 'audio', 'system'],
      default: 'text',
    },
    mediaUrl: {
      type: String,
    },
    telegramMessageId: Number,
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
  },
  {
    timestamps: true,
  }
);

// Index for fetching messages in a session
MessageSchema.index({ session: 1, createdAt: 1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);

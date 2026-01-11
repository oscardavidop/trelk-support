/**
 * Whisper Model - Private messages from supervisors to agents during live chat
 * Part of the Supervisor Mode feature
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWhisper extends Document {
  _id: Types.ObjectId;
  sessionId: string;                // Chat session where whisper was sent
  fromSupervisor: Types.ObjectId;   // Supervisor who sent the whisper
  toAgent: Types.ObjectId;          // Agent receiving the whisper
  content: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WhisperSchema = new Schema<IWhisper>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    fromSupervisor: {
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
    content: {
      type: String,
      required: true,
      maxlength: 2000,
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

// Indexes for efficient queries
WhisperSchema.index({ sessionId: 1, createdAt: -1 });
WhisperSchema.index({ toAgent: 1, isRead: 1 });

export const Whisper = mongoose.model<IWhisper>('Whisper', WhisperSchema);

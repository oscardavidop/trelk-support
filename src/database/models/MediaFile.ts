/**
 * MediaFile Model - Unified media/file tracking for the entire platform
 * Tracks every file uploaded or received across Telegram, LiveChat, Flows, and Admin uploads
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type MediaSource = 'telegram' | 'livechat' | 'webchat' | 'flow' | 'admin' | 'system';
export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'voice' | 'other';
export type MediaStatus = 'active' | 'soft_deleted' | 'permanent_deleted' | 'orphan';

export interface IMediaFile extends Document {
  _id: Types.ObjectId;

  // File identity
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;

  // Storage
  url: string;
  storagePath: string;
  thumbnailUrl?: string;

  // Classification
  type: MediaType;
  source: MediaSource;

  // References
  chatSessionId?: string;
  messageId?: Types.ObjectId;
  flowId?: Types.ObjectId;
  uploadedBy?: Types.ObjectId;
  uploadedByName?: string;

  // User who sent (for telegram/livechat messages)
  userId?: Types.ObjectId;
  userName?: string;

  // Metadata
  width?: number;
  height?: number;
  duration?: number;
  telegramFileId?: string;
  isFlowAsset: boolean;
  tags: string[];
  description?: string;

  // Status
  status: MediaStatus;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  deleteReason?: string;

  // Analytics
  downloadCount: number;
  lastAccessedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const MediaFileSchema = new Schema<IMediaFile>(
  {
    // File identity
    filename: { type: String, required: true, index: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    extension: { type: String, required: true },

    // Storage
    url: { type: String, required: true, index: true },
    storagePath: { type: String, required: true },
    thumbnailUrl: { type: String },

    // Classification
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', 'sticker', 'voice', 'other'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['telegram', 'livechat', 'webchat', 'flow', 'admin', 'system'],
      required: true,
      index: true,
    },

    // References
    chatSessionId: { type: String, index: true },
    messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    flowId: { type: Schema.Types.ObjectId, ref: 'Flow' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
    uploadedByName: { type: String },

    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String },

    // Metadata
    width: { type: Number },
    height: { type: Number },
    duration: { type: Number },
    telegramFileId: { type: String, index: true },
    isFlowAsset: { type: Boolean, default: false },
    tags: [{ type: String }],
    description: { type: String },

    // Status
    status: {
      type: String,
      enum: ['active', 'soft_deleted', 'permanent_deleted', 'orphan'],
      default: 'active',
      index: true,
    },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
    deleteReason: { type: String },

    // Analytics
    downloadCount: { type: Number, default: 0 },
    lastAccessedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
MediaFileSchema.index({ type: 1, source: 1, createdAt: -1 });
MediaFileSchema.index({ status: 1, createdAt: -1 });
MediaFileSchema.index({ chatSessionId: 1, type: 1 });
MediaFileSchema.index({ isFlowAsset: 1, status: 1 });
MediaFileSchema.index({ originalName: 'text', description: 'text', tags: 'text' });

// Virtual: human-readable size
MediaFileSchema.virtual('humanSize').get(function () {
  const bytes = this.size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
});

export const MediaFile = mongoose.model<IMediaFile>('MediaFile', MediaFileSchema);

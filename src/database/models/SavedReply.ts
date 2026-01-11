/**
 * SavedReply Model - Quick replies for agents
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISavedReply extends Document {
  _id: Types.ObjectId;
  title: string;
  content: string;
  category?: string;
  isActive: boolean;
  shortcut?: string; // e.g., "/greet" - optional keyboard shortcut
  usageCount: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SavedReplySchema = new Schema<ISavedReply>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    shortcut: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster searches
SavedReplySchema.index({ title: 'text', content: 'text' });
SavedReplySchema.index({ category: 1 });
SavedReplySchema.index({ isActive: 1 });
SavedReplySchema.index({ shortcut: 1 });

export const SavedReply = mongoose.model<ISavedReply>('SavedReply', SavedReplySchema);

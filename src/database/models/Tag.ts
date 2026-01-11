/**
 * Tag Model - Labels for categorizing users/conversations
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ITag extends Document {
  name: string;
  color: string; // Hex color for UI display
  description?: string;
  usageCount: number;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema = new Schema<ITag>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 50,
      index: true,
    },
    color: {
      type: String,
      required: true,
      default: '#2563eb', // Indigo default
      match: /^#[0-9A-Fa-f]{6}$/,
    },
    description: {
      type: String,
      maxlength: 200,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Text search on name and description
TagSchema.index({ name: 'text', description: 'text' });

export const Tag = mongoose.model<ITag>('Tag', TagSchema);

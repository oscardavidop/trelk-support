/**
 * UserTag Model - Many-to-many relationship between users and tags
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserTag extends Document {
  user: Types.ObjectId;
  tag: Types.ObjectId;
  addedBy: Types.ObjectId; // Agent who added the tag
  createdAt: Date;
}

const UserTagSchema = new Schema<IUserTag>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tag: {
      type: Schema.Types.ObjectId,
      ref: 'Tag',
      required: true,
      index: true,
    },
    addedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound unique index: one tag per user
UserTagSchema.index({ user: 1, tag: 1 }, { unique: true });

export const UserTag = mongoose.model<IUserTag>('UserTag', UserTagSchema);

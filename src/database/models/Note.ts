/**
 * Note Model - Internal notes attached to users/conversations
 * Only visible to agents and admins
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INote extends Document {
  user: Types.ObjectId; // Reference to User
  session?: Types.ObjectId; // Optional: tied to specific session
  content: string;
  createdBy: Types.ObjectId; // Agent who created
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    session: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      index: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000,
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

// Indexes for efficient queries
NoteSchema.index({ user: 1, createdAt: -1 });
NoteSchema.index({ session: 1, createdAt: -1 });

export const Note = mongoose.model<INote>('Note', NoteSchema);

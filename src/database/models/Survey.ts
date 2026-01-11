/**
 * Survey Model - Post-chat surveys
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISurvey extends Document {
  session: Types.ObjectId;
  user: Types.ObjectId;
  agent?: Types.ObjectId;
  rating: number; // 1-5
  comment?: string;
  submittedAt: Date;
  telegramMessageId?: number;
}

const SurveySchema = new Schema<ISurvey>(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
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
    agent: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: String,
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    telegramMessageId: Number,
  },
  {
    timestamps: true,
  }
);

// Index for agent performance
SurveySchema.index({ agent: 1, rating: 1 });

export const Survey = mongoose.model<ISurvey>('Survey', SurveySchema);

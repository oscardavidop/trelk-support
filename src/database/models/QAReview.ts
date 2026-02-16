/**
 * QAReview Model — Individual quality assurance evaluations for chat sessions.
 * Each review scores a closed chat against the active QA checklist items.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type QACheckResult = 'yes' | 'no' | 'partial' | 'na';
export type QAReviewStatus = 'draft' | 'completed';
export type CoachingStatus = 'none' | 'pending' | 'scheduled' | 'completed' | 'dismissed';

export interface IQACheckEval {
  checkItemId: Types.ObjectId;
  checkName: string;
  checkCategory: string;
  weight: number;
  result: QACheckResult;
  /** Calculated: yes=100, partial=50, no=0, na=excluded */
  score: number;
  note?: string;
}

export type CoachingTag = 'tone_issue' | 'slow_response' | 'wrong_category' | 'policy_violation' | 'other';

export interface IQAEditLog {
  editedAt: Date;
  editedBy: Types.ObjectId;
  editReason: string;
  previousScore: number;
  newScore: number;
}

export interface IQAReview extends Document {
  sessionId: string; // ChatSession.sessionId
  session: Types.ObjectId; // ref ChatSession _id
  agentId: Types.ObjectId; // The agent being evaluated
  reviewedBy: Types.ObjectId; // The supervisor/admin who reviewed
  checks: IQACheckEval[];
  totalScore: number; // 0–100 weighted average
  comment: string; // Required when totalScore < lowScoreThreshold
  status: QAReviewStatus;
  // Coaching workflow
  coaching: CoachingStatus;
  coachingNotes?: string;
  coachingScheduledAt?: Date;
  coachingCompletedAt?: Date;
  coachingBy?: Types.ObjectId;
  coachingTags: CoachingTag[];
  trainingRecommendations: string[];
  // Feedback — agent can acknowledge & respond
  agentAcknowledged: boolean;
  agentAcknowledgedAt?: Date;
  agentFeedback?: string;
  // Re-acknowledgement after edits
  requiresReack: boolean;
  // Audit log for edits
  editHistory: IQAEditLog[];
  // Escalation
  escalated: boolean;
  escalatedAt?: Date;
  escalatedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const QACheckEvalSchema = new Schema<IQACheckEval>(
  {
    checkItemId: { type: Schema.Types.ObjectId, ref: 'QACheckItem', required: true },
    checkName: { type: String, required: true },
    checkCategory: { type: String, required: true },
    weight: { type: Number, required: true },
    result: { type: String, enum: ['yes', 'no', 'partial', 'na'], required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    note: { type: String, trim: true, maxlength: 500 },
  },
  { _id: false }
);

const QAEditLogSchema = new Schema<IQAEditLog>(
  {
    editedAt: { type: Date, required: true },
    editedBy: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    editReason: { type: String, required: true, trim: true, maxlength: 500 },
    previousScore: { type: Number, required: true },
    newScore: { type: Number, required: true },
  },
  { _id: false }
);

const QAReviewSchema = new Schema<IQAReview>(
  {
    sessionId: { type: String, required: true, index: true },
    session: { type: Schema.Types.ObjectId, ref: 'ChatSession', required: true },
    agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    checks: { type: [QACheckEvalSchema], required: true },
    totalScore: { type: Number, required: true, min: 0, max: 100 },
    comment: { type: String, default: '', trim: true, maxlength: 2000 },
    status: { type: String, enum: ['draft', 'completed'], default: 'draft' },
    // Coaching
    coaching: {
      type: String,
      enum: ['none', 'pending', 'scheduled', 'completed', 'dismissed'],
      default: 'none',
    },
    coachingNotes: { type: String, trim: true, maxlength: 2000 },
    coachingScheduledAt: { type: Date },
    coachingCompletedAt: { type: Date },
    coachingBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
    coachingTags: [{ type: String, enum: ['tone_issue', 'slow_response', 'wrong_category', 'policy_violation', 'other'] }],
    trainingRecommendations: [{ type: String, trim: true, maxlength: 300 }],
    // Agent feedback
    agentAcknowledged: { type: Boolean, default: false },
    agentAcknowledgedAt: { type: Date },
    agentFeedback: { type: String, trim: true, maxlength: 1000 },
    // Re-acknowledgement
    requiresReack: { type: Boolean, default: false },
    // Audit log
    editHistory: { type: [QAEditLogSchema], default: [] },
    // Escalation
    escalated: { type: Boolean, default: false },
    escalatedAt: { type: Date },
    escalatedReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
QAReviewSchema.index({ agentId: 1, createdAt: -1 });
QAReviewSchema.index({ reviewedBy: 1, createdAt: -1 });
QAReviewSchema.index({ sessionId: 1 }, { unique: true }); // One review per session
QAReviewSchema.index({ status: 1, coaching: 1 });
QAReviewSchema.index({ totalScore: 1 });

export const QAReview = mongoose.model<IQAReview>('QAReview', QAReviewSchema);

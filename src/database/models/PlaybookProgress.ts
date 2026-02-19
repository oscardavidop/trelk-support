/**
 * PlaybookProgress Model — Tracks per-chat playbook execution
 * Records which steps have been completed, skipped, or are pending
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type StepStatus = 'pending' | 'completed' | 'skipped';

export interface IStepProgress {
  stepId: string;
  status: StepStatus;
  completedAt?: Date;
  completedBy?: Types.ObjectId;
  skipReason?: string; // Required if skipped and step.skipRequiresComment
  actionResult?: string; // Result of action execution (e.g. message sent ID)
}

export interface IPlaybookProgress extends Document {
  _id: Types.ObjectId;
  sessionId: string;         // ChatSession.sessionId
  playbookId: Types.ObjectId;
  playbookVersion: number;   // Snapshot of version when started
  agentId: Types.ObjectId;   // Agent who started/is executing
  steps: IStepProgress[];
  status: 'active' | 'completed' | 'abandoned';
  completionPercent: number; // 0-100
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StepProgressSchema = new Schema<IStepProgress>({
  stepId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed', 'skipped'], default: 'pending' },
  completedAt: { type: Date },
  completedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
  skipReason: { type: String },
  actionResult: { type: String },
}, { _id: false });

const PlaybookProgressSchema = new Schema<IPlaybookProgress>({
  sessionId: { type: String, required: true, index: true },
  playbookId: { type: Schema.Types.ObjectId, ref: 'Playbook', required: true },
  playbookVersion: { type: Number, required: true },
  agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  steps: [StepProgressSchema],
  status: { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active', index: true },
  completionPercent: { type: Number, default: 0 },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
}, { timestamps: true });

PlaybookProgressSchema.index({ sessionId: 1, status: 1 });
PlaybookProgressSchema.index({ sessionId: 1, playbookId: 1 }, { unique: true });
PlaybookProgressSchema.index({ agentId: 1, createdAt: -1 });

export const PlaybookProgress = mongoose.model<IPlaybookProgress>('PlaybookProgress', PlaybookProgressSchema);

/**
 * QAConfig Model — Configurable quality assurance checklist
 * Each document represents a single checklist item with a weight for scoring.
 * Supervisors / admins manage these via the QA Settings page.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type QACheckCategory = 'greeting' | 'resolution' | 'tone' | 'procedure' | 'closing' | 'general';

export interface IQACheckItem extends Document {
  name: string;
  description: string;
  category: QACheckCategory;
  weight: number; // percentage weight (0-100), all items should sum ≈100
  isActive: boolean;
  order: number;
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QACheckItemSchema = new Schema<IQACheckItem>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 500 },
    category: {
      type: String,
      enum: ['greeting', 'resolution', 'tone', 'procedure', 'closing', 'general'],
      default: 'general',
    },
    weight: { type: Number, required: true, min: 0, max: 100, default: 10 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
  },
  { timestamps: true }
);

QACheckItemSchema.index({ isActive: 1, order: 1 });
QACheckItemSchema.index({ category: 1 });

export const QACheckItem = mongoose.model<IQACheckItem>('QACheckItem', QACheckItemSchema);

// ─── Global QA Settings (single document) ─────────────────────────────

export interface IQASettings extends Document {
  /** Minimum score threshold below which a comment is required */
  lowScoreThreshold: number;
  /** Whether coaching mode is enabled globally */
  coachingEnabled: boolean;
  /** Auto-flag agents whose rolling average drops below this */
  autoFlagThreshold: number;
  /** Rolling window in days for auto-flag calculations */
  rollingWindowDays: number;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const QASettingsSchema = new Schema<IQASettings>(
  {
    lowScoreThreshold: { type: Number, default: 70, min: 0, max: 100 },
    coachingEnabled: { type: Boolean, default: true },
    autoFlagThreshold: { type: Number, default: 60, min: 0, max: 100 },
    rollingWindowDays: { type: Number, default: 30, min: 1, max: 365 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
  },
  { timestamps: true }
);

export const QASettings = mongoose.model<IQASettings>('QASettings', QASettingsSchema);

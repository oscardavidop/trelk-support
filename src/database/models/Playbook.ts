/**
 * Playbook Model — Guided scripts for agents
 * Each playbook defines a sequence of steps to follow during a chat
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Step Types ───
export type PlaybookStepType =
  | 'checklist'        // Simple checkbox
  | 'action_button'    // Executes an action (send template, assign tag, etc.)
  | 'question'         // Mandatory question to ask/verify
  | 'escalation'       // Escalate to supervisor
  | 'internal_note'    // Create internal note
  | 'link'             // Open internal/external link
  | 'validation'       // Open validation modal (identity, order, etc.)
  | 'category_change'; // Change chat category/disposition

export type PlaybookStepAction =
  | 'send_template'
  | 'assign_tag'
  | 'change_category'
  | 'create_note'
  | 'escalate_supervisor'
  | 'open_link'
  | 'open_modal'
  | 'none';

export interface IPlaybookStep {
  stepId: string;
  type: PlaybookStepType;
  label: string;
  description?: string;
  action: PlaybookStepAction;
  // Action config
  templateId?: string;       // For send_template
  templateText?: string;     // Inline template text with {{variables}}
  tagName?: string;          // For assign_tag
  categoryId?: string;       // For change_category
  linkUrl?: string;          // For open_link
  modalType?: string;        // For open_modal (e.g. 'identity_validation')
  // Step config
  isCritical: boolean;       // Must be completed before closing chat
  order: number;
  skipRequiresComment: boolean; // If skipped, requires a comment
  estimatedSeconds?: number; // Estimated time for this step
}

export type PlaybookTriggerType = 'disposition' | 'tag' | 'category' | 'intent' | 'manual';

export interface IPlaybookTrigger {
  type: PlaybookTriggerType;
  value: string; // The disposition ID, tag name, category, or intent
}

export interface IPlaybook extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  category: string;
  isActive: boolean;
  isMandatory: boolean; // If true, chat cannot be closed without completing critical steps
  version: number;
  steps: IPlaybookStep[];
  triggers: IPlaybookTrigger[];
  // Metadata
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlaybookStepSchema = new Schema<IPlaybookStep>({
  stepId: { type: String, required: true },
  type: {
    type: String,
    enum: ['checklist', 'action_button', 'question', 'escalation', 'internal_note', 'link', 'validation', 'category_change'],
    required: true,
  },
  label: { type: String, required: true },
  description: { type: String },
  action: {
    type: String,
    enum: ['send_template', 'assign_tag', 'change_category', 'create_note', 'escalate_supervisor', 'open_link', 'open_modal', 'none'],
    default: 'none',
  },
  templateId: { type: String },
  templateText: { type: String },
  tagName: { type: String },
  categoryId: { type: String },
  linkUrl: { type: String },
  modalType: { type: String },
  isCritical: { type: Boolean, default: false },
  order: { type: Number, required: true },
  skipRequiresComment: { type: Boolean, default: false },
  estimatedSeconds: { type: Number },
}, { _id: false });

const PlaybookTriggerSchema = new Schema<IPlaybookTrigger>({
  type: {
    type: String,
    enum: ['disposition', 'tag', 'category', 'intent', 'manual'],
    required: true,
  },
  value: { type: String, required: true },
}, { _id: false });

const PlaybookSchema = new Schema<IPlaybook>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, required: true, index: true },
  isActive: { type: Boolean, default: true, index: true },
  isMandatory: { type: Boolean, default: false },
  version: { type: Number, default: 1 },
  steps: [PlaybookStepSchema],
  triggers: [PlaybookTriggerSchema],
  createdBy: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
}, { timestamps: true });

PlaybookSchema.index({ isActive: 1, category: 1 });
PlaybookSchema.index({ 'triggers.type': 1, 'triggers.value': 1 });

export const Playbook = mongoose.model<IPlaybook>('Playbook', PlaybookSchema);

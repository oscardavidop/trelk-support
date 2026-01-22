/**
 * ContactActivity Model - Activity log for contacts
 * Tracks all significant events for audit and analytics
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type ContactActivityType = 
  // System events
  | 'contact_created'
  | 'contact_updated'
  | 'contact_blocked'
  | 'contact_unblocked'
  | 'contact_deleted'
  // Communication
  | 'message_sent'
  | 'message_received'
  | 'session_started'
  | 'session_closed'
  | 'session_transferred'
  // Tags
  | 'tag_added'
  | 'tag_removed'
  // Custom fields
  | 'custom_field_updated'
  // Agent interactions
  | 'agent_assigned'
  | 'agent_unassigned'
  | 'note_added'
  | 'note_updated'
  | 'note_deleted'
  // Flows
  | 'flow_triggered'
  | 'flow_completed'
  | 'flow_failed'
  // Surveys
  | 'survey_sent'
  | 'survey_responded'
  // Language
  | 'language_changed'
  // Bulk actions
  | 'bulk_action_applied';

// Activity type constants for easy use
export const ActivityTypes = {
  CONTACT_CREATED: 'contact_created' as ContactActivityType,
  CONTACT_UPDATED: 'contact_updated' as ContactActivityType,
  CONTACT_BLOCKED: 'contact_blocked' as ContactActivityType,
  CONTACT_UNBLOCKED: 'contact_unblocked' as ContactActivityType,
  CONTACT_DELETED: 'contact_deleted' as ContactActivityType,
  MESSAGE_SENT: 'message_sent' as ContactActivityType,
  MESSAGE_RECEIVED: 'message_received' as ContactActivityType,
  SESSION_STARTED: 'session_started' as ContactActivityType,
  SESSION_CLOSED: 'session_closed' as ContactActivityType,
  SESSION_TRANSFERRED: 'session_transferred' as ContactActivityType,
  TAG_ADDED: 'tag_added' as ContactActivityType,
  TAG_REMOVED: 'tag_removed' as ContactActivityType,
  CUSTOM_FIELD_UPDATED: 'custom_field_updated' as ContactActivityType,
  AGENT_ASSIGNED: 'agent_assigned' as ContactActivityType,
  AGENT_UNASSIGNED: 'agent_unassigned' as ContactActivityType,
  NOTE_ADDED: 'note_added' as ContactActivityType,
  NOTE_UPDATED: 'note_updated' as ContactActivityType,
  NOTE_DELETED: 'note_deleted' as ContactActivityType,
  FLOW_TRIGGERED: 'flow_triggered' as ContactActivityType,
  FLOW_COMPLETED: 'flow_completed' as ContactActivityType,
  FLOW_FAILED: 'flow_failed' as ContactActivityType,
  SURVEY_SENT: 'survey_sent' as ContactActivityType,
  SURVEY_RESPONDED: 'survey_responded' as ContactActivityType,
  LANGUAGE_CHANGED: 'language_changed' as ContactActivityType,
  BULK_ACTION_APPLIED: 'bulk_action_applied' as ContactActivityType,
} as const;

export interface ActivityActor {
  type: 'agent' | 'system' | 'user' | 'flow';
  id?: string;
  name?: string;
}

export interface IContactActivity extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: ContactActivityType;
  description: string;
  // Actor
  actor: ActivityActor;
  // Additional data
  metadata?: Record<string, any>;
  // Related entities
  sessionId?: string;
  flowId?: string;
  flowExecutionId?: string;
  // Timestamps
  createdAt: Date;
}

const ContactActivitySchema = new Schema<IContactActivity>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    actor: {
      type: {
        type: String,
        enum: ['agent', 'system', 'user', 'flow'],
        required: true,
      },
      id: String,
      name: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    sessionId: {
      type: String,
      index: true,
    },
    flowId: {
      type: String,
      index: true,
    },
    flowExecutionId: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes for efficient queries
ContactActivitySchema.index({ user: 1, createdAt: -1 });
ContactActivitySchema.index({ user: 1, type: 1, createdAt: -1 });
ContactActivitySchema.index({ createdAt: -1 }); // For global activity feed

// TTL index - keep activities for 1 year
ContactActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const ContactActivity = mongoose.model<IContactActivity>('ContactActivity', ContactActivitySchema);

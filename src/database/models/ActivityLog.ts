/**
 * ActivityLog Model - Per-chat activity timeline
 * Tracks all significant events in a chat session for agent visibility
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type ActivityAction =
  | 'session_created'
  | 'session_assigned'
  | 'session_transferred'
  | 'session_closed'
  | 'session_reopened'
  | 'session_queued'
  | 'message_sent'
  | 'message_edited'
  | 'message_deleted'
  | 'message_pinned'
  | 'note_added'
  | 'note_edited'
  | 'note_deleted'
  | 'tag_added'
  | 'tag_removed'
  | 'category_changed'
  | 'priority_changed'
  | 'whisper_sent'
  | 'whisper_read'
  | 'supervisor_viewing'
  | 'supervisor_stopped'
  | 'rating_received'
  | 'rule_triggered'
  | 'user_blocked'
  | 'user_unblocked'
  | 'first_response'
  | 'sla_warning'
  | 'sla_breached';

export type ActorType = 'user' | 'agent' | 'supervisor' | 'system' | 'rule' | 'bot';

export interface IActivityActor {
  type: ActorType;
  id?: Types.ObjectId;
  name?: string;
}

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  sessionId: string;
  
  // What happened
  action: ActivityAction;
  
  // Who did it
  actor: IActivityActor;
  
  // Additional context
  metadata: Record<string, unknown>;
  
  // Human-readable description
  description: string;
  
  // Visual indicator
  icon?: string;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
  
  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'session_created', 'session_assigned', 'session_transferred',
        'session_closed', 'session_reopened', 'session_queued',
        'message_sent', 'message_edited', 'message_deleted', 'message_pinned',
        'note_added', 'note_edited', 'note_deleted',
        'tag_added', 'tag_removed', 'category_changed', 'priority_changed',
        'whisper_sent', 'whisper_read', 'supervisor_viewing', 'supervisor_stopped',
        'rating_received', 'rule_triggered', 'user_blocked', 'user_unblocked',
        'first_response', 'sla_warning', 'sla_breached'
      ],
      required: true,
      index: true,
    },
    actor: {
      type: {
        type: String,
        enum: ['user', 'agent', 'supervisor', 'system', 'rule', 'bot'],
        required: true,
      },
      id: {
        type: Schema.Types.ObjectId,
        refPath: 'actor.type',
      },
      name: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    description: {
      type: String,
      required: true,
      maxlength: 500,
    },
    icon: String,
    color: {
      type: String,
      enum: ['green', 'yellow', 'red', 'blue', 'gray'],
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// TTL index - delete logs after 180 days
ActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

// Compound index for session timeline queries
ActivityLogSchema.index({ sessionId: 1, createdAt: -1 });

export const ActivityLog = mongoose.model<IActivityLog>('ActivityLog', ActivityLogSchema);

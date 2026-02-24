/**
 * AgentStatusLog Model - Immutable audit log of every agent status change
 * 
 * This is the SOURCE OF TRUTH for:
 * - Payroll calculations (time per state)
 * - Anti-fraud detection
 * - Supervisor audits
 * 
 * Records are NEVER modified after creation. endedAt/durationMs are set
 * when the state changes (opening a new record closes the previous one).
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type StatusChangeTrigger =
  | 'agent_self'          // Agent changed their own state
  | 'supervisor'          // Supervisor forced a change
  | 'system_auto'         // System auto-change (e.g. max chats reached → busy)
  | 'heartbeat_timeout'   // Missed heartbeat → forced offline
  | 'logout'              // Normal logout
  | 'login'               // Login event
  | 'reconnect'           // Reconnected after disconnect
  | 'quota_exceeded'      // Break quota exceeded → forced available
  | 'auto_expire'         // State auto-expired (e.g. break timer ran out)
  | 'idle_timeout';       // Idle detection timeout

export interface IAgentStatusLog extends Document {
  _id: Types.ObjectId;

  // Agent reference
  agentId: Types.ObjectId;

  // State info
  auxiliaryStateCode: string;   // e.g. 'available', 'break_lunch'
  auxiliaryStateLabel: string;  // Label at time of change (for historical accuracy)
  reason?: string;              // Break reason or supervisor note

  // Time tracking
  startedAt: Date;
  endedAt?: Date;               // Set when next state begins
  durationMs?: number;          // Exact computed duration

  // Context (anti-fraud evidence)
  ip: string;
  userAgent: string;
  sessionId?: string;           // AgentSession._id reference (string for flexibility)

  // Audit
  triggeredBy: StatusChangeTrigger;
  triggeredByAgentId?: Types.ObjectId;  // Supervisor/admin who changed it
  isUnexpected: boolean;         // e.g. heartbeat timeout, crash = true

  // Anti-tamper hash (sha256 of core fields for integrity check)
  integrityHash: string;

  createdAt: Date;
  // updatedAt intentionally excluded - records are immutable
}

const AgentStatusLogSchema = new Schema<IAgentStatusLog>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    auxiliaryStateCode: {
      type: String,
      required: true,
      index: true,
    },
    auxiliaryStateLabel: {
      type: String,
      required: true,
    },
    reason: String,

    // Time
    startedAt: {
      type: Date,
      required: true,
      index: true,
    },
    endedAt: Date,
    durationMs: Number,

    // Context
    ip: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: 'unknown',
    },
    sessionId: String,

    // Audit
    triggeredBy: {
      type: String,
      enum: [
        'agent_self',
        'supervisor',
        'system_auto',
        'heartbeat_timeout',
        'logout',
        'login',
        'reconnect',
        'quota_exceeded',
        'auto_expire',
        'idle_timeout',
      ],
      required: true,
    },
    triggeredByAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    isUnexpected: {
      type: Boolean,
      default: false,
    },
    integrityHash: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable: no updatedAt
  }
);

// Compound indices for efficient time-range queries
AgentStatusLogSchema.index({ agentId: 1, startedAt: -1 });
AgentStatusLogSchema.index({ agentId: 1, auxiliaryStateCode: 1, startedAt: -1 });
AgentStatusLogSchema.index({ triggeredBy: 1, startedAt: -1 });
AgentStatusLogSchema.index({ isUnexpected: 1, startedAt: -1 });

// Disable all mutating instance methods to enforce immutability
AgentStatusLogSchema.pre('findOneAndUpdate', function () {
  throw new Error('AgentStatusLog records are immutable and cannot be updated.');
});
AgentStatusLogSchema.pre('updateOne', function () {
  throw new Error('AgentStatusLog records are immutable and cannot be updated.');
});
AgentStatusLogSchema.pre('updateMany', function () {
  throw new Error('AgentStatusLog records are immutable and cannot be updated.');
});

export const AgentStatusLog = mongoose.model<IAgentStatusLog>(
  'AgentStatusLog',
  AgentStatusLogSchema
);

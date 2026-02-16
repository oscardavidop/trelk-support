/**
 * AuditLog Model - Security and compliance audit trail
 * Tracks all sensitive actions for security, debugging, and compliance
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type AuditCategory = 
  | 'message' 
  | 'session' 
  | 'agent' 
  | 'rule' 
  | 'settings' 
  | 'export' 
  | 'security'
  | 'user'
  | 'auth'
  | 'authentication'
  | 'communication'
  | 'chat'
  | 'disposition';

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  
  // What was done
  action: string;                   // 'message.delete', 'rule.create', etc.
  category: AuditCategory;
  
  // Who did it
  actorId: Types.ObjectId;
  actorType: 'agent' | 'admin' | 'system';
  actorName: string;
  actorEmail?: string;
  actorIp: string;
  actorUserAgent?: string;
  
  // What was affected
  targetType: 'message' | 'session' | 'user' | 'agent' | 'rule' | 'setting' | 'export' | 'system' | 'device';
  targetId: string;
  targetDescription?: string;
  
  // Changes
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  
  // Context
  sessionId?: string;
  requestId?: string;
  requestPath?: string;
  requestMethod?: string;
  
  // Risk level
  severity: AuditSeverity;
  
  // Flags
  isAnomaly?: boolean;              // Flagged by abuse detection
  anomalyReason?: string;
  
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['message', 'session', 'agent', 'rule', 'settings', 'export', 'security', 'user', 'auth', 'authentication', 'communication', 'chat', 'disposition'],
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    actorType: {
      type: String,
      enum: ['agent', 'admin', 'system'],
      required: true,
    },
    actorName: {
      type: String,
      required: true,
    },
    actorEmail: String,
    actorIp: {
      type: String,
      required: true,
    },
    actorUserAgent: String,
    targetType: {
      type: String,
      enum: ['message', 'session', 'user', 'agent', 'rule', 'setting', 'export', 'system', 'device', 'disposition', 'chat_session'],
      required: true,
    },
    targetId: {
      type: String,
      required: true,
      index: true,
    },
    targetDescription: String,
    previousValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    sessionId: {
      type: String,
      index: true,
    },
    requestId: String,
    requestPath: String,
    requestMethod: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      required: true,
      index: true,
    },
    isAnomaly: {
      type: Boolean,
      default: false,
      index: true,
    },
    anomalyReason: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// TTL index - keep audit logs for 2 years (compliance)
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 730 * 24 * 60 * 60 });

// Compound indexes for common queries
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ category: 1, createdAt: -1 });
AuditLogSchema.index({ severity: 1, createdAt: -1 });
AuditLogSchema.index({ isAnomaly: 1, createdAt: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

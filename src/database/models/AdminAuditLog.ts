/**
 * Admin Audit Log Model
 * Records all administrative actions for security and compliance
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminAuditLog extends Document {
  adminId: mongoose.Types.ObjectId;
  adminEmail: string;
  adminName: string;
  action: string;
  category: 'chat' | 'flow' | 'database' | 'logs' | 'cache' | 'session' | 'system';
  severity: 'info' | 'warning' | 'critical' | 'destructive';
  target: string;
  targetId?: string;
  details: Record<string, unknown>;
  affectedCount?: number;
  ip: string;
  userAgent?: string;
  result: 'success' | 'failure' | 'partial';
  errorMessage?: string;
  executionTimeMs?: number;
  requiresReview?: boolean;
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
}

const AdminAuditLogSchema = new Schema<IAdminAuditLog>({
  adminId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  adminEmail: { type: String, required: true },
  adminName: { type: String, required: true },
  action: { type: String, required: true, index: true },
  category: { 
    type: String, 
    enum: ['chat', 'flow', 'database', 'logs', 'cache', 'session', 'system'],
    required: true,
    index: true
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical', 'destructive'],
    required: true,
    index: true
  },
  target: { type: String, required: true },
  targetId: { type: String },
  details: { type: Schema.Types.Mixed, default: {} },
  affectedCount: { type: Number },
  ip: { type: String, required: true },
  userAgent: { type: String },
  result: { 
    type: String, 
    enum: ['success', 'failure', 'partial'],
    required: true,
    index: true
  },
  errorMessage: { type: String },
  executionTimeMs: { type: Number },
  requiresReview: { type: Boolean, default: false },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
  reviewedAt: { type: Date },
}, {
  timestamps: true,
});

// Indexes for efficient querying
AdminAuditLogSchema.index({ createdAt: -1 });
AdminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
AdminAuditLogSchema.index({ category: 1, severity: 1, createdAt: -1 });
AdminAuditLogSchema.index({ action: 1, result: 1 });

// TTL index - keep logs for 1 year
AdminAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const AdminAuditLog = mongoose.model<IAdminAuditLog>('AdminAuditLog', AdminAuditLogSchema);

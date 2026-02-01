/**
 * Audit Log Service - Security and compliance logging
 * Tracks all sensitive actions for security, debugging, and compliance
 */

import { Types } from 'mongoose';
import { FastifyRequest } from 'fastify';
import { AuditLog, type IAuditLog, type AuditCategory, type AuditSeverity } from '../database/models/AuditLog.js';

interface AuditParams {
  action: string;
  category: AuditCategory;
  actorId: Types.ObjectId | string;
  actorType: 'agent' | 'admin' | 'system';
  actorName: string;
  actorEmail?: string;
  targetType: 'message' | 'session' | 'user' | 'agent' | 'rule' | 'setting' | 'export' | 'system' | 'device';
  targetId: string;
  targetDescription?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  sessionId?: string;
  severity: AuditSeverity;
  isAnomaly?: boolean;
  anomalyReason?: string;
  metadata?: Record<string, unknown>;
}

interface AuditFromRequest extends Omit<AuditParams, 'actorId' | 'actorType' | 'actorName' | 'actorEmail'> {
  request: FastifyRequest;
}

/**
 * Log an audit event
 */
export async function logAudit(params: AuditParams & { ip: string; userAgent?: string }): Promise<IAuditLog> {
  const audit = await AuditLog.create({
    action: params.action,
    category: params.category,
    actorId: new Types.ObjectId(params.actorId.toString()),
    actorType: params.actorType,
    actorName: params.actorName,
    actorEmail: params.actorEmail,
    actorIp: params.ip,
    actorUserAgent: params.userAgent,
    targetType: params.targetType,
    targetId: params.targetId,
    targetDescription: params.targetDescription,
    previousValue: params.previousValue,
    newValue: params.newValue,
    sessionId: params.sessionId,
    severity: params.severity,
    isAnomaly: params.isAnomaly,
    anomalyReason: params.anomalyReason,
  });

  return audit;
}

/**
 * Log an audit event from a Fastify request (extracts agent info and IP)
 */
export async function logAuditFromRequest(params: AuditFromRequest): Promise<IAuditLog | null> {
  const agent = (params.request as any).agent;
  if (!agent) {
    console.warn('Audit log attempted without agent context');
    return null;
  }

  const ip = params.request.ip || 
    (params.request.headers['x-forwarded-for'] as string)?.split(',')[0] || 
    'unknown';

  return logAudit({
    ...params,
    actorId: agent._id,
    actorType: agent.role === 'admin' ? 'admin' : 'agent',
    actorName: agent.name,
    actorEmail: agent.email,
    ip,
    userAgent: params.request.headers['user-agent'],
  });
}

/**
 * Search audit logs
 */
export async function searchAuditLogs(options: {
  actorId?: Types.ObjectId | string;
  category?: AuditCategory;
  action?: string;
  targetType?: string;
  targetId?: string;
  severity?: AuditSeverity;
  isAnomaly?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}): Promise<{ logs: IAuditLog[]; total: number }> {
  const query: Record<string, unknown> = {};

  if (options.actorId) query.actorId = new Types.ObjectId(options.actorId.toString());
  if (options.category) query.category = options.category;
  if (options.action) query.action = { $regex: options.action, $options: 'i' };
  if (options.targetType) query.targetType = options.targetType;
  if (options.targetId) query.targetId = options.targetId;
  if (options.severity) query.severity = options.severity;
  if (options.isAnomaly !== undefined) query.isAnomaly = options.isAnomaly;

  if (options.dateFrom || options.dateTo) {
    query.createdAt = {};
    if (options.dateFrom) (query.createdAt as any).$gte = options.dateFrom;
    if (options.dateTo) (query.createdAt as any).$lte = options.dateTo;
  }

  const [logsResult, total] = await Promise.all([
    AuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip(options.offset || 0)
      .limit(options.limit || 50)
      .lean(),
    AuditLog.countDocuments(query),
  ]);

  return { logs: logsResult as unknown as IAuditLog[], total };
}

/**
 * Get audit summary for a specific target (session, user, etc.)
 */
export async function getTargetAuditHistory(
  targetType: string,
  targetId: string,
  limit = 50
) {
  const result = await AuditLog.find({ targetType, targetId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  
  return result as unknown as IAuditLog[];
}

/**
 * Detect anomalies based on patterns
 */
export async function checkForAnomalies(
  actorId: Types.ObjectId | string,
  action: string
): Promise<{ isAnomaly: boolean; reason?: string }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Count similar actions in the last hour
  const recentCount = await AuditLog.countDocuments({
    actorId: new Types.ObjectId(actorId.toString()),
    action,
    createdAt: { $gte: oneHourAgo },
  });

  // Define thresholds for different actions
  const thresholds: Record<string, number> = {
    'message.delete': 20,
    'session.close': 50,
    'user.block': 10,
    'setting.change': 5,
    'export.create': 20,
  };

  const threshold = thresholds[action] || 100;

  if (recentCount >= threshold) {
    return {
      isAnomaly: true,
      reason: `Unusual activity: ${recentCount + 1} "${action}" actions in the last hour (threshold: ${threshold})`,
    };
  }

  return { isAnomaly: false };
}

// Severity calculation helpers
export const SeverityRules = {
  getSeverity(action: string, metadata?: Record<string, unknown>): AuditSeverity {
    // Critical actions
    if (['user.permBlock', 'agent.delete', 'setting.security'].includes(action)) {
      return 'critical';
    }

    // High severity
    if (['message.delete', 'user.block', 'rule.delete', 'export.audit'].includes(action)) {
      return 'high';
    }

    // Medium severity
    if (['session.close', 'message.edit', 'rule.create', 'rule.update'].includes(action)) {
      return 'medium';
    }

    // Default: low
    return 'low';
  },
};

// Common audit actions
export const AuditActions = {
  // Messages
  MESSAGE_DELETE: 'message.delete',
  MESSAGE_EDIT: 'message.edit',
  
  // Sessions
  SESSION_CLOSE: 'session.close',
  SESSION_TRANSFER: 'session.transfer',
  SESSION_TAKEOVER: 'session.takeover',
  
  // Users
  USER_BLOCK: 'user.block',
  USER_UNBLOCK: 'user.unblock',
  USER_PERM_BLOCK: 'user.permBlock',
  
  // Agents
  AGENT_CREATE: 'agent.create',
  AGENT_UPDATE: 'agent.update',
  AGENT_DELETE: 'agent.delete',
  AGENT_ROLE_CHANGE: 'agent.roleChange',
  
  // Rules
  RULE_CREATE: 'rule.create',
  RULE_UPDATE: 'rule.update',
  RULE_DELETE: 'rule.delete',
  RULE_TOGGLE: 'rule.toggle',
  
  // Settings
  SETTING_CHANGE: 'setting.change',
  SETTING_SECURITY: 'setting.security',
  
  // Exports
  EXPORT_CREATE: 'export.create',
  EXPORT_DOWNLOAD: 'export.download',
  EXPORT_AUDIT: 'export.audit',
  
  // Auth
  AUTH_LOGIN: 'auth.login',
  AUTH_LOGOUT: 'auth.logout',
  AUTH_FAILED: 'auth.failed',
  AUTH_PASSWORD_CHANGE: 'auth.passwordChange',
};

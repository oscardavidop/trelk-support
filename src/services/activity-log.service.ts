/**
 * Activity Log Service - Track all significant events in chat sessions
 */

import { Types } from 'mongoose';
import { ActivityLog, type IActivityLog, type ActivityAction, type ActorType } from '../database/models/ActivityLog.js';

interface LogActivityParams {
  sessionId: string;
  action: ActivityAction;
  actorType: ActorType;
  actorId?: Types.ObjectId | string;
  actorName?: string;
  metadata?: Record<string, unknown>;
  description?: string;
  icon?: string;
  color?: 'green' | 'yellow' | 'red' | 'blue' | 'gray';
}

// Default icons and colors for actions
const ACTION_DEFAULTS: Record<ActivityAction, { icon: string; color: 'green' | 'yellow' | 'red' | 'blue' | 'gray'; description: string }> = {
  session_created: { icon: '🕐', color: 'blue', description: 'Chat created' },
  session_assigned: { icon: '🟢', color: 'green', description: 'Chat assigned' },
  session_transferred: { icon: '🔄', color: 'yellow', description: 'Chat transferred' },
  session_closed: { icon: '✅', color: 'green', description: 'Chat closed' },
  session_reopened: { icon: '🔓', color: 'yellow', description: 'Chat reopened' },
  session_queued: { icon: '📋', color: 'blue', description: 'Added to queue' },
  message_sent: { icon: '💬', color: 'blue', description: 'Message sent' },
  message_edited: { icon: '✏️', color: 'gray', description: 'Message edited' },
  message_deleted: { icon: '🗑️', color: 'red', description: 'Message deleted' },
  message_pinned: { icon: '📌', color: 'blue', description: 'Message pinned' },
  note_added: { icon: '📝', color: 'blue', description: 'Note added' },
  note_edited: { icon: '✏️', color: 'gray', description: 'Note edited' },
  note_deleted: { icon: '🗑️', color: 'red', description: 'Note deleted' },
  tag_added: { icon: '🏷️', color: 'blue', description: 'Tag added' },
  tag_removed: { icon: '🏷️', color: 'gray', description: 'Tag removed' },
  category_changed: { icon: '📁', color: 'blue', description: 'Category changed' },
  priority_changed: { icon: '⚡', color: 'yellow', description: 'Priority changed' },
  whisper_sent: { icon: '👁️', color: 'blue', description: 'Whisper sent' },
  whisper_read: { icon: '✓', color: 'gray', description: 'Whisper read' },
  supervisor_viewing: { icon: '👁️', color: 'blue', description: 'Supervisor viewing' },
  supervisor_stopped: { icon: '👁️', color: 'gray', description: 'Supervisor stopped viewing' },
  rating_received: { icon: '⭐', color: 'green', description: 'Rating received' },
  rule_triggered: { icon: '⚙️', color: 'blue', description: 'Automation rule triggered' },
  user_blocked: { icon: '🚫', color: 'red', description: 'User blocked' },
  user_unblocked: { icon: '✅', color: 'green', description: 'User unblocked' },
  first_response: { icon: '💬', color: 'green', description: 'First response sent' },
  sla_warning: { icon: '⚠️', color: 'yellow', description: 'SLA warning' },
  sla_breached: { icon: '🔴', color: 'red', description: 'SLA breached' },
};

/**
 * Log an activity event
 */
export async function logActivity(params: LogActivityParams): Promise<IActivityLog> {
  const defaults = ACTION_DEFAULTS[params.action];
  
  const activity = await ActivityLog.create({
    sessionId: params.sessionId,
    action: params.action,
    actor: {
      type: params.actorType,
      id: params.actorId ? new Types.ObjectId(params.actorId.toString()) : undefined,
      name: params.actorName,
    },
    metadata: params.metadata || {},
    description: params.description || defaults.description,
    icon: params.icon || defaults.icon,
    color: params.color || defaults.color,
  });

  return activity;
}

/**
 * Get activity timeline for a session
 */
export async function getSessionTimeline(
  sessionId: string,
  options: {
    limit?: number;
    before?: Date;
    actions?: ActivityAction[];
  } = {}
): Promise<IActivityLog[]> {
  const query: Record<string, unknown> = { sessionId };

  if (options.before) {
    query.createdAt = { $lt: options.before };
  }

  if (options.actions?.length) {
    query.action = { $in: options.actions };
  }

  const result = await ActivityLog.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50)
    .lean();
  
  return result as unknown as IActivityLog[];
}

/**
 * Get recent activities across all sessions (for supervisor dashboard)
 */
export async function getRecentActivities(
  options: {
    limit?: number;
    sessionIds?: string[];
    agentIds?: (Types.ObjectId | string)[];
    actions?: ActivityAction[];
  } = {}
): Promise<IActivityLog[]> {
  const query: Record<string, unknown> = {};

  if (options.sessionIds?.length) {
    query.sessionId = { $in: options.sessionIds };
  }

  if (options.agentIds?.length) {
    query['actor.id'] = { $in: options.agentIds.map(id => new Types.ObjectId(id.toString())) };
  }

  if (options.actions?.length) {
    query.action = { $in: options.actions };
  }

  const result = await ActivityLog.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 100)
    .lean();
  
  return result as unknown as IActivityLog[];
}

/**
 * Count activities by type for analytics
 */
export async function countActivitiesByType(
  sessionId?: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<Record<ActivityAction, number>> {
  const match: Record<string, unknown> = {};
  
  if (sessionId) match.sessionId = sessionId;
  
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) (match.createdAt as any).$gte = dateFrom;
    if (dateTo) (match.createdAt as any).$lte = dateTo;
  }

  const result = await ActivityLog.aggregate<{ _id: ActivityAction; count: number }>([
    { $match: match },
    { $group: { _id: '$action', count: { $sum: 1 } } },
  ]);

  return result.reduce((acc: Record<ActivityAction, number>, item: { _id: ActivityAction; count: number }) => {
    acc[item._id] = item.count;
    return acc;
  }, {} as Record<ActivityAction, number>);
}

// Helper functions for common activities
export const ActivityHelpers = {
  sessionCreated: (sessionId: string, metadata?: Record<string, unknown>) =>
    logActivity({ sessionId, action: 'session_created', actorType: 'system', metadata }),

  sessionAssigned: (sessionId: string, agentId: Types.ObjectId | string, agentName: string) =>
    logActivity({
      sessionId,
      action: 'session_assigned',
      actorType: 'system',
      metadata: { agentId: agentId.toString(), agentName },
      description: `Assigned to ${agentName}`,
    }),

  sessionClosed: (sessionId: string, actorType: ActorType, actorId?: Types.ObjectId | string, actorName?: string, reason?: string) =>
    logActivity({
      sessionId,
      action: 'session_closed',
      actorType,
      actorId,
      actorName,
      metadata: { reason },
      description: reason ? `Chat closed: ${reason}` : 'Chat closed',
    }),

  firstResponse: (sessionId: string, agentId: Types.ObjectId | string, agentName: string, responseTimeSeconds: number) =>
    logActivity({
      sessionId,
      action: 'first_response',
      actorType: 'agent',
      actorId: agentId,
      actorName: agentName,
      metadata: { responseTimeSeconds },
      description: `First response in ${responseTimeSeconds}s`,
    }),

  ratingReceived: (sessionId: string, rating: number, feedback?: string) =>
    logActivity({
      sessionId,
      action: 'rating_received',
      actorType: 'user',
      metadata: { rating, feedback },
      description: `Rating: ${rating}/5${feedback ? ` - "${feedback}"` : ''}`,
    }),

  ruleTriggered: (sessionId: string, ruleId: string, ruleName: string, actions: string[]) =>
    logActivity({
      sessionId,
      action: 'rule_triggered',
      actorType: 'rule',
      metadata: { ruleId, ruleName, actions },
      description: `Rule "${ruleName}" triggered`,
    }),
};

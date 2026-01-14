/**
 * Agent Activity Log Model
 * Tracks agent actions for audit and activity display
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type ActivityType = 
  | 'status_change'
  | 'login'
  | 'logout'
  | 'chat_opened'
  | 'chat_closed'
  | 'chat_transferred'
  | 'chat_assigned'
  | 'message_sent'
  | 'note_added'
  | 'tag_added'
  | 'tag_removed'
  | 'settings_changed'
  | 'password_changed'
  | 'profile_updated';

export interface IAgentActivity extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  
  type: ActivityType;
  description: string;
  
  // Related entities
  sessionId?: string;
  chatId?: Types.ObjectId;
  targetAgentId?: Types.ObjectId;
  
  // Additional details
  metadata?: Record<string, any>;
  
  // IP for security events
  ip?: string;
  
  createdAt: Date;
}

const AgentActivitySchema = new Schema<IAgentActivity>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    
    type: {
      type: String,
      enum: [
        'status_change',
        'login',
        'logout',
        'chat_opened',
        'chat_closed',
        'chat_transferred',
        'chat_assigned',
        'message_sent',
        'note_added',
        'tag_added',
        'tag_removed',
        'settings_changed',
        'password_changed',
        'profile_updated',
      ],
      required: true,
      index: true,
    },
    
    description: {
      type: String,
      required: true,
    },
    
    sessionId: String,
    chatId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
    },
    targetAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    
    metadata: Schema.Types.Mixed,
    ip: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound indexes
AgentActivitySchema.index({ agentId: 1, createdAt: -1 });
AgentActivitySchema.index({ type: 1, createdAt: -1 });

// Auto-cleanup old activities (older than 90 days)
AgentActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AgentActivity = mongoose.model<IAgentActivity>('AgentActivity', AgentActivitySchema);

/**
 * Log an activity
 */
export async function logActivity(
  agentId: string,
  type: ActivityType,
  description: string,
  options?: {
    sessionId?: string;
    chatId?: string;
    targetAgentId?: string;
    metadata?: Record<string, any>;
    ip?: string;
  }
): Promise<IAgentActivity> {
  return AgentActivity.create({
    agentId,
    type,
    description,
    sessionId: options?.sessionId,
    chatId: options?.chatId,
    targetAgentId: options?.targetAgentId,
    metadata: options?.metadata,
    ip: options?.ip,
  });
}

/**
 * Get recent activities for an agent
 */
export async function getRecentActivities(
  agentId: string,
  limit: number = 50
) {
  return AgentActivity.find({ agentId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

/**
 * Get activities by type
 */
export async function getActivitiesByType(
  agentId: string,
  types: ActivityType[],
  limit: number = 50
) {
  return AgentActivity.find({ agentId, type: { $in: types } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

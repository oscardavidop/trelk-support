/**
 * RoutingRule Model - Rules for intelligent chat assignment
 * Matches incoming chats to the best available agent
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type RoutingField = 'category' | 'language' | 'keywords' | 'userTags' | 'time' | 'priority';
export type RoutingOperator = 'equals' | 'contains' | 'notContains' | 'in' | 'between' | 'matches';
export type RoutingAction = 'assignToAgent' | 'assignToTeam' | 'addToQueue' | 'escalate' | 'roundRobin';
export type QueuePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface IRoutingCondition {
  field: RoutingField;
  operator: RoutingOperator;
  value: string | string[] | number[];
}

export interface IRoutingRule extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;                 // Lower = higher priority (evaluated first)
  
  // Conditions to match
  conditions: IRoutingCondition[];
  conditionLogic: 'AND' | 'OR';
  
  // Action when conditions match
  action: {
    type: RoutingAction;
    targetAgentId?: Types.ObjectId;  // For assignToAgent
    targetTeamId?: Types.ObjectId;   // For assignToTeam
    queuePriority?: QueuePriority;   // For addToQueue
    fallbackAction?: RoutingAction;  // If primary fails
  };
  
  // Scoring weights for smart assignment
  scoring?: {
    availabilityWeight: number;      // 0-1, default 0.4
    skillMatchWeight: number;        // 0-1, default 0.3
    currentLoadWeight: number;       // 0-1, default 0.2
    responseTimeWeight: number;      // 0-1, default 0.1
  };
  
  // Stats
  matchCount: number;
  lastMatchedAt?: Date;
  
  // Audit
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RoutingRuleSchema = new Schema<IRoutingRule>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 100,
      index: true,
    },
    conditions: [{
      field: {
        type: String,
        enum: ['category', 'language', 'keywords', 'userTags', 'time', 'priority'],
        required: true,
      },
      operator: {
        type: String,
        enum: ['equals', 'contains', 'notContains', 'in', 'between', 'matches'],
        required: true,
      },
      value: {
        type: Schema.Types.Mixed,
        required: true,
      },
    }],
    conditionLogic: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND',
    },
    action: {
      type: {
        type: String,
        enum: ['assignToAgent', 'assignToTeam', 'addToQueue', 'escalate', 'roundRobin'],
        required: true,
      },
      targetAgentId: {
        type: Schema.Types.ObjectId,
        ref: 'Agent',
      },
      targetTeamId: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
      },
      queuePriority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
      },
      fallbackAction: {
        type: String,
        enum: ['assignToAgent', 'assignToTeam', 'addToQueue', 'escalate', 'roundRobin'],
      },
    },
    scoring: {
      availabilityWeight: { type: Number, default: 0.4, min: 0, max: 1 },
      skillMatchWeight: { type: Number, default: 0.3, min: 0, max: 1 },
      currentLoadWeight: { type: Number, default: 0.2, min: 0, max: 1 },
      responseTimeWeight: { type: Number, default: 0.1, min: 0, max: 1 },
    },
    matchCount: {
      type: Number,
      default: 0,
    },
    lastMatchedAt: Date,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding active rules in priority order
RoutingRuleSchema.index({ isActive: 1, priority: 1 });

export const RoutingRule = mongoose.model<IRoutingRule>('RoutingRule', RoutingRuleSchema);

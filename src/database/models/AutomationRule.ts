/**
 * AutomationRule Model - IF/THEN automation rules for chat events
 * Enables automatic actions based on triggers and conditions
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type TriggerType = 'timer' | 'message' | 'stateChange' | 'rating' | 'connection' | 'manual';
export type ActionType = 
  | 'closeSession' 
  | 'sendMessage' 
  | 'transfer' 
  | 'escalate'
  | 'addTag' 
  | 'removeTag'
  | 'alert' 
  | 'block' 
  | 'assignAgent' 
  | 'setCategory'
  | 'setPriority'
  | 'webhook';

export type ConditionOperator = 
  | 'eq' | 'neq' 
  | 'gt' | 'gte' | 'lt' | 'lte' 
  | 'contains' | 'notContains' 
  | 'in' | 'notIn'
  | 'matches';  // regex

export interface IRuleTrigger {
  type: TriggerType;
  config: {
    // For timer
    intervalMinutes?: number;
    
    // For message
    keywords?: string[];
    regex?: string;
    sender?: 'user' | 'agent' | 'any';
    
    // For stateChange
    fromStatus?: string[];
    toStatus?: string[];
    
    // For rating
    ratingThreshold?: number;
    comparison?: 'lte' | 'gte' | 'eq';
  };
}

export interface IRuleCondition {
  field: string;                    // 'session.status', 'user.tags', etc.
  operator: ConditionOperator;
  value: unknown;
}

export interface IRuleAction {
  type: ActionType;
  config: Record<string, unknown>;
  delay?: number;                   // Delay in seconds before executing
}

export interface IAutomationRule extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;                 // Lower = higher priority
  
  // Trigger configuration
  trigger: IRuleTrigger;
  
  // Conditions (all must be true by default)
  conditions: IRuleCondition[];
  conditionLogic: 'AND' | 'OR';
  
  // Actions to execute
  actions: IRuleAction[];
  
  // Execution limits
  limits: {
    maxExecutionsPerSession?: number;
    cooldownMinutes?: number;
    maxDailyExecutions?: number;
  };
  
  // Stats
  lastExecutedAt?: Date;
  executionCount: number;
  failureCount: number;
  
  // Audit
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationRuleSchema = new Schema<IAutomationRule>(
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
    trigger: {
      type: {
        type: String,
        enum: ['timer', 'message', 'stateChange', 'rating', 'connection', 'manual'],
        required: true,
      },
      config: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    conditions: [{
      field: { type: String, required: true },
      operator: {
        type: String,
        enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'notContains', 'in', 'notIn', 'matches'],
        required: true,
      },
      value: { type: Schema.Types.Mixed, required: true },
    }],
    conditionLogic: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND',
    },
    actions: [{
      type: {
        type: String,
        enum: [
          'closeSession', 'sendMessage', 'transfer', 'escalate',
          'addTag', 'removeTag', 'alert', 'block', 'assignAgent', 
          'setCategory', 'setPriority', 'webhook'
        ],
        required: true,
      },
      config: {
        type: Schema.Types.Mixed,
        default: {},
      },
      delay: {
        type: Number,
        default: 0,
        min: 0,
      },
    }],
    limits: {
      maxExecutionsPerSession: Number,
      cooldownMinutes: Number,
      maxDailyExecutions: Number,
    },
    lastExecutedAt: Date,
    executionCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
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

// Index for finding active rules by trigger type
AutomationRuleSchema.index({ isActive: 1, 'trigger.type': 1, priority: 1 });

export const AutomationRule = mongoose.model<IAutomationRule>('AutomationRule', AutomationRuleSchema);

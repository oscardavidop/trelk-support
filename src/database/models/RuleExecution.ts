/**
 * RuleExecution Model - Audit log for automation rule executions
 * Tracks every rule trigger, condition evaluation, and action result
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IConditionResult {
  field: string;
  expected: unknown;
  actual: unknown;
  passed: boolean;
}

export interface IActionResult {
  type: string;
  success: boolean;
  error?: string;
  result?: Record<string, unknown>;
  executedAt: Date;
  durationMs: number;
}

export interface IRuleExecution extends Document {
  _id: Types.ObjectId;
  ruleId: Types.ObjectId;
  ruleName: string;
  sessionId: string;
  userId?: Types.ObjectId;
  agentId?: Types.ObjectId;
  
  // What triggered the rule
  trigger: {
    type: string;
    data: Record<string, unknown>;
  };
  
  // Condition evaluation results
  conditionsEvaluated: IConditionResult[];
  allConditionsPassed: boolean;
  
  // Action execution results
  actionsExecuted: IActionResult[];
  allActionsSucceeded: boolean;
  
  // Execution stats
  totalDurationMs: number;
  
  executedAt: Date;
}

const RuleExecutionSchema = new Schema<IRuleExecution>(
  {
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: 'AutomationRule',
      required: true,
      index: true,
    },
    ruleName: {
      type: String,
      required: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      index: true,
    },
    trigger: {
      type: {
        type: String,
        required: true,
      },
      data: {
        type: Schema.Types.Mixed,
        default: {},
      },
    },
    conditionsEvaluated: [{
      field: String,
      expected: Schema.Types.Mixed,
      actual: Schema.Types.Mixed,
      passed: Boolean,
    }],
    allConditionsPassed: {
      type: Boolean,
      required: true,
    },
    actionsExecuted: [{
      type: {
        type: String,
        required: true,
      },
      success: Boolean,
      error: String,
      result: Schema.Types.Mixed,
      executedAt: Date,
      durationMs: Number,
    }],
    allActionsSucceeded: {
      type: Boolean,
      required: true,
    },
    totalDurationMs: {
      type: Number,
      default: 0,
    },
    executedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We use executedAt
  }
);

// TTL index - automatically delete old executions after 90 days
RuleExecutionSchema.index({ executedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound indexes for queries
RuleExecutionSchema.index({ ruleId: 1, executedAt: -1 });
RuleExecutionSchema.index({ sessionId: 1, executedAt: -1 });

export const RuleExecution = mongoose.model<IRuleExecution>('RuleExecution', RuleExecutionSchema);

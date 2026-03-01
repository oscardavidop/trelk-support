/**
 * FlowExecution Model - Tracks flow execution state per session
 * Supports pause/resume, retries, and crash recovery
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import type { ExecutionStatus } from './Flow.js';

// ============= TYPES =============

export interface ExecutionStep {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number; // ms
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  retryCount: number;
  messageId?: number; // Telegram message ID for edit operations
}

export interface ExecutionContext {
  flowName: string;
  // Trigger data
  triggerType: string;
  triggerData: Record<string, any>;
  // Session/Chat data
  sessionId: string;
  chatId: number;
  userId: number;
  // Channel type for omnichannel support
  channel?: 'telegram' | 'web' | 'whatsapp' | 'instagram' | 'email';
  // User data (resolved at start)
  user: {
    id: number;
    firstName: string;
    lastName?: string;
    username?: string;
    language?: string;
  };
  // Agent data (if assigned)
  agent?: {
    id: string;
    name: string;
  };
  // Message data (if message trigger)
  message?: {
    id: string;
    content: string;
    type: string;
    mediaUrl?: string;
  };
  // Custom variables set during execution
  variables: Record<string, any>;
  // Custom fields from user profile (for i18n and conditions)
  customFields?: Record<string, any>;
  // Execution metadata
  startedAt: Date;
  lastActiveAt: Date;
  // Button flow support
  lastNodeWithButtons?: string;
  lastMessageId?: number; // Last sent message ID for edit operations
}

// ============= DOCUMENT INTERFACE =============

export interface IFlowExecution extends Document {
  _id: Types.ObjectId;
  name?: string;
  flowId: Types.ObjectId;
  flowVersion: number;
  sessionId: string;
  chatId: number;
  // Status
  status: ExecutionStatus;
  // Execution state
  currentNodeId: string | null;
  nextNodeId: string | null;
  context: ExecutionContext;
  steps: ExecutionStep[];
  // Delay/Wait state
  waitingUntil?: Date;
  waitingFor?: 'response' | 'agent_online' | 'business_hours' | 'condition' | 'fixed_time' | 'button_click';
  // Retry
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  // Lock for concurrency control
  processingLock?: {
    lockId: string;
    expiresAt: Date;
  };
  // Timing
  startedAt: Date;
  completedAt?: Date;
  pausedAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  totalDuration?: number;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  // Methods
  acquireLock(lockId: string, ttlMs?: number): Promise<boolean>;
  releaseLock(lockId: string): Promise<boolean>;
  extendLock(lockId: string, ttlMs?: number): Promise<boolean>;
  addStep(step: Partial<ExecutionStep>): ExecutionStep;
  updateStep(nodeId: string, updates: Partial<ExecutionStep>): void;
  complete(): void;
  fail(error: string): void;
  pause(waitingFor: string, waitingUntil?: Date): void;
  resume(): void;
  cancel(reason?: string): void;
}

// ============= SCHEMA =============

const ExecutionStepSchema = new Schema<ExecutionStep>({
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true },
  nodeLabel: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
    default: 'pending',
  },
  startedAt: Date,
  completedAt: Date,
  duration: Number,
  input: Schema.Types.Mixed,
  output: Schema.Types.Mixed,
  error: String,
  retryCount: { type: Number, default: 0 },
  messageId: Number, // Telegram message ID for editing
}, { _id: false });

const ExecutionContextSchema = new Schema<ExecutionContext>({
  triggerType: { type: String, required: true },
  triggerData: { type: Schema.Types.Mixed, default: {} },
  sessionId: { type: String, required: true },
  chatId: { type: Number, required: true },
  userId: { type: Number, required: true },
  user: {
    id: { type: Number, required: true },
    firstName: { type: String, required: true },
    lastName: String,
    username: String,
    language: String,
  },
  agent: {
    id: String,
    name: String,
  },
  message: {
    type: new Schema({
      id: String,
      content: String,
      type: String,
      mediaUrl: String,
    }, { _id: false }),
    required: false,
  },
  variables: { type: Schema.Types.Mixed, default: {} },
  startedAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  lastNodeWithButtons: String,
  lastMessageId: Number,
}, { _id: false });

const FlowExecutionSchema = new Schema<IFlowExecution>({
  flowId: { type: Schema.Types.ObjectId, ref: 'Flow', required: true },
  flowVersion: { type: Number, required: true },
  sessionId: { type: String, required: true },
  chatId: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'],
    default: 'pending',
  },
  currentNodeId: String,
  nextNodeId: String,
  context: { type: ExecutionContextSchema, required: true },
  steps: [ExecutionStepSchema],
  waitingUntil: Date,
  waitingFor: {
    type: String,
    enum: ['response', 'agent_online', 'business_hours', 'condition', 'fixed_time', 'button_click'],
  },
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  lastError: String,
  processingLock: {
    lockId: String,
    expiresAt: Date,
  },
  startedAt: { type: Date, default: Date.now },
  completedAt: Date,
  pausedAt: Date,
  cancelledAt: Date,
  cancelReason: String,
  totalDuration: Number,
}, {
  timestamps: true,
});

// ============= INDEXES =============

FlowExecutionSchema.index({ flowId: 1, status: 1 });
FlowExecutionSchema.index({ sessionId: 1, status: 1 });
FlowExecutionSchema.index({ status: 1, waitingUntil: 1 });
FlowExecutionSchema.index({ 'processingLock.expiresAt': 1 });
FlowExecutionSchema.index({ chatId: 1 });
FlowExecutionSchema.index({ startedAt: -1 });

// ============= STATICS =============

FlowExecutionSchema.statics.findActiveForSession = function(sessionId: string) {
  return this.find({
    sessionId,
    status: { $in: ['pending', 'running', 'paused'] },
  }).sort({ startedAt: -1 });
};

FlowExecutionSchema.statics.findWaitingExecutions = function() {
  return this.find({
    status: 'paused',
    waitingUntil: { $lte: new Date() },
  });
};

FlowExecutionSchema.statics.findStaleLocks = function(maxAge: number = 60000) {
  return this.find({
    status: 'running',
    'processingLock.expiresAt': { $lte: new Date() },
  });
};

// ============= METHODS =============

FlowExecutionSchema.methods.acquireLock = async function(lockId: string, ttlMs: number = 30000): Promise<boolean> {
  const result = await (this.constructor as any).findOneAndUpdate(
    {
      _id: this._id,
      $or: [
        { processingLock: null },
        { 'processingLock.expiresAt': { $lte: new Date() } },
      ],
    },
    {
      $set: {
        processingLock: {
          lockId,
          expiresAt: new Date(Date.now() + ttlMs),
        },
      },
    },
    { new: true }
  );
  return result !== null;
};

FlowExecutionSchema.methods.releaseLock = async function(lockId: string): Promise<boolean> {
  const result = await (this.constructor as any).findOneAndUpdate(
    {
      _id: this._id,
      'processingLock.lockId': lockId,
    },
    {
      $unset: { processingLock: 1 },
    },
    { new: true }
  );
  return result !== null;
};

FlowExecutionSchema.methods.extendLock = async function(lockId: string, ttlMs: number = 30000): Promise<boolean> {
  const result = await (this.constructor as any).findOneAndUpdate(
    {
      _id: this._id,
      'processingLock.lockId': lockId,
    },
    {
      $set: {
        'processingLock.expiresAt': new Date(Date.now() + ttlMs),
      },
    },
    { new: true }
  );
  return result !== null;
};

FlowExecutionSchema.methods.addStep = function(step: Partial<ExecutionStep>): ExecutionStep {
  const newStep: ExecutionStep = {
    nodeId: step.nodeId!,
    nodeType: step.nodeType!,
    nodeLabel: step.nodeLabel!,
    status: step.status || 'pending',
    startedAt: step.startedAt,
    completedAt: step.completedAt,
    duration: step.duration,
    input: step.input,
    output: step.output,
    error: step.error,
    retryCount: step.retryCount || 0,
  };
  this.steps.push(newStep);
  return newStep;
};

FlowExecutionSchema.methods.updateStep = function(nodeId: string, updates: Partial<ExecutionStep>): void {
  const step = this.steps.find((s: ExecutionStep) => s.nodeId === nodeId);
  if (step) {
    Object.assign(step, updates);
    if (updates.completedAt && step.startedAt) {
      step.duration = updates.completedAt.getTime() - step.startedAt.getTime();
    }
  }
};

FlowExecutionSchema.methods.complete = function(): void {
  this.status = 'completed';
  this.completedAt = new Date();
  this.totalDuration = this.completedAt.getTime() - this.startedAt.getTime();
};

FlowExecutionSchema.methods.fail = function(error: string): void {
  this.status = 'failed';
  this.completedAt = new Date();
  this.lastError = error;
  this.totalDuration = this.completedAt.getTime() - this.startedAt.getTime();
};

FlowExecutionSchema.methods.pause = function(waitingFor: string, waitingUntil?: Date): void {
  this.status = 'paused';
  this.pausedAt = new Date();
  this.waitingFor = waitingFor;
  if (waitingUntil) {
    this.waitingUntil = waitingUntil;
  }
};

FlowExecutionSchema.methods.resume = function(): void {
  this.status = 'running';
  this.pausedAt = undefined;
  this.waitingFor = undefined;
  this.waitingUntil = undefined;
  this.context.lastActiveAt = new Date();
};

FlowExecutionSchema.methods.cancel = function(reason?: string): void {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelReason = reason;
  this.totalDuration = this.cancelledAt.getTime() - this.startedAt.getTime();
};

// ============= MODEL =============

export const FlowExecution = mongoose.model<IFlowExecution>('FlowExecution', FlowExecutionSchema);
export default FlowExecution;

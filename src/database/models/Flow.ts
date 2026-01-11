/**
 * Flow Model - Automation flow definition
 * Visual flow builder similar to Zapier/ManyChat
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============= ENUMS & TYPES =============

export type TriggerType = 
  | 'chat_created'
  | 'message_received'
  | 'chat_assigned'
  | 'chat_closed'
  | 'user_inactive'
  | 'survey_answered'
  | 'category_changed'
  | 'tag_added'
  | 'file_received'
  | 'keyword_detected'
  | 'chat_reopened'
  | 'agent_online'
  | 'sla_warning';

export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'regex'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'exists'
  | 'not_exists'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'ends_with';

export type ActionType = 
  | 'send_message'
  | 'schedule_message'
  | 'transfer_chat'
  | 'assign_agent'
  | 'change_category'
  | 'add_tag'
  | 'remove_tag'
  | 'create_note'
  | 'block_user'
  | 'call_webhook'
  | 'set_custom_field'
  | 'close_chat'
  | 'reopen_chat'
  | 'send_survey'
  | 'escalate'
  | 'wait_for_response'
  | 'add_to_queue';

export type DelayType = 
  | 'fixed_time'
  | 'until_response'
  | 'until_agent_online'
  | 'until_business_hours'
  | 'until_condition';

export type NodeType = 'trigger' | 'condition' | 'action' | 'delay' | 'branch' | 'end';
export type FlowStatus = 'draft' | 'published' | 'archived' | 'disabled';
export type ExecutionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

// ============= NODE CONFIGS =============

export interface TriggerConfig {
  triggerType: TriggerType;
  // Keyword trigger
  keywords?: string[];
  keywordMatchType?: 'exact' | 'contains' | 'regex';
  // Inactivity trigger
  inactivityMinutes?: number;
  // Survey trigger
  surveyRatingFilter?: 'any' | 'positive' | 'negative';
  // Category trigger
  categoryFilter?: string[];
  // Tag trigger
  tagFilter?: string[];
  // File trigger
  fileTypeFilter?: ('image' | 'document' | 'audio' | 'video')[];
}

export interface ConditionRule {
  id: string;
  field: string; // e.g., 'user.firstName', 'message.content', 'chat.status'
  operator: ConditionOperator;
  value: any;
}

export interface ConditionGroup {
  id: string;
  operator: 'AND' | 'OR';
  rules: ConditionRule[];
}

export interface ConditionConfig {
  groups: ConditionGroup[];
  groupOperator: 'AND' | 'OR';
}

export interface ActionConfig {
  actionType: ActionType;
  // Send message
  messageContent?: string;
  messageType?: 'text' | 'image' | 'document';
  mediaUrl?: string;
  // Schedule message
  scheduleDelay?: number;
  scheduleType?: 'fixed_time' | 'after_inactivity';
  // Transfer/Assign
  targetAgentId?: string;
  targetTeamId?: string;
  transferReason?: string;
  // Category/Tag
  categoryName?: string;
  tagName?: string;
  tagColor?: string;
  // Note
  noteContent?: string;
  // Block
  blockDurationHours?: number;
  blockReason?: string;
  // Webhook
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT';
  webhookHeaders?: Record<string, string>;
  webhookBody?: string;
  // Custom field
  customFieldName?: string;
  customFieldValue?: string;
  // Survey
  surveyType?: 'csat' | 'nps';
  // Queue
  queuePriority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface DelayConfig {
  delayType: DelayType;
  // Fixed time
  delayMinutes?: number;
  // Until response
  maxWaitMinutes?: number;
  // Condition
  waitCondition?: ConditionConfig;
  // Cancelable
  cancelOnChatClose?: boolean;
  cancelOnUserResponse?: boolean;
}

// ============= NODE & EDGE INTERFACES =============

export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface IFlowNode {
  id: string;
  type: NodeType;
  label: string;
  config: TriggerConfig | ConditionConfig | ActionConfig | DelayConfig | Record<string, any>;
  position: FlowNodePosition;
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

export interface IFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // 'true' | 'false' for conditions
  targetHandle?: string;
  label?: string;
  animated?: boolean;
}

// ============= FLOW VERSION =============

export interface IFlowVersion {
  version: number;
  nodes: IFlowNode[];
  edges: IFlowEdge[];
  createdAt: Date;
  createdBy: Types.ObjectId;
  changeDescription?: string;
}

// ============= FLOW DOCUMENT =============

export interface IFlow extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  status: FlowStatus;
  enabled: boolean;
  currentVersion: number;
  nodes: IFlowNode[];
  edges: IFlowEdge[];
  versions: IFlowVersion[];
  // Triggers
  triggers: TriggerType[];
  // Stats
  executionCount: number;
  lastExecutedAt?: Date;
  errorCount: number;
  avgExecutionTime?: number;
  // Metadata
  tags?: string[];
  priority: number;
  // Permissions
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  publishedBy?: Types.ObjectId;
  publishedAt?: Date;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  // Methods
  createVersion(agentId: Types.ObjectId, description?: string): void;
  rollbackToVersion(version: number): boolean;
  extractTriggers(): TriggerType[];
}

// ============= FLOW SCHEMA =============

const FlowNodeSchema = new Schema<IFlowNode>({
  id: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['trigger', 'condition', 'action', 'delay', 'branch', 'end'],
    required: true 
  },
  label: { type: String, required: true },
  config: { type: Schema.Types.Mixed, default: {} },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  metadata: {
    color: String,
    icon: String,
    description: String,
  },
}, { _id: false });

const FlowEdgeSchema = new Schema<IFlowEdge>({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceHandle: String,
  targetHandle: String,
  label: String,
  animated: { type: Boolean, default: false },
}, { _id: false });

const FlowVersionSchema = new Schema<IFlowVersion>({
  version: { type: Number, required: true },
  nodes: [FlowNodeSchema],
  edges: [FlowEdgeSchema],
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  changeDescription: String,
}, { _id: false });

const FlowSchema = new Schema<IFlow>({
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
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived', 'disabled'],
    default: 'draft',
  },
  enabled: { type: Boolean, default: false },
  currentVersion: { type: Number, default: 1 },
  nodes: [FlowNodeSchema],
  edges: [FlowEdgeSchema],
  versions: [FlowVersionSchema],
  triggers: [{
    type: String,
    enum: [
      'chat_created', 'message_received', 'chat_assigned', 'chat_closed',
      'user_inactive', 'survey_answered', 'category_changed', 'tag_added',
      'file_received', 'keyword_detected', 'chat_reopened', 'agent_online', 'sla_warning'
    ],
  }],
  executionCount: { type: Number, default: 0 },
  lastExecutedAt: Date,
  errorCount: { type: Number, default: 0 },
  avgExecutionTime: Number,
  tags: [String],
  priority: { type: Number, default: 0 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Agent', required: true },
  publishedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
  publishedAt: Date,
}, {
  timestamps: true,
});

// ============= INDEXES =============

FlowSchema.index({ status: 1, enabled: 1 });
FlowSchema.index({ triggers: 1 });
FlowSchema.index({ createdBy: 1 });
FlowSchema.index({ 'nodes.type': 1 });
FlowSchema.index({ tags: 1 });
FlowSchema.index({ priority: -1 });

// ============= METHODS =============

FlowSchema.methods.createVersion = function(agentId: Types.ObjectId, description?: string): void {
  this.versions.push({
    version: this.currentVersion,
    nodes: [...this.nodes],
    edges: [...this.edges],
    createdAt: new Date(),
    createdBy: agentId,
    changeDescription: description,
  });
  this.currentVersion += 1;
};

FlowSchema.methods.rollbackToVersion = function(version: number): boolean {
  const targetVersion = this.versions.find((v: IFlowVersion) => v.version === version);
  if (!targetVersion) return false;
  
  this.nodes = [...targetVersion.nodes];
  this.edges = [...targetVersion.edges];
  return true;
};

FlowSchema.methods.extractTriggers = function(): TriggerType[] {
  const triggers: TriggerType[] = [];
  for (const node of this.nodes) {
    if (node.type === 'trigger' && node.config?.triggerType) {
      triggers.push(node.config.triggerType as TriggerType);
    }
  }
  return triggers;
};

// ============= PRE-SAVE =============

FlowSchema.pre('save', function(next) {
  // Extract triggers from nodes
  this.triggers = this.extractTriggers();
  next();
});

// ============= MODEL =============

export const Flow = mongoose.model<IFlow>('Flow', FlowSchema);
export default Flow;

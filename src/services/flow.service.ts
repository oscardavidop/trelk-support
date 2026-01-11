/**
 * Flow Service - CRUD operations for automation flows
 */

import { Types } from 'mongoose';
import Flow, { IFlow, IFlowNode, IFlowEdge, FlowStatus, TriggerType } from '../database/models/Flow.js';
import FlowExecution from '../database/models/FlowExecution.js';
import { logger } from './logger.js';

// ============= TYPES =============

export interface CreateFlowInput {
  name: string;
  description?: string;
  nodes?: IFlowNode[];
  edges?: IFlowEdge[];
  tags?: string[];
  priority?: number;
  createdBy: Types.ObjectId;
}

export interface UpdateFlowInput {
  name?: string;
  description?: string;
  nodes?: IFlowNode[];
  edges?: IFlowEdge[];
  tags?: string[];
  priority?: number;
  enabled?: boolean;
  updatedBy: Types.ObjectId;
}

export interface FlowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FlowStats {
  totalFlows: number;
  publishedFlows: number;
  draftFlows: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTime: number;
}

// ============= CRUD OPERATIONS =============

/**
 * Create a new flow
 */
export async function createFlow(input: CreateFlowInput): Promise<IFlow> {
  const flow = new Flow({
    name: input.name,
    description: input.description,
    status: 'draft',
    enabled: false,
    currentVersion: 1,
    nodes: input.nodes || [],
    edges: input.edges || [],
    versions: [],
    tags: input.tags || [],
    priority: input.priority || 0,
    createdBy: input.createdBy,
    updatedBy: input.createdBy,
  });

  await flow.save();
  
  logger.info('flow', { 
    action: 'flow_created',
    flowId: flow._id.toString(),
    name: flow.name,
    createdBy: input.createdBy.toString(),
  });

  return flow;
}

/**
 * Get flow by ID
 */
export async function getFlowById(flowId: string | Types.ObjectId): Promise<IFlow | null> {
  return Flow.findById(flowId);
}

/**
 * Get all flows with optional filters
 */
export async function getFlows(options: {
  status?: FlowStatus;
  enabled?: boolean;
  trigger?: TriggerType;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} = {}): Promise<{ flows: IFlow[]; total: number }> {
  const query: any = {};

  if (options.status) {
    query.status = options.status;
  }

  if (options.enabled !== undefined) {
    query.enabled = options.enabled;
  }

  if (options.trigger) {
    query.triggers = options.trigger;
  }

  if (options.tags && options.tags.length > 0) {
    query.tags = { $in: options.tags };
  }

  if (options.search) {
    query.$or = [
      { name: { $regex: options.search, $options: 'i' } },
      { description: { $regex: options.search, $options: 'i' } },
    ];
  }

  const page = options.page || 1;
  const limit = options.limit || 20;
  const skip = (page - 1) * limit;

  const sortField = options.sortBy || 'updatedAt';
  const sortOrder = options.sortOrder === 'asc' ? 1 : -1;

  const [flows, total] = await Promise.all([
    Flow.find(query)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name'),
    Flow.countDocuments(query),
  ]);

  return { flows, total };
}

/**
 * Update flow
 */
export async function updateFlow(
  flowId: string | Types.ObjectId,
  input: UpdateFlowInput,
  createVersion = true
): Promise<IFlow | null> {
  const flow = await Flow.findById(flowId);
  if (!flow) return null;

  // Create version before updating
  if (createVersion && (input.nodes || input.edges)) {
    flow.createVersion(input.updatedBy, 'Auto-saved version');
  }

  // Update fields
  if (input.name !== undefined) flow.name = input.name;
  if (input.description !== undefined) flow.description = input.description;
  if (input.nodes !== undefined) flow.nodes = input.nodes;
  if (input.edges !== undefined) flow.edges = input.edges;
  if (input.tags !== undefined) flow.tags = input.tags;
  if (input.priority !== undefined) flow.priority = input.priority;
  if (input.enabled !== undefined) flow.enabled = input.enabled;
  
  flow.updatedBy = input.updatedBy;

  await flow.save();

  logger.info('flow', { 
    action: 'flow_updated',
    flowId: flow._id.toString(),
    updatedBy: input.updatedBy.toString(),
  });

  return flow;
}

/**
 * Delete flow
 */
export async function deleteFlow(flowId: string | Types.ObjectId): Promise<boolean> {
  const result = await Flow.deleteOne({ _id: flowId });
  
  if (result.deletedCount > 0) {
    // Also delete executions
    await FlowExecution.deleteMany({ flowId });
    
    logger.info('flow', { 
      action: 'flow_deleted',
      flowId: flowId.toString(),
    });
  }

  return result.deletedCount > 0;
}

/**
 * Duplicate flow
 */
export async function duplicateFlow(
  flowId: string | Types.ObjectId,
  agentId: Types.ObjectId
): Promise<IFlow | null> {
  const original = await Flow.findById(flowId);
  if (!original) return null;

  const duplicate = new Flow({
    name: `${original.name} (Copy)`,
    description: original.description,
    status: 'draft',
    enabled: false,
    currentVersion: 1,
    nodes: original.nodes.map(n => ({ ...n, id: `${n.id}_copy` })),
    edges: original.edges.map(e => ({ 
      ...e, 
      id: `${e.id}_copy`,
      source: `${e.source}_copy`,
      target: `${e.target}_copy`,
    })),
    versions: [],
    tags: original.tags,
    priority: original.priority,
    createdBy: agentId,
    updatedBy: agentId,
  });

  await duplicate.save();

  logger.info('flow', { 
    action: 'flow_duplicated',
    originalId: flowId.toString(),
    duplicateId: duplicate._id.toString(),
  });

  return duplicate;
}

// ============= PUBLISHING =============

/**
 * Publish flow (make it live)
 */
export async function publishFlow(
  flowId: string | Types.ObjectId,
  agentId: Types.ObjectId
): Promise<{ success: boolean; error?: string; flow?: IFlow }> {
  const flow = await Flow.findById(flowId);
  if (!flow) return { success: false, error: 'Flow not found' };

  // Validate before publishing
  const validation = validateFlow(flow);
  if (!validation.valid) {
    return { 
      success: false, 
      error: `Validation failed: ${validation.errors.join(', ')}`,
    };
  }

  // Create version
  flow.createVersion(agentId, 'Published version');

  // Update status
  flow.status = 'published';
  flow.enabled = true;
  flow.publishedBy = agentId;
  flow.publishedAt = new Date();
  flow.updatedBy = agentId;

  await flow.save();

  logger.info('flow', { 
    action: 'flow_published',
    flowId: flow._id.toString(),
    version: flow.currentVersion,
    publishedBy: agentId.toString(),
  });

  return { success: true, flow };
}

/**
 * Unpublish flow (disable)
 */
export async function unpublishFlow(
  flowId: string | Types.ObjectId,
  agentId: Types.ObjectId
): Promise<IFlow | null> {
  const flow = await Flow.findByIdAndUpdate(
    flowId,
    {
      $set: {
        status: 'disabled',
        enabled: false,
        updatedBy: agentId,
      },
    },
    { new: true }
  );

  if (flow) {
    logger.info('flow', { 
      action: 'flow_unpublished',
      flowId: flow._id.toString(),
    });
  }

  return flow;
}

// ============= VERSIONING =============

/**
 * Get flow versions
 */
export async function getFlowVersions(flowId: string | Types.ObjectId): Promise<{
  currentVersion: number;
  versions: Array<{
    version: number;
    createdAt: Date;
    createdBy: { id: string; name: string } | null;
    changeDescription?: string;
  }>;
} | null> {
  const flow = await Flow.findById(flowId).populate('versions.createdBy', 'name');
  if (!flow) return null;

  return {
    currentVersion: flow.currentVersion,
    versions: flow.versions.map(v => ({
      version: v.version,
      createdAt: v.createdAt,
      createdBy: v.createdBy ? { id: v.createdBy.toString(), name: (v.createdBy as any).name } : null,
      changeDescription: v.changeDescription,
    })),
  };
}

/**
 * Rollback to specific version
 */
export async function rollbackFlow(
  flowId: string | Types.ObjectId,
  targetVersion: number,
  agentId: Types.ObjectId
): Promise<{ success: boolean; error?: string; flow?: IFlow }> {
  const flow = await Flow.findById(flowId);
  if (!flow) return { success: false, error: 'Flow not found' };

  // Create version of current state before rollback
  flow.createVersion(agentId, `Before rollback to v${targetVersion}`);

  // Rollback
  const success = flow.rollbackToVersion(targetVersion);
  if (!success) {
    return { success: false, error: 'Version not found' };
  }

  flow.updatedBy = agentId;
  await flow.save();

  logger.info('flow', { 
    action: 'flow_rollback',
    flowId: flow._id.toString(),
    targetVersion,
  });

  return { success: true, flow };
}

// ============= VALIDATION =============

/**
 * Validate flow structure
 */
export function validateFlow(flow: IFlow): FlowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Must have at least one node
  if (!flow.nodes || flow.nodes.length === 0) {
    errors.push('Flow must have at least one node');
  }

  // Must have exactly one trigger
  const triggers = flow.nodes.filter(n => n.type === 'trigger');
  if (triggers.length === 0) {
    errors.push('Flow must have a trigger node');
  } else if (triggers.length > 1) {
    errors.push('Flow can only have one trigger node');
  }

  // Validate trigger config
  if (triggers.length === 1) {
    const trigger = triggers[0];
    if (!trigger.config || !(trigger.config as any).triggerType) {
      errors.push('Trigger must have a type configured');
    }
  }

  // Validate all nodes are connected
  const connectedNodes = new Set<string>();
  if (triggers.length > 0) {
    connectedNodes.add(triggers[0].id);
    
    let changed = true;
    while (changed) {
      changed = false;
      for (const edge of flow.edges) {
        if (connectedNodes.has(edge.source) && !connectedNodes.has(edge.target)) {
          connectedNodes.add(edge.target);
          changed = true;
        }
      }
    }
  }

  const disconnectedNodes = flow.nodes.filter(n => !connectedNodes.has(n.id));
  if (disconnectedNodes.length > 0) {
    warnings.push(`${disconnectedNodes.length} node(s) are not connected to the flow`);
  }

  // Validate condition nodes have both true/false paths
  const conditionNodes = flow.nodes.filter(n => n.type === 'condition');
  for (const condition of conditionNodes) {
    const outEdges = flow.edges.filter(e => e.source === condition.id);
    const hasTrue = outEdges.some(e => e.sourceHandle === 'true');
    const hasFalse = outEdges.some(e => e.sourceHandle === 'false');
    
    if (!hasTrue && !hasFalse) {
      errors.push(`Condition "${condition.label}" has no output connections`);
    } else if (!hasTrue) {
      warnings.push(`Condition "${condition.label}" has no TRUE path`);
    } else if (!hasFalse) {
      warnings.push(`Condition "${condition.label}" has no FALSE path`);
    }
  }

  // Validate action configs
  const actionNodes = flow.nodes.filter(n => n.type === 'action');
  for (const action of actionNodes) {
    const config = action.config as any;
    if (!config.actionType) {
      errors.push(`Action "${action.label}" has no action type configured`);
    }
    
    // Validate specific action types
    if (config.actionType === 'send_message' && !config.messageContent) {
      errors.push(`Action "${action.label}" has no message content`);
    }
    if (config.actionType === 'call_webhook' && !config.webhookUrl) {
      errors.push(`Action "${action.label}" has no webhook URL`);
    }
  }

  // Check for potential infinite loops
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(nodeId: string): boolean {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    
    visited.add(nodeId);
    recursionStack.add(nodeId);
    
    const outEdges = flow.edges.filter(e => e.source === nodeId);
    for (const edge of outEdges) {
      if (hasCycle(edge.target)) return true;
    }
    
    recursionStack.delete(nodeId);
    return false;
  }

  if (triggers.length > 0 && hasCycle(triggers[0].id)) {
    warnings.push('Flow may contain a cycle (possible infinite loop)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============= STATISTICS =============

/**
 * Get flow execution stats
 */
export async function getFlowExecutionStats(flowId: string | Types.ObjectId): Promise<{
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  running: number;
  avgDuration: number;
  last24Hours: number;
  last7Days: number;
}> {
  const stats = await FlowExecution.aggregate([
    { $match: { flowId: new Types.ObjectId(flowId.toString()) } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgDuration: { $avg: '$totalDuration' },
      },
    },
  ]);

  const now = new Date();
  const last24Hours = await FlowExecution.countDocuments({
    flowId,
    startedAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
  });

  const last7Days = await FlowExecution.countDocuments({
    flowId,
    startedAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
  });

  const result = {
    total: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    running: 0,
    avgDuration: 0,
    last24Hours,
    last7Days,
  };

  let totalDuration = 0;
  let durationCount = 0;

  for (const stat of stats) {
    result.total += stat.count;
    if (stat._id === 'completed') result.completed = stat.count;
    if (stat._id === 'failed') result.failed = stat.count;
    if (stat._id === 'cancelled') result.cancelled = stat.count;
    if (stat._id === 'running') result.running = stat.count;
    
    if (stat.avgDuration) {
      totalDuration += stat.avgDuration * stat.count;
      durationCount += stat.count;
    }
  }

  if (durationCount > 0) {
    result.avgDuration = totalDuration / durationCount;
  }

  return result;
}

/**
 * Get overall flow stats
 */
export async function getOverallFlowStats(): Promise<FlowStats> {
  const [flowStats, executionStats] = await Promise.all([
    Flow.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]),
    FlowExecution.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgDuration: { $avg: '$totalDuration' },
        },
      },
    ]),
  ]);

  const result: FlowStats = {
    totalFlows: 0,
    publishedFlows: 0,
    draftFlows: 0,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    avgExecutionTime: 0,
  };

  for (const stat of flowStats) {
    result.totalFlows += stat.count;
    if (stat._id === 'published') result.publishedFlows = stat.count;
    if (stat._id === 'draft') result.draftFlows = stat.count;
  }

  let totalDuration = 0;
  let durationCount = 0;

  for (const stat of executionStats) {
    result.totalExecutions += stat.count;
    if (stat._id === 'completed') result.successfulExecutions = stat.count;
    if (stat._id === 'failed') result.failedExecutions = stat.count;
    
    if (stat.avgDuration) {
      totalDuration += stat.avgDuration * stat.count;
      durationCount += stat.count;
    }
  }

  if (durationCount > 0) {
    result.avgExecutionTime = totalDuration / durationCount;
  }

  return result;
}

// ============= EXPORTS =============

export default {
  createFlow,
  getFlowById,
  getFlows,
  updateFlow,
  deleteFlow,
  duplicateFlow,
  publishFlow,
  unpublishFlow,
  getFlowVersions,
  rollbackFlow,
  validateFlow,
  getFlowExecutionStats,
  getOverallFlowStats,
};

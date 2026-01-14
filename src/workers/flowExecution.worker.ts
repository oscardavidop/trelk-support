/**
 * Flow Execution Worker
 * Processes flow triggers asynchronously using BullMQ
 * 
 * This worker handles flow execution in the background,
 * with caching for better performance
 */

import { Job } from 'bullmq';
import mongoose from 'mongoose';
import {
  registerWorker,
  QUEUE_NAMES,
  type FlowExecutionJob,
} from '../services/queue.js';
import { logger } from '../services/logger.js';
import { FlowCache } from '../services/cache.js';
import { acquireLock, releaseLock } from '../services/redis.js';

// ============= TYPES =============

interface FlowContext {
  session: any;
  chatId: number;
  trigger: Record<string, any>;
  variables: Record<string, any>;
  flowId: string;
}

// ============= WORKER PROCESSOR =============

/**
 * Process a flow execution job
 */
async function processFlowExecution(job: Job<FlowExecutionJob>): Promise<any> {
  const { flowId, sessionId, chatId, triggerType, triggerData } = job.data;
  const lockKey = `flow:${sessionId}:${flowId}`;

  logger.info('worker:flow', {
    action: 'processing',
    jobId: job.id,
    flowId,
    sessionId,
    triggerType,
  });

  // Acquire lock to prevent concurrent execution of same flow for same session
  const lockValue = await acquireLock(lockKey, 60); // 60 second lock
  if (!lockValue) {
    logger.warn('worker:flow', {
      action: 'lock_failed',
      flowId,
      sessionId,
      reason: 'Flow already executing for this session',
    });
    return { skipped: true, reason: 'concurrent_execution' };
  }

  try {
    // Try to get flow from cache first
    let flow = await FlowCache.get(flowId);
    
    if (!flow) {
      // Fallback to database
      const Flow = mongoose.model('Flow');
      const dbFlow = await Flow.findById(flowId).lean();
      
      if (dbFlow) {
        flow = dbFlow;
        // Cache for next time
        await FlowCache.set(flowId, flow);
      }
    }

    if (!flow) {
      logger.error('worker:flow', {
        action: 'flow_not_found',
        flowId,
      });
      return { success: false, reason: 'flow_not_found' };
    }

    // Check if flow is published
    if (!flow.isPublished) {
      logger.warn('worker:flow', {
        action: 'flow_not_published',
        flowId,
      });
      return { skipped: true, reason: 'not_published' };
    }

    // Execute the flow
    const result = await executeFlow(flow, sessionId, chatId, triggerData);

    logger.info('worker:flow', {
      action: 'completed',
      jobId: job.id,
      flowId,
      sessionId,
      nodesExecuted: result.nodesExecuted,
    });

    return {
      success: true,
      flowId,
      nodesExecuted: result.nodesExecuted,
      duration: result.duration,
    };

  } catch (error) {
    logger.error('worker:flow', {
      action: 'execution_failed',
      flowId,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await releaseLock(lockKey, lockValue);
  }
}

// ============= FLOW EXECUTION =============

interface ExecutionResult {
  success: boolean;
  nodesExecuted: number;
  duration: number;
  outputs: Record<string, any>;
}

/**
 * Execute a flow with the given trigger data
 */
async function executeFlow(
  flow: any,
  sessionId: string,
  chatId: number,
  triggerData: Record<string, any>
): Promise<ExecutionResult> {
  const startTime = Date.now();
  let nodesExecuted = 0;
  const outputs: Record<string, any> = {};

  try {
    // Get session context
    const Session = mongoose.model('Session');
    const session = await Session.findById(sessionId);
    
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Create execution context
    const context: FlowContext = {
      session,
      chatId,
      trigger: triggerData,
      variables: {},
      flowId: flow._id.toString(),
    };

    // Execute flow nodes
    const nodes = flow.nodes || [];
    const edges = flow.edges || [];

    // Find entry node (trigger node)
    const triggerNode = nodes.find((n: any) => n.type === 'trigger');
    if (!triggerNode) {
      throw new Error('Flow has no trigger node');
    }

    // Execute nodes in order following edges
    const executed = new Set<string>();
    const queue = [triggerNode.id];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      
      if (executed.has(nodeId)) continue;
      executed.add(nodeId);

      const node = nodes.find((n: any) => n.id === nodeId);
      if (!node) continue;

      // Execute the node
      const nodeResult = await executeNode(node, context);
      nodesExecuted++;
      outputs[nodeId] = nodeResult;

      // Update context with node output
      (context.variables as Record<string, any>)[nodeId] = nodeResult;

      // Find next nodes
      const outgoingEdges = edges.filter((e: any) => e.source === nodeId);
      for (const edge of outgoingEdges) {
        // Check conditions if present
        if (edge.condition && !evaluateCondition(edge.condition, context)) {
          continue;
        }
        queue.push(edge.target);
      }
    }

    return {
      success: true,
      nodesExecuted,
      duration: Date.now() - startTime,
      outputs,
    };

  } catch (error) {
    logger.error('worker:flow', {
      action: 'execute_error',
      flowId: flow._id,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      nodesExecuted,
      duration: Date.now() - startTime,
      outputs,
    };
  }
}

/**
 * Execute a single node
 */
async function executeNode(node: any, context: FlowContext): Promise<any> {
  const { type } = node;

  switch (type) {
    case 'trigger':
      // Trigger nodes just pass through
      return context.trigger;

    case 'message':
      return await executeMessageNode(node, context);

    case 'condition':
      return await executeConditionNode(node, context);

    case 'delay':
      return await executeDelayNode(node, context);

    case 'api':
      return await executeApiNode(node, context);

    case 'variable':
      return await executeVariableNode(node, context);

    case 'tag':
      return await executeTagNode(node, context);

    case 'transfer':
      return await executeTransferNode(node, context);

    case 'close':
      return await executeCloseNode(node, context);

    default:
      logger.warn('worker:flow', {
        action: 'unknown_node_type',
        type,
        nodeId: node.id,
      });
      return null;
  }
}

// ============= NODE EXECUTORS =============

async function executeMessageNode(node: any, context: FlowContext): Promise<any> {
  const telegram = await import('../services/telegram.js');
  
  const message = interpolateVariables(node.data.content || '', context);
  
  const messageId = await telegram.sendMessageWithId(context.chatId, message, {
    parseMode: 'HTML',
  });

  return { messageId };
}

async function executeConditionNode(node: any, context: FlowContext): Promise<boolean> {
  const { condition } = node.data;
  return evaluateCondition(condition, context);
}

async function executeDelayNode(node: any, _context: FlowContext): Promise<void> {
  const delayMs = (node.data.seconds || 0) * 1000;
  if (delayMs > 0 && delayMs <= 30000) { // Max 30 seconds inline delay
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

async function executeApiNode(node: any, context: FlowContext): Promise<any> {
  const { url, method, headers, body } = node.data;
  
  const interpolatedUrl = interpolateVariables(url, context);
  const interpolatedBody = body ? interpolateVariables(body, context) : undefined;

  const response = await fetch(interpolatedUrl, {
    method: method || 'GET',
    headers: headers || {},
    body: interpolatedBody,
  });

  return await response.json();
}

async function executeVariableNode(node: any, context: FlowContext): Promise<any> {
  const { name, value } = node.data;
  const interpolatedValue = interpolateVariables(value, context);
  context.variables[name] = interpolatedValue;
  return interpolatedValue;
}

async function executeTagNode(node: any, context: FlowContext): Promise<void> {
  const Session = mongoose.model('Session');
  const { tags, action = 'add' } = node.data;
  
  if (action === 'add') {
    await Session.findByIdAndUpdate(context.session._id, {
      $addToSet: { tags: { $each: tags } },
    });
  } else if (action === 'remove') {
    await Session.findByIdAndUpdate(context.session._id, {
      $pullAll: { tags: tags },
    });
  }
}

async function executeTransferNode(node: any, context: FlowContext): Promise<void> {
  const Session = mongoose.model('Session');
  const { agentId, department } = node.data;
  
  const update: Record<string, any> = { status: 'queued' };
  if (agentId) update.assignedTo = agentId;
  if (department) update.department = department;
  
  await Session.findByIdAndUpdate(context.session._id, update);
}

async function executeCloseNode(node: any, context: FlowContext): Promise<void> {
  const Session = mongoose.model('Session');
  
  await Session.findByIdAndUpdate(context.session._id, {
    status: 'closed',
    closedAt: new Date(),
    closedBy: 'flow',
    closeReason: node.data.reason || 'Closed by flow',
  });
}

// ============= HELPERS =============

/**
 * Interpolate variables in a string
 * Supports {{variable}} syntax
 */
function interpolateVariables(text: string, context: FlowContext): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const value = getNestedValue(context, path.trim());
    return value !== undefined ? String(value) : match;
  });
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let current: any = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  
  return current;
}

/**
 * Evaluate a condition expression
 */
function evaluateCondition(condition: any, context: FlowContext): boolean {
  if (!condition) return true;
  
  const { operator, left, right } = condition;
  const leftValue = interpolateVariables(left || '', context);
  const rightValue = interpolateVariables(right || '', context);
  
  switch (operator) {
    case 'equals':
    case '==':
      return leftValue == rightValue;
    case 'notEquals':
    case '!=':
      return leftValue != rightValue;
    case 'contains':
      return String(leftValue).includes(String(rightValue));
    case 'notContains':
      return !String(leftValue).includes(String(rightValue));
    case 'startsWith':
      return String(leftValue).startsWith(String(rightValue));
    case 'endsWith':
      return String(leftValue).endsWith(String(rightValue));
    case 'greaterThan':
    case '>':
      return Number(leftValue) > Number(rightValue);
    case 'lessThan':
    case '<':
      return Number(leftValue) < Number(rightValue);
    case 'isEmpty':
      return !leftValue || leftValue === '';
    case 'isNotEmpty':
      return !!leftValue && leftValue !== '';
    default:
      return true;
  }
}

// ============= WORKER REGISTRATION =============

let isWorkerRegistered = false;

/**
 * Start the flow execution worker
 */
export function startFlowExecutionWorker(): void {
  if (isWorkerRegistered) {
    logger.warn('worker:flow', { action: 'already_registered' });
    return;
  }

  registerWorker<FlowExecutionJob>(
    QUEUE_NAMES.FLOW_EXECUTION,
    processFlowExecution,
    { concurrency: 20 } // Process 20 flows in parallel
  );

  isWorkerRegistered = true;
  console.log('✅ [Worker] Flow execution worker started');
}

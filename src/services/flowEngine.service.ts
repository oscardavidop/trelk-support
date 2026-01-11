/**
 * Flow Engine Service - Executes automation flows
 * Deterministic, crash-tolerant, and scalable
 */

import { Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import Flow, { 
  IFlow, 
  IFlowNode, 
  IFlowEdge,
  TriggerType,
  TriggerConfig,
  ConditionConfig,
  ActionConfig,
  DelayConfig,
  ConditionOperator,
} from '../database/models/Flow.js';
import FlowExecution, { 
  IFlowExecution,
  ExecutionContext,
  ExecutionStep,
} from '../database/models/FlowExecution.js';
import { ChatSession } from '../database/models/ChatSession.js';
import { User } from '../database/models/User.js';
import { Agent } from '../database/models/Agent.js';
import { sendMessage, sendPhoto, sendDocument } from './telegram.js';
import { logger } from './logger.js';
import { createScheduledMessage } from './scheduledMessage.service.js';

// ============= TYPES =============

export interface TriggerEvent {
  type: TriggerType;
  sessionId: string;
  chatId: number;
  userId: number;
  data: Record<string, any>;
}

interface ExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  nextNodeId?: string;
  shouldPause?: boolean;
  pauseUntil?: Date;
  pauseFor?: string;
}

// ============= FLOW ENGINE CLASS =============

export class FlowEngine {
  private static instance: FlowEngine;
  private isRunning = false;
  private processingInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() {}

  static getInstance(): FlowEngine {
    if (!FlowEngine.instance) {
      FlowEngine.instance = new FlowEngine();
    }
    return FlowEngine.instance;
  }

  // ============= LIFECYCLE =============

  start(intervalMs: number = 5000): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    logger.info('flow', { action: 'engine_started', interval: intervalMs });

    // Process waiting executions periodically
    this.processingInterval = setInterval(() => {
      this.processWaitingExecutions().catch(err => {
        logger.error('flow', { action: 'process_waiting_error', error: String(err) });
      });
    }, intervalMs);
  }

  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isRunning = false;
    logger.info('flow', { action: 'engine_stopped' });
  }

  // ============= TRIGGER HANDLING =============

  /**
   * Handle an incoming trigger event
   */
  async handleTrigger(event: TriggerEvent): Promise<void> {
    logger.debug('flow', { action: 'trigger_received', type: event.type, sessionId: event.sessionId });

    // Find all enabled flows that match this trigger
    const flows = await Flow.find({
      enabled: true,
      status: 'published',
      triggers: event.type,
    }).sort({ priority: -1 });

    if (flows.length === 0) {
      logger.debug('flow', { action: 'no_matching_flows', type: event.type });
      return;
    }

    // Check if there's already an active execution for this session
    const activeExecutions = await FlowExecution.find({
      sessionId: event.sessionId,
      status: { $in: ['running', 'paused'] },
    });

    // Get session and user data for context
    const session = await ChatSession.findOne({ sessionId: event.sessionId });
    const user = await User.findOne({ telegramId: event.userId });
    
    if (!session || !user) {
      logger.warn('flow', { action: 'missing_context', sessionId: event.sessionId });
      return;
    }

    // Build execution context
    const context: ExecutionContext = {
      triggerType: event.type,
      triggerData: event.data,
      sessionId: event.sessionId,
      chatId: event.chatId,
      userId: event.userId,
      user: {
        id: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        language: user.language,
      },
      variables: {},
      startedAt: new Date(),
      lastActiveAt: new Date(),
    };

    // Add agent data if assigned
    if (session.assignedAgent) {
      const agent = await Agent.findById(session.assignedAgent);
      if (agent) {
        context.agent = {
          id: agent._id.toString(),
          name: agent.name,
        };
      }
    }

    // Add message data if message trigger
    if (event.data.message) {
      context.message = {
        id: event.data.message._id?.toString() || '',
        content: event.data.message.content || '',
        type: event.data.message.messageType || 'text',
        mediaUrl: event.data.message.mediaUrl,
      };
    }

    // Execute matching flows
    for (const flow of flows) {
      // Skip if flow is already running for this session
      if (activeExecutions.some(e => e.flowId.toString() === flow._id.toString())) {
        logger.debug('flow', { 
          action: 'flow_already_running', 
          flowId: flow._id.toString(),
          sessionId: event.sessionId,
        });
        continue;
      }

      // Check if trigger node matches conditions
      const triggerNode = flow.nodes.find(n => n.type === 'trigger');
      if (!triggerNode) continue;

      if (!this.matchesTriggerConfig(triggerNode.config as TriggerConfig, event)) {
        continue;
      }

      // Create execution
      await this.startExecution(flow, context, triggerNode.id);
    }
  }

  /**
   * Check if event matches trigger configuration
   */
  private matchesTriggerConfig(config: TriggerConfig, event: TriggerEvent): boolean {
    if (config.triggerType !== event.type) return false;

    switch (event.type) {
      case 'keyword_detected':
        if (config.keywords && config.keywords.length > 0) {
          const content = event.data.message?.content?.toLowerCase() || '';
          const matchType = config.keywordMatchType || 'contains';
          
          return config.keywords.some(keyword => {
            const kw = keyword.toLowerCase();
            switch (matchType) {
              case 'exact': return content === kw;
              case 'contains': return content.includes(kw);
              case 'regex': return new RegExp(keyword, 'i').test(content);
              default: return content.includes(kw);
            }
          });
        }
        break;

      case 'survey_answered':
        if (config.surveyRatingFilter && config.surveyRatingFilter !== 'any') {
          const rating = event.data.rating;
          if (config.surveyRatingFilter === 'positive' && rating < 4) return false;
          if (config.surveyRatingFilter === 'negative' && rating >= 4) return false;
        }
        break;

      case 'category_changed':
        if (config.categoryFilter && config.categoryFilter.length > 0) {
          if (!config.categoryFilter.includes(event.data.category)) return false;
        }
        break;

      case 'tag_added':
        if (config.tagFilter && config.tagFilter.length > 0) {
          if (!config.tagFilter.includes(event.data.tag)) return false;
        }
        break;

      case 'file_received':
        if (config.fileTypeFilter && config.fileTypeFilter.length > 0) {
          if (!config.fileTypeFilter.includes(event.data.fileType)) return false;
        }
        break;

      case 'user_inactive':
        // Inactivity is handled by the inactivity checker, just validate config
        break;
    }

    return true;
  }

  // ============= EXECUTION =============

  /**
   * Start a new flow execution
   */
  async startExecution(
    flow: IFlow, 
    context: ExecutionContext, 
    startNodeId: string
  ): Promise<IFlowExecution> {
    const execution = new FlowExecution({
      flowId: flow._id,
      flowVersion: flow.currentVersion,
      sessionId: context.sessionId,
      chatId: context.chatId,
      status: 'running',
      currentNodeId: startNodeId,
      context,
      steps: [],
      retryCount: 0,
      maxRetries: 3,
      startedAt: new Date(),
    });

    await execution.save();

    logger.info('flow', { 
      action: 'execution_started',
      executionId: execution._id.toString(),
      flowId: flow._id.toString(),
      flowName: flow.name,
      sessionId: context.sessionId,
    });

    // Update flow stats
    await Flow.updateOne(
      { _id: flow._id },
      { 
        $inc: { executionCount: 1 },
        $set: { lastExecutedAt: new Date() },
      }
    );

    // Start executing
    await this.executeFromNode(execution, flow, startNodeId);

    return execution;
  }

  /**
   * Execute flow from a specific node
   */
  private async executeFromNode(
    execution: IFlowExecution,
    flow: IFlow,
    nodeId: string
  ): Promise<void> {
    const lockId = uuidv4();
    
    // Acquire lock
    const gotLock = await execution.acquireLock(lockId, 60000);
    if (!gotLock) {
      logger.warn('flow', { 
        action: 'lock_failed', 
        executionId: execution._id.toString(),
      });
      return;
    }

    try {
      let currentNodeId: string | null = nodeId;
      let iterations = 0;
      const maxIterations = 100; // Prevent infinite loops

      while (currentNodeId && iterations < maxIterations) {
        iterations++;

        // Extend lock periodically
        if (iterations % 10 === 0) {
          await execution.extendLock(lockId, 60000);
        }

        const node = flow.nodes.find(n => n.id === currentNodeId);
        if (!node) {
          logger.error('flow', { 
            action: 'node_not_found', 
            nodeId: currentNodeId,
            executionId: execution._id.toString(),
          });
          execution.fail(`Node not found: ${currentNodeId}`);
          await execution.save();
          break;
        }

        // Update execution state
        execution.currentNodeId = currentNodeId;
        execution.context.lastActiveAt = new Date();

        // Add step
        const step: ExecutionStep = {
          nodeId: node.id,
          nodeType: node.type,
          nodeLabel: node.label,
          status: 'running',
          startedAt: new Date(),
          retryCount: 0,
        };
        execution.steps.push(step);

        // Execute node
        const result = await this.executeNode(node, execution, flow);

        // Update step
        const stepIndex = execution.steps.findIndex(s => s.nodeId === node.id && s.status === 'running');
        if (stepIndex >= 0) {
          execution.steps[stepIndex].status = result.success ? 'completed' : 'failed';
          execution.steps[stepIndex].completedAt = new Date();
          execution.steps[stepIndex].output = result.output;
          execution.steps[stepIndex].error = result.error;
          if (execution.steps[stepIndex].startedAt) {
            execution.steps[stepIndex].duration = 
              new Date().getTime() - execution.steps[stepIndex].startedAt!.getTime();
          }
        }

        // Handle pause
        if (result.shouldPause) {
          execution.pause(result.pauseFor || 'fixed_time', result.pauseUntil);
          execution.nextNodeId = result.nextNodeId || null;
          await execution.save();
          logger.info('flow', { 
            action: 'execution_paused',
            executionId: execution._id.toString(),
            pauseFor: result.pauseFor,
          });
          break;
        }

        // Handle failure
        if (!result.success) {
          execution.fail(result.error || 'Unknown error');
          await execution.save();
          
          // Update flow error count
          await Flow.updateOne({ _id: flow._id }, { $inc: { errorCount: 1 } });
          break;
        }

        // Get next node
        currentNodeId = result.nextNodeId || this.getNextNode(flow, node.id, result.output);

        // Check if we've reached the end
        if (!currentNodeId) {
          execution.complete();
          await execution.save();

          // Update flow average execution time
          if (execution.totalDuration) {
            const avgTime = flow.avgExecutionTime || execution.totalDuration;
            const newAvg = (avgTime + execution.totalDuration) / 2;
            await Flow.updateOne({ _id: flow._id }, { $set: { avgExecutionTime: newAvg } });
          }

          logger.info('flow', { 
            action: 'execution_completed',
            executionId: execution._id.toString(),
            duration: execution.totalDuration,
          });
          break;
        }

        await execution.save();
      }

      if (iterations >= maxIterations) {
        execution.fail('Maximum iterations exceeded - possible infinite loop');
        await execution.save();
        logger.error('flow', { 
          action: 'max_iterations',
          executionId: execution._id.toString(),
        });
      }
    } finally {
      await execution.releaseLock(lockId);
    }
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    node: IFlowNode,
    execution: IFlowExecution,
    flow: IFlow
  ): Promise<ExecutionResult> {
    try {
      switch (node.type) {
        case 'trigger':
          // Triggers just pass through
          return { success: true };

        case 'condition':
          return await this.executeCondition(node, execution);

        case 'action':
          return await this.executeAction(node, execution);

        case 'delay':
          return await this.executeDelay(node, execution);

        case 'end':
          return { success: true, nextNodeId: undefined };

        default:
          return { success: false, error: `Unknown node type: ${node.type}` };
      }
    } catch (error) {
      logger.error('flow', { 
        action: 'node_execution_error',
        nodeId: node.id,
        nodeType: node.type,
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Execute condition node
   */
  private async executeCondition(
    node: IFlowNode,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const config = node.config as ConditionConfig;
    const result = this.evaluateConditions(config, execution.context);

    return { 
      success: true, 
      output: { conditionResult: result },
    };
  }

  /**
   * Evaluate condition groups
   */
  private evaluateConditions(config: ConditionConfig, context: ExecutionContext): boolean {
    if (!config.groups || config.groups.length === 0) return true;

    const groupResults = config.groups.map(group => {
      if (!group.rules || group.rules.length === 0) return true;

      const ruleResults = group.rules.map(rule => 
        this.evaluateRule(rule.field, rule.operator, rule.value, context)
      );

      return group.operator === 'AND' 
        ? ruleResults.every(r => r)
        : ruleResults.some(r => r);
    });

    return config.groupOperator === 'AND'
      ? groupResults.every(r => r)
      : groupResults.some(r => r);
  }

  /**
   * Evaluate a single condition rule
   */
  private evaluateRule(
    field: string,
    operator: ConditionOperator,
    value: any,
    context: ExecutionContext
  ): boolean {
    const fieldValue = this.resolveField(field, context);

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
      case 'regex':
        return new RegExp(value, 'i').test(String(fieldValue));
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'greater_or_equal':
        return Number(fieldValue) >= Number(value);
      case 'less_or_equal':
        return Number(fieldValue) <= Number(value);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      case 'not_exists':
        return fieldValue === undefined || fieldValue === null;
      case 'is_empty':
        return !fieldValue || (typeof fieldValue === 'string' && fieldValue.trim() === '');
      case 'is_not_empty':
        return !!fieldValue && (typeof fieldValue !== 'string' || fieldValue.trim() !== '');
      case 'starts_with':
        return String(fieldValue).toLowerCase().startsWith(String(value).toLowerCase());
      case 'ends_with':
        return String(fieldValue).toLowerCase().endsWith(String(value).toLowerCase());
      default:
        return false;
    }
  }

  /**
   * Resolve field path from context
   */
  private resolveField(field: string, context: ExecutionContext): any {
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }

    return value;
  }

  /**
   * Execute action node
   */
  private async executeAction(
    node: IFlowNode,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const config = node.config as ActionConfig;
    const ctx = execution.context;

    switch (config.actionType) {
      case 'send_message': {
        const content = this.resolvePlaceholders(config.messageContent || '', ctx);
        const success = await sendMessage(ctx.chatId, content);
        return { success, output: { messageSent: success } };
      }

      case 'schedule_message': {
        const result = await createScheduledMessage({
          sessionId: ctx.sessionId,
          chatId: ctx.chatId,
          type: config.scheduleType === 'after_inactivity' ? 'after_inactivity' : 'fixed_time',
          delayMinutes: config.scheduleDelay,
          message: { text: this.resolvePlaceholders(config.messageContent || '', ctx) },
          createdBy: 'system',
        });
        return { success: !!result, output: { scheduledMessageId: result?._id?.toString() } };
      }

      case 'transfer_chat': {
        if (config.targetAgentId) {
          await ChatSession.updateOne(
            { sessionId: ctx.sessionId },
            { 
              $set: { 
                assignedAgent: new Types.ObjectId(config.targetAgentId),
                status: 'human',
              },
            }
          );
        }
        return { success: true };
      }

      case 'assign_agent': {
        if (config.targetAgentId) {
          await ChatSession.updateOne(
            { sessionId: ctx.sessionId },
            { 
              $set: { 
                assignedAgent: new Types.ObjectId(config.targetAgentId),
                status: 'human',
              },
            }
          );
        }
        return { success: true };
      }

      case 'change_category': {
        await ChatSession.updateOne(
          { sessionId: ctx.sessionId },
          { $set: { category: config.categoryName } }
        );
        return { success: true };
      }

      case 'add_tag': {
        await ChatSession.updateOne(
          { sessionId: ctx.sessionId },
          { $addToSet: { tags: config.tagName } }
        );
        return { success: true };
      }

      case 'remove_tag': {
        await ChatSession.updateOne(
          { sessionId: ctx.sessionId },
          { $pull: { tags: config.tagName } }
        );
        return { success: true };
      }

      case 'create_note': {
        const note = this.resolvePlaceholders(config.noteContent || '', ctx);
        await ChatSession.updateOne(
          { sessionId: ctx.sessionId },
          { 
            $push: { 
              notes: { 
                content: note,
                createdAt: new Date(),
                createdBy: 'automation',
              },
            },
          }
        );
        return { success: true };
      }

      case 'block_user': {
        await User.updateOne(
          { telegramId: ctx.userId },
          { 
            $set: { 
              isBlocked: true,
              blockReason: config.blockReason,
              blockedAt: new Date(),
              blockExpiresAt: config.blockDurationHours 
                ? new Date(Date.now() + config.blockDurationHours * 60 * 60 * 1000)
                : undefined,
            },
          }
        );
        return { success: true };
      }

      case 'call_webhook': {
        try {
          const body = config.webhookBody 
            ? this.resolvePlaceholders(config.webhookBody, ctx)
            : JSON.stringify(ctx);
          
          const response = await fetch(config.webhookUrl!, {
            method: config.webhookMethod || 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...config.webhookHeaders,
            },
            body: config.webhookMethod !== 'GET' ? body : undefined,
          });

          const responseData = await response.json().catch(() => null);
          
          // Store response in variables
          execution.context.variables.webhookResponse = responseData;
          
          return { 
            success: response.ok, 
            output: { status: response.status, data: responseData },
          };
        } catch (error) {
          return { success: false, error: String(error) };
        }
      }

      case 'set_custom_field': {
        execution.context.variables[config.customFieldName!] = 
          this.resolvePlaceholders(config.customFieldValue || '', ctx);
        
        // Also update user custom fields
        await User.updateOne(
          { telegramId: ctx.userId },
          { $set: { [`customFields.${config.customFieldName}`]: config.customFieldValue } }
        );
        return { success: true };
      }

      case 'close_chat': {
        await ChatSession.updateOne(
          { sessionId: ctx.sessionId },
          { 
            $set: { 
              status: 'closed',
              closedAt: new Date(),
              closedByType: 'system',
              closeReason: 'automation',
            },
          }
        );
        return { success: true };
      }

      case 'add_to_queue': {
        await ChatSession.updateOne(
          { sessionId: ctx.sessionId },
          { 
            $set: { 
              status: 'queued',
              queuePriority: config.queuePriority || 'normal',
              queuedAt: new Date(),
            },
          }
        );
        return { success: true };
      }

      default:
        return { success: false, error: `Unknown action type: ${config.actionType}` };
    }
  }

  /**
   * Execute delay node
   */
  private async executeDelay(
    node: IFlowNode,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const config = node.config as DelayConfig;

    switch (config.delayType) {
      case 'fixed_time':
        return {
          success: true,
          shouldPause: true,
          pauseFor: 'fixed_time',
          pauseUntil: new Date(Date.now() + (config.delayMinutes || 1) * 60 * 1000),
        };

      case 'until_response':
        return {
          success: true,
          shouldPause: true,
          pauseFor: 'response',
          pauseUntil: config.maxWaitMinutes 
            ? new Date(Date.now() + config.maxWaitMinutes * 60 * 1000)
            : undefined,
        };

      case 'until_agent_online':
        return {
          success: true,
          shouldPause: true,
          pauseFor: 'agent_online',
        };

      case 'until_business_hours':
        return {
          success: true,
          shouldPause: true,
          pauseFor: 'business_hours',
        };

      default:
        return { success: true };
    }
  }

  /**
   * Get next node based on edges
   */
  private getNextNode(flow: IFlow, currentNodeId: string, output?: any): string | null {
    const edges = flow.edges.filter(e => e.source === currentNodeId);
    
    if (edges.length === 0) return null;
    if (edges.length === 1) return edges[0].target;

    // Handle condition branches
    if (output?.conditionResult !== undefined) {
      const branch = output.conditionResult ? 'true' : 'false';
      const matchingEdge = edges.find(e => e.sourceHandle === branch);
      return matchingEdge?.target || null;
    }

    // Default to first edge
    return edges[0].target;
  }

  /**
   * Resolve placeholders in text
   */
  private resolvePlaceholders(text: string, ctx: ExecutionContext): string {
    return text
      .replace(/\{user\.firstName\}/g, ctx.user.firstName)
      .replace(/\{user\.lastName\}/g, ctx.user.lastName || '')
      .replace(/\{user\.username\}/g, ctx.user.username || '')
      .replace(/\{user\.id\}/g, String(ctx.user.id))
      .replace(/\{agent\.name\}/g, ctx.agent?.name || '')
      .replace(/\{message\.content\}/g, ctx.message?.content || '')
      .replace(/\{session\.id\}/g, ctx.sessionId)
      .replace(/\{chat\.id\}/g, String(ctx.chatId))
      .replace(/\{date\}/g, new Date().toISOString().split('T')[0])
      .replace(/\{time\}/g, new Date().toTimeString().slice(0, 5))
      .replace(/\{var\.(\w+)\}/g, (_, name) => ctx.variables[name] || '');
  }

  // ============= WAITING EXECUTIONS =============

  /**
   * Process executions that are waiting
   */
  private async processWaitingExecutions(): Promise<void> {
    // Find paused executions that are ready to resume
    const executions = await FlowExecution.find({
      status: 'paused',
      $or: [
        { waitingUntil: { $lte: new Date() } },
        { waitingFor: 'agent_online' }, // Check if any agent is now online
      ],
    }).limit(50);

    for (const execution of executions) {
      // Check specific conditions
      if (execution.waitingFor === 'agent_online') {
        const onlineAgent = await Agent.findOne({ onlineStatus: 'online' });
        if (!onlineAgent) continue;
      }

      // Resume execution
      const flow = await Flow.findById(execution.flowId);
      if (!flow || !flow.enabled) {
        execution.cancel('Flow disabled or deleted');
        await execution.save();
        continue;
      }

      execution.resume();
      await execution.save();

      // Continue from next node
      if (execution.nextNodeId) {
        await this.executeFromNode(execution, flow, execution.nextNodeId);
      }
    }
  }

  // ============= CANCEL EXECUTIONS =============

  /**
   * Cancel all executions for a session
   */
  async cancelSessionExecutions(sessionId: string, reason: string): Promise<number> {
    const result = await FlowExecution.updateMany(
      { 
        sessionId,
        status: { $in: ['pending', 'running', 'paused'] },
      },
      {
        $set: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: reason,
        },
      }
    );
    return result.modifiedCount;
  }

  /**
   * Resume executions waiting for user response
   */
  async resumeOnUserResponse(sessionId: string): Promise<void> {
    const executions = await FlowExecution.find({
      sessionId,
      status: 'paused',
      waitingFor: 'response',
    });

    for (const execution of executions) {
      const flow = await Flow.findById(execution.flowId);
      if (!flow) continue;

      execution.resume();
      await execution.save();

      if (execution.nextNodeId) {
        await this.executeFromNode(execution, flow, execution.nextNodeId);
      }
    }
  }
}

// ============= SINGLETON EXPORT =============

export const flowEngine = FlowEngine.getInstance();
export default flowEngine;

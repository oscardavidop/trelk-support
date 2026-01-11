/**
 * Automation Engine - Execute IF/THEN rules based on events and conditions
 */

import { Types } from 'mongoose';
import { 
  AutomationRule, 
  type IAutomationRule, 
  type TriggerType,
  type ConditionOperator 
} from '../database/models/AutomationRule.js';
import { RuleExecution, type IRuleExecution } from '../database/models/RuleExecution.js';
import { ChatSession } from '../database/models/ChatSession.js';
import { Message } from '../database/models/Message.js';
import { User } from '../database/models/User.js';
import { Agent } from '../database/models/Agent.js';
import { ActivityHelpers } from './activity-log.service.js';
import { io } from './socket.js';

// Context passed to condition evaluation and action execution
interface RuleContext {
  sessionId: string;
  session: any;
  user: any;
  agent?: any;
  message?: any;
  previousStatus?: string;
  newStatus?: string;
  rating?: number;
  triggerData: Record<string, unknown>;
}

interface ActionResult {
  type: string;
  success: boolean;
  error?: string;
  result?: Record<string, unknown>;
  executedAt: Date;
  durationMs: number;
}

/**
 * Get all active rules for a trigger type, ordered by priority
 */
export async function getActiveRules(triggerType: TriggerType) {
  const result = await AutomationRule.find({
    isActive: true,
    'trigger.type': triggerType,
  })
    .sort({ priority: 1 })
    .lean();
  
  return result as unknown as IAutomationRule[];
}

/**
 * Evaluate a condition against the context
 */
function evaluateCondition(
  condition: { field: string; operator: ConditionOperator; value: unknown },
  context: RuleContext
): { passed: boolean; actual: unknown } {
  // Get the actual value from context using dot notation
  const getNestedValue = (obj: any, path: string): unknown => {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  };

  const actual = getNestedValue(context, condition.field);
  const expected = condition.value;

  let passed = false;

  switch (condition.operator) {
    case 'eq':
      passed = actual === expected;
      break;
    case 'neq':
      passed = actual !== expected;
      break;
    case 'gt':
      passed = typeof actual === 'number' && typeof expected === 'number' && actual > expected;
      break;
    case 'gte':
      passed = typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
      break;
    case 'lt':
      passed = typeof actual === 'number' && typeof expected === 'number' && actual < expected;
      break;
    case 'lte':
      passed = typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
      break;
    case 'contains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        passed = actual.toLowerCase().includes(expected.toLowerCase());
      } else if (Array.isArray(actual)) {
        passed = actual.includes(expected);
      }
      break;
    case 'notContains':
      if (typeof actual === 'string' && typeof expected === 'string') {
        passed = !actual.toLowerCase().includes(expected.toLowerCase());
      } else if (Array.isArray(actual)) {
        passed = !actual.includes(expected);
      }
      break;
    case 'in':
      if (Array.isArray(expected)) {
        passed = expected.includes(actual);
      }
      break;
    case 'notIn':
      if (Array.isArray(expected)) {
        passed = !expected.includes(actual);
      }
      break;
    case 'matches':
      if (typeof actual === 'string' && typeof expected === 'string') {
        try {
          const regex = new RegExp(expected, 'i');
          passed = regex.test(actual);
        } catch {
          passed = false;
        }
      }
      break;
  }

  return { passed, actual };
}

/**
 * Evaluate all conditions of a rule
 */
function evaluateConditions(
  rule: IAutomationRule,
  context: RuleContext
): { allPassed: boolean; results: Array<{ field: string; expected: unknown; actual: unknown; passed: boolean }> } {
  const results = rule.conditions.map(condition => {
    const { passed, actual } = evaluateCondition(condition, context);
    return {
      field: condition.field,
      expected: condition.value,
      actual,
      passed,
    };
  });

  const allPassed = rule.conditionLogic === 'AND'
    ? results.every(r => r.passed)
    : results.some(r => r.passed);

  return { allPassed, results };
}

/**
 * Execute an action
 */
async function executeAction(
  action: { type: string; config: Record<string, unknown>; delay?: number },
  context: RuleContext
): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    // Wait for delay if specified
    if (action.delay !== undefined && action.delay > 0) {
      const delayMs = action.delay * 1000;
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    let result: Record<string, unknown> = {};

    switch (action.type) {
      case 'closeSession':
        await ChatSession.findOneAndUpdate(
          { sessionId: context.sessionId },
          {
            status: 'closed',
            closedAt: new Date(),
            closedByType: 'system',
            closeReason: action.config.reason || 'automation',
          }
        );
        io.to(context.sessionId).emit('session:closed', context.sessionId);
        result = { closed: true };
        break;

      case 'sendMessage':
        const message = await Message.create({
          sessionId: context.sessionId,
          content: action.config.content as string,
          sender: 'bot',
          isAutoReply: true,
        });
        io.to(context.sessionId).emit('message:new', {
          _id: message._id.toString(),
          session: context.sessionId,
          sender: 'bot',
          content: message.content,
          createdAt: message.createdAt,
        });
        result = { messageId: message._id.toString() };
        break;

      case 'addTag':
        await ChatSession.findOneAndUpdate(
          { sessionId: context.sessionId },
          { $addToSet: { tags: action.config.tag } }
        );
        result = { tagAdded: action.config.tag };
        break;

      case 'removeTag':
        await ChatSession.findOneAndUpdate(
          { sessionId: context.sessionId },
          { $pull: { tags: action.config.tag } }
        );
        result = { tagRemoved: action.config.tag };
        break;

      case 'setCategory':
        await ChatSession.findOneAndUpdate(
          { sessionId: context.sessionId },
          { category: action.config.category }
        );
        result = { category: action.config.category };
        break;

      case 'setPriority':
        await ChatSession.findOneAndUpdate(
          { sessionId: context.sessionId },
          { priority: action.config.priority }
        );
        io.to(context.sessionId).emit('session:update', {
          sessionId: context.sessionId,
          priority: action.config.priority,
        });
        result = { priority: action.config.priority };
        break;

      case 'assignAgent':
        const agent = await Agent.findById(action.config.agentId);
        if (agent && agent.onlineStatus === 'online' && agent.activeChats < 5) {
          const updatedSession = await ChatSession.findOneAndUpdate(
            { sessionId: context.sessionId },
            {
              assignedAgent: agent._id,
              status: 'human',
            },
            { new: true }
          ).populate('user');
          await Agent.findByIdAndUpdate(agent._id, { $inc: { activeChats: 1 } });
          if (updatedSession && agent.socketId) {
            // Notify via session:assigned instead of session:new
            io.to(agent.socketId).emit('session:assigned', {
              sessionId: context.sessionId,
              agentId: agent._id.toString(),
              agentName: agent.name,
            });
          }
          result = { assignedTo: agent._id.toString() };
        }
        break;

      case 'transfer':
        // Transfer to specific agent or queue
        if (action.config.toAgentId) {
          await ChatSession.findOneAndUpdate(
            { sessionId: context.sessionId },
            { assignedAgent: action.config.toAgentId }
          );
          result = { transferredTo: action.config.toAgentId };
        } else {
          await ChatSession.findOneAndUpdate(
            { sessionId: context.sessionId },
            { 
              status: 'queued',
              assignedAgent: null,
              priority: action.config.priority || 'high',
            }
          );
          result = { transferredToQueue: true };
        }
        break;

      case 'escalate':
        await ChatSession.findOneAndUpdate(
          { sessionId: context.sessionId },
          { priority: 'urgent' }
        );
        // Notify supervisors
        io.emit('escalation:new', {
          sessionId: context.sessionId,
          reason: action.config.reason as string | undefined,
        });
        result = { escalated: true };
        break;

      case 'alert':
        io.emit('alert:automation', {
          sessionId: context.sessionId,
          message: action.config.message as string | undefined,
          type: (action.config.alertType as string) || 'warning',
        });
        result = { alerted: true };
        break;

      case 'webhook':
        // TODO: Implement webhook calls
        result = { webhook: 'not implemented' };
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    return {
      type: action.type,
      success: true,
      result,
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      type: action.type,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      executedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Check execution limits before running a rule
 */
async function checkExecutionLimits(
  rule: IAutomationRule,
  sessionId: string
): Promise<{ canExecute: boolean; reason?: string }> {
  const { limits } = rule;
  
  if (!limits) return { canExecute: true };

  // Check per-session limit
  if (limits.maxExecutionsPerSession) {
    const sessionExecutions = await RuleExecution.countDocuments({
      ruleId: rule._id,
      sessionId,
      allConditionsPassed: true,
    });
    
    if (sessionExecutions >= limits.maxExecutionsPerSession) {
      return { 
        canExecute: false, 
        reason: `Max ${limits.maxExecutionsPerSession} executions per session reached` 
      };
    }
  }

  // Check cooldown
  if (limits.cooldownMinutes && rule.lastExecutedAt) {
    const cooldownEnd = new Date(rule.lastExecutedAt.getTime() + limits.cooldownMinutes * 60 * 1000);
    if (new Date() < cooldownEnd) {
      return { 
        canExecute: false, 
        reason: `Cooldown active until ${cooldownEnd.toISOString()}` 
      };
    }
  }

  // Check daily limit
  if (limits.maxDailyExecutions) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const todayExecutions = await RuleExecution.countDocuments({
      ruleId: rule._id,
      executedAt: { $gte: todayStart },
      allConditionsPassed: true,
    });
    
    if (todayExecutions >= limits.maxDailyExecutions) {
      return { 
        canExecute: false, 
        reason: `Max ${limits.maxDailyExecutions} daily executions reached` 
      };
    }
  }

  return { canExecute: true };
}

/**
 * Process a single rule against a context
 */
async function processRule(
  rule: IAutomationRule,
  context: RuleContext
): Promise<IRuleExecution | null> {
  const startTime = Date.now();

  // Check limits
  const { canExecute, reason } = await checkExecutionLimits(rule, context.sessionId);
  if (!canExecute) {
    console.log(`Rule ${rule.name} skipped: ${reason}`);
    return null;
  }

  // Evaluate conditions
  const { allPassed, results } = evaluateConditions(rule, context);

  // Always log the execution attempt
  const actionResults: ActionResult[] = [];
  
  if (allPassed) {
    // Execute all actions
    for (const action of rule.actions) {
      const result = await executeAction(action, context);
      actionResults.push(result);
    }

    // Update rule stats
    await AutomationRule.findByIdAndUpdate(rule._id, {
      lastExecutedAt: new Date(),
      $inc: { 
        executionCount: 1,
        failureCount: actionResults.some(r => !r.success) ? 1 : 0,
      },
    });

    // Log activity
    await ActivityHelpers.ruleTriggered(
      context.sessionId,
      rule._id.toString(),
      rule.name,
      rule.actions.map(a => a.type)
    );
  }

  // Create execution log
  const execution = await RuleExecution.create({
    ruleId: rule._id,
    ruleName: rule.name,
    sessionId: context.sessionId,
    userId: context.user?._id,
    agentId: context.agent?._id,
    trigger: {
      type: rule.trigger.type,
      data: context.triggerData,
    },
    conditionsEvaluated: results,
    allConditionsPassed: allPassed,
    actionsExecuted: actionResults,
    allActionsSucceeded: actionResults.every(r => r.success),
    totalDurationMs: Date.now() - startTime,
    executedAt: new Date(),
  });

  return execution;
}

/**
 * Main entry point: Process trigger event
 */
export async function processTrigger(
  triggerType: TriggerType,
  sessionId: string,
  triggerData: Record<string, unknown> = {}
): Promise<void> {
  try {
    // Get session and user context
    const session = await ChatSession.findOne({ sessionId })
      .populate('user')
      .populate('assignedAgent')
      .lean();

    if (!session) {
      console.warn(`Automation: Session ${sessionId} not found`);
      return;
    }

    const context: RuleContext = {
      sessionId,
      session,
      user: session.user,
      agent: session.assignedAgent,
      triggerData,
      ...triggerData, // Spread trigger-specific data like message, rating, etc.
    };

    // Get all active rules for this trigger
    const rules = await getActiveRules(triggerType);

    // Process each rule
    for (const rule of rules) {
      try {
        await processRule(rule, context);
      } catch (error) {
        console.error(`Error processing rule ${rule.name}:`, error);
        await AutomationRule.findByIdAndUpdate(rule._id, {
          $inc: { failureCount: 1 },
        });
      }
    }
  } catch (error) {
    console.error('Error in automation engine:', error);
  }
}

// Export trigger helpers
export const AutomationTriggers = {
  onMessage: (sessionId: string, message: any, sender: 'user' | 'agent') => 
    processTrigger('message', sessionId, { message, sender }),
  
  onStateChange: (sessionId: string, fromStatus: string, toStatus: string) =>
    processTrigger('stateChange', sessionId, { previousStatus: fromStatus, newStatus: toStatus }),
  
  onRating: (sessionId: string, rating: number, feedback?: string) =>
    processTrigger('rating', sessionId, { rating, feedback }),
  
  onConnection: (sessionId: string, connected: boolean) =>
    processTrigger('connection', sessionId, { connected }),
};

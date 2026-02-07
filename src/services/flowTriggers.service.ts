/**
 * Flow Triggers Service
 * Integrates the Flow Engine with real system events
 * 
 * This service provides hooks that can be called from:
 * - bot.handlers.ts (message received, chat created)
 * - chat.service.ts (chat closed, status changed)
 * - socket.ts (agent assigned, agent actions)
 * - scheduledMessage.worker.ts (inactivity events)
 */

import { flowEngine, TriggerEvent } from './flowEngine.service.js';
import { ChatSession, type IChatSession } from '../database/models/ChatSession.js';
import { User, type IUser } from '../database/models/User.js';
import { logger } from './logger.js';
import FlowExecution from '../database/models/FlowExecution.js';
import Flow from '../database/models/Flow.js';
import type { ChannelType } from '../types/omnichannel.js';

// ============= TRIGGER HELPERS =============

/**
 * Build trigger event from user (without session)
 * Used when no active support session exists
 */
function buildTriggerEventFromUser(
  type: TriggerEvent['type'],
  user: IUser,
  chatId: number,
  extraData: Record<string, any> = {},
  channel: ChannelType = 'telegram'
): TriggerEvent {
  return {
    type,
    sessionId: `nosession-${chatId}`, // Virtual session ID for flows without session
    chatId,
    externalChatId: String(chatId),
    userId: user.telegramId,
    externalUserId: String(user.telegramId),
    channel, // Omnichannel support
    data: {
      session: {
        id: `nosession-${chatId}`,
        status: 'none', // No active session
        category: undefined,
        priority: undefined,
        tags: [],
      },
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        language: user.language,
      },
      channel, // Also include in data for condition evaluation
      ...extraData,
    },
  };
}

/**
 * Build base trigger event from session
 */
async function buildTriggerEvent(
  type: TriggerEvent['type'],
  session: IChatSession,
  extraData: Record<string, any> = {}
): Promise<TriggerEvent | null> {
  try {
    const user = await User.findById(session.user);
    if (!user) {
      logger.warn('flow', { action: 'trigger_no_user', sessionId: session.sessionId });
      return null;
    }

    // Determine channel from session or default to telegram
    const channel: ChannelType = session.channel || 'telegram';

    return {
      type,
      sessionId: session.sessionId,
      chatId: session.telegramChatId || 0, // 0 for web/non-telegram sessions
      externalChatId: session.externalChatId || String(session.telegramChatId),
      userId: user.telegramId || 0,
      externalUserId: String(user.telegramId || session.webVisitor),
      channel,
      data: {
        session: {
          id: session.sessionId,
          status: session.status,
          category: session.category,
          priority: session.priority,
          tags: session.tags,
        },
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          language: user.language,
        },
        channel, // Also include in data for condition evaluation
        ...extraData,
      },
    };
  } catch (error) {
    logger.error('flow', { action: 'build_trigger_error', error: String(error) });
    return null;
  }
}

// ============= PUBLIC TRIGGER FUNCTIONS =============

/**
 * Trigger: New chat/session created
 */
export async function triggerChatCreated(session: IChatSession): Promise<void> {
  logger.info('flow', { 
    action: 'triggerChatCreated_called', 
    sessionId: session.sessionId,
    telegramChatId: session.telegramChatId,
  });
  const event = await buildTriggerEvent('chat_created', session);
  if (event) {
    logger.info('flow', { action: 'trigger_chat_created', sessionId: session.sessionId });
    await flowEngine.handleTrigger(event);
  }
}

/**
 * Trigger: Message received from user
 */
export async function triggerMessageReceived(
  session: IChatSession,
  message: {
    content: string;
    messageType: string;
    mediaUrl?: string;
    messageId?: number;
  }
): Promise<void> {
  logger.info('flow', { 
    action: 'triggerMessageReceived_called', 
    sessionId: session.sessionId,
    content: message.content?.substring(0, 50),
  });
  const event = await buildTriggerEvent('message_received', session, { message });
  if (event) {
    logger.info('flow', { action: 'trigger_message_received', sessionId: session.sessionId });
    await flowEngine.handleTrigger(event);
    
    // Also resume any flows waiting for user response, passing the message content
    await flowEngine.resumeOnUserResponse(session.sessionId, message.content);
  }
}

/**
 * Trigger: Keyword detected in message
 */
export async function triggerKeywordDetected(
  session: IChatSession,
  message: { content: string; messageType: string }
): Promise<void> {
  logger.info('flow', { 
    action: 'triggerKeywordDetected_called', 
    sessionId: session.sessionId,
    content: message.content?.substring(0, 50),
  });
  const event = await buildTriggerEvent('keyword_detected', session, { message });
  if (event) {
    logger.info('flow', { action: 'trigger_keyword', sessionId: session.sessionId });
    await flowEngine.handleTrigger(event);
  }
}

/**
 * Trigger: Chat assigned to agent
 */
export async function triggerChatAssigned(
  session: IChatSession,
  agentId: string,
  agentName: string
): Promise<void> {
  const event = await buildTriggerEvent('chat_assigned', session, {
    agent: { id: agentId, name: agentName },
  });
  if (event) {
    logger.debug('flow', { action: 'trigger_chat_assigned', sessionId: session.sessionId, agentId });
    await flowEngine.handleTrigger(event);
  }
}

/**
 * Trigger: Chat closed
 */
export async function triggerChatClosed(
  session: IChatSession,
  closedBy: 'agent' | 'user' | 'system',
  reason?: string
): Promise<void> {
  const event = await buildTriggerEvent('chat_closed', session, {
    closedBy,
    reason,
  });
  if (event) {
    logger.debug('flow', { action: 'trigger_chat_closed', sessionId: session.sessionId, closedBy });
    await flowEngine.handleTrigger(event);
    
    // Cancel any running flows for this session
    await flowEngine.cancelSessionExecutions(session.sessionId, 'Chat closed');
  }
}

/**
 * Trigger: User inactive (no response for X minutes)
 */
export async function triggerUserInactive(
  session: IChatSession,
  inactiveMinutes: number
): Promise<void> {
  const event = await buildTriggerEvent('user_inactive', session, { inactiveMinutes });
  if (event) {
    logger.debug('flow', { action: 'trigger_user_inactive', sessionId: session.sessionId, minutes: inactiveMinutes });
    await flowEngine.handleTrigger(event);
  }
}

/**
 * Trigger: Survey answered
 */
export async function triggerSurveyAnswered(
  session: IChatSession,
  survey: { rating: number; feedback?: string }
): Promise<void> {
  const event = await buildTriggerEvent('survey_answered', session, {
    rating: survey.rating,
    feedback: survey.feedback,
  });
  if (event) {
    logger.debug('flow', { action: 'trigger_survey', sessionId: session.sessionId, rating: survey.rating });
    await flowEngine.handleTrigger(event);
  }
}

/**
 * Trigger: Category changed
 */
export async function triggerCategoryChanged(
  session: IChatSession,
  oldCategory: string | undefined,
  newCategory: string
): Promise<void> {
  const event = await buildTriggerEvent('category_changed', session, {
    oldCategory,
    category: newCategory,
  });
  if (event) {
    logger.debug('flow', { action: 'trigger_category_changed', sessionId: session.sessionId, newCategory });
    await flowEngine.handleTrigger(event);
  }
}

/**
 * Trigger: Tag added
 */
export async function triggerTagAdded(
  session: IChatSession,
  tag: string
): Promise<void> {
  const event = await buildTriggerEvent('tag_added', session, { tag });
  if (event) {
    logger.debug('flow', { action: 'trigger_tag_added', sessionId: session.sessionId, tag });
    await flowEngine.handleTrigger(event);
  }
}

/**
 * Trigger: File received from user
 */
export async function triggerFileReceived(
  session: IChatSession,
  file: { type: string; fileId?: string; caption?: string }
): Promise<void> {
  const event = await buildTriggerEvent('file_received', session, {
    fileType: file.type,
    fileId: file.fileId,
    caption: file.caption,
  });
  if (event) {
    logger.debug('flow', { action: 'trigger_file_received', sessionId: session.sessionId, type: file.type });
    await flowEngine.handleTrigger(event);
  }
}

/**
 * Trigger: Agent message sent
 */
export async function triggerAgentMessageSent(
  session: IChatSession,
  message: { content: string; agentId: string; agentName: string }
): Promise<void> {
  const event = await buildTriggerEvent('agent_message_sent', session, {
    message: { content: message.content },
    agent: { id: message.agentId, name: message.agentName },
  });
  if (event) {
    logger.debug('flow', { action: 'trigger_agent_message', sessionId: session.sessionId });
    await flowEngine.handleTrigger(event);
  }
}

/**
 * Trigger: First response from agent
 */
export async function triggerFirstResponse(
  session: IChatSession,
  responseTimeSeconds: number,
  agentId: string
): Promise<void> {
  const event = await buildTriggerEvent('first_response', session, {
    responseTimeSeconds,
    agent: { id: agentId },
  });
  if (event) {
    logger.debug('flow', { action: 'trigger_first_response', sessionId: session.sessionId, responseTime: responseTimeSeconds });
    await flowEngine.handleTrigger(event);
  }
}

// ============= UTILITY =============

/**
 * Get session by ID and trigger event
 */
export async function triggerBySessionId(
  sessionId: string,
  triggerType: TriggerEvent['type'],
  data: Record<string, any> = {}
): Promise<void> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session) {
    logger.warn('flow', { action: 'trigger_session_not_found', sessionId, triggerType });
    return;
  }

  const event = await buildTriggerEvent(triggerType, session, data);
  if (event) {
    await flowEngine.handleTrigger(event);
  }
}

// ============= NO-SESSION TRIGGERS =============

// ============= COMMAND TRIGGERS =============

/**
 * Trigger: Command received (e.g., /start, /help)
 * Supports deep links: t.me/bot?start=PARAM
 */
export async function triggerCommandReceivedNoSession(
  user: IUser,
  chatId: number,
  command: {
    name: string;     // Command without / (e.g., 'start', 'help')
    param?: string;   // Deep link parameter (e.g., for /start ref123 → param='ref123')
    fullText: string; // Full message text
    messageId?: number;
  }
): Promise<void> {
  logger.info('flow', { 
    action: 'triggerCommandReceivedNoSession_called', 
    chatId,
    userId: user.telegramId,
    command: command.name,
    param: command.param,
  });
  
  const event = buildTriggerEventFromUser('command_received', user, chatId, { 
    command: {
      name: command.name,
      param: command.param,
      fullText: command.fullText,
    },
    message: {
      content: command.fullText,
      messageType: 'text',
      messageId: command.messageId,
    }
  });
  
  logger.info('flow', { action: 'trigger_command_no_session', chatId, command: command.name });
  await flowEngine.handleTrigger(event);
}

/**
 * Trigger: Command received WITH active session
 */
export async function triggerCommandReceived(
  session: IChatSession,
  command: {
    name: string;
    param?: string;
    fullText: string;
    messageId?: number;
  }
): Promise<void> {
  logger.info('flow', { 
    action: 'triggerCommandReceived_called', 
    sessionId: session.sessionId,
    command: command.name,
    param: command.param,
  });
  
  const event = await buildTriggerEvent('command_received', session, { 
    command: {
      name: command.name,
      param: command.param,
      fullText: command.fullText,
    },
    message: {
      content: command.fullText,
      messageType: 'text',
      messageId: command.messageId,
    }
  });
  
  if (event) {
    logger.info('flow', { action: 'trigger_command', sessionId: session.sessionId, command: command.name });
    await flowEngine.handleTrigger(event);
  }
}

// ============= NO-SESSION TRIGGERS =============

/**
 * Trigger: Message received from user WITHOUT active session
 * Used for flows that should run for any message, not just during support
 */
export async function triggerMessageReceivedNoSession(
  user: IUser,
  chatId: number,
  message: {
    content: string;
    messageType: string;
    messageId?: number;
  }
): Promise<void> {
  logger.info('flow', { 
    action: 'triggerMessageReceivedNoSession_called', 
    chatId,
    userId: user.telegramId,
    content: message.content?.substring(0, 50),
  });
  
  const event = buildTriggerEventFromUser('message_received', user, chatId, { message });
  const sessionId = `nosession-${chatId}`;
  
  logger.info('flow', { action: 'trigger_message_no_session', chatId });
  await flowEngine.handleTrigger(event);
  
  // Also resume any flows waiting for user response
  await flowEngine.resumeOnUserResponse(sessionId, message.content);
}

/**
 * Trigger: Keyword detected WITHOUT active session
 */
export async function triggerKeywordDetectedNoSession(
  user: IUser,
  chatId: number,
  message: { content: string; messageType: string }
): Promise<void> {
  logger.info('flow', { 
    action: 'triggerKeywordDetectedNoSession_called', 
    chatId,
    content: message.content?.substring(0, 50),
  });
  
  const event = buildTriggerEventFromUser('keyword_detected', user, chatId, { message });
  logger.info('flow', { action: 'trigger_keyword_no_session', chatId });
  await flowEngine.handleTrigger(event);
}

/**
 * Handle flow button click callback
 * Supports three formats:
 * - Compact: fb:{shortId} (new compact format, under 64 bytes)
 * - Simple: flow:{nodeId}:btn:{btnId} (current format from frontend)
 * - Full: flow:{flowId}:node:{nodeId}:btn:{btnId}:{mode}
 */
export async function handleFlowButtonCallback(
  callbackData: string,
  user: IUser,
  chatId: number,
  messageId: number
): Promise<{ handled: boolean; error?: string }> {
  const parts = callbackData.split(':');
  
  // Check for compact format first: fb:{shortId}
  if (parts[0] === 'fb' && parts.length === 2) {
    const shortId = parts[1];
    const { getCallbackDataAsync } = await import('./flowEngine.service.js');
    const callbackMapping = await getCallbackDataAsync(shortId);
    
    if (!callbackMapping) {
      logger.warn('flow', {
        action: 'flow_button_expired_or_invalid',
        shortId,
        chatId,
      });
      return { handled: false, error: 'Button expired or invalid' };
    }
    
    logger.info('flow', {
      action: 'flow_button_compact_format',
      shortId,
      flowId: callbackMapping.flowId,
      nodeId: callbackMapping.nodeId,
      btnId: callbackMapping.btnId,
      mode: callbackMapping.mode,
      chatId,
    });
    
    // Use the callback mapping data
    return handleFlowButtonWithData(
      callbackMapping.flowId,
      callbackMapping.nodeId,
      callbackMapping.btnId,
      callbackMapping.mode as 'continue' | 'goto_node' | 'goto_flow' | 'url' | 'none',
      user,
      chatId,
      messageId
    );
  }
  
  // Must start with "flow:" for legacy formats
  if (parts[0] !== 'flow') {
    return { handled: false };
  }
  
  let flowId: string | undefined;
  let nodeId: string | undefined;
  let btnId: string;
  let mode: 'continue' | 'goto_node' | 'goto_flow' | 'url' | 'none' = 'continue';
  
  // Parse based on format
  // Format 1 (current): flow:{nodeId}:btn:{btnId} - 4 parts
  // Format 2 (legacy): flow:{flowId}:node:{nodeId}:btn:{btnId}:{mode} - 7 parts
  if (parts.length === 4 && parts[2] === 'btn') {
    // Simple format: flow:{nodeId}:btn:{btnId}
    nodeId = parts[1];
    btnId = parts[3];
    
    logger.info('flow', {
      action: 'flow_button_simple_format',
      nodeId,
      btnId,
      chatId,
    });
  } else if (parts.length >= 6 && parts[2] === 'node' && parts[4] === 'btn') {
    // Full format: flow:{flowId}:node:{nodeId}:btn:{btnId}:{mode}
    flowId = parts[1];
    nodeId = parts[3];
    btnId = parts[5];
    mode = (parts[6] as typeof mode) || 'continue';
    
    logger.info('flow', {
      action: 'flow_button_full_format',
      flowId,
      nodeId,
      btnId,
      mode,
      chatId,
    });
  } else {
    logger.warn('flow', {
      action: 'flow_button_invalid_format',
      callbackData,
      parts: parts.length,
    });
    return { handled: false };
  }
  
  // Delegate to the common handler with parsed data
  return handleFlowButtonWithData(
    flowId,
    nodeId,
    btnId!,
    mode,
    user,
    chatId,
    messageId
  );
}

/**
 * Handle flow button with parsed data
 * Common logic for all callback formats (compact, simple, full)
 */
async function handleFlowButtonWithData(
  flowId: string | undefined,
  nodeId: string | undefined,
  btnId: string,
  mode: 'continue' | 'goto_node' | 'goto_flow' | 'url' | 'none',
  user: IUser,
  chatId: number,
  messageId: number
): Promise<{ handled: boolean; error?: string }> {
  // Build sessionId patterns to search
  const sessionId = `nosession-${chatId}`;
  
  // Check if there's an active support session
  const activeSession = await ChatSession.findOne({ 
    telegramChatId: chatId,
    status: { $in: ['queued', 'waiting', 'human'] }
  });
  
  const currentSessionId = activeSession?.sessionId || sessionId;
  
  // If we don't have flowId or nodeId is the fallback "node", find from execution
  if (!flowId || nodeId === 'node') {
    // Look for paused execution waiting for button click first
    let execution = await FlowExecution.findOne({
      sessionId: { $in: [sessionId, currentSessionId] },
      status: 'paused',
      waitingFor: 'button_click',
    }).sort({ updatedAt: -1 });
    
    // If no paused execution, look for any running/paused execution
    if (!execution) {
      execution = await FlowExecution.findOne({
        sessionId: { $in: [sessionId, currentSessionId] },
        status: { $in: ['running', 'paused'] },
      }).sort({ updatedAt: -1 });
    }
    
    if (execution) {
      flowId = execution.flowId.toString();
      // Use nodeId from execution if current nodeId is invalid
      if (execution.currentNodeId && (!nodeId || nodeId === 'node')) {
        nodeId = execution.currentNodeId;
      }
      
      logger.info('flow', {
        action: 'flow_button_found_execution',
        executionId: execution._id.toString(),
        flowId,
        nodeId,
        executionNodeId: execution.currentNodeId,
        chatId,
      });
    } else {
      // No active execution - try to find the flow by searching for the button ID
      // This handles cases where the callback data has nodeId='node' (legacy format)
      logger.info('flow', {
        action: 'flow_button_searching_by_btnId',
        chatId,
        btnId,
      });
      
      // Look for the most recent completed execution for this chat
      const recentExecution = await FlowExecution.findOne({
        sessionId: { $in: [sessionId, currentSessionId] },
      }).sort({ updatedAt: -1 });
      
      if (recentExecution) {
        flowId = recentExecution.flowId.toString();
        logger.info('flow', {
          action: 'flow_button_found_recent_execution',
          flowId,
          executionStatus: recentExecution.status,
          chatId,
        });
      } else {
        logger.warn('flow', {
          action: 'flow_button_no_execution',
          chatId,
          btnId,
        });
        return { handled: false, error: 'No active flow execution found' };
      }
    }
  }
  
  // Get the flow to find button configuration and mode
  const flow = await Flow.findById(flowId);
  if (!flow) {
    logger.warn('flow', { action: 'flow_not_found', flowId });
    return { handled: false, error: 'Flow not found' };
  }
  
  // Helper function to find button in all nodes
  const findButtonInFlow = (targetBtnId: string): { foundNode: any; foundButton: any } | null => {
    for (const node of flow.nodes) {
      const nodeConfig = node?.config as any;
      if (nodeConfig?.messageBlocks) {
        for (const block of nodeConfig.messageBlocks) {
          if (block.keyboard?.rows) {
            for (const row of block.keyboard.rows) {
              for (const button of row.buttons) {
                if (button.id === targetBtnId) {
                  return { foundNode: node, foundButton: button };
                }
              }
            }
          }
        }
      }
    }
    return null;
  };
  
  // Variable to store targetNodeId for goto_node mode
  let targetNodeId: string | undefined;
  
  // Find the node and button to get the mode
  // If nodeId is invalid ('node'), search for the button in all nodes
  if (!nodeId || nodeId === 'node') {
    const found = findButtonInFlow(btnId);
    if (found) {
      nodeId = found.foundNode.id;
      if (found.foundButton.onClick?.mode) {
        mode = found.foundButton.onClick.mode;
      }
      if (found.foundButton.onClick?.targetNodeId) {
        targetNodeId = found.foundButton.onClick.targetNodeId;
      }
      logger.info('flow', {
        action: 'flow_button_found_by_search',
        nodeId,
        btnId,
        mode,
        targetNodeId,
      });
    }
  } else {
    // nodeId is valid, search in specific node
    const node = flow.nodes.find(n => n.id === nodeId);
    const nodeConfig = node?.config as any;
    if (nodeConfig?.messageBlocks) {
      for (const block of nodeConfig.messageBlocks) {
        if (block.keyboard?.rows) {
          for (const row of block.keyboard.rows) {
            for (const button of row.buttons) {
              if (button.id === btnId && button.onClick) {
                if (button.onClick.mode) {
                  mode = button.onClick.mode;
                }
                if (button.onClick.targetNodeId) {
                  targetNodeId = button.onClick.targetNodeId;
                }
                break;
              }
            }
          }
        }
      }
    }
  }
  
  logger.info('flow', {
    action: 'flow_button_clicked',
    flowId,
    nodeId,
    btnId,
    mode,
    targetNodeId,
    chatId,
    userId: user.telegramId,
  });
  
  // Get full button onClick data from the flow
  let buttonClickData: any = {};
  const foundButtonResult = findButtonInFlow(btnId);
  if (foundButtonResult?.foundButton?.onClick) {
    buttonClickData = foundButtonResult.foundButton.onClick;
  }

  const event: TriggerEvent = {
    type: 'button_clicked',
    sessionId: currentSessionId,
    chatId,
    externalChatId: String(chatId),
    userId: user.telegramId,
    externalUserId: String(user.telegramId),
    channel: 'telegram', // Button clicks only come from Telegram for now
    data: {
      chatId,  // Include chatId for execution lookup fallback
      channel: 'telegram',
      button: {
        id: btnId,
        flowId,
        nodeId,
        mode,
        targetNodeId,  // Include targetNodeId in the event
        onClick: buttonClickData,  // Include full onClick data (includes messageMode, etc)
      },
      messageId,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        language: user.language,
        telegramId: user.telegramId,  // Include for execution lookup
      },
    },
  };
  
  try {
    // Handle based on mode
    if (mode === 'continue' || mode === 'goto_node') {
      // Resume or jump to specific node in the flow
      const resumed = await flowEngine.resumeFromButton(
        flowId!,
        nodeId!,
        btnId,
        mode,
        event.sessionId,
        event.data
      );
      
      if (!resumed) {
        // If no active execution and we have a target node, start fresh from that node
        if (mode === 'goto_node' && targetNodeId) {
          logger.info('flow', {
            action: 'flow_button_start_from_target',
            flowId,
            targetNodeId,
            sessionId: event.sessionId,
          });
          
          // Start a new execution from the target node
          await flowEngine.startFlowFromNode(
            flowId!,
            targetNodeId,
            event.sessionId,
            event.chatId,
            event.userId,
            event.data
          );
        } else {
          // If no active execution, trigger button_clicked event
          await flowEngine.handleTrigger(event);
        }
      }
      
      return { handled: true };
    } else if (mode === 'goto_flow') {
      // Start a new flow
      await flowEngine.handleTrigger(event);
      return { handled: true };
    } else if (mode === 'none') {
      // Just acknowledge, no flow action
      return { handled: true };
    }
    
    return { handled: false };
  } catch (error) {
    logger.error('flow', { 
      action: 'flow_button_error', 
      error: String(error),
      flowId,
      nodeId,
      btnId,
    });
    return { handled: false, error: String(error) };
  }
}

export default {
  triggerChatCreated,
  triggerMessageReceived,
  triggerKeywordDetected,
  triggerChatAssigned,
  triggerChatClosed,
  triggerUserInactive,
  triggerSurveyAnswered,
  triggerCategoryChanged,
  triggerTagAdded,
  triggerFileReceived,
  triggerAgentMessageSent,
  triggerFirstResponse,
  triggerBySessionId,
  triggerMessageReceivedNoSession,
  triggerKeywordDetectedNoSession,
  triggerCommandReceivedNoSession,
  triggerCommandReceived,
  handleFlowButtonCallback,
};

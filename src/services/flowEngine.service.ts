/**
 * Flow Engine Service - Executes automation flows
 * Deterministic, crash-tolerant, and scalable
 * 
 * Now with Redis caching for improved performance
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
  MessageBlock,
  KeyboardConfig,
  DataCollectionConfig,
} from '../database/models/Flow.js';
import FlowExecution, {
  IFlowExecution,
  ExecutionContext,
  ExecutionStep,
} from '../database/models/FlowExecution.js';
import { ChatSession } from '../database/models/ChatSession.js';
import { User } from '../database/models/User.js';
import { Agent } from '../database/models/Agent.js';
import { Tag, UserTag, Note } from '../database/index.js';
import {
  sendMessage,
  sendMessageWithId,
  sendPhoto,
  sendPhotoWithId,
  sendDocument,
  sendDocumentWithId,
  sendVoice,
  sendAudio,
  sendVideo,
  sendVideoWithId,
  editMessage,
  // New Telegram functions
  deleteMessage,
  editMessageReplyMarkup,
  pinChatMessage,
  unpinChatMessage,
  sendChatAction,
  sendLocation,
  sendContact,
  sendSticker,
  copyMessage,
  simulateTyping,
  buildReplyKeyboard,
  buildReplyKeyboardRemove,
  buildInlineKeyboard,
} from './telegram.js';
import { webChatAdapter } from '../channels/webchat.adapter.js';
import type { InlineKeyboardMarkup, ReplyKeyboardMarkup, ChatAction } from '../types/index.js';
import { logger } from './logger.js';
import { createScheduledMessage } from './scheduledMessage.service.js';
import { notifyNewSession, emitChatClosed } from './socket.js';
import {
  getOrCreateSession,
  transferToHuman,
  addMessage,
  getActiveSessionByTelegramChatId,
} from './chat.service.js';
import { startQueuedTimer } from './inactivity.service.js';
import { SYSTEM_USERS } from '../config/index.js';
import { setUserFieldByKey, getUserFieldByKey } from './customFields.service.js';
// Redis caching
import { FlowCache, CacheKeys, CacheTTL, getOrFetch } from './cache.js';
import { isRedisConnected } from './redis.js';
// Write-behind cache for FlowExecutions
import { FlowExecutionCache } from './cache-models.service.js';
// Text Registry for i18n text resolution
import { resolveText, getTextSync, type SupportedLanguage } from './text-registry.service.js';

// ============= TYPES =============

import type { ChannelType } from '../types/omnichannel.js';

export interface TriggerEvent {
  type: TriggerType;
  sessionId: string;
  chatId: number; // For telegram, or 0 for web
  externalChatId?: string; // Universal chat ID (works for all channels)
  userId: number; // For telegram, or 0 for web
  externalUserId?: string; // Universal user ID (visitorId for web)
  channel: ChannelType; // The channel this event originated from
  data: Record<string, any>;
  force?: boolean; // Si es true, ejecuta el flow aunque haya un agente activo
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

// ============= OMNICHANNEL MESSAGE ROUTING =============
// Helper functions to route messages to the correct channel

import { Message } from '../database/models/Message.js';

/**
 * Save a bot message to database for webchat
 */
async function saveBotMessageToDb(
  sessionId: string,
  content: string,
  contentType: string = 'text',
  mediaUrl?: string,
  replyMarkup?: any
): Promise<void> {
  try {
    const session = await ChatSession.findOne({ sessionId });
    if (!session) return;

    // Build message data
    const messageData: Record<string, any> = {
      session: session._id,
      channel: 'web',
      sender: 'bot',
      senderName: 'Bot',
      content,
      messageType: contentType,
      mediaUrl,
      externalMessageId: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      deliveryStatus: 'sent',
    };
    
    // Store keyboard data if present (for message history)
    if (replyMarkup) {
      const markup = replyMarkup as any;
      if (markup.inline_keyboard) {
        messageData.inlineKeyboard = markup.inline_keyboard;
      }
      if (markup.keyboard) {
        messageData.replyKeyboard = markup.keyboard;
      }
    }

    await Message.create(messageData);

    await ChatSession.updateOne(
      { _id: session._id },
      {
        lastMessage: content.substring(0, 100),
        lastMessageAt: new Date(),
      }
    );
  } catch (error) {
    logger.warn('flow', { action: 'save_bot_message_failed', sessionId, error: String(error) });
  }
}

/**
 * Send a text message to the appropriate channel
 * Returns message ID for telegram, or a timestamp for webchat
 */
async function sendMessageToChannel(
  ctx: ExecutionContext,
  content: string,
  options?: { replyMarkup?: any; parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML' }
): Promise<number | null> {
  if (ctx.channel === 'web') {
    // For webchat, use the webchat adapter
    // Pass replyMarkup to adapter for button support
    const result = await webChatAdapter.sendMessage(ctx.sessionId, content, {
      replyMarkup: options?.replyMarkup,
    });
    if (result.success) {
      // Also save to database (with keyboard data for history)
      await saveBotMessageToDb(ctx.sessionId, content, 'text', undefined, options?.replyMarkup);
      return Date.now(); // Return timestamp as pseudo message ID
    }
    return null;
  }
  
  // Default: Telegram
  return await sendMessageWithId(ctx.chatId, content, options);
}

/**
 * Send a photo/image to the appropriate channel
 */
async function sendPhotoToChannel(
  ctx: ExecutionContext,
  url: string,
  options?: { caption?: string; replyMarkup?: any; parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML' }
): Promise<number | null> {
  if (ctx.channel === 'web') {
    // For webchat, send as media
    const result = await webChatAdapter.sendMedia(ctx.sessionId, {
      type: 'image',
      url,
    }, { caption: options?.caption });
    if (result.success) {
      await saveBotMessageToDb(ctx.sessionId, options?.caption || '[Imagen]', 'image', url);
      return Date.now();
    }
    return null;
  }
  
  return await sendPhotoWithId(ctx.chatId, url, options);
}

/**
 * Send a document to the appropriate channel
 */
async function sendDocumentToChannel(
  ctx: ExecutionContext,
  url: string,
  options?: { caption?: string; fileName?: string; replyMarkup?: any; parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML' }
): Promise<number | null> {
  if (ctx.channel === 'web') {
    const result = await webChatAdapter.sendMedia(ctx.sessionId, {
      type: 'file',
      url,
      fileName: options?.fileName,
    }, { caption: options?.caption });
    if (result.success) {
      await saveBotMessageToDb(ctx.sessionId, options?.caption || '[Documento]', 'document', url);
      return Date.now();
    }
    return null;
  }
  
  return await sendDocumentWithId(ctx.chatId, url, options);
}

/**
 * Send a video to the appropriate channel
 */
async function sendVideoToChannel(
  ctx: ExecutionContext,
  url: string,
  options?: { caption?: string; replyMarkup?: any; parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML' }
): Promise<number | null> {
  if (ctx.channel === 'web') {
    const result = await webChatAdapter.sendMedia(ctx.sessionId, {
      type: 'video',
      url,
    }, { caption: options?.caption });
    if (result.success) {
      await saveBotMessageToDb(ctx.sessionId, options?.caption || '[Video]', 'video', url);
      return Date.now();
    }
    return null;
  }
  
  return await sendVideoWithId(ctx.chatId, url, options);
}

/**
 * Send audio/voice to the appropriate channel
 */
async function sendAudioToChannel(
  ctx: ExecutionContext,
  url: string,
  isVoice: boolean,
  options?: { replyMarkup?: any }
): Promise<boolean> {
  if (ctx.channel === 'web') {
    const messageType = isVoice ? 'voice' : 'audio';
    const result = await webChatAdapter.sendMedia(ctx.sessionId, {
      type: messageType,
      url,
    });
    if (result.success) {
      await saveBotMessageToDb(ctx.sessionId, `[${isVoice ? 'Nota de voz' : 'Audio'}]`, messageType, url);
    }
    return result.success;
  }
  
  if (isVoice) {
    return await sendVoice(ctx.chatId, url, options);
  }
  return await sendAudio(ctx.chatId, url, options);
}

// ============= CALLBACK DATA REGISTRY =============
// Telegram limits callback_data to 64 bytes
// We use short IDs and store full data in memory + Redis for persistence

import { getRedisClient } from './redis.js';

interface CallbackMapping {
  flowId: string;
  nodeId: string;
  btnId: string;
  mode: string;
  createdAt: number;
}

// In-memory callback registry (cache)
const callbackRegistry = new Map<string, CallbackMapping>();
const CALLBACK_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CALLBACK_TTL_SECONDS = 24 * 60 * 60; // 24 hours in seconds for Redis
const REDIS_CALLBACK_PREFIX = 'cb:';

// Generate short unique ID (8 chars, ~2.8 trillion combinations)
function generateShortId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Register callback and return short ID - stores in both memory and Redis
function registerCallback(flowId: string, nodeId: string, btnId: string, mode: string): string {
  const shortId = generateShortId();
  const mapping: CallbackMapping = {
    flowId,
    nodeId,
    btnId,
    mode,
    createdAt: Date.now(),
  };
  
  // Store in memory
  callbackRegistry.set(shortId, mapping);
  
  // Store in Redis asynchronously (don't await to avoid blocking)
  const redis = getRedisClient();
  if (redis) {
    redis.setex(
      `${REDIS_CALLBACK_PREFIX}${shortId}`,
      CALLBACK_TTL_SECONDS,
      JSON.stringify(mapping)
    ).catch(err => {
      logger.warn('flow', { action: 'callback_redis_store_failed', shortId, error: String(err) });
    });
  }
  
  return shortId;
}

// Get callback data from short ID - checks memory first, then Redis
export async function getCallbackDataAsync(shortId: string): Promise<CallbackMapping | null> {
  // Check memory first
  const memData = callbackRegistry.get(shortId);
  if (memData) {
    // Check if expired
    if (Date.now() - memData.createdAt > CALLBACK_TTL_MS) {
      callbackRegistry.delete(shortId);
      return null;
    }
    return memData;
  }
  
  // Try Redis
  const redis = getRedisClient();
  if (redis) {
    try {
      const redisData = await redis.get(`${REDIS_CALLBACK_PREFIX}${shortId}`);
      if (redisData) {
        const mapping: CallbackMapping = JSON.parse(redisData);
        // Cache in memory for future lookups
        callbackRegistry.set(shortId, mapping);
        return mapping;
      }
    } catch (err) {
      logger.warn('flow', { action: 'callback_redis_get_failed', shortId, error: String(err) });
    }
  }
  
  return null;
}

// Synchronous version for backward compatibility (memory only)
export function getCallbackData(shortId: string): CallbackMapping | null {
  const data = callbackRegistry.get(shortId);
  if (!data) return null;
  
  // Check if expired
  if (Date.now() - data.createdAt > CALLBACK_TTL_MS) {
    callbackRegistry.delete(shortId);
    return null;
  }
  
  return data;
}

// Cleanup expired callbacks from memory (Redis handles its own TTL)
function cleanupCallbacks(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of callbackRegistry.entries()) {
    if (now - value.createdAt > CALLBACK_TTL_MS) {
      callbackRegistry.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug('flow', { action: 'callback_cleanup', removed: cleaned, remaining: callbackRegistry.size });
  }
}

// Cleanup every hour
setInterval(cleanupCallbacks, 60 * 60 * 1000);

// ============= FLOW ENGINE CLASS =============

export class FlowEngine {
  private static instance: FlowEngine;
  private isRunning = false;
  private processingInterval: ReturnType<typeof setInterval> | null = null;

  private constructor() { }

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

  // ============= FLOW CACHING =============

  /**
   * Get flows by trigger type with Redis caching
   * Note: Excludes 'versions' field to reduce cache size
   */
  private async getFlowsByTrigger(triggerType: TriggerType): Promise<IFlow[]> {
    const cacheKey = CacheKeys.flowByTrigger(triggerType);
    
    if (isRedisConnected()) {
      const flows = await getOrFetch<IFlow[]>(
        cacheKey,
        async () => {
          const flowDocs = await Flow.find({
            enabled: true,
            status: 'published',
            triggers: triggerType,
          })
            .select('-versions') // Exclude versions to save space
            .sort({ priority: -1 })
            .lean();
          return flowDocs as unknown as IFlow[];
        },
        { ttl: CacheTTL.FLOW }
      );
      return flows;
    }

    // Fallback to direct DB query
    return Flow.find({
      enabled: true,
      status: 'published',
      triggers: triggerType,
    })
      .select('-versions')
      .sort({ priority: -1 });
  }

  /**
   * Get a single flow by ID with caching
   * Note: Excludes 'versions' field to reduce cache size
   */
  private async getFlowById(flowId: string): Promise<IFlow | null> {
    const cacheKey = CacheKeys.flow(flowId);
    
    if (isRedisConnected()) {
      const flow = await getOrFetch<IFlow | null>(
        cacheKey,
        async () => {
          const flowDoc = await Flow.findById(flowId)
            .select('-versions') // Exclude versions to save space
            .lean();
          return flowDoc as unknown as IFlow | null;
        },
        { ttl: CacheTTL.FLOW }
      );
      return flow;
    }

    // Fallback to direct DB query
    return Flow.findById(flowId).select('-versions');
  }

  // ============= TRIGGER HANDLING =============

  /**
   * Handle an incoming trigger event
   */
  async handleTrigger(event: TriggerEvent): Promise<void> {
    // Always log trigger events to track flow engine activity
    logger.info('flow', {
      action: 'trigger_received',
      type: event.type,
      sessionId: event.sessionId,
      chatId: event.chatId,
    });

    // Find all enabled flows that match this trigger (with caching)
    const flows = await this.getFlowsByTrigger(event.type);

    logger.info('flow', {
      action: 'flows_matched',
      type: event.type,
      matchedCount: flows.length,
      flowIds: flows.map(f => f._id.toString()),
    });

    if (flows.length === 0) {
      logger.info('flow', { action: 'no_matching_flows', type: event.type });
      return;
    }

    // Check if there's already an active execution for this session
    const activeExecutions = await FlowExecution.find({
      sessionId: event.sessionId,
      status: { $in: ['running', 'paused'] },
    });

    // Get session and user/visitor data for context
    const isNoSession = event.sessionId.startsWith('nosession-');
    const session = isNoSession ? null : await ChatSession.findOne({ sessionId: event.sessionId });
    
    // Handle different channels for user data
    let userData: {
      id: number | string;
      firstName: string;
      lastName?: string;
      username?: string;
      language: string;
      email?: string;
      phone?: string;
      visitorId?: string;
    } | null = null;
    
    if (event.channel === 'web') {
      // For WebChat, get user data from the event.data.user (populated by trigger)
      // WebVisitors don't have a User record - their data comes from the trigger event
      if (event.data?.user) {
        userData = {
          id: event.externalUserId || 0,
          firstName: event.data.user.firstName || 'Web Visitor',
          lastName: event.data.user.lastName || '',
          username: event.data.user.username || event.data.user.email || '',
          language: event.data.user.language || 'es',
          email: event.data.user.email,
          phone: event.data.user.phone,
          visitorId: event.data.user.visitorId || event.externalUserId,
        };
      } else {
        // Fallback: create minimal user data from event
        userData = {
          id: event.externalUserId || 0,
          firstName: 'Web Visitor',
          language: 'es',
          visitorId: event.externalUserId,
        };
      }
      
      logger.info('flow', {
        action: 'web_user_data_resolved',
        sessionId: event.sessionId,
        visitorId: userData.visitorId,
        firstName: userData.firstName,
      });
    } else {
      // For Telegram/other channels, get User from database
      const user = await User.findOne({ telegramId: event.userId });
      if (user) {
        userData = {
          id: user.telegramId,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          language: user.language,
        };
      }
    }

    // For Telegram no-session triggers, we need user data
    // For WebChat, we always have user data from the event
    if (!userData && event.channel !== 'web') {
      logger.warn('flow', { action: 'missing_user', sessionId: event.sessionId, userId: event.userId, channel: event.channel });
      return;
    }
    
    // Ensure we have user data for all channels
    if (!userData) {
      logger.warn('flow', { action: 'missing_user_data', sessionId: event.sessionId, channel: event.channel });
      return;
    }

    // For session-based triggers, we need session (but NOT for webchat initial triggers)
    if (!isNoSession && !session && event.channel !== 'web') {
      logger.warn('flow', { action: 'missing_session', sessionId: event.sessionId });
      return;
    }

    // ============= BLOCK FLOWS WHEN AGENT IS ACTIVE =============
    // Si hay una sesión activa con agente (status 'human' o 'waiting'), 
    // no ejecutar flows automáticos a menos que sea forzado desde el dashboard
    if (!event.force && session) {
      const blockedStatuses = ['human', 'waiting'];
      if (blockedStatuses.includes(session.status)) {
        logger.info('flow', {
          action: 'flow_blocked_agent_active',
          sessionId: event.sessionId,
          sessionStatus: session.status,
          hasAssignedAgent: !!session.assignedAgent,
          message: 'Flow execution blocked while chat is with agent. Use force=true to override.',
        });
        return;
      }
    }

    // Build execution context
    const context: ExecutionContext = {
      triggerType: event.type,
      triggerData: event.data,
      sessionId: event.sessionId,
      chatId: event.chatId,
      userId: event.userId,
      channel: event.channel, // Add channel for omnichannel message routing
      user: {
        id: typeof userData.id === 'number' ? userData.id : 0,
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username,
        language: userData.language,
        // Include web-specific fields
        ...(userData.visitorId && { visitorId: userData.visitorId }),
        ...(userData.email && { email: userData.email }),
        ...(userData.phone && { phone: userData.phone }),
      },
      variables: {},
      customFields: event.data?.user?.customFields || {}, // Load custom fields from event data
      startedAt: new Date(),
      lastActiveAt: new Date(),
    };

    // Add agent data if assigned (only for session-based)
    if (session?.assignedAgent) {
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
        id: event.data.message._id?.toString() || event.data.message.messageId?.toString() || '',
        content: event.data.message.content || '',
        type: event.data.message.messageType || 'text',
      };
      // Only add mediaUrl if it exists
      if (event.data.message.mediaUrl) {
        context.message.mediaUrl = event.data.message.mediaUrl;
      }
    }

    // Add command data if command trigger
    if (event.type === 'command_received' && event.data.command) {
      (context as any).command = {
        name: event.data.command.name,
        param: event.data.command.param || '',
        fullText: event.data.command.fullText || '',
      };
    }

    // Execute matching flows
    for (const flow of flows) {
      // Skip if flow is already running for this session
      if (activeExecutions.some(e => e.flowId.toString() === flow._id.toString())) {
        logger.info('flow', {
          action: 'flow_already_running',
          flowId: flow._id.toString(),
          flowName: flow.name,
          sessionId: event.sessionId,
        });
        continue;
      }

      // Check if trigger node matches conditions
      const triggerNode = flow.nodes.find(n => n.type === 'trigger');
      if (!triggerNode) {
        logger.warn('flow', {
          action: 'no_trigger_node',
          flowId: flow._id.toString(),
          flowName: flow.name,
        });
        continue;
      }

      const configMatches = this.matchesTriggerConfig(triggerNode.config as TriggerConfig, event);
      logger.info('flow', {
        action: 'trigger_config_check',
        flowId: flow._id.toString(),
        flowName: flow.name,
        triggerType: (triggerNode.config as TriggerConfig).triggerType,
        matches: configMatches,
        triggerConfig: JSON.stringify(triggerNode.config),
      });

      if (!configMatches) {
        continue;
      }

      // For command triggers, save command and param to variables if configured
      const triggerConf = triggerNode.config as TriggerConfig;
      if (event.type === 'command_received') {
        // Save command name
        if (triggerConf.saveCommandTo && event.data.command?.name) {
          context.variables[triggerConf.saveCommandTo] = event.data.command.name;
          logger.info('flow', {
            action: 'command_name_saved',
            variableName: triggerConf.saveCommandTo,
            value: event.data.command.name,
          });
        }
        // Save param
        if (triggerConf.saveParamTo && event.data.command?.param) {
          context.variables[triggerConf.saveParamTo] = event.data.command.param;
          logger.info('flow', {
            action: 'command_param_saved',
            variableName: triggerConf.saveParamTo,
            value: event.data.command.param,
          });
        }
      }

      // Create execution
      logger.info('flow', {
        action: 'starting_execution',
        flowId: flow._id.toString(),
        flowName: flow.name,
        triggerNodeId: triggerNode.id,
        nodesCount: flow.nodes.length,
        edgesCount: flow.edges.length,
      });
      await this.startExecution(flow, context, triggerNode.id);
    }
  }

  /**
   * Check if event matches trigger configuration
   */
  private matchesTriggerConfig(config: TriggerConfig, event: TriggerEvent): boolean {
    if (config.triggerType !== event.type) return false;

    // === OMNICHANNEL: Check channel filter ===
    if (config.channelFilter && config.channelFilter.length > 0) {
      if (!config.channelFilter.includes(event.channel)) return false;
    }

    switch (event.type) {
      case 'command_received':
        // Command must match
        if (!config.command) return false;
        const cmdName = event.data.command?.name?.toLowerCase() || '';
        if (cmdName !== config.command.toLowerCase()) return false;
        
        // Check param matching if configured
        if (config.commandParamMatch && config.commandParamMatch !== 'any') {
          const param = event.data.command?.param || '';
          const expectedParam = config.commandParam || '';
          
          switch (config.commandParamMatch) {
            case 'exact':
              if (param !== expectedParam) return false;
              break;
            case 'contains':
              if (expectedParam && !param.includes(expectedParam)) return false;
              break;
            case 'regex':
              if (expectedParam && !new RegExp(expectedParam, 'i').test(param)) return false;
              break;
          }
        }
        break;

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
    // Create via cache (writes to DB and caches in Redis)
    const execution = await FlowExecutionCache.create({
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

    logger.info('flow', {
      action: 'executeFromNode_start',
      executionId: execution._id.toString(),
      nodeId,
      variables: JSON.stringify(execution.context.variables),
    });

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
          // Calculate next node if not provided (for wait_for_response, delays, etc.)
          const nextNode = result.nextNodeId || this.getNextNode(flow, node.id, result.output);
          execution.nextNodeId = nextNode || null;
          await execution.save();
          logger.info('flow', {
            action: 'execution_paused',
            executionId: execution._id.toString(),
            pauseFor: result.pauseFor,
            nextNodeId: execution.nextNodeId,
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

        // Check if we've reached the end or need to wait for button click
        if (!currentNodeId) {
          // Check if there are button edges - if so, pause instead of completing
          const buttonEdges = flow.edges.filter(e =>
            e.source === node.id && e.sourceHandle?.startsWith('btn-')
          );

          if (buttonEdges.length > 0) {
            // Pause execution waiting for button click
            execution.pause('button_click');
            execution.currentNodeId = node.id; // Store the node with buttons
            await execution.save();

            logger.info('flow', {
              action: 'execution_paused_for_buttons',
              executionId: execution._id.toString(),
              nodeId: node.id,
              buttonEdgesCount: buttonEdges.length,
            });
          } else {
            // No more nodes and no button edges - complete
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
          }
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
   * Supports: user.language, user.firstName, customFields.fieldName, variables.varName, etc.
   */
  private resolveField(field: string, context: ExecutionContext): any {
    const parts = field.split('.');
    let value: any = context;

    // Handle special field aliases
    if (parts[0] === 'customFields' || parts[0] === 'custom') {
      // Custom fields are stored in variables
      if (parts.length > 1) {
        const fieldName = parts.slice(1).join('.');
        return context.variables?.[fieldName];
      }
      return context.variables;
    }

    // Handle language shorthand
    if (field === 'language' || field === 'lang') {
      return context.user?.language;
    }

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
    const userFlowId = SYSTEM_USERS.FLOW_USER_ID;

    logger.info('flow', {
      action: 'executing_action',
      nodeId: node.id,
      nodeLabel: node.label,
      actionType: config.actionType,
      executionId: execution._id.toString(),
      chatId: ctx.chatId,
      sessionId: ctx.sessionId,
      isTemporarySession: ctx.sessionId?.startsWith('nosession-'),
    });

    switch (config.actionType) {
      case 'send_message': {
        return await this.executeSendMessage(config, ctx, execution, node.id);
      }

      case 'schedule_message': {
        return await this.executeScheduleMessage(config, ctx);
      }

      case 'transfer_chat': {
        // Si es una sesión temporal (nosession-*), crear sesión real
        let session: any = null;

        if (ctx.sessionId.startsWith('nosession-')) {
          // Buscar o crear usuario (User usa telegramId, no telegramChatId)
          let user = await User.findOne({ telegramId: ctx.userId });
          if (!user) {
            user = await User.create({
              telegramId: ctx.userId,
              firstName: ctx.user?.firstName || 'Usuario',
              username: ctx.user?.username,
              language: ctx.user?.language || 'es',
            });
          }
          // Crear sesión real
          session = await getOrCreateSession(user, ctx.chatId);
          // Actualizar contexto con sessionId real
          ctx.sessionId = session.sessionId;
        }

        // Poner en cola (status: 'waiting') - el agente debe aceptar
        // Si hay targetAgentId, asignamos pero sigue en 'waiting' para que pueda aceptar
        const updateData: any = {
          status: 'waiting', // Siempre 'waiting' para que entre en cola
          escalatedAt: new Date(),
        };

        if (config.targetAgentId) {
          // Asignar al agente específico, pero sigue en cola hasta que acepte
          updateData.assignedAgent = new Types.ObjectId(config.targetAgentId);
        }

        await ChatSession.updateOne(
          { sessionId: ctx.sessionId },
          { $set: updateData }
        );

        // Start inactivity timer for queued session
        await startQueuedTimer(ctx.sessionId, ctx.chatId);

        // Notificar al dashboard
        const transferredSession = await ChatSession.findOne({ sessionId: ctx.sessionId }).populate('user');
        if (transferredSession) {
          await notifyNewSession(transferredSession);
        }

        logger.info('flow', {
          action: 'chat_transferred',
          sessionId: ctx.sessionId,
          targetAgentId: config.targetAgentId || 'queue',
          status: 'waiting',
        });

        return { success: true };
      }

      case 'assign_agent': {
        // Handle webchat channel - session already exists
        if (ctx.channel === 'web') {
          // For webchat, the session already exists, just transfer to human
          if (config.targetAgentId) {
            await ChatSession.updateOne(
              { sessionId: ctx.sessionId },
              {
                $set: {
                  assignedAgent: new Types.ObjectId(config.targetAgentId),
                  status: 'waiting', // Go to waiting so agent can accept
                  escalatedAt: new Date(),
                },
              }
            );
          } else {
            await transferToHuman(ctx.sessionId);
          }

          // Notify dashboard - for webchat, get session directly by sessionId
          const webSession = await ChatSession.findOne({ sessionId: ctx.sessionId })
            .populate('webVisitor')
            .populate('assignedAgent');
          if (webSession) {
            await notifyNewSession(webSession);
          }

          logger.info('flow', {
            action: 'webchat_agent_assigned',
            sessionId: ctx.sessionId,
            targetAgentId: config.targetAgentId || 'queue',
            channel: 'web',
          });

          return { success: true };
        }

        // === TELEGRAM FLOW ===
        // Si es una sesión temporal (nosession-*), crear sesión real
        // Replicamos exactamente el flujo de handleHumanConfirm

        if (ctx.sessionId.startsWith('nosession-')) {
          // Buscar o crear usuario (User usa telegramId, no telegramChatId)
          let user = await User.findOne({ telegramId: ctx.userId });
          if (!user) {
            user = await User.create({
              telegramId: ctx.userId,
              firstName: ctx.user?.firstName || 'Usuario',
              username: ctx.user?.username,
              language: ctx.user?.language || 'es',
            });
          }

          // 1. Crear sesión real (igual que handleHumanConfirm)
          const session = await getOrCreateSession(user, ctx.chatId);
          const oldSessionId = ctx.sessionId;
          ctx.sessionId = session.sessionId;
          
          // IMPORTANT: Also update execution.sessionId so future button clicks can find this execution
          execution.sessionId = session.sessionId;
          execution.markModified('sessionId');

          logger.info('flow', {
            action: 'session_created_for_escalation',
            oldSessionId,
            newSessionId: session.sessionId,
            chatId: ctx.chatId,
            executionUpdated: true,
          });

          // 2. Transfer to waiting (igual que handleHumanConfirm)
          await transferToHuman(session.sessionId);

          // 3. Start inactivity timer
          await startQueuedTimer(session.sessionId, ctx.chatId);

          // 4. Add system message
          await addMessage(session.sessionId, 'bot', 'User requested human support via flow automation', {
            messageType: 'system',
          });

          // 5. Notify dashboard (usando getActiveSessionByTelegramChatId como handleHumanConfirm)
          const updatedSession = await getActiveSessionByTelegramChatId(ctx.chatId);
          if (updatedSession) {
            await notifyNewSession(updatedSession);
          }

          logger.info('flow', {
            action: 'agent_assigned',
            sessionId: ctx.sessionId,
            targetAgentId: config.targetAgentId || 'queue',
          });

          return { success: true };
        }

        // Si ya tiene sesión real, usar el flujo normal
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
        } else {
          // Sin agente específico: transfer to waiting
          await transferToHuman(ctx.sessionId);
        }

        // Notificar al dashboard
        const assignedSession = await getActiveSessionByTelegramChatId(ctx.chatId);
        if (assignedSession) {
          await notifyNewSession(assignedSession);
        }

        logger.info('flow', {
          action: 'agent_assigned',
          sessionId: ctx.sessionId,
          targetAgentId: config.targetAgentId || 'queue',
        });

        return { success: true };
      }

      case 'change_category': {
        // Si es una sesión temporal (nosession-*), crear sesión real primero
        if (ctx.sessionId.startsWith('nosession-')) {
          let user = await User.findOne({ telegramId: ctx.userId });
          if (!user) {
            user = await User.create({
              telegramId: ctx.userId,
              firstName: ctx.user?.firstName || 'Usuario',
              username: ctx.user?.username,
              language: ctx.user?.language || 'es',
            });
          }
          const session = await getOrCreateSession(user, ctx.chatId);
          ctx.sessionId = session.sessionId;
        }

        await ChatSession.updateOne(
          { sessionId: ctx.sessionId },
          { $set: { category: config.categoryName } }
        );
        return { success: true };
      }

      case 'add_tag': {
        // Obtener o crear el usuario primero
        let user = await User.findOne({ telegramId: ctx.userId });
        if (!user) {
          user = await User.create({
            telegramId: ctx.userId,
            firstName: ctx.user?.firstName || 'Usuario',
            username: ctx.user?.username,
            language: ctx.user?.language || 'es',
          });
        }

        // Si es una sesión temporal (nosession-*), crear sesión real
        if (ctx.sessionId.startsWith('nosession-')) {
          const session = await getOrCreateSession(user, ctx.chatId);
          const oldSessionId = ctx.sessionId;
          ctx.sessionId = session.sessionId;
          execution.context.sessionId = session.sessionId;
          execution.markModified('context');

          logger.info('flow', {
            action: 'session_created_for_tag',
            oldSessionId,
            newSessionId: session.sessionId,
            tag: config.tagName,
            userId: ctx.userId,
          });
        }

        // Buscar o crear el tag por nombre
        let tag = await Tag.findOne({ name: config.tagName });
        if (!tag) {
          // Buscar un agente para usarlo como creador (preferir admin)

          if (!userFlowId) {
            logger.error('flow', {
              action: 'add_tag_no_agent',
              message: 'No agents found in system to create tag',
            });
            return { success: false, error: 'No agents available to create tag' };
          }

          // Crear el tag con el color configurado o un color por defecto
          tag = await Tag.create({
            name: config.tagName,
            color: config.tagColor || '#3B82F6',
            description: `Created by flow automation`,
            createdBy: userFlowId,
          });

          logger.info('flow', {
            action: 'tag_created',
            tagName: config.tagName,
            tagId: tag._id?.toString(),
            createdBy: userFlowId,
          });
        }

      
        // Crear la relación UserTag (ignorar si ya existe)
        try {
          await UserTag.create({
            user: user._id,
            tag: tag._id,
            addedBy: userFlowId,
            createdBy: userFlowId,
          });

          // Incrementar contador de uso
          await Tag.findByIdAndUpdate(tag._id, { $inc: { usageCount: 1 } });

          logger.info('flow', {
            action: 'add_tag_success',
            userId: user._id?.toString(),
            tagId: tag._id?.toString(),
            tagName: config.tagName,
          });
        } catch (err: any) {
          // Error 11000 = duplicado, el tag ya existe para este usuario
          if (err.code === 11000) {
            logger.info('flow', {
              action: 'add_tag_already_exists',
              userId: user._id?.toString(),
              tagName: config.tagName,
            });
          } else {
            throw err;
          }
        }

        return { success: true };
      }

      case 'remove_tag': {
        // Obtener usuario
        const userForRemove = await User.findOne({ telegramId: ctx.userId });
        if (!userForRemove) {
          return { success: true }; // No hay usuario, nada que remover
        }

        // Buscar el tag
        const tagToRemove = await Tag.findOne({ name: config.tagName });
        if (!tagToRemove) {
          return { success: true }; // No existe el tag
        }

        // Eliminar la relación
        const removeResult = await UserTag.deleteOne({
          user: userForRemove._id,
          tag: tagToRemove._id,
        });

        if (removeResult.deletedCount > 0) {
          await Tag.findByIdAndUpdate(tagToRemove._id, { $inc: { usageCount: -1 } });
        }

        return { success: true };
      }

      case 'create_note': {
        // Obtener o crear el usuario primero
        let user = await User.findOne({ telegramId: ctx.userId });
        if (!user) {
          user = await User.create({
            telegramId: ctx.userId,
            firstName: ctx.user?.firstName || 'Usuario',
            username: ctx.user?.username,
            language: ctx.user?.language || 'es',
          });
        }

        // Si es una sesión temporal (nosession-*), crear sesión real
        let sessionObjectId: Types.ObjectId | undefined;
        if (ctx.sessionId.startsWith('nosession-')) {
          const session = await getOrCreateSession(user, ctx.chatId);
          const oldSessionId = ctx.sessionId;
          ctx.sessionId = session.sessionId;
          execution.context.sessionId = session.sessionId;
          execution.markModified('context');
          sessionObjectId = session._id as Types.ObjectId;

          logger.info('flow', {
            action: 'session_created_for_note',
            oldSessionId,
            newSessionId: session.sessionId,
            userId: ctx.userId,
          });
        } else {
          // Obtener el ObjectId de la sesión existente
          const existingSession = await ChatSession.findOne({ sessionId: ctx.sessionId }).select('_id');
          sessionObjectId = existingSession?._id as Types.ObjectId | undefined;
        }

        const noteContent = this.resolvePlaceholders(config.noteContent || '', ctx);
       
        // Crear la nota en la colección Note
        const note = await Note.create({
          user: user._id,
          session: sessionObjectId,
          content: noteContent,
          createdBy: userFlowId,
          // No hay agente en automatización, dejamos createdBy vacío o usamos un sistema
        });

        logger.info('flow', {
          action: 'create_note_success',
          noteId: note._id?.toString(),
          userId: user._id?.toString(),
          sessionId: ctx.sessionId,
          content: noteContent,
        });

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

      case 'api_call': {
        return await this.executeApiCall(config, ctx, execution);
      }

      case 'set_custom_field': {
        const fieldKey = config.customFieldName || '';
        const resolvedValue = this.resolvePlaceholders(config.customFieldValue || '', ctx);
        
        // Store in execution context variables (for backward compatibility)
        execution.context.variables[fieldKey] = resolvedValue;
        
        // IMPORTANT: Also update ctx.customFields for i18n resolution within the same flow execution
        if (!ctx.customFields) {
          ctx.customFields = {};
        }
        ctx.customFields[fieldKey] = resolvedValue;
        execution.context.customFields = ctx.customFields;

        // Find user by telegramId and set the custom field using the new service
        const user = await User.findOne({ telegramId: ctx.userId });
        if (user) {
          // Convert value type based on content
          let typedValue: string | number | boolean = resolvedValue;
          if (resolvedValue === 'true') typedValue = true;
          else if (resolvedValue === 'false') typedValue = false;
          else if (!isNaN(Number(resolvedValue)) && resolvedValue !== '') typedValue = Number(resolvedValue);
          
          await setUserFieldByKey(user._id!.toString(), fieldKey, typedValue);
          
          logger.info('flow', {
            action: 'custom_field_set',
            fieldKey,
            resolvedValue,
            userId: ctx.userId,
          });
        }
        
        return { success: true };
      }

      case 'close_chat': {
        // Close the chat session
        logger.info('flow', {
          action: 'close_chat_attempting',
          sessionId: ctx.sessionId,
          chatId: ctx.chatId,
        });
        
        // First try by sessionId, then by telegramChatId (for cases where sessionId is temporary)
        let closeResult = await ChatSession.findOneAndUpdate(
          { sessionId: ctx.sessionId },
          {
            $set: {
              status: 'closed',
              closedAt: new Date(),
              closedByType: 'system',
              closeReason: 'automation',
            },
          },
          { new: true }
        ).populate('user');
        
        logger.info('flow', {
          action: 'close_chat_first_attempt',
          foundBySessionId: !!closeResult,
          sessionId: ctx.sessionId,
        });
        
        // If no session found by sessionId (maybe it's a temporary nosession-xxx),
        // try to find by telegramChatId
        if (!closeResult && ctx.chatId) {
          // First, let's see what sessions exist for this chatId
          const existingSessions = await ChatSession.find({
            telegramChatId: ctx.chatId,
            status: { $in: ['queued', 'waiting', 'human', 'bot'] }
          }).select('sessionId status createdAt');
          
          logger.info('flow', {
            action: 'close_chat_searching_by_chatId',
            chatId: ctx.chatId,
            existingSessions: existingSessions.map(s => ({ 
              sessionId: s.sessionId, 
              status: s.status 
            })),
          });
          
          closeResult = await ChatSession.findOneAndUpdate(
            { 
              telegramChatId: ctx.chatId,
              status: { $in: ['queued', 'waiting', 'human', 'bot'] }
            },
            {
              $set: {
                status: 'closed',
                closedAt: new Date(),
                closedByType: 'system',
                closeReason: 'automation',
              },
            },
            { new: true }
          ).populate('user');
          
          if (closeResult) {
            logger.info('flow', {
              action: 'close_chat_found_by_chatId',
              chatId: ctx.chatId,
              sessionId: closeResult.sessionId,
            });
          }
        }
        
        // Emit WebSocket events for real-time dashboard update
        if (closeResult) {
          // Cancel any pending scheduled messages
          try {
            const { autoCancelSessionMessages } = await import('./scheduledMessage.service.js');
            await autoCancelSessionMessages(closeResult.sessionId, 'Session closed by automation');
          } catch (e) {
            logger.warn('flow', { action: 'cancel_scheduled_messages_failed', error: String(e) });
          }
          
          emitChatClosed(closeResult.sessionId, 'Closed by automation', 'automation');
          
          logger.info('flow', {
            action: 'close_chat_success',
            sessionId: closeResult.sessionId,
            chatId: ctx.chatId,
          });
          
          // Optionally send a confirmation message to user
          if ((config as any).closeMessage) {
            const closeMsg = this.resolvePlaceholders((config as any).closeMessage, ctx);
            await sendMessage(ctx.chatId, closeMsg);
          }
        } else {
          logger.warn('flow', {
            action: 'close_chat_no_session_found',
            sessionId: ctx.sessionId,
            chatId: ctx.chatId,
          });
        }
        
        return { success: !!closeResult };
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

        // Notificar al dashboard
        const queuedSession = await ChatSession.findOne({ sessionId: ctx.sessionId }).populate('user');
        if (queuedSession) {
          await notifyNewSession(queuedSession);
        }

        logger.info('flow', {
          action: 'added_to_queue',
          sessionId: ctx.sessionId,
          priority: config.queuePriority || 'normal',
        });

        return { success: true };
      }

      case 'wait_for_response': {
        // Data collection: send question, pause flow, wait for user response
        return await this.executeWaitForResponse(config, ctx, execution);
      }

      // ============= NEW TELEGRAM ACTIONS =============

      case 'edit_message': {
        return await this.executeEditMessage(config, ctx, execution);
      }

      case 'delete_message': {
        return await this.executeDeleteMessage(config, ctx, execution);
      }

      case 'edit_keyboard': {
        return await this.executeEditKeyboard(config, ctx, execution);
      }

      case 'remove_keyboard': {
        return await this.executeRemoveKeyboard(config, ctx, execution);
      }

      case 'send_reply_keyboard': {
        return await this.executeSendReplyKeyboard(config, ctx, execution);
      }

      case 'remove_reply_keyboard': {
        return await this.executeRemoveReplyKeyboard(config, ctx, execution);
      }

      case 'send_chat_action': {
        return await this.executeSendChatAction(config, ctx, execution);
      }

      case 'pin_message': {
        return await this.executePinMessage(config, ctx, execution);
      }

      case 'unpin_message': {
        return await this.executeUnpinMessage(config, ctx, execution);
      }

      case 'save_message_id': {
        return this.executeSaveMessageId(config, ctx, execution);
      }

      case 'delay_action': {
        return await this.executeDelayAction(config, ctx, execution);
      }

      case 'send_location': {
        return await this.executeSendLocation(config, ctx, execution);
      }

      case 'send_contact': {
        return await this.executeSendContact(config, ctx, execution);
      }

      case 'send_sticker': {
        return await this.executeSendSticker(config, ctx, execution);
      }

      case 'copy_message': {
        return await this.executeCopyMessage(config, ctx, execution);
      }

      case 'run_subflow': {
        return await this.executeRunSubflow(config, ctx, execution);
      }

      default:
        return { success: false, error: `Unknown action type: ${config.actionType}` };
    }
  }

  /**
   * Execute wait_for_response action (Data Collection)
   */
  private async executeWaitForResponse(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const dc = config.dataCollection;
    if (!dc) {
      return { success: false, error: 'No data collection config' };
    }

    // Send the question
    const question = this.resolvePlaceholders(dc.question, ctx);
    await sendMessage(ctx.chatId, question);

    logger.info('flow', {
      action: 'wait_for_response_started',
      variableName: dc.variableName,
      validationType: dc.validationType,
      expiresInMinutes: dc.expiresInMinutes,
    });

    // Store data collection context for validation
    execution.context.variables._dataCollection = {
      variableName: dc.variableName,
      validationType: dc.validationType,
      required: dc.required,
      minLength: dc.minLength,
      maxLength: dc.maxLength,
      pattern: dc.pattern,
      choices: dc.choices,
      retryCount: 0,
      maxRetries: dc.maxRetries || 3,
      errorMessage: dc.errorMessage,
    };

    // Mark as modified so Mongoose persists the nested changes in Mixed type
    execution.markModified('context');
    execution.markModified('context.variables');

    logger.info('flow', {
      action: 'data_collection_config_stored',
      variableName: dc.variableName,
      variables: JSON.stringify(execution.context.variables),
    });

    // Calculate expiration time
    const expiresAt = dc.expiresInMinutes
      ? new Date(Date.now() + dc.expiresInMinutes * 60 * 1000)
      : undefined;

    return {
      success: true,
      shouldPause: true,
      pauseFor: 'response',
      pauseUntil: expiresAt,
    };
  }

  /**
   * Execute api_call action - Advanced HTTP request with retry, timeout, variable extraction
   */
  private async executeApiCall(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const apiConfig = config.apiCallConfig;
    if (!apiConfig || !apiConfig.url) {
      return { success: false, error: 'API Call config or URL is missing' };
    }

    const {
      method = 'GET',
      url,
      headers = [],
      queryParams = [],
      bodyType = 'none',
      body = '',
      authType = 'none',
      authConfig = {},
      timeout = 30,
      retryCount = 0,
      retryDelay = 5,
      successCodes = [200, 201, 204],
      extractVariables = [],
      onError = 'continue',
      errorNodeId,
      saveErrorTo,
      saveResponseTo,
      saveStatusCodeTo,
    } = apiConfig;

    // Resolve URL with placeholders
    let resolvedUrl = this.resolvePlaceholders(url, ctx);

    // Add query params
    const enabledParams = queryParams.filter((p: any) => p.enabled && p.key);
    if (enabledParams.length > 0) {
      const params = new URLSearchParams();
      enabledParams.forEach((p: any) => {
        params.append(p.key, this.resolvePlaceholders(p.value, ctx));
      });
      // Add API key to query if configured
      if (authType === 'api-key' && authConfig.apiKeyLocation === 'query' && authConfig.apiKeyName) {
        params.append(authConfig.apiKeyName, this.resolvePlaceholders(authConfig.apiKeyValue || '', ctx));
      }
      resolvedUrl += (resolvedUrl.includes('?') ? '&' : '?') + params.toString();
    }

    // Build headers
    const requestHeaders: Record<string, string> = {};
    headers.filter((h: any) => h.enabled && h.key).forEach((h: any) => {
      requestHeaders[h.key] = this.resolvePlaceholders(h.value, ctx);
    });

    // Add auth headers
    if (authType === 'bearer' && authConfig.bearerToken) {
      const token = this.resolvePlaceholders(authConfig.bearerToken, ctx);
      requestHeaders['Authorization'] = `Bearer ${token}`;
    } else if (authType === 'basic' && authConfig.basicUsername) {
      const username = this.resolvePlaceholders(authConfig.basicUsername, ctx);
      const password = this.resolvePlaceholders(authConfig.basicPassword || '', ctx);
      const credentials = Buffer.from(`${username}:${password}`).toString('base64');
      requestHeaders['Authorization'] = `Basic ${credentials}`;
    } else if (authType === 'api-key' && authConfig.apiKeyName && authConfig.apiKeyLocation === 'header') {
      const keyValue = this.resolvePlaceholders(authConfig.apiKeyValue || '', ctx);
      requestHeaders[authConfig.apiKeyName] = keyValue;
    }

    // Set content type for body
    if (bodyType === 'json') {
      requestHeaders['Content-Type'] = 'application/json';
    } else if (bodyType === 'x-www-form-urlencoded') {
      requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    // Resolve body placeholders
    const resolvedBody = bodyType !== 'none' ? this.resolvePlaceholders(body, ctx) : undefined;

    logger.info('flow', {
      action: 'api_call_start',
      method,
      url: resolvedUrl,
      hasBody: !!resolvedBody,
      timeout,
      retryCount,
    });

    // Execute request with retry logic
    let lastError: string | null = null;
    let responseData: any = null;
    let statusCode = 0;
    let success = false;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // Add delay between retries
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * 1000));
          logger.info('flow', {
            action: 'api_call_retry',
            attempt,
            maxRetries: retryCount,
          });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

        const fetchOptions: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
        };

        if (resolvedBody && method !== 'GET') {
          fetchOptions.body = resolvedBody;
        }

        const response = await fetch(resolvedUrl, fetchOptions);
        clearTimeout(timeoutId);

        statusCode = response.status;

        // Parse response
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        // Check if success
        success = successCodes.includes(statusCode);

        if (success) {
          logger.info('flow', {
            action: 'api_call_success',
            statusCode,
            attempt,
          });
          break;
        } else {
          lastError = `HTTP ${statusCode}: ${response.statusText}`;
          logger.warn('flow', {
            action: 'api_call_non_success_status',
            statusCode,
            attempt,
          });
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          lastError = `Request timeout (${timeout}s)`;
        } else {
          lastError = error.message || String(error);
        }
        logger.error('flow', {
          action: 'api_call_error',
          error: lastError,
          attempt,
        });
      }
    }

    // Mark context as modified
    execution.markModified('context');
    execution.markModified('context.variables');

    // Save status code to variable if configured
    if (saveStatusCodeTo) {
      execution.context.variables[saveStatusCodeTo] = statusCode;
    }

    // Handle success case
    if (success) {
      // Save full response if configured
      if (saveResponseTo) {
        execution.context.variables[saveResponseTo] = responseData;
      }

      // Extract variables from response
      for (const extract of extractVariables) {
        if (extract.variableName && extract.jsonPath) {
          const value = this.extractJsonPath(responseData, extract.jsonPath);
          execution.context.variables[extract.variableName] = value !== undefined 
            ? value 
            : extract.defaultValue || '';
          
          logger.info('flow', {
            action: 'api_call_variable_extracted',
            variableName: extract.variableName,
            jsonPath: extract.jsonPath,
            value: typeof value === 'object' ? JSON.stringify(value).substring(0, 100) : String(value).substring(0, 100),
          });
        }
      }

      return {
        success: true,
        output: { statusCode, data: responseData },
      };
    }

    // Handle error case
    if (saveErrorTo) {
      execution.context.variables[saveErrorTo] = lastError || 'Unknown error';
    }

    // Also save response even on error (might contain error details)
    if (saveResponseTo && responseData) {
      execution.context.variables[saveResponseTo] = responseData;
    }

    logger.warn('flow', {
      action: 'api_call_failed',
      error: lastError,
      statusCode,
      onError,
    });

    switch (onError) {
      case 'stop':
        return { success: false, error: lastError || 'API call failed' };
      
      case 'goto_node':
        if (errorNodeId) {
          return { success: true, nextNodeId: errorNodeId };
        }
        return { success: true };
      
      case 'continue':
      default:
        return { success: true };
    }
  }

  /**
   * Extract value from JSON using dot notation path
   */
  private extractJsonPath(obj: any, path: string): any {
    if (!obj || !path) return undefined;
    
    const parts = path.split('.');
    let value = obj;
    
    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      
      // Handle array index notation like "items[0]"
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        value = value[key];
        if (Array.isArray(value)) {
          value = value[parseInt(index, 10)];
        } else {
          return undefined;
        }
      } else {
        value = value[part];
      }
    }
    
    return value;
  }

  /**
   * Validate user response for data collection
   */
  private validateResponse(
    response: string,
    config: {
      validationType: string;
      required?: boolean;
      minLength?: number;
      maxLength?: number;
      pattern?: string;
      choices?: { value: string }[];
    }
  ): { valid: boolean; error?: string } {
    if (!response && config.required) {
      return { valid: false, error: 'Esta respuesta es obligatoria' };
    }

    if (!response) return { valid: true };

    // Length checks
    if (config.minLength && response.length < config.minLength) {
      return { valid: false, error: `Mínimo ${config.minLength} caracteres` };
    }
    if (config.maxLength && response.length > config.maxLength) {
      return { valid: false, error: `Máximo ${config.maxLength} caracteres` };
    }

    // Type-specific validation
    switch (config.validationType) {
      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(response)) {
          return { valid: false, error: 'Por favor ingresa un email válido' };
        }
        break;
      }

      case 'phone': {
        const phoneRegex = /^[\d\s\-+()]{8,20}$/;
        if (!phoneRegex.test(response)) {
          return { valid: false, error: 'Por favor ingresa un teléfono válido' };
        }
        break;
      }

      case 'number': {
        if (isNaN(Number(response))) {
          return { valid: false, error: 'Por favor ingresa un número válido' };
        }
        break;
      }

      case 'url': {
        try {
          new URL(response);
        } catch {
          return { valid: false, error: 'Por favor ingresa una URL válida' };
        }
        break;
      }

      case 'date': {
        const date = new Date(response);
        if (isNaN(date.getTime())) {
          return { valid: false, error: 'Por favor ingresa una fecha válida' };
        }
        break;
      }

      case 'choice': {
        if (config.choices && !config.choices.some(c => c.value === response)) {
          return { valid: false, error: 'Por favor selecciona una opción válida' };
        }
        break;
      }
    }

    // Custom regex pattern
    if (config.pattern) {
      try {
        const regex = new RegExp(config.pattern);
        if (!regex.test(response)) {
          return { valid: false, error: 'Formato inválido' };
        }
      } catch {
        // Invalid regex, skip
      }
    }

    return { valid: true };
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
   * IMPORTANT: Ignores button handles (btn-xxx) - those are triggered by user clicks
   */
  private getNextNode(flow: IFlow, currentNodeId: string, output?: any): string | null {
    const allEdges = flow.edges.filter(e => e.source === currentNodeId);

    // Filter out button-connected edges - those should only be followed on button click
    const edges = allEdges.filter(e => !e.sourceHandle?.startsWith('btn-'));
    const buttonEdges = allEdges.filter(e => e.sourceHandle?.startsWith('btn-'));

    logger.info('flow', {
      action: 'get_next_node',
      flowId: flow._id.toString(),
      currentNodeId,
      allEdgesCount: allEdges.length,
      regularEdgesCount: edges.length,
      buttonEdgesCount: buttonEdges.length,
      edges: edges.map(e => ({ source: e.source, target: e.target, handle: e.sourceHandle })),
    });

    // If all edges are button edges, wait for button click (return null)
    if (edges.length === 0) {
      if (buttonEdges.length > 0) {
        logger.info('flow', {
          action: 'waiting_for_button_click',
          flowId: flow._id.toString(),
          currentNodeId,
          buttonEdges: buttonEdges.length,
          reason: 'All edges are connected to buttons - waiting for user click',
        });
      } else {
        logger.info('flow', {
          action: 'no_next_node',
          flowId: flow._id.toString(),
          currentNodeId,
          reason: 'No edges from current node - flow ends here',
        });
      }
      return null;
    }

    if (edges.length === 1) return edges[0].target;

    // Handle condition branches
    if (output?.conditionResult !== undefined) {
      const branch = output.conditionResult ? 'true' : 'false';
      const matchingEdge = edges.find(e => e.sourceHandle === branch);
      return matchingEdge?.target || null;
    }

    // Default to first edge (non-button edge)
    return edges[0].target;
  }

  // i18n configuration type for determining language source
  private getLanguageFromI18nConfig(
    i18nConfig: { 
      source: 'user_language' | 'custom_field' | 'variable' | 'fixed'; 
      customFieldName?: string; 
      variableName?: string; 
      fixedLanguage?: string; 
    } | undefined, 
    ctx: ExecutionContext
  ): SupportedLanguage {
    if (!i18nConfig) {
      // Default: use user language
      logger.debug('flow', { action: 'i18n_no_config', usingDefault: ctx.user?.language || 'es' });
      return (ctx.user?.language || 'es') as SupportedLanguage;
    }

    logger.info('flow', {
      action: 'i18n_resolve_language',
      source: i18nConfig.source,
      customFieldName: i18nConfig.customFieldName,
      variableName: i18nConfig.variableName,
      fixedLanguage: i18nConfig.fixedLanguage,
      ctxCustomFields: JSON.stringify(ctx.customFields),
      ctxVariables: JSON.stringify(ctx.variables),
    });

    switch (i18nConfig.source) {
      case 'user_language':
        return (ctx.user?.language || 'es') as SupportedLanguage;
      
      case 'custom_field':
        if (i18nConfig.customFieldName) {
          const fieldValue = ctx.customFields?.[i18nConfig.customFieldName];
          logger.info('flow', {
            action: 'i18n_custom_field_lookup',
            fieldName: i18nConfig.customFieldName,
            fieldValue,
            fieldType: typeof fieldValue,
          });
          if (fieldValue && typeof fieldValue === 'string') {
            // Validate it's a supported language
            const validLangs = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ru', 'zh', 'ja', 'ko', 'ar'];
            if (validLangs.includes(fieldValue.toLowerCase())) {
              logger.info('flow', { action: 'i18n_resolved', language: fieldValue.toLowerCase() });
              return fieldValue.toLowerCase() as SupportedLanguage;
            }
          }
        }
        logger.warn('flow', { action: 'i18n_fallback_es', reason: 'custom_field_not_found_or_invalid' });
        return 'es' as SupportedLanguage; // Fallback
      
      case 'variable':
        if (i18nConfig.variableName) {
          const varValue = ctx.variables?.[i18nConfig.variableName];
          logger.info('flow', {
            action: 'i18n_variable_lookup',
            varName: i18nConfig.variableName,
            varValue,
          });
          if (varValue && typeof varValue === 'string') {
            const validLangs = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ru', 'zh', 'ja', 'ko', 'ar'];
            if (validLangs.includes(varValue.toLowerCase())) {
              return varValue.toLowerCase() as SupportedLanguage;
            }
          }
        }
        return 'es' as SupportedLanguage; // Fallback
      
      case 'fixed':
        return (i18nConfig.fixedLanguage || 'es') as SupportedLanguage;
      
      default:
        return (ctx.user?.language || 'es') as SupportedLanguage;
    }
  }

  /**
   * Resolve placeholders in text - supports {{variable}} syntax like ManyChat/Handlebars
   * Now also resolves {{TEXT.KEY}} for i18n text registry
   * @param i18nConfig Optional configuration for determining which language to use for i18n texts
   */
  private resolvePlaceholders(
    text: string, 
    ctx: ExecutionContext,
    i18nConfig?: { 
      source: 'user_language' | 'custom_field' | 'variable' | 'fixed'; 
      customFieldName?: string; 
      variableName?: string; 
      fixedLanguage?: string; 
    }
  ): string {
    if (!text) return '';

    // Get language for i18n resolution based on config
    const userLang = this.getLanguageFromI18nConfig(i18nConfig, ctx);

    // Universal {{path.to.value}} resolver
    return text.replace(/\{\{([^}]+)\}\}/g, (_, path: string) => {
      const trimmedPath = path.trim();

      // Handle special built-in variables
      switch (trimmedPath) {
        case 'date':
          return new Date().toISOString().split('T')[0];
        case 'time':
          return new Date().toTimeString().slice(0, 5);
        case 'datetime':
          return new Date().toISOString().replace('T', ' ').slice(0, 19);
        case 'timestamp':
          return Date.now().toString();
      }

      // ============= TEXT REGISTRY RESOLUTION =============
      // Format: {{TEXT.WELCOME_MESSAGE}} or {{text.WELCOME_MESSAGE}}
      if (trimmedPath.toUpperCase().startsWith('TEXT.')) {
        const textKey = trimmedPath.substring(5).toUpperCase(); // Remove "TEXT." prefix
        const resolvedText = getTextSync(textKey, userLang);
        
        logger.info('flow', {
          action: 'text_registry_resolved',
          key: textKey,
          lang: userLang,
          resolved: resolvedText ? resolvedText.substring(0, 50) + '...' : 'NOT_FOUND',
        });
        
        if (resolvedText) {
          // Recursively resolve any variables inside the text, passing i18nConfig
          return this.resolvePlaceholders(resolvedText, ctx, i18nConfig);
        }
        return `{{TEXT.${textKey}}}`; // Return original if not found
      }

      // Also check if this is a text registry key directly (without TEXT. prefix)
      // This allows {{WELCOME_MESSAGE}} as shorthand for {{TEXT.WELCOME_MESSAGE}}
      const directTextKey = trimmedPath.toUpperCase();
      const directText = getTextSync(directTextKey, userLang);
      if (directText) {
        logger.info('flow', {
          action: 'text_registry_direct_resolved',
          key: directTextKey,
          lang: userLang,
          resolved: directText.substring(0, 50) + '...',
        });
        // Recursively resolve any variables inside the text, passing i18nConfig
        return this.resolvePlaceholders(directText, ctx, i18nConfig);
      }

      // Try to resolve from context using dot notation
      const value = this.resolveNestedValue(trimmedPath, ctx);

      logger.info('flow', {
        action: 'placeholder_resolved',
        path: trimmedPath,
        resolvedValue: value !== undefined ? String(value) : 'UNDEFINED',
        ctxVariables: JSON.stringify(ctx.variables),
      });

      if (value !== undefined && value !== null) {
        return String(value);
      }

      // Return empty string for unresolved variables
      return '';
    });
  }

  /**
   * Resolve nested value from object using dot notation
   */
  private resolveNestedValue(path: string, obj: any): any {
    const parts = path.split('.');
    let value = obj;

    for (const part of parts) {
      if (value === undefined || value === null) return undefined;

      // Handle special aliases
      if (part === 'var' || part === 'variables') {
        value = value.variables;
      } else if (part === 'customFields' || part === 'custom') {
        // custom and customFields both map to variables (where we store field values)
        value = value.variables;
      } else {
        value = value[part];
      }
    }

    // If not found and path doesn't start with a known prefix, try in variables
    if (value === undefined && parts.length === 1 && obj.variables) {
      value = obj.variables[parts[0]];
    }

    return value;
  }

  // ============= ADVANCED MESSAGE EXECUTION =============

  /**
   * Execute send_message action with blocks and keyboard support
   */
  private async executeSendMessage(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution,
    nodeId?: string
  ): Promise<ExecutionResult> {
    const chatId = ctx.chatId;
    const flowId = execution.flowId.toString();
    let success = true;
    let lastMessageId: number | null = null;

    logger.info('flow', {
      action: 'send_message_action',
      chatId,
      hasBlocks: !!(config.messageBlocks?.length),
      hasKeyboard: !!config.keyboard,
      executionId: execution._id.toString(),
    });

    // Check if using new blocks format or legacy
    if (config.messageBlocks && config.messageBlocks.length > 0) {
      // Process each block in order - each block can have its own keyboard
      for (let i = 0; i < config.messageBlocks.length; i++) {
        const block = config.messageBlocks[i];

        // Each block uses its own keyboard if defined
        const blockKeyboard = block.keyboard
          ? this.buildKeyboard(block.keyboard, flowId, nodeId)
          : undefined;

        // Use WithId versions to capture messageId, pass i18nConfig for language resolution
        const blockMessageId = await this.executeMessageBlockWithId(
          block, 
          chatId, 
          ctx, 
          blockKeyboard,
          config.i18nConfig
        );
        if (blockMessageId === false) {
          success = false;
          logger.warn('flow', {
            action: 'message_block_failed',
            blockType: block.type,
            blockId: block.id,
          });
        } else if (typeof blockMessageId === 'number' && blockMessageId > 0) {
          lastMessageId = blockMessageId;
          success = true;
          logger.info('flow', {
            action: 'message_block_sent',
            blockType: block.type,
            blockId: block.id,
            messageId: blockMessageId,
          });
        } else if (blockMessageId === null) {
          // null means empty content or delay block - not a failure
          logger.info('flow', {
            action: 'message_block_skipped',
            blockType: block.type,
            blockId: block.id,
            reason: 'empty content or delay',
          });
        }
      }
    } else {
      // Legacy: single text message (still supports global keyboard for backward compatibility)
      const content = this.resolvePlaceholders(config.messageContent || '', ctx, config.i18nConfig);
      const legacyKeyboard = config.keyboard ? this.buildKeyboard(config.keyboard, flowId, nodeId) : undefined;

      if (content) {
        // Use omnichannel message routing
        const msgId = await sendMessageToChannel(ctx, content, { replyMarkup: legacyKeyboard });
        if (msgId) {
          lastMessageId = msgId;
        } else {
          success = false;
        }
      }

      // Handle legacy media
      if (config.mediaUrl) {
        const caption = config.messageContent ? this.resolvePlaceholders(config.messageContent, ctx, config.i18nConfig) : undefined;
        if (config.messageType === 'image') {
          // Use omnichannel message routing
          const msgId = await sendPhotoToChannel(ctx, config.mediaUrl, { caption, replyMarkup: legacyKeyboard });
          if (msgId) lastMessageId = msgId;
        } else if (config.messageType === 'document') {
          // Use omnichannel message routing
          const msgId = await sendDocumentToChannel(ctx, config.mediaUrl, { caption, replyMarkup: legacyKeyboard });
          if (msgId) lastMessageId = msgId;
        }
      }
    }

    logger.info('flow', {
      action: 'send_message_result',
      success,
      chatId,
      lastMessageId,
    });

    // Store the current node ID and message ID in context for button click handling
    if (nodeId) {
      execution.context.lastNodeWithButtons = nodeId;
    }
    if (lastMessageId) {
      execution.context.lastMessageId = lastMessageId;
    }

    return { success, output: { messageSent: success, nodeId, messageId: lastMessageId } };
  }

  /**
   * Execute schedule_message action
   * Creates a scheduled message using the robust scheduling system
   */
  private async executeScheduleMessage(
    config: ActionConfig,
    ctx: ExecutionContext
  ): Promise<ExecutionResult> {
    // Get configuration from new format or legacy format
    const scheduleConfig = config.scheduleMessageConfig;
    
    // Determine schedule type
    const scheduleType = scheduleConfig?.type || 
      (config.scheduleType === 'after_inactivity' ? 'after_inactivity' : 'fixed_time');
    
    // Get message content
    const messageText = this.resolvePlaceholders(
      scheduleConfig?.messageContent || config.messageContent || '', 
      ctx
    );
    
    if (!messageText) {
      logger.warn('flow', {
        action: 'schedule_message_skipped',
        reason: 'empty_message',
        sessionId: ctx.sessionId,
      });
      return { success: false, output: { error: 'Message content is empty' } };
    }
    
    try {
      // Build scheduled message params
      const scheduleParams: any = {
        sessionId: ctx.sessionId,
        chatId: ctx.chatId,
        type: scheduleType,
        message: { text: messageText },
        createdBy: 'system',
      };
      
      // Add type-specific config
      if (scheduleType === 'after_inactivity') {
        scheduleParams.delayMinutes = scheduleConfig?.delayMinutes || config.scheduleDelay || 30;
      } else if (scheduleType === 'fixed_time' && scheduleConfig?.scheduledAt) {
        scheduleParams.scheduledAt = new Date(scheduleConfig.scheduledAt);
      } else if (scheduleType === 'on_event' && scheduleConfig?.triggerEvent) {
        scheduleParams.triggerEvent = scheduleConfig.triggerEvent;
      }
      
      // Add expiration if configured
      if (scheduleConfig?.expiresInHours) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + scheduleConfig.expiresInHours);
        scheduleParams.expiresAt = expiresAt;
      }
      
      // Create the scheduled message
      const result = await createScheduledMessage(scheduleParams);
      
      logger.info('flow', {
        action: 'schedule_message_created',
        scheduledMessageId: result?._id?.toString(),
        type: scheduleType,
        sessionId: ctx.sessionId,
        delayMinutes: scheduleParams.delayMinutes,
        scheduledAt: scheduleParams.scheduledAt,
        triggerEvent: scheduleParams.triggerEvent,
      });
      
      return { 
        success: !!result, 
        output: { 
          scheduledMessageId: result?._id?.toString(),
          scheduleType,
          scheduledAt: scheduleParams.scheduledAt,
          delayMinutes: scheduleParams.delayMinutes,
        } 
      };
    } catch (error) {
      logger.error('flow', {
        action: 'schedule_message_failed',
        error: error instanceof Error ? error.message : String(error),
        sessionId: ctx.sessionId,
      });
      
      return { 
        success: false, 
        output: { error: error instanceof Error ? error.message : 'Failed to schedule message' } 
      };
    }
  }

  /**
   * Execute a message block and return the message ID
   * Supports omnichannel routing (Telegram, WebChat)
   */
  private async executeMessageBlockWithId(
    block: MessageBlock,
    chatId: number,
    ctx: ExecutionContext,
    replyMarkup?: any,
    i18nConfig?: ActionConfig['i18nConfig']
  ): Promise<number | null | false> {
    const parseMode = (block as any).parseMode as 'Markdown' | 'MarkdownV2' | 'HTML' | undefined;

    switch (block.type) {
      case 'text': {
        const content = this.resolvePlaceholders(block.content || '', ctx, i18nConfig);
        
        logger.info('flow', {
          action: 'send_block_text_preparing',
          chatId,
          channel: ctx.channel || 'telegram',
          originalContent: block.content?.substring(0, 100),
          resolvedContent: content?.substring(0, 100),
          contentLength: content?.length || 0,
          hasReplyMarkup: !!replyMarkup,
          i18nSource: i18nConfig?.source || 'user_language',
        });
        
        if (!content) {
          logger.info('flow', { action: 'send_block_text_empty', chatId, reason: 'no_content' });
          return null; // Empty text is ok - skipped
        }
        
        // Attempt to send via channel router
        logger.info('flow', {
          action: 'send_block_text_sending',
          chatId,
          channel: ctx.channel || 'telegram',
          contentPreview: content.substring(0, 50),
        });
        
        // Use omnichannel message routing
        const messageId = await sendMessageToChannel(ctx, content, { replyMarkup, parseMode });
        
        if (messageId) {
          logger.info('flow', {
            action: 'send_block_text_success',
            chatId,
            channel: ctx.channel || 'telegram',
            messageId,
          });
          return messageId;
        } else {
          logger.error('flow', {
            action: 'send_block_text_failed',
            chatId,
            channel: ctx.channel || 'telegram',
            reason: 'channel_api_returned_null',
            contentPreview: content.substring(0, 50),
          });
          return false; // API error - mark as failed
        }
      }

      case 'image': {
        if (!block.url) {
          logger.warn('flow', { action: 'send_block_image_no_url', chatId });
          return false;
        }
        const caption = block.caption ? this.resolvePlaceholders(block.caption, ctx, i18nConfig) : undefined;
        // Use omnichannel message routing
        const messageId = await sendPhotoToChannel(ctx, block.url, { caption, replyMarkup, parseMode });
        if (!messageId) {
          logger.error('flow', { action: 'send_block_image_failed', chatId, channel: ctx.channel || 'telegram', url: block.url });
          return false;
        }
        return messageId;
      }

      case 'document': {
        if (!block.url) {
          logger.warn('flow', { action: 'send_block_document_no_url', chatId });
          return false;
        }
        const caption = block.caption ? this.resolvePlaceholders(block.caption, ctx, i18nConfig) : undefined;
        // Use omnichannel message routing
        const messageId = await sendDocumentToChannel(ctx, block.url, {
          caption,
          fileName: (block as any).filename,
          replyMarkup,
          parseMode,
        });
        if (!messageId) {
          logger.error('flow', { action: 'send_block_document_failed', chatId, channel: ctx.channel || 'telegram', url: block.url });
          return false;
        }
        return messageId;
      }

      case 'audio': {
        if (!block.url) {
          logger.warn('flow', { action: 'send_block_audio_no_url', chatId });
          return false;
        }
        // Use omnichannel message routing
        const success = await sendAudioToChannel(ctx, block.url, !!(block as any).isVoiceNote, { replyMarkup });
        if (!success) {
          logger.error('flow', { 
            action: (block as any).isVoiceNote ? 'send_block_voice_failed' : 'send_block_audio_failed', 
            chatId, 
            channel: ctx.channel || 'telegram',
            url: block.url 
          });
          return false;
        }
        return null; // Audio/Voice doesn't return messageId but succeeded
      }

      case 'video': {
        if (!block.url) {
          logger.warn('flow', { action: 'send_block_video_no_url', chatId });
          return false;
        }
        const caption = block.caption ? this.resolvePlaceholders(block.caption, ctx, i18nConfig) : undefined;
        // Use omnichannel message routing
        const messageId = await sendVideoToChannel(ctx, block.url, { caption, replyMarkup, parseMode });
        if (!messageId) {
          logger.error('flow', { action: 'send_block_video_failed', chatId, channel: ctx.channel || 'telegram', url: block.url });
          return false;
        }
        return messageId;
      }

      case 'delay': {
        const seconds = (block as any).seconds || 1;
        logger.info('flow', { action: 'send_block_delay', chatId, seconds });
        await this.sleep(seconds * 1000);
        return null;
      }

      default:
        logger.warn('flow', { action: 'unknown_block_type', type: (block as any).type, chatId });
        return null;
    }
  }

  /**
   * Execute a single message block
   * Supports omnichannel routing (Telegram, WebChat)
   */
  private async executeMessageBlock(
    block: MessageBlock,
    chatId: number,
    ctx: ExecutionContext,
    replyMarkup?: InlineKeyboardMarkup | ReplyKeyboardMarkup
  ): Promise<boolean> {
    // Get parseMode from block (if supported)
    const parseMode = (block as any).parseMode as 'Markdown' | 'MarkdownV2' | 'HTML' | undefined;

    switch (block.type) {
      case 'text': {
        const content = this.resolvePlaceholders(block.content || '', ctx);
        if (!content) return true; // Empty text is ok
        // Use omnichannel message routing
        const msgId = await sendMessageToChannel(ctx, content, { replyMarkup, parseMode });
        return msgId !== null;
      }

      case 'image': {
        if (!block.url) return false;
        const caption = block.caption ? this.resolvePlaceholders(block.caption, ctx) : undefined;
        // Use omnichannel message routing
        const msgId = await sendPhotoToChannel(ctx, block.url, { caption, replyMarkup, parseMode });
        return msgId !== null;
      }

      case 'document': {
        if (!block.url) return false;
        const caption = block.caption ? this.resolvePlaceholders(block.caption, ctx) : undefined;
        // Use omnichannel message routing
        const msgId = await sendDocumentToChannel(ctx, block.url, {
          caption,
          fileName: block.filename,
          replyMarkup,
          parseMode,
        });
        return msgId !== null;
      }

      case 'audio': {
        if (!block.url) return false;
        // Use omnichannel message routing
        return await sendAudioToChannel(ctx, block.url, !!block.isVoiceNote, { replyMarkup });
      }

      case 'video': {
        if (!block.url) return false;
        const caption = block.caption ? this.resolvePlaceholders(block.caption, ctx) : undefined;
        // Use omnichannel message routing
        const msgId = await sendVideoToChannel(ctx, block.url, { caption, replyMarkup, parseMode });
        return msgId !== null;
      }

      case 'delay': {
        const seconds = block.seconds || 1;
        await this.sleep(seconds * 1000);
        return true;
      }

      default:
        logger.warn('flow', { action: 'unknown_block_type', type: (block as any).type });
        return true;
    }
  }

  /**
   * Build Telegram keyboard from config
   * Generates callback_data with flow routing information
   * Uses compact callback IDs to stay within Telegram's 64-byte limit
   */
  private buildKeyboard(config: KeyboardConfig, flowId?: string, nodeId?: string): InlineKeyboardMarkup | ReplyKeyboardMarkup | undefined {
    if (!config.rows || config.rows.length === 0) return undefined;

    if (config.type === 'inline') {
      const inline_keyboard = config.rows.map(row =>
        row.buttons.map(btn => {
          // Get mode from button config
          const mode = btn.onClick?.mode || 'continue';

          // If it's a URL button, use url parameter (no callback_data needed)
          if (mode === 'url' && (btn.onClick?.url || btn.url)) {
            return {
              text: btn.text,
              url: btn.onClick?.url || btn.url,
            };
          }

          // Register callback and get short ID
          // Format: fb:{shortId} (only 11 chars, well under 64 byte limit)
          const shortId = registerCallback(
            flowId || 'unknown',
            nodeId || 'unknown',
            btn.id,
            mode
          );
          const callbackData = `fb:${shortId}`;

          logger.debug('flow', {
            action: 'callback_registered',
            shortId,
            flowId,
            nodeId,
            btnId: btn.id,
            mode,
            callbackDataLength: callbackData.length,
          });

          return {
            text: btn.text,
            callback_data: callbackData,
          };
        })
      );
      return { inline_keyboard };
    } else if (config.type === 'reply') {
      const keyboard = config.rows.map(row =>
        row.buttons.map(btn => ({
          text: btn.text,
        }))
      );
      return {
        keyboard,
        one_time_keyboard: config.oneTimeKeyboard ?? true,
        resize_keyboard: config.resizeKeyboard ?? true,
        input_field_placeholder: config.placeholder,
      } as ReplyKeyboardMarkup;
    } else if (config.type === 'remove') {
      return { remove_keyboard: true } as any;
    }

    return undefined;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============= WAITING EXECUTIONS =============

  /**
   * Process executions that are waiting
   */
  private async processWaitingExecutions(): Promise<void> {
    // console.log('Processing waiting executions...');
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
   * Resume execution from a button click
   * Handles continue and goto_node modes
   */
  async resumeFromButton(
    flowId: string,
    nodeId: string,
    buttonId: string,
    mode: 'continue' | 'goto_node' | 'goto_flow' | 'url' | 'none',
    sessionId: string,
    buttonData: Record<string, any>
  ): Promise<boolean> {
    logger.info('flow', {
      action: 'resume_from_button',
      flowId,
      nodeId,
      buttonId,
      mode,
      sessionId,
    });

    // Find active execution for this session and flow
    // Also look for executions paused waiting for button click
    // Note: sessionId might have changed during execution (e.g., assign_agent creates new session)
    // so we also search by chatId from buttonData
    const chatId = buttonData?.user?.telegramId || buttonData?.chatId;
    
    let execution = await FlowExecution.findOne({
      flowId,
      sessionId,
      status: { $in: ['running', 'paused'] },
    });
    
    // If not found by sessionId, try by chatId (in case sessionId changed during execution)
    if (!execution && chatId) {
      execution = await FlowExecution.findOne({
        flowId,
        chatId,
        status: { $in: ['running', 'paused'] },
      });
      
      if (execution) {
        logger.info('flow', {
          action: 'execution_found_by_chatId',
          flowId,
          chatId,
          executionSessionId: execution.sessionId,
          searchedSessionId: sessionId,
        });
      }
    }

    if (!execution) {
      logger.info('flow', {
        action: 'no_execution_for_button',
        flowId,
        sessionId,
        chatId,
        reason: 'No active execution found',
      });
      return false;
    }

    // Verify the execution is actually waiting for this button
    if (execution.status === 'paused' && execution.waitingFor === 'button_click') {
      logger.info('flow', {
        action: 'execution_waiting_for_button',
        executionId: execution._id.toString(),
        currentNodeId: execution.currentNodeId,
        expectedNodeId: nodeId,
      });
    }

    const flow = await Flow.findById(flowId);
    if (!flow) {
      logger.warn('flow', { action: 'flow_not_found', flowId });
      return false;
    }

    // Store button click data in context
    execution.context.variables._lastButtonClick = {
      buttonId,
      nodeId,
      mode,
      timestamp: new Date().toISOString(),
      ...buttonData.button,
    };
    execution.markModified('context');

    // Get the node that has this button
    const sourceNode = flow.nodes.find(n => n.id === nodeId);
    if (!sourceNode) {
      logger.warn('flow', { action: 'node_not_found', nodeId });
      return false;
    }

    // Find ALL edges connected to this button handle (support multiple connections)
    const expectedHandle = `btn-${buttonId}`;
    const allEdgesFromNode = flow.edges.filter(e => e.source === nodeId);
    const buttonEdges = flow.edges.filter(e =>
      e.source === nodeId && e.sourceHandle === expectedHandle
    );

    logger.info('flow', {
      action: 'looking_for_button_edges',
      nodeId,
      buttonId,
      expectedHandle,
      allEdgesFromNode: allEdgesFromNode.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle
      })),
      foundButtonEdges: buttonEdges.map(e => ({ target: e.target, handle: e.sourceHandle })),
      multipleEdges: buttonEdges.length > 1,
    });

    // If multiple edges from same button, we need to execute ALL of them
    // Priority: execute non-message actions first (assign_agent, set_field, etc.)
    // Then execute message actions (which may pause for buttons)
    if (buttonEdges.length > 1) {
      logger.info('flow', {
        action: 'multiple_button_edges_detected',
        buttonId,
        edgeCount: buttonEdges.length,
        targets: buttonEdges.map(e => e.target),
      });

      // Categorize target nodes
      const messageNodes: string[] = [];
      const actionNodes: string[] = [];
      
      for (const edge of buttonEdges) {
        const targetNode = flow.nodes.find(n => n.id === edge.target);
        if (targetNode && targetNode.type === 'action') {
          const config = targetNode.config as any;
          if (config.actionType === 'send_message') {
            messageNodes.push(edge.target);
          } else {
            actionNodes.push(edge.target);
          }
        } else if (targetNode) {
          actionNodes.push(edge.target);
        }
      }

      logger.info('flow', {
        action: 'categorized_button_targets',
        buttonId,
        actionNodes,
        messageNodes,
      });

      // Execute action nodes first (like assign_agent)
      for (const actionNodeId of actionNodes) {
        await this.executeFromNode(execution, flow, actionNodeId);
      }

      // Then handle message nodes (may pause for buttons)
      if (messageNodes.length > 0) {
        // Use the first message node as the "next" node
        const nextNodeId = messageNodes[0];
        
        // Check if we should edit instead of send
        const messageMode = buttonData.button?.onClick?.messageMode || 'send_new';
        if (messageMode === 'edit_message' && execution.context.lastMessageId) {
          // Handle edit mode for the message node
          const nextNode = flow.nodes.find(n => n.id === nextNodeId);
          if (nextNode && nextNode.type === 'action') {
            const config = nextNode.config as any;
            if (config.actionType === 'send_message') {
              let resolvedContent: string | undefined;
              let parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML';
              let replyMarkup: any;

              if (config.messageBlocks && config.messageBlocks.length > 0) {
                const textBlock = config.messageBlocks.find((b: any) => b.type === 'text');
                if (textBlock && textBlock.content) {
                  resolvedContent = this.resolvePlaceholders(textBlock.content, execution.context, config.i18nConfig);
                  if (textBlock.parseMode) parseMode = textBlock.parseMode;
                  if (textBlock.keyboard) {
                    replyMarkup = this.buildKeyboard(textBlock.keyboard, flow._id?.toString(), nextNodeId);
                  }
                }
              } else if (config.messageContent) {
                resolvedContent = this.resolvePlaceholders(config.messageContent, execution.context, config.i18nConfig);
                if (config.keyboard) {
                  replyMarkup = this.buildKeyboard(config.keyboard, flow._id?.toString(), nextNodeId);
                }
              }

              if (resolvedContent) {
                await editMessage(execution.context.chatId, execution.context.lastMessageId, resolvedContent, { replyMarkup, parseMode });
                
                // Check if the message node has buttons
                const hasKeyboard = config?.keyboard?.rows?.length > 0 ||
                  config?.messageBlocks?.some((b: any) => b.keyboard?.rows?.length > 0);

                if (hasKeyboard) {
                  execution.pause('button_click');
                  execution.currentNodeId = nextNodeId;
                  execution.nextNodeId = null;
                  await execution.save();
                } else {
                  execution.complete();
                  await execution.save();
                }
                return true;
              }
            }
          }
        }

        // Normal send (not edit)
        await this.executeFromNode(execution, flow, nextNodeId);
        return true;
      }

      // If only action nodes were executed, complete
      execution.complete();
      await execution.save();
      return true;
    }

    // Single edge or no edge - original logic
    const buttonEdge = buttonEdges[0];
    let nextNodeId: string | undefined;

    if (mode === 'goto_node' && buttonData.button?.targetNodeId) {
      // Explicit target node from button config
      nextNodeId = buttonData.button.targetNodeId;
    } else if (buttonEdge) {
      // Use connected edge
      nextNodeId = buttonEdge.target;
    } else {
      // Fall back to default output
      const defaultEdge = flow.edges.find(e =>
        e.source === nodeId && (!e.sourceHandle || e.sourceHandle === 'default')
      );
      nextNodeId = defaultEdge?.target;

      logger.info('flow', {
        action: 'button_edge_not_found_using_default',
        nodeId,
        buttonId,
        defaultEdgeTarget: nextNodeId,
      });
    }

    if (!nextNodeId) {
      logger.info('flow', {
        action: 'no_next_node_for_button',
        nodeId,
        buttonId,
      });
      // Complete the execution if no next node
      execution.complete();
      await execution.save();
      return true;
    }

    // Check if we should edit the last message instead of sending new
    const messageMode = buttonData.button?.onClick?.messageMode || 'send_new';

    // If messageMode is 'edit_message', we need to find the last message sent
    // and edit it instead of sending a new one and continuing the flow
    if (messageMode === 'edit_message' && execution.context.lastMessageId) {
      logger.info('flow', {
        action: 'edit_mode_message',
        nodeId,
        buttonId,
        lastMessageId: execution.context.lastMessageId,
      });

      // Get the next node to get its message content
      const nextNode = flow.nodes.find(n => n.id === nextNodeId);
      if (nextNode && nextNode.type === 'action') {
        const config = nextNode.config as any;
        if (config.actionType === 'send_message') {
          let resolvedContent: string | undefined;
          let parseMode: 'HTML' | 'Markdown' | 'MarkdownV2' = 'HTML';
          let replyMarkup: any;

          // Handle new messageBlocks format
          if (config.messageBlocks && config.messageBlocks.length > 0) {
            const textBlock = config.messageBlocks.find((b: any) => b.type === 'text');
            if (textBlock && textBlock.content) {
              resolvedContent = this.resolvePlaceholders(textBlock.content, execution.context);
              if (textBlock.parseMode) {
                parseMode = textBlock.parseMode;
              }
              // Build keyboard from first text block if it has one
              if (textBlock.keyboard) {
                replyMarkup = this.buildKeyboard(
                  textBlock.keyboard,
                  flow._id?.toString(),
                  nextNodeId
                );
              }
            }
          } else if (config.messageContent) {
            // Handle legacy format
            resolvedContent = this.resolvePlaceholders(config.messageContent, execution.context);
            if (config.keyboard) {
              replyMarkup = this.buildKeyboard(
                config.keyboard,
                flow._id?.toString(),
                nextNodeId
              );
            }
          }

          if (resolvedContent) {
            // Edit the message instead of sending a new one
            await editMessage(
              execution.context.chatId,
              execution.context.lastMessageId,
              resolvedContent,
              { replyMarkup, parseMode }
            );

            // Add step for button click
            const step: ExecutionStep = {
              nodeId,
              nodeType: 'button_click',
              nodeLabel: `Botón: ${buttonData.button?.text || buttonId} (edición)`,
              status: 'completed',
              startedAt: new Date(),
              completedAt: new Date(),
              retryCount: 0,
              output: {
                type: 'button_click',
                buttonId,
                buttonText: buttonData.button?.text,
                messageEdited: true,
                messageId: execution.context.lastMessageId,
              },
            };
            execution.steps.push(step);

            // The message has been edited with content from nextNode
            // Now check if nextNode has buttons - if so, pause and wait for button click
            // If not, continue execution from nextNode to process any connected actions (like close_chat)
            const nextNodeConfig = nextNode.config as any;
            const hasKeyboard = nextNodeConfig?.keyboard?.rows?.length > 0 ||
              nextNodeConfig?.messageBlocks?.some((b: any) => b.keyboard?.rows?.length > 0);

            if (hasKeyboard) {
              // Has buttons - pause and wait for next button click
              execution.pause('button_click');
              execution.currentNodeId = nextNodeId;
              execution.nextNodeId = null;
              await execution.save();

              logger.info('flow', {
                action: 'paused_after_edit_waiting_for_buttons',
                nodeId,
                nextNodeId,
                buttonId,
                messageId: execution.context.lastMessageId,
              });
            } else {
              // No buttons - continue execution to process any connected nodes
              // The message was edited, so we don't need to execute send_message again
              // but we DO need to continue to any nodes connected to nextNode
              
              // Find the node AFTER nextNode (the send_message we just edited)
              const afterEditNodeId = this.getNextNode(flow, nextNodeId);
              
              logger.info('flow', {
                action: 'continuing_after_edit_no_buttons',
                nodeId,
                nextNodeId,
                afterEditNodeId,
                buttonId,
                messageId: execution.context.lastMessageId,
              });
              
              // Mark the send_message node as completed
              const sendMsgStep: ExecutionStep = {
                nodeId: nextNodeId,
                nodeType: 'action',
                nodeLabel: nextNode.label || 'Enviar mensaje',
                status: 'completed',
                startedAt: new Date(),
                completedAt: new Date(),
                retryCount: 0,
                output: {
                  type: 'send_message_edit',
                  messageEdited: true,
                  messageId: execution.context.lastMessageId,
                },
              };
              execution.steps.push(step);
              execution.steps.push(sendMsgStep);
              execution.currentNodeId = nextNodeId;
              execution.resume();
              await execution.save();
              
              // Continue from the node AFTER nextNode (if it exists)
              if (afterEditNodeId) {
                await this.executeFromNode(execution, flow, afterEditNodeId);
              } else {
                // No more nodes - complete the execution
                execution.complete();
                await execution.save();
                logger.info('flow', {
                  action: 'completed_after_edit_no_more_nodes',
                  nodeId,
                  nextNodeId,
                });
              }
            }

            return true;
          }
        }
      }

      // If we can't edit (no messageId, no next node, etc), fall through to normal button handling
      logger.warn('flow', {
        action: 'edit_mode_failed_falling_back',
        nodeId,
        buttonId,
        reason: 'Could not edit message, falling back to normal handling',
      });
    }

    // Add step for button click
    const step: ExecutionStep = {
      nodeId,
      nodeType: 'button_click',
      nodeLabel: `Botón: ${buttonData.button?.text || buttonId}`,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
      retryCount: 0,
      output: {
        type: 'button_click',
        buttonId,
        buttonText: buttonData.button?.text,
        nextNodeId,
      },
    };
    execution.steps.push(step);

    // Resume and continue to next node
    execution.resume();
    await execution.save();

    // Execute from next node
    await this.executeFromNode(execution, flow, nextNodeId);
    return true;
  }

  /**
   * Start a flow execution from a specific node
   * Used when a button with goto_node is clicked but no active execution exists
   */
  async startFlowFromNode(
    flowId: string,
    startNodeId: string,
    sessionId: string,
    chatId: number,
    userId: number,
    data: Record<string, any> = {}
  ): Promise<IFlowExecution | null> {
    logger.info('flow', {
      action: 'start_flow_from_node',
      flowId,
      startNodeId,
      sessionId,
      chatId,
    });

    // Get the flow
    const flow = await Flow.findById(flowId);
    if (!flow) {
      logger.warn('flow', { action: 'flow_not_found', flowId });
      return null;
    }

    // Verify the node exists
    const targetNode = flow.nodes.find(n => n.id === startNodeId);
    if (!targetNode) {
      logger.warn('flow', { action: 'target_node_not_found', flowId, startNodeId });
      return null;
    }

    // Build execution context with user data
    const userInfo = data.user || {};
    const now = new Date();
    const context: ExecutionContext = {
      triggerType: 'button_clicked',
      triggerData: {
        buttonId: data.button?.id,
        targetNodeId: startNodeId,
        startedFromButton: true,
      },
      sessionId,
      chatId,
      userId,
      user: {
        id: userId,
        firstName: userInfo.firstName || '',
        lastName: userInfo.lastName,
        username: userInfo.username,
        language: userInfo.language,
      },
      variables: {
        button: data.button || {},
        _startedFromNode: startNodeId,
      },
      startedAt: now,
      lastActiveAt: now,
    };

    // Start execution from the specified node
    const execution = await this.startExecution(flow, context, startNodeId);

    logger.info('flow', {
      action: 'flow_started_from_node',
      executionId: execution._id.toString(),
      flowId,
      startNodeId,
    });

    return execution;
  }

  /**
   * Resume executions waiting for user response
   * Also handles data collection validation
   */
  async resumeOnUserResponse(sessionId: string, userResponse?: string): Promise<void> {
    // Don't resume executions that were paused very recently (within 2 seconds)
    // This prevents the message that triggered the flow from also resuming it
    const minPausedAt = new Date(Date.now() - 2000);
    
    const executions = await FlowExecution.find({
      sessionId,
      status: 'paused',
      waitingFor: 'response',
      pausedAt: { $lt: minPausedAt },
    });

    logger.info('flow', {
      action: 'resume_on_user_response',
      sessionId,
      executionsFound: executions.length,
      hasResponse: !!userResponse,
    });

    for (const execution of executions) {
      const flow = await Flow.findById(execution.flowId);
      if (!flow) continue;

      // Check for data collection config
      const dcConfig = execution.context.variables._dataCollection;
      
      logger.info('flow', {
        action: 'resume_checking_data_collection',
        executionId: execution._id.toString(),
        hasDataCollection: !!dcConfig,
        variablesFromDB: JSON.stringify(execution.context.variables),
        userResponse: userResponse?.substring(0, 50),
      });
      
      if (dcConfig && userResponse) {
        // Validate the response
        const validation = this.validateResponse(userResponse, dcConfig);

        if (!validation.valid) {
          // Increment retry count
          dcConfig.retryCount = (dcConfig.retryCount || 0) + 1;
          
          // Update the config in execution context
          execution.context.variables._dataCollection = dcConfig;
          execution.markModified('context');
          execution.markModified('context.variables');

          logger.info('flow', {
            action: 'data_collection_retry',
            retryCount: dcConfig.retryCount,
            maxRetries: dcConfig.maxRetries,
            variableName: dcConfig.variableName,
          });

          if (dcConfig.retryCount >= (dcConfig.maxRetries || 3)) {
            // Max retries reached - fail or continue
            logger.warn('flow', {
              action: 'data_collection_max_retries',
              sessionId,
              variableName: dcConfig.variableName,
              retryCount: dcConfig.retryCount,
            });
            // Continue with empty value
            execution.context.variables[dcConfig.variableName] = '';
            delete execution.context.variables._dataCollection;
            execution.markModified('context');
            execution.markModified('context.variables');
          } else {
            // Send error message and wait again
            const errorMsg = dcConfig.errorMessage || validation.error || 'Respuesta inválida';
            await sendMessage(execution.chatId, `❌ ${errorMsg}\n\nPor favor intenta de nuevo. (Intento ${dcConfig.retryCount}/${dcConfig.maxRetries || 3})`);
            await execution.save();
            continue; // Don't resume yet
          }
        } else {
          // Valid response - store it
          const varName = dcConfig.variableName;
          execution.context.variables[varName] = userResponse;
          delete execution.context.variables._dataCollection;
          
          // Mark context as modified for Mongoose to detect nested changes
          execution.markModified('context');
          execution.markModified('context.variables');

          logger.info('flow', {
            action: 'variable_stored',
            variableName: varName,
            value: userResponse,
            variablesNow: JSON.stringify(execution.context.variables),
            contextVariablesRef: typeof execution.context.variables,
          });

          // Also save to user's custom fields using the proper service
          const user = await User.findOne({ telegramId: execution.context.userId });
          if (user) {
            // Convert value type based on content
            let typedValue: string | number | boolean = userResponse;
            if (userResponse === 'true') typedValue = true;
            else if (userResponse === 'false') typedValue = false;
            else if (!isNaN(Number(userResponse)) && userResponse !== '') typedValue = Number(userResponse);
            
            await setUserFieldByKey(user._id!.toString(), varName, typedValue);
          }

          logger.info('flow', {
            action: 'data_collection_success',
            sessionId,
            variableName: varName,
            value: userResponse.substring(0, 50),
            allVariables: JSON.stringify(execution.context.variables),
          });
        }
      }

      execution.resume();
      
      // Store variables before save to ensure they persist
      const savedVariables = { ...execution.context.variables };
      
      await execution.save();
      
      // Restore variables to execution context (in case Mongoose reset them)
      execution.context.variables = savedVariables;

      logger.info('flow', {
        action: 'resuming_after_data_collection',
        executionId: execution._id.toString(),
        nextNodeId: execution.nextNodeId,
        variablesAfterSave: JSON.stringify(execution.context.variables),
      });

      if (execution.nextNodeId) {
        await this.executeFromNode(execution, flow, execution.nextNodeId);
      } else {
        logger.warn('flow', {
          action: 'no_next_node_after_resume',
          executionId: execution._id.toString(),
        });
      }
    }
  }

  // ============= SIMULATION =============

  /**
   * Simulate flow execution without side effects
   * Returns step-by-step what would happen
   */
  async simulateFlow(
    flow: IFlow,
    context: Partial<ExecutionContext>
  ): Promise<{
    success: boolean;
    steps: Array<{
      nodeId: string;
      nodeType: string;
      nodeLabel: string;
      status: 'executed' | 'skipped' | 'would_execute' | 'error';
      duration?: number;
      output?: any;
      error?: string;
      actionSkipped?: boolean;
      conditionResult?: boolean;
    }>;
    totalDuration: number;
    errors: string[];
    warnings: string[];
  }> {
    const steps: Array<{
      nodeId: string;
      nodeType: string;
      nodeLabel: string;
      status: 'executed' | 'skipped' | 'would_execute' | 'error';
      duration?: number;
      output?: any;
      error?: string;
      actionSkipped?: boolean;
      conditionResult?: boolean;
    }> = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const startTime = Date.now();

    // Build full context with defaults
    const fullContext: ExecutionContext = {
      triggerType: context.triggerType || 'chat_created',
      triggerData: context.triggerData || {},
      sessionId: context.sessionId || 'sim_session_001',
      chatId: context.chatId || 123456789,
      userId: context.userId || 987654321,
      user: context.user || {
        id: 987654321,
        firstName: 'Test',
        lastName: 'User',
        username: 'testuser',
        language: 'es',
      },
      agent: context.agent,
      message: context.message,
      variables: context.variables || {},
      startedAt: new Date(),
      lastActiveAt: new Date(),
    };

    // Find trigger node
    const triggerNode = flow.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      errors.push('No trigger node found');
      return { success: false, steps, totalDuration: 0, errors, warnings };
    }

    // Execute flow simulation
    let currentNodeId: string | null = triggerNode.id;
    let iterations = 0;
    const maxIterations = 100;

    while (currentNodeId && iterations < maxIterations) {
      iterations++;
      const nodeStart = Date.now();

      const node = flow.nodes.find(n => n.id === currentNodeId);
      if (!node) {
        errors.push(`Node not found: ${currentNodeId}`);
        break;
      }

      const step: typeof steps[0] = {
        nodeId: node.id,
        nodeType: node.type,
        nodeLabel: node.label,
        status: 'executed',
        duration: 0,
      };

      try {
        switch (node.type) {
          case 'trigger':
            // Trigger just passes through
            step.output = { triggered: true, type: (node.config as any)?.triggerType };
            break;

          case 'condition':
            // Actually evaluate condition
            const condConfig = node.config as ConditionConfig;
            const condResult = this.evaluateConditions(condConfig, fullContext);
            step.conditionResult = condResult;
            step.output = { conditionResult: condResult };
            break;

          case 'action':
            // Mark actions as "would_execute" - don't actually run them
            step.status = 'would_execute';
            step.actionSkipped = true;
            const actionConfig = node.config as ActionConfig;
            step.output = {
              actionType: actionConfig.actionType,
              wouldDo: this.describeAction(actionConfig, fullContext),
            };
            break;

          case 'delay':
            // Show what delay would happen
            const delayConfig = node.config as DelayConfig;
            step.status = 'would_execute';
            step.output = {
              delayType: delayConfig.delayType,
              delayMinutes: delayConfig.delayMinutes,
              description: `Would wait ${delayConfig.delayMinutes || 0} minutes`,
            };
            break;

          case 'end':
            step.output = { flowCompleted: true };
            break;
        }
      } catch (error) {
        step.status = 'error';
        step.error = String(error);
        errors.push(`Error at node "${node.label}": ${error}`);
      }

      step.duration = Date.now() - nodeStart;
      steps.push(step);

      // Get next node
      if (node.type === 'end') {
        break;
      }

      const edges = flow.edges.filter(e => e.source === currentNodeId);
      if (edges.length === 0) {
        warnings.push(`Node "${node.label}" has no outgoing connections`);
        break;
      }

      // For conditions, follow the correct branch
      if (step.conditionResult !== undefined) {
        const branch = step.conditionResult ? 'true' : 'false';
        const matchingEdge = edges.find(e => e.sourceHandle === branch);
        currentNodeId = matchingEdge?.target || null;

        if (!currentNodeId) {
          warnings.push(`No ${branch.toUpperCase()} path found for condition "${node.label}"`);
        }
      } else {
        currentNodeId = edges[0].target;
      }
    }

    if (iterations >= maxIterations) {
      errors.push('Maximum iterations exceeded - possible infinite loop');
    }

    return {
      success: errors.length === 0,
      steps,
      totalDuration: Date.now() - startTime,
      errors,
      warnings,
    };
  }

  // ============= NEW TELEGRAM ACTION IMPLEMENTATIONS =============

  /**
   * Edit a previously sent message
   */
  private async executeEditMessage(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const editConfig = (config as any).editMessageConfig;
    if (!editConfig) {
      return { success: false, error: 'No edit message config provided' };
    }

    // Get message ID based on target type
    let messageId: number | null = null;

    switch (editConfig.targetType) {
      case 'last_bot_message':
        messageId = execution.context.variables._lastBotMessageId;
        break;
      case 'variable':
        messageId = execution.context.variables[editConfig.messageIdVariable || ''];
        break;
      case 'specific_id':
        messageId = editConfig.specificMessageId;
        break;
    }

    if (!messageId) {
      return { success: false, error: 'No message ID found to edit' };
    }

    const newText = this.resolvePlaceholders(editConfig.newText || '', ctx);
    
    // Build keyboard if needed
    let replyMarkup: InlineKeyboardMarkup | undefined;
    if (editConfig.updateKeyboard && editConfig.newKeyboard) {
      replyMarkup = this.buildInlineKeyboardFromConfig(editConfig.newKeyboard);
    }

    const success = await editMessage(ctx.chatId, messageId, newText, {
      parseMode: editConfig.parseMode || 'HTML',
      replyMarkup,
    });

    logger.info('flow', {
      action: 'edit_message',
      chatId: ctx.chatId,
      messageId,
      success,
    });

    return { success };
  }

  /**
   * Delete a message
   */
  private async executeDeleteMessage(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const deleteConfig = (config as any).deleteMessageConfig;
    if (!deleteConfig) {
      return { success: false, error: 'No delete message config provided' };
    }

    let messageId: number | null = null;

    switch (deleteConfig.targetType) {
      case 'last_bot_message':
        messageId = execution.context.variables._lastBotMessageId;
        break;
      case 'last_user_message':
        messageId = ctx.message?.id ? parseInt(ctx.message.id, 10) : null;
        break;
      case 'variable':
        messageId = execution.context.variables[deleteConfig.messageIdVariable || ''];
        break;
      case 'specific_id':
        messageId = deleteConfig.specificMessageId;
        break;
    }

    if (!messageId) {
      return { success: false, error: 'No message ID found to delete' };
    }

    const success = await deleteMessage(ctx.chatId, messageId);

    logger.info('flow', {
      action: 'delete_message',
      chatId: ctx.chatId,
      messageId,
      success,
    });

    return { success };
  }

  /**
   * Edit inline keyboard of a message
   */
  private async executeEditKeyboard(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const kbConfig = (config as any).editKeyboardConfig;
    if (!kbConfig) {
      return { success: false, error: 'No edit keyboard config provided' };
    }

    let messageId: number | null = null;

    switch (kbConfig.targetType) {
      case 'last_bot_message':
        messageId = execution.context.variables._lastBotMessageId;
        break;
      case 'variable':
        messageId = execution.context.variables[kbConfig.messageIdVariable || ''];
        break;
      case 'specific_id':
        messageId = kbConfig.specificMessageId;
        break;
    }

    if (!messageId) {
      return { success: false, error: 'No message ID found to edit keyboard' };
    }

    let newKeyboard: InlineKeyboardMarkup | undefined;
    
    switch (kbConfig.operation) {
      case 'replace':
      case 'add_row':
        if (kbConfig.newKeyboard) {
          newKeyboard = this.buildInlineKeyboardFromConfig(kbConfig.newKeyboard);
        }
        break;
      case 'remove':
        newKeyboard = undefined; // Will remove keyboard
        break;
      case 'disable_button':
        // TODO: Get current keyboard, find button, mark as disabled
        logger.warn('flow', { action: 'disable_button_not_implemented' });
        break;
    }

    const success = await editMessageReplyMarkup(ctx.chatId, messageId, newKeyboard);

    logger.info('flow', {
      action: 'edit_keyboard',
      chatId: ctx.chatId,
      messageId,
      operation: kbConfig.operation,
      success,
    });

    return { success };
  }

  /**
   * Remove inline keyboard from a message
   */
  private async executeRemoveKeyboard(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const messageId = execution.context.variables._lastBotMessageId;
    
    if (!messageId) {
      return { success: false, error: 'No message ID found to remove keyboard' };
    }

    const success = await editMessageReplyMarkup(ctx.chatId, messageId);

    logger.info('flow', {
      action: 'remove_keyboard',
      chatId: ctx.chatId,
      messageId,
      success,
    });

    return { success };
  }

  /**
   * Send a reply keyboard (persistent menu)
   */
  private async executeSendReplyKeyboard(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const kbConfig = (config as any).replyKeyboardConfig;
    if (!kbConfig || !kbConfig.rows) {
      return { success: false, error: 'No reply keyboard config provided' };
    }

    // Build keyboard
    const keyboard = kbConfig.rows.map((row: any) =>
      row.buttons.map((btn: any) => {
        const button: any = { text: btn.text };
        if (btn.type === 'contact') button.request_contact = true;
        if (btn.type === 'location') button.request_location = true;
        if (btn.type === 'poll') button.request_poll = { type: btn.pollType };
        return button;
      })
    );

    const replyMarkup = buildReplyKeyboard({
      keyboard,
      resizeKeyboard: kbConfig.resizeKeyboard ?? true,
      oneTimeKeyboard: kbConfig.oneTimeKeyboard ?? false,
      inputFieldPlaceholder: kbConfig.inputPlaceholder,
      isPersistent: kbConfig.isPersistent,
    });

    const messageText = this.resolvePlaceholders(kbConfig.messageText || 'Selecciona una opción:', ctx);
    
    const msgId = await sendMessageWithId(ctx.chatId, messageText, {
      replyMarkup,
      parseMode: 'HTML',
    });

    if (msgId) {
      execution.context.variables._lastBotMessageId = msgId;
      execution.markModified('context.variables');
    }

    logger.info('flow', {
      action: 'send_reply_keyboard',
      chatId: ctx.chatId,
      buttonCount: keyboard.flat().length,
    });

    return { success: !!msgId };
  }

  /**
   * Remove reply keyboard
   */
  private async executeRemoveReplyKeyboard(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const removeMarkup = buildReplyKeyboardRemove();

    const msgId = await sendMessageWithId(ctx.chatId, '...', {
      replyMarkup: removeMarkup,
    });

    // Delete the placeholder message after a brief moment
    if (msgId) {
      setTimeout(async () => {
        await deleteMessage(ctx.chatId, msgId);
      }, 500);
    }

    logger.info('flow', {
      action: 'remove_reply_keyboard',
      chatId: ctx.chatId,
    });

    return { success: true };
  }

  /**
   * Send a chat action (typing, upload_photo, etc.)
   */
  private async executeSendChatAction(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const actionConfig = (config as any).chatActionConfig;
    const action = (actionConfig?.action || 'typing') as ChatAction;
    const duration = (actionConfig?.simulateDuration || 0) * 1000;

    if (duration > 0) {
      // Simulate typing for the specified duration
      await simulateTyping(ctx.chatId, duration);
    } else {
      // Just send the action once
      await sendChatAction(ctx.chatId, action);
    }

    logger.info('flow', {
      action: 'send_chat_action',
      chatId: ctx.chatId,
      actionType: action,
      duration,
    });

    return { success: true };
  }

  /**
   * Pin a message
   */
  private async executePinMessage(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const pinConfig = (config as any).pinMessageConfig;
    
    let messageId: number | null = null;

    switch (pinConfig?.targetType || 'last_bot_message') {
      case 'last_bot_message':
        messageId = execution.context.variables._lastBotMessageId;
        break;
      case 'variable':
        messageId = execution.context.variables[pinConfig.messageIdVariable || ''];
        break;
      case 'specific_id':
        messageId = pinConfig.specificMessageId;
        break;
    }

    if (!messageId) {
      return { success: false, error: 'No message ID found to pin' };
    }

    const success = await pinChatMessage(ctx.chatId, messageId, {
      disableNotification: pinConfig?.disableNotification ?? true,
    });

    logger.info('flow', {
      action: 'pin_message',
      chatId: ctx.chatId,
      messageId,
      success,
    });

    return { success };
  }

  /**
   * Unpin a message
   */
  private async executeUnpinMessage(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const unpinConfig = (config as any).pinMessageConfig;
    
    let messageId: number | undefined;

    if (unpinConfig?.targetType === 'specific_id' && unpinConfig.specificMessageId) {
      messageId = unpinConfig.specificMessageId;
    } else if (unpinConfig?.targetType === 'variable' && unpinConfig.messageIdVariable) {
      messageId = execution.context.variables[unpinConfig.messageIdVariable];
    }

    const success = await unpinChatMessage(ctx.chatId, messageId);

    logger.info('flow', {
      action: 'unpin_message',
      chatId: ctx.chatId,
      messageId,
      success,
    });

    return { success };
  }

  /**
   * Save a message ID to a variable
   */
  private executeSaveMessageId(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): ExecutionResult {
    const saveConfig = (config as any).saveMessageIdConfig;
    if (!saveConfig?.variableName) {
      return { success: false, error: 'No variable name provided' };
    }

    let messageId: number | string | null = null;

    switch (saveConfig.messageSource) {
      case 'last_bot_message':
        messageId = execution.context.variables._lastBotMessageId ?? null;
        break;
      case 'last_user_message':
        messageId = ctx.message?.id ?? null;
        break;
    }

    if (messageId) {
      execution.context.variables[saveConfig.variableName] = messageId;
      execution.markModified('context.variables');
    }

    logger.info('flow', {
      action: 'save_message_id',
      variableName: saveConfig.variableName,
      messageId,
    });

    return { success: true };
  }

  /**
   * Delay execution for a specified time (without pausing the flow)
   */
  private async executeDelayAction(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const delayConfig = (config as any).delayActionConfig;
    const delaySeconds = delayConfig?.delaySeconds || 0;
    const showTyping = delayConfig?.showTyping ?? false;

    if (delaySeconds > 0) {
      if (showTyping) {
        // Simulate typing during the delay
        await simulateTyping(ctx.chatId, delaySeconds * 1000);
      } else {
        // Just wait
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    logger.info('flow', {
      action: 'delay_action',
      delaySeconds,
      showTyping,
    });

    return { success: true };
  }

  /**
   * Send a location
   */
  private async executeSendLocation(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const locConfig = (config as any).locationConfig;
    if (!locConfig) {
      return { success: false, error: 'No location config provided' };
    }

    const latitude = parseFloat(this.resolvePlaceholders(locConfig.latitude || '0', ctx));
    const longitude = parseFloat(this.resolvePlaceholders(locConfig.longitude || '0', ctx));

    const msgId = await sendLocation(ctx.chatId, latitude, longitude, {
      livePeriod: locConfig.livePeriod,
    });

    if (msgId) {
      execution.context.variables._lastBotMessageId = msgId;
      execution.markModified('context.variables');
    }

    logger.info('flow', {
      action: 'send_location',
      chatId: ctx.chatId,
      latitude,
      longitude,
    });

    return { success: !!msgId };
  }

  /**
   * Send a contact
   */
  private async executeSendContact(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const contactConfig = (config as any).contactConfig;
    if (!contactConfig) {
      return { success: false, error: 'No contact config provided' };
    }

    const phoneNumber = this.resolvePlaceholders(contactConfig.phoneNumber || '', ctx);
    const firstName = this.resolvePlaceholders(contactConfig.firstName || '', ctx);
    const lastName = contactConfig.lastName 
      ? this.resolvePlaceholders(contactConfig.lastName, ctx) 
      : undefined;

    const msgId = await sendContact(ctx.chatId, phoneNumber, firstName, {
      lastName,
    });

    if (msgId) {
      execution.context.variables._lastBotMessageId = msgId;
      execution.markModified('context.variables');
    }

    logger.info('flow', {
      action: 'send_contact',
      chatId: ctx.chatId,
      phoneNumber,
    });

    return { success: !!msgId };
  }

  /**
   * Send a sticker
   */
  private async executeSendSticker(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const stickerConfig = (config as any).stickerConfig;
    if (!stickerConfig) {
      return { success: false, error: 'No sticker config provided' };
    }

    const sticker = stickerConfig.stickerSource === 'url' 
      ? stickerConfig.stickerUrl 
      : stickerConfig.stickerId;

    if (!sticker) {
      return { success: false, error: 'No sticker ID or URL provided' };
    }

    const msgId = await sendSticker(ctx.chatId, sticker);

    if (msgId) {
      execution.context.variables._lastBotMessageId = msgId;
      execution.markModified('context.variables');
    }

    logger.info('flow', {
      action: 'send_sticker',
      chatId: ctx.chatId,
      stickerSource: stickerConfig.stickerSource,
    });

    return { success: !!msgId };
  }

  /**
   * Copy a message to another chat or same chat
   */
  private async executeCopyMessage(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    // For now, copy the last user message
    const sourceMessageId = ctx.message?.id ? parseInt(ctx.message.id, 10) : null;
    
    if (!sourceMessageId) {
      return { success: false, error: 'No source message ID found' };
    }

    const msgId = await copyMessage(ctx.chatId, ctx.chatId, sourceMessageId);

    if (msgId) {
      execution.context.variables._lastBotMessageId = msgId;
      execution.markModified('context.variables');
    }

    logger.info('flow', {
      action: 'copy_message',
      chatId: ctx.chatId,
      sourceMessageId,
    });

    return { success: !!msgId };
  }

  /**
   * Execute a sub-flow
   */
  private async executeRunSubflow(
    config: ActionConfig,
    ctx: ExecutionContext,
    execution: IFlowExecution
  ): Promise<ExecutionResult> {
    const subflowConfig = (config as any).subflowConfig;
    if (!subflowConfig?.flowId) {
      return { success: false, error: 'No subflow ID provided' };
    }

    // Find the subflow
    const subflow = await Flow.findById(subflowConfig.flowId);
    if (!subflow) {
      return { success: false, error: `Subflow not found: ${subflowConfig.flowId}` };
    }

    if (!subflow.enabled || subflow.status !== 'published') {
      return { success: false, error: 'Subflow is not enabled or published' };
    }

    // Find trigger node
    const triggerNode = subflow.nodes.find(n => n.type === 'trigger');
    if (!triggerNode) {
      return { success: false, error: 'Subflow has no trigger node' };
    }

    // Build context for subflow
    const subflowContext: ExecutionContext = {
      ...ctx,
      startedAt: new Date(),
      lastActiveAt: new Date(),
    };

    // Pass variables if configured
    if (subflowConfig.passVariables) {
      if (subflowConfig.variablesToPass && subflowConfig.variablesToPass.length > 0) {
        // Only pass specified variables
        subflowContext.variables = {};
        for (const varName of subflowConfig.variablesToPass) {
          if (execution.context.variables[varName] !== undefined) {
            subflowContext.variables[varName] = execution.context.variables[varName];
          }
        }
      } else {
        // Pass all variables
        subflowContext.variables = { ...execution.context.variables };
      }
    } else {
      subflowContext.variables = {};
    }

    logger.info('flow', {
      action: 'run_subflow_start',
      parentExecutionId: execution._id.toString(),
      subflowId: subflow._id.toString(),
      subflowName: subflow.name,
    });

    if (subflowConfig.waitForCompletion) {
      // Execute subflow synchronously
      const subExecution = await this.startExecution(subflow, subflowContext, triggerNode.id);
      
      // Wait for completion (with timeout)
      const maxWait = 30000; // 30 seconds
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWait) {
        const updatedExecution = await FlowExecution.findById(subExecution._id);
        if (!updatedExecution) break;
        
        if (['completed', 'failed', 'cancelled'].includes(updatedExecution.status)) {
          // Copy variables back to parent
          if (subflowConfig.passVariables) {
            Object.assign(execution.context.variables, updatedExecution.context.variables);
            execution.markModified('context.variables');
          }
          
          return {
            success: updatedExecution.status === 'completed',
            output: { subflowStatus: updatedExecution.status },
          };
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      logger.warn('flow', {
        action: 'run_subflow_timeout',
        subflowId: subflow._id.toString(),
      });
      
      return { success: false, error: 'Subflow execution timeout' };
    } else {
      // Execute subflow asynchronously (fire and forget)
      this.startExecution(subflow, subflowContext, triggerNode.id).catch(err => {
        logger.error('flow', {
          action: 'run_subflow_async_error',
          error: String(err),
        });
      });
      
      return { success: true };
    }
  }

  /**
   * Build inline keyboard from config
   */
  private buildInlineKeyboardFromConfig(kbConfig: any): InlineKeyboardMarkup {
    if (!kbConfig || !kbConfig.rows) {
      return { inline_keyboard: [] };
    }

    return {
      inline_keyboard: kbConfig.rows.map((row: any) =>
        row.buttons.map((btn: any) => ({
          text: btn.text,
          callback_data: btn.callbackData || btn.id,
          url: btn.url,
        }))
      ),
    };
  }

  /**
   * Describe what an action would do (for simulation)
   */
  private describeAction(config: ActionConfig, ctx: ExecutionContext): string {
    switch (config.actionType) {
      case 'send_message':
        const msg = this.resolvePlaceholders(config.messageContent || '', ctx);
        return `Send message: "${msg.substring(0, 100)}${msg.length > 100 ? '...' : ''}"`;
      case 'schedule_message':
        return `Schedule message in ${config.scheduleDelay} minutes`;
      case 'transfer_chat':
        return `Transfer chat to agent ${config.targetAgentId}`;
      case 'assign_agent':
        return `Assign to agent ${config.targetAgentId}`;
      case 'change_category':
        return `Change category to "${config.categoryName}"`;
      case 'add_tag':
        return `Add tag "${config.tagName}"`;
      case 'remove_tag':
        return `Remove tag "${config.tagName}"`;
      case 'create_note':
        return `Create note: "${config.noteContent?.substring(0, 50)}..."`;
      case 'block_user':
        return `Block user for ${config.blockDurationHours} hours`;
      case 'call_webhook':
        return `Call webhook: ${config.webhookMethod} ${config.webhookUrl}`;
      case 'set_custom_field':
        return `Set field "${config.customFieldName}" = "${config.customFieldValue}"`;
      case 'close_chat':
        return 'Close the chat';
      case 'add_to_queue':
        return `Add to queue with priority ${config.queuePriority}`;
      // New Telegram actions
      case 'edit_message':
        return 'Edit a previously sent message';
      case 'delete_message':
        return 'Delete a message';
      case 'edit_keyboard':
        return 'Edit inline keyboard of a message';
      case 'remove_keyboard':
        return 'Remove inline keyboard from message';
      case 'send_reply_keyboard':
        return 'Send a reply keyboard menu';
      case 'remove_reply_keyboard':
        return 'Remove reply keyboard';
      case 'send_chat_action':
        return 'Show typing or other action';
      case 'pin_message':
        return 'Pin a message';
      case 'unpin_message':
        return 'Unpin a message';
      case 'save_message_id':
        return 'Save message ID to variable';
      case 'delay_action':
        const delay = (config as any).delayActionConfig?.delaySeconds || 0;
        return `Wait ${delay} seconds`;
      case 'send_location':
        return 'Send a location';
      case 'send_contact':
        return 'Send a contact';
      case 'send_sticker':
        return 'Send a sticker';
      case 'copy_message':
        return 'Copy a message';
      case 'run_subflow':
        return `Execute subflow: ${(config as any).subflowConfig?.flowId}`;
      default:
        return `Execute action: ${config.actionType}`;
    }
  }
}

// ============= SINGLETON EXPORT =============

export const flowEngine = FlowEngine.getInstance();
export default flowEngine;

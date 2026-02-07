/**
 * WebChat Service
 * Handles web chat sessions, visitors, and message processing
 */

import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { WebChatProject, type IWebChatProject } from '../database/models/WebChatProject.js';
import { WebVisitor, type IWebVisitor } from '../database/models/WebVisitor.js';
import { ChatSession, type IChatSession, type ChannelType } from '../database/models/ChatSession.js';
import { Message, type IMessage } from '../database/models/Message.js';
import { Types } from 'mongoose';
import { logger } from './logger.js';
import { getOnlineAgents } from './agent.service.js';
import { logActivity } from './activity-log.service.js';

// ============= PROJECT MANAGEMENT =============

/**
 * Create a new WebChat project
 */
export async function createWebChatProject(
  data: {
    name: string;
    description?: string;
    allowedDomains: string[];
    createdBy: string;
    config?: Partial<IWebChatProject['config']>;
  }
): Promise<IWebChatProject> {
  const projectId = `proj_${uuidv4().slice(0, 8)}`;
  const apiKey = `wck_${crypto.randomBytes(32).toString('hex')}`;

  const project = await WebChatProject.create({
    projectId,
    name: data.name,
    description: data.description,
    allowedDomains: data.allowedDomains,
    apiKey,
    createdBy: new Types.ObjectId(data.createdBy),
    config: {
      theme: 'auto',
      position: 'right',
      primaryColor: '#4F46E5',
      headerText: 'Soporte en vivo',
      welcomeMessage: '¡Hola! 👋 ¿En qué podemos ayudarte hoy?',
      offlineMessage: 'No hay agentes disponibles. Deja tu mensaje y te responderemos pronto.',
      inputPlaceholder: 'Escribe un mensaje...',
      requireEmail: false,
      requireName: false,
      collectPhone: false,
      showAgentPhotos: true,
      showAgentNames: true,
      enableAttachments: true,
      enableEmoji: true,
      enableSurvey: true,
      enableTypingIndicator: true,
      enableSoundNotifications: true,
      bubbleIcon: 'chat',
      autoOpenDelay: 0,
      hideWhenOffline: false,
      showPoweredBy: true,
      ...data.config,
    },
  });

  logger.info('webchat', {
    action: 'createProject',
    projectId,
    name: data.name,
  });

  return project;
}

/**
 * Get project by projectId
 */
export async function getProjectById(projectId: string): Promise<IWebChatProject | null> {
  return WebChatProject.findOne({ projectId, isActive: true });
}

/**
 * Get project by API key
 */
export async function getProjectByApiKey(apiKey: string): Promise<IWebChatProject | null> {
  return WebChatProject.findOne({ apiKey, isActive: true });
}

/**
 * Validate project origin (CORS)
 */
export function validateProjectOrigin(project: IWebChatProject, origin: string): boolean {
  if (project.allowedDomains.length === 0) {
    return true; // No restrictions
  }

  // Check if origin matches any allowed domain
  const originHost = new URL(origin).hostname;
  return project.allowedDomains.some(domain => {
    if (domain.startsWith('*.')) {
      // Wildcard domain
      const baseDomain = domain.slice(2);
      return originHost.endsWith(baseDomain);
    }
    return originHost === domain || origin.includes(domain);
  });
}

/**
 * Update project config
 */
export async function updateProjectConfig(
  projectId: string,
  config: Partial<IWebChatProject['config']>
): Promise<IWebChatProject | null> {
  return WebChatProject.findOneAndUpdate(
    { projectId },
    { $set: { config } },
    { new: true }
  );
}

/**
 * List all projects
 */
export async function listProjects(): Promise<IWebChatProject[]> {
  return WebChatProject.find({ isActive: true }).sort({ createdAt: -1 });
}

/**
 * Regenerate API key
 */
export async function regenerateApiKey(projectId: string): Promise<string | null> {
  const newApiKey = `wck_${crypto.randomBytes(32).toString('hex')}`;
  
  const project = await WebChatProject.findOneAndUpdate(
    { projectId },
    { apiKey: newApiKey },
    { new: true }
  );

  return project ? newApiKey : null;
}

// ============= VISITOR MANAGEMENT =============

/**
 * Generate unique visitor ID
 */
export function generateVisitorId(): string {
  return `vis_${uuidv4().replace(/-/g, '')}`;
}

/**
 * Get or create visitor
 */
export async function getOrCreateVisitor(
  projectId: string,
  visitorId: string,
  visitorData?: {
    name?: string;
    email?: string;
    phone?: string;
    userAgent?: string;
    ipAddress?: string;
    currentPageUrl?: string;
    currentPageTitle?: string;
    referrerUrl?: string;
  }
): Promise<IWebVisitor> {
  let visitor = await WebVisitor.findOne({ projectId, visitorId });

  if (!visitor) {
    // Parse user agent for device info
    const deviceInfo = parseUserAgent(visitorData?.userAgent);

    visitor = await WebVisitor.create({
      visitorId,
      projectId,
      name: visitorData?.name,
      email: visitorData?.email,
      phone: visitorData?.phone,
      userAgent: visitorData?.userAgent,
      browser: deviceInfo.browser,
      browserVersion: deviceInfo.browserVersion,
      os: deviceInfo.os,
      osVersion: deviceInfo.osVersion,
      device: deviceInfo.device,
      ipAddress: visitorData?.ipAddress,
      currentPageUrl: visitorData?.currentPageUrl,
      currentPageTitle: visitorData?.currentPageTitle,
      referrerUrl: visitorData?.referrerUrl,
      firstVisit: new Date(),
      lastVisit: new Date(),
      totalVisits: 1,
      totalPageViews: visitorData?.currentPageUrl ? 1 : 0,
      pagesViewed: visitorData?.currentPageUrl ? [{
        url: visitorData.currentPageUrl,
        title: visitorData.currentPageTitle || '',
        visitedAt: new Date(),
      }] : [],
    });

    logger.info('webchat', {
      action: 'createVisitor',
      projectId,
      visitorId,
    });
  } else {
    // Update existing visitor
    visitor.lastVisit = new Date();
    visitor.totalVisits += 1;
    
    if (visitorData?.name) visitor.name = visitorData.name;
    if (visitorData?.email) visitor.email = visitorData.email;
    if (visitorData?.phone) visitor.phone = visitorData.phone;
    if (visitorData?.currentPageUrl) {
      visitor.currentPageUrl = visitorData.currentPageUrl;
      visitor.currentPageTitle = visitorData.currentPageTitle;
      visitor.totalPageViews += 1;
      visitor.pagesViewed.push({
        url: visitorData.currentPageUrl,
        title: visitorData.currentPageTitle || '',
        visitedAt: new Date(),
      });
    }

    await visitor.save();
  }

  return visitor;
}

/**
 * Update visitor page
 */
export async function updateVisitorPage(
  visitorId: string,
  pageUrl: string,
  pageTitle: string
): Promise<void> {
  await WebVisitor.updateOne(
    { visitorId },
    {
      $set: {
        currentPageUrl: pageUrl,
        currentPageTitle: pageTitle,
        lastVisit: new Date(),
      },
      $inc: { totalPageViews: 1 },
      $push: {
        pagesViewed: {
          url: pageUrl,
          title: pageTitle,
          visitedAt: new Date(),
        },
      },
    }
  );
}

/**
 * Parse user agent to extract device info
 */
function parseUserAgent(userAgent?: string): {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: 'desktop' | 'mobile' | 'tablet';
} {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      browserVersion: '',
      os: 'Unknown',
      osVersion: '',
      device: 'desktop',
    };
  }

  // Simple UA parsing (could use a library for more accurate parsing)
  let browser = 'Unknown';
  let browserVersion = '';
  let os = 'Unknown';
  let osVersion = '';
  let device: 'desktop' | 'mobile' | 'tablet' = 'desktop';

  // Browser detection
  if (userAgent.includes('Chrome/')) {
    browser = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    browserVersion = match?.[1] || '';
  } else if (userAgent.includes('Firefox/')) {
    browser = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    browserVersion = match?.[1] || '';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
    const match = userAgent.match(/Version\/(\d+)/);
    browserVersion = match?.[1] || '';
  } else if (userAgent.includes('Edge/') || userAgent.includes('Edg/')) {
    browser = 'Edge';
    const match = userAgent.match(/Edg?\/(\d+)/);
    browserVersion = match?.[1] || '';
  }

  // OS detection
  if (userAgent.includes('Windows')) {
    os = 'Windows';
    if (userAgent.includes('Windows NT 10')) osVersion = '10';
    else if (userAgent.includes('Windows NT 11')) osVersion = '11';
  } else if (userAgent.includes('Mac OS X')) {
    os = 'macOS';
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    osVersion = match?.[1]?.replace('_', '.') || '';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
    const match = userAgent.match(/Android (\d+)/);
    osVersion = match?.[1] || '';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
    const match = userAgent.match(/OS (\d+)/);
    osVersion = match?.[1] || '';
  }

  // Device detection
  if (userAgent.includes('Mobile') || userAgent.includes('Android') && !userAgent.includes('Tablet')) {
    device = 'mobile';
  } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
    device = 'tablet';
  }

  return { browser, browserVersion, os, osVersion, device };
}

// ============= SESSION MANAGEMENT =============

/**
 * Generate session ID for web chat
 */
function generateWebSessionId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().slice(0, 6).toUpperCase();
  return `WC-${timestamp.slice(-4)}-${random}`;
}

/**
 * Get or create web chat session
 */
export async function getOrCreateWebSession(
  visitor: IWebVisitor,
  projectId: string
): Promise<IChatSession> {
  // Check for existing active session
  let session = await ChatSession.findOne({
    webVisitor: visitor._id,
    channel: 'web',
    status: { $in: ['bot', 'waiting', 'human', 'queued'] },
  });

  if (session) {
    // Update visitor reference on session
    await WebVisitor.updateOne(
      { _id: visitor._id },
      { currentSessionId: session.sessionId }
    );
    return session;
  }

  // Create new session
  session = await ChatSession.create({
    sessionId: generateWebSessionId(),
    channel: 'web',
    channelMetadata: {
      visitorId: visitor.visitorId,
      projectId,
      currentPageUrl: visitor.currentPageUrl,
      browser: visitor.browser,
      os: visitor.os,
      device: visitor.device,
      country: visitor.country,
    },
    webVisitor: visitor._id,
    externalChatId: visitor.visitorId,
    status: 'waiting', // Web chats go directly to waiting/queue
    priority: 'medium',
    tags: [],
    reopenCount: 0,
  });

  // Update visitor and project stats
  await Promise.all([
    WebVisitor.updateOne(
      { _id: visitor._id },
      {
        currentSessionId: session.sessionId,
        lastChatAt: new Date(),
        $inc: { totalConversations: 1 },
      }
    ),
    WebChatProject.updateOne(
      { projectId },
      {
        lastActivityAt: new Date(),
        $inc: { totalConversations: 1 },
      }
    ),
  ]);

  // Log session creation
  await logActivity({
    sessionId: session.sessionId,
    action: 'session_created',
    actorType: 'user',
    actorId: visitor._id.toString(),
    actorName: visitor.name || 'Web Visitor',
    metadata: {
      channel: 'web',
      projectId,
      visitorId: visitor.visitorId,
      pageUrl: visitor.currentPageUrl,
    },
    description: `Web chat started from ${visitor.currentPageUrl || 'unknown page'}`,
  });

  logger.info('webchat', {
    action: 'createSession',
    sessionId: session.sessionId,
    visitorId: visitor.visitorId,
    projectId,
  });

  return session;
}

/**
 * Get session by visitor ID
 */
export async function getSessionByVisitorId(visitorId: string): Promise<IChatSession | null> {
  const visitor = await WebVisitor.findOne({ visitorId });
  if (!visitor) return null;

  return ChatSession.findOne({
    webVisitor: visitor._id,
    status: { $in: ['bot', 'waiting', 'human', 'queued'] },
  }).populate('assignedAgent');
}

/**
 * Get session with messages
 */
export async function getSessionWithMessages(
  sessionId: string,
  limit = 50
): Promise<{ session: IChatSession | null; messages: IMessage[] }> {
  const session = await ChatSession.findOne({ sessionId })
    .populate('assignedAgent')
    .populate('webVisitor');

  if (!session) {
    return { session: null, messages: [] };
  }

  const messages = await Message.find({ session: session._id })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('senderAgent');

  return { session, messages: messages.reverse() };
}

// ============= MESSAGE HANDLING =============

/**
 * Add message from web visitor
 */
export async function addWebMessage(
  sessionId: string,
  content: string,
  contentType: string = 'text',
  media?: {
    type: string;
    url: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }
): Promise<IMessage | null> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session) return null;

  const message = await Message.create({
    session: session._id,
    channel: 'web',
    sender: 'user',
    content,
    messageType: contentType,
    mediaUrl: media?.url,
    media: media ? {
      type: media.type as any,
      url: media.url,
      fileName: media.fileName,
      fileSize: media.fileSize,
      mimeType: media.mimeType,
    } : undefined,
    externalMessageId: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    deliveryStatus: 'delivered',
    deliveredAt: new Date(),
  });

  // Update session
  await ChatSession.updateOne(
    { _id: session._id },
    {
      lastMessage: content.substring(0, 100),
      lastMessageAt: new Date(),
      $inc: { unreadCount: 1 },
    }
  );

  // Update project stats
  if (session.channelMetadata?.projectId) {
    await WebChatProject.updateOne(
      { projectId: session.channelMetadata.projectId },
      {
        lastActivityAt: new Date(),
        $inc: { totalMessages: 1 },
      }
    );
  }

  return message;
}

/**
 * Add message from agent
 */
export async function addAgentWebMessage(
  sessionId: string,
  agentId: string,
  agentName: string,
  content: string,
  contentType: string = 'text',
  media?: {
    type: string;
    url: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }
): Promise<IMessage | null> {
  const session = await ChatSession.findOne({ sessionId });
  if (!session) return null;

  const message = await Message.create({
    session: session._id,
    channel: 'web',
    sender: 'agent',
    senderAgent: new Types.ObjectId(agentId),
    senderName: agentName,
    content,
    messageType: contentType,
    mediaUrl: media?.url,
    media: media ? {
      type: media.type as any,
      url: media.url,
      fileName: media.fileName,
      fileSize: media.fileSize,
      mimeType: media.mimeType,
    } : undefined,
    externalMessageId: `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    deliveryStatus: 'sent',
  });

  // Update session
  await ChatSession.updateOne(
    { _id: session._id },
    {
      lastMessage: content.substring(0, 100),
      lastMessageAt: new Date(),
    }
  );

  return message;
}

// ============= ONLINE STATUS =============

/**
 * Check if any agents are online
 */
export async function areAgentsOnline(): Promise<boolean> {
  const onlineAgents = await getOnlineAgents();
  return onlineAgents.length > 0;
}

/**
 * Get project online status
 */
export async function getProjectOnlineStatus(projectId: string): Promise<{
  isOnline: boolean;
  agentCount: number;
}> {
  const project = await WebChatProject.findOne({ projectId, isActive: true });
  
  if (!project || !project.isOnline) {
    return { isOnline: false, agentCount: 0 };
  }

  const onlineAgents = await getOnlineAgents();
  
  return {
    isOnline: onlineAgents.length > 0,
    agentCount: onlineAgents.length,
  };
}

// ============= SURVEY HANDLING =============

/**
 * Submit web survey response
 */
export async function submitWebSurvey(
  sessionId: string,
  rating: number,
  comment?: string
): Promise<boolean> {
  const result = await ChatSession.updateOne(
    { sessionId },
    {
      $set: {
        'webSurvey.answered': true,
        'webSurvey.rating': rating,
        'webSurvey.comment': comment,
        'webSurvey.answeredAt': new Date(),
        rating,
        feedback: comment,
        satisfaction: rating >= 4 ? 'positive' : rating >= 3 ? 'neutral' : 'negative',
      },
    }
  );

  logger.info('webchat', {
    action: 'submitSurvey',
    sessionId,
    rating,
    hasComment: !!comment,
  });

  return result.modifiedCount > 0;
}

/**
 * WebChat Socket Handler
 * Handles real-time communication with web chat widget
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from './logger.js';
import { setWebChatSocketIO } from '../channels/webchat.adapter.js';
import {
  getProjectById,
  getProjectByApiKey,
  validateProjectOrigin,
  getOrCreateVisitor,
  getOrCreateWebSession,
  getSessionByVisitorId,
  getSessionWithMessages,
  addWebMessage,
  updateVisitorPage,
  submitWebSurvey,
  areAgentsOnline,
  generateVisitorId,
} from './webchat.service.js';
import { assignAgent, getQueuedSessions } from './chat.service.js';
import { getOnlineAgents } from './agent.service.js';
import { triggerMessageReceived, triggerKeywordDetected } from './flowTriggers.service.js';
import {
  checkRateLimit,
  isIPBlocked,
  trackIPConnection,
  isVisitorBlocked,
  analyzeMessage,
  trackAbuseScore,
  validateOrigin,
  logSecurityEvent,
} from './webchat-security.service.js';

// Connected visitors map
const connectedVisitors = new Map<string, {
  socketId: string;
  projectId: string;
  sessionId?: string;
  connectedAt: Date;
}>();

// Main dashboard socket reference (for emitting to agents)
let dashboardIO: SocketServer | null = null;

/**
 * Set reference to dashboard Socket.IO
 */
export function setDashboardIO(io: SocketServer): void {
  dashboardIO = io;
}

/**
 * Initialize WebChat Socket.IO namespace
 */
export function initializeWebChatSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    path: '/webchat-socket',
    cors: {
      origin: '*', // Will validate per-project via security checks
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Set reference in adapter
  setWebChatSocketIO(io);

  logger.info('webchat-socket', {
    action: 'initialize',
    message: 'WebChat Socket.IO initialized',
  });

  io.on('connection', async (socket: Socket) => {
    const clientIP = socket.handshake.headers['x-forwarded-for']?.toString().split(',')[0] 
      || socket.handshake.address;

    // === SECURITY: Check if IP is blocked ===
    if (await isIPBlocked(clientIP)) {
      logSecurityEvent({
        type: 'ip_block',
        ip: clientIP,
        details: { action: 'connection_rejected', reason: 'ip_blocked' },
      });
      socket.emit('web:error', { code: 'BLOCKED', message: 'Access denied' });
      socket.disconnect();
      return;
    }

    // === SECURITY: Track IP connection flood ===
    const ipTrack = trackIPConnection(clientIP);
    if (!ipTrack.allowed) {
      logSecurityEvent({
        type: 'rate_limit',
        ip: clientIP,
        details: { action: 'connection_flood', connectionCount: ipTrack.count },
      });
      socket.emit('web:error', { code: 'RATE_LIMITED', message: 'Too many connections' });
      socket.disconnect();
      return;
    }

    logger.info('webchat-socket', {
      action: 'connection',
      socketId: socket.id,
    });

    // Handle visitor connection
    socket.on('web:connect', async (data: {
      visitorId?: string;
      projectId: string;
      apiKey?: string;
      user?: { name?: string; email?: string; phone?: string };
      pageUrl?: string;
      pageTitle?: string;
      referrer?: string;
      userAgent?: string;
    }) => {
      try {
        // === SECURITY: Rate limit connections per visitor ===
        if (data.visitorId) {
          const visitorRateLimit = await checkRateLimit(data.visitorId, 'connect:visitor');
          if (!visitorRateLimit.allowed) {
            logSecurityEvent({
              type: 'rate_limit',
              visitorId: data.visitorId,
              ip: clientIP,
              projectId: data.projectId,
              details: { action: 'visitor_connect_rate_limit' },
            });
            socket.emit('web:error', { code: 'RATE_LIMITED', message: 'Too many reconnections' });
            socket.disconnect();
            return;
          }
        }

        // === SECURITY: Check if visitor is blocked ===
        if (data.visitorId && isVisitorBlocked(data.visitorId)) {
          logSecurityEvent({
            type: 'abuse',
            visitorId: data.visitorId,
            ip: clientIP,
            projectId: data.projectId,
            details: { action: 'blocked_visitor_attempt' },
          });
          socket.emit('web:error', { code: 'BLOCKED', message: 'Access denied' });
          socket.disconnect();
          return;
        }

        // Validate project
        let project = data.apiKey 
          ? await getProjectByApiKey(data.apiKey)
          : await getProjectById(data.projectId);

        if (!project) {
          socket.emit('web:error', {
            code: 'INVALID_PROJECT',
            message: 'Invalid project ID or API key',
          });
          socket.disconnect();
          return;
        }

        // Validate origin against allowed domains
        const origin = socket.handshake.headers.origin;
        const originValidation = validateOrigin(origin as string | undefined, project.allowedDomains);
        if (!originValidation.valid) {
          logSecurityEvent({
            type: 'domain_reject',
            ip: clientIP,
            projectId: project.projectId,
            details: { 
              origin, 
              reason: originValidation.reason,
              allowedDomains: project.allowedDomains,
            },
          });
          socket.emit('web:error', {
            code: 'INVALID_ORIGIN',
            message: 'Origin not allowed',
          });
          socket.disconnect();
          return;
        }

        // Generate or use visitor ID
        const visitorId = data.visitorId || generateVisitorId();

        // Get or create visitor
        const visitor = await getOrCreateVisitor(project.projectId, visitorId, {
          name: data.user?.name,
          email: data.user?.email,
          phone: data.user?.phone,
          userAgent: data.userAgent || socket.handshake.headers['user-agent'],
          ipAddress: socket.handshake.address,
          currentPageUrl: data.pageUrl,
          currentPageTitle: data.pageTitle,
          referrerUrl: data.referrer,
        });

        // Get or create session
        const session = await getOrCreateWebSession(visitor, project.projectId);

        // Join visitor room
        socket.join(`webchat:${visitorId}`);

        // Store connection info
        connectedVisitors.set(visitorId, {
          socketId: socket.id,
          projectId: project.projectId,
          sessionId: session.sessionId,
          connectedAt: new Date(),
        });

        // Get existing messages
        const { messages } = await getSessionWithMessages(session.sessionId, 50);

        // Emit connected event with session info
        socket.emit('web:connected', {
          visitorId,
          sessionId: session.sessionId,
          projectConfig: {
            theme: project.config.theme,
            primaryColor: project.config.primaryColor,
            headerText: project.config.headerText,
            welcomeMessage: project.config.welcomeMessage,
            inputPlaceholder: project.config.inputPlaceholder,
            showAgentPhotos: project.config.showAgentPhotos,
            showAgentNames: project.config.showAgentNames,
            enableAttachments: project.config.enableAttachments,
            enableEmoji: project.config.enableEmoji,
            enableTypingIndicator: project.config.enableTypingIndicator,
            showPoweredBy: project.config.showPoweredBy,
          },
          existingMessages: messages.map(m => ({
            id: m._id.toString(),
            sessionId: session.sessionId,
            channel: 'web',
            senderType: m.sender,
            senderName: m.senderName,
            contentType: m.messageType,
            content: m.content,
            media: m.media,
            timestamp: m.createdAt.toISOString(),
            isRead: m.isRead,
          })),
          isOnline: await areAgentsOnline(),
          agent: session.assignedAgent ? {
            id: (session.assignedAgent as any)._id?.toString(),
            name: (session.assignedAgent as any).name,
          } : null,
        });

        // Notify dashboard about new web chat if it's a new session
        if (dashboardIO && messages.length === 0) {
          dashboardIO.emit('session:new', {
            sessionId: session.sessionId,
            channel: 'web',
            status: session.status,
            visitorId,
            visitorName: visitor.name || 'Web Visitor',
            pageUrl: visitor.currentPageUrl,
            createdAt: session.createdAt,
          });
        }

        logger.info('webchat-socket', {
          action: 'visitor_connected',
          visitorId,
          sessionId: session.sessionId,
          projectId: project.projectId,
        });

      } catch (error) {
        logger.error('webchat-socket', {
          action: 'connect_error',
          error: String(error),
        });
        socket.emit('web:error', {
          code: 'CONNECTION_ERROR',
          message: 'Failed to establish connection',
        });
      }
    });

    // Handle incoming messages from visitor
    socket.on('web:message:send', async (data: {
      content: string;
      contentType?: string;
      media?: {
        type: string;
        url: string;
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
      };
    }) => {
      try {
        // Find visitor by socket
        let visitorId: string | undefined;
        let projectId: string | undefined;
        for (const [vid, info] of connectedVisitors.entries()) {
          if (info.socketId === socket.id) {
            visitorId = vid;
            projectId = info.projectId;
            break;
          }
        }

        if (!visitorId) {
          socket.emit('web:error', {
            code: 'NOT_CONNECTED',
            message: 'Visitor not connected',
          });
          return;
        }

        const connectionInfo = connectedVisitors.get(visitorId);
        if (!connectionInfo?.sessionId) {
          socket.emit('web:error', {
            code: 'NO_SESSION',
            message: 'No active session',
          });
          return;
        }

        // === SECURITY: Rate limit messages ===
        const msgRateLimit = await checkRateLimit(connectionInfo.sessionId, 'message');
        if (!msgRateLimit.allowed) {
          logSecurityEvent({
            type: 'rate_limit',
            visitorId,
            projectId,
            details: { action: 'message_rate_limit', remaining: msgRateLimit.remaining },
          });
          socket.emit('web:error', { code: 'RATE_LIMITED', message: 'Too many messages. Please slow down.' });
          return;
        }

        // === SECURITY: Burst protection ===
        const burstLimit = await checkRateLimit(connectionInfo.sessionId, 'message:burst');
        if (!burstLimit.allowed) {
          socket.emit('web:error', { code: 'RATE_LIMITED', message: 'Please wait a moment before sending another message.' });
          return;
        }

        // === SECURITY: Analyze message content for abuse ===
        const contentAnalysis = analyzeMessage(data.content);
        if (contentAnalysis.blocked) {
          logSecurityEvent({
            type: 'abuse',
            visitorId,
            projectId,
            details: { 
              action: 'message_blocked',
              score: contentAnalysis.score,
              reasons: contentAnalysis.reasons,
            },
          });
          
          // Track abuse score
          await trackAbuseScore(visitorId, contentAnalysis.score, contentAnalysis.reasons);
          
          socket.emit('web:error', { code: 'MESSAGE_REJECTED', message: 'Message cannot be sent.' });
          return;
        }

        // Track abuse score even for non-blocked messages
        if (contentAnalysis.score > 0) {
          await trackAbuseScore(visitorId, contentAnalysis.score, contentAnalysis.reasons);
        }

        // Add message to database
        const message = await addWebMessage(
          connectionInfo.sessionId,
          data.content,
          data.contentType || 'text',
          data.media
        );

        if (!message) {
          socket.emit('web:error', {
            code: 'MESSAGE_FAILED',
            message: 'Failed to save message',
          });
          return;
        }

        // Emit confirmation to visitor
        socket.emit('web:message:sent', {
          id: message._id.toString(),
          timestamp: message.createdAt.toISOString(),
        });

        // Notify dashboard about new message
        if (dashboardIO) {
          dashboardIO.emit('message:new', {
            _id: message._id.toString(),
            sessionId: connectionInfo.sessionId,
            session: message.session,
            channel: 'web',
            sender: 'user',
            content: data.content,
            messageType: data.contentType || 'text',
            media: data.media,
            createdAt: message.createdAt,
          });
        }

        // Trigger flow engine
        const session = await getSessionByVisitorId(visitorId);
        if (session) {
          // Fire message received trigger - pass full session and message object
          triggerMessageReceived(session, {
            content: data.content,
            messageType: 'text',
          });

          // Check for keywords
          triggerKeywordDetected(session, {
            content: data.content,
            messageType: 'text',
          });
        }

        logger.info('webchat-socket', {
          action: 'message_received',
          visitorId,
          sessionId: connectionInfo.sessionId,
          contentType: data.contentType || 'text',
        });

      } catch (error) {
        logger.error('webchat-socket', {
          action: 'message_error',
          error: String(error),
        });
        socket.emit('web:error', {
          code: 'MESSAGE_ERROR',
          message: 'Failed to process message',
        });
      }
    });

    // Handle typing indicator from visitor
    socket.on('web:typing:start', () => {
      // Find visitor and notify agent
      for (const [visitorId, info] of connectedVisitors.entries()) {
        if (info.socketId === socket.id && info.sessionId && dashboardIO) {
          dashboardIO.emit('typing:start', {
            sessionId: info.sessionId,
            userId: visitorId,
          });
          break;
        }
      }
    });

    socket.on('web:typing:stop', () => {
      for (const [visitorId, info] of connectedVisitors.entries()) {
        if (info.socketId === socket.id && info.sessionId && dashboardIO) {
          dashboardIO.emit('typing:stop', {
            sessionId: info.sessionId,
            userId: visitorId,
          });
          break;
        }
      }
    });

    // Handle message read
    socket.on('web:read', async (data: { messageIds: string[] }) => {
      // Mark messages as read
      // This would update the Message collection
    });

    // Handle page change
    socket.on('web:page:change', async (data: { url: string; title: string }) => {
      for (const [visitorId, info] of connectedVisitors.entries()) {
        if (info.socketId === socket.id) {
          await updateVisitorPage(visitorId, data.url, data.title);
          
          // Notify dashboard
          if (dashboardIO && info.sessionId) {
            dashboardIO.emit('session:updated', {
              sessionId: info.sessionId,
              channelMetadata: {
                currentPageUrl: data.url,
              },
            });
          }
          break;
        }
      }
    });

    // Handle survey submission
    socket.on('web:survey:submit', async (data: { rating: number; comment?: string }) => {
      for (const [visitorId, info] of connectedVisitors.entries()) {
        if (info.socketId === socket.id && info.sessionId) {
          await submitWebSurvey(info.sessionId, data.rating, data.comment);
          
          socket.emit('web:survey:thanks', {
            message: '¡Gracias por tu feedback!',
          });

          // Notify dashboard
          if (dashboardIO) {
            dashboardIO.emit('session:updated', {
              sessionId: info.sessionId,
              webSurvey: {
                answered: true,
                rating: data.rating,
                comment: data.comment,
              },
            });
          }
          break;
        }
      }
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      // Remove from connected visitors
      for (const [visitorId, info] of connectedVisitors.entries()) {
        if (info.socketId === socket.id) {
          connectedVisitors.delete(visitorId);
          
          logger.info('webchat-socket', {
            action: 'visitor_disconnected',
            visitorId,
            sessionId: info.sessionId,
            reason,
          });
          
          // Notify dashboard
          if (dashboardIO && info.sessionId) {
            dashboardIO.emit('session:visitor_offline', {
              sessionId: info.sessionId,
              visitorId,
            });
          }
          break;
        }
      }
    });
  });

  return io;
}

/**
 * Get connected visitor info
 */
export function getConnectedVisitor(visitorId: string) {
  return connectedVisitors.get(visitorId);
}

/**
 * Check if visitor is connected
 */
export function isVisitorConnected(visitorId: string): boolean {
  return connectedVisitors.has(visitorId);
}

/**
 * Get all connected visitors for a project
 */
export function getProjectVisitors(projectId: string): string[] {
  const visitors: string[] = [];
  for (const [visitorId, info] of connectedVisitors.entries()) {
    if (info.projectId === projectId) {
      visitors.push(visitorId);
    }
  }
  return visitors;
}

/**
 * Send message to visitor (called from dashboard)
 */
export function emitToVisitor(visitorId: string, event: string, data: any): boolean {
  const info = connectedVisitors.get(visitorId);
  if (!info) return false;

  // The webchat socket io instance handles this via room
  return true;
}

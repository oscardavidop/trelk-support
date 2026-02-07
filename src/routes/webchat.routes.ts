/**
 * WebChat Routes
 * API endpoints for web chat widget and project management
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  createWebChatProject,
  getProjectById,
  listProjects,
  updateProjectConfig,
  regenerateApiKey,
  getProjectOnlineStatus,
  getSessionWithMessages,
} from '../services/webchat.service.js';
import {
  getRecentSecurityEvents,
  blockIP,
  unblockVisitor,
  checkRateLimit,
} from '../services/webchat-security.service.js';
import { logger } from '../services/logger.js';

interface CreateProjectBody {
  name: string;
  description?: string;
  allowedDomains: string[];
  config?: Record<string, any>;
}

interface UpdateProjectBody {
  name?: string;
  description?: string;
  allowedDomains?: string[];
  config?: Record<string, any>;
  isOnline?: boolean;
}

export default async function webchatRoutes(fastify: FastifyInstance) {
  // ============= PUBLIC ENDPOINTS (for widget) =============
  
  /**
   * Get project config for widget initialization
   * No auth required - used by widget.js
   * Rate limited per IP
   */
  fastify.get('/widget/config/:projectId', async (request, reply) => {
    try {
      // Rate limit this endpoint
      const clientIP = request.headers['x-forwarded-for']?.toString().split(',')[0] || request.ip;
      const rateLimit = await checkRateLimit(clientIP, 'api:config');
      if (!rateLimit.allowed) {
        return reply.status(429).send({ ok: false, error: 'Too many requests' });
      }

      const { projectId } = request.params as { projectId: string };
      const project = await getProjectById(projectId);

      if (!project) {
        return reply.status(404).send({ ok: false, error: 'Project not found' });
      }

      // Validate origin
      const origin = request.headers.origin;
      if (origin && project.allowedDomains.length > 0) {
        const hostname = new URL(origin).hostname.toLowerCase();
        const allowed = project.allowedDomains.some(domain => {
          const normalizedDomain = domain.toLowerCase().trim();
          if (normalizedDomain.startsWith('*.')) {
            const baseDomain = normalizedDomain.slice(2);
            return hostname === baseDomain || hostname.endsWith(`.${baseDomain}`);
          }
          return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
        });
        
        if (!allowed) {
          logger.warn('webchat-routes', { action: 'origin_rejected', origin, projectId });
          return reply.status(403).send({ ok: false, error: 'Origin not allowed' });
        }
      }

      const { isOnline, agentCount } = await getProjectOnlineStatus(projectId);

      return reply.send({
        ok: true,
        config: {
          theme: project.config.theme,
          position: project.config.position,
          primaryColor: project.config.primaryColor,
          headerText: project.config.headerText,
          welcomeMessage: project.config.welcomeMessage,
          offlineMessage: project.config.offlineMessage,
          inputPlaceholder: project.config.inputPlaceholder,
          requireEmail: project.config.requireEmail,
          requireName: project.config.requireName,
          showAgentPhotos: project.config.showAgentPhotos,
          showAgentNames: project.config.showAgentNames,
          enableAttachments: project.config.enableAttachments,
          enableEmoji: project.config.enableEmoji,
          enableTypingIndicator: project.config.enableTypingIndicator,
          enableSoundNotifications: project.config.enableSoundNotifications,
          bubbleIcon: project.config.bubbleIcon,
          customIconUrl: project.config.customIconUrl,
          logoUrl: project.config.logoUrl,
          customCss: project.config.customCss,
          autoOpenDelay: project.config.autoOpenDelay,
          hideWhenOffline: project.config.hideWhenOffline,
          showPoweredBy: project.config.showPoweredBy,
        },
        isOnline,
        agentCount,
      });
    } catch (error) {
      logger.error('webchat-routes', { action: 'getWidgetConfig', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get project config' });
    }
  });

  /**
   * Check online status
   */
  fastify.get('/widget/status/:projectId', async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const { isOnline, agentCount } = await getProjectOnlineStatus(projectId);
      return reply.send({ ok: true, isOnline, agentCount });
    } catch (error) {
      return reply.status(500).send({ ok: false, error: 'Failed to check status' });
    }
  });

  // ============= ADMIN ENDPOINTS (for dashboard) =============

  /**
   * List all webchat projects
   */
  fastify.get('/projects', {
    preHandler: [authMiddleware, requireRole(['admin', 'supervisor'])],
  }, async (_request, reply) => {
    try {
      const projects = await listProjects();

      const projectsWithStatus = await Promise.all(
        projects.map(async (project) => {
          const { isOnline, agentCount } = await getProjectOnlineStatus(project.projectId);
          return { ...project.toObject(), currentlyOnline: isOnline, onlineAgentCount: agentCount };
        })
      );

      return reply.send({ ok: true, projects: projectsWithStatus });
    } catch (error) {
      logger.error('webchat-routes', { action: 'listProjects', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to list projects' });
    }
  });

  /**
   * Create new webchat project
   */
  fastify.post('/projects', {
    preHandler: [authMiddleware, requireRole(['admin'])],
  }, async (request, reply) => {
    try {
      const { name, description, allowedDomains, config } = request.body as CreateProjectBody;
      const agent = (request as any).agent;

      const project = await createWebChatProject({
        name,
        description,
        allowedDomains,
        createdBy: agent._id,
        config,
      });

      return reply.status(201).send({ ok: true, project });
    } catch (error) {
      logger.error('webchat-routes', { action: 'createProject', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to create project' });
    }
  });

  /**
   * Get project details
   */
  fastify.get('/projects/:projectId', {
    preHandler: [authMiddleware, requireRole(['admin', 'supervisor'])],
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const project = await getProjectById(projectId);

      if (!project) {
        return reply.status(404).send({ ok: false, error: 'Project not found' });
      }

      const { isOnline, agentCount } = await getProjectOnlineStatus(projectId);

      return reply.send({
        ok: true,
        project: { ...project.toObject(), currentlyOnline: isOnline, onlineAgentCount: agentCount },
      });
    } catch (error) {
      logger.error('webchat-routes', { action: 'getProject', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get project' });
    }
  });

  /**
   * Update project
   */
  fastify.patch('/projects/:projectId', {
    preHandler: [authMiddleware, requireRole(['admin'])],
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const updates = request.body as UpdateProjectBody;

      const project = await getProjectById(projectId);
      if (!project) {
        return reply.status(404).send({ ok: false, error: 'Project not found' });
      }

      if (updates.config) {
        await updateProjectConfig(projectId, { ...project.config, ...updates.config });
      }

      if (updates.name) project.name = updates.name;
      if (updates.description !== undefined) project.description = updates.description;
      if (updates.allowedDomains) project.allowedDomains = updates.allowedDomains;
      if (updates.isOnline !== undefined) project.isOnline = updates.isOnline;

      await project.save();

      return reply.send({ ok: true, project });
    } catch (error) {
      logger.error('webchat-routes', { action: 'updateProject', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to update project' });
    }
  });

  /**
   * Regenerate API key
   */
  fastify.post('/projects/:projectId/regenerate-key', {
    preHandler: [authMiddleware, requireRole(['admin'])],
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const newApiKey = await regenerateApiKey(projectId);

      if (!newApiKey) {
        return reply.status(404).send({ ok: false, error: 'Project not found' });
      }

      return reply.send({ ok: true, apiKey: newApiKey });
    } catch (error) {
      logger.error('webchat-routes', { action: 'regenerateApiKey', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to regenerate API key' });
    }
  });

  /**
   * Get embed code for project
   */
  fastify.get('/projects/:projectId/embed-code', {
    preHandler: [authMiddleware, requireRole(['admin', 'supervisor'])],
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const project = await getProjectById(projectId);

      if (!project) {
        return reply.status(404).send({ ok: false, error: 'Project not found' });
      }

      const baseUrl = process.env.PUBLIC_URL || 'https://trelk.site';
      
      const embedCode = `<!-- Trelk WebChat Widget -->
<script src="${baseUrl}/widget/trelk-chat.js"></script>
<script>
  TrelkChat.init({
    projectId: "${projectId}",
    // Optional: Pre-fill user info
    // user: { name: "User Name", email: "user@example.com" }
  });
</script>`;

      return reply.send({ ok: true, embedCode, projectId, widgetUrl: `${baseUrl}/widget/trelk-chat.js` });
    } catch (error) {
      logger.error('webchat-routes', { action: 'getEmbedCode', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to generate embed code' });
    }
  });

  /**
   * Get session messages (for agent viewing web chat)
   */
  fastify.get('/sessions/:sessionId/messages', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const { limit } = request.query as { limit?: string };
      const limitNum = parseInt(limit || '50');

      const { session, messages } = await getSessionWithMessages(sessionId, limitNum);

      if (!session) {
        return reply.status(404).send({ ok: false, error: 'Session not found' });
      }

      return reply.send({
        ok: true,
        session: {
          sessionId: session.sessionId,
          channel: session.channel,
          status: session.status,
          channelMetadata: session.channelMetadata,
        },
        messages: messages.map(m => ({
          _id: m._id,
          sender: m.sender,
          senderName: m.senderName,
          content: m.content,
          messageType: m.messageType,
          media: m.media,
          createdAt: m.createdAt,
          isRead: m.isRead,
        })),
      });
    } catch (error) {
      logger.error('webchat-routes', { action: 'getSessionMessages', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get messages' });
    }
  });

  // ============= SECURITY ADMIN ENDPOINTS =============

  /**
   * Get recent security events
   */
  fastify.get('/security/events', {
    preHandler: [authMiddleware, requireRole(['admin'])],
  }, async (request, reply) => {
    try {
      const { limit, projectId } = request.query as { limit?: string; projectId?: string };
      const events = getRecentSecurityEvents(parseInt(limit || '100'), projectId);
      
      return reply.send({ ok: true, events, count: events.length });
    } catch (error) {
      logger.error('webchat-routes', { action: 'getSecurityEvents', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get security events' });
    }
  });

  /**
   * Block an IP address
   */
  fastify.post('/security/block-ip', {
    preHandler: [authMiddleware, requireRole(['admin'])],
  }, async (request, reply) => {
    try {
      const { ip, reason, durationMinutes } = request.body as { 
        ip: string; 
        reason: string; 
        durationMinutes?: number;
      };

      if (!ip || !reason) {
        return reply.status(400).send({ ok: false, error: 'IP and reason are required' });
      }

      const durationMs = (durationMinutes || 60) * 60 * 1000;
      await blockIP(ip, reason, durationMs);

      logger.info('webchat-routes', { 
        action: 'ip_blocked_by_admin',
        ip,
        reason,
        durationMinutes: durationMinutes || 60,
        agent: (request as any).agent?.email,
      });

      return reply.send({ ok: true, message: `IP ${ip} blocked for ${durationMinutes || 60} minutes` });
    } catch (error) {
      logger.error('webchat-routes', { action: 'blockIP', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to block IP' });
    }
  });

  /**
   * Unblock a visitor
   */
  fastify.post('/security/unblock-visitor', {
    preHandler: [authMiddleware, requireRole(['admin'])],
  }, async (request, reply) => {
    try {
      const { visitorId } = request.body as { visitorId: string };

      if (!visitorId) {
        return reply.status(400).send({ ok: false, error: 'Visitor ID is required' });
      }

      unblockVisitor(visitorId);

      logger.info('webchat-routes', { 
        action: 'visitor_unblocked',
        visitorId,
        agent: (request as any).agent?.email,
      });

      return reply.send({ ok: true, message: `Visitor ${visitorId} unblocked` });
    } catch (error) {
      logger.error('webchat-routes', { action: 'unblockVisitor', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to unblock visitor' });
    }
  });

  /**
   * Delete project (soft delete)
   */
  fastify.delete('/projects/:projectId', {
    preHandler: [authMiddleware, requireRole(['admin'])],
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const project = await getProjectById(projectId);

      if (!project) {
        return reply.status(404).send({ ok: false, error: 'Project not found' });
      }

      project.isActive = false;
      await project.save();

      logger.info('webchat-routes', { 
        action: 'project_deleted',
        projectId,
        agent: (request as any).agent?.email,
      });

      return reply.send({ ok: true, message: 'Project deleted' });
    } catch (error) {
      logger.error('webchat-routes', { action: 'deleteProject', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to delete project' });
    }
  });

  /**
   * Toggle project online status
   */
  fastify.post('/projects/:projectId/toggle-status', {
    preHandler: [authMiddleware, requireRole(['admin', 'supervisor'])],
  }, async (request, reply) => {
    try {
      const { projectId } = request.params as { projectId: string };
      const project = await getProjectById(projectId);

      if (!project) {
        return reply.status(404).send({ ok: false, error: 'Project not found' });
      }

      project.isOnline = !project.isOnline;
      await project.save();

      return reply.send({ ok: true, isOnline: project.isOnline });
    } catch (error) {
      logger.error('webchat-routes', { action: 'toggleStatus', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to toggle status' });
    }
  });
}

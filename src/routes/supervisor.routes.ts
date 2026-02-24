/**
 * Supervisor Routes - Live monitoring, whispers, and chat takeover
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getSupervisorStats,
  getAgentOverviews,
  sendWhisper,
  markWhisperAsRead,
  getUnreadWhispers,
  getSessionWhispers,
  startWatchingSession,
  stopWatchingSession,
  takeoverSession,
  getLiveChats,
} from '../services/supervisor.service.js';
import { getSessionTimeline } from '../services/activity-log.service.js';
import { authMiddleware, requireRole, requirePermission, requireAnyPermission } from '../middleware/auth.js';
import { addToQueue } from '../services/chat.service.js';
import { ChatSession } from '../database/models/ChatSession.js';
import { Agent } from '../database/models/Agent.js';
import { forceLogoutAgent } from '../services/auto-lock.service.js';
import { ActivityLog } from '../database/models/ActivityLog.js';
import { getIO } from '../services/socket.js';

interface WhisperBody {
  sessionId: string;
  content: string;
}

interface SessionParams {
  sessionId: string;
}

interface WhisperParams {
  whisperId: string;
}

interface TakeoverBody {
  reason?: string;
}

export async function supervisorRoutes(fastify: FastifyInstance): Promise<void> {
  // Base auth + role guard on all supervisor routes
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', requireRole(['supervisor', 'admin']));

  /**
   * GET /api/supervisor/stats
   * Get supervisor dashboard statistics
   */
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await getSupervisorStats();
      return { success: true, data: stats };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get stats',
      });
    }
  });

  /**
   * GET /api/supervisor/agents
   * Get overview of all active agents with their current sessions
   */
  fastify.get('/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const agents = await getAgentOverviews();
      return { success: true, data: agents };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get agents',
      });
    }
  });

  /**
   * GET /api/supervisor/live-chats
   * Get all live chats with their current status
   */
  fastify.get('/live-chats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const chats = await getLiveChats();
      return { success: true, data: chats };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get live chats',
      });
    }
  });

  /**
   * POST /api/supervisor/whisper
   * Send a whisper to an agent handling a chat
   */
  fastify.post<{ Body: WhisperBody }>(
    '/whisper',
    { preHandler: requirePermission('supervisor.whisper') },
    async (request: FastifyRequest<{ Body: WhisperBody }>, reply: FastifyReply) => {
      try {
        const { sessionId, content } = request.body;
        const agent = (request as any).agent;

        if (!sessionId || !content) {
          return reply.status(400).send({
            success: false,
            error: 'sessionId and content are required',
          });
        }

        const whisper = await sendWhisper(sessionId, agent._id, content);
        return { success: true, data: whisper };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to send whisper',
        });
      }
    }
  );

  /**
   * GET /api/supervisor/whispers/unread
   * Get all unread whispers for the current agent
   */
  fastify.get('/whispers/unread', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const agent = (request as any).agent;
      const whispers = await getUnreadWhispers(agent._id);
      return { success: true, data: whispers };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get whispers',
      });
    }
  });

  /**
   * POST /api/supervisor/whispers/:whisperId/read
   * Mark a whisper as read
   */
  fastify.post<{ Params: WhisperParams }>(
    '/whispers/:whisperId/read',
    async (request: FastifyRequest<{ Params: WhisperParams }>, reply: FastifyReply) => {
      try {
        const { whisperId } = request.params;
        const agent = (request as any).agent;

        await markWhisperAsRead(whisperId, agent._id);
        return { success: true };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to mark whisper as read',
        });
      }
    }
  );

  /**
   * GET /api/supervisor/sessions/:sessionId/whispers
   * Get all whispers for a specific session
   */
  fastify.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/whispers',
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;
        const agent = (request as any).agent;

        const whispers = await getSessionWhispers(sessionId, agent._id);
        return { success: true, data: whispers };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get session whispers',
        });
      }
    }
  );

  /**
   * GET /api/supervisor/sessions/:sessionId/timeline
   * Get activity timeline for a session
   */
  fastify.get<{ Params: SessionParams }>(
    '/sessions/:sessionId/timeline',
    { preHandler: requirePermission('supervisor.monitor') },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;
        const timeline = await getSessionTimeline(sessionId);
        return { success: true, data: timeline };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get timeline',
        });
      }
    }
  );

  /**
   * POST /api/supervisor/sessions/:sessionId/watch
   * Start watching a session (live monitoring)
   */
  fastify.post<{ Params: SessionParams }>(
    '/sessions/:sessionId/watch',
    { preHandler: requirePermission('supervisor.monitor') },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;
        const agent = (request as any).agent;

        await startWatchingSession(agent._id, sessionId);
        return { success: true, message: 'Now watching session' };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to start watching',
        });
      }
    }
  );

  /**
   * POST /api/supervisor/sessions/:sessionId/unwatch
   * Stop watching a session
   */
  fastify.post<{ Params: SessionParams }>(
    '/sessions/:sessionId/unwatch',
    { preHandler: requirePermission('supervisor.monitor') },
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;
        const agent = (request as any).agent;

        await stopWatchingSession(agent._id, sessionId);
        return { success: true, message: 'Stopped watching session' };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to stop watching',
        });
      }
    }
  );

  /**
   * POST /api/supervisor/sessions/:sessionId/takeover
   * Take over a chat from an agent
   */
  fastify.post<{ Params: SessionParams; Body: TakeoverBody }>(
    '/sessions/:sessionId/takeover',
    { preHandler: requirePermission('supervisor.intervene') },
    async (
      request: FastifyRequest<{ Params: SessionParams; Body: TakeoverBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { sessionId } = request.params;
        const { reason } = request.body;
        const agent = (request as any).agent;

        await takeoverSession(agent._id, sessionId, reason);
        return { success: true, message: 'Session taken over successfully' };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to takeover session',
        });
      }
    }
  );

  /**
   * POST /api/supervisor/sessions/:sessionId/unassign
   * Unassign a chat from its agent and move it to queue
   */
  fastify.post<{ Params: SessionParams; Body: { reason?: string } }>(
    '/sessions/:sessionId/unassign',
    { preHandler: requirePermission('supervisor.unassign') },
    async (
      request: FastifyRequest<{ Params: SessionParams; Body: { reason?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { sessionId } = request.params;
        const { reason } = request.body || {};
        const supervisor = (request as any).agent;

        const session = await ChatSession.findOne({ sessionId });
        if (!session) {
          return reply.status(404).send({ success: false, error: 'Session not found' });
        }

        const previousAgentId = session.assignedAgent;

        // Move session to queue
        const queued = await addToQueue(sessionId);
        if (!queued) {
          return reply.status(500).send({ success: false, error: 'Failed to queue session' });
        }

        // Decrement previous agent's chat count
        if (previousAgentId) {
          await Agent.findByIdAndUpdate(previousAgentId, { $inc: { activeChats: -1 } });
        }

        // Audit log
        await ActivityLog.create({
          sessionId,
          action: 'session_unassigned',
          actor: { type: 'supervisor', id: supervisor._id, name: supervisor.name },
          metadata: { fromAgentId: previousAgentId?.toString(), reason: reason || 'Supervisor unassigned', type: 'unassign' },
          description: `${supervisor.name} devolvió este chat a la cola`,
          icon: '↩️',
          color: 'amber',
        });

        // Notify via socket
        const io = getIO();
        io.emit('session:queued', { sessionId, status: 'queued' } as any);

        return { success: true, message: 'Session returned to queue' };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to unassign session',
        });
      }
    }
  );

  /**
   * POST /api/supervisor/agents/:agentId/force-logout
   * Force logout an agent (disconnect their socket session)
   */
  fastify.post<{ Params: { agentId: string }; Body: { reason?: string } }>(
    '/agents/:agentId/force-logout',
    { preHandler: requireAnyPermission(['supervisor.force_logout', 'system.admin']) },
    async (
      request: FastifyRequest<{ Params: { agentId: string }; Body: { reason?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { agentId } = request.params;
        const { reason } = request.body || {};
        const supervisor = (request as any).agent;

        const targetAgent = await Agent.findById(agentId);
        if (!targetAgent) {
          return reply.status(404).send({ success: false, error: 'Agent not found' });
        }

        // Cannot force-logout another admin or supervisor with higher privileges unless admin
        if (supervisor.role === 'supervisor' && ['admin', 'supervisor'].includes(targetAgent.role)) {
          return reply.status(403).send({ success: false, error: 'Insufficient permissions' });
        }

        forceLogoutAgent(agentId, reason || `Desconexión forzada por supervisor ${supervisor.name}`);

        // Audit log
        await ActivityLog.create({
          sessionId: 'system',
          action: 'agent_force_logout',
          actor: { type: 'supervisor', id: supervisor._id, name: supervisor.name },
          metadata: { targetAgentId: agentId, targetAgentName: targetAgent.name, reason },
          description: `${supervisor.name} desconectó forzadamente a ${targetAgent.name}`,
          icon: '🔌',
          color: 'red',
        });

        return { success: true, message: `Agent ${targetAgent.name} has been force-logged out` };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to force logout agent',
        });
      }
    }
  );
}

export default supervisorRoutes;

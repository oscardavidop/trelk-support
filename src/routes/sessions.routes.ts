/**
 * Chat Session Routes
 * API endpoints for managing support chat sessions
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  getSessionById,
  getSessionsByStatus,
  getAllActiveSessions,
  getWaitingSessions,
  getAgentSessions,
  getSessionMessages,
  assignAgent,
  closeSession,
  getSessionStats,
  getFilteredSessions,
  getSessionCounts,
  closeSessionDetailed,
  getVisibleSessionsForAgent,
  getQueuedSessions,
  getQueueCount,
  canAgentAccessSession,
  canAgentAccessSessionV2,
  getSessionMessagesV2,
} from '../services/chat.service.js';
import {
  getAllSavedReplies,
  searchSavedReplies,
  incrementUsageCount,
  createSavedReply,
  updateSavedReply,
  deleteSavedReply,
} from '../services/savedReply.service.js';
import { getSessionTimeline } from '../services/activity-log.service.js';
import { ChatSession, Message } from '../database/index.js';

interface SessionParams {
  sessionId: string;
}

interface CloseSessionBody {
  reason?: string;
  closedByType?: 'user' | 'agent' | 'system';
  closeReason?: 'manual' | 'inactivity' | 'resolved' | 'spam';
}

interface MessagesQuery {
  limit?: string;
  before?: string;
}

interface FilteredSessionsQuery {
  status?: 'open' | 'closed';
  search?: string;
  dateFilter?: 'today' | 'week' | 'month' | 'all';
  page?: string;
  limit?: string;
}

export async function registerSessionRoutes(fastify: FastifyInstance): Promise<void> {

  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ============= SESSION LIST =============

  /**
   * Get all active sessions (respects agent visibility)
   */
  fastify.get('/api/sessions', async (request) => {
    const agent = (request as any).agent;
    const isAdmin = agent.role === 'admin';

    const sessions = await getVisibleSessionsForAgent(agent._id.toString(), isAdmin);
    return { ok: true, sessions };
  });

  /**
   * Get queue - unassigned sessions waiting
   */
  fastify.get('/api/sessions/queue', async () => {
    const sessions = await getQueuedSessions();
    const count = await getQueueCount();
    return { ok: true, sessions, count };
  });

  /**
   * Get filtered sessions with pagination (for tabs: open/closed)
   * IMPORTANT: Respects agent visibility rules
   */
  fastify.get<{ Querystring: FilteredSessionsQuery }>('/api/sessions/filtered', async (request) => {
    const { status, search, dateFilter, page, limit } = request.query;
    const agent = (request as any).agent;
    const isAdminOrSupervisor = agent.role === 'admin' || agent.role === 'supervisor';

    const result = await getFilteredSessions({
      status: status as 'open' | 'closed' | undefined,
      search,
      dateFilter: dateFilter as 'today' | 'week' | 'month' | 'all' | undefined,
      agentId: agent._id.toString(),
      isAdmin: isAdminOrSupervisor,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });

    return { ok: true, ...result };
  });

  /**
   * Get session counts for tabs (respects agent visibility)
   */
  fastify.get('/api/sessions/counts', async (request) => {
    const agent = (request as any).agent;
    const isAdminOrSupervisor = agent.role === 'admin' || agent.role === 'supervisor';
    const counts = await getSessionCounts(agent._id.toString(), isAdminOrSupervisor);
    return { ok: true, counts };
  });

  /**
   * Get waiting sessions (queue)
   */
  fastify.get('/api/sessions/waiting', async () => {
    const sessions = await getWaitingSessions();
    return { ok: true, sessions };
  });

  /**
   * Get agent's assigned sessions
   */
  fastify.get('/api/sessions/mine', async (request) => {
    const agent = (request as any).agent;
    const sessions = await getAgentSessions(agent._id.toString());
    return { ok: true, sessions };
  });

  /**
   * Get sessions by status
   */
  fastify.get<{ Params: { status: string } }>('/api/sessions/status/:status', async (request, reply) => {
    const { status } = request.params;

    if (!['bot', 'waiting', 'human', 'closed'].includes(status)) {
      return reply.code(400).send({ ok: false, error: 'Invalid status' });
    }

    const sessions = await getSessionsByStatus(status as any);
    return { ok: true, sessions };
  });

  /**
   * Get session statistics
   */
  fastify.get('/api/sessions/stats', async () => {
    const stats = await getSessionStats();
    return { ok: true, stats };
  });

  // ============= SINGLE SESSION =============

  /**
   * Get single session by ID (with access control)
   */
  fastify.get<{ Params: SessionParams }>('/api/sessions/:sessionId', async (request, reply) => {
    const { sessionId } = request.params;
    const agent = (request as any).agent;
    const isAdmin = agent.role === 'admin';

    // Check access permission
    const canAccess = canAgentAccessSession(sessionId, agent._id.toString(), isAdmin);
    if (!canAccess) {
      return reply.code(403).send({ ok: false, error: 'Access denied to this session' });
    }

    const session = await getSessionById(sessionId);

    if (!session) {
      return reply.code(404).send({ ok: false, error: 'Session not found' });
    }

    return { ok: true, session };
  });

  /**
   * Get session messages (with access control and pagination)
   * Supports infinite scroll with cursor-based pagination
   */
  // fastify.get<{ Params: SessionParams; Querystring: MessagesQuery }>(
  //   '/api/sessions/:sessionId/messages', 
  //   async (request, reply) => {
  //     const { sessionId } = request.params;
  //     const { limit, before } = request.query;
  //     const agent = (request as any).agent;
  //     const isAdmin = agent.role === 'admin';

  //     // Check access permission
  //     const canAccess = await canAgentAccessSession(sessionId, agent._id.toString(), isAdmin);
  //     if (!canAccess) {
  //       return reply.code(403).send({ ok: false, error: 'Access denied to this session' });
  //     }

  //     const result = await getSessionMessages(
  //       sessionId, 
  //       limit ? parseInt(limit, 10) : 50,
  //       before ? new Date(before) : undefined
  //     );

  //     // Transform messages to include sessionId string instead of ObjectId
  //     const transformedMessages = result.messages.map(msg => ({
  //       _id: msg._id.toString(),
  //       session: sessionId, // Use sessionId string instead of ObjectId
  //       sender: msg.sender,
  //       senderAgent: msg.senderAgent,
  //       content: msg.content,
  //       messageType: msg.messageType,
  //       mediaUrl: msg.mediaUrl,
  //       telegramMessageId: msg.telegramMessageId,
  //       isRead: msg.isRead,
  //       isEdited: msg.isEdited || false,
  //       editedAt: msg.editedAt,
  //       isPinned: (msg as any).isPinned || false,
  //       createdAt: msg.createdAt,
  //       replyToMessage: (msg as any).replyTo ? {
  //         _id: (msg as any).replyTo._id?.toString(),
  //         sender: (msg as any).replyTo.sender,
  //         senderAgent: (msg as any).replyTo.senderAgent,
  //         content: (msg as any).replyTo.content,
  //       } : undefined,
  //     }));

  //     // Find the pinned message
  //     const pinnedMessage = transformedMessages.find(m => m.isPinned);

  //     return { 
  //       ok: true, 
  //       messages: transformedMessages, 
  //       pinnedMessage: pinnedMessage || null,
  //       hasMore: result.hasMore,
  //       oldestTimestamp: result.oldestTimestamp?.toISOString()
  //     };
  //   }
  // );
  fastify.get<{ Params: SessionParams; Querystring: MessagesQuery }>(
    '/api/sessions/:sessionId/messages',
    async (request, reply) => {
      const { sessionId } = request.params;
      const { limit, before } = request.query;
      const agent = (request as any).agent;
      const isAdmin = agent.role === 'admin' || agent.role === 'supervisor';

      // 1. OPTIMIZACIÓN: Buscar la sesión UNA sola vez aquí
      const session = await ChatSession.findOne({ sessionId })
        .select('_id status assignedAgent closedBy sessionId') // Solo lo necesario
        .lean();

      if (!session) {
        return reply.code(404).send({ ok: false, error: 'Session not found' });
      }

      // 2. Verificar acceso pasando el OBJETO (Sync, super rápido)
      if (!canAgentAccessSessionV2(session, agent._id.toString(), isAdmin)) {
        return reply.code(403).send({ ok: false, error: 'Access denied' });
      }

      // 3. Obtener mensajes y pinned message en PARALELO
      const limitNum = limit ? parseInt(limit, 10) : 50;
      const beforeDate = before ? new Date(before) : undefined;

      const [messagesResult, pinnedMessage] = await Promise.all([
        // A. Los mensajes paginados
        getSessionMessagesV2(session._id, limitNum, beforeDate),

        // B. El mensaje fijado (Consulta específica)
        Message.findOne({ session: session._id, isPinned: true })
          .populate('senderAgent', 'name avatar')
          .lean()
      ]);

      // 4. Transformación (Manteniendo tu lógica)
      // Nota: Usamos .lean() abajo, así que el mapeo es más directo
      const transformMsg = (msg: any) => ({
        _id: msg._id.toString(),
        session: sessionId, // String del param
        sender: msg.sender,
        senderAgent: msg.senderAgent,
        content: msg.content,
        messageType: msg.messageType,
        mediaUrl: msg.mediaUrl,
        telegramMessageId: msg.telegramMessageId,
        isRead: msg.isRead,
        isEdited: msg.isEdited || false,
        editedAt: msg.editedAt,
        isPinned: msg.isPinned || false,
        createdAt: msg.createdAt,
        replyToMessage: msg.replyTo ? {
          _id: msg.replyTo._id?.toString(),
          sender: msg.replyTo.sender,
          senderAgent: msg.replyTo.senderAgent,
          content: msg.replyTo.content,
        } : undefined,
      });

      return {
        ok: true,
        messages: messagesResult.messages.map(transformMsg),
        // Ahora SI devolvemos el pinned message aunque sea de hace un año
        pinnedMessage: pinnedMessage ? transformMsg(pinnedMessage) : null,
        hasMore: messagesResult.hasMore,
        oldestTimestamp: messagesResult.oldestTimestamp?.toISOString(),
      };
    }
  );
  /**
   * Get session activity timeline
   * Available to agents (filtered) and supervisors/admins (full)
   */
  fastify.get<{ Params: SessionParams }>(
    '/api/sessions/:sessionId/timeline',
    async (request, reply) => {
      const { sessionId } = request.params;
      const agent = (request as any).agent;
      const isAdmin = agent.role === 'admin' || agent.role === 'supervisor';

      // Check access permission
      const canAccess = await canAgentAccessSession(sessionId, agent._id.toString(), isAdmin);
      if (!canAccess) {
        return reply.code(403).send({ ok: false, error: 'Access denied to this session' });
      }

      try {
        const timeline = await getSessionTimeline(sessionId);

        // For regular agents, filter out sensitive activities
        if (!isAdmin) {
          const agentSafeActions = [
            'session_created',
            'session_assigned',
            'message_sent',
            'message_received',
            'session_transferred',
            'session_closed',
            'category_changed',
            'note_added',
            'tag_added',
            'tag_removed',
          ];
          const filteredTimeline = timeline.filter(
            (item: { action: string }) => agentSafeActions.includes(item.action)
          );
          return { success: true, data: filteredTimeline };
        }

        return { success: true, data: timeline };
      } catch (error) {
        return reply.code(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get timeline',
        });
      }
    }
  );

  /**
   * Accept/assign session to current agent
   */
  fastify.post<{ Params: SessionParams }>('/api/sessions/:sessionId/accept', async (request, reply) => {
    const { sessionId } = request.params;
    const agentId = request.agent!._id.toString();

    const session = await assignAgent(sessionId, agentId);

    if (!session) {
      return reply.code(404).send({ ok: false, error: 'Session not found' });
    }

    return { ok: true, session };
  });

  /**
   * Close session
   * Requires: chats.close permission
   */
  fastify.post<{ Params: SessionParams; Body: CloseSessionBody }>(
    '/api/sessions/:sessionId/close',
    { preHandler: requirePermission('chats.close') },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { reason, closedByType = 'agent', closeReason = 'manual' } = request.body;
      const agentId = request.agent!._id.toString();

      const session = await closeSessionDetailed(
        sessionId,
        closedByType,
        closeReason,
        agentId,
        reason
      );

      if (!session) {
        return reply.code(404).send({ ok: false, error: 'Session not found' });
      }

      return { ok: true, session };
    }
  );

  // ============= SAVED REPLIES (for agents) =============

  /**
   * Get all active saved replies (for quick reply dropdown)
   * Requires: replies.read
   */
  fastify.get('/api/saved-replies', async () => {
    const replies = await getAllSavedReplies(false); // Only active ones
    return { ok: true, replies };
  });

  /**
   * Search saved replies
   * Requires: replies.read
   */
  fastify.get<{ Querystring: { q: string } }>('/api/saved-replies/search', async (request) => {
    const { q } = request.query;
    const replies = await searchSavedReplies(q || '');
    return { ok: true, replies };
  });

  /**
   * Increment usage count for a saved reply
   * Requires: replies.use
   */
  fastify.post<{ Params: { replyId: string } }>(
    '/api/saved-replies/:replyId/use',
    async (request, reply) => {
      const { replyId } = request.params;

      try {
        await incrementUsageCount(replyId);
        return { ok: true };
      } catch {
        return reply.code(404).send({ ok: false, error: 'Saved reply not found' });
      }
    }
  );

  /**
   * Get all saved replies (including inactive) - for management
   * Requires: replies.write permission
   */
  fastify.get(
    '/api/saved-replies/manage',
    { preHandler: requirePermission('replies.write') },
    async () => {
      const replies = await getAllSavedReplies(true); // Include inactive
      return { ok: true, replies };
    }
  );

  /**
   * Create a new saved reply
   * Requires: replies.write permission
   */
  fastify.post<{
    Body: {
      title: string;
      content: string;
      category?: string;
      shortcut?: string;
      isActive?: boolean;
    };
  }>(
    '/api/saved-replies/manage',
    { preHandler: requirePermission('replies.write') },
    async (request, reply) => {
      const { title, content, category, shortcut, isActive } = request.body;

      if (!title || !content) {
        return reply.code(400).send({
          ok: false,
          error: 'Title and content are required',
        });
      }

      const savedReply = await createSavedReply(
        {
          title,
          content,
          category,
          shortcut,
          isActive,
        },
        request.agent!._id.toString()
      );

      return { ok: true, reply: savedReply };
    }
  );

  /**
   * Update a saved reply
   * Requires: replies.write permission
   */
  fastify.put<{
    Params: { replyId: string };
    Body: {
      title?: string;
      content?: string;
      category?: string;
      shortcut?: string;
      isActive?: boolean;
    };
  }>(
    '/api/saved-replies/manage/:replyId',
    { preHandler: requirePermission('replies.write') },
    async (request, reply) => {
      const { replyId } = request.params;
      const updates = request.body;

      const savedReply = await updateSavedReply(replyId, updates);

      if (!savedReply) {
        return reply.code(404).send({ ok: false, error: 'Saved reply not found' });
      }

      return { ok: true, reply: savedReply };
    }
  );

  /**
   * Delete a saved reply
   * Requires: replies.write permission
   */
  fastify.delete<{ Params: { replyId: string } }>(
    '/api/saved-replies/manage/:replyId',
    { preHandler: requirePermission('replies.write') },
    async (request, reply) => {
      const { replyId } = request.params;

      const deleted = await deleteSavedReply(replyId);

      if (!deleted) {
        return reply.code(404).send({ ok: false, error: 'Saved reply not found' });
      }

      return { ok: true };
    }
  );
}

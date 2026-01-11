/**
 * Chat Session Routes
 * API endpoints for managing support chat sessions
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
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
} from '../services/chat.service.js';
import {
  getAllSavedReplies,
  searchSavedReplies,
  incrementUsageCount,
} from '../services/savedReply.service.js';
import { getSessionTimeline } from '../services/activity-log.service.js';

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
    const isAdmin = agent.role === 'admin';
    
    const result = await getFilteredSessions({
      status: status as 'open' | 'closed' | undefined,
      search,
      dateFilter: dateFilter as 'today' | 'week' | 'month' | 'all' | undefined,
      agentId: agent._id.toString(),
      isAdmin,
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
    const isAdmin = agent.role === 'admin';
    const counts = await getSessionCounts(agent._id.toString(), isAdmin);
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
    const canAccess = await canAgentAccessSession(sessionId, agent._id.toString(), isAdmin);
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
   * Get session messages (with access control)
   */
  fastify.get<{ Params: SessionParams; Querystring: MessagesQuery }>(
    '/api/sessions/:sessionId/messages', 
    async (request, reply) => {
      const { sessionId } = request.params;
      const { limit, before } = request.query;
      const agent = (request as any).agent;
      const isAdmin = agent.role === 'admin';
      
      // Check access permission
      const canAccess = await canAgentAccessSession(sessionId, agent._id.toString(), isAdmin);
      if (!canAccess) {
        return reply.code(403).send({ ok: false, error: 'Access denied to this session' });
      }
      
      const messages = await getSessionMessages(
        sessionId, 
        limit ? parseInt(limit, 10) : 100,
        before ? new Date(before) : undefined
      );
      
      // Transform messages to include sessionId string instead of ObjectId
      const transformedMessages = messages.map(msg => ({
        _id: msg._id.toString(),
        session: sessionId, // Use sessionId string instead of ObjectId
        sender: msg.sender,
        senderAgent: msg.senderAgent,
        content: msg.content,
        messageType: msg.messageType,
        mediaUrl: msg.mediaUrl,
        telegramMessageId: msg.telegramMessageId,
        isRead: msg.isRead,
        isEdited: msg.isEdited || false,
        editedAt: msg.editedAt,
        createdAt: msg.createdAt,
        replyToMessage: (msg as any).replyTo ? {
          _id: (msg as any).replyTo._id?.toString(),
          sender: (msg as any).replyTo.sender,
          senderAgent: (msg as any).replyTo.senderAgent,
          content: (msg as any).replyTo.content,
        } : undefined,
      }));
      
      return { ok: true, messages: transformedMessages };
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
   */
  fastify.post<{ Params: SessionParams; Body: CloseSessionBody }>(
    '/api/sessions/:sessionId/close', 
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
   */
  fastify.get('/api/saved-replies', async () => {
    const replies = await getAllSavedReplies(false); // Only active ones
    return { ok: true, replies };
  });

  /**
   * Search saved replies
   */
  fastify.get<{ Querystring: { q: string } }>('/api/saved-replies/search', async (request) => {
    const { q } = request.query;
    const replies = await searchSavedReplies(q || '');
    return { ok: true, replies };
  });

  /**
   * Increment usage count for a saved reply
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
}

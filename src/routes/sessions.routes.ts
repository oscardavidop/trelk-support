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
} from '../services/chat.service.js';
import {
  getAllSavedReplies,
  searchSavedReplies,
  incrementUsageCount,
} from '../services/savedReply.service.js';

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
   * Get all active sessions
   */
  fastify.get('/api/sessions', async () => {
    const sessions = await getAllActiveSessions();
    return { ok: true, sessions };
  });

  /**
   * Get filtered sessions with pagination (for tabs: open/closed)
   */
  fastify.get<{ Querystring: FilteredSessionsQuery }>('/api/sessions/filtered', async (request) => {
    const { status, search, dateFilter, page, limit } = request.query;
    
    const result = await getFilteredSessions({
      status: status as 'open' | 'closed' | undefined,
      search,
      dateFilter: dateFilter as 'today' | 'week' | 'month' | 'all' | undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    
    return { ok: true, ...result };
  });

  /**
   * Get session counts for tabs
   */
  fastify.get('/api/sessions/counts', async () => {
    const counts = await getSessionCounts();
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
    const sessions = await getAgentSessions(request.agent!._id.toString());
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
   * Get single session by ID
   */
  fastify.get<{ Params: SessionParams }>('/api/sessions/:sessionId', async (request, reply) => {
    const { sessionId } = request.params;
    
    const session = await getSessionById(sessionId);
    
    if (!session) {
      return reply.code(404).send({ ok: false, error: 'Session not found' });
    }
    
    return { ok: true, session };
  });
  
  /**
   * Get session messages
   */
  fastify.get<{ Params: SessionParams; Querystring: MessagesQuery }>(
    '/api/sessions/:sessionId/messages', 
    async (request, reply) => {
      const { sessionId } = request.params;
      const { limit, before } = request.query;
      
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
        createdAt: msg.createdAt,
      }));
      
      return { ok: true, messages: transformedMessages };
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

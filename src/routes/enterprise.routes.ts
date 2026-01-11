/**
 * Enterprise Routes - Metrics, Surveys, Blocks, Transfers
 */

import type { FastifyInstance } from 'fastify';
import { 
  getMetrics, 
  submitSurvey, 
  getSessionSurvey,
  getUserBlockInfo,
  getUserBlockHistory,
  getSessionTransfers,
  isUserBlocked,
} from '../services/enterprise.service.js';
import { authMiddleware } from '../middleware/auth.js';

export async function registerEnterpriseRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth to all routes
  fastify.addHook('onRequest', authMiddleware);

  // ============= METRICS =============
  
  /**
   * Get dashboard metrics
   */
  fastify.get('/api/metrics', async (request, reply) => {
    const { startDate, endDate, agentId } = request.query as {
      startDate?: string;
      endDate?: string;
      agentId?: string;
    };
    
    const metrics = await getMetrics({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      agentId,
    });
    
    return { ok: true, metrics };
  });

  // ============= SURVEYS =============
  
  /**
   * Get survey for a session
   */
  fastify.get<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/survey',
    async (request, reply) => {
      const survey = await getSessionSurvey(request.params.sessionId);
      return { ok: true, survey };
    }
  );

  // ============= BLOCKS =============
  
  /**
   * Get block info for a user
   */
  fastify.get<{ Params: { telegramId: string } }>(
    '/api/users/:telegramId/block',
    async (request, reply) => {
      const telegramId = parseInt(request.params.telegramId, 10);
      const block = await getUserBlockInfo(telegramId);
      const { blocked } = await isUserBlocked(telegramId);
      
      return { ok: true, blocked, block };
    }
  );
  
  /**
   * Get block history for a user
   */
  fastify.get<{ Params: { telegramId: string } }>(
    '/api/users/:telegramId/block-history',
    async (request, reply) => {
      const telegramId = parseInt(request.params.telegramId, 10);
      const history = await getUserBlockHistory(telegramId);
      
      return { ok: true, history };
    }
  );

  // ============= TRANSFERS =============
  
  /**
   * Get transfer history for a session
   */
  fastify.get<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/transfers',
    async (request, reply) => {
      const transfers = await getSessionTransfers(request.params.sessionId);
      return { ok: true, transfers };
    }
  );

  // ============= MESSAGE NOTES =============
  
  /**
   * Add internal note to a message
   */
  fastify.post<{ Params: { messageId: string }; Body: { note: string } }>(
    '/api/messages/:messageId/note',
    async (request, reply) => {
      const { messageId } = request.params;
      const { note } = request.body;
      const agent = (request as any).agent;
      
      // Import Message model
      const { Message } = await import('../database/models/Message.js');
      
      const message = await Message.findById(messageId);
      if (!message) {
        return reply.status(404).send({ ok: false, error: 'Message not found' });
      }
      
      // Add note to message metadata
      (message as any).internalNote = note;
      (message as any).noteAddedBy = agent._id;
      (message as any).noteAddedAt = new Date();
      await message.save();
      
      return { ok: true };
    }
  );

  /**
   * Add tags to a message
   */
  fastify.put<{ Params: { messageId: string }; Body: { tags: string[] } }>(
    '/api/messages/:messageId/tags',
    async (request, reply) => {
      const { messageId } = request.params;
      const { tags } = request.body;
      
      // Import Message model
      const { Message } = await import('../database/models/Message.js');
      
      const message = await Message.findById(messageId);
      if (!message) {
        return reply.status(404).send({ ok: false, error: 'Message not found' });
      }
      
      // Update tags
      (message as any).tags = tags;
      await message.save();
      
      return { ok: true };
    }
  );
}

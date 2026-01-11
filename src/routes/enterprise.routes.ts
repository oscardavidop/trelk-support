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
}

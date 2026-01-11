/**
 * Dashboard Routes
 * Stats and overview endpoints
 */

import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { getSessionStats } from '../services/chat.service.js';
import { getAgentStats } from '../services/agent.service.js';
import { getUserCount } from '../services/user.service.js';

export async function registerDashboardRoutes(fastify: FastifyInstance): Promise<void> {
  
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);
  
  /**
   * Get dashboard overview stats
   */
  fastify.get('/api/dashboard/stats', async () => {
    const [sessions, agents, userCount] = await Promise.all([
      getSessionStats(),
      getAgentStats(),
      getUserCount(),
    ]);
    
    return {
      ok: true,
      stats: {
        sessions,
        agents,
        users: {
          total: userCount,
        },
      },
    };
  });
  
  /**
   * Get dashboard health check
   */
  fastify.get('/api/dashboard/health', async () => {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}

/**
 * Dashboard Routes
 * Stats and overview endpoints with role-based views
 */

import type { FastifyInstance } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { getSessionStats } from '../services/chat.service.js';
import { getAgentStats } from '../services/agent.service.js';
import { getUserCount } from '../services/user.service.js';
import {
  getAdminMetrics,
  getSupervisorMetrics,
  getAgentPersonalMetrics,
  getQuickStats,
  type DashboardFilters,
} from '../services/dashboard-metrics.service.js';

interface FiltersQuery {
  startDate?: string;
  endDate?: string;
  channel?: string;
  teamId?: string;
  category?: string;
}

export async function registerDashboardRoutes(fastify: FastifyInstance): Promise<void> {
  
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);
  
  /**
   * Get dashboard overview stats (legacy endpoint)
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
   * Get quick stats for real-time updates
   */
  fastify.get('/api/dashboard/quick-stats', async () => {
    const stats = await getQuickStats();
    return { ok: true, ...stats };
  });

  /**
   * Get Admin Dashboard Metrics
   * Full access to all metrics, system health, alerts
   */
  fastify.get<{ Querystring: FiltersQuery }>(
    '/api/dashboard/admin',
    { preHandler: requirePermission('analytics.read') },
    async (request) => {
      const { startDate, endDate, channel, teamId, category } = request.query;
      
      const filters: DashboardFilters = {};
      if (startDate && endDate) {
        filters.dateRange = {
          start: new Date(startDate),
          end: new Date(endDate),
        };
      }
      if (channel) filters.channel = channel;
      if (teamId) filters.teamId = teamId;
      if (category) filters.category = category;

      const metrics = await getAdminMetrics(filters);
      return { ok: true, ...metrics };
    }
  );

  /**
   * Get Supervisor Dashboard Metrics
   * Team-focused metrics, agent status, queue management
   */
  fastify.get<{ Querystring: FiltersQuery }>(
    '/api/dashboard/supervisor',
    { preHandler: requirePermission('chats.monitor') },
    async (request) => {
      const supervisorId = request.agent!._id.toString();
      const { startDate, endDate, channel, teamId, category } = request.query;
      
      const filters: DashboardFilters = {};
      if (startDate && endDate) {
        filters.dateRange = {
          start: new Date(startDate),
          end: new Date(endDate),
        };
      }
      if (channel) filters.channel = channel;
      if (teamId) filters.teamId = teamId;
      if (category) filters.category = category;

      const metrics = await getSupervisorMetrics(supervisorId, filters);
      return { ok: true, ...metrics };
    }
  );

  /**
   * Get Agent Personal Dashboard Metrics
   * Personal stats, my chats, upcoming actions
   */
  fastify.get('/api/dashboard/agent', async (request) => {
    const agentId = request.agent!._id.toString();
    const metrics = await getAgentPersonalMetrics(agentId);
    return { ok: true, ...metrics };
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

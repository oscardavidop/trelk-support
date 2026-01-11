/**
 * Activity & Audit Log Routes
 * Routes for viewing activity timeline and audit logs
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ActivityLog, AuditLog } from '../database/models/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

interface QueryParams {
  timeFilter?: 'today' | 'week' | 'month' | 'all';
  actionType?: string;
  page?: number;
  limit?: number;
}

function getDateFilter(timeFilter: string): { createdAt?: { $gte: Date } } {
  const now = new Date();
  let startDate: Date;
  
  switch (timeFilter) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
    default:
      return {};
  }
  
  return { createdAt: { $gte: startDate } };
}

export async function activityRoutes(fastify: FastifyInstance): Promise<void> {
  // Add authentication to all routes
  fastify.addHook('preHandler', authMiddleware);
  
  /**
   * GET /api/activity
   * Get activity logs (admin/supervisor only)
   */
  fastify.get('/', {
    preHandler: requireRole(['admin', 'supervisor']),
    handler: async (
      request: FastifyRequest<{ Querystring: QueryParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { timeFilter = 'today', actionType, page = 1, limit = 100 } = request.query;
        
        const filter: Record<string, unknown> = {
          ...getDateFilter(timeFilter),
        };
        
        if (actionType && actionType !== 'all') {
          filter.actionType = actionType;
        }
        
        const skip = (page - 1) * limit;
        
        const logs = await ActivityLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('agent', 'name email')
          .lean();
        
        // Transform for frontend
        const transformed = logs.map((log: Record<string, unknown>) => ({
          _id: log._id,
          agentId: (log.agent as { _id?: string })?._id || log.agent,
          agentName: (log.agent as { name?: string })?.name || 'Unknown',
          action: log.action,
          actionType: log.actionType,
          targetType: log.targetType,
          targetId: log.targetId,
          metadata: log.metadata,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt,
        }));
        
        return reply.send({
          success: true,
          data: transformed,
        });
      } catch (error) {
        request.log.error(error, 'Error fetching activity logs');
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch activity logs',
        });
      }
    },
  });
  
  /**
   * GET /api/activity/agent/:agentId
   * Get activity logs for a specific agent
   */
  fastify.get('/agent/:agentId', {
    preHandler: requireRole(['admin', 'supervisor']),
    handler: async (
      request: FastifyRequest<{ Params: { agentId: string }; Querystring: QueryParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { agentId } = request.params;
        const { timeFilter = 'today', page = 1, limit = 50 } = request.query;
        
        const filter = {
          agent: agentId,
          ...getDateFilter(timeFilter),
        };
        
        const skip = (page - 1) * limit;
        
        const logs = await ActivityLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
        
        return reply.send({
          success: true,
          data: logs,
        });
      } catch (error) {
        request.log.error(error, 'Error fetching agent activity logs');
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch agent activity logs',
        });
      }
    },
  });
}

export async function auditRoutes(fastify: FastifyInstance): Promise<void> {
  // Add authentication to all routes
  fastify.addHook('preHandler', authMiddleware);
  
  /**
   * GET /api/audit
   * Get audit logs (admin/supervisor only)
   */
  fastify.get('/', {
    preHandler: requireRole(['admin', 'supervisor']),
    handler: async (
      request: FastifyRequest<{ Querystring: QueryParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { timeFilter = 'today', page = 1, limit = 100 } = request.query;
        
        const filter = getDateFilter(timeFilter);
        const skip = (page - 1) * limit;
        
        const logs = await AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('performedBy', 'name email')
          .lean();
        
        // Transform for frontend
        const transformed = logs.map((log: Record<string, unknown>) => ({
          _id: log._id,
          performedBy: (log.performedBy as { _id?: string })?._id || log.performedBy,
          performedByName: (log.performedBy as { name?: string })?.name || 'System',
          action: log.action,
          resource: log.resource,
          resourceId: log.resourceId,
          changes: log.changes,
          ipAddress: log.ipAddress,
          createdAt: log.createdAt,
        }));
        
        return reply.send({
          success: true,
          data: transformed,
        });
      } catch (error) {
        request.log.error(error, 'Error fetching audit logs');
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch audit logs',
        });
      }
    },
  });
  
  /**
   * GET /api/audit/resource/:resourceType/:resourceId
   * Get audit logs for a specific resource
   */
  fastify.get('/resource/:resourceType/:resourceId', {
    preHandler: requireRole(['admin', 'supervisor']),
    handler: async (
      request: FastifyRequest<{ 
        Params: { resourceType: string; resourceId: string }; 
        Querystring: QueryParams 
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { resourceType, resourceId } = request.params;
        const { page = 1, limit = 50 } = request.query;
        
        const filter = {
          resource: resourceType,
          resourceId,
        };
        
        const skip = (page - 1) * limit;
        
        const logs = await AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('performedBy', 'name email')
          .lean();
        
        return reply.send({
          success: true,
          data: logs,
        });
      } catch (error) {
        request.log.error(error, 'Error fetching resource audit logs');
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch resource audit logs',
        });
      }
    },
  });
}

export default { activityRoutes, auditRoutes };

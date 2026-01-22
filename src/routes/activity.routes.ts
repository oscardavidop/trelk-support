/**
 * Activity & Audit Log Routes
 * Routes for viewing activity timeline and audit logs
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuditLog } from '../database/models/index.js';
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
   * Uses AuditLog model which has actorId, actorName, category, etc.
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
        
        // Filter by category if actionType specified
        if (actionType && actionType !== 'all') {
          filter.category = actionType;
        }
        
        const skip = (page - 1) * limit;
        
        // Use AuditLog which has proper agent info
        const logs = await AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
        
        // Transform to frontend format
        const transformed = logs.map((log: Record<string, unknown>) => ({
          _id: log._id,
          agentId: log.actorId,
          agentName: log.actorName || 'Sistema',
          action: log.action,
          actionType: log.category,
          targetType: log.targetType,
          targetId: log.targetId,
          metadata: {
            previousValue: log.previousValue,
            newValue: log.newValue,
            severity: log.severity,
          },
          ipAddress: log.actorIp,
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
          actorId: agentId,
          ...getDateFilter(timeFilter),
        };
        
        const skip = (page - 1) * limit;
        
        const logs = await AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
        
        // Transform to frontend format
        const transformed = logs.map((log: Record<string, unknown>) => ({
          _id: log._id,
          agentId: log.actorId,
          agentName: log.actorName || 'Sistema',
          action: log.action,
          actionType: log.category,
          targetType: log.targetType,
          targetId: log.targetId,
          metadata: {
            previousValue: log.previousValue,
            newValue: log.newValue,
            severity: log.severity,
          },
          ipAddress: log.actorIp,
          createdAt: log.createdAt,
        }));
        
        return reply.send({
          success: true,
          data: transformed,
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
          .lean();
        
        // Transform to frontend format
        const transformed = logs.map((log: Record<string, unknown>) => ({
          _id: log._id,
          performedBy: log.actorId,
          performedByName: log.actorName || 'Sistema',
          action: log.action,
          resource: log.targetType,
          resourceId: log.targetId,
          changes: {
            before: log.previousValue,
            after: log.newValue,
          },
          ipAddress: log.actorIp,
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
          targetType: resourceType,
          targetId: resourceId,
        };
        
        const skip = (page - 1) * limit;
        
        const logs = await AuditLog.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
        
        // Transform to frontend format
        const transformed = logs.map((log: Record<string, unknown>) => ({
          _id: log._id,
          performedBy: log.actorId,
          performedByName: log.actorName || 'Sistema',
          action: log.action,
          resource: log.targetType,
          resourceId: log.targetId,
          changes: {
            before: log.previousValue,
            after: log.newValue,
          },
          ipAddress: log.actorIp,
          createdAt: log.createdAt,
        }));
        
        return reply.send({
          success: true,
          data: transformed,
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

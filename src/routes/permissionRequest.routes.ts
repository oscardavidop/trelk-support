/**
 * Permission Request Routes
 * API endpoints for managing permission access requests
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  getPendingRequests,
  getAllRequests,
  getRequestById,
  getAgentPendingRequest,
  getAgentRequestStatus,
  requestPermission,
  reviewRequest,
  cancelRequest,
  unblockPermission,
  getRequestStats,
  isPermissionPending,
  isPermissionBlocked
} from '../services/permissionRequest.service.js';

// ============= TYPES =============

interface RequestPermissionBody {
  permission: string;
  reason: string;
  page?: string;
}

interface ReviewRequestBody {
  action: 'approve' | 'reject' | 'approve_partial';
  rejectionReason?: string;
  approvedPermissions?: string[];
  blockPermissions?: boolean;
}

interface RequestParams {
  requestId: string;
}

interface UnblockBody {
  agentId: string;
  permission: string;
}

// ============= ROUTES =============

export async function registerPermissionRequestRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ============= AGENT ROUTES (for requesting permissions) =============

  /**
   * GET /api/permission-requests/my-status
   * Get current agent's request status (pending permissions, blocked permissions)
   */
  fastify.get('/my-status', async (request) => {
    const agentId = request.agent!._id.toString();
    const status = await getAgentRequestStatus(agentId);
    return { ok: true, ...status };
  });

  /**
   * GET /api/permission-requests/my-request
   * Get current agent's pending request
   */
  fastify.get('/my-request', async (request) => {
    const agentId = request.agent!._id.toString();
    const pendingRequest = await getAgentPendingRequest(agentId);
    return { ok: true, request: pendingRequest };
  });

  /**
   * GET /api/permission-requests/check/:permission
   * Check if a specific permission is pending or blocked
   */
  fastify.get<{ Params: { permission: string } }>(
    '/check/:permission',
    async (request) => {
      const agentId = request.agent!._id.toString();
      const { permission } = request.params;
      
      const [isPending, isBlocked] = await Promise.all([
        isPermissionPending(agentId, permission),
        isPermissionBlocked(agentId, permission)
      ]);
      
      return { 
        ok: true, 
        permission,
        isPending, 
        isBlocked,
        canRequest: !isPending && !isBlocked
      };
    }
  );

  /**
   * POST /api/permission-requests
   * Create a new permission request or add to existing
   */
  fastify.post<{ Body: RequestPermissionBody }>(
    '/',
    async (request, reply) => {
      const agentId = request.agent!._id.toString();
      const { permission, reason, page } = request.body;

      if (!permission || !reason) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Se requiere el permiso y la razón' 
        });
      }

      if (reason.length < 10) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'La razón debe tener al menos 10 caracteres' 
        });
      }

      const result = await requestPermission({
        agentId,
        permission,
        reason,
        page
      });

      if (!result.ok) {
        return reply.code(400).send(result);
      }

      return { ok: true, request: result.request };
    }
  );

  /**
   * DELETE /api/permission-requests/my-request
   * Cancel own pending request
   */
  fastify.delete('/my-request', async (request, reply) => {
    const agentId = request.agent!._id.toString();
    const pendingRequest = await getAgentPendingRequest(agentId);
    
    if (!pendingRequest) {
      return reply.code(404).send({ 
        ok: false, 
        error: 'No tienes solicitudes pendientes' 
      });
    }

    const cancelled = await cancelRequest(
      pendingRequest._id.toString(), 
      agentId
    );
    
    return { ok: cancelled };
  });

  // ============= ADMIN ROUTES (for managing requests) =============

  /**
   * GET /api/permission-requests/pending
   * Get all pending requests (admin only)
   */
  fastify.get(
    '/pending',
    { preHandler: requirePermission('permissions.write') },
    async () => {
      const requests = await getPendingRequests();
      return { ok: true, requests };
    }
  );

  /**
   * GET /api/permission-requests/all
   * Get all requests with optional filters (admin only)
   */
  fastify.get<{ Querystring: { status?: string; agentId?: string; limit?: string } }>(
    '/all',
    { preHandler: requirePermission('permissions.write') },
    async (request) => {
      const { status, agentId, limit } = request.query;
      const requests = await getAllRequests({
        status,
        agentId,
        limit: limit ? parseInt(limit, 10) : undefined
      });
      return { ok: true, requests };
    }
  );

  /**
   * GET /api/permission-requests/stats
   * Get request statistics (admin only)
   */
  fastify.get(
    '/stats',
    { preHandler: requirePermission('permissions.write') },
    async () => {
      const stats = await getRequestStats();
      return { ok: true, stats };
    }
  );

  /**
   * GET /api/permission-requests/:requestId
   * Get specific request details (admin only)
   */
  fastify.get<{ Params: RequestParams }>(
    '/:requestId',
    { preHandler: requirePermission('permissions.write') },
    async (request, reply) => {
      const { requestId } = request.params;
      const permRequest = await getRequestById(requestId);
      
      if (!permRequest) {
        return reply.code(404).send({ 
          ok: false, 
          error: 'Solicitud no encontrada' 
        });
      }
      
      return { ok: true, request: permRequest };
    }
  );

  /**
   * POST /api/permission-requests/:requestId/review
   * Review (approve/reject) a request (admin only)
   */
  fastify.post<{ Params: RequestParams; Body: ReviewRequestBody }>(
    '/:requestId/review',
    { preHandler: requirePermission('permissions.write') },
    async (request, reply) => {
      const { requestId } = request.params;
      const { action, rejectionReason, approvedPermissions, blockPermissions } = request.body;
      const reviewerId = request.agent!._id.toString();

      if (!['approve', 'reject', 'approve_partial'].includes(action)) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Acción inválida' 
        });
      }

      if (action === 'reject' && !rejectionReason) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Se requiere razón de rechazo' 
        });
      }

      if (action === 'approve_partial' && (!approvedPermissions || approvedPermissions.length === 0)) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Se requieren permisos aprobados para aprobación parcial' 
        });
      }

      const result = await reviewRequest({
        requestId,
        reviewerId,
        action,
        rejectionReason,
        approvedPermissions,
        blockPermissions
      });

      if (!result.ok) {
        return reply.code(400).send(result);
      }

      return { ok: true, request: result.request };
    }
  );

  /**
   * POST /api/permission-requests/unblock
   * Unblock a permission for an agent (admin only)
   */
  fastify.post<{ Body: UnblockBody }>(
    '/unblock',
    { preHandler: requirePermission('permissions.write') },
    async (request, reply) => {
      const { agentId, permission } = request.body;

      if (!agentId || !permission) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Se requiere agentId y permission' 
        });
      }

      const unblocked = await unblockPermission(agentId, permission);
      return { ok: true, unblocked };
    }
  );

  /**
   * DELETE /api/permission-requests/:requestId
   * Cancel/delete a request (admin only)
   */
  fastify.delete<{ Params: RequestParams }>(
    '/:requestId',
    { preHandler: requirePermission('permissions.write') },
    async (request) => {
      const { requestId } = request.params;
      const reviewerId = request.agent!._id.toString();
      
      const cancelled = await cancelRequest(requestId, reviewerId);
      return { ok: cancelled };
    }
  );
}

/**
 * Permission Request Service
 * Handles CRUD operations for permission access requests
 */

import { Types } from 'mongoose';
import { PermissionRequest, type IPermissionRequest, type IPermissionItem } from '../database/models/PermissionRequest.js';
import { Agent } from '../database/models/Agent.js';
import { grantPermissions, getEffectivePermissions } from './permission.service.js';
import { logger } from './logger.js';
import { emitPermissionsUpdated } from './socket.js';

// ============= TYPES =============

export interface CreateRequestInput {
  agentId: string;
  permission: string;
  reason: string;
  page?: string;
}

export interface ReviewRequestInput {
  requestId: string;
  reviewerId: string;
  action: 'approve' | 'reject' | 'approve_partial';
  rejectionReason?: string;
  approvedPermissions?: string[];  // For partial approval
  blockPermissions?: boolean;       // Block rejected permissions from future requests
}

export interface RequestWithAgent {
  _id: Types.ObjectId;
  agent: {
    _id: Types.ObjectId;
    name: string;
    email: string;
    avatar?: string;
    role: string;
  };
  permissions: IPermissionItem[];
  status: 'pending' | 'approved' | 'rejected' | 'partial';
  blockedPermissions: string[];
  rejectionReason?: string;
  reviewedBy?: {
    _id: Types.ObjectId;
    name: string;
  };
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============= QUERIES =============

/**
 * Get all pending permission requests (for admins)
 */
export async function getPendingRequests(): Promise<RequestWithAgent[]> {
  const requests = await PermissionRequest.find({ status: 'pending' })
    .populate('agent', 'name email avatar role')
    .populate('reviewedBy', 'name')
    .sort({ createdAt: -1 })
    .lean();
  
  return requests as unknown as RequestWithAgent[];
}

/**
 * Get all requests (for admins) with filters
 */
export async function getAllRequests(filters?: {
  status?: string;
  agentId?: string;
  limit?: number;
}): Promise<RequestWithAgent[]> {
  const query: any = {};
  
  if (filters?.status) {
    query.status = filters.status;
  }
  if (filters?.agentId) {
    query.agent = filters.agentId;
  }
  
  const requests = await PermissionRequest.find(query)
    .populate('agent', 'name email avatar role')
    .populate('reviewedBy', 'name')
    .sort({ updatedAt: -1 })
    .limit(filters?.limit || 100)
    .lean();
  
  return requests as unknown as RequestWithAgent[];
}

/**
 * Get request by ID
 */
export async function getRequestById(requestId: string): Promise<RequestWithAgent | null> {
  const request = await PermissionRequest.findById(requestId)
    .populate('agent', 'name email avatar role')
    .populate('reviewedBy', 'name')
    .lean();
  
  return request as RequestWithAgent | null;
}

/**
 * Get agent's pending request
 */
export async function getAgentPendingRequest(agentId: string): Promise<IPermissionRequest | null> {
  return PermissionRequest.findOne({ 
    agent: agentId, 
    status: 'pending' 
  });
}

/**
 * Check if a permission is in agent's pending request
 */
export async function isPermissionPending(agentId: string, permission: string): Promise<boolean> {
  const request = await PermissionRequest.findOne({
    agent: agentId,
    status: 'pending',
    'permissions.permission': permission
  });
  return !!request;
}

/**
 * Check if a permission is blocked for agent (rejected and not allowed to re-request)
 */
export async function isPermissionBlocked(agentId: string, permission: string): Promise<boolean> {
  const blockedRequest = await PermissionRequest.findOne({
    agent: agentId,
    blockedPermissions: permission
  });
  return !!blockedRequest;
}

/**
 * Get blocked permissions for an agent
 */
export async function getBlockedPermissions(agentId: string): Promise<string[]> {
  const requests = await PermissionRequest.find({
    agent: agentId,
    blockedPermissions: { $exists: true, $ne: [] }
  }).select('blockedPermissions');
  
  const blocked = new Set<string>();
  requests.forEach(r => r.blockedPermissions.forEach(p => blocked.add(p)));
  return Array.from(blocked);
}

/**
 * Get permission request status for an agent
 * Returns status info for each permission the agent might want
 */
export async function getAgentRequestStatus(agentId: string): Promise<{
  pending: IPermissionItem[];
  blocked: string[];
  hasActiveRequest: boolean;
}> {
  const [pendingRequest, blockedPerms] = await Promise.all([
    getAgentPendingRequest(agentId),
    getBlockedPermissions(agentId)
  ]);
  
  return {
    pending: pendingRequest?.permissions || [],
    blocked: blockedPerms,
    hasActiveRequest: !!pendingRequest
  };
}

// ============= MUTATIONS =============

/**
 * Create or update permission request
 * If agent has pending request, add permission to it
 * If not, create new request
 */
export async function requestPermission(input: CreateRequestInput): Promise<{
  ok: boolean;
  request?: IPermissionRequest;
  error?: string;
  alreadyPending?: boolean;
  blocked?: boolean;
}> {
  const { agentId, permission, reason, page } = input;
  
  try {
    // Check if permission is blocked
    const isBlocked = await isPermissionBlocked(agentId, permission);
    if (isBlocked) {
      return { 
        ok: false, 
        error: 'Este permiso ha sido bloqueado. Contacta a un administrador.',
        blocked: true
      };
    }
    
    // Check if already in pending request
    const isPending = await isPermissionPending(agentId, permission);
    if (isPending) {
      return { 
        ok: false, 
        error: 'Ya tienes una solicitud pendiente para este permiso.',
        alreadyPending: true
      };
    }
    
    // Find or create pending request
    let request = await getAgentPendingRequest(agentId);
    
    if (request) {
      // Add to existing request
      request.permissions.push({
        permission,
        reason,
        requestedAt: new Date(),
        page
      });
      await request.save();
    } else {
      // Create new request
      request = await PermissionRequest.create({
        agent: agentId,
        permissions: [{
          permission,
          reason,
          requestedAt: new Date(),
          page
        }],
        status: 'pending'
      });
    }
    
    logger.info('api', {
      action: 'permission_request_created',
      agentId,
      permission,
      requestId: request._id.toString()
    });
    
    return { ok: true, request };
  } catch (error) {
    logger.error('api', {
      action: 'permission_request_error',
      agentId,
      permission,
      error: String(error)
    });
    return { ok: false, error: 'Error al crear la solicitud' };
  }
}

/**
 * Review (approve/reject) a permission request
 */
export async function reviewRequest(input: ReviewRequestInput): Promise<{
  ok: boolean;
  request?: IPermissionRequest;
  error?: string;
}> {
  const { requestId, reviewerId, action, rejectionReason, approvedPermissions, blockPermissions } = input;
  
  try {
    const request = await PermissionRequest.findById(requestId);
    if (!request) {
      return { ok: false, error: 'Solicitud no encontrada' };
    }
    
    if (request.status !== 'pending') {
      return { ok: false, error: 'Esta solicitud ya fue procesada' };
    }
    
    const agent = await Agent.findById(request.agent);
    if (!agent) {
      return { ok: false, error: 'Agente no encontrado' };
    }
    
    request.reviewedBy = new Types.ObjectId(reviewerId);
    request.reviewedAt = new Date();
    
    if (action === 'approve') {
      // Approve all permissions
      request.status = 'approved';
      
      // Add all permissions to agent using grantPermissions
      const permissionsToGrant = request.permissions.map(p => p.permission);
      await grantPermissions(request.agent.toString(), permissionsToGrant, reviewerId);
      
      // Get effective permissions and emit event
      try {
        const finalPermissions = await getEffectivePermissions(request.agent.toString());
        const updatedAgent = await Agent.findById(request.agent).lean();
        
        if (updatedAgent) {
          await emitPermissionsUpdated(request.agent.toString(), {
            permissions: finalPermissions,
            role: updatedAgent.role,
            permissionVersion: updatedAgent.permissionVersion || 1,
            updatedBy: {
              id: reviewerId,
              name: 'Admin',
            },
          });
        }
      } catch (e) {
        logger.error('api', { action: 'emit_permissions_error', error: String(e) });
      }
      
      logger.info('api', {
        action: 'permission_request_approved',
        requestId,
        agentId: request.agent.toString(),
        permissions: request.permissions.map(p => p.permission),
        reviewerId
      });
      
    } else if (action === 'reject') {
      // Reject all permissions
      request.status = 'rejected';
      request.rejectionReason = rejectionReason;
      
      // Optionally block permissions from future requests
      if (blockPermissions) {
        request.blockedPermissions = request.permissions.map(p => p.permission);
      }
      
      logger.info('api', {
        action: 'permission_request_rejected',
        requestId,
        agentId: request.agent.toString(),
        permissions: request.permissions.map(p => p.permission),
        reviewerId,
        blocked: blockPermissions
      });
      
    } else if (action === 'approve_partial' && approvedPermissions) {
      // Partial approval
      request.status = 'partial';
      
      const approved = request.permissions.filter(p => 
        approvedPermissions.includes(p.permission)
      );
      const rejected = request.permissions.filter(p => 
        !approvedPermissions.includes(p.permission)
      );
      
      // Add approved permissions using grantPermissions
      const permissionsToGrant = approved.map(p => p.permission);
      if (permissionsToGrant.length > 0) {
        await grantPermissions(request.agent.toString(), permissionsToGrant, reviewerId);
      }
      
      // Block rejected if requested
      if (blockPermissions) {
        request.blockedPermissions = rejected.map(p => p.permission);
      }
      
      // Emit WebSocket event
      try {
        const finalPermissions = await getEffectivePermissions(request.agent.toString());
        const updatedAgent = await Agent.findById(request.agent).lean();
        
        if (updatedAgent) {
          await emitPermissionsUpdated(request.agent.toString(), {
            permissions: finalPermissions,
            role: updatedAgent.role,
            permissionVersion: updatedAgent.permissionVersion || 1,
            updatedBy: {
              id: reviewerId,
              name: 'Admin',
            },
          });
        }
      } catch (e) {
        logger.error('api', { action: 'emit_permissions_error', error: String(e) });
      }
      
      logger.info('api', {
        action: 'permission_request_partial',
        requestId,
        agentId: request.agent.toString(),
        approved: approved.map(p => p.permission),
        rejected: rejected.map(p => p.permission),
        reviewerId
      });
    }
    
    await request.save();
    return { ok: true, request };
    
  } catch (error) {
    logger.error('api', {
      action: 'permission_review_error',
      requestId,
      error: String(error)
    });
    return { ok: false, error: 'Error al procesar la solicitud' };
  }
}

/**
 * Unblock a permission for an agent
 */
export async function unblockPermission(agentId: string, permission: string): Promise<boolean> {
  const result = await PermissionRequest.updateMany(
    { agent: agentId },
    { $pull: { blockedPermissions: permission } }
  );
  return result.modifiedCount > 0;
}

/**
 * Cancel a pending request (by agent or admin)
 */
export async function cancelRequest(requestId: string, cancelledBy: string): Promise<boolean> {
  const result = await PermissionRequest.findOneAndUpdate(
    { _id: requestId, status: 'pending' },
    { 
      status: 'rejected',
      rejectionReason: 'Solicitud cancelada',
      reviewedBy: cancelledBy,
      reviewedAt: new Date()
    }
  );
  return !!result;
}

/**
 * Get request statistics
 */
export async function getRequestStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}> {
  const [pending, approved, rejected, total] = await Promise.all([
    PermissionRequest.countDocuments({ status: 'pending' }),
    PermissionRequest.countDocuments({ status: 'approved' }),
    PermissionRequest.countDocuments({ status: 'rejected' }),
    PermissionRequest.countDocuments()
  ]);
  
  return { pending, approved, rejected, total };
}

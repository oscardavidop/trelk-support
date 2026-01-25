/**
 * Fastify Authentication Plugin
 * JWT middleware for protected routes with RBAC permission support
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, getAgentFromToken } from '../services/auth.service.js';
import type { IAgent } from '../database/index.js';
import { 
  checkAgentPermission, 
  getEffectivePermissions,
  hasPermission,
  requiresConfirmation,
  validateDestructiveAction,
  DESTRUCTIVE_PERMISSIONS,
} from '../services/permission.service.js';
import { logAuditFromRequest } from '../services/audit-log.service.js';

// Extend FastifyRequest to include agent and permissions
declare module 'fastify' {
  interface FastifyRequest {
    agent?: IAgent;
    effectivePermissions?: string[];
  }
}

/**
 * Authentication middleware
 */
export async function authMiddleware(
  request: FastifyRequest, 
  reply: FastifyReply
): Promise<void> {
  try {
    // Get token from header or cookie
    const authHeader = request.headers.authorization;
    let token: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (request.cookies?.token) {
      token = request.cookies.token;
    }
    
    if (!token) {
      return reply.code(401).send({ 
        ok: false, 
        error: 'Authentication required' 
      });
    }
    
    // Verify and get agent
    const agent = await getAgentFromToken(token);
    
    if (!agent) {
      return reply.code(401).send({ 
        ok: false, 
        error: 'Invalid or expired token' 
      });
    }
    
    // Attach agent to request
    request.agent = agent;
  } catch (error) {
    return reply.code(401).send({ 
      ok: false, 
      error: 'Authentication failed' 
    });
  }
}

/**
 * Admin-only middleware
 */
export async function adminMiddleware(
  request: FastifyRequest, 
  reply: FastifyReply
): Promise<void> {
  // First run auth middleware
  await authMiddleware(request, reply);
  
  if (!request.agent) return;
  
  if (request.agent.role !== 'admin') {
    return reply.code(403).send({ 
      ok: false, 
      error: 'Admin access required' 
    });
  }
}

/**
 * Optional authentication (for public endpoints that can benefit from auth)
 */
export async function optionalAuth(
  request: FastifyRequest, 
  _reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;
    let token: string | undefined;
    
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (request.cookies?.token) {
      token = request.cookies.token;
    }
    
    if (token) {
      const agent = await getAgentFromToken(token);
      if (agent) {
        request.agent = agent;
      }
    }
  } catch {
    // Ignore errors - auth is optional
  }
}

/**
 * Role-based access control middleware factory
 * Creates a middleware that requires one of the specified roles
 */
export function requireRole(allowedRoles: string[]): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // First ensure auth
    await authMiddleware(request, reply);
    
    if (!request.agent) return;
    
    // Check role hierarchy
    const agent = request.agent;
    const hasRole = allowedRoles.some(role => {
      // Admin has all permissions
      if (agent.role === 'admin') return true;
      // Supervisor can access supervisor or lower
      if (agent.role === 'supervisor' && ['supervisor', 'support', 'junior'].includes(role)) return true;
      // Direct role match
      return agent.role === role;
    });
    
    if (!hasRole) {
      return reply.code(403).send({
        ok: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }
  };
}

/**
 * Supervisor or admin only middleware
 */
export async function supervisorMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  await authMiddleware(request, reply);
  
  if (!request.agent) return;
  
  if (!['admin', 'supervisor'].includes(request.agent.role)) {
    return reply.code(403).send({
      ok: false,
      error: 'Supervisor access required',
    });
  }
}

// ============= PERMISSION-BASED MIDDLEWARE =============

/**
 * Standard forbidden response
 */
function forbiddenResponse(reply: FastifyReply, permission: string, reason?: string) {
  return reply.code(403).send({
    ok: false,
    error: 'FORBIDDEN',
    message: reason || `No tienes permiso para acceder a este recurso`,
    requiredPermission: permission,
  });
}

/**
 * Permission guard middleware factory
 * Creates a middleware that requires a specific permission
 * 
 * @example
 * fastify.get('/api/contacts', { preHandler: requirePermission('contacts.read') }, handler)
 */
export function requirePermission(
  permission: string
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Ensure authentication first
    await authMiddleware(request, reply);
    if (!request.agent) return;
    
    const agent = request.agent;
    
    // Check permission
    const result = checkAgentPermission(agent, permission);
    
    if (!result.allowed) {
      // Log access denied
      await logAuditFromRequest({
        request,
        action: 'access.denied',
        category: 'security',
        targetType: 'setting',
        targetId: request.url,
        targetDescription: `Access denied: ${permission}`,
        severity: 'medium',
      });
      
      return forbiddenResponse(reply, permission, result.reason);
    }
  };
}

/**
 * Require any of the specified permissions
 * 
 * @example
 * fastify.get('/api/data', { preHandler: requireAnyPermission(['data.read', 'data.admin']) }, handler)
 */
export function requireAnyPermission(
  permissions: string[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authMiddleware(request, reply);
    if (!request.agent) return;
    
    const agent = request.agent;
    const hasAny = permissions.some(p => checkAgentPermission(agent, p).allowed);
    
    if (!hasAny) {
      await logAuditFromRequest({
        request,
        action: 'access.denied',
        category: 'security',
        targetType: 'setting',
        targetId: request.url,
        targetDescription: `Access denied: requires one of [${permissions.join(', ')}]`,
        severity: 'medium',
      });
      
      return reply.code(403).send({
        ok: false,
        error: 'FORBIDDEN',
        message: 'No tienes permiso para acceder a este recurso',
        requiredPermissions: permissions,
        requiresAny: true,
      });
    }
  };
}

/**
 * Require all of the specified permissions
 * 
 * @example
 * fastify.delete('/api/data', { preHandler: requireAllPermissions(['data.read', 'data.delete']) }, handler)
 */
export function requireAllPermissions(
  permissions: string[]
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authMiddleware(request, reply);
    if (!request.agent) return;
    
    const agent = request.agent;
    const missing = permissions.filter(p => !checkAgentPermission(agent, p).allowed);
    
    if (missing.length > 0) {
      await logAuditFromRequest({
        request,
        action: 'access.denied',
        category: 'security',
        targetType: 'setting',
        targetId: request.url,
        targetDescription: `Access denied: missing [${missing.join(', ')}]`,
        severity: 'medium',
      });
      
      return reply.code(403).send({
        ok: false,
        error: 'FORBIDDEN',
        message: 'No tienes permiso para acceder a este recurso',
        requiredPermissions: permissions,
        missingPermissions: missing,
        requiresAll: true,
      });
    }
  };
}

/**
 * Destructive action guard
 * Requires admin role + specific permission + confirmation
 * 
 * @example
 * fastify.delete('/api/chats/all', { preHandler: requireDestructivePermission('chats.delete_all') }, handler)
 */
export function requireDestructivePermission(
  permission: string
): (request: FastifyRequest, reply: FastifyReply) => Promise<void> {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authMiddleware(request, reply);
    if (!request.agent) return;
    
    const agent = request.agent;
    
    // Must be admin
    if (agent.role !== 'admin') {
      await logAuditFromRequest({
        request,
        action: 'destructive.denied.not_admin',
        category: 'security',
        targetType: 'setting',
        targetId: request.url,
        targetDescription: `Destructive action denied: ${permission} (not admin)`,
        severity: 'high',
      });
      
      return reply.code(403).send({
        ok: false,
        error: 'FORBIDDEN',
        message: 'Esta acción requiere rol de administrador',
        requiredRole: 'admin',
      });
    }
    
    // Check permission
    const result = checkAgentPermission(agent, permission);
    if (!result.allowed) {
      return forbiddenResponse(reply, permission, result.reason);
    }
    
    // Check confirmation text in body or header
    const body = request.body as Record<string, unknown> | undefined;
    const confirmationText = body?.confirmationText as string | undefined 
      || request.headers['x-confirm-destructive'] as string | undefined;
    
    if (!confirmationText || confirmationText !== 'CONFIRM') {
      await logAuditFromRequest({
        request,
        action: 'destructive.denied.no_confirmation',
        category: 'security',
        targetType: 'setting',
        targetId: request.url,
        targetDescription: `Destructive action denied: ${permission} (no confirmation)`,
        severity: 'high',
      });
      
      return reply.code(400).send({
        ok: false,
        error: 'CONFIRMATION_REQUIRED',
        message: 'Esta acción destructiva requiere confirmación. Envía confirmationText: "CONFIRM"',
        requiredConfirmation: 'CONFIRM',
      });
    }
    
    // Log successful destructive action authorization
    await logAuditFromRequest({
      request,
      action: 'destructive.authorized',
      category: 'security',
      targetType: 'setting',
      targetId: request.url,
      targetDescription: `Destructive action authorized: ${permission}`,
      severity: 'critical',
    });
  };
}

/**
 * Helper to check permission in route handler
 * Use this for conditional permission checks within a handler
 * 
 * @example
 * if (!can(request.agent, 'contacts.delete')) {
 *   return reply.code(403).send({ error: 'Cannot delete contacts' });
 * }
 */
export function can(agent: IAgent | undefined, permission: string): boolean {
  if (!agent) return false;
  return checkAgentPermission(agent, permission).allowed;
}

/**
 * Check if agent can perform any of the permissions
 */
export function canAny(agent: IAgent | undefined, permissions: string[]): boolean {
  if (!agent) return false;
  return permissions.some(p => checkAgentPermission(agent, p).allowed);
}

/**
 * Check if agent can perform all of the permissions
 */
export function canAll(agent: IAgent | undefined, permissions: string[]): boolean {
  if (!agent) return false;
  return permissions.every(p => checkAgentPermission(agent, p).allowed);
}

/**
 * Agent permissions decorator for routes
 * Attaches effective permissions to request for use in handlers
 */
export async function attachPermissions(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  if (request.agent) {
    request.effectivePermissions = await getEffectivePermissions(
      request.agent._id.toString()
    );
  }
}

/**
 * Fastify Authentication Plugin
 * JWT middleware for protected routes
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, getAgentFromToken } from '../services/auth.service.js';
import type { IAgent } from '../database/index.js';

// Extend FastifyRequest to include agent
declare module 'fastify' {
  interface FastifyRequest {
    agent?: IAgent;
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

/**
 * Agent Management Routes
 * API endpoints for agent CRUD operations
 * Uses RBAC permissions for access control
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission, can } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rate-limit.js';
import {
  getAllAgents,
  findAgentById,
  getOnlineAgents,
  updateAgentProfile,
  updateAgentStatus,
  updateAgentPassword,
  deleteAgent,
  getAgentStats,
} from '../services/agent.service.js';
import {
  remoteLockAgent,
  forceUnlock,
  isAgentLocked,
  remoteLockWithSocket,
  notifyAgentDeactivated,
  isAgentOnline,
  forceLogoutAgent,
} from '../services/auto-lock.service.js';
import { agentSockets } from '../services/socket.js';
import {
  getActiveSessions,
  invalidateSession,
  invalidateAllAgentSessions,
} from '../database/models/AgentSession.js';

interface AgentParams {
  agentId: string;
}

interface UpdateProfileBody {
  name?: string;
  avatar?: string;
}

interface UpdateStatusBody {
  status: 'online' | 'away' | 'offline';
}

interface UpdatePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export async function registerAgentRoutes(fastify: FastifyInstance): Promise<void> {
  
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);
  
  // ============= AGENT LIST =============
  
  /**
   * Get all agents
   */
  fastify.get('/api/agents', async () => {
    const agents = await getAllAgents();
    return { ok: true, agents };
  });
  
  /**
   * Get online agents
   */
  fastify.get('/api/agents/online', async () => {
    const agents = await getOnlineAgents();
    return { ok: true, agents };
  });
  
  /**
   * Get agent statistics
   */
  fastify.get('/api/agents/stats', async () => {
    const stats = await getAgentStats();
    return { ok: true, stats };
  });
  
  // ============= SINGLE AGENT =============
  
  /**
   * Get single agent by ID
   * Only self, supervisors, or admins can view full profile
   */
  fastify.get<{ Params: AgentParams }>('/api/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params;
    const currentAgent = request.agent!;
    
    // IDOR FIX: Only allow viewing own profile, or require agents.view permission
    const isSelf = currentAgent._id.toString() === agentId;
    const canViewAgents = can(currentAgent, 'agents.view') || ['admin', 'supervisor'].includes(currentAgent.role);
    
    if (!isSelf && !canViewAgents) {
      return reply.code(403).send({ ok: false, error: 'Not authorized to view this agent' });
    }
    
    const agent = await findAgentById(agentId);
    
    if (!agent) {
      return reply.code(404).send({ ok: false, error: 'Agent not found' });
    }
    
    return { ok: true, agent };
  });
  
  // ============= CURRENT AGENT =============
  
  /**
   * Update current agent's profile
   */
  fastify.patch<{ Body: UpdateProfileBody }>('/api/agents/me/profile', async (request, reply) => {
    const agentId = request.agent!._id.toString();
    const { name, avatar } = request.body;
    
    const agent = await updateAgentProfile(agentId, { name, avatar });
    
    if (!agent) {
      return reply.code(404).send({ ok: false, error: 'Agent not found' });
    }
    
    return { ok: true, agent };
  });
  
  /**
   * Update current agent's status
   */
  fastify.patch<{ Body: UpdateStatusBody }>('/api/agents/me/status', async (request, reply) => {
    const agentId = request.agent!._id.toString();
    const { status } = request.body;
    
    if (!['online', 'away', 'offline'].includes(status)) {
      return reply.code(400).send({ ok: false, error: 'Invalid status' });
    }
    
    await updateAgentStatus(agentId, status);
    
    return { ok: true };
  });
  
  /**
   * Update current agent's password
   * Rate limited to prevent brute force of current password
   */
  fastify.patch<{ Body: UpdatePasswordBody }>(
    '/api/agents/me/password',
    { preHandler: authRateLimit },
    async (request, reply) => {
    const agentId = request.agent!._id.toString();
    const { currentPassword, newPassword } = request.body;
    
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ ok: false, error: 'Current and new password required' });
    }
    
    if (newPassword.length < 8) {
      return reply.code(400).send({ ok: false, error: 'Password must be at least 8 characters' });
    }
    
    // Verify current password
    const { Agent } = await import('../database/index.js');
    const agent = await Agent.findById(agentId).select('+password');
    
    if (!agent) {
      return reply.code(404).send({ ok: false, error: 'Agent not found' });
    }
    
    const isValid = await agent.comparePassword(currentPassword);
    
    if (!isValid) {
      return reply.code(401).send({ ok: false, error: 'Current password is incorrect' });
    }
    
    await updateAgentPassword(agentId, newPassword);
    
    return { ok: true };
  });
  
  // ============= ADMIN ROUTES =============
  
  /**
   * Delete agent
   * Requires: agents.delete
   */
  fastify.delete<{ Params: AgentParams }>(
    '/api/agents/:agentId', 
    { preHandler: requirePermission('agents.delete') },
    async (request, reply) => {
      const { agentId } = request.params;
      
      // Can't delete yourself
      if (agentId === request.agent!._id.toString()) {
        return reply.code(400).send({ ok: false, error: 'Cannot delete yourself' });
      }
      
      const deleted = await deleteAgent(agentId);
      
      if (!deleted) {
        return reply.code(404).send({ ok: false, error: 'Agent not found' });
      }
      
      return { ok: true };
    }
  );

  // ============= AUTO-LOCK ADMIN ROUTES =============

  /**
   * Get agent lock status
   * Requires: agents.view
   */
  fastify.get<{ Params: AgentParams }>(
    '/api/agents/:agentId/lock',
    { preHandler: requirePermission('agents.view') },
    async (request, reply) => {
      const { agentId } = request.params;
      
      const agent = await findAgentById(agentId);
      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Agente no encontrado' });
      }
      
      const lockState = await isAgentLocked(agentId);
      
      return {
        ok: true,
        agentId,
        agentName: agent.name,
        lockState: lockState || { isLocked: false },
      };
    }
  );

  /**
   * Remote lock an agent's session
   * Requires: agents.manage or admin role
   */
  fastify.post<{ Params: AgentParams }>(
    '/api/agents/:agentId/lock',
    { preHandler: requirePermission('agents.manage') },
    async (request, reply) => {
      const { agentId } = request.params;
      const adminAgent = request.agent!;
      
      // Use socket-aware lock function
      const result = await remoteLockWithSocket(
        agentId,
        adminAgent._id.toString(),
        adminAgent.name,
        request
      );
      
      if (!result.success) {
        return reply.code(400).send({ ok: false, error: result.error });
      }
      
      return { ok: true, message: 'Sesión bloqueada remotamente' };
    }
  );

  /**
   * Force unlock an agent's session
   * Requires: agents.manage or admin role
   */
  fastify.post<{ Params: AgentParams }>(
    '/api/agents/:agentId/unlock',
    { preHandler: requirePermission('agents.manage') },
    async (request, reply) => {
      const { agentId } = request.params;
      const adminAgent = request.agent!;
      
      const result = await forceUnlock(
        agentId,
        adminAgent._id.toString(),
        request
      );
      
      if (!result.success) {
        return reply.code(400).send({ ok: false, error: result.error });
      }
      
      return { ok: true, message: 'Sesión desbloqueada' };
    }
  );

  // ============= AGENT SESSIONS (LOGIN SESSIONS) =============

  /**
   * Get active sessions for an agent
   * Requires: agents.view
   */
  fastify.get<{ Params: AgentParams }>(
    '/api/agents/:agentId/sessions',
    { preHandler: requirePermission('agents.view') },
    async (request, reply) => {
      const { agentId } = request.params;
      
      const agent = await findAgentById(agentId);
      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Agente no encontrado' });
      }
      
      const sessions = await getActiveSessions(agentId);
      const isOnline = isAgentOnline(agentId);
      
      return {
        ok: true,
        agentId,
        agentName: agent.name,
        isOnline,
        sessions: sessions.map(s => ({
          _id: s._id,
          deviceType: s.deviceType,
          browser: s.browser,
          os: s.os,
          ip: s.ip,
          location: s.location,
          loginAt: s.loginAt,
          lastSeenAt: s.lastSeenAt,
          isCurrent: s.isCurrent,
        })),
      };
    }
  );

  /**
   * Invalidate a specific session for an agent
   * Requires: agents.manage
   */
  fastify.delete<{ Params: { agentId: string; sessionId: string } }>(
    '/api/agents/:agentId/sessions/:sessionId',
    { preHandler: requirePermission('agents.manage') },
    async (request, reply) => {
      const { agentId, sessionId } = request.params;
      
      const invalidated = await invalidateSession(sessionId, agentId);
      
      if (!invalidated) {
        return reply.code(404).send({ ok: false, error: 'Sesión no encontrada' });
      }
      
      // Try to force logout via socket if online
      if (isAgentOnline(agentId)) {
        forceLogoutAgent(agentId, 'Sesión invalidada por administrador');
      }
      
      return { ok: true, message: 'Sesión invalidada' };
    }
  );

  /**
   * Invalidate ALL sessions for an agent (force logout everywhere)
   * Requires: agents.manage
   */
  fastify.post<{ Params: AgentParams }>(
    '/api/agents/:agentId/sessions/invalidate-all',
    { preHandler: requirePermission('agents.manage') },
    async (request, reply) => {
      const { agentId } = request.params;
      
      const agent = await findAgentById(agentId);
      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Agente no encontrado' });
      }
      
      // Can't invalidate your own sessions
      if (agentId === request.agent!._id.toString()) {
        return reply.code(400).send({ ok: false, error: 'No puedes invalidar tus propias sesiones' });
      }
      
      const invalidatedCount = await invalidateAllAgentSessions(agentId);
      
      // Force logout via socket if online
      if (isAgentOnline(agentId)) {
        forceLogoutAgent(agentId, 'Todas las sesiones fueron invalidadas por un administrador');
      }
      
      return { 
        ok: true, 
        message: `${invalidatedCount} sesiones invalidadas`,
        invalidatedCount,
      };
    }
  );

  /**
   * Force logout an agent (only if online)
   * Requires: agents.manage
   */
  fastify.post<{ Params: AgentParams; Body: { reason?: string } }>(
    '/api/agents/:agentId/force-logout',
    { preHandler: requirePermission('agents.manage') },
    async (request, reply) => {
      const { agentId } = request.params;
      const { reason } = request.body || {};
      
      const agent = await findAgentById(agentId);
      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Agente no encontrado' });
      }
      
      if (!isAgentOnline(agentId)) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'El agente no está conectado actualmente' 
        });
      }
      
      // Force logout via socket
      forceLogoutAgent(agentId, reason || 'Desconectado por administrador');
      
      // Also invalidate their sessions
      await invalidateAllAgentSessions(agentId);
      
      return { ok: true, message: 'Agente desconectado exitosamente' };
    }
  );}
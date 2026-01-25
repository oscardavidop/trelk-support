/**
 * Agent Management Routes
 * API endpoints for agent CRUD operations
 * Uses RBAC permissions for access control
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
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
   */
  fastify.get<{ Params: AgentParams }>('/api/agents/:agentId', async (request, reply) => {
    const { agentId } = request.params;
    
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
   */
  fastify.patch<{ Body: UpdatePasswordBody }>('/api/agents/me/password', async (request, reply) => {
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
}

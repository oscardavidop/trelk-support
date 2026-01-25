/**
 * Authentication Routes
 * Login, logout, and session management for agents
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { loginAgent, logoutAgent, refreshToken } from '../services/auth.service.js';
import { createAgent } from '../services/agent.service.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { ENV } from '../config/index.js';

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'support';
}

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ============= PUBLIC ROUTES =============
  
  /**
   * Agent login
   */
  fastify.post<{ Body: LoginBody }>('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body;
    
    if (!email || !password) {
      return reply.code(400).send({ ok: false, error: 'Email and password required' });
    }
    
    const result = await loginAgent(email, password);
    
    if (!result.success) {
      return reply.code(401).send({ ok: false, error: result.error });
    }
    
    // Set HTTP-only cookie for token
    reply.setCookie('token', result.token!, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });
    
    return {
      ok: true,
      agent: result.agent,
      token: result.token,
      permissions: result.permissions,
    };
  });
  
  /**
   * Agent logout
   */
  fastify.post('/api/auth/logout', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.agent) {
      await logoutAgent(request.agent._id.toString());
    }
    
    reply.clearCookie('token', { path: '/' });
    
    return { ok: true };
  });
  
  /**
   * Refresh token
   */
  fastify.post('/api/auth/refresh', async (request, reply) => {
    const token = request.cookies?.token || request.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return reply.code(401).send({ ok: false, error: 'No token provided' });
    }
    
    const result = await refreshToken(token);
    
    if (!result.success) {
      reply.clearCookie('token', { path: '/' });
      return reply.code(401).send({ ok: false, error: result.error });
    }
    
    reply.setCookie('token', result.token!, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    
    return {
      ok: true,
      agent: result.agent,
      token: result.token,
      permissions: result.permissions,
    };
  });
  
  /**
   * Get current agent (me)
   */
  fastify.get('/api/auth/me', { preHandler: authMiddleware }, async (request) => {
    return {
      ok: true,
      agent: request.agent,
    };
  });
  
  // ============= ADMIN ROUTES =============
  
  /**
   * Register new agent
   * Requires: agents.write
   */
  fastify.post<{ Body: RegisterBody }>(
    '/api/auth/register', 
    { preHandler: requirePermission('agents.write') }, 
    async (request, reply) => {
      const { name, email, password, role } = request.body;
      
      if (!name || !email || !password) {
        return reply.code(400).send({ ok: false, error: 'Name, email, and password required' });
      }
      
      try {
        const agent = await createAgent({ name, email, password, role });
        return { ok: true, agent };
      } catch (error: any) {
        if (error.code === 11000) {
          return reply.code(409).send({ ok: false, error: 'Email already exists' });
        }
        throw error;
      }
    }
  );
  
  /**
   * Setup first admin (only when no agents exist)
   * This route is only available during initial setup
   */
  fastify.post<{ Body: RegisterBody }>('/api/auth/setup', async (request, reply) => {
    const { Agent } = await import('../database/index.js');
    const count = await Agent.countDocuments();
    
    if (count > 0) {
      return reply.code(403).send({ ok: false, error: 'Setup already completed' });
    }
    
    const { name, email, password } = request.body;
    
    if (!name || !email || !password) {
      return reply.code(400).send({ ok: false, error: 'Name, email, and password required' });
    }
    
    const agent = await createAgent({ name, email, password, role: 'admin' });
    const loginResult = await loginAgent(email, password);
    
    reply.setCookie('token', loginResult.token!, {
      httpOnly: true,
      secure: ENV.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    
    return {
      ok: true,
      agent,
      token: loginResult.token,
    };
  });
}

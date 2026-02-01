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
  deviceInfo?: {
    deviceType?: string;
    browser?: string;
    os?: string;
  };
}

interface RegisterBody {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'support';
}

/**
 * Extract device info from request headers
 */
function extractDeviceInfo(request: FastifyRequest, bodyDeviceInfo?: LoginBody['deviceInfo']) {
  const userAgent = request.headers['user-agent'] || '';
  const ip = request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown';
  
  // Basic device type detection from user agent
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'unknown';
  if (/mobile/i.test(userAgent)) {
    deviceType = /tablet|ipad/i.test(userAgent) ? 'tablet' : 'mobile';
  } else if (/windows|macintosh|linux/i.test(userAgent)) {
    deviceType = 'desktop';
  }
  
  // Basic browser detection
  let browser = 'Unknown';
  if (/chrome/i.test(userAgent) && !/edge|edg/i.test(userAgent)) browser = 'Chrome';
  else if (/firefox/i.test(userAgent)) browser = 'Firefox';
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
  else if (/edge|edg/i.test(userAgent)) browser = 'Edge';
  else if (/opera|opr/i.test(userAgent)) browser = 'Opera';
  
  // Basic OS detection
  let os = 'Unknown';
  if (/windows/i.test(userAgent)) os = 'Windows';
  else if (/macintosh|mac os/i.test(userAgent)) os = 'macOS';
  else if (/linux/i.test(userAgent) && !/android/i.test(userAgent)) os = 'Linux';
  else if (/android/i.test(userAgent)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS';
  
  return {
    deviceType: bodyDeviceInfo?.deviceType || deviceType,
    browser: bodyDeviceInfo?.browser || browser,
    os: bodyDeviceInfo?.os || os,
    ip,
  };
}

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {

  // ============= PUBLIC ROUTES =============

  /**
   * Agent login
   */
  fastify.post<{ Body: LoginBody & { deviceFingerprint?: string } }>('/api/auth/login', async (request, reply) => {
    const { email, password, deviceInfo: bodyDeviceInfo, deviceFingerprint } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ ok: false, error: 'Email and password required' });
    }

    // Extract device info from request
    const deviceInfo = extractDeviceInfo(request, bodyDeviceInfo);
    
    const result = await loginAgent(email, password, deviceInfo, { deviceFingerprint });

    if (!result.success && !result.mfaRequired) {
      return reply.code(401).send({ ok: false, error: result.error });
    }

    // Check if MFA is required
    if (result.mfaRequired) {
      // MFA required - return pending state without setting session
      if (result.mfaError) {
        return reply.code(400).send({
          ok: false,
          error: result.mfaError,
          mfaRequired: true,
        });
      }
      
      return {
        ok: true,
        mfaRequired: true,
        mfaLoginToken: result.mfaLoginToken,
        mfaExpiresIn: result.mfaExpiresIn,
        message: 'Se ha enviado un código de verificación a tu Telegram',
      };
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
      sessionsInvalidated: result.sessionsInvalidated,
      forcePasswordChange: result.forcePasswordChange,
    };
  });

  /**
   * Complete login after MFA verification
   * POST /api/auth/mfa/complete-login
   */
  fastify.post<{ Body: { loginToken: string; deviceFingerprint?: string } }>(
    '/api/auth/mfa/complete-login',
    async (request, reply) => {
      const { loginToken, deviceFingerprint } = request.body;

      if (!loginToken) {
        return reply.code(400).send({ ok: false, error: 'Login token required' });
      }

      // Verify the MFA session was completed
      const { getVerifiedMFASession } = await import('../database/index.js');
      
      const session = await getVerifiedMFASession(loginToken);
      
      // Check if session exists and is verified
      // Note: The actual verification happens in /api/auth/mfa/verify
      // This endpoint creates the actual session after MFA is confirmed
      if (!session) {
        return reply.code(401).send({ 
          ok: false, 
          error: 'Sesión MFA no verificada o expirada' 
        });
      }

      const agentId = session.agentId.toString();

      // Extract device info
      const deviceInfo = extractDeviceInfo(request);

      // Complete the login
      const { completeLoginAfterMFA } = await import('../services/auth.service.js');
      const result = await completeLoginAfterMFA(agentId, deviceInfo);

      if (!result.success) {
        return reply.code(401).send({ ok: false, error: result.error });
      }

      // Set HTTP-only cookie
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
        sessionsInvalidated: result.sessionsInvalidated,
        forcePasswordChange: result.forcePasswordChange,
      };
    }
  );

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
      forcePasswordChange: result.forcePasswordChange,
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
    
    // Extract device info for the setup login
    const deviceInfo = extractDeviceInfo(request);
    const loginResult = await loginAgent(email, password, deviceInfo);

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

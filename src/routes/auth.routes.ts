/**
 * Authentication Routes
 * Login, logout, and session management for agents
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { loginAgent, logoutAgent, refreshToken } from '../services/auth.service.js';
import { clearLockOnLogout } from '../services/auto-lock.service.js';
import { createAgent } from '../services/agent.service.js';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { authRateLimit, applyFailurePenalty } from '../middleware/rate-limit.js';
import { ENV } from '../config/index.js';
import { startQRLogin, getQRStatus } from '../services/qr-login.service.js';
import {
  getAutoLockSettings,
  getTimeoutForAgent,
  isAgentLocked,
  lockAgent,
  unlockWithPassword,
  unlockWithMFA,
  checkRemoteLock,
  updateLastActivity,
  getLastActivity,
} from '../services/auto-lock.service.js';

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

  // Get country from Cloudflare header (handle array case)
  const cfCountry = request.headers['cf-ipcountry'];
  const country = Array.isArray(cfCountry) ? cfCountry[0] : (cfCountry || 'Unknown');
  
  console.log('Extracted device info:', { deviceType, browser, os, ip, country }, request.headers);
  return {
    deviceType: bodyDeviceInfo?.deviceType || deviceType,
    browser: bodyDeviceInfo?.browser || browser,
    os: bodyDeviceInfo?.os || os,
    ip,
    country,
  };
}

/**
 * Helper to get client IP from request
 */
function getClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return ips.split(',')[0].trim();
  }
  return request.ip || 'unknown';
}

export async function registerAuthRoutes(fastify: FastifyInstance): Promise<void> {

  // ============= PUBLIC ROUTES =============

  /**
   * Agent login
   * Rate limited to prevent brute force attacks
   */
  fastify.post<{ Body: LoginBody & { deviceFingerprint?: string } }>(
    '/api/auth/login',
    { preHandler: authRateLimit },
    async (request, reply) => {
    const { email, password, deviceInfo: bodyDeviceInfo, deviceFingerprint } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ ok: false, error: 'Email and password required' });
    }

    // Extract device info from request
    const deviceInfo = extractDeviceInfo(request, bodyDeviceInfo);
    
    const result = await loginAgent(email, password, deviceInfo, { deviceFingerprint });

    if (!result.success && !result.mfaRequired) {
      // Apply penalty for failed login attempt (brute force protection)
      await applyFailurePenalty('auth', getClientIp(request), 2);
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
          mfaAvailableMethods: result.mfaAvailableMethods || [],
        });
      }
      
      // Determine the correct message based on selected method
      const selectedMethod = result.mfaSelectedMethod || 'telegram';
      const isPendingSelection = result.mfaPendingMethodSelection || false;
      const message = isPendingSelection
        ? 'Selecciona tu método de verificación'
        : selectedMethod === 'totp'
          ? 'Ingresa el código de tu app autenticadora'
          : 'Se ha enviado un código de verificación a tu Telegram';
      
      return {
        ok: true,
        mfaRequired: true,
        mfaLoginToken: result.mfaLoginToken,
        mfaExpiresIn: result.mfaExpiresIn,
        mfaAvailableMethods: result.mfaAvailableMethods || ['telegram'],
        mfaPreferredMethod: result.mfaPreferredMethod,
        mfaSelectedMethod: result.mfaSelectedMethod || 'telegram',
        mfaPendingMethodSelection: isPendingSelection,
        message,
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
      telegramLinkRequired: result.telegramLinkRequired,
      mfaSetupRequired: result.mfaSetupRequired,
      // Policy engine results
      redirect: result.redirect,
      profileIncomplete: result.profileIncomplete,
      globalAlert: result.globalAlert,
      policyAcceptanceRequired: result.policyAcceptanceRequired,
      readOnlyMode: result.readOnlyMode,
      maintenanceMode: result.maintenanceMode,
      maintenanceMessage: result.maintenanceMessage,
      warnings: result.warnings,
    };
  });

  /**
   * Complete login after MFA verification
   * POST /api/auth/mfa/complete-login
   * 
   * Security: 
   * - Session is consumed (one-time use) to prevent replay
   * - 60-second window after verification
   * - Optional IP binding for high-security
   */
  fastify.post<{ Body: { loginToken: string; deviceFingerprint?: string } }>(
    '/api/auth/mfa/complete-login',
    async (request, reply) => {
      const { loginToken, deviceFingerprint } = request.body;

      if (!loginToken) {
        return reply.code(400).send({ ok: false, error: 'Login token required' });
      }

      // Get client IP for security logging and optional binding
      const clientIp = request.ip || 
        (request.headers['x-forwarded-for'] as string)?.split(',')[0] || 
        'unknown';

      // Consume the MFA session (one-time use, atomic operation)
      const { consumeVerifiedMFASession } = await import('../database/index.js');
      const { logAudit } = await import('../services/audit-log.service.js');
      
      const session = await consumeVerifiedMFASession(loginToken);
      
      // Check if session exists, is verified, and not expired
      if (!session) {
        // Log failed attempt
        await logAudit({
          action: 'mfa_complete_login_failed',
          category: 'authentication',
          actorType: 'system',
          actorId: 'unknown' as any,
          actorName: 'Unknown',
          targetType: 'system',
          targetId: 'mfa_session',
          severity: 'medium',
          ip: clientIp,
          userAgent: request.headers['user-agent'],
          metadata: { reason: 'session_not_found_or_expired', loginToken: loginToken.substring(0, 8) + '...' },
        });
        
        return reply.code(401).send({ 
          ok: false, 
          error: 'Sesión MFA no verificada o expirada. Por favor, inicia sesión de nuevo.' 
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

      // Log successful MFA completion
      await logAudit({
        action: 'mfa_login_completed',
        category: 'authentication',
        actorType: 'agent',
        actorId: agentId,
        actorName: result.agent?.name ?? 'Unknown',
        targetType: 'agent',
        targetId: agentId,
        severity: 'low',
        ip: clientIp,
        userAgent: request.headers['user-agent'],
        metadata: { method: session.method },
      });

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
        telegramLinkRequired: result.telegramLinkRequired,
        mfaSetupRequired: result.mfaSetupRequired,
        // Policy engine results
        redirect: result.redirect,
        profileIncomplete: result.profileIncomplete,
        globalAlert: result.globalAlert,
        policyAcceptanceRequired: result.policyAcceptanceRequired,
        readOnlyMode: result.readOnlyMode,
        maintenanceMode: result.maintenanceMode,
        maintenanceMessage: result.maintenanceMessage,
        warnings: result.warnings,
      };
    }
  );

  /**
   * Agent logout
   */
  fastify.post('/api/auth/logout', { preHandler: authMiddleware }, async (request, reply) => {
    if (request.agent) {
      const agentId = request.agent._id.toString();
      await logoutAgent(agentId);
      // Clear any auto-lock state on logout
      await clearLockOnLogout(agentId);
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
      telegramLinkRequired: result.telegramLinkRequired,
      mfaSetupRequired: result.mfaSetupRequired,
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

  // ============= QR LOGIN ROUTES =============

  /**
   * Start QR Login session
   * POST /api/auth/qr/start
   * 
   * Returns a QR URL for Telegram deep link and a token for polling
   */
  fastify.post<{ Body: { deviceInfo?: { deviceType?: string; browser?: string; os?: string } } }>(
    '/api/auth/qr/start',
    { preHandler: authRateLimit },
    async (request, reply) => {
      const clientIp = getClientIp(request);
      const userAgent = request.headers['user-agent'] || '';
      const deviceInfo = extractDeviceInfo(request, request.body?.deviceInfo);

      const result = await startQRLogin(clientIp, userAgent, {
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
      });

      if (!result.success) {
        return reply.code(429).send({ ok: false, error: result.error });
      }

      return {
        ok: true,
        token: result.token,
        qrUrl: result.qrUrl,
        expiresIn: result.expiresIn,
      };
    }
  );

  /**
   * Check QR Login status (polling endpoint)
   * GET /api/auth/qr/status/:token
   * 
   * Returns current status: pending | scanned | approved | rejected | expired
   * When approved, also returns the session token and agent data
   */
  fastify.get<{ Params: { token: string }; Querystring: { deviceFingerprint?: string } }>(
    '/api/auth/qr/status/:token',
    async (request, reply) => {
      const { token } = request.params;
      const { deviceFingerprint } = request.query;
      const clientIp = getClientIp(request);
      const deviceInfo = extractDeviceInfo(request);

      if (!token || token.length < 32) {
        return reply.code(400).send({ ok: false, error: 'Token inválido' });
      }

      const result = await getQRStatus(token, clientIp, {
        ...deviceInfo,
        deviceFingerprint,
      });

      if (!result.success) {
        return reply.code(400).send({ ok: false, error: result.error });
      }

      // If login completed, set cookie
      if (result.status === 'approved' && result.loginResult) {
        reply.setCookie('token', result.loginResult.token, {
          httpOnly: true,
          secure: ENV.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });

        return {
          ok: true,
          status: 'approved',
          agent: result.loginResult.agent,
          token: result.loginResult.token,
          permissions: result.loginResult.permissions,
          forcePasswordChange: result.loginResult.forcePasswordChange,
          telegramLinkRequired: result.loginResult.telegramLinkRequired,
          mfaSetupRequired: result.loginResult.mfaSetupRequired,
        };
      }

      // If MFA is required after QR approval
      if (result.status === 'approved' && result.mfaRequired) {
        return {
          ok: true,
          status: 'approved',
          mfaRequired: true,
          mfaLoginToken: result.mfaLoginToken,
          mfaMethods: result.mfaMethods,
          agentName: result.agentName,
        };
      }

      return {
        ok: true,
        status: result.status,
        remainingSeconds: result.remainingSeconds,
        agentName: result.agentName,
      };
    }
  );

  // ============= AUTO-LOCK ROUTES =============

  /**
   * Get auto-lock settings and current lock state
   * GET /api/auth/lock/status
   */
  fastify.get(
    '/api/auth/lock/status',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = (request as any).agent;
      
      // Get settings
      const settings = await getAutoLockSettings();
      
      // Get lock state
      const lockState = await isAgentLocked(agent._id.toString());
      
      // Get timeout for this agent
      const timeoutMinutes = await getTimeoutForAgent(agent);
      
      // Check for remote lock trigger
      const hasRemoteLock = await checkRemoteLock(agent._id.toString());
      
      // Get last activity
      const lastActivity = await getLastActivity(agent._id.toString());
      
      return {
        ok: true,
        settings: {
          enabled: settings.enabled,
          timeoutMinutes,
          requirePassword: settings.requirePassword,
          requireMFA: settings.requireMFA,
          showLastActivity: settings.showLastActivity,
          gracePeriodSeconds: settings.gracePeriodSeconds,
        },
        lockState: lockState || { isLocked: false },
        hasRemoteLock,
        lastActivity,
      };
    }
  );

  /**
   * Lock current session manually
   * POST /api/auth/lock
   */
  fastify.post(
    '/api/auth/lock',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = (request as any).agent;
      
      const success = await lockAgent(
        agent._id.toString(),
        'manual',
        undefined,
        request
      );
      
      if (!success) {
        return reply.code(500).send({ ok: false, error: 'Error al bloquear sesión' });
      }
      
      return { ok: true, message: 'Sesión bloqueada' };
    }
  );

  /**
   * Unlock session with password
   * POST /api/auth/unlock
   */
  fastify.post<{ Body: { password: string } }>(
    '/api/auth/unlock',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = (request as any).agent;
      const { password } = request.body;
      
      if (!password) {
        return reply.code(400).send({ ok: false, error: 'Contraseña requerida' });
      }
      
      const result = await unlockWithPassword(
        agent._id.toString(),
        password,
        request
      );
      
      if (!result.success) {
        return reply.code(401).send({
          ok: false,
          error: result.error,
          remainingAttempts: result.remainingAttempts,
          lockoutUntil: result.lockoutUntil,
        });
      }
      
      return { ok: true, message: 'Sesión desbloqueada' };
    }
  );

  /**
   * Unlock session with MFA
   * POST /api/auth/unlock/mfa
   */
  fastify.post<{ Body: { code: string; method?: 'telegram' | 'totp' } }>(
    '/api/auth/unlock/mfa',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = (request as any).agent;
      const { code, method } = request.body;
      
      if (!code) {
        return reply.code(400).send({ ok: false, error: 'Código MFA requerido' });
      }
      
      // Verify MFA code
      const { verifyAgentTOTP } = await import('../database/index.js');
      let mfaVerified = false;
      
      if (method === 'totp' || !method) {
        // Try TOTP verification
        const totpResult = await verifyAgentTOTP(agent._id.toString(), code);
        mfaVerified = totpResult.success;
      }
      
      // TODO: Add Telegram MFA verification if needed
      
      if (!mfaVerified) {
        return reply.code(401).send({ ok: false, error: 'Código MFA inválido' });
      }
      
      const result = await unlockWithMFA(
        agent._id.toString(),
        true,
        request
      );
      
      if (!result.success) {
        return reply.code(500).send({ ok: false, error: result.error });
      }
      
      return { ok: true, message: 'Sesión desbloqueada via MFA' };
    }
  );

  /**
   * Heartbeat / Update activity
   * POST /api/auth/activity
   */
  fastify.post(
    '/api/auth/activity',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = (request as any).agent;
      
      await updateLastActivity(agent._id.toString());
      
      // Also check for remote lock
      const hasRemoteLock = await checkRemoteLock(agent._id.toString());
      const lockState = await isAgentLocked(agent._id.toString());
      
      return {
        ok: true,
        hasRemoteLock,
        isLocked: lockState?.isLocked ?? false,
        lockReason: lockState?.reason,
      };
    }
  );
}

/**
 * MFA Routes
 * API endpoints for Multi-Factor Authentication
 */

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  initiateMFA,
  verifyMFA,
  resendMFACode,
  startMFAActivation,
  completeMFAActivation,
  disableMFA,
  getMFAStatus,
  getAgentTrustedDevices,
  revokeAgentDevice,
  revokeAllAgentDevices,
  adminEnableMFA,
  adminDisableMFA,
  adminBypassMFA,
  adminRevokeBypass,
  getGlobalMFASettings,
  updateGlobalMFASettings,
} from '../services/mfa.service.js';
import { getMFASessionByToken } from '../database/index.js';
import { logger } from '../services/logger.js';

// ============= REQUEST TYPES =============

interface VerifyMFABody {
  loginToken: string;
  code: string;
  trustDevice?: boolean;
  deviceFingerprint?: string;
  deviceName?: string;
}

interface ResendCodeBody {
  loginToken: string;
}

interface ActivateMFABody {
  loginToken: string;
  code: string;
}

interface DisableMFABody {
  loginToken: string;
  code: string;
}

interface AdminMFAParams {
  agentId: string;
}

interface AdminBypassBody {
  durationMinutes?: number;
  reason?: string;
}

interface AdminDisableBody {
  reason?: string;
}

interface GlobalMFASettingsBody {
  mfaRequiredForAll?: boolean;
  mfaRequiredRoles?: string[];
  mfaBypassIPs?: string[];
  mfaTrustDevicesEnabled?: boolean;
}

interface RevokeDeviceParams {
  deviceId: string;
}

// ============= HELPER =============

function getClientInfo(request: FastifyRequest) {
  const ip = request.ip || 
    (request.headers['x-forwarded-for'] as string)?.split(',')[0] || 
    (request.headers['x-real-ip'] as string) ||
    'unknown';
  const userAgent = request.headers['user-agent'];
  
  return { ip, userAgent };
}

// ============= ROUTES =============

export async function registerMFARoutes(fastify: FastifyInstance): Promise<void> {

  // ============= PUBLIC ROUTES (During Login) =============

  /**
   * Verify MFA code
   * POST /api/auth/mfa/verify
   */
  fastify.post<{ Body: VerifyMFABody }>(
    '/api/auth/mfa/verify',
    async (request, reply) => {
      const { loginToken, code, trustDevice, deviceFingerprint, deviceName } = request.body;

      if (!loginToken || !code) {
        return reply.code(400).send({
          ok: false,
          error: 'Token y código son requeridos',
        });
      }

      // Validate code format
      if (!/^\d{6}$/.test(code)) {
        return reply.code(400).send({
          ok: false,
          error: 'El código debe ser de 6 dígitos',
        });
      }

      const { ip, userAgent } = getClientInfo(request);

      const result = await verifyMFA(loginToken, code, {
        ip,
        userAgent,
        trustDevice,
        deviceFingerprint,
        deviceName,
      });

      if (!result.success) {
        const statusCode = result.blockedUntil ? 429 : 401;
        return reply.code(statusCode).send({
          ok: false,
          error: result.error,
          remainingAttempts: result.remainingAttempts,
          blockedUntil: result.blockedUntil,
        });
      }

      // Return agentId for completing the login
      return {
        ok: true,
        agentId: result.agentId,
        message: 'Verificación exitosa',
      };
    }
  );

  /**
   * Resend MFA code
   * POST /api/auth/mfa/resend
   */
  fastify.post<{ Body: ResendCodeBody }>(
    '/api/auth/mfa/resend',
    async (request, reply) => {
      const { loginToken } = request.body;

      if (!loginToken) {
        return reply.code(400).send({
          ok: false,
          error: 'Token requerido',
        });
      }

      const { ip, userAgent } = getClientInfo(request);

      const result = await resendMFACode(loginToken, { ip, userAgent });

      if (!result.success) {
        const statusCode = result.waitSeconds ? 429 : 400;
        return reply.code(statusCode).send({
          ok: false,
          error: result.error,
          waitSeconds: result.waitSeconds,
        });
      }

      return {
        ok: true,
        message: 'Código reenviado a tu Telegram',
      };
    }
  );

  /**
   * Check MFA session status
   * GET /api/auth/mfa/status?loginToken=xxx
   */
  fastify.get<{ Querystring: { loginToken: string } }>(
    '/api/auth/mfa/status',
    async (request, reply) => {
      const { loginToken } = request.query;

      if (!loginToken) {
        return reply.code(400).send({
          ok: false,
          error: 'Token requerido',
        });
      }

      const session = await getMFASessionByToken(loginToken);

      if (!session) {
        return reply.code(404).send({
          ok: false,
          error: 'Sesión no encontrada o expirada',
        });
      }

      return {
        ok: true,
        status: session.status,
        expiresAt: session.expiresAt,
        attempts: session.attempts,
        maxAttempts: session.maxAttempts,
      };
    }
  );

  // ============= AUTHENTICATED ROUTES =============

  /**
   * Get current user's MFA status
   * GET /api/auth/mfa/my-status
   */
  fastify.get(
    '/api/auth/mfa/my-status',
    { preHandler: authMiddleware },
    async (request) => {
      const status = await getMFAStatus(request.agent!._id.toString());
      return { ok: true, ...status };
    }
  );

  /**
   * Start MFA activation
   * POST /api/auth/mfa/activate/start
   */
  fastify.post(
    '/api/auth/mfa/activate/start',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { ip, userAgent } = getClientInfo(request);

      const result = await startMFAActivation(
        request.agent!._id.toString(),
        { ip, userAgent }
      );

      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }

      return {
        ok: true,
        loginToken: result.loginToken,
        expiresIn: result.expiresIn,
        message: result.message,
      };
    }
  );

  /**
   * Complete MFA activation
   * POST /api/auth/mfa/activate/complete
   */
  fastify.post<{ Body: ActivateMFABody }>(
    '/api/auth/mfa/activate/complete',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { loginToken, code } = request.body;

      if (!loginToken || !code) {
        return reply.code(400).send({
          ok: false,
          error: 'Token y código son requeridos',
        });
      }

      const { ip, userAgent } = getClientInfo(request);

      const result = await completeMFAActivation(
        request.agent!._id.toString(),
        loginToken,
        code,
        { ip, userAgent }
      );

      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }

      return {
        ok: true,
        message: 'MFA activado exitosamente',
      };
    }
  );

  /**
   * Start MFA disable process (sends verification code)
   * POST /api/auth/mfa/disable/start
   */
  fastify.post(
    '/api/auth/mfa/disable/start',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agent = request.agent!;
      
      if (!agent.mfaEnabled) {
        return reply.code(400).send({
          ok: false,
          error: 'MFA no está activado',
        });
      }

      if (agent.mfaEnforcedByAdmin) {
        return reply.code(403).send({
          ok: false,
          error: 'MFA fue activado por un administrador y no puede ser desactivado',
        });
      }

      const { ip, userAgent } = getClientInfo(request);

      // Use same flow as activation to send code
      const result = await startMFAActivation(
        agent._id.toString(),
        { ip, userAgent }
      );

      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }

      return {
        ok: true,
        loginToken: result.loginToken,
        message: 'Código de verificación enviado a tu Telegram',
      };
    }
  );

  /**
   * Complete MFA disable
   * POST /api/auth/mfa/disable/complete
   */
  fastify.post<{ Body: DisableMFABody }>(
    '/api/auth/mfa/disable/complete',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { loginToken, code } = request.body;

      if (!loginToken || !code) {
        return reply.code(400).send({
          ok: false,
          error: 'Token y código son requeridos',
        });
      }

      const { ip, userAgent } = getClientInfo(request);

      const result = await disableMFA(
        request.agent!._id.toString(),
        code,
        loginToken,
        { ip, userAgent }
      );

      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }

      return {
        ok: true,
        message: 'MFA desactivado exitosamente',
      };
    }
  );

  // ============= TRUSTED DEVICES =============

  /**
   * Get trusted devices
   * GET /api/auth/mfa/devices
   */
  fastify.get(
    '/api/auth/mfa/devices',
    { preHandler: authMiddleware },
    async (request) => {
      const devices = await getAgentTrustedDevices(request.agent!._id.toString());
      
      // Don't expose full fingerprint
      const safeDevices = devices.map(d => ({
        id: d._id.toString(),
        name: d.name,
        browser: d.browser,
        os: d.os,
        lastUsedAt: d.lastUsedAt,
        createdAt: d.createdAt,
        expiresAt: d.expiresAt,
      }));

      return { ok: true, devices: safeDevices };
    }
  );

  /**
   * Revoke a trusted device
   * DELETE /api/auth/mfa/devices/:deviceId
   */
  fastify.delete<{ Params: RevokeDeviceParams }>(
    '/api/auth/mfa/devices/:deviceId',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { deviceId } = request.params;
      const { ip, userAgent } = getClientInfo(request);

      const result = await revokeAgentDevice(
        deviceId,
        request.agent!._id.toString(),
        {
          agentName: request.agent!.name,
          ip,
          userAgent,
        }
      );

      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }

      return { ok: true, message: 'Dispositivo revocado' };
    }
  );

  /**
   * Revoke all trusted devices
   * DELETE /api/auth/mfa/devices
   */
  fastify.delete(
    '/api/auth/mfa/devices',
    { preHandler: authMiddleware },
    async (request) => {
      const { ip, userAgent } = getClientInfo(request);
      const result = await revokeAllAgentDevices(
        request.agent!._id.toString(),
        {
          agentName: request.agent!.name,
          ip,
          userAgent,
        }
      );

      return {
        ok: true,
        message: `${result.count} dispositivos revocados`,
        count: result.count,
      };
    }
  );

  // ============= ADMIN ROUTES =============

  /**
   * Get global MFA settings
   * GET /api/admin/mfa/settings
   */
  fastify.get(
    '/api/admin/mfa/settings',
    { preHandler: requirePermission('settings.read') },
    async () => {
      const settings = await getGlobalMFASettings();
      return { ok: true, settings };
    }
  );

  /**
   * Update global MFA settings
   * PUT /api/admin/mfa/settings
   */
  fastify.put<{ Body: GlobalMFASettingsBody }>(
    '/api/admin/mfa/settings',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { ip, userAgent } = getClientInfo(request);
      const result = await updateGlobalMFASettings(
        request.body,
        request.agent!._id.toString(),
        {
          adminName: request.agent!.name,
          ip,
          userAgent,
        }
      );

      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }

      return { ok: true, message: 'Configuración actualizada' };
    }
  );

  /**
   * Get agent MFA status (admin)
   * GET /api/admin/agents/:agentId/mfa
   */
  fastify.get<{ Params: AdminMFAParams }>(
    '/api/admin/agents/:agentId/mfa',
    { preHandler: requirePermission('agents.read') },
    async (request, reply) => {
      try {
        const status = await getMFAStatus(request.params.agentId);
        const devices = await getAgentTrustedDevices(request.params.agentId);
        
        return {
          ok: true,
          mfa: status,
          trustedDevices: devices.map(d => ({
            id: d._id.toString(),
            name: d.name,
            browser: d.browser,
            os: d.os,
            lastUsedAt: d.lastUsedAt,
            createdAt: d.createdAt,
          })),
        };
      } catch (error) {
        return reply.code(404).send({
          ok: false,
          error: 'Agente no encontrado',
        });
      }
    }
  );

  /**
   * Admin: Force enable MFA for agent
   * POST /api/admin/agents/:agentId/mfa/enable
   */
  fastify.post<{ Params: AdminMFAParams }>(
    '/api/admin/agents/:agentId/mfa/enable',
    { preHandler: requirePermission('agents.write') },
    async (request, reply) => {
      const { ip, userAgent } = getClientInfo(request);
      const result = await adminEnableMFA(
        request.params.agentId,
        request.agent!._id.toString(),
        {
          adminName: request.agent!.name,
          ip,
          userAgent,
        }
      );

      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }

      return { ok: true, message: 'MFA forzado para el agente' };
    }
  );

  /**
   * Admin: Disable MFA for agent
   * POST /api/admin/agents/:agentId/mfa/disable
   */
  fastify.post<{ Params: AdminMFAParams; Body: AdminDisableBody }>(
    '/api/admin/agents/:agentId/mfa/disable',
    { preHandler: requirePermission('agents.write') },
    async (request, reply) => {
      const { ip, userAgent } = getClientInfo(request);
      const result = await adminDisableMFA(
        request.params.agentId,
        request.agent!._id.toString(),
        {
          adminName: request.agent!.name,
          ip,
          userAgent,
          reason: request.body.reason,
        }
      );

      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }

      return { ok: true, message: 'MFA desactivado para el agente' };
    }
  );

  /**
   * Admin: Grant MFA bypass
   * POST /api/admin/agents/:agentId/mfa/bypass
   */
  fastify.post<{ Params: AdminMFAParams; Body: AdminBypassBody }>(
    '/api/admin/agents/:agentId/mfa/bypass',
    { preHandler: requirePermission('agents.write') },
    async (request, reply) => {
      const { durationMinutes = 30, reason } = request.body;

      if (durationMinutes < 5 || durationMinutes > 1440) {
        return reply.code(400).send({
          ok: false,
          error: 'La duración debe ser entre 5 y 1440 minutos',
        });
      }

      const { ip, userAgent } = getClientInfo(request);
      const result = await adminBypassMFA(
        request.params.agentId,
        request.agent!._id.toString(),
        durationMinutes,
        {
          adminName: request.agent!.name,
          ip,
          userAgent,
          reason,
        }
      );

      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }

      return {
        ok: true,
        message: `Bypass concedido por ${durationMinutes} minutos`,
        bypassUntil: result.bypassUntil,
      };
    }
  );

  /**
   * Admin: Revoke MFA bypass
   * DELETE /api/admin/agents/:agentId/mfa/bypass
   */
  fastify.delete<{ Params: AdminMFAParams }>(
    '/api/admin/agents/:agentId/mfa/bypass',
    { preHandler: requirePermission('agents.write') },
    async (request, reply) => {
      const { ip, userAgent } = getClientInfo(request);
      const result = await adminRevokeBypass(
        request.params.agentId,
        request.agent!._id.toString(),
        {
          adminName: request.agent!.name,
          ip,
          userAgent,
        }
      );

      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }

      return { ok: true, message: 'Bypass revocado' };
    }
  );

  /**
   * Admin: Revoke all trusted devices for agent
   * DELETE /api/admin/agents/:agentId/mfa/devices
   */
  fastify.delete<{ Params: AdminMFAParams }>(
    '/api/admin/agents/:agentId/mfa/devices',
    { preHandler: requirePermission('agents.write') },
    async (request) => {
      const { revokeAllDevices } = await import('../database/index.js');
      const count = await revokeAllDevices(
        request.params.agentId,
        request.agent!._id.toString(),
        'admin_revoked'
      );

      return {
        ok: true,
        message: `${count} dispositivos revocados`,
        count,
      };
    }
  );
}

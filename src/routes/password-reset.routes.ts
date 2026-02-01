/**
 * Password Reset Routes
 * Public and protected routes for password reset flow
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  requestPasswordReset,
  requestPasswordResetByEmail,
  validateResetToken,
  completePasswordReset,
  completeForcedPasswordChange,
  forcePasswordChange,
  adminRevokeResetTokens,
  checkPasswordChangeRequired,
} from '../services/password-reset.service.js';
import { logger } from '../services/logger.js';

// ============= REQUEST TYPES =============

interface RequestResetByEmailBody {
  email: string;
}

interface ValidateTokenParams {
  token: string;
}

interface CompleteResetBody {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

interface ForcedChangeBody {
  newPassword: string;
  confirmPassword: string;
}

interface AdminResetParams {
  agentId: string;
}

interface AdminRevokeBody {
  reason?: string;
}

interface AdminForceChangeParams {
  agentId: string;
}

// ============= HELPER: Get client info =============

function getClientInfo(request: FastifyRequest) {
  const ip = request.ip || 
    (request.headers['x-forwarded-for'] as string)?.split(',')[0] || 
    (request.headers['x-real-ip'] as string) ||
    'unknown';
  const userAgent = request.headers['user-agent'];
  
  return { ip, userAgent };
}

// ============= ROUTES =============

export async function registerPasswordResetRoutes(fastify: FastifyInstance): Promise<void> {

  // ============= PUBLIC ROUTES =============

  /**
   * Request password reset by email (self-service)
   * POST /api/auth/password-reset/request
   */
  fastify.post<{ Body: RequestResetByEmailBody }>(
    '/api/auth/password-reset/request',
    async (request, reply) => {
      const { email } = request.body;

      if (!email) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'El correo electrónico es requerido' 
        });
      }

      const { ip, userAgent } = getClientInfo(request);

      const result = await requestPasswordResetByEmail(email, {
        ip,
        userAgent,
        requestSource: 'dashboard',
      });

      // Always return success to prevent email enumeration
      return {
        ok: true,
        message: result.message || 'Si el correo existe, recibirás un enlace de recuperación en tu Telegram',
      };
    }
  );

  /**
   * Validate reset token (for UI preview)
   * GET /api/auth/password-reset/validate?token=xxx
   */
  fastify.get<{ Querystring: { token: string } }>(
    '/api/auth/password-reset/validate',
    async (request, reply) => {
      const { token } = request.query;

      if (!token) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Token requerido' 
        });
      }

      // Validate token format (prevent DoS with very long tokens)
      if (typeof token !== 'string' || token.length !== 64 || !/^[a-f0-9]+$/i.test(token)) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Token inválido' 
        });
      }

      const result = await validateResetToken(token);

      if (!result.valid) {
        return reply.code(400).send({ 
          ok: false, 
          error: result.error,
        });
      }

      return {
        ok: true,
        expiresAt: result.expiresAt,
        agentName: result.agentName,
        // Don't expose email or agentId in public response
      };
    }
  );

  /**
   * Complete password reset
   * POST /api/auth/password-reset/complete
   */
  fastify.post<{ Body: CompleteResetBody }>(
    '/api/auth/password-reset/complete',
    async (request, reply) => {
      const { token, newPassword, confirmPassword } = request.body;

      // Validate input
      if (!token) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Token requerido' 
        });
      }

      // Validate token format (prevent DoS with very long tokens)
      if (typeof token !== 'string' || token.length !== 64 || !/^[a-f0-9]+$/i.test(token)) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Token inválido' 
        });
      }

      if (!newPassword) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'La nueva contraseña es requerida' 
        });
      }

      if (newPassword !== confirmPassword) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Las contraseñas no coinciden' 
        });
      }

      const { ip, userAgent } = getClientInfo(request);

      const result = await completePasswordReset(token, newPassword, {
        ip,
        userAgent,
      });

      if (!result.success) {
        return reply.code(400).send({ 
          ok: false, 
          error: result.error,
        });
      }

      return {
        ok: true,
        message: result.message,
        sessionsInvalidated: result.sessionsInvalidated,
      };
    }
  );

  /**
   * Check if password change is required (for current user)
   * GET /api/auth/password-change-required
   */
  fastify.get(
    '/api/auth/password-change-required',
    { preHandler: authMiddleware },
    async (request) => {
      const required = await checkPasswordChangeRequired(
        request.agent!._id.toString()
      );
      return { ok: true, required };
    }
  );

  /**
   * Complete forced password change
   * POST /api/auth/password-reset/force-complete
   */
  fastify.post<{ Body: ForcedChangeBody }>(
    '/api/auth/password-reset/force-complete',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { newPassword, confirmPassword } = request.body;

      if (!newPassword) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'La nueva contraseña es requerida' 
        });
      }

      if (newPassword !== confirmPassword) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Las contraseñas no coinciden' 
        });
      }

      const { ip, userAgent } = getClientInfo(request);

      const result = await completeForcedPasswordChange(
        request.agent!._id.toString(),
        newPassword,
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
        message: result.message,
      };
    }
  );

  // ============= ADMIN ROUTES =============

  /**
   * Admin: Request password reset for an agent (sends link via Telegram)
   * POST /api/admin/agents/:agentId/send-password-reset
   * Requires: agents.write permission
   */
  fastify.post<{ Params: AdminResetParams }>(
    '/api/admin/agents/:agentId/send-password-reset',
    { preHandler: requirePermission('agents.write') },
    async (request, reply) => {
      const { agentId } = request.params;
      const { ip, userAgent } = getClientInfo(request);

      const result = await requestPasswordReset(agentId, {
        requestSource: 'admin',
        requestedBy: request.agent!._id.toString(),
        ip,
        userAgent,
        sendViaTelegram: true,
      });

      if (!result.success) {
        return reply.code(400).send({ 
          ok: false, 
          error: result.error,
          blockedUntil: result.blockedUntil,
        });
      }

      logger.info('api', {
        action: 'admin_password_reset_sent',
        agentId,
        adminId: request.agent!._id.toString(),
      });

      return {
        ok: true,
        message: result.message,
      };
    }
  );

  /**
   * Admin: Force password change for an agent
   * POST /api/admin/agents/:agentId/force-password-change
   * Requires: agents.write permission
   */
  fastify.post<{ Params: AdminForceChangeParams }>(
    '/api/admin/agents/:agentId/force-password-change',
    { preHandler: requirePermission('agents.write') },
    async (request, reply) => {
      const { agentId } = request.params;

      const result = await forcePasswordChange(
        agentId,
        request.agent!._id.toString()
      );

      if (!result.success) {
        return reply.code(400).send({ 
          ok: false, 
          error: result.error,
        });
      }

      logger.info('api', {
        action: 'admin_force_password_change',
        agentId,
        adminId: request.agent!._id.toString(),
      });

      return {
        ok: true,
        message: 'El agente deberá cambiar su contraseña en el próximo inicio de sesión',
      };
    }
  );

  /**
   * Admin: Revoke all pending reset tokens for an agent
   * POST /api/admin/agents/:agentId/revoke-reset-tokens
   * Requires: agents.write permission
   */
  fastify.post<{ Params: AdminResetParams; Body: AdminRevokeBody }>(
    '/api/admin/agents/:agentId/revoke-reset-tokens',
    { preHandler: requirePermission('agents.write') },
    async (request, reply) => {
      const { agentId } = request.params;
      const { reason } = request.body;

      const result = await adminRevokeResetTokens(
        agentId,
        request.agent!._id.toString(),
        reason
      );

      if (!result.success) {
        return reply.code(400).send({ 
          ok: false, 
          error: result.error,
        });
      }

      return {
        ok: true,
        message: `Se revocaron ${result.revokedCount} tokens pendientes`,
        revokedCount: result.revokedCount,
      };
    }
  );
}

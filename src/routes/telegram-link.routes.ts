/**
 * Telegram Link Routes
 * API endpoints for Telegram account linking using Login Widget
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { authRateLimit } from '../middleware/rate-limit.js';
import {
  generateLinkToken,
  linkTelegramAccount,
  unlinkTelegramAccount,
  adminLinkTelegram,
  getTelegramBotInfo,
  type TelegramAuthData,
} from '../services/telegram-link.service.js';
import { Agent } from '../database/index.js';
import { logger } from '../services/logger.js';

// Request types
interface LinkTelegramBody {
  linkToken: string;
  authData: TelegramAuthData;
}

interface AdminLinkBody {
  agentId: string;
  telegramId: number;
}

interface AdminUnlinkBody {
  agentId: string;
}

/**
 * Get client info from request
 */
function getClientInfo(request: FastifyRequest): { ip: string; userAgent?: string } {
  const forwarded = request.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0].trim())
    : request.ip || 'unknown';
  const userAgent = request.headers['user-agent'];
  return { ip, userAgent };
}

export async function registerTelegramLinkRoutes(fastify: FastifyInstance): Promise<void> {
  
  // ============= PUBLIC CONFIG (for widget) =============
  
  /**
   * Get Telegram bot info for widget
   * GET /api/telegram/bot-info
   */
  fastify.get('/api/telegram/bot-info', async (_request, reply) => {
    const botInfo = getTelegramBotInfo();
    return { ok: true, ...botInfo };
  });
  
  // ============= AUTHENTICATED ROUTES =============
  
  /**
   * Start Telegram linking flow - get link token
   * POST /api/telegram/link/start
   */
  fastify.post(
    '/api/telegram/link/start',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agentId = request.agent!._id.toString();
      
      // Check if already has Telegram
      const agent = await Agent.findById(agentId);
      if (agent?.telegramId) {
        return reply.code(400).send({
          ok: false,
          error: 'Ya tienes una cuenta de Telegram vinculada',
        });
      }
      
      // Generate session-bound link token
      const sessionId = request.cookies?.sessionId || 'unknown';
      const result = await generateLinkToken(agentId, sessionId);
      
      if (!result.success) {
        return reply.code(500).send({
          ok: false,
          error: result.error,
        });
      }
      
      // Also return bot info for convenience
      const botInfo = getTelegramBotInfo();
      
      return {
        ok: true,
        linkToken: result.token,
        expiresIn: result.expiresIn,
        botId: botInfo.botId,
        botUsername: botInfo.botUsername,
      };
    }
  );
  
  /**
   * Complete Telegram linking - validate widget callback
   * POST /api/telegram/link/complete
   */
  fastify.post<{ Body: LinkTelegramBody }>(
    '/api/telegram/link/complete',
    { preHandler: [authRateLimit, authMiddleware] },
    async (request, reply) => {
      const { linkToken, authData } = request.body;
      
      if (!linkToken || !authData) {
        return reply.code(400).send({
          ok: false,
          error: 'Token y datos de autenticación requeridos',
        });
      }
      
      // Validate required Telegram fields
      if (!authData.id || !authData.hash || !authData.auth_date) {
        return reply.code(400).send({
          ok: false,
          error: 'Datos de Telegram incompletos',
        });
      }
      
      const { ip, userAgent } = getClientInfo(request);
      const sessionId = request.cookies?.sessionId;
      
      const result = await linkTelegramAccount(linkToken, authData, {
        ip,
        userAgent,
        sessionId,
      });
      
      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }
      
      return {
        ok: true,
        message: 'Cuenta de Telegram vinculada exitosamente',
        telegramId: result.telegramId,
        telegramUsername: result.telegramUsername,
      };
    }
  );
  
  /**
   * Unlink own Telegram account
   * DELETE /api/telegram/link
   */
  fastify.delete(
    '/api/telegram/link',
    { preHandler: authMiddleware },
    async (request, reply) => {
      const agentId = request.agent!._id.toString();
      const { ip, userAgent } = getClientInfo(request);
      
      const result = await unlinkTelegramAccount(agentId, { ip, userAgent });
      
      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }
      
      return {
        ok: true,
        message: 'Cuenta de Telegram desvinculada',
      };
    }
  );
  
  /**
   * Check Telegram link status
   * GET /api/telegram/link/status
   */
  fastify.get(
    '/api/telegram/link/status',
    { preHandler: authMiddleware },
    async (request, _reply) => {
      const agent = request.agent!;
      
      return {
        ok: true,
        linked: !!agent.telegramId,
        telegramId: agent.telegramId,
        telegramUsername: (agent as any).telegramUsername,
        telegramVerified: (agent as any).telegramVerified,
        telegramLinkedAt: (agent as any).telegramLinkedAt,
      };
    }
  );
  
  // ============= ADMIN ROUTES =============
  
  /**
   * Admin: Link Telegram to agent by ID
   * POST /api/admin/agents/:id/telegram
   */
  fastify.post<{ Params: { id: string }; Body: { telegramId: number } }>(
    '/api/admin/agents/:id/telegram',
    { preHandler: adminMiddleware },
    async (request, reply) => {
      const { id: agentId } = request.params;
      const { telegramId } = request.body;
      
      if (!telegramId || typeof telegramId !== 'number') {
        return reply.code(400).send({
          ok: false,
          error: 'Telegram ID requerido y debe ser un número',
        });
      }
      
      const { ip, userAgent } = getClientInfo(request);
      
      const result = await adminLinkTelegram(agentId, telegramId, {
        ip,
        userAgent,
        adminId: request.agent!._id.toString(),
        adminName: request.agent!.name,
      });
      
      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }
      
      return {
        ok: true,
        message: 'Telegram vinculado exitosamente',
      };
    }
  );
  
  /**
   * Admin: Unlink Telegram from agent
   * DELETE /api/admin/agents/:id/telegram
   */
  fastify.delete<{ Params: { id: string } }>(
    '/api/admin/agents/:id/telegram',
    { preHandler: adminMiddleware },
    async (request, reply) => {
      const { id: agentId } = request.params;
      const { ip, userAgent } = getClientInfo(request);
      
      const result = await unlinkTelegramAccount(agentId, {
        ip,
        userAgent,
        byAdmin: true,
        adminId: request.agent!._id.toString(),
      });
      
      if (!result.success) {
        return reply.code(400).send({
          ok: false,
          error: result.error,
        });
      }
      
      return {
        ok: true,
        message: 'Telegram desvinculado exitosamente',
      };
    }
  );
}

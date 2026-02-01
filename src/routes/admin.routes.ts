/**
 * Admin Routes
 * Protected routes for admin operations (agents CRUD, settings)
 * Now uses RBAC permissions instead of role-based admin check
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { Agent } from '../database/index.js';
import {
  createAgent,
  getAllAgents,
  findAgentById,
  updateAgentProfile,
  updateAgentPassword,
  deleteAgent,
  generatePassword,
  sendNewPasswordTelegramMessage,
} from '../services/agent.service.js';
import {
  getCachedSettings,
  updateSettings as updateAllCachedSettings,
  resetSettings as resetCachedSettings,
  formatSettingsForClient,
} from '../services/settings-cache.service.js';
import {
  getAllSavedReplies,
  getSavedReplyById,
  createSavedReply,
  updateSavedReply,
  deleteSavedReply,
  getCategories,
  getUsageStats,
  PLACEHOLDERS,
} from '../services/savedReply.service.js';
import { logger } from '../services/logger.js';

// ============= REQUEST TYPES =============

interface AgentParams {
  agentId: string;
}

interface CreateAgentBody {
  name: string;
  email: string;
  password: string;
  role?: 'admin' | 'support';
}

interface UpdateAgentBody {
  name?: string;
  role?: 'admin' | 'support';
  isActive?: boolean;
}

interface ResetPasswordBody {
  newPassword: string;
}

interface UpdateSettingsBody {
  bot?: Record<string, unknown>;
  chat?: Record<string, unknown>;
  agents?: Record<string, unknown>;
  security?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
}

interface SavedReplyParams {
  replyId: string;
}

interface CreateSavedReplyBody {
  title: string;
  content: string;
  category?: string;
  shortcut?: string;
  isActive?: boolean;
}

interface UpdateSavedReplyBody {
  title?: string;
  content?: string;
  category?: string;
  shortcut?: string;
  isActive?: boolean;
}

// ============= ROUTES =============

export async function registerAdminRoutes(fastify: FastifyInstance): Promise<void> {

  // All admin routes require authentication (but NOT admin role - we use RBAC permissions)
  fastify.addHook('preHandler', authMiddleware);

  // ============= AGENT MANAGEMENT =============
  // Permission: agents.read, agents.write, agents.delete

  /**
   * Get all agents with extended info
   * Requires: agents.read
   */
  fastify.get(
    '/api/admin/agents',
    { preHandler: requirePermission('agents.read') },
    async () => {
      const agents = await Agent.find()
        .select('-password')
        .sort({ name: 1 });

      return { ok: true, agents };
    }
  );

  /**
   * Create new agent
   * Requires: agents.write
   */
  fastify.post<{ Body: CreateAgentBody }>(
    '/api/admin/agents',
    { preHandler: requirePermission('agents.write') },
    async (request, reply) => {
      const { name, email, password, role } = request.body;

      // Validation
      if (!name || !email || !password) {
        return reply.code(400).send({
          ok: false,
          error: 'Name, email and password are required'
        });
      }

      if (password.length < 8) {
        return reply.code(400).send({
          ok: false,
          error: 'Password must be at least 8 characters'
        });
      }

      // Check if email already exists
      const existing = await Agent.findOne({ email: email.toLowerCase() });
      if (existing) {
        return reply.code(409).send({
          ok: false,
          error: 'An agent with this email already exists'
        });
      }

      const agent = await createAgent({ name, email, password, role });

      logger.info('api', {
        action: 'agent_created',
        agentId: agent._id.toString(),
        createdBy: request.agent!._id.toString(),
      });

      // Return without password
      const agentData = agent.toObject();
      const { password: _, ...safeAgent } = agentData;

      return { ok: true, agent: safeAgent };
    }
  );

  /**
   * Get single agent
   * Requires: agents.read
   */
  fastify.get<{ Params: AgentParams }>(
    '/api/admin/agents/:agentId',
    { preHandler: requirePermission('agents.read') },
    async (request, reply) => {
      const { agentId } = request.params;

      const agent = await findAgentById(agentId);

      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Agent not found' });
      }

      return { ok: true, agent };
    }
  );

  /**
   * Update agent
   * Requires: agents.write
   */
  fastify.patch<{ Params: AgentParams; Body: UpdateAgentBody }>(
    '/api/admin/agents/:agentId',
    { preHandler: requirePermission('agents.write') },
    async (request, reply) => {
      const { agentId } = request.params;
      const { name, role, isActive } = request.body;

      const agent = await Agent.findById(agentId);

      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Agent not found' });
      }

      // Can't deactivate yourself
      if (isActive === false && agentId === request.agent!._id.toString()) {
        return reply.code(400).send({
          ok: false,
          error: 'Cannot deactivate your own account'
        });
      }

      // Can't change your own role
      if (role && agentId === request.agent!._id.toString()) {
        return reply.code(400).send({
          ok: false,
          error: 'Cannot change your own role'
        });
      }

      // Update fields
      if (name) agent.name = name;
      if (role) agent.role = role;
      if (typeof isActive === 'boolean') agent.isActive = isActive;

      await agent.save();

      logger.info('api', {
        action: 'agent_updated',
        agentId,
        updatedBy: request.agent!._id.toString(),
        changes: { name, role, isActive },
      });

      return { ok: true, agent };
    }
  );

  /**
   * Reset agent password (generates random password and sends via Telegram)
   * For sending reset link via Telegram, use /api/admin/agents/:agentId/send-password-reset
   * Requires: agents.write
   */
  fastify.post<{ Params: AgentParams; Body: ResetPasswordBody }>(
    '/api/admin/agents/:agentId/reset-password',
    { preHandler: requirePermission('agents.write') },
    async (request, reply) => {
      const { agentId } = request.params;

      const agent = await findAgentById(agentId);

      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Agent not found' });
      }

      if (!agent.telegramId) {
        return reply.code(400).send({
          ok: false,
          error: 'Agent does not have a Telegram ID set. Cannot send new password.'
        });
      }
      const newPassword = generatePassword();

      await updateAgentPassword(agentId, newPassword);

      // Marcar que debe cambiar la contraseña al iniciar sesión
      const { Agent } = await import('../database/index.js');
      await Agent.updateOne({ _id: agentId }, {
        forcePasswordChange: true,
        lastPasswordChangeAt: new Date()
      });

      // Revocar todos los tokens de reset pendientes
      const { revokeAllTokensForAgent } = await import('../database/index.js');
      await revokeAllTokensForAgent(agentId, request.agent!._id.toString(), 'password_regenerated');

      // Enviar contraseña por Telegram
      agent.telegramId && sendNewPasswordTelegramMessage(agent.telegramId, newPassword, agent.name);

      logger.info('api', {
        action: 'agent_password_reset',
        agentId,
        resetBy: request.agent!._id.toString(),
      });

      return { ok: true, message: 'Password reset successfully' };
    }
  );

  /**
   * Delete agent (soft delete - sets isActive to false)
   * Requires: agents.delete
   */
  fastify.delete<{ Params: AgentParams }>(
    '/api/admin/agents/:agentId',
    { preHandler: requirePermission('agents.delete') },
    async (request, reply) => {
      const { agentId } = request.params;

      // Can't delete yourself
      if (agentId === request.agent!._id.toString()) {
        return reply.code(400).send({
          ok: false,
          error: 'Cannot delete your own account'
        });
      }

      const agent = await Agent.findById(agentId);

      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Agent not found' });
      }

      // Soft delete - keep data but mark as inactive
      agent.isActive = false;
      agent.onlineStatus = 'offline';
      await agent.save();

      logger.info('api', {
        action: 'agent_deleted',
        agentId,
        deletedBy: request.agent!._id.toString(),
      });

      return { ok: true, message: 'Agent deactivated successfully' };
    }
  );

  /**
   * Permanently delete agent (hard delete)
   * Requires: agents.delete
   */
  fastify.delete<{ Params: AgentParams }>(
    '/api/admin/agents/:agentId/permanent',
    { preHandler: requirePermission('agents.delete') },
    async (request, reply) => {
      const { agentId } = request.params;

      // Can't delete yourself
      if (agentId === request.agent!._id.toString()) {
        return reply.code(400).send({
          ok: false,
          error: 'Cannot delete your own account'
        });
      }

      const deleted = await deleteAgent(agentId);

      if (!deleted) {
        return reply.code(404).send({ ok: false, error: 'Agent not found' });
      }

      logger.info('api', {
        action: 'agent_hard_deleted',
        agentId,
        deletedBy: request.agent!._id.toString(),
      });

      return { ok: true, message: 'Agent permanently deleted' };
    }
  );

  // ============= SETTINGS =============
  // Permission: settings.read, settings.write

  /**
   * Get all settings
   * Requires: settings.read
   */
  fastify.get(
    '/api/admin/settings',
    { preHandler: requirePermission('settings.read') },
    async () => {
      const settings = await getCachedSettings();
      // Format for frontend compatibility
      return { ok: true, settings: formatSettingsForClient(settings) };
    }
  );

  /**
   * Update settings (partial or full)
   * Requires: settings.write
   */
  fastify.patch<{ Body: UpdateSettingsBody }>(
    '/api/admin/settings',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { bot, chat, agents, security, notifications } = request.body as {
        bot?: Record<string, unknown>;
        chat?: Record<string, unknown>;
        agents?: Record<string, unknown>;
        security?: Record<string, unknown>;
        notifications?: Record<string, unknown>;
      };
      const agentId = request.agent!._id.toString();

      const settings = await updateAllCachedSettings(
        { bot, chat, agents, security, notifications },
        agentId
      );

      logger.info('api', {
        action: 'settings_updated',
        updatedBy: agentId,
        sections: Object.keys(request.body),
      });

      return { ok: true, settings: formatSettingsForClient(settings) };
    }
  );

  /**
   * Update bot settings
   * Requires: settings.write
   */
  fastify.patch<{ Body: Record<string, unknown> }>(
    '/api/admin/settings/bot',
    { preHandler: requirePermission('settings.write') },
    async (request) => {
      const settings = await updateAllCachedSettings({ bot: request.body }, request.agent!._id.toString());
      return { ok: true, settings: formatSettingsForClient(settings) };
    }
  );

  /**
   * Update chat settings
   * Requires: settings.write
   */
  fastify.patch<{ Body: Record<string, unknown> }>(
    '/api/admin/settings/chat',
    { preHandler: requirePermission('settings.write') },
    async (request) => {
      const settings = await updateAllCachedSettings({ chat: request.body }, request.agent!._id.toString());
      return { ok: true, settings: formatSettingsForClient(settings) };
    }
  );

  /**
   * Update agent rules
   * Requires: settings.write
   */
  fastify.patch<{ Body: Record<string, unknown> }>(
    '/api/admin/settings/agent-rules',
    { preHandler: requirePermission('settings.write') },
    async (request) => {
      const settings = await updateAllCachedSettings({ agents: request.body }, request.agent!._id.toString());
      return { ok: true, settings: formatSettingsForClient(settings) };
    }
  );

  /**
   * Update security settings
   * Requires: settings.write
   */
  fastify.patch<{ Body: Record<string, unknown> }>(
    '/api/admin/settings/security',
    { preHandler: requirePermission('settings.write') },
    async (request) => {
      const settings = await updateAllCachedSettings({ security: request.body }, request.agent!._id.toString());
      return { ok: true, settings: formatSettingsForClient(settings) };
    }
  );

  /**
   * Reset settings to defaults
   * Requires: settings.write
   */
  fastify.post(
    '/api/admin/settings/reset',
    { preHandler: requirePermission('settings.write') },
    async (request) => {
      const settings = await resetCachedSettings(request.agent!._id.toString());

      logger.info('api', {
        action: 'settings_reset',
        resetBy: request.agent!._id.toString(),
      });

      return { ok: true, settings: formatSettingsForClient(settings), message: 'Settings reset to defaults' };
    }
  );

  /**
   * Force logout all agents (invalidates all sessions)
   * Requires: system.admin (critical operation)
   */
  fastify.post(
    '/api/admin/force-logout',
    { preHandler: requirePermission('system.admin') },
    async (request) => {
      // Set all agents to offline
      await Agent.updateMany({}, { onlineStatus: 'offline' });

      logger.info('api', {
        action: 'force_logout_all',
        triggeredBy: request.agent!._id.toString(),
      });

      // Note: This doesn't invalidate JWT tokens, just sets status to offline
      // For full logout, you'd need a token blacklist or short-lived tokens

      return { ok: true, message: 'All agents set to offline' };
    }
  );

  // ============= SAVED REPLIES =============
  // Permission: replies.read, replies.write

  /**
   * Get all saved replies
   * Requires: replies.read
   */
  fastify.get(
    '/api/admin/saved-replies',
    { preHandler: requirePermission('replies.read') },
    async () => {
      const replies = await getAllSavedReplies(true); // Include inactive
      const categories = await getCategories();
      const stats = await getUsageStats();

      return {
        ok: true,
        replies,
        categories,
        stats,
        placeholders: PLACEHOLDERS,
      };
    }
  );

  /**
   * Get saved reply by ID
   * Requires: replies.read
   */
  fastify.get<{ Params: SavedReplyParams }>(
    '/api/admin/saved-replies/:replyId',
    { preHandler: requirePermission('replies.read') },
    async (request, reply) => {
      const { replyId } = request.params;

      const savedReply = await getSavedReplyById(replyId);

      if (!savedReply) {
        return reply.code(404).send({ ok: false, error: 'Saved reply not found' });
      }

      return { ok: true, reply: savedReply };
    }
  );

  /**
   * Create saved reply
   * Requires: replies.write
   */
  fastify.post<{ Body: CreateSavedReplyBody }>(
    '/api/admin/saved-replies',
    { preHandler: requirePermission('replies.write') },
    async (request, reply) => {
      const { title, content, category, shortcut, isActive } = request.body;

      if (!title || !content) {
        return reply.code(400).send({
          ok: false,
          error: 'Title and content are required'
        });
      }

      const savedReply = await createSavedReply(
        { title, content, category, shortcut, isActive },
        request.agent!._id.toString()
      );

      logger.info('api', {
        action: 'saved_reply_created',
        replyId: savedReply._id.toString(),
        createdBy: request.agent!._id.toString(),
      });

      return { ok: true, reply: savedReply };
    }
  );

  /**
   * Update saved reply
   * Requires: replies.write
   */
  fastify.patch<{ Params: SavedReplyParams; Body: UpdateSavedReplyBody }>(
    '/api/admin/saved-replies/:replyId',
    { preHandler: requirePermission('replies.write') },
    async (request, reply) => {
      const { replyId } = request.params;
      const updates = request.body;

      const savedReply = await updateSavedReply(
        replyId,
        updates,
        request.agent!._id.toString()
      );

      if (!savedReply) {
        return reply.code(404).send({ ok: false, error: 'Saved reply not found' });
      }

      logger.info('api', {
        action: 'saved_reply_updated',
        replyId,
        updatedBy: request.agent!._id.toString(),
      });

      return { ok: true, reply: savedReply };
    }
  );

  /**
   * Delete saved reply
   * Requires: replies.write
   */
  fastify.delete<{ Params: SavedReplyParams }>(
    '/api/admin/saved-replies/:replyId',
    { preHandler: requirePermission('replies.write') },
    async (request, reply) => {
      const { replyId } = request.params;

      const deleted = await deleteSavedReply(replyId);

      if (!deleted) {
        return reply.code(404).send({ ok: false, error: 'Saved reply not found' });
      }

      logger.info('api', {
        action: 'saved_reply_deleted',
        replyId,
        deletedBy: request.agent!._id.toString(),
      });

      return { ok: true, message: 'Saved reply deleted' };
    }
  );

  /**
   * Get placeholders info
   * Requires: replies.read
   */
  fastify.get(
    '/api/admin/saved-replies/placeholders',
    { preHandler: requirePermission('replies.read') },
    async () => {
      return { ok: true, placeholders: PLACEHOLDERS };
    }
  );
}

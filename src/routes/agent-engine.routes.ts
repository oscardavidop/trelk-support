/**
 * Agent Engine Routes - Configuration management API
 *
 * Prefix: /api/agent-engine
 *
 * Endpoints:
 *   GET    /config                   - Get global config
 *   PUT    /config                   - Update global config
 *   GET    /config/team/:teamId      - Get team override
 *   PUT    /config/team/:teamId      - Upsert team override
 *   GET    /config/agent/:agentId    - Get agent override
 *   PUT    /config/agent/:agentId    - Upsert agent override
 *   GET    /config/resolved/:agentId - Get resolved (merged) config for agent
 *   GET    /configs                  - List all configs
 *   POST   /cache/rebuild            - Rebuild all caches
 *   GET    /version                  - Engine version
 *   GET    /break/:agentId           - Break accumulation for agent
 *   POST   /break/:agentId/reset     - Reset break counter (supervisor)
 *   POST   /supervisor/:agentId/suspend    - Suspend agent
 *   POST   /supervisor/:agentId/unblock    - Remove break-quota block
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  getGlobalConfig,
  getTeamConfig,
  getAgentConfig,
  resolveConfig,
  upsertConfig,
  listConfigs,
  rebuildAllCache,
  getEngineVersion,
} from '../services/agent-config.service.js';
import {
  getBreakAccumulation,
  resetBreakCounter,
  validateSupervisorAction,
} from '../services/agent-rule-engine.js';
import { Agent } from '../database/models/Agent.js';
import { ENGINE_DEFAULTS } from '../database/models/AgentEngineConfig.js';
import {
  authMiddleware,
  requirePermission,
} from '../middleware/auth.js';

export async function agentEngineRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', authMiddleware);

  // ── Global config ───────────────────────────────────────────────────────────

  fastify.get('/config', {
    preHandler: [requirePermission('settings.read')],
    handler: async (_req: FastifyRequest, reply: FastifyReply) => {
      const cfg = await getGlobalConfig();
      return { success: true, data: cfg ?? ENGINE_DEFAULTS, defaults: ENGINE_DEFAULTS };
    },
  });

  fastify.put('/config', {
    preHandler: [requirePermission('settings.write')],
    handler: async (
      request: FastifyRequest<{ Body: Record<string, any> }>,
      reply: FastifyReply
    ) => {
      const doc = await upsertConfig('global', null, request.body);
      return { success: true, data: doc };
    },
  });

  // ── Team config ─────────────────────────────────────────────────────────────

  fastify.get('/config/team/:teamId', {
    preHandler: [requirePermission('settings.read')],
    handler: async (
      request: FastifyRequest<{ Params: { teamId: string } }>,
      reply: FastifyReply
    ) => {
      const cfg = await getTeamConfig(request.params.teamId);
      return { success: true, data: cfg };
    },
  });

  fastify.put('/config/team/:teamId', {
    preHandler: [requirePermission('settings.write')],
    handler: async (
      request: FastifyRequest<{ Params: { teamId: string }; Body: Record<string, any> }>,
      reply: FastifyReply
    ) => {
      const doc = await upsertConfig('team', request.params.teamId, request.body);
      return { success: true, data: doc };
    },
  });

  // ── Agent config ────────────────────────────────────────────────────────────

  fastify.get('/config/agent/:agentId', {
    preHandler: [requirePermission('settings.read')],
    handler: async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const cfg = await getAgentConfig(request.params.agentId);
      return { success: true, data: cfg };
    },
  });

  fastify.put('/config/agent/:agentId', {
    preHandler: [requirePermission('settings.write')],
    handler: async (
      request: FastifyRequest<{ Params: { agentId: string }; Body: Record<string, any> }>,
      reply: FastifyReply
    ) => {
      const doc = await upsertConfig('agent', request.params.agentId, request.body);
      return { success: true, data: doc };
    },
  });

  // ── Resolved config ─────────────────────────────────────────────────────────

  fastify.get('/config/resolved/:agentId', {
    preHandler: [requirePermission('settings.read')],
    handler: async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const cfg = await resolveConfig(request.params.agentId);
      return { success: true, data: cfg };
    },
  });

  // ── List all configs ────────────────────────────────────────────────────────

  fastify.get('/configs', {
    preHandler: [requirePermission('settings.read')],
    handler: async (_req: FastifyRequest, reply: FastifyReply) => {
      const configs = await listConfigs();
      return { success: true, data: configs };
    },
  });

  // ── Cache management ────────────────────────────────────────────────────────

  fastify.post('/cache/rebuild', {
    preHandler: [requirePermission('settings.write')],
    handler: async (_req: FastifyRequest, reply: FastifyReply) => {
      const result = await rebuildAllCache();
      return { success: true, ...result };
    },
  });

  // ── Engine version ──────────────────────────────────────────────────────────

  fastify.get('/version', {
    handler: async (_req: FastifyRequest, reply: FastifyReply) => {
      const version = await getEngineVersion();
      return { success: true, version, defaults: ENGINE_DEFAULTS };
    },
  });

  // ── Break tracking ──────────────────────────────────────────────────────────

  fastify.get('/break/:agentId', {
    preHandler: [requirePermission('supervisor.monitor')],
    handler: async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const data = await getBreakAccumulation(request.params.agentId);
      return { success: true, data };
    },
  });

  fastify.post('/break/:agentId/reset', {
    preHandler: [requirePermission('supervisor.actions')],
    handler: async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const agent = (request as any).agent;
      const validation = await validateSupervisorAction(
        String(agent._id),
        request.params.agentId,
        'reset_break_counter'
      );
      if (!validation.allowed) {
        reply.code(403);
        return { success: false, error: validation.reason };
      }
      await resetBreakCounter(request.params.agentId, String(agent._id));
      return { success: true };
    },
  });

  // ── Supervisor actions ──────────────────────────────────────────────────────

  fastify.post('/supervisor/:agentId/suspend', {
    preHandler: [requirePermission('supervisor.actions')],
    handler: async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      const supervisor = (request as any).agent;
      const validation = await validateSupervisorAction(
        String(supervisor._id),
        request.params.agentId,
        'suspend'
      );
      if (!validation.allowed) {
        reply.code(403);
        return { success: false, error: validation.reason };
      }
      // Set agent offline + block
      const { setAgentState } = await import('../services/presence.service.js');
      await setAgentState(request.params.agentId, 'offline', {
        triggeredBy: 'supervisor',
        supervisorId: String(supervisor._id),
        skipValidation: true,
        reason: 'Suspended by supervisor',
        ip: '0.0.0.0',
        userAgent: 'system',
      });
      return { success: true };
    },
  });

  fastify.post('/supervisor/:agentId/unblock', {
    preHandler: [requirePermission('supervisor.actions')],
    handler: async (
      request: FastifyRequest<{ Params: { agentId: string } }>,
      reply: FastifyReply
    ) => {
      await Agent.updateOne(
        { _id: request.params.agentId },
        { $unset: { breakQuotaBlockedUntil: 1 } }
      );
      return { success: true };
    },
  });
}

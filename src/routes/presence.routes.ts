/**
 * Presence Routes - Agent status management API
 *
 * Endpoints:
 *  Agent self-management:
 *    POST /api/presence/heartbeat             - Anti-fraud heartbeat
 *    POST /api/presence/state                 - Change own state
 *    GET  /api/presence/me                    - My current state + today stats
 *
 *  Supervisor / Admin:
 *    GET  /api/presence/all                   - All agents' presence (wallboard)
 *    GET  /api/presence/:agentId              - One agent's presence
 *    POST /api/presence/:agentId/state        - Force state change
 *    POST /api/presence/:agentId/max-chats    - Adjust capacity
 *    GET  /api/presence/:agentId/history      - Status history log
 *    GET  /api/presence/:agentId/stats        - Time stats for range
 *
 *  Reporting:
 *    GET  /api/presence/report/summary        - Team summary
 *    POST /api/presence/report/export         - Export Excel
 *
 *  Auxiliary states config (Admin only):
 *    GET  /api/presence/auxiliaries           - List all states
 *    POST /api/presence/auxiliaries           - Create new
 *    PATCH /api/presence/auxiliaries/:code    - Update
 *    DELETE /api/presence/auxiliaries/:code   - Deactivate
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  setAgentState,
  handleHeartbeat,
  getAgentPresence,
  getAllPresences,
  setAgentMaxChats,
  invalidateAuxCache,
} from '../services/presence.service.js';
import {
  getAgentTimeStats,
  getTeamTimeStats,
  getAgentStatusHistory,
  getUnexpectedEvents,
  getDailyBreakdown,
  exportTimeReportExcel,
} from '../services/time-aggregator.service.js';
import { AuxiliaryState } from '../database/models/AuxiliaryState.js';
import { Agent } from '../database/models/Agent.js';
import {
  authMiddleware,
  requireRole,
  requirePermission,
} from '../middleware/auth.js';

// ─── Guards ───────────────────────────────────────────────────────────────────

function parseRange(query: any): { from: Date; to: Date } {
  const now = new Date();
  const from = query.from ? new Date(query.from as string) : new Date(new Date().setHours(0, 0, 0, 0));
  let to: Date;
  if (query.to) {
    const raw = new Date(query.to as string);
    // If only a date string was provided (no time component), set to end of that day
    if (typeof query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
      raw.setUTCHours(23, 59, 59, 999);
    }
    // Cap to current time so we don't project into the future
    to = raw > now ? now : raw;
  } else {
    to = now;
  }
  return { from, to };
}

function getRequestMeta(request: FastifyRequest): { ip: string; userAgent: string } {
  return {
    ip: (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || request.socket.remoteAddress
      || '0.0.0.0',
    userAgent: request.headers['user-agent'] || 'unknown',
  };
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export async function presenceRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ── Heartbeat ───────────────────────────────────────────────────────────────
  fastify.post('/heartbeat', async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = (request as any).agent;
    const { ip, userAgent } = getRequestMeta(request);
    await handleHeartbeat(String(agent._id), { ip, userAgent });
    return { ok: true };
  });

  // ── Agent: get my current state + today stats ────────────────────────────────
  fastify.get('/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = (request as any).agent;
    const agentId = String(agent._id);

    const [presence, todayStats] = await Promise.all([
      getAgentPresence(agentId),
      getAgentTimeStats(agentId, new Date(new Date().setHours(0, 0, 0, 0)), new Date()),
    ]);

    const auxStates = await AuxiliaryState.find({ isActive: true })
      .sort({ sortOrder: 1 })
      .select('-__v')
      .lean();

    return {
      success: true,
      data: {
        presence,
        todayStats,
        availableStates: auxStates,
        maxChats: agent.maxChatsOverride ?? 5,
        idleRiskSince: agent.idleRiskSince ?? null,
      },
    };
  });

  // ── Agent: change own state ──────────────────────────────────────────────────
  fastify.post(
    '/state',
    async (
      request: FastifyRequest<{ Body: { stateCode: string; reason?: string } }>,
      reply: FastifyReply
    ) => {
      const agent = (request as any).agent;
      const { stateCode, reason } = request.body;
      const { ip, userAgent } = getRequestMeta(request);

      // Check if the state allows agent manual set
      const auxState = await AuxiliaryState.findOne({ code: stateCode, isActive: true }).lean() as any;
      if (!auxState) return reply.status(400).send({ success: false, error: 'Unknown state' });
      if (!auxState.allowAgentManualSet) {
        return reply.status(403).send({ success: false, error: 'This state cannot be set manually by agents' });
      }
      if (auxState.requiresReason && !reason) {
        return reply.status(400).send({ success: false, error: 'A reason is required for this state' });
      }

      const result = await setAgentState(String(agent._id), stateCode, {
        reason,
        triggeredBy: 'agent_self',
        ip,
        userAgent,
      });

      if (!result.ok) return reply.status(400).send({ success: false, error: result.error });
      return { success: true };
    }
  );

  // ── Supervisor: get all presences (wallboard) ───────────────────────────────
  fastify.get(
    '/all',
    { preHandler: requireRole(['supervisor', 'admin']) },
    async (_request: FastifyRequest, _reply: FastifyReply) => {
      const presences = await getAllPresences();
      return { success: true, data: presences };
    }
  );

  // ── Supervisor: get single agent presence ───────────────────────────────────
  fastify.get<{ Params: { agentId: string } }>(
    '/:agentId',
    { preHandler: requireRole(['supervisor', 'admin']) },
    async (request: FastifyRequest<{ Params: { agentId: string } }>, reply: FastifyReply) => {
      const { agentId } = request.params;
      const presence = await getAgentPresence(agentId);
      if (!presence) return reply.status(404).send({ success: false, error: 'Agent not found' });
      return { success: true, data: presence };
    }
  );

  // ── Supervisor: force state change on agent ─────────────────────────────────
  fastify.post<{ Params: { agentId: string }; Body: { stateCode: string; reason?: string } }>(
    '/:agentId/state',
    { preHandler: [requireRole(['supervisor', 'admin']), requirePermission('supervisor.monitor')] },
    async (
      request: FastifyRequest<{ Params: { agentId: string }; Body: { stateCode: string; reason?: string } }>,
      reply: FastifyReply
    ) => {
      const { agentId } = request.params;
      const { stateCode, reason } = request.body;
      const supervisor = (request as any).agent;
      const { ip, userAgent } = getRequestMeta(request);

      const result = await setAgentState(agentId, stateCode, {
        reason: reason || 'Forced by supervisor',
        triggeredBy: 'supervisor',
        supervisorId: String(supervisor._id),
        skipValidation: true,
        ip,
        userAgent,
      });

      if (!result.ok) return reply.status(400).send({ success: false, error: result.error });
      return { success: true };
    }
  );

  // ── Supervisor: adjust agent max chats ──────────────────────────────────────
  fastify.post<{ Params: { agentId: string }; Body: { maxChats: number } }>(
    '/:agentId/max-chats',
    { preHandler: requireRole(['supervisor', 'admin']) },
    async (
      request: FastifyRequest<{ Params: { agentId: string }; Body: { maxChats: number } }>,
      reply: FastifyReply
    ) => {
      const { agentId } = request.params;
      const { maxChats } = request.body;
      const supervisor = (request as any).agent;

      if (maxChats < 1 || maxChats > 20) {
        return reply.status(400).send({ success: false, error: 'maxChats must be between 1 and 20' });
      }

      await setAgentMaxChats(agentId, maxChats, String(supervisor._id));
      return { success: true };
    }
  );

  // ── Supervisor: agent status history ────────────────────────────────────────
  fastify.get<{ Params: { agentId: string }; Querystring: { from?: string; to?: string; limit?: string } }>(
    '/:agentId/history',
    { preHandler: requireRole(['supervisor', 'admin']) },
    async (request: FastifyRequest<{ Params: { agentId: string }; Querystring: { from?: string; to?: string; limit?: string } }>, _reply: FastifyReply) => {
      const { agentId } = request.params;
      const { from, to } = parseRange(request.query);
      const limit = Math.min(parseInt(request.query.limit || '200'), 500);

      const [history, unexpected] = await Promise.all([
        getAgentStatusHistory(agentId, from, to, limit),
        getUnexpectedEvents(agentId, from, to),
      ]);

      return { success: true, data: { history, unexpected } };
    }
  );

  // ── Supervisor: agent time stats ──────────────────────────────────────────────
  fastify.get<{ Params: { agentId: string }; Querystring: { from?: string; to?: string } }>(
    '/:agentId/stats',
    { preHandler: requireRole(['supervisor', 'admin']) },
    async (request: FastifyRequest<{ Params: { agentId: string }; Querystring: { from?: string; to?: string } }>, reply: FastifyReply) => {
      const { agentId } = request.params;
      const { from, to } = parseRange(request.query);

      const [stats, daily] = await Promise.all([
        getAgentTimeStats(agentId, from, to),
        getDailyBreakdown(agentId, from, to),
      ]);

      return { success: true, data: { stats, daily } };
    }
  );

  // ── Report: team summary ──────────────────────────────────────────────────────
  fastify.get<{ Querystring: { from?: string; to?: string; teamId?: string } }>(
    '/report/summary',
    { preHandler: requireRole(['supervisor', 'admin']) },
    async (request: FastifyRequest<{ Querystring: { from?: string; to?: string; teamId?: string } }>, _reply: FastifyReply) => {
      const { from, to } = parseRange(request.query);
      const { teamId } = request.query;
      const stats = await getTeamTimeStats(from, to, teamId);
      return { success: true, data: stats };
    }
  );

  // ── Report: export Excel ────────────────────────────────────────────────────
  fastify.post<{ Body: { agentIds?: string[]; from?: string; to?: string } }>(
    '/report/export',
    { preHandler: requireRole(['supervisor', 'admin']) },
    async (
      request: FastifyRequest<{ Body: { agentIds?: string[]; from?: string; to?: string } }>,
      reply: FastifyReply
    ) => {
      const { agentIds, from, to } = request.body;
      const { from: fromDate, to: toDate } = parseRange({ from, to });

      // If no specific agents, export all
      let ids = agentIds || [];
      if (ids.length === 0) {
        const agents = await Agent.find({ isActive: true }).select('_id').lean() as any[];
        ids = agents.map((a: any) => String(a._id));
      }

      const buffer = await exportTimeReportExcel(ids, fromDate, toDate);

      reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      reply.header(
        'Content-Disposition',
        `attachment; filename="reporte-estados-${fromDate.toISOString().split('T')[0]}_${toDate.toISOString().split('T')[0]}.xlsx"`
      );
      reply.header('Content-Length', buffer.length);
      return reply.send(buffer);
    }
  );

  // ────────────────────────────────────────────────────────────────────────────
  // Auxiliary States CRUD (Admin only)
  // ────────────────────────────────────────────────────────────────────────────

  fastify.get('/auxiliaries', async (_request: FastifyRequest, _reply: FastifyReply) => {
    const states = await AuxiliaryState.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    return { success: true, data: states };
  });

  fastify.post(
    '/auxiliaries',
    { preHandler: requireRole(['admin']) },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as any;
      if (!body.code || !body.label) {
        return reply.status(400).send({ success: false, error: 'code and label are required' });
      }
      body.code = body.code.toLowerCase().trim();
      const existing = await AuxiliaryState.findOne({ code: body.code });
      if (existing) return reply.status(409).send({ success: false, error: 'State code already exists' });

      const state = await AuxiliaryState.create(body);
      await invalidateAuxCache();
      return { success: true, data: state };
    }
  );

  fastify.patch<{ Params: { code: string }; Body: Partial<any> }>(
    '/auxiliaries/:code',
    { preHandler: requireRole(['admin']) },
    async (
      request: FastifyRequest<{ Params: { code: string }; Body: Partial<any> }>,
      reply: FastifyReply
    ) => {
      const { code } = request.params;
      const state = await AuxiliaryState.findOne({ code });
      if (!state) return reply.status(404).send({ success: false, error: 'State not found' });
      if (state.isDefault && request.body.code) {
        return reply.status(400).send({ success: false, error: 'Cannot change code of default states' });
      }

      // Prevent changing code
      const { code: _c, isDefault: _d, ...safeUpdate } = request.body;
      Object.assign(state, safeUpdate);
      await state.save();
      await invalidateAuxCache();
      return { success: true, data: state };
    }
  );

  fastify.delete<{ Params: { code: string } }>(
    '/auxiliaries/:code',
    { preHandler: requireRole(['admin']) },
    async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
      const { code } = request.params;
      const state = await AuxiliaryState.findOne({ code });
      if (!state) return reply.status(404).send({ success: false, error: 'State not found' });
      if (state.isDefault) {
        return reply.status(400).send({ success: false, error: 'Cannot delete default states' });
      }
      state.isActive = false;
      await state.save();
      await invalidateAuxCache();
      return { success: true };
    }
  );
}

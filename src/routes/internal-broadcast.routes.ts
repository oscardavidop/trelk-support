/**
 * Internal Broadcast Routes
 * API endpoints for admin announcements to agents
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Types } from 'mongoose';
import { internalBroadcastService } from '../services/internal-broadcast.service.js';
import { Team } from '../database/models/Team.js';
import { Agent } from '../database/models/Agent.js';
import { authMiddleware } from '../middleware/auth.js';

// ============= TYPES =============

interface CreateBroadcastBody {
  title: string;
  message: string;
  level?: 'info' | 'warning' | 'critical';
  target?: 'all' | 'online' | 'supervisors' | 'admins' | 'team' | 'high_load' | 'custom';
  targetTeamId?: string;
  targetAgentIds?: string[];
  requireAck?: boolean;
  isPinned?: boolean;
  expiresInHours?: number;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
  activeOnly?: boolean;
}

// ============= ROUTES =============

export default async function internalBroadcastRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  /**
   * GET /api/internal-broadcasts
   * Get all broadcasts (admin) or active broadcasts for agent
   */
  fastify.get('/', async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply) => {
    try {
      const agent = request.agent!;
      const { page = 1, limit = 20, activeOnly } = request.query;

      // Admins can see all broadcasts
      if (agent.role === 'admin') {
        const result = await internalBroadcastService.getBroadcasts({
          page: Number(page),
          limit: Number(limit),
          activeOnly: activeOnly === true || activeOnly === 'true' as any,
        });
        return { ok: true, ...result };
      }

      // Agents see their active broadcasts
      const broadcasts = await internalBroadcastService.getActiveBroadcastsForAgent(agent._id.toString());
      return { ok: true, broadcasts, total: broadcasts.length };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al obtener broadcasts' });
    }
  });

  /**
   * GET /api/internal-broadcasts/pending
   * Get pending broadcasts for current agent (for offline recovery)
   */
  fastify.get('/pending', async (request, reply) => {
    try {
      const agentId = request.agent!._id.toString();
      const broadcasts = await internalBroadcastService.getActiveBroadcastsForAgent(agentId);
      return { ok: true, broadcasts };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al obtener broadcasts pendientes' });
    }
  });

  /**
   * GET /api/internal-broadcasts/metrics
   * Get broadcast metrics (admin only)
   */
  fastify.get('/metrics', async (request: FastifyRequest<{ Querystring: { days?: number } }>, reply) => {
    try {
      if (request.agent!.role !== 'admin') {
        return reply.code(403).send({ ok: false, error: 'Solo administradores' });
      }

      const { days = 30 } = request.query;
      const metrics = await internalBroadcastService.getMetrics(Number(days));
      return { ok: true, metrics };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al obtener métricas' });
    }
  });

  /**
   * GET /api/internal-broadcasts/targets
   * Get available target options for broadcast creation
   */
  fastify.get('/targets', async (request, reply) => {
    try {
      if (request.agent!.role !== 'admin') {
        return reply.code(403).send({ ok: false, error: 'Solo administradores' });
      }

      // Get teams for team targeting
      const teams = await Team.find({ isActive: true }).select('_id name').lean();
      
      // Get agent count by role
      const agentCounts = await Agent.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
      ]);

      const countByRole = agentCounts.reduce((acc: Record<string, number>, item: { _id: string; count: number }) => {
        acc[item._id] = item.count;
        return acc;
      }, {} as Record<string, number>);

      const totalAgents = (Object.values(countByRole) as number[]).reduce((a, b) => a + b, 0);

      return {
        ok: true,
        targets: [
          { id: 'all', label: 'Todos los agentes', count: totalAgents },
          { id: 'online', label: 'Solo agentes online', count: null }, // Dynamic
          { id: 'supervisors', label: 'Supervisores', count: (countByRole['supervisor'] || 0) + (countByRole['admin'] || 0) },
          { id: 'admins', label: 'Solo administradores', count: countByRole['admin'] || 0 },
          { id: 'high_load', label: 'Agentes con carga alta', count: null }, // Dynamic
          { id: 'team', label: 'Por equipo', teams },
          { id: 'custom', label: 'Selección manual', count: null },
        ],
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al obtener opciones de destino' });
    }
  });

  /**
   * GET /api/internal-broadcasts/:id/stats
   * Get a specific broadcast with full stats and receipts
   */
  fastify.get('/:id/stats', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ ok: false, error: 'ID inválido' });
      }

      const broadcast = await internalBroadcastService.getBroadcastStats(id);
      
      if (!broadcast) {
        return reply.code(404).send({ ok: false, error: 'Broadcast no encontrado' });
      }

      return { ok: true, broadcast };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al obtener estadísticas' });
    }
  });

  /**
   * GET /api/internal-broadcasts/:id
   * Get a specific broadcast with full stats
   */
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ ok: false, error: 'ID inválido' });
      }

      const broadcast = await internalBroadcastService.getBroadcast(id);
      
      if (!broadcast) {
        return reply.code(404).send({ ok: false, error: 'Broadcast no encontrado' });
      }

      return { ok: true, broadcast };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al obtener broadcast' });
    }
  });

  /**
   * POST /api/internal-broadcasts
   * Create a new broadcast (admin only)
   */
  fastify.post('/', async (request: FastifyRequest<{ Body: CreateBroadcastBody }>, reply) => {
    try {
      const admin = request.agent!;

      if (admin.role !== 'admin') {
        return reply.code(403).send({ ok: false, error: 'Solo administradores pueden crear broadcasts' });
      }

      const {
        title,
        message,
        level = 'info',
        target = 'all',
        targetTeamId,
        targetAgentIds,
        requireAck = false,
        isPinned = false,
        expiresInHours,
      } = request.body;

      if (!title || !message) {
        return reply.code(400).send({ ok: false, error: 'Título y mensaje son requeridos' });
      }

      if (title.length > 200) {
        return reply.code(400).send({ ok: false, error: 'Título muy largo (máx 200 caracteres)' });
      }

      if (message.length > 5000) {
        return reply.code(400).send({ ok: false, error: 'Mensaje muy largo (máx 5000 caracteres)' });
      }

      // Validate team if target is team
      if (target === 'team') {
        if (!targetTeamId) {
          return reply.code(400).send({ ok: false, error: 'Debes seleccionar un equipo' });
        }
        const team = await Team.findById(targetTeamId).lean();
        if (!team) {
          return reply.code(404).send({ ok: false, error: 'Equipo no encontrado' });
        }
      }

      // Validate agents if target is custom
      if (target === 'custom' && (!targetAgentIds || targetAgentIds.length === 0)) {
        return reply.code(400).send({ ok: false, error: 'Debes seleccionar al menos un agente' });
      }

      // Calculate expiration
      let expiresAt: Date | undefined;
      if (expiresInHours && expiresInHours > 0) {
        expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresInHours);
      }

      const result = await internalBroadcastService.createBroadcast({
        title,
        message,
        level,
        target,
        targetTeamId,
        targetAgentIds,
        requireAck,
        isPinned,
        expiresAt,
        createdBy: admin._id.toString(),
      });

      return {
        ok: true,
        broadcast: result.broadcast,
        deliveredCount: result.deliveredCount,
        telegramFallbackCount: result.telegramFallbackCount,
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al crear broadcast' });
    }
  });

  /**
   * POST /api/internal-broadcasts/:id/seen
   * Mark broadcast as seen by current agent
   */
  fastify.post('/:id/seen', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      const agentId = request.agent!._id.toString();

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ ok: false, error: 'ID inválido' });
      }

      await internalBroadcastService.markSeen(id, agentId);
      return { ok: true };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al marcar como visto' });
    }
  });

  /**
   * POST /api/internal-broadcasts/:id/acknowledge
   * Acknowledge a broadcast
   */
  fastify.post('/:id/acknowledge', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      const agentId = request.agent!._id.toString();

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ ok: false, error: 'ID inválido' });
      }

      const receipt = await internalBroadcastService.acknowledge(id, agentId);
      
      if (!receipt) {
        return reply.code(404).send({ ok: false, error: 'Broadcast no encontrado o ya confirmado' });
      }

      return { ok: true, receipt };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al confirmar broadcast' });
    }
  });

  /**
   * POST /api/internal-broadcasts/:id/cancel
   * Cancel a broadcast (admin only) - Alternative to DELETE
   */
  fastify.post('/:id/cancel', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const admin = request.agent!;

      if (admin.role !== 'admin') {
        return reply.code(403).send({ ok: false, error: 'Solo administradores' });
      }

      const { id } = request.params;

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ ok: false, error: 'ID inválido' });
      }

      const broadcast = await internalBroadcastService.cancelBroadcast(id, admin._id.toString());
      
      if (!broadcast) {
        return reply.code(404).send({ ok: false, error: 'Broadcast no encontrado' });
      }

      return { ok: true };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al cancelar broadcast' });
    }
  });

  /**
   * DELETE /api/internal-broadcasts/:id
   * Cancel a broadcast (admin only)
   */
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const admin = request.agent!;

      if (admin.role !== 'admin') {
        return reply.code(403).send({ ok: false, error: 'Solo administradores' });
      }

      const { id } = request.params;

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ ok: false, error: 'ID inválido' });
      }

      const broadcast = await internalBroadcastService.cancelBroadcast(id, admin._id.toString());
      
      if (!broadcast) {
        return reply.code(404).send({ ok: false, error: 'Broadcast no encontrado' });
      }

      return { ok: true };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al cancelar broadcast' });
    }
  });
}

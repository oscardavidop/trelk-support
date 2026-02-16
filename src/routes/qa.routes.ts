/**
 * QA & Coaching Routes
 * CRUD for QA checklist config, review submission, coaching workflow, analytics.
 * All endpoints require admin or supervisor role.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { ChatSession } from '../database/index.js';
import { logger } from '../services/logger.js';
import * as qaService from '../services/qa.service.js';
import { agentSockets } from '../services/socket.js';

// ─── Request body / param types ───────────────────────────────────────

interface IdParams {
  id: string;
}

interface SessionIdParams {
  sessionId: string;
}

interface AgentIdParams {
  agentId: string;
}

interface CreateCheckBody {
  name: string;
  description?: string;
  category?: string;
  weight: number;
  order?: number;
}

interface UpdateCheckBody {
  name?: string;
  description?: string;
  category?: string;
  weight?: number;
  isActive?: boolean;
  order?: number;
}

interface ReorderBody {
  items: { id: string; order: number }[];
}

interface UpdateSettingsBody {
  lowScoreThreshold?: number;
  coachingEnabled?: boolean;
  autoFlagThreshold?: number;
  rollingWindowDays?: number;
}

interface SubmitReviewBody {
  sessionId: string;
  agentId: string;
  checks: {
    checkItemId: string;
    checkName: string;
    checkCategory: string;
    weight: number;
    result: 'yes' | 'no' | 'partial' | 'na';
    note?: string;
  }[];
  comment?: string;
  status?: 'draft' | 'completed';
}

interface UpdateReviewBody {
  checks?: SubmitReviewBody['checks'];
  comment?: string;
  status?: 'draft' | 'completed';
}

interface CoachingBody {
  coaching: 'none' | 'pending' | 'scheduled' | 'completed' | 'dismissed';
  coachingNotes?: string;
  coachingScheduledAt?: string;
}

interface AcknowledgeBody {
  agentFeedback?: string;
}

// ─── Helper: role guard ───────────────────────────────────────────────

function isSupervisorOrAdmin(request: FastifyRequest): boolean {
  const agent = (request as any).agent;
  return agent && ['admin', 'supervisor'].includes(agent.role);
}

function guardRole(request: FastifyRequest, reply: FastifyReply): boolean {
  if (!isSupervisorOrAdmin(request)) {
    reply.status(403).send({ error: 'Requiere rol admin o supervisor' });
    return false;
  }
  return true;
}

// ─── Plugin ───────────────────────────────────────────────────────────

export async function qaRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('onRequest', authMiddleware);

  // ═══════════════════════════════════════════════════════════════════
  //  CHECKLIST CONFIG (admin/supervisor)
  // ═══════════════════════════════════════════════════════════════════

  /** GET /api/qa/checklist — active checklist items (all authenticated agents) */
  fastify.get('/api/qa/checklist', async (request, reply) => {
    try {
      const items = await qaService.getActiveChecklist();
      return { items };
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to fetch QA checklist' });
      return reply.status(500).send({ error: 'Error al obtener checklist' });
    }
  });

  /** GET /api/qa/checklist/all — ALL items including inactive (admin/supervisor) */
  fastify.get('/api/qa/checklist/all', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const items = await qaService.getAllChecklistItems();
      return { items };
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to fetch all QA checklist items' });
      return reply.status(500).send({ error: 'Error al obtener checklist' });
    }
  });

  /** POST /api/qa/checklist — create item */
  fastify.post<{ Body: CreateCheckBody }>('/api/qa/checklist', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const agent = (request as any).agent;
      const item = await qaService.createChecklistItem(request.body, agent._id.toString());
      return reply.status(201).send(item);
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to create QA check item' });
      return reply.status(500).send({ error: 'Error al crear ítem' });
    }
  });

  /** PUT /api/qa/checklist/:id — update item */
  fastify.put<{ Params: IdParams; Body: UpdateCheckBody }>('/api/qa/checklist/:id', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const agent = (request as any).agent;
      const item = await qaService.updateChecklistItem(request.params.id, request.body, agent._id.toString());
      if (!item) return reply.status(404).send({ error: 'Ítem no encontrado' });
      return item;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to update QA check item' });
      return reply.status(500).send({ error: 'Error al actualizar ítem' });
    }
  });

  /** DELETE /api/qa/checklist/:id — delete item */
  fastify.delete<{ Params: IdParams }>('/api/qa/checklist/:id', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const deleted = await qaService.deleteChecklistItem(request.params.id);
      if (!deleted) return reply.status(404).send({ error: 'Ítem no encontrado' });
      return { success: true };
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to delete QA check item' });
      return reply.status(500).send({ error: 'Error al eliminar ítem' });
    }
  });

  /** PATCH /api/qa/checklist/reorder — reorder items */
  fastify.patch<{ Body: ReorderBody }>('/api/qa/checklist/reorder', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      await qaService.reorderChecklist(request.body.items);
      return { success: true };
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to reorder QA checklist' });
      return reply.status(500).send({ error: 'Error al reordenar' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  QA SETTINGS (singleton)
  // ═══════════════════════════════════════════════════════════════════

  /** GET /api/qa/settings — readable by all authenticated agents */
  fastify.get('/api/qa/settings', async (request, reply) => {
    try {
      const settings = await qaService.getQASettings();
      return settings;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to fetch QA settings' });
      return reply.status(500).send({ error: 'Error al obtener configuración' });
    }
  });

  /** PUT /api/qa/settings */
  fastify.put<{ Body: UpdateSettingsBody }>('/api/qa/settings', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const agent = (request as any).agent;
      const settings = await qaService.updateQASettings(request.body, agent._id.toString());
      return settings;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to update QA settings' });
      return reply.status(500).send({ error: 'Error al actualizar configuración' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  QA REVIEWS
  // ═══════════════════════════════════════════════════════════════════

  /** POST /api/qa/reviews — submit a new review */
  fastify.post<{ Body: SubmitReviewBody }>('/api/qa/reviews', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const agent = (request as any).agent;
      const { sessionId, agentId, checks, comment, status } = request.body;

      // Verify session exists
      const session = await ChatSession.findOne({ sessionId });
      if (!session) return reply.status(404).send({ error: 'Sesión no encontrada' });

      const review = await qaService.createReview({
        sessionId,
        sessionObjectId: session._id.toString(),
        agentId,
        reviewedBy: agent._id.toString(),
        checks,
        comment,
        status,
      });

      // Notify agent via socket
      try {
        const targetSocket = agentSockets.get(agentId);
        if (targetSocket) {
          targetSocket.emit('notification', {
            type: 'warning',
            title: 'Nueva Evaluación QA',
            message: `Se ha registrado una evaluación de calidad para una de tus sesiones. Puntaje: ${review.totalScore}`,
          });
          targetSocket.emit('qa:review:new' as any, {
            reviewId: review._id,
            totalScore: review.totalScore,
            sessionId,
          });
        }
      } catch (socketErr) {
        logger.error('error', { error: (socketErr as Error).message, context: 'QA socket notification failed' });
      }

      return reply.status(201).send(review);
    } catch (err: any) {
      if (err.code === 11000) {
        return reply.status(409).send({ error: 'Ya existe una evaluación para esta sesión' });
      }
      logger.error('error', { error: (err as Error).message, context: 'Failed to create QA review' });
      return reply.status(500).send({ error: 'Error al crear evaluación' });
    }
  });

  /** PUT /api/qa/reviews/:id — update review */
  fastify.put<{ Params: IdParams; Body: UpdateReviewBody }>('/api/qa/reviews/:id', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const review = await qaService.updateReview(request.params.id, request.body);
      if (!review) return reply.status(404).send({ error: 'Evaluación no encontrada' });
      return review;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to update QA review' });
      return reply.status(500).send({ error: 'Error al actualizar evaluación' });
    }
  });

  /** GET /api/qa/reviews/session/:sessionId — get review for a session */
  fastify.get<{ Params: SessionIdParams }>('/api/qa/reviews/session/:sessionId', async (request, reply) => {
    try {
      const review = await qaService.getReviewBySession(request.params.sessionId);
      if (!review) return reply.status(404).send({ error: 'No hay evaluación para esta sesión' });
      return review;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to fetch QA review' });
      return reply.status(500).send({ error: 'Error al obtener evaluación' });
    }
  });

  /** GET /api/qa/reviews/agent/:agentId — reviews for an agent */
  fastify.get<{ Params: AgentIdParams; Querystring: { limit?: string; skip?: string } }>(
    '/api/qa/reviews/agent/:agentId',
    async (request, reply) => {
      try {
        const { limit, skip } = request.query as any;
        const result = await qaService.getReviewsByAgent(request.params.agentId, {
          limit: limit ? parseInt(limit, 10) : 20,
          skip: skip ? parseInt(skip, 10) : 0,
        });
        return result;
      } catch (err) {
        logger.error('error', { error: (err as Error).message, context: 'Failed to fetch agent QA reviews' });
        return reply.status(500).send({ error: 'Error al obtener evaluaciones' });
      }
    }
  );

  // ═══════════════════════════════════════════════════════════════════
  //  COACHING WORKFLOW
  // ═══════════════════════════════════════════════════════════════════

  /** PATCH /api/qa/reviews/:id/coaching — update coaching status */
  fastify.patch<{ Params: IdParams; Body: CoachingBody }>('/api/qa/reviews/:id/coaching', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const agent = (request as any).agent;
      const { coaching, coachingNotes, coachingScheduledAt } = request.body;
      const review = await qaService.updateCoachingStatus(request.params.id, coaching, {
        coachingNotes,
        coachingBy: agent._id.toString(),
        coachingScheduledAt: coachingScheduledAt ? new Date(coachingScheduledAt) : undefined,
      });
      if (!review) return reply.status(404).send({ error: 'Evaluación no encontrada' });
      return review;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to update coaching status' });
      return reply.status(500).send({ error: 'Error al actualizar coaching' });
    }
  });

  /** PATCH /api/qa/reviews/:id/acknowledge — agent acknowledges review */
  fastify.patch<{ Params: IdParams; Body: AcknowledgeBody }>('/api/qa/reviews/:id/acknowledge', async (request, reply) => {
    try {
      const review = await qaService.acknowledgeReview(request.params.id, request.body.agentFeedback);
      if (!review) return reply.status(404).send({ error: 'Evaluación no encontrada' });
      return review;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to acknowledge QA review' });
      return reply.status(500).send({ error: 'Error al confirmar evaluación' });
    }
  });

  /** GET /api/qa/coaching/pending — sessions needing coaching */
  fastify.get('/api/qa/coaching/pending', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const { limit, skip } = request.query as any;
      const result = await qaService.getPendingCoachingSessions({
        limit: limit ? parseInt(limit, 10) : 20,
        skip: skip ? parseInt(skip, 10) : 0,
      });
      return result;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to fetch pending coaching' });
      return reply.status(500).send({ error: 'Error al obtener coaching pendiente' });
    }
  });

  /** GET /api/qa/coaching/unreviewed — closed sessions without QA review */
  fastify.get('/api/qa/coaching/unreviewed', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const { limit, skip, days } = request.query as any;
      const result = await qaService.getSessionsPendingReview({
        limit: limit ? parseInt(limit, 10) : 20,
        skip: skip ? parseInt(skip, 10) : 0,
        days: days ? parseInt(days, 10) : 7,
      });
      return result;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to fetch unreviewed sessions' });
      return reply.status(500).send({ error: 'Error al obtener sesiones sin evaluar' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  ANALYTICS
  // ═══════════════════════════════════════════════════════════════════

  /** GET /api/qa/analytics/agent/:agentId — stats for one agent */
  fastify.get<{ Params: AgentIdParams; Querystring: { days?: string } }>(
    '/api/qa/analytics/agent/:agentId',
    async (request, reply) => {
      if (!guardRole(request, reply)) return;
      try {
        const days = request.query.days ? parseInt(request.query.days as string, 10) : 30;
        const stats = await qaService.getAgentStats(request.params.agentId, days);
        return stats;
      } catch (err) {
        logger.error('error', { error: (err as Error).message, context: 'Failed to fetch agent QA analytics' });
        return reply.status(500).send({ error: 'Error al obtener analytics' });
      }
    }
  );

  /** GET /api/qa/analytics/team — team-wide analytics */
  fastify.get<{ Querystring: { days?: string } }>('/api/qa/analytics/team', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const days = request.query.days ? parseInt(request.query.days as string, 10) : 30;
      const analytics = await qaService.getTeamAnalytics(days);
      return analytics;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to fetch team QA analytics' });
      return reply.status(500).send({ error: 'Error al obtener analytics de equipo' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  AGENT-FACING ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════

  /** GET /api/qa/my/pending — unacknowledged reviews for current agent */
  fastify.get('/api/qa/my/pending', async (request, reply) => {
    try {
      const agent = (request as any).agent;
      const reviews = await qaService.getUnacknowledgedReviewsForAgent(agent._id.toString());
      return { reviews };
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to fetch pending QA reviews for agent' });
      return reply.status(500).send({ error: 'Error al obtener reviews pendientes' });
    }
  });

  /** GET /api/qa/my/performance — agent's own QA performance summary */
  fastify.get('/api/qa/my/performance', async (request, reply) => {
    try {
      const agent = (request as any).agent;
      const perf = await qaService.getAgentQAPerformance(agent._id.toString());
      return perf;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to fetch agent QA performance' });
      return reply.status(500).send({ error: 'Error al obtener rendimiento QA' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  //  REVIEW EDITING WITH AUDIT (admin/supervisor)
  // ═══════════════════════════════════════════════════════════════════

  /** PATCH /api/qa/reviews/:id/edit — edit review with audit trail */
  fastify.patch<{
    Params: IdParams;
    Body: {
      editReason: string;
      checks?: SubmitReviewBody['checks'];
      comment?: string;
      coachingTags?: string[];
      trainingRecommendations?: string[];
    };
  }>('/api/qa/reviews/:id/edit', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const agent = (request as any).agent;
      const { editReason, checks, comment, coachingTags, trainingRecommendations } = request.body;
      if (!editReason || !editReason.trim()) {
        return reply.status(400).send({ error: 'Se requiere razón de edición' });
      }
      const review = await qaService.editReviewWithAudit(
        request.params.id,
        agent._id.toString(),
        editReason,
        { checks, comment, coachingTags, trainingRecommendations }
      );
      if (!review) return reply.status(404).send({ error: 'Evaluación no encontrada' });

      // Check escalation rule after edit
      await qaService.checkEscalationRule(review.agentId.toString());

      // Notify agent that their review was edited (may need re-acknowledgement)
      try {
        const targetAgentId = review.agentId.toString();
        const targetSocket = agentSockets.get(targetAgentId);
        if (targetSocket) {
          targetSocket.emit('notification', {
            type: 'warning',
            title: 'Evaluación QA Editada',
            message: `Una evaluación de calidad ha sido modificada. Nuevo puntaje: ${review.totalScore}`,
          });
          targetSocket.emit('qa:review:edited' as any, {
            reviewId: review._id,
            totalScore: review.totalScore,
            requiresReack: review.requiresReack,
          });
        }
      } catch (socketErr) {
        logger.error('error', { error: (socketErr as Error).message, context: 'QA edit socket notification failed' });
      }

      return review;
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to edit QA review with audit' });
      return reply.status(500).send({ error: 'Error al editar evaluación' });
    }
  });

  /** GET /api/qa/escalations — escalated reviews (admin only) */
  fastify.get('/api/qa/escalations', async (request, reply) => {
    if (!guardRole(request, reply)) return;
    try {
      const { QAReview: QAReviewModel } = await import('../database/index.js');
      const escalated = await QAReviewModel.find({ escalated: true })
        .sort({ escalatedAt: -1 })
        .limit(50)
        .populate('agentId', 'name avatar email')
        .populate('reviewedBy', 'name avatar')
        .lean();
      return { reviews: escalated };
    } catch (err) {
      logger.error('error', { error: (err as Error).message, context: 'Failed to fetch escalated reviews' });
      return reply.status(500).send({ error: 'Error al obtener escalaciones' });
    }
  });
}

/**
 * Playbook Routes — API endpoints for playbook management & execution
 */

import type { FastifyInstance } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import * as playbookService from '../services/playbook.service.js';

interface IdParams { id: string }
interface SessionParams { sessionId: string }
interface StepParams { sessionId: string; stepId: string }

export async function playbookRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require auth
  fastify.addHook('onRequest', authMiddleware);

  // ─── PLAYBOOK CRUD (Admin/Supervisor) ───

  // List all playbooks
  fastify.get('/playbooks', async (request) => {
    const { isActive, category } = request.query as any;
    const filter: { isActive?: boolean; category?: string } = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (category) filter.category = category;
    const playbooks = await playbookService.getAllPlaybooks(filter);
    return { ok: true, playbooks };
  });

  // Get single playbook
  fastify.get<{ Params: IdParams }>('/playbooks/:id', async (request, reply) => {
    const playbook = await playbookService.getPlaybookById(request.params.id);
    if (!playbook) return reply.code(404).send({ ok: false, error: 'Playbook not found' });
    return { ok: true, playbook };
  });

  // Create playbook (admin/supervisor)
  fastify.post('/playbooks', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }
    try {
      const playbook = await playbookService.createPlaybook(request.body as any, agent._id.toString());
      return reply.code(201).send({ ok: true, playbook });
    } catch (err: any) {
      return reply.code(400).send({ ok: false, error: err.message });
    }
  });

  // Update playbook
  fastify.put<{ Params: IdParams }>('/playbooks/:id', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }
    const playbook = await playbookService.updatePlaybook(
      request.params.id,
      request.body as any,
      agent._id.toString()
    );
    if (!playbook) return reply.code(404).send({ ok: false, error: 'Playbook not found' });
    return { ok: true, playbook };
  });

  // Delete playbook
  fastify.delete<{ Params: IdParams }>('/playbooks/:id', async (request, reply) => {
    const agent = (request as any).agent;
    if (agent.role !== 'admin') {
      return reply.code(403).send({ ok: false, error: 'Only admins can delete playbooks' });
    }
    const result = await playbookService.deletePlaybook(request.params.id);
    if (!result) return reply.code(404).send({ ok: false, error: 'Playbook not found' });
    return { ok: true };
  });

  // Toggle active/inactive
  fastify.patch<{ Params: IdParams }>('/playbooks/:id/toggle', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }
    const { isActive } = request.body as any;
    const playbook = await playbookService.togglePlaybook(request.params.id, isActive);
    if (!playbook) return reply.code(404).send({ ok: false, error: 'Playbook not found' });
    return { ok: true, playbook };
  });

  // Seed defaults
  fastify.post('/playbooks/seed', async (request, reply) => {
    const agent = (request as any).agent;
    if (agent.role !== 'admin') {
      return reply.code(403).send({ ok: false, error: 'Only admins can seed playbooks' });
    }
    await playbookService.seedDefaultPlaybooks(agent._id.toString());
    return { ok: true, message: 'Default playbooks seeded' };
  });

  // ─── MATCHING ───

  // Find playbooks matching context
  fastify.post('/playbooks/match', async (request) => {
    const body = request.body as any;
    const playbooks = await playbookService.findMatchingPlaybooks(body);
    // If no matches found via triggers, also include manual-trigger playbooks
    const manualPlaybooks = await playbookService.getManualPlaybooks();
    // Merge, avoiding duplicates
    const ids = new Set(playbooks.map((p: any) => p._id.toString()));
    const merged = [...playbooks, ...manualPlaybooks.filter((p: any) => !ids.has(p._id.toString()))];
    return { ok: true, playbooks: merged };
  });

  // Get all available (active) playbooks for manual selection
  fastify.get('/playbooks/available', async () => {
    const playbooks = await playbookService.getAvailablePlaybooks();
    return { ok: true, playbooks };
  });

  // ─── PROGRESS TRACKING ───

  // Start a playbook for a session
  fastify.post<{ Params: SessionParams }>('/playbooks/progress/:sessionId/start', async (request, reply) => {
    const agent = (request as any).agent;
    const { playbookId } = request.body as any;
    try {
      const raw = await playbookService.startPlaybook(request.params.sessionId, playbookId, agent._id.toString());
      // Re-fetch with populate so the client gets full playbook data
      const progress = await playbookService.getActiveProgress(request.params.sessionId);
      return { ok: true, progress: progress || raw };
    } catch (err: any) {
      return reply.code(400).send({ ok: false, error: err.message });
    }
  });

  // Get active progress for a session
  fastify.get<{ Params: SessionParams }>('/playbooks/progress/:sessionId', async (request) => {
    const progress = await playbookService.getActiveProgress(request.params.sessionId);
    return { ok: true, progress };
  });

  // Get all progress history for a session
  fastify.get<{ Params: SessionParams }>('/playbooks/progress/:sessionId/history', async (request) => {
    const history = await playbookService.getProgressBySession(request.params.sessionId);
    return { ok: true, history };
  });

  // Complete a step
  fastify.post<{ Params: StepParams }>('/playbooks/progress/:sessionId/step/:stepId/complete', async (request, reply) => {
    const agent = (request as any).agent;
    const { actionResult } = (request.body || {}) as any;
    try {
      await playbookService.completeStep(
        request.params.sessionId,
        request.params.stepId,
        agent._id.toString(),
        actionResult
      );
      // Re-fetch with populate so client gets full playbook data in steps
      const progress = await playbookService.getActiveProgress(request.params.sessionId);
      return { ok: true, progress };
    } catch (err: any) {
      return reply.code(400).send({ ok: false, error: err.message });
    }
  });

  // Skip a step
  fastify.post<{ Params: StepParams }>('/playbooks/progress/:sessionId/step/:stepId/skip', async (request, reply) => {
    const agent = (request as any).agent;
    const { reason } = request.body as any;
    if (!reason) return reply.code(400).send({ ok: false, error: 'Skip reason is required' });
    try {
      await playbookService.skipStep(
        request.params.sessionId,
        request.params.stepId,
        agent._id.toString(),
        reason
      );
      // Re-fetch with populate
      const progress = await playbookService.getActiveProgress(request.params.sessionId);
      return { ok: true, progress };
    } catch (err: any) {
      return reply.code(400).send({ ok: false, error: err.message });
    }
  });

  // Abandon playbook
  fastify.post<{ Params: SessionParams }>('/playbooks/progress/:sessionId/abandon', async (request) => {
    const progress = await playbookService.abandonPlaybook(request.params.sessionId);
    return { ok: true, progress };
  });

  // ─── VALIDATION ───

  // Validate if chat can be closed
  fastify.get<{ Params: SessionParams }>('/playbooks/validate-close/:sessionId', async (request) => {
    const result = await playbookService.validateBeforeClose(request.params.sessionId);
    return { ok: true, ...result };
  });

  // ─── QA DATA ───

  // Get playbook QA data for a session
  fastify.get<{ Params: SessionParams }>('/playbooks/qa/:sessionId', async (request) => {
    const data = await playbookService.getPlaybookQAData(request.params.sessionId);
    return { ok: true, data };
  });

  // ─── TEMPLATE PREVIEW ───

  // Preview template with variable replacement
  fastify.post('/playbooks/preview-template', async (request) => {
    const { text, context } = request.body as any;
    const resolved = playbookService.replacePlaybookVariables(text || '', context || {});
    return { ok: true, resolved };
  });
}

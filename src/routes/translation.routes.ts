/**
 * Translation Routes — API endpoints for the translation system
 * Endpoints: translate, detect, settings CRUD, logs, agent prefs, languages
 */

import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import {
  translateTextV2,
  detectLanguage,
  testProxyConnection,
  SUPPORTED_LANGUAGES,
} from '../services/translation.service.js';
import {
  translateOutgoing,
  previewOutgoingTranslation,
  getOutgoingConfig,
  updateSessionTranslation,
} from '../services/outgoing-translation.service.js';
import {
  getIncomingConfig,
  updateSessionIncomingTranslation,
} from '../services/incoming-translation.service.js';
import {
  getTranslationSettings,
  updateTranslationSettings,
} from '../database/models/TranslationSettings.js';
import {
  getTranslationLogs,
  getTranslationStats,
  TranslationLog,
} from '../database/models/TranslationLog.js';
import {
  createTranslationReport,
  getTranslationReports,
  updateReportStatus,
  blockReporter,
  unblockReporter,
  isReporterBlocked,
  getReportStats,
  type ReportCategory,
  type ReportStatus,
} from '../database/models/TranslationReport.js';
import { Message } from '../database/models/Message.js';

// ─── TYPES ──────────────────────────────────────────────────

interface TranslateBody {
  text: string;
  sourceLang?: string;
  targetLang: string;
  provider?: string;
  sessionId?: string;
  messageId?: string;
  direction?: 'incoming' | 'outgoing' | 'manual';
}

interface DetectBody {
  text: string;
}

// ─── ROUTES ─────────────────────────────────────────────────

export async function translationRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('onRequest', authMiddleware);

  // ═══════════════════════════════════════════════════════════
  //  CORE TRANSLATION
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/translation/translate
   * Translate text using the configured provider chain
   */
  fastify.post<{ Body: TranslateBody }>('/translate', async (request, reply) => {
    const agent = (request as any).agent;
    const body = request.body as TranslateBody;

    if (!body.text?.trim()) {
      return reply.code(400).send({ ok: false, error: 'Text is required' });
    }
    if (!body.targetLang?.trim()) {
      return reply.code(400).send({ ok: false, error: 'Target language is required' });
    }

    try {
      const result = await translateTextV2({
        text: body.text,
        sourceLang: body.sourceLang,
        targetLang: body.targetLang,
        provider: body.provider as any,
        agentId: agent._id.toString(),
        sessionId: body.sessionId,
        messageId: body.messageId,
        direction: body.direction || 'manual',
      });

      return {
        ok: true,
        translatedText: result.translatedText,
        detectedLang: result.detectedLang,
        provider: result.provider,
        cached: result.cached,
        latencyMs: result.latencyMs,
      };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * POST /api/translation/detect
   * Detect the language of a text
   */
  fastify.post<{ Body: DetectBody }>('/detect', async (request, reply) => {
    const body = request.body as DetectBody;
    if (!body.text?.trim()) {
      return reply.code(400).send({ ok: false, error: 'Text is required' });
    }

    try {
      const agent = (request as any).agent;
      const result = await detectLanguage(body.text, agent._id.toString());
      return { ok: true, language: result.language, confidence: result.confidence };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/translation/languages
   * Get list of supported languages
   */
  fastify.get('/languages', async () => {
    return { ok: true, languages: SUPPORTED_LANGUAGES };
  });

  // ═══════════════════════════════════════════════════════════
  //  SETTINGS (Admin/Supervisor only)
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /api/translation/settings
   * Get current translation settings
   */
  fastify.get('/settings', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    const settings = await getTranslationSettings();
    return { ok: true, settings };
  });

  /**
   * PUT /api/translation/settings
   * Update translation settings
   */
  fastify.put('/settings', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    try {
      const settings = await updateTranslationSettings(
        request.body as any,
        agent._id.toString(),
      );
      return { ok: true, settings };
    } catch (err: any) {
      return reply.code(400).send({ ok: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  AUDIT LOGS & STATS (Admin/Supervisor only)
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /api/translation/logs
   * Get translation audit logs (paginated)
   */
  fastify.get('/logs', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    const { agentId, sessionId, provider, page, limit } = request.query as any;
    const result = await getTranslationLogs({
      agentId, sessionId, provider,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });

    return { ok: true, ...result };
  });

  /**
   * GET /api/translation/stats
   * Get translation usage statistics
   */
  fastify.get('/stats', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    const { days } = request.query as any;
    const stats = await getTranslationStats(days ? parseInt(days) : 30);
    return { ok: true, stats };
  });

  /**
   * POST /api/translation/proxy/test
   * Test proxy connectivity (Admin/Supervisor only)
   */
  fastify.post('/proxy/test', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    const proxyConfig = request.body as any;
    if (!proxyConfig?.host || !proxyConfig?.port) {
      return reply.code(400).send({ ok: false, error: 'Proxy host and port are required' });
    }

    try {
      const result = await testProxyConnection({
        enabled: true,
        protocol: proxyConfig.protocol || 'http',
        host: proxyConfig.host,
        port: parseInt(proxyConfig.port) || 8080,
        username: proxyConfig.username || '',
        password: proxyConfig.password || '',
        timeoutMs: parseInt(proxyConfig.timeoutMs) || 10000,
        externalOnly: proxyConfig.externalOnly ?? true,
        allowDirectFallback: proxyConfig.allowDirectFallback ?? true,
      });

      return { ok: true, ...result };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/translation/settings/public
   * Get non-sensitive settings for agents (lock flags, default langs, mode)
   */
  fastify.get('/settings/public', async () => {
    const settings = await getTranslationSettings();
    return {
      ok: true,
      mode: settings.mode,
      defaultSourceLang: settings.defaultSourceLang,
      defaultTargetLang: settings.defaultTargetLang,
      lockSourceLang: settings.lockSourceLang,
      lockTargetLang: settings.lockTargetLang,
      enableAutoDetect: settings.enableAutoDetect,
      proxyEnabled: settings.proxy?.enabled ?? false,
    };
  });

  // ═══════════════════════════════════════════════════════════
  //  OUTGOING AUTO-TRANSLATE
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/translation/outgoing/preview
   * Preview an outgoing translation before sending
   */
  fastify.post('/outgoing/preview', async (request, reply) => {
    const agent = (request as any).agent;
    const body = request.body as { content: string; sessionId: string };

    if (!body.content?.trim()) {
      return reply.code(400).send({ ok: false, error: 'Content is required' });
    }
    if (!body.sessionId) {
      return reply.code(400).send({ ok: false, error: 'Session ID is required' });
    }

    try {
      const result = await previewOutgoingTranslation({
        content: body.content,
        sessionId: body.sessionId,
        agentId: agent._id.toString(),
        agentName: agent.name,
        channel: 'preview',
      });
      return { ok: true, ...result };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/translation/outgoing/config
   * Get outgoing translation config for current agent + session
   */
  fastify.get('/outgoing/config', async (request) => {
    const agent = (request as any).agent;
    const { sessionId } = request.query as { sessionId?: string };

    const config = await getOutgoingConfig(
      agent._id.toString(),
      sessionId || '',
    );
    return { ok: true, ...config };
  });

  /**
   * PATCH /api/translation/outgoing/session
   * Update per-session translation override
   */
  fastify.patch('/outgoing/session', async (request, reply) => {
    const body = request.body as {
      sessionId: string;
      outgoingEnabled?: boolean;
      outgoingTargetLang?: string;
    };

    if (!body.sessionId) {
      return reply.code(400).send({ ok: false, error: 'Session ID is required' });
    }

    // get current config to check if agent override is allowed
    const currentConfig = await getOutgoingConfig('', body.sessionId);
    if (currentConfig.agentOverrideAllowed === false) {
      return reply.code(403).send({ ok: false, error: 'Agent override is not allowed for this session' });
    }

    try {
      await updateSessionTranslation(body.sessionId, {
        outgoingEnabled: body.outgoingEnabled,
        outgoingTargetLang: body.outgoingTargetLang,
      });
      return { ok: true };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // ─── INCOMING AUTO-TRANSLATE ─────────────────────────────────

  /**
   * GET /api/translation/incoming/config
   * Get incoming translation config for current agent + session
   */
  fastify.get('/incoming/config', async (request) => {
    const agent = (request as any).agent;
    const { sessionId } = request.query as { sessionId?: string };

    const config = await getIncomingConfig(
      agent._id.toString(),
      sessionId || '',
    );
    return { ok: true, ...config };
  });

  /**
   * PATCH /api/translation/incoming/session
   * Update per-session incoming translation override
   */
  fastify.patch('/incoming/session', async (request, reply) => {
    const body = request.body as {
      sessionId: string;
      incomingEnabled?: boolean;
      incomingTargetLang?: string;
    };

    if (!body.sessionId) {
      return reply.code(400).send({ ok: false, error: 'Session ID is required' });
    }

    // get current config to check if agent override is allowed
    const currentConfig = await getIncomingConfig('', body.sessionId);
    if (currentConfig.agentOverrideAllowed === false) {
      return reply.code(403).send({ ok: false, error: 'Agent override is not allowed for this session' });
    }

    try {
      await updateSessionIncomingTranslation(body.sessionId, {
        incomingEnabled: body.incomingEnabled,
        incomingTargetLang: body.incomingTargetLang,
      });
      return { ok: true };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  TRANSLATION REPORTS
  // ═══════════════════════════════════════════════════════════

  /**
   * POST /api/translation/reports
   * Submit a translation report
   */
  fastify.post('/reports', async (request, reply) => {
    const agent = (request as any).agent;
    const body = request.body as {
      messageId: string;
      sessionId: string;
      category: ReportCategory;
      reason: string;
      originalContent: string;
      translatedContent: string;
      sourceLang: string;
      targetLang: string;
      provider: string;
      direction?: 'incoming' | 'outgoing';
      latencyMs?: number;
    };

    if (!body.messageId || !body.sessionId || !body.category || !body.reason?.trim()) {
      return reply.code(400).send({ ok: false, error: 'messageId, sessionId, category and reason are required' });
    }

    // Check if reporter is blocked
    const blocked = await isReporterBlocked(agent._id.toString());
    if (blocked) {
      return reply.code(403).send({ ok: false, error: 'Tu cuenta está bloqueada para enviar reportes de traducción' });
    }

    try {
      const report = await createTranslationReport({
        messageId: body.messageId as any,
        sessionId: body.sessionId,
        reportedBy: agent._id,
        reportedByName: agent.name,
        category: body.category,
        reason: body.reason.trim(),
        originalContent: body.originalContent,
        translatedContent: body.translatedContent,
        sourceLang: body.sourceLang,
        targetLang: body.targetLang,
        provider: body.provider,
        direction: body.direction || 'incoming',
        latencyMs: body.latencyMs,
      });
      return { ok: true, report };
    } catch (err: any) {
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  /**
   * GET /api/translation/reports
   * List translation reports (Admin/Supervisor)
   */
  fastify.get('/reports', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    const { status, category, reportedBy, provider, page, limit } = request.query as any;
    const result = await getTranslationReports({
      status, category, reportedBy, provider,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });

    return { ok: true, ...result };
  });

  /**
   * GET /api/translation/reports/stats
   * Get report statistics
   */
  fastify.get('/reports/stats', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    const stats = await getReportStats();
    return { ok: true, stats };
  });

  /**
   * PATCH /api/translation/reports/:id
   * Update report status (review, resolve, dismiss)
   */
  fastify.patch<{ Params: { id: string } }>('/reports/:id', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    const body = request.body as { status: ReportStatus; reviewNote?: string };
    if (!body.status) {
      return reply.code(400).send({ ok: false, error: 'Status is required' });
    }

    const report = await updateReportStatus(request.params.id, {
      status: body.status,
      reviewNote: body.reviewNote,
      reviewedBy: agent._id.toString(),
      reviewedByName: agent.name,
    });

    if (!report) {
      return reply.code(404).send({ ok: false, error: 'Report not found' });
    }

    return { ok: true, report };
  });

  /**
   * POST /api/translation/reports/block/:agentId
   * Block an agent from submitting reports
   */
  fastify.post<{ Params: { agentId: string } }>('/reports/block/:agentId', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    await blockReporter(request.params.agentId, agent._id.toString());
    return { ok: true };
  });

  /**
   * POST /api/translation/reports/unblock/:agentId
   * Unblock an agent from submitting reports
   */
  fastify.post<{ Params: { agentId: string } }>('/reports/unblock/:agentId', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    await unblockReporter(request.params.agentId);
    return { ok: true };
  });

  // ═══════════════════════════════════════════════════════════
  //  COST DASHBOARD
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /api/translation/cost-dashboard
   * Get cost/usage analytics for translation system
   */
  fastify.get('/cost-dashboard', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    const { days } = request.query as { days?: string };
    const numDays = days ? parseInt(days) : 30;
    const since = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000);

    const [
      dailyUsage,
      byProvider,
      byDirection,
      byLangPair,
      topAgents,
      totalStats,
    ] = await Promise.all([
      // Daily usage (for chart)
      TranslationLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            requests: { $sum: 1 },
            characters: { $sum: '$characterCount' },
            cached: { $sum: { $cond: ['$cached', 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // By provider
      TranslationLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$provider',
            count: { $sum: 1 },
            chars: { $sum: '$characterCount' },
            avgLatency: { $avg: '$latencyMs' },
          },
        },
        { $sort: { count: -1 } },
      ]),
      // By direction
      TranslationLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$direction',
            count: { $sum: 1 },
            chars: { $sum: '$characterCount' },
          },
        },
      ]),
      // Top language pairs
      TranslationLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { source: '$sourceLang', target: '$targetLang' },
            count: { $sum: 1 },
            chars: { $sum: '$characterCount' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      // Top agents
      TranslationLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: '$agentId',
            count: { $sum: 1 },
            chars: { $sum: '$characterCount' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'agents',
            localField: '_id',
            foreignField: '_id',
            as: 'agent',
          },
        },
        { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
        { $project: { agentName: '$agent.name', count: 1, chars: 1 } },
      ]),
      // Totals
      TranslationLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            totalChars: { $sum: '$characterCount' },
            cachedHits: { $sum: { $cond: ['$cached', 1, 0] } },
            avgLatency: { $avg: '$latencyMs' },
          },
        },
      ]),
    ]);

    // Estimate cost (rough: DeepL $20/M chars, Google $20/M chars, Free $0)
    const estimatedCost = byProvider.reduce((acc: number, p: any) => {
      if (p._id === 'free') return acc;
      return acc + (p.chars / 1_000_000) * 20;
    }, 0);

    const totals = totalStats[0] || { totalRequests: 0, totalChars: 0, cachedHits: 0, avgLatency: 0 };

    return {
      ok: true,
      days: numDays,
      totals: { ...totals, estimatedCost: Math.round(estimatedCost * 100) / 100 },
      dailyUsage,
      byProvider,
      byDirection,
      byLangPair,
      topAgents,
    };
  });

  // ═══════════════════════════════════════════════════════════
  //  QA REVIEW MODE
  // ═══════════════════════════════════════════════════════════

  /**
   * GET /api/translation/qa/messages
   * Get messages with translations for QA review (supervisor)
   */
  fastify.get('/qa/messages', async (request, reply) => {
    const agent = (request as any).agent;
    if (!['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Insufficient permissions' });
    }

    const { sessionId, page, limit, direction, edited } = request.query as any;
    const numPage = page ? parseInt(page) : 1;
    const numLimit = limit ? parseInt(limit) : 30;
    const filter: Record<string, unknown> = {};

    if (sessionId) filter.session = sessionId;

    // Different filters for incoming vs outgoing
    if (direction === 'incoming') {
      filter['incomingTranslation.translatedContent'] = { $exists: true, $ne: '' };
    } else if (direction === 'outgoing') {
      filter['translation.isTranslated'] = true;
    } else {
      // Both
      filter.$or = [
        { 'incomingTranslation.translatedContent': { $exists: true, $ne: '' } },
        { 'translation.isTranslated': true },
      ];
    }

    // Filter edited-only messages (for outgoing with editedTranslation)
    if (edited === 'true') {
      filter['translation.editedContent'] = { $exists: true, $ne: '' };
    }

    const [messages, total] = await Promise.all([
      Message.find(filter)
        .sort({ createdAt: -1 })
        .skip((numPage - 1) * numLimit)
        .limit(numLimit)
        .populate('senderAgent', 'name email avatar')
        .populate('session', 'sessionId')
        .lean(),
      Message.countDocuments(filter),
    ]);

    return {
      ok: true,
      messages: messages.map((m: any) => ({
        _id: m._id,
        sessionId: m.session?.sessionId || m.session,
        sender: m.sender,
        senderAgent: m.senderAgent,
        originalContent: m.content,
        // Outgoing translation
        outgoingTranslation: m.translation?.isTranslated ? {
          translatedContent: m.translation.originalContent ? m.content : undefined,
          originalAgentContent: m.translation.originalContent,
          editedContent: m.translation.editedContent,
          sourceLang: m.translation.sourceLang,
          targetLang: m.translation.targetLang,
          provider: m.translation.provider,
          latencyMs: m.translation.latencyMs,
          wasEdited: !!m.translation.editedContent,
        } : undefined,
        // Incoming translation
        incomingTranslation: m.incomingTranslation?.translatedContent ? {
          translatedContent: m.incomingTranslation.translatedContent,
          sourceLang: m.incomingTranslation.sourceLang,
          targetLang: m.incomingTranslation.targetLang,
          provider: m.incomingTranslation.provider,
          latencyMs: m.incomingTranslation.latencyMs,
          cached: m.incomingTranslation.cached,
        } : undefined,
        createdAt: m.createdAt,
      })),
      total,
      page: numPage,
      pages: Math.ceil(total / numLimit),
    };
  });
}

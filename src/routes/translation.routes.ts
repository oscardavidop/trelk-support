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
} from '../database/models/TranslationLog.js';

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
}

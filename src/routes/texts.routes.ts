/**
 * Text Registry Routes
 * Admin API for managing internationalized texts
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logger } from '../services/logger.js';
import {
  getAllTexts,
  getTextByKey,
  createText,
  updateText,
  updateTextLanguage,
  deleteText,
  deleteTextLanguage,
  getTextKeys,
  getTextPreview,
  exportTextsAsJSON,
  importTextsFromJSON,
  validateFlowTexts,
  setTextVariant,
  removeTextVariant,
  forceReloadRegistry,
  getCacheStats,
  seedDefaultTexts,
  type SupportedLanguage,
  SUPPORTED_LANGUAGES,
} from '../services/text-registry.service.js';
import {
  translateText,
  translateToMultipleLanguages,
  detectLanguage,
  getProviderStatus,
} from '../services/translation.service.js';

// ============= ROUTE REGISTRATION =============

export async function textsRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth to all routes
  fastify.addHook('onRequest', authMiddleware);

  // ============= TEXT CRUD =============

  /**
   * GET /api/admin/texts
   * Get all texts with optional filtering
   */
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { category, search, lang, limit, skip } = request.query as {
        category?: string;
        search?: string;
        lang?: string;
        limit?: string;
        skip?: string;
      };
      
      const result = await getAllTexts({
        category,
        search,
        lang,
        limit: limit ? parseInt(limit) : undefined,
        skip: skip ? parseInt(skip) : undefined,
      });
      
      // Transform Map to Object for JSON serialization
      const texts = result.texts.map(text => ({
        ...text,
        texts: text.texts instanceof Map 
          ? Object.fromEntries(text.texts) 
          : text.texts,
        variants: text.variants instanceof Map
          ? Object.fromEntries(
              Array.from(text.variants).map(([k, v]) => [
                k,
                v instanceof Map ? Object.fromEntries(v) : v
              ])
            )
          : text.variants,
      }));
      
      return {
        success: true,
        data: texts,
        total: result.total,
        languages: SUPPORTED_LANGUAGES,
      };
    } catch (error) {
      logger.error('settings-cache', { action: 'get_texts_failed', error: String(error) });
      return reply.status(500).send({ success: false, error: 'Failed to get texts' });
    }
  });

  /**
   * GET /api/admin/texts/keys
   * Get all text keys for autocomplete
   */
  fastify.get('/keys', async () => {
    const keys = getTextKeys();
    return { success: true, keys };
  });

  /**
   * GET /api/admin/texts/categories
   * Get available categories
   */
  fastify.get('/categories', async () => {
    return {
      success: true,
      categories: [
        { value: 'welcome', label: 'Bienvenida', icon: '👋' },
        { value: 'farewell', label: 'Despedida', icon: '👋' },
        { value: 'follow-up', label: 'Seguimiento', icon: '📩' },
        { value: 'notification', label: 'Notificación', icon: '🔔' },
        { value: 'error', label: 'Error', icon: '❌' },
        { value: 'menu', label: 'Menú', icon: '📋' },
        { value: 'button', label: 'Botón', icon: '🔘' },
        { value: 'system', label: 'Sistema', icon: '⚙️' },
        { value: 'custom', label: 'Personalizado', icon: '✏️' },
      ],
    };
  });

  /**
   * GET /api/admin/texts/languages
   * Get supported languages
   */
  fastify.get('/languages', async () => {
    return {
      success: true,
      languages: SUPPORTED_LANGUAGES,
    };
  });

  /**
   * GET /api/admin/texts/stats
   * Get cache and registry stats
   */
  fastify.get('/stats', async () => {
    const stats = getCacheStats();
    const translationStatus = getProviderStatus();
    
    return {
      success: true,
      stats: {
        ...stats,
        translation: translationStatus,
      },
    };
  });

  /**
   * GET /api/admin/texts/translation/status
   * Get translation provider status
   */
  fastify.get('/translation/status', async () => {
    const status = getProviderStatus();
    return { success: true, data: status };
  });

  /**
   * GET /api/admin/texts/export/json
   * Export all texts as JSON
   */
  fastify.get('/export/json', {
    onRequest: requireRole(['admin']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const json = await exportTextsAsJSON();
      
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', 'attachment; filename=texts-export.json');
      return reply.send(json);
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Export failed' });
    }
  });

  /**
   * GET /api/admin/texts/:key
   * Get a single text by key
   */
  fastify.get('/:key', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key } = request.params as { key: string };
      const text = await getTextByKey(key);
      
      if (!text) {
        return reply.status(404).send({ success: false, error: 'Text not found' });
      }
      
      // Transform for JSON
      const transformed = {
        ...text,
        texts: text.texts instanceof Map 
          ? Object.fromEntries(text.texts) 
          : text.texts,
        variants: text.variants instanceof Map
          ? Object.fromEntries(
              Array.from(text.variants).map(([k, v]) => [
                k,
                v instanceof Map ? Object.fromEntries(v) : v
              ])
            )
          : text.variants,
      };
      
      return { success: true, data: transformed };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Failed to get text' });
    }
  });

  /**
   * GET /api/admin/texts/:key/preview
   * Get text preview with all languages
   */
  fastify.get('/:key/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key } = request.params as { key: string };
      const preview = await getTextPreview(key);
      
      if (!preview) {
        return reply.status(404).send({ success: false, error: 'Text not found' });
      }
      
      return { success: true, data: preview };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Failed to get preview' });
    }
  });

  /**
   * POST /api/admin/texts
   * Create a new text
   */
  fastify.post('/', {
    onRequest: requireRole(['admin', 'supervisor']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key, defaultLang, texts, description, category, tags } = request.body as {
        key: string;
        defaultLang?: string;
        texts: Record<string, string>;
        description?: string;
        category?: string;
        tags?: string[];
      };
      const agent = (request as any).agent;
      
      if (!key || !texts || Object.keys(texts).length === 0) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Key and at least one text translation are required' 
        });
      }
      
      // Validate key format
      if (!/^[A-Z][A-Z0-9_]*$/i.test(key)) {
        return reply.status(400).send({ 
          success: false, 
          error: 'Key must start with a letter and contain only letters, numbers, and underscores' 
        });
      }
      
      // Check if key already exists
      const existing = await getTextByKey(key);
      if (existing) {
        return reply.status(409).send({ 
          success: false, 
          error: 'A text with this key already exists' 
        });
      }
      
      const text = await createText({
        key,
        defaultLang: (defaultLang || 'es') as SupportedLanguage,
        texts,
        description,
        category,
        tags,
        createdBy: agent.id,
      });
      
      return reply.status(201).send({ 
        success: true, 
        data: {
          ...text.toObject(),
          texts: Object.fromEntries(text.texts),
        }
      });
    } catch (error) {
      logger.error('settings-cache', { action: 'create_text_failed', error: String(error) });
      return reply.status(500).send({ success: false, error: 'Failed to create text' });
    }
  });

  /**
   * POST /api/admin/texts/translate
   * Translate text to a target language
   */
  fastify.post('/translate', {
    onRequest: requireRole(['admin', 'supervisor']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { text, sourceLang, targetLang, provider } = request.body as {
        text: string;
        sourceLang: string;
        targetLang: string;
        provider?: 'google' | 'azure';
      };
      
      if (!text || !sourceLang || !targetLang) {
        return reply.status(400).send({ 
          success: false, 
          error: 'text, sourceLang, and targetLang are required' 
        });
      }
      
      const result = await translateText(text, sourceLang, targetLang, provider);
      
      return { success: result.success, data: result };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Translation failed' });
    }
  });

  /**
   * POST /api/admin/texts/translate-all
   * Translate text to multiple languages
   */
  fastify.post('/translate-all', {
    onRequest: requireRole(['admin', 'supervisor']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { text, sourceLang, targetLangs, provider } = request.body as {
        text: string;
        sourceLang: string;
        targetLangs: string[];
        provider?: 'google' | 'azure';
      };
      
      if (!text || !sourceLang || !targetLangs || targetLangs.length === 0) {
        return reply.status(400).send({ 
          success: false, 
          error: 'text, sourceLang, and targetLangs are required' 
        });
      }
      
      const result = await translateToMultipleLanguages(text, sourceLang, targetLangs, provider);
      
      return { success: result.success, data: result };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Batch translation failed' });
    }
  });

  /**
   * POST /api/admin/texts/detect-language
   * Detect the language of a text
   */
  fastify.post('/detect-language', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { text } = request.body as { text: string };
      
      if (!text) {
        return reply.status(400).send({ success: false, error: 'Text is required' });
      }
      
      const result = await detectLanguage(text);
      return { success: result.success, data: result };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Language detection failed' });
    }
  });

  /**
   * POST /api/admin/texts/validate
   * Validate that texts exist for a flow
   */
  fastify.post('/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { keys } = request.body as { keys: string[] };
      
      if (!keys || !Array.isArray(keys)) {
        return reply.status(400).send({ success: false, error: 'Keys array is required' });
      }
      
      const result = validateFlowTexts(keys);
      return { success: true, data: result };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Validation failed' });
    }
  });

  /**
   * POST /api/admin/texts/import/json
   * Import texts from JSON
   */
  fastify.post('/import/json', {
    onRequest: requireRole(['admin']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { data, mode = 'merge' } = request.body as {
        data: string | Record<string, unknown>;
        mode?: 'merge' | 'replace';
      };
      const agent = (request as any).agent;
      
      if (!data) {
        return reply.status(400).send({ success: false, error: 'JSON data is required' });
      }
      
      const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
      const result = await importTextsFromJSON(jsonString, agent.id, mode);
      
      return { success: true, data: result };
    } catch (error) {
      logger.error('settings-cache', { action: 'import_failed', error: String(error) });
      return reply.status(500).send({ success: false, error: 'Import failed: ' + String(error) });
    }
  });

  /**
   * POST /api/admin/texts/cache/reload
   * Force reload the text registry cache
   */
  fastify.post('/cache/reload', {
    onRequest: requireRole(['admin']),
  }, async () => {
    const count = await forceReloadRegistry();
    return { success: true, message: `Cache reloaded with ${count} texts` };
  });

  /**
   * POST /api/admin/texts/seed
   * Seed default texts
   */
  fastify.post('/seed', {
    onRequest: requireRole(['admin']),
  }, async (request: FastifyRequest) => {
    const agent = (request as any).agent;
    await seedDefaultTexts(agent.id);
    return { success: true, message: 'Default texts seeded successfully' };
  });

  /**
   * POST /api/admin/texts/:key/translate/:lang
   * Translate an existing text to a new language and save
   */
  fastify.post('/:key/translate/:lang', {
    onRequest: requireRole(['admin', 'supervisor']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key, lang } = request.params as { key: string; lang: string };
      const { sourceLang, provider } = request.body as {
        sourceLang?: string;
        provider?: 'google' | 'azure';
      };
      const agent = (request as any).agent;
      
      // Get the source text
      const textDoc = await getTextByKey(key);
      if (!textDoc) {
        return reply.status(404).send({ success: false, error: 'Text not found' });
      }
      
      const sourceTexts = textDoc.texts instanceof Map 
        ? textDoc.texts 
        : new Map(Object.entries(textDoc.texts as Record<string, string>));
      
      const sourceText = sourceTexts.get(sourceLang || textDoc.defaultLang);
      if (!sourceText) {
        return reply.status(400).send({ success: false, error: 'Source language text not found' });
      }
      
      // Translate
      const result = await translateText(
        sourceText,
        sourceLang || textDoc.defaultLang,
        lang,
        provider
      );
      
      if (!result.success || !result.translatedText) {
        return reply.status(500).send({ success: false, error: result.error || 'Translation failed' });
      }
      
      // Save the translation
      const updated = await updateTextLanguage(
        key,
        lang as SupportedLanguage,
        result.translatedText,
        result.provider,
        agent.id
      );
      
      return { 
        success: true, 
        data: {
          translatedText: result.translatedText,
          provider: result.provider,
          saved: !!updated,
        }
      };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Failed to translate and save' });
    }
  });

  /**
   * PUT /api/admin/texts/:key
   * Update an existing text
   */
  fastify.put('/:key', {
    onRequest: requireRole(['admin', 'supervisor']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key } = request.params as { key: string };
      const { texts, description, category, tags, defaultLang, abTest, scheduled, changeNote } = request.body as {
        texts?: Record<string, string>;
        description?: string;
        category?: string;
        tags?: string[];
        defaultLang?: string;
        abTest?: { enabled: boolean; variantA?: string; variantB?: string; distribution?: number };
        scheduled?: { enabled: boolean; activateAt?: Date; deactivateAt?: Date };
        changeNote?: string;
      };
      const agent = (request as any).agent;
      
      const updated = await updateText(key, {
        texts,
        description,
        category,
        tags,
        defaultLang: defaultLang as SupportedLanguage,
        abTest,
        scheduled,
        updatedBy: agent.id,
        changeNote,
      });
      
      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Text not found' });
      }
      
      return { 
        success: true, 
        data: {
          ...updated.toObject(),
          texts: Object.fromEntries(updated.texts),
        }
      };
    } catch (error) {
      logger.error('settings-cache', { action: 'update_text_failed', error: String(error) });
      return reply.status(500).send({ success: false, error: 'Failed to update text' });
    }
  });

  /**
   * PUT /api/admin/texts/:key/language/:lang
   * Update a specific language translation
   */
  fastify.put('/:key/language/:lang', {
    onRequest: requireRole(['admin', 'supervisor']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key, lang } = request.params as { key: string; lang: string };
      const { text, source = 'manual' } = request.body as {
        text: string;
        source?: 'manual' | 'google' | 'azure' | 'ai';
      };
      const agent = (request as any).agent;
      
      if (!text) {
        return reply.status(400).send({ success: false, error: 'Text is required' });
      }
      
      const updated = await updateTextLanguage(
        key,
        lang as SupportedLanguage,
        text,
        source,
        agent.id
      );
      
      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Text not found' });
      }
      
      return { 
        success: true, 
        data: {
          ...updated.toObject(),
          texts: Object.fromEntries(updated.texts),
        }
      };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Failed to update language' });
    }
  });

  /**
   * PUT /api/admin/texts/:key/variant/:variantName
   * Add or update a context variant
   */
  fastify.put('/:key/variant/:variantName', {
    onRequest: requireRole(['admin', 'supervisor']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key, variantName } = request.params as { key: string; variantName: string };
      const { texts } = request.body as { texts: Record<string, string> };
      const agent = (request as any).agent;
      
      if (!texts || Object.keys(texts).length === 0) {
        return reply.status(400).send({ success: false, error: 'At least one translation is required' });
      }
      
      const updated = await setTextVariant(key, variantName, texts, agent.id);
      
      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Text not found' });
      }
      
      return { success: true, message: 'Variant updated successfully' };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Failed to update variant' });
    }
  });

  /**
   * DELETE /api/admin/texts/:key
   * Delete a text
   */
  fastify.delete('/:key', {
    onRequest: requireRole(['admin']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key } = request.params as { key: string };
      const agent = (request as any).agent;
      
      const deleted = await deleteText(key, agent.id);
      
      if (!deleted) {
        return reply.status(404).send({ 
          success: false, 
          error: 'Text not found or is locked (used in active flows)' 
        });
      }
      
      return { success: true, message: 'Text deleted successfully' };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Failed to delete text' });
    }
  });

  /**
   * DELETE /api/admin/texts/:key/language/:lang
   * Delete a specific language from a text
   */
  fastify.delete('/:key/language/:lang', {
    onRequest: requireRole(['admin', 'supervisor']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key, lang } = request.params as { key: string; lang: string };
      const agent = (request as any).agent;
      
      const updated = await deleteTextLanguage(key, lang as SupportedLanguage, agent.id);
      
      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Text not found or cannot delete the only language' });
      }
      
      return { 
        success: true, 
        data: {
          ...updated.toObject(),
          texts: Object.fromEntries(updated.texts),
        }
      };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Failed to delete language' });
    }
  });

  /**
   * DELETE /api/admin/texts/:key/variant/:variantName
   * Remove a context variant
   */
  fastify.delete('/:key/variant/:variantName', {
    onRequest: requireRole(['admin', 'supervisor']),
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { key, variantName } = request.params as { key: string; variantName: string };
      const agent = (request as any).agent;
      
      const updated = await removeTextVariant(key, variantName, agent.id);
      
      if (!updated) {
        return reply.status(404).send({ success: false, error: 'Text not found' });
      }
      
      return { success: true, message: 'Variant removed successfully' };
    } catch (error) {
      return reply.status(500).send({ success: false, error: 'Failed to remove variant' });
    }
  });
}

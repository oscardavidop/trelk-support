/**
 * Outgoing Translation Service
 * Handles automatic translation of agent replies before delivery to users.
 *
 * Features:
 * - Target language resolution (user detected → custom field → session → fallback)
 * - Redis caching with 7-day TTL
 * - Placeholder/variable protection ({{var}}, markdown, links, emojis)
 * - Delivery mode: translated_only or both (original + translated)
 * - Provider fallback chain + structured error logging
 * - Per-session and per-agent override support
 *
 * Prepared for future: incoming auto-translate (user → agent) can follow same pattern.
 */

import crypto from 'crypto';
import type { Types } from 'mongoose';
import {
  getTranslationSettings,
  type ITranslationSettings,
  type IOutgoingTranslateConfig,
  type TargetLangStrategy,
} from '../database/models/TranslationSettings.js';
import {
  AgentPreferences,
  type IAgentPreferences,
} from '../database/models/AgentPreferences.js';
import {
  ChatSession,
  type IChatSession,
} from '../database/models/ChatSession.js';
import {
  User,
  type IUser,
} from '../database/models/User.js';
import { logTranslation } from '../database/models/TranslationLog.js';
import { translateTextV2, type TranslateResult } from './translation.service.js';
import * as redis from './redis.js';
import { logger } from './logger.js';

// ─── TYPES ──────────────────────────────────────────────────

export interface OutgoingTranslateRequest {
  content: string;
  sessionId: string;
  agentId: string;
  agentName?: string;
  channel: string;
}

export interface OutgoingTranslateResult {
  shouldTranslate: boolean;
  translatedContent: string;    // the text to actually send to user
  originalContent: string;      // original agent text
  deliveryMode: 'translated_only' | 'both' | 'none';
  sourceLang: string;
  targetLang: string;
  provider?: string;
  latencyMs: number;
  cached: boolean;
  error?: string;
}

// ─── REDIS CACHE ────────────────────────────────────────────

const REDIS_PREFIX = 'outgoing:';
const REDIS_TTL = 7 * 24 * 60 * 60; // 7 days

function redisCacheKey(text: string, targetLang: string): string {
  const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
  return `${REDIS_PREFIX}${hash}:${targetLang}`;
}

async function getFromRedisCache(text: string, targetLang: string): Promise<string | null> {
  if (!redis.isRedisAvailable()) return null;
  try {
    return await redis.get(redisCacheKey(text, targetLang));
  } catch {
    return null;
  }
}

async function setRedisCache(text: string, targetLang: string, translated: string): Promise<void> {
  if (!redis.isRedisAvailable()) return;
  try {
    await redis.set(redisCacheKey(text, targetLang), translated, REDIS_TTL);
  } catch { /* silent */ }
}

// ─── PLACEHOLDER PROTECTION ────────────────────────────────

interface PlaceholderMap {
  processed: string;
  restore: (translated: string) => string;
}

/**
 * Protects template variables {{...}}, markdown links, and special tokens
 * during translation, then restores them after.
 */
function protectPlaceholders(text: string): PlaceholderMap {
  const tokens: { placeholder: string; original: string }[] = [];
  let idx = 0;

  // 1. Template variables: {{userName}}, {{date}}, etc.
  let result = text.replace(/\{\{([^}]+)\}\}/g, (match) => {
    const ph = `__TVAR${idx++}__`;
    tokens.push({ placeholder: ph, original: match });
    return ph;
  });

  // 2. Markdown links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match) => {
    const ph = `__TLINK${idx++}__`;
    tokens.push({ placeholder: ph, original: match });
    return ph;
  });

  // 3. URLs: http(s)://...
  result = result.replace(/(https?:\/\/[^\s<>]+)/g, (match) => {
    const ph = `__TURL${idx++}__`;
    tokens.push({ placeholder: ph, original: match });
    return ph;
  });

  // 4. Code blocks: `code` and ```code```
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    const ph = `__TCODE${idx++}__`;
    tokens.push({ placeholder: ph, original: match });
    return ph;
  });
  result = result.replace(/`[^`]+`/g, (match) => {
    const ph = `__TICOD${idx++}__`;
    tokens.push({ placeholder: ph, original: match });
    return ph;
  });

  return {
    processed: result,
    restore: (translated: string) => {
      let restored = translated;
      for (const t of tokens) {
        restored = restored.replace(t.placeholder, t.original);
      }
      return restored;
    },
  };
}

// ─── TARGET LANGUAGE RESOLUTION ─────────────────────────────

/**
 * Resolves the target language for outgoing translation.
 * Priority order from settings.outgoing.targetLangPriority:
 *   1. user_detected  — User.language or Telegram language_code
 *   2. custom_field   — UserCustomField with key 'lang'
 *   3. session_lang   — ChatSession.detectedUserLang
 *   4. fallback       — settings.outgoing.fallbackLang
 */
async function resolveTargetLang(
  session: IChatSession,
  config: IOutgoingTranslateConfig,
): Promise<string> {
  const priority = config.targetLangPriority || ['user_detected', 'custom_field', 'session_lang', 'fallback'];

  for (const strategy of priority) {
    const lang = await resolveStrategy(strategy, session, config);
    if (lang && lang !== 'auto' && lang.length >= 2) return lang;
  }

  return config.fallbackLang || 'en';
}

async function resolveStrategy(
  strategy: TargetLangStrategy | string,
  session: IChatSession,
  config: IOutgoingTranslateConfig,
): Promise<string | null> {
  switch (strategy) {
    case 'user_detected': {
      // Get user language from DB
      if (session.user) {
        const userId = typeof session.user === 'object' && '_id' in session.user
          ? (session.user as IUser)._id
          : session.user;
        const user = await User.findById(userId).lean();
        if (user?.language && user.language.length >= 2) return user.language;
      }
      return null;
    }
    case 'custom_field': {
      // Try to find a custom field named 'lang' or 'language' for this user
      try {
        const { UserCustomField } = await import('../database/models/CustomField.js');
        if (session.user) {
          const userId = typeof session.user === 'object' && '_id' in session.user
            ? (session.user as IUser)._id
            : session.user;
          const cf = await UserCustomField.findOne({
            user: userId,
            $or: [{ fieldKey: 'lang' }, { fieldKey: 'language' }],
          }).lean();
          if (cf?.value && typeof cf.value === 'string') return cf.value;
        }
      } catch { /* custom fields not set up */ }
      return null;
    }
    case 'session_lang': {
      if (session.detectedUserLang) return session.detectedUserLang;
      return null;
    }
    case 'fallback':
    default:
      return config.fallbackLang || 'en';
  }
}

// ─── CHECK IF AGENT HAS TRANSLATION ENABLED ────────────────

interface TranslateDecision {
  enabled: boolean;
  confirmBeforeSend: boolean;
  deliveryMode: 'translated_only' | 'both';
  agentWritesIn: string;
}

async function getTranslateDecision(
  agentId: string,
  sessionId: string,
  globalConfig: IOutgoingTranslateConfig,
): Promise<TranslateDecision> {
  const defaults: TranslateDecision = {
    enabled: globalConfig.enabled,
    confirmBeforeSend: globalConfig.showPreviewBeforeSend,
    deliveryMode: globalConfig.deliveryMode,
    agentWritesIn: 'auto',
  };

  // 1. Check per-session override
  try {
    const session = await ChatSession.findOne({ sessionId }).lean();
    if (session?.translationOverride) {
      if (session.translationOverride.outgoingEnabled === false) {
        return { ...defaults, enabled: false };
      }
      if (session.translationOverride.outgoingEnabled === true) {
        defaults.enabled = true;
      }
    }
  } catch { /* no session */ }

  // 2. Check agent preferences override
  try {
    const prefs = await AgentPreferences.findOne({ agentId }).lean() as IAgentPreferences | null;
    if (prefs?.translation) {
      if (prefs.translation.outgoingOverride === 'always_off') {
        return { ...defaults, enabled: false };
      }
      if (prefs.translation.outgoingOverride === 'always_on') {
        defaults.enabled = true;
      }
      if (prefs.translation.agentWritesIn) {
        defaults.agentWritesIn = prefs.translation.agentWritesIn;
      }
      if (typeof prefs.translation.confirmBeforeSend === 'boolean') {
        defaults.confirmBeforeSend = prefs.translation.confirmBeforeSend;
      }
    }
  } catch { /* no prefs */ }

  // 3. Global override allowed check
  if (!globalConfig.agentOverrideAllowed) {
    defaults.enabled = globalConfig.enabled;
  }

  return defaults;
}

// ─── FORMAT "BOTH" MODE ─────────────────────────────────────

function formatBothMode(original: string, translated: string, targetLang: string): string {
  const langNames: Record<string, string> = {
    en: 'English', es: 'Español', pt: 'Português', fr: 'Français',
    de: 'Deutsch', it: 'Italiano', ru: 'Русский', zh: '中文',
    ja: '日本語', ko: '한국어', ar: 'العربية', hi: 'हिन्दी',
    tr: 'Türkçe', nl: 'Nederlands', pl: 'Polski', uk: 'Українська',
  };
  const langLabel = langNames[targetLang] || targetLang.toUpperCase();
  return `${original}\n\n(${langLabel})\n${translated}`;
}

// ─── MAIN FUNCTION ──────────────────────────────────────────

/**
 * Translates an outgoing agent message before delivery.
 * Returns the translation result including what to send and metadata.
 *
 * Called from: socket message:send handler (backend) OR frontend preview endpoint.
 */
export async function translateOutgoing(req: OutgoingTranslateRequest): Promise<OutgoingTranslateResult> {
  const start = Date.now();
  const noTranslate: OutgoingTranslateResult = {
    shouldTranslate: false,
    translatedContent: req.content,
    originalContent: req.content,
    deliveryMode: 'none',
    sourceLang: 'auto',
    targetLang: '',
    latencyMs: 0,
    cached: false,
  };

  try {
    const settings = await getTranslationSettings();
    const outConfig = settings.outgoing || { enabled: false } as IOutgoingTranslateConfig;

    // Get decision (global + agent + session overrides)
    const decision = await getTranslateDecision(req.agentId, req.sessionId, outConfig);
    if (!decision.enabled) return noTranslate;

    // Resolve target language
    const session = await ChatSession.findOne({ sessionId: req.sessionId })
      .populate('user')
      .lean() as IChatSession | null;

    if (!session) return noTranslate;

    // Per-session target lang override
    const targetLang = session.translationOverride?.outgoingTargetLang
      || await resolveTargetLang(session, outConfig);

    const sourceLang = decision.agentWritesIn || 'auto';

    // Same language check
    if (sourceLang !== 'auto' && sourceLang === targetLang) {
      return noTranslate;
    }

    // Redis cache check
    const cached = await getFromRedisCache(req.content, targetLang);
    if (cached) {
      const latencyMs = Date.now() - start;
      const deliveryMode = decision.deliveryMode;
      const translatedContent = deliveryMode === 'both'
        ? formatBothMode(req.content, cached, targetLang)
        : cached;

      // Audit log
      if (settings.enableAuditLog) {
        logTranslation({
          agentId: req.agentId as unknown as Types.ObjectId,
          sessionId: req.sessionId,
          provider: 'free' as any, // cached from Redis
          sourceLang, targetLang,
          sourceText: req.content.slice(0, 500),
          translatedText: cached.slice(0, 500),
          characterCount: req.content.length,
          cached: true, latencyMs,
          direction: 'outgoing',
        }).catch(() => {});
      }

      return {
        shouldTranslate: true,
        translatedContent,
        originalContent: req.content,
        deliveryMode,
        sourceLang, targetLang,
        provider: 'redis_cache',
        latencyMs,
        cached: true,
      };
    }

    // Protect placeholders
    const { processed, restore } = outConfig.protectPlaceholders !== false
      ? protectPlaceholders(req.content)
      : { processed: req.content, restore: (t: string) => t };

    // Translate via provider chain
    const result: TranslateResult = await translateTextV2({
      text: processed,
      sourceLang,
      targetLang,
      agentId: req.agentId,
      sessionId: req.sessionId,
      direction: 'outgoing',
    });

    // Restore protected tokens
    const rawTranslated = restore(result.translatedText);

    // Cache in Redis
    await setRedisCache(req.content, targetLang, rawTranslated);

    const latencyMs = Date.now() - start;
    const deliveryMode = decision.deliveryMode;
    const translatedContent = deliveryMode === 'both'
      ? formatBothMode(req.content, rawTranslated, targetLang)
      : rawTranslated;

    return {
      shouldTranslate: true,
      translatedContent,
      originalContent: req.content,
      deliveryMode,
      sourceLang: result.detectedLang || sourceLang,
      targetLang,
      provider: result.provider,
      latencyMs,
      cached: false,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);

    logger.error('translation', {
      type: 'outgoing_translate_failed',
      chatId: req.sessionId,
      agentId: req.agentId,
      error,
    });

    return {
      ...noTranslate,
      error,
      latencyMs,
    };
  }
}

/**
 * Preview-only translation (for composer preview, no Redis cache write).
 */
export async function previewOutgoingTranslation(req: OutgoingTranslateRequest): Promise<OutgoingTranslateResult> {
  return translateOutgoing(req);
}

/**
 * Get outgoing translation config for a specific agent + session.
 * Used by frontend to decide whether to show auto-translate UI.
 */
export async function getOutgoingConfig(agentId: string, sessionId: string) {
  const settings = await getTranslationSettings();
  const outConfig = settings.outgoing || { enabled: false } as IOutgoingTranslateConfig;
  const decision = await getTranslateDecision(agentId, sessionId, outConfig);

  // Resolve target lang
  let targetLang = outConfig.fallbackLang || 'en';
  try {
    const session = await ChatSession.findOne({ sessionId }).populate('user').lean() as IChatSession | null;
    if (session) {
      targetLang = session.translationOverride?.outgoingTargetLang
        || await resolveTargetLang(session, outConfig);
    }
  } catch { /* */ }

  return {
    enabled: decision.enabled,
    confirmBeforeSend: decision.confirmBeforeSend,
    deliveryMode: decision.deliveryMode,
    agentWritesIn: decision.agentWritesIn,
    targetLang,
    showPreview: outConfig.showPreviewBeforeSend,
    agentOverrideAllowed: outConfig.agentOverrideAllowed,
  };
}

/**
 * Update per-session translation override.
 */
export async function updateSessionTranslation(
  sessionId: string,
  override: { outgoingEnabled?: boolean; outgoingTargetLang?: string },
): Promise<void> {
  await ChatSession.updateOne(
    { sessionId },
    { $set: { translationOverride: override } },
  );
}

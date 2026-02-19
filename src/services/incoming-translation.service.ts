/**
 * Incoming Translation Service
 * Handles automatic translation of incoming user messages for agents.
 *
 * Features:
 * - Async translation (message arrives first, translation follows)
 * - Redis caching with configurable TTL
 * - Skip rules (commands, emoji-only, short messages, media-only)
 * - Per-chat throttle (anti-flood)
 * - Provider fallback chain + structured error logging
 * - Per-session and per-agent override support
 * - Channel scope filtering (Telegram only, Web only, all)
 *
 * Flow:
 *   1. User sends message → saved to DB → emitted to dashboard immediately
 *   2. This service runs async → translates → emits 'message:translation' event
 *   3. Dashboard shows translation overlay under the original message
 */

import crypto from 'crypto';
import {
  getTranslationSettings,
  type IIncomingTranslateConfig,
  type IncomingTargetLangMode,
  type IncomingChannelScope,
} from '../database/models/TranslationSettings.js';
import {
  AgentPreferences,
  type IAgentPreferences,
} from '../database/models/AgentPreferences.js';
import {
  ChatSession,
  type IChatSession,
  type ChannelType,
} from '../database/models/ChatSession.js';
import { Message } from '../database/models/Message.js';
import { logTranslation } from '../database/models/TranslationLog.js';
import { translateTextV2, type TranslateResult } from './translation.service.js';
import * as redis from './redis.js';
import { logger } from './logger.js';

// ─── TYPES ──────────────────────────────────────────────────

export interface IncomingTranslateRequest {
  messageId: string;
  content: string;
  sessionId: string;
  channel: ChannelType;
  messageType?: string;
}

export interface IncomingTranslateResult {
  shouldTranslate: boolean;
  translatedContent: string;
  originalContent: string;
  sourceLang: string;
  targetLang: string;
  provider?: string;
  latencyMs: number;
  cached: boolean;
  showOriginal: boolean;
  error?: string;
}

export interface IncomingConfig {
  enabled: boolean;
  targetLang: string;
  showOriginal: boolean;
  channelScope: IncomingChannelScope;
  agentOverrideAllowed: boolean;
}

// ─── REDIS CACHE ────────────────────────────────────────────

const REDIS_PREFIX = 'incoming:';
const DEFAULT_TTL = 7 * 24 * 60 * 60; // 7 days

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

async function setRedisCache(text: string, targetLang: string, translated: string, ttlSeconds?: number): Promise<void> {
  if (!redis.isRedisAvailable()) return;
  try {
    await redis.set(redisCacheKey(text, targetLang), translated, ttlSeconds || DEFAULT_TTL);
  } catch { /* silent */ }
}

// ─── THROTTLE ───────────────────────────────────────────────

const throttleMap = new Map<string, number>(); // sessionId → lastTranslateTimestamp

function isThrottled(sessionId: string, throttleMs: number): boolean {
  if (throttleMs <= 0) return false;
  const last = throttleMap.get(sessionId) || 0;
  const now = Date.now();
  if (now - last < throttleMs) return true;
  throttleMap.set(sessionId, now);
  return false;
}

// Cleanup throttle map every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [key, ts] of throttleMap) {
    if (ts < cutoff) throttleMap.delete(key);
  }
}, 600_000);

// ─── SKIP RULES ─────────────────────────────────────────────

const COMMAND_REGEX = /^\/[a-zA-Z]/;
const EMOJI_ONLY_REGEX = /^[\p{Emoji_Presentation}\p{Emoji}\u200d\ufe0f\s]+$/u;

function shouldSkip(
  content: string,
  messageType: string | undefined,
  config: IIncomingTranslateConfig,
): { skip: boolean; reason?: string } {
  // Skip non-text (media without caption)
  if (messageType && messageType !== 'text' && (!content || content.trim().length === 0)) {
    return { skip: true, reason: 'media_no_caption' };
  }

  if (!content || content.trim().length === 0) {
    return { skip: true, reason: 'empty' };
  }

  // Skip commands
  if (config.skipCommands && COMMAND_REGEX.test(content.trim())) {
    return { skip: true, reason: 'command' };
  }

  // Skip short messages
  if (config.skipShortMessages && content.trim().length < 3) {
    return { skip: true, reason: 'too_short' };
  }

  // Skip emoji-only
  if (config.skipEmojiOnly && EMOJI_ONLY_REGEX.test(content.trim())) {
    return { skip: true, reason: 'emoji_only' };
  }

  return { skip: false };
}

// ─── CHANNEL SCOPE CHECK ────────────────────────────────────

function isChannelAllowed(channel: ChannelType, scope: IncomingChannelScope): boolean {
  if (scope === 'all') return true;
  if (scope === 'web_only' && channel === 'web') return true;
  if (scope === 'telegram_only' && channel === 'telegram') return true;
  return false;
}

// ─── TARGET LANGUAGE RESOLUTION ─────────────────────────────

async function resolveTargetLang(
  config: IIncomingTranslateConfig,
  session: IChatSession | null,
  agentId?: string,
): Promise<string> {
  const mode = config.targetLangMode || 'system_lang';

  switch (mode) {
    case 'agent_lang': {
      // Use agent's preferred language from preferences
      if (agentId) {
        try {
          const prefs = await AgentPreferences.findOne({ agentId }).lean() as IAgentPreferences | null;
          if (prefs?.translation?.incomingTargetLang && prefs.translation.incomingTargetLang.length >= 2) {
            return prefs.translation.incomingTargetLang;
          }
          if (prefs?.language && prefs.language.length >= 2) {
            return prefs.language;
          }
        } catch { /* fallthrough */ }
      }
      return config.targetLang || 'es';
    }
    case 'system_lang': {
      return config.targetLang || 'es';
    }
    case 'custom': {
      return config.targetLang || 'es';
    }
    default:
      return config.targetLang || 'es';
  }
}

// ─── DECISION ENGINE ────────────────────────────────────────

interface IncomingDecision {
  enabled: boolean;
  showOriginal: boolean;
  targetLang: string;
}

async function getIncomingDecision(
  sessionId: string,
  channel: ChannelType,
  agentId: string | undefined,
  globalConfig: IIncomingTranslateConfig,
): Promise<IncomingDecision> {
  const defaults: IncomingDecision = {
    enabled: globalConfig.enabled,
    showOriginal: globalConfig.showOriginal,
    targetLang: globalConfig.targetLang || 'es',
  };

  // Channel scope check
  if (!isChannelAllowed(channel, globalConfig.channelScope || 'all')) {
    return { ...defaults, enabled: false };
  }

  // 1. Check per-session override
  try {
    const session = await ChatSession.findOne({ sessionId }).lean();
    if (session?.translationOverride) {
      if (session.translationOverride.incomingEnabled === false) {
        return { ...defaults, enabled: false };
      }
      if (session.translationOverride.incomingEnabled === true) {
        defaults.enabled = true;
      }
      if (session.translationOverride.incomingTargetLang) {
        defaults.targetLang = session.translationOverride.incomingTargetLang;
      }
    }
  } catch { /* */ }

  // 2. Check agent preferences override (if agent is assigned)
  if (agentId && globalConfig.agentOverrideAllowed) {
    try {
      const prefs = await AgentPreferences.findOne({ agentId }).lean() as IAgentPreferences | null;
      if (prefs?.translation) {
        if (prefs.translation.incomingOverride === 'always_off') {
          return { ...defaults, enabled: false };
        }
        if (prefs.translation.incomingOverride === 'always_on') {
          defaults.enabled = true;
        }
        if (typeof prefs.translation.showOriginalWithTranslation === 'boolean') {
          defaults.showOriginal = prefs.translation.showOriginalWithTranslation;
        }
        if (prefs.translation.incomingTargetLang && prefs.translation.incomingTargetLang.length >= 2) {
          defaults.targetLang = prefs.translation.incomingTargetLang;
        }
      }
    } catch { /* */ }
  }

  // 3. Global override allowed check
  if (!globalConfig.agentOverrideAllowed) {
    defaults.enabled = globalConfig.enabled;
  }

  return defaults;
}

// ─── MAIN FUNCTION ──────────────────────────────────────────

/**
 * Translates an incoming user message for the agent dashboard.
 * Returns the translation result and metadata.
 *
 * Called async from: notifyNewMessage / notifyNewMediaMessage / web:message:send
 * The original message is always delivered first; translation arrives as a follow-up event.
 */
export async function translateIncoming(req: IncomingTranslateRequest): Promise<IncomingTranslateResult> {
  const start = Date.now();
  const noTranslate: IncomingTranslateResult = {
    shouldTranslate: false,
    translatedContent: '',
    originalContent: req.content,
    sourceLang: 'auto',
    targetLang: '',
    latencyMs: 0,
    cached: false,
    showOriginal: true,
  };

  try {
    const settings = await getTranslationSettings();
    const inConfig = settings.incoming;
    if (!inConfig || !inConfig.enabled) return noTranslate;

    // Get session for agent info
    const session = await ChatSession.findOne({ sessionId: req.sessionId }).lean() as IChatSession | null;

    // Get assigned agent ID
    const agentId = session?.assignedAgent?.toString();

    // Decision engine (global + agent + session overrides)
    const decision = await getIncomingDecision(req.sessionId, req.channel, agentId, inConfig);
    if (!decision.enabled) return noTranslate;

    // Skip rules
    const skipCheck = shouldSkip(req.content, req.messageType, inConfig);
    if (skipCheck.skip) return noTranslate;

    // Throttle check
    if (isThrottled(req.sessionId, inConfig.throttleMs || 1000)) {
      return noTranslate;
    }

    // Resolve target language
    const targetLang = await resolveTargetLang(inConfig, session, agentId);

    // Redis cache check
    const cached = await getFromRedisCache(req.content, targetLang);
    if (cached) {
      const latencyMs = Date.now() - start;

      // Update message in DB with cached translation
      await Message.updateOne(
        { _id: req.messageId },
        {
          $set: {
            incomingTranslation: {
              translatedContent: cached,
              sourceLang: 'auto',
              targetLang,
              provider: 'redis_cache',
              latencyMs,
              cached: true,
              translatedAt: new Date(),
            },
          },
        },
      );

      if (settings.enableAuditLog) {
        logTranslation({
          sessionId: req.sessionId,
          provider: 'free' as any,
          sourceLang: 'auto',
          targetLang,
          sourceText: req.content.slice(0, 500),
          translatedText: cached.slice(0, 500),
          characterCount: req.content.length,
          cached: true,
          latencyMs,
          direction: 'incoming',
        }).catch(() => {});
      }

      return {
        shouldTranslate: true,
        translatedContent: cached,
        originalContent: req.content,
        sourceLang: 'auto',
        targetLang,
        provider: 'redis_cache',
        latencyMs,
        cached: true,
        showOriginal: decision.showOriginal,
      };
    }

    // Translate via provider chain
    const result: TranslateResult = await translateTextV2({
      text: req.content,
      sourceLang: 'auto',
      targetLang,
      agentId: agentId || '',
      sessionId: req.sessionId,
      direction: 'incoming',
    });

    const translatedContent = result.translatedText;
    const detectedLang = result.detectedLang || 'unknown';

    // Same language check — if detected === target, skip
    if (inConfig.onlyIfDifferent && detectedLang === targetLang) {
      return noTranslate;
    }

    // Cache in Redis
    const cacheTTL = settings.cacheTTLSeconds || DEFAULT_TTL;
    await setRedisCache(req.content, targetLang, translatedContent, cacheTTL);

    const latencyMs = Date.now() - start;

    // Persist to message in DB
    await Message.updateOne(
      { _id: req.messageId },
      {
        $set: {
          incomingTranslation: {
            translatedContent,
            sourceLang: detectedLang,
            targetLang,
            provider: result.provider,
            latencyMs,
            cached: false,
            translatedAt: new Date(),
          },
        },
      },
    );

    // Also store detected language on session if not set
    if (detectedLang && detectedLang !== 'unknown' && detectedLang !== 'auto') {
      await ChatSession.updateOne(
        { sessionId: req.sessionId, detectedUserLang: { $exists: false } },
        { $set: { detectedUserLang: detectedLang } },
      ).catch(() => {});
    }

    // Audit log
    if (settings.enableAuditLog) {
      logTranslation({
        sessionId: req.sessionId,
        provider: result.provider as any,
        sourceLang: detectedLang,
        targetLang,
        sourceText: req.content.slice(0, 500),
        translatedText: translatedContent.slice(0, 500),
        characterCount: req.content.length,
        cached: false,
        latencyMs,
        direction: 'incoming',
      }).catch(() => {});
    }

    return {
      shouldTranslate: true,
      translatedContent,
      originalContent: req.content,
      sourceLang: detectedLang,
      targetLang,
      provider: result.provider,
      latencyMs,
      cached: false,
      showOriginal: decision.showOriginal,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);

    logger.error('translation', {
      type: 'auto_translate_failed',
      chatId: req.sessionId,
      messageId: req.messageId,
      provider: 'chain',
      error,
    });

    return {
      ...noTranslate,
      error,
      latencyMs,
    };
  }
}

// ─── CONFIG GETTER ──────────────────────────────────────────

/**
 * Get incoming translation config for a specific agent + session.
 * Used by frontend to decide whether to show auto-translate UI.
 */
export async function getIncomingConfig(agentId: string, sessionId: string): Promise<IncomingConfig> {
  const settings = await getTranslationSettings();
  const inConfig = settings.incoming || { enabled: false } as IIncomingTranslateConfig;

  let channel: ChannelType = 'web';
  try {
    const session = await ChatSession.findOne({ sessionId }).lean() as IChatSession | null;
    if (session?.channel) channel = session.channel;
  } catch { /* */ }

  const decision = await getIncomingDecision(sessionId, channel, agentId, inConfig);

  return {
    enabled: decision.enabled,
    targetLang: decision.targetLang,
    showOriginal: decision.showOriginal,
    channelScope: inConfig.channelScope || 'all',
    agentOverrideAllowed: inConfig.agentOverrideAllowed ?? true,
  };
}

/**
 * Update per-session incoming translation override.
 */
export async function updateSessionIncomingTranslation(
  sessionId: string,
  override: { incomingEnabled?: boolean; incomingTargetLang?: string },
): Promise<void> {
  const update: Record<string, unknown> = {};
  if (typeof override.incomingEnabled === 'boolean') {
    update['translationOverride.incomingEnabled'] = override.incomingEnabled;
  }
  if (override.incomingTargetLang) {
    update['translationOverride.incomingTargetLang'] = override.incomingTargetLang;
  }
  await ChatSession.updateOne({ sessionId }, { $set: update });
}

/**
 * Translation Service — Multi-provider translation engine
 * Supports: free mode (no API key), DeepL, Google Cloud, Azure Translator
 * Features: language detection, in-memory caching, rate limiting, fallback chain, audit logging, proxy support
 */

import crypto from 'crypto';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import {
  getTranslationSettings,
  SUPPORTED_LANGUAGES,
  type IProviderConfig,
  type ITranslationSettings,
  type IProxyConfig,
} from '../database/models/TranslationSettings.js';
import { logTranslation } from '../database/models/TranslationLog.js';
import type { Types } from 'mongoose';

// Re-export the type from the model so routes & others can import from one place
export type { TranslationProvider } from '../database/models/TranslationSettings.js';
import type { TranslationProvider } from '../database/models/TranslationSettings.js';

// ─── TYPES ──────────────────────────────────────────────────

export interface TranslateRequest {
  text: string;
  sourceLang?: string;  // 'auto' or ISO code
  targetLang: string;   // ISO code
  provider?: TranslationProvider;
  agentId: string;
  sessionId?: string;
  messageId?: string;
  direction?: 'incoming' | 'outgoing' | 'manual';
}

export interface TranslateResult {
  translatedText: string;
  detectedLang?: string;
  provider: TranslationProvider;
  cached: boolean;
  latencyMs: number;
}

export interface DetectResult {
  language: string;
  confidence: number;
}

// Legacy compat types (used by other services that import from here)
export interface TranslationResult {
  success: boolean;
  translatedText?: string;
  sourceLang: string;
  targetLang: string;
  provider: TranslationProvider;
  confidence?: number;
  error?: string;
}

export interface BatchTranslationResult {
  success: boolean;
  translations: Record<string, string>;
  provider: TranslationProvider;
  errors: string[];
}

// ─── TRANSLATION PROVIDER INTERFACE ─────────────────────────

interface ITranslationProviderImpl {
  name: TranslationProvider;
  translate(text: string, sourceLang: string, targetLang: string, config: IProviderConfig, proxy?: IProxyConfig): Promise<{ translated: string; detectedLang?: string }>;
  detectLanguage(text: string, config: IProviderConfig, proxy?: IProxyConfig): Promise<DetectResult>;
}

// ─── IN-MEMORY CACHE ────────────────────────────────────────

const memoryCache = new Map<string, { value: string; detectedLang?: string; expiresAt: number }>();

function getCacheKey(text: string, sourceLang: string, targetLang: string): string {
  const hash = crypto.createHash('md5').update(`${sourceLang}:${targetLang}:${text}`).digest('hex');
  return `tr:${hash}`;
}

function getFromCache(key: string): { value: string; detectedLang?: string } | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return { value: entry.value, detectedLang: entry.detectedLang };
}

function setInCache(key: string, value: string, detectedLang: string | undefined, ttlSeconds: number): void {
  memoryCache.set(key, { value, detectedLang, expiresAt: Date.now() + ttlSeconds * 1000 });
  // Evict old entries when cache grows too large
  if (memoryCache.size > 10000) {
    const now = Date.now();
    for (const [k, v] of memoryCache) {
      if (now > v.expiresAt) memoryCache.delete(k);
    }
  }
}

// ─── RATE LIMITER ───────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(agentId: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(agentId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(agentId, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (entry.count >= maxPerMinute) return false;
  entry.count++;
  return true;
}

// ═══════════════════════════════════════════════════════════
//  PROXY SUPPORT
// ═══════════════════════════════════════════════════════════

/**
 * Build a proxy URL string from proxy config
 */
function buildProxyUrl(proxy: IProxyConfig): string {
  const auth = proxy.username ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password || '')}@` : '';
  const proto = proxy.protocol === 'socks5' ? 'socks5' : proxy.protocol;
  return `${proto}://${auth}${proxy.host}:${proxy.port}`;
}

/**
 * Create the appropriate proxy dispatcher/agent for fetch
 */
function createProxyAgent(proxy: IProxyConfig): HttpProxyAgent<string> | HttpsProxyAgent<string> | SocksProxyAgent {
  const url = buildProxyUrl(proxy);
  const opts = { timeout: proxy.timeoutMs || 10000 };

  switch (proxy.protocol) {
    case 'socks5':
      return new SocksProxyAgent(url, opts);
    case 'https':
      return new HttpsProxyAgent(url, opts);
    case 'http':
    default:
      return new HttpsProxyAgent(url, opts); // HttpsProxyAgent works for HTTP proxies connecting to HTTPS targets
  }
}

/**
 * Get fetch options with proxy agent if enabled + applicable
 */
function getProxyFetchOpts(proxy: IProxyConfig | undefined, providerName: string): { dispatcher?: unknown } {
  if (!proxy?.enabled) return {};
  // If externalOnly and provider is 'free' (internal gtx), skip proxy
  if (proxy.externalOnly && providerName === 'free') return {};

  try {
    const agent = createProxyAgent(proxy);
    return { dispatcher: agent };
  } catch (err) {
    console.warn(`[Translation] Failed to create proxy agent: ${err}`);
    return {};
  }
}

/**
 * Fetch with proxy support + direct fallback
 */
async function proxyFetch(
  url: string,
  init: RequestInit,
  proxy: IProxyConfig | undefined,
  providerName: string,
): Promise<Response> {
  const proxyOpts = getProxyFetchOpts(proxy, providerName);

  if (Object.keys(proxyOpts).length > 0) {
    try {
      const res = await fetch(url, { ...init, ...(proxyOpts as any) });
      return res;
    } catch (err) {
      console.warn(`[Translation] Proxy fetch failed for ${providerName}:`, err);

      // Log proxy error
      proxyErrorLog(providerName, err, proxy);

      if (proxy?.allowDirectFallback) {
        console.info(`[Translation] Falling back to direct connection for ${providerName}`);
        return fetch(url, init);
      }
      throw err;
    }
  }

  return fetch(url, init);
}

/** Structured proxy error log */
function proxyErrorLog(provider: string, err: unknown, proxy?: IProxyConfig) {
  console.error(JSON.stringify({
    type: 'proxy_error',
    provider,
    error: err instanceof Error ? err.message : String(err),
    proxyEnabled: proxy?.enabled ?? false,
    proxyProtocol: proxy?.protocol,
    proxyHost: proxy?.host,
    timestamp: new Date().toISOString(),
  }));
}

/** Cached proxy config (refreshed with settings) */
let _cachedProxy: IProxyConfig | undefined;

/**
 * Test a proxy connection by doing a small request
 */
export async function testProxyConnection(proxy: IProxyConfig): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const agent = createProxyAgent(proxy);
    const res = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=test', {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      ...(({ dispatcher: agent }) as any),
      signal: AbortSignal.timeout(proxy.timeoutMs || 10000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) return { success: false, latencyMs, error: `HTTP ${res.status}` };
    return { success: true, latencyMs };
  } catch (err) {
    return { success: false, latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
  }
}

// ═══════════════════════════════════════════════════════════
//  PROVIDERS
// ═══════════════════════════════════════════════════════════

// ─── FREE PROVIDER (no API key) ─────────────────────────────

const FreeProvider: ITranslationProviderImpl = {
  name: 'free',

  async translate(text, sourceLang, targetLang, _config, proxy) {
    const sl = sourceLang === 'auto' ? 'auto' : sourceLang;
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

    const res = await proxyFetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } }, proxy, 'free');
    if (!res.ok) throw new Error(`Free translation failed: HTTP ${res.status}`);

    const data = await res.json() as unknown[][];
    let translated = '';
    let detectedLang: string | undefined;

    if (Array.isArray(data) && Array.isArray(data[0])) {
      for (const segment of data[0] as unknown[][]) {
        if (Array.isArray(segment) && typeof segment[0] === 'string') {
          translated += segment[0];
        }
      }
    }
    if (Array.isArray(data) && typeof data[2] === 'string') {
      detectedLang = data[2];
    }

    if (!translated) throw new Error('Free translation returned empty result');
    return { translated, detectedLang };
  },

  async detectLanguage(text, _config, proxy) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text.slice(0, 200))}`;
    const res = await proxyFetch(url, { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } }, proxy, 'free');
    if (!res.ok) throw new Error(`Language detection failed: HTTP ${res.status}`);

    const data = await res.json() as unknown[];
    const lang = typeof data[2] === 'string' ? data[2] : 'unknown';
    return { language: lang, confidence: 0.8 };
  },
};

// ─── DEEPL PROVIDER ─────────────────────────────────────────

const DeepLProvider: ITranslationProviderImpl = {
  name: 'deepl',

  async translate(text, sourceLang, targetLang, config, proxy) {
    if (!config.apiKey) throw new Error('DeepL API key not configured');
    const isFree = config.apiKey.endsWith(':fx');
    const baseUrl = isFree ? 'https://api-free.deepl.com/v2' : 'https://api.deepl.com/v2';

    const body: Record<string, unknown> = { text: [text], target_lang: targetLang.toUpperCase() };
    if (sourceLang !== 'auto') body.source_lang = sourceLang.toUpperCase();

    const res = await proxyFetch(`${baseUrl}/translate`, {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, proxy, 'deepl');

    if (!res.ok) { const e = await res.text(); throw new Error(`DeepL error ${res.status}: ${e}`); }

    const data = await res.json() as { translations: { text: string; detected_source_language?: string }[] };
    const first = data.translations?.[0];
    if (!first?.text) throw new Error('DeepL returned empty result');
    return { translated: first.text, detectedLang: first.detected_source_language?.toLowerCase() };
  },

  async detectLanguage(text, config, proxy) {
    const result = await this.translate(text.slice(0, 100), 'auto', 'en', config, proxy);
    return { language: result.detectedLang || 'unknown', confidence: 0.9 };
  },
};

// ─── GOOGLE CLOUD TRANSLATION PROVIDER ──────────────────────

const GoogleProvider: ITranslationProviderImpl = {
  name: 'google',

  async translate(text, sourceLang, targetLang, config, proxy) {
    if (!config.apiKey) throw new Error('Google Cloud Translation API key not configured');

    const body: Record<string, unknown> = { q: text, target: targetLang, format: 'text' };
    if (sourceLang !== 'auto') body.source = sourceLang;

    const res = await proxyFetch(`https://translation.googleapis.com/language/translate/v2?key=${config.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, proxy, 'google');

    if (!res.ok) { const e = await res.text(); throw new Error(`Google Translate error ${res.status}: ${e}`); }

    const data = await res.json() as { data: { translations: { translatedText: string; detectedSourceLanguage?: string }[] } };
    const first = data.data?.translations?.[0];
    if (!first?.translatedText) throw new Error('Google returned empty result');
    return { translated: first.translatedText, detectedLang: first.detectedSourceLanguage?.toLowerCase() };
  },

  async detectLanguage(text, config, proxy) {
    if (!config.apiKey) throw new Error('Google Cloud Translation API key not configured');
    const res = await proxyFetch(`https://translation.googleapis.com/language/translate/v2/detect?key=${config.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text.slice(0, 200) }),
    }, proxy, 'google');
    if (!res.ok) throw new Error(`Google detect failed: HTTP ${res.status}`);

    const data = await res.json() as { data: { detections: { language: string; confidence: number }[][] } };
    const det = data.data?.detections?.[0]?.[0];
    return { language: det?.language || 'unknown', confidence: det?.confidence || 0 };
  },
};

// ─── AZURE TRANSLATOR PROVIDER ──────────────────────────────

const AzureProvider: ITranslationProviderImpl = {
  name: 'azure',

  async translate(text, sourceLang, targetLang, config, proxy) {
    if (!config.apiKey) throw new Error('Azure Translator API key not configured');
    const region = config.region || 'global';
    const endpoint = config.endpoint || 'https://api.cognitive.microsofttranslator.com';

    let url = `${endpoint}/translate?api-version=3.0&to=${targetLang}`;
    if (sourceLang !== 'auto') url += `&from=${sourceLang}`;

    const res = await proxyFetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ Text: text }]),
    }, proxy, 'azure');

    if (!res.ok) { const e = await res.text(); throw new Error(`Azure Translator error ${res.status}: ${e}`); }

    const data = await res.json() as { detectedLanguage?: { language: string }; translations: { text: string }[] }[];
    const first = data?.[0];
    if (!first?.translations?.[0]?.text) throw new Error('Azure returned empty result');
    return { translated: first.translations[0].text, detectedLang: first.detectedLanguage?.language };
  },

  async detectLanguage(text, config, proxy) {
    if (!config.apiKey) throw new Error('Azure Translator API key not configured');
    const region = config.region || 'global';
    const endpoint = config.endpoint || 'https://api.cognitive.microsofttranslator.com';

    const res = await proxyFetch(`${endpoint}/detect?api-version=3.0`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ Text: text.slice(0, 200) }]),
    }, proxy, 'azure');
    if (!res.ok) throw new Error(`Azure detect failed: HTTP ${res.status}`);

    const data = await res.json() as { language: string; score: number }[];
    const first = data?.[0];
    return { language: first?.language || 'unknown', confidence: first?.score || 0 };
  },
};

// ─── PROVIDER REGISTRY ──────────────────────────────────────

const PROVIDERS: Record<TranslationProvider, ITranslationProviderImpl> = {
  free: FreeProvider,
  deepl: DeepLProvider,
  google: GoogleProvider,
  azure: AzureProvider,
};

// ═══════════════════════════════════════════════════════════
//  MAIN SERVICE FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Get the ordered provider chain based on settings and optional override
 */
function getProviderChain(settings: ITranslationSettings, preferredProvider?: TranslationProvider): IProviderConfig[] {
  let providers = settings.providers.filter((p: IProviderConfig) => p.isEnabled);

  if (settings.mode === 'free') {
    providers = providers.filter((p: IProviderConfig) => p.provider === 'free');
    if (providers.length === 0) {
      providers = [{ provider: 'free', isEnabled: true, priority: 0, apiKey: '', region: '', endpoint: '' }];
    }
    return providers;
  }

  providers.sort((a: IProviderConfig, b: IProviderConfig) => a.priority - b.priority);

  if (preferredProvider) {
    const preferred = providers.find((p: IProviderConfig) => p.provider === preferredProvider);
    if (preferred) return [preferred, ...providers.filter((p: IProviderConfig) => p.provider !== preferredProvider)];
  }

  return providers;
}

/**
 * Translate text using the configured provider chain (new API)
 */
export async function translateTextV2(req: TranslateRequest): Promise<TranslateResult> {
  const start = Date.now();
  const settings = await getTranslationSettings();

  if (req.text.length > settings.maxTextLength) {
    throw new Error(`Text exceeds maximum length of ${settings.maxTextLength} characters`);
  }

  if (!checkRateLimit(req.agentId, settings.rateLimitPerMinute)) {
    throw new Error('Translation rate limit exceeded. Please wait a moment.');
  }

  const sourceLang = req.sourceLang || settings.defaultSourceLang || 'auto';
  const targetLang = req.targetLang || settings.defaultTargetLang || 'es';

  // Same language → no-op
  if (sourceLang !== 'auto' && sourceLang === targetLang) {
    return { translatedText: req.text, provider: 'free', cached: false, latencyMs: 0 };
  }

  // Check cache
  const cacheKey = getCacheKey(req.text, sourceLang, targetLang);
  const cached = getFromCache(cacheKey);
  if (cached) {
    const latencyMs = Date.now() - start;
    if (settings.enableAuditLog) {
      logTranslation({
        agentId: req.agentId as unknown as Types.ObjectId,
        sessionId: req.sessionId,
        messageId: req.messageId,
        provider: 'free',
        sourceLang, targetLang,
        sourceText: req.text.slice(0, 500),
        translatedText: cached.value.slice(0, 500),
        characterCount: req.text.length,
        cached: true, latencyMs,
        direction: req.direction || 'manual',
      }).catch(() => {});
    }
    return { translatedText: cached.value, detectedLang: cached.detectedLang, provider: 'free', cached: true, latencyMs };
  }

  // Preserve template variables
  const variables: string[] = [];
  const processedText = req.text.replace(/\{\{([^}]+)\}\}/g, (match) => {
    const placeholder = `__VAR${variables.length}__`;
    variables.push(match);
    return placeholder;
  });

  // Walk the fallback chain
  const chain = getProviderChain(settings, req.provider);
  const proxy = settings.proxy?.enabled ? settings.proxy : undefined;
  _cachedProxy = proxy;
  let lastError: Error | null = null;

  for (const provConfig of chain) {
    const provider = PROVIDERS[provConfig.provider];
    if (!provider) continue;

    try {
      const result = await provider.translate(processedText, sourceLang, targetLang, provConfig, proxy);
      const latencyMs = Date.now() - start;

      // Restore variables
      let translated = result.translated;
      variables.forEach((variable, i) => {
        translated = translated.replace(`__VAR${i}__`, variable);
      });

      setInCache(cacheKey, translated, result.detectedLang, settings.cacheTTLSeconds);

      if (settings.enableAuditLog) {
        logTranslation({
          agentId: req.agentId as unknown as Types.ObjectId,
          sessionId: req.sessionId,
          messageId: req.messageId,
          provider: provConfig.provider,
          sourceLang, targetLang,
          detectedLang: result.detectedLang,
          sourceText: req.text.slice(0, 500),
          translatedText: translated.slice(0, 500),
          characterCount: req.text.length,
          cached: false, latencyMs,
          direction: req.direction || 'manual',
        }).catch(() => {});
      }

      return { translatedText: translated, detectedLang: result.detectedLang, provider: provConfig.provider, cached: false, latencyMs };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Translation] Provider ${provConfig.provider} failed:`, lastError.message);
    }
  }

  throw lastError || new Error('No translation providers available');
}

/**
 * Detect the language of a text
 */
export async function detectLanguage(text: string, _agentId?: string): Promise<DetectResult> {
  const settings = await getTranslationSettings();
  const chain = getProviderChain(settings);
  const proxy = settings.proxy?.enabled ? settings.proxy : undefined;

  for (const provConfig of chain) {
    const provider = PROVIDERS[provConfig.provider];
    if (!provider) continue;
    try {
      return await provider.detectLanguage(text, provConfig, proxy);
    } catch (err) {
      console.warn(`[Translation] Detect failed for ${provConfig.provider}:`, err);
    }
  }

  return { language: 'unknown', confidence: 0 };
}

// ═══════════════════════════════════════════════════════════
//  LEGACY COMPAT (kept so existing callers don't break)
// ═══════════════════════════════════════════════════════════

export function getActiveProvider(): TranslationProvider | null {
  return 'free'; // always available now
}

export function isTranslationAvailable(): boolean {
  return true; // free mode always available
}

/**
 * Legacy translate function — wraps translateTextV2
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  preferredProvider?: TranslationProvider,
): Promise<TranslationResult> {
  if (sourceLang === targetLang) {
    return { success: true, translatedText: text, sourceLang, targetLang, provider: preferredProvider || 'free' };
  }
  try {
    const result = await translateTextV2({
      text,
      sourceLang,
      targetLang,
      provider: preferredProvider,
      agentId: 'system',
      direction: 'manual',
    });
    return { success: true, translatedText: result.translatedText, sourceLang, targetLang, provider: result.provider };
  } catch (err) {
    return { success: false, sourceLang, targetLang, provider: preferredProvider || 'free', error: String(err) };
  }
}

/**
 * Translate to multiple languages
 */
export async function translateToMultipleLanguages(
  text: string,
  sourceLang: string,
  targetLangs: string[],
  preferredProvider?: TranslationProvider,
): Promise<BatchTranslationResult> {
  const provider = preferredProvider || 'free';
  const translations: Record<string, string> = { [sourceLang]: text };
  const errors: string[] = [];

  const results = await Promise.all(
    targetLangs.filter(l => l !== sourceLang).map(async (tl) => {
      const r = await translateText(text, sourceLang, tl, preferredProvider);
      return { tl, r };
    }),
  );

  for (const { tl, r } of results) {
    if (r.success && r.translatedText) translations[tl] = r.translatedText;
    else errors.push(`${tl}: ${r.error}`);
  }

  return { success: errors.length === 0, translations, provider, errors };
}

/**
 * Get supported languages
 */
export async function getSupportedLanguages() {
  return { success: true, languages: SUPPORTED_LANGUAGES.filter(l => l.code !== 'auto') };
}

/**
 * Get provider status
 */
export function getProviderStatus() {
  return {
    available: true,
    activeProvider: 'free' as TranslationProvider,
    providers: { free: true, google: false, deepl: false, azure: false },
  };
}

export { SUPPORTED_LANGUAGES };

/**
 * Translation Settings Model
 * Global configuration for the translation system: providers, API keys, rules, agent prefs
 */

import mongoose, { Schema, type Document } from 'mongoose';
import { TranslationConfigCache } from '../../services/cache.js';

// ─── TYPES ──────────────────────────────────────────────────

export type TranslationProvider = 'free' | 'deepl' | 'google' | 'azure';
export type TranslationMode = 'free' | 'api';

export interface IProviderConfig {
  provider: TranslationProvider;
  apiKey?: string;
  region?: string;       // Azure-specific
  endpoint?: string;     // Custom endpoint
  isEnabled: boolean;
  priority: number;      // fallback chain order (lower = higher priority)
}

export interface ITranslationRule {
  name: string;
  sourceLang: string;    // 'auto' for auto-detect
  targetLang: string;
  isEnabled: boolean;
}

export type ProxyProtocol = 'http' | 'https' | 'socks5';

export interface IProxyConfig {
  enabled: boolean;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  timeoutMs: number;
  externalOnly: boolean;        // only use proxy for external provider calls
  allowDirectFallback: boolean; // if proxy fails, fall back to direct
  lastTestResult?: {
    success: boolean;
    latencyMs: number;
    error?: string;
    testedAt: string;           // ISO date
  };
}

// ─── OUTGOING AUTO-TRANSLATE CONFIG ──────────────────────────

export type OutgoingDeliveryMode = 'translated_only' | 'both';
export type TargetLangStrategy = 'user_detected' | 'custom_field' | 'session_lang' | 'fallback';

export interface IOutgoingTranslateConfig {
  enabled: boolean;
  deliveryMode: OutgoingDeliveryMode; // send only translated or both
  showPreviewBeforeSend: boolean;     // show preview in composer
  targetLangPriority: TargetLangStrategy[]; // ordered priority for target lang resolution
  fallbackLang: string;               // fallback if no lang detected (default: 'en')
  protectPlaceholders: boolean;       // protect {{var}} during translation
  agentOverrideAllowed: boolean;      // allow agents to override per-chat
}

// ─── INCOMING AUTO-TRANSLATE CONFIG ─────────────────────────

export type IncomingTargetLangMode = 'agent_lang' | 'system_lang' | 'custom';
export type IncomingChannelScope = 'all' | 'web_only' | 'telegram_only';

export interface IIncomingTranslateConfig {
  enabled: boolean;
  targetLang: string;              // default language agents see messages in
  targetLangMode: IncomingTargetLangMode; // how to resolve target lang
  showOriginal: boolean;           // show original alongside translation
  onlyIfDifferent: boolean;        // only translate if detected lang ≠ target
  channelScope: IncomingChannelScope; // which channels to auto-translate
  agentOverrideAllowed: boolean;   // allow agents to override per-chat
  skipCommands: boolean;           // skip /start, /help etc.
  skipShortMessages: boolean;      // skip messages < 3 chars
  skipEmojiOnly: boolean;          // skip emoji-only messages
  throttleMs: number;              // min ms between translations per chat (anti-flood)
  maxTranslationsPerMin: number;   // max translations/min per chat (anti-abuse)
  maxCharsPerMessage: number;      // max chars to translate per message
  blockRepetitive: boolean;        // block identical repeated messages
}

export interface ITranslationSettings extends Document {
  mode: TranslationMode;
  defaultSourceLang: string;
  defaultTargetLang: string;
  providers: IProviderConfig[];
  rules: ITranslationRule[];
  proxy: IProxyConfig;
  lockSourceLang: boolean;      // restrict agents from changing source lang
  lockTargetLang: boolean;      // restrict agents from changing target lang
  cacheTTLSeconds: number;
  rateLimitPerMinute: number;
  enableAuditLog: boolean;
  enableAutoDetect: boolean;
  maxTextLength: number;
  // Auto-translate configs
  outgoing: IOutgoingTranslateConfig;
  incoming: IIncomingTranslateConfig;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentTranslateOverride = 'global' | 'always_on' | 'always_off';

export interface IAgentTranslationPrefs {
  preferredTargetLang: string;
  preferredProvider?: TranslationProvider;
  autoTranslateIncoming: boolean;
  showOriginalWithTranslation: boolean;
  // Outgoing auto-translate
  outgoingOverride: AgentTranslateOverride;
  agentWritesIn: string;            // lang the agent normally writes in
  confirmBeforeSend: boolean;       // ask confirmation before sending translated
}

// ─── SCHEMA ─────────────────────────────────────────────────

const ProviderConfigSchema = new Schema<IProviderConfig>({
  provider: { type: String, enum: ['free', 'deepl', 'google', 'azure'], required: true },
  apiKey: { type: String, default: '' },
  region: { type: String, default: '' },
  endpoint: { type: String, default: '' },
  isEnabled: { type: Boolean, default: false },
  priority: { type: Number, default: 0 },
}, { _id: false });

const TranslationRuleSchema = new Schema<ITranslationRule>({
  name: { type: String, required: true },
  sourceLang: { type: String, default: 'auto' },
  targetLang: { type: String, required: true },
  isEnabled: { type: Boolean, default: true },
}, { _id: false });

const ProxyConfigSchema = new Schema({
  enabled: { type: Boolean, default: false },
  protocol: { type: String, enum: ['http', 'https', 'socks5'], default: 'http' },
  host: { type: String, default: '' },
  port: { type: Number, default: 8080 },
  username: { type: String, default: '' },
  password: { type: String, default: '' },
  timeoutMs: { type: Number, default: 10000 },
  externalOnly: { type: Boolean, default: true },
  allowDirectFallback: { type: Boolean, default: true },
  lastTestResult: {
    success: { type: Boolean },
    latencyMs: { type: Number },
    error: { type: String },
    testedAt: { type: String },
  },
}, { _id: false });

const TranslationSettingsSchema = new Schema<ITranslationSettings>({
  mode: { type: String, enum: ['free', 'api'], default: 'free' },
  defaultSourceLang: { type: String, default: 'auto' },
  defaultTargetLang: { type: String, default: 'es' },
  providers: { type: [ProviderConfigSchema], default: () => getDefaultProviders() },
  rules: { type: [TranslationRuleSchema], default: [] },
  proxy: { type: ProxyConfigSchema, default: () => getDefaultProxy() },
  lockSourceLang: { type: Boolean, default: false },
  lockTargetLang: { type: Boolean, default: false },
  cacheTTLSeconds: { type: Number, default: 3600 },     // 1 hour
  rateLimitPerMinute: { type: Number, default: 60 },
  enableAuditLog: { type: Boolean, default: true },
  enableAutoDetect: { type: Boolean, default: true },
  maxTextLength: { type: Number, default: 5000 },
  // Outgoing auto-translate
  outgoing: {
    enabled: { type: Boolean, default: false },
    deliveryMode: { type: String, enum: ['translated_only', 'both'], default: 'translated_only' },
    showPreviewBeforeSend: { type: Boolean, default: true },
    targetLangPriority: { type: [String], default: ['user_detected', 'custom_field', 'session_lang', 'fallback'] },
    fallbackLang: { type: String, default: 'en' },
    protectPlaceholders: { type: Boolean, default: true },
    agentOverrideAllowed: { type: Boolean, default: true },
  },
  // Incoming auto-translate
  incoming: {
    enabled: { type: Boolean, default: false },
    targetLang: { type: String, default: 'es' },
    targetLangMode: { type: String, enum: ['agent_lang', 'system_lang', 'custom'], default: 'system_lang' },
    showOriginal: { type: Boolean, default: true },
    onlyIfDifferent: { type: Boolean, default: true },
    channelScope: { type: String, enum: ['all', 'web_only', 'telegram_only'], default: 'all' },
    agentOverrideAllowed: { type: Boolean, default: true },
    skipCommands: { type: Boolean, default: true },
    skipShortMessages: { type: Boolean, default: true },
    skipEmojiOnly: { type: Boolean, default: true },
    throttleMs: { type: Number, default: 1000 },
    maxTranslationsPerMin: { type: Number, default: 30 },
    maxCharsPerMessage: { type: Number, default: 5000 },
    blockRepetitive: { type: Boolean, default: false },
  },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
}, {
  timestamps: true,
  collection: 'translation_settings',
});

// ─── HELPERS ────────────────────────────────────────────────

function getDefaultProviders(): IProviderConfig[] {
  return [
    { provider: 'free', apiKey: '', region: '', endpoint: '', isEnabled: true, priority: 0 },
    { provider: 'deepl', apiKey: '', region: '', endpoint: '', isEnabled: false, priority: 1 },
    { provider: 'google', apiKey: '', region: '', endpoint: '', isEnabled: false, priority: 2 },
    { provider: 'azure', apiKey: '', region: '', endpoint: '', isEnabled: false, priority: 3 },
  ];
}

function getDefaultProxy(): IProxyConfig {
  return {
    enabled: false,
    protocol: 'http',
    host: '',
    port: 8080,
    username: '',
    password: '',
    timeoutMs: 10000,
    externalOnly: true,
    allowDirectFallback: true,
  };
}

export const TranslationSettings = mongoose.model<ITranslationSettings>('TranslationSettings', TranslationSettingsSchema);

/**
 * Get or create the global translation settings (singleton)
 */
export async function getTranslationSettings(): Promise<ITranslationSettings> {
  const cached = await TranslationConfigCache.get();
  if (cached) return cached;
  let settings = await TranslationSettings.findOne();
  if (!settings) {
    settings = await TranslationSettings.create({
      mode: 'free',
      providers: getDefaultProviders(),
    });
  }
  TranslationConfigCache.set(settings);
  return settings;
}

/**
 * Update settings
 */
export async function updateTranslationSettings(
  data: Partial<ITranslationSettings>,
  agentId: string,
): Promise<ITranslationSettings> {
  let settings = await TranslationSettings.findOne();
  if (!settings) {
    settings = await TranslationSettings.create({
      mode: 'free',
      providers: getDefaultProviders(),
    });
  }
  Object.assign(settings, data, { updatedBy: new mongoose.Types.ObjectId(agentId) });
  await settings.save();
  TranslationConfigCache.set(settings);
  return settings;
}

// ─── SUPPORTED LANGUAGES ────────────────────────────────────

export const SUPPORTED_LANGUAGES = [
  { code: 'auto', name: 'Auto-detectar' },
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'uk', name: 'Українська' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
] as const;

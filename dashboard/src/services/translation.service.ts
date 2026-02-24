/**
 * Translation API Service — Frontend API calls & types
 */

import api from './api';

// ─── TYPES ──────────────────────────────────────────────────

export type TranslationProvider = 'free' | 'deepl' | 'google' | 'azure';
export type TranslationMode = 'free' | 'api';

export interface TranslateResponse {
  ok: boolean;
  translatedText?: string;
  detectedLang?: string;
  provider?: TranslationProvider;
  cached?: boolean;
  latencyMs?: number;
  error?: string;
}

export interface DetectResponse {
  ok: boolean;
  language?: string;
  confidence?: number;
  error?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
}

export interface ProviderConfig {
  provider: TranslationProvider;
  apiKey?: string;
  region?: string;
  endpoint?: string;
  isEnabled: boolean;
  priority: number;
}

export interface TranslationRule {
  name: string;
  sourceLang: string;
  targetLang: string;
  isEnabled: boolean;
}

export type ProxyProtocol = 'http' | 'https' | 'socks5';

export interface ProxyConfig {
  enabled: boolean;
  protocol: ProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
  timeoutMs: number;
  externalOnly: boolean;
  allowDirectFallback: boolean;
  lastTestResult?: {
    success: boolean;
    latencyMs: number;
    error?: string;
    testedAt: string;
  };
}

export interface PublicTranslationSettings {
  mode: TranslationMode;
  defaultSourceLang: string;
  defaultTargetLang: string;
  lockSourceLang: boolean;
  lockTargetLang: boolean;
  enableAutoDetect: boolean;
  proxyEnabled: boolean;
}

export interface TranslationSettings {
  _id?: string;
  mode: TranslationMode;
  defaultSourceLang: string;
  defaultTargetLang: string;
  providers: ProviderConfig[];
  rules: TranslationRule[];
  proxy: ProxyConfig;
  lockSourceLang: boolean;
  lockTargetLang: boolean;
  cacheTTLSeconds: number;
  rateLimitPerMinute: number;
  enableAuditLog: boolean;
  enableAutoDetect: boolean;
  maxTextLength: number;
  // Outgoing auto-translate
  outgoing: OutgoingTranslateConfig;
  incoming: IncomingTranslateConfig;
}

export type OutgoingDeliveryMode = 'translated_only' | 'both';
export type TargetLangStrategy = 'user_detected' | 'custom_field' | 'session_lang' | 'fallback';

export interface OutgoingTranslateConfig {
  enabled: boolean;
  deliveryMode: OutgoingDeliveryMode;
  showPreviewBeforeSend: boolean;
  targetLangPriority: TargetLangStrategy[];
  fallbackLang: string;
  protectPlaceholders: boolean;
  agentOverrideAllowed: boolean;
}

export interface IncomingTranslateConfig {
  enabled: boolean;
  targetLang: string;
  targetLangMode: 'agent_lang' | 'system_lang' | 'custom';
  showOriginal: boolean;
  onlyIfDifferent: boolean;
  channelScope: 'all' | 'web_only' | 'telegram_only';
  agentOverrideAllowed: boolean;
  skipCommands: boolean;
  skipShortMessages: boolean;
  skipEmojiOnly: boolean;
  throttleMs: number;
}

export type AgentTranslateOverride = 'global' | 'always_on' | 'always_off';

export interface OutgoingConfig {
  enabled: boolean;
  confirmBeforeSend: boolean;
  deliveryMode: OutgoingDeliveryMode;
  agentWritesIn: string;
  targetLang: string;
  showPreview: boolean;
  agentOverrideAllowed: boolean;
  agentCanOverride: boolean;
  agentOverride: AgentTranslateOverride;

}

export interface OutgoingPreviewResult {
  ok: boolean;
  shouldTranslate: boolean;
  translatedContent: string;
  originalContent: string;
  deliveryMode: OutgoingDeliveryMode | 'none';
  sourceLang: string;
  targetLang: string;
  provider?: string;
  latencyMs: number;
  cached: boolean;
  error?: string;
}

export interface TranslationLogEntry {
  _id: string;
  agentId: { _id: string; name: string; email: string } | string;
  sessionId?: string;
  messageId?: string;
  provider: TranslationProvider;
  sourceLang: string;
  targetLang: string;
  detectedLang?: string;
  sourceText: string;
  translatedText: string;
  characterCount: number;
  cached: boolean;
  latencyMs: number;
  direction: 'incoming' | 'outgoing' | 'manual';
  createdAt: string;
}

export interface TranslationStats {
  totalTranslations: number;
  totalCharacters: number;
  cachedHits: number;
  avgLatency: number;
  byProvider: { _id: string; count: number; chars: number }[];
  byAgent: { _id: string; agentName: string; count: number; chars: number }[];
}

// ─── API FUNCTIONS ──────────────────────────────────────────

/**
 * Translate text
 */
export async function translateText(
  text: string,
  targetLang: string,
  opts?: {
    sourceLang?: string;
    provider?: TranslationProvider;
    sessionId?: string;
    messageId?: string;
    direction?: 'incoming' | 'outgoing' | 'manual';
  },
): Promise<TranslateResponse> {
  const res = await api.post<TranslateResponse>('/api/translation/translate', {
    text,
    targetLang,
    sourceLang: opts?.sourceLang || 'auto',
    provider: opts?.provider,
    sessionId: opts?.sessionId,
    messageId: opts?.messageId,
    direction: opts?.direction || 'manual',
  });
  return res.data;
}

/**
 * Detect language of text
 */
export async function detectLanguage(text: string): Promise<DetectResponse> {
  const res = await api.post<DetectResponse>('/api/translation/detect', { text });
  return res.data;
}

/**
 * Get supported languages list
 */
export async function getLanguages(): Promise<SupportedLanguage[]> {
  const res = await api.get<{ ok: boolean; languages: SupportedLanguage[] }>('/api/translation/languages');
  return res.data.languages || [];
}

/**
 * Get translation settings
 */
export async function getTranslationSettings(): Promise<TranslationSettings> {
  const res = await api.get<{ ok: boolean; settings: TranslationSettings }>('/api/translation/settings');
  return res.data.settings;
}

/**
 * Update translation settings
 */
export async function updateTranslationSettings(
  settings: Partial<TranslationSettings>,
): Promise<TranslationSettings> {
  const res = await api.put<{ ok: boolean; settings: TranslationSettings }>('/api/translation/settings', settings);
  return res.data.settings;
}

/**
 * Get translation audit logs
 */
export async function getTranslationLogs(opts?: {
  agentId?: string;
  sessionId?: string;
  provider?: string;
  page?: number;
  limit?: number;
}): Promise<{ logs: TranslationLogEntry[]; total: number; page: number; pages: number }> {
  const params = new URLSearchParams();
  if (opts?.agentId) params.set('agentId', opts.agentId);
  if (opts?.sessionId) params.set('sessionId', opts.sessionId);
  if (opts?.provider) params.set('provider', opts.provider);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));

  const qs = params.toString();
  const res = await api.get<{
    ok: boolean;
    logs: TranslationLogEntry[];
    total: number;
    page: number;
    pages: number;
  }>(`/api/translation/logs${qs ? `?${qs}` : ''}`);
  return { logs: res.data.logs, total: res.data.total, page: res.data.page, pages: res.data.pages };
}

/**
 * Get translation usage statistics
 */
export async function getTranslationStats(days?: number): Promise<TranslationStats> {
  const qs = days ? `?days=${days}` : '';
  const res = await api.get<{ ok: boolean; stats: TranslationStats }>(`/api/translation/stats${qs}`);
  return res.data.stats;
}

/**
 * Test proxy connection
 */
export async function testProxy(proxy: Partial<ProxyConfig>): Promise<{ success: boolean; latencyMs: number; error?: string }> {
  const res = await api.post<{ ok: boolean; success: boolean; latencyMs: number; error?: string }>('/api/translation/proxy/test', proxy);
  return { success: res.data.success, latencyMs: res.data.latencyMs, error: res.data.error };
}

/**
 * Get public (non-admin) translation settings for agents
 */
export async function getPublicTranslationSettings(): Promise<PublicTranslationSettings> {
  const res = await api.get<{ ok: boolean } & PublicTranslationSettings>('/api/translation/settings/public');
  return res.data;
}

// ─── OUTGOING AUTO-TRANSLATE ────────────────────────────────

/**
 * Preview an outgoing translation (composer preview)
 */
export async function previewOutgoingTranslation(
  content: string,
  sessionId: string,
): Promise<OutgoingPreviewResult> {
  const res = await api.post<OutgoingPreviewResult>('/api/translation/outgoing/preview', { content, sessionId });
  return res.data;
}

/**
 * Get outgoing config for current agent + session
 */
export async function getOutgoingConfig(sessionId: string): Promise<OutgoingConfig> {
  const res = await api.get<{ ok: boolean } & OutgoingConfig>(`/api/translation/outgoing/config?sessionId=${sessionId}`);
  return res.data;
}

/**
 * Update per-session translation override
 */
export async function updateSessionTranslation(
  sessionId: string,
  override: { outgoingEnabled?: boolean; outgoingTargetLang?: string },
): Promise<void> {
  await api.patch('/api/translation/outgoing/session', { sessionId, ...override });
}

// ─── INCOMING AUTO-TRANSLATE ────────────────────────────────

export interface IncomingConfig {
  enabled: boolean;
  targetLang: string;
  showOriginal: boolean;
  channelScope: 'all' | 'web_only' | 'telegram_only';
  agentOverrideAllowed: boolean;
}

/**
 * Get incoming translation config for current agent + session
 */
export async function getIncomingConfig(sessionId: string): Promise<IncomingConfig> {
  const res = await api.get<{ ok: boolean } & IncomingConfig>(`/api/translation/incoming/config?sessionId=${sessionId}`);
  return res.data;
}

/**
 * Update per-session incoming translation override
 */
export async function updateSessionIncomingTranslation(
  sessionId: string,
  override: { incomingEnabled?: boolean; incomingTargetLang?: string },
): Promise<void> {
  await api.patch('/api/translation/incoming/session', { sessionId, ...override });
}

// ─── TRANSLATION REPORTS ────────────────────────────────────

export type ReportCategory = 'wrong_translation' | 'wrong_language' | 'offensive' | 'incomplete' | 'improvement' | 'bug' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface TranslationReportEntry {
  _id: string;
  messageId: string;
  sessionId: string;
  reportedBy: { _id: string; name: string; email: string; avatar?: string } | string;
  reportedByName: string;
  category: ReportCategory;
  reason: string;
  originalContent: string;
  translatedContent: string;
  sourceLang: string;
  targetLang: string;
  provider: string;
  direction: 'incoming' | 'outgoing';
  latencyMs?: number;
  status: ReportStatus;
  reviewedBy?: { _id: string; name: string; email: string } | string;
  reviewedByName?: string;
  reviewNote?: string;
  reviewedAt?: string;
  reporterBlocked: boolean;
  createdAt: string;
}

export interface ReportStats {
  byStatus: { _id: ReportStatus; count: number }[];
  byCategory: { _id: ReportCategory; count: number }[];
  byProvider: { _id: string; count: number }[];
  topReporters: { _id: string; name: string; count: number }[];
}

export async function submitTranslationReport(data: {
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
}): Promise<{ ok: boolean; report: TranslationReportEntry }> {
  const res = await api.post<{ ok: boolean; report: TranslationReportEntry }>('/api/translation/reports', data);
  return res.data;
}

export async function getTranslationReports(opts?: {
  status?: ReportStatus;
  category?: ReportCategory;
  reportedBy?: string;
  provider?: string;
  page?: number;
  limit?: number;
}): Promise<{ reports: TranslationReportEntry[]; total: number; page: number; pages: number }> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.category) params.set('category', opts.category);
  if (opts?.reportedBy) params.set('reportedBy', opts.reportedBy);
  if (opts?.provider) params.set('provider', opts.provider);
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const res = await api.get<{ ok: boolean; reports: TranslationReportEntry[]; total: number; page: number; pages: number }>(
    `/api/translation/reports${qs ? `?${qs}` : ''}`
  );
  return { reports: res.data.reports, total: res.data.total, page: res.data.page, pages: res.data.pages };
}

export async function updateTranslationReport(
  reportId: string,
  data: { status: ReportStatus; reviewNote?: string },
): Promise<TranslationReportEntry> {
  const res = await api.patch<{ ok: boolean; report: TranslationReportEntry }>(`/api/translation/reports/${reportId}`, data);
  return res.data.report;
}

export async function getReportStats(): Promise<ReportStats> {
  const res = await api.get<{ ok: boolean; stats: ReportStats }>('/api/translation/reports/stats');
  return res.data.stats;
}

export async function blockReporter(agentId: string): Promise<void> {
  await api.post(`/api/translation/reports/block/${agentId}`, { agentId });
}

export async function unblockReporter(agentId: string): Promise<void> {
  await api.post(`/api/translation/reports/unblock/${agentId}`, { agentId });
}

// ─── COST DASHBOARD ─────────────────────────────────────────

export interface CostDashboardData {
  days: number;
  totals: {
    totalRequests: number;
    totalChars: number;
    cachedHits: number;
    avgLatency: number;
    estimatedCost: number;
  };
  dailyUsage: { _id: string; requests: number; characters: number; cached: number }[];
  byProvider: { _id: string; count: number; chars: number; avgLatency: number }[];
  byDirection: { _id: string; count: number; chars: number }[];
  byLangPair: { _id: { source: string; target: string }; count: number; chars: number }[];
  topAgents: { _id: string; agentName: string; count: number; chars: number }[];
}

export async function getCostDashboard(days?: number): Promise<CostDashboardData> {
  const qs = days ? `?days=${days}` : '';
  const res = await api.get<{ ok: boolean } & CostDashboardData>(`/api/translation/cost-dashboard${qs}`);
  return res.data;
}

// ─── QA REVIEW ──────────────────────────────────────────────

export interface QAMessage {
  _id: string;
  sessionId: string;
  sender: string;
  senderAgent?: { _id: string; name: string; email: string; avatar?: string };
  originalContent: string;
  outgoingTranslation?: {
    translatedContent?: string;
    originalAgentContent?: string;
    editedContent?: string;
    sourceLang: string;
    targetLang: string;
    provider: string;
    latencyMs: number;
    wasEdited: boolean;
  };
  incomingTranslation?: {
    translatedContent: string;
    sourceLang: string;
    targetLang: string;
    provider: string;
    latencyMs: number;
    cached: boolean;
  };
  createdAt: string;
}

export async function getQAMessages(opts?: {
  sessionId?: string;
  direction?: 'incoming' | 'outgoing';
  edited?: boolean;
  page?: number;
  limit?: number;
}): Promise<{ messages: QAMessage[]; total: number; page: number; pages: number }> {
  const params = new URLSearchParams();
  if (opts?.sessionId) params.set('sessionId', opts.sessionId);
  if (opts?.direction) params.set('direction', opts.direction);
  if (opts?.edited) params.set('edited', 'true');
  if (opts?.page) params.set('page', String(opts.page));
  if (opts?.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const res = await api.get<{ ok: boolean; messages: QAMessage[]; total: number; page: number; pages: number }>(
    `/api/translation/qa/messages${qs ? `?${qs}` : ''}`
  );
  return { messages: res.data.messages, total: res.data.total, page: res.data.page, pages: res.data.pages };
}

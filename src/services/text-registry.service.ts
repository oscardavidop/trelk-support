/**
 * Text Registry Service
 * High-performance i18n text resolution with multi-layer caching
 * 
 * Architecture:
 * 1. Memory Cache (instant) - Full registry loaded at boot
 * 2. Redis Cache (fast) - Shared across instances
 * 3. MongoDB (persistent) - Source of truth, rarely hit
 */

import { TextRegistry, type ITextRegistry, type ITextUsage } from '../database/index.js';
import { getRedisClient } from './redis.js';
import { logger } from './logger.js';
import { getIO } from './socket.js';

// ============= TYPES =============

export interface TextContext {
  userId?: string;
  userLang?: string;
  flowLang?: string;
  customLang?: string;
  variant?: string;
  variables?: Record<string, string>;
}

export interface ResolvedText {
  key: string;
  text: string;
  lang: string;
  variant?: string;
  source: 'memory' | 'redis' | 'db';
}

export interface TextRegistryEntry {
  key: string;
  defaultLang: string;
  texts: Record<string, string>;
  variants: Record<string, Record<string, string>>;
  category: string;
  description?: string;
  tags: string[];
  isActive: boolean;
  abTest?: {
    enabled: boolean;
    variantA?: string;
    variantB?: string;
    distribution: number;
    startDate?: Date;
    endDate?: Date;
  };
  scheduled?: {
    enabled: boolean;
    activateAt?: Date;
    deactivateAt?: Date;
    fallbackKey?: string;
  };
}

export type SupportedLanguage = 'es' | 'en' | 'pt' | 'fr' | 'de' | 'it' | 'ru' | 'zh' | 'ja' | 'ko' | 'ar';

export const SUPPORTED_LANGUAGES: { code: SupportedLanguage; name: string; flag: string }[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];

// ============= CACHE CONFIG =============

const REDIS_KEY = 'texts:registry';
const REDIS_TTL = 60 * 60; // 1 hour
const DEFAULT_LANG: SupportedLanguage = 'es';

// ============= IN-MEMORY CACHE =============

let memoryRegistry: Map<string, TextRegistryEntry> = new Map();
let memoryCacheTime = 0;
let isInitialized = false;

// ============= INITIALIZATION =============

/**
 * Load entire text registry into memory at boot
 * Should be called once during server startup
 */
export async function initializeTextRegistry(): Promise<void> {
  if (isInitialized) {
    logger.warn('settings-cache', { message: 'Text registry already initialized' });
    return;
  }
  
  try {
    logger.info('settings-cache', { message: 'Initializing text registry...' });
    
    // Try to load from Redis first
    const redis = getRedisClient();
    if (redis) {
      try {
        const cached = await redis.get(REDIS_KEY);
        if (cached) {
          const entries: TextRegistryEntry[] = JSON.parse(cached);
          memoryRegistry = new Map(entries.map(e => [e.key, e]));
          memoryCacheTime = Date.now();
          isInitialized = true;
          logger.info('settings-cache', { 
            message: 'Text registry loaded from Redis', 
            count: memoryRegistry.size 
          });
          return;
        }
      } catch (error) {
        logger.warn('settings-cache', { message: 'Redis text registry load failed', error: String(error) });
      }
    }
    
    // Load from database
    await loadRegistryFromDB();
    isInitialized = true;
    
    logger.info('settings-cache', { 
      message: 'Text registry initialized from DB', 
      count: memoryRegistry.size 
    });
  } catch (error) {
    logger.error('settings-cache', { 
      message: 'Failed to initialize text registry', 
      error: String(error) 
    });
    throw error;
  }
}

/**
 * Load all active texts from database into memory and Redis
 */
async function loadRegistryFromDB(): Promise<void> {
  const texts = await TextRegistry.find({ isActive: true }).lean<ITextRegistry[]>();
  
  memoryRegistry = new Map();
  
  for (const text of texts) {
    const entry: TextRegistryEntry = {
      key: text.key,
      defaultLang: text.defaultLang,
      texts: text.texts instanceof Map 
        ? Object.fromEntries(text.texts) 
        : (text.texts as unknown as Record<string, string>),
      variants: {},
      category: text.category,
      description: text.description,
      tags: text.tags,
      isActive: text.isActive,
      abTest: text.abTest,
      scheduled: text.scheduled,
    };
    
    // Convert variants Map
    if (text.variants instanceof Map) {
      for (const [variantKey, langMap] of text.variants) {
        entry.variants[variantKey] = langMap instanceof Map 
          ? Object.fromEntries(langMap) 
          : (langMap as unknown as Record<string, string>);
      }
    }
    
    memoryRegistry.set(text.key, entry);
  }
  
  memoryCacheTime = Date.now();
  
  // Update Redis cache
  await updateRedisCache();
}

/**
 * Update Redis cache with current memory registry
 */
async function updateRedisCache(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  
  try {
    const entries = Array.from(memoryRegistry.values());
    await redis.setex(REDIS_KEY, REDIS_TTL, JSON.stringify(entries));
  } catch (error) {
    logger.warn('settings-cache', { message: 'Redis text registry update failed', error: String(error) });
  }
}

// ============= TEXT RESOLUTION =============

/**
 * Resolve a text key to its localized content
 * This is the main function used throughout the system
 * 
 * Usage: {{TEXT.WELCOME_MESSAGE}}
 */
export async function resolveText(
  key: string, 
  context?: TextContext
): Promise<ResolvedText | null> {
  const normalizedKey = key.toUpperCase().replace(/^TEXT\./, '');
  
  // Determine language priority
  const langPriority = [
    context?.customLang,
    context?.userLang,
    context?.flowLang,
    DEFAULT_LANG,
  ].filter(Boolean) as string[];
  
  // Try memory cache first
  const entry = memoryRegistry.get(normalizedKey);
  if (entry) {
    const resolved = resolveFromEntry(entry, langPriority, context?.variant);
    if (resolved) {
      let text = resolved.text;
      
      // Replace variables
      if (context?.variables) {
        text = replaceVariables(text, context.variables);
      }
      
      return {
        key: normalizedKey,
        text,
        lang: resolved.lang,
        variant: context?.variant,
        source: 'memory',
      };
    }
  }
  
  // Try to reload from DB (cache miss or stale)
  if (!isInitialized || Date.now() - memoryCacheTime > REDIS_TTL * 1000) {
    await loadRegistryFromDB();
    
    const reloadedEntry = memoryRegistry.get(normalizedKey);
    if (reloadedEntry) {
      const resolved = resolveFromEntry(reloadedEntry, langPriority, context?.variant);
      if (resolved) {
        let text = resolved.text;
        if (context?.variables) {
          text = replaceVariables(text, context.variables);
        }
        return {
          key: normalizedKey,
          text,
          lang: resolved.lang,
          variant: context?.variant,
          source: 'db',
        };
      }
    }
  }
  
  logger.warn('settings-cache', { message: 'Text not found', key: normalizedKey });
  return null;
}

/**
 * Resolve text from a cached entry
 */
function resolveFromEntry(
  entry: TextRegistryEntry,
  langPriority: string[],
  variant?: string
): { text: string; lang: string } | null {
  // Check if scheduled and should be inactive
  if (entry.scheduled?.enabled) {
    const now = new Date();
    if (entry.scheduled.activateAt && now < entry.scheduled.activateAt) {
      return null; // Not yet active
    }
    if (entry.scheduled.deactivateAt && now > entry.scheduled.deactivateAt) {
      return null; // Expired
    }
  }
  
  // Check variant first
  if (variant && entry.variants[variant]) {
    const variantTexts = entry.variants[variant];
    for (const lang of langPriority) {
      if (variantTexts[lang]) {
        return { text: variantTexts[lang], lang };
      }
    }
    // Variant fallback to default lang
    if (variantTexts[entry.defaultLang]) {
      return { text: variantTexts[entry.defaultLang], lang: entry.defaultLang };
    }
  }
  
  // Handle A/B testing
  if (entry.abTest?.enabled) {
    const now = new Date();
    const inTestPeriod = (!entry.abTest.startDate || now >= entry.abTest.startDate) &&
                         (!entry.abTest.endDate || now <= entry.abTest.endDate);
    
    if (inTestPeriod) {
      const random = Math.random() * 100;
      const selectedText = random < entry.abTest.distribution 
        ? entry.abTest.variantA 
        : entry.abTest.variantB;
      
      if (selectedText) {
        return { text: selectedText, lang: entry.defaultLang };
      }
    }
  }
  
  // Check main texts by language priority
  for (const lang of langPriority) {
    if (entry.texts[lang]) {
      return { text: entry.texts[lang], lang };
    }
  }
  
  // Fallback to default language
  if (entry.texts[entry.defaultLang]) {
    return { text: entry.texts[entry.defaultLang], lang: entry.defaultLang };
  }
  
  // Last resort: first available
  const firstLang = Object.keys(entry.texts)[0];
  if (firstLang) {
    return { text: entry.texts[firstLang], lang: firstLang };
  }
  
  return null;
}

/**
 * Replace variables in text
 * Supports: {{user.firstName}}, {{agent.name}}, {{custom.field}}
 */
function replaceVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const value = variables[key.trim()];
    return value !== undefined ? value : match;
  });
}

/**
 * Get text synchronously (for performance-critical paths)
 * Returns null if not in cache - use resolveText for guaranteed resolution
 */
export function getTextSync(key: string, lang?: string, variant?: string): string | null {
  const normalizedKey = key.toUpperCase().replace(/^TEXT\./, '');
  const entry = memoryRegistry.get(normalizedKey);
  
  if (!entry) return null;
  
  const resolved = resolveFromEntry(entry, lang ? [lang, DEFAULT_LANG] : [DEFAULT_LANG], variant);
  return resolved?.text ?? null;
}

/**
 * Batch resolve multiple texts
 */
export async function resolveTexts(
  keys: string[],
  context?: TextContext
): Promise<Map<string, ResolvedText | null>> {
  const results = new Map<string, ResolvedText | null>();
  
  // Use Promise.all for parallel resolution
  const resolutions = await Promise.all(
    keys.map(key => resolveText(key, context))
  );
  
  keys.forEach((key, index) => {
    results.set(key, resolutions[index]);
  });
  
  return results;
}

// ============= TEXT CRUD =============

/**
 * Create a new text entry
 */
export async function createText(data: {
  key: string;
  defaultLang: SupportedLanguage;
  texts: Record<string, string>;
  description?: string;
  category?: string;
  tags?: string[];
  createdBy: string;
}): Promise<ITextRegistry> {
  const text = await TextRegistry.create({
    key: data.key.toUpperCase(),
    defaultLang: data.defaultLang,
    texts: new Map(Object.entries(data.texts)),
    description: data.description,
    category: data.category || 'custom',
    tags: data.tags || [],
    createdBy: data.createdBy,
    currentVersion: 1,
    versions: [{
      version: 1,
      texts: new Map(Object.entries(data.texts)),
      createdAt: new Date(),
      createdBy: data.createdBy,
      changeNote: 'Initial creation',
    }],
  });
  
  // Update caches
  await invalidateAndReload();
  
  logger.info('settings-cache', { 
    action: 'text_created', 
    key: text.key, 
    createdBy: data.createdBy 
  });
  
  broadcastTextUpdate('created', text.key);
  
  return text;
}

/**
 * Update an existing text
 */
export async function updateText(
  key: string,
  data: {
    texts?: Record<string, string>;
    description?: string;
    category?: string;
    tags?: string[];
    defaultLang?: SupportedLanguage;
    abTest?: {
      enabled: boolean;
      variantA?: string;
      variantB?: string;
      distribution?: number;
      startDate?: Date;
      endDate?: Date;
    };
    scheduled?: {
      enabled: boolean;
      activateAt?: Date;
      deactivateAt?: Date;
    };
    updatedBy: string;
    changeNote?: string;
  }
): Promise<ITextRegistry | null> {
  const text = await TextRegistry.findOne({ key: key.toUpperCase() });
  if (!text) return null;
  
  // Create version backup
  text.versions.push({
    version: text.currentVersion,
    texts: new Map(text.texts),
    createdAt: new Date(),
    createdBy: data.updatedBy,
    changeNote: data.changeNote || 'Update',
  });
  text.currentVersion += 1;
  
  // Keep only last 10 versions
  if (text.versions.length > 10) {
    text.versions = text.versions.slice(-10);
  }
  
  // Apply updates
  if (data.texts) {
    text.texts = new Map(Object.entries(data.texts));
  }
  if (data.description !== undefined) text.description = data.description;
  if (data.category) text.category = data.category as ITextRegistry['category'];
  if (data.tags) text.tags = data.tags;
  if (data.defaultLang) text.defaultLang = data.defaultLang;
  if (data.abTest) {
    text.abTest = {
      enabled: data.abTest.enabled,
      variantA: data.abTest.variantA ?? text.abTest?.variantA ?? '',
      variantB: data.abTest.variantB ?? text.abTest?.variantB ?? '',
      distribution: data.abTest.distribution ?? text.abTest?.distribution ?? 50,
      startDate: data.abTest.startDate ?? text.abTest?.startDate,
      endDate: data.abTest.endDate ?? text.abTest?.endDate,
    };
  }
  if (data.scheduled) text.scheduled = { ...text.scheduled, ...data.scheduled };
  
  text.updatedBy = data.updatedBy;
  
  await text.save();
  
  // Update caches
  await invalidateAndReload();
  
  logger.info('settings-cache', { 
    action: 'text_updated', 
    key: text.key, 
    updatedBy: data.updatedBy 
  });
  
  broadcastTextUpdate('updated', text.key);
  
  return text;
}

/**
 * Update a specific language translation
 */
export async function updateTextLanguage(
  key: string,
  lang: SupportedLanguage,
  text: string,
  source: 'manual' | 'google' | 'azure' | 'ai',
  updatedBy: string
): Promise<ITextRegistry | null> {
  const textDoc = await TextRegistry.findOne({ key: key.toUpperCase() });
  if (!textDoc) return null;
  
  // Update the specific language
  textDoc.texts.set(lang, text);
  
  // Track translation
  textDoc.translations.push({
    lang,
    text,
    source,
    translatedAt: new Date(),
    translatedBy: updatedBy,
  });
  
  textDoc.updatedBy = updatedBy;
  
  await textDoc.save();
  
  // Update caches
  await invalidateAndReload();
  
  logger.info('settings-cache', { 
    action: 'text_language_updated', 
    key: textDoc.key, 
    lang,
    source,
    updatedBy 
  });
  
  broadcastTextUpdate('updated', textDoc.key);
  
  return textDoc;
}

/**
 * Delete a text entry
 */
export async function deleteText(key: string, deletedBy: string): Promise<boolean> {
  const text = await TextRegistry.findOne({ key: key.toUpperCase() });
  if (!text) return false;
  
  // Check if locked (used in active flows)
  if (text.isLocked && text.usedIn.length > 0) {
    logger.warn('settings-cache', { 
      message: 'Cannot delete locked text', 
      key: text.key,
      usedIn: text.usedIn.length 
    });
    return false;
  }
  
  await TextRegistry.deleteOne({ key: key.toUpperCase() });
  
  // Update caches
  await invalidateAndReload();
  
  logger.info('settings-cache', { 
    action: 'text_deleted', 
    key: text.key, 
    deletedBy 
  });
  
  broadcastTextUpdate('deleted', key);
  
  return true;
}

/**
 * Delete a specific language from a text
 */
export async function deleteTextLanguage(
  key: string,
  lang: SupportedLanguage,
  deletedBy: string
): Promise<ITextRegistry | null> {
  const text = await TextRegistry.findOne({ key: key.toUpperCase() });
  if (!text) return null;
  
  // Cannot delete default language if it's the only one
  if (text.defaultLang === lang && text.texts.size === 1) {
    return null;
  }
  
  text.texts.delete(lang);
  
  // If we deleted the default lang, set a new one
  if (text.defaultLang === lang) {
    const firstLang = text.texts.keys().next().value;
    if (firstLang) {
      text.defaultLang = firstLang;
    }
  }
  
  text.updatedBy = deletedBy;
  await text.save();
  
  // Update caches
  await invalidateAndReload();
  
  logger.info('settings-cache', { 
    action: 'text_language_deleted', 
    key: text.key, 
    lang,
    deletedBy 
  });
  
  broadcastTextUpdate('updated', key);
  
  return text;
}

// ============= QUERY FUNCTIONS =============

/**
 * Get all texts (for admin panel)
 */
export async function getAllTexts(options?: {
  category?: string;
  search?: string;
  lang?: string;
  limit?: number;
  skip?: number;
}): Promise<{ texts: ITextRegistry[]; total: number }> {
  const filter: Record<string, unknown> = { isActive: true };
  
  if (options?.category) {
    filter.category = options.category;
  }
  
  if (options?.search) {
    filter.$or = [
      { key: { $regex: options.search, $options: 'i' } },
      { description: { $regex: options.search, $options: 'i' } },
      { tags: { $in: [new RegExp(options.search, 'i')] } },
    ];
  }
  
  const [texts, total] = await Promise.all([
    TextRegistry.find(filter)
      .sort({ key: 1 })
      .skip(options?.skip || 0)
      .limit(options?.limit || 100)
      .lean<ITextRegistry[]>(),
    TextRegistry.countDocuments(filter),
  ]);
  
  return { texts, total };
}

/**
 * Get a single text by key
 */
export async function getTextByKey(key: string): Promise<ITextRegistry | null> {
  return TextRegistry.findOne({ key: key.toUpperCase() }).lean<ITextRegistry>();
}

/**
 * Get texts used in a specific flow
 */
export async function getTextsUsedInFlow(flowId: string): Promise<ITextRegistry[]> {
  return TextRegistry.find({ 'usedIn.flowId': flowId, isActive: true }).lean<ITextRegistry[]>();
}

/**
 * Get all available text keys (for autocomplete)
 */
export function getTextKeys(): string[] {
  return Array.from(memoryRegistry.keys());
}

/**
 * Get text preview with all languages
 */
export async function getTextPreview(key: string): Promise<{
  key: string;
  languages: { lang: string; text: string; flag: string }[];
} | null> {
  const entry = memoryRegistry.get(key.toUpperCase());
  if (!entry) return null;
  
  const languages = SUPPORTED_LANGUAGES
    .filter(l => entry.texts[l.code])
    .map(l => ({
      lang: l.code,
      text: entry.texts[l.code],
      flag: l.flag,
    }));
  
  return { key: entry.key, languages };
}

// ============= FLOW INTEGRATION =============

/**
 * Register text usage in a flow
 */
export async function registerTextUsage(
  key: string,
  usage: ITextUsage
): Promise<void> {
  await TextRegistry.updateOne(
    { key: key.toUpperCase() },
    {
      $addToSet: { usedIn: usage },
      $inc: { usageCount: 1 },
      $set: { isLocked: true },
    }
  );
  
  // Update memory cache
  const entry = memoryRegistry.get(key.toUpperCase());
  if (entry) {
    entry.isActive = true; // Lock the entry
  }
}

/**
 * Unregister text usage from a flow
 */
export async function unregisterTextUsage(
  key: string,
  flowId: string
): Promise<void> {
  const text = await TextRegistry.findOneAndUpdate(
    { key: key.toUpperCase() },
    {
      $pull: { usedIn: { flowId } },
    },
    { new: true }
  );
  
  if (text && text.usedIn.length === 0) {
    text.isLocked = false;
    await text.save();
  }
}

/**
 * Validate that all texts used in a flow exist
 */
export function validateFlowTexts(textKeys: string[]): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  
  for (const key of textKeys) {
    const normalizedKey = key.toUpperCase().replace(/^TEXT\./, '');
    const entry = memoryRegistry.get(normalizedKey);
    
    if (!entry) {
      missing.push(normalizedKey);
    } else {
      // Check if missing critical languages
      if (!entry.texts[entry.defaultLang]) {
        warnings.push(`${normalizedKey}: Missing default language (${entry.defaultLang})`);
      }
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

// ============= VARIANT MANAGEMENT =============

/**
 * Add or update a context variant
 */
export async function setTextVariant(
  key: string,
  variantName: string,
  texts: Record<string, string>,
  updatedBy: string
): Promise<ITextRegistry | null> {
  const textDoc = await TextRegistry.findOne({ key: key.toUpperCase() });
  if (!textDoc) return null;
  
  textDoc.variants.set(variantName, new Map(Object.entries(texts)));
  textDoc.updatedBy = updatedBy;
  
  await textDoc.save();
  await invalidateAndReload();
  
  broadcastTextUpdate('updated', key);
  
  return textDoc;
}

/**
 * Remove a context variant
 */
export async function removeTextVariant(
  key: string,
  variantName: string,
  deletedBy: string
): Promise<ITextRegistry | null> {
  const textDoc = await TextRegistry.findOne({ key: key.toUpperCase() });
  if (!textDoc) return null;
  
  textDoc.variants.delete(variantName);
  textDoc.updatedBy = deletedBy;
  
  await textDoc.save();
  await invalidateAndReload();
  
  broadcastTextUpdate('updated', key);
  
  return textDoc;
}

// ============= CACHE MANAGEMENT =============

/**
 * Invalidate caches and reload from database
 */
export async function invalidateAndReload(): Promise<void> {
  // Clear Redis
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(REDIS_KEY);
    } catch (error) {
      logger.warn('settings-cache', { message: 'Redis text cache delete failed', error: String(error) });
    }
  }
  
  // Reload from DB
  await loadRegistryFromDB();
}

/**
 * Force reload from database (admin action)
 */
export async function forceReloadRegistry(): Promise<number> {
  await loadRegistryFromDB();
  return memoryRegistry.size;
}

/**
 * Get cache stats
 */
export function getCacheStats(): {
  totalEntries: number;
  memoryCacheAge: number;
  isInitialized: boolean;
} {
  return {
    totalEntries: memoryRegistry.size,
    memoryCacheAge: Date.now() - memoryCacheTime,
    isInitialized,
  };
}

// ============= EVENTS =============

/**
 * Broadcast text update event to all connected clients
 */
function broadcastTextUpdate(action: 'created' | 'updated' | 'deleted', key: string): void {
  const io = getIO();
  if (!io) return;
  
  io.emit('texts:updated', {
    action,
    key,
    timestamp: new Date().toISOString(),
  });
}

// ============= IMPORT/EXPORT =============

/**
 * Export all texts as JSON
 */
export async function exportTextsAsJSON(): Promise<string> {
  const texts = await TextRegistry.find({ isActive: true }).lean<ITextRegistry[]>();
  
  const exportData: Record<string, {
    defaultLang: string;
    texts: Record<string, string>;
    description?: string;
    category: string;
    tags: string[];
    updatedAt: string;
  }> = {};
  
  for (const text of texts) {
    exportData[text.key] = {
      defaultLang: text.defaultLang,
      texts: text.texts instanceof Map 
        ? Object.fromEntries(text.texts) 
        : (text.texts as unknown as Record<string, string>),
      description: text.description,
      category: text.category,
      tags: text.tags,
      updatedAt: text.updatedAt.toISOString(),
    };
  }
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Import texts from JSON
 */
export async function importTextsFromJSON(
  jsonData: string,
  importedBy: string,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ imported: number; updated: number; errors: string[] }> {
  const data = JSON.parse(jsonData);
  let imported = 0;
  let updated = 0;
  const errors: string[] = [];
  
  if (mode === 'replace') {
    await TextRegistry.deleteMany({});
    memoryRegistry.clear();
  }
  
  for (const [key, value] of Object.entries(data)) {
    try {
      const textData = value as {
        defaultLang: string;
        texts: Record<string, string>;
        description?: string;
        category?: string;
        tags?: string[];
      };
      
      const existing = await TextRegistry.findOne({ key: key.toUpperCase() });
      
      if (existing) {
        existing.texts = new Map(Object.entries(textData.texts));
        existing.defaultLang = textData.defaultLang;
        if (textData.description) existing.description = textData.description;
        if (textData.category) existing.category = textData.category as ITextRegistry['category'];
        if (textData.tags) existing.tags = textData.tags;
        existing.updatedBy = importedBy;
        await existing.save();
        updated++;
      } else {
        await TextRegistry.create({
          key: key.toUpperCase(),
          defaultLang: textData.defaultLang,
          texts: new Map(Object.entries(textData.texts)),
          description: textData.description,
          category: textData.category || 'custom',
          tags: textData.tags || [],
          createdBy: importedBy,
          currentVersion: 1,
        });
        imported++;
      }
    } catch (error) {
      errors.push(`${key}: ${String(error)}`);
    }
  }
  
  // Reload cache
  await invalidateAndReload();
  
  logger.info('settings-cache', { 
    action: 'texts_imported', 
    imported, 
    updated, 
    errors: errors.length,
    importedBy 
  });
  
  return { imported, updated, errors };
}

// ============= SEED DEFAULT TEXTS =============

/**
 * Seed default system texts if none exist
 */
export async function seedDefaultTexts(createdBy: string = 'system'): Promise<void> {
  const count = await TextRegistry.countDocuments();
  if (count > 0) return;
  
  const defaultTexts = [
    {
      key: 'WELCOME_MESSAGE',
      defaultLang: 'es' as SupportedLanguage,
      texts: {
        es: '¡Hola {{user.firstName}}! 👋 Bienvenido a nuestro soporte.',
        en: 'Hello {{user.firstName}}! 👋 Welcome to our support.',
        pt: 'Olá {{user.firstName}}! 👋 Bem-vindo ao nosso suporte.',
      },
      description: 'Mensaje de bienvenida inicial',
      category: 'welcome',
    },
    {
      key: 'OFFLINE_MESSAGE',
      defaultLang: 'es' as SupportedLanguage,
      texts: {
        es: 'Lo sentimos, nuestro equipo no está disponible en este momento. Te responderemos pronto.',
        en: 'Sorry, our team is not available right now. We will get back to you soon.',
        pt: 'Desculpe, nossa equipe não está disponível no momento. Entraremos em contato em breve.',
      },
      description: 'Mensaje cuando no hay agentes disponibles',
      category: 'notification',
    },
    {
      key: 'TRANSFER_MESSAGE',
      defaultLang: 'es' as SupportedLanguage,
      texts: {
        es: 'Te estamos transfiriendo con uno de nuestros agentes. Por favor espera un momento.',
        en: 'We are transferring you to one of our agents. Please wait a moment.',
        pt: 'Estamos transferindo você para um de nossos agentes. Por favor, aguarde um momento.',
      },
      description: 'Mensaje al transferir a un agente humano',
      category: 'notification',
    },
    {
      key: 'CHAT_CLOSED',
      defaultLang: 'es' as SupportedLanguage,
      texts: {
        es: 'El chat ha sido cerrado. ¡Gracias por contactarnos!',
        en: 'The chat has been closed. Thank you for contacting us!',
        pt: 'O chat foi encerrado. Obrigado por entrar em contato!',
      },
      description: 'Mensaje cuando se cierra el chat',
      category: 'farewell',
    },
    {
      key: 'FOLLOW_UP_24H',
      defaultLang: 'es' as SupportedLanguage,
      texts: {
        es: '¡Hola de nuevo! ¿Pudimos resolver tu consulta? Estamos aquí si necesitas algo más.',
        en: 'Hello again! Were we able to resolve your inquiry? We are here if you need anything else.',
        pt: 'Olá novamente! Conseguimos resolver sua consulta? Estamos aqui se precisar de mais alguma coisa.',
      },
      description: 'Mensaje de seguimiento 24h después',
      category: 'follow-up',
    },
    {
      key: 'SURVEY_REQUEST',
      defaultLang: 'es' as SupportedLanguage,
      texts: {
        es: '¿Cómo calificarías tu experiencia con nosotros hoy?',
        en: 'How would you rate your experience with us today?',
        pt: 'Como você avaliaria sua experiência conosco hoje?',
      },
      description: 'Solicitud de encuesta de satisfacción',
      category: 'notification',
    },
    {
      key: 'QUEUE_POSITION',
      defaultLang: 'es' as SupportedLanguage,
      texts: {
        es: 'Estás en la posición {{queue.position}} de la cola. Tiempo estimado: {{queue.waitTime}} minutos.',
        en: 'You are in position {{queue.position}} in the queue. Estimated time: {{queue.waitTime}} minutes.',
        pt: 'Você está na posição {{queue.position}} da fila. Tempo estimado: {{queue.waitTime}} minutos.',
      },
      description: 'Mensaje de posición en cola',
      category: 'notification',
    },
    {
      key: 'AGENT_ASSIGNED',
      defaultLang: 'es' as SupportedLanguage,
      texts: {
        es: '{{agent.name}} se ha unido al chat y te atenderá. 🙂',
        en: '{{agent.name}} has joined the chat and will assist you. 🙂',
        pt: '{{agent.name}} entrou no chat e irá atendê-lo. 🙂',
      },
      description: 'Mensaje cuando un agente acepta el chat',
      category: 'notification',
    },
  ];
  
  for (const text of defaultTexts) {
    await createText({
      ...text,
      createdBy,
    });
  }
  
  logger.info('settings-cache', { 
    action: 'default_texts_seeded', 
    count: defaultTexts.length 
  });
}

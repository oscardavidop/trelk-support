/**
 * Text Registry API Service
 * Client-side API calls for i18n text management
 */

import { api } from './api';

// ============= TYPES =============

export interface TextTranslation {
    lang: string;
    text: string;
    source: 'manual' | 'google' | 'azure' | 'ai';
    translatedAt: string;
    translatedBy?: string;
}

export interface TextVersion {
    version: number;
    texts: Record<string, string>;
    createdAt: string;
    createdBy: string;
    changeNote?: string;
}

export interface TextUsage {
    flowId: string;
    flowName: string;
    nodeId: string;
    nodeType: string;
}

export interface TextEntry {
    _id: string;
    key: string;
    defaultLang: string;
    texts: Record<string, string>;
    variants: Record<string, Record<string, string>>;
    description?: string;
    category: TextCategory;
    tags: string[];
    translations: TextTranslation[];
    versions: TextVersion[];
    currentVersion: number;
    usedIn: TextUsage[];
    usageCount: number;
    abTest?: {
        enabled: boolean;
        variantA: string;
        variantB: string;
        distribution: number;
        startDate?: string;
        endDate?: string;
    };
    scheduled?: {
        enabled: boolean;
        activateAt?: string;
        deactivateAt?: string;
        fallbackKey?: string;
    };
    createdBy: string;
    updatedBy?: string;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
    isLocked: boolean;
}

export type TextCategory =
    | 'welcome'
    | 'farewell'
    | 'follow-up'
    | 'notification'
    | 'error'
    | 'menu'
    | 'button'
    | 'system'
    | 'custom';

export interface SupportedLanguage {
    code: string;
    name: string;
    flag: string;
}

export interface CategoryInfo {
    value: TextCategory;
    label: string;
    icon: string;
}

export interface TranslationResult {
    success: boolean;
    translatedText?: string;
    sourceLang: string;
    targetLang: string;
    provider: 'google' | 'azure' | 'ai';
    error?: string;
}

export interface TranslationStatus {
    available: boolean;
    activeProvider: 'google' | 'azure' | null;
    providers: {
        google: boolean;
        azure: boolean;
    };
}

export interface TextStats {
    totalEntries: number;
    memoryCacheAge: number;
    isInitialized: boolean;
    translation: TranslationStatus;
}

// ============= API FUNCTIONS =============

/**
 * Get all texts with optional filtering
 */
export async function getTexts(options?: {
    category?: string;
    search?: string;
    lang?: string;
    limit?: number;
    skip?: number;
}): Promise<{
    data: TextEntry[];
    total: number;
    languages: SupportedLanguage[];
}> {
    const params = new URLSearchParams();
    if (options?.category) params.append('category', options.category);
    if (options?.search) params.append('search', options.search);
    if (options?.lang) params.append('lang', options.lang);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.skip) params.append('skip', options.skip.toString());

    const queryString = params.toString();
    const url = `/api/admin/texts${queryString ? `?${queryString}` : ''}`;

    const response = await api.get<{ success: boolean; data: TextEntry[]; total: number; languages: SupportedLanguage[]; error?: string }>(url);
    if (!response.ok || !response.data.success) {
        throw new Error(response.data.error || 'Error al cargar textos');
    }
    return { data: response.data.data, total: response.data.total, languages: response.data.languages };
}

/**
 * Get a single text by key
 */
export async function getTextByKey(key: string): Promise<TextEntry> {
    const response = await api.get<{ data: TextEntry }>(`/api/admin/texts/${key}`);
    return response.data.data;
}

/**
 * Get all text keys for autocomplete
 */
export async function getTextKeys(): Promise<string[]> {
    const response = await api.get<{ keys: string[] }>('/api/admin/texts/keys');
    return response.data.keys;
}

/**
 * Get available categories
 */
export async function getCategories(): Promise<CategoryInfo[]> {
    const response = await api.get<{ categories: CategoryInfo[] }>('/api/admin/texts/categories');
    return response.data.categories;
}

/**
 * Get supported languages
 */
export async function getLanguages(): Promise<SupportedLanguage[]> {
    const response = await api.get<{ languages: SupportedLanguage[] }>('/api/admin/texts/languages');
    return response.data.languages;
}

/**
 * Get cache and translation stats
 */
export async function getTextStats(): Promise<TextStats> {
    const response = await api.get<{ stats: TextStats }>('/api/admin/texts/stats');
    return response.data.stats;
}

/**
 * Get text preview with all languages
 */
export async function getTextPreview(key: string): Promise<{
    key: string;
    languages: { lang: string; text: string; flag: string }[];
}> {
    const response = await api.get<{ data: { key: string; languages: { lang: string; text: string; flag: string }[] } }>(`/api/admin/texts/${key}/preview`);
    return response.data.data;
}

/**
 * Create a new text
 */
export async function createText(data: {
    key: string;
    defaultLang: string;
    texts: Record<string, string>;
    description?: string;
    category?: TextCategory;
    tags?: string[];
}): Promise<TextEntry> {
    const response = await api.post<{ success: boolean; data: TextEntry; error?: string }>('/api/admin/texts', data);
    if (!response.ok || !response.data.success) {
        throw new Error(response.data.error || 'Error al crear texto');
    }
    return response.data.data;
}

/**
 * Update an existing text
 */
export async function updateText(
    key: string,
    data: {
        texts?: Record<string, string>;
        description?: string;
        category?: TextCategory;
        tags?: string[];
        defaultLang?: string;
        abTest?: {
            enabled: boolean;
            variantA?: string;
            variantB?: string;
            distribution?: number;
        };
        scheduled?: {
            enabled: boolean;
            activateAt?: string;
            deactivateAt?: string;
        };
        changeNote?: string;
    }
): Promise<TextEntry> {
    const response = await api.put<{ success: boolean; data: TextEntry; error?: string }>(`/api/admin/texts/${key}`, data);
    if (!response.ok || !response.data.success) {
        throw new Error(response.data.error || 'Error al actualizar texto');
    }
    return response.data.data;
}

/**
 * Update a specific language translation
 */
export async function updateTextLanguage(
    key: string,
    lang: string,
    text: string,
    source: 'manual' | 'google' | 'azure' | 'ai' = 'manual'
): Promise<TextEntry> {
    const response = await api.put<{ success: boolean; data: TextEntry; error?: string }>(`/api/admin/texts/${key}/language/${lang}`, { text, source });
    if (!response.ok || !response.data.success) {
        throw new Error(response.data.error || 'Error al actualizar idioma');
    }
    return response.data.data;
}

/**
 * Delete a text
 */
export async function deleteText(key: string): Promise<void> {
    const response = await api.delete<{ success: boolean; error?: string }>(`/api/admin/texts/${key}`, { data: {} });
    if (!response.ok || !response.data.success) {
        throw new Error(response.data.error || 'Error al eliminar texto');
    }
}

/**
 * Delete a specific language from a text
 */
export async function deleteTextLanguage(key: string, lang: string): Promise<TextEntry> {
    const response = await api.delete<{ data: TextEntry }>(`/api/admin/texts/${key}/language/${lang}`, { data: {} });
    return response.data.data;
}

/**
 * Translate text to a target language
 */
export async function translateText(
    text: string,
    sourceLang: string,
    targetLang: string,
    provider?: 'google' | 'azure'
): Promise<TranslationResult> {
    const response = await api.post<{ data: TranslationResult }>('/api/admin/texts/translate', {
        text,
        sourceLang,
        targetLang,
        provider,
    });
    return response.data.data;
}

/**
 * Translate text to multiple languages
 */
export async function translateToMultipleLanguages(
    text: string,
    sourceLang: string,
    targetLangs: string[],
    provider?: 'google' | 'azure'
): Promise<{
    translations: Record<string, string>;
    errors: string[];
}> {
    const response = await api.post<{ data: { translations: Record<string, string>; errors: string[] } }>('/api/admin/texts/translate-all', {
        text,
        sourceLang,
        targetLangs,
        provider,
    });
    return response.data.data;
}

/**
 * Translate and save a text to a new language
 */
export async function translateAndSave(
    key: string,
    targetLang: string,
    sourceLang?: string,
    provider?: 'google' | 'azure'
): Promise<{
    translatedText: string;
    provider: string;
    saved: boolean;
}> {
    const response = await api.post<{ data: { translatedText: string; provider: string; saved: boolean } }>(`/admin/texts/${key}/translate/${targetLang}`, {
        sourceLang,
        provider,
    });
    return response.data.data;
}

/**
 * Detect language of text
 */
export async function detectLanguage(text: string): Promise<{
    language?: string;
    confidence?: number;
}> {
    const response = await api.post<{ data: { language?: string; confidence?: number } }>('/admin/texts/detect-language', { text });
    return response.data.data;
}

/**
 * Get translation provider status
 */
export async function getTranslationStatus(): Promise<TranslationStatus> {
    const response = await api.get<{ data: TranslationStatus }>('/admin/texts/translation/status');
    return response.data.data;
}

/**
 * Add or update a context variant
 */
export async function setTextVariant(
    key: string,
    variantName: string,
    texts: Record<string, string>
): Promise<void> {
    await api.put(`/api/admin/texts/${key}/variant/${variantName}`, { texts });
}

/**
 * Remove a context variant
 */
export async function removeTextVariant(key: string, variantName: string): Promise<void> {
    await api.delete(`/api/admin/texts/${key}/variant/${variantName}`, { data: {} });
}

/**
 * Export all texts as JSON
 */
export async function exportTexts(): Promise<string> {
    const response = await api.get<string>('/api/admin/texts/export/json');
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
}

/**
 * Import texts from JSON
 */
export async function importTexts(
    data: Record<string, unknown>,
    mode: 'merge' | 'replace' = 'merge'
): Promise<{
    imported: number;
    updated: number;
    errors: string[];
}> {
    const response = await api.post<{ data: { imported: number; updated: number; errors: string[] } }>('/api/admin/texts/import/json', { data, mode });
    return response.data.data;
}

/**
 * Validate text keys
 */
export async function validateTextKeys(keys: string[]): Promise<{
    valid: boolean;
    missing: string[];
    warnings: string[];
}> {
    const response = await api.post<{ data: { valid: boolean; missing: string[]; warnings: string[] } }>('/api/admin/texts/validate', { keys });
    return response.data.data;
}

/**
 * Force reload cache
 */
export async function reloadCache(): Promise<string> {
    const response = await api.post<{ message: string }>('/api/admin/texts/cache/reload');
    return response.data.message;
}

/**
 * Seed default texts
 */
export async function seedDefaultTexts(): Promise<void> {
    await api.post('/api/admin/texts/seed');
}

/**
 * Translation Service
 * Automatic text translation using external APIs
 * Supports Google Translate and Azure Translator
 */

import { logger } from './logger.js';

// ============= TYPES =============

export type TranslationProvider = 'google' | 'azure' | 'ai';

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

// ============= CONFIGURATION =============

const GOOGLE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;
const AZURE_API_KEY = process.env.AZURE_TRANSLATOR_KEY;
const AZURE_REGION = process.env.AZURE_TRANSLATOR_REGION || 'eastus';
const AZURE_ENDPOINT = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_REQUESTS = 100;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// ============= PROVIDER DETECTION =============

/**
 * Get the configured translation provider
 */
export function getActiveProvider(): TranslationProvider | null {
  if (GOOGLE_API_KEY) return 'google';
  if (AZURE_API_KEY) return 'azure';
  return null;
}

/**
 * Check if translation service is available
 */
export function isTranslationAvailable(): boolean {
  return getActiveProvider() !== null;
}

// ============= RATE LIMITING =============

function checkRateLimit(provider: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(provider);
  
  if (!limit || now > limit.resetAt) {
    rateLimitMap.set(provider, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (limit.count >= RATE_LIMIT_REQUESTS) {
    return false;
  }
  
  limit.count++;
  return true;
}

// ============= GOOGLE TRANSLATE =============

/**
 * Translate text using Google Translate API
 */
async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult> {
  if (!GOOGLE_API_KEY) {
    return {
      success: false,
      sourceLang,
      targetLang,
      provider: 'google',
      error: 'Google Translate API key not configured',
    };
  }
  
  if (!checkRateLimit('google')) {
    return {
      success: false,
      sourceLang,
      targetLang,
      provider: 'google',
      error: 'Rate limit exceeded',
    };
  }
  
  try {
    const url = new URL('https://translation.googleapis.com/language/translate/v2');
    url.searchParams.set('key', GOOGLE_API_KEY);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text,
        source: sourceLang,
        target: targetLang,
        format: 'text',
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as { 
      data?: { translations?: Array<{ translatedText?: string }> } 
    };
    const translatedText = data.data?.translations?.[0]?.translatedText;
    
    if (!translatedText) {
      throw new Error('No translation returned');
    }
    
    logger.info('settings-cache', {
      action: 'translation_success',
      provider: 'google',
      sourceLang,
      targetLang,
      textLength: text.length,
    });
    
    return {
      success: true,
      translatedText,
      sourceLang,
      targetLang,
      provider: 'google',
    };
  } catch (error) {
    logger.error('settings-cache', {
      action: 'translation_failed',
      provider: 'google',
      error: String(error),
    });
    
    return {
      success: false,
      sourceLang,
      targetLang,
      provider: 'google',
      error: String(error),
    };
  }
}

// ============= AZURE TRANSLATOR =============

/**
 * Translate text using Azure Translator API
 */
async function translateWithAzure(
  text: string,
  sourceLang: string,
  targetLang: string
): Promise<TranslationResult> {
  if (!AZURE_API_KEY) {
    return {
      success: false,
      sourceLang,
      targetLang,
      provider: 'azure',
      error: 'Azure Translator API key not configured',
    };
  }
  
  if (!checkRateLimit('azure')) {
    return {
      success: false,
      sourceLang,
      targetLang,
      provider: 'azure',
      error: 'Rate limit exceeded',
    };
  }
  
  try {
    const url = new URL(`${AZURE_ENDPOINT}/translate`);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('from', sourceLang);
    url.searchParams.set('to', targetLang);
    
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
        'Ocp-Apim-Subscription-Region': AZURE_REGION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ text }]),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure API error: ${response.status} - ${error}`);
    }
    
    const data = await response.json() as Array<{ translations?: Array<{ text?: string }> }>;
    const translatedText = data[0]?.translations?.[0]?.text;
    
    if (!translatedText) {
      throw new Error('No translation returned');
    }
    
    logger.info('settings-cache', {
      action: 'translation_success',
      provider: 'azure',
      sourceLang,
      targetLang,
      textLength: text.length,
    });
    
    return {
      success: true,
      translatedText,
      sourceLang,
      targetLang,
      provider: 'azure',
    };
  } catch (error) {
    logger.error('settings-cache', {
      action: 'translation_failed',
      provider: 'azure',
      error: String(error),
    });
    
    return {
      success: false,
      sourceLang,
      targetLang,
      provider: 'azure',
      error: String(error),
    };
  }
}

// ============= MAIN TRANSLATION FUNCTION =============

/**
 * Translate text using the configured provider
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  preferredProvider?: TranslationProvider
): Promise<TranslationResult> {
  const provider = preferredProvider || getActiveProvider();
  
  if (!provider) {
    return {
      success: false,
      sourceLang,
      targetLang,
      provider: 'google',
      error: 'No translation provider configured. Set GOOGLE_TRANSLATE_API_KEY or AZURE_TRANSLATOR_KEY in environment.',
    };
  }
  
  // Skip translation if source and target are the same
  if (sourceLang === targetLang) {
    return {
      success: true,
      translatedText: text,
      sourceLang,
      targetLang,
      provider,
    };
  }
  
  // Preserve variables in text (don't translate them)
  const variables: string[] = [];
  let processedText = text.replace(/\{\{([^}]+)\}\}/g, (match, content) => {
    const placeholder = `__VAR${variables.length}__`;
    variables.push(match);
    return placeholder;
  });
  
  let result: TranslationResult;
  
  switch (provider) {
    case 'google':
      result = await translateWithGoogle(processedText, sourceLang, targetLang);
      break;
    case 'azure':
      result = await translateWithAzure(processedText, sourceLang, targetLang);
      break;
    default:
      return {
        success: false,
        sourceLang,
        targetLang,
        provider,
        error: `Unknown provider: ${provider}`,
      };
  }
  
  // Restore variables
  if (result.success && result.translatedText) {
    let restoredText = result.translatedText;
    variables.forEach((variable, index) => {
      restoredText = restoredText.replace(`__VAR${index}__`, variable);
    });
    result.translatedText = restoredText;
  }
  
  return result;
}

/**
 * Translate text to multiple languages at once
 */
export async function translateToMultipleLanguages(
  text: string,
  sourceLang: string,
  targetLangs: string[],
  preferredProvider?: TranslationProvider
): Promise<BatchTranslationResult> {
  const provider = preferredProvider || getActiveProvider() || 'google';
  const translations: Record<string, string> = {};
  const errors: string[] = [];
  
  // Include source language
  translations[sourceLang] = text;
  
  // Translate to each target language
  const results = await Promise.all(
    targetLangs
      .filter(lang => lang !== sourceLang)
      .map(async (targetLang) => {
        const result = await translateText(text, sourceLang, targetLang, preferredProvider);
        return { targetLang, result };
      })
  );
  
  for (const { targetLang, result } of results) {
    if (result.success && result.translatedText) {
      translations[targetLang] = result.translatedText;
    } else {
      errors.push(`${targetLang}: ${result.error}`);
    }
  }
  
  return {
    success: errors.length === 0,
    translations,
    provider,
    errors,
  };
}

/**
 * Detect language of text
 */
export async function detectLanguage(text: string): Promise<{
  success: boolean;
  language?: string;
  confidence?: number;
  error?: string;
}> {
  const provider = getActiveProvider();
  
  if (provider === 'google' && GOOGLE_API_KEY) {
    try {
      const url = new URL('https://translation.googleapis.com/language/translate/v2/detect');
      url.searchParams.set('key', GOOGLE_API_KEY);
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: text }),
      });
      
      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`);
      }
      
      const data = await response.json() as { 
        data?: { detections?: Array<Array<{ language?: string; confidence?: number }>> } 
      };
      const detection = data.data?.detections?.[0]?.[0];
      
      return {
        success: true,
        language: detection?.language,
        confidence: detection?.confidence,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }
  
  if (provider === 'azure' && AZURE_API_KEY) {
    try {
      const url = new URL(`${AZURE_ENDPOINT}/detect`);
      url.searchParams.set('api-version', '3.0');
      
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_API_KEY,
          'Ocp-Apim-Subscription-Region': AZURE_REGION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([{ text }]),
      });
      
      if (!response.ok) {
        throw new Error(`Azure API error: ${response.status}`);
      }
      
      const data = await response.json() as Array<{ language?: string; score?: number }>;
      const detection = data[0];
      
      return {
        success: true,
        language: detection?.language,
        confidence: detection?.score,
      };
    } catch (error) {
      return {
        success: false,
        error: String(error),
      };
    }
  }
  
  return {
    success: false,
    error: 'No translation provider configured',
  };
}

/**
 * Get supported languages for translation
 */
export async function getSupportedLanguages(): Promise<{
  success: boolean;
  languages?: { code: string; name: string }[];
  error?: string;
}> {
  const provider = getActiveProvider();
  
  // Return static list for now (both Google and Azure support these)
  return {
    success: true,
    languages: [
      { code: 'es', name: 'Spanish' },
      { code: 'en', name: 'English' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'ru', name: 'Russian' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'nl', name: 'Dutch' },
      { code: 'pl', name: 'Polish' },
      { code: 'tr', name: 'Turkish' },
      { code: 'vi', name: 'Vietnamese' },
      { code: 'th', name: 'Thai' },
      { code: 'id', name: 'Indonesian' },
      { code: 'sv', name: 'Swedish' },
      { code: 'da', name: 'Danish' },
      { code: 'no', name: 'Norwegian' },
      { code: 'fi', name: 'Finnish' },
      { code: 'el', name: 'Greek' },
      { code: 'he', name: 'Hebrew' },
      { code: 'uk', name: 'Ukrainian' },
      { code: 'cs', name: 'Czech' },
      { code: 'ro', name: 'Romanian' },
      { code: 'hu', name: 'Hungarian' },
    ],
  };
}

/**
 * Get translation provider status
 */
export function getProviderStatus(): {
  available: boolean;
  activeProvider: TranslationProvider | null;
  providers: {
    google: boolean;
    azure: boolean;
  };
} {
  return {
    available: isTranslationAvailable(),
    activeProvider: getActiveProvider(),
    providers: {
      google: !!GOOGLE_API_KEY,
      azure: !!AZURE_API_KEY,
    },
  };
}

/**
 * MessageTranslation — Inline translation overlay for chat messages
 * Shows translated text below the original message when triggered from context menu
 */

import { useState, useCallback } from 'react';
import { Languages, Loader2, X, ChevronDown, ArrowRightLeft, Clock } from 'lucide-react';
import { translateText, type SupportedLanguage } from '../../services/translation.service';

const QUICK_LANGS: SupportedLanguage[] = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文' },
];

interface TranslationBubbleProps {
  translatedText: string;
  detectedLang?: string;
  targetLang: string;
  provider?: string;
  latencyMs?: number;
  onClose: () => void;
}

/**
 * A small bubble shown below the message with the translated text
 */
export function TranslationBubble({ translatedText, detectedLang, targetLang, provider, latencyMs, onClose }: TranslationBubbleProps) {
  return (
    <div className="mt-1.5 p-2.5 bg-indigo-500/5 border border-indigo-500/20 rounded-xl animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-[10px] text-indigo-400/70 flex-wrap">
          <Languages className="w-3 h-3" />
          <span className="font-mono uppercase">
            {detectedLang || '?'} → {targetLang}
          </span>
          {provider && (
            <span className="px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-bold text-[9px]">
              {provider}
            </span>
          )}
          {latencyMs != null && (
            <span className="flex items-center gap-0.5 text-zinc-600 text-[9px]">
              <Clock className="w-2.5 h-2.5" />{latencyMs}ms
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-0.5 text-zinc-500 hover:text-zinc-300 rounded transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Translation */}
      <p className="text-sm text-indigo-200/90 leading-relaxed whitespace-pre-wrap">
        {translatedText}
      </p>
    </div>
  );
}

interface MessageTranslationState {
  translations: Map<string, { text: string; detectedLang?: string; targetLang: string; provider?: string; latencyMs?: number }>;
  loading: Set<string>;
}

/**
 * Hook to manage message translations in the chat window
 */
export function useMessageTranslation() {
  const [state, setState] = useState<MessageTranslationState>({
    translations: new Map(),
    loading: new Set(),
  });

  const translateMessage = useCallback(async (
    messageId: string,
    messageText: string,
    targetLang: string,
    sessionId?: string,
  ) => {
    // Mark as loading
    setState(prev => ({
      ...prev,
      loading: new Set(prev.loading).add(messageId),
    }));

    try {
      const result = await translateText(messageText, targetLang, {
        sourceLang: 'auto',
        sessionId,
        messageId,
        direction: 'incoming',
      });

      if (result.ok && result.translatedText) {
        setState(prev => {
          const newTranslations = new Map(prev.translations);
          newTranslations.set(messageId, {
            text: result.translatedText!,
            detectedLang: result.detectedLang,
            targetLang,
            provider: result.provider,
            latencyMs: result.latencyMs,
          });
          const newLoading = new Set(prev.loading);
          newLoading.delete(messageId);
          return { translations: newTranslations, loading: newLoading };
        });
      } else {
        setState(prev => {
          const newLoading = new Set(prev.loading);
          newLoading.delete(messageId);
          return { ...prev, loading: newLoading };
        });
      }
    } catch {
      setState(prev => {
        const newLoading = new Set(prev.loading);
        newLoading.delete(messageId);
        return { ...prev, loading: newLoading };
      });
    }
  }, []);

  const clearTranslation = useCallback((messageId: string) => {
    setState(prev => {
      const newTranslations = new Map(prev.translations);
      newTranslations.delete(messageId);
      return { ...prev, translations: newTranslations };
    });
  }, []);

  const clearAll = useCallback(() => {
    setState({ translations: new Map(), loading: new Set() });
  }, []);

  return {
    translations: state.translations,
    loading: state.loading,
    translateMessage,
    clearTranslation,
    clearAll,
  };
}

/**
 * Translate sub-menu for the context menu — shows a language picker that triggers translation
 */
interface TranslateSubMenuProps {
  onSelectLanguage: (lang: string) => void;
  onClose: () => void;
}

export function TranslateSubMenu({ onSelectLanguage, onClose }: TranslateSubMenuProps) {
  return (
    <div className="absolute left-full top-0 ml-1 w-44 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl z-[10000] animate-in fade-in slide-in-from-left-1 duration-150 overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase">
          <ArrowRightLeft className="w-3 h-3" />
          Idioma destino
        </div>
      </div>
      <div className="max-h-52 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-zinc-700">
        {QUICK_LANGS.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => { onSelectLanguage(lang.code); onClose(); }}
            className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all flex items-center justify-between"
          >
            <span className="font-medium">{lang.name}</span>
            <span className="text-[10px] font-mono text-zinc-600 uppercase">{lang.code}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

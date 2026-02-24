/**
 * TranslateDropdown - Premium Zinc Refactor (Smart Positioning)
 * Horizontal, compact, and high-fidelity translation tool.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Languages, ChevronDown, Loader2, Check, X, ArrowRight,
  Lock, Zap, Globe, Sparkles
} from 'lucide-react';
import {
  translateText,
  getPublicTranslationSettings,
  type SupportedLanguage,
  type PublicTranslationSettings,
} from '../../services/translation.service';

const QUICK_LANGUAGES: SupportedLanguage[] = [
  { code: 'es', name: 'Español' }, { code: 'en', name: 'English' }, { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' }, { code: 'de', name: 'Deutsch' }, { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' }, { code: 'zh', name: '中文' }, { code: 'ja', name: '日本語' },
];
const SOURCE_LANGUAGES: SupportedLanguage[] = [{ code: 'auto', name: 'Auto Detect' }, ...QUICK_LANGUAGES];

function getLangName(code: string): string {
  if (code === 'auto') return 'Auto';
  return QUICK_LANGUAGES.find(l => l.code === code)?.name || code.toUpperCase();
}

interface TranslateDropdownProps {
  message: string;
  onReplace: (text: string) => void;
  sessionId?: string;
  disabled?: boolean;
}

export default function TranslateDropdown({ message, onReplace, sessionId, disabled }: TranslateDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeList, setActiveList] = useState<'source' | 'target' | null>(null);

  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('en');
  const [lockSource, setLockSource] = useState(false);
  const [lockTarget, setLockTarget] = useState(false);

  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ lat?: number; prov?: string }>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, placement: 'top' as 'top' | 'bottom' });

  // Init Settings
  useEffect(() => {
    getPublicTranslationSettings().then((s: PublicTranslationSettings) => {
      if (s.defaultTargetLang) setTargetLang(s.defaultTargetLang);
      if (s.defaultSourceLang) setSourceLang(s.defaultSourceLang);
      setLockSource(s.lockSourceLang);
      setLockTarget(s.lockTargetLang);
    }).catch(() => { });
  }, []);

  // Smart Positioning Logic
  const updatePosition = useCallback(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const dropdownHeight = 220; // Altura estimada
      const spaceAbove = rect.top;
      const shouldShowBelow = spaceAbove < dropdownHeight + 20;

      setPos({
        top: shouldShowBelow ? rect.bottom + 8 : rect.top - 8,
        left: rect.left,
        placement: shouldShowBelow ? 'bottom' : 'top'
      });
    }
  }, [isOpen]);

  useEffect(() => {
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [updatePosition]);

  // Click Outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && !triggerRef.current?.contains(e.target as Node)) {
        setIsOpen(false); setActiveList(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Reset on message change
  useEffect(() => {
    if (translatedText && message !== translatedText) {
      setTranslatedText(null); setError(null);
    }
  }, [message]);

  const handleTranslate = useCallback(async () => {
    if (!message.trim()) return;
    setIsTranslating(true); setError(null); setActiveList(null);
    setIsOpen(false); // Cierra inmediatamente para mejor UX

    try {
      const res = await translateText(message, targetLang, { sourceLang, sessionId, direction: 'outgoing' });
      if (res.ok && res.translatedText) {
        setTranslatedText(res.translatedText);
        setMeta({ lat: res.latencyMs, prov: res.provider });
      } else {
        setError(res.error || 'Error en la traducción');
      }
    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setIsTranslating(false);
    }
  }, [message, sourceLang, targetLang, sessionId]);

  const hasMessage = message.trim().length > 0;

  // === DROPDOWN PORTAL ===
  const dropdown = isOpen && createPortal(
    <div
      ref={dropdownRef}
      className="fixed z-[9999] w-[340px] flex flex-col bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl shadow-black ring-1 ring-white/10 animate-in fade-in zoom-in-95 duration-200"
      style={{
        top: pos.top,
        left: pos.left,
        transform: pos.placement === 'top' ? 'translateY(-100%)' : 'translateY(0)',
        transformOrigin: pos.placement === 'top' ? 'bottom left' : 'top left'
      }}
    >
      {/* 1. Header Fijo */}
      <div className="flex-none flex items-center justify-between p-1.5 bg-zinc-900/50 border-b border-zinc-800/50 rounded-t-2xl">
        <button
          title={`Idioma de origen${lockSource ? ' (no se puede cambiar)' : ''}`}
          onClick={() => !lockSource && setActiveList(activeList === 'source' ? null : 'source')}
          disabled={lockSource}
          className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            activeList === 'source' ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          <span className="truncate max-w-[80px]">{getLangName(sourceLang)}</span>
          {lockSource ? <Lock className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
        </button>

        <div className="flex px-1.5 text-zinc-600">
          <ArrowRight className="w-3.5 h-3.5" />
        </div>

        <button
          title={`Idioma de destino${lockTarget ? ' (no se puede cambiar)' : ''}`}
          onClick={() => !lockTarget && setActiveList(activeList === 'target' ? null : 'target')}
          disabled={lockTarget}
          className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            activeList === 'target' ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 shadow-sm' : 'text-indigo-400 hover:bg-indigo-500/10'
          }`}
        >
          <span className="truncate max-w-[80px]">{getLangName(targetLang)}</span>
          {lockTarget ? <Lock className="w-3 h-3 opacity-50" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
        </button>
      </div>

      {/* 2. Lista de Idiomas (Flujo normal) */}
      {activeList && (
        <div className="flex-1 animate-in slide-in-from-top-2 fade-in duration-200 bg-zinc-950 border-b border-zinc-800/50">
          <div className="max-h-[260px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent p-1 grid grid-cols-2 gap-px bg-zinc-900/30">
            {(activeList === 'source' ? SOURCE_LANGUAGES : QUICK_LANGUAGES).map(lang => (
              <button
                key={lang.code}
                onClick={() => {
                  activeList === 'source' ? setSourceLang(lang.code) : setTargetLang(lang.code);
                  setActiveList(null);
                }}
                className={`
                  flex items-center gap-2 px-3 py-2.5 text-xs text-left rounded-lg transition-all
                  ${(activeList === 'source' ? sourceLang : targetLang) === lang.code
                    ? 'bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-500/20 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }
                `}
              >
                <span className="w-4 text-[9px] font-mono font-bold uppercase opacity-50 shrink-0">{lang.code}</span>
                <span className="truncate">{lang.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Footer Action - Minimalist Ghost */}
      <div className="p-1.5 bg-zinc-950/50 rounded-b-2xl">
        <button
          onClick={handleTranslate}
          className="
            group w-full flex items-center justify-center gap-2 py-2.5 rounded-xl 
            text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 hover:shadow-lg hover:shadow-indigo-500/5
            transition-all duration-300 active:scale-[0.98]
          "
        >
          <Sparkles className="w-3.5 h-3.5 text-zinc-600 group-hover:text-indigo-400 transition-colors duration-300" />
          <span className="text-xs font-bold uppercase ">Traducir Mensaje</span>
          <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-indigo-400" />
        </button>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="relative inline-block">
      {/* TRIGGER BUTTON */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => hasMessage && !disabled && setIsOpen(!isOpen)}
        disabled={!hasMessage || disabled || isTranslating}
        className={`
          group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all duration-200 shadow-sm
          ${isTranslating
            ? 'bg-zinc-800 border-zinc-700 text-zinc-400 cursor-wait'
            : translatedText
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 hover:shadow-indigo-500/5'
          } 
          ${(!hasMessage || disabled) ? 'opacity-40 cursor-not-allowed' : ''}
        `}
      >
        {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
          translatedText ? <Check className="w-3.5 h-3.5" /> :
          <Languages className="w-3.5 h-3.5 group-hover:text-indigo-400 transition-colors" />}
        <span className="hidden sm:inline-block">
          {isTranslating ? 'Traduciendo...' : translatedText ? 'Traducido' : 'Traducir'}
        </span>
      </button>

      {dropdown}

      {/* PREVIEW BAR (Dynamic Island Style) */}
      {(translatedText || isTranslating) && !isOpen && (
        createPortal(
          <div className="fixed z-[100] left-1/2 -translate-x-1/2 bottom-24 w-auto max-w-[90vw] min-w-[300px] animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex items-center gap-3 p-1.5 pr-2 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-full shadow-2xl shadow-black/50 ring-1 ring-white/5">
              
              <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 shadow-inner">
                {isTranslating ? <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" /> : <Globe className="w-4 h-4 text-emerald-400" />}
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col justify-center px-1">
                {isTranslating ? (
                  <span className="text-xs text-zinc-400 font-medium">Procesando traducción...</span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-200 font-medium truncate max-w-[200px] sm:max-w-[300px]" title={translatedText!}>
                      {translatedText}
                    </span>
                    {meta.lat && <span className="text-[9px] text-zinc-600 font-mono hidden sm:inline-block">{meta.lat}ms</span>}
                  </div>
                )}
              </div>
              
              {!isTranslating && (
                <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-800">
                  <button onClick={() => { onReplace(translatedText!); setTranslatedText(null); }} className="p-1.5 rounded-full bg-emerald-500 text-white hover:bg-emerald-400 hover:scale-105 transition-all shadow-lg shadow-emerald-500/20" title="Usar Traducción">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setTranslatedText(null); setError(null); }} className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 hover:scale-105 transition-all" title="Descartar">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Error Toast */}
            {error && (
              <div className="mt-3 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/90 backdrop-blur text-white text-[10px] font-bold shadow-lg animate-in fade-in slide-in-from-top-1">
                  <Zap className="w-3 h-3 fill-white" /> {error}
                  <button onClick={() => setError(null)} className="ml-1 opacity-70 hover:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                </span>
              </div>
            )}
          </div>,
          document.body
        )
      )}
    </div>
  );
}
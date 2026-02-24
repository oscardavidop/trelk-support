/**
 * Sidebar Translations - Premium Zinc Refactor
 * High-fidelity control panels for incoming and outgoing auto-translation.
 */

import { useState } from "react";
import {
  updateSessionIncomingTranslation,
  updateSessionTranslation,
  type IncomingConfig,
  type OutgoingConfig
} from "../../services/translation.service";
import { Languages, ChevronDown, ArrowRight, ArrowLeft, Lock, Info, Loader2 } from "lucide-react";

// ============= SHARED CONSTANTS =============

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "ru", label: "Русский" },
  { value: "zh", label: "中文" },
  { value: "ar", label: "العربية" },
  { value: "ja", label: "日本語" },
];

// ============= OUTGOING TRANSLATION =============

export function SidebarTranslation({ sessionId, config, onConfigChange }: {
  sessionId: string;
  config: OutgoingConfig;
  onConfigChange: (cfg: OutgoingConfig) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [targetLang, setTargetLang] = useState(config.targetLang || '');

  const toggleEnabled = async () => {
    setSaving(true);
    try {
      const next = !config.enabled;
      await updateSessionTranslation(sessionId, { outgoingEnabled: next, outgoingTargetLang: targetLang || undefined });
      onConfigChange({ ...config, enabled: next });
      window.dispatchEvent(new CustomEvent('translation:sessionUpdated', { detail: { sessionId } }));
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleLangChange = async (lang: string) => {
    setTargetLang(lang);
    setSaving(true);
    try {
      await updateSessionTranslation(sessionId, { outgoingEnabled: config.enabled, outgoingTargetLang: lang });
      onConfigChange({ ...config, targetLang: lang });
      window.dispatchEvent(new CustomEvent('translation:sessionUpdated', { detail: { sessionId } }));
    } catch { /* silent */ }
    setSaving(false);
  };

  return (
    <div className="px-4 py-4 space-y-4">

      {/* Header & Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm text-zinc-200 font-bold tracking-tight">Auto-Translate Salida</span>
        </div>

        {
          config.agentOverrideAllowed && (<button
            onClick={toggleEnabled}
            disabled={saving}
            className={`
    relative inline-flex h-3.5 w-7 items-center rounded-full
    transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-indigo-400/30
    ${config.enabled ? 'bg-indigo-500/90' : 'bg-zinc-700'}
    ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
  `}
          >
            <span
              className={`
      inline-block h-2.5 w-2.5 transform rounded-full bg-white
      transition-transform duration-200
      ${config.enabled ? 'translate-x-4' : 'translate-x-1'}
    `}
            />
          </button>)
        }

      </div>

      {/* Admin Lock Warning */}
      {!config.agentOverrideAllowed && (
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
          <Lock className="w-3 h-3" />
          <span>Configuración bloqueada por el administrador.</span>
        </div>
      )}

      {/* Language Selector */}
      {
        saving && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            Guardando cambios...
          </div>
        ) || (
          <>

            {config.agentOverrideAllowed && config.enabled && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[10px] text-zinc-500 font-bold uppercase ">
                  Idioma destino
                </label>
                <div className="relative group">
                  <select
                    value={targetLang}
                    onChange={e => handleLangChange(e.target.value)}
                    disabled={saving}
                    className="w-full appearance-none bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl pl-3 pr-8 py-2 text-xs focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all disabled:opacity-50"
                  >
                    <option value="">Auto-detectar</option>
                    {LANGUAGE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none group-hover:text-zinc-300 transition-colors" />
                </div>
              </div>
            )}

            {/* Status Info */}
            <div className="flex items-start gap-2 p-2.5 bg-zinc-900/40 border border-zinc-800/50 rounded-xl text-[11px] text-zinc-400 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
              <div>
                {config.enabled
                  ? <span>Tus mensajes se traducirán a <strong className="text-indigo-400 font-mono uppercase">{config.targetLang || 'AUTO'}</strong> antes de enviarse al usuario.</span>
                  : <span>La traducción automática está desactivada para este chat.</span>
                }
                {config.deliveryMode === 'both' && config.enabled && (
                  <span className="block mt-1 text-indigo-400/80 font-medium">Modo: Original + Traducción</span>
                )}
              </div>
            </div>
          </>)
      }
    </div>
  );
}

// ============= INCOMING TRANSLATION =============

export function SidebarIncomingTranslation({ sessionId, config, onConfigChange }: {
  sessionId: string;
  config: IncomingConfig;
  onConfigChange: (cfg: IncomingConfig) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [targetLang, setTargetLang] = useState('');

  const toggleEnabled = async () => {
    if (!config.agentOverrideAllowed) return;
    setSaving(true);
    try {
      const next = !config.enabled;
      await updateSessionIncomingTranslation(sessionId, { incomingEnabled: next });
      onConfigChange({ ...config, enabled: next });
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleLangChange = async (lang: string) => {
    setTargetLang(lang);
    setSaving(true);
    try {
      await updateSessionIncomingTranslation(sessionId, { incomingTargetLang: lang || undefined });
      onConfigChange({ ...config, targetLang: lang || config.targetLang });
    } catch { /* silent */ }
    setSaving(false);
  };

  return (
    <div className="px-4 py-4 space-y-4 border-t border-zinc-800/50">

      {/* Header & Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20">
            <ArrowLeft className="w-3.5 h-3.5" />
          </div>
          <span className="text-sm text-zinc-200 font-bold tracking-tight">Auto-Translate Entrada</span>
        </div>
        {
          config.agentOverrideAllowed && (
            <button
              onClick={toggleEnabled}
              disabled={saving || !config.agentOverrideAllowed}
              className={`
    relative inline-flex h-3.5 w-7 items-center rounded-full
    transition-colors duration-200
    focus:outline-none focus:ring-2 focus:ring-cyan-400/30
    ${config.enabled ? 'bg-cyan-500/90' : 'bg-zinc-700'}
    ${(!config.agentOverrideAllowed || saving)
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer'}
  `}
            >
              <span
                className={`
      inline-block h-2.5 w-2.5 transform rounded-full bg-white
      transition-transform duration-200
      ${config.enabled ? 'translate-x-4' : 'translate-x-1'}
    `}
              />
            </button>
          )
        }
      </div>

      {/* Admin Lock Warning */}
      {!config.agentOverrideAllowed && (
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800">
          <Lock className="w-3 h-3" />
          <span>Configuración bloqueada por el administrador.</span>
        </div>
      )}

      {/* Language Selector */}
      {
        saving && (
          <div className="flex items-center gap-2 text-sm text-zinc-400 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin" />
            Guardando cambios...
          </div>
        ) || (
          <>
            {config.agentOverrideAllowed && config.enabled && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[10px] text-zinc-500 font-bold uppercase ">
                  Traducir al idioma
                </label>
                <div className="relative group">
                  <select
                    value={targetLang}
                    onChange={e => handleLangChange(e.target.value)}
                    disabled={saving}
                    className="w-full appearance-none bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl pl-3 pr-8 py-2 text-xs focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all disabled:opacity-50"
                  >
                    <option value="">Usar default del sistema</option>
                    {LANGUAGE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none group-hover:text-zinc-300 transition-colors" />
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 p-2.5 bg-zinc-900/40 border border-zinc-800/50 rounded-xl text-[11px] text-zinc-400 leading-relaxed">
              <Languages className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
              <div>
                {config.enabled
                  ? <span>Los mensajes del cliente se traducirán a <strong className="text-cyan-400 font-mono uppercase">{config.targetLang || 'AUTO'}</strong> en tiempo real.</span>
                  : <span>La traducción entrante está desactivada para este chat.</span>
                }
                {config.showOriginal && config.enabled && (
                  <span className="block mt-1 text-cyan-400/80 font-medium">Se mostrará el mensaje original junto a la traducción.</span>
                )}
              </div>
            </div>
          </>
        )
      }

    </div>
  );
}
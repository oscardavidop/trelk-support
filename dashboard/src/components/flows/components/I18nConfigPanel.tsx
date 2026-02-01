import React from 'react';
import { 
  Globe, 
  User, 
  Database, 
  Lock, 
  Info, 
  Languages 
} from 'lucide-react';
import type { ActionConfig } from "../../../types/flow";

interface I18nConfigProps {
  config: ActionConfig;
  onChange: (updates: Partial<ActionConfig>) => void;
  detectedTextKeys: string[];
  readOnly?: boolean;
}

// ============= SUPPORTED LANGUAGES =============
const SUPPORTED_LANGUAGES = [
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

const I18nConfigPanel: React.FC<I18nConfigProps> = ({ config, onChange, detectedTextKeys, readOnly }) => {
  const i18nConfig = config.i18nConfig || { source: 'user_language' };
  
  const updateI18nConfig = (updates: Partial<ActionConfig['i18nConfig']>) => {
    onChange({ 
      i18nConfig: { ...i18nConfig, ...updates } as ActionConfig['i18nConfig']
    });
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2">
      
      {/* 1. Header */}
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-3">
        <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
          <Globe className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">
            Configuración i18n
          </h4>
          <p className="text-[10px] text-zinc-500">
            Fuente de idioma para {detectedTextKeys.length} textos detectados
          </p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        
        {/* 2. Detected Keys Badge Area */}
        {detectedTextKeys.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-2.5">
            <div className="flex items-center gap-2 mb-2">
              <Languages className="w-3 h-3 text-indigo-400" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Variables Detectadas</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {detectedTextKeys.map((key, i) => (
                <span 
                  key={i}
                  className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded text-[10px] font-mono"
                >
                  {`{{TEXT.${key}}}`}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 3. Source Selection Grid */}
        <div className="space-y-3">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Fuente del Idioma</label>
          
          <div className="grid grid-cols-1 gap-2">
            
            {/* Option: User Language */}
            <label className={`
              relative flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all group
              ${i18nConfig.source === 'user_language'
                ? 'bg-indigo-500/5 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.1)]'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
              }
            `}>
              <div className="mt-0.5">
                <input
                  type="radio"
                  name="i18n-source"
                  checked={i18nConfig.source === 'user_language'}
                  onChange={() => updateI18nConfig({ source: 'user_language', customFieldName: undefined, variableName: undefined, fixedLanguage: undefined })}
                  disabled={readOnly}
                  className="hidden" // Ocultamos el radio nativo, usamos estilos de tarjeta
                />
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${i18nConfig.source === 'user_language' ? 'border-indigo-500' : 'border-zinc-600'}`}>
                  {i18nConfig.source === 'user_language' && <div className="w-2 h-2 bg-indigo-500 rounded-full" />}
                </div>
              </div>
              <div className="flex-1">
                <div className={`text-xs font-bold flex items-center gap-2 ${i18nConfig.source === 'user_language' ? 'text-indigo-400' : 'text-zinc-300'}`}>
                  <User className="w-3.5 h-3.5" /> Idioma del Usuario
                </div>
                <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                  Utiliza la configuración regional del perfil de Telegram del usuario.
                </p>
              </div>
            </label>

            {/* Option: Custom Field */}
            <label className={`
              relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all group gap-2
              ${i18nConfig.source === 'custom_field'
                ? 'bg-indigo-500/5 border-indigo-500/50'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }
            `}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <input
                    type="radio"
                    name="i18n-source"
                    checked={i18nConfig.source === 'custom_field'}
                    onChange={() => updateI18nConfig({ source: 'custom_field', variableName: undefined, fixedLanguage: undefined })}
                    disabled={readOnly}
                    className="hidden"
                  />
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${i18nConfig.source === 'custom_field' ? 'border-indigo-500' : 'border-zinc-600'}`}>
                    {i18nConfig.source === 'custom_field' && <div className="w-2 h-2 bg-indigo-500 rounded-full" />}
                  </div>
                </div>
                <div className="flex-1">
                  <div className={`text-xs font-bold flex items-center gap-2 ${i18nConfig.source === 'custom_field' ? 'text-indigo-400' : 'text-zinc-300'}`}>
                    <Database className="w-3.5 h-3.5" /> Campo Personalizado
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Obtiene el código desde un campo de la base de datos.
                  </p>
                </div>
              </div>
              
              {/* Conditional Input */}
              {i18nConfig.source === 'custom_field' && (
                <div className="pl-7 animate-in fade-in zoom-in-95 duration-200">
                  <input
                    type="text"
                    value={i18nConfig.customFieldName || ''}
                    onChange={(e) => updateI18nConfig({ customFieldName: e.target.value })}
                    placeholder="Ej: preferred_lang"
                    disabled={readOnly}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </label>

            {/* Option: Fixed Language */}
            <label className={`
              relative flex flex-col p-3 rounded-lg border cursor-pointer transition-all group gap-2
              ${i18nConfig.source === 'fixed'
                ? 'bg-indigo-500/5 border-indigo-500/50'
                : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
              }
            `}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <input
                    type="radio"
                    name="i18n-source"
                    checked={i18nConfig.source === 'fixed'}
                    onChange={() => updateI18nConfig({ source: 'fixed', customFieldName: undefined, variableName: undefined, fixedLanguage: 'es' })}
                    disabled={readOnly}
                    className="hidden"
                  />
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${i18nConfig.source === 'fixed' ? 'border-indigo-500' : 'border-zinc-600'}`}>
                    {i18nConfig.source === 'fixed' && <div className="w-2 h-2 bg-indigo-500 rounded-full" />}
                  </div>
                </div>
                <div className="flex-1">
                  <div className={`text-xs font-bold flex items-center gap-2 ${i18nConfig.source === 'fixed' ? 'text-indigo-400' : 'text-zinc-300'}`}>
                    <Lock className="w-3.5 h-3.5" /> Idioma Fijo
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-1">
                    Fuerza un idioma específico para esta acción.
                  </p>
                </div>
              </div>

              {/* Conditional Select */}
              {i18nConfig.source === 'fixed' && (
                <div className="pl-7 animate-in fade-in zoom-in-95 duration-200">
                  <select
                    value={i18nConfig.fixedLanguage || 'es'}
                    onChange={(e) => updateI18nConfig({ fixedLanguage: e.target.value })}
                    disabled={readOnly}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none cursor-pointer appearance-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {SUPPORTED_LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </label>

          </div>
        </div>

        {/* 4. Info Footer */}
        <div className="flex items-start gap-2 p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg">
          <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Asegúrate de que las claves detectadas estén definidas en el módulo <strong>/admin/texts</strong>. Si falta una traducción, se usará el idioma por defecto (Español).
          </p>
        </div>

      </div>
    </div>
  );
};

export default I18nConfigPanel;
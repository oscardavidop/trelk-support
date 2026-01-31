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
    <div className="border border-purple-200 dark:border-purple-800 rounded-xl p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-purple-100 dark:bg-purple-900 rounded-lg">
          <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            🌐 Configuración de Textos i18n
          </h4>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Configura cómo obtener el idioma para los textos multilingüe
          </p>
        </div>
      </div>

      {/* Detected keys */}
      <div className="mb-3 p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
        <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 tracking-wide">
          Textos detectados:
        </span>
        <div className="flex flex-wrap gap-1 mt-1">
          {detectedTextKeys.map((key, i) => (
            <span 
              key={i}
              className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-[10px] font-mono"
            >
              {`{{TEXT.${key}}}`}
            </span>
          ))}
        </div>
      </div>

      {/* Language source selector */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
          ¿De dónde obtener el idioma?
        </label>
        
        {/* Option: User Language */}
        <label className={`
          flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
          ${i18nConfig.source === 'user_language'
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
          }
        `}>
          <input
            type="radio"
            name="i18n-source"
            checked={i18nConfig.source === 'user_language'}
            onChange={() => updateI18nConfig({ source: 'user_language', customFieldName: undefined, variableName: undefined, fixedLanguage: undefined })}
            disabled={readOnly}
            className="mt-0.5 text-purple-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
              👤 Idioma del usuario
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              Usa el idioma configurado en el perfil del usuario (user.language)
            </div>
          </div>
        </label>

        {/* Option: Custom Field */}
        <label className={`
          flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
          ${i18nConfig.source === 'custom_field'
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
          }
        `}>
          <input
            type="radio"
            name="i18n-source"
            checked={i18nConfig.source === 'custom_field'}
            onChange={() => updateI18nConfig({ source: 'custom_field', variableName: undefined, fixedLanguage: undefined })}
            disabled={readOnly}
            className="mt-0.5 text-purple-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
              📋 Campo personalizado
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
              Usa el valor de un campo personalizado del usuario (ej: "lang", "preferred_language")
            </div>
            {i18nConfig.source === 'custom_field' && (
              <input
                type="text"
                value={i18nConfig.customFieldName || ''}
                onChange={(e) => updateI18nConfig({ customFieldName: e.target.value })}
                placeholder="Nombre del campo (ej: lang)"
                disabled={readOnly}
                className="w-full px-2 py-1.5 text-xs border border-purple-300 dark:border-purple-700 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </label>

        {/* Option: Variable */}
        <label className={`
          flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
          ${i18nConfig.source === 'variable'
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
          }
        `}>
          <input
            type="radio"
            name="i18n-source"
            checked={i18nConfig.source === 'variable'}
            onChange={() => updateI18nConfig({ source: 'variable', customFieldName: undefined, fixedLanguage: undefined })}
            disabled={readOnly}
            className="mt-0.5 text-purple-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
              📦 Variable del flow
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
              Usa el valor de una variable de sesión del flow
            </div>
            {i18nConfig.source === 'variable' && (
              <input
                type="text"
                value={i18nConfig.variableName || ''}
                onChange={(e) => updateI18nConfig({ variableName: e.target.value })}
                placeholder="Nombre de variable (ej: userLanguage)"
                disabled={readOnly}
                className="w-full px-2 py-1.5 text-xs border border-purple-300 dark:border-purple-700 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500"
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </label>

        {/* Option: Fixed Language */}
        <label className={`
          flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all
          ${i18nConfig.source === 'fixed'
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 bg-white dark:bg-gray-800'
          }
        `}>
          <input
            type="radio"
            name="i18n-source"
            checked={i18nConfig.source === 'fixed'}
            onChange={() => updateI18nConfig({ source: 'fixed', customFieldName: undefined, variableName: undefined, fixedLanguage: 'es' })}
            disabled={readOnly}
            className="mt-0.5 text-purple-500"
          />
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
              🔒 Idioma fijo
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
              Usa siempre un idioma específico
            </div>
            {i18nConfig.source === 'fixed' && (
              <select
                value={i18nConfig.fixedLanguage || 'es'}
                onChange={(e) => updateI18nConfig({ fixedLanguage: e.target.value })}
                disabled={readOnly}
                className="w-full px-2 py-1.5 text-xs border border-purple-300 dark:border-purple-700 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-purple-500"
                onClick={(e) => e.stopPropagation()}
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name} ({lang.code})
                  </option>
                ))}
              </select>
            )}
          </div>
        </label>
      </div>

      {/* Info box */}
      <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-blue-500 text-sm">💡</span>
          <p className="text-[10px] text-blue-700 dark:text-blue-300">
            Los textos deben estar definidos en <strong>/admin/texts</strong> con traducciones para cada idioma. 
            Si el idioma no está disponible, se usará español como fallback.
          </p>
        </div>
      </div>
    </div>
  );
};

export default I18nConfigPanel;
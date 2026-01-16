/**
 * MessageEditor - Advanced message configuration for Flow Builder
 * Supports blocks (text, image, document, audio, video, delay) and keyboards
 */

import React, { useState, useMemo } from 'react';
import type {
  MessageBlock,
  TextBlock,
  ImageBlock,
  DocumentBlock,
  AudioBlock,
  VideoBlock,
  DelayBlock,
  KeyboardConfig,
  KeyboardRow,
  KeyboardButton,
  ActionConfig,
  ButtonOnClick,
  ButtonActionMode,
  ParseMode,
} from '../../types/flow';
import { MessagePreview } from './MessagePreview';
import { FileUpload } from './FileUpload';

// Tipos simplificados para las listas
interface NodeOption {
  id: string;
  label: string;
}

interface FlowOption {
  id: string;
  name: string;
}

interface MessageEditorProps {
  config: ActionConfig;
  onChange: (updates: Partial<ActionConfig>) => void;
  readOnly?: boolean;
  /** Lista de nodos del flow actual para el selector */
  nodes?: NodeOption[];
  /** Lista de flows disponibles para el selector */
  flows?: FlowOption[];
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

// ============= ICONS =============

const BlockIcons = {
  text: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  image: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  document: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  audio: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  ),
  video: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  delay: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ============= VARIABLE SELECTOR =============

const AVAILABLE_VARIABLES = [
  { path: 'user.firstName', label: 'Nombre', description: 'Nombre del usuario', category: 'user' },
  { path: 'user.lastName', label: 'Apellido', description: 'Apellido del usuario', category: 'user' },
  { path: 'user.username', label: 'Username', description: '@username de Telegram', category: 'user' },
  { path: 'user.id', label: 'User ID', description: 'ID de Telegram', category: 'user' },
  { path: 'user.language', label: 'Idioma', description: 'Idioma del usuario', category: 'user' },
  { path: 'message.content', label: 'Mensaje', description: 'Contenido del último mensaje', category: 'message' },
  { path: 'chat.id', label: 'Chat ID', description: 'ID del chat', category: 'chat' },
  { path: 'date', label: 'Fecha', description: 'Fecha actual (YYYY-MM-DD)', category: 'system' },
  { path: 'time', label: 'Hora', description: 'Hora actual (HH:MM)', category: 'system' },
  { path: 'datetime', label: 'Fecha y hora', description: 'Fecha y hora actual', category: 'system' },
  { path: 'agent.name', label: 'Agente', description: 'Nombre del agente asignado', category: 'agent' },
];

// Textos i18n de ejemplo (se cargan dinámicamente)
const COMMON_TEXT_KEYS = [
  { key: 'WELCOME_MESSAGE', description: 'Mensaje de bienvenida' },
  { key: 'GOODBYE_MESSAGE', description: 'Mensaje de despedida' },
  { key: 'AGENT_ASSIGNED', description: 'Agente asignado' },
  { key: 'WAIT_MESSAGE', description: 'Mensaje de espera' },
  { key: 'ERROR_MESSAGE', description: 'Mensaje de error' },
  { key: 'HELP_MESSAGE', description: 'Mensaje de ayuda' },
  { key: 'MENU_MESSAGE', description: 'Menú principal' },
  { key: 'TRANSFER_MESSAGE', description: 'Transferencia a agente' },
];

// ============= i18n CONFIGURATION COMPONENT =============
// Detects {{TEXT.KEY}} patterns and shows language source configuration

interface I18nConfigProps {
  config: ActionConfig;
  onChange: (updates: Partial<ActionConfig>) => void;
  detectedTextKeys: string[];
  readOnly?: boolean;
}

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
        <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400 uppercase tracking-wide">
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

// Helper function to detect {{TEXT.KEY}} patterns in content
function detectTextKeys(blocks: MessageBlock[]): string[] {
  const keys = new Set<string>();
  const textPattern = /\{\{TEXT\.([A-Z0-9_]+)\}\}/g;
  
  for (const block of blocks) {
    // Check text content
    if ('content' in block && block.content) {
      let match;
      while ((match = textPattern.exec(block.content)) !== null) {
        keys.add(match[1]);
      }
    }
    // Check caption
    if ('caption' in block && block.caption) {
      let match;
      while ((match = textPattern.exec(block.caption)) !== null) {
        keys.add(match[1]);
      }
    }
    // Check button texts in keyboard
    if ('keyboard' in block && block.keyboard?.rows) {
      for (const row of block.keyboard.rows) {
        for (const btn of row.buttons) {
          if (btn.text) {
            let match;
            while ((match = textPattern.exec(btn.text)) !== null) {
              keys.add(match[1]);
            }
          }
        }
      }
    }
  }
  
  return Array.from(keys);
}

interface VariableSelectorProps {
  onSelect: (variable: string) => void;
}

const VariableSelector: React.FC<VariableSelectorProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'variables' | 'texts'>('variables');
  const [customTextKey, setCustomTextKey] = useState('');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 flex items-center gap-1"
      >
        <span>{'{ }'}</span>
        Variables
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className="absolute z-50 bottom-full right-0 mb-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setActiveTab('variables')}
                className={`flex-1 px-3 py-2 text-xs font-medium ${
                  activeTab === 'variables'
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-b-2 border-blue-500'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Variables
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('texts')}
                className={`flex-1 px-3 py-2 text-xs font-medium ${
                  activeTab === 'texts'
                    ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 border-b-2 border-purple-500'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                🌐 Textos i18n
              </button>
            </div>
            
            <div className="max-h-64 overflow-y-auto">
              {activeTab === 'variables' ? (
                // Variables tab
                AVAILABLE_VARIABLES.map((v) => (
                  <button
                    key={v.path}
                    type="button"
                    onClick={() => {
                      onSelect(`{{${v.path}}}`);
                      setIsOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0"
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                      {v.label}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {`{{${v.path}}}`}
                    </div>
                  </button>
                ))
              ) : (
                // Texts i18n tab
                <div>
                  {/* Custom text key input */}
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={customTextKey}
                        onChange={(e) => setCustomTextKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                        placeholder="KEY_PERSONALIZADA"
                        className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customTextKey) {
                            onSelect(`{{TEXT.${customTextKey}}}`);
                            setIsOpen(false);
                            setCustomTextKey('');
                          }
                        }}
                        disabled={!customTextKey}
                        className="px-2 py-1.5 text-xs bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                      >
                        Insertar
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Usa textos de /admin/texts
                    </p>
                  </div>
                  
                  {/* Common text keys */}
                  {COMMON_TEXT_KEYS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => {
                        onSelect(`{{TEXT.${t.key}}}`);
                        setIsOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-purple-50 dark:hover:bg-purple-900/20 border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {t.description}
                      </div>
                      <div className="text-xs text-purple-500 dark:text-purple-400 font-mono">
                        {`{{TEXT.${t.key}}}`}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ============= MESSAGE BLOCK EDITORS =============

interface BlockEditorProps<T extends MessageBlock> {
  block: T;
  onChange: (updates: Partial<T>) => void;
  onDelete: () => void;
  onInsertVariable: (variable: string) => void;
  readOnly?: boolean;
  nodes?: NodeOption[];
  flows?: FlowOption[];
}

const TextBlockEditor: React.FC<BlockEditorProps<TextBlock>> = ({
  block,
  onChange,
  onDelete,
  onInsertVariable,
  readOnly,
  nodes = [],
  flows = [],
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleInsertVariable = (variable: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = block.content || '';
      const newText = text.substring(0, start) + variable + text.substring(end);
      onChange({ content: newText });
    } else {
      onChange({ content: (block.content || '') + variable });
    }
  };

return (
  <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 bg-white dark:bg-gray-900 shadow-sm group/block transition-all hover:border-blue-300 dark:hover:border-blue-700">
    
    {/* Header Section */}
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400">
          {BlockIcons.text}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Mensaje de Texto</h3>
        </div>
      </div>

      {!readOnly && (
        <button 
          onClick={onDelete} 
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
          title="Eliminar bloque"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>

    {/* Editor Container CORREGIDO:
       1. Eliminado 'overflow-hidden' para que el menú de variables pueda salir.
       2. Añadido 'relative z-0' para el contexto de apilamiento.
    */}
    <div className="w-full border border-gray-300 dark:border-gray-600 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all bg-white dark:bg-gray-800 relative z-0">
      
      {/* Text Area */}
      <textarea
        ref={textareaRef}
        value={block.content || ''}
        onChange={(e) => onChange({ content: e.target.value })}
        disabled={readOnly}
        rows={3}
        /* CORRECCIÓN: Añadido 'rounded-t-lg' explícitamente */
        className="w-full px-3 py-3 text-sm text-gray-800 dark:text-gray-100 bg-transparent border-none outline-none resize-y min-h-[80px] placeholder-gray-400 dark:placeholder-gray-500 rounded-t-lg"
        placeholder="Escribe el contenido del mensaje..."
      />

      {/* Toolbar (Bottom) */}
      {/* CORRECCIÓN: Añadido 'rounded-b-lg' explícitamente */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-600 rounded-b-lg">
        
        {/* Left: Parse Mode Selector */}
        <div className="flex items-center gap-2">
          <select
            value={block.parseMode || ''}
            onChange={(e) => onChange({ parseMode: (e.target.value || undefined) as ParseMode })}
            disabled={readOnly}
            className="text-[11px] font-medium px-2 py-1 rounded border border-transparent hover:border-gray-300 dark:hover:border-gray-500 bg-transparent text-gray-600 dark:text-gray-300 outline-none cursor-pointer transition-colors focus:bg-white dark:focus:bg-gray-600"
            title="Formato de texto"
          >
            <option value="">Texto plano</option>
            <option value="Markdown">Markdown</option>
            <option value="MarkdownV2">Markdown V2</option>
            <option value="HTML">HTML</option>
          </select>
        </div>

        {/* Right: Variable Selector */}
        <div className="flex items-center border-l border-gray-200 dark:border-gray-600 pl-2">
           <VariableSelector onSelect={handleInsertVariable} />
        </div>
      </div>
    </div>

    {/* Helpers & Previews */}
    <div className="mt-2 space-y-2">
      
      {/* Markdown Hint */}
      {block.parseMode && (
        <div className="flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 px-1">
          <span className="mt-0.5">💡</span>
          <span>
            {block.parseMode === 'Markdown' && <span>Usa <b>*negrita*</b>, <i>_cursiva_</i>, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">código</code>, [enlace](url)</span>}
            {block.parseMode === 'MarkdownV2' && <span>Usa <b>*negrita*</b>, <i>_cursiva_</i>, <u>__subrayado__</u>, ~tachado~, <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">código</code></span>}
            {block.parseMode === 'HTML' && <span>Usa &lt;b&gt;negrita&lt;/b&gt;, &lt;i&gt;cursiva&lt;/i&gt;, &lt;code&gt;código&lt;/code&gt;</span>}
          </span>
        </div>
      )}

      {/* Detected Variables Badge */}
      {block.content && block.content.includes('{{') && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs px-1">
          <span className="text-blue-600 dark:text-blue-400 font-medium text-[10px] uppercase tracking-wide">Variables:</span>
          {block.content.match(/\{\{[^}]+\}\}/g)?.map((v, i) => (
            <span key={i} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/40 border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded text-[10px] font-mono">
              {v}
            </span>
          ))}
        </div>
      )}
    </div>

    {/* Message Preview */}
    <MessagePreview blocks={[block]} />

    {/* Keyboard Component */}
    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
      <BlockKeyboardEditor
        keyboard={block.keyboard}
        onChange={(keyboard) => onChange({ keyboard })}
        readOnly={readOnly}
        nodes={nodes}
        flows={flows}
      />
    </div>
  </div>
);
};


const ImageBlockEditor: React.FC<BlockEditorProps<ImageBlock>> = ({
  block,
  onChange,
  onDelete,
  readOnly,
  nodes = [],
  flows = [],
}) => (
  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {BlockIcons.image}
        <span>Imagen</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Parse Mode selector for caption */}
        <select
          value={block.parseMode || ''}
          onChange={(e) => onChange({ parseMode: (e.target.value || undefined) as ParseMode })}
          disabled={readOnly}
          className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          title="Formato del caption"
        >
          <option value="">Sin formato</option>
          <option value="Markdown">Markdown</option>
          <option value="MarkdownV2">MarkdownV2</option>
          <option value="HTML">HTML</option>
        </select>
        {!readOnly && (
          <button onClick={onDelete} className="text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
    
    {/* File Upload or URL */}
    <FileUpload
      mediaType="image"
      value={block.url || ''}
      onChange={(url) => onChange({ url })}
      disabled={readOnly}
    />
    
    <input
      type="text"
      value={block.caption || ''}
      onChange={(e) => onChange({ caption: e.target.value })}
      disabled={readOnly}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
      placeholder="Caption (opcional)..."
    />
    {block.url && (
      <div className="mt-2">
        <img src={block.url} alt="Preview" className="max-h-32 rounded" onError={(e) => (e.currentTarget.style.display = 'none')} />
      </div>
    )}
    
    {/* Message Preview */}
    <MessagePreview blocks={[block]} />
    
    {/* Keyboard for this block */}
    <BlockKeyboardEditor
      keyboard={block.keyboard}
      onChange={(keyboard) => onChange({ keyboard })}
      readOnly={readOnly}
      nodes={nodes}
      flows={flows}
    />
  </div>
);

const DelayBlockEditor: React.FC<BlockEditorProps<DelayBlock>> = ({
  block,
  onChange,
  onDelete,
  readOnly,
}) => (
  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {BlockIcons.delay}
        <span>Esperar</span>
      </div>
      {!readOnly && (
        <button onClick={onDelete} className="text-red-500 hover:text-red-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
    <div className="flex items-center gap-2">
      <input
        type="number"
        value={block.seconds || 1}
        onChange={(e) => onChange({ seconds: parseInt(e.target.value) || 1 })}
        disabled={readOnly}
        min={1}
        max={60}
        className="w-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <span className="text-sm text-gray-600 dark:text-gray-400">segundos</span>
    </div>
  </div>
);

// Document Block Editor
const DocumentBlockEditor: React.FC<BlockEditorProps<DocumentBlock>> = ({
  block,
  onChange,
  onDelete,
  readOnly,
  nodes = [],
  flows = [],
}) => (
  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {BlockIcons.document}
        <span>Documento</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Parse Mode selector for caption */}
        <select
          value={block.parseMode || ''}
          onChange={(e) => onChange({ parseMode: (e.target.value || undefined) as ParseMode })}
          disabled={readOnly}
          className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          title="Formato del caption"
        >
          <option value="">Sin formato</option>
          <option value="Markdown">Markdown</option>
          <option value="MarkdownV2">MarkdownV2</option>
          <option value="HTML">HTML</option>
        </select>
        {!readOnly && (
          <button onClick={onDelete} className="text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
    
    {/* File Upload or URL */}
    <FileUpload
      mediaType="document"
      value={block.url || ''}
      onChange={(url) => onChange({ url })}
      disabled={readOnly}
    />
    
    <input
      type="text"
      value={block.filename || ''}
      onChange={(e) => onChange({ filename: e.target.value })}
      disabled={readOnly}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2 mb-2"
      placeholder="Nombre del archivo (opcional)..."
    />
    <input
      type="text"
      value={block.caption || ''}
      onChange={(e) => onChange({ caption: e.target.value })}
      disabled={readOnly}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Caption (opcional)..."
    />
    
    {/* Message Preview */}
    <MessagePreview blocks={[block]} />
    
    {/* Keyboard for this block */}
    <BlockKeyboardEditor
      keyboard={block.keyboard}
      onChange={(keyboard) => onChange({ keyboard })}
      readOnly={readOnly}
      nodes={nodes}
      flows={flows}
    />
  </div>
);

// Audio Block Editor
const AudioBlockEditor: React.FC<BlockEditorProps<AudioBlock>> = ({
  block,
  onChange,
  onDelete,
  readOnly,
}) => (
  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {BlockIcons.audio}
        <span>Audio</span>
      </div>
      {!readOnly && (
        <button onClick={onDelete} className="text-red-500 hover:text-red-700">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
    </div>
    
    {/* File Upload or URL */}
    <FileUpload
      mediaType="audio"
      value={block.url || ''}
      onChange={(url) => onChange({ url })}
      disabled={readOnly}
    />
    
    <label className="flex items-center gap-2 mt-2">
      <input
        type="checkbox"
        checked={block.isVoiceNote || false}
        onChange={(e) => onChange({ isVoiceNote: e.target.checked })}
        disabled={readOnly}
        className="rounded border-gray-300 dark:border-gray-600"
      />
      <span className="text-sm text-gray-600 dark:text-gray-400">
        Enviar como nota de voz (círculo azul en Telegram)
      </span>
    </label>
    
    {/* Message Preview */}
    <MessagePreview blocks={[block]} />
    
    {/* Keyboard for this block */}
    <BlockKeyboardEditor
      keyboard={block.keyboard}
      onChange={(keyboard) => onChange({ keyboard })}
      readOnly={readOnly}
    />
  </div>
);

// Video Block Editor
const VideoBlockEditor: React.FC<BlockEditorProps<VideoBlock>> = ({
  block,
  onChange,
  onDelete,
  readOnly,
  nodes = [],
  flows = [],
}) => (
  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {BlockIcons.video}
        <span>Video</span>
      </div>
      <div className="flex items-center gap-2">
        {/* Parse Mode selector for caption */}
        <select
          value={block.parseMode || ''}
          onChange={(e) => onChange({ parseMode: (e.target.value || undefined) as ParseMode })}
          disabled={readOnly}
          className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          title="Formato del caption"
        >
          <option value="">Sin formato</option>
          <option value="Markdown">Markdown</option>
          <option value="MarkdownV2">MarkdownV2</option>
          <option value="HTML">HTML</option>
        </select>
        {!readOnly && (
          <button onClick={onDelete} className="text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
    
    {/* File Upload or URL */}
    <FileUpload
      mediaType="video"
      value={block.url || ''}
      onChange={(url) => onChange({ url })}
      disabled={readOnly}
    />
    
    <input
      type="text"
      value={block.caption || ''}
      onChange={(e) => onChange({ caption: e.target.value })}
      disabled={readOnly}
      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
      placeholder="Caption (opcional)..."
    />
    {block.url && (
      <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
        <video src={block.url} className="max-h-24 rounded" controls onError={(e) => (e.currentTarget.style.display = 'none')} />
      </div>
    )}
    
    {/* Message Preview */}
    <MessagePreview blocks={[block]} />
    
    {/* Keyboard for this block */}
    <BlockKeyboardEditor
      keyboard={block.keyboard}
      onChange={(keyboard) => onChange({ keyboard })}
      readOnly={readOnly}
      nodes={nodes}
      flows={flows}
    />
  </div>
);
// ============= COMPACT BLOCK KEYBOARD EDITOR =============

interface BlockKeyboardEditorProps {
  keyboard?: KeyboardConfig;
  onChange: (keyboard: KeyboardConfig | undefined) => void;
  readOnly?: boolean;
  nodeId?: string; // For generating unique callback data
  nodes?: NodeOption[];
  flows?: FlowOption[];
}

// Button Card Component - Expandable mini-card for each button
interface ButtonCardProps {
  button: KeyboardButton;
  keyboardType: 'inline' | 'reply';
  onUpdate: (updates: Partial<KeyboardButton>) => void;
  onRemove: () => void;
  readOnly?: boolean;
  nodeId?: string;
  nodes?: NodeOption[];
  flows?: FlowOption[];
}

const ButtonCard: React.FC<ButtonCardProps> = ({ button, keyboardType, onUpdate, onRemove, readOnly, nodeId, nodes = [], flows = [] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Get current action mode
  const getActionMode = (): ButtonActionMode => {
    if (button.onClick?.mode) return button.onClick.mode;
    if (button.onClick?.url || button.url) return 'url';
    if (button.onClick?.targetNodeId || button.targetNodeId) return 'goto_node';
    if (button.onClick?.targetFlowId || button.targetFlowId) return 'goto_flow';
    return 'continue';
  };

  const actionMode = getActionMode();

  const updateOnClick = (updates: Partial<ButtonOnClick>) => {
    const currentOnClick = button.onClick || { mode: 'continue' };
    onUpdate({ onClick: { ...currentOnClick, ...updates } });
  };

  // Generate unique callback data
  const generateCallbackData = () => {
    const prefix = nodeId ? `flow:${nodeId}:btn:${button.id}` : `btn_${button.id}`;
    return prefix;
  };

  // Ensure callback data is set
  React.useEffect(() => {
    if (keyboardType === 'inline' && !button.callbackData) {
      onUpdate({ callbackData: generateCallbackData() });
    }
  }, []);

  // Check if button needs configuration but doesn't have it
  const needsConfiguration = (
    (actionMode === 'goto_node' && !button.onClick?.targetNodeId && !button.targetNodeId) ||
    (actionMode === 'goto_flow' && !button.onClick?.targetFlowId && !button.targetFlowId) ||
    (actionMode === 'url' && !button.onClick?.url && !button.url)
  );

  return (
    <div className={`
      relative group w-full border rounded-lg transition-all overflow-hidden
      ${isExpanded 
        ? 'border-blue-400 dark:border-blue-600 bg-white dark:bg-gray-800 shadow-md' 
        : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/50 hover:border-blue-300'
      }
    `}>
      {/* Remove Button X */}
      {!readOnly && (
        <button
          onClick={onRemove}
          className="absolute top-1 left-1 w-5 h-5 bg-gray-100 hover:bg-red-500 text-gray-500 hover:text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
        >
          ×
        </button>
      )}

      {/* Collapsed View - Click to expand */}
      <div 
        className="p-2.5 cursor-pointer"
        onClick={() => !readOnly && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {/* Button icon */}
          <div className={`
            w-6 h-6 rounded flex items-center justify-center shrink-0
            ${keyboardType === 'inline' 
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400' 
              : 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
            }
          `}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <rect x="3" y="8" width="18" height="8" rx="2" strokeWidth="2"/>
            </svg>
          </div>
          
          {/* Button text */}
          <div className="flex-1 min-w-0">
            <input
              type="text"
              value={button.text}
              onChange={(e) => {
                e.stopPropagation();
                onUpdate({ text: e.target.value });
              }}
              onClick={(e) => e.stopPropagation()}
              disabled={readOnly}
              className="w-full px-2 py-1 text-sm font-medium border-0 bg-transparent text-gray-800 dark:text-gray-200 focus:outline-none focus:bg-white dark:focus:bg-gray-700 rounded"
              placeholder="Texto del botón"
            />
          </div>

          {/* Action indicator */}
          <div className="flex items-center gap-1.5">
            {needsConfiguration && (
              <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[9px] font-medium rounded">
                ⚠️ Configurar
              </span>
            )}
            {actionMode === 'continue' && (
              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[9px] font-medium rounded flex items-center gap-0.5">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
                Continúa
              </span>
            )}
            {actionMode === 'goto_node' && (button.onClick?.targetNodeId || button.targetNodeId) && (
              <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[9px] font-medium rounded flex items-center gap-0.5">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                → Nodo
              </span>
            )}
            {actionMode === 'goto_flow' && (
              <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[9px] font-medium rounded">
                → Flow
              </span>
            )}
            {actionMode === 'url' && (
              <span className="px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 text-[9px] font-medium rounded">
                🔗 URL
              </span>
            )}

            {/* Expand arrow */}
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded View - Action Configuration */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50 space-y-3">
          {/* Callback ID (for inline) */}
          {keyboardType === 'inline' && (
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                Callback ID (auto-generado)
              </label>
              <input
                type="text"
                value={button.callbackData || generateCallbackData()}
                onChange={(e) => onUpdate({ callbackData: e.target.value })}
                disabled={readOnly}
                className="w-full px-2 py-1.5 text-xs font-mono border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                placeholder="callback_data"
              />
            </div>
          )}

          {/* Message Mode Selection - Only for inline keyboards */}
          {keyboardType === 'inline' && (
            <div>
              <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-2">
                Modo de mensaje:
              </label>
              <div className="space-y-1">
                {/* Send New Message */}
                <label className={`
                  flex items-center gap-2 p-2 rounded border cursor-pointer transition-all
                  ${(button.onClick?.messageMode !== 'edit_message')
                    ? 'border-green-400 bg-green-50 dark:bg-green-900/30' 
                    : 'border-gray-200 dark:border-gray-600 hover:border-green-300'
                  }
                `}>
                  <input
                    type="radio"
                    name={`message-mode-${button.id}`}
                    checked={(button.onClick?.messageMode !== 'edit_message')}
                    onChange={() => updateOnClick({ messageMode: 'send_new' })}
                    disabled={readOnly}
                    className="text-green-500"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Enviar nuevo mensaje</div>
                    <div className="text-[10px] text-gray-500">Envía un mensaje nuevo al chat</div>
                  </div>
                </label>

                {/* Edit Message */}
                <label className={`
                  flex items-center gap-2 p-2 rounded border cursor-pointer transition-all
                  ${(button.onClick?.messageMode === 'edit_message')
                    ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/30' 
                    : 'border-gray-200 dark:border-gray-600 hover:border-orange-300'
                  }
                `}>
                  <input
                    type="radio"
                    name={`message-mode-${button.id}`}
                    checked={(button.onClick?.messageMode === 'edit_message')}
                    onChange={() => updateOnClick({ messageMode: 'edit_message' })}
                    disabled={readOnly}
                    className="text-orange-500"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Editar mensaje</div>
                    <div className="text-[10px] text-gray-500">Modifica el mensaje actual sin enviar uno nuevo</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Action Selection */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-2">
              Al hacer click:
            </label>
            <div className="space-y-1.5">
              {/* Continue flow */}
              <label className={`
                flex items-center gap-2 p-2 rounded border cursor-pointer transition-all
                ${actionMode === 'continue' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                  : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                }
              `}>
                <input
                  type="radio"
                  name={`action-${button.id}`}
                  checked={actionMode === 'continue'}
                  onChange={() => updateOnClick({ mode: 'continue', targetNodeId: undefined, targetFlowId: undefined, url: undefined })}
                  disabled={readOnly}
                  className="text-blue-500"
                />
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Continuar flow</div>
                  <div className="text-[10px] text-gray-500">Sigue al siguiente nodo conectado</div>
                </div>
              </label>

              {/* Go to specific node */}
              <label className={`
                flex items-start gap-2 p-2 rounded border cursor-pointer transition-all
                ${actionMode === 'goto_node' 
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' 
                  : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                }
              `}>
                <input
                  type="radio"
                  name={`action-${button.id}`}
                  checked={actionMode === 'goto_node'}
                  onChange={() => updateOnClick({ mode: 'goto_node', targetFlowId: undefined, url: undefined })}
                  disabled={readOnly}
                  className="text-purple-500 mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Ir a nodo específico</div>
                  <div className="text-[10px] text-gray-500 mb-1">Salta a otro nodo del flow</div>
                  {actionMode === 'goto_node' && (
                    <select
                      value={button.onClick?.targetNodeId || button.targetNodeId || ''}
                      onChange={(e) => updateOnClick({ targetNodeId: e.target.value })}
                      disabled={readOnly}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      <option value="">-- Seleccionar nodo --</option>
                      {nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.label || node.id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              {/* Go to another flow */}
              <label className={`
                flex items-start gap-2 p-2 rounded border cursor-pointer transition-all
                ${actionMode === 'goto_flow' 
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' 
                  : 'border-gray-200 dark:border-gray-600 hover:border-indigo-300'
                }
              `}>
                <input
                  type="radio"
                  name={`action-${button.id}`}
                  checked={actionMode === 'goto_flow'}
                  onChange={() => updateOnClick({ mode: 'goto_flow', targetNodeId: undefined, url: undefined })}
                  disabled={readOnly}
                  className="text-indigo-500 mt-0.5"
                />
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Ir a otro flow</div>
                  <div className="text-[10px] text-gray-500 mb-1">Inicia otro flujo de automatización</div>
                  {actionMode === 'goto_flow' && (
                    <select
                      value={button.onClick?.targetFlowId || button.targetFlowId || ''}
                      onChange={(e) => updateOnClick({ targetFlowId: e.target.value })}
                      disabled={readOnly}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      <option value="">-- Seleccionar flow --</option>
                      {flows.map((flow) => (
                        <option key={flow.id} value={flow.id}>
                          {flow.name || flow.id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              {/* Open URL (inline only) */}
              {keyboardType === 'inline' && (
                <label className={`
                  flex items-start gap-2 p-2 rounded border cursor-pointer transition-all
                  ${actionMode === 'url' 
                    ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30' 
                    : 'border-gray-200 dark:border-gray-600 hover:border-cyan-300'
                  }
                `}>
                  <input
                    type="radio"
                    name={`action-${button.id}`}
                    checked={actionMode === 'url'}
                    onChange={() => updateOnClick({ mode: 'url', targetNodeId: undefined, targetFlowId: undefined })}
                    disabled={readOnly}
                    className="text-cyan-500 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Abrir URL</div>
                    <div className="text-[10px] text-gray-500 mb-1">Abre un enlace externo</div>
                    {actionMode === 'url' && (
                      <input
                        type="url"
                        value={button.onClick?.url || button.url || ''}
                        onChange={(e) => updateOnClick({ url: e.target.value })}
                        disabled={readOnly}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        placeholder="https://..."
                      />
                    )}
                  </div>
                </label>
              )}

              {/* No action */}
              <label className={`
                flex items-center gap-2 p-2 rounded border cursor-pointer transition-all
                ${actionMode === 'none' 
                  ? 'border-gray-500 bg-gray-100 dark:bg-gray-900/50' 
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'
                }
              `}>
                <input
                  type="radio"
                  name={`action-${button.id}`}
                  checked={actionMode === 'none'}
                  onChange={() => updateOnClick({ mode: 'none', targetNodeId: undefined, targetFlowId: undefined, url: undefined })}
                  disabled={readOnly}
                  className="text-gray-500"
                />
                <div className="flex-1">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Sin acción</div>
                  <div className="text-[10px] text-gray-500">Solo envía callback, no continúa flow</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BlockKeyboardEditor: React.FC<BlockKeyboardEditorProps> = ({ keyboard, onChange, readOnly, nodeId, nodes = [], flows = [] }) => {
  const [isExpanded, setIsExpanded] = useState(!!keyboard?.rows?.some(r => r.buttons.length > 0));

  const addKeyboard = () => {
    const btnId = Date.now().toString();
    onChange({
      type: 'inline',
      rows: [{ 
        id: Date.now().toString(), 
        buttons: [{ 
          id: btnId, 
          text: 'Botón', 
          callbackData: `flow:${nodeId || 'node'}:btn:${btnId}`,
          onClick: { mode: 'continue' }
        }] 
      }],
    });
    setIsExpanded(true);
  };

  const removeRow = (rowIndex: number) => {
    if (!keyboard) return;
    const newRows = keyboard.rows.filter((_, i) => i !== rowIndex);
    onChange({ ...keyboard, rows: newRows });
  };

  const removeKeyboard = () => {
    onChange(undefined);
    setIsExpanded(false);
  };

  const addButton = (rowIndex: number) => {
    if (!keyboard) return;
    const btnId = Date.now().toString();
    const newRows = [...keyboard.rows];
    newRows[rowIndex].buttons.push({
      id: btnId,
      text: 'Botón',
      callbackData: `flow:${nodeId || 'node'}:btn:${btnId}`,
      onClick: { mode: 'continue' }
    });
    onChange({ ...keyboard, rows: newRows });
  };

  const updateButton = (rowIndex: number, btnIndex: number, updates: Partial<KeyboardButton>) => {
    if (!keyboard) return;
    const newRows = [...keyboard.rows];
    newRows[rowIndex].buttons[btnIndex] = { ...newRows[rowIndex].buttons[btnIndex], ...updates };
    onChange({ ...keyboard, rows: newRows });
  };

  const removeButton = (rowIndex: number, btnIndex: number) => {
    if (!keyboard) return;
    const newRows = [...keyboard.rows];
    newRows[rowIndex].buttons = newRows[rowIndex].buttons.filter((_, i) => i !== btnIndex);
    if (newRows[rowIndex].buttons.length === 0 && newRows.length > 1) {
      newRows.splice(rowIndex, 1);
    }
    onChange({ ...keyboard, rows: newRows });
  };

  const addRow = () => {
    if (!keyboard) return;
    const btnId = Date.now().toString();
    onChange({
      ...keyboard,
      rows: [...keyboard.rows, { 
        id: Date.now().toString(), 
        buttons: [{ 
          id: btnId, 
          text: 'Botón', 
          callbackData: `flow:${nodeId || 'node'}:btn:${btnId}`,
          onClick: { mode: 'continue' }
        }] 
      }],
    });
  };

  if (!keyboard || !isExpanded) {
    return (
      <button
        type="button"
        onClick={addKeyboard}
        disabled={readOnly}
        className="mt-2 w-full py-1.5 px-3 text-xs border border-dashed border-gray-300 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 flex items-center justify-center gap-1.5 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Añadir teclado con botones
      </button>
    );
  }

  return (
    <div className="mt-2 border border-blue-200 dark:border-blue-800 rounded-xl p-3 bg-slate-50 dark:bg-slate-900/50 shadow-sm">

      {/* Header */}
      <div className="flex flex-col gap-2 mb-3 border-b border-blue-100 dark:border-blue-800/50 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded text-blue-600 dark:text-blue-400">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2" strokeWidth="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M7 12h10" strokeWidth="2" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">Teclado Interactivo</span>
          </div>
          {!readOnly && (
            <button
              onClick={removeKeyboard}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="Quitar teclado"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
            </button>
          )}
        </div>

        <select
          value={keyboard.type}
          onChange={(e) => onChange({ ...keyboard, type: e.target.value as 'inline' | 'reply' })}
          disabled={readOnly}
          className="w-full text-[11px] px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
        >
          <option value="inline">Inline (Botones bajo mensaje)</option>
          <option value="reply">Reply (Menú personalizado)</option>
        </select>
      </div>

      {/* Button rows */}
      <div className="space-y-3">
        {keyboard.rows.map((row, rowIndex) => (
          <div key={row.id} className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 shadow-sm">
            {/* Row header */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                Fila {rowIndex + 1}
              </span>
              {!readOnly && keyboard.rows.length > 1 && (
                <button onClick={() => removeRow(rowIndex)} className="text-gray-400 hover:text-red-500 text-xs">
                  ✕ Eliminar fila
                </button>
              )}
            </div>

            {/* Buttons in row */}
            <div className="space-y-2">
              {row.buttons.map((btn, btnIndex) => (
                <ButtonCard
                  key={btn.id}
                  button={btn}
                  keyboardType={keyboard.type as 'inline' | 'reply'}
                  onUpdate={(updates) => updateButton(rowIndex, btnIndex, updates)}
                  onRemove={() => removeButton(rowIndex, btnIndex)}
                  readOnly={readOnly}
                  nodeId={nodeId}
                  nodes={nodes}
                  flows={flows}
                />
              ))}

              {/* Add button */}
              {!readOnly && (
                <button
                  onClick={() => addButton(rowIndex)}
                  className="w-full py-2 flex items-center justify-center gap-1 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-400 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
                >
                  <span className="text-sm font-bold">+</span>
                  <span className="text-xs">Añadir botón a esta fila</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add row */}
      {!readOnly && (
        <button
          onClick={addRow}
          className="mt-3 w-full py-2 text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
        >
          + Nueva fila de botones
        </button>
      )}
    </div>
  );
};

// ============= MAIN COMPONENT =============

// Helper function to extract all buttons from blocks and check for issues
function getButtonValidation(blocks: MessageBlock[]): { hasWarnings: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  for (const block of blocks) {
    if ('keyboard' in block && block.keyboard?.rows) {
      for (const row of block.keyboard.rows) {
        for (const btn of row.buttons) {
          const mode = btn.onClick?.mode || 'continue';
          
          // Check for buttons with goto_node but no target
          if (mode === 'goto_node' && !btn.onClick?.targetNodeId && !btn.targetNodeId) {
            warnings.push(`El botón "${btn.text}" tiene acción "Ir a nodo" pero no tiene nodo destino configurado`);
          }
          
          // Check for buttons with goto_flow but no target
          if (mode === 'goto_flow' && !btn.onClick?.targetFlowId && !btn.targetFlowId) {
            warnings.push(`El botón "${btn.text}" tiene acción "Ir a flow" pero no tiene flow destino configurado`);
          }
          
          // Check for URL buttons without URL
          if (mode === 'url' && !btn.onClick?.url && !btn.url) {
            warnings.push(`El botón "${btn.text}" tiene acción "Abrir URL" pero no tiene URL configurada`);
          }
        }
      }
    }
  }
  
  return { hasWarnings: warnings.length > 0, warnings };
}

const MessageEditor: React.FC<MessageEditorProps> = ({ config, onChange, readOnly, nodes = [], flows = [] }) => {
  const blocks = config.messageBlocks || [];
  
  // Get button validation warnings
  const validation = useMemo(() => getButtonValidation(blocks), [blocks]);
  
  // Detect {{TEXT.KEY}} patterns in all blocks
  const detectedTextKeys = useMemo(() => detectTextKeys(blocks), [blocks]);
  const hasI18nTexts = detectedTextKeys.length > 0;

  // Initialize with legacy content if no blocks
  React.useEffect(() => {
    if (!config.messageBlocks && config.messageContent) {
      onChange({
        messageBlocks: [
          {
            id: Date.now().toString(),
            type: 'text',
            content: config.messageContent,
          },
        ],
      });
    }
  }, []);

  const addBlock = (type: MessageBlock['type']) => {
    const newBlock: MessageBlock = {
      id: Date.now().toString(),
      type,
    } as MessageBlock;

    if (type === 'text') (newBlock as TextBlock).content = '';
    if (type === 'image') (newBlock as ImageBlock).url = '';
    if (type === 'document') (newBlock as DocumentBlock).url = '';
    if (type === 'audio') (newBlock as AudioBlock).url = '';
    if (type === 'video') (newBlock as VideoBlock).url = '';
    if (type === 'delay') (newBlock as DelayBlock).seconds = 1;

    onChange({ messageBlocks: [...blocks, newBlock] });
  };

  const updateBlock = (index: number, updates: Partial<MessageBlock>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates } as MessageBlock;
    onChange({ messageBlocks: newBlocks });
  };

  const deleteBlock = (index: number) => {
    onChange({ messageBlocks: blocks.filter((_, i) => i !== index) });
  };

  const renderBlockEditor = (block: MessageBlock, index: number) => {
    const commonProps = {
      onDelete: () => deleteBlock(index),
      onInsertVariable: (v: string) => { },
      readOnly,
      nodes,
      flows,
    };

    switch (block.type) {
      case 'text':
        return (
          <TextBlockEditor
            key={block.id}
            block={block as TextBlock}
            onChange={(updates) => updateBlock(index, updates as Partial<MessageBlock>)}
            {...commonProps}
          />
        );
      case 'image':
        return (
          <ImageBlockEditor
            key={block.id}
            block={block as ImageBlock}
            onChange={(updates) => updateBlock(index, updates as Partial<MessageBlock>)}
            {...commonProps}
          />
        );
      case 'document':
        return (
          <DocumentBlockEditor
            key={block.id}
            block={block as DocumentBlock}
            onChange={(updates) => updateBlock(index, updates as Partial<MessageBlock>)}
            {...commonProps}
          />
        );
      case 'audio':
        return (
          <AudioBlockEditor
            key={block.id}
            block={block as AudioBlock}
            onChange={(updates) => updateBlock(index, updates as Partial<MessageBlock>)}
            {...commonProps}
          />
        );
      case 'video':
        return (
          <VideoBlockEditor
            key={block.id}
            block={block as VideoBlock}
            onChange={(updates) => updateBlock(index, updates as Partial<MessageBlock>)}
            {...commonProps}
          />
        );
      case 'delay':
        return (
          <DelayBlockEditor
            key={block.id}
            block={block as DelayBlock}
            onChange={(updates) => updateBlock(index, updates as Partial<MessageBlock>)}
            {...commonProps}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-3">
      {/* i18n Configuration - Shows when {{TEXT.KEY}} is detected */}
      {hasI18nTexts && (
        <I18nConfigPanel
          config={config}
          onChange={onChange}
          detectedTextKeys={detectedTextKeys}
          readOnly={readOnly}
        />
      )}

      {/* Validation warnings */}
      {validation.hasWarnings && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-medium text-sm mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Botones requieren configuración
          </div>
          <ul className="space-y-1">
            {validation.warnings.map((warning, i) => (
              <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                <span className="mt-0.5">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blocks */}
      {blocks.map((block, index) => (
        <div key={block.id}>
          {renderBlockEditor(block, index)}
        </div>
      ))}

      {/* Add block buttons */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => addBlock('text')}
            className="flex items-center text-gray-700 dark:text-gray-300 gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dashed-border"
          >
            {BlockIcons.text} Texto
          </button>
          <button
            type="button"
            onClick={() => addBlock('image')}
            className="flex items-center text-gray-700 dark:text-gray-300 gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dashed-border"
          >
            {BlockIcons.image} Imagen
          </button>
          <button
            type="button"
            onClick={() => addBlock('document')}
            className="flex items-center text-gray-700 dark:text-gray-300 gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dashed-border"
          >
            {BlockIcons.document} Documento
          </button>
          <button
            type="button"
            onClick={() => addBlock('audio')}
            className="flex items-center text-gray-700 dark:text-gray-300 gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dashed-border"
          >
            {BlockIcons.audio} Audio
          </button>
          <button
            type="button"
            onClick={() => addBlock('video')}
            className="flex items-center text-gray-700 dark:text-gray-300 gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dashed-border"
          >
            {BlockIcons.video} Video
          </button>
          <button
            type="button"
            onClick={() => addBlock('delay')}
            className="flex items-center text-gray-700 dark:text-gray-300 gap-1 px-3 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dashed-border"
          >
            {BlockIcons.delay} Delay
          </button>
        </div>
      )}
    </div>
  );
};

export default MessageEditor;

/**
 * NodeConfigPanel - Right sidebar for node configuration
 */

import React, { useState, useEffect } from 'react';
import type { Node } from 'reactflow';
import type {
  NodeType,
  TriggerType,
  ActionType,
  DelayType,
  ConditionOperator,
  TriggerConfig,
  ActionConfig,
  DelayConfig,
  ConditionConfig,
  ConditionRule,
} from '../../types/flow';
import {
  TRIGGER_LABELS,
  ACTION_LABELS,
  DELAY_LABELS,
} from '../../types/flow';
import MessageEditor from './MessageEditor';
import DataCollectionEditor from './DataCollectionEditor';
import ApiCallEditor from './ApiCallEditor';

// Tipos simplificados para las listas de nodos y flows
interface NodeOption {
  id: string;
  label: string;
}

interface FlowOption {
  id: string;
  name: string;
}

interface NodeConfigPanelProps {
  node: Node;
  onClose: () => void;
  onChange: (nodeId: string, label: string, config: any) => void;
  readOnly?: boolean;
  /** Lista de nodos del flow actual para el selector de botones */
  nodes?: NodeOption[];
  /** Lista de flows disponibles para el selector de botones */
  flows?: FlowOption[];
}

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'es igual a',
  not_equals: 'no es igual a',
  contains: 'contiene',
  not_contains: 'no contiene',
  regex: 'coincide con regex',
  greater_than: 'mayor que',
  less_than: 'menor que',
  greater_or_equal: 'mayor o igual',
  less_or_equal: 'menor o igual',
  exists: 'existe',
  not_exists: 'no existe',
  is_empty: 'está vacío',
  is_not_empty: 'no está vacío',
  starts_with: 'empieza con',
  ends_with: 'termina con',
};

const AVAILABLE_FIELDS = [
  { path: 'message.text', label: 'Mensaje', type: 'string' },
  { path: 'user.firstName', label: 'Nombre del usuario', type: 'string' },
  { path: 'user.lastName', label: 'Apellido del usuario', type: 'string' },
  { path: 'user.username', label: 'Username', type: 'string' },
  { path: 'user.language', label: 'Idioma del usuario', type: 'language' },
  { path: 'session.category', label: 'Categoría', type: 'string' },
  { path: 'session.priority', label: 'Prioridad', type: 'string' },
  { path: 'session.tags', label: 'Tags', type: 'array' },
  { path: 'session.messageCount', label: 'Número de mensajes', type: 'number' },
  { path: 'agent.name', label: 'Nombre del agente', type: 'string' },
  { path: 'customFields', label: 'Campo personalizado', type: 'customField' },
  { path: 'variables', label: 'Variable', type: 'variable' },
];

// Idiomas soportados para condiciones
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


const CATEGORY_OPTIONS = [
  { value: 'support', label: 'Soporte' },
  { value: 'billing', label: 'Facturación' },
  { value: 'bug', label: 'Bug/Error' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Otro' },
]

const getTriggerIcon = (type: string) => {
  const props = {
    xmlns: "http://www.w3.org/2000/svg",
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case 'chat_created': // Icono: Burbuja de chat con signo más (+)
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="9" y1="10" x2="15" y2="10" />
          <line x1="12" y1="7" x2="12" y2="13" />
        </svg>
      );

    case 'message_received': // Icono: Sobre de carta (Email/Mensaje)
      return (
        <svg {...props}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );

    case 'command_received': // Icono: Terminal/Comando
      return (
        <svg {...props}>
          <polyline points="4 17 10 11 4 5" />
          <line x1="12" y1="19" x2="20" y2="19" />
        </svg>
      );

    case 'keyword_detected': // Icono: Lupa (Búsqueda)
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );

    case 'chat_assigned': // Icono: Usuario con signo más (Asignar persona)
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );

    case 'chat_closed': // Icono: Check en círculo (Completado)
      return (
        <svg {...props}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );

    case 'user_inactive': // Icono: Reloj (Tiempo)
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );

    case 'survey_answered': // Icono: Estrella (Rating/Encuesta)
      return (
        <svg {...props}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );

    case 'category_changed': // Icono: Carpeta (Categoría)
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );

    case 'tag_added': // Icono: Etiqueta (Tag)
      return (
        <svg {...props}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );

    case 'file_received': // Icono: Clip (Adjunto)
      return (
        <svg {...props}>
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      );

    case 'chat_reopened': // Icono: Flechas rotando (Reabrir/Refresh)
      return (
        <svg {...props}>
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      );

    case 'agent_online': // Icono: Usuario con check (Agente disponible)
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      );

    case 'sla_warning': // Icono: Triángulo de alerta (Warning)
      return (
        <svg {...props}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );

    default: // Icono por defecto (Rayo)
      return (
        <svg {...props}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
  }
};

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  node,
  onClose,
  onChange,
  readOnly = false,
  nodes = [],
  flows = [],
}) => {
  const [label, setLabel] = useState(node.data.label || '');
  const [config, setConfig] = useState(node.data.config || {});

  // Update local state when node changes
  useEffect(() => {
    setLabel(node.data.label || '');
    setConfig(node.data.config || {});
  }, [node.id, node.data]);

  // Save changes
  const handleSave = () => {
    if (!readOnly) {
      onChange(node.id, label, config);
    }
  };

  // Update config field
  const updateConfig = (field: string, value: any) => {
    if (readOnly) return;
    const newConfig = { ...config, [field]: value };
    setConfig(newConfig);
    onChange(node.id, label, newConfig);
  };

  // Render trigger config
  const renderTriggerConfig = () => {
    const triggerConfig = config as TriggerConfig;

    // Trigger type info with icons and descriptions
    const TRIGGER_INFO: Record<string, { description: string; color: string }> = {
      chat_created: { description: 'Cuando se inicia una nueva conversación', color: 'green' },
      message_received: { description: 'Cuando el usuario envía cualquier mensaje', color: 'blue' },
      command_received: { description: 'Cuando el usuario envía un comando (/start, /help)', color: 'cyan' },
      keyword_detected: { description: 'Cuando el mensaje contiene palabras clave', color: 'purple' },
      chat_assigned: { description: 'Cuando se asigna un agente al chat', color: 'indigo' },
      chat_closed: { description: 'Cuando se cierra la conversación', color: 'gray' },
      user_inactive: { description: 'Cuando el usuario no responde por X minutos', color: 'orange' },
      survey_answered: { description: 'Cuando el usuario responde una encuesta', color: 'yellow' },
      category_changed: { description: 'Cuando cambia la categoría del chat', color: 'cyan' },
      tag_added: { description: 'Cuando se añade un tag específico', color: 'pink' },
      file_received: { description: 'Cuando el usuario envía un archivo', color: 'teal' },
      chat_reopened: { description: 'Cuando se reabre un chat cerrado', color: 'amber' },
      agent_online: { description: 'Cuando un agente se conecta', color: 'emerald' },
      sla_warning: { description: 'Cuando el SLA está por vencer', color: 'red' },
    };

    const currentTriggerInfo = TRIGGER_INFO[triggerConfig.triggerType || ''];

    return (
      <div className="space-y-4">
        {/* Trigger type selector */}
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-md text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
          </div>
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Condición de Activación
          </label>
        </div>

        {/* Grid Container */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
          {Object.entries(TRIGGER_LABELS).map(([value, label]) => {
            // Obtenemos la info, pero ignoramos el icono emoji original
            const info = TRIGGER_INFO[value] || { description: '' };
            const isSelected = triggerConfig.triggerType === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => !readOnly && updateConfig('triggerType', value)}
                disabled={readOnly}
                className={`relative group flex flex-col items-start p-4 border rounded-xl transition-all duration-200 text-left ${isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500 shadow-sm z-10'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
              >
                {/* Header: Icono y Título */}
                <div className="flex items-center gap-3 mb-2 w-full">
                  <div className={`p-2 rounded-lg transition-colors ${isSelected
                    ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500'
                    }`}>
                    {getTriggerIcon(value)}
                  </div>
                  <span className={`font-semibold text-sm ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-200'
                    }`}>
                    {label}
                  </span>
                </div>

                {/* Descripción */}
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed pl-1">
                  {info.description || 'Activa el flujo cuando ocurre este evento.'}
                </p>

                {/* Checkmark Absolute (Solo visible si seleccionado) */}
                {isSelected && (
                  <div className="absolute top-3 right-3 text-blue-500 animate-in fade-in zoom-in duration-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected trigger indicator */}
        {currentTriggerInfo && (
          <div className="mt-4 relative group overflow-hidden border border-green-200 dark:border-green-800 rounded-xl bg-gradient-to-br from-green-50 to-white dark:from-green-900/20 dark:to-gray-800/50 p-4 shadow-sm transition-all hover:shadow-md">

            {/* Decoración de fondo sutil */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-green-100 dark:bg-green-800/30 rounded-bl-full -mr-8 -mt-8 opacity-50 pointer-events-none" />

            <div className="flex items-start gap-4 relative z-10">

              {/* Icon Container */}
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-700/50 shadow-sm">
                <span className="text-xl">{
                  getTriggerIcon(triggerConfig.triggerType || '')
                }</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Trigger Configurado
                  </h4>

                  {/* Badge de "Activo" */}
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/60 border border-green-200 dark:border-green-800">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span className="text-[10px] font-medium text-green-700 dark:text-green-300 tracking-wide">Activo</span>
                  </span>
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {currentTriggerInfo.description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Command config */}
        {triggerConfig.triggerType === 'command_received' && (
          <div className="mt-3 border border-cyan-200 dark:border-cyan-800/50 rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden transition-all">

            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-cyan-50 to-transparent dark:from-cyan-900/10 border-b border-cyan-100 dark:border-cyan-800/30 flex items-center gap-2">
              <div className="p-1.5 bg-cyan-100 dark:bg-cyan-900 rounded-md text-cyan-600 dark:text-cyan-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Configuración de Comando
              </h3>
            </div>

            <div className="p-4 space-y-5">
              {/* Command name */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-2 block">
                  Comando (sin /)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-mono">/</span>
                  <input
                    type="text"
                    value={triggerConfig.command || ''}
                    onChange={(e) => updateConfig('command', e.target.value.replace(/^\//, '').toLowerCase())}
                    disabled={readOnly}
                    className="w-full pl-7 pr-3 py-2.5 text-sm font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                    placeholder="start"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  Ej: start, help, menu (sin la barra /)
                </p>
              </div>

              {/* Deep link info */}
              <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3 border border-cyan-200 dark:border-cyan-800/50">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div className="text-xs text-cyan-700 dark:text-cyan-300">
                    <span className="font-semibold">Deep Links:</span> Los comandos pueden tener parámetros vía 
                    <code className="mx-1 px-1 bg-cyan-100 dark:bg-cyan-800 rounded">t.me/bot?start=PARAM</code>
                  </div>
                </div>
              </div>

              {/* Parameter matching */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-2 block">
                  Coincidir parámetro
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'any', label: 'Cualquiera', desc: 'Sin filtro' },
                    { value: 'exact', label: 'Exacto', desc: 'Valor exacto' },
                    { value: 'contains', label: 'Contiene', desc: 'Incluye texto' },
                    { value: 'regex', label: 'Regex', desc: 'Expresión regular' },
                  ].map((opt) => {
                    const isSelected = (triggerConfig.commandParamMatch || 'any') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateConfig('commandParamMatch', opt.value)}
                        disabled={readOnly}
                        className={`relative flex flex-col items-center justify-center p-2.5 rounded-lg border transition-all duration-200 ${isSelected
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-cyan-300'
                        }`}
                      >
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-70">{opt.desc}</div>
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-cyan-500 rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Expected param value (if not 'any') */}
              {triggerConfig.commandParamMatch && triggerConfig.commandParamMatch !== 'any' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-2 block">
                    Valor del parámetro esperado
                  </label>
                  <input
                    type="text"
                    value={triggerConfig.commandParam || ''}
                    onChange={(e) => updateConfig('commandParam', e.target.value)}
                    disabled={readOnly}
                    className="w-full px-3 py-2.5 text-sm font-mono border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                    placeholder={triggerConfig.commandParamMatch === 'regex' ? '^ref_[a-z0-9]+$' : 'referral123'}
                  />
                </div>
              )}

              {/* Save variables section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 tracking-wide">Guardar en variables</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Save command to variable */}
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
                      Comando → Variable
                    </label>
                    <input
                      type="text"
                      value={triggerConfig.saveCommandTo || ''}
                      onChange={(e) => updateConfig('saveCommandTo', e.target.value.replace(/\s/g, '_'))}
                      disabled={readOnly}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                      placeholder="comando"
                    />
                  </div>

                  {/* Save param to variable */}
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
                      Parámetro → Variable
                    </label>
                    <input
                      type="text"
                      value={triggerConfig.saveParamTo || ''}
                      onChange={(e) => updateConfig('saveParamTo', e.target.value.replace(/\s/g, '_'))}
                      disabled={readOnly}
                      className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                      placeholder="referral_code"
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Usa <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">{'{{variable}}'}</code> en nodos posteriores
                </p>
              </div>

              {/* Preview */}
              {triggerConfig.command && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-2">
                    Vista previa
                  </div>
                  <div className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    <span className="text-cyan-600 dark:text-cyan-400">/{triggerConfig.command}</span>
                    {triggerConfig.commandParamMatch !== 'any' && triggerConfig.commandParam && (
                      <span className="text-gray-400"> {triggerConfig.commandParam}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Deep link: <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">t.me/tubot?{triggerConfig.command}={triggerConfig.commandParam || 'PARAM'}</code>
                  </div>
                  {(triggerConfig.saveCommandTo || triggerConfig.saveParamTo) && (
                    <div className="text-xs text-cyan-600 dark:text-cyan-400 mt-2 flex flex-wrap gap-2">
                      {triggerConfig.saveCommandTo && (
                        <span className="px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-900/30 rounded">
                          {`{{${triggerConfig.saveCommandTo}}}`} = comando
                        </span>
                      )}
                      {triggerConfig.saveParamTo && (
                        <span className="px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-900/30 rounded">
                          {`{{${triggerConfig.saveParamTo}}}`} = parámetro
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Keyword config */}
        {triggerConfig.triggerType === 'keyword_detected' && (
          <div className="mt-3 border border-purple-200 dark:border-purple-800/50 rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden transition-all">

            {/* Header con gradiente sutil */}
            <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-900/10 border-b border-purple-100 dark:border-purple-800/30 flex items-center gap-2">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-900 rounded-md text-purple-600 dark:text-purple-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path><line x1="9" y1="10" x2="15" y2="10"></line></svg>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                Configuración de Palabras Clave
              </h3>
            </div>

            <div className="p-4 space-y-5">

              {/* Selector de Tipo de Coincidencia */}
              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-2 block">
                  Lógica de coincidencia
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      value: 'contains',
                      label: 'Contiene',
                      desc: 'Frase parcial',
                      icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    },
                    {
                      value: 'exact',
                      label: 'Exacta',
                      desc: 'Palabra completa',
                      icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    },
                    {
                      value: 'regex',
                      label: 'Regex',
                      desc: 'Avanzado',
                      icon: <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                    },
                  ].map((opt) => {
                    const isSelected = (triggerConfig.keywordMatchType || 'contains') === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateConfig('keywordMatchType', opt.value)}
                        disabled={readOnly}
                        className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 group ${isSelected
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                      >
                        <div className={`mb-1.5 ${isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-purple-500'}`}>
                          {opt.icon}
                        </div>
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">{opt.desc}</div>

                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-purple-500 rounded-full shadow-sm animate-pulse" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Input de Keywords */}
              <div className="relative">
                <div className="flex justify-between items-end mb-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide">
                    Lista de palabras (1 por línea)
                  </label>
                  <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
                    {(triggerConfig.keywords || []).length} definidas
                  </span>
                </div>

                <div className="relative group">
                  <textarea
                    value={(triggerConfig.keywords || []).join('\n')}
                    onChange={(e) => updateConfig('keywords', e.target.value.split('\n'))}
                    disabled={readOnly}
                    rows={5}
                    className="w-full px-4 py-3 text-sm font-mono border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all placeholder-gray-400 dark:placeholder-gray-600 resize-none"
                    placeholder={triggerConfig.keywordMatchType === 'regex' ? "^hola|saludo\nprecio\n([a-z]+)" : "precio\nayuda\nsoporte\nnecesito info"}
                  />
                  {/* Decorative corner */}
                  <div className="absolute bottom-2 right-2 pointer-events-none">
                    <svg className="w-3 h-3 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /></svg>
                  </div>
                </div>

                {/* Tags Preview */}
                {(triggerConfig.keywords || []).filter(Boolean).length > 0 && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1 custom-scrollbar">
                      {triggerConfig.keywords?.filter(k => k.trim() !== '').map((kw, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-1 bg-purple-100 dark:bg-purple-900/40 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 text-xs rounded-md font-medium">
                          {triggerConfig.keywordMatchType === 'regex' && <span className="text-[9px] text-purple-400 mr-1">Rx</span>}
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Message received config */}
        {triggerConfig.triggerType === 'message_received' && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              💡 <strong>Tip:</strong> Este trigger se activa con cada mensaje.
              Combínalo con condiciones para filtrar mensajes específicos,
              o usa "Keyword Detected" si buscas palabras clave.
            </p>
          </div>
        )}

        {/* File received config */}
        {triggerConfig.triggerType === 'file_received' && (
          <div className="space-y-3 p-3 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filtrar por tipo de archivo
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'image', label: '🖼️ Imágenes', desc: 'JPG, PNG, GIF...' },
                { value: 'document', label: '📄 Documentos', desc: 'PDF, DOC, XLS...' },
                { value: 'audio', label: '🎵 Audio', desc: 'MP3, notas de voz' },
                { value: 'video', label: '🎬 Video', desc: 'MP4, video notes' },
              ].map((type) => {
                const isChecked = (triggerConfig.fileTypeFilter || []).includes(type.value as any);
                return (
                  <label key={type.value} className={`flex items-start gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${isChecked ? 'border-teal-500 bg-teal-100 dark:bg-teal-800' : 'border-gray-200 dark:border-gray-600'
                    }`}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const current = triggerConfig.fileTypeFilter || [];
                        const newFilter = e.target.checked
                          ? [...current, type.value]
                          : current.filter(t => t !== type.value);
                        updateConfig('fileTypeFilter', newFilter);
                      }}
                      disabled={readOnly}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-medium">{type.label}</div>
                      <div className="text-xs text-gray-500">{type.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            {!(triggerConfig.fileTypeFilter || []).length && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Si no seleccionas ninguno, se activará con cualquier tipo de archivo.
              </p>
            )}
          </div>
        )}

        {/* Inactivity config */}
        {triggerConfig.triggerType === 'user_inactive' && (
          <div className="space-y-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Minutos de inactividad
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={triggerConfig.inactivityMinutes || 5}
                  onChange={(e) => updateConfig('inactivityMinutes', parseInt(e.target.value))}
                  disabled={readOnly}
                  min={1}
                  max={1440}
                  className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">minutos sin respuesta</span>
              </div>
            </div>
            <div className="flex gap-2">
              {[5, 10, 15, 30, 60].map(min => (
                <button
                  key={min}
                  type="button"
                  onClick={() => updateConfig('inactivityMinutes', min)}
                  disabled={readOnly}
                  className={`px-2 py-1 text-xs rounded ${triggerConfig.inactivityMinutes === min
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                >
                  {min}m
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Survey filter */}
        {triggerConfig.triggerType === 'survey_answered' && (
          <div className="space-y-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filtrar por calificación
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'any', label: 'Todas', icon: '🌟' },
                { value: 'positive', label: 'Positivas', icon: '😊' },
                { value: 'negative', label: 'Negativas', icon: '😞' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateConfig('surveyRatingFilter', opt.value)}
                  disabled={readOnly}
                  className={`p-2 text-center border rounded-lg transition-colors ${(triggerConfig.surveyRatingFilter || 'any') === opt.value
                    ? 'border-yellow-500 bg-yellow-100 dark:bg-yellow-800'
                    : 'border-gray-200 dark:border-gray-600'
                    }`}
                >
                  <div className="text-xl">{opt.icon}</div>
                  <div className="text-xs font-medium">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tag added config */}
        {triggerConfig.triggerType === 'tag_added' && (
          <div className="space-y-3 p-3 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filtrar por tags específicos (opcional)
              </label>
              <input
                type="text"
                value={(triggerConfig.tagFilter || []).join(', ')}
                onChange={(e) => updateConfig('tagFilter', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="vip, urgente, premium"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Separa múltiples tags con comas. Dejar vacío para activar con cualquier tag.
              </p>
            </div>
          </div>
        )}

        {/* Category changed config */}
        {triggerConfig.triggerType === 'category_changed' && (
          <div className="space-y-3 p-3 bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filtrar por categorías (opcional)
              </label>
              <input
                type="text"
                value={(triggerConfig.categoryFilter || []).join(', ')}
                onChange={(e) => updateConfig('categoryFilter', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="ventas, soporte-tecnico, facturacion"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Se activa cuando el chat cambia a estas categorías.
              </p>
            </div>
          </div>
        )}

        {/* No config needed triggers */}
        {['chat_created', 'chat_assigned', 'chat_closed', 'chat_reopened', 'agent_online', 'sla_warning'].includes(triggerConfig.triggerType || '') && (
          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              ✓ Este trigger no requiere configuración adicional.
            </p>
          </div>
        )}
      </div>
    );
  };

  // Render condition config
  const renderConditionConfig = () => {
    const conditionConfig = config as ConditionConfig;
    const groups = conditionConfig.groups || [{ id: '1', operator: 'AND', rules: [] }];

    const addRule = (groupIndex: number) => {
      const newGroups = [...groups];
      newGroups[groupIndex].rules.push({
        id: Date.now().toString(),
        field: 'message.text',
        operator: 'contains',
        value: '',
      });
      updateConfig('groups', newGroups);
    };

    const updateRule = (groupIndex: number, ruleIndex: number, field: string, value: any) => {
      const newGroups = [...groups];
      newGroups[groupIndex].rules[ruleIndex] = {
        ...newGroups[groupIndex].rules[ruleIndex],
        [field]: value,
      };
      updateConfig('groups', newGroups);
    };

    const removeRule = (groupIndex: number, ruleIndex: number) => {
      const newGroups = [...groups];
      newGroups[groupIndex].rules.splice(ruleIndex, 1);
      updateConfig('groups', newGroups);
    };

    return (
      <div className="space-y-6">
        {groups.map((group, groupIndex) => (
          <div
            key={group.id}
            className="group/card relative bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-all hover:border-blue-300 dark:hover:border-blue-700"
          >
            {/* Header del Grupo: Operador Lógico */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded text-blue-600 dark:text-blue-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Grupo de Lógica #{groupIndex + 1}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">Coincidencia:</span>
                <select
                  value={group.operator}
                  onChange={(e) => {
                    const newGroups = [...groups];
                    newGroups[groupIndex].operator = e.target.value as 'AND' | 'OR';
                    updateConfig('groups', newGroups);
                  }}
                  disabled={readOnly}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border cursor-pointer outline-none transition-colors ${group.operator === 'AND'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
                    : 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800'
                    }`}
                >
                  <option value="AND">AND (Todas)</option>
                  <option value="OR">OR (Alguna)</option>
                </select>
              </div>
            </div>

            {/* Lista de Reglas */}
            <div className="p-4 space-y-3">
              {group.rules.length === 0 ? (
                <div className="text-center py-4 text-gray-400 text-sm italic">
                  No hay reglas definidas en este grupo.
                </div>
              ) : (
                group.rules.map((rule, ruleIndex) => (
                  <div key={rule.id} className="grid grid-cols-12 gap-2 items-center group/rule">

                    {/* 1. Selector de Campo */}
                    <div className="col-span-4 relative">
                      <select
                        value={rule.field}
                        onChange={(e) => updateRule(groupIndex, ruleIndex, 'field', e.target.value)}
                        disabled={readOnly}
                        className="w-full pl-2 pr-6 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                      >
                        {AVAILABLE_FIELDS.map((field) => (
                          <option key={field.path} value={field.path}>{field.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 2. Selector de Operador */}
                    <div className="col-span-3">
                      <select
                        value={rule.operator}
                        onChange={(e) => updateRule(groupIndex, ruleIndex, 'operator', e.target.value)}
                        disabled={readOnly}
                        className="w-full px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium"
                      >
                        {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Input de Valor - Dinámico según el tipo de campo */}
                    <div className="col-span-4">
                      {(() => {
                        const fieldInfo = AVAILABLE_FIELDS.find(f => f.path === rule.field);
                        const fieldType = fieldInfo?.type || 'string';
                        
                        // Selector de idioma
                        if (fieldType === 'language' || rule.field === 'user.language') {
                          return (
                            <select
                              value={rule.value || ''}
                              onChange={(e) => updateRule(groupIndex, ruleIndex, 'value', e.target.value)}
                              disabled={readOnly}
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            >
                              <option value="">Seleccionar idioma...</option>
                              {SUPPORTED_LANGUAGES.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                  {lang.flag} {lang.name}
                                </option>
                              ))}
                            </select>
                          );
                        }
                        
                        // Campo personalizado - necesita especificar el nombre del campo
                        if (fieldType === 'customField' || rule.field === 'customFields') {
                          return (
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={rule.customFieldName || ''}
                                onChange={(e) => {
                                  updateRule(groupIndex, ruleIndex, 'customFieldName', e.target.value);
                                  updateRule(groupIndex, ruleIndex, 'field', `customFields.${e.target.value}`);
                                }}
                                disabled={readOnly}
                                placeholder="Nombre campo"
                                className="w-1/2 px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
                              />
                              <input
                                type="text"
                                value={rule.value || ''}
                                onChange={(e) => updateRule(groupIndex, ruleIndex, 'value', e.target.value)}
                                disabled={readOnly}
                                placeholder="Valor"
                                className="w-1/2 px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
                              />
                            </div>
                          );
                        }
                        
                        // Variable - necesita especificar el nombre de la variable
                        if (fieldType === 'variable' || rule.field === 'variables') {
                          return (
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={rule.variableName || ''}
                                onChange={(e) => {
                                  updateRule(groupIndex, ruleIndex, 'variableName', e.target.value);
                                  updateRule(groupIndex, ruleIndex, 'field', `variables.${e.target.value}`);
                                }}
                                disabled={readOnly}
                                placeholder="Variable"
                                className="w-1/2 px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
                              />
                              <input
                                type="text"
                                value={rule.value || ''}
                                onChange={(e) => updateRule(groupIndex, ruleIndex, 'value', e.target.value)}
                                disabled={readOnly}
                                placeholder="Valor"
                                className="w-1/2 px-2 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 outline-none placeholder-gray-400"
                              />
                            </div>
                          );
                        }
                        
                        // Input estándar de texto
                        return (
                          <input
                            type="text"
                            value={rule.value || ''}
                            onChange={(e) => updateRule(groupIndex, ruleIndex, 'value', e.target.value)}
                            disabled={readOnly}
                            placeholder="Valor a comparar..."
                            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder-gray-400"
                          />
                        );
                      })()}
                    </div>

                    {/* 4. Botón Eliminar */}
                    <div className="col-span-1 flex justify-center">
                      {!readOnly && (
                        <button
                          onClick={() => removeRule(groupIndex, ruleIndex)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors opacity-0 group-hover/rule:opacity-100 focus:opacity-100"
                          title="Eliminar regla"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Botón Añadir Regla */}
              {!readOnly && (
                <button
                  onClick={() => addRule(groupIndex)}
                  className="w-full mt-2 py-2 flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:text-blue-600 border border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-400 rounded-lg bg-white/50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Añadir condición
                </button>
              )}
            </div>

            {/* Decoración lateral de conexión (Visual) */}
            <div className={`absolute top-0 bottom-0 left-0 w-1 ${group.operator === 'AND' ? 'bg-blue-500' : 'bg-orange-500'} opacity-0 group-hover/card:opacity-100 transition-opacity`} />
          </div>
        ))}
      </div>
    );
  };

  // Render action config
  const renderActionConfig = () => {
    const actionConfig = config as ActionConfig;

    return (
      <div className="space-y-4">
        {/* Action type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tipo de acción
          </label>
          <select
            value={actionConfig.actionType || ''}
            onChange={(e) => updateConfig('actionType', e.target.value)}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar...</option>
            {Object.entries(ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Send message - NEW ADVANCED EDITOR */}
        {actionConfig.actionType === 'send_message' && (
          <div className="mt-4">
            <MessageEditor
              config={actionConfig}
              onChange={(updates) => {
                const newConfig = { ...config, ...updates };
                setConfig(newConfig);
                onChange(node.id, label, newConfig);
              }}
              readOnly={readOnly}
              nodes={nodes}
              flows={flows}
            />
          </div>
        )}

        {/* Schedule message - PROGRAMAR MENSAJE */}
        {actionConfig.actionType === 'schedule_message' && (
          <div className="space-y-4 mt-4">
            {/* Tipo de programación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ⏱️ Tipo de programación
              </label>
              <select
                value={actionConfig.scheduleMessageConfig?.type || actionConfig.scheduleType || 'after_inactivity'}
                onChange={(e) => {
                  const scheduleType = e.target.value as 'fixed_time' | 'after_inactivity' | 'on_event';
                  const newScheduleConfig = {
                    ...(actionConfig.scheduleMessageConfig || {}),
                    type: scheduleType,
                  };
                  const newConfig = { 
                    ...config, 
                    scheduleMessageConfig: newScheduleConfig,
                    scheduleType: scheduleType === 'on_event' ? 'fixed_time' : scheduleType, // legacy support
                  };
                  setConfig(newConfig);
                  onChange(node.id, label, newConfig);
                }}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="after_inactivity">⏳ Después de inactividad</option>
                <option value="fixed_time">📅 Fecha y hora específica</option>
                <option value="on_event">🎯 Al ocurrir un evento</option>
              </select>
            </div>

            {/* Config según tipo */}
            {(actionConfig.scheduleMessageConfig?.type || actionConfig.scheduleType || 'after_inactivity') === 'after_inactivity' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minutos de inactividad
                </label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={actionConfig.scheduleMessageConfig?.delayMinutes || actionConfig.scheduleDelay || 30}
                  onChange={(e) => {
                    const delay = parseInt(e.target.value) || 30;
                    const newScheduleConfig = {
                      ...(actionConfig.scheduleMessageConfig || {}),
                      type: 'after_inactivity' as const,
                      delayMinutes: delay,
                    };
                    const newConfig = { 
                      ...config, 
                      scheduleMessageConfig: newScheduleConfig,
                      scheduleDelay: delay, // legacy support
                    };
                    setConfig(newConfig);
                    onChange(node.id, label, newConfig);
                  }}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="30"
                />
                <p className="text-xs text-gray-500 mt-1">
                  El mensaje se enviará después de X minutos sin respuesta del usuario
                </p>
              </div>
            )}

            {(actionConfig.scheduleMessageConfig?.type) === 'fixed_time' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fecha y hora programada
                </label>
                <input
                  type="datetime-local"
                  value={(() => {
                    // Convert ISO string back to local datetime-local format
                    const isoString = actionConfig.scheduleMessageConfig?.scheduledAt;
                    if (!isoString) return '';
                    const date = new Date(isoString);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                  })()}
                  onChange={(e) => {
                    // Parse datetime-local as local time
                    const value = e.target.value;
                    const [datePart, timePart] = value.split('T');
                    const [year, month, day] = datePart.split('-').map(Number);
                    const [hours, minutes] = timePart.split(':').map(Number);
                    const localDate = new Date(year, month - 1, day, hours, minutes);
                    
                    const newScheduleConfig = {
                      ...(actionConfig.scheduleMessageConfig || {}),
                      type: 'fixed_time' as const,
                      scheduledAt: localDate.toISOString(),
                    };
                    const newConfig = { 
                      ...config, 
                      scheduleMessageConfig: newScheduleConfig,
                    };
                    setConfig(newConfig);
                    onChange(node.id, label, newConfig);
                  }}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  También puedes usar variables: {"{{date.tomorrow}}"}, {"{{date.next_week}}"}
                </p>
              </div>
            )}

            {(actionConfig.scheduleMessageConfig?.type) === 'on_event' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Evento disparador
                </label>
                <select
                  value={actionConfig.scheduleMessageConfig?.triggerEvent || ''}
                  onChange={(e) => {
                    const newScheduleConfig = {
                      ...(actionConfig.scheduleMessageConfig || {}),
                      type: 'on_event' as const,
                      triggerEvent: e.target.value as any,
                    };
                    const newConfig = { 
                      ...config, 
                      scheduleMessageConfig: newScheduleConfig,
                    };
                    setConfig(newConfig);
                    onChange(node.id, label, newConfig);
                  }}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar evento...</option>
                  <option value="agent_online">👤 Agente se conecta</option>
                  <option value="chat_assigned">📋 Chat es asignado</option>
                  <option value="chat_reopened">🔄 Chat es reabierto</option>
                  <option value="sla_warning">⚠️ Alerta de SLA</option>
                  <option value="chat_transferred">🔀 Chat es transferido</option>
                </select>
              </div>
            )}

            {/* Mensaje a enviar */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                📝 Mensaje a enviar
              </label>
              <textarea
                value={actionConfig.scheduleMessageConfig?.messageContent || actionConfig.messageContent || ''}
                onChange={(e) => {
                  const newScheduleConfig = {
                    ...(actionConfig.scheduleMessageConfig || {}),
                    messageContent: e.target.value,
                  };
                  const newConfig = { 
                    ...config, 
                    scheduleMessageConfig: newScheduleConfig,
                    messageContent: e.target.value, // legacy support
                  };
                  setConfig(newConfig);
                  onChange(node.id, label, newConfig);
                }}
                disabled={readOnly}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="Hola {{user.firstName}}, ¿sigues ahí?..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Soporta variables: {"{{user.firstName}}"}, {"{{agent.name}}"}, {"{{session.id}}"}
              </p>
            </div>

            {/* Opciones de cancelación */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🚫 Cancelar automáticamente si:
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={actionConfig.scheduleMessageConfig?.cancelOnUserResponse ?? true}
                    onChange={(e) => {
                      const newScheduleConfig = {
                        ...(actionConfig.scheduleMessageConfig || {}),
                        cancelOnUserResponse: e.target.checked,
                      };
                      const newConfig = { 
                        ...config, 
                        scheduleMessageConfig: newScheduleConfig,
                      };
                      setConfig(newConfig);
                      onChange(node.id, label, newConfig);
                    }}
                    disabled={readOnly}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    El usuario responde antes
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={actionConfig.scheduleMessageConfig?.cancelOnChatClose ?? true}
                    onChange={(e) => {
                      const newScheduleConfig = {
                        ...(actionConfig.scheduleMessageConfig || {}),
                        cancelOnChatClose: e.target.checked,
                      };
                      const newConfig = { 
                        ...config, 
                        scheduleMessageConfig: newScheduleConfig,
                      };
                      setConfig(newConfig);
                      onChange(node.id, label, newConfig);
                    }}
                    disabled={readOnly}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    El chat se cierra
                  </span>
                </label>
              </div>
            </div>

            {/* Expiración */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ⏰ Expirar después de (horas)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={actionConfig.scheduleMessageConfig?.expiresInHours || 24}
                onChange={(e) => {
                  const newScheduleConfig = {
                    ...(actionConfig.scheduleMessageConfig || {}),
                    expiresInHours: parseInt(e.target.value) || 24,
                  };
                  const newConfig = { 
                    ...config, 
                    scheduleMessageConfig: newScheduleConfig,
                  };
                  setConfig(newConfig);
                  onChange(node.id, label, newConfig);
                }}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="24"
              />
              <p className="text-xs text-gray-500 mt-1">
                Si no se puede enviar, el mensaje expirará después de este tiempo
              </p>
            </div>
          </div>
        )}

        {/* Add tag */}
        {(actionConfig.actionType === 'add_tag' || actionConfig.actionType === 'remove_tag') && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre del tag
              </label>
              <input
                type="text"
                value={actionConfig.tagName || ''}
                onChange={(e) => updateConfig('tagName', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: urgente"
              />
            </div>
            {actionConfig.actionType === 'add_tag' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <input
                  type="color"
                  value={actionConfig.tagColor || '#3B82F6'}
                  onChange={(e) => updateConfig('tagColor', e.target.value)}
                  disabled={readOnly}
                  className="w-12 h-8 rounded cursor-pointer"
                />
              </div>
            )}
          </>
        )}

        {/* Webhook */}
        {actionConfig.actionType === 'call_webhook' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL
              </label>
              <input
                type="url"
                value={actionConfig.webhookUrl || ''}
                onChange={(e) => updateConfig('webhookUrl', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://api.example.com/webhook"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Método
              </label>
              <select
                value={actionConfig.webhookMethod || 'POST'}
                onChange={(e) => updateConfig('webhookMethod', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
          </>
        )}

        {/* API Call - Advanced HTTP Request */}
        {actionConfig.actionType === 'api_call' && (
          <div className="mt-4">
            <ApiCallEditor
              config={actionConfig.apiCallConfig || {}}
              onChange={(apiCallConfig) => {
                const newConfig = { ...config, apiCallConfig };
                setConfig(newConfig);
                onChange(node.id, label, newConfig);
              }}
              flowNodes={nodes?.map(n => ({ id: n.id, label: n.label || n.id, type: 'action' })) || []}
            />
          </div>
        )}

        {/* Create note */}
        {actionConfig.actionType === 'create_note' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Contenido de la nota
            </label>
            <textarea
              value={actionConfig.noteContent || ''}
              onChange={(e) => updateConfig('noteContent', e.target.value)}
              disabled={readOnly}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Nota interna..."
            />
          </div>
        )}

        {/* Wait for response / Data Collection */}
        {actionConfig.actionType === 'wait_for_response' && (
          <div className="mt-4">
            <DataCollectionEditor
              config={actionConfig}
              onChange={(updates) => {
                const newConfig = { ...config, ...updates };
                setConfig(newConfig);
                onChange(node.id, label, newConfig);
              }}
              readOnly={readOnly}
            />
          </div>
        )}

        {/* Assign agent */}
        {actionConfig.actionType === 'assign_agent' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ID del agente (opcional)
            </label>
            <input
              type="text"
              value={actionConfig.targetAgentId || ''}
              onChange={(e) => updateConfig('targetAgentId', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Dejar vacío para asignar automáticamente"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Si no especificas un agente, se asignará al siguiente disponible.
            </p>
          </div>
        )}

        {/* Change category */}
        {actionConfig.actionType === 'change_category' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nueva categoría
            </label>
            <select
              value={actionConfig.categoryName || ''}
              onChange={(e) => updateConfig('categoryName', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar categoría...</option>
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Block user */}
        {actionConfig.actionType === 'block_user' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Duración del bloqueo (horas)
              </label>
              <input
                type="number"
                value={actionConfig.blockDurationHours || 24}
                onChange={(e) => updateConfig('blockDurationHours', parseInt(e.target.value))}
                disabled={readOnly}
                min={1}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Razón del bloqueo
              </label>
              <input
                type="text"
                value={actionConfig.blockReason || ''}
                onChange={(e) => updateConfig('blockReason', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Spam, comportamiento abusivo, etc."
              />
            </div>
          </>
        )}

        {/* Close/Reopen chat - no extra config needed */}
        {(actionConfig.actionType === 'close_chat' || actionConfig.actionType === 'reopen_chat') && (
          <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {actionConfig.actionType === 'close_chat'
                ? '✓ El chat se cerrará automáticamente al ejecutar esta acción.'
                : '✓ El chat se reabrirá automáticamente al ejecutar esta acción.'}
            </p>
          </div>
        )}

        {/* Send survey */}
        {actionConfig.actionType === 'send_survey' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tipo de encuesta
            </label>
            <select
              value={actionConfig.surveyType || 'csat'}
              onChange={(e) => updateConfig('surveyType', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="csat">CSAT (Satisfacción 1-5)</option>
              <option value="nps">NPS (Net Promoter Score 0-10)</option>
            </select>
          </div>
        )}

        {/* Set custom field */}
        {actionConfig.actionType === 'set_custom_field' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Campo personalizado
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={actionConfig.customFieldName || ''}
                  onChange={(e) => updateConfig('customFieldName', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="nombre_del_campo"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Clave del campo (solo minúsculas, números y _). Se creará automáticamente si no existe.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Valor a guardar
              </label>
              <input
                type="text"
                value={actionConfig.customFieldValue || ''}
                onChange={(e) => updateConfig('customFieldValue', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: premium, true, 100"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Usa variables dinámicas: <code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">{`{{user.firstName}}`}</code>, <code className="bg-gray-100 dark:bg-gray-600 px-1 rounded">{`{{variables.respuesta}}`}</code>
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 <strong>Uso:</strong> Accede a este valor con <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{`{{custom.${actionConfig.customFieldName || 'campo'}}}`}</code> en mensajes y condiciones.
              </p>
            </div>
          </>
        )}

        {/* ============= NEW TELEGRAM ACTIONS UI ============= */}

        {/* Edit Message */}
        {actionConfig.actionType === 'edit_message' && (
          <div className="space-y-4 mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              <span className="font-semibold">Editar Mensaje</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje objetivo</label>
              <select
                value={(actionConfig as any).editMessageConfig?.targetType || 'last_bot_message'}
                onChange={(e) => updateConfig('editMessageConfig', { ...(actionConfig as any).editMessageConfig, targetType: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="last_bot_message">Último mensaje del bot</option>
                <option value="variable">ID desde variable</option>
                <option value="specific_id">ID específico</option>
              </select>
            </div>
            {(actionConfig as any).editMessageConfig?.targetType === 'variable' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Variable con ID</label>
                <input
                  type="text"
                  value={(actionConfig as any).editMessageConfig?.messageIdVariable || ''}
                  onChange={(e) => updateConfig('editMessageConfig', { ...(actionConfig as any).editMessageConfig, messageIdVariable: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="saved_message_id"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nuevo texto</label>
              <textarea
                value={(actionConfig as any).editMessageConfig?.newText || ''}
                onChange={(e) => updateConfig('editMessageConfig', { ...(actionConfig as any).editMessageConfig, newText: e.target.value })}
                disabled={readOnly}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="Nuevo contenido del mensaje..."
              />
            </div>
          </div>
        )}

        {/* Delete Message */}
        {actionConfig.actionType === 'delete_message' && (
          <div className="space-y-4 mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              <span className="font-semibold">Eliminar Mensaje</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje a eliminar</label>
              <select
                value={(actionConfig as any).deleteMessageConfig?.targetType || 'last_bot_message'}
                onChange={(e) => updateConfig('deleteMessageConfig', { ...(actionConfig as any).deleteMessageConfig, targetType: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="last_bot_message">Último mensaje del bot</option>
                <option value="last_user_message">Último mensaje del usuario</option>
                <option value="variable">ID desde variable</option>
                <option value="specific_id">ID específico</option>
              </select>
            </div>
            {(actionConfig as any).deleteMessageConfig?.targetType === 'variable' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Variable con ID</label>
                <input
                  type="text"
                  value={(actionConfig as any).deleteMessageConfig?.messageIdVariable || ''}
                  onChange={(e) => updateConfig('deleteMessageConfig', { ...(actionConfig as any).deleteMessageConfig, messageIdVariable: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="message_to_delete"
                />
              </div>
            )}
          </div>
        )}

        {/* Send Chat Action (Typing...) */}
        {actionConfig.actionType === 'send_chat_action' && (
          <div className="space-y-4 mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 10"/></svg>
              <span className="font-semibold">Acción de Chat</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de acción</label>
              <select
                value={(actionConfig as any).chatActionConfig?.action || 'typing'}
                onChange={(e) => updateConfig('chatActionConfig', { ...(actionConfig as any).chatActionConfig, action: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="typing">⌨️ Escribiendo...</option>
                <option value="upload_photo">📷 Subiendo foto...</option>
                <option value="record_video">🎥 Grabando video...</option>
                <option value="upload_video">📹 Subiendo video...</option>
                <option value="record_voice">🎤 Grabando audio...</option>
                <option value="upload_voice">🎵 Subiendo audio...</option>
                <option value="upload_document">📄 Subiendo documento...</option>
                <option value="find_location">📍 Buscando ubicación...</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Duración simulada (segundos)</label>
              <input
                type="number"
                value={(actionConfig as any).chatActionConfig?.simulateDuration || 2}
                onChange={(e) => updateConfig('chatActionConfig', { ...(actionConfig as any).chatActionConfig, simulateDuration: parseInt(e.target.value) })}
                disabled={readOnly}
                min={0}
                max={30}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
              <p className="text-xs text-gray-500 mt-1">0 = enviar una vez, mayor = simular durante X segundos</p>
            </div>
          </div>
        )}

        {/* Delay Action */}
        {actionConfig.actionType === 'delay_action' && (
          <div className="space-y-4 mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span className="font-semibold">Esperar (Delay)</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Segundos de espera</label>
              <input
                type="number"
                value={(actionConfig as any).delayActionConfig?.delaySeconds || 2}
                onChange={(e) => updateConfig('delayActionConfig', { ...(actionConfig as any).delayActionConfig, delaySeconds: parseInt(e.target.value) })}
                disabled={readOnly}
                min={1}
                max={300}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={(actionConfig as any).delayActionConfig?.showTyping || false}
                onChange={(e) => updateConfig('delayActionConfig', { ...(actionConfig as any).delayActionConfig, showTyping: e.target.checked })}
                disabled={readOnly}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label className="text-sm text-gray-700 dark:text-gray-300">Mostrar "escribiendo..." durante la espera</label>
            </div>
          </div>
        )}

        {/* Pin Message */}
        {actionConfig.actionType === 'pin_message' && (
          <div className="space-y-4 mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>
              <span className="font-semibold">Fijar Mensaje</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mensaje a fijar</label>
              <select
                value={(actionConfig as any).pinMessageConfig?.targetType || 'last_bot_message'}
                onChange={(e) => updateConfig('pinMessageConfig', { ...(actionConfig as any).pinMessageConfig, targetType: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="last_bot_message">Último mensaje del bot</option>
                <option value="variable">ID desde variable</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={(actionConfig as any).pinMessageConfig?.disableNotification ?? true}
                onChange={(e) => updateConfig('pinMessageConfig', { ...(actionConfig as any).pinMessageConfig, disableNotification: e.target.checked })}
                disabled={readOnly}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label className="text-sm text-gray-700 dark:text-gray-300">Sin notificación al usuario</label>
            </div>
          </div>
        )}

        {/* Unpin Message */}
        {actionConfig.actionType === 'unpin_message' && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mt-4">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/><line x1="2" y1="2" x2="22" y2="22" strokeWidth="2"/></svg>
              <span className="font-semibold">Desfijar Mensaje</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Se desfijará el último mensaje fijado del chat.</p>
          </div>
        )}

        {/* Save Message ID */}
        {actionConfig.actionType === 'save_message_id' && (
          <div className="space-y-4 mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              <span className="font-semibold">Guardar ID de Mensaje</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre de la variable</label>
              <input
                type="text"
                value={(actionConfig as any).saveMessageIdConfig?.variableName || ''}
                onChange={(e) => updateConfig('saveMessageIdConfig', { ...(actionConfig as any).saveMessageIdConfig, variableName: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono"
                placeholder="mensaje_guardado"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Origen del mensaje</label>
              <select
                value={(actionConfig as any).saveMessageIdConfig?.messageSource || 'last_bot_message'}
                onChange={(e) => updateConfig('saveMessageIdConfig', { ...(actionConfig as any).saveMessageIdConfig, messageSource: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="last_bot_message">Último mensaje del bot</option>
                <option value="last_user_message">Último mensaje del usuario</option>
              </select>
            </div>
            <p className="text-xs text-gray-500">
              Usa <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{`{{variables.${(actionConfig as any).saveMessageIdConfig?.variableName || 'mensaje_guardado'}}}`}</code> para referenciar este ID después.
            </p>
          </div>
        )}

        {/* Send Location */}
        {actionConfig.actionType === 'send_location' && (
          <div className="space-y-4 mt-4 p-4 bg-teal-50 dark:bg-teal-900/20 rounded-xl border border-teal-200 dark:border-teal-800">
            <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span className="font-semibold">Enviar Ubicación</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Latitud</label>
                <input
                  type="text"
                  value={(actionConfig as any).locationConfig?.latitude || ''}
                  onChange={(e) => updateConfig('locationConfig', { ...(actionConfig as any).locationConfig, latitude: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm"
                  placeholder="40.7128"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Longitud</label>
                <input
                  type="text"
                  value={(actionConfig as any).locationConfig?.longitude || ''}
                  onChange={(e) => updateConfig('locationConfig', { ...(actionConfig as any).locationConfig, longitude: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm"
                  placeholder="-74.0060"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">Puedes usar variables: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{`{{variables.lat}}`}</code></p>
          </div>
        )}

        {/* Send Contact */}
        {actionConfig.actionType === 'send_contact' && (
          <div className="space-y-4 mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span className="font-semibold">Enviar Contacto</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teléfono</label>
              <input
                type="text"
                value={(actionConfig as any).contactConfig?.phoneNumber || ''}
                onChange={(e) => updateConfig('contactConfig', { ...(actionConfig as any).contactConfig, phoneNumber: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                placeholder="+1234567890"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={(actionConfig as any).contactConfig?.firstName || ''}
                  onChange={(e) => updateConfig('contactConfig', { ...(actionConfig as any).contactConfig, firstName: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Apellido</label>
                <input
                  type="text"
                  value={(actionConfig as any).contactConfig?.lastName || ''}
                  onChange={(e) => updateConfig('contactConfig', { ...(actionConfig as any).contactConfig, lastName: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  placeholder="Doe"
                />
              </div>
            </div>
          </div>
        )}

        {/* Run Subflow */}
        {actionConfig.actionType === 'run_subflow' && (
          <div className="space-y-4 mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
              <span className="font-semibold">Ejecutar Sub-Flow</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flow a ejecutar</label>
              <select
                value={(actionConfig as any).subflowConfig?.flowId || ''}
                onChange={(e) => updateConfig('subflowConfig', { ...(actionConfig as any).subflowConfig, flowId: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="">Seleccionar flow...</option>
                {flows.map((flow) => (
                  <option key={flow.id} value={flow.id}>{flow.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(actionConfig as any).subflowConfig?.passVariables || false}
                  onChange={(e) => updateConfig('subflowConfig', { ...(actionConfig as any).subflowConfig, passVariables: e.target.checked })}
                  disabled={readOnly}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">Pasar variables al sub-flow</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={(actionConfig as any).subflowConfig?.waitForCompletion || false}
                  onChange={(e) => updateConfig('subflowConfig', { ...(actionConfig as any).subflowConfig, waitForCompletion: e.target.checked })}
                  disabled={readOnly}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label className="text-sm text-gray-700 dark:text-gray-300">Esperar a que termine (síncrono)</label>
              </div>
            </div>
          </div>
        )}

        {/* Remove keyboard actions - simple info */}
        {(actionConfig.actionType === 'remove_keyboard' || actionConfig.actionType === 'remove_reply_keyboard') && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 mt-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              ✓ {actionConfig.actionType === 'remove_keyboard' 
                ? 'Se eliminará el teclado inline del último mensaje del bot.'
                : 'Se eliminará el teclado reply (menú persistente).'}
            </p>
          </div>
        )}

        {/* Edit keyboard - basic */}
        {actionConfig.actionType === 'edit_keyboard' && (
          <div className="space-y-4 mt-4 p-4 bg-cyan-50 dark:bg-cyan-900/20 rounded-xl border border-cyan-200 dark:border-cyan-800">
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"/><path d="M6 8h.001"/><path d="M10 8h.001"/><path d="M14 8h.001"/><path d="M18 8h.001"/><path d="M8 12h.001"/><path d="M12 12h.001"/><path d="M16 12h.001"/><path d="M7 16h10"/></svg>
              <span className="font-semibold">Editar Teclado Inline</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Operación</label>
              <select
                value={(actionConfig as any).editKeyboardConfig?.operation || 'replace'}
                onChange={(e) => updateConfig('editKeyboardConfig', { ...(actionConfig as any).editKeyboardConfig, operation: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              >
                <option value="replace">Reemplazar teclado completo</option>
                <option value="remove">Eliminar teclado</option>
                <option value="disable_button">Desactivar botón (próximamente)</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              💡 Para configurar botones avanzados, usa "Enviar mensaje" con teclado inline.
            </p>
          </div>
        )}

        {/* Send sticker - basic */}
        {actionConfig.actionType === 'send_sticker' && (
          <div className="space-y-4 mt-4 p-4 bg-pink-50 dark:bg-pink-900/20 rounded-xl border border-pink-200 dark:border-pink-800">
            <div className="flex items-center gap-2 text-pink-600 dark:text-pink-400 mb-2">
              <span className="text-xl">🎨</span>
              <span className="font-semibold">Enviar Sticker</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File ID del sticker</label>
              <input
                type="text"
                value={(actionConfig as any).stickerConfig?.stickerId || ''}
                onChange={(e) => updateConfig('stickerConfig', { stickerSource: 'file_id', stickerId: e.target.value })}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm"
                placeholder="CAACAgIAAxkBAAI..."
              />
            </div>
            <p className="text-xs text-gray-500">
              Obtén el file_id enviando el sticker al bot y revisando los logs.
            </p>
          </div>
        )}
      </div>
    );
  };

  // Render delay config
  const renderDelayConfig = () => {
    const delayConfig = config as DelayConfig;

    return (
      <div className="space-y-4">
        {/* Delay type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tipo de espera
          </label>
          <select
            value={delayConfig.delayType || ''}
            onChange={(e) => updateConfig('delayType', e.target.value)}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar...</option>
            {Object.entries(DELAY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Fixed time */}
        {delayConfig.delayType === 'fixed_time' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Minutos de espera
            </label>
            <input
              type="number"
              value={delayConfig.delayMinutes || 5}
              onChange={(e) => updateConfig('delayMinutes', parseInt(e.target.value))}
              disabled={readOnly}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Until response */}
        {delayConfig.delayType === 'until_response' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tiempo máximo de espera (minutos)
            </label>
            <input
              type="number"
              value={delayConfig.maxWaitMinutes || 30}
              onChange={(e) => updateConfig('maxWaitMinutes', parseInt(e.target.value))}
              disabled={readOnly}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Si no responde, continúa el flow
            </p>
          </div>
        )}

        {/* Cancel conditions */}
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={delayConfig.cancelOnUserResponse || false}
              onChange={(e) => updateConfig('cancelOnUserResponse', e.target.checked)}
              disabled={readOnly}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Cancelar si el usuario responde
            </span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={delayConfig.cancelOnChatClose || false}
              onChange={(e) => updateConfig('cancelOnChatClose', e.target.checked)}
              disabled={readOnly}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Cancelar si se cierra el chat
            </span>
          </label>
        </div>
      </div>
    );
  };

  // Get node type config renderer
  const renderNodeConfig = () => {
    switch (node.type as NodeType) {
      case 'trigger':
        return renderTriggerConfig();
      case 'condition':
      case 'branch':
        return renderConditionConfig();
      case 'action':
        return renderActionConfig();
      case 'delay':
        return renderDelayConfig();
      case 'end':
        return (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Este nodo marca el fin del flow.
          </p>
        );
      default:
        return null;
    }
  };

  const getNodeColor = () => {
    const colors: Record<string, string> = {
      trigger: '#10B981',
      condition: '#F59E0B',
      branch: '#F59E0B',
      action: '#3B82F6',
      delay: '#8B5CF6',
      end: '#6B7280',
    };
    return colors[node.type as string] || '#6B7280';
  };

  const getNodeTypeLabel = () => {
    const labels: Record<string, string> = {
      trigger: 'Trigger',
      condition: 'Condición',
      branch: 'Condición',
      action: 'Acción',
      delay: 'Esperar',
      end: 'Fin',
    };
    return labels[node.type as string] || 'Nodo';
  };

  return (
    <div className="w-[420px] h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getNodeColor() }}
          />
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {getNodeTypeLabel()}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Label */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Nombre del nodo
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              if (!readOnly) {
                onChange(node.id, e.target.value, config);
              }
            }}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nombre descriptivo"
          />
        </div>

        {/* Node type config */}
        {renderNodeConfig()}
      </div>

      {/* Footer */}
      {!readOnly && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  );
};

export default NodeConfigPanel;

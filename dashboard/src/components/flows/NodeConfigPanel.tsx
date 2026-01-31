/**
 * NodeConfigPanel - Right sidebar for node configuration
 */

import React, { useState, useEffect } from 'react';
import type { Node } from 'reactflow';
import type {
  NodeType,
  TriggerConfig,
  ActionConfig,
  DelayConfig,
  ConditionConfig,
  ConditionRule,
} from '../../types/flow';
import {
  ACTION_LABELS,
} from '../../types/flow';
import MessageEditor from './MessageEditor';
import DataCollectionEditor from './DataCollectionEditor';
import ApiCallEditor from './ApiCallEditor';
import renderTriggerConfig from './config/RenderTriggerConfig';
import RenderConditionConfig from './config/RenderConditionConfig';
import RenderDelayConfig from './config/RenderDelayConfig';
import { Activity, BarChart3, ChevronDown, ClipboardList, Clock, Contact, Database, Info, MapPin, Phone, PlayCircle, ShieldCheck, Sparkles, Star, User, UserCog, Variable } from 'lucide-react';

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


const CATEGORY_OPTIONS = [
  { value: 'support', label: 'Soporte' },
  { value: 'billing', label: 'Facturación' },
  { value: 'bug', label: 'Bug/Error' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Otro' },
]


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


  // Render action config
  const renderActionConfig = () => {
    const actionConfig = config as ActionConfig;

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
            <PlayCircle className="w-3.5 h-3.5" /> Tipo de Acción
          </label>

          <div className="relative group">
            <select
              value={actionConfig.actionType || ''}
              onChange={(e) => updateConfig('actionType', e.target.value)}
              disabled={readOnly}
              className="w-full pl-4 pr-10 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
            >
              <option value="">Seleccionar...</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value} className="bg-zinc-900 text-zinc-300">
                  {label}
                </option>
              ))}
            </select>

            {/* Custom Arrow */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-zinc-400 transition-colors">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
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

        {/* Assign Agent Config */}
        {actionConfig.actionType === 'assign_agent' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
                <UserCog className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Enrutamiento</h4>
                <p className="text-[10px] text-zinc-500">Asigna la conversación a un humano</p>
              </div>
            </div>

            {/* Agent ID Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">ID del Agente (Opcional)</label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  value={actionConfig.targetAgentId || ''}
                  onChange={(e) => updateConfig('targetAgentId', e.target.value)}
                  disabled={readOnly}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono placeholder-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                  placeholder="Ej: agent_452"
                />
              </div>
            </div>

            {/* Status Feedback Indicator */}
            <div className={`flex items-start gap-2 p-3 rounded-lg border transition-all duration-300 ${!actionConfig.targetAgentId
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-indigo-500/5 border-indigo-500/20'
              }`}>
              <div className="mt-0.5">
                {!actionConfig.targetAgentId ? (
                  <Sparkles className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-xs font-medium ${!actionConfig.targetAgentId ? 'text-emerald-400' : 'text-indigo-400'}`}>
                  {!actionConfig.targetAgentId ? 'Asignación Automática (Round Robin)' : 'Asignación Directa'}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">
                  {!actionConfig.targetAgentId
                    ? 'El sistema buscará el siguiente agente disponible basándose en la carga de trabajo y estado.'
                    : `La conversación se forzará al agente con ID: ${actionConfig.targetAgentId}.`
                  }
                </p>
              </div>
            </div>

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

        {/* Send Survey Config */}
        {actionConfig.actionType === 'send_survey' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
                <ClipboardList className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Encuesta de Satisfacción</h4>
                <p className="text-[10px] text-zinc-500">Recopila feedback del usuario</p>
              </div>
            </div>

            {/* Survey Type Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Metodología</label>
              <div className="relative">
                <select
                  value={actionConfig.surveyType || 'csat'}
                  onChange={(e) => updateConfig('surveyType', e.target.value)}
                  disabled={readOnly}
                  className="w-full pl-3 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700"
                >
                  <option value="csat">CSAT (Customer Satisfaction Score)</option>
                  <option value="nps">NPS (Net Promoter Score)</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Visual Preview of the Scale */}
            <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-zinc-500 uppercase">Vista Previa Escala</span>
                <BarChart3 className="w-3 h-3 text-zinc-600" />
              </div>

              <div className="flex justify-center items-center h-12">
                {(actionConfig.surveyType || 'csat') === 'csat' ? (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-0.5 w-full">
                    {Array.from({ length: 11 }, (_, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-6 flex items-center justify-center text-[9px] rounded-sm font-bold border ${i <= 6 ? 'bg-red-500/20 border-red-500/30 text-red-400' :
                          i <= 8 ? 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400' :
                            'bg-green-500/20 border-green-500/30 text-green-400'
                          }`}
                      >
                        {i}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-center text-[10px] text-zinc-500">
                {(actionConfig.surveyType || 'csat') === 'csat'
                  ? 'El usuario calificará de 1 a 5 estrellas.'
                  : 'El usuario calificará de 0 a 10 (Detractores, Pasivos, Promotores).'}
              </p>
            </div>

          </div>
        )}

        {/* Set Custom Field Config */}
        {actionConfig.actionType === 'set_custom_field' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Variable Personalizada</h4>
                <p className="text-[10px] text-zinc-500">Almacena datos específicos del usuario</p>
              </div>
            </div>

            {/* Field Key Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                <Variable className="w-3 h-3" /> Clave del Campo (Key)
              </label>
              <input
                type="text"
                value={actionConfig.customFieldName || ''}
                onChange={(e) => updateConfig('customFieldName', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                disabled={readOnly}
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-indigo-300 font-mono placeholder-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                placeholder="nombre_del_campo"
              />
              <p className="text-[10px] text-zinc-500">
                Identificador único. Solo minúsculas, números y guiones bajos (snake_case).
              </p>
            </div>

            {/* Field Value Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Valor a Guardar</label>
              <input
                type="text"
                value={actionConfig.customFieldValue || ''}
                onChange={(e) => updateConfig('customFieldValue', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                placeholder="Ej: premium, true, 100"
              />
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="text-[10px] text-zinc-500">Dinámicos:</span>
                <code className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300 border border-zinc-700">{`{{user.firstName}}`}</code>
                <code className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300 border border-zinc-700">{`{{variables.input}}`}</code>
              </div>
            </div>

            {/* Usage Tip */}
            <div className="flex items-start gap-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg">
              <Info className="w-4 h-4 text-indigo-500/50 mt-0.5 shrink-0" />
              <p className="text-xs text-zinc-400 leading-relaxed">
                Para leer este valor más adelante en tus mensajes o condiciones, utiliza la variable:
                <br />
                <code className="text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono mt-1 inline-block">
                  {`{{custom.${actionConfig.customFieldName || 'campo'}}}`}
                </code>
              </p>
            </div>

          </div>
        )}

        {/* ============= NEW TELEGRAM ACTIONS UI ============= */}

        {/* Edit Message */}
        {actionConfig.actionType === 'edit_message' && (
          <div className="space-y-4 mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
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

        {actionConfig.actionType === 'send_chat_action' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20 text-blue-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Estado del Chat</h4>
                <p className="text-[10px] text-zinc-500">Simula actividad humana (escribiendo, grabando...)</p>
              </div>
            </div>

            {/* Action Type Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Tipo de Acción</label>
              <div className="relative">
                <select
                  value={(actionConfig as any).chatActionConfig?.action || 'typing'}
                  onChange={(e) => updateConfig('chatActionConfig', { ...(actionConfig as any).chatActionConfig, action: e.target.value })}
                  disabled={readOnly}
                  className="w-full pl-3 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700"
                >
                  <option value="typing">⌨️ Escribiendo...</option>
                  <option value="record_voice">🎤 Grabando audio...</option>
                  <option value="upload_photo">📷 Subiendo foto...</option>
                  <option value="record_video">🎥 Grabando video...</option>
                  <option value="upload_video">📹 Subiendo video...</option>
                  <option value="upload_voice">🎵 Subiendo audio...</option>
                  <option value="upload_document">📄 Subiendo documento...</option>
                  <option value="find_location">📍 Buscando ubicación...</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Duration Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Duración de Simulación</label>
              <div className="flex items-center gap-3">
                <div className="relative w-24">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
                  <input
                    type="number"
                    value={(actionConfig as any).chatActionConfig?.simulateDuration || 2}
                    onChange={(e) => updateConfig('chatActionConfig', { ...(actionConfig as any).chatActionConfig, simulateDuration: parseInt(e.target.value) })}
                    disabled={readOnly}
                    min={0}
                    max={60}
                    className="w-full pl-8 pr-2 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono text-center focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <span className="text-sm text-zinc-400">segundos</span>
              </div>
            </div>

            {/* Helper Info */}
            <div className="flex items-start gap-2 p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <Info className="w-3.5 h-3.5 text-blue-500/50 mt-0.5 shrink-0" />
              <p className="text-xs text-zinc-400 leading-relaxed">
                Si configuras <strong>0 segundos</strong>, la acción se enviará una sola vez sin mantener el estado. Útil para acciones instantáneas.
              </p>
            </div>

          </div>
        )}

        {/* Delay Action */}
        {actionConfig.actionType === 'delay_action' && (
          <div className="space-y-4 mt-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" /></svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22" /><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" /><line x1="2" y1="2" x2="22" y2="22" strokeWidth="2" /></svg>
              <span className="font-semibold">Desfijar Mensaje</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Se desfijará el último mensaje fijado del chat.</p>
          </div>
        )}

        {/* Save Message ID */}
        {actionConfig.actionType === 'save_message_id' && (
          <div className="space-y-4 mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
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

        {/* Send Location Config */}
        {actionConfig.actionType === 'send_location' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-teal-500/10 rounded-lg border border-teal-500/20 text-teal-400">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Ubicación Geográfica</h4>
                <p className="text-[10px] text-zinc-500">Coordenadas del mapa</p>
              </div>
            </div>

            {/* Coordinates Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Latitud</label>
                <input
                  type="text"
                  value={(actionConfig as any).locationConfig?.latitude || ''}
                  onChange={(e) => updateConfig('locationConfig', { ...(actionConfig as any).locationConfig, latitude: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono placeholder-zinc-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 outline-none transition-all"
                  placeholder="40.7128"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Longitud</label>
                <input
                  type="text"
                  value={(actionConfig as any).locationConfig?.longitude || ''}
                  onChange={(e) => updateConfig('locationConfig', { ...(actionConfig as any).locationConfig, longitude: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono placeholder-zinc-700 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/50 outline-none transition-all"
                  placeholder="-74.0060"
                />
              </div>
            </div>

            {/* Helper Note */}
            <div className="flex items-start gap-2 p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <div className="mt-0.5 text-teal-500/50">
                <Info className="w-3.5 h-3.5" />
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Admite coordenadas estáticas o variables dinámicas como <code className="text-teal-400 bg-teal-500/10 px-1 py-0.5 rounded border border-teal-500/20 font-mono">{`{{variables.lat}}`}</code>.
              </p>
            </div>

          </div>
        )}

        {/* Send Contact Config */}
        {actionConfig.actionType === 'send_contact' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 text-indigo-400">
                <Contact className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wide">Tarjeta de Contacto</h4>
                <p className="text-[10px] text-zinc-500">Configura la VCard que se enviará</p>
              </div>
            </div>

            {/* Phone Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Teléfono</label>
              <div className="relative group">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  value={(actionConfig as any).contactConfig?.phoneNumber || ''}
                  onChange={(e) => updateConfig('contactConfig', { ...(actionConfig as any).contactConfig, phoneNumber: e.target.value })}
                  disabled={readOnly}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all font-mono"
                  placeholder="+57 300 123 4567"
                />
              </div>
            </div>

            {/* Name Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Nombre</label>
                <input
                  type="text"
                  value={(actionConfig as any).contactConfig?.firstName || ''}
                  onChange={(e) => updateConfig('contactConfig', { ...(actionConfig as any).contactConfig, firstName: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Apellido</label>
                <input
                  type="text"
                  value={(actionConfig as any).contactConfig?.lastName || ''}
                  onChange={(e) => updateConfig('contactConfig', { ...(actionConfig as any).contactConfig, lastName: e.target.value })}
                  disabled={readOnly}
                  className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                  placeholder="Pérez"
                />
              </div>
            </div>

          </div>
        )}

        {/* Run Subflow */}
        {actionConfig.actionType === 'run_subflow' && (
          <div className="space-y-4 mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 14 20 9 15 4" /><path d="M4 20v-7a4 4 0 0 1 4-4h12" /></svg>
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
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><path d="M6 8h.001" /><path d="M10 8h.001" /><path d="M14 8h.001" /><path d="M18 8h.001" /><path d="M8 12h.001" /><path d="M12 12h.001" /><path d="M16 12h.001" /><path d="M7 16h10" /></svg>
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

  // Get node type config renderer
  const renderNodeConfig = () => {
    switch (node.type as NodeType) {
      case 'trigger':
        return renderTriggerConfig(config as TriggerConfig, updateConfig, readOnly);
      case 'condition':
      case 'branch':
        return RenderConditionConfig(config as ConditionConfig, updateConfig, readOnly);
      case 'action':
        return renderActionConfig();
      case 'delay':
        return RenderDelayConfig(config as DelayConfig, updateConfig, readOnly);
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

  const getNodeMeta = () => {
    const map: Record<string, { label: string; color: string }> = {
      trigger: { label: 'Disparador', color: '#10B981' }, // Emerald
      condition: { label: 'Condición', color: '#F59E0B' }, // Amber
      action: { label: 'Acción', color: '#3B82F6' }, // Blue
      delay: { label: 'Espera', color: '#8B5CF6' }, // Violet
      end: { label: 'Fin', color: '#EF4444' }, // Red
    };
    return map[node.type as string] || { label: 'Nodo', color: '#71717A' }; // Zinc
  };

  const { label: typeLabel, color } = getNodeMeta();
  return (
    <div className="w-[420px] h-full bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden shadow-2xl">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-3">
          <span
            className="w-3 h-3 rounded-full shadow-[0_0_10px]"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 10px ${color}40`
            }}
          />
          <span className="text-lg font-bold text-white tracking-tight">
            {typeLabel}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
        {/* Label */}
        <div className="space-y-2">
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
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
            className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            placeholder="Nombre descriptivo"
          />
        </div>

        <div className="h-px bg-zinc-800 w-full" />

        {/* Node type config */}
        <div className="animate-in fade-in duration-300">
          {renderNodeConfig()}
        </div>
      </div>

      {/* Footer */}
      {!readOnly && (
        <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl font-medium transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/20 transition-all"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  );
};

export default NodeConfigPanel;

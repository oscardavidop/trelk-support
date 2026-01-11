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

interface NodeConfigPanelProps {
  node: Node;
  onClose: () => void;
  onChange: (nodeId: string, label: string, config: any) => void;
  readOnly?: boolean;
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
  { path: 'session.category', label: 'Categoría', type: 'string' },
  { path: 'session.priority', label: 'Prioridad', type: 'string' },
  { path: 'session.tags', label: 'Tags', type: 'array' },
  { path: 'session.messageCount', label: 'Número de mensajes', type: 'number' },
  { path: 'agent.name', label: 'Nombre del agente', type: 'string' },
  { path: 'variables.custom', label: 'Variable personalizada', type: 'any' },
];

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  node,
  onClose,
  onChange,
  readOnly = false,
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

    return (
      <div className="space-y-4">
        {/* Trigger type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Tipo de trigger
          </label>
          <select
            value={triggerConfig.triggerType || ''}
            onChange={(e) => updateConfig('triggerType', e.target.value)}
            disabled={readOnly}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Seleccionar...</option>
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Keyword config */}
        {triggerConfig.triggerType === 'keyword_detected' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Keywords (una por línea)
              </label>
              <textarea
                value={(triggerConfig.keywords || []).join('\n')}
                onChange={(e) => updateConfig('keywords', e.target.value.split('\n').filter(Boolean))}
                disabled={readOnly}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="ayuda&#10;soporte&#10;problema"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de coincidencia
              </label>
              <select
                value={triggerConfig.keywordMatchType || 'contains'}
                onChange={(e) => updateConfig('keywordMatchType', e.target.value)}
                disabled={readOnly}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="exact">Exacta</option>
                <option value="contains">Contiene</option>
                <option value="regex">Regex</option>
              </select>
            </div>
          </>
        )}

        {/* Inactivity config */}
        {triggerConfig.triggerType === 'user_inactive' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Minutos de inactividad
            </label>
            <input
              type="number"
              value={triggerConfig.inactivityMinutes || 5}
              onChange={(e) => updateConfig('inactivityMinutes', parseInt(e.target.value))}
              disabled={readOnly}
              min={1}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Survey filter */}
        {triggerConfig.triggerType === 'survey_answered' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Filtrar por rating
            </label>
            <select
              value={triggerConfig.surveyRatingFilter || 'any'}
              onChange={(e) => updateConfig('surveyRatingFilter', e.target.value)}
              disabled={readOnly}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="any">Cualquiera</option>
              <option value="positive">Positivo (4-5)</option>
              <option value="negative">Negativo (1-2)</option>
            </select>
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
      <div className="space-y-4">
        {groups.map((group, groupIndex) => (
          <div key={group.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Grupo de reglas
              </span>
              <select
                value={group.operator}
                onChange={(e) => {
                  const newGroups = [...groups];
                  newGroups[groupIndex].operator = e.target.value as 'AND' | 'OR';
                  updateConfig('groups', newGroups);
                }}
                disabled={readOnly}
                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="AND">AND (todas)</option>
                <option value="OR">OR (alguna)</option>
              </select>
            </div>

            <div className="space-y-2">
              {group.rules.map((rule, ruleIndex) => (
                <div key={rule.id} className="flex items-center gap-2">
                  <select
                    value={rule.field}
                    onChange={(e) => updateRule(groupIndex, ruleIndex, 'field', e.target.value)}
                    disabled={readOnly}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {AVAILABLE_FIELDS.map((field) => (
                      <option key={field.path} value={field.path}>{field.label}</option>
                    ))}
                  </select>
                  <select
                    value={rule.operator}
                    onChange={(e) => updateRule(groupIndex, ruleIndex, 'operator', e.target.value)}
                    disabled={readOnly}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={rule.value || ''}
                    onChange={(e) => updateRule(groupIndex, ruleIndex, 'value', e.target.value)}
                    disabled={readOnly}
                    placeholder="Valor"
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  {!readOnly && (
                    <button
                      onClick={() => removeRule(groupIndex, ruleIndex)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {!readOnly && (
              <button
                onClick={() => addRule(groupIndex)}
                className="mt-2 flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Añadir regla
              </button>
            )}
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

        {/* Send message */}
        {actionConfig.actionType === 'send_message' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mensaje
            </label>
            <textarea
              value={actionConfig.messageContent || ''}
              onChange={(e) => updateConfig('messageContent', e.target.value)}
              disabled={readOnly}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Escribe el mensaje..."
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Puedes usar variables como {'{{user.firstName}}'} o {'{{message.text}}'}
            </p>
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
    <div className="w-80 h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
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

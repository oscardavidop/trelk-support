/**
 * NodePalette - Sidebar with draggable nodes
 */

import React, { useState } from 'react';
import type { JSX } from 'react';
import type { NodeType, TriggerType, ActionType, DelayType } from '../../types/flow';
import { NODE_COLORS, TRIGGER_LABELS, ACTION_LABELS, DELAY_LABELS } from '../../types/flow';

interface NodePaletteProps {
  onAddNode: (type: NodeType, label: string, config: any) => void;
}

interface NodeCategory {
  id: string;
  label: string;
  icon: JSX.Element;
  items: NodeItem[];
}

interface NodeItem {
  type: NodeType;
  subType?: string;
  label: string;
  description: string;
  config: any;
  icon: JSX.Element;
}

const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>('triggers');
  const [searchQuery, setSearchQuery] = useState('');

  const categories: NodeCategory[] = [
    {
      id: 'triggers',
      label: 'Triggers',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      items: [
        {
          type: 'trigger',
          subType: 'chat_created',
          label: 'Chat creado',
          description: 'Se activa cuando se crea un nuevo chat',
          config: { triggerType: 'chat_created' as TriggerType },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
        {
          type: 'trigger',
          subType: 'message_received',
          label: 'Mensaje recibido',
          description: 'Se activa cuando llega un mensaje',
          config: { triggerType: 'message_received' as TriggerType },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          ),
        },
        {
          type: 'trigger',
          subType: 'keyword_detected',
          label: 'Keyword detectada',
          description: 'Se activa con palabras clave',
          config: { triggerType: 'keyword_detected' as TriggerType, keywords: [], keywordMatchType: 'contains' },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          ),
        },
        {
          type: 'trigger',
          subType: 'user_inactive',
          label: 'Usuario inactivo',
          description: 'Se activa después de X minutos sin respuesta',
          config: { triggerType: 'user_inactive' as TriggerType, inactivityMinutes: 5 },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          type: 'trigger',
          subType: 'chat_assigned',
          label: 'Chat asignado',
          description: 'Se activa cuando se asigna un chat',
          config: { triggerType: 'chat_assigned' as TriggerType },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        },
        {
          type: 'trigger',
          subType: 'chat_closed',
          label: 'Chat cerrado',
          description: 'Se activa cuando se cierra un chat',
          config: { triggerType: 'chat_closed' as TriggerType },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
        },
        {
          type: 'trigger',
          subType: 'survey_answered',
          label: 'Encuesta respondida',
          description: 'Se activa cuando el usuario responde una encuesta',
          config: { triggerType: 'survey_answered' as TriggerType, surveyRatingFilter: 'any' },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'conditions',
      label: 'Condiciones',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      items: [
        {
          type: 'condition',
          label: 'Condición If/Else',
          description: 'Divide el flow según condiciones',
          config: { groups: [{ id: '1', operator: 'AND', rules: [] }], groupOperator: 'AND' },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'actions',
      label: 'Acciones',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      items: [
        {
          type: 'action',
          subType: 'send_message',
          label: 'Enviar mensaje',
          description: 'Envía un mensaje al usuario',
          config: { actionType: 'send_message' as ActionType, messageContent: '', messageType: 'text' },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
        {
          type: 'action',
          subType: 'assign_agent',
          label: 'Asignar agente',
          description: 'Asigna el chat a un agente',
          config: { actionType: 'assign_agent' as ActionType },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          ),
        },
        {
          type: 'action',
          subType: 'transfer_chat',
          label: 'Transferir chat',
          description: 'Transfiere el chat a otro equipo',
          config: { actionType: 'transfer_chat' as ActionType },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          ),
        },
        {
          type: 'action',
          subType: 'add_tag',
          label: 'Añadir tag',
          description: 'Añade una etiqueta al chat',
          config: { actionType: 'add_tag' as ActionType, tagName: '', tagColor: '#3B82F6' },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          ),
        },
        {
          type: 'action',
          subType: 'change_category',
          label: 'Cambiar categoría',
          description: 'Cambia la categoría del chat',
          config: { actionType: 'change_category' as ActionType },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          ),
        },
        {
          type: 'action',
          subType: 'create_note',
          label: 'Crear nota',
          description: 'Añade una nota interna al chat',
          config: { actionType: 'create_note' as ActionType, noteContent: '' },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          ),
        },
        {
          type: 'action',
          subType: 'call_webhook',
          label: 'Llamar webhook',
          description: 'Envía datos a un servicio externo',
          config: { actionType: 'call_webhook' as ActionType, webhookUrl: '', webhookMethod: 'POST' },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          ),
        },
        {
          type: 'action',
          subType: 'send_survey',
          label: 'Enviar encuesta',
          description: 'Envía una encuesta de satisfacción',
          config: { actionType: 'send_survey' as ActionType, surveyType: 'csat' },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          ),
        },
        {
          type: 'action',
          subType: 'close_chat',
          label: 'Cerrar chat',
          description: 'Cierra el chat automáticamente',
          config: { actionType: 'close_chat' as ActionType },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'delays',
      label: 'Esperas',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      items: [
        {
          type: 'delay',
          subType: 'fixed_time',
          label: 'Esperar tiempo',
          description: 'Espera un tiempo fijo',
          config: { delayType: 'fixed_time' as DelayType, delayMinutes: 5 },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          type: 'delay',
          subType: 'until_response',
          label: 'Esperar respuesta',
          description: 'Espera hasta que el usuario responda',
          config: { delayType: 'until_response' as DelayType, cancelOnChatClose: true },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
        {
          type: 'delay',
          subType: 'until_agent_online',
          label: 'Esperar agente',
          description: 'Espera hasta que un agente esté disponible',
          config: { delayType: 'until_agent_online' as DelayType },
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      id: 'flow',
      label: 'Flow',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      ),
      items: [
        {
          type: 'end',
          label: 'Fin',
          description: 'Finaliza el flow',
          config: {},
          icon: (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
            </svg>
          ),
        },
      ],
    },
  ];

  // Handle drag start
  const onDragStart = (event: React.DragEvent, item: NodeItem) => {
    event.dataTransfer.setData('application/reactflow/type', item.type);
    event.dataTransfer.setData('application/reactflow/label', item.label);
    event.dataTransfer.setData('application/reactflow/config', JSON.stringify(item.config));
    event.dataTransfer.effectAllowed = 'move';
  };

  // Filter items by search
  const filterItems = (items: NodeItem[]) => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
    );
  };

  return (
    <div className="w-64 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Nodos
        </h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar nodos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Categories */}
      <div className="flex-1 overflow-y-auto">
        {categories.map((category) => {
          const filteredItems = filterItems(category.items);
          if (searchQuery && filteredItems.length === 0) return null;

          return (
            <div key={category.id} className="border-b border-gray-100 dark:border-gray-700">
              {/* Category header */}
              <button
                onClick={() =>
                  setExpandedCategory(
                    expandedCategory === category.id ? null : category.id
                  )
                }
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="p-1.5 rounded-lg"
                    style={{
                      backgroundColor:
                        category.id === 'triggers'
                          ? '#D1FAE5'
                          : category.id === 'conditions'
                          ? '#FEF3C7'
                          : category.id === 'actions'
                          ? '#DBEAFE'
                          : category.id === 'delays'
                          ? '#EDE9FE'
                          : '#F3F4F6',
                      color:
                        category.id === 'triggers'
                          ? '#059669'
                          : category.id === 'conditions'
                          ? '#D97706'
                          : category.id === 'actions'
                          ? '#2563EB'
                          : category.id === 'delays'
                          ? '#7C3AED'
                          : '#4B5563',
                    }}
                  >
                    {category.icon}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {category.label}
                  </span>
                </div>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${
                    expandedCategory === category.id ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Category items */}
              {(expandedCategory === category.id || searchQuery) && (
                <div className="pb-2">
                  {filteredItems.map((item, idx) => (
                    <div
                      key={`${item.type}-${item.subType || idx}`}
                      draggable
                      onDragStart={(e) => onDragStart(e, item)}
                      onClick={() => onAddNode(item.type, item.label, item.config)}
                      className="mx-2 mb-1 px-3 py-2 flex items-start gap-3 rounded-lg cursor-grab hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors active:cursor-grabbing border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                    >
                      <span
                        className="p-1.5 rounded shrink-0"
                        style={{
                          backgroundColor: NODE_COLORS[item.type] + '20',
                          color: NODE_COLORS[item.type],
                        }}
                      >
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                          {item.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {item.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer tip */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Arrastra los nodos al canvas o haz clic para añadirlos
        </p>
      </div>
    </div>
  );
};

export default NodePalette;

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
import { Activity, AlignLeft, ArrowRightLeft, Ban, BarChart3, BellOff, Calendar, CalendarClock, CheckCircle2Icon, ChevronDown, ClipboardList, Clock, Contact, Database, Eraser, EyeOff, FileKey, FileWarning, FolderInput, Globe, Hash, Info, Keyboard, KeyboardOff, Layers, LayoutList, MapPin, MessageSquare, Palette, PenLine, Phone, Pin, PinOff, PlayCircle, Plus, RotateCcw, Save, ShieldCheck, Sparkles, Star, Sticker, StickyNote, Tag, Timer, Trash2, User, UserCog, Variable, Webhook, Workflow, XCircle, Zap } from 'lucide-react';


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
          <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-2">
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

        {/* Schedule Message Config */}
        {actionConfig.actionType === 'schedule_message' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/20 text-violet-400">
                <CalendarClock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Programar Mensaje</h4>
                <p className="text-[10px] text-zinc-500">Envío diferido o condicional</p>
              </div>
            </div>

            {/* Schedule Type Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Tipo de Programación</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { value: 'after_inactivity', label: 'Por Inactividad', icon: Timer },
                  { value: 'fixed_time', label: 'Fecha Específica', icon: Calendar },
                  { value: 'on_event', label: 'Por Evento', icon: Zap },
                ].map((type) => {
                  const currentType = actionConfig.scheduleMessageConfig?.type || actionConfig.scheduleType || 'after_inactivity';
                  const isSelected = currentType === type.value;
                  const Icon = type.icon;

                  return (
                    <button
                      key={type.value}
                      onClick={() => {
                        if (readOnly) return;
                        const newConfig = {
                          ...config,
                          scheduleMessageConfig: { ...(actionConfig.scheduleMessageConfig || {}), type: type.value as any },
                          scheduleType: type.value === 'on_event' ? 'fixed_time' : type.value,
                        };
                        setConfig(newConfig);
                        onChange(node.id, label, newConfig);
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all ${isSelected
                        ? 'bg-violet-500/10 border-violet-500/50 text-violet-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      {type.label}
                      {isSelected && <div className="ml-auto w-2 h-2 bg-violet-500 rounded-full shadow-[0_0_8px] shadow-violet-500/50" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-zinc-800 w-full" />

            {/* Configuration based on Type */}
            <div className="space-y-4">

              {/* 1. After Inactivity */}
              {(actionConfig.scheduleMessageConfig?.type || actionConfig.scheduleType || 'after_inactivity') === 'after_inactivity' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase r">Tiempo de Espera</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={1440}
                      value={actionConfig.scheduleMessageConfig?.delayMinutes || actionConfig.scheduleDelay || 30}
                      onChange={(e) => {
                        const delay = parseInt(e.target.value) || 30;
                        const newConfig = {
                          ...config,
                          scheduleMessageConfig: { ...(actionConfig.scheduleMessageConfig || {}), type: 'after_inactivity', delayMinutes: delay },
                          scheduleDelay: delay,
                        };
                        setConfig(newConfig);
                        onChange(node.id, label, newConfig);
                      }}
                      disabled={readOnly}
                      className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-center font-mono focus:border-violet-500 outline-none"
                    />
                    <span className="text-sm text-zinc-400">minutos sin respuesta del usuario</span>
                  </div>
                </div>
              )}

              {/* 2. Fixed Time */}
              {(actionConfig.scheduleMessageConfig?.type) === 'fixed_time' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase r">Fecha y Hora</label>
                  <input
                    type="datetime-local"
                    value={(() => {
                      const isoString = actionConfig.scheduleMessageConfig?.scheduledAt;
                      if (!isoString) return '';
                      const date = new Date(isoString);
                      // Format for datetime-local input
                      const pad = (n: number) => n.toString().padStart(2, '0');
                      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                    })()}
                    onChange={(e) => {
                      const localDate = new Date(e.target.value);
                      const newConfig = {
                        ...config,
                        scheduleMessageConfig: { ...(actionConfig.scheduleMessageConfig || {}), type: 'fixed_time', scheduledAt: localDate.toISOString() },
                      };
                      setConfig(newConfig);
                      onChange(node.id, label, newConfig);
                    }}
                    disabled={readOnly}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono focus:border-violet-500 outline-none appearance-none"
                  />
                  <p className="text-[10px] text-zinc-500">Variables soportadas: <code className="text-zinc-300">{`{{date.tomorrow}}`}</code></p>
                </div>
              )}

              {/* 3. On Event */}
              {(actionConfig.scheduleMessageConfig?.type) === 'on_event' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase r">Evento Disparador</label>
                  <select
                    value={actionConfig.scheduleMessageConfig?.triggerEvent || ''}
                    onChange={(e) => {
                      const newConfig = {
                        ...config,
                        scheduleMessageConfig: { ...(actionConfig.scheduleMessageConfig || {}), type: 'on_event', triggerEvent: e.target.value as any },
                      };
                      setConfig(newConfig);
                      onChange(node.id, label, newConfig);
                    }}
                    disabled={readOnly}
                    className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:border-violet-500 outline-none"
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

              {/* Message Content */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" /> Contenido del Mensaje
                </label>
                <textarea
                  value={actionConfig.scheduleMessageConfig?.messageContent || actionConfig.messageContent || ''}
                  onChange={(e) => {
                    const newConfig = {
                      ...config,
                      scheduleMessageConfig: { ...(actionConfig.scheduleMessageConfig || {}), messageContent: e.target.value },
                      messageContent: e.target.value,
                    };
                    setConfig(newConfig);
                    onChange(node.id, label, newConfig);
                  }}
                  disabled={readOnly}
                  rows={4}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 placeholder-zinc-600 focus:border-violet-500 outline-none resize-none"
                  placeholder="Hola {{user.firstName}}, ¿sigues ahí?..."
                />
              </div>

              {/* Cancel Conditions */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase r">Condiciones de Cancelación</label>

                <label className="flex items-center gap-3 p-2 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={actionConfig.scheduleMessageConfig?.cancelOnUserResponse ?? true}
                    onChange={(e) => {
                      const newConfig = { ...config, scheduleMessageConfig: { ...(actionConfig.scheduleMessageConfig || {}), cancelOnUserResponse: e.target.checked } };
                      setConfig(newConfig);
                      onChange(node.id, label, newConfig);
                    }}
                    disabled={readOnly}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-violet-500 focus:ring-offset-0"
                  />
                  <span className="text-xs text-zinc-300">Si el usuario responde antes</span>
                </label>

                <label className="flex items-center gap-3 p-2 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={actionConfig.scheduleMessageConfig?.cancelOnChatClose ?? true}
                    onChange={(e) => {
                      const newConfig = { ...config, scheduleMessageConfig: { ...(actionConfig.scheduleMessageConfig || {}), cancelOnChatClose: e.target.checked } };
                      setConfig(newConfig);
                      onChange(node.id, label, newConfig);
                    }}
                    disabled={readOnly}
                  // className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-violet-500 focus:ring-offset-0"
                  />

                  <span className="text-xs text-zinc-300">Si el chat se cierra</span>
                </label>

              </div>


              {/* Expiration */}
              <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                <Clock className="w-4 h-4 text-red-400" />
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-red-400 uppercase  block mb-1">Expiración</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={actionConfig.scheduleMessageConfig?.expiresInHours || 24}
                      onChange={(e) => {
                        const newConfig = { ...config, scheduleMessageConfig: { ...(actionConfig.scheduleMessageConfig || {}), expiresInHours: parseInt(e.target.value) || 24 } };
                        setConfig(newConfig);
                        onChange(node.id, label, newConfig);
                      }}
                      disabled={readOnly}
                      className="w-16 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-center text-xs text-white focus:border-red-500 outline-none"
                    />
                    <span className="text-xs text-zinc-500">horas antes de descartar</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Add/Remove Tag Config */}
        {(actionConfig.actionType === 'add_tag' || actionConfig.actionType === 'remove_tag') && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className={`p-2 rounded-lg border ${actionConfig.actionType === 'add_tag'
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">
                  {actionConfig.actionType === 'add_tag' ? 'Añadir Etiqueta' : 'Quitar Etiqueta'}
                </h4>
                <p className="text-[10px] text-zinc-500">
                  {actionConfig.actionType === 'add_tag' ? 'Marca el chat para organizarlo' : 'Elimina una marca existente'}
                </p>
              </div>
            </div>

            {/* Tag Name Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Nombre del Tag</label>
              <div className="relative group">
                {actionConfig.actionType === 'add_tag' ? (
                  <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
                ) : (
                  <Trash2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-red-500 transition-colors" />
                )}
                <input
                  type="text"
                  value={actionConfig.tagName || ''}
                  onChange={(e) => updateConfig('tagName', e.target.value)}
                  disabled={readOnly}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                  placeholder="Ej: vip_customer"
                />
              </div>
            </div>

            {/* Color Picker (Only for Add) */}
            {actionConfig.actionType === 'add_tag' && (
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-2">
                  <Palette className="w-3 h-3" /> Color de Etiqueta
                </label>
                <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-lg p-2">
                  <input
                    type="color"
                    value={actionConfig.tagColor || '#3B82F6'}
                    onChange={(e) => updateConfig('tagColor', e.target.value)}
                    disabled={readOnly}
                    className="w-8 h-8 rounded cursor-pointer border-none bg-transparent p-0"
                  />
                  <input
                    type="text"
                    value={actionConfig.tagColor || '#3B82F6'}
                    onChange={(e) => updateConfig('tagColor', e.target.value)}
                    className="bg-transparent text-xs text-zinc-300 font-mono outline-none uppercase w-20"
                  />
                </div>
              </div>
            )}

            {/* Live Preview */}
            <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg flex flex-col items-center justify-center gap-2">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Vista Previa</span>
              <div className="flex gap-2">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium text-white shadow-sm flex items-center gap-1.5 transition-all"
                  style={{ backgroundColor: actionConfig.actionType === 'add_tag' ? (actionConfig.tagColor || '#3B82F6') : '#52525b' }}
                >
                  <Tag className="w-3 h-3 fill-current opacity-20" />
                  {actionConfig.tagName || 'Nombre del Tag'}
                </span>
              </div>
            </div>

          </div>
        )}

        {/* Call Webhook Config */}
        {actionConfig.actionType === 'call_webhook' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20 text-pink-400">
                <Webhook className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Webhook Simple</h4>
                <p className="text-[10px] text-zinc-500">Notificación HTTP básica</p>
              </div>
            </div>

            {/* Combined Method & URL Input (Omnibar) */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" /> Endpoint Destino
              </label>

              <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-pink-500/50 focus-within:border-pink-500 transition-all">

                {/* Method Select */}
                <div className="relative border-r border-zinc-800 bg-zinc-950/30">
                  <select
                    value={actionConfig.webhookMethod || 'POST'}
                    onChange={(e) => updateConfig('webhookMethod', e.target.value)}
                    disabled={readOnly}
                    className={`h-full pl-3 pr-8 appearance-none bg-transparent text-xs font-bold outline-none cursor-pointer transition-colors ${(actionConfig.webhookMethod || 'POST') === 'GET' ? 'text-emerald-400' :
                      (actionConfig.webhookMethod || 'POST') === 'POST' ? 'text-blue-400' :
                        (actionConfig.webhookMethod || 'POST') === 'PUT' ? 'text-amber-400' :
                          'text-red-400'
                      }`}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>

                {/* URL Input */}
                <input
                  type="url"
                  value={actionConfig.webhookUrl || ''}
                  onChange={(e) => updateConfig('webhookUrl', e.target.value)}
                  disabled={readOnly}
                  className="flex-1 px-3 py-2.5 bg-transparent text-sm text-white font-mono placeholder-zinc-700 outline-none min-w-0"
                  placeholder="https://api.mi-sistema.com/hook"
                />
              </div>
            </div>

            {/* Info Note */}
            <div className="flex items-start gap-2 p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <Info className="w-3.5 h-3.5 text-pink-500/50 mt-0.5 shrink-0" />
              <p className="text-xs text-zinc-500 leading-relaxed">
                Este nodo envía automáticamente el contexto del chat (usuario, mensajes) en el cuerpo JSON. Para configuraciones avanzadas (Headers, Auth), usa la acción <strong>API Call</strong>.
              </p>
            </div>

          </div>
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


        {/* Create Note Config */}
        {actionConfig.actionType === 'create_note' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
                <StickyNote className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Nota Interna</h4>
                <p className="text-[10px] text-zinc-500">Solo visible para agentes y admins</p>
              </div>
            </div>

            {/* Note Content Textarea */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-2">
                <AlignLeft className="w-3.5 h-3.5" /> Contenido
              </label>
              <textarea
                value={actionConfig.noteContent || ''}
                onChange={(e) => updateConfig('noteContent', e.target.value)}
                disabled={readOnly}
                rows={4}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none resize-none transition-all leading-relaxed"
                placeholder="Escribe detalles sobre el cliente o el contexto de la conversación..."
              />
            </div>

            {/* Privacy Badge */}
            <div className="flex items-center gap-2 p-2.5 bg-amber-500/5 border border-amber-500/10 rounded-lg">
              <EyeOff className="w-3.5 h-3.5 text-amber-500/60" />
              <p className="text-xs text-zinc-500">
                <span className="text-amber-500/80 font-medium">Privado:</span> Este texto NO se enviará al usuario. Se guardará en el historial del chat.
              </p>
            </div>

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
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Enrutamiento</h4>
                <p className="text-[10px] text-zinc-500">Asigna la conversación a un humano</p>
              </div>
            </div>

            {/* Agent ID Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">ID del Agente (Opcional)</label>
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

        {/* Change Category Config */}
        {actionConfig.actionType === 'change_category' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-sky-500/10 rounded-lg border border-sky-500/20 text-sky-400">
                <FolderInput className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Clasificación</h4>
                <p className="text-[10px] text-zinc-500">Organiza el chat en una bandeja específica</p>
              </div>
            </div>

            {/* Category Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" /> Nueva Categoría
              </label>

              <div className="relative group">
                <select
                  value={actionConfig.categoryName || ''}
                  onChange={(e) => updateConfig('categoryName', e.target.value)}
                  disabled={readOnly}
                  className="w-full pl-4 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700"
                >
                  <option value="">Seleccionar categoría...</option>
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.value} value={cat.value} className="bg-zinc-900 text-zinc-300">
                      {cat.label}
                    </option>
                  ))}
                </select>

                {/* Custom Arrow */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Block User Config */}
        {actionConfig.actionType === 'block_user' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400">
                <Ban className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Bloquear Usuario</h4>
                <p className="text-[10px] text-zinc-500">Restringe el acceso al bot temporalmente</p>
              </div>
            </div>

            {/* Duration Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Duración del bloqueo</label>
              <div className="relative group">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-red-500 transition-colors" />
                <input
                  type="number"
                  value={actionConfig.blockDurationHours || 24}
                  onChange={(e) => updateConfig('blockDurationHours', parseInt(e.target.value))}
                  disabled={readOnly}
                  min={1}
                  className="w-full pl-9 pr-12 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono placeholder-zinc-700 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 font-medium">Horas</span>
              </div>
            </div>

            {/* Reason Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Motivo (Interno)</label>
              <div className="relative group">
                <FileWarning className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-red-500 transition-colors" />
                <input
                  type="text"
                  value={actionConfig.blockReason || ''}
                  onChange={(e) => updateConfig('blockReason', e.target.value)}
                  disabled={readOnly}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none transition-all"
                  placeholder="Ej: Spam, lenguaje ofensivo..."
                />
              </div>
            </div>

          </div>
        )}

        {/* Close/Reopen Chat Config */}
        {(actionConfig.actionType === 'close_chat' || actionConfig.actionType === 'reopen_chat') && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual Dymanic */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              {actionConfig.actionType === 'close_chat' ? (
                <>
                  <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200 uppercase ">Cerrar Chat</h4>
                    <p className="text-[10px] text-zinc-500">Finalizar sesión actual</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200 uppercase ">Reabrir Chat</h4>
                    <p className="text-[10px] text-zinc-500">Reactivar sesión archivada</p>
                  </div>
                </>
              )}
            </div>

            {/* Info Box */}
            <div className="flex items-start gap-3 p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <CheckCircle2Icon className={`w-4 h-4 mt-0.5 shrink-0 ${actionConfig.actionType === 'close_chat' ? 'text-red-500/50' : 'text-emerald-500/50'
                }`} />
              <p className="text-xs text-zinc-400 leading-relaxed">
                {actionConfig.actionType === 'close_chat'
                  ? 'Esta acción marcará la conversación como "Resuelta" y la archivará automáticamente. No se requiere configuración adicional.'
                  : 'Esta acción moverá la conversación de vuelta a la bandeja de "Abiertos" o "Pendientes" para ser atendida nuevamente.'}
              </p>
            </div>

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
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Encuesta de Satisfacción</h4>
                <p className="text-[10px] text-zinc-500">Recopila feedback del usuario</p>
              </div>
            </div>

            {/* Survey Type Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Metodología</label>
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
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Variable Personalizada</h4>
                <p className="text-[10px] text-zinc-500">Almacena datos específicos del usuario</p>
              </div>
            </div>

            {/* Field Key Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-2">
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Valor a Guardar</label>
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

        {/* Edit Message Config */}
        {actionConfig.actionType === 'edit_message' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
                <PenLine className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Editar Mensaje</h4>
                <p className="text-[10px] text-zinc-500">Modifica contenido enviado previamente</p>
              </div>
            </div>

            {/* Target Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Mensaje a Editar</label>
              <div className="relative group">
                <select
                  value={(actionConfig as any).editMessageConfig?.targetType || 'last_bot_message'}
                  onChange={(e) => updateConfig('editMessageConfig', { ...(actionConfig as any).editMessageConfig, targetType: e.target.value })}
                  disabled={readOnly}
                  className="w-full pl-3 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700"
                >
                  <option value="last_bot_message">🤖 Último mensaje del bot</option>
                  <option value="variable">📦 ID desde variable</option>
                  <option value="specific_id">🆔 ID específico</option>
                </select>

                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Conditional Input: Variable */}
            {(actionConfig as any).editMessageConfig?.targetType === 'variable' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase r">Nombre de Variable</label>
                <div className="relative group">
                  <Variable className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-amber-500 transition-colors" />
                  <input
                    type="text"
                    value={(actionConfig as any).editMessageConfig?.messageIdVariable || ''}
                    onChange={(e) => updateConfig('editMessageConfig', { ...(actionConfig as any).editMessageConfig, messageIdVariable: e.target.value })}
                    disabled={readOnly}
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono placeholder-zinc-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                    placeholder="saved_message_id"
                  />
                </div>
              </div>
            )}

            {/* Conditional Input: Specific ID */}
            {(actionConfig as any).editMessageConfig?.targetType === 'specific_id' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase r">ID del Mensaje</label>
                <div className="relative group">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-amber-500 transition-colors" />
                  <input
                    type="text"
                    value={(actionConfig as any).editMessageConfig?.messageId || ''}
                    onChange={(e) => updateConfig('editMessageConfig', { ...(actionConfig as any).editMessageConfig, messageId: e.target.value })}
                    disabled={readOnly}
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono placeholder-zinc-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none transition-all"
                    placeholder="msg_12345"
                  />
                </div>
              </div>
            )}

            {/* New Text Content */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-2">
                <MessageSquare className="w-3 h-3" /> Nuevo Contenido
              </label>
              <textarea
                value={(actionConfig as any).editMessageConfig?.newText || ''}
                onChange={(e) => updateConfig('editMessageConfig', { ...(actionConfig as any).editMessageConfig, newText: e.target.value })}
                disabled={readOnly}
                rows={3}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 placeholder-zinc-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none resize-none transition-all"
                placeholder="Escribe el nuevo texto del mensaje..."
              />
            </div>

          </div>
        )}

        {/* Delete Message Config */}
        {actionConfig.actionType === 'delete_message' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20 text-red-400">
                <Eraser className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Eliminar Mensaje</h4>
                <p className="text-[10px] text-zinc-500">Gestión del historial de chat</p>
              </div>
            </div>

            {/* Target Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Mensaje a eliminar</label>
              <div className="relative group">
                <select
                  value={(actionConfig).deleteMessageConfig?.targetType || 'last_bot_message'}
                  onChange={(e) => updateConfig('deleteMessageConfig', { ...(actionConfig as any).deleteMessageConfig, targetType: e.target.value })}
                  disabled={readOnly}
                  className="w-full pl-3 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700"
                >
                  <option value="last_bot_message">🤖 Último mensaje del bot</option>
                  <option value="last_user_message">👤 Último mensaje del usuario</option>
                  <option value="variable">📦 ID desde variable</option>
                  <option value="specific_id">🆔 ID específico</option>
                </select>

                {/* Custom Arrow */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Conditional Inputs */}
            {(actionConfig as any).deleteMessageConfig?.targetType === 'variable' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase r">Nombre de la Variable</label>
                <div className="relative group">
                  <Variable className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-red-500 transition-colors" />
                  <input
                    type="text"
                    value={(actionConfig as any).deleteMessageConfig?.messageIdVariable || ''}
                    onChange={(e) => updateConfig('deleteMessageConfig', { ...(actionConfig as any).deleteMessageConfig, messageIdVariable: e.target.value })}
                    disabled={readOnly}
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono placeholder-zinc-700 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none transition-all"
                    placeholder="message_id_var"
                  />
                </div>
              </div>
            )}

            {(actionConfig as any).deleteMessageConfig?.targetType === 'specific_id' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase r">ID del Mensaje</label>
                <div className="relative group">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-red-500 transition-colors" />
                  <input
                    type="text"
                    value={(actionConfig as any).deleteMessageConfig?.messageId || ''}
                    onChange={(e) => updateConfig('deleteMessageConfig', { ...(actionConfig as any).deleteMessageConfig, messageId: e.target.value })}
                    disabled={readOnly}
                    className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono placeholder-zinc-700 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none transition-all"
                    placeholder="msg_123456789"
                  />
                </div>
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
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Estado del Chat</h4>
                <p className="text-[10px] text-zinc-500">Simula actividad humana (escribiendo, grabando...)</p>
              </div>
            </div>

            {/* Action Type Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Tipo de Acción</label>
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
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Duración de Simulación</label>
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

        {actionConfig.actionType === 'delay_action' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-violet-500/10 rounded-lg border border-violet-500/20 text-violet-400">
                <Timer className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Pausa (Delay)</h4>
                <p className="text-[10px] text-zinc-500">Controla el ritmo de la conversación</p>
              </div>
            </div>

            {/* Time Input & Visualizer */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Duración de la pausa</label>
              <div className="flex items-center gap-4">

                {/* Number Input */}
                <div className="relative w-24">
                  <input
                    type="number"
                    value={(actionConfig as any).delayActionConfig?.delaySeconds || 2}
                    onChange={(e) => updateConfig('delayActionConfig', { ...(actionConfig as any).delayActionConfig, delaySeconds: Math.max(1, parseInt(e.target.value) || 1) })}
                    disabled={readOnly}
                    min={1}
                    max={300}
                    className="w-full pl-3 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all text-center"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 font-bold select-none">s</span>
                </div>

                {/* Visual Progress Bar (Decorativo) */}
                <div className="flex-1 flex flex-col justify-center gap-1.5 opacity-80">
                  <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                    <div
                      className="h-full bg-linear-to-r from-violet-600 to-fuchsia-500 transition-all duration-500 rounded-full"
                      style={{ width: `${Math.min((((actionConfig as any).delayActionConfig?.delaySeconds || 2) / 60) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-zinc-600 font-medium uppercase r">
                    <span>1s</span>
                    <span>60s+</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Show Typing Toggle Card */}
            <label className={`
            flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all group
            ${(actionConfig as any).delayActionConfig?.showTyping
                ? 'bg-violet-500/5 border-violet-500/30'
                : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'}
          `}>
              <div className="mt-0.5">
                <input
                  type="checkbox"
                  checked={(actionConfig as any).delayActionConfig?.showTyping || false}
                  onChange={(e) => updateConfig('delayActionConfig', { ...(actionConfig as any).delayActionConfig, showTyping: e.target.checked })}
                  disabled={readOnly}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-600 text-violet-500 focus:ring-violet-500/20 focus:ring-offset-0"
                />
              </div>
              <div className="flex-1">
                <div className={`flex items-center gap-2 mb-0.5 text-xs font-bold transition-colors ${(actionConfig as any).delayActionConfig?.showTyping ? 'text-violet-300' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Simular escritura</span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Muestra el estado <span className="font-mono text-violet-400">"escribiendo..."</span> en el chat del usuario mientras dura la pausa.
                </p>
              </div>
              {(actionConfig as any).delayActionConfig?.showTyping && (
                <div className="p-1.5 bg-violet-500/20 rounded-full animate-pulse">
                  <Activity className="w-3 h-3 text-violet-400" />
                </div>
              )}
            </label>

          </div>
        )}
        {/* Pin Message Config */}
        {actionConfig.actionType === 'pin_message' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20 text-amber-400">
                <Pin className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Fijar Mensaje</h4>
                <p className="text-[10px] text-zinc-500">Ancla un mensaje en la parte superior del chat</p>
              </div>
            </div>

            {/* Target Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Mensaje a fijar</label>
              <div className="relative group">
                <select
                  value={(actionConfig as any).pinMessageConfig?.targetType || 'last_bot_message'}
                  onChange={(e) => updateConfig('pinMessageConfig', { ...(actionConfig as any).pinMessageConfig, targetType: e.target.value })}
                  disabled={readOnly}
                  className="w-full pl-3 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700"
                >
                  <option value="last_bot_message">🤖 Último mensaje del bot</option>
                  <option value="variable">🔗 ID desde variable</option>
                </select>

                {/* Custom Arrow */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Disable Notification Toggle Card */}
            <label className={`
            flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all group
            ${(actionConfig as any).pinMessageConfig?.disableNotification
                ? 'bg-amber-500/5 border-amber-500/30'
                : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'}
          `}>
              <div className="mt-0.5">
                <input
                  type="checkbox"
                  checked={(actionConfig as any).pinMessageConfig?.disableNotification ?? true}
                  onChange={(e) => updateConfig('pinMessageConfig', { ...(actionConfig as any).pinMessageConfig, disableNotification: e.target.checked })}
                  disabled={readOnly}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-600 text-amber-500 focus:ring-amber-500/20 focus:ring-offset-0"
                />
              </div>
              <div className="flex-1">
                <div className={`flex items-center gap-2 mb-0.5 text-xs font-bold transition-colors ${(actionConfig as any).pinMessageConfig?.disableNotification ? 'text-amber-300' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                  <BellOff className="w-3.5 h-3.5" />
                  <span>Fijar silenciosamente</span>
                </div>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Si se activa, el usuario no recibirá una notificación sonora cuando el mensaje sea anclado.
                </p>
              </div>
            </label>

          </div>
        )}

        {/* Unpin Message Config */}
        {actionConfig.actionType === 'unpin_message' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800 text-zinc-400 shrink-0">
              <PinOff className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-200">Desfijar Mensaje</h4>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                Se retirará el último mensaje anclado en la conversación, devolviéndolo al flujo normal.
              </p>
            </div>
          </div>
        )}

        {/* Save Message ID Config */}
        {actionConfig.actionType === 'save_message_id' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20 text-emerald-400">
                <Save className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Guardar ID</h4>
                <p className="text-[10px] text-zinc-500">Captura el identificador único de un mensaje</p>
              </div>
            </div>

            {/* Variable Name Input (Styled as code syntax) */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-1.5">
                <Variable className="w-3 h-3" /> Nombre de la Variable
              </label>
              <div className="flex items-center group focus-within:ring-1 focus-within:ring-emerald-500/50 rounded-lg transition-all">
                <div className="bg-zinc-900 border border-r-0 border-zinc-800 rounded-l-lg px-3 py-2.5 text-xs text-zinc-500 font-mono select-none">
                  {'{{variables.'}
                </div>
                <input
                  type="text"
                  value={(actionConfig as any).saveMessageIdConfig?.variableName || ''}
                  onChange={(e) => updateConfig('saveMessageIdConfig', { ...(actionConfig as any).saveMessageIdConfig, variableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                  disabled={readOnly}
                  className="flex-1 px-0 py-2.5 text-xs border-y border-zinc-800 bg-zinc-900 text-emerald-400 font-mono focus:outline-none placeholder-zinc-700"
                  placeholder="mensaje_guardado"
                />
                <div className="bg-zinc-900 border border-l-0 border-zinc-800 rounded-r-lg px-3 py-2.5 text-xs text-zinc-500 font-mono select-none">
                  {'}}'}
                </div>
              </div>
            </div>

            {/* Message Source Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> Origen del Mensaje
              </label>
              <div className="relative group">
                <select
                  value={(actionConfig as any).saveMessageIdConfig?.messageSource || 'last_bot_message'}
                  onChange={(e) => updateConfig('saveMessageIdConfig', { ...(actionConfig as any).saveMessageIdConfig, messageSource: e.target.value })}
                  disabled={readOnly}
                  className="w-full pl-3 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700"
                >
                  <option value="last_bot_message">🤖 Último mensaje del bot</option>
                  <option value="last_user_message">👤 Último mensaje del usuario</option>
                </select>

                {/* Custom Arrow */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Info Footer */}
            <div className="text-[10px] text-zinc-500 bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
              Podrás usar este ID en acciones como <strong>"Editar Mensaje"</strong> o <strong>"Eliminar Mensaje"</strong>.
            </div>

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
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Ubicación Geográfica</h4>
                <p className="text-[10px] text-zinc-500">Coordenadas del mapa</p>
              </div>
            </div>

            {/* Coordinates Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase r">Latitud</label>
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
                <label className="text-[10px] font-bold text-zinc-500 uppercase r">Longitud</label>
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
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Tarjeta de Contacto</h4>
                <p className="text-[10px] text-zinc-500">Configura la VCard que se enviará</p>
              </div>
            </div>

            {/* Phone Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Teléfono</label>
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
                <label className="text-[10px] font-bold text-zinc-500 uppercase r">Nombre</label>
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
                <label className="text-[10px] font-bold text-zinc-500 uppercase r">Apellido</label>
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

        {/* Run Subflow Config */}
        {actionConfig.actionType === 'run_subflow' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20 text-orange-400">
                <Workflow className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Ejecutar Sub-Flujo</h4>
                <p className="text-[10px] text-zinc-500">Conecta y reutiliza otros flujos</p>
              </div>
            </div>

            {/* Flow Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Flujo Destino</label>
              <div className="relative group">
                <select
                  value={(actionConfig as any).subflowConfig?.flowId || ''}
                  onChange={(e) => updateConfig('subflowConfig', { ...(actionConfig as any).subflowConfig, flowId: e.target.value })}
                  disabled={readOnly}
                  className="w-full pl-4 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/50 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700"
                >
                  <option value="">Seleccionar flujo...</option>
                  {flows.map((flow) => (
                    <option key={flow.id} value={flow.id} className="bg-zinc-900 text-zinc-300">
                      {flow.name}
                    </option>
                  ))}
                </select>

                {/* Custom Arrow */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Options Cards */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Configuración de Ejecución</label>

              {/* Pass Variables Option */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-700 cursor-pointer transition-all group">
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={(actionConfig as any).subflowConfig?.passVariables || false}
                    onChange={(e) => updateConfig('subflowConfig', { ...(actionConfig as any).subflowConfig, passVariables: e.target.checked })}
                    disabled={readOnly}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-orange-500 focus:ring-orange-500/20 focus:ring-offset-0"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">Compartir Contexto</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    El sub-flujo tendrá acceso a todas las variables y datos del usuario actual.
                  </p>
                </div>
              </label>

              {/* Wait For Completion Option */}
              <label className="flex items-start gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-700 cursor-pointer transition-all group">
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={(actionConfig as any).subflowConfig?.waitForCompletion || false}
                    onChange={(e) => updateConfig('subflowConfig', { ...(actionConfig as any).subflowConfig, waitForCompletion: e.target.checked })}
                    disabled={readOnly}
                    className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-orange-500 focus:ring-orange-500/20 focus:ring-offset-0"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-300 group-hover:text-white transition-colors">Ejecución Síncrona</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Este flujo se pausará hasta que el sub-flujo termine. Si se desactiva, ambos correrán en paralelo.
                  </p>
                </div>
              </label>
            </div>

          </div>
        )}

        {/* Remove Keyboard Actions */}
        {(actionConfig.actionType === 'remove_keyboard' || actionConfig.actionType === 'remove_reply_keyboard') && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
            <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 text-red-400 shrink-0">
              <KeyboardOff className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-zinc-200">
                {actionConfig.actionType === 'remove_keyboard' ? 'Eliminar Teclado Inline' : 'Eliminar Menú Reply'}
              </h4>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                {actionConfig.actionType === 'remove_keyboard'
                  ? 'Se eliminarán los botones interactivos adjuntos al último mensaje del bot.'
                  : 'Se cerrará el menú de opciones persistente (teclado inferior) del usuario.'}
              </p>
            </div>
          </div>
        )}

        {/* Edit Keyboard Config */}
        {actionConfig.actionType === 'edit_keyboard' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400">
                <LayoutList className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Editar Teclado</h4>
                <p className="text-[10px] text-zinc-500">Modificar botones existentes</p>
              </div>
            </div>

            {/* Operation Select */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r">Tipo de Operación</label>
              <div className="relative group">
                <select
                  value={(actionConfig as any).editKeyboardConfig?.operation || 'replace'}
                  onChange={(e) => updateConfig('editKeyboardConfig', { ...(actionConfig as any).editKeyboardConfig, operation: e.target.value })}
                  disabled={readOnly}
                  className="w-full pl-3 pr-10 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none appearance-none cursor-pointer transition-all hover:border-zinc-700"
                >
                  <option value="replace">Reemplazar teclado completo</option>
                  <option value="remove">Eliminar teclado</option>
                  <option value="disable_button">Desactivar botón (próximamente)</option>
                </select>

                {/* Custom Arrow */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 group-hover:text-zinc-400 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Hint Card */}
            <div className="flex gap-2 p-2.5 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Para una gestión más avanzada de botones, te recomendamos usar la acción <strong>"Enviar Mensaje"</strong> y configurar el teclado directamente en los bloques.
              </p>
            </div>

          </div>
        )}
        {/* Send Sticker Config */}
        {actionConfig.actionType === 'send_sticker' && (
          <div className="mt-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-5 animate-in fade-in slide-in-from-top-2">

            {/* Header Visual */}
            <div className="flex items-center gap-3 pb-2 border-b border-zinc-800/50">
              <div className="p-2 bg-pink-500/10 rounded-lg border border-pink-500/20 text-pink-400">
                <Sticker className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-200 uppercase ">Enviar Sticker</h4>
                <p className="text-[10px] text-zinc-500">Envía una pegatina usando su identificador único</p>
              </div>
            </div>

            {/* Sticker ID Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase r flex items-center gap-1.5">
                <FileKey className="w-3 h-3" /> File ID del Sticker
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={(actionConfig).stickerConfig?.stickerId || ''}
                  onChange={(e) => updateConfig('stickerConfig', { stickerSource: 'file_id', stickerId: e.target.value })}
                  disabled={readOnly}
                  className="w-full pl-9 pr-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-pink-300 font-mono focus:border-pink-500 focus:ring-1 focus:ring-pink-500/50 outline-none transition-all placeholder-zinc-700"
                  placeholder="CAACAgIAAxkBAAI..."
                />
                <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 group-focus-within:text-pink-500 transition-colors" />
              </div>
            </div>

            {/* Info Hint */}
            <div className="flex items-start gap-2 p-2.5 bg-zinc-900/50 border border-zinc-800 rounded-lg">
              <Info className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
              <p className="text-[12px] text-zinc-500 leading-relaxed">
                Para obtener el <strong>File ID</strong>, envía el sticker deseado al bot (@userinfobot o similar) y copia el código que te devuelve.
              </p>
            </div>

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
    <div className="h-full w-[420px] max-w-[420px] min-w-[420px] shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden shadow-2xl" >

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
          <label className="block text-xs font-bold text-zinc-500 uppercase r mb-1">
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
        <div className="p-2 border-t border-zinc-800 bg-zinc-950 flex gap-3 shrink-0">
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

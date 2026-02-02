import React, { useState, useEffect } from 'react';
import {
  LayoutList, Trash2, X, Plus, ChevronDown,
  ArrowRight, GitMerge, Link, PlayCircle, ExternalLink,
  Check, CornerDownRight, MessageSquare, Edit3, Ban, MousePointerClick
} from 'lucide-react';

import type {
  KeyboardConfig, KeyboardButton, ButtonOnClick, ButtonActionMode,
  BlockKeyboardEditorProps, ButtonCardProps
} from '../../../types/flow';

// Estilos base para inputs del sistema
const inputBase = "bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-zinc-600";

// ============= BUTTON CARD (Componente Individual de Botón) =============

export const ButtonCard: React.FC<ButtonCardProps> = ({ 
  button, keyboardType, onUpdate, onRemove, readOnly, nodeId, nodes = [], flows = [] 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determinar el modo actual para la UI
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

  // Generar ID único si no existe
  const generateCallbackData = () => {
    const prefix = nodeId ? `flow:${nodeId}:btn:${button.id}` : `btn_${button.id}`;
    return prefix;
  };

  useEffect(() => {
    if (keyboardType === 'inline' && !button.callbackData) {
      onUpdate({ callbackData: generateCallbackData() });
    }
  }, []);

  // Verificar si falta configuración obligatoria
  const needsConfiguration = (
    (actionMode === 'goto_node' && !button.onClick?.targetNodeId && !button.targetNodeId) ||
    (actionMode === 'goto_flow' && !button.onClick?.targetFlowId && !button.targetFlowId) ||
    (actionMode === 'url' && !button.onClick?.url && !button.url)
  );

  return (
    <div className={`relative group w-full border rounded-xl transition-all overflow-hidden ${isExpanded ? 'border-indigo-500/50 bg-zinc-950 shadow-lg ring-1 ring-indigo-500/20' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}>
      
      {/* --- HEADER: Resumen del Botón (Siempre visible) --- */}
      <div className="flex items-center gap-3 p-3">
        
        {/* Icono de Tipo */}
        <div 
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 cursor-pointer ${keyboardType === 'inline' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}
          onClick={() => !readOnly && setIsExpanded(!isExpanded)}
        >
          <MousePointerClick className="w-4 h-4" />
        </div>

        {/* Input de Texto (Label) */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={button.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            disabled={readOnly}
            className="w-full bg-transparent text-sm font-semibold text-zinc-200 focus:text-white outline-none placeholder-zinc-600 border-none p-0 focus:ring-0"
            placeholder="Etiqueta del botón"
          />
          {/* Subtítulo de estado */}
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-500 cursor-pointer" onClick={() => !readOnly && setIsExpanded(!isExpanded)}>
             {needsConfiguration && <span className="text-amber-500 font-bold flex items-center gap-1">⚠️ Configurar</span>}
             <span className="flex items-center gap-1 truncate max-w-[150px]">
               {actionMode === 'continue' && 'Continuar flow'}
               {actionMode === 'goto_node' && 'Ir a nodo'}
               {actionMode === 'goto_flow' && 'Ir a flow'}
               {actionMode === 'url' && 'Abrir URL'}
               {actionMode === 'none' && 'Sin acción'}
             </span>
          </div>
        </div>

        {/* Controles: Separados y Organizados */}
        <div className="flex items-center gap-1 shrink-0 border-l border-zinc-800 pl-2 ml-1">
          {!readOnly && (
            <button 
              onClick={() => onRemove()} 
              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
              title="Eliminar botón"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded transition-all ${isExpanded ? 'bg-zinc-800 text-zinc-200' : ''}`}
            title={isExpanded ? "Colapsar" : "Expandir configuración"}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* --- BODY: Configuración Completa (Expandible) --- */}
      {isExpanded && (
        <div className="border-t border-zinc-800 bg-zinc-900/30 p-3 space-y-5 animate-in slide-in-from-top-2 duration-200">
          
          {/* 1. Callback ID (Solo Inline) */}
          {keyboardType === 'inline' && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase  flex justify-between">
                <span>Callback ID (Auto-generado)</span>
                <span className="font-mono text-zinc-600">{button.id}</span>
              </label>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5">
                <span className="text-[10px] text-zinc-500 font-mono select-none">ID:</span>
                <input
                  type="text"
                  value={button.callbackData || generateCallbackData()}
                  onChange={(e) => onUpdate({ callbackData: e.target.value })}
                  disabled={readOnly}
                  className="bg-transparent border-none text-[11px] font-mono text-indigo-300 w-full focus:ring-0 p-0"
                />
              </div>
            </div>
          )}

          {/* 2. Message Mode (Solo Inline - Send New vs Edit) */}
          {keyboardType === 'inline' && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase ">Modo de Mensaje</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Opción: Enviar Nuevo */}
                <label className={`
                  flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all
                  ${(button.onClick?.messageMode !== 'edit_message') 
                    ? 'bg-emerald-500/10 border-emerald-500/50' 
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}
                `}>
                  <input
                    type="radio"
                    name={`msg-mode-${button.id}`}
                    checked={(button.onClick?.messageMode !== 'edit_message')}
                    onChange={() => updateOnClick({ messageMode: 'send_new' })}
                    className="mt-1 text-emerald-500 bg-zinc-900 border-zinc-700"
                  />
                  <div>
                    <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3" /> Enviar nuevo
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Envía un mensaje nuevo al chat.</p>
                  </div>
                </label>

                {/* Opción: Editar Actual */}
                <label className={`
                  flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all
                  ${(button.onClick?.messageMode === 'edit_message') 
                    ? 'bg-amber-500/10 border-amber-500/50' 
                    : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}
                `}>
                  <input
                    type="radio"
                    name={`msg-mode-${button.id}`}
                    checked={(button.onClick?.messageMode === 'edit_message')}
                    onChange={() => updateOnClick({ messageMode: 'edit_message' })}
                    className="mt-1 text-amber-500 bg-zinc-900 border-zinc-700"
                  />
                  <div>
                    <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <Edit3 className="w-3 h-3" /> Editar mensaje
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Modifica el mensaje actual.</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 3. Actions List (Radio Cards Verticales) */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-500 uppercase ">Al hacer click</label>
            <div className="flex flex-col gap-2">
              
              {/* Action: Continue */}
              <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${actionMode === 'continue' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'}`}>
                <input type="radio" name={`act-${button.id}`} checked={actionMode === 'continue'} onChange={() => updateOnClick({ mode: 'continue', targetNodeId: undefined, url: undefined })} className="text-blue-500 bg-zinc-900 border-zinc-700" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-zinc-300 flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5"/> Continuar flow</div>
                  <div className="text-[10px] text-zinc-500">Sigue al siguiente nodo conectado.</div>
                </div>
              </label>

              {/* Action: Go to Node */}
              <label className={`flex flex-col gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${actionMode === 'goto_node' ? 'bg-purple-500/10 border-purple-500/50' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" name={`act-${button.id}`} checked={actionMode === 'goto_node'} onChange={() => updateOnClick({ mode: 'goto_node', url: undefined })} className="text-purple-500 bg-zinc-900 border-zinc-700" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-zinc-300 flex items-center gap-2"><GitMerge className="w-3.5 h-3.5"/> Ir a nodo específico</div>
                    <div className="text-[10px] text-zinc-500">Salta a otro nodo dentro de este flow.</div>
                  </div>
                </div>
                {actionMode === 'goto_node' && (
                  <div className="pl-7 mt-1">
                    <select
                      value={button.onClick?.targetNodeId || button.targetNodeId || ''}
                      onChange={(e) => updateOnClick({ targetNodeId: e.target.value })}
                      className={`${inputBase} w-full px-2 py-1.5 cursor-pointer`}
                    >
                      <option value="">-- Seleccionar nodo --</option>
                      {nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
                    </select>
                  </div>
                )}
              </label>

              {/* Action: Go to Flow */}
              <label className={`flex flex-col gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${actionMode === 'goto_flow' ? 'bg-orange-500/10 border-orange-500/50' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'}`}>
                <div className="flex items-center gap-3">
                  <input type="radio" name={`act-${button.id}`} checked={actionMode === 'goto_flow'} onChange={() => updateOnClick({ mode: 'goto_flow', url: undefined })} className="text-orange-500 bg-zinc-900 border-zinc-700" />
                  <div className="flex-1">
                    <div className="text-xs font-bold text-zinc-300 flex items-center gap-2"><PlayCircle className="w-3.5 h-3.5"/> Ir a otro flow</div>
                    <div className="text-[10px] text-zinc-500">Inicia otro flujo de automatización.</div>
                  </div>
                </div>
                {actionMode === 'goto_flow' && (
                  <div className="pl-7 mt-1">
                    <select
                      value={button.onClick?.targetFlowId || button.targetFlowId || ''}
                      onChange={(e) => updateOnClick({ targetFlowId: e.target.value })}
                      className={`${inputBase} w-full px-2 py-1.5 cursor-pointer`}
                    >
                      <option value="">-- Seleccionar flow --</option>
                      {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </div>
                )}
              </label>

              {/* Action: URL */}
              {keyboardType === 'inline' && (
                <label className={`flex flex-col gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${actionMode === 'url' ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'}`}>
                  <div className="flex items-center gap-3">
                    <input type="radio" name={`act-${button.id}`} checked={actionMode === 'url'} onChange={() => updateOnClick({ mode: 'url', targetNodeId: undefined })} className="text-cyan-500 bg-zinc-900 border-zinc-700" />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-zinc-300 flex items-center gap-2"><ExternalLink className="w-3.5 h-3.5"/> Abrir URL</div>
                      <div className="text-[10px] text-zinc-500">Abre un enlace externo en el navegador.</div>
                    </div>
                  </div>
                  {actionMode === 'url' && (
                    <div className="pl-7 mt-1">
                      <input
                        type="url"
                        value={button.onClick?.url || button.url || ''}
                        onChange={(e) => updateOnClick({ url: e.target.value })}
                        className={`${inputBase} w-full px-2 py-1.5`}
                        placeholder="https://ejemplo.com"
                      />
                    </div>
                  )}
                </label>
              )}

              {/* Action: None */}
              <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${actionMode === 'none' ? 'bg-zinc-800 border-zinc-600' : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900'}`}>
                <input type="radio" name={`act-${button.id}`} checked={actionMode === 'none'} onChange={() => updateOnClick({ mode: 'none', targetNodeId: undefined, url: undefined })} className="text-zinc-500 bg-zinc-900 border-zinc-700" />
                <div className="flex-1">
                  <div className="text-xs font-bold text-zinc-300 flex items-center gap-2"><Ban className="w-3.5 h-3.5"/> Sin acción</div>
                  <div className="text-[10px] text-zinc-500">Solo envía callback event, no navega.</div>
                </div>
              </label>

            </div>
          </div>

        </div>
      )}
    </div>
  );
};

// ============= MAIN KEYBOARD EDITOR (Contenedor de Filas) =============

export const BlockKeyboardEditor: React.FC<BlockKeyboardEditorProps> = ({ keyboard, onChange, readOnly, nodeId, nodes, flows }) => {
  const [isExpanded, setIsExpanded] = useState(!!keyboard?.rows?.some(r => r.buttons.length > 0));

  const initKeyboard = () => {
    const btnId = Date.now().toString();
    onChange({
      type: 'inline',
      rows: [{ id: Date.now().toString(), buttons: [{ id: btnId, text: 'Botón 1', callbackData: `btn:${btnId}`, onClick: { mode: 'continue' } }] }]
    });
    setIsExpanded(true);
  };

  const removeKeyboard = () => {
    onChange(undefined);
    setIsExpanded(false);
  };

  if (!keyboard || !isExpanded) {
    return (
      <button
        onClick={initKeyboard}
        disabled={readOnly}
        className="w-full py-2.5 border border-dashed border-zinc-700 rounded-xl text-xs font-medium text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2 group"
      >
        <LayoutList className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" /> 
        Añadir Teclado Interactivo
      </button>
    );
  }

  return (
    <div className="bg-zinc-950/30 border border-zinc-800 rounded-xl p-3 space-y-4">
      
      {/* Cabecera del Teclado */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400"><LayoutList className="w-4 h-4" /></div>
          <span className="text-xs font-bold text-zinc-200">Configuración de Teclado</span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Selector de Tipo */}
          <select
            value={keyboard.type}
            onChange={(e) => onChange({ ...keyboard, type: e.target.value as any })}
            className="bg-zinc-900 border border-zinc-700 text-[10px] text-zinc-300 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="inline">Inline (Burbujas)</option>
            <option value="reply">Reply (Menú Fijo)</option>
          </select>

          {!readOnly && (
            <button 
              onClick={removeKeyboard} 
              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Eliminar teclado completo"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filas de Botones */}
      <div className="space-y-4">
        {keyboard.rows.map((row, rIdx) => (
          <div key={row.id} className="relative space-y-2">
            
            {/* Cabecera de Fila */}
            <div className="flex justify-between items-center px-1">
              <span className="text-[9px] font-bold text-zinc-600 uppercase st">Fila {rIdx + 1}</span>
              {!readOnly && (
                <button 
                  onClick={() => {
                    const newRows = [...keyboard.rows];
                    newRows.splice(rIdx, 1);
                    onChange({ ...keyboard, rows: newRows });
                  }}
                  className="text-[10px] text-zinc-600 hover:text-red-400 flex items-center gap-1 transition-colors"
                >
                  <X className="w-3 h-3"/> Eliminar fila
                </button>
              )}
            </div>
            
            {/* Grid de Botones (Responsive) */}
            <div className="grid grid-cols-1 gap-2"> {/* Usar 1 col asegura que no se rompa en paneles pequeños */}
              {row.buttons.map((btn, bIdx) => (
                <ButtonCard
                  key={btn.id}
                  button={btn}
                  keyboardType={keyboard.type as any}
                  onUpdate={(u) => {
                    const newRows = [...keyboard.rows];
                    newRows[rIdx].buttons[bIdx] = { ...newRows[rIdx].buttons[bIdx], ...u };
                    onChange({ ...keyboard, rows: newRows });
                  }}
                  onRemove={() => {
                    const newRows = [...keyboard.rows];
                    newRows[rIdx].buttons.splice(bIdx, 1);
                    onChange({ ...keyboard, rows: newRows });
                  }}
                  readOnly={readOnly}
                  nodeId={nodeId}
                  nodes={nodes}
                  flows={flows}
                />
              ))}
              
              {/* Botón Añadir en la Fila */}
              {!readOnly && (
                <button
                  onClick={() => {
                    const newRows = [...keyboard.rows];
                    const btnId = Date.now().toString();
                    newRows[rIdx].buttons.push({ id: btnId, text: 'Nuevo Botón', callbackData: `btn:${btnId}`, onClick: { mode: 'continue' } });
                    onChange({ ...keyboard, rows: newRows });
                  }}
                  className="w-full py-2 border border-dashed border-zinc-800 rounded-lg flex items-center justify-center text-zinc-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all text-xs font-medium gap-1"
                >
                  <Plus className="w-3 h-3" /> Añadir Botón a Fila {rIdx + 1}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Botón Añadir Nueva Fila (Global) */}
      {!readOnly && (
        <button
          onClick={() => {
            const btnId = Date.now().toString();
            onChange({
              ...keyboard,
              rows: [...keyboard.rows, { id: Date.now().toString(), buttons: [{ id: btnId, text: 'Nuevo Botón', callbackData: `btn:${btnId}`, onClick: { mode: 'continue' } }] }]
            });
          }}
          className="w-full py-2 text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg hover:text-white hover:border-zinc-700 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-3.5 h-3.5" /> Nueva Fila
        </button>
      )}
    </div>
  );
};
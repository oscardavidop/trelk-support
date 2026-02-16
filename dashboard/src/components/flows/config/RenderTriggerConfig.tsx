import React from 'react';
import { 
  Zap, MessageSquare, Terminal, Hash, UserPlus, XCircle, Clock, 
  CheckSquare, FolderInput, Tag, FileText, RotateCcw, UserCheck, 
  AlertTriangle, Search, Info
} from 'lucide-react';
import type { TriggerConfig } from '../../../types/flow';
import { TRIGGER_LABELS } from '../../../types/flow';

// Trigger Info Map
const TRIGGER_INFO: Record<string, { description: string; color: string; icon: any }> = {
  chat_created: { description: 'Nueva conversación iniciada', color: 'emerald', icon: MessageSquare },
  message_received: { description: 'Cualquier mensaje del usuario', color: 'blue', icon: MessageSquare },
  command_received: { description: 'Comando (/start, /help)', color: 'cyan', icon: Terminal },
  keyword_detected: { description: 'Palabras clave específicas', color: 'purple', icon: Hash },
  chat_assigned: { description: 'Agente asignado al chat', color: 'indigo', icon: UserPlus },
  chat_closed: { description: 'Conversación finalizada', color: 'zinc', icon: XCircle },
  user_inactive: { description: 'Sin respuesta por X tiempo', color: 'orange', icon: Clock },
  survey_answered: { description: 'Respuesta a encuesta CSAT', color: 'yellow', icon: CheckSquare },
  category_changed: { description: 'Cambio de categoría', color: 'sky', icon: FolderInput },
  tag_added: { description: 'Etiqueta añadida al chat', color: 'pink', icon: Tag },
  file_received: { description: 'Archivo multimedia recibido', color: 'purple', icon: FileText },
  chat_reopened: { description: 'Chat reabierto', color: 'amber', icon: RotateCcw },
  agent_online: { description: 'Agente conectado', color: 'green', icon: UserCheck },
  sla_warning: { description: 'SLA próximo a vencer', color: 'red', icon: AlertTriangle },
};

const renderTriggerConfig = (config: TriggerConfig, updateConfig: (key: string, value: any) => void, readOnly: boolean) => {
  const triggerConfig = config as TriggerConfig;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      
      {/* Trigger Type Selector */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-zinc-500 uppercase r flex items-center gap-2">
          <Zap className="w-3.5 h-3.5" /> Condición de Activación
        </label>
        
        <div className="grid grid-cols-1 gap-2 max-h-[350px] overflow-y-auto custom-scrollbar pr-1">
          {Object.entries(TRIGGER_LABELS).map(([value, label]) => {
            const info = TRIGGER_INFO[value] || { description: '', color: 'zinc', icon: Zap };
            const Icon = info.icon;
            const isSelected = triggerConfig.triggerType === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => !readOnly && updateConfig('triggerType', value)}
                disabled={readOnly}
                className={`
                  relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all group
                  ${isSelected 
                    ? `bg-${info.color}-500/10 border-${info.color}-500/30 ring-1 ring-${info.color}-500/20` 
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'}
                `}
              >
                <div className={`p-2 rounded-lg transition-colors ${isSelected ? `bg-${info.color}-500/20 text-${info.color}-400` : 'bg-zinc-800 text-zinc-500 group-hover:text-zinc-300'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-bold ${isSelected ? 'text-zinc-50' : 'text-zinc-300 group-hover:text-zinc-50'}`}>
                    {label}
                  </div>
                  <div className="text-[10px] text-zinc-500 truncate">
                    {info.description}
                  </div>
                </div>
                {isSelected && <div className={`w-2 h-2 rounded-full bg-${info.color}-500 shadow-[0_0_8px] shadow-${info.color}-500/50`} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dynamic Config Sections */}
      {triggerConfig.triggerType === 'command_received' && (
        <div className="p-4 bg-zinc-950 border border-cyan-500/20 rounded-xl space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 rounded-bl-full -mr-10 -mt-10 pointer-events-none" />
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-cyan-500 uppercase r">Comando</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-500 font-mono">/</span>
              <input
                type="text"
                value={triggerConfig.command || ''}
                onChange={(e) => updateConfig('command', e.target.value.replace(/^\//, '').toLowerCase())}
                className="w-full pl-6 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 font-mono text-sm focus:border-cyan-500 outline-none"
                placeholder="start"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase r">Parámetros</label>
            <div className="grid grid-cols-2 gap-2">
               {['any', 'exact', 'contains', 'regex'].map(opt => (
                 <button
                   key={opt}
                   onClick={() => updateConfig('commandParamMatch', opt)}
                   className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                     (triggerConfig.commandParamMatch || 'any') === opt 
                     ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' 
                     : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                   }`}
                 >
                   {opt === 'any' ? 'Cualquiera' : opt === 'exact' ? 'Exacto' : opt === 'contains' ? 'Contiene' : 'Regex'}
                 </button>
               ))}
            </div>
            {triggerConfig.commandParamMatch !== 'any' && (
               <input 
                 type="text" 
                 value={triggerConfig.commandParam || ''} 
                 onChange={e => updateConfig('commandParam', e.target.value)}
                 className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 text-sm focus:border-cyan-500 outline-none mt-2" 
                 placeholder="Valor esperado..." 
               />
            )}
          </div>
        </div>
      )}

      {triggerConfig.triggerType === 'keyword_detected' && (
        <div className="p-4 bg-zinc-950 border border-purple-500/20 rounded-xl space-y-4">
           <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-purple-500 uppercase r">Palabras Clave</label>
              <div className="flex gap-1 bg-zinc-900 rounded p-0.5 border border-zinc-800">
                 {['contains', 'exact', 'regex'].map(opt => (
                    <button 
                      key={opt}
                      onClick={() => updateConfig('keywordMatchType', opt)}
                      className={`px-2 py-0.5 text-[10px] rounded ${
                        (triggerConfig.keywordMatchType || 'contains') === opt 
                        ? 'bg-purple-500 text-zinc-50' 
                        : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {opt === 'contains' ? 'Contiene' : opt === 'exact' ? 'Exacto' : 'Regex'}
                    </button>
                 ))}
              </div>
           </div>
           
           <textarea
             value={(triggerConfig.keywords || []).join('\n')}
             onChange={(e) => updateConfig('keywords', e.target.value.split('\n'))}
             rows={4}
             className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 text-sm font-mono focus:border-purple-500 outline-none resize-none"
             placeholder="Una palabra por línea..."
           />
           
           <div className="flex flex-wrap gap-1.5">
              {(triggerConfig.keywords || []).filter(k => k.trim()).map((k, i) => (
                 <span key={i} className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 rounded text-[10px] text-purple-300 font-mono truncate max-w-[100px]">
                    {k}
                 </span>
              ))}
           </div>
        </div>
      )}

      {triggerConfig.triggerType === 'user_inactive' && (
         <div className="p-4 bg-zinc-950 border border-orange-500/20 rounded-xl flex items-center gap-3">
            <Clock className="w-5 h-5 text-orange-500" />
            <div className="flex-1">
               <label className="text-xs font-bold text-orange-500 uppercase r block mb-1">Tiempo de Inactividad</label>
               <div className="flex items-center gap-2">
                  <input 
                    type="number" 
                    value={triggerConfig.inactivityMinutes || 5}
                    onChange={e => updateConfig('inactivityMinutes', parseInt(e.target.value))}
                    min={1}
                    className="w-16 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-center text-zinc-50 focus:border-orange-500 outline-none"
                  />
                  <span className="text-sm text-zinc-400">minutos sin respuesta</span>
               </div>
            </div>
         </div>
      )}

      {/* Info Box for simple triggers */}
      {['chat_created', 'chat_assigned', 'chat_closed', 'agent_online', 'sla_warning', 'chat_reopened'].includes(triggerConfig.triggerType || '') && (
         <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg flex items-start gap-3">
            <Info className="w-4 h-4 text-zinc-500 mt-0.5" />
            <p className="text-xs text-zinc-400">Este disparador no requiere configuración adicional.</p>
         </div>
      )}

    </div>
  );
};

export default renderTriggerConfig;
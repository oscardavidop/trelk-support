/**
 * TriggerNode - Premium Zinc Refactor
 * Flow initialization node
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { 
  MessageSquarePlus, Mail, Search, UserPlus, 
  CheckCircle2, Clock, Star, FolderInput, 
  Tag, Paperclip, RotateCw, UserCheck, 
  AlertTriangle, Zap
} from 'lucide-react';

import type { TriggerConfig, TriggerType } from '../../../types/flow';
import { TRIGGER_LABELS } from '../../../types/flow';
import NodeWrapper from './NodeWrapper';

// --- Interfaces & Helpers ---

interface TriggerNodeData {
  label: string;
  config: TriggerConfig;
}

// Helper: Get Icon based on Trigger Type (Using Lucide)
const getTriggerVisuals = (type?: TriggerType) => {
  switch (type) {
    case 'chat_created': return { icon: MessageSquarePlus };
    case 'message_received': return { icon: Mail };
    case 'keyword_detected': return { icon: Search };
    case 'chat_assigned': return { icon: UserPlus };
    case 'chat_closed': return { icon: CheckCircle2 };
    case 'user_inactive': return { icon: Clock };
    case 'survey_answered': return { icon: Star };
    case 'category_changed': return { icon: FolderInput };
    case 'tag_added': return { icon: Tag };
    case 'file_received': return { icon: Paperclip };
    case 'chat_reopened': return { icon: RotateCw };
    case 'agent_online': return { icon: UserCheck };
    case 'sla_warning': return { icon: AlertTriangle };
    default: return { icon: Zap };
  }
};

// --- Component ---

function TriggerNode({ data, selected, id }: NodeProps<TriggerNodeData>) {
  const triggerType = data.config?.triggerType;
  const triggerLabel = triggerType ? (TRIGGER_LABELS[triggerType] || triggerType) : 'Seleccionar Trigger';
  const { icon: Icon } = getTriggerVisuals(triggerType);

  return (
    <NodeWrapper nodeId={id} selected={selected}>
      <div
        className={`
          relative flex flex-col
          bg-zinc-950 
          rounded-xl shadow-2xl 
          border-[1.5px] min-w-[240px] max-w-[260px]
          transition-all duration-200
          ${selected 
            ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
            : 'border-zinc-800 hover:border-zinc-700'
          }
        `}
      >
        {/* --- HEADER --- */}
        <div className="p-3 rounded-t-xl border-b border-zinc-800/50 flex items-center gap-3 bg-zinc-900/30">
          
          {/* Icon Box */}
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-lg border
            ${selected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-zinc-900 border-zinc-800 text-emerald-600 dark:text-emerald-500'
            }
          `}>
            <Icon className="w-4 h-4" />
          </div>

          {/* Titles */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase r text-zinc-500 mb-0.5">
              Evento Inicial
            </div>
            <div className="font-bold text-zinc-200 text-xs leading-tight truncate">
              {triggerLabel}
            </div>
          </div>
        </div>

        {/* --- BODY --- */}
        <div className="p-3">

          {/* Case: KEYWORDS */}
          {triggerType === 'keyword_detected' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                 <span className="text-[9px] font-bold text-zinc-500 uppercase ">Palabras Clave</span>
                 <span className="text-[9px] bg-zinc-900 text-zinc-400 px-1.5 rounded">{data.config?.keywords?.length || 0}</span>
              </div>
              
              <div className="flex flex-wrap gap-1.5">
                {(data.config?.keywords?.length ?? 0) > 0 ? (
                  <>
                    {data.config!.keywords!.slice(0, 3).map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded text-[10px] font-mono truncate max-w-[80px]"
                      >
                        {kw}
                      </span>
                    ))}
                    {data.config!.keywords!.length > 3 && (
                      <span className="px-1.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] rounded border border-emerald-500/20 font-bold">
                        +{data.config!.keywords!.length - 3}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-zinc-600 italic">Sin configurar</span>
                )}
              </div>
            </div>
          )}

          {/* Case: INACTIVITY */}
          {triggerType === 'user_inactive' && (
            <div className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-lg">
              <Clock className="w-4 h-4 text-amber-500/80" />
              <div className="flex flex-col">
                <span className="text-[9px] text-amber-500/60 font-bold uppercase">Tiempo de espera</span>
                <span className="text-xs font-bold text-amber-400">
                  {data.config?.inactivityMinutes ? `${data.config.inactivityMinutes} minutos` : 'No definido'}
                </span>
              </div>
            </div>
          )}

          {/* Case: CATEGORY / TAG */}
          {(triggerType === 'category_changed' || triggerType === 'tag_added') && (
             <div className="text-[10px] text-zinc-400 bg-zinc-900/50 p-2 rounded border border-zinc-800/50">
               Se activa cuando {triggerType === 'category_changed' ? 'la categoría cambia' : 'se añade una etiqueta'}.
             </div>
          )}

          {/* Case: GENERIC */}
          {!['keyword_detected', 'user_inactive', 'category_changed', 'tag_added'].includes(triggerType || '') && (
            <div className="text-[10px] text-zinc-500 italic">
              Este evento inicia el flujo automáticamente.
            </div>
          )}
        </div>

        {/* --- HANDLE (Output Only) --- */}
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
          <Handle
            type="source"
            position={Position.Bottom}
            className="!relative !transform-none !w-3 !h-3 !bg-emerald-500 !border-2 !border-zinc-950 transition-transform hover:scale-125 hover:!bg-emerald-400"
          />
        </div>

      </div>
    </NodeWrapper>
  );
}

export default memo(TriggerNode);
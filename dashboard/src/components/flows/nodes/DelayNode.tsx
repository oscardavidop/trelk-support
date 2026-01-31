/**
 * DelayNode - Premium Zinc Refactor
 * Flow delay/wait node
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
  Timer, MessageCircle, UserCheck, Store,
  GitBranch, Hourglass, XCircle, MessageSquareOff,
  Zap
} from 'lucide-react';

import NodeWrapper from './NodeWrapper';
import type { DelayConfig, DelayType } from '../../../types/flow';
import { DELAY_LABELS, NODE_STYLES } from '../../../types/flow';

// --- Interfaces & Helpers ---

interface DelayNodeData {
  label: string;
  config: DelayConfig;
}

// Helper: Get Icon based on Delay Type
const getDelayVisuals = (type?: DelayType) => {
  switch (type) {
    case 'fixed_time': return { icon: Timer, label: 'Tiempo Fijo' };
    case 'until_response': return { icon: MessageCircle, label: 'Hasta Respuesta' };
    case 'until_agent_online': return { icon: UserCheck, label: 'Agente Online' };
    case 'until_business_hours': return { icon: Store, label: 'Horario Laboral' };
    case 'until_condition': return { icon: GitBranch, label: 'Hasta Condición' };
    default: return { icon: Hourglass, label: 'Esperar' };
  }
};

// --- Component ---

function DelayNode({ data, selected, id }: NodeProps<DelayNodeData>) {
  const delayType = data.config?.delayType;
  const { icon: Icon, label: typeLabel } = getDelayVisuals(delayType);
  const styles = NODE_STYLES['delay'];
  // Helper logic for display text
  const getDelayInfo = () => {
    if (!data.config) return null;

    switch (delayType) {
      case 'fixed_time':
        if (data.config.delayMinutes) {
          const hours = Math.floor(data.config.delayMinutes / 60);
          const mins = data.config.delayMinutes % 60;
          if (hours > 0) return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
          return `${mins} min`;
        }
        return '0 min';

      case 'until_response':
        return data.config.maxWaitMinutes
          ? `Máx. espera: ${data.config.maxWaitMinutes} min`
          : 'Espera indefinida';

      case 'until_agent_online': return 'Esperando disponibilidad...';
      case 'until_business_hours': return 'Esperando apertura...';
      case 'until_condition': return 'Evaluando condición...';
      default: return null;
    }
  };

  return (
    <NodeWrapper nodeId={id} selected={selected}>
      <div
        className={`
          relative flex flex-col
          bg-zinc-950 
          rounded-xl shadow-2xl 
          border-[1.5px] min-w-[200px] max-w-[240px]
          transition-all duration-200
          ${selected ? `${styles.border} ring-2 ${styles.ring}` : 'border-zinc-800'}`}
      >
        {/* --- INPUT HANDLE --- */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !-top-1.5 !bg-zinc-200 !border-2 !border-zinc-950 transition-transform hover:scale-125 hover:!bg-violet-400"
        />

        {/* --- HEADER --- */}
        <div className="p-3 rounded-t-xl border-b border-zinc-800/50 flex items-center gap-3 bg-zinc-900/30">

          {/* Icon Box */}
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-lg border
            ${selected
              ? 'bg-violet-500/10 border-violet-500/20 text-violet-400'
              : 'bg-zinc-900 border-zinc-800 text-violet-600 dark:text-violet-500'
            }
          `}>
            <Icon className="w-4 h-4" />
          </div>

          {/* Titles */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
              {typeLabel}
            </div>
            <div className="font-bold text-zinc-200 text-xs leading-tight truncate">
              {data.label || 'Pausa'}
            </div>
          </div>
        </div>

        {/* --- BODY --- */}
        <div className="p-3 space-y-3">

          {/* Main Info Badge */}
          {getDelayInfo() && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-violet-500/5 border border-violet-500/10 rounded-lg">
              <Hourglass className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
              <span className="text-[11px] font-medium text-violet-200 truncate">
                {getDelayInfo()}
              </span>
            </div>
          )}

          {/* Cancel Conditions (Tags) */}
          {(data.config?.cancelOnChatClose || data.config?.cancelOnUserResponse) && (
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[9px] font-bold text-zinc-600 uppercase ml-1">Cancelar si:</span>
              <div className="flex flex-wrap gap-1.5">
                {data.config.cancelOnUserResponse && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[9px] font-medium">
                    <MessageSquareOff className="w-2.5 h-2.5" />
                    Usuario responde
                  </div>
                )}
                {data.config.cancelOnChatClose && (
                  <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded text-[9px] font-medium">
                    <XCircle className="w-2.5 h-2.5" />
                    Chat cierra
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* --- OUTPUT HANDLE --- */}
        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2">
          <Handle
            type="source"
            position={Position.Bottom}
            className="!relative !transform-none !w-3 !h-3 !bg-violet-500 !border-2 !border-zinc-950 transition-transform hover:scale-125 hover:!bg-violet-400"
          />
        </div>

      </div>
    </NodeWrapper>
  );
}

export default memo(DelayNode);
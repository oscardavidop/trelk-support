/**
 * EndNode - Premium Zinc Refactor
 * Flow termination node
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Flag, StopCircle } from 'lucide-react';
import NodeWrapper from './NodeWrapper';

interface EndNodeData {
  label: string;
  config: Record<string, any>;
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

function EndNode({ data, selected, id }: NodeProps<EndNodeData>) {
  return (
    <NodeWrapper nodeId={id} selected={selected}>
      <div
        className={`
          relative flex flex-col
          bg-zinc-950 
          rounded-xl shadow-2xl 
          border-[1.5px] min-w-[160px] max-w-[200px]
          transition-all duration-200
          ${selected 
            ? 'border-zinc-500 ring-2 ring-zinc-500/20' 
            : 'border-zinc-800 hover:border-zinc-700'
          }
        `}
      >
        {/* --- INPUT HANDLE --- */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !-top-1.5 !bg-zinc-400 !border-2 !border-zinc-950 transition-transform hover:scale-125"
        />

        {/* --- HEADER --- */}
        <div className="p-3 rounded-t-xl border-b border-zinc-800/50 flex items-center gap-3 bg-zinc-900/30">
          
          {/* Icon Box */}
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-lg border
            ${selected
              ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
              : 'bg-zinc-900 border-zinc-800 text-zinc-500'
            }
          `}>
            <Flag className="w-4 h-4" />
          </div>

          {/* Titles */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mb-0.5">
              Estado Final
            </div>
            <div className="font-bold text-zinc-200 text-xs leading-tight truncate">
              {data.label || 'Fin del Flujo'}
            </div>
          </div>
        </div>

        {/* --- BODY --- */}
        <div className="p-3 flex items-center justify-center gap-2">
           <StopCircle className="w-3.5 h-3.5 text-zinc-600" />
           <span className="text-[10px] text-zinc-500 italic">
             El proceso termina aquí
           </span>
        </div>

      </div>
    </NodeWrapper>
  );
}

export default memo(EndNode);
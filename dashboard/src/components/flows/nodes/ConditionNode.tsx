/**
 * ConditionNode - Premium Zinc Refactor
 * Logic branching node (If/Else)
 */

import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { 
  GitFork, 
  CheckCircle2, 
  XCircle, 
  ListFilter,
  ArrowDownWideNarrow
} from 'lucide-react';

import type { ConditionConfig } from '../../../types/flow';
import NodeWrapper from './NodeWrapper';

interface ConditionNodeData {
  label: string;
  config: ConditionConfig;
}

function ConditionNode({ data, selected, id }: NodeProps<ConditionNodeData>) {
  const groups = data.config?.groups || [];
  const groupOperator = data.config?.groupOperator || 'AND';
  const totalRules = groups.reduce((acc, group) => acc + (group.rules?.length || 0), 0);

  return (
    <NodeWrapper nodeId={id} selected={selected}>
      <div
        className={`
          relative flex flex-col
          bg-zinc-950 
          rounded-xl shadow-2xl 
          border-[1.5px] min-w-[200px] max-w-[240px]
          transition-all duration-200
          ${selected 
            ? 'border-amber-500 ring-2 ring-amber-500/20' 
            : 'border-zinc-800 hover:border-zinc-700'
          }
        `}
      >
        {/* --- INPUT HANDLE --- */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !-top-1.5 !bg-zinc-200 !border-2 !border-zinc-950 transition-transform hover:scale-125 hover:!bg-amber-400"
        />

        {/* --- HEADER --- */}
        <div className="p-3 rounded-t-xl border-b border-zinc-800/50 flex items-center gap-3 bg-zinc-900/30">
          
          {/* Icon Box */}
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-lg border
            ${selected
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-zinc-900 border-zinc-800 text-amber-600 dark:text-amber-500'
            }
          `}>
            <GitFork className="w-4 h-4" />
          </div>

          {/* Titles */}
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-0.5">
              Condición Lógica
            </div>
            <div className="font-bold text-zinc-200 text-xs leading-tight truncate">
              {data.label || 'Evaluar'}
            </div>
          </div>
        </div>

        {/* --- BODY --- */}
        <div className="p-3 space-y-3">
          
          {/* Operator Badge */}
          <div className="flex items-center justify-between">
             <span className="text-[10px] font-bold text-zinc-500">Operador Global</span>
             <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
               groupOperator === 'AND' 
                 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                 : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
             }`}>
               {groupOperator === 'AND' ? 'Y (AND)' : 'O (OR)'}
             </span>
          </div>

          {/* Rules Summary */}
          {totalRules > 0 ? (
            <div className="flex items-center gap-2 p-2 bg-zinc-900/50 border border-zinc-800 rounded-lg">
               <ListFilter className="w-3.5 h-3.5 text-zinc-500" />
               <span className="text-[10px] text-zinc-400">
                 Se evalúan <strong>{totalRules}</strong> reglas
               </span>
            </div>
          ) : (
            <div className="text-center py-1">
               <span className="text-[10px] text-zinc-600 italic">Sin reglas definidas</span>
            </div>
          )}
        </div>

        {/* --- FOOTER (Outputs Split) --- */}
        <div className="flex border-t border-zinc-800 h-10">
          
          {/* YES Branch */}
          <div className="flex-1 flex items-center justify-center gap-1.5 border-r border-zinc-800 relative group bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors rounded-bl-xl">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Sí</span>
            
            <Handle
              type="source"
              position={Position.Bottom}
              id="yes"
              className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-zinc-950 !bottom-[-6px] transition-transform group-hover:scale-125"
            />
          </div>

          {/* NO Branch */}
          <div className="flex-1 flex items-center justify-center gap-1.5 relative group bg-red-500/5 hover:bg-red-500/10 transition-colors rounded-br-xl">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wide">No</span>
            
            <Handle
              type="source"
              position={Position.Bottom}
              id="no"
              className="!w-2.5 !h-2.5 !bg-red-500 !border-2 !border-zinc-950 !bottom-[-6px] transition-transform group-hover:scale-125"
            />
          </div>

        </div>
      </div>
    </NodeWrapper>
  );
}

export default memo(ConditionNode);
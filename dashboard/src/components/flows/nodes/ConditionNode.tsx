/**
 * ConditionNode - Flow condition/branch node component
 */
import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { ConditionConfig } from '../../../types/flow';
import NodeWrapper from './NodeWrapper';

// Iconos inline para no depender de librerías externas en este snippet
const SplitIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.87l-4.2-4.2a2 2 0 0 0-2.8 2.8l1.586 1.586" /><path d="M12 13.7l4.2-4.2a2 2 0 0 0 2.8 2.8l-1.586 1.586" /></svg>
);

interface ConditionNodeData {
  label: string;
  config: ConditionConfig;
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

function ConditionNode({ data, selected, id }: NodeProps<ConditionNodeData>) {
  const groups = data.config?.groups || [];
  const groupOperator = data.config?.groupOperator || 'AND';

  // Calcular total de reglas
  const totalRules = groups.reduce((acc, group) => acc + (group.rules?.length || 0), 0);

  // Obtener la primera regla para la previsualización
  const firstRule = groups[0]?.rules?.[0];

  // Helper para acortar texto
  const truncate = (str: string | number, len: number = 20) => {
    const s = String(str);
    return s.length > len ? s.substring(0, len) + '...' : s;
  };

  return (
    <NodeWrapper nodeId={id} selected={selected}>
      <div
        className={`
          relative flex flex-col
          bg-white dark:bg-gray-900 
          rounded-xl shadow-xl 
          border-2 min-w-[140px] max-w-[200px] max-h-[180px]
          transition-all duration-200
          ${selected
            ? 'border-amber-500 ring-4 ring-amber-500/20'
            : 'border-amber-400/60 dark:border-amber-600/60 hover:border-amber-500'
          }
        `}
      >
        {/* --- INPUT HANDLE --- */}
        <Handle
          type="target"
          position={Position.Top}
          className="!w-4 !h-4 !-top-2 !bg-amber-500 !border-2 !border-white dark:!border-gray-900 transition-transform hover:scale-125"
        />

        {/* --- HEADER --- */}
        <div className="bg-gradient-to-r from-amber-50 to-white dark:from-amber-900/20 dark:to-gray-900 p-3 rounded-t-xl border-b border-amber-100 dark:border-amber-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-md ${selected ? 'bg-amber-500 text-white' : 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400'}`}>
              <SplitIcon />
            </div>
            <div>
              <div className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">
                {data.label || 'Condición'}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider mt-0.5">
                Lógica {groupOperator === 'AND' ? 'Y' : 'O'}
              </div>
            </div>
          </div>
        </div>

        {/* --- BODY --- */}
        <div className="p-3 space-y-3">
          {totalRules > 0 ? (
            <div className="flex justify-center">
              <span className="text-[10px] font-medium text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                {totalRules} reglas añadidas
              </span>
            </div>
          ) : (
            <div className="text-center py-2 text-xs text-gray-400 italic">
              Sin condiciones configuradas
            </div>
          )}
        </div>

        {/* --- FOOTER (Outputs) --- */}
        <div className="flex border-t border-gray-100 dark:border-gray-800">
          {/* Lado VERDADERO */}
          <div className="flex-1 py-2 flex items-center justify-center border-r border-gray-100 dark:border-gray-800 relative group/yes">
            <span className="text-xs font-bold text-green-600 dark:text-green-400 group-hover/yes:text-green-500 transition-colors">
              Sí (True)
            </span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="yes" // ID crítico para conectar bordes específicos
              className="!w-3 !h-3 !bg-green-500 !border-2 !border-white dark:!border-gray-900 !bottom-[-7px]"
              style={{ left: '50%' }} // Centrado en su mitad
            />
          </div>

          {/* Lado FALSO */}
          <div className="flex-1 py-2 flex items-center justify-center relative group/no">
            <span className="text-xs font-bold text-red-600 dark:text-red-400 group-hover/no:text-red-500 transition-colors">
              No (False)
            </span>
            <Handle
              type="source"
              position={Position.Bottom}
              id="no" // ID crítico para conectar bordes específicos
              className="!w-3 !h-3 !bg-red-500 !border-2 !border-white dark:!border-gray-900 !bottom-[-7px]"
              style={{ left: '50%' }} // Centrado en su mitad
            />
          </div>
        </div>
      </div>
    </NodeWrapper>
  );
}

export default memo(ConditionNode);
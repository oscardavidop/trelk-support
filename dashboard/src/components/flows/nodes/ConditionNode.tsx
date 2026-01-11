/**
 * ConditionNode - Flow condition/branch node component
 */

import React, { memo } from 'react';
import { Handle, Position,  } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { ConditionConfig } from '../../../types/flow';
interface ConditionNodeData {
  label: string;
  config: ConditionConfig;
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

function ConditionNode({ data, selected }: NodeProps<ConditionNodeData>) {
  const groups = data.config?.groups || [];
  const groupOperator = data.config?.groupOperator || 'AND';

  const getRulesCount = () => {
    return groups.reduce((acc, group) => acc + (group.rules?.length || 0), 0);
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 min-w-[180px]
        transition-all duration-200
        ${selected 
          ? 'border-amber-500 ring-2 ring-amber-200 dark:ring-amber-900' 
          : 'border-amber-400 dark:border-amber-600'
        }
      `}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-amber-500 border-2 border-white dark:border-gray-800"
      />

      {/* Header */}
      <div className="bg-amber-500 dark:bg-amber-600 text-white px-3 py-2 rounded-t-md flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="font-medium text-sm">Condición</span>
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        <div className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-1">
          {data.label || 'Sin nombre'}
        </div>
        
        {groups.length > 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {getRulesCount()} {getRulesCount() === 1 ? 'regla' : 'reglas'}
            {groups.length > 1 && ` (${groupOperator})`}
          </div>
        ) : (
          <div className="text-xs text-amber-600 dark:text-amber-400">
            Sin condiciones
          </div>
        )}

        {/* Preview of first rule */}
        {groups[0]?.rules?.[0] && (
          <div className="mt-2 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 rounded text-xs">
            <span className="text-gray-600 dark:text-gray-400">
              {groups[0].rules[0].field}
            </span>
            <span className="text-amber-600 dark:text-amber-400 mx-1">
              {groups[0].rules[0].operator}
            </span>
            <span className="text-gray-700 dark:text-gray-300">
              {String(groups[0].rules[0].value).substring(0, 15)}
              {String(groups[0].rules[0].value).length > 15 && '...'}
            </span>
          </div>
        )}
      </div>

      {/* Output handles */}
      <div className="flex justify-between px-3 pb-2">
        <div className="flex flex-col items-center">
          <span className="text-xs text-green-600 dark:text-green-400 mb-1">Sí</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            className="!relative !transform-none w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800"
          />
        </div>
        <div className="flex flex-col items-center">
          <span className="text-xs text-red-600 dark:text-red-400 mb-1">No</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            className="!relative !transform-none w-3 h-3 bg-red-500 border-2 border-white dark:border-gray-800"
          />
        </div>
      </div>
    </div>
  );
}

export default memo(ConditionNode);

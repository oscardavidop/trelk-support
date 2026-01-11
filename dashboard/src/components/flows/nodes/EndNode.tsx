/**
 * EndNode - Flow end node component
 */

import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';

interface EndNodeData {
  label: string;
  config: Record<string, any>;
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

function EndNode({ data, selected }: NodeProps<EndNodeData>) {
  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 min-w-[120px]
        transition-all duration-200
        ${selected 
          ? 'border-gray-500 ring-2 ring-gray-200 dark:ring-gray-700' 
          : 'border-gray-400 dark:border-gray-600'
        }
      `}
    >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-500 border-2 border-white dark:border-gray-800"
      />

      {/* Header */}
      <div className="bg-gray-500 dark:bg-gray-600 text-white px-3 py-2 rounded-t-md flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
        </svg>
        <span className="font-medium text-sm">Fin</span>
      </div>

      {/* Body */}
      <div className="px-3 py-3 text-center">
        <div className="font-medium text-gray-900 dark:text-gray-100 text-sm">
          {data.label || 'Fin del flow'}
        </div>
      </div>
    </div>
  );
}

export default memo(EndNode);

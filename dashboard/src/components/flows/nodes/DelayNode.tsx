/**
 * DelayNode - Flow delay node component
 */

import React, { memo } from 'react';
import type { JSX } from 'react';
import { Handle, Position } from 'reactflow';
import NodeWrapper from './NodeWrapper';
import type { NodeProps } from 'reactflow';
import type { DelayConfig, DelayType } from '../../../types/flow';
import { DELAY_LABELS } from '../../../types/flow';

interface DelayNodeData {
  label: string;
  config: DelayConfig;
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

const getDelayIcon = (delayType: DelayType) => {
  const icons: Record<DelayType, JSX.Element> = {
    fixed_time: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    until_response: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    until_agent_online: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    until_business_hours: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    until_condition: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };
  return icons[delayType] || (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
};

function DelayNode({ data, selected, id }: NodeProps<DelayNodeData>) {
  const delayType = data.config?.delayType;
  const delayLabel = delayType ? DELAY_LABELS[delayType] : 'Esperar';

  const getDelayInfo = () => {
    if (!data.config) return null;

    switch (delayType) {
      case 'fixed_time':
        if (data.config.delayMinutes) {
          const hours = Math.floor(data.config.delayMinutes / 60);
          const mins = data.config.delayMinutes % 60;
          if (hours > 0) {
            return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
          }
          return `${mins} min`;
        }
        return null;

      case 'until_response':
        return data.config.maxWaitMinutes 
          ? `Máx. ${data.config.maxWaitMinutes} min`
          : 'Sin límite';

      case 'until_agent_online':
        return 'Hasta que un agente esté disponible';

      case 'until_business_hours':
        return 'Hasta horario laboral';

      case 'until_condition':
        return 'Hasta condición';

      default:
        return null;
    }
  };

  return (
    <NodeWrapper nodeId={id} selected={selected}>
      <div
        className={`
          bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 min-w-[180px]
          transition-all duration-200
          ${selected 
            ? 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-900' 
            : 'border-purple-400 dark:border-purple-600'
          }
        `}
      >
      {/* Input handle (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-purple-500 border-2 border-white dark:border-gray-800"
      />

      {/* Header */}
      <div className="bg-purple-500 dark:bg-purple-600 text-white px-3 py-2 rounded-t-md flex items-center gap-2">
        {getDelayIcon(delayType)}
        <span className="font-medium text-sm">Esperar</span>
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        <div className="font-medium text-gray-900 dark:text-gray-100 text-sm mb-1">
          {data.label || 'Sin nombre'}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {delayLabel}
        </div>
        
        {getDelayInfo() && (
          <div className="mt-2 px-2 py-1 bg-purple-50 dark:bg-purple-900/20 rounded text-xs text-purple-700 dark:text-purple-300">
            {getDelayInfo()}
          </div>
        )}

        {/* Cancel conditions */}
        {(data.config?.cancelOnChatClose || data.config?.cancelOnUserResponse) && (
          <div className="mt-2 flex flex-wrap gap-1">
            {data.config.cancelOnUserResponse && (
              <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-[10px]">
                Cancelar si responde
              </span>
            )}
            {data.config.cancelOnChatClose && (
              <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded text-[10px]">
                Cancelar si cierra
              </span>
            )}
          </div>
        )}
      </div>

        {/* Output handle (bottom) */}
        <Handle
          type="source"
          position={Position.Bottom}
          className="w-3 h-3 bg-purple-500 border-2 border-white dark:border-gray-800"
        />
      </div>
    </NodeWrapper>
  );
}

export default memo(DelayNode);

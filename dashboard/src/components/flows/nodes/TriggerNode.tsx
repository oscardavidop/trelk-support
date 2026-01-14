/**
 * TriggerNode - Flow trigger node component
 */

import React, { memo } from 'react';
import type { JSX } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { TriggerConfig, TriggerType } from '../../../types/flow';
import { TRIGGER_LABELS } from '../../../types/flow';
import NodeWrapper from './NodeWrapper';

interface TriggerNodeData {
  label: string;
  config: TriggerConfig;
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

const TriggerIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const getTriggerIcon = (type: string) => {
  const props = {
    xmlns: "http://www.w3.org/2000/svg",
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case 'chat_created': // Icono: Burbuja de chat con signo más (+)
      return (
        <svg {...props}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="9" y1="10" x2="15" y2="10" />
          <line x1="12" y1="7" x2="12" y2="13" />
        </svg>
      );

    case 'message_received': // Icono: Sobre de carta (Email/Mensaje)
      return (
        <svg {...props}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );

    case 'keyword_detected': // Icono: Lupa (Búsqueda)
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );

    case 'chat_assigned': // Icono: Usuario con signo más (Asignar persona)
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <line x1="20" y1="8" x2="20" y2="14" />
          <line x1="23" y1="11" x2="17" y2="11" />
        </svg>
      );

    case 'chat_closed': // Icono: Check en círculo (Completado)
      return (
        <svg {...props}>
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );

    case 'user_inactive': // Icono: Reloj (Tiempo)
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );

    case 'survey_answered': // Icono: Estrella (Rating/Encuesta)
      return (
        <svg {...props}>
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      );

    case 'category_changed': // Icono: Carpeta (Categoría)
      return (
        <svg {...props}>
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );

    case 'tag_added': // Icono: Etiqueta (Tag)
      return (
        <svg {...props}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );

    case 'file_received': // Icono: Clip (Adjunto)
      return (
        <svg {...props}>
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      );

    case 'chat_reopened': // Icono: Flechas rotando (Reabrir/Refresh)
      return (
        <svg {...props}>
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
        </svg>
      );

    case 'agent_online': // Icono: Usuario con check (Agente disponible)
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </svg>
      );

    case 'sla_warning': // Icono: Triángulo de alerta (Warning)
      return (
        <svg {...props}>
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );

    default: // Icono por defecto (Rayo)
      return (
        <svg {...props}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
  }
};

function TriggerNode({ data, selected, id }: NodeProps<TriggerNodeData>) {
  const triggerType = data.config?.triggerType;
  // Fallback si no hay tipo seleccionado
  const triggerLabel = triggerType ? (TRIGGER_LABELS[triggerType] || triggerType) : 'Seleccionar Trigger';

  return (
    <NodeWrapper nodeId={id} selected={selected}>
      <div
        className={`
          relative flex flex-col
          bg-white dark:bg-gray-900 
          rounded-xl shadow-xl 
          border-2 min-w-[220px] max-w-[260px]
          transition-all duration-200
          ${selected
            ? 'border-green-500 ring-4 ring-green-500/20'
            : 'border-green-400/60 dark:border-green-600/60 hover:border-green-500'
          }
        `}
      >
        {/* --- HEADER --- */}
        <div className="bg-gradient-to-r from-green-50 to-white dark:from-green-900/20 dark:to-gray-900 p-3 rounded-t-xl border-b border-green-100 dark:border-green-800/50 flex items-center gap-3">
          {/* Icon Box */}
          <div className={`
            flex items-center justify-center w-8 h-8 rounded-lg shadow-sm border
            ${selected
              ? 'bg-green-500 text-white border-green-600'
              : 'bg-white dark:bg-gray-800 text-green-600 dark:text-green-400 border-green-200 dark:border-green-700'
            }
          `}>
            {/* Usamos tu función getTriggerIcon o un fallback */}
            {getTriggerIcon(triggerType) || (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            )}
          </div>

          {/* Titles */}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight truncate">
              {data.label || 'Inicio del Flujo'}
            </div>
            <div className="text-[10px] text-green-600 dark:text-green-400 font-medium uppercase tracking-wider mt-0.5 truncate">
              {triggerLabel}
            </div>
          </div>
        </div>

        {/* --- BODY --- */}
        <div className="p-3">

          {/* Case: KEYWORDS */}
          {triggerType === 'keyword_detected' && (
            <div className="space-y-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase">Palabras clave:</span>
              <div className="flex flex-wrap gap-1.5">
                {(data.config?.keywords?.length ?? 0) > 0 ? (
                  <>
                    {data.config!.keywords!.slice(0, 3).map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-md text-xs font-medium"
                      >
                        {kw}
                      </span>
                    ))}
                    {data.config!.keywords!.length > 3 && (
                      <span className="px-1.5 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs rounded-md font-bold">
                        +{data.config!.keywords!.length - 3}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-gray-400 italic">Sin configurar</span>
                )}
              </div>
            </div>
          )}

          {/* Case: INACTIVITY */}
          {triggerType === 'user_inactive' && (
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-800/50 p-2 rounded-lg">
              <svg className="w-4 h-4 text-orange-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <div className="flex flex-col">
                <span className="text-[10px] text-orange-600/70 dark:text-orange-400">Tiempo de espera</span>
                <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                  {data.config?.inactivityMinutes ? `${data.config.inactivityMinutes} minutos` : 'No definido'}
                </span>
              </div>
            </div>
          )}

          {/* Case: GENERIC / DESCRIPTION */}
          {!['keyword_detected', 'user_inactive'].includes(triggerType || '') && (
            <div className="text-xs text-gray-500 dark:text-gray-400 italic">
              Este evento inicia el flujo automáticamente.
            </div>
          )}
        </div>

        {/* --- HANDLE (Solo Salida / Bottom) --- */}
        <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 flex flex-col items-center">
          <Handle
            type="source"
            position={Position.Bottom}
            className="!relative !transform-none !w-3.5 !h-3.5 !bg-green-500 !border-2 !border-white dark:!border-gray-900 transition-transform hover:scale-125 shadow-sm"
          />
        </div>

      </div>
    </NodeWrapper>
  );
}

export default memo(TriggerNode);

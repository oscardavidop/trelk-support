/**
 * DeletableEdge - Custom edge with delete button on hover
 */

import React, { useState, useCallback } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
} from 'reactflow';
import type { EdgeProps } from 'reactflow';

export default function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  label,
  selected,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { setEdges } = useReactFlow();

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  }, [id, setEdges]);

  const showDeleteButton = isHovered || selected;

  return (
    <>
      {/* Actual visible edge */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: showDeleteButton ? '#EF4444' : (style.stroke as string),
          strokeWidth: showDeleteButton ? 3 : (style.strokeWidth || 2),
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
      />

      {/* Edge center interaction point - always visible for easy access */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Show label if exists and not hovered */}
          {label && !showDeleteButton && (
            <div className="px-2 py-0.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400 shadow-sm cursor-pointer">
              {label}
            </div>
          )}

          {/* Small dot indicator when not hovered and no label */}
          {!label && !showDeleteButton && (
            <div 
              className="w-3 h-3 rounded-full bg-gray-300 dark:bg-gray-600 hover:bg-red-400 dark:hover:bg-red-500 cursor-pointer transition-colors opacity-50 hover:opacity-100"
              title="Clic para opciones"
            />
          )}

          {/* Delete button on hover or selected */}
          {showDeleteButton && (
            <button
              onClick={handleDelete}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="w-5 h-5 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg flex items-center justify-center transition-colors cursor-pointer border-2 border-white"
              title="Eliminar conexión"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
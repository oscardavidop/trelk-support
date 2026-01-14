/**
 * NodeWrapper - Wrapper for flow nodes with context menu and hover actions
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';

interface NodeWrapperProps {
  nodeId: string;
  selected: boolean;
  children: React.ReactNode;
  onDelete?: () => void;
}

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
}

export const NodeWrapper: React.FC<NodeWrapperProps> = ({
  nodeId,
  selected,
  children,
  onDelete,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ show: false, x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { getNode, setNodes, setEdges, setCenter } = useReactFlow();

  // Close context menu on click outside or Escape key
  useEffect(() => {
    if (!contextMenu.show) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is outside the menu
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu({ show: false, x: 0, y: 0 });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu({ show: false, x: 0, y: 0 });
      }
    };

    const handleScroll = () => {
      setContextMenu({ show: false, x: 0, y: 0 });
    };
    
    // Use setTimeout to avoid catching the same click that opened the menu
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('click', handleClickOutside);
    }, 0);
    
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [contextMenu.show]);

  // Handle right click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
    });
  }, []);

  // Delete node
  const handleDelete = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setNodes((nodes) => nodes.filter((n) => n.id !== nodeId));
    setEdges((edges) => edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setContextMenu({ show: false, x: 0, y: 0 });
  }, [nodeId, setNodes, setEdges]);

  // Duplicate node
  const handleDuplicate = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const node = getNode(nodeId);
    if (!node) return;

    const newId = `${node.type}-${Date.now()}`;
    const newNode = {
      ...node,
      id: newId,
      position: {
        x: node.position.x + 50,
        y: node.position.y + 50,
      },
      data: {
        ...node.data,
        label: `${node.data.label} (copia)`,
      },
      selected: false,
    };

    setNodes((nodes) => [...nodes, newNode]);
    setContextMenu({ show: false, x: 0, y: 0 });
  }, [nodeId, getNode, setNodes]);

  // Copy node to clipboard
  const handleCopy = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const node = getNode(nodeId);
    if (!node) return;

    const nodeData = {
      type: node.type,
      data: node.data,
    };
    
    // Store in localStorage for paste operation
    localStorage.setItem('flow-clipboard', JSON.stringify(nodeData));
    setContextMenu({ show: false, x: 0, y: 0 });
  }, [nodeId, getNode]);

  // Center on node
  const handleCenter = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const node = getNode(nodeId);
    if (!node) return;
    
    setCenter(node.position.x, node.position.y, { zoom: 1.5, duration: 500 });
    setContextMenu({ show: false, x: 0, y: 0 });
  }, [nodeId, getNode, setCenter]);

  // Context menu portal
  const contextMenuPortal = contextMenu.show && createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]"
      style={{
        left: contextMenu.x,
        top: contextMenu.y,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Duplicate */}
      <button
        onMouseDown={(e) => handleDuplicate(e)}
        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
        </svg>
        Duplicar
      </button>

      {/* Copy */}
      <button
        onMouseDown={(e) => handleCopy(e)}
        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Copiar
      </button>

      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

      {/* Center view */}
      <button
        onMouseDown={(e) => handleCenter(e)}
        className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
        </svg>
        Centrar vista
      </button>

      <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

      {/* Delete */}
      <button
        onMouseDown={(e) => handleDelete(e)}
        className="w-full px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Eliminar
      </button>
    </div>,
    document.body
  );

  return (
    <>
      <div
        ref={wrapperRef}
        className="relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
      >
        {/* Hover Actions (top right corner) */}
        {isHovered && !contextMenu.show && (
          <div 
            className="absolute -top-3 -right-3 z-20 flex gap-1"
          >
            {/* Copy button */}
            <button
              onMouseDown={(e) => handleCopy(e)}
              className="nodrag nopan w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg flex items-center justify-center transition-colors cursor-pointer"
              title="Copiar"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            
            {/* Delete button */}
            <button
              onMouseDown={(e) => handleDelete(e)}
              className="nodrag nopan w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white shadow-lg flex items-center justify-center transition-colors cursor-pointer"
              title="Eliminar"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}

        {/* Node content */}
        {children}
      </div>

      {/* Context Menu (rendered via portal) */}
      {contextMenuPortal}
    </>
  );
};

export default NodeWrapper;

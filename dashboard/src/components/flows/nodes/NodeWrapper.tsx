/**
 * NodeWrapper - Premium Zinc Refactor
 * Wrapper for flow nodes with styled context menu and hover actions
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow } from 'reactflow';
import { 
  Copy, 
  CopyPlus, 
  Trash2, 
  Scan, 
  MoreHorizontal 
} from 'lucide-react';

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

const NodeWrapper: React.FC<NodeWrapperProps> = ({
  nodeId,
  children,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ show: false, x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { getNode, setNodes, setEdges, setCenter } = useReactFlow();

  // --- Effect: Handle clicks outside & scroll ---
  useEffect(() => {
    if (!contextMenu.show) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu({ show: false, x: 0, y: 0 });
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu({ show: false, x: 0, y: 0 });
    };

    const handleScroll = () => setContextMenu({ show: false, x: 0, y: 0 });
    
    // Defer event listener to avoid immediate trigger
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

  // --- Handlers ---

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ show: true, x: e.clientX, y: e.clientY });
  }, []);

  const handleDelete = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setNodes((nodes) => nodes.filter((n) => n.id !== nodeId));
    setEdges((edges) => edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setContextMenu({ show: false, x: 0, y: 0 });
  }, [nodeId, setNodes, setEdges]);

  const handleDuplicate = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const node = getNode(nodeId);
    if (!node) return;

    const newId = `${node.type}-${Date.now()}`;
    const newNode = {
      ...node,
      id: newId,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      data: { ...node.data, label: `${node.data.label} (copia)` },
      selected: false,
    };

    setNodes((nodes) => [...nodes, newNode]);
    setContextMenu({ show: false, x: 0, y: 0 });
  }, [nodeId, getNode, setNodes]);

  const handleCopy = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const node = getNode(nodeId);
    if (!node) return;

    const nodeData = { type: node.type, data: node.data };
    localStorage.setItem('flow-clipboard', JSON.stringify(nodeData));
    setContextMenu({ show: false, x: 0, y: 0 });
  }, [nodeId, getNode]);

  const handleCenter = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const node = getNode(nodeId);
    if (!node) return;
    
    setCenter(node.position.x, node.position.y, { zoom: 1.5, duration: 500 });
    setContextMenu({ show: false, x: 0, y: 0 });
  }, [nodeId, getNode, setCenter]);

  // --- Render: Context Menu Portal ---
  const contextMenuPortal = contextMenu.show && createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[180px] bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-100 flex flex-col gap-0.5"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Acciones</div>
      
      <button
        onMouseDown={handleDuplicate}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <CopyPlus className="w-3.5 h-3.5 text-zinc-500" /> Duplicar
      </button>

      <button
        onMouseDown={handleCopy}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <Copy className="w-3.5 h-3.5 text-zinc-500" /> Copiar
      </button>

      <button
        onMouseDown={handleCenter}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
      >
        <Scan className="w-3.5 h-3.5 text-zinc-500" /> Centrar Vista
      </button>

      <div className="h-px bg-zinc-800 my-1 mx-1" />

      <button
        onMouseDown={handleDelete}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" /> Eliminar
      </button>
    </div>,
    document.body
  );

  // --- Render: Main Component ---
  return (
    <>
      <div
        ref={wrapperRef}
        className="relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
      >
        {/* Hover Actions (Floating Toolbar) */}
        {isHovered && !contextMenu.show && (
          <div className="absolute -top-5 right-0 z-50 flex gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Botón Copiar */}
            <button
              onMouseDown={handleCopy}
              className="nodrag nopan w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 hover:bg-zinc-800 shadow-lg flex items-center justify-center transition-all"
              title="Copiar"
            >
              <Copy className="w-2.5 h-2.5" />
            </button>
            
            {/* Botón Eliminar */}
            <button
              onMouseDown={handleDelete}
              className="nodrag nopan w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/10 shadow-lg flex items-center justify-center transition-all"
              title="Eliminar"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        )}

        {/* Node Content */}
        {children}
      </div>

      {contextMenuPortal}
    </>
  );
};

export default NodeWrapper;
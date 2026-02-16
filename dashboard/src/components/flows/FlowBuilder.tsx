/**
 * FlowBuilder - Visual Flow Editor
 * Refactored: Premium Zinc Style
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, {
  Controls, Background, MiniMap, useNodesState, useEdgesState, addEdge,
  Panel, useReactFlow, ReactFlowProvider, MarkerType, BackgroundVariant,
 type Node, type Edge, type Connection, type NodeTypes, type EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useThemeStore } from '../../hooks/useTheme';
import type { FlowNode, FlowEdge, Flow, NodeType } from '../../types/flow';
import { NODE_COLORS } from '../../types/flow';
import TriggerNode from './nodes/TriggerNode';
import ConditionNode from './nodes/ConditionNode';
import ActionNode from './nodes/ActionNode';
import DelayNode from './nodes/DelayNode';
import EndNode from './nodes/EndNode';
import DeletableEdge from './edges/DeletableEdge';
import NodePalette from './NodePalette';
import NodeConfigPanel from './NodeConfigPanel';
import FlowToolbar from './FlowToolbar';
import { getFlows } from '../../services/flow.service';
import { Zap, GitFork, PlayCircle, MousePointerClick } from 'lucide-react';

// Custom node & edge types
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  end: EndNode,
  branch: ConditionNode,
};

const edgeTypes: EdgeTypes = { deletable: DeletableEdge };

const EDGE_COLORS = { dark: '#52525b', light: '#94a3b8' };
const DOT_COLORS = { dark: '#3f3f46', light: '#cbd5e1' };
const MASK_COLORS = { dark: 'rgba(9, 9, 11, 0.8)', light: 'rgba(241, 245, 249, 0.8)' };

const defaultEdgeOptions = {
  type: 'deletable' as const,
  animated: false,
  style: { strokeWidth: 2, stroke: EDGE_COLORS.dark },
  markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS.dark },
};

interface FlowBuilderProps {
  flow: Flow | null;
  onSave: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  onAutoSave?: (nodes: FlowNode[], edges: FlowEdge[]) => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onSimulate: () => void;
  onClose: () => void;
  onDelete: () => void;
  onVersionHistory: () => void;
  isLoading?: boolean;
  readOnly?: boolean;
  lastSaved?: Date | null;
}

// History state
interface HistoryState { nodes: Node[]; edges: Edge[]; }
const MAX_HISTORY_LENGTH = 50;

// Converters
const toReactFlowNodes = (flowNodes: FlowNode[] | undefined): Node[] => 
  (flowNodes || []).map(node => ({
    id: node.id, type: node.type, position: node.position,
    data: { label: node.label, config: node.config, metadata: node.metadata },
  }));

const toReactFlowEdges = (flowEdges: FlowEdge[] | undefined): Edge[] => 
  (flowEdges || []).map(edge => ({
    id: edge.id, source: edge.source, target: edge.target,
    sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle,
    label: edge.label, ...defaultEdgeOptions, animated: edge.animated,
  }));

const toFlowNodes = (reactNodes: Node[]): FlowNode[] => 
  reactNodes.map(node => ({
    id: node.id, type: node.type as NodeType, label: node.data.label,
    config: node.data.config, position: node.position, metadata: node.data.metadata,
  }));

const toFlowEdges = (reactEdges: Edge[]): FlowEdge[] => 
  reactEdges.map(edge => ({
    id: edge.id, source: edge.source, target: edge.target,
    sourceHandle: edge.sourceHandle || undefined, targetHandle: edge.targetHandle || undefined,
    label: typeof edge.label === 'string' ? edge.label : undefined, animated: edge.animated,
  }));

function FlowBuilderInner({
  flow, onSave, onAutoSave, onPublish, onUnpublish, onSimulate,
  onClose, onDelete, onVersionHistory, isLoading = false, readOnly = false, lastSaved,
}: FlowBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, getNodes, getEdges, setCenter } = useReactFlow();
  
  const [nodes, setNodes, onNodesChange] = useNodesState(flow ? toReactFlowNodes(flow.nodes) : []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow ? toReactFlowEdges(flow.edges) : []);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [availableFlows, setAvailableFlows] = useState<{ id: string; name: string }[]>([]);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const edgeColor = EDGE_COLORS[resolvedTheme];
  const dotColor = DOT_COLORS[resolvedTheme];
  const maskColor = MASK_COLORS[resolvedTheme];
  const themedEdgeOptions = useMemo(() => ({
    type: 'deletable' as const,
    animated: false,
    style: { strokeWidth: 2, stroke: edgeColor },
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
  }), [edgeColor]);

  // Load flows for config
  useEffect(() => {
    getFlows({ limit: 100 }).then(res => setAvailableFlows(res.flows.map(f => ({ id: f._id, name: f.name })))).catch(console.error);
  }, []);

  const nodeOptions = useMemo(() => nodes.map(n => ({ id: n.id, label: (n.data?.label as string) || n.id })), [nodes]);

  // History Management
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoingRef = useRef(false);
  const saveHistoryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveToHistory = useCallback(() => {
    if (isUndoingRef.current) return;
    const currentState: HistoryState = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(currentState);
      if (newHistory.length > MAX_HISTORY_LENGTH) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_LENGTH - 1));
  }, [nodes, edges, historyIndex]);

  useEffect(() => {
    if (flow && history.length === 0) {
      setHistory([{ nodes: toReactFlowNodes(flow.nodes), edges: toReactFlowEdges(flow.edges) }]);
      setHistoryIndex(0);
    }
  }, [flow]);

  useEffect(() => {
    if (isUndoingRef.current || !flow) return;
    if (saveHistoryTimeoutRef.current) clearTimeout(saveHistoryTimeoutRef.current);
    saveHistoryTimeoutRef.current = setTimeout(saveToHistory, 500);
    return () => { if (saveHistoryTimeoutRef.current) clearTimeout(saveHistoryTimeoutRef.current); };
  }, [nodes, edges]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    isUndoingRef.current = true;
    const prevState = history[historyIndex - 1];
    setNodes(prevState.nodes); setEdges(prevState.edges);
    setHistoryIndex(prev => prev - 1);
    setTimeout(() => { isUndoingRef.current = false; }, 100);
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    isUndoingRef.current = true;
    const nextState = history[historyIndex + 1];
    setNodes(nextState.nodes); setEdges(nextState.edges);
    setHistoryIndex(prev => prev + 1);
    setTimeout(() => { isUndoingRef.current = false; }, 100);
  }, [history, historyIndex, setNodes, setEdges]);

  // Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || ((e.ctrlKey || e.metaKey) && e.key === 'y')) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, readOnly]);

  // Auto-save & Change detection
  useEffect(() => {
    if (flow) {
      const changed = JSON.stringify(toFlowNodes(nodes)) !== JSON.stringify(flow.nodes) || JSON.stringify(toFlowEdges(edges)) !== JSON.stringify(flow.edges);
      setHasChanges(changed);
      if (changed && !isUndoingRef.current && onAutoSave) onAutoSave(toFlowNodes(nodes), toFlowEdges(edges));
    }
  }, [nodes, edges, flow, onAutoSave]);

  // Flow Handlers
  const onConnect = useCallback((params: Connection) => {
    if (readOnly) return;
    setEdges(eds => addEdge({ ...params, id: `edge-${Date.now()}`, ...themedEdgeOptions }, eds));
  }, [setEdges, readOnly, themedEdgeOptions]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { setSelectedNode(node); setIsConfigOpen(true); }, []);
  const onPaneClick = useCallback(() => { setSelectedNode(null); setIsConfigOpen(false); }, []);
  
  const onNodesDelete = useCallback((deletedNodes: Node[]) => {
    if (readOnly) return;
    const ids = new Set(deletedNodes.map(n => n.id));
    setEdges(eds => eds.filter(e => !ids.has(e.source) && !ids.has(e.target)));
    if (selectedNode && ids.has(selectedNode.id)) { setSelectedNode(null); setIsConfigOpen(false); }
  }, [selectedNode, setEdges, readOnly]);

  const onAddNode = useCallback((type: NodeType, label: string, config: any) => {
    if (readOnly) return;
    const newNode: Node = {
      id: `${type}-${Date.now()}`, type, position: { x: 250, y: nodes.length * 100 + 50 },
      data: { label, config, metadata: { color: NODE_COLORS[type] } },
    };
    setNodes(nds => [...nds, newNode]);
    setSelectedNode(newNode); setIsConfigOpen(true);
  }, [nodes, setNodes, readOnly]);

  const onNodeConfigChange = useCallback((nodeId: string, label: string, config: any) => {
    if (readOnly) return;
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, label, config } } : n));
  }, [setNodes, readOnly]);

  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (readOnly || !reactFlowWrapper.current) return;
    const type = event.dataTransfer.getData('application/reactflow/type') as NodeType;
    const label = event.dataTransfer.getData('application/reactflow/label');
    const config = JSON.parse(event.dataTransfer.getData('application/reactflow/config') || '{}');
    if (!type) return;

    const bounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = project({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    const newNode: Node = {
      id: `${type}-${Date.now()}`, type, position,
      data: { label, config, metadata: { color: NODE_COLORS[type] } },
    };
    setNodes(nds => [...nds, newNode]);
  }, [project, setNodes, readOnly]);

  const handleSave = useCallback(() => {
    onSave(toFlowNodes(getNodes()), toFlowEdges(getEdges()));
    setHasChanges(false);
  }, [getNodes, getEdges, onSave]);

  return (
    <div className="h-screen w-full flex flex-col bg-black">
      <FlowToolbar
        flowName={flow?.name || 'Nuevo Flow'}
        flowStatus={flow?.status || 'draft'}
        hasChanges={hasChanges}
        isLoading={isLoading}
        onSave={handleSave}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
        onSimulate={onSimulate}
        onClose={onClose}
        onCenterView={() => nodes.length > 0 && setCenter(nodes[0].position.x, nodes[0].position.y, { zoom: 1, duration: 800 })}
        onTogglePalette={() => setIsPaletteOpen(!isPaletteOpen)}
        onVersionHistory={onVersionHistory}
        onDelete={onDelete}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        isPaletteOpen={isPaletteOpen}
        readOnly={readOnly}
        lastSaved={lastSaved}
      />

      <div className="flex-1 flex relative overflow-hidden">
        {isPaletteOpen && !readOnly && <NodePalette onAddNode={onAddNode} />}

        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes} edges={edges}
            onNodesChange={readOnly ? undefined : onNodesChange}
            onEdgesChange={readOnly ? undefined : onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onNodesDelete={onNodesDelete}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={themedEdgeOptions}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            minZoom={0.2}
            maxZoom={2}
            deleteKeyCode={readOnly ? null : 'Delete'}
            selectionKeyCode={readOnly ? null : 'Shift'}
            multiSelectionKeyCode={readOnly ? null : 'Meta'}
            panOnScroll zoomOnScroll
            className="bg-zinc-950"
          >
            <Controls className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden [&>button]:border-b [&>button]:border-zinc-800 [&>button]:bg-zinc-900 [&>button]:fill-zinc-400 [&>button:hover]:bg-zinc-800" showInteractive={!readOnly} />
            <MiniMap 
              nodeColor={n => NODE_COLORS[n.type as NodeType] || edgeColor} 
              maskColor={maskColor} 
              className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl" 
            />
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color={dotColor} />

            {nodes.length === 0 && (
              <Panel position="top-center" className="mt-32">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-8 text-center max-w-md ring-1 ring-white/10">
                  <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-5 border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                    <MousePointerClick className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-zinc-50 mb-2">Lienzo vacío</h3>
                  <p className="text-zinc-400 mb-6 leading-relaxed">
                    Arrastra nodos desde el panel izquierdo para comenzar a diseñar tu flujo conversacional.
                  </p>
                  <div className="flex items-center justify-center gap-3 text-xs text-zinc-500 font-mono bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                    <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-emerald-500"/> Trigger</span>
                    <span className="text-zinc-700">→</span>
                    <span className="flex items-center gap-1.5"><GitFork className="w-3 h-3 text-amber-500"/> Lógica</span>
                    <span className="text-zinc-700">→</span>
                    <span className="flex items-center gap-1.5"><PlayCircle className="w-3 h-3 text-blue-500"/> Acción</span>
                  </div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {isConfigOpen && selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onClose={() => { setSelectedNode(null); setIsConfigOpen(false); }}
            onChange={onNodeConfigChange}
            readOnly={readOnly}
            nodes={nodeOptions}
            flows={availableFlows}
          />
        )}
      </div>
    </div>
  );
}

export default function FlowBuilder(props: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
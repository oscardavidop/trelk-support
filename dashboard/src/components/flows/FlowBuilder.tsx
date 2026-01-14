/**
 * FlowBuilder - Visual Flow Editor
 * Main canvas component using React Flow
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  BackgroundVariant,
} from 'reactflow';
import type {
  Node,
  Edge,
  Connection,
  NodeTypes,
  EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';

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

// Custom node types
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  end: EndNode,
  branch: ConditionNode, // Use condition node for branches too
};

// Custom edge types
const edgeTypes: EdgeTypes = {
  deletable: DeletableEdge,
};

// Custom edge style
const defaultEdgeOptions = {
  type: 'deletable',
  animated: false,
  style: { strokeWidth: 2, stroke: '#94A3B8' },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#94A3B8',
  },
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

// History state for Undo/Redo
interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

const MAX_HISTORY_LENGTH = 50;

// Convert our FlowNode to ReactFlow Node
const toReactFlowNodes = (flowNodes: FlowNode[] | undefined): Node[] => {
  if (!flowNodes || !Array.isArray(flowNodes)) return [];
  return flowNodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      label: node.label,
      config: node.config,
      metadata: node.metadata,
    },
  }));
};

// Convert our FlowEdge to ReactFlow Edge
const toReactFlowEdges = (flowEdges: FlowEdge[] | undefined): Edge[] => {
  if (!flowEdges || !Array.isArray(flowEdges)) return [];
  return flowEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
    ...defaultEdgeOptions,
    animated: edge.animated,
  }));
};

// Convert ReactFlow Node back to FlowNode
const toFlowNodes = (reactFlowNodes: Node[]): FlowNode[] => {
  return reactFlowNodes.map((node) => ({
    id: node.id,
    type: node.type as NodeType,
    label: node.data.label,
    config: node.data.config,
    position: node.position,
    metadata: node.data.metadata,
  }));
};

// Convert ReactFlow Edge back to FlowEdge
const toFlowEdges = (reactFlowEdges: Edge[]): FlowEdge[] => {
  return reactFlowEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
    label: typeof edge.label === 'string' ? edge.label : undefined,
    animated: edge.animated,
  }));
};

function FlowBuilderInner({
  flow,
  onSave,
  onAutoSave,
  onPublish,
  onUnpublish,
  onSimulate,
  onClose,
  onDelete,
  onVersionHistory,
  isLoading = false,
  readOnly = false,
  lastSaved,
}: FlowBuilderProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project, getNodes, getEdges, setCenter } = useReactFlow();
  
  // State
  const [nodes, setNodes, onNodesChange] = useNodesState(
    flow ? toReactFlowNodes(flow.nodes) : []
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    flow ? toReactFlowEdges(flow.edges) : []
  );
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Available flows for button actions (cached list)
  const [availableFlows, setAvailableFlows] = useState<{ id: string; name: string }[]>([]);

  // Load available flows for dropdown selectors
  useEffect(() => {
    const loadFlows = async () => {
      try {
        const result = await getFlows({ limit: 100 });
        setAvailableFlows(
          result.flows.map((f) => ({ id: f._id, name: f.name }))
        );
      } catch (error) {
        console.error('Error loading flows:', error);
      }
    };
    loadFlows();
  }, []);

  // Convert current nodes to NodeOption format for dropdowns
  const nodeOptions = useMemo(() => 
    nodes.map((n) => ({ 
      id: n.id, 
      label: (n.data?.label as string) || n.id 
    }))
  , [nodes]);

  // Undo/Redo history
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoingRef = useRef(false);
  
  // Track if we can undo/redo
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  // Save current state to history
  const saveToHistory = useCallback(() => {
    if (isUndoingRef.current) return;
    
    const currentState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    
    setHistory(prev => {
      // If we're not at the end, cut off future history
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(currentState);
      
      // Limit history length
      if (newHistory.length > MAX_HISTORY_LENGTH) {
        newHistory.shift();
      }
      
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY_LENGTH - 1));
  }, [nodes, edges, historyIndex]);

  // Initialize history on mount
  useEffect(() => {
    if (flow && history.length === 0) {
      const initialState: HistoryState = {
        nodes: toReactFlowNodes(flow.nodes),
        edges: toReactFlowEdges(flow.edges),
      };
      setHistory([initialState]);
      setHistoryIndex(0);
    }
  }, [flow]);

  // Debounced history save on changes
  const saveHistoryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isUndoingRef.current || !flow) return;
    
    if (saveHistoryTimeoutRef.current) {
      clearTimeout(saveHistoryTimeoutRef.current);
    }
    
    saveHistoryTimeoutRef.current = setTimeout(() => {
      saveToHistory();
    }, 500);
    
    return () => {
      if (saveHistoryTimeoutRef.current) {
        clearTimeout(saveHistoryTimeoutRef.current);
      }
    };
  }, [nodes, edges]);

  // Undo function
  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    
    isUndoingRef.current = true;
    const prevState = history[historyIndex - 1];
    setNodes(prevState.nodes);
    setEdges(prevState.edges);
    setHistoryIndex(prev => prev - 1);
    
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 100);
  }, [canUndo, history, historyIndex, setNodes, setEdges]);

  // Redo function
  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    
    isUndoingRef.current = true;
    const nextState = history[historyIndex + 1];
    setNodes(nextState.nodes);
    setEdges(nextState.edges);
    setHistoryIndex(prev => prev + 1);
    
    setTimeout(() => {
      isUndoingRef.current = false;
    }, 100);
  }, [canRedo, history, historyIndex, setNodes, setEdges]);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      
      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, readOnly]);

  // Track changes and trigger auto-save
  useEffect(() => {
    if (flow) {
      const currentNodes = JSON.stringify(toFlowNodes(nodes));
      const currentEdges = JSON.stringify(toFlowEdges(edges));
      const originalNodes = JSON.stringify(flow.nodes);
      const originalEdges = JSON.stringify(flow.edges);
      const changed = currentNodes !== originalNodes || currentEdges !== originalEdges;
      setHasChanges(changed);
      
      // Trigger auto-save if there are changes and not undoing
      if (changed && !isUndoingRef.current && onAutoSave) {
        onAutoSave(toFlowNodes(nodes), toFlowEdges(edges));
      }
    }
  }, [nodes, edges, flow, onAutoSave]);

  // Handle connection (edge creation)
  const onConnect = useCallback(
    (params: Connection) => {
      if (readOnly) return;
      
      const newEdge = {
        ...params,
        id: `edge-${Date.now()}`,
        ...defaultEdgeOptions,
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, readOnly]
  );

  // Handle node click
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      setIsConfigOpen(true);
    },
    []
  );

  // Handle pane click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setIsConfigOpen(false);
  }, []);

  // Handle node deletion
  const onNodesDelete = useCallback(
    (deletedNodes: Node[]) => {
      if (readOnly) return;
      
      // Also delete connected edges
      const deletedNodeIds = new Set(deletedNodes.map((n) => n.id));
      setEdges((eds) =>
        eds.filter(
          (e) => !deletedNodeIds.has(e.source) && !deletedNodeIds.has(e.target)
        )
      );
      
      // Clear selection if deleted
      if (selectedNode && deletedNodeIds.has(selectedNode.id)) {
        setSelectedNode(null);
        setIsConfigOpen(false);
      }
    },
    [selectedNode, setEdges, readOnly]
  );

  // Add new node from palette
  const onAddNode = useCallback(
    (type: NodeType, label: string, config: any) => {
      if (readOnly) return;

      const id = `${type}-${Date.now()}`;
      const newNode: Node = {
        id,
        type,
        position: {
          x: 250,
          y: nodes.length * 100 + 50,
        },
        data: {
          label,
          config,
          metadata: {
            color: NODE_COLORS[type],
          },
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setSelectedNode(newNode);
      setIsConfigOpen(true);
    },
    [nodes, setNodes, readOnly]
  );

  // Update node configuration
  const onNodeConfigChange = useCallback(
    (nodeId: string, label: string, config: any) => {
      if (readOnly) return;

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                label,
                config,
              },
            };
          }
          return node;
        })
      );
    },
    [setNodes, readOnly]
  );

  // Handle drag over for drop
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop from palette
  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (readOnly) return;

      const type = event.dataTransfer.getData('application/reactflow/type') as NodeType;
      const label = event.dataTransfer.getData('application/reactflow/label');
      const config = JSON.parse(event.dataTransfer.getData('application/reactflow/config') || '{}');

      if (!type || !reactFlowWrapper.current) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const id = `${type}-${Date.now()}`;
      const newNode: Node = {
        id,
        type,
        position,
        data: {
          label,
          config,
          metadata: {
            color: NODE_COLORS[type],
          },
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [project, setNodes, readOnly]
  );

  // Save flow
  const handleSave = useCallback(() => {
    const flowNodes = toFlowNodes(getNodes());
    const flowEdges = toFlowEdges(getEdges());
    onSave(flowNodes, flowEdges);
    setHasChanges(false);
  }, [getNodes, getEdges, onSave]);

  // Center view
  const handleCenterView = useCallback(() => {
    if (nodes.length > 0) {
      const firstNode = nodes[0];
      setCenter(firstNode.position.x, firstNode.position.y, { zoom: 1, duration: 800 });
    }
  }, [nodes, setCenter]);

  // MiniMap node color
  const minimapNodeColor = useCallback((node: Node) => {
    return NODE_COLORS[node.type as NodeType] || '#6B7280';
  }, []);

  return (
    <div className="h-screen w-full flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Toolbar */}
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
        onCenterView={handleCenterView}
        onTogglePalette={() => setIsPaletteOpen(!isPaletteOpen)}
        onVersionHistory={onVersionHistory}
        onDelete={onDelete}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        isPaletteOpen={isPaletteOpen}
        readOnly={readOnly}
        lastSaved={lastSaved}
      />

      <div className="flex-1 flex relative overflow-hidden">
        {/* Node Palette (Left Sidebar) */}
        {isPaletteOpen && !readOnly && (
          <NodePalette onAddNode={onAddNode} />
        )}

        {/* Canvas */}
        <div className="flex-1 h-full" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
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
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            minZoom={0.2}
            maxZoom={2}
            deleteKeyCode={readOnly ? null : 'Delete'}
            selectionKeyCode={readOnly ? null : 'Shift'}
            multiSelectionKeyCode={readOnly ? null : 'Meta'}
            panOnScroll
            zoomOnScroll
            className="bg-gray-50 dark:bg-gray-900"
          >
            <Controls
              showInteractive={!readOnly}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
            />
            <MiniMap
              nodeColor={minimapNodeColor}
              maskColor="rgba(0, 0, 0, 0.1)"
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
            />
            <Background
              variant={BackgroundVariant.Dots}
              gap={15}
              size={1}
              color="#94A3B8"
            />

            {/* Empty state */}
            {nodes.length === 0 && (
              <Panel position="top-center" className="mt-32">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 text-center max-w-md">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    Comienza tu automatización
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Arrastra un nodo de trigger desde el panel izquierdo para comenzar a construir tu flow.
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-500">
                    <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                    <span>Trigger</span>
                    <span className="mx-2">→</span>
                    <span className="w-3 h-3 bg-amber-500 rounded-full"></span>
                    <span>Condición</span>
                    <span className="mx-2">→</span>
                    <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                    <span>Acción</span>
                  </div>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Node Configuration Panel (Right Sidebar) */}
        {isConfigOpen && selectedNode && (
          <NodeConfigPanel
            node={selectedNode}
            onClose={() => {
              setSelectedNode(null);
              setIsConfigOpen(false);
            }}
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

// Wrapper with ReactFlow Provider
export default function FlowBuilder(props: FlowBuilderProps) {
  return (
    <ReactFlowProvider>
      <FlowBuilderInner {...props} />
    </ReactFlowProvider>
  );
}

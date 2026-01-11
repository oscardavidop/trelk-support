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
import NodePalette from './NodePalette';
import NodeConfigPanel from './NodeConfigPanel';
import FlowToolbar from './FlowToolbar';

// Custom node types
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  delay: DelayNode,
  end: EndNode,
  branch: ConditionNode, // Use condition node for branches too
};

// Custom edge style
const defaultEdgeOptions = {
  type: 'smoothstep',
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
  onPublish: () => void;
  onSimulate: () => void;
  onClose: () => void;
  isLoading?: boolean;
  readOnly?: boolean;
}

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
  onPublish,
  onSimulate,
  onClose,
  isLoading = false,
  readOnly = false,
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

  // Track changes
  useEffect(() => {
    if (flow) {
      const currentNodes = JSON.stringify(toFlowNodes(nodes));
      const currentEdges = JSON.stringify(toFlowEdges(edges));
      const originalNodes = JSON.stringify(flow.nodes);
      const originalEdges = JSON.stringify(flow.edges);
      setHasChanges(currentNodes !== originalNodes || currentEdges !== originalEdges);
    }
  }, [nodes, edges, flow]);

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
        onSimulate={onSimulate}
        onClose={onClose}
        onCenterView={handleCenterView}
        onTogglePalette={() => setIsPaletteOpen(!isPaletteOpen)}
        isPaletteOpen={isPaletteOpen}
        readOnly={readOnly}
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

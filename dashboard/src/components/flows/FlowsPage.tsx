/**
 * FlowsPage - Main flows management page
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { FlowListItem, FlowStatus, TriggerType, FlowVersion, SimulationResult } from '../../types/flow';
import { TRIGGER_LABELS } from '../../types/flow';
import * as flowService from '../../services/flow.service';
import FlowBuilder from './FlowBuilder';
import { CheckCircle, ChevronDown, Copy, Edit3, Layers, MoreVertical, Plus, RefreshCw, Search, ToggleLeft, ToggleRight, Trash2, Workflow, Zap } from 'lucide-react';
import VersionHistoryModal from './FlowVersionHistory';

// ============= MODAL COMPONENTS =============

// Simulation Modal
const SimulationModal: React.FC<{
  flowId: string;
  flowName: string;
  onClose: () => void;
}> = ({ flowId, flowName, onClose }) => {
  const [triggerType, setTriggerType] = useState<TriggerType>('message_received');
  const [context, setContext] = useState({
    message: 'Hola, necesito ayuda',
    firstName: 'Usuario',
    lastName: 'Test',
    username: 'testuser',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await flowService.simulateFlow(flowId, triggerType, {
        message: { content: context.message, type: 'text' },
        user: {
          firstName: context.firstName,
          lastName: context.lastName,
          username: context.username
        },
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Error en simulación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Simular Flow
            </h2>
            <p className="text-sm text-gray-500">{flowName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {/* Trigger selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de Trigger
            </label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as TriggerType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="message_received">Mensaje recibido</option>
              <option value="chat_created">Chat creado</option>
              <option value="keyword_detected">Keyword detectada</option>
              <option value="file_received">Archivo recibido</option>
              <option value="chat_assigned">Chat asignado</option>
              <option value="chat_closed">Chat cerrado</option>
            </select>
          </div>

          {/* Context inputs */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mensaje
              </label>
              <input
                type="text"
                value={context.message}
                onChange={(e) => setContext({ ...context, message: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nombre
              </label>
              <input
                type="text"
                value={context.firstName}
                onChange={(e) => setContext({ ...context, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
              />
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runSimulation}
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              </svg>
            )}
            Ejecutar Simulación
          </button>

          {/* Error */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`} />
                Resultado de Simulación
              </h3>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.stepsExecuted}</p>
                  <p className="text-xs text-gray-500">Pasos</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.totalDuration}ms</p>
                  <p className="text-xs text-gray-500">Duración</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{result.warnings?.length || 0}</p>
                  <p className="text-xs text-gray-500">Warnings</p>
                </div>
              </div>

              {/* Steps timeline */}
              <div className="space-y-2 max-h-60 overflow-auto">
                {result.steps?.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${step.status === 'success' ? 'bg-green-100 text-green-600' :
                      step.status === 'skipped' ? 'bg-gray-100 text-gray-500' :
                        'bg-red-100 text-red-600'
                      }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{step.nodeLabel}</p>
                      <p className="text-xs text-gray-500">{step.nodeType} · {step.duration}ms</p>
                      {step.output && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{step.output}</p>}
                      {step.error && <p className="text-xs text-red-500 mt-1">{step.error}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



// ============= MAIN COMPONENT =============

const FlowsPage: React.FC = () => {
  // State
  const [flows, setFlows] = useState<FlowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FlowStatus | 'all'>('all');
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderFlow, setBuilderFlow] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  // Modal states
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);

  // Auto-save state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingChangesRef = useRef<{ nodes: any[]; edges: any[] } | null>(null);

  // Load flows
  const loadFlows = async () => {
    try {
      setLoading(true);
      const response = await flowService.getFlows({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
      });
      setFlows(response?.flows || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error cargando flows');
      setFlows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFlows();
  }, [statusFilter, searchQuery]);

  // Open flow builder
  const openFlowBuilder = async (flowId?: string) => {
    if (flowId) {
      try {
        const flow = await flowService.getFlowById(flowId);
        setBuilderFlow(flow);
      } catch (err) {
        console.error('Error loading flow:', err);
      }
    } else {
      setBuilderFlow(null);
    }
    setIsBuilderOpen(true);
  };

  // Create new flow
  const handleCreateFlow = async () => {
    setIsCreating(true);
    try {
      const newFlow = await flowService.createFlow({
        name: 'Nuevo Flow',
        description: '',
        nodes: [],
        edges: [],
      });
      setBuilderFlow(newFlow);
      setIsBuilderOpen(true);
    } catch (err: any) {
      setError(err.message || 'Error creando flow');
    } finally {
      setIsCreating(false);
    }
  };

  // Save flow from builder (with auto-save support)
  const handleSaveFlow = useCallback(async (nodes: any[], edges: any[]) => {
    if (!builderFlow?._id) return;

    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    setIsSaving(true);
    try {
      const updated = await flowService.updateFlow(builderFlow._id, {
        nodes,
        edges,
      });
      setBuilderFlow(updated);
      setLastSaved(new Date());
      pendingChangesRef.current = null;
      loadFlows();
    } catch (err: any) {
      setError(err.message || 'Error guardando flow');
    } finally {
      setIsSaving(false);
    }
  }, [builderFlow?._id]);

  // Auto-save function (debounced)
  const handleAutoSave = useCallback((nodes: any[], edges: any[]) => {
    if (!builderFlow?._id) return;

    // Store pending changes
    pendingChangesRef.current = { nodes, edges };

    // Clear previous timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (3 seconds after last change)
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (pendingChangesRef.current) {
        handleSaveFlow(pendingChangesRef.current.nodes, pendingChangesRef.current.edges);
      }
    }, 3000);
  }, [builderFlow?._id, handleSaveFlow]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Publish flow
  const handlePublishFlow = async () => {
    if (!builderFlow?._id) return;
    setIsSaving(true);
    try {
      const updated = await flowService.publishFlow(builderFlow._id);
      setBuilderFlow(updated);
      loadFlows();
    } catch (err: any) {
      setError(err.message || 'Error publicando flow');
    } finally {
      setIsSaving(false);
    }
  };

  // Unpublish flow
  const handleUnpublishFlow = async () => {
    if (!builderFlow?._id) return;
    setIsSaving(true);
    try {
      const updated = await flowService.unpublishFlow(builderFlow._id);
      setBuilderFlow(updated);
      loadFlows();
    } catch (err: any) {
      setError(err.message || 'Error desactivando flow');
    } finally {
      setIsSaving(false);
    }
  };

  // Simulate flow - opens modal
  const handleSimulateFlow = () => {
    if (!builderFlow?._id) return;
    setShowSimulationModal(true);
  };

  // Close builder
  const handleCloseBuilder = () => {
    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    setIsBuilderOpen(false);
    setBuilderFlow(null);
    setShowSimulationModal(false);
    setShowVersionModal(false);
    loadFlows();
  };

  // Version history - opens modal
  const handleVersionHistory = () => {
    if (!builderFlow?._id) return;
    setShowVersionModal(true);
  };

  // Handle rollback from version modal
  const handleRollback = async (version: number) => {
    // Reload the flow after rollback
    if (builderFlow?._id) {
      const updated = await flowService.getFlowById(builderFlow._id);
      setBuilderFlow(updated);
    }
  };

  // Delete current flow from builder
  const handleDeleteCurrentFlow = async () => {
    if (!builderFlow?._id) return;
    if (!confirm('¿Estás seguro de eliminar este flow? Esta acción no se puede deshacer.')) return;
    try {
      await flowService.deleteFlow(builderFlow._id);
      handleCloseBuilder();
    } catch (err: any) {
      setError(err.message || 'Error eliminando flow');
    }
  };

  // Delete flow
  const handleDeleteFlow = async (id: string) => {
    try {
      await flowService.deleteFlow(id);
      setShowDeleteModal(null);
      loadFlows();
    } catch (err: any) {
      setError(err.message || 'Error eliminando flow');
    }
  };

  // Toggle flow enabled
  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    try {
      await flowService.toggleFlowEnabled(id, enabled);
      loadFlows();
    } catch (err: any) {
      setError(err.message || 'Error actualizando flow');
    }
  };

  // Duplicate flow
  const handleDuplicateFlow = async (id: string) => {
    try {
      await flowService.duplicateFlow(id);
      loadFlows();
    } catch (err: any) {
      setError(err.message || 'Error duplicando flow');
    }
  };

  // Stats
  const stats = useMemo(() => {
    const safeFlows = flows || [];
    return {
      total: safeFlows.length,
      published: safeFlows.filter(f => f.status === 'published').length,
      draft: safeFlows.filter(f => f.status === 'draft').length,
      executions: safeFlows.reduce((acc, f) => acc + (f.executionCount || 0), 0),
    };
  }, [flows]);

  // Show builder if open
  if (isBuilderOpen) {
    return (
      <>
        <FlowBuilder
          flow={builderFlow}
          onSave={handleSaveFlow}
          onAutoSave={handleAutoSave}
          onPublish={handlePublishFlow}
          onUnpublish={handleUnpublishFlow}
          onSimulate={handleSimulateFlow}
          onClose={handleCloseBuilder}
          onDelete={handleDeleteCurrentFlow}
          onVersionHistory={handleVersionHistory}
          isLoading={isSaving}
          lastSaved={lastSaved}
        />

        {/* Simulation Modal */}
        {showSimulationModal && builderFlow && (
          <SimulationModal
            flowId={builderFlow._id}
            flowName={builderFlow.name}
            onClose={() => setShowSimulationModal(false)}
          />
        )}

        {/* Version History Modal */}
        {showVersionModal && builderFlow && (
          <VersionHistoryModal
            flowId={builderFlow._id}
            flowName={builderFlow.name}
            currentVersion={builderFlow.currentVersion || 1}
            onClose={() => setShowVersionModal(false)}
            onRollback={handleRollback}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-cyan-500/30">

      {/* Cyan Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">

        {/* Header Section */}
        <div className="px-8 py-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-cyan-900/10">
                <Workflow className="w-6 h-6 text-cyan-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Flow Builder</h1>
                <p className="text-sm text-zinc-400">Automatización visual de conversaciones</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={loadFlows}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
              </button>

              <button
                onClick={handleCreateFlow}
                disabled={isCreating}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-medium rounded-xl shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
              >
                {isCreating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-5 h-5" />}
                <span>Nuevo Flow</span>
              </button>
            </div>
          </div>

          {/* Stats Bar (Glassy) */}
          <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6">
            <StatBadge icon={Layers} count={stats.total} label="Total" color="text-zinc-200" bg="bg-zinc-800" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={CheckCircle} count={stats.published} label="Publicados" color="text-emerald-400" bg="bg-emerald-500/10" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Edit3} count={stats.draft} label="Borradores" color="text-amber-400" bg="bg-amber-500/10" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Zap} count={stats.executions} label="Ejecuciones" color="text-cyan-400" bg="bg-cyan-500/10" />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[280px] max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-cyan-500 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar flows..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/50 cursor-pointer"
              >
                <option value="all">Todos los estados</option>
                <option value="published">Publicados</option>
                <option value="draft">Borradores</option>
                <option value="archived">Archivados</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            </div>
          ) : flows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
              <Workflow className="w-16 h-16 mb-4 stroke-1" />
              <p className="text-lg font-medium">No se encontraron flows</p>
              <button onClick={handleCreateFlow} className="mt-4 text-sm text-cyan-400 hover:underline">Crear el primero</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {flows.map((flow) => (
                <FlowCard
                  key={flow._id}
                  flow={flow}
                  onEdit={() => openFlowBuilder(flow._id)}
                  onDuplicate={() => handleDuplicateFlow(flow._id)}
                  onDelete={() => setShowDeleteModal(flow._id)}
                  onToggleEnabled={(enabled) => handleToggleEnabled(flow._id, enabled)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">¿Eliminar Flow?</h3>
            <p className="text-zinc-400 text-sm mb-6">Esta acción es irreversible y eliminará todo el historial de ejecuciones.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(null)} className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-colors font-medium">Cancelar</button>
              <button onClick={() => handleDeleteFlow(showDeleteModal)} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors font-medium shadow-lg shadow-red-900/20">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Flow card component
interface FlowCardProps {
  flow: FlowListItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
}

const FlowCard: React.FC<FlowCardProps> = ({ flow, onEdit, onDuplicate, onDelete, onToggleEnabled }) => {
  const [showMenu, setShowMenu] = useState(false);
  const statusColors = {
    draft: { text: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
    published: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    archived: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    disabled: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  };
  const style = statusColors[flow.status as FlowStatus] || statusColors.draft;

  return (
    <div className="group relative bg-zinc-900/60 backdrop-blur-sm border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 hover:shadow-xl hover:shadow-black/20 transition-all duration-300 flex flex-col">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 shadow-inner group-hover:border-cyan-500/30 transition-colors">
            <Workflow className="w-5 h-5 text-zinc-400 group-hover:text-cyan-400 transition-colors" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100 truncate max-w-[140px] group-hover:text-white transition-colors">{flow.name}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold${style.bg} ${style.text} ${style.border}`}>
              {flow.status}
            </span>
          </div>
        </div>

        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-8 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <button onClick={onEdit} className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"><Edit3 className="w-3.5 h-3.5" /> Editar</button>
                <button onClick={onDuplicate} className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"><Copy className="w-3.5 h-3.5" /> Duplicar</button>
                <div className="h-px bg-zinc-800 my-1" />
                <button onClick={onDelete} className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 mb-4 bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/50">
        <div className="text-center p-1">
          <div className="text-sm font-bold text-white">{flow.executionCount || 0}</div>
          <div className="text-[10px] text-zinc-500 tracking-wide">Runs</div>
        </div>
        <div className="text-center p-1 border-l border-zinc-800">
          <div className={`text-sm font-bold ${flow.errorCount > 0 ? 'text-red-400' : 'text-zinc-400'}`}>{flow.errorCount || 0}</div>
          <div className="text-[10px] text-zinc-500 tracking-wide">Errors</div>
        </div>
      </div>

      {/* Triggers */}
      <div className="mb-4 flex-1">
        <div className="text-[10px] font-bold text-zinc-500 tracking-widest mb-2">Triggers</div>
        <div className="flex flex-wrap gap-1.5">
          {flow.triggers?.length > 0 ? flow.triggers.slice(0, 2).map((t: string) => (
            <span key={t} className="px-2 py-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 rounded-md text-[10px] font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" /> {TRIGGER_LABELS[t as TriggerType]}
            </span>
          )) : <span className="text-xs text-zinc-600 italic">Sin triggers</span>}
          {(flow.triggers?.length || 0) > 2 && <span className="px-1.5 py-1 bg-zinc-800 text-zinc-500 rounded text-[10px]">+{flow.triggers.length - 2}</span>}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50 mt-auto">
        <button
          onClick={() => onToggleEnabled(!flow.enabled)}
          disabled={flow.status !== 'published'}
          className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${flow.enabled ? 'text-emerald-400 hover:text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'} ${flow.status !== 'published' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {flow.enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          {flow.enabled ? 'Activado' : 'Desactivado'}
        </button>

        <button onClick={onEdit} className="text-xs font-bold text-cyan-400 hover:text-cyan-300 uppercaseflex items-center gap-1 hover:underline">
          Abrir <ChevronDown className="w-3 h-3 -rotate-90" />
        </button>
      </div>
    </div>
  );
};

function StatBadge({ icon: Icon, count, label, color, bg }: any) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-lg ${color}`}>{count.toLocaleString()}</span>
        <span className="text-[10px] font-bold text-zinc-500">{label}</span>
      </div>
    </div>
  );
}
export default FlowsPage;

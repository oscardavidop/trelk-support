/**
 * FlowsPage - Main flows management page
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { FlowListItem, FlowStatus, TriggerType, FlowVersion, SimulationResult } from '../../types/flow';
import { TRIGGER_LABELS } from '../../types/flow';
import * as flowService from '../../services/flow.service';
import FlowBuilder from './FlowBuilder';

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
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.status === 'success' ? 'bg-green-100 text-green-600' :
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

// Version History Modal
const VersionHistoryModal: React.FC<{
  flowId: string;
  flowName: string;
  currentVersion: number;
  onClose: () => void;
  onRollback: (version: number) => void;
}> = ({ flowId, flowName, currentVersion, onClose, onRollback }) => {
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<number | null>(null);

  useEffect(() => {
    loadVersions();
  }, [flowId]);

  const loadVersions = async () => {
    try {
      const res = await flowService.getFlowVersions(flowId);
      setVersions(res?.versions || []);
    } catch (err: any) {
      setError(err.message || 'Error cargando versiones');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async (version: number) => {
    setRollingBack(version);
    try {
      await flowService.rollbackFlow(flowId, version);
      onRollback(version);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error restaurando versión');
    } finally {
      setRollingBack(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Historial de Versiones
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
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No hay versiones guardadas aún</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.version}
                  className={`p-4 rounded-lg border ${
                    v.version === currentVersion
                      ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          Versión {v.version}
                        </span>
                        {v.version === currentVersion && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 text-xs rounded-full">
                            Actual
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatDate(v.publishedAt)}
                      </p>
                      {v.changeDescription && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {v.changeDescription}
                        </p>
                      )}
                    </div>
                    {v.version !== currentVersion && (
                      <button
                        onClick={() => handleRollback(v.version)}
                        disabled={rollingBack !== null}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {rollingBack === v.version ? (
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          'Restaurar'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Flow Builder
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automatiza procesos con flujos visuales
            </p>
          </div>
          <button
            onClick={handleCreateFlow}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {isCreating ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            <span>Nuevo Flow</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total flows</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.published}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Publicados</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.draft}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Borradores</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.executions.toLocaleString()}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Ejecuciones</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <input
            type="text"
            placeholder="Buscar flows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as FlowStatus | 'all')}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Todos los estados</option>
          <option value="published">Publicados</option>
          <option value="draft">Borradores</option>
          <option value="archived">Archivados</option>
        </select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline">
              Cerrar
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-64">
            <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {/* Empty state */}
        {!loading && flows.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No hay flows creados
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Crea tu primer flow para automatizar procesos
            </p>
            <button
              onClick={handleCreateFlow}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Crear primer flow
            </button>
          </div>
        )}

        {/* Flow list */}
        {!loading && flows.length > 0 && (
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
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

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              ¿Eliminar flow?
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Esta acción no se puede deshacer. El flow y todas sus ejecuciones serán eliminados.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteFlow(showDeleteModal)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Eliminar
              </button>
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

const FlowCard: React.FC<FlowCardProps> = ({
  flow,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleEnabled,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const getStatusBadge = () => {
    const styles: Record<FlowStatus, { bg: string; text: string; label: string }> = {
      draft: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', label: 'Borrador' },
      published: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', label: 'Publicado' },
      archived: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', label: 'Archivado' },
      disabled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', label: 'Desactivado' },
    };
    const style = styles[flow.status] || styles.draft;
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        {style.label}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
            {flow.name}
          </h3>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                  <button
                    onClick={() => { onEdit(); setShowMenu(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => { onDuplicate(); setShowMenu(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    Duplicar
                  </button>
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {flow.enabled && flow.status === 'published' && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Activo
            </span>
          )}
        </div>
      </div>

      {/* Triggers */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Triggers</div>
        <div className="flex flex-wrap gap-1">
          {flow.triggers.length > 0 ? (
            flow.triggers.slice(0, 3).map((trigger) => (
              <span
                key={trigger}
                className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs"
              >
                {TRIGGER_LABELS[trigger]}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-400">Sin triggers</span>
          )}
          {flow.triggers.length > 3 && (
            <span className="px-2 py-0.5 text-gray-500 text-xs">
              +{flow.triggers.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {flow.executionCount.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Ejecuciones</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {flow.errorCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Errores</div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={flow.enabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="sr-only peer"
              disabled={flow.status !== 'published'}
            />
            <div className={`w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-blue-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 ${flow.status !== 'published' ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <div className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform ${flow.enabled ? 'translate-x-4' : ''}`} />
            </div>
          </label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {flow.enabled ? 'Activado' : 'Desactivado'}
          </span>
        </div>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
        >
          Abrir
        </button>
      </div>
    </div>
  );
};

export default FlowsPage;

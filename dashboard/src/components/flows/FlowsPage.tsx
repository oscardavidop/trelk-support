/**
 * FlowsPage - Main flows management page
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { FlowListItem, FlowStatus, TriggerType } from '../../types/flow';
import { TRIGGER_LABELS } from '../../types/flow';
import * as flowService from '../../services/flow.service';
import FlowBuilder from './FlowBuilder';

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

  // Save flow from builder
  const handleSaveFlow = async (nodes: any[], edges: any[]) => {
    if (!builderFlow?._id) return;
    try {
      const updated = await flowService.updateFlow(builderFlow._id, {
        nodes,
        edges,
      });
      setBuilderFlow(updated);
      loadFlows();
    } catch (err: any) {
      setError(err.message || 'Error guardando flow');
    }
  };

  // Publish flow
  const handlePublishFlow = async () => {
    if (!builderFlow?._id) return;
    try {
      const updated = await flowService.publishFlow(builderFlow._id);
      setBuilderFlow(updated);
      loadFlows();
    } catch (err: any) {
      setError(err.message || 'Error publicando flow');
    }
  };

  // Simulate flow
  const handleSimulateFlow = () => {
    // TODO: Open simulation modal
    console.log('Simulate flow');
  };

  // Close builder
  const handleCloseBuilder = () => {
    setIsBuilderOpen(false);
    setBuilderFlow(null);
    loadFlows();
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
      <FlowBuilder
        flow={builderFlow}
        onSave={handleSaveFlow}
        onPublish={handlePublishFlow}
        onSimulate={handleSimulateFlow}
        onClose={handleCloseBuilder}
      />
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

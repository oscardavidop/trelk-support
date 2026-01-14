/**
 * FlowVersionHistory - Modal for viewing and managing flow versions
 */

import React, { useState, useEffect } from 'react';
import type { Flow, FlowVersion } from '../../types/flow';
import * as flowService from '../../services/flow.service';

interface FlowVersionHistoryProps {
  flow: Flow;
  onClose: () => void;
  onRollback: (version: number) => Promise<void>;
}

const FlowVersionHistory: React.FC<FlowVersionHistoryProps> = ({
  flow,
  onClose,
  onRollback,
}) => {
  const [versions, setVersions] = useState<FlowVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [showConfirmRollback, setShowConfirmRollback] = useState(false);

  useEffect(() => {
    loadVersions();
  }, [flow._id]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const response = await flowService.getFlowVersions(flow._id);
      setVersions(response.versions);
    } catch (err: any) {
      setError(err.message || 'Error cargando versiones');
    } finally {
      setLoading(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedVersion) return;
    
    try {
      setRolling(true);
      await onRollback(selectedVersion);
      setShowConfirmRollback(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error restaurando versión');
    } finally {
      setRolling(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Historial de versiones
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {flow.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center h-48">
              <svg className="w-8 h-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 m-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Empty */}
          {!loading && versions.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">
                No hay versiones previas
              </p>
            </div>
          )}

          {/* Version list */}
          {!loading && versions.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {versions.map((version, index) => {
                const isCurrent = version.version === flow.currentVersion;
                const isSelected = selectedVersion === version.version;

                return (
                  <div
                    key={version.version}
                    className={`px-6 py-4 flex items-start gap-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                    onClick={() => !isCurrent && setSelectedVersion(version.version)}
                  >
                    {/* Version indicator */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          isCurrent
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        v{version.version}
                      </div>
                      {index < versions.length - 1 && (
                        <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700 mt-2" />
                      )}
                    </div>

                    {/* Version info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {isCurrent && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded text-xs font-medium">
                            Actual
                          </span>
                        )}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(version.createdAt)}
                        </span>
                      </div>
                      
                      {version.changeDescription && (
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                          {version.changeDescription}
                        </p>
                      )}
                      
                      {version.createdBy && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Por {version.createdBy.name}
                        </p>
                      )}
                    </div>

                    {/* Selection indicator */}
                    {!isCurrent && (
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => setShowConfirmRollback(true)}
            disabled={!selectedVersion}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Restaurar versión v{selectedVersion}
          </button>
        </div>
      </div>

      {/* Confirm rollback modal */}
      {showConfirmRollback && selectedVersion && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              ¿Restaurar a versión v{selectedVersion}?
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Esto reemplazará la configuración actual del flow con la versión seleccionada. La versión actual se guardará en el historial.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmRollback(false)}
                disabled={rolling}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleRollback}
                disabled={rolling}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {rolling ? 'Restaurando...' : 'Restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowVersionHistory;

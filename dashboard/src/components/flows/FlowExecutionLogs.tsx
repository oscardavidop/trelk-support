/**
 * FlowExecutionLogs - Shows execution logs for a flow
 * Real-time visibility into flow execution
 */

import React, { useState, useEffect } from 'react';
import * as flowService from '../../services/flow.service';
import type { FlowExecution, ExecutionStep } from '../../types/flow';

interface FlowExecutionLogsProps {
  flowId?: string;
  sessionId?: string;
  limit?: number;
  onClose?: () => void;
}

// Extended type for display
interface ExecutionLogDisplay extends FlowExecution {
  flowName?: string;
}

const FlowExecutionLogs: React.FC<FlowExecutionLogsProps> = ({
  flowId,
  sessionId,
  limit = 50,
  onClose,
}) => {
  const [logs, setLogs] = useState<ExecutionLogDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ExecutionLogDisplay | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load execution logs
  const loadLogs = async () => {
    try {
      const params: any = { limit };
      if (flowId) params.flowId = flowId;
      if (sessionId) params.sessionId = sessionId;
      
      const response = await flowService.getFlowExecutions(params);
      setLogs((response?.executions || []) as ExecutionLogDisplay[]);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Error cargando logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [flowId, sessionId, limit]);

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, flowId, sessionId, limit]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; dot: string }> = {
      running: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500 animate-pulse' },
      completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', dot: 'bg-green-500' },
      failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
      paused: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
      pending: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
      cancelled: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', dot: 'bg-gray-400' },
    };
    const style = styles[status] || styles.pending;
    
    const labels: Record<string, string> = {
      running: 'Ejecutando',
      completed: 'Completado',
      failed: 'Fallido',
      paused: 'Pausado',
      pending: 'Pendiente',
      cancelled: 'Cancelado',
    };
    
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
        {labels[status] || status}
      </span>
    );
  };

  const formatDuration = (ms: number | undefined) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDateTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Logs de Ejecución
          </h3>
          {loading && (
            <svg className="w-4 h-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Auto refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              autoRefresh 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            Auto-refresh
          </button>
          
          {/* Manual refresh */}
          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Logs list */}
        <div className={`${selectedLog ? 'w-1/2 border-r border-gray-200 dark:border-gray-700' : 'w-full'} overflow-auto`}>
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {logs.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <svg className="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p>No hay ejecuciones registradas</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {logs.map((log) => (
                <div
                  key={log._id}
                  onClick={() => setSelectedLog(log)}
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                    selectedLog?._id === log._id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(log.status)}
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {log.flowName || 'Flow'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                        <p>Trigger: {log.context?.triggerType || '-'}</p>
                        {log.sessionId && <p>Session: {log.sessionId.slice(-8)}</p>}
                        <p>
                          {formatTime(log.startedAt)}
                          {log.totalDuration && ` · ${formatDuration(log.totalDuration)}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">
                        {log.steps?.length || 0} pasos
                      </p>
                      {log.status === 'running' && log.currentNodeId && (
                        <p className="text-xs text-blue-500 mt-1">
                          → Nodo activo
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Error message preview */}
                  {log.lastError && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400 truncate">
                      {log.lastError}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Log detail */}
        {selectedLog && (
          <div className="w-1/2 overflow-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                Detalle de Ejecución
              </h4>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Execution info */}
            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Estado:</span>
                <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Duración:</span>
                <p className="text-gray-900 dark:text-gray-100 mt-1">
                  {selectedLog.totalDuration ? formatDuration(selectedLog.totalDuration) : 'En progreso...'}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Iniciado:</span>
                <p className="text-gray-900 dark:text-gray-100 mt-1">
                  {formatDateTime(selectedLog.startedAt)}
                </p>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Trigger:</span>
                <p className="text-gray-900 dark:text-gray-100 mt-1">
                  {selectedLog.context?.triggerType || '-'}
                </p>
              </div>
            </div>

            {/* Error if any */}
            {selectedLog.lastError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Error</p>
                <p className="text-sm text-red-700 dark:text-red-300">{selectedLog.lastError}</p>
              </div>
            )}

            {/* Executed nodes timeline */}
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Pasos ejecutados
              </h5>
              <div className="space-y-2">
                {selectedLog.steps?.map((step: ExecutionStep, index: number) => (
                  <div
                    key={`${step.nodeId}-${index}`}
                    className="flex items-start gap-3 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                      step.status === 'completed' 
                        ? 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400'
                        : step.status === 'failed'
                        ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                        : step.status === 'skipped'
                        ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                        : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {step.nodeLabel}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                          {step.nodeType}
                        </span>
                      </div>
                      {step.output && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                          {typeof step.output === 'string' ? step.output : JSON.stringify(step.output)}
                        </p>
                      )}
                      {step.error && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          {step.error}
                        </p>
                      )}
                    </div>
                    {step.duration && (
                      <span className="text-xs text-gray-400">
                        {formatDuration(step.duration)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlowExecutionLogs;

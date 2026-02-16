/**
 * FlowSimulator - Modal for testing flow execution
 */

import React, { useState } from 'react';
import { 
  TRIGGER_LABELS 
} from '../../types/flow';
import type { 
  Flow, 
  TriggerType, 
  SimulationResult 
} from '../../types/flow';
import * as flowService from '../../services/flow.service';

interface FlowSimulatorProps {
  flow: Flow;
  onClose: () => void;
}

const FlowSimulator: React.FC<FlowSimulatorProps> = ({ flow, onClose }) => {
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerType | ''>('');
  const [context, setContext] = useState<string>(
    JSON.stringify(
      {
        message: { text: 'Hola, necesito ayuda' },
        user: { id: 12345, firstName: 'Juan', lastName: 'Pérez', username: 'juanperez' },
        session: { category: 'general', tags: [], messageCount: 1 },
      },
      null,
      2
    )
  );
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    if (!selectedTrigger) {
      setError('Selecciona un trigger');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const parsedContext = JSON.parse(context);
      const simResult = await flowService.simulateFlow(
        flow._id,
        selectedTrigger,
        parsedContext
      );
      setResult(simResult);
    } catch (err: any) {
      setError(err.message || 'Error ejecutando simulación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Simular Flow
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Prueba tu flow con datos de ejemplo
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Trigger selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Trigger a simular
            </label>
            <select
              value={selectedTrigger}
              onChange={(e) => setSelectedTrigger(e.target.value as TriggerType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar trigger...</option>
              {flow.triggers.map((trigger) => (
                <option key={trigger} value={trigger}>
                  {TRIGGER_LABELS[trigger]}
                </option>
              ))}
            </select>
          </div>

          {/* Context editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Contexto (JSON)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Define los datos del mensaje, usuario y sesión para la simulación
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  Resultado de la simulación
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Completion status */}
                <div className="flex items-center gap-2">
                  {result.wouldComplete ? (
                    <>
                      <span className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="text-sm text-green-600 dark:text-green-400">
                        El flow completaría exitosamente
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </span>
                      <span className="text-sm text-amber-600 dark:text-amber-400">
                        El flow no completaría (se detendría en una condición)
                      </span>
                    </>
                  )}
                </div>

                {/* Steps */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pasos ejecutados
                  </h4>
                  <div className="space-y-2">
                    {result.steps.map((step, index) => (
                      <div
                        key={step.nodeId}
                        className={`flex items-start gap-3 p-3 rounded-lg ${
                          step.wouldExecute
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                            : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <span className="flex-shrink-0 w-6 h-6 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-xs font-medium border border-gray-300 dark:border-gray-600">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                              {step.nodeLabel}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              step.nodeType === 'trigger'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                : step.nodeType === 'condition'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                : step.nodeType === 'action'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                                : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                            }`}>
                              {step.nodeType}
                            </span>
                          </div>
                          
                          {step.nodeType === 'condition' && step.conditionResult !== undefined && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Resultado: {step.conditionResult ? '✓ Verdadero' : '✗ Falso'}
                            </div>
                          )}
                          
                          {step.output && (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Output: {JSON.stringify(step.output)}
                            </div>
                          )}
                        </div>
                        
                        {step.wouldExecute ? (
                          <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handleSimulate}
            disabled={loading || !selectedTrigger}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-zinc-50 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Simulando...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Ejecutar simulación</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlowSimulator;

/**
 * VersionHistoryModal - History and Rollback
 * Refactored: Premium Zinc Style
 */

import React, { useState, useEffect } from 'react';
import { flowService  } from '../../services/flow.service';
import { 
  X, History, RotateCcw, CheckCircle2, AlertCircle, Loader2, GitCommit, Calendar
} from 'lucide-react';

interface VersionHistoryModalProps {
  flowId: string;
  flowName: string;
  currentVersion: number;
  onClose: () => void;
  onRollback: (version: number) => void;
}

const VersionHistoryModal: React.FC<VersionHistoryModalProps> = ({ 
  flowId, 
  flowName, 
  currentVersion, 
  onClose, 
  onRollback 
}) => {
  const [versions, setVersions] = useState<any[]>([]);
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
    if (!confirm(`¿Estás seguro de restaurar la versión ${version}? Se perderán los cambios no guardados.`)) return;
    
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
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl shadow-inner">
              <History className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Historial de Versiones</h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">{flowName}</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-zinc-500 animate-pulse">Cargando historial...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-red-400">Error de carga</h4>
                <p className="text-xs text-red-300/80 mt-1">{error}</p>
              </div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <GitCommit className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No hay versiones guardadas</p>
              <p className="text-xs mt-1 opacity-60">Publica tu flujo para crear un punto de restauración.</p>
            </div>
          ) : (
            <div className="relative space-y-6 pl-4">
              {/* Timeline Line */}
              <div className="absolute left-[19px] top-4 bottom-4 w-px bg-zinc-800" />

              {versions.map((v, idx) => {
                const isCurrent = v.version === currentVersion;
                return (
                  <div key={v.version} className="relative pl-8 group">
                    
                    {/* Timeline Dot */}
                    <div className={`
                      absolute left-0 top-1 w-10 h-10 rounded-full border-4 border-zinc-900 flex items-center justify-center z-10 transition-colors
                      ${isCurrent ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-zinc-200'}
                    `}>
                      <span className="text-xs font-bold">{v.version}</span>
                    </div>

                    {/* Card */}
                    <div className={`
                      p-4 rounded-xl border transition-all duration-200
                      ${isCurrent 
                        ? 'bg-zinc-800/50 border-indigo-500/30 shadow-md ring-1 ring-indigo-500/20' 
                        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/30'}
                    `}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${isCurrent ? 'text-white' : 'text-zinc-300'}`}>
                              Versión {v.version}
                            </span>
                            {isCurrent && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/20 uppercase tracking-wide flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Actual
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mt-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(v.createdAt)}
                          </div>
                        </div>

                        {!isCurrent && (
                          <button
                            onClick={() => handleRollback(v.version)}
                            disabled={rollingBack !== null}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg border border-zinc-700 transition-all hover:border-zinc-600 disabled:opacity-50"
                          >
                            {rollingBack === v.version ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                            <span>Restaurar</span>
                          </button>
                        )}
                      </div>

                      {v.changeDescription ? (
                        <p className="text-xs text-zinc-400 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50 italic">
                          "{v.changeDescription}"
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-600 italic">Sin descripción de cambios</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 text-center">
           <p className="text-[10px] text-zinc-500">
             Restaurar una versión anterior creará una nueva versión basada en ella.
           </p>
        </div>

      </div>
    </div>
  );
};

export default VersionHistoryModal;
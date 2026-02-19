/**
 * ExportPanel - Premium Zinc Refactor
 * Enterprise-grade chat export tool with high-fidelity UI
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Download, FileArchive, FileSpreadsheet, FileText, Loader2, Check, X,
  Trash2, RefreshCw, ChevronDown, Shield, Eye, EyeOff, Clock, AlertCircle,
  FileJson, Database, History, Calendar, CheckSquare, Square
} from 'lucide-react';
import {
  createSessionExport, getExportJobStatus, getExportJobs, downloadExport, deleteExportJob,
  formatFileSize, FORMAT_LABELS,
  type ExportFormat, type ExportIncludeOptions, type ExportAdvancedOptions, type ExportJobData, type ExportJobStatusData
} from '../../services/export.service';
import { useAuthStore } from '../../stores/authStore';

// ============= CONFIGURATION =============

interface ExportPanelProps {
  sessionId: string;
}

type ExportStep = 'config' | 'exporting' | 'done';

const FORMAT_OPTIONS: { value: ExportFormat; icon: React.ElementType; label: string; desc: string; color: string }[] = [
  { value: 'zip', icon: FileArchive, label: 'Paquete ZIP', desc: 'JSON + Archivos adjuntos', color: 'text-amber-400' },
  { value: 'xlsx', icon: FileSpreadsheet, label: 'Excel (.xlsx)', desc: 'Reporte tabular estructurado', color: 'text-emerald-400' },
  { value: 'html', icon: FileText, label: 'Reporte HTML', desc: 'Vista visual imprimible', color: 'text-orange-400' },
  { value: 'pdf', icon: FileText, label: 'Reporte PDF', desc: 'Documento visual de alta calidad', color: 'text-red-400' },
  { value: 'json', icon: FileJson, label: 'JSON Raw', desc: 'Datos crudos para análisis', color: 'text-yellow-400' },
  { value: 'csv', icon: Database, label: 'CSV', desc: 'Texto plano separado por comas', color: 'text-blue-400' },
];

const INCLUDE_DEFAULTS: ExportIncludeOptions = {
  messages: true, notes: true, transfers: true, ratings: true, userInfo: true, disposition: true,
  media: false, scheduledMessages: false, whispers: false, contactHistory: false, qaReview: false, systemLogs: false, agentActions: false,
};

const INCLUDE_OPTIONS: { key: keyof ExportIncludeOptions; label: string }[] = [
  { key: 'messages', label: 'Mensajes' },
  { key: 'notes', label: 'Notas internas' },
  { key: 'media', label: 'Archivos media' },
  { key: 'disposition', label: 'Disposición' },
  { key: 'transfers', label: 'Transferencias' },
  { key: 'scheduledMessages', label: 'Msg. programados' },
  { key: 'whispers', label: 'Whispers' },
  { key: 'qaReview', label: 'QA Review' },
  { key: 'contactHistory', label: 'Historial contacto' },
  { key: 'systemLogs', label: 'Logs del sistema' },
  { key: 'ratings', label: 'Ratings / Feedback' },
  { key: 'userInfo', label: 'Info del usuario' },
];

// ============= MAIN COMPONENT =============

export default function ExportPanel({ sessionId }: ExportPanelProps) {
  const agent = useAuthStore(s => s.agent);
  const canExport = agent?.role === 'admin' || agent?.role === 'supervisor';

  const [step, setStep] = useState<ExportStep>('config');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('zip');
  const [include, setInclude] = useState<ExportIncludeOptions>({ ...INCLUDE_DEFAULTS });
  const [advanced, setAdvanced] = useState<ExportAdvancedOptions>({ redactPII: false, gdprMode: false });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showIncludes, setShowIncludes] = useState(false);

  // Export State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<ExportJobStatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // History State
  const [history, setHistory] = useState<ExportJobData[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);


  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Logic: Polling ---
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const status = await getExportJobStatus(jobId);
      setJobStatus(status);
      if (status.status === 'completed') { setStep('done'); stopPolling(); }
      else if (status.status === 'failed') { setError(status.error || 'Error desconocido'); setStep('config'); stopPolling(); }
    } catch { /* keep polling */ }
  }, []);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(() => pollJobStatus(jobId), 1500);
  }, [pollJobStatus]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // --- Handlers ---
  const handleExport = async () => {
    setError(null); setStep('exporting');
    try {
      const result = await createSessionExport(sessionId, {
        format: selectedFormat, include, advanced: (advanced.redactPII || advanced.gdprMode) ? advanced : undefined,
      });
      setActiveJobId(result.jobId); setJobStatus(null); startPolling(result.jobId);
    } catch (err: any) { setError(err.message || 'Error al exportar'); setStep('config'); }
  };

  const handleDownload = () => activeJobId && downloadExport(activeJobId, selectedFormat, setIsExporting);

  const handleReset = () => { setStep('config'); setActiveJobId(null); setJobStatus(null); setError(null); };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const result = await getExportJobs({ limit: 10 });
      setHistory(result.data);
    } catch { /* ignore */ }
    finally { setLoadingHistory(false); }
  };

  const handleDeleteJob = async (jobId: string) => {
    try {
      await deleteExportJob(jobId);
      setHistory(prev => prev.filter(j => j._id !== jobId));
    } catch { /* ignore */ }
  };

  if (!canExport) {
    return (
      <div className="px-4 py-6 flex flex-col items-center text-center text-zinc-500">
        <Shield className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-xs italic">Solo supervisores y administradores pueden exportar datos.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-6">

      {/* === ERROR BANNER === */}
      {error && (
        <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-bold">Error de Exportación</p>
            <p className="opacity-90">{error}</p>
          </div>
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* === STEP 1: CONFIGURATION === */}
      {step === 'config' && (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* Format Selection */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-zinc-500 uppercase  px-1">Formato de Exportación</h4>
            <div className="grid gap-2">
              {FORMAT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedFormat(opt.value)}
                  className={`
                    relative flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all
                    ${selectedFormat === opt.value
                      ? 'bg-indigo-500/10 border-indigo-500/30 ring-1 ring-indigo-500/20'
                      : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                    }
                  `}
                >
                  <div className={`p-2 rounded-lg bg-zinc-950 border border-zinc-800 ${selectedFormat === opt.value ? 'shadow-inner' : ''}`}>
                    <opt.icon className={`w-4 h-4 ${opt.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${selectedFormat === opt.value ? 'text-indigo-200' : 'text-zinc-300'}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">{opt.desc}</p>
                  </div>
                  {selectedFormat === opt.value && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/40">
                        <Check className="w-2.5 h-2.5 text-zinc-50" />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Includes Toggle */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowIncludes(!showIncludes)}
              className="w-full flex items-center justify-between px-4 py-3 text-xs font-medium text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <CheckSquare className="w-3.5 h-3.5 text-zinc-500" />
                Contenido a Incluir
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${showIncludes ? 'rotate-180' : ''}`} />
            </button>

            {showIncludes && (
              <div className="p-2 pt-3 grid grid-cols-2 gap-1 bg-zinc-900/50 border-t border-zinc-800 py-3 animate-in fade-in slide-in-from-top-2">
                {INCLUDE_OPTIONS.map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors group">
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${include[opt.key] ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-600 group-hover:border-zinc-500'}`}>
                      {include[opt.key] && <Check className="w-2.5 h-2.5 text-zinc-50" />}
                    </div>
                    <input type="checkbox" checked={!!include[opt.key]} onChange={() => setInclude(p => ({ ...p, [opt.key]: !p[opt.key] }))} className="hidden" />
                    <span className={`text-[11px] ${include[opt.key] ? 'text-zinc-200' : 'text-zinc-500'}`}>{opt.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Advanced Options */}
          <div className="space-y-2 px-1">
            <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${advanced.redactPII ? 'bg-amber-500/10 border-amber-500/30' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${advanced.redactPII ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  <EyeOff className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className={`text-xs font-medium ${advanced.redactPII ? 'text-amber-200' : 'text-zinc-300'}`}>Redacción PII</p>
                  <p className="text-[10px] text-zinc-500">Ocultar datos sensibles (emails, teléfonos)</p>
                </div>
              </div>
              <input type="checkbox" checked={advanced.redactPII} onChange={() => setAdvanced(p => ({ ...p, redactPII: !p.redactPII }))} className="hidden" />
              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${advanced.redactPII ? 'bg-amber-500' : 'bg-zinc-700'}`}>
                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${advanced.redactPII ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </label>

            <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${advanced.gdprMode ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${advanced.gdprMode ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-500'}`}>
                  <Shield className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className={`text-xs font-medium ${advanced.gdprMode ? 'text-red-200' : 'text-zinc-300'}`}>Modo GDPR</p>
                  <p className="text-[10px] text-zinc-500">Anonimización total del usuario</p>
                </div>
              </div>
              <input type="checkbox" checked={advanced.gdprMode} onChange={() => setAdvanced(p => ({ ...p, gdprMode: !p.gdprMode }))} className="hidden" />
              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${advanced.gdprMode ? 'bg-red-500' : 'bg-zinc-700'}`}>
                <div className={`w-3 h-3 bg-white rounded-full shadow-sm transition-transform ${advanced.gdprMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </label>
          </div>

          {/* Action Button */}
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 text-xs font-bold uppercase  rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:translate-y-[-1px] active:scale-[0.98]"
          >
            <Download className="w-3.5 h-3.5" /> Generar Exportación
          </button>
        </div>
      )}

      {/* === STEP 2: EXPORTING === */}
      {step === 'exporting' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center animate-in fade-in zoom-in-95">
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin relative z-10" />
          </div>
          <h3 className="text-sm font-bold text-zinc-50 mb-1">Generando Archivo...</h3>
          <p className="text-xs text-zinc-500 mb-4">{jobStatus?.currentStep || 'Procesando datos'}</p>

          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${jobStatus?.progress || 10}%` }} />
          </div>
          <p className="text-[10px] font-mono text-zinc-500 mt-2">{jobStatus?.progress || 0}%</p>
        </div>
      )}

      {/* === STEP 3: DONE === */}
      {step === 'done' && jobStatus && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-400">¡Exportación Lista!</p>
              <p className="text-xs text-emerald-400/70 font-mono mt-0.5">
                {formatFileSize(jobStatus.fileSize)} • {FORMAT_LABELS[selectedFormat].label}
              </p>
            </div>
          </div>

          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-zinc-50 text-xs font-bold uppercase  rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-0.5"
          >
            <Download className="w-3.5 h-3.5" /> {
              isExporting ? 'Descargando...' : `Descargar ${FORMAT_LABELS[selectedFormat].label.split(' ')[0]}`
            }
          </button>

          <button onClick={handleReset} className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center justify-center gap-1.5">
            <RefreshCw className="w-3 h-3" /> Crear otra exportación
          </button>
        </div>
      )}

      {/* === HISTORY TOGGLE === */}
      <div className="pt-4 border-t border-zinc-800">
        <button
          onClick={() => {
            const next = !showHistory;
            setShowHistory(next);
            if (next && history.length === 0) loadHistory();
          }}
          className="w-full flex items-center justify-between text-[10px] font-bold text-zinc-500 hover:text-zinc-300 uppercase  transition-colors"
        >
          <span className="flex items-center gap-1.5"><History className="w-3 h-3" /> Historial Reciente</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>

        {showHistory && (
          <div className="mt-3 space-y-2 animate-in slide-in-from-top-2">
            {loadingHistory ? (
              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-zinc-600" /></div>
            ) : history.length === 0 ? (
              <p className="text-center text-[10px] text-zinc-600 py-2">No hay historial disponible.</p>
            ) : (
              history.map(job => (
                <div key={job._id} className="flex items-center justify-between p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full ${job.status === 'completed' ? 'bg-emerald-500' : job.status === 'failed' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`} />
                    <div>
                      <p className="text-xs font-bold text-zinc-300">{job.format?.toUpperCase()} <span className="text-zinc-600 font-normal">| {formatFileSize(job.fileSize)}</span></p>
                      <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        {new Date(job.createdAt || job.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {job.status === 'completed' && job.downloadUrl && (
                      <button onClick={() => downloadExport(job._id)} className="p-1.5 text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"><Download className="w-3.5 h-3.5" /></button>
                    )}
                    <button onClick={() => handleDeleteJob(job._id)} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

    </div>
  );
}
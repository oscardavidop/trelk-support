/**
 * ExportsPage - Advanced Export System UI
 * Allows exporting conversations, logs, and data in multiple formats
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Navigate } from 'react-router-dom';
import {
  Download,
  FileText,
  FileJson,
  FileSpreadsheet,
  Calendar,
  Filter,
  Users,
  Tag,
  CheckCircle,
  Loader2,
  Clock,
  AlertCircle,
  RefreshCw,
  Trash2,
  Eye,
  Play,
  Archive,
  HardDrive,
  ChevronRight,
  X
} from 'lucide-react';

type ExportFormat = 'pdf' | 'json' | 'csv';
type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface ExportJob {
  _id: string;
  format: ExportFormat;
  status: ExportStatus;
  filters: {
    dateFrom?: string;
    dateTo?: string;
    agentIds?: string[];
    categories?: string[];
    status?: string[];
  };
  options: {
    includeMessages: boolean;
    includeNotes: boolean;
    includeLogs: boolean;
    includeAgentActions: boolean;
    includeBranding?: boolean;
  };
  downloadUrl?: string;
  fileSize?: number;
  recordCount?: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

interface Agent {
  _id: string;
  name: string;
}

interface Category {
  _id: string;
  name: string;
}

export default function ExportsPage() {
  const { agent } = useAuthStore();

  // Access control
  const canAccess = agent?.role === 'admin' || agent?.role === 'supervisor';

  // Export jobs list
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);

  // New export form
  const [showForm, setShowForm] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string[]>([]);
  const [includeMessages, setIncludeMessages] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeLogs, setIncludeLogs] = useState(false);
  const [includeAgentActions, setIncludeAgentActions] = useState(false);
  const [includeBranding, setIncludeBranding] = useState(true);
  const [creating, setCreating] = useState(false);

  // Available options
  const [agents, setAgents] = useState<Agent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      completed: jobs.filter(j => j.status === 'completed').length,
      processing: jobs.filter(j => ['pending', 'processing'].includes(j.status)).length,
      failed: jobs.filter(j => j.status === 'failed').length,
      totalRecords: jobs.reduce((acc, curr) => acc + (curr.recordCount || 0), 0)
    };
  }, [jobs]);

  // Fetch export jobs
  const fetchJobs = useCallback(async () => {
    if (!canAccess) return;

    setLoadingJobs(true);
    try {
      const token = JSON.parse(localStorage.getItem('trelk-support-auth') || '{}').state?.token;

      const res = await fetch(`/api/exports/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch export jobs:', error);
    } finally {
      setLoadingJobs(false);
    }
  }, [canAccess]);

  // Fetch agents for filters (categories are static)
  const fetchOptions = useCallback(async () => {
    if (!canAccess) return;

    try {
      const token = JSON.parse(localStorage.getItem('trelk-support-auth') || '{}').state?.token;

      // Fetch agents
      const agentsRes = await fetch(`/api/agents`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        // API returns { ok: true, agents: [...] }
        setAgents(data.agents || []);
      }

      // Categories are static based on ChatSession model
      setCategories([
        { _id: 'support', name: 'Soporte' },
        { _id: 'billing', name: 'Facturación' },
        { _id: 'bug', name: 'Errores' },
        { _id: 'feedback', name: 'Feedback' },
        { _id: 'other', name: 'Otros' }
      ]);
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  }, [canAccess]);

  useEffect(() => {
    fetchJobs();
    fetchOptions();
  }, [fetchJobs, fetchOptions]);

  // Poll only when there are pending/processing jobs
  useEffect(() => {
    const hasPendingJobs = jobs.some(j => j.status === 'pending' || j.status === 'processing');
    if (!hasPendingJobs) return;

    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  // Create export job
  const handleCreateExport = async () => {
    setCreating(true);
    try {
      const token = JSON.parse(localStorage.getItem('trelk-support-auth') || '{}').state?.token;

      const res = await fetch(`/api/exports/batch`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          format,
          filters: {
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            agentIds: selectedAgents.length > 0 ? selectedAgents : undefined,
            categories: selectedCategories.length > 0 ? selectedCategories : undefined,
            statuses: selectedStatus.length > 0 ? selectedStatus : undefined,
          },
          include: {
            messages: includeMessages,
            notes: includeNotes,
            systemLogs: includeLogs,
            agentActions: includeAgentActions,
          },
          pdfOptions: format === 'pdf' ? {
            includeBranding: includeBranding,
          } : undefined
        })
      });

      if (res.ok) {
        setShowForm(false);
        resetForm();
        await fetchJobs();
      }
    } catch (error) {
      console.error('Failed to create export:', error);
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormat('pdf');
    setDateFrom('');
    setDateTo('');
    setSelectedAgents([]);
    setSelectedCategories([]);
    setSelectedStatus([]);
    setIncludeMessages(true);
    setIncludeNotes(true);
    setIncludeLogs(false);
    setIncludeAgentActions(false);
    setIncludeBranding(true);
  };

  // Delete export job
  const handleDelete = async (jobId: string) => {
    try {
      const token = JSON.parse(localStorage.getItem('trelk-support-auth') || '{}').state?.token;

      await fetch(`/api/exports/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      await fetchJobs();
    } catch (error) {
      console.error('Failed to delete export:', error);
    }
  };

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  console.log('Export Jobs:', jobs);
  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-emerald-500/30">

      {/* Emerald Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">

        {/* Header Section */}
        <div className="px-8 py-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-emerald-900/10">
                <Archive className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Centro de Exportación</h1>
                <p className="text-sm text-zinc-400">Descarga de datos históricos y reportes</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={fetchJobs}
                disabled={loadingJobs}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-50 transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${loadingJobs ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
              </button>

              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-zinc-50 font-medium rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Download className="w-5 h-5" />
                <span>Nueva Exportación</span>
              </button>
            </div>
          </div>

          {/* Stats Bar (Glassy) */}
          <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6 overflow-x-auto">
            <StatBadge icon={HardDrive} count={stats.total} label="Total Jobs" color="text-zinc-200" bg="bg-zinc-800" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={CheckCircle} count={stats.completed} label="Completados" color="text-emerald-400" bg="bg-emerald-500/10" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Loader2} count={stats.processing} label="Procesando" color="text-blue-400" bg="bg-blue-500/10" />
            {stats.failed > 0 && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <StatBadge icon={AlertCircle} count={stats.failed} label="Fallidos" color="text-red-400" bg="bg-red-500/10" />
              </>
            )}
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={FileText} count={stats.totalRecords.toLocaleString()} label="Registros" color="text-amber-400" bg="bg-amber-500/10" />
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 custom-scrollbar">
          {loadingJobs ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
              <Download className="w-16 h-16 mb-4 stroke-1" />
              <p className="text-lg font-medium">No hay exportaciones recientes</p>
              <button onClick={() => setShowForm(true)} className="mt-4 text-sm text-emerald-400 hover:underline">
                Crear la primera
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => (
                <ExportJobCard
                  key={job._id}
                  job={job}
                  onDelete={() => handleDelete(job._id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <ExportFormModal
          format={format} setFormat={setFormat}
          dateFrom={dateFrom} setDateFrom={setDateFrom}
          dateTo={dateTo} setDateTo={setDateTo}
          selectedAgents={selectedAgents} setSelectedAgents={setSelectedAgents}
          selectedCategories={selectedCategories} setSelectedCategories={setSelectedCategories}
          selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus}
          includeMessages={includeMessages} setIncludeMessages={setIncludeMessages}
          includeNotes={includeNotes} setIncludeNotes={setIncludeNotes}
          includeLogs={includeLogs} setIncludeLogs={setIncludeLogs}
          includeAgentActions={includeAgentActions} setIncludeAgentActions={setIncludeAgentActions}
          includeBranding={includeBranding} setIncludeBranding={setIncludeBranding}
          agents={agents} categories={categories} creating={creating}
          onSubmit={handleCreateExport} onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// Sub-components

function StatBadge({ icon: Icon, count, label, color, bg }: any) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-lg ${color}`}>{count}</span>
        <span className="text-[10px] font-bold text-zinc-500">{label}</span>
      </div>
    </div>
  );
}

function ExportJobCard({ job, onDelete }: { job: ExportJob; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  const formatConfig = {
    pdf: { icon: FileText, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    json: { icon: FileJson, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    csv: { icon: FileSpreadsheet, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  }[job.format];

  const statusConfig = {
    pending: { label: 'En Cola', color: 'text-zinc-400', bg: 'bg-zinc-500/10', icon: Clock },
    processing: { label: 'Procesando', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Loader2, spin: true },
    completed: { label: 'Listo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircle },
    failed: { label: 'Fallido', color: 'text-red-400', bg: 'bg-red-500/10', icon: AlertCircle },
  }[job.status];

  const Icon = formatConfig.icon;
  const StatusIcon = statusConfig.icon;

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={`group relative bg-zinc-900/60 backdrop-blur-sm border rounded-xl transition-all duration-300 hover:shadow-lg ${expanded ? 'border-emerald-500/30' : 'border-zinc-800 hover:border-zinc-700'}`}>
      <div className="flex items-center p-4 gap-4">
        {/* Icon */}
        <div className={`p-3 rounded-xl border ${formatConfig.bg} ${formatConfig.border}`}>
          <Icon className={`w-6 h-6 ${formatConfig.color}`} />
        </div>

        {/* Main Info */}
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs font-bold uppercase px-1.5 rounded border ${formatConfig.bg} ${formatConfig.color} ${formatConfig.border}`}>
                {job.format}
              </span>
              <span className="text-zinc-500 text-xs">•</span>
              <span className="text-zinc-400 text-xs font-mono">{new Date(job.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="text-sm font-medium text-zinc-50 truncate">Exportación de datos</div>
          </div>

          {/* Stats */}
          <div className="col-span-2 flex items-center gap-6 text-sm">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase">Registros</span>
              <span className="text-zinc-200 font-mono">{job.recordCount ? job.recordCount.toLocaleString() : '-'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase">Tamaño</span>
              <span className="text-zinc-200 font-mono">{formatFileSize(job.fileSize)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase">Estado</span>
              <div className={`flex items-center gap-1.5 ${statusConfig.color}`}>
                <StatusIcon className={`w-3.5 h-3.5 ${statusConfig.spin ? 'animate-spin' : ''}`} />
                <span className="font-medium text-xs">{statusConfig.label}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="col-span-1 flex items-center justify-end gap-2">
            {job.status === 'completed' && job.downloadUrl && (
              <a
                href={job.downloadUrl}
                download
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-50 rounded-lg text-xs font-medium transition-colors shadow-lg shadow-emerald-900/20"
              >
                <Download className="w-3.5 h-3.5" /> Descargar
              </a>
            )}
            <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors">
              <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
            <button onClick={onDelete} className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-zinc-800/50 bg-zinc-950/30">
          <div className="grid grid-cols-2 gap-8 py-4">
            <div>
              <h4 className="text-xs font-bold text-zinc-500 st mb-2">Filtros Aplicados</h4>
              <div className="flex flex-wrap gap-2">
                {job.filters.dateFrom && <FilterBadge label="Desde" value={new Date(job.filters.dateFrom).toLocaleDateString()} />}
                {job.filters.dateTo && <FilterBadge label="Hasta" value={new Date(job.filters.dateTo).toLocaleDateString()} />}
                {job.filters.agentIds && <FilterBadge label="Agentes" value={`${job.filters.agentIds.length} seleccionados`} />}
                {job.filters.categories && <FilterBadge label="Categorías" value={`${job.filters.categories.length}`} />}
                {!Object.keys(job.filters).length && <span className="text-xs text-zinc-600 italic">Sin filtros (exportación completa)</span>}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-500 st mb-2">Contenido</h4>
              <div className="flex flex-wrap gap-2 text-xs text-zinc-400">
                {job.options.includeMessages && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Mensajes</span>}
                {job.options.includeNotes && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Notas</span>}
                {job.options.includeLogs && <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-500" /> Logs</span>}
              </div>
            </div>
          </div>
          {job.error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-center gap-2 mt-2">
              <AlertCircle className="w-4 h-4" /> {job.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const FilterBadge = ({ label, value }: any) => (
  <span className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300">
    <span className="text-zinc-500 mr-1">{label}:</span>{value}
  </span>
);

function ExportFormModal({
  format, setFormat, dateFrom, setDateFrom, dateTo, setDateTo, selectedAgents, setSelectedAgents,
  includeMessages, setIncludeMessages, includeNotes, setIncludeNotes, includeLogs, setIncludeLogs,
  agents, creating, onSubmit, onClose
}: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
              <Download className="w-5 h-5 text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold text-zinc-50">Nueva Exportación</h2>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-8">

          {/* 1. Format Selection */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-500 st">Formato de Archivo</label>
            <div className="grid grid-cols-3 gap-4">
              <FormatButton
                active={format === 'pdf'} onClick={() => setFormat('pdf')}
                icon={FileText} label="PDF" desc="Reporte visual" color="text-red-400" border="border-red-500/50" bg="bg-red-500/10"
              />
              <FormatButton
                active={format === 'json'} onClick={() => setFormat('json')}
                icon={FileJson} label="JSON" desc="Datos crudos" color="text-yellow-400" border="border-yellow-500/50" bg="bg-yellow-500/10"
              />
              <FormatButton
                active={format === 'csv'} onClick={() => setFormat('csv')}
                icon={FileSpreadsheet} label="CSV" desc="Para Excel" color="text-emerald-400" border="border-emerald-500/50" bg="bg-emerald-500/10"
              />
            </div>
          </div>

          {/* 2. Filters */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-500 st">Filtros de Tiempo</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Desde</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-50 focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Hasta</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-50 focus:border-emerald-500 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* 3. Agents */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-500 st">Filtrar por Agente</label>
            <select
              multiple
              value={selectedAgents}
              onChange={(e) => setSelectedAgents(Array.from(e.target.selectedOptions, o => o.value))}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-50 focus:border-emerald-500 focus:outline-none h-32"
            >
              {agents.map((a: any) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
            <p className="text-[10px] text-zinc-500">Mantén presionado Ctrl (Cmd) para seleccionar varios.</p>
          </div>

          {/* 4. Content Toggles */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-500 st">Incluir Datos</label>
            <div className="space-y-2 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800">
              <Toggle label="Mensajes de chat" checked={includeMessages} onChange={setIncludeMessages} />
              <Toggle label="Notas internas" checked={includeNotes} onChange={setIncludeNotes} />
              <Toggle label="Logs del sistema" checked={includeLogs} onChange={setIncludeLogs} />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-zinc-900/50 border-t border-zinc-800">
          <button onClick={onClose} className="px-5 py-2.5 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-xl transition-all font-medium">Cancelar</button>
          <button
            onClick={onSubmit}
            disabled={creating}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-50 font-medium rounded-xl shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            <span>Iniciar Exportación</span>
          </button>
        </div>
      </div>
    </div>
  );
}

const FormatButton = ({ active, onClick, icon: Icon, label, desc, color, border, bg }: any) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 ${active ? `${bg} ${border} shadow-lg` : 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'
      }`}
  >
    <Icon className={`w-6 h-6 mb-2 ${active ? color : 'text-zinc-500'}`} />
    <span className={`font-bold text-sm ${active ? 'text-zinc-50' : 'text-zinc-400'}`}>{label}</span>
    <span className="text-[10px] text-zinc-500">{desc}</span>
  </button>
);

const Toggle = ({ label, checked, onChange }: any) => (
  <label className="flex items-center justify-between cursor-pointer group p-1">
    <span className="text-sm text-zinc-300 group-hover:text-zinc-50 transition-colors">{label}</span>
    <div className={`w-10 h-6 rounded-full relative transition-colors ${checked ? 'bg-emerald-600' : 'bg-zinc-700'}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden" />
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${checked ? 'left-5' : 'left-1'}`} />
    </div>
  </label>
);
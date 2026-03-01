import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  HardDrive, Image, Video, FileText, Music, Search, RefreshCw, Upload, Trash2,
  Download, Eye, X, AlertTriangle, Shield, Filter,
  BarChart3, Clock, FileWarning, Zap, Archive, RotateCcw, Copy, Check,
  Play, Pause, File, Layers, Database, Settings, Globe, Bot, MessageSquare,
  Workflow, FolderOpen, Tag, Info, Maximize2, Volume2, SlidersHorizontal
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api, buildQueryString, uploadFile } from '../services/api';

// ============= TYPES =============

interface DiskUsageEntry {
  count: number;
  size: number;
  sizeFormatted: string;
}

interface StorageOverview {
  totalFiles: number;
  totalSize: number;
  totalSizeFormatted?: string;
  diskUsage: {
    images: DiskUsageEntry;
    videos: DiskUsageEntry;
    audios: DiskUsageEntry;
    documents: DiskUsageEntry;
    other: DiskUsageEntry;
  };
  bySource: Record<string, { count: number; size: number }>;
  orphanCount: number;
  recentUploads: number;
  softDeletedCount?: number;
}

interface MediaFileItem {
  _id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  extension: string;
  url: string;
  storagePath: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'voice' | 'other';
  source: 'telegram' | 'livechat' | 'webchat' | 'flow' | 'admin' | 'system';
  chatSessionId?: string;
  messageId?: string;
  flowId?: string;
  uploadedBy?: { agentId: string; agentName: string };
  status: 'active' | 'soft_deleted' | 'permanent_deleted' | 'orphan';
  isFlowAsset: boolean;
  description?: string;
  tags: string[];
  downloadCount: number;
  lastAccessedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface QuotaInfo {
  maxUploadSizeMB: number;
  maxStorageBytes: number;
  maxFileSizeBytes: number;
  allowedTypes: string[];
  retentionDays: number;
  usedStorageBytes: number;
  usedStorageFormatted: string;
  usedPercent: number;
  remainingBytes: number;
}

interface QueryResult {
  ok: boolean;
  files: MediaFileItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

type SectionId = 'overview' | 'files' | 'orphans' | 'tools' | 'quota';
type TypeFilter = '' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'voice' | 'other';
type SourceFilter = '' | 'telegram' | 'livechat' | 'webchat' | 'flow' | 'admin' | 'system';
type StatusFilter = '' | 'active' | 'soft_deleted' | 'orphan';

// ============= HELPERS =============

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/** Derive proper MIME type from extension when stored mimeType is generic */
function getProperMimeType(file: { mimeType: string; extension: string; type: string }): string | undefined {
  if (file.mimeType && file.mimeType !== 'application/octet-stream') return file.mimeType;
  const ext = (file.extension || '').toLowerCase().replace('.', '');
  const map: Record<string, string> = {
    mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg', mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac', oga: 'audio/ogg', opus: 'audio/opus', weba: 'audio/webm',
    pdf: 'application/pdf',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  };
  return map[ext] || undefined;
}

function isPdfFile(file: { mimeType: string; extension: string }): boolean {
  const ext = (file.extension || '').toLowerCase().replace('.', '');
  return ext === 'pdf' || file.mimeType === 'application/pdf';
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'image': return Image;
    case 'video': return Video;
    case 'audio': case 'voice': return Music;
    case 'document': return FileText;
    case 'sticker': return Layers;
    default: return File;
  }
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'image': return 'text-blue-400';
    case 'video': return 'text-purple-400';
    case 'audio': case 'voice': return 'text-emerald-400';
    case 'document': return 'text-amber-400';
    case 'sticker': return 'text-pink-400';
    default: return 'text-zinc-400';
  }
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'telegram': return Bot;
    case 'livechat': return MessageSquare;
    case 'webchat': return Globe;
    case 'flow': return Workflow;
    case 'admin': return Shield;
    default: return Settings;
  }
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'telegram': return 'text-sky-400';
    case 'livechat': return 'text-blue-400';
    case 'webchat': return 'text-emerald-400';
    case 'flow': return 'text-purple-400';
    case 'admin': return 'text-amber-400';
    default: return 'text-zinc-400';
  }
}

const SOURCE_LABELS: Record<string, string> = {
  telegram: 'Telegram', livechat: 'LiveChat', webchat: 'WebChat',
  flow: 'Flow', admin: 'Admin', system: 'Sistema',
};

const TYPE_LABELS: Record<string, string> = {
  image: 'Imágenes', video: 'Videos', audio: 'Audio',
  document: 'Documentos', sticker: 'Stickers', voice: 'Notas de voz', other: 'Otros',
};

// ============= CONFIRMATION MODAL =============

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  severity: 'warning' | 'danger' | 'critical';
  confirmPhrase?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

function ConfirmModal({ isOpen, title, message, severity, confirmPhrase, onConfirm, onCancel, loading }: ConfirmModalProps) {
  const [phrase, setPhrase] = useState('');

  useEffect(() => { if (!isOpen) setPhrase(''); }, [isOpen]);
  if (!isOpen) return null;

  const canConfirm = !confirmPhrase || phrase === confirmPhrase;
  const theme = {
    critical: { bg: 'bg-red-950', border: 'border-red-900', icon: 'text-red-500', btn: 'bg-red-600 hover:bg-red-500' },
    danger: { bg: 'bg-zinc-900', border: 'border-red-500/50', icon: 'text-red-400', btn: 'bg-red-600 hover:bg-red-500' },
    warning: { bg: 'bg-zinc-900', border: 'border-amber-500/50', icon: 'text-amber-400', btn: 'bg-amber-600 hover:bg-amber-500' },
  }[severity];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className={`w-full max-w-md border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${theme.bg} ${theme.border}`}>
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-full bg-black/40 border border-white/5 ${theme.icon}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-zinc-50">{title}</h3>
          </div>
          <p className="text-zinc-300 mb-6 leading-relaxed">{message}</p>
          {severity === 'critical' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
              <p className="text-red-400 text-sm font-medium flex items-center gap-2">
                <Shield className="w-4 h-4" /> ACCIÓN DESTRUCTIVA IRREVERSIBLE
              </p>
            </div>
          )}
          {confirmPhrase && (
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                Escribe <span className="text-red-400 font-mono select-all">{confirmPhrase}</span>
              </label>
              <input
                type="text" value={phrase} onChange={(e) => setPhrase(e.target.value)}
                className="w-full px-4 py-2.5 bg-black/40 border border-zinc-700 rounded-xl text-zinc-50 focus:border-red-500 focus:outline-none transition-all placeholder-zinc-600"
                placeholder="Confirmar frase..." autoComplete="off"
              />
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-zinc-400 hover:text-zinc-50 font-medium transition-colors">Cancelar</button>
          <button onClick={onConfirm} disabled={!canConfirm || loading} className={`px-6 py-2 rounded-xl text-zinc-50 font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${theme.btn}`}>
            {loading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Check className="w-4 h-4" />} Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= PREVIEW MODAL =============

function PreviewModal({ file, onClose }: { file: MediaFileItem | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!file) return null;

  const copyUrl = () => {
    navigator.clipboard.writeText(`${window.location.origin}${file.url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadFile = () => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.originalName;
    a.click();
  };

  const isImage = file.type === 'image' || file.type === 'sticker';
  const isVideo = file.type === 'video';
  const isAudio = file.type === 'audio' || file.type === 'voice';
  const isPdf = isPdfFile(file);
  const resolvedMime = getProperMimeType(file);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3 min-w-0">
            {(() => { const Icon = getTypeIcon(file.type); return <Icon className={`w-5 h-5 flex-shrink-0 ${getTypeColor(file.type)}`} />; })()}
            <div className="min-w-0">
              <h3 className="text-zinc-50 font-bold truncate">{file.originalName}</h3>
              <p className="text-xs text-zinc-500">{formatBytes(file.size)} · {file.mimeType} · {formatDate(file.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyUrl} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors" title="Copiar URL">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button onClick={downloadFile} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors" title="Descargar">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row">
          {/* Preview Area */}
          <div className="flex-1 flex items-center justify-center bg-black/40 min-h-[300px] max-h-[60vh] p-4 overflow-auto">
            {isImage && <img src={file.url} alt={file.originalName} className="max-w-full max-h-full object-contain rounded-lg" />}
            {isVideo && (
              <video controls className="max-w-full max-h-full rounded-lg" preload="metadata">
                <source src={file.url} {...(resolvedMime ? { type: resolvedMime } : {})} />
              </video>
            )}
            {isAudio && (
              <div className="flex flex-col items-center gap-6 p-8">
                <div className="w-32 h-32 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center">
                  <Volume2 className="w-16 h-16 text-emerald-400" />
                </div>
                <audio controls className="w-full max-w-md" preload="metadata">
                  <source src={file.url} {...(resolvedMime ? { type: resolvedMime } : {})} />
                </audio>
              </div>
            )}
            {isPdf && !isImage && !isVideo && !isAudio && (
              <iframe
                src={file.url}
                title={file.originalName}
                className="w-full h-[55vh] rounded-lg border border-zinc-700 bg-white"
              />
            )}
            {!isImage && !isVideo && !isAudio && !isPdf && (
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <div className="w-24 h-24 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <FileText className="w-12 h-12 text-zinc-500" />
                </div>
                <p className="text-zinc-400">Vista previa no disponible</p>
                <button onClick={downloadFile} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-zinc-50 rounded-xl font-medium text-sm transition-colors flex items-center gap-2">
                  <Download className="w-4 h-4" /> Descargar archivo
                </button>
              </div>
            )}
          </div>

          {/* Metadata Sidebar */}
          <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-zinc-800 p-5 space-y-4 overflow-y-auto max-h-[60vh]">
            <h4 className="text-xs font-bold text-zinc-500 uppercase ">Detalles</h4>
            <div className="space-y-3">
              <MetaRow label="Tipo" value={TYPE_LABELS[file.type] || file.type} />
              <MetaRow label="Fuente" value={SOURCE_LABELS[file.source] || file.source} />
              <MetaRow label="Estado" value={file.status === 'active' ? '● Activo' : file.status === 'soft_deleted' ? '● Eliminado' : file.status === 'orphan' ? '● Huérfano' : file.status} />
              <MetaRow label="Extensión" value={file.extension || '—'} />
              <MetaRow label="Descargas" value={String(file.downloadCount)} />
              {file.uploadedBy && <MetaRow label="Subido por" value={file.uploadedBy.agentName} />}
              {file.chatSessionId && <MetaRow label="Sesión" value={file.chatSessionId.slice(-8)} />}
              {file.isFlowAsset && <MetaRow label="Asset Flow" value="✓ Sí" />}
              {file.tags.length > 0 && <MetaRow label="Tags" value={file.tags.join(', ')} />}
              {file.description && <MetaRow label="Descripción" value={file.description} />}
              <MetaRow label="Ruta" value={file.storagePath} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] font-bold text-zinc-600 uppercase block">{label}</span>
      <span className="text-sm text-zinc-300 break-all">{value}</span>
    </div>
  );
}

// ============= UPLOAD MODAL =============

function UploadModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [isFlowAsset, setIsFlowAsset] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setFile(null); setDescription(''); setTags(''); setIsFlowAsset(false); setDragOver(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const additionalData: Record<string, string> = {};
      if (description) additionalData.description = description;
      if (tags) additionalData.tags = tags;
      if (isFlowAsset) additionalData.isFlowAsset = 'true';

      const res = await uploadFile('/api/media-admin/upload', file, 'file', additionalData);
      if (res.ok) {
        onSuccess();
        onClose();
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h3 className="text-lg font-bold text-zinc-50 flex items-center gap-2"><Upload className="w-5 h-5 text-blue-400" /> Subir Archivo</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragOver ? 'border-blue-500 bg-blue-500/5' : file ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-700 hover:border-zinc-600 bg-zinc-950/50'
            }`}
          >
            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
            {file ? (
              <div className="flex items-center gap-4 justify-center">
                {(() => { const Icon = getTypeIcon(file.type.split('/')[0] === 'image' ? 'image' : file.type.split('/')[0] === 'video' ? 'video' : 'document'); return <Icon className="w-8 h-8 text-emerald-400" />; })()}
                <div className="text-left">
                  <p className="text-zinc-50 font-medium truncate max-w-[250px]">{file.name}</p>
                  <p className="text-xs text-zinc-500">{formatBytes(file.size)}</p>
                </div>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400 font-medium">Arrastra un archivo o haz clic para seleccionar</p>
                <p className="text-xs text-zinc-600 mt-1">Imágenes, videos, audio, documentos</p>
              </>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Descripción</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-50 placeholder-zinc-600 focus:border-blue-500 focus:outline-none transition-all"
              placeholder="Descripción opcional..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5">Tags <span className="text-zinc-600 normal-case">(separados por coma)</span></label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-50 placeholder-zinc-600 focus:border-blue-500 focus:outline-none transition-all"
              placeholder="logo, banner, campania..."
            />
          </div>

          {/* Flow Asset toggle */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-10 h-5 rounded-full transition-colors relative ${isFlowAsset ? 'bg-purple-600' : 'bg-zinc-700'}`}
              onClick={() => setIsFlowAsset(!isFlowAsset)}>
              <div className={`absolute w-4 h-4 rounded-full bg-white top-0.5 transition-transform ${isFlowAsset ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <span className="text-sm text-zinc-300 font-medium group-hover:text-zinc-50 transition-colors">Asset de Flow</span>
              <span className="text-[10px] text-zinc-600 block">Marcar como recurso reutilizable en flujos</span>
            </div>
          </label>
        </div>

        <div className="px-6 py-4 bg-black/20 border-t border-white/5 flex justify-end gap-3">
          <button onClick={onClose} disabled={uploading} className="px-4 py-2 text-zinc-400 hover:text-zinc-50 font-medium transition-colors">Cancelar</button>
          <button onClick={handleUpload} disabled={!file || uploading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-zinc-50 font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {uploading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Subiendo...' : 'Subir'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= STAT CARD =============

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors">
      <div className={`p-3 rounded-xl bg-zinc-950 border border-zinc-800 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-zinc-50 tracking-tight">{value}</p>
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        {sub && <p className="text-[10px] text-zinc-600">{sub}</p>}
      </div>
    </div>
  );
}

// ============= SIDEBAR SECTIONS =============

const SECTIONS: { id: SectionId; label: string; icon: any; color: string }[] = [
  { id: 'overview', label: 'Storage Overview', icon: BarChart3, color: 'text-blue-500' },
  { id: 'files', label: 'Explorador', icon: FolderOpen, color: 'text-emerald-500' },
  { id: 'orphans', label: 'Huérfanos', icon: FileWarning, color: 'text-amber-500' },
  { id: 'tools', label: 'Herramientas', icon: SlidersHorizontal, color: 'text-purple-500' },
  { id: 'quota', label: 'Cuota & Límites', icon: HardDrive, color: 'text-cyan-500' },
];

// ============= MAIN COMPONENT =============

export default function MediaPage() {
  const { agent } = useAuthStore();

  // Navigation
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

  // Overview
  const [overview, setOverview] = useState<StorageOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // Files
  const [files, setFiles] = useState<MediaFileItem[]>([]);
  const [filesTotal, setFilesTotal] = useState(0);
  const [filesPage, setFilesPage] = useState(1);
  const [filesPages, setFilesPages] = useState(1);
  const [filesLoading, setFilesLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [flowAssetsOnly, setFlowAssetsOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Orphans
  const [orphanFiles, setOrphanFiles] = useState<MediaFileItem[]>([]);
  const [orphanTotal, setOrphanTotal] = useState(0);
  const [orphanLoading, setOrphanLoading] = useState(false);

  // Quota
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  // Modals
  const [previewFile, setPreviewFile] = useState<MediaFileItem | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasMore = filesPage < filesPages;

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Access guard
  if (!agent || !['admin', 'supervisor'].includes(agent.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-zinc-950 text-zinc-500 gap-4">
        <Shield className="w-12 h-12" />
        <p className="text-lg font-bold">Acceso Restringido</p>
        <p className="text-sm">Solo administradores y supervisores pueden acceder</p>
      </div>
    );
  }

  // ============= API CALLS =============

  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await api.get<{ ok: boolean; data: StorageOverview }>('/api/media-admin/overview');
      if (res.ok && res.data?.data) setOverview(res.data.data);
    } catch (e) { console.error('Error loading overview:', e); }
    finally { setOverviewLoading(false); }
  };

  const loadFiles = async (page = 1, append = false) => {
    if (filesLoading) return;
    setFilesLoading(true);
    try {
      const qs = buildQueryString({
        search: search || undefined,
        type: typeFilter || undefined,
        source: sourceFilter || undefined,
        status: statusFilter || undefined,
        isFlowAsset: flowAssetsOnly ? 'true' : undefined,
        page,
        limit: 30,
      });
      const res = await api.get<QueryResult>(`/api/media-admin/files${qs}`);
      if (res.ok && res.data) {
        if (append && page > 1) {
          setFiles(prev => [...prev, ...(res.data.files || [])]);
        } else {
          setFiles(res.data.files || []);
        }
        setFilesTotal(res.data.total || 0);
        setFilesPage(res.data.page || 1);
        setFilesPages(res.data.pages || 1);
      }
    } catch (e) { console.error('Error loading files:', e); }
    finally { setFilesLoading(false); }
  };

  const loadNextPage = useCallback(() => {
    if (!filesLoading && filesPage < filesPages) {
      loadFiles(filesPage + 1, true);
    }
  }, [filesPage, filesPages, filesLoading, search, typeFilter, sourceFilter, statusFilter, flowAssetsOnly]);

  const loadOrphans = async () => {
    setOrphanLoading(true);
    try {
      const qs = buildQueryString({ isOrphan: 'true', status: 'orphan', limit: 50 });
      const res = await api.get<QueryResult>(`/api/media-admin/files${qs}`);
      if (res.ok && res.data) {
        setOrphanFiles(res.data.files || []);
        setOrphanTotal(res.data.total || 0);
      }
    } catch (e) { console.error('Error loading orphans:', e); }
    finally { setOrphanLoading(false); }
  };

  const loadQuota = async () => {
    try {
      const res = await api.get<{ ok: boolean; data: QuotaInfo }>('/api/media-admin/quota');
      if (res.ok && res.data?.data) setQuota(res.data.data);
    } catch (e) { console.error('Error loading quota:', e); }
  };

  // Actions
  const softDelete = async (id: string, name: string) => {
    setConfirmModal({
      isOpen: true, title: 'Eliminar archivo', severity: 'danger' as const,
      message: `¿Eliminar "${name}"? Se puede restaurar después.`,
      onConfirm: async () => {
        setModalLoading(true);
        try {
          const res = await api.delete<any>(`/api/media-admin/files/${id}`, {  });
          if (res.ok) { showToast('Archivo eliminado', 'success'); loadFiles(filesPage); if (activeSection === 'overview') loadOverview(); }
          else showToast('Error al eliminar', 'error');
        } catch { showToast('Error de conexión', 'error'); }
        finally { setModalLoading(false); setConfirmModal(null); }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const permanentDelete = async (id: string, name: string) => {
    setConfirmModal({
      isOpen: true, title: 'Eliminación PERMANENTE', severity: 'critical' as const,
      message: `¿Eliminar permanentemente "${name}"? El archivo será borrado del disco. Esta acción NO se puede deshacer.`,
      confirmPhrase: 'ELIMINAR',
      onConfirm: async () => {
        setModalLoading(true);
        try {
          const res = await api.delete<any>(`/api/media-admin/files/${id}/permanent`, {  });
          if (res.ok) { showToast('Archivo eliminado permanentemente', 'success'); loadFiles(filesPage); loadOverview(); }
          else showToast(res.data?.error || 'Error', 'error');
        } catch { showToast('Error de conexión', 'error'); }
        finally { setModalLoading(false); setConfirmModal(null); }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const restoreFile = async (id: string) => {
    try {
      const res = await api.post<any>(`/api/media-admin/files/${id}/restore`,{  });
      if (res.ok) { showToast('Archivo restaurado', 'success'); loadFiles(filesPage); }
      else showToast('Error al restaurar', 'error');
    } catch { showToast('Error de conexión', 'error'); }
  };

  const detectOrphans = async () => {
    setOrphanLoading(true);
    try {
      const res = await api.post<{ ok: boolean; orphanCount: number }>('/api/media-admin/orphans/detect', {  });
      if (res.ok) {
        showToast(`Se detectaron ${res.data.orphanCount} archivos huérfanos`, 'success');
        loadOrphans();
      }
    } catch { showToast('Error en detección', 'error'); }
    finally { setOrphanLoading(false); }
  };

  const purgeAction = async (type: 'old' | 'orphans' | 'all', daysOld?: number) => {
    const messages: Record<string, string> = {
      old: `Se eliminarán permanentemente todos los archivos eliminados hace más de ${daysOld || 30} días.`,
      orphans: 'Se eliminarán permanentemente todos los archivos huérfanos detectados.',
      all: 'Se eliminarán TODOS los archivos del sistema. Esta acción es IRREVERSIBLE.',
    };

    setConfirmModal({
      isOpen: true,
      title: type === 'all' ? '⚠️ PURGA TOTAL' : `Purgar ${type === 'old' ? 'antiguos' : 'huérfanos'}`,
      severity: type === 'all' ? 'critical' as const : 'danger' as const,
      message: messages[type],
      confirmPhrase: type === 'all' ? 'DELETE ALL FILES' : undefined,
      onConfirm: async () => {
        setModalLoading(true);
        try {
          const body: any = { type };
          if (type === 'old' && daysOld) body.daysOld = daysOld;
          if (type === 'all') body.confirmPhrase = 'DELETE ALL FILES';

          const res = await api.post<{ ok: boolean; purgedCount: number; message: string }>('/api/media-admin/purge', body);
          if (res.ok) {
            showToast(res.data.message || `${res.data.purgedCount} archivos purgados`, 'success');
            loadOverview(); loadOrphans();
          } else showToast(res.data?.message || 'Error en purga', 'error');
        } catch { showToast('Error de conexión', 'error'); }
        finally { setModalLoading(false); setConfirmModal(null); }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  const syncMedia = async () => {
    setConfirmModal({
      isOpen: true, title: 'Sincronizar Media', severity: 'warning' as const,
      message: 'Se escanearán los mensajes existentes y el disco para indexar todos los archivos en la base de datos. Esto puede tardar unos minutos.',
      onConfirm: async () => {
        setModalLoading(true);
        try {
          const res = await api.post<{ ok: boolean; tracked: number; errors: number }>('/api/media-admin/sync', {});
          if (res.ok) {
            showToast(`Sincronización completa: ${res.data.tracked} archivos indexados, ${res.data.errors} errores`, 'success');
            loadOverview();
          } else showToast('Error en sincronización', 'error');
        } catch { showToast('Error de conexión', 'error'); }
        finally { setModalLoading(false); setConfirmModal(null); }
      },
      onCancel: () => setConfirmModal(null),
    });
  };

  // ============= EFFECTS =============

  useEffect(() => {
    switch (activeSection) {
      case 'overview': loadOverview(); break;
      case 'files': loadFiles(1); break;
      case 'orphans': loadOrphans(); break;
      case 'quota': loadQuota(); break;
    }
  }, [activeSection]);

  // Reload files on filter change
  useEffect(() => {
    if (activeSection === 'files') loadFiles(1);
  }, [typeFilter, sourceFilter, statusFilter, flowAssetsOnly]);

  // Debounced search
  useEffect(() => {
    if (activeSection !== 'files') return;
    const timer = setTimeout(() => loadFiles(1), 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Infinite scroll observer
  useEffect(() => {
    if (activeSection !== 'files') return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadNextPage();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeSection, loadNextPage]);

  // ============= SECTION RENDERERS =============

  const renderOverview = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-50 flex items-center gap-3"><BarChart3 className="text-blue-500 w-8 h-8" /> Storage Overview</h2>
          <p className="text-zinc-400 mt-1">Resumen completo del almacenamiento multimedia</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-zinc-50 font-medium text-sm transition-all shadow-lg shadow-blue-900/20">
            <Upload className="w-4 h-4" /> Subir
          </button>
          <button onClick={loadOverview} disabled={overviewLoading} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors">
            <RefreshCw className={`w-5 h-5 ${overviewLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {overview ? (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Archivos" value={overview.totalFiles.toLocaleString()} icon={Database} color="text-blue-400" />
            <StatCard label="Almacenamiento" value={formatBytes(overview.totalSize)} icon={HardDrive} color="text-emerald-400" />
            <StatCard label="Huérfanos" value={overview.orphanCount} icon={FileWarning} color="text-amber-400" />
            <StatCard label="Subidos (24h)" value={overview.recentUploads} icon={Clock} color="text-cyan-400" />
          </div>

          {/* By Type */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-500 uppercase mb-5">Por Tipo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {([
                { key: 'images', type: 'image' as TypeFilter, label: 'Imágenes' },
                { key: 'videos', type: 'video' as TypeFilter, label: 'Videos' },
                { key: 'audios', type: 'audio' as TypeFilter, label: 'Audio' },
                { key: 'documents', type: 'document' as TypeFilter, label: 'Documentos' },
                { key: 'other', type: 'other' as TypeFilter, label: 'Otros' },
              ] as const).map(({ key, type, label }) => {
                const entry = overview.diskUsage[key];
                if (!entry || entry.count === 0) return null;
                const Icon = getTypeIcon(type);
                return (
                  <div key={key} className="flex items-center gap-3 bg-zinc-950/50 border border-zinc-800/50 rounded-xl px-4 py-3 hover:border-zinc-700 transition-colors cursor-pointer"
                    onClick={() => { setTypeFilter(type); setActiveSection('files'); }}>
                    <Icon className={`w-5 h-5 ${getTypeColor(type)}`} />
                    <div>
                      <p className="text-zinc-50 font-bold text-sm">{entry.count}</p>
                      <p className="text-[10px] text-zinc-500">{label} · {formatBytes(entry.size)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By Source */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h3 className="text-sm font-bold text-zinc-500 uppercase mb-5">Por Fuente</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(overview.bySource || {}).map(([source, data]) => {
                const Icon = getSourceIcon(source);
                return (
                  <div key={source} className="flex items-center gap-3 bg-zinc-950/50 border border-zinc-800/50 rounded-xl px-4 py-3 hover:border-zinc-700 transition-colors cursor-pointer"
                    onClick={() => { setSourceFilter(source as SourceFilter); setActiveSection('files'); }}>
                    <Icon className={`w-5 h-5 ${getSourceColor(source)}`} />
                    <div>
                      <p className="text-zinc-50 font-bold text-sm">{data.count}</p>
                      <p className="text-[10px] text-zinc-500">{SOURCE_LABELS[source] || source} · {formatBytes(data.size)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deleted Files */}
          {((overview.softDeletedCount || 0) > 0) && (
            <div className="bg-zinc-900 border border-amber-500/20 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trash2 className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-zinc-50 font-bold">{overview.softDeletedCount || 0} archivos en papelera</p>
                    <p className="text-xs text-zinc-500">Archivos eliminados que pueden ser restaurados</p>
                  </div>
                </div>
                <button onClick={() => { setStatusFilter('soft_deleted'); setActiveSection('files'); }}
                  className="px-4 py-2 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-xl text-sm font-medium transition-colors">
                  Ver papelera
                </button>
              </div>
            </div>
          )}
        </>
      ) : overviewLoading ? (
        <div className="flex items-center justify-center h-64 text-zinc-500">
          <RefreshCw className="animate-spin w-8 h-8" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-zinc-500 gap-3">
          <Database className="w-10 h-10" />
          <p>No hay datos de almacenamiento</p>
          <button onClick={syncMedia} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-zinc-50 text-sm font-medium transition-colors">
            Sincronizar ahora
          </button>
        </div>
      )}
    </div>
  );

  const renderFilesSection = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-50 flex items-center gap-3"><FolderOpen className="text-emerald-500 w-8 h-8" /> Explorador de Archivos</h2>
          <p className="text-zinc-400 mt-1">{filesTotal.toLocaleString()} archivos encontrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setUploadOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-zinc-50 font-medium text-sm transition-all shadow-lg shadow-blue-900/20">
            <Upload className="w-4 h-4" /> Subir
          </button>
          <button onClick={() => loadFiles(1)} disabled={filesLoading} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors">
            <RefreshCw className={`w-5 h-5 ${filesLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-50 placeholder-zinc-600 focus:border-blue-500 focus:outline-none transition-all"
              placeholder="Buscar por nombre, tipo, extensión..."
            />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-medium text-sm transition-all ${
              showFilters || typeFilter || sourceFilter || statusFilter || flowAssetsOnly
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
            }`}>
            <Filter className="w-4 h-4" /> Filtros
            {(typeFilter || sourceFilter || statusFilter || flowAssetsOnly) && (
              <span className="w-2 h-2 rounded-full bg-blue-500" />
            )}
          </button>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-zinc-800 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Tipo</label>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-50 focus:border-blue-500 focus:outline-none">
                <option value="">Todos</option>
                <option value="image">Imágenes</option>
                <option value="video">Videos</option>
                <option value="audio">Audio</option>
                <option value="document">Documentos</option>
                <option value="sticker">Stickers</option>
                <option value="voice">Notas de voz</option>
                <option value="other">Otros</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Fuente</label>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-50 focus:border-blue-500 focus:outline-none">
                <option value="">Todas</option>
                <option value="telegram">Telegram</option>
                <option value="livechat">LiveChat</option>
                <option value="webchat">WebChat</option>
                <option value="flow">Flow</option>
                <option value="admin">Admin</option>
                <option value="system">Sistema</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 uppercase mb-1">Estado</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-50 focus:border-blue-500 focus:outline-none">
                <option value="">Todos</option>
                <option value="active">Activos</option>
                <option value="soft_deleted">Eliminados</option>
                <option value="orphan">Huérfanos</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer py-2">
                <input type="checkbox" checked={flowAssetsOnly} onChange={(e) => setFlowAssetsOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-purple-600 focus:ring-purple-500" />
                <span className="text-sm text-zinc-400">Solo Assets Flow</span>
              </label>
            </div>
            {(typeFilter || sourceFilter || statusFilter || flowAssetsOnly) && (
              <button onClick={() => { setTypeFilter(''); setSourceFilter(''); setStatusFilter(''); setFlowAssetsOnly(false); }}
                className="col-span-full text-xs text-zinc-500 hover:text-zinc-50 transition-colors flex items-center gap-1">
                <X className="w-3 h-3" /> Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* File Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {filesLoading ? (
          <div className="flex items-center justify-center h-48 text-zinc-500">
            <RefreshCw className="animate-spin w-6 h-6" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
            <FolderOpen className="w-10 h-10" />
            <p>No se encontraron archivos</p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_100px_100px_100px_100px_120px] gap-4 px-5 py-3 border-b border-zinc-800 text-[10px] font-bold text-zinc-600 uppercase ">
              <span>Archivo</span>
              <span>Tipo</span>
              <span>Fuente</span>
              <span>Tamaño</span>
              <span>Estado</span>
              <span className="text-right">Acciones</span>
            </div>

            {/* Rows */}
            {files.map((f) => {
              const TypeIcon = getTypeIcon(f.type);
              const SourceIcon = getSourceIcon(f.source);
              return (
                <div key={f._id} className="grid grid-cols-[1fr_100px_100px_100px_100px_120px] gap-4 px-5 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors items-center group">
                  {/* Filename */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Thumbnail or Icon */}
                    {f.type === 'image' || f.type === 'sticker' ? (
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-800 border border-zinc-700 flex-shrink-0">
                        <img src={f.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ) : (
                      <div className={`w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0 ${getTypeColor(f.type)}`}>
                        <TypeIcon className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-50 truncate font-medium">{f.originalName}</p>
                      <p className="text-[10px] text-zinc-600 truncate">{formatDate(f.createdAt)}</p>
                    </div>
                  </div>

                  {/* Type */}
                  <div className="flex items-center gap-1.5">
                    <TypeIcon className={`w-3.5 h-3.5 ${getTypeColor(f.type)}`} />
                    <span className="text-xs text-zinc-400">{TYPE_LABELS[f.type]?.slice(0, 6) || f.type}</span>
                  </div>

                  {/* Source */}
                  <div className="flex items-center gap-1.5">
                    <SourceIcon className={`w-3.5 h-3.5 ${getSourceColor(f.source)}`} />
                    <span className="text-xs text-zinc-400">{SOURCE_LABELS[f.source]?.slice(0, 8) || f.source}</span>
                  </div>

                  {/* Size */}
                  <span className="text-xs text-zinc-400 font-mono">{formatBytes(f.size)}</span>

                  {/* Status */}
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 w-fit ${
                    f.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                    f.status === 'soft_deleted' ? 'bg-red-500/10 text-red-400' :
                    f.status === 'orphan' ? 'bg-amber-500/10 text-amber-400' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {f.status === 'active' ? 'Activo' : f.status === 'soft_deleted' ? 'Eliminado' : f.status === 'orphan' ? 'Huérfano' : f.status}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setPreviewFile(f)} className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors" title="Preview">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <a href={f.url} download={f.originalName} className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors" title="Descargar">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    {f.status === 'soft_deleted' ? (
                      <button onClick={() => restoreFile(f._id)} className="p-1.5 hover:bg-emerald-500/20 rounded-lg text-emerald-400 transition-colors" title="Restaurar">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button onClick={() => softDelete(f._id, f.originalName)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-zinc-400 hover:text-red-400 transition-colors" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {agent.role === 'admin' && (
                      <button onClick={() => permanentDelete(f._id, f.originalName)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-zinc-500 hover:text-red-500 transition-colors" title="Eliminar permanente">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Infinite Scroll Sentinel */}
            <div ref={sentinelRef} className="px-5 py-4 border-t border-zinc-800">
              {filesLoading && files.length > 0 ? (
                <div className="flex items-center justify-center gap-2 text-zinc-500">
                  <RefreshCw className="animate-spin w-4 h-4" />
                  <span className="text-xs">Cargando más archivos...</span>
                </div>
              ) : hasMore ? (
                <p className="text-xs text-zinc-600 text-center">
                  {files.length} de {filesTotal.toLocaleString()} archivos · scroll para cargar más
                </p>
              ) : files.length > 0 ? (
                <p className="text-xs text-zinc-600 text-center">
                  {filesTotal.toLocaleString()} archivos · fin del listado
                </p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderOrphansSection = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-50 flex items-center gap-3"><FileWarning className="text-amber-500 w-8 h-8" /> Archivos Huérfanos</h2>
          <p className="text-zinc-400 mt-1">Archivos sin mensajes asociados o no rastreados en disco</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={detectOrphans} disabled={orphanLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl font-medium text-sm transition-all">
            {orphanLoading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />} Detectar Huérfanos
          </button>
          {orphanTotal > 0 && agent.role === 'admin' && (
            <button onClick={() => purgeAction('orphans')}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl font-medium text-sm transition-all">
              <Trash2 className="w-4 h-4" /> Purgar Todos
            </button>
          )}
        </div>
      </div>

      {orphanTotal > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-amber-300 font-bold">{orphanTotal} archivos huérfanos detectados</p>
              <p className="text-xs text-zinc-500 mt-1">Estos archivos ocupan espacio en disco pero no están asociados a ningún mensaje o flujo activo.</p>
            </div>
          </div>
        </div>
      )}

      {orphanLoading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500">
          <RefreshCw className="animate-spin w-6 h-6" />
        </div>
      ) : orphanFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-500 gap-3">
          <Check className="w-10 h-10 text-emerald-500" />
          <p className="text-emerald-400 font-medium">Sin archivos huérfanos</p>
          <p className="text-xs text-zinc-600">Ejecuta una detección para escanear el sistema</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {orphanFiles.map((f) => {
            const TypeIcon = getTypeIcon(f.type);
            return (
              <div key={f._id} className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center ${getTypeColor(f.type)}`}>
                    <TypeIcon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-50 truncate font-medium">{f.originalName}</p>
                    <p className="text-[10px] text-zinc-600">{formatBytes(f.size)} · {f.storagePath}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPreviewFile(f)} className="p-1.5 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  {agent.role === 'admin' && (
                    <button onClick={() => permanentDelete(f._id, f.originalName)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderToolsSection = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold text-zinc-50 flex items-center gap-3"><SlidersHorizontal className="text-purple-500 w-8 h-8" /> Herramientas de Media</h2>
        <p className="text-zinc-400 mt-1">Operaciones de mantenimiento y gestión masiva</p>
      </div>

      {/* Sync Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <Zap className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-zinc-50">Sincronizar Media</h3>
            <p className="text-sm text-zinc-400 mt-1 mb-4">
              Escanea todos los mensajes y el directorio de uploads para indexar archivos existentes en la base de datos MediaFile.
              Útil para la primera vez o si se perdió el tracking.
            </p>
            <button onClick={syncMedia} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 rounded-xl font-medium text-sm transition-all">
              <Zap className="w-4 h-4" /> Ejecutar Sincronización
            </button>
          </div>
        </div>
      </div>

      {/* Orphan Detection Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <FileWarning className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-zinc-50">Detectar Huérfanos</h3>
            <p className="text-sm text-zinc-400 mt-1 mb-4">
              Encuentra archivos en disco que no están asociados a ningún mensaje, o registros en BD cuyos archivos físicos no existen.
            </p>
            <button onClick={detectOrphans} disabled={orphanLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 rounded-xl font-medium text-sm transition-all">
              {orphanLoading ? <RefreshCw className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />} Escanear Huérfanos
            </button>
          </div>
        </div>
      </div>

      {/* Purge Section */}
      <div className="bg-zinc-900 border border-red-500/10 rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-50">Purgar Archivos</h3>
            <p className="text-sm text-zinc-400 mt-1">Eliminación masiva de archivos — solo Admin</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-5">
            <h4 className="text-zinc-50 font-bold text-sm mb-2">Purgar Antiguos</h4>
            <p className="text-xs text-zinc-500 mb-4">Elimina archivos soft-deleted con más de 30 días</p>
            <button onClick={() => purgeAction('old', 30)} disabled={agent.role !== 'admin'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <Archive className="w-4 h-4" /> Purgar +30 días
            </button>
          </div>

          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-xl p-5">
            <h4 className="text-zinc-50 font-bold text-sm mb-2">Purgar Huérfanos</h4>
            <p className="text-xs text-zinc-500 mb-4">Elimina permanentemente todos los archivos huérfanos</p>
            <button onClick={() => purgeAction('orphans')} disabled={agent.role !== 'admin'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <FileWarning className="w-4 h-4" /> Purgar Huérfanos
            </button>
          </div>

          <div className="bg-red-950/30 border border-red-500/20 rounded-xl p-5">
            <h4 className="text-red-400 font-bold text-sm mb-2">⚠️ PURGA TOTAL</h4>
            <p className="text-xs text-zinc-500 mb-4">Elimina TODOS los archivos. Acción irreversible.</p>
            <button onClick={() => purgeAction('all')} disabled={agent.role !== 'admin'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-zinc-50 border border-red-700 hover:bg-red-700 rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed">
              <AlertTriangle className="w-4 h-4" /> Purga Total
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderQuotaSection = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-50 flex items-center gap-3"><HardDrive className="text-cyan-500 w-8 h-8" /> Cuota & Límites</h2>
          <p className="text-zinc-400 mt-1">Gestión de espacio y configuración de límites</p>
        </div>
        <button onClick={loadQuota} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-50 transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {quota ? (
        <>
          {/* Progress Bar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-zinc-50 font-bold">Uso de Almacenamiento</h3>
              <span className={`text-sm font-bold ${
                quota.usedPercent > 90 ? 'text-red-400' : quota.usedPercent > 70 ? 'text-amber-400' : 'text-emerald-400'
              }`}>{quota.usedPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  quota.usedPercent > 90 ? 'bg-red-500' : quota.usedPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(quota.usedPercent, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-zinc-500">
              <span>{formatBytes(quota.usedStorageBytes)} usado</span>
              <span>{formatBytes(quota.remainingBytes)} libre</span>
              <span>{formatBytes(quota.maxStorageBytes)} total</span>
            </div>
          </div>

          {/* Quota Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Almacenamiento Máximo" value={formatBytes(quota.maxStorageBytes)} icon={HardDrive} color="text-cyan-400" />
            <StatCard label="Tamaño Max por Archivo" value={formatBytes(quota.maxFileSizeBytes)} icon={File} color="text-purple-400" />
            <StatCard label="Espacio Restante" value={formatBytes(quota.remainingBytes)} icon={Database} color={quota.usedPercent > 90 ? 'text-red-400' : 'text-emerald-400'} />
          </div>

          {/* Warnings */}
          {quota.usedPercent > 80 && (
            <div className={`border rounded-2xl p-5 ${
              quota.usedPercent > 90 ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 ${quota.usedPercent > 90 ? 'text-red-400' : 'text-amber-400'}`} />
                <div>
                  <p className={`font-bold ${quota.usedPercent > 90 ? 'text-red-400' : 'text-amber-400'}`}>
                    {quota.usedPercent > 90 ? '¡Almacenamiento crítico!' : 'Almacenamiento alto'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {quota.usedPercent > 90
                      ? 'Queda menos del 10% de espacio. Considera purgar archivos antiguos o huérfanos.'
                      : 'El uso de almacenamiento supera el 80%. Monitorea el crecimiento.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-48 text-zinc-500">
          <RefreshCw className="animate-spin w-6 h-6" />
        </div>
      )}
    </div>
  );

  // ============= MAIN LAYOUT =============

  return (
    <div className="flex h-full bg-zinc-950">
      {/* Sidebar */}
      <div className="w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="px-6 py-6 border-b border-zinc-800">
          <h1 className="text-xl font-black text-zinc-50 tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
              <HardDrive className="w-5 h-5 text-zinc-50" />
            </div>
            Media Admin
          </h1>
          <p className="text-xs text-zinc-600 mt-2">Gestión de almacenamiento enterprise</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-1">
          {SECTIONS.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                activeSection === id
                  ? 'bg-zinc-800 text-zinc-50 shadow-lg'
                  : 'text-zinc-500 hover:text-zinc-50 hover:bg-zinc-900'
              }`}
            >
              <Icon className={`w-5 h-5 ${activeSection === id ? color : ''}`} />
              {label}
            </button>
          ))}
        </nav>

        {/* Quick Stats */}
        {overview && (
          <div className="px-5 pb-5 space-y-2">
            <div className="text-[10px] font-bold text-zinc-600 uppercase  mb-2">Quick Stats</div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Total</span>
              <span className="text-zinc-50 font-bold">{overview.totalFiles.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Almacenamiento</span>
              <span className="text-zinc-50 font-bold">{formatBytes(overview.totalSize)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-500">Huérfanos</span>
              <span className="text-amber-400 font-bold">{overview.orphanCount}</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        {activeSection === 'overview' && renderOverview()}
        {activeSection === 'files' && renderFilesSection()}
        {activeSection === 'orphans' && renderOrphansSection()}
        {activeSection === 'tools' && renderToolsSection()}
        {activeSection === 'quota' && renderQuotaSection()}
      </div>

      {/* Modals */}
      <PreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      <UploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} onSuccess={() => { loadFiles(filesPage); loadOverview(); }} />
      {confirmModal && (
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          severity={confirmModal.severity}
          confirmPhrase={confirmModal.confirmPhrase}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel}
          loading={modalLoading}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[70] px-5 py-3 rounded-xl border shadow-2xl font-medium text-sm flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 ${
          toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 text-zinc-500 hover:text-zinc-50"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}

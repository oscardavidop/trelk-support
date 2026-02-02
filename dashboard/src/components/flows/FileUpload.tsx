/**
 * FileUpload Component
 * Refactored: Premium Zinc Style
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { 
  Link, UploadCloud, Image as ImageIcon, FileText, X, Check, 
  Loader2, Trash2, Film, Music, AlertCircle, RefreshCw 
} from 'lucide-react';

// ============= TYPES =============

export type MediaType = 'image' | 'document' | 'audio' | 'video';

interface FileUploadProps {
  mediaType: MediaType;
  value: string; // Current URL
  onChange: (url: string) => void;
  disabled?: boolean;
  placeholder?: string;
  accept?: string;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
}

interface GalleryFile {
  filename: string;
  url: string;
  size: number;
  createdAt: string;
}

// ============= HELPER CONSTANTS =============

const CONFIG = {
  image: { accept: 'image/jpeg,image/png,image/gif,image/webp', endpoint: '/api/upload/image', list: '/api/upload/list?type=images', maxSize: 10 * 1024 * 1024, label: 'Imagen', icon: ImageIcon },
  document: { accept: '.pdf,.doc,.docx,.zip,.xls,.xlsx,.txt,.csv', endpoint: '/api/upload/file', list: '/api/upload/list?type=files', maxSize: 50 * 1024 * 1024, label: 'Documento', icon: FileText },
  audio: { accept: 'audio/ogg,audio/webm,audio/mp3,audio/mpeg,audio/wav', endpoint: '/api/upload/audio', list: '/api/upload/list?type=audio', maxSize: 20 * 1024 * 1024, label: 'Audio', icon: Music },
  video: { accept: 'video/mp4,video/webm,video/quicktime,.mov,.avi,.mkv', endpoint: '/api/upload/video', list: '/api/upload/list?type=videos', maxSize: 50 * 1024 * 1024, label: 'Video', icon: Film },
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// ============= COMPONENT =============

export const FileUpload: React.FC<FileUploadProps> = ({
  mediaType,
  value,
  onChange,
  disabled = false,
  placeholder,
  accept,
}) => {
  const config = CONFIG[mediaType] || CONFIG.document;
  const [mode, setMode] = useState<'url' | 'upload' | 'gallery'>(value?.startsWith('/uploads/') ? 'upload' : 'url');
  const [uploadState, setUploadState] = useState<UploadState>({ isUploading: false, progress: 0, error: null });
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<GalleryFile[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.token);

  // Initial Check
  const isUploadedFile = value?.startsWith('/uploads/');

  // Load Gallery
  const loadGallery = useCallback(async () => {
    if (!token) return;
    setGalleryLoading(true);
    try {
      const response = await fetch(config.list, { headers: { Authorization: `Bearer ${token}` } });
      const result = await response.json();
      if (result.ok && result.files) setGalleryFiles(result.files);
    } catch (e) { console.error(e); } 
    finally { setGalleryLoading(false); }
  }, [config.list, token]);

  useEffect(() => { if (mode === 'gallery') loadGallery(); }, [mode, loadGallery]);

  // Handle Upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > config.maxSize) {
      setUploadState({ isUploading: false, progress: 0, error: `Máximo ${formatFileSize(config.maxSize)}` });
      return;
    }

    setUploadState({ isUploading: true, progress: 0, error: null });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await response.json();

      if (result.ok && result.url) {
        onChange(result.url);
        setUploadedFileName(result.originalName || file.name);
        setUploadState({ isUploading: false, progress: 100, error: null });
      } else {
        throw new Error(result.error || 'Error al subir');
      }
    } catch (error: any) {
      setUploadState({ isUploading: false, progress: 0, error: error.message || 'Error de conexión' });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && fileInputRef.current) {
        const dt = new DataTransfer(); dt.items.add(file);
        fileInputRef.current.files = dt.files;
        handleFileSelect({ target: fileInputRef.current } as any);
    }
  };

  const selectFromGallery = (file: GalleryFile) => {
    onChange(file.url);
    setUploadedFileName(file.filename);
    setMode('upload'); // Show preview in upload tab
  };

  return (
    <div className="space-y-3">
      
      {/* Mode Switcher */}
      <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-lg">
        {[
          { id: 'url', label: 'Enlace', icon: Link },
          { id: 'upload', label: 'Subir', icon: UploadCloud },
          { id: 'gallery', label: 'Galería', icon: config.icon }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id as any)}
            disabled={disabled}
            className={`
              flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all
              ${mode === tab.id 
                ? 'bg-zinc-800 text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}
            `}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="relative">
        
        {/* MODE: URL */}
        {mode === 'url' && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div className="relative">
              <input
                type="url"
                value={isUploadedFile ? '' : value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder || `https://ejemplo.com/archivo.${mediaType === 'image' ? 'png' : 'pdf'}`}
                className="w-full pl-9 pr-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <Link className="absolute left-3 top-3 w-4 h-4 text-zinc-600" />
            </div>
            {isUploadedFile && (
              <div className="flex items-center gap-2 text-xs text-amber-500/80 px-2">
                <AlertCircle className="w-3 h-3" />
                <span>Hay un archivo subido activo. Escribe una URL para sobrescribirlo.</span>
              </div>
            )}
          </div>
        )}

        {/* MODE: UPLOAD */}
        {mode === 'upload' && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-1 duration-200">
            
            {/* Upload Area */}
            {!isUploadedFile && !uploadState.isUploading && (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-900/50 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group"
              >
                <input ref={fileInputRef} type="file" accept={accept || config.accept} onChange={handleFileSelect} disabled={disabled} className="hidden" />
                <div className="p-3 bg-zinc-900 rounded-full mb-3 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6 text-zinc-500 group-hover:text-indigo-400" />
                </div>
                <p className="text-sm text-zinc-400 font-medium">Click o arrastra tu archivo</p>
                <p className="text-xs text-zinc-600 mt-1">Máx. {formatFileSize(config.maxSize)}</p>
              </div>
            )}

            {/* Progress */}
            {uploadState.isUploading && (
              <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-6 text-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-zinc-300 font-medium">Subiendo archivo...</p>
              </div>
            )}

            {/* Success / Preview State */}
            {isUploadedFile && !uploadState.isUploading && (
              <div className="relative group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                <div className="flex items-center p-3 gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                    {mediaType === 'image' ? <ImageIcon className="w-5 h-5"/> : <FileText className="w-5 h-5"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-200 truncate">{uploadedFileName || value.split('/').pop()}</p>
                    <p className="text-xs text-emerald-500 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Listo para enviar
                    </p>
                  </div>
                  {!disabled && (
                    <button onClick={() => { onChange(''); setUploadedFileName(null); }} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {/* Image Preview Background (if image) */}
                {mediaType === 'image' && (
                  <div className="h-1 bg-zinc-800 w-full mt-0">
                     <div className="h-full bg-indigo-500 w-full" />
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {uploadState.error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {uploadState.error}
              </div>
            )}
          </div>
        )}

        {/* MODE: GALLERY */}
        {mode === 'gallery' && (
          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div className="flex justify-between items-center mb-3 px-1">
               <span className="text-xs font-bold text-zinc-500 uppercase r">Archivos Recientes</span>
               <button onClick={loadGallery} disabled={galleryLoading} className="text-zinc-500 hover:text-white p-1 rounded hover:bg-zinc-800">
                  <RefreshCw className={`w-3.5 h-3.5 ${galleryLoading ? 'animate-spin' : ''}`} />
               </button>
            </div>

            {galleryLoading ? (
               <div className="flex flex-col items-center justify-center py-8 text-zinc-500 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-xs">Cargando galería...</span>
               </div>
            ) : galleryFiles.length === 0 ? (
               <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
                  No hay archivos disponibles
               </div>
            ) : mediaType === 'image' ? (
               <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {galleryFiles.map((file) => (
                     <button
                        key={file.url}
                        onClick={() => selectFromGallery(file)}
                        className={`
                           relative aspect-square rounded-lg overflow-hidden border-2 transition-all group
                           ${value === file.url ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-transparent hover:border-zinc-700'}
                        `}
                     >
                        <img src={file.url} alt={file.filename} className="w-full h-full object-cover bg-zinc-800" />
                        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${value === file.url ? 'opacity-100 bg-indigo-900/40' : ''}`}>
                           {value === file.url && <Check className="w-6 h-6 text-white drop-shadow-md" />}
                        </div>
                     </button>
                  ))}
               </div>
            ) : (
               <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                  {galleryFiles.map((file) => (
                     <button
                        key={file.url}
                        onClick={() => selectFromGallery(file)}
                        className={`
                           w-full flex items-center gap-3 p-2 rounded-lg text-left transition-all border
                           ${value === file.url 
                              ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200' 
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700'}
                        `}
                     >
                        <div className="p-1.5 rounded bg-zinc-950 border border-zinc-800">
                           {mediaType === 'audio' ? <Music className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className="text-xs font-medium truncate">{file.filename}</p>
                           <p className="text-[10px] opacity-60">{formatFileSize(file.size)}</p>
                        </div>
                        {value === file.url && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                     </button>
                  ))}
               </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default FileUpload;
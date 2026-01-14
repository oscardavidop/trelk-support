/**
 * FileUpload Component
 * Allows uploading files or entering URLs for media blocks in flows
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';

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

// ============= HELPER FUNCTIONS =============

const getAcceptedTypes = (mediaType: MediaType): string => {
  switch (mediaType) {
    case 'image':
      return 'image/jpeg,image/png,image/gif,image/webp';
    case 'document':
      return '.pdf,.doc,.docx,.zip,.xls,.xlsx,.txt,.csv';
    case 'audio':
      return 'audio/ogg,audio/webm,audio/mp3,audio/mpeg,audio/wav';
    case 'video':
      return 'video/mp4,video/webm,video/quicktime,.mov,.avi,.mkv';
    default:
      return '*/*';
  }
};

const getUploadEndpoint = (mediaType: MediaType): string => {
  switch (mediaType) {
    case 'image':
      return '/api/upload/image';
    case 'document':
      return '/api/upload/file';
    case 'audio':
      return '/api/upload/audio';
    case 'video':
      return '/api/upload/video';
    default:
      return '/api/upload/file';
  }
};

const getListEndpoint = (mediaType: MediaType): string => {
  switch (mediaType) {
    case 'image':
      return '/api/upload/list?type=images';
    case 'document':
      return '/api/upload/list?type=files';
    case 'audio':
      return '/api/upload/list?type=audio';
    case 'video':
      return '/api/upload/list?type=videos';
    default:
      return '/api/upload/list?type=files';
  }
};

const getMaxSize = (mediaType: MediaType): number => {
  switch (mediaType) {
    case 'image':
      return 10 * 1024 * 1024; // 10MB
    case 'document':
      return 50 * 1024 * 1024; // 50MB
    case 'audio':
      return 20 * 1024 * 1024; // 20MB
    case 'video':
      return 50 * 1024 * 1024; // 50MB
    default:
      return 50 * 1024 * 1024;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getMediaLabel = (mediaType: MediaType): string => {
  switch (mediaType) {
    case 'image': return 'imagen';
    case 'document': return 'documento';
    case 'audio': return 'audio';
    case 'video': return 'video';
    default: return 'archivo';
  }
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
  const [mode, setMode] = useState<'url' | 'upload' | 'gallery'>(value?.startsWith('/uploads/') ? 'upload' : 'url');
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
  });
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<GalleryFile[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const token = useAuthStore((s) => s.token);

  // Load gallery files
  const loadGallery = useCallback(async () => {
    if (!token) return;
    
    setGalleryLoading(true);
    try {
      const response = await fetch(getListEndpoint(mediaType), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.ok && result.files) {
        setGalleryFiles(result.files);
      }
    } catch (error) {
      console.error('Failed to load gallery:', error);
    } finally {
      setGalleryLoading(false);
    }
  }, [mediaType, token]);

  // Load gallery when switching to gallery mode
  useEffect(() => {
    if (mode === 'gallery') {
      loadGallery();
    }
  }, [mode, loadGallery]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const maxSize = getMaxSize(mediaType);
    if (file.size > maxSize) {
      setUploadState({
        isUploading: false,
        progress: 0,
        error: `El archivo es muy grande. Máximo: ${formatFileSize(maxSize)}`,
      });
      return;
    }

    // Start upload
    setUploadState({ isUploading: true, progress: 0, error: null });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(getUploadEndpoint(mediaType), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.ok && result.url) {
        onChange(result.url);
        setUploadedFileName(result.originalName || file.name);
        setUploadState({ isUploading: false, progress: 100, error: null });
      } else {
        setUploadState({
          isUploading: false,
          progress: 0,
          error: result.error || 'Error al subir archivo',
        });
      }
    } catch (error) {
      setUploadState({
        isUploading: false,
        progress: 0,
        error: 'Error de conexión',
      });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Create a synthetic event for handleFileSelect
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.files = dataTransfer.files;
      handleFileSelect({ target: fileInputRef.current } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const clearFile = () => {
    onChange('');
    setUploadedFileName(null);
    setUploadState({ isUploading: false, progress: 0, error: null });
  };

  const selectFromGallery = (file: GalleryFile) => {
    onChange(file.url);
    setUploadedFileName(file.filename);
    setMode('upload'); // Switch to upload view to show selected file
  };

  const isUploadedFile = value?.startsWith('/uploads/');

  return (
    <div className="space-y-2">
      {/* Mode Selector */}
      <div className="flex gap-1 mb-2">
        <button
          type="button"
          onClick={() => setMode('url')}
          disabled={disabled}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            mode === 'url'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          🔗 URL
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          disabled={disabled}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            mode === 'upload'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
            📤
          Subir
        </button>
        <button
          type="button"
          onClick={() => setMode('gallery')}
          disabled={disabled}
          className={`px-2 py-1 text-xs rounded-md transition-colors ${
            mode === 'gallery'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
            🖼️
          Galería
        </button>
      </div>

      {/* URL Mode */}
      {mode === 'url' && (
        <input
          type="url"
          value={isUploadedFile ? '' : value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={placeholder || `URL de la ${getMediaLabel(mediaType)}...`}
        />
      )}

      {/* Upload Mode */}
      {mode === 'upload' && (
        <div className="space-y-2">
          {/* Drop Zone */}
          {!isUploadedFile && !uploadState.isUploading && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={accept || getAcceptedTypes(mediaType)}
                onChange={handleFileSelect}
                disabled={disabled}
                className="hidden"
              />
              <div className="text-gray-500 dark:text-gray-400">
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm">
                  Arrastra un archivo aquí o <span className="text-blue-500">haz clic para seleccionar</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Máximo: {formatFileSize(getMaxSize(mediaType))}
                </p>
              </div>
            </div>
          )}

          {/* Uploading Progress */}
          {uploadState.isUploading && (
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm text-gray-600 dark:text-gray-400">Subiendo...</span>
              </div>
            </div>
          )}

          {/* Uploaded File Preview */}
          {isUploadedFile && !uploadState.isUploading && (
            <div className="border border-green-300 dark:border-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-green-700 dark:text-green-300 truncate">
                    {uploadedFileName || value.split('/').pop()}
                  </span>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    onClick={clearFile}
                    className="text-gray-500 hover:text-red-500 flex-shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {uploadState.error && (
            <div className="text-sm text-red-500 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {uploadState.error}
            </div>
          )}
        </div>
      )}

      {/* Gallery Mode */}
      {mode === 'gallery' && (
        <div className="space-y-2">
          {galleryLoading ? (
            <div className="flex items-center justify-center p-4 text-gray-500 dark:text-gray-400">
              <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Cargando...
            </div>
          ) : galleryFiles.length === 0 ? (
            <div className="text-center p-4 text-gray-500 dark:text-gray-400 text-sm border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              No hay archivos subidos de este tipo
            </div>
          ) : mediaType === 'image' ? (
            // Image gallery - grid with thumbnails
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {galleryFiles.map((file) => (
                <button
                  key={file.url}
                  type="button"
                  onClick={() => selectFromGallery(file)}
                  disabled={disabled}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:border-blue-400 ${
                    value === file.url ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <img
                    src={file.url}
                    alt={file.filename}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ccc"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
                    }}
                  />
                  {value === file.url && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            // File list for non-image types
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {galleryFiles.map((file) => (
                <button
                  key={file.url}
                  type="button"
                  onClick={() => selectFromGallery(file)}
                  disabled={disabled}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                    value === file.url
                      ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-400'
                      : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-transparent'
                  }`}
                >
                  <span className="text-lg">
                    {mediaType === 'audio' ? '🎵' : mediaType === 'video' ? '🎬' : '📄'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {file.filename}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                  {value === file.url && (
                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
          
          {/* Refresh button */}
          <button
            type="button"
            onClick={loadGallery}
            disabled={galleryLoading}
            className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
          >
            <svg className={`w-3 h-3 ${galleryLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Actualizar
          </button>
        </div>
      )}

      {/* Preview for URL mode with uploaded file */}
      {mode === 'url' && isUploadedFile && value && (
        <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Actualmente usando archivo subido. Ingresa una URL para cambiar.
        </div>
      )}
    </div>
  );
};

export default FileUpload;

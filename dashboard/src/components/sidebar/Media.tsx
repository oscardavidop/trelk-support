/**
 * SidebarMedia - Premium Zinc Refactor
 * Enterprise media gallery for chat sidebar with high-fidelity UI
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useSocket } from '../../hooks/useSocket';
import {
  Image as ImageIcon, Video, Music, FileText, Download, Play, Pause,
  X, Copy, Check, Loader2, ChevronLeft, ChevronRight, Maximize2,
  SearchX, FileImage,
  FileImageIcon
} from 'lucide-react';

// ============= TYPES =============

interface MediaItem {
  id: string;
  type: string;
  url: string;
  thumbnailUrl?: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
  width?: number;
  height?: number;
  caption?: string;
  sender: 'user' | 'agent' | 'bot' | 'system';
  senderName?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

interface MediaCounts {
  images: number;
  videos: number;
  audios: number;
  files: number;
  stickers: number;
  total: number;
}

interface MediaData {
  images: MediaItem[];
  videos: MediaItem[];
  audios: MediaItem[];
  files: MediaItem[];
  stickers: MediaItem[];
}

interface SidebarMediaProps {
  sessionId: string;
}

type MediaTab = 'all' | 'images' | 'videos' | 'audios' | 'files';

const TABS: { id: MediaTab; label: string; icon: typeof ImageIcon }[] = [
  { id: 'all', label: 'Todo', icon: FileImageIcon },
  { id: 'images', label: 'Fotos', icon: ImageIcon },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'audios', label: 'Audio', icon: Music },
  { id: 'files', label: 'Archivos', icon: FileText },
];


// ============= MAIN COMPONENT =============

export function SidebarMedia({ sessionId, contactInfo }: SidebarMediaProps & { contactInfo?: any }) {
  console.log('Rendering SidebarMedia with sessionId:', contactInfo);
  const { token } = useAuthStore();
  const { socket } = useSocket();

  // State
  const [activeTab, setActiveTab] = useState<MediaTab>('all');
  const [media, setMedia] = useState<MediaData>({ images: [], videos: [], audios: [], files: [], stickers: [] });
  const [counts, setCounts] = useState<MediaCounts>({ images: 0, videos: 0, audios: 0, files: 0, stickers: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // --- API & Socket Logic ---
  const loadMedia = useCallback(async (loadMore = false) => {
    if (!sessionId) return;
    if (!loadMore) setIsLoading(true);

    try {
      const url = `/api/media/chat/${sessionId}${loadMore && cursor ? `?cursor=${cursor}` : ''}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();

      if (data.ok) {
        if (loadMore) {
          setMedia(prev => ({
            images: [...prev.images, ...data.media.images],
            videos: [...prev.videos, ...data.media.videos],
            audios: [...prev.audios, ...data.media.audios],
            files: [...prev.files, ...data.media.files],
            stickers: [...prev.stickers, ...data.media.stickers]
          }));
        } else {
          setMedia(data.media);
          setCounts(data.counts);
        }
        setHasMore(data.hasMore);
        setCursor(data.nextCursor);
      }
    } catch (error) { console.error(error); }
    finally { setIsLoading(false); }
  }, [sessionId, token, cursor]);

  useEffect(() => { loadMedia(); }, [sessionId]);

  useEffect(() => {
    if (!socket || !sessionId) return;
    const handleNewMessage = (msg: any) => {
      if (msg.sessionId !== sessionId) return;
      const mediaTypes = ['image', 'video', 'audio', 'voice', 'file', 'document', 'sticker'];
      if (!mediaTypes.includes(msg.messageType)) return;

      const mediaItem: MediaItem = {
        id: msg._id || msg.id, type: msg.messageType, url: msg.media?.url || msg.mediaUrl || '',
        thumbnailUrl: msg.media?.thumbnailUrl, fileName: msg.media?.fileName || msg.content || 'Unknown',
        fileSize: msg.media?.fileSize, mimeType: msg.media?.mimeType, duration: msg.media?.duration,
        width: msg.media?.width, height: msg.media?.height, caption: msg.content,
        sender: msg.sender, senderName: msg.senderName, createdAt: msg.createdAt, metadata: msg.metadata
      };

      setMedia(prev => {
        const updated = { ...prev };
        switch (msg.messageType) {
          case 'image': updated.images = [mediaItem, ...prev.images]; break;
          case 'video': updated.videos = [mediaItem, ...prev.videos]; break;
          case 'audio': case 'voice': updated.audios = [mediaItem, ...prev.audios]; break;
          case 'file': case 'document': updated.files = [mediaItem, ...prev.files]; break;
          case 'sticker': updated.stickers = [mediaItem, ...prev.stickers]; break;
        }
        return updated;
      });

      setCounts(prev => {
        const updated = { ...prev, total: prev.total + 1 };
        switch (msg.messageType) {
          case 'image': updated.images++; break;
          case 'video': updated.videos++; break;
          case 'audio': case 'voice': updated.audios++; break;
          case 'file': case 'document': updated.files++; break;
          case 'sticker': updated.stickers++; break;
        }
        return updated;
      });
    };

    socket.on('message:new', handleNewMessage);
    return () => { socket.off('message:new', handleNewMessage); };
  }, [socket, sessionId]);

  // --- Utils ---
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getMediaUrl = (item: MediaItem) => {
    if (item.url.startsWith('http')) return item.url;
    if (item.url.startsWith('/')) return item.url;
    return `/api/media/${item.url}`;
  };

  const getFilteredItems = () => {
    switch (activeTab) {
      case 'images': return media.images;
      case 'videos': return media.videos;
      case 'audios': return media.audios;
      case 'files': return media.files;
      case 'all': default:
        return [...media.images, ...media.videos, ...media.audios, ...media.files, ...media.stickers]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  };

  const filteredItems = getFilteredItems();

  // --- Loading State ---
  if (isLoading && filteredItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-xs font-medium text-zinc-500 uppercase st animate-pulse">Cargando Galería...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-300">

      {/* Tabs Container */}
      <div className="px-4 py-3 shrink-0">
        <div className="flex p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          {TABS.map(tab => {
            const count = tab.id === 'all' ? counts.total : counts[tab.id as keyof Omit<MediaCounts, 'total' | 'stickers'>];
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition-all ${isActive
                  ? 'bg-zinc-800 text-zinc-50 shadow-sm ring-1 ring-white/5'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                  }`}
              >
                <tab.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline-block">{count || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20">
            <div className="p-4 bg-zinc-900 rounded-full mb-3 border border-zinc-800 shadow-xl">
              <SearchX className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-sm font-bold text-zinc-300">Galería vacía</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-[200px] text-center">No hay archivos multimedia en esta categoría.</p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* Images Grid */}
            {(activeTab === 'all' || activeTab === 'images') && media.images.length > 0 && (
              <div className="space-y-3">
                {activeTab === 'all' && (
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase  flex items-center gap-1.5 px-1">
                    <ImageIcon className="w-3 h-3" /> Fotografías <span className="text-zinc-600">({counts.images})</span>
                  </h4>
                )}
                <div className="grid grid-cols-3 gap-1.5">
                  {media.images.slice(0, activeTab === 'all' ? 6 : undefined).map(item => (
                    <button
                      key={item.id}
                      onClick={() => setPreviewItem(item)}
                      className="aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 hover:border-indigo-500 transition-all group relative"
                    >
                      <img
                        src={getMediaUrl(item)}
                        alt={item.fileName}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-zinc-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                        <Maximize2 className="w-5 h-5 text-zinc-50 drop-shadow-md" />
                      </div>
                      <div className={`absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-zinc-950 ${item.sender === 'user' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                    </button>
                  ))}
                </div>
                {activeTab === 'all' && media.images.length > 6 && (
                  <button onClick={() => setActiveTab('images')} className="w-full py-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition-colors border border-transparent hover:border-indigo-500/20">
                    Ver todas las fotos
                  </button>
                )}
              </div>
            )}

            {/* Videos List */}
            {(activeTab === 'all' || activeTab === 'videos') && media.videos.length > 0 && (
              <div className="space-y-3">
                {activeTab === 'all' && (
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase  flex items-center gap-1.5 px-1">
                    <Video className="w-3 h-3" /> Videos <span className="text-zinc-600">({counts.videos})</span>
                  </h4>
                )}
                <div className="space-y-2">
                  {media.videos.slice(0, activeTab === 'all' ? 3 : undefined).map(item => (
                    <VideoCard key={item.id} item={item} getMediaUrl={getMediaUrl} formatDate={formatDate} formatFileSize={formatFileSize} onPreview={() => setPreviewItem(item)} />
                  ))}
                </div>
                {activeTab === 'all' && media.videos.length > 3 && (
                  <button onClick={() => setActiveTab('videos')} className="w-full py-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition-colors border border-transparent hover:border-indigo-500/20">
                    Ver todos los videos
                  </button>
                )}
              </div>
            )}

            {/* Audios List */}
            {(activeTab === 'all' || activeTab === 'audios') && media.audios.length > 0 && (
              <div className="space-y-3">
                {activeTab === 'all' && (
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase  flex items-center gap-1.5 px-1">
                    <Music className="w-3 h-3" /> Audio <span className="text-zinc-600">({counts.audios})</span>
                  </h4>
                )}
                <div className="space-y-2">
                  {media.audios.slice(0, activeTab === 'all' ? 3 : undefined).map(item => (
                    <AudioCard key={item.id} item={item} getMediaUrl={getMediaUrl} formatDate={formatDate} formatFileSize={formatFileSize} />
                  ))}
                </div>
                {activeTab === 'all' && media.audios.length > 3 && (
                  <button onClick={() => setActiveTab('audios')} className="w-full py-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition-colors border border-transparent hover:border-indigo-500/20">
                    Ver todos los audios
                  </button>
                )}
              </div>
            )}

            {/* Files List */}
            {(activeTab === 'all' || activeTab === 'files') && media.files.length > 0 && (
              <div className="space-y-3">
                {activeTab === 'all' && (
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase  flex items-center gap-1.5 px-1">
                    <FileText className="w-3 h-3" /> Documentos <span className="text-zinc-600">({counts.files})</span>
                  </h4>
                )}
                <div className="space-y-2">
                  {media.files.slice(0, activeTab === 'all' ? 4 : undefined).map(item => (
                    <FileCard key={item.id} item={item} getMediaUrl={getMediaUrl} formatDate={formatDate} formatFileSize={formatFileSize} onCopy={copyToClipboard} copiedId={copiedId} />
                  ))}
                </div>
                {activeTab === 'all' && media.files.length > 4 && (
                  <button onClick={() => setActiveTab('files')} className="w-full py-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-xl transition-colors border border-transparent hover:border-indigo-500/20">
                    Ver todos los archivos
                  </button>
                )}
              </div>
            )}

            {/* Load More Button */}
            {hasMore && activeTab !== 'all' && (
              <button
                onClick={() => loadMedia(true)}
                disabled={isLoading}
                className="w-full py-3 mt-4 text-xs font-bold text-zinc-400 bg-zinc-900 border border-zinc-800 hover:text-zinc-50 hover:border-zinc-700 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cargar historial anterior'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {previewItem && (
        <MediaPreviewModal
          item={{
            ...previewItem, session: {
              user: {
                name: contactInfo?.user.firstName || 'Cliente',
                photoFileId: contactInfo?.user.photoFileId || undefined
              }
            }
          }}
          items={filteredItems.filter(i => i.type === 'image' || i.type === 'video' || i.type === 'sticker')}
          getMediaUrl={getMediaUrl}
          formatDate={formatDate}
          onClose={() => setPreviewItem(null)}
          onNavigate={setPreviewItem}
        />
      )}
    </div>
  );
}

// ============= SUBCOMPONENTS =============

// Video Card
function VideoCard({ item, getMediaUrl, formatDate, formatFileSize, onPreview }: any) {
  return (
    <button onClick={onPreview} className="w-full flex items-center gap-3 p-2 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/50 hover:border-zinc-700 rounded-xl transition-all group text-left">
      <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-zinc-950 flex items-center justify-center shrink-0 border border-zinc-800 group-hover:border-indigo-500/50 transition-colors">
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <Video className="w-5 h-5 text-zinc-600" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-transparent transition-colors">
          <div className="bg-zinc-950/80 backdrop-blur-sm p-1 rounded-full text-zinc-50 group-hover:text-indigo-400 group-hover:scale-110 transition-all">
            <Play className="w-3 h-3 ml-0.5" />
          </div>
        </div>
        {item.duration && (
          <span className="absolute bottom-1 right-1 text-[8px] font-mono font-bold bg-zinc-950/90 text-zinc-50 px-1 py-0.5 rounded shadow-sm">
            {Math.floor(item.duration / 60)}:{(item.duration % 60).toString().padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-indigo-400 transition-colors">{item.fileName}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-500">
          <span className={`w-1.5 h-1.5 rounded-full ${item.sender === 'user' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
          <span>{formatDate(item.createdAt)}</span>
          <span>•</span>
          <span className="font-mono">{formatFileSize(item.fileSize)}</span>
        </div>
      </div>
    </button>
  );
}

// Audio Card
function AudioCard({ item, getMediaUrl, formatDate, formatFileSize }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) setProgress((audioRef.current.currentTime / (item.duration || audioRef.current.duration || 1)) * 100);
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/50 hover:border-zinc-700 rounded-xl transition-all group">
      <audio ref={audioRef} src={getMediaUrl(item)} onTimeUpdate={handleTimeUpdate} onEnded={() => { setIsPlaying(false); setProgress(0); }} preload="metadata" />

      <div className="flex items-center gap-3">
        <button onClick={togglePlay} className="w-10 h-10 rounded-full bg-zinc-800 group-hover:bg-indigo-500/10 border border-zinc-700 group-hover:border-indigo-500/30 flex items-center justify-center shrink-0 transition-colors text-zinc-300 group-hover:text-indigo-400">
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-zinc-200 truncate">{item.type === 'voice' ? 'Nota de Voz' : item.fileName}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-zinc-500 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${item.sender === 'user' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
              {formatDate(item.createdAt)}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">{formatFileSize(item.fileSize)}</span>
          </div>
        </div>
      </div>

      {/* Sleek Progress Bar */}
      <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800/50">
        <div className="h-full bg-indigo-500 rounded-full transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(99,102,241,0.5)]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

// File Card
function FileCard({ item, getMediaUrl, formatDate, formatFileSize, onCopy, copiedId }: any) {
  return (
    <div className="flex items-center gap-3 p-2 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/50 hover:border-zinc-700 rounded-xl transition-all group">
      <div className="w-10 h-10 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
        <FileImage className="w-5 h-5 text-zinc-500 group-hover:text-indigo-400 transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-200 truncate group-hover:text-indigo-400 transition-colors">{item.fileName}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-zinc-500">
          <span className={`w-1.5 h-1.5 rounded-full ${item.sender === 'user' ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
          <span>{formatDate(item.createdAt)}</span>
          <span>•</span>
          <span className="font-mono">{formatFileSize(item.fileSize)}</span>
        </div>
      </div>

      {/* Hover Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => onCopy(`${window.location.origin}${getMediaUrl(item)}`, item.id)} className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors" title="Copiar Enlace">
          {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
        </button>
        <a href={`${getMediaUrl(item)}?download=true`} download={item.fileName} className="p-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition-colors" title="Descargar">
          <Download className="w-3.5 h-3.5 text-indigo-400" />
        </a>
      </div>
    </div>
  );
}

// Lightbox Modal
function MediaPreviewModal({ item, items, getMediaUrl, formatDate, onClose, onNavigate }: any) {
  console.log('Previewing item:', item);
  const currentIndex = items.findIndex((i: any) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(items[currentIndex - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(items[currentIndex + 1]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items]);

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-zinc-950/95 backdrop-blur-2xl animate-in fade-in duration-300" onClick={onClose}>

      {/* Top Header */}
      <div className="absolute top-0 left-0 right-0 p-4 sm:px-8 flex items-center justify-between z-10 bg-gradient-to-b from-zinc-950/80 to-transparent" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xs font-bold text-zinc-50 bg-zinc-800 border-2 border-zinc-950 overflow-hidden ${item.session.user?.photoFileId ? 'p-0' : ''}`}>
            {item.session.user?.photoFileId ? (
              <img
                src={`/api/media/${item.session.user.photoFileId}`}
                alt={item.session.user.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-110"
              />
            ) : (
              <span>{item.session.user.name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-50">{item.senderName || (item.sender === 'user' ? item?.session.user.name || 'Cliente' : 'Agente')}</p>
            <p className="text-xs text-zinc-400">{formatDate(item.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a href={`${getMediaUrl(item)}?download=true`} download={item.fileName} className="p-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 hover:text-zinc-50 rounded-xl transition-colors">
            <Download className="w-5 h-5" />
          </a>
          <button onClick={onClose} className="p-2.5 bg-zinc-900 border border-zinc-800 hover:bg-red-500/20 text-zinc-300 hover:text-red-400 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {hasPrev && (
        <button onClick={(e) => { e.stopPropagation(); onNavigate(items[currentIndex - 1]); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-full text-zinc-300 hover:text-zinc-50 backdrop-blur-md transition-colors z-10">
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {hasNext && (
        <button onClick={(e) => { e.stopPropagation(); onNavigate(items[currentIndex + 1]); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-full text-zinc-300 hover:text-zinc-50 backdrop-blur-md transition-colors z-10">
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      {/* Media Content Wrapper */}
      <div className="relative max-w-5xl w-full max-h-[85vh] p-4 flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
        {item.type === 'image' || item.type === 'sticker' ? (
          <img src={getMediaUrl(item)} alt={item.fileName} onContextMenu={(e) => e.preventDefault()} draggable={false} className="max-w-full max-h-[75vh] object-contain rounded-lg ring-1 ring-white/10 shadow-2xl shadow-black pointer-events-none select-none" />
        ) : item.type === 'video' ? (
          <video src={getMediaUrl(item)} controls autoPlay className="max-w-full max-h-[75vh] rounded-lg ring-1 ring-white/10 shadow-2xl shadow-black" />
        ) : null}

        {/* Caption */}
        {item.caption && item.caption !== item.fileName && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 px-6 py-3 rounded-2xl max-w-lg text-center">
            <p className="text-zinc-200 text-sm leading-relaxed">{item.caption}</p>
          </div>
        )}
      </div>

      {/* Counter Pill */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-xs font-bold font-mono text-zinc-400 z-10">
        <span className="text-zinc-100">{currentIndex + 1}</span> / {items.length}
      </div>
    </div>
  );
}

export default SidebarMedia;
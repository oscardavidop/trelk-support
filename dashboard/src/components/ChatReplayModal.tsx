// /**
// * ChatReplayModal — Full-screen chat replay / playback overlay
// * Enterprise QA feature: replay closed conversations with real timing,
// * events, silence indicators, and QA metrics.
// */

// import { useEffect, useRef, useCallback, useState } from 'react';
// import {
//     Play, Pause, SkipBack, X, Download, Clock, MessageSquare,
//     User, Bot, Shield, Volume2, FileText, Image as ImageIcon,
//     Maximize2, ChevronRight, Gauge, ArrowRightLeft, Timer,
//     Zap, Hash, Loader2, AlertTriangle,
// } from 'lucide-react';
// import {
//     useReplayEngine,
//     formatDuration,
//     formatDurationShort,
//     SILENCE_THRESHOLD,
//     type ReplayTimelineItem,
//     type PlaybackSpeed,
// } from '../hooks/useReplayEngine';
// import ReplayTimeline, { EventPill, SilenceBlock } from './ReplayTimeline';
// import type { ChatSession } from '../types';

// interface ChatReplayModalProps {
//     session: ChatSession;
//     isOpen: boolean;
//     onClose: () => void;
// }

// // ============= MEDIA HELPERS (replicated from ChatWindow for isolation) =============

// function getProxyMediaUrl(mediaRef?: string): string | undefined {
//     if (!mediaRef) return;
//     if (mediaRef.startsWith('/api/media/') || mediaRef.startsWith('/api/download/') || mediaRef.startsWith('/uploads/'))
//         return mediaRef;
//     if (mediaRef.startsWith('http')) {
//         const match = mediaRef.match(/api\.telegram\.org\/file\/bot[^/]+\/(.+)$/);
//         return match ? `/api/media/${match[1]}` : mediaRef;
//     }
//     return `/api/media/${encodeURIComponent(mediaRef)}`;
// }

// // ============= REPLAY MESSAGE BUBBLE =============

// function ReplayBubble({ item, session, animate }: { item: ReplayTimelineItem; session: ChatSession; animate: boolean }) {
//     const isAgent = item.sender === 'agent';
//     const isBot = item.sender === 'bot';
//     const isSystem = item.sender === 'system' || item.messageType === 'system';

//     if (isSystem) {
//         return (
//             <div className={`flex justify-center my-2 ${animate ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''}`}>
//                 <span className="px-4 py-1.5 text-xs rounded-full bg-zinc-800/70 text-zinc-500 backdrop-blur">
//                     {item.content}
//                 </span>
//             </div>
//         );
//     }

//     const mediaUrl = getProxyMediaUrl(item.mediaUrl);

//     const renderMedia = () => {
//         if (!mediaUrl) return null;
//         switch (item.messageType) {
//             case 'image':
//                 return (
//                     <img src={mediaUrl} alt={item.content || ''} className="max-w-xs max-h-64 rounded-lg" loading="lazy"
//                         onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
//                 );
//             case 'video':
//                 return (
//                     <video controls preload="metadata" className="max-w-xs max-h-48 rounded-lg">
//                         <source src={mediaUrl} />
//                     </video>
//                 );
//             case 'audio':
//             case 'voice':
//                 return (
//                     <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-black/20 min-w-[200px]">
//                         <Volume2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
//                         <audio controls preload="metadata" className="h-8 flex-1 max-w-[240px]">
//                             <source src={mediaUrl} />
//                         </audio>
//                     </div>
//                 );
//             case 'file':
//             case 'document':
//                 return (
//                     <a href={mediaUrl} target="_blank" rel="noopener noreferrer"
//                         className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/20 hover:bg-black/30 transition-colors">
//                         <FileText className="w-5 h-5 text-amber-400 flex-shrink-0" />
//                         <span className="text-sm truncate max-w-[200px]">{item.fileName || item.content || 'Archivo'}</span>
//                         <Download className="w-4 h-4 opacity-50 flex-shrink-0" />
//                     </a>
//                 );
//             case 'sticker':
//                 return <img src={mediaUrl} alt="Sticker" className="w-28 h-28 object-contain" />;
//             default:
//                 return null;
//         }
//     };

//     return (
//         <div className={`flex ${isAgent ? 'justify-end' : 'justify-start'} group ${animate ? 'animate-in fade-in slide-in-from-bottom-3 duration-300' : ''}`}>
//             <div className={`flex items-end gap-2 max-w-[72%] ${isAgent ? 'flex-row-reverse' : ''}`}>
//                 {/* Avatar */}
//                 <div className="w-7 h-7 rounded-full flex items-center justify-center shadow-sm bg-zinc-700 shrink-0 overflow-hidden">
//                     {isAgent ? (
//                         item.senderAgent?.avatar
//                             ? <img src={item.senderAgent.avatar} className="w-full h-full object-cover" />
//                             : <span className="text-[10px] font-bold text-zinc-50">{item.senderAgent?.name?.[0]?.toUpperCase() || 'A'}</span>
//                     ) : isBot ? (
//                         <Bot className="w-3.5 h-3.5 text-zinc-50" />
//                     ) : session.user?.photoFileId ? (
//                         <img src={`/api/media/${session.user.photoFileId}`} className="w-full h-full object-cover" />
//                     ) : (
//                         <User className="w-3.5 h-3.5 text-zinc-50" />
//                     )}
//                 </div>

//                 {/* Bubble */}
//                 <div className={`relative px-3.5 py-2 rounded-2xl ${isAgent
//                         ? 'bg-blue-600 text-zinc-50 rounded-br-md'
//                         : isBot
//                             ? 'bg-purple-600/30 text-zinc-50 rounded-bl-md'
//                             : 'bg-zinc-700 text-zinc-50 rounded-bl-md'
//                     }`}>
//                     {/* Sender name */}
//                     {item.senderAgent && (
//                         <p className="text-[11px] font-semibold opacity-70 mb-0.5">{item.senderAgent.name}</p>
//                     )}

//                     {/* Reply */}
//                     {item.replyToMessage && (
//                         <div className="mb-1.5 pl-2 border-l-2 border-white/30">
//                             <p className="text-[10px] font-medium opacity-70">
//                                 {item.replyToMessage.sender === 'user' ? 'Usuario' : item.replyToMessage.senderAgent?.name || 'Agente'}
//                             </p>
//                             <p className="text-[10px] opacity-50 truncate max-w-[200px]">{item.replyToMessage.content}</p>
//                         </div>
//                     )}

//                     {/* Media */}
//                     {renderMedia()}

//                     {/* Text content */}
//                     {item.content && (item.messageType === 'text' || !item.mediaUrl) && (
//                         <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{item.content}</p>
//                     )}
//                     {/* Caption below media */}
//                     {item.content && item.mediaUrl && item.messageType !== 'text' && (
//                         <p className="text-xs opacity-80 mt-1.5 whitespace-pre-wrap">{item.content}</p>
//                     )}

//                     {/* Footer */}
//                     <div className="flex items-center justify-end gap-1.5 mt-1 text-[10px] opacity-50">
//                         <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
//                         {item.isEdited && <span>(editado)</span>}
//                         {item.isPinned && <span>📌</span>}
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }

// // ============= DATE SEPARATOR =============

// function DateSeparator({ date }: { date: Date }) {
//     const label = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
//     return (
//         <div className="flex justify-center my-4">
//             <span className="px-4 py-1 text-xs font-medium rounded-full text-zinc-400 backdrop-blur border border-zinc-700/70 bg-zinc-900/70 text-center">
//                 {label}
//             </span>
//         </div>
//     );
// }

// // ============= METRICS PANEL =============

// function MetricsBar({ metrics, session }: { metrics: any; session: any }) {
//     const cards = [
//         { icon: Timer, label: 'Duración', value: formatDuration(metrics.totalDuration), color: 'text-blue-400' },
//         { icon: Gauge, label: 'Resp. promedio', value: formatDuration(metrics.avgAgentResponseTime), color: 'text-emerald-400' },
//         { icon: Clock, label: 'Max silencio', value: formatDuration(metrics.maxSilenceGap), color: 'text-amber-400' },
//         { icon: Zap, label: 'Primera resp.', value: formatDuration(metrics.firstResponseTime), color: 'text-cyan-400' },
//         { icon: MessageSquare, label: 'Mensajes', value: `${metrics.totalMessages}`, color: 'text-purple-400' },
//         { icon: ArrowRightLeft, label: 'Transferencias', value: `${metrics.transfers}`, color: 'text-orange-400' },
//     ];

//     return (
//         <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
//             {cards.map(({ icon: Icon, label, value, color }) => (
//                 <div key={label} className="bg-zinc-800/50 border border-zinc-700/30 rounded-xl px-3 py-2 text-center">
//                     <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
//                     <p className="text-sm font-bold text-zinc-50">{value}</p>
//                     <p className="text-[10px] text-zinc-500">{label}</p>
//                 </div>
//             ))}
//         </div>
//     );
// }

// // ============= MESSAGE COUNTS BADGE =============

// function CountsBadge({ metrics }: { metrics: any }) {
//     return (
//         <div className="flex items-center gap-3 text-[11px]">
//             <span className="flex items-center gap-1 text-zinc-500">
//                 <User className="w-3 h-3" /> <span className="text-zinc-300 font-medium">{metrics.userMessages}</span>
//             </span>
//             <span className="flex items-center gap-1 text-zinc-500">
//                 <Shield className="w-3 h-3" /> <span className="text-zinc-300 font-medium">{metrics.agentMessages}</span>
//             </span>
//             <span className="flex items-center gap-1 text-zinc-500">
//                 <Bot className="w-3 h-3" /> <span className="text-zinc-300 font-medium">{metrics.botMessages}</span>
//             </span>
//             <span className="flex items-center gap-1 text-zinc-500">
//                 <Hash className="w-3 h-3" /> <span className="text-zinc-300 font-medium">{metrics.systemEvents}</span> eventos
//             </span>
//         </div>
//     );
// }

// // ============= SPEED BUTTON =============

// function SpeedSelector({ speed, onChange }: { speed: PlaybackSpeed; onChange: (s: PlaybackSpeed) => void }) {
//     const speeds: PlaybackSpeed[] = [1, 2, 5, 10];
//     return (
//         <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-0.5">
//             {speeds.map(s => (
//                 <button
//                     key={s}
//                     onClick={() => onChange(s)}
//                     className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${s === speed
//                             ? 'bg-blue-600 text-zinc-50 shadow-sm'
//                             : 'text-zinc-500 hover:text-zinc-50 hover:bg-zinc-700/50'
//                         }`}
//                 >
//                     {s}x
//                 </button>
//             ))}
//         </div>
//     );
// }

// // ============= CHANNEL BADGE =============

// function ChannelBadge({ channel }: { channel: string }) {
//     const config: Record<string, { label: string; color: string }> = {
//         telegram: { label: 'Telegram', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
//         web: { label: 'WebChat', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
//         whatsapp: { label: 'WhatsApp', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
//         instagram: { label: 'Instagram', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
//         email: { label: 'Email', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
//     };
//     const c = config[channel] || { label: channel, color: 'bg-zinc-700/50 text-zinc-400 border-zinc-600/50' };
//     return (
//         <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${c.color}`}>
//             {c.label}
//         </span>
//     );
// }

// // ============= MAIN MODAL =============

// export default function ChatReplayModal({ session, isOpen, onClose }: ChatReplayModalProps) {
//     const engine = useReplayEngine();
//     const chatContainerRef = useRef<HTMLDivElement>(null);
//     const [showMetrics, setShowMetrics] = useState(true);

//     // Load replay data when modal opens
//     useEffect(() => {
//         if (isOpen && session?.sessionId) {
//             engine.loadReplay(session.sessionId);
//         }
//         return () => {
//             engine.cleanup();
//         };
//     }, [isOpen, session?.sessionId]);

//     // Auto-scroll to bottom as items appear
//     useEffect(() => {
//         const container = chatContainerRef.current;
//         if (!container) return;
//         // Only auto-scroll if near bottom
//         const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
//         if (isNearBottom || engine.state === 'playing') {
//             requestAnimationFrame(() => {
//                 container.scrollTop = container.scrollHeight;
//             });
//         }
//     }, [engine.visibleItems.length]);

//     // Keyboard shortcuts
//     useEffect(() => {
//         if (!isOpen) return;
//         const handler = (e: KeyboardEvent) => {
//             if (e.key === 'Escape') { onClose(); return; }
//             if (e.key === ' ' || e.key === 'k') {
//                 e.preventDefault();
//                 if (engine.state === 'playing') engine.pause();
//                 else engine.play();
//             }
//             if (e.key === 'r' || e.key === 'R') { engine.restart(); }
//             if (e.key === 'ArrowRight') {
//                 e.preventDefault();
//                 engine.seekTo(Math.min(engine.currentIndex + 5, (engine.data?.timeline.length || 1) - 1));
//             }
//             if (e.key === 'ArrowLeft') {
//                 e.preventDefault();
//                 engine.seekTo(Math.max(engine.currentIndex - 5, 0));
//             }
//         };
//         window.addEventListener('keydown', handler);
//         return () => window.removeEventListener('keydown', handler);
//     }, [isOpen, engine.state, engine.currentIndex]);

//     // Export handler
//     const handleExport = useCallback(async () => {
//         if (!session?.sessionId) return;
//         try {
//             const { api } = await import('../services/api');
//             const res = await api.get<any>(`/api/replay/${session.sessionId}/export`);
//             if (res.ok) {
//                 const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
//                 const url = URL.createObjectURL(blob);
//                 const a = document.createElement('a');
//                 a.href = url;
//                 a.download = `replay-${session.sessionId}-${Date.now()}.json`;
//                 a.click();
//                 URL.revokeObjectURL(url);
//             }
//         } catch { /* silently fail */ }
//     }, [session?.sessionId]);

//     if (!isOpen) return null;

//     // Build visible items with silence markers
//     const renderItems = () => {
//         const items: JSX.Element[] = [];
//         let lastDate = '';

//         for (let i = 0; i < engine.visibleItems.length; i++) {
//             const item = engine.visibleItems[i];
//             const isNew = i === engine.visibleItems.length - 1 && engine.state === 'playing';

//             // Date separator
//             const itemDate = new Date(item.timestamp).toDateString();
//             if (itemDate !== lastDate) {
//                 items.push(<DateSeparator key={`date-${itemDate}`} date={new Date(item.timestamp)} />);
//                 lastDate = itemDate;
//             }

//             // Silence block (if gap from previous item > threshold)
//             if (i > 0) {
//                 const prev = new Date(engine.visibleItems[i - 1].timestamp).getTime();
//                 const curr = new Date(item.timestamp).getTime();
//                 const gap = curr - prev;
//                 if (gap >= SILENCE_THRESHOLD) {
//                     items.push(<SilenceBlock key={`silence-${i}`} durationMs={gap} animate={isNew} />);
//                 }
//             }

//             // Render item
//             if (item.kind === 'event') {
//                 items.push(<EventPill key={item.id} item={item} animate={isNew} />);
//             } else {
//                 items.push(
//                     <ReplayBubble key={item.id} item={item} session={session} animate={isNew} />
//                 );
//             }
//         }
//         return items;
//     };

//     return (
//         <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950">
//             {/* ========= TOP BAR ========= */}
//             <div className="flex items-center justify-between px-5 py-3 bg-zinc-900/80 border-b border-zinc-800 backdrop-blur-xl">
//                 <div className="flex items-center gap-3">
//                     {/* Replay badge */}
//                     <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-xl">
//                         <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
//                         <span className="text-xs font-black text-red-400 uppercase r">Replay Mode</span>
//                     </div>
//                     <ChannelBadge channel={session.channel} />
//                     <div className="min-w-0">
//                         <p className="text-sm font-bold text-zinc-50 truncate">
//                             {session.user?.firstName || session.channelMetadata?.visitorName || 'Usuario'}
//                             {session.user?.username && <span className="text-zinc-500 font-normal ml-1">@{session.user.username}</span>}
//                         </p>
//                         <p className="text-[10px] text-zinc-500">
//                             {session.sessionId.slice(-12)} · {session.status}
//                             {engine.data?.session.assignedAgent && ` · Agente: ${engine.data.session.assignedAgent.name}`}
//                         </p>
//                     </div>
//                 </div>

//                 <div className="flex items-center gap-2">
//                     {engine.data && <CountsBadge metrics={engine.data.metrics} />}
//                     <button
//                         onClick={() => setShowMetrics(!showMetrics)}
//                         className={`p-2 rounded-lg transition-colors ${showMetrics ? 'bg-blue-500/20 text-blue-400' : 'text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800'}`}
//                         title="Métricas"
//                     >
//                         <Gauge className="w-4 h-4" />
//                     </button>
//                     <button onClick={handleExport} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-50 transition-colors" title="Exportar JSON">
//                         <Download className="w-4 h-4" />
//                     </button>
//                     <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-50 transition-colors" title="Cerrar (ESC)">
//                         <X className="w-4 h-4" />
//                     </button>
//                 </div>
//             </div>

//             {/* ========= METRICS BAR (collapsible) ========= */}
//             {showMetrics && engine.data && (
//                 <div className="px-5 py-3 bg-zinc-900/40 border-b border-zinc-800/50 animate-in fade-in slide-in-from-top-2 duration-200">
//                     <MetricsBar metrics={engine.data.metrics} session={engine.data.session} />
//                 </div>
//             )}

//             {/* ========= CHAT AREA ========= */}
//             <div className="flex-1 overflow-hidden flex flex-col">
//                 {engine.loading ? (
//                     <div className="flex-1 flex items-center justify-center text-zinc-500">
//                         <div className="text-center space-y-3">
//                             <Loader2 className="w-8 h-8 animate-spin mx-auto" />
//                             <p className="text-sm">Cargando replay...</p>
//                         </div>
//                     </div>
//                 ) : engine.error ? (
//                     <div className="flex-1 flex items-center justify-center text-zinc-500">
//                         <div className="text-center space-y-3">
//                             <AlertTriangle className="w-8 h-8 mx-auto text-red-400" />
//                             <p className="text-sm text-red-400">{engine.error}</p>
//                         </div>
//                     </div>
//                 ) : engine.data ? (
//                     <>
//                         {/* Chat messages area */}
//                         <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
//                             {engine.visibleItems.length === 0 && engine.state === 'idle' && (
//                                 <div className="flex-1 flex items-center justify-center h-full text-zinc-500">
//                                     <div className="text-center space-y-4">
//                                         <Play className="w-16 h-16 mx-auto text-zinc-700" />
//                                         <div>
//                                             <p className="text-lg font-bold text-zinc-400">Listo para reproducir</p>
//                                             <p className="text-sm text-zinc-600 mt-1">
//                                                 {engine.data.timeline.length} items · {formatDuration(engine.data.metrics.totalDuration)}
//                                             </p>
//                                         </div>
//                                         <button
//                                             onClick={engine.play}
//                                             className="mx-auto flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-zinc-50 font-bold transition-all shadow-lg shadow-blue-900/30"
//                                         >
//                                             <Play className="w-5 h-5" /> Reproducir Conversación
//                                         </button>
//                                         <p className="text-[10px] text-zinc-600 mt-2">
//                                             Atajos: Espacio = play/pause · R = restart · ← → = saltar · ESC = salir
//                                         </p>
//                                     </div>
//                                 </div>
//                             )}
//                             {renderItems()}
//                         </div>

//                         {/* ========= TIMELINE SCRUBBER ========= */}
//                         <div className="px-5 py-2 bg-zinc-900/60 border-t border-zinc-800/50">
//                             <ReplayTimeline
//                                 timeline={engine.data.timeline}
//                                 currentIndex={engine.currentIndex}
//                                 onSeek={engine.seekTo}
//                             />
//                         </div>

//                         {/* ========= PLAYER CONTROLS ========= */}
//                         <div className="flex items-center justify-between px-5 py-3 bg-zinc-900/80 border-t border-zinc-800 backdrop-blur-xl">
//                             {/* Left: controls */}
//                             <div className="flex items-center gap-2">
//                                 <button
//                                     onClick={engine.restart}
//                                     className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-50 transition-colors"
//                                     title="Restart (R)"
//                                 >
//                                     <SkipBack className="w-4 h-4" />
//                                 </button>
//                                 <button
//                                     onClick={() => engine.state === 'playing' ? engine.pause() : engine.play()}
//                                     className="p-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-zinc-50 shadow-lg shadow-blue-900/30 transition-all"
//                                     title={engine.state === 'playing' ? 'Pausa (Espacio)' : 'Play (Espacio)'}
//                                 >
//                                     {engine.state === 'playing'
//                                         ? <Pause className="w-5 h-5" />
//                                         : <Play className="w-5 h-5" />}
//                                 </button>
//                                 <SpeedSelector speed={engine.speed} onChange={engine.changeSpeed} />
//                             </div>

//                             {/* Center: time progress */}
//                             <div className="flex items-center gap-3 text-sm text-zinc-400">
//                                 <span className="font-mono text-zinc-50">{formatDurationShort(engine.elapsedTime)}</span>
//                                 <span className="text-zinc-600">/</span>
//                                 <span className="font-mono text-zinc-500">{formatDurationShort(engine.data.metrics.totalDuration)}</span>
//                                 <span className="text-[10px] text-zinc-600 ml-2">
//                                     {Math.max(0, engine.currentIndex + 1)} / {engine.data.timeline.length}
//                                 </span>
//                             </div>

//                             {/* Right: status */}
//                             <div className="flex items-center gap-3">
//                                 {engine.state === 'finished' && (
//                                     <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">
//                                         ✓ Replay completado
//                                     </span>
//                                 )}
//                                 {engine.state === 'paused' && (
//                                     <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-full border border-amber-500/30">
//                                         ⏸ Pausado
//                                     </span>
//                                 )}
//                                 {engine.state === 'playing' && (
//                                     <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-bold rounded-full border border-blue-500/30 flex items-center gap-1.5">
//                                         <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
//                                         Reproduciendo {engine.speed > 1 ? `${engine.speed}x` : ''}
//                                     </span>
//                                 )}
//                             </div>
//                         </div>
//                     </>
//                 ) : null}
//             </div>

//             {/* ========= READ-ONLY INPUT BAR (visual indicator) ========= */}
//             <div className="px-5 py-3 bg-zinc-900/50 border-t border-zinc-800/50">
//                 <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-800/50 border border-zinc-700/30 rounded-xl opacity-50 cursor-not-allowed">
//                     <Shield className="w-4 h-4 text-zinc-600" />
//                     <span className="text-sm text-zinc-600 font-medium">Modo solo lectura — Replay activo</span>
//                 </div>
//             </div>
//         </div>
//     );
// }

/**
 * ChatReplayModal - Premium Zinc Refactor
 * Enterprise QA Replay Suite with high-fidelity playback controls
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Play, Pause, SkipBack, X, Download, Clock, MessageSquare,
  User, Bot, Shield, Volume2, FileText,
  Maximize2, Gauge, ArrowRightLeft, Timer,
  Zap, Hash, Loader2, AlertTriangle, MonitorPlay, Lock, ClipboardCheck
} from 'lucide-react';
import {
  useReplayEngine,
  formatDuration,
  formatDurationShort,
  SILENCE_THRESHOLD,
  type ReplayTimelineItem,
  type PlaybackSpeed,
} from '../hooks/useReplayEngine';
import ReplayTimeline, { EventPill, SilenceBlock } from './ReplayTimeline';
import QAReviewPanel from './QAReviewPanel';
import type { ChatSession } from '../types';

interface ChatReplayModalProps {
  session: ChatSession;
  isOpen: boolean;
  onClose: () => void;
}

// ============= HELPERS =============

function getProxyMediaUrl(mediaRef?: string): string | undefined {
  if (!mediaRef) return;
  if (mediaRef.startsWith('/api/') || mediaRef.startsWith('http')) return mediaRef;
  return `/api/media/${encodeURIComponent(mediaRef)}`;
}

const CHANNEL_CONFIG: Record<string, { label: string; color: string; border: string }> = {
  telegram: { label: 'Telegram', color: 'text-sky-400 bg-sky-500/10', border: 'border-sky-500/20' },
  whatsapp: { label: 'WhatsApp', color: 'text-emerald-400 bg-emerald-500/10', border: 'border-emerald-500/20' },
  web: { label: 'WebChat', color: 'text-indigo-400 bg-indigo-500/10', border: 'border-indigo-500/20' },
  instagram: { label: 'Instagram', color: 'text-pink-400 bg-pink-500/10', border: 'border-pink-500/20' },
  email: { label: 'Email', color: 'text-amber-400 bg-amber-500/10', border: 'border-amber-500/20' },
};

// ============= SUB-COMPONENTS =============

function ChannelBadge({ channel }: { channel: string }) {
  const conf = CHANNEL_CONFIG[channel] || { label: channel, color: 'text-zinc-400 bg-zinc-800', border: 'border-zinc-700' };
  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase r rounded border ${conf.color} ${conf.border}`}>
      {conf.label}
    </span>
  );
}

function ReplayBubble({ item, session, animate }: { item: ReplayTimelineItem; session: ChatSession; animate: boolean }) {
  const isAgent = item.sender === 'agent';
  const isBot = item.sender === 'bot';
  const isSystem = item.sender === 'system' || item.messageType === 'system';
  const mediaUrl = getProxyMediaUrl(item.mediaUrl);

  if (isSystem) {
    return (
      <div className={`flex justify-center my-3 ${animate ? 'animate-in fade-in slide-in-from-bottom-1 duration-300' : ''}`}>
        <span className="px-3 py-1 text-[10px] font-medium text-zinc-500 bg-zinc-900/50 border border-zinc-800 rounded-full flex items-center gap-1.5">
          <Hash className="w-3 h-3" /> {item.content}
        </span>
      </div>
    );
  }

  const renderMedia = () => {
    if (!mediaUrl) return null;
    return (
      <div className="mt-2 mb-1 overflow-hidden rounded-lg border border-white/10">
        {item.messageType === 'image' && <img src={mediaUrl} className="max-w-[240px] max-h-60 object-cover" loading="lazy" />}
        {item.messageType === 'video' && <video src={mediaUrl} controls className="max-w-[240px] max-h-60 bg-black" />}
        {item.messageType === 'sticker' && <img src={mediaUrl} className="w-24 h-24 object-contain" />}
        {(item.messageType === 'audio' || item.messageType === 'voice') && (
          <div className="flex items-center gap-2 p-2 bg-zinc-900/50 min-w-[200px]">
            <Volume2 className="w-4 h-4" /> <span className="text-xs">Audio Clip</span>
          </div>
        )}
        {(item.messageType === 'file' || item.messageType === 'document') && (
          <div className="flex items-center gap-2 p-2 bg-zinc-900/50 min-w-[200px]">
            <FileText className="w-4 h-4" /> 
            <span className="text-xs truncate max-w-[150px]">{item.fileName || 'Documento'}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex w-full ${isAgent ? 'justify-end' : 'justify-start'} mb-3 ${animate ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''}`}>
      <div className={`flex max-w-[75%] gap-3 ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
          isAgent ? 'bg-indigo-600 border-indigo-500' : isBot ? 'bg-purple-600 border-purple-500' : 'bg-zinc-800 border-zinc-700'
        }`}>
          {isAgent ? (
            item.senderAgent?.avatar 
              ? <img src={item.senderAgent.avatar} className="w-full h-full rounded-full object-cover" />
              : <span className="text-xs font-bold text-zinc-50">{item.senderAgent?.name?.[0] || 'A'}</span>
          ) : isBot ? <Bot className="w-4 h-4 text-zinc-50" /> : <User className="w-4 h-4 text-zinc-400" />}
        </div>

        {/* Bubble */}
        <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
          <div className="flex items-center gap-2 mb-1 px-1">

            <span className="text-[12px] font-bold text-zinc-300 max-w-[200px] truncate" title={isAgent ? item.senderAgent?.name : isBot ? 'Bot' : (session.user?.firstName || 'Usuario')}>
              {isAgent ? item.senderAgent?.name : isBot ? 'Bot' : (session.user?.firstName || 'Usuario')} en nombre de {session.channel} Trelk Bot Support
            </span>
            <span className="text-[11px] text-zinc-500">
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          <div className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
            isAgent 
              ? 'bg-indigo-600 text-zinc-50 rounded-tr-sm' 
              : isBot 
                ? 'bg-purple-900/40 border border-purple-500/20 text-purple-100 rounded-tl-sm'
                : 'bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-tl-sm'
          }`}>
            {item.replyToMessage && (
              <div className="mb-2 pl-2 border-l-2 border-white/20 text-[10px] opacity-70">
                Respuesta a: {item.replyToMessage.content.substring(0, 30)}...
              </div>
            )}
            
            {renderMedia()}
            
            {item.content && (item.messageType === 'text' || !item.mediaUrl) && (
              <p className="whitespace-pre-wrap">{item.content}</p>
            )}
            {item.content && item.mediaUrl && item.messageType !== 'text' && (
              <p className="text-xs mt-1 opacity-80">{item.content}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricsCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="flex flex-col items-center justify-center p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
      <div className={`flex items-center gap-1.5 ${color} mb-1`}>
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase r">{label}</span>
      </div>
      <span className="text-sm font-mono font-bold text-zinc-200">{value}</span>
    </div>
  );
}

// ============= MAIN COMPONENT =============

export default function ChatReplayModal({ session, isOpen, onClose }: ChatReplayModalProps) {
  const engine = useReplayEngine();
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showQA, setShowQA] = useState(false);

  // --- Effects ---
  useEffect(() => {
    if (isOpen && session?.sessionId) engine.loadReplay(session.sessionId);
    return () => engine.cleanup();
  }, [isOpen, session?.sessionId]);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container && (engine.state === 'playing' || engine.visibleItems.length === 1)) {
      requestAnimationFrame(() => container.scrollTop = container.scrollHeight);
    }
  }, [engine.visibleItems.length, engine.state]);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.code === 'Space') { e.preventDefault(); engine.state === 'playing' ? engine.pause() : engine.play(); }
      if (e.key === 'ArrowRight') engine.seekTo(Math.min(engine.currentIndex + 5, (engine.data?.timeline.length || 1) - 1));
      if (e.key === 'ArrowLeft') engine.seekTo(Math.max(engine.currentIndex - 5, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, engine.state, engine.currentIndex]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] flex flex-col bg-zinc-950 animate-in fade-in duration-300">
      
      {/* ================= HEADER ================= */}
      <div className="flex items-center justify-between px-6 py-3 bg-zinc-950 border-b border-zinc-800 shadow-sm z-20">
        
        {/* Left: Info */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <MonitorPlay className="w-5 h-5 text-indigo-500" />
              Replay de Sesión
            </h2>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
              <span className="font-mono text-zinc-400">#{session.sessionId.slice(-8)}</span>
              <span>•</span>
              <ChannelBadge channel={session.channel} />
              <span>•</span>
              <span>{new Date(session.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowQA(!showQA)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all ${showQA ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'}`}
            title="Evaluar este chat (QA)"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span className="text-xs font-medium">QA</span>
          </button>
          <button 
            onClick={() => setShowMetrics(!showMetrics)}
            className={`p-2 rounded-lg border transition-all ${showMetrics ? 'bg-zinc-800 border-zinc-700 text-zinc-100' : 'bg-transparent border-transparent text-zinc-500 hover:text-zinc-300'}`}
            title="Alternar Métricas"
          >
            <Gauge className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-zinc-800 mx-1" />
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ================= METRICS PANEL ================= */}
      {showMetrics && engine.data && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-px bg-zinc-800 border-b border-zinc-800">
          <div className="bg-zinc-950 p-3">
            <MetricsCard icon={Timer} label="Duración" value={formatDuration(engine.data.metrics.totalDuration)} color="text-zinc-400" />
          </div>
          <div className="bg-zinc-950 p-3">
            <MetricsCard icon={Gauge} label="T. Respuesta" value={formatDuration(engine.data.metrics.avgAgentResponseTime)} color="text-emerald-400" />
          </div>
          <div className="bg-zinc-950 p-3">
            <MetricsCard icon={Clock} label="Max Silencio" value={formatDuration(engine.data.metrics.maxSilenceGap)} color="text-amber-400" />
          </div>
          <div className="bg-zinc-950 p-3">
            <MetricsCard icon={Zap} label="1ra Resp" value={formatDuration(engine.data.metrics.firstResponseTime)} color="text-indigo-400" />
          </div>
          <div className="bg-zinc-950 p-3">
            <MetricsCard icon={MessageSquare} label="Mensajes" value={engine.data.metrics.totalMessages} color="text-blue-400" />
          </div>
          <div className="bg-zinc-950 p-3">
            <MetricsCard icon={ArrowRightLeft} label="Transf." value={engine.data.metrics.transfers} color="text-orange-400" />
          </div>
        </div>
      )}

      {/* ================= VIEWPORT + QA PANEL ================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat replay area */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-zinc-950">
        
        {/* Loading / Error States */}
        {engine.loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-10">
            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          </div>
        ) : engine.error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-10 text-red-400 gap-3">
            <AlertTriangle className="w-12 h-12" />
            <p>{engine.error}</p>
          </div>
        ) : !engine.data ? null : (
          <>
            {/* Chat Content */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 md:px-20 py-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {/* Start Marker */}
              <div className="flex justify-center mb-8">
                <div className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-500 flex items-center gap-2">
                  <Play className="w-3 h-3" /> Inicio de la grabación
                </div>
              </div>

              {/* Items Render */}
              {engine.visibleItems.map((item, idx) => {
                const isLast = idx === engine.visibleItems.length - 1;
                const prevItem = engine.visibleItems[idx - 1];
                
                // Silence Gap Detection
                let silenceEl = null;
                if (prevItem) {
                  const gap = new Date(item.timestamp).getTime() - new Date(prevItem.timestamp).getTime();
                  if (gap >= SILENCE_THRESHOLD) {
                    silenceEl = <SilenceBlock durationMs={gap} animate={isLast && engine.state === 'playing'} />;
                  }
                }

                if (item.kind === 'event') {
                  return <div key={item.id}>{silenceEl}<EventPill item={item} animate={isLast && engine.state === 'playing'} /></div>;
                }
                
                return (
                  <div key={item.id}>
                    {silenceEl}
                    <ReplayBubble item={item} session={session} animate={isLast && engine.state === 'playing'} />
                  </div>
                );
              })}

              {/* End Marker */}
              {engine.state === 'finished' && (
                <div className="flex justify-center mt-8 pb-8 animate-in fade-in slide-in-from-bottom-4">
                  <div className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2">
                    <Shield className="w-3 h-3" /> Fin de la sesión
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        </div>

        {/* ================= QA REVIEW SIDE PANEL ================= */}
        {showQA && session?.assignedAgent && (
          <div className="w-[380px] border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800 bg-zinc-900/60">
              <ClipboardCheck className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-zinc-200 flex-1">Evaluación QA</h3>
              <button onClick={() => setShowQA(false)} className="text-zinc-500 hover:text-zinc-50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <QAReviewPanel
                sessionId={session.sessionId}
                agentId={typeof session.assignedAgent === 'object' ? (session.assignedAgent as any)._id : session.assignedAgent}
                compact={false}
                onReviewSaved={() => {}}
              />
            </div>
          </div>
        )}
      </div>

      {/* ================= CONTROLS FOOTER ================= */}
      {engine.data && (
        <div className="bg-zinc-900 border-t border-zinc-800 p-4 pb-6 z-20">
          
          {/* Timeline Scrubber */}
          <div className="mb-4 px-2">
            <ReplayTimeline
              timeline={engine.data.timeline}
              currentIndex={engine.currentIndex}
              onSeek={engine.seekTo}
            />
          </div>

          {/* Controls Bar */}
          <div className="flex items-center justify-between">
            
            {/* Playback Controls */}
            <div className="flex items-center gap-4">
              <button 
                onClick={engine.restart}
                className="p-2 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors"
                title="Reiniciar (R)"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              <button 
                onClick={() => engine.state === 'playing' ? engine.pause() : engine.play()}
                className="w-12 h-12 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-zinc-50 rounded-full shadow-lg shadow-indigo-500/20 transition-transform hover:scale-105 active:scale-95"
              >
                {engine.state === 'playing' ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <div className="flex items-center gap-2 ml-2">
                {[1, 2, 5, 10].map(s => (
                  <button
                    key={s}
                    onClick={() => engine.changeSpeed(s as PlaybackSpeed)}
                    className={`px-2 py-1 text-xs font-bold rounded-md transition-colors ${
                      engine.speed === s 
                        ? 'bg-zinc-700 text-zinc-50' 
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Time Display */}
            <div className="flex items-center gap-2 font-mono text-sm">
              <span className="text-zinc-100">{formatDurationShort(engine.elapsedTime)}</span>
              <span className="text-zinc-600">/</span>
              <span className="text-zinc-500">{formatDurationShort(engine.data.metrics.totalDuration)}</span>
            </div>

            {/* Read Only Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg opacity-60">
              <Lock className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs font-medium text-zinc-500 uppercase ">Solo Lectura</span>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
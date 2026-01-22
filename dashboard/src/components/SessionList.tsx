// // Session List component with Tabs (My Chats/All/Queue/Closed)
// import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// import { useChatStore } from '../stores/chatStore';
// import { useAuthStore } from '../stores/authStore';
// import { 
//   Clock, 
//   User, 
//   CheckCircle, 
//   MessageSquare, 
//   Search, 
//   Calendar,
//   Archive,
//   MessageCircle,
//   X,
//   ChevronDown,
//   Loader2,
//   AlertCircle,
//   UserX,
//   Inbox,
//   Users,
//   Sparkles,
//   Eye
// } from 'lucide-react';
// import type { ChatSession } from '../types';

// type DateFilter = 'today' | 'week' | 'month' | 'all';

// export default function SessionList() {
//   const { token, agent: currentAgent } = useAuthStore();
//   const { 
//     sessions, 
//     queueSessions,
//     closedSessions,
//     activeSession, 
//     setActiveSession,
//     setSessions,
//     setQueueSessions,
//     setClosedSessions,
//     activeTab,
//     setActiveTab,
//     searchQuery,
//     setSearchQuery,
//     dateFilter,
//     setDateFilter,
//     sessionCounts,
//     setSessionCounts,
//     isLoadingSessions,
//     setLoadingSessions,
//     currentPage,
//     hasMore,
//     setPagination,
//     moveToClosedSessions,
//     removeFromQueue,
//     addSession,
//   } = useChatStore();

//   const [showDateDropdown, setShowDateDropdown] = useState(false);
//   const [localSearch, setLocalSearch] = useState(searchQuery);

//   // Track new sessions for highlight animation
//   const [newSessionIds, setNewSessionIds] = useState<Set<string>>(new Set());
//   const previousSessionIdsRef = useRef<Set<string>>(new Set());

//   // Admin/Supervisor check and filtered sessions
//   const isAdminOrSupervisor = currentAgent?.role === 'admin' || currentAgent?.role === 'supervisor';

//   // My sessions - only sessions I'm ACTIVELY attending (human or waiting for response)
//   // Exclude: bot, queued, closed - these are not "my active chats"
//   const mySessions = useMemo(() => 
//     sessions.filter(s => 
//       s.assignedAgent?._id === currentAgent?._id && 
//       (s.status === 'human' || s.status === 'waiting')
//     ),
//     [sessions, currentAgent?._id]
//   );

//   // All active sessions (for admin/supervisor view) - only human attended chats
//   const allActiveSessions = useMemo(() => 
//     sessions.filter(s => s.status === 'human' || s.status === 'waiting'), 
//     [sessions]
//   );

//   // Debounce search
//   useEffect(() => {
//     const timer = setTimeout(() => {
//       setSearchQuery(localSearch);
//     }, 300);
//     return () => clearTimeout(timer);
//   }, [localSearch, setSearchQuery]);

//   // Detect new sessions and animate them
//   useEffect(() => {
//     const currentSessionIds = new Set([
//       ...sessions.map(s => s.sessionId),
//       ...queueSessions.map(s => s.sessionId),
//     ]);

//     const previousIds = previousSessionIdsRef.current;
//     const newIds = new Set<string>();

//     currentSessionIds.forEach(id => {
//       if (!previousIds.has(id)) {
//         newIds.add(id);
//       }
//     });

//     if (newIds.size > 0) {
//       setNewSessionIds(prev => new Set([...prev, ...newIds]));

//       // Clear highlight after animation completes (3s)
//       setTimeout(() => {
//         setNewSessionIds(prev => {
//           const updated = new Set(prev);
//           newIds.forEach(id => updated.delete(id));
//           return updated;
//         });
//       }, 3000);
//     }

//     previousSessionIdsRef.current = currentSessionIds;
//   }, [sessions, queueSessions]);

//   // Fetch session counts
//   const fetchCounts = useCallback(async () => {
//     try {
//       const res = await fetch('/api/sessions/counts', {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       if (data.ok) {
//         setSessionCounts(data.counts);
//       }
//     } catch (error) {
//       console.error('Failed to fetch counts:', error);
//     }
//   }, [token, setSessionCounts]);

//   // Fetch queue sessions
//   const fetchQueue = useCallback(async () => {
//     try {
//       const res = await fetch('/api/sessions/queue', {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();
//       if (data.ok) {
//         setQueueSessions(data.sessions);
//       }
//     } catch (error) {
//       console.error('Failed to fetch queue:', error);
//     }
//   }, [token, setQueueSessions]);

//   // Fetch sessions based on tab and filters
//   const fetchSessions = useCallback(async (page = 1) => {
//     setLoadingSessions(true);
//     try {
//       if (activeTab === 'queue') {
//         await fetchQueue();
//         setLoadingSessions(false);
//         return;
//       }

//       // Map 'all' tab to 'open' status for API
//       const apiStatus = activeTab === 'all' ? 'open' : activeTab;

//       const params = new URLSearchParams({
//         status: apiStatus,
//         page: page.toString(),
//         limit: '50',
//       });

//       if (searchQuery) params.set('search', searchQuery);
//       if (dateFilter !== 'all') params.set('dateFilter', dateFilter);

//       const res = await fetch(`/api/sessions/filtered?${params}`, {
//         headers: { Authorization: `Bearer ${token}` },
//       });
//       const data = await res.json();

//       if (data.ok) {
//         if (activeTab === 'open' || activeTab === 'all') {
//           setSessions(data.sessions);
//         } else if (activeTab === 'closed') {
//           setClosedSessions(data.sessions);
//         }
//         setPagination({
//           page: data.page,
//           totalPages: data.totalPages,
//           hasMore: data.hasMore,
//         });
//       }
//     } catch (error) {
//       console.error('Failed to fetch sessions:', error);
//     } finally {
//       setLoadingSessions(false);
//     }
//   }, [activeTab, searchQuery, dateFilter, token, setSessions, setClosedSessions, setPagination, setLoadingSessions]);

//   // Fetch on mount and when filters change
//   useEffect(() => {
//     fetchSessions();
//     fetchCounts();
//     if (activeTab === 'queue') {
//       fetchQueue();
//     }
//   }, [fetchSessions, fetchCounts, fetchQueue, activeTab]);

//   // Listen for chat:closed events from socket
//   useEffect(() => {
//     const handleChatClosed = (event: CustomEvent) => {
//       const { sessionId, session } = event.detail;
//       if (session) {
//         moveToClosedSessions(sessionId, session);
//       }
//       fetchCounts();
//     };

//     // Listen for session:assigned events (auto-assignment)
//     const handleSessionAssigned = (event: CustomEvent) => {
//       const { sessionId } = event.detail;
//       console.log('Session assigned to me:', sessionId);
//       // Remove from queue and refresh my sessions
//       removeFromQueue(sessionId);
//       fetchSessions();
//       fetchCounts();
//     };

//     // Listen for session:reopened events (move to open tab)
//     const handleSessionReopened = (event: CustomEvent) => {
//       const { sessionId, session } = event.detail;
//       console.log('Session reopened:', sessionId);
//       // Remove from closed sessions
//       setClosedSessions(closedSessions.filter(s => s.sessionId !== sessionId));
//       // Add to open sessions if we have the session data
//       if (session) {
//         addSession(session);
//       }
//       // Switch to open tab automatically
//       setActiveTab('open');
//       // Refresh sessions and counts
//       fetchSessions();
//       fetchCounts();
//     };

//     window.addEventListener('chat:closed' as never, handleChatClosed as never);
//     window.addEventListener('session:assigned' as never, handleSessionAssigned as never);
//     window.addEventListener('session:reopened' as never, handleSessionReopened as never);
//     return () => {
//       window.removeEventListener('chat:closed' as never, handleChatClosed as never);
//       window.removeEventListener('session:assigned' as never, handleSessionAssigned as never);
//       window.removeEventListener('session:reopened' as never, handleSessionReopened as never);
//     };
//   }, [moveToClosedSessions, fetchCounts, removeFromQueue, fetchSessions, setActiveTab, addSession, setClosedSessions, closedSessions]);

//   // Determine which sessions to show based on tab
//   const currentSessions = useMemo(() => {
//     switch (activeTab) {
//       case 'open':
//         return mySessions; // Only my assigned sessions
//       case 'all':
//         return allActiveSessions; // All active sessions (admin/supervisor)
//       case 'queue':
//         return queueSessions;
//       case 'closed':
//         return closedSessions;
//       default:
//         return [];
//     }
//   }, [activeTab, mySessions, allActiveSessions, queueSessions, closedSessions]);

//   // Sort sessions: waiting first, then by last update
//   const sortedSessions = [...currentSessions].sort((a, b) => {
//     if (activeTab === 'open' || activeTab === 'all') {
//       if (a.status === 'waiting' && b.status !== 'waiting') return -1;
//       if (b.status === 'waiting' && a.status !== 'waiting') return 1;
//     }
//     if (activeTab === 'queue') {
//       // Queue is FIFO, oldest first
//       return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
//     }
//     return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
//   });

//   const getStatusColor = (status: string) => {
//     switch (status) {
//       case 'waiting': return 'bg-warning';
//       case 'queued': return 'bg-orange-500';
//       case 'human': return 'bg-secondary';
//       case 'bot': return 'bg-primary';
//       case 'closed': return 'bg-gray-500';
//       default: return 'bg-gray-500';
//     }
//   };

//   const getStatusIcon = (status: string) => {
//     switch (status) {
//       case 'waiting': return Clock;
//       case 'queued': return Inbox;
//       case 'human': return User;
//       case 'closed': return CheckCircle;
//       default: return MessageSquare;
//     }
//   };

//   const formatTime = (date: string) => {
//     const d = new Date(date);
//     const now = new Date();
//     const diff = now.getTime() - d.getTime();

//     if (diff < 60000) return 'Ahora';
//     if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
//     if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
//     return d.toLocaleDateString();
//   };

//   const getCloseReasonLabel = (session: ChatSession) => {
//     if (!session.closeReason) return null;
//     const labels: Record<string, string> = {
//       manual: session.closedByType === 'agent' ? 'Cerrado por agente' : 'Cerrado por usuario',
//       automation: 'Cerrado vía automatización',
//       inactivity: 'Inactividad',
//       resolved: 'Resuelto',
//       spam: 'Spam',
//     };
//     return labels[session.closeReason] || session.closeReason;
//   };

//   const dateFilterLabels: Record<DateFilter, string> = {
//     today: 'Hoy',
//     week: '7 días',
//     month: '30 días',
//     all: 'Todos',
//   };

//   return (
//     <div className="flex flex-col h-full overflow-hidden">
//       {/* Tabs */}
//       <div className="flex border-b border-gray-800">
//         <button
//           onClick={() => setActiveTab('open')}
//           className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-sm font-medium transition-all ${
//             activeTab === 'open'
//               ? 'text-primary border-b-2 border-primary bg-primary/5'
//               : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
//           }`}
//         >
//           <MessageCircle className="w-4 h-4" />
//           <span className="hidden sm:inline">Mis Chats</span>
//           {mySessions.length > 0 && (
//             <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
//               activeTab === 'open' ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'
//             }`}>
//               {mySessions.length}
//             </span>
//           )}
//         </button>

//         {/* All Chats Tab - Only for Admin/Supervisor */}
//         {isAdminOrSupervisor && (
//           <button
//             onClick={() => setActiveTab('all')}
//             className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-sm font-medium transition-all ${
//               activeTab === 'all'
//                 ? 'text-purple-500 border-b-2 border-purple-500 bg-purple-500/5'
//                 : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
//             }`}
//           >
//             <Eye className="w-4 h-4" />
//             <span className="hidden sm:inline">Todos</span>
//             {allActiveSessions.length > 0 && (
//               <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
//                 activeTab === 'all' ? 'bg-purple-500 text-white' : 'bg-purple-900 text-purple-300'
//               }`}>
//                 {allActiveSessions.length}
//               </span>
//             )}
//           </button>
//         )}

//         <button
//           onClick={() => setActiveTab('queue')}
//           className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-sm font-medium transition-all ${
//             activeTab === 'queue'
//               ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/5'
//               : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
//           }`}
//         >
//           <Inbox className="w-4 h-4" />
//           <span className="hidden sm:inline">Cola</span>
//           {sessionCounts.queue > 0 && (
//             <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
//               activeTab === 'queue' ? 'bg-orange-500 text-white' : 'bg-orange-900 text-orange-300'
//             }`}>
//               {sessionCounts.queue}
//             </span>
//           )}
//         </button>

//         <button
//           onClick={() => setActiveTab('closed')}
//           className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-sm font-medium transition-all ${
//             activeTab === 'closed'
//               ? 'text-primary border-b-2 border-primary bg-primary/5'
//               : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
//           }`}
//         >
//           <Archive className="w-4 h-4" />
//           <span className="hidden sm:inline">Cerrados</span>
//           {sessionCounts.closed > 0 && (
//             <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
//               activeTab === 'closed' ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'
//             }`}>
//               {sessionCounts.closed > 99 ? '99+' : sessionCounts.closed}
//             </span>
//           )}
//         </button>
//       </div>

//       {/* Search & Filters */}
//       <div className="p-3 border-b border-gray-800 space-y-2">
//         {/* Search */}
//         <div className="relative">
//           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
//           <input
//             type="text"
//             value={localSearch}
//             onChange={(e) => setLocalSearch(e.target.value)}
//             placeholder="Buscar por username o ID..."
//             className="w-full pl-10 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
//           />
//           {localSearch && (
//             <button
//               onClick={() => setLocalSearch('')}
//               className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
//             >
//               <X className="w-4 h-4" />
//             </button>
//           )}
//         </div>

//         {/* Date Filter - Only for closed tab */}
//         {activeTab === 'closed' && (
//           <div className="relative">
//             <button
//               onClick={() => setShowDateDropdown(!showDateDropdown)}
//               className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700"
//             >
//               <Calendar className="w-4 h-4" />
//               <span>{dateFilterLabels[dateFilter]}</span>
//               <ChevronDown className="w-3 h-3" />
//             </button>

//             {showDateDropdown && (
//               <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1 min-w-32">
//                 {(Object.entries(dateFilterLabels) as [DateFilter, string][]).map(([key, label]) => (
//                   <button
//                     key={key}
//                     onClick={() => {
//                       setDateFilter(key);
//                       setShowDateDropdown(false);
//                     }}
//                     className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-700 ${
//                       dateFilter === key ? 'text-primary' : 'text-gray-300'
//                     }`}
//                   >
//                     {label}
//                   </button>
//                 ))}
//               </div>
//             )}
//           </div>
//         )}
//       </div>

//       {/* Loading State */}
//       {isLoadingSessions && (
//         <div className="flex-1 flex items-center justify-center p-4">
//           <Loader2 className="w-6 h-6 text-primary animate-spin" />
//         </div>
//       )}

//       {/* Empty State */}
//       {!isLoadingSessions && sortedSessions.length === 0 && (
//         <div className="flex-1 flex items-center justify-center p-4">
//           <div className="text-center">
//             {activeTab === 'open' ? (
//               <>
//                 <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
//                 <p className="text-gray-500 text-sm">No hay chats abiertos</p>
//                 <p className="text-gray-600 text-xs mt-1">Los nuevos mensajes aparecerán aquí</p>
//               </>
//             ) : (
//               <>
//                 <Archive className="w-12 h-12 text-gray-700 mx-auto mb-3" />
//                 <p className="text-gray-500 text-sm">No hay historial</p>
//                 {searchQuery && (
//                   <p className="text-gray-600 text-xs mt-1">Prueba con otra búsqueda</p>
//                 )}
//               </>
//             )}
//           </div>
//         </div>
//       )}

//       {/* Sessions List */}
//       {!isLoadingSessions && sortedSessions.length > 0 && (
//         <div className="flex-1 overflow-y-auto scrollbar-thin">
//           {sortedSessions.map((session) => {
//             const StatusIcon = getStatusIcon(session.status);
//             const isActive = activeSession?.sessionId === session.sessionId;
//             const isClosed = session.status === 'closed';
//             const isNew = newSessionIds.has(session.sessionId);

//             return (
//               <button
//                 key={session.sessionId}
//                 onClick={() => setActiveSession(session)}
//                 className={`w-full p-4 border-b border-gray-800 hover:bg-gray-800/50 transition-colors text-left relative ${
//                   isActive ? 'bg-gray-800/70' : ''
//                 } ${isClosed ? 'opacity-80' : ''} ${
//                   isNew ? 'animate-slide-up-fade bg-primary/10' : ''
//                 }`}
//               >
//                 {/* New badge */}
//                 {isNew && (
//                   <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-white text-xs font-bold animate-pulse-highlight">
//                     <Sparkles className="w-3 h-3" />
//                     <span>Nuevo</span>
//                   </div>
//                 )}

//                 <div className="flex items-start gap-3">
//                   {/* Avatar */}
//                   <div className="relative flex-shrink-0">
//                     <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
//                       isClosed ? 'bg-gray-600' : 'bg-gray-700'
//                     }`}>
//                       {session.user?.firstName?.charAt(0)?.toUpperCase() || '?'}
//                     </div>
//                     <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${getStatusColor(session.status)}`} />
//                   </div>

//                   {/* Content */}
//                   <div className="flex-1 min-w-0">
//                     <div className="flex items-center justify-between gap-2">
//                       <span className="font-medium text-white truncate">
//                         {session.user?.firstName || 'Usuario desconocido'}
//                         {session.user?.username && (
//                           <span className="text-gray-500 font-normal ml-1">@{session.user.username}</span>
//                         )}
//                       </span>
//                       <span className="text-xs text-gray-500 flex-shrink-0">
//                         {formatTime(isClosed && session.closedAt ? session.closedAt : session.updatedAt)}
//                       </span>
//                     </div>

//                     <div className="flex items-center gap-2 mt-1 flex-wrap">
//                       {/* Status Badge */}
//                       <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
//                         session.status === 'waiting' 
//                           ? 'bg-warning/20 text-warning' 
//                           : session.status === 'human'
//                             ? 'bg-secondary/20 text-secondary'
//                             : session.status === 'closed'
//                               ? 'bg-gray-700 text-gray-400'
//                               : 'bg-gray-700 text-gray-400'
//                       }`}>
//                         <StatusIcon className="w-3 h-3" />
//                         <span className="capitalize">
//                           {session.status === 'waiting' ? 'En espera' : 
//                            session.status === 'human' ? 'Activo' :
//                            session.status === 'closed' ? 'Cerrado' : 
//                            session.status}
//                         </span>
//                       </div>

//                       {/* Close Reason for closed sessions */}
//                       {isClosed && session.closeReason && (
//                         <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-500">
//                           {session.closeReason === 'inactivity' ? (
//                             <AlertCircle className="w-3 h-3" />
//                           ) : session.closedByType === 'user' ? (
//                             <UserX className="w-3 h-3" />
//                           ) : (
//                             <User className="w-3 h-3" />
//                           )}
//                           <span>{getCloseReasonLabel(session)}</span>
//                         </div>
//                       )}

//                       {/* Unread count for open sessions */}
//                       {!isClosed && session.unreadCount && session.unreadCount > 0 && (
//                         <span className="px-1.5 py-0.5 bg-primary text-white text-xs font-bold rounded-full">
//                           {session.unreadCount}
//                         </span>
//                       )}

//                       {/* Show agent badge in "All" tab for sessions not assigned to me */}
//                       {activeTab === 'all' && session.assignedAgent && session.assignedAgent._id !== currentAgent?._id && (
//                         <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
//                           <Eye className="w-3 h-3" />
//                           <span>{session.assignedAgent.name}</span>
//                         </div>
//                       )}
//                     </div>

//                     {/* Assigned Agent - only show in non-All tabs */}
//                     {session.assignedAgent && !isClosed && activeTab !== 'all' && (
//                       <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
//                         <User className="w-3 h-3" />
//                         <span>{session.assignedAgent.name}</span>
//                       </div>
//                     )}

//                     {/* Last Message Preview */}
//                     {session.lastMessage && (
//                       <p className="text-sm text-gray-500 truncate mt-1">
//                         {session.lastMessage}
//                       </p>
//                     )}
//                   </div>
//                 </div>
//               </button>
//             );
//           })}

//             {/* Load More */}
//           {hasMore && (
//             <button
//               onClick={() => fetchSessions(currentPage + 1)}
//               className="w-full p-3 text-sm text-primary hover:bg-gray-800/50"
//             >
//               Cargar más
//             </button>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }
















import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import {
  Clock, User, CheckCircle2, MessageSquare, Search, Calendar, Archive,
  MessageCircle, X, ChevronDown, Loader2, Inbox, Users, Sparkles,
  Bot, AlertCircle, UserX, TimerOff, ShieldAlert
} from 'lucide-react';
import type { ChatSession } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type DateFilter = 'today' | 'week' | 'month' | 'all';

// --- CONFIGURACIÓN VISUAL ---
const STATUS_STYLES: Record<string, { color: string, border: string, icon: any }> = {
  waiting: { color: 'text-amber-500', border: 'border-amber-500', icon: Clock },
  queued: { color: 'text-orange-500', border: 'border-orange-500', icon: Inbox },
  human: { color: 'text-indigo-500', border: 'border-indigo-500', icon: User },
  bot: { color: 'text-blue-500', border: 'border-blue-500', icon: Bot },
  closed: { color: 'text-slate-500', border: 'border-slate-400', icon: CheckCircle2 },
};

export default function SessionList() {
  const { token, agent: currentAgent } = useAuthStore();
  const {
    sessions, queueSessions, closedSessions, activeSession, setActiveSession,
    setSessions, setQueueSessions, setClosedSessions, activeTab, setActiveTab,
    searchQuery, setSearchQuery, dateFilter, setDateFilter, sessionCounts, setSessionCounts,
    isLoadingSessions, setLoadingSessions, currentPage, hasMore, setPagination,
    moveToClosedSessions, removeFromQueue, addSession,
  } = useChatStore();

  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [newSessionIds, setNewSessionIds] = useState<Set<string>>(new Set());
  const previousSessionIdsRef = useRef<Set<string>>(new Set());

  const isAdminOrSupervisor = currentAgent?.role === 'admin' || currentAgent?.role === 'supervisor';

  // --- LOGIC ---
  const mySessions = useMemo(() =>
    sessions.filter(s => s.assignedAgent?._id === currentAgent?._id && (s.status === 'human' || s.status === 'waiting')),
    [sessions, currentAgent?._id]
  );

  const allActiveSessions = useMemo(() =>
    sessions.filter(s => s.status === 'human' || s.status === 'waiting'),
    [sessions]
  );

  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(localSearch), 300);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  useEffect(() => {
    const currentSessionIds = new Set([...sessions.map(s => s.sessionId), ...queueSessions.map(s => s.sessionId)]);
    const previousIds = previousSessionIdsRef.current;
    const newIds = new Set<string>();

    currentSessionIds.forEach(id => {
      if (!previousIds.has(id)) newIds.add(id);
    });

    if (newIds.size > 0) {
      setNewSessionIds(prev => new Set([...prev, ...newIds]));
      setTimeout(() => {
        setNewSessionIds(prev => {
          const updated = new Set(prev);
          newIds.forEach(id => updated.delete(id));
          return updated;
        });
      }, 3000);
    }
    previousSessionIdsRef.current = currentSessionIds;
  }, [sessions, queueSessions]);

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions/counts', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setSessionCounts(data.counts);
    } catch (error) { console.error('Failed to fetch counts:', error); }
  }, [token, setSessionCounts]);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions/queue', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setQueueSessions(data.sessions);
    } catch (error) { console.error('Failed to fetch queue:', error); }
  }, [token, setQueueSessions]);

  const fetchSessions = useCallback(async (page = 1) => {
    setLoadingSessions(true);
    try {
      if (activeTab === 'queue') {
        await fetchQueue();
        setLoadingSessions(false);
        return;
      }
      const apiStatus = activeTab === 'all' ? 'open' : activeTab;
      const params = new URLSearchParams({ status: apiStatus, page: page.toString(), limit: '50' });
      if (searchQuery) params.set('search', searchQuery);
      if (dateFilter !== 'all') params.set('dateFilter', dateFilter);

      const res = await fetch(`/api/sessions/filtered?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();

      if (data.ok) {
        if (activeTab === 'open' || activeTab === 'all') setSessions(data.sessions);
        else if (activeTab === 'closed') setClosedSessions(data.sessions);
        setPagination({ page: data.page, totalPages: data.totalPages, hasMore: data.hasMore });
      }
    } catch (error) { console.error('Failed to fetch sessions:', error); }
    finally { setLoadingSessions(false); }
  }, [activeTab, searchQuery, dateFilter, token, setSessions, setClosedSessions, setPagination, setLoadingSessions]);

  useEffect(() => {
    fetchSessions();
    fetchCounts();
    if (activeTab === 'queue') fetchQueue();
  }, [fetchSessions, fetchCounts, fetchQueue, activeTab]);

  // Event Listeners (Socket)
  useEffect(() => {
    const handleChatClosed = (event: CustomEvent) => {
      const { sessionId, session } = event.detail;
      if (session) moveToClosedSessions(sessionId, session);
      fetchCounts();
    };
    const handleSessionAssigned = (event: CustomEvent) => {
      const { sessionId } = event.detail;
      removeFromQueue(sessionId);
      fetchSessions();
      fetchCounts();
    };
    const handleSessionReopened = (event: CustomEvent) => {
      const { sessionId, session } = event.detail;
      setClosedSessions(closedSessions.filter(s => s.sessionId !== sessionId));
      if (session) addSession(session);
      setActiveTab('open');
      fetchSessions();
      fetchCounts();
    };

    window.addEventListener('chat:closed' as never, handleChatClosed as never);
    window.addEventListener('session:assigned' as never, handleSessionAssigned as never);
    window.addEventListener('session:reopened' as never, handleSessionReopened as never);
    return () => {
      window.removeEventListener('chat:closed' as never, handleChatClosed as never);
      window.removeEventListener('session:assigned' as never, handleSessionAssigned as never);
      window.removeEventListener('session:reopened' as never, handleSessionReopened as never);
    };
  }, [moveToClosedSessions, fetchCounts, removeFromQueue, fetchSessions, setActiveTab, addSession, setClosedSessions, closedSessions]);

  const currentSessions = useMemo(() => {
    switch (activeTab) {
      case 'open': return mySessions;
      case 'all': return allActiveSessions;
      case 'queue': return queueSessions;
      case 'closed': return closedSessions;
      default: return [];
    }
  }, [activeTab, mySessions, allActiveSessions, queueSessions, closedSessions]);

  const sortedSessions = useMemo(() => {
    return [...currentSessions].sort((a, b) => {
      if (activeTab === 'open' || activeTab === 'all') {
        if (a.status === 'waiting' && b.status !== 'waiting') return -1;
        if (b.status === 'waiting' && a.status !== 'waiting') return 1;
      }
      if (activeTab === 'queue') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [currentSessions, activeTab]);

  // --- RENDER ---

  const dateFilterLabels: Record<DateFilter, string> = { today: 'Hoy', week: '7 días', month: '30 días', all: 'Histórico' };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0f1117] dark:border-gray-800 overflow-hidden">

      {/* 1. Tabs Navigation */}
      <div className="flex items-center justify-between px-2 pt-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#0f1117] h-[56px]">
        <TabButton
          isActive={activeTab === 'open'}
          onClick={() => setActiveTab('open')}
          icon={MessageCircle}
          label="Míos"
          count={mySessions.length}
          activeColor="text-indigo-600 dark:text-indigo-400 border-indigo-600 dark:border-indigo-400"
        />
        {isAdminOrSupervisor && (
          <TabButton
            isActive={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
            icon={Users}
            label="Todos"
            count={allActiveSessions.length}
            activeColor="text-violet-600 dark:text-violet-400 border-violet-600 dark:border-violet-400"
          />
        )}
        <TabButton
          isActive={activeTab === 'queue'}
          onClick={() => setActiveTab('queue')}
          icon={Inbox}
          label="Cola"
          count={sessionCounts.queue}
          activeColor="text-orange-500 border-orange-500"
        />
        <TabButton
          isActive={activeTab === 'closed'}
          onClick={() => setActiveTab('closed')}
          icon={Archive}
          label="Fin"
          count={0} // Opcional: sessionCounts.closed
          activeColor="text-gray-600 dark:text-gray-400 border-gray-600 dark:border-gray-400"
        />
      </div>

      {/* 2. Search & Filters Bar */}
      <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0f1117]">
        <div className="flex gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar chat..."
              className="w-full pl-9 pr-8 py-2 bg-gray-100 dark:bg-gray-800/50 border border-transparent dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {localSearch && (
              <button
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Date Filter Dropdown (Closed Tab) */}
          {activeTab === 'closed' && (
            <div className="relative">
              <button
                onClick={() => setShowDateDropdown(!showDateDropdown)}
                className="h-full px-3 flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800/50 border border-transparent dark:border-gray-700 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>
              {showDateDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDateDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                    {(Object.entries(dateFilterLabels) as [DateFilter, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => { setDateFilter(key); setShowDateDropdown(false); }}
                        className={`w-full px-3 py-2 text-xs text-left flex items-center justify-between ${dateFilter === key
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                          }`}
                      >
                        {label}
                        {dateFilter === key && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3. Session List Area */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 bg-gray-50/30 dark:bg-transparent">

        {/* Loading */}
        {isLoadingSessions && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-xs text-gray-400 font-medium">Cargando conversaciones...</p>
          </div>
        )}

        {/* Empty States */}
        {!isLoadingSessions && sortedSessions.length === 0 && (
          <EmptyState activeTab={activeTab} hasSearch={!!searchQuery} />
        )}

        {/* List */}
        {!isLoadingSessions && sortedSessions.length > 0 && (
          <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {sortedSessions.map((session) => (
              <SessionItem
                key={session.sessionId}
                session={session}
                isActive={activeSession?.sessionId === session.sessionId}
                isNew={newSessionIds.has(session.sessionId)}
                currentAgentId={currentAgent?._id}
                onClick={() => setActiveSession(session)}
              />
            ))}

            {hasMore && (
              <div className="p-4">
                <button
                  onClick={() => fetchSessions(currentPage + 1)}
                  className="w-full py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                >
                  Cargar más antiguos
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

const TabButton = ({ isActive, onClick, icon: Icon, label, count, activeColor }: any) => (
  <button
    onClick={onClick}
    className={`
      flex-1 flex flex-col items-center justify-center gap-1 py-1 px-1 relative transition-all duration-200
      ${isActive ? activeColor : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 border-transparent'}
      border-b-2
    `}
  >
    <div className="relative">
      <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
      {count > 0 && (
        <span className={`
          absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center px-0.5 rounded-full text-[9px] font-bold ring-2 ring-white dark:ring-[#0f1117]
          ${isActive ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}
        `}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
    <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
  </button>
);

const EmptyState = ({ activeTab, hasSearch }: { activeTab: string, hasSearch: boolean }) => (
  <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center opacity-60">
    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
      {activeTab === 'queue' ? <Inbox className="w-8 h-8 text-gray-400" /> :
        activeTab === 'closed' ? <Archive className="w-8 h-8 text-gray-400" /> :
          <MessageSquare className="w-8 h-8 text-gray-400" />}
    </div>
    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
      {hasSearch ? 'Sin resultados' :
        activeTab === 'queue' ? 'La cola está vacía' :
          activeTab === 'closed' ? 'No hay chats cerrados' : 'Estás al día'}
    </h3>
    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
      {hasSearch ? 'Intenta con otros términos de búsqueda.' :
        activeTab === 'queue' ? '¡Excelente! No hay clientes esperando.' :
          'Los nuevos mensajes aparecerán aquí.'}
    </p>
  </div>
);

// --- HELPER PARA RAZÓN DE CIERRE ---
const getClosureDetails = (session: ChatSession) => {
  let icon = CheckCircle2;
  let label = 'Finalizado';
  let color = 'text-gray-500 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';

  if (session.closeReason === 'inactivity') {
    icon = TimerOff;
    label = 'Inactividad';
    color = 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800';
  } else if (session.closeReason === 'spam') {
    icon = ShieldAlert;
    label = 'Spam';
    color = 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800';
  } else if (session.closedByType === 'user') {
    icon = UserX;
    label = 'Por usuario';
    color = 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700';
  } else if (session.closedByType === 'agent') {
    icon = CheckCircle2;
    label = `Por agente: ${session.closedBy || 'Sistema'}`;
    color = 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800';
  }

  return { icon, label, color };
};

const getCloseReasonLabel = (session: ChatSession) => {
  if (!session.closeReason) return null;
  const labels: Record<string, string> = {
    manual: session.closedByType === 'agent' ? 'Cerrado por agente' : 'Cerrado por usuario',
    automation: 'Cerrado vía automatización',
    inactivity: 'Inactividad',
    resolved: 'Resuelto',
    spam: 'Spam',
  };
  return labels[session.closeReason] || session.closeReason;
};
// Memoized Session Item for performance
const SessionItem = memo(({ session, isActive, isNew, currentAgentId, onClick }: any) => {
  const isClosed = session.status === 'closed';
  const style = STATUS_STYLES[session.status] || STATUS_STYLES.closed;
  const StatusIcon = style.icon;
  const showUnread = !isClosed && session.unreadCount > 0;

  // Datos de cierre (si aplica)
  const closureInfo = isClosed ? getClosureDetails(session) : null;
  const ClosureIcon = closureInfo?.icon;

  // Format Time Logic
  const timeDisplay = useMemo(() => {
    const date = new Date(isClosed ? session.closedAt : session.updatedAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Ahora';
    if (diff < 86400000 && now.getDate() === date.getDate()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }, [session.updatedAt, session.closedAt, isClosed]);

  return (
    <div
      onClick={onClick}
      className={`
        group relative w-full p-3.5 flex gap-3 cursor-pointer border-l-4 transition-all duration-200
        ${isActive
          ? 'bg-indigo-50/80 dark:bg-indigo-900/10 border-indigo-500'
          : 'bg-white dark:bg-[#0f1117] border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/30'}
        ${isNew ? 'animate-pulse bg-indigo-50 dark:bg-indigo-900/20' : ''}
        ${isClosed && !isActive ? 'opacity-75 hover:opacity-100 grayscale-[0.3] hover:grayscale-0' : ''} 
      `}
    >
      {/* Avatar Section */}
      <div className="relative shrink-0">
        <div className={`
          w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm
          ${isClosed ? 'bg-slate-400 dark:bg-slate-700' : 'bg-gradient-to-br from-indigo-500 to-purple-600'}
        `}>
          {
            session.user?.photoFileId ? (
              <img
                src={`/api/media/${session.user.photoFileId}`}
                alt="Avatar"
                className="w-11 h-11 rounded-full object-cover"
              />
            ) : (
              <span>
                {session.user?.firstName?.charAt(0)?.toUpperCase() || '?'}
              </span>
            )
          }
        </div>
        {/* Status Dot (Solo si no está cerrado, o indicador discreto si lo está) */}
        {!isClosed && (
          <div className={`
            absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-white dark:bg-[#0f1117] flex items-center justify-center
            `}>
            <div className={`w-2.5 h-2.5 rounded-full ${style.color.replace('text-', 'bg-')}`} />
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">

        {/* Top Row: Name & Time */}
        <div className="flex justify-between items-baseline mb-0.5">
          <h4 className={`text-sm font-semibold truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-100'} ${isClosed ? 'text-slate-600 dark:text-slate-400 line-through decoration-slate-300 dark:decoration-slate-600' : ''}`}>
            {session.user?.firstName || 'Usuario'}
            {session.user?.lastName ? ` ${session.user.lastName}` : ''}
          </h4>
          <span className={`text-[10px] shrink-0 font-medium ${showUnread ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
            {timeDisplay}
          </span>
        </div>

        {/* Middle Row: Message Preview or Closure Reason */}
        {!isClosed ? (
          <p className={`text-xs truncate leading-relaxed ${showUnread ? 'text-gray-800 dark:text-gray-200 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
            {session.lastMessage || <span className="italic opacity-70">Sin mensajes</span>}
          </p>
        ) : (
          <p className="text-xs truncate leading-relaxed text-gray-400 italic">
            {/* Chat archivado - {session.lastMessage?.slice(0, 30)}... */}
          </p>
        )}

        {/* Bottom Row: Badges */}
        <div className="flex items-center gap-1.5 mt-1.5">

          {/* Active Status Badge */}
          {!isClosed && (
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border dark:bg-opacity-10 ${style.border} border-opacity-20 ${style.color} bg-white dark:bg-gray-800/50`}>
              <StatusIcon className="w-2.5 h-2.5" />
              <span className="capitalize">{session.status === 'human' ? 'Activo' : session.status}</span>
            </span>
          )}

          {/* CLOSURE BADGE (Nuevo diseño para cerrados) */}
          {isClosed && closureInfo && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${closureInfo.color}`}>
              {ClosureIcon && <ClosureIcon className="w-3 h-3" />}
              <span>{getCloseReasonLabel(session) || 'Cerrado'}</span>

            </span>

          )}

          {/* Assigned Agent (if viewing all) */}
          {session.assignedAgent && session.assignedAgent._id !== currentAgentId && !isClosed && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
              <User className="w-2.5 h-2.5" />
              {session.assignedAgent.name}
            </span>
          )}

          {/* Unread Badge */}
          {showUnread && (
            <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold shadow-sm">
              {session.unreadCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

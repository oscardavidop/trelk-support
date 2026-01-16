// Session List component with Tabs (My Chats/All/Queue/Closed)
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { 
  Clock, 
  User, 
  CheckCircle, 
  MessageSquare, 
  Search, 
  Calendar,
  Archive,
  MessageCircle,
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
  UserX,
  Inbox,
  Users,
  Sparkles,
  Eye
} from 'lucide-react';
import type { ChatSession } from '../types';

type DateFilter = 'today' | 'week' | 'month' | 'all';

export default function SessionList() {
  const { token, agent: currentAgent } = useAuthStore();
  const { 
    sessions, 
    queueSessions,
    closedSessions,
    activeSession, 
    setActiveSession,
    setSessions,
    setQueueSessions,
    setClosedSessions,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    sessionCounts,
    setSessionCounts,
    isLoadingSessions,
    setLoadingSessions,
    currentPage,
    hasMore,
    setPagination,
    moveToClosedSessions,
    removeFromQueue,
    addSession,
  } = useChatStore();

  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  
  // Track new sessions for highlight animation
  const [newSessionIds, setNewSessionIds] = useState<Set<string>>(new Set());
  const previousSessionIdsRef = useRef<Set<string>>(new Set());

  // Admin/Supervisor check and filtered sessions
  const isAdminOrSupervisor = currentAgent?.role === 'admin' || currentAgent?.role === 'supervisor';
  
  // My sessions - only sessions I'm ACTIVELY attending (human or waiting for response)
  // Exclude: bot, queued, closed - these are not "my active chats"
  const mySessions = useMemo(() => 
    sessions.filter(s => 
      s.assignedAgent?._id === currentAgent?._id && 
      (s.status === 'human' || s.status === 'waiting')
    ),
    [sessions, currentAgent?._id]
  );
  
  // All active sessions (for admin/supervisor view) - only human attended chats
  const allActiveSessions = useMemo(() => 
    sessions.filter(s => s.status === 'human' || s.status === 'waiting'), 
    [sessions]
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  // Detect new sessions and animate them
  useEffect(() => {
    const currentSessionIds = new Set([
      ...sessions.map(s => s.sessionId),
      ...queueSessions.map(s => s.sessionId),
    ]);
    
    const previousIds = previousSessionIdsRef.current;
    const newIds = new Set<string>();
    
    currentSessionIds.forEach(id => {
      if (!previousIds.has(id)) {
        newIds.add(id);
      }
    });
    
    if (newIds.size > 0) {
      setNewSessionIds(prev => new Set([...prev, ...newIds]));
      
      // Clear highlight after animation completes (3s)
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

  // Fetch session counts
  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions/counts', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSessionCounts(data.counts);
      }
    } catch (error) {
      console.error('Failed to fetch counts:', error);
    }
  }, [token, setSessionCounts]);

  // Fetch queue sessions
  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions/queue', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setQueueSessions(data.sessions);
      }
    } catch (error) {
      console.error('Failed to fetch queue:', error);
    }
  }, [token, setQueueSessions]);

  // Fetch sessions based on tab and filters
  const fetchSessions = useCallback(async (page = 1) => {
    setLoadingSessions(true);
    try {
      if (activeTab === 'queue') {
        await fetchQueue();
        setLoadingSessions(false);
        return;
      }
      
      // Map 'all' tab to 'open' status for API
      const apiStatus = activeTab === 'all' ? 'open' : activeTab;
      
      const params = new URLSearchParams({
        status: apiStatus,
        page: page.toString(),
        limit: '50',
      });
      
      if (searchQuery) params.set('search', searchQuery);
      if (dateFilter !== 'all') params.set('dateFilter', dateFilter);

      const res = await fetch(`/api/sessions/filtered?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (data.ok) {
        if (activeTab === 'open' || activeTab === 'all') {
          setSessions(data.sessions);
        } else if (activeTab === 'closed') {
          setClosedSessions(data.sessions);
        }
        setPagination({
          page: data.page,
          totalPages: data.totalPages,
          hasMore: data.hasMore,
        });
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, [activeTab, searchQuery, dateFilter, token, setSessions, setClosedSessions, setPagination, setLoadingSessions]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchSessions();
    fetchCounts();
    if (activeTab === 'queue') {
      fetchQueue();
    }
  }, [fetchSessions, fetchCounts, fetchQueue, activeTab]);

  // Listen for chat:closed events from socket
  useEffect(() => {
    const handleChatClosed = (event: CustomEvent) => {
      const { sessionId, session } = event.detail;
      if (session) {
        moveToClosedSessions(sessionId, session);
      }
      fetchCounts();
    };
    
    // Listen for session:assigned events (auto-assignment)
    const handleSessionAssigned = (event: CustomEvent) => {
      const { sessionId } = event.detail;
      console.log('Session assigned to me:', sessionId);
      // Remove from queue and refresh my sessions
      removeFromQueue(sessionId);
      fetchSessions();
      fetchCounts();
    };

    // Listen for session:reopened events (move to open tab)
    const handleSessionReopened = (event: CustomEvent) => {
      const { sessionId, session } = event.detail;
      console.log('Session reopened:', sessionId);
      // Remove from closed sessions
      setClosedSessions(closedSessions.filter(s => s.sessionId !== sessionId));
      // Add to open sessions if we have the session data
      if (session) {
        addSession(session);
      }
      // Switch to open tab automatically
      setActiveTab('open');
      // Refresh sessions and counts
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

  // Determine which sessions to show based on tab
  const currentSessions = useMemo(() => {
    switch (activeTab) {
      case 'open':
        return mySessions; // Only my assigned sessions
      case 'all':
        return allActiveSessions; // All active sessions (admin/supervisor)
      case 'queue':
        return queueSessions;
      case 'closed':
        return closedSessions;
      default:
        return [];
    }
  }, [activeTab, mySessions, allActiveSessions, queueSessions, closedSessions]);

  // Sort sessions: waiting first, then by last update
  const sortedSessions = [...currentSessions].sort((a, b) => {
    if (activeTab === 'open' || activeTab === 'all') {
      if (a.status === 'waiting' && b.status !== 'waiting') return -1;
      if (b.status === 'waiting' && a.status !== 'waiting') return 1;
    }
    if (activeTab === 'queue') {
      // Queue is FIFO, oldest first
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting': return 'bg-warning';
      case 'queued': return 'bg-orange-500';
      case 'human': return 'bg-secondary';
      case 'bot': return 'bg-primary';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting': return Clock;
      case 'queued': return Inbox;
      case 'human': return User;
      case 'closed': return CheckCircle;
      default: return MessageSquare;
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    if (diff < 60000) return 'Ahora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  };

  const getCloseReasonLabel = (session: ChatSession) => {
    if (!session.closeReason) return null;
    const labels: Record<string, string> = {
      manual: session.closedByType === 'agent' ? 'Cerrado por agente' : 'Cerrado por usuario',
      inactivity: 'Inactividad',
      resolved: 'Resuelto',
      spam: 'Spam',
    };
    return labels[session.closeReason] || session.closeReason;
  };

  const dateFilterLabels: Record<DateFilter, string> = {
    today: 'Hoy',
    week: '7 días',
    month: '30 días',
    all: 'Todos',
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setActiveTab('open')}
          className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-sm font-medium transition-all ${
            activeTab === 'open'
              ? 'text-primary border-b-2 border-primary bg-primary/5'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Mis Chats</span>
          {mySessions.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'open' ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'
            }`}>
              {mySessions.length}
            </span>
          )}
        </button>

        {/* All Chats Tab - Only for Admin/Supervisor */}
        {isAdminOrSupervisor && (
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-sm font-medium transition-all ${
              activeTab === 'all'
                ? 'text-purple-500 border-b-2 border-purple-500 bg-purple-500/5'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">Todos</span>
            {allActiveSessions.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'all' ? 'bg-purple-500 text-white' : 'bg-purple-900 text-purple-300'
              }`}>
                {allActiveSessions.length}
              </span>
            )}
          </button>
        )}
        
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-sm font-medium transition-all ${
            activeTab === 'queue'
              ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/5'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span className="hidden sm:inline">Cola</span>
          {sessionCounts.queue > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'queue' ? 'bg-orange-500 text-white' : 'bg-orange-900 text-orange-300'
            }`}>
              {sessionCounts.queue}
            </span>
          )}
        </button>
        
        <button
          onClick={() => setActiveTab('closed')}
          className={`flex-1 flex items-center justify-center gap-2 px-2 py-3 text-sm font-medium transition-all ${
            activeTab === 'closed'
              ? 'text-primary border-b-2 border-primary bg-primary/5'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
          }`}
        >
          <Archive className="w-4 h-4" />
          <span className="hidden sm:inline">Cerrados</span>
          {sessionCounts.closed > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              activeTab === 'closed' ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'
            }`}>
              {sessionCounts.closed > 99 ? '99+' : sessionCounts.closed}
            </span>
          )}
        </button>
      </div>

      {/* Search & Filters */}
      <div className="p-3 border-b border-gray-800 space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Buscar por username o ID..."
            className="w-full pl-10 pr-8 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date Filter - Only for closed tab */}
        {activeTab === 'closed' && (
          <div className="relative">
            <button
              onClick={() => setShowDateDropdown(!showDateDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-700"
            >
              <Calendar className="w-4 h-4" />
              <span>{dateFilterLabels[dateFilter]}</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            
            {showDateDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 py-1 min-w-32">
                {(Object.entries(dateFilterLabels) as [DateFilter, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setDateFilter(key);
                      setShowDateDropdown(false);
                    }}
                    className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-700 ${
                      dateFilter === key ? 'text-primary' : 'text-gray-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoadingSessions && (
        <div className="flex-1 flex items-center justify-center p-4">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      )}

      {/* Empty State */}
      {!isLoadingSessions && sortedSessions.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            {activeTab === 'open' ? (
              <>
                <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No hay chats abiertos</p>
                <p className="text-gray-600 text-xs mt-1">Los nuevos mensajes aparecerán aquí</p>
              </>
            ) : (
              <>
                <Archive className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No hay historial</p>
                {searchQuery && (
                  <p className="text-gray-600 text-xs mt-1">Prueba con otra búsqueda</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Sessions List */}
      {!isLoadingSessions && sortedSessions.length > 0 && (
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {sortedSessions.map((session) => {
            const StatusIcon = getStatusIcon(session.status);
            const isActive = activeSession?.sessionId === session.sessionId;
            const isClosed = session.status === 'closed';
            const isNew = newSessionIds.has(session.sessionId);
            
            return (
              <button
                key={session.sessionId}
                onClick={() => setActiveSession(session)}
                className={`w-full p-4 border-b border-gray-800 hover:bg-gray-800/50 transition-colors text-left relative ${
                  isActive ? 'bg-gray-800/70' : ''
                } ${isClosed ? 'opacity-80' : ''} ${
                  isNew ? 'animate-slide-up-fade bg-primary/10' : ''
                }`}
              >
                {/* New badge */}
                {isNew && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary text-white text-xs font-bold animate-pulse-highlight">
                    <Sparkles className="w-3 h-3" />
                    <span>Nuevo</span>
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${
                      isClosed ? 'bg-gray-600' : 'bg-gray-700'
                    }`}>
                      {session.user?.firstName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900 ${getStatusColor(session.status)}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-white truncate">
                        {session.user?.firstName || 'Usuario desconocido'}
                        {session.user?.username && (
                          <span className="text-gray-500 font-normal ml-1">@{session.user.username}</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatTime(isClosed && session.closedAt ? session.closedAt : session.updatedAt)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {/* Status Badge */}
                      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
                        session.status === 'waiting' 
                          ? 'bg-warning/20 text-warning' 
                          : session.status === 'human'
                            ? 'bg-secondary/20 text-secondary'
                            : session.status === 'closed'
                              ? 'bg-gray-700 text-gray-400'
                              : 'bg-gray-700 text-gray-400'
                      }`}>
                        <StatusIcon className="w-3 h-3" />
                        <span className="capitalize">
                          {session.status === 'waiting' ? 'En espera' : 
                           session.status === 'human' ? 'Activo' :
                           session.status === 'closed' ? 'Cerrado' : 
                           session.status}
                        </span>
                      </div>
                      
                      {/* Close Reason for closed sessions */}
                      {isClosed && session.closeReason && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-500">
                          {session.closeReason === 'inactivity' ? (
                            <AlertCircle className="w-3 h-3" />
                          ) : session.closedByType === 'user' ? (
                            <UserX className="w-3 h-3" />
                          ) : (
                            <User className="w-3 h-3" />
                          )}
                          <span>{getCloseReasonLabel(session)}</span>
                        </div>
                      )}
                      
                      {/* Unread count for open sessions */}
                      {!isClosed && session.unreadCount && session.unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-primary text-white text-xs font-bold rounded-full">
                          {session.unreadCount}
                        </span>
                      )}
                      
                      {/* Show agent badge in "All" tab for sessions not assigned to me */}
                      {activeTab === 'all' && session.assignedAgent && session.assignedAgent._id !== currentAgent?._id && (
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400">
                          <Eye className="w-3 h-3" />
                          <span>{session.assignedAgent.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Assigned Agent - only show in non-All tabs */}
                    {session.assignedAgent && !isClosed && activeTab !== 'all' && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                        <User className="w-3 h-3" />
                        <span>{session.assignedAgent.name}</span>
                      </div>
                    )}

                    {/* Last Message Preview */}
                    {session.lastMessage && (
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {session.lastMessage}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}

          {/* Load More */}
          {hasMore && (
            <button
              onClick={() => fetchSessions(currentPage + 1)}
              className="w-full p-3 text-sm text-primary hover:bg-gray-800/50"
            >
              Cargar más
            </button>
          )}
        </div>
      )}
    </div>
  );
}

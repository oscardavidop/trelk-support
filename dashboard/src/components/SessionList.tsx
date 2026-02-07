import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import {
  Clock, User, CheckCircle2, MessageSquare, Search, Calendar, Archive,
  MessageCircle, X, ChevronDown, Loader2, Inbox, Users, Sparkles,
  Bot, AlertCircle, UserX, TimerOff, ShieldAlert, Globe, Send
} from 'lucide-react';
import type { ChatSession, ChannelType } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

type DateFilter = 'today' | 'week' | 'month' | 'all';

// --- CHANNEL BADGE CONFIG ---
const CHANNEL_CONFIG: Record<ChannelType, { icon: any, label: string, color: string, bg: string }> = {
  telegram: { icon: Send, label: 'Telegram', color: 'text-sky-400', bg: 'bg-sky-500/10' },
  web: { icon: Globe, label: 'Web Chat', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  whatsapp: { icon: MessageCircle, label: 'WhatsApp', color: 'text-green-400', bg: 'bg-green-500/10' },
  instagram: { icon: MessageCircle, label: 'Instagram', color: 'text-pink-400', bg: 'bg-pink-500/10' },
  email: { icon: MessageSquare, label: 'Email', color: 'text-blue-400', bg: 'bg-blue-500/10' },
};

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
    searchQuery, setSearchQuery, dateFilter, setDateFilter, channelFilter, setChannelFilter,
    sessionCounts, setSessionCounts,
    isLoadingSessions, setLoadingSessions, currentPage, hasMore, setPagination,
    moveToClosedSessions, removeFromQueue, addSession,
  } = useChatStore();

  const [showDateDropdown, setShowDateDropdown] = useState(false);
  const [showChannelDropdown, setShowChannelDropdown] = useState(false);
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
    let sessions: ChatSession[];
    switch (activeTab) {
      case 'open': sessions = mySessions; break;
      case 'all': sessions = allActiveSessions; break;
      case 'queue': sessions = queueSessions; break;
      case 'closed': sessions = closedSessions; break;
      default: sessions = [];
    }
    // Apply channel filter
    if (channelFilter !== 'all') {
      sessions = sessions.filter(s => (s.channel || 'telegram') === channelFilter);
    }
    return sessions;
  }, [activeTab, mySessions, allActiveSessions, queueSessions, closedSessions, channelFilter]);

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

  const dateFilterLabels: Record<string, string> = { today: 'Hoy', week: '7 días', month: '30 días', all: 'Todo' };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800 w-80 shrink-0">
      
      {/* 1. Tabs Header */}
      <div className="flex items-center justify-between px-2 pt-2 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm h-14">
        <TabButton isActive={activeTab === 'open'} onClick={() => setActiveTab('open')} icon={MessageCircle} label="Míos" count={mySessions.length} activeColor="text-indigo-400 border-indigo-500" />
        {isAdminOrSupervisor && (
          <TabButton isActive={activeTab === 'all'} onClick={() => setActiveTab('all')} icon={Users} label="Todos" count={allActiveSessions.length} activeColor="text-violet-400 border-violet-500" />
        )}
        <TabButton isActive={activeTab === 'queue'} onClick={() => setActiveTab('queue')} icon={Inbox} label="Cola" count={sessionCounts.queue} activeColor="text-orange-400 border-orange-500" />
        <TabButton isActive={activeTab === 'closed'} onClick={() => setActiveTab('closed')} icon={Archive} label="Fin" count={0} activeColor="text-zinc-400 border-zinc-500" />
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="p-3 border-b border-zinc-800 bg-zinc-900/30">
        <div className="flex gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-9 pr-8 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:bg-zinc-900/80 transition-all"
            />
            {localSearch && (
              <button onClick={() => setLocalSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Channel Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowChannelDropdown(!showChannelDropdown)}
              className={`h-full px-3 flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-medium hover:text-white hover:border-zinc-700 transition-colors ${channelFilter !== 'all' ? 'text-indigo-400 border-indigo-500/50' : 'text-zinc-400'}`}
              title="Filtrar por canal"
            >
              {channelFilter !== 'all' ? (
                (() => { const cfg = CHANNEL_CONFIG[channelFilter]; const Icon = cfg.icon; return <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />; })()
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
              <ChevronDown className="w-3 h-3 opacity-70" />
            </button>
            {showChannelDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowChannelDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 w-36 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                  <button
                    onClick={() => { setChannelFilter('all'); setShowChannelDropdown(false); }}
                    className={`w-full px-3 py-2 text-xs text-left flex items-center gap-2 ${channelFilter === 'all' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Todos</span>
                    {channelFilter === 'all' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                  </button>
                  {(Object.keys(CHANNEL_CONFIG) as ChannelType[]).map((ch) => {
                    const cfg = CHANNEL_CONFIG[ch];
                    const ChIcon = cfg.icon;
                    return (
                      <button
                        key={ch}
                        onClick={() => { setChannelFilter(ch); setShowChannelDropdown(false); }}
                        className={`w-full px-3 py-2 text-xs text-left flex items-center gap-2 ${channelFilter === ch ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
                      >
                        <ChIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        <span>{cfg.label}</span>
                        {channelFilter === ch && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {activeTab === 'closed' && (
            <div className="relative">
              <button
                onClick={() => setShowDateDropdown(!showDateDropdown)}
                className="h-full px-3 flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
              >
                <Calendar className="w-3.5 h-3.5" />
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>
              {showDateDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDateDropdown(false)} />
                  <div className="absolute right-0 top-full mt-2 w-32 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                    {Object.entries(dateFilterLabels).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => { setDateFilter(key as any); setShowDateDropdown(false); }}
                        className={`w-full px-3 py-2 text-xs text-left flex items-center justify-between ${dateFilter === key ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
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

      {/* 3. Session List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoadingSessions ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <p className="text-xs text-zinc-500 font-medium">Cargando...</p>
          </div>
        ) : sortedSessions.length === 0 ? (
          <EmptyState activeTab={activeTab} hasSearch={!!searchQuery} />
        ) : (
          <div className=" divide-zinc-800/50">
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
                  className="w-full py-2 text-xs font-medium text-zinc-400 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors"
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

/////////



const TabButton = ({ isActive, onClick, icon: Icon, label, count, activeColor }: any) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center justify-center gap-1 py-1 relative transition-all duration-200 border-b-2 ${isActive ? activeColor : 'text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-zinc-900/30'}`}
  >
    <div className="relative">
      <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
      {count > 0 && (
        <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-4 flex items-center justify-center px-0.5 rounded-full text-[9px] font-bold border border-zinc-950 ${isActive ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-400'}`}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </div>
    <span className="text-[10px] font-medium  opacity-90">{label}</span>
  </button>
);

const EmptyState = ({ activeTab, hasSearch }: any) => (
  <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center opacity-40">
    <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center mb-3 border border-zinc-800">
      {activeTab === 'queue' ? <Inbox className="w-6 h-6 text-zinc-500" /> : <MessageSquare className="w-6 h-6 text-zinc-500" />}
    </div>
    <p className="text-sm text-zinc-400 font-medium">
      {hasSearch ? 'Sin resultados' : activeTab === 'queue' ? 'Cola vacía' : 'No hay chats'}
    </p>
  </div>
);

// --- SESSION ITEM ---
const STATUS_CONFIG: Record<string, { color: string, bg: string, border: string, icon: any, label: string }> = {
  waiting: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Clock, label: 'En espera' },
  queued: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: Inbox, label: 'En cola' },
  human: { color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', icon: User, label: 'Activo' },
  bot: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Bot, label: 'Bot' },
  closed: { color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', icon: CheckCircle2, label: 'Cerrado' },
};
const SessionItem = memo(({ session, isActive, isNew, currentAgentId, onClick }: any) => {
  const isClosed = session.status === 'closed';
  const config = STATUS_CONFIG[session.status] || STATUS_CONFIG.closed;
  const showUnread = !isClosed && session.unreadCount > 0;

  // Closure info
  const getClosureInfo = () => {
    if (session.closeReason === 'inactivity') return { icon: TimerOff, color: 'text-amber-500' };
    if (session.closeReason === 'spam') return { icon: ShieldAlert, color: 'text-red-500' };
    if (session.closedByType === 'user') return { icon: UserX, color: 'text-zinc-500' };
    return { icon: CheckCircle2, color: 'text-emerald-500' };
  };
  const closureInfo = isClosed ? getClosureInfo() : null;
  const ClosureIcon = closureInfo?.icon;

  // Time format
  const timeDisplay = useMemo(() => {
    const date = new Date(isClosed ? session.closedAt : session.updatedAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return 'Ahora';
    if (diff < 86400000 && now.getDate() === date.getDate()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  }, [session.updatedAt, session.closedAt, isClosed]);

  // Channel badge config
  const channel: ChannelType = session.channel || 'telegram';
  const channelConfig = CHANNEL_CONFIG[channel];
  const ChannelIcon = channelConfig.icon;

  return (
    <div
      onClick={onClick}
      className={`
        group relative p-3 flex gap-3 cursor-pointer border-l-2 transition-all duration-200
        ${isActive ? 'bg-zinc-900 border-indigo-500' : 'bg-transparent border-transparent hover:bg-zinc-900/40 hover:border-zinc-800'}
        ${isNew ? 'animate-pulse bg-indigo-900/10' : ''}
      `}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-inner border border-white/5 ${isClosed ? 'bg-zinc-800 text-zinc-500' : 'bg-gradient-to-br from-indigo-600 to-violet-700'}`}>
          {session.user?.photoFileId ? (
            <img src={`/api/media/${session.user.photoFileId}`} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <span>{session.user?.firstName?.charAt(0)?.toUpperCase() || '?'}</span>
          )}
        </div>
        {/* Channel indicator badge */}
        <div 
          className={`absolute -top-0.5 -left-0.5 w-4 h-4 rounded-full ${channelConfig.bg} flex items-center justify-center border border-zinc-950`}
          title={channelConfig.label}
        >
          <ChannelIcon className={`w-2.5 h-2.5 ${channelConfig.color}`} />
        </div>
        {!isClosed && (
           <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-zinc-950 flex items-center justify-center`}>
              <div className={`w-2 h-2 rounded-full ${config.color.replace('text-', 'bg-')}`} />
           </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex justify-between items-center mb-0.5">
          <h4 className={`text-sm font-medium truncate pr-2 ${isActive ? 'text-white' : 'text-zinc-300'} ${isClosed ? 'line-through text-zinc-600' : ''}`}>
            {session.user?.firstName || 'Usuario'} {session.user?.lastName || ''}
          </h4>
          <span className={`text-[10px] shrink-0 font-medium ${showUnread ? 'text-indigo-400' : 'text-zinc-600'}`}>
            {timeDisplay}
          </span>
        </div>

        <div className="flex justify-between items-center">
           <p className={`text-xs truncate max-w-[140px] ${showUnread ? 'text-zinc-100 font-medium' : 'text-zinc-500'} ${isClosed ? 'italic opacity-60' : ''}`}>
             {session.lastMessage || 'Sin mensajes'}
           </p>

           {/* Badges */}
           <div className="flex items-center gap-1.5 ml-2">
              {isClosed && ClosureIcon ? (
                 <ClosureIcon className={`w-3 h-3 ${closureInfo.color}`} />
              ) : showUnread ? (
                 <span className="min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full bg-indigo-500 text-white text-[9px] font-bold shadow-sm">
                    {session.unreadCount}
                 </span>
              ) : null}
              
              {/* Agent assignment indicator if not me */}
              {session.assignedAgent && session.assignedAgent._id !== currentAgentId && !isClosed && (
                 <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-400 border border-zinc-700" title={session.assignedAgent.name}>
                    {session.assignedAgent.name.charAt(0)}
                 </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
});
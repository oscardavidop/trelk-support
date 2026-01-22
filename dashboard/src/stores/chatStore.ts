// Chat/Sessions store
import { create } from 'zustand';
import type { ChatSession, Message, DashboardStats } from '../types';

type TabType = 'open' | 'all' | 'queue' | 'closed';
type DateFilter = 'today' | 'week' | 'month' | 'all';

interface SessionCounts {
  open: number;
  queue: number;
  closed: number;
  myActive: number;
}

interface ChatState {
  sessions: ChatSession[];
  queueSessions: ChatSession[];
  closedSessions: ChatSession[];
  activeSession: ChatSession | null;
  messages: Message[];
  stats: DashboardStats | null;
  isLoadingMessages: boolean;
  pinnedMessages: Record<string, Message>; // sessionId -> pinned message
  
  // Message pagination state
  hasMoreMessages: boolean;
  isLoadingOlderMessages: boolean;
  oldestMessageTimestamp: string | null;
  
  // Tab state
  activeTab: TabType;
  searchQuery: string;
  dateFilter: DateFilter;
  sessionCounts: SessionCounts;
  isLoadingSessions: boolean;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
  
  // Actions
  setSessions: (sessions: ChatSession[]) => void;
  setQueueSessions: (sessions: ChatSession[]) => void;
  setClosedSessions: (sessions: ChatSession[]) => void;
  addSession: (session: ChatSession) => void;
  addToQueue: (session: ChatSession) => void;
  removeFromQueue: (sessionId: string) => void;
  updateSession: (session: ChatSession) => void;
  removeSession: (sessionId: string) => void;
  moveToClosedSessions: (sessionId: string, session: ChatSession) => void;
  setActiveSession: (session: ChatSession | null) => void;
  setMessages: (messages: Message[], hasMore?: boolean, oldestTimestamp?: string | null) => void;
  prependMessages: (messages: Message[], hasMore: boolean, oldestTimestamp?: string | null) => void;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  deleteMessage: (messageId: string) => void;
  setStats: (stats: DashboardStats) => void;
  setLoadingMessages: (loading: boolean) => void;
  setLoadingOlderMessages: (loading: boolean) => void;
  setPinnedMessage: (sessionId: string, message: Message) => void;
  clearPinnedMessage: (sessionId: string) => void;
  
  // Tab actions
  setActiveTab: (tab: TabType) => void;
  setSearchQuery: (query: string) => void;
  setDateFilter: (filter: DateFilter) => void;
  setSessionCounts: (counts: SessionCounts) => void;
  setLoadingSessions: (loading: boolean) => void;
  setPagination: (data: { page: number; totalPages: number; hasMore: boolean }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  queueSessions: [],
  closedSessions: [],
  activeSession: null,
  messages: [],
  stats: null,
  isLoadingMessages: false,
  pinnedMessages: {},
  
  // Message pagination state
  hasMoreMessages: false,
  isLoadingOlderMessages: false,
  oldestMessageTimestamp: null,
  
  // Tab state defaults
  activeTab: 'open',
  searchQuery: '',
  dateFilter: 'all',
  sessionCounts: { open: 0, queue: 0, closed: 0, myActive: 0 },
  isLoadingSessions: false,
  currentPage: 1,
  totalPages: 1,
  hasMore: false,

  setSessions: (sessions) => set({ sessions }),
  
  setQueueSessions: (queueSessions) => set({ queueSessions }),
  
  setClosedSessions: (closedSessions) => set({ closedSessions }),
  
  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions.filter(s => s.sessionId !== session.sessionId)],
    // Also remove from queue if present
    queueSessions: state.queueSessions.filter(s => s.sessionId !== session.sessionId),
  })),
  
  addToQueue: (session) => set((state) => ({
    queueSessions: [session, ...state.queueSessions.filter(s => s.sessionId !== session.sessionId)],
    // Remove from regular sessions if present (shouldn't be, but safety)
    sessions: state.sessions.filter(s => s.sessionId !== session.sessionId),
  })),
  
  removeFromQueue: (sessionId) => set((state) => ({
    queueSessions: state.queueSessions.filter(s => s.sessionId !== sessionId),
  })),
  
  updateSession: (session) => set((state) => ({
    sessions: state.sessions.map(s => 
      s.sessionId === session.sessionId ? session : s
    ),
    queueSessions: state.queueSessions.map(s =>
      s.sessionId === session.sessionId ? session : s
    ),
    closedSessions: state.closedSessions.map(s =>
      s.sessionId === session.sessionId ? session : s
    ),
    activeSession: state.activeSession?.sessionId === session.sessionId 
      ? session 
      : state.activeSession,
  })),
  
  removeSession: (sessionId) => set((state) => ({
    sessions: state.sessions.filter(s => s.sessionId !== sessionId),
    queueSessions: state.queueSessions.filter(s => s.sessionId !== sessionId),
    activeSession: state.activeSession?.sessionId === sessionId 
      ? null 
      : state.activeSession,
  })),
  
  moveToClosedSessions: (sessionId, closedSession) => set((state) => ({
    sessions: state.sessions.filter(s => s.sessionId !== sessionId),
    queueSessions: state.queueSessions.filter(s => s.sessionId !== sessionId),
    closedSessions: [closedSession, ...state.closedSessions],
    sessionCounts: {
      open: Math.max(0, state.sessionCounts.open - 1),
      queue: state.sessionCounts.queue,
      closed: state.sessionCounts.closed + 1,
      myActive: Math.max(0, state.sessionCounts.myActive - 1),
    },
    activeSession: state.activeSession?.sessionId === sessionId 
      ? closedSession 
      : state.activeSession,
  })),
  
  setActiveSession: (session) => {
    const currentSession = get().activeSession;
    // Only clear messages if switching to a different session
    if (session?.sessionId !== currentSession?.sessionId) {
      set({ 
        activeSession: session, 
        messages: [],
        hasMoreMessages: false,
        oldestMessageTimestamp: null 
      });
    } else {
      // Same session, just update the session data but keep messages
      set({ activeSession: session });
    }
  },
  
  setMessages: (messages, hasMore = false, oldestTimestamp = null) => set({ 
    messages,
    hasMoreMessages: hasMore,
    oldestMessageTimestamp: oldestTimestamp 
  }),
  
  prependMessages: (newMessages, hasMore, oldestTimestamp = null) => {
    set((state) => ({
      messages: [...newMessages, ...state.messages],
      hasMoreMessages: hasMore,
      oldestMessageTimestamp: oldestTimestamp ?? state.oldestMessageTimestamp,
    }));
  },
  
  addMessage: (message) => {
    const { activeSession } = get();
    // Support both 'session' and 'sessionId' fields for compatibility
    const messageSessionId = message.session || (message as any).sessionId;
    if (activeSession && messageSessionId === activeSession.sessionId) {
      set((state) => ({
        messages: [...state.messages, message],
      }));
    }
  },
  
  updateMessage: (messageId, updates) => {
    set((state) => ({
      messages: state.messages.map(m => 
        m._id === messageId ? { ...m, ...updates } : m
      ),
    }));
  },
  
  deleteMessage: (messageId) => {
    set((state) => ({
      messages: state.messages.map(m => 
        m._id === messageId 
          ? { ...m, content: 'Mensaje eliminado por el agente', messageType: 'system' as const }
          : m
      ),
    }));
  },
  
  setStats: (stats) => set({ stats }),
  
  setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
  
  setLoadingOlderMessages: (loading) => set({ isLoadingOlderMessages: loading }),
  
  setPinnedMessage: (sessionId, message) => set((state) => ({
    pinnedMessages: { ...state.pinnedMessages, [sessionId]: message },
  })),
  
  clearPinnedMessage: (sessionId) => set((state) => {
    const { [sessionId]: _, ...rest } = state.pinnedMessages;
    return { pinnedMessages: rest };
  }),
  
  // Tab actions
  setActiveTab: (tab) => set({ activeTab: tab, currentPage: 1 }),
  
  setSearchQuery: (query) => set({ searchQuery: query, currentPage: 1 }),
  
  setDateFilter: (filter) => set({ dateFilter: filter, currentPage: 1 }),
  
  setSessionCounts: (counts) => set({ sessionCounts: counts }),
  
  setLoadingSessions: (loading) => set({ isLoadingSessions: loading }),
  
  setPagination: ({ page, totalPages, hasMore }) => set({ 
    currentPage: page, 
    totalPages, 
    hasMore 
  }),
}));

// Chat/Sessions store
import { create } from 'zustand';
import type { ChatSession, Message, DashboardStats } from '../types';

type TabType = 'open' | 'closed';
type DateFilter = 'today' | 'week' | 'month' | 'all';

interface SessionCounts {
  open: number;
  closed: number;
}

interface ChatState {
  sessions: ChatSession[];
  closedSessions: ChatSession[];
  activeSession: ChatSession | null;
  messages: Message[];
  stats: DashboardStats | null;
  isLoadingMessages: boolean;
  
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
  setClosedSessions: (sessions: ChatSession[]) => void;
  addSession: (session: ChatSession) => void;
  updateSession: (session: ChatSession) => void;
  removeSession: (sessionId: string) => void;
  moveToClosedSessions: (sessionId: string, session: ChatSession) => void;
  setActiveSession: (session: ChatSession | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  setStats: (stats: DashboardStats) => void;
  setLoadingMessages: (loading: boolean) => void;
  
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
  closedSessions: [],
  activeSession: null,
  messages: [],
  stats: null,
  isLoadingMessages: false,
  
  // Tab state defaults
  activeTab: 'open',
  searchQuery: '',
  dateFilter: 'all',
  sessionCounts: { open: 0, closed: 0 },
  isLoadingSessions: false,
  currentPage: 1,
  totalPages: 1,
  hasMore: false,

  setSessions: (sessions) => set({ sessions }),
  
  setClosedSessions: (closedSessions) => set({ closedSessions }),
  
  addSession: (session) => set((state) => ({
    sessions: [session, ...state.sessions.filter(s => s.sessionId !== session.sessionId)],
  })),
  
  updateSession: (session) => set((state) => ({
    sessions: state.sessions.map(s => 
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
    activeSession: state.activeSession?.sessionId === sessionId 
      ? null 
      : state.activeSession,
  })),
  
  moveToClosedSessions: (sessionId, closedSession) => set((state) => ({
    sessions: state.sessions.filter(s => s.sessionId !== sessionId),
    closedSessions: [closedSession, ...state.closedSessions],
    sessionCounts: {
      open: Math.max(0, state.sessionCounts.open - 1),
      closed: state.sessionCounts.closed + 1,
    },
    activeSession: state.activeSession?.sessionId === sessionId 
      ? closedSession 
      : state.activeSession,
  })),
  
  setActiveSession: (session) => {
    set({ activeSession: session, messages: [] });
  },
  
  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => {
    const { activeSession } = get();
    if (activeSession && message.session === activeSession.sessionId) {
      set((state) => ({
        messages: [...state.messages, message],
      }));
    }
  },
  
  setStats: (stats) => set({ stats }),
  
  setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
  
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

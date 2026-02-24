// Supervisor store - For supervisor/admin features
import { create } from 'zustand';

export interface AgentOverview {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'online' | 'away' | 'offline';
  availability: 'available' | 'busy' | 'unavailable';
  activeChats: number;
  maxChats: number;
  avgResponseTime: number;
  resolvedToday: number;
  lastActive: Date;
  sessions: Array<{
    id: string;
    user: { firstName: string; username?: string };
    status: string;
    category?: string;
    unreadCount: number;
    lastMessage?: string;
    createdAt: Date;
  }>;
}

export interface SupervisorStats {
  totalAgents: number;
  onlineAgents: number;
  busyAgents: number;
  availableAgents: number;
  totalActiveSessions: number;
  queuedSessions: number;
  avgWaitTime: number;
  avgHandleTime: number;
  resolutionsToday: number;
  
}

export interface Whisper {
  id: string;
  _id: string; // For compatibility with backend
  sessionId: string;
  supervisorId: string;
  supervisorName: string;
  targetAgentId: string;
  content: string;
  createdAt: Date;
  isRead: boolean;
  readAt?: Date;
}

export interface ActivityItem {
  id: string;
  sessionId: string;
  type: string;
  description: string;
  agentId?: string;
  agentName?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

interface SupervisorState {
  // Stats
  stats: SupervisorStats | null;
  isLoadingStats: boolean;
  
  // Agent monitoring
  agents: AgentOverview[];
  isLoadingAgents: boolean;
  selectedAgentId: string | null;
  
  // Session watching
  watchingSessions: Set<string>;
  
  // Whispers
  whispers: Whisper[];
  unreadWhisperCount: number;
  
  // Activity timeline
  sessionActivities: Record<string, ActivityItem[]>;
  
  // UI state
  isSupervisorMode: boolean;
  showSupervisorPanel: boolean;
  
  // Actions
  setStats: (stats: SupervisorStats) => void;
  setLoadingStats: (loading: boolean) => void;
  setAgents: (agents: AgentOverview[]) => void;
  updateAgent: (agentId: string, updates: Partial<AgentOverview>) => void;
  setLoadingAgents: (loading: boolean) => void;
  setSelectedAgent: (agentId: string | null) => void;
  
  // Watching
  startWatching: (sessionId: string) => void;
  stopWatching: (sessionId: string) => void;
  
  // Whispers
  addWhisper: (whisper: Whisper) => void;
  setWhispers: (whispers: Whisper[]) => void;
  markWhisperAsRead: (whisperId: string) => void;
  
  // Activity
  setSessionActivities: (sessionId: string, activities: ActivityItem[]) => void;
  addActivity: (activity: ActivityItem) => void;
  
  // UI
  toggleSupervisorMode: () => void;
  toggleSupervisorPanel: () => void;
}

export const useSupervisorStore = create<SupervisorState>((set, get) => ({
  // Initial state
  stats: null,
  isLoadingStats: false,
  agents: [],
  isLoadingAgents: false,
  selectedAgentId: null,
  watchingSessions: new Set(),
  whispers: [],
  unreadWhisperCount: 0,
  sessionActivities: {},
  isSupervisorMode: false,
  showSupervisorPanel: false,
  
  // Actions
  setStats: (stats) => set({ stats }),
  setLoadingStats: (loading) => set({ isLoadingStats: loading }),
  
  setAgents: (agents) => set({ agents }),
  updateAgent: (agentId, updates) => set((state) => ({
    agents: state.agents.map(agent => 
      agent.id === agentId ? { ...agent, ...updates } : agent
    ),
  })),
  setLoadingAgents: (loading) => set({ isLoadingAgents: loading }),
  setSelectedAgent: (agentId) => set({ selectedAgentId: agentId }),
  
  startWatching: (sessionId) => set((state) => {
    const newSet = new Set(state.watchingSessions);
    newSet.add(sessionId);
    return { watchingSessions: newSet };
  }),
  stopWatching: (sessionId) => set((state) => {
    const newSet = new Set(state.watchingSessions);
    newSet.delete(sessionId);
    return { watchingSessions: newSet };
  }),
  
  addWhisper: (whisper) => set((state) => ({
    whispers: [whisper, ...state.whispers],
    unreadWhisperCount: whisper.isRead ? state.unreadWhisperCount : state.unreadWhisperCount + 1,
  })),
  setWhispers: (whispers) => set({
    whispers,
    unreadWhisperCount: whispers.filter(w => !w.isRead).length,
  }),
  markWhisperAsRead: (whisperId) => set((state) => ({
    whispers: state.whispers.map(w =>
      w.id === whisperId ? { ...w, isRead: true, readAt: new Date() } : w
    ),
    unreadWhisperCount: Math.max(0, state.unreadWhisperCount - 1),
  })),
  
  setSessionActivities: (sessionId, activities) => set((state) => ({
    sessionActivities: {
      ...state.sessionActivities,
      [sessionId]: activities,
    },
  })),
  addActivity: (activity) => set((state) => {
    const existing = state.sessionActivities[activity.sessionId] || [];
    return {
      sessionActivities: {
        ...state.sessionActivities,
        [activity.sessionId]: [activity, ...existing],
      },
    };
  }),
  
  toggleSupervisorMode: () => set((state) => ({ 
    isSupervisorMode: !state.isSupervisorMode 
  })),
  toggleSupervisorPanel: () => set((state) => ({ 
    showSupervisorPanel: !state.showSupervisorPanel 
  })),
}));

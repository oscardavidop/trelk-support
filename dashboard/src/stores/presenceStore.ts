/**
 * Presence Store - Manages agent status state, heartbeat, and live updates
 */

import { create } from 'zustand';
import {
  sendHeartbeat,
  getMyPresence,
  setMyState,
  getAuxiliaryStates,
  type AuxiliaryState,
  type AgentPresence,
  type AgentTimeStats,
} from '../services/presence.service';

const HEARTBEAT_INTERVAL_MS = 25_000; // 25s (server expects every 30s)

interface PresenceState {
  // Current agent state
  currentState: AuxiliaryState | null;
  stateChangedAt: Date | null;
  availableStates: AuxiliaryState[];
  todayStats: AgentTimeStats | null;
  idleRiskSince: string | null;
  maxChats: number;

  // All agents (for supervisor/wallboard)
  allPresences: AgentPresence[];

  // UI
  isChangingState: boolean;
  isLoading: boolean;
  heartbeatInterval: ReturnType<typeof setInterval> | null;

  // Ticker: seconds in current state (for live counter)
  secondsInState: number;

  // Actions
  init: () => Promise<void>;
  setMyState: (stateCode: string, reason?: string) => Promise<{ ok: boolean; error?: string }>;
  startHeartbeat: () => void;
  stopHeartbeat: () => void;
  refreshMyPresence: () => Promise<void>;
  setAllPresences: (presences: AgentPresence[]) => void;
  onSocketStateChange: (data: { agentId: string; stateCode: string; color: string; changedAt: string }) => void;
  tickSecond: () => void;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  currentState: null,
  stateChangedAt: null,
  availableStates: [],
  todayStats: null,
  idleRiskSince: null,
  maxChats: 5,
  allPresences: [],
  isChangingState: false,
  isLoading: false,
  heartbeatInterval: null,
  secondsInState: 0,

  init: async () => {
    set({ isLoading: true });
    try {
      const [myData, allStates] = await Promise.all([
        getMyPresence().catch(() => null),
        getAuxiliaryStates().catch(() => []),
      ]);

      if (myData) {
        const current = allStates.find(s => s.code === myData.presence?.stateCode);
        const changedAt = myData.presence?.changedAt ? new Date(myData.presence.changedAt) : null;
        const secondsInState = changedAt
          ? Math.floor((Date.now() - changedAt.getTime()) / 1000)
          : 0;

        set({
          currentState: current || null,
          stateChangedAt: changedAt,
          availableStates: allStates,
          todayStats: myData.todayStats,
          idleRiskSince: myData.idleRiskSince,
          maxChats: myData.maxChats,
          secondsInState,
        });
      } else {
        set({ availableStates: allStates });
      }
    } finally {
      set({ isLoading: false });
    }

    // Start heartbeat
    get().startHeartbeat();

    // Start live counter
    setInterval(() => get().tickSecond(), 1000);
  },

  setMyState: async (stateCode, reason) => {
    set({ isChangingState: true });
    try {
      const result = await setMyState(stateCode, reason);
      if (result.ok) {
        const { availableStates } = get();
        const newState = availableStates.find(s => s.code === stateCode);
        set({
          currentState: newState || null,
          stateChangedAt: new Date(),
          secondsInState: 0,
        });
      }
      return result;
    } finally {
      set({ isChangingState: false });
    }
  },

  startHeartbeat: () => {
    const { heartbeatInterval } = get();
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    const interval = setInterval(() => {
      sendHeartbeat().catch(() => {/* ignore */});
    }, HEARTBEAT_INTERVAL_MS);

    // Send immediately
    sendHeartbeat().catch(() => {});

    set({ heartbeatInterval: interval });
  },

  stopHeartbeat: () => {
    const { heartbeatInterval } = get();
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      set({ heartbeatInterval: null });
    }
  },

  refreshMyPresence: async () => {
    try {
      const data = await getMyPresence();
      if (!data) return;
      const { availableStates } = get();
      const current = availableStates.find(s => s.code === data.presence?.stateCode);
      const changedAt = data.presence?.changedAt ? new Date(data.presence.changedAt) : null;
      set({
        currentState: current || null,
        stateChangedAt: changedAt,
        todayStats: data.todayStats,
        secondsInState: changedAt ? Math.floor((Date.now() - changedAt.getTime()) / 1000) : 0,
      });
    } catch {/* ignore */}
  },

  setAllPresences: (presences) => set({ allPresences: presences }),

  onSocketStateChange: ({ agentId: _agentId, stateCode, color, changedAt }) => {
    // Update allPresences (wallboard)
    const { allPresences, availableStates } = get();
    const updated = allPresences.map(p =>
      p.agentId === _agentId
        ? { ...p, stateCode, color, changedAt }
        : p
    );
    set({ allPresences: updated });

    // MULTI-TAB SYNC: If it's the current agent's own state change from another
    // tab or from a supervisor, update currentState/stateChangedAt so all tabs stay in sync
    try {
      const authRaw = localStorage.getItem('trelk-support-auth');
      const myId = authRaw ? JSON.parse(authRaw).state?.agent?._id : null;
      if (myId && _agentId === myId) {
        const newState = availableStates.find(s => s.code === stateCode) || null;
        const newChangedAt = changedAt ? new Date(changedAt) : new Date();
        set({
          currentState: newState,
          stateChangedAt: newChangedAt,
          secondsInState: 0,
        });
      }
    } catch { /* ignore parse errors */ }
  },

  tickSecond: () => {
    set(s => ({ secondsInState: s.secondsInState + 1 }));
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatLiveTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

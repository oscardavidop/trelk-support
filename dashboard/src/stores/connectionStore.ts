/**
 * Connection Status Store
 * Tracks WebSocket connection state for UI feedback
 */
import { create } from 'zustand';

export type ConnectionStatus = 'ready' | 'reconnecting' | 'disconnected';

interface SyncState {
  mySessions: number;
  queuedSessions: number;
  reconnected: boolean;
  recoveredSessions: number;
  lastSyncAt: Date | null;
}

interface ConnectionState {
  status: ConnectionStatus;
  reconnectAttempt: number;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;
  syncState: SyncState | null;
  
  // Actions
  setConnected: () => void;
  setReconnecting: (attempt: number) => void;
  setDisconnected: () => void;
  setSyncState: (state: SyncState) => void;
  clearSyncState: () => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  reconnectAttempt: 0,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  syncState: null,

  setConnected: () => set({
    status: 'ready',
    reconnectAttempt: 0,
    lastConnectedAt: new Date(),
  }),
  
  setReconnecting: (attempt) => set({
    status: 'reconnecting',
    reconnectAttempt: attempt,
  }),
  
  setDisconnected: () => set({
    status: 'disconnected',
    lastDisconnectedAt: new Date(),
  }),
  
  setSyncState: (syncState) => set({
    syncState: {
      ...syncState,
      lastSyncAt: new Date(),
    },
  }),
  
  clearSyncState: () => set({ syncState: null }),
}));

/**
 * Playbook Store — Zustand state management for playbooks
 */

import { create } from 'zustand';
import type { Playbook, PlaybookProgress, CloseValidation } from '../services/playbook.service';
import * as playbookApi from '../services/playbook.service';

interface PlaybookState {
  // Admin list
  playbooks: Playbook[];
  isLoadingPlaybooks: boolean;

  // Active progress per session
  activeProgress: Record<string, PlaybookProgress | null>; // keyed by sessionId
  isLoadingProgress: boolean;

  // Suggested playbooks for current chat
  suggestedPlaybooks: Playbook[];

  // All available playbooks (for manual browse)
  availablePlaybooks: Playbook[];

  // Close validation
  closeValidation: CloseValidation | null;

  // Actions — Admin
  fetchPlaybooks: (params?: { isActive?: boolean; category?: string }) => Promise<void>;
  createPlaybook: (data: Partial<Playbook>) => Promise<Playbook>;
  updatePlaybook: (id: string, data: Partial<Playbook>) => Promise<void>;
  deletePlaybook: (id: string) => Promise<void>;
  togglePlaybook: (id: string, isActive: boolean) => Promise<void>;
  seedDefaults: () => Promise<void>;

  // Actions — Chat
  fetchSuggestions: (context: { dispositionId?: string; dispositionCode?: string; dispositionName?: string; tags?: string[]; category?: string }) => Promise<void>;
  fetchAvailable: () => Promise<void>;
  startPlaybook: (sessionId: string, playbookId: string) => Promise<void>;
  fetchProgress: (sessionId: string) => Promise<void>;
  completeStep: (sessionId: string, stepId: string, actionResult?: string) => Promise<void>;
  skipStep: (sessionId: string, stepId: string, reason: string) => Promise<void>;
  abandonPlaybook: (sessionId: string) => Promise<void>;
  validateClose: (sessionId: string) => Promise<CloseValidation>;

  // Socket updates
  onPlaybookProgress: (sessionId: string, progress: PlaybookProgress) => void;
  onPlaybookUpdated: (playbook: Playbook) => void;
  onPlaybookDeleted: (playbookId: string) => void;

  clearProgress: (sessionId: string) => void;
}

export const usePlaybookStore = create<PlaybookState>((set, get) => ({
  playbooks: [],
  isLoadingPlaybooks: false,
  activeProgress: {},
  isLoadingProgress: false,
  suggestedPlaybooks: [],
  availablePlaybooks: [],
  closeValidation: null,

  // ─── Admin CRUD ───

  fetchPlaybooks: async (params) => {
    set({ isLoadingPlaybooks: true });
    try {
      const playbooks = await playbookApi.getPlaybooks(params);
      set({ playbooks });
    } finally {
      set({ isLoadingPlaybooks: false });
    }
  },

  createPlaybook: async (data) => {
    const playbook = await playbookApi.createPlaybook(data);
    set(s => ({ playbooks: [...s.playbooks, playbook] }));
    return playbook;
  },

  updatePlaybook: async (id, data) => {
    const playbook = await playbookApi.updatePlaybook(id, data);
    set(s => ({
      playbooks: s.playbooks.map(p => p._id === id ? playbook : p),
    }));
  },

  deletePlaybook: async (id) => {
    await playbookApi.deletePlaybook(id);
    set(s => ({
      playbooks: s.playbooks.filter(p => p._id !== id),
    }));
  },

  togglePlaybook: async (id, isActive) => {
    const playbook = await playbookApi.togglePlaybook(id, isActive);
    set(s => ({
      playbooks: s.playbooks.map(p => p._id === id ? playbook : p),
    }));
  },

  seedDefaults: async () => {
    await playbookApi.seedPlaybooks();
    await get().fetchPlaybooks();
  },

  // ─── Chat Actions ───

  fetchSuggestions: async (context) => {
    try {
      const playbooks = await playbookApi.matchPlaybooks(context);
      set({ suggestedPlaybooks: playbooks });
    } catch {
      set({ suggestedPlaybooks: [] });
    }
  },

  fetchAvailable: async () => {
    try {
      const playbooks = await playbookApi.getAvailablePlaybooks();
      set({ availablePlaybooks: playbooks });
    } catch {
      set({ availablePlaybooks: [] });
    }
  },

  startPlaybook: async (sessionId, playbookId) => {
    const progress = await playbookApi.startPlaybook(sessionId, playbookId);
    set(s => ({
      activeProgress: { ...s.activeProgress, [sessionId]: progress },
      // Clear suggestions once a playbook is started
      suggestedPlaybooks: [],
    }));
  },

  fetchProgress: async (sessionId) => {
    set({ isLoadingProgress: true });
    try {
      const progress = await playbookApi.getActiveProgress(sessionId);
      set(s => ({
        activeProgress: { ...s.activeProgress, [sessionId]: progress },
      }));
    } finally {
      set({ isLoadingProgress: false });
    }
  },

  completeStep: async (sessionId, stepId, actionResult) => {
    const progress = await playbookApi.completeStep(sessionId, stepId, actionResult);
    set(s => ({
      activeProgress: { ...s.activeProgress, [sessionId]: progress },
    }));
  },

  skipStep: async (sessionId, stepId, reason) => {
    const progress = await playbookApi.skipStep(sessionId, stepId, reason);
    set(s => ({
      activeProgress: { ...s.activeProgress, [sessionId]: progress },
    }));
  },

  abandonPlaybook: async (sessionId) => {
    await playbookApi.abandonPlaybook(sessionId);
    set(s => ({
      activeProgress: { ...s.activeProgress, [sessionId]: null },
    }));
  },

  validateClose: async (sessionId) => {
    const result = await playbookApi.validateBeforeClose(sessionId);
    set({ closeValidation: result });
    return result;
  },

  // ─── Socket handlers ───

  onPlaybookProgress: (sessionId, progress) => {
    set(s => ({
      activeProgress: { ...s.activeProgress, [sessionId]: progress },
    }));
  },

  onPlaybookUpdated: (playbook) => {
    set(s => ({
      playbooks: s.playbooks.map(p => p._id === playbook._id ? playbook : p),
    }));
  },

  onPlaybookDeleted: (playbookId) => {
    set(s => ({
      playbooks: s.playbooks.filter(p => p._id !== playbookId),
    }));
  },

  clearProgress: (sessionId) => {
    set(s => ({
      activeProgress: { ...s.activeProgress, [sessionId]: null },
    }));
  },
}));

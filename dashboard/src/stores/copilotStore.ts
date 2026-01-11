// AI Copilot store - For AI-powered suggestions
import { create } from 'zustand';

export type SuggestionType = 'response' | 'summary' | 'category' | 'close_ready' | 'sentiment';

export interface CopilotSuggestion {
  id: string;
  sessionId: string;
  type: SuggestionType;
  content: string;
  confidence: number;
  categories?: string[];
  sentiment?: {
    score: number;
    label: 'positive' | 'neutral' | 'negative' | 'frustrated';
  };
  closeReady?: {
    ready: boolean;
    reasons: string[];
  };
  createdAt: Date;
  isUsed?: boolean;
  feedbackGiven?: 'positive' | 'negative';
}

export interface CopilotAnalytics {
  suggestionsGenerated: number;
  suggestionsUsed: number;
  positiveRatings: number;
  negativeRatings: number;
  usageRate: number;
  satisfactionRate: number;
  byType: Record<SuggestionType, {
    generated: number;
    used: number;
    positiveRatings: number;
  }>;
}

interface CopilotState {
  // Suggestions
  suggestions: Record<string, CopilotSuggestion[]>; // sessionId -> suggestions
  activeSuggestion: CopilotSuggestion | null;
  
  // Loading states
  isGenerating: Record<string, boolean>; // type -> loading
  
  // Preferences
  isEnabled: boolean;
  autoSuggest: boolean;
  suggestionTypes: SuggestionType[];
  
  // Analytics
  analytics: CopilotAnalytics | null;
  
  // UI
  isPanelOpen: boolean;
  
  // Actions
  setSuggestions: (sessionId: string, suggestions: CopilotSuggestion[]) => void;
  addSuggestion: (suggestion: CopilotSuggestion) => void;
  setActiveSuggestion: (suggestion: CopilotSuggestion | null) => void;
  markSuggestionUsed: (suggestionId: string, sessionId: string) => void;
  rateSuggestion: (suggestionId: string, sessionId: string, rating: 'positive' | 'negative') => void;
  
  // Loading
  setGenerating: (type: SuggestionType, loading: boolean) => void;
  
  // Preferences
  setEnabled: (enabled: boolean) => void;
  setAutoSuggest: (enabled: boolean) => void;
  setSuggestionTypes: (types: SuggestionType[]) => void;
  
  // Analytics
  setAnalytics: (analytics: CopilotAnalytics) => void;
  
  // UI
  togglePanel: () => void;
  clearSessionSuggestions: (sessionId: string) => void;
}

export const useCopilotStore = create<CopilotState>((set, get) => ({
  // Initial state
  suggestions: {},
  activeSuggestion: null,
  isGenerating: {},
  isEnabled: true,
  autoSuggest: true,
  suggestionTypes: ['response', 'summary', 'category', 'close_ready', 'sentiment'],
  analytics: null,
  isPanelOpen: false,
  
  // Actions
  setSuggestions: (sessionId, suggestions) => set((state) => ({
    suggestions: {
      ...state.suggestions,
      [sessionId]: suggestions,
    },
  })),
  
  addSuggestion: (suggestion) => set((state) => {
    const existing = state.suggestions[suggestion.sessionId] || [];
    // Avoid duplicates
    if (existing.some(s => s.id === suggestion.id)) {
      return state;
    }
    return {
      suggestions: {
        ...state.suggestions,
        [suggestion.sessionId]: [suggestion, ...existing].slice(0, 10), // Keep last 10
      },
      activeSuggestion: suggestion.type === 'response' ? suggestion : state.activeSuggestion,
    };
  }),
  
  setActiveSuggestion: (suggestion) => set({ activeSuggestion: suggestion }),
  
  markSuggestionUsed: (suggestionId, sessionId) => set((state) => ({
    suggestions: {
      ...state.suggestions,
      [sessionId]: (state.suggestions[sessionId] || []).map(s =>
        s.id === suggestionId ? { ...s, isUsed: true } : s
      ),
    },
  })),
  
  rateSuggestion: (suggestionId, sessionId, rating) => set((state) => ({
    suggestions: {
      ...state.suggestions,
      [sessionId]: (state.suggestions[sessionId] || []).map(s =>
        s.id === suggestionId ? { ...s, feedbackGiven: rating } : s
      ),
    },
  })),
  
  setGenerating: (type, loading) => set((state) => ({
    isGenerating: { ...state.isGenerating, [type]: loading },
  })),
  
  setEnabled: (enabled) => set({ isEnabled: enabled }),
  setAutoSuggest: (enabled) => set({ autoSuggest: enabled }),
  setSuggestionTypes: (types) => set({ suggestionTypes: types }),
  
  setAnalytics: (analytics) => set({ analytics }),
  
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  clearSessionSuggestions: (sessionId) => set((state) => {
    const { [sessionId]: _, ...rest } = state.suggestions;
    return { suggestions: rest };
  }),
}));

// AI Copilot API service
import type { CopilotSuggestion, SuggestionType } from '../stores/copilotStore';

const API_URL = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth-storage');
  let authToken = '';
  
  if (token) {
    try {
      const parsed = JSON.parse(token);
      authToken = parsed.state?.token || '';
    } catch {
      // ignore
    }
  }
  
  return {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface SuggestionResponse {
  id: string;
  content?: string;
  summary?: string;
  categories?: string[];
  sentiment?: {
    score: number;
    label: 'positive' | 'neutral' | 'negative' | 'frustrated';
  };
  closeReady?: {
    ready: boolean;
    reasons: string[];
  };
  confidence: number;
}

// ============= SUGGESTIONS =============

export async function suggestResponse(
  sessionId: string, 
  context?: string
): Promise<ApiResponse<SuggestionResponse>> {
  try {
    const res = await fetch(`${API_URL}/copilot/suggest-response/${sessionId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ context }),
    });
    const data = await res.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('Error getting response suggestion:', error);
    return { success: false, data: {} as SuggestionResponse, error: 'Failed to get suggestion' };
  }
}

export async function summarize(sessionId: string): Promise<ApiResponse<SuggestionResponse>> {
  try {
    const res = await fetch(`${API_URL}/copilot/summarize/${sessionId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('Error getting summary:', error);
    return { success: false, data: {} as SuggestionResponse, error: 'Failed to summarize' };
  }
}

export async function categorize(sessionId: string): Promise<ApiResponse<SuggestionResponse>> {
  try {
    const res = await fetch(`${API_URL}/copilot/categorize/${sessionId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('Error categorizing:', error);
    return { success: false, data: {} as SuggestionResponse, error: 'Failed to categorize' };
  }
}

export async function checkCloseReady(sessionId: string): Promise<ApiResponse<SuggestionResponse>> {
  try {
    const res = await fetch(`${API_URL}/copilot/close-readiness/${sessionId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('Error checking close readiness:', error);
    return { success: false, data: {} as SuggestionResponse, error: 'Failed to check' };
  }
}

export async function getSentiment(sessionId: string): Promise<ApiResponse<SuggestionResponse>> {
  try {
    const res = await fetch(`${API_URL}/copilot/sentiment/${sessionId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('Error getting sentiment:', error);
    return { success: false, data: {} as SuggestionResponse, error: 'Failed to analyze sentiment' };
  }
}

// ============= FEEDBACK =============

export async function recordFeedback(
  suggestionId: string, 
  rating: 'positive' | 'negative'
): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_URL}/copilot/feedback/${suggestionId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ rating }),
    });
    const data = await res.json();
    return {
      success: data.success,
      data: undefined,
      error: data.error,
    };
  } catch (error) {
    console.error('Error recording feedback:', error);
    return { success: false, data: undefined, error: 'Failed to record feedback' };
  }
}

// ============= GET SUGGESTIONS =============

export async function getLatestSuggestions(sessionId: string): Promise<ApiResponse<CopilotSuggestion[]>> {
  try {
    const res = await fetch(`${API_URL}/copilot/suggestions/${sessionId}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return {
      success: data.success,
      data: data.data || [],
      error: data.error,
    };
  } catch (error) {
    console.error('Error getting suggestions:', error);
    return { success: false, data: [], error: 'Failed to get suggestions' };
  }
}

// ============= ANALYTICS =============

export async function getAnalytics(): Promise<ApiResponse<{
  suggestionsGenerated: number;
  suggestionsUsed: number;
  positiveRatings: number;
  negativeRatings: number;
  usageRate: number;
  satisfactionRate: number;
}>> {
  try {
    const res = await fetch(`${API_URL}/copilot/analytics`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('Error getting analytics:', error);
    return { success: false, data: {} as any, error: 'Failed to get analytics' };
  }
}

export const copilotService = {
  suggestResponse,
  summarize,
  categorize,
  checkCloseReady,
  getSentiment,
  recordFeedback,
  getLatestSuggestions,
  getAnalytics,
};

export default copilotService;

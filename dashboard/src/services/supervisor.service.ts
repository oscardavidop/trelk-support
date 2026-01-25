// Supervisor API service
import type { 
  AgentOverview, 
  SupervisorStats, 
  Whisper, 
  ActivityItem 
} from '../stores/supervisorStore';

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

// ============= STATS =============

export async function getStats(): Promise<ApiResponse<SupervisorStats>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/stats`, {
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
    console.error('Error fetching supervisor stats:', error);
    return { success: false, data: {} as SupervisorStats, error: 'Failed to fetch stats' };
  }
}

// ============= AGENT OVERVIEWS =============

export async function getAgentOverviews(): Promise<ApiResponse<AgentOverview[]>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/agents`, {
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
    console.error('Error fetching agent overviews:', error);
    return { success: false, data: [], error: 'Failed to fetch agents' };
  }
}

// ============= WHISPERS =============

export async function sendWhisper(
  sessionId: string, 
  targetAgentId: string, 
  content: string
): Promise<ApiResponse<Whisper>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/whisper`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ sessionId, targetAgentId, content }),
    });
    const data = await res.json();
    return {
      success: data.success,
      data: data.data,
      error: data.error,
    };
  } catch (error) {
    console.error('Error sending whisper:', error);
    return { success: false, data: {} as Whisper, error: 'Failed to send whisper' };
  }
}

export async function getUnreadWhispers(): Promise<ApiResponse<Whisper[]>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/whispers/unread`, {
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
    console.error('Error fetching whispers:', error);
    return { success: false, data: [], error: 'Failed to fetch whispers' };
  }
}

export async function markWhisperAsRead(whisperId: string): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/whispers/${whisperId}/read`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ 
        readAt: new Date().toISOString(), 
      }),
    });
    const data = await res.json();
    return {
      success: data.success,
      data: undefined,
      error: data.error,
    };
  } catch (error) {
    console.error('Error marking whisper as read:', error);
    return { success: false, data: undefined, error: 'Failed to mark whisper as read' };
  }
}

export async function getSessionWhispers(sessionId: string): Promise<ApiResponse<Whisper[]>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/sessions/${sessionId}/whispers`, {
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
    console.error('Error fetching session whispers:', error);
    return { success: false, data: [], error: 'Failed to fetch whispers' };
  }
}

// ============= SESSION WATCHING =============

export async function startWatchingSession(sessionId: string): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/sessions/${sessionId}/watch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return {
      success: data.success,
      data: undefined,
      error: data.error,
    };
  } catch (error) {
    console.error('Error starting session watch:', error);
    return { success: false, data: undefined, error: 'Failed to start watching' };
  }
}

export async function stopWatchingSession(sessionId: string): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/sessions/${sessionId}/unwatch`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return {
      success: data.success,
      data: undefined,
      error: data.error,
    };
  } catch (error) {
    console.error('Error stopping session watch:', error);
    return { success: false, data: undefined, error: 'Failed to stop watching' };
  }
}

// ============= TAKEOVER =============

export async function takeoverSession(
  sessionId: string, 
  reason: string
): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/sessions/${sessionId}/takeover`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    return {
      success: data.success,
      data: undefined,
      error: data.error,
    };
  } catch (error) {
    console.error('Error taking over session:', error);
    return { success: false, data: undefined, error: 'Failed to take over session' };
  }
}

// ============= ACTIVITY TIMELINE =============

export async function getSessionTimeline(sessionId: string): Promise<ApiResponse<ActivityItem[]>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/sessions/${sessionId}/timeline`, {
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
    console.error('Error fetching session timeline:', error);
    return { success: false, data: [], error: 'Failed to fetch timeline' };
  }
}

// ============= LIVE CHATS =============

interface LiveChat {
  sessionId: string;
  userId: string;
  userName: string;
  agentId: string;
  agentName: string;
  status: string;
  messagesCount: number;
  duration: number;
  lastMessage: string;
  lastMessageAt: string;
  slaStatus: 'ok' | 'warning' | 'critical';
}

export async function getLiveChats(): Promise<ApiResponse<LiveChat[]>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/live-chats`, {
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
    console.error('Error fetching live chats:', error);
    return { success: false, data: [], error: 'Failed to fetch live chats' };
  }
}

export async function takeOverChat(sessionId: string): Promise<ApiResponse<void>> {
  try {
    const res = await fetch(`${API_URL}/supervisor/sessions/${sessionId}/takeover`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ reason: 'Supervisor takeover' }),
    });
    const data = await res.json();
    return {
      success: data.success,
      data: undefined,
      error: data.error,
    };
  } catch (error) {
    console.error('Error taking over chat:', error);
    return { success: false, data: undefined, error: 'Failed to take over chat' };
  }
}

export const supervisorService = {
  getStats,
  getAgentOverviews,
  sendWhisper,
  getUnreadWhispers,
  markWhisperAsRead,
  getSessionWhispers,
  startWatchingSession,
  stopWatchingSession,
  takeoverSession,
  getSessionTimeline,
  getLiveChats,
  takeOverChat,
};

export default supervisorService;

// Settings Service - API calls for user settings
import type { AgentPreferences, AgentSession, AgentActivity } from '../types';

const API_URL = '/api/settings';

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('auth-storage');
  if (token) {
    try {
      const parsed = JSON.parse(token);
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${parsed.state?.token || ''}`
      };
    } catch {
      return { 'Content-Type': 'application/json' };
    }
  }
  return { 'Content-Type': 'application/json' };
};

// ============= ACCOUNT =============

export interface AccountData {
  name: string;
  email: string;
  avatar?: string;
  department?: string;
  timezone?: string;
}

export async function getAccount(): Promise<AccountData> {
  const res = await fetch(`${API_URL}/account`, {
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to get account');
  return data.account;
}

export async function updateAccount(updates: Partial<AccountData>): Promise<AccountData> {
  const res = await fetch(`${API_URL}/account`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to update account');
  return data.account;
}

// ============= PREFERENCES =============

export async function getPreferences(): Promise<AgentPreferences> {
  const res = await fetch(`${API_URL}/preferences`, {
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to get preferences');
  return data.preferences;
}

export async function updatePreferences(updates: Partial<AgentPreferences>): Promise<AgentPreferences> {
  const res = await fetch(`${API_URL}/preferences`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to update preferences');
  return data.preferences;
}

// ============= NOTIFICATIONS =============

export interface NotificationSettings {
  email: {
    enabled: boolean;
    onNewChat: boolean;
    onMention: boolean;
    onAssignment: boolean;
    dailyDigest: boolean;
  };
  inApp: {
    enabled: boolean;
    sound: boolean;
    onNewMessage: boolean;
    onNewChat: boolean;
    onMention: boolean;
  };
  telegram: {
    enabled: boolean;
    chatId?: number;
    onNewChat: boolean;
    onMention: boolean;
  };
  desktop: {
    enabled: boolean;
    onNewMessage: boolean;
    onNewChat: boolean;
  };
}

export async function getNotifications(): Promise<NotificationSettings> {
  const res = await fetch(`${API_URL}/notifications`, {
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to get notifications');
  return data.notifications;
}

export async function updateNotifications(updates: Partial<NotificationSettings>): Promise<NotificationSettings> {
  const res = await fetch(`${API_URL}/notifications`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates)
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to update notifications');
  return data.notifications;
}

// ============= SECURITY =============

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${API_URL}/security/password`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to change password');
}

export async function getSessions(): Promise<{ sessions: AgentSession[]; currentSessionId: string }> {
  const res = await fetch(`${API_URL}/security/sessions`, {
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to get sessions');
  return { sessions: data.sessions, currentSessionId: data.currentSessionId };
}

export async function revokeSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/security/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to revoke session');
}

export async function revokeAllOtherSessions(): Promise<{ revokedCount: number }> {
  const res = await fetch(`${API_URL}/security/sessions/revoke-others`, {
    method: 'POST',
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to revoke sessions');
  return { revokedCount: data.revokedCount };
}

// ============= ACTIVITY =============

export async function getActivity(page = 1, limit = 50): Promise<{ activities: AgentActivity[]; total: number; page: number; pages: number }> {
  const res = await fetch(`${API_URL}/activity?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders(),
    credentials: 'include'
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || 'Failed to get activity');
  return {
    activities: data.activities,
    total: data.total,
    page: data.page,
    pages: data.pages
  };
}

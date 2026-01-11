// Contact Info API service
import type { ContactInfo, Note, Tag, CustomFieldDefinition, CustomFieldValue, UserHistorySession } from '../types';

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

// ============= CONTACT INFO =============

export async function getContactInfo(sessionId: string): Promise<ContactInfo | null> {
  try {
    const res = await fetch(`${API_URL}/sessions/${sessionId}/contact`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.ok ? data.contact : null;
  } catch (error) {
    console.error('Error fetching contact info:', error);
    return null;
  }
}

export async function getUserHistory(userId: string, limit = 50): Promise<UserHistorySession[]> {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/history?limit=${limit}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.ok ? data.history : [];
  } catch (error) {
    console.error('Error fetching user history:', error);
    return [];
  }
}

// ============= NOTES =============

export async function getUserNotes(userId: string): Promise<Note[]> {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/notes`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.ok ? data.notes : [];
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
}

export async function createNote(userId: string, content: string, sessionId?: string): Promise<Note | null> {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/notes`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ content, sessionId }),
    });
    const data = await res.json();
    return data.ok ? data.note : null;
  } catch (error) {
    console.error('Error creating note:', error);
    return null;
  }
}

export async function deleteNote(noteId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/notes/${noteId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.ok;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
}

// ============= TAGS =============

export async function getAllTags(): Promise<Tag[]> {
  try {
    const res = await fetch(`${API_URL}/tags`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.ok ? data.tags : [];
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
}

export async function searchTags(query: string): Promise<Tag[]> {
  try {
    const res = await fetch(`${API_URL}/tags/search?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.ok ? data.tags : [];
  } catch (error) {
    console.error('Error searching tags:', error);
    return [];
  }
}

export async function getUserTags(userId: string): Promise<Tag[]> {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/tags`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.ok ? data.tags : [];
  } catch (error) {
    console.error('Error fetching user tags:', error);
    return [];
  }
}

export async function addTagToUser(userId: string, tagId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/tags`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ tagId }),
    });
    const data = await res.json();
    return data.ok;
  } catch (error) {
    console.error('Error adding tag:', error);
    return false;
  }
}

export async function removeTagFromUser(userId: string, tagId: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/tags/${tagId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.ok;
  } catch (error) {
    console.error('Error removing tag:', error);
    return false;
  }
}

export async function createTag(name: string, color: string, description?: string): Promise<Tag | null> {
  try {
    const res = await fetch(`${API_URL}/tags`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ name, color, description }),
    });
    const data = await res.json();
    return data.ok ? data.tag : null;
  } catch (error) {
    console.error('Error creating tag:', error);
    return null;
  }
}

// ============= CUSTOM FIELDS =============

export async function getCustomFields(): Promise<CustomFieldDefinition[]> {
  try {
    const res = await fetch(`${API_URL}/custom-fields`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.ok ? data.fields : [];
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    return [];
  }
}

export async function getUserFieldValues(userId: string): Promise<CustomFieldValue[]> {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/custom-fields`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    return data.ok ? data.values : [];
  } catch (error) {
    console.error('Error fetching field values:', error);
    return [];
  }
}

export async function setUserFieldValue(
  userId: string, 
  fieldId: string, 
  value: string | number | boolean
): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/users/${userId}/custom-fields/${fieldId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({ value }),
    });
    const data = await res.json();
    return data.ok;
  } catch (error) {
    console.error('Error setting field value:', error);
    return false;
  }
}

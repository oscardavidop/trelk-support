/**
 * Custom Fields Admin API Service
 * CRUD operations for custom field definitions
 */

import type { CustomFieldDefinition } from '../types';

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

export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'url' | 'email';

export interface CustomField {
  id: string;
  name: string;
  key: string;
  type: CustomFieldType;
  description?: string;
  required: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
  order: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCustomFieldInput {
  name: string;
  key: string;
  type: CustomFieldType;
  description?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
  order?: number;
}

export interface UpdateCustomFieldInput {
  name?: string;
  description?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
  order?: number;
  isActive?: boolean;
}

// ============= FIELD DEFINITIONS =============

/**
 * Get all custom field definitions
 * @param includeInactive - Whether to include inactive fields
 */
export async function getCustomFields(includeInactive = false): Promise<CustomField[]> {
  try {
    const url = includeInactive 
      ? `${API_URL}/custom-fields?all=true` 
      : `${API_URL}/custom-fields`;
    
    const res = await fetch(url, {
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

/**
 * Create a new custom field definition
 */
export async function createCustomField(input: CreateCustomFieldInput): Promise<{ ok: boolean; field?: CustomField; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/custom-fields`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(input),
    });
    const data = await res.json();
    
    if (!data.ok) {
      return { ok: false, error: data.error || 'Error creating field' };
    }
    
    return { ok: true, field: data.field };
  } catch (error) {
    console.error('Error creating custom field:', error);
    return { ok: false, error: 'Network error' };
  }
}

/**
 * Update a custom field definition
 */
export async function updateCustomField(
  fieldId: string, 
  updates: UpdateCustomFieldInput
): Promise<{ ok: boolean; field?: CustomField; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/custom-fields/${fieldId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    
    if (!data.ok) {
      return { ok: false, error: data.error || 'Error updating field' };
    }
    
    return { ok: true, field: data.field };
  } catch (error) {
    console.error('Error updating custom field:', error);
    return { ok: false, error: 'Network error' };
  }
}

/**
 * Delete (archive) a custom field definition
 */
export async function deleteCustomField(fieldId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/custom-fields/${fieldId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
      body: JSON.stringify({}),
    });
    const data = await res.json();
    
    if (!data.ok) {
      return { ok: false, error: data.error || 'Error deleting field' };
    }
    
    return { ok: true };
  } catch (error) {
    console.error('Error deleting custom field:', error);
    return { ok: false, error: 'Network error' };
  }
}

/**
 * Restore an archived custom field
 */
export async function restoreCustomField(fieldId: string): Promise<{ ok: boolean; error?: string }> {
  return updateCustomField(fieldId, { isActive: true });
}

/**
 * Reorder custom fields
 */
export async function reorderCustomFields(orderedIds: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const updatePromises = orderedIds.map((id, index) => 
      updateCustomField(id, { order: index })
    );
    
    await Promise.all(updatePromises);
    return { ok: true };
  } catch (error) {
    console.error('Error reordering fields:', error);
    return { ok: false, error: 'Network error' };
  }
}

// ============= FIELD USAGE STATS =============

/**
 * Get usage statistics for a field (how many users have values)
 */
export async function getFieldUsageCount(fieldId: string): Promise<number> {
  // TODO: Implement backend endpoint for this
  // For now, return 0
  return 0;
}

// ============= HELPERS =============

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Fecha',
  boolean: 'Sí/No',
  select: 'Lista de opciones',
  url: 'URL',
  email: 'Email',
};

export const FIELD_TYPE_ICONS: Record<CustomFieldType, string> = {
  text: 'Type',
  number: 'Hash',
  date: 'Calendar',
  boolean: 'ToggleLeft',
  select: 'List',
  url: 'Link',
  email: 'Mail',
};

/**
 * Generate a key from a field name
 */
export function generateFieldKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '_')     // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '')          // Trim underscores
    .substring(0, 50);                 // Limit length
}

/**
 * Validate a field key
 */
export function isValidFieldKey(key: string): boolean {
  return /^[a-z0-9_]+$/.test(key) && key.length > 0 && key.length <= 50;
}

/**
 * API Client - Centralized HTTP client for all API calls
 * Uses native fetch with automatic auth token handling and error normalization
 */

// ============= CONFIG =============

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ============= AUTH TOKEN HELPERS =============

function getAuthToken(): string | null {
  try {
    const stored = localStorage.getItem('trelk-support-auth');
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.state?.token || null;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function getHeaders(): HeadersInit {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ============= API INSTANCE (axios-like interface) =============

export interface ApiInstance {
  get: <T = unknown>(url: string, config?: RequestConfig) => Promise<ApiResult<T>>;
  post: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<ApiResult<T>>;
  put: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<ApiResult<T>>;
  patch: <T = unknown>(url: string, data?: unknown, config?: RequestConfig) => Promise<ApiResult<T>>;
  delete: <T = unknown>(url: string, config?: RequestConfig) => Promise<ApiResult<T>>;
}

interface RequestConfig {
  headers?: HeadersInit;
  signal?: AbortSignal;
  data?: unknown;
}

interface ApiResult<T> {
  data: T;
  status: number;
  ok: boolean;
}

async function request<T>(
  method: string,
  url: string,
  data?: unknown,
  config?: RequestConfig
): Promise<ApiResult<T>> {
  const fullUrl = `${API_BASE_URL}${url}`;
  
  const response = await fetch(fullUrl, {
    method,
    headers: {
      ...getHeaders(),
      ...config?.headers,
    },
    credentials: 'include',
    signal: config?.signal,
    body: data ? JSON.stringify(data) : undefined,
  });

  // Handle 401 - unauthorized
  if (response.status === 401) {
    localStorage.removeItem('trelk-support-auth');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const responseData = await response.json().catch(() => ({}));
  
  return {
    data: responseData as T,
    status: response.status,
    ok: response.ok,
  };
}

export const api: ApiInstance = {
  get: <T>(url: string, config?: RequestConfig) => request<T>('GET', url, undefined, config),
  post: <T>(url: string, data?: unknown, config?: RequestConfig) => request<T>('POST', url, data, config),
  put: <T>(url: string, data?: unknown, config?: RequestConfig) => request<T>('PUT', url, data, config),
  patch: <T>(url: string, data?: unknown, config?: RequestConfig) => request<T>('PATCH', url, data, config),
  delete: <T>(url: string, data?: unknown, config?: RequestConfig) => request<T>('DELETE', url, data, config),
};

// ============= TYPED API METHODS =============

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * GET request with typed response
 */
export async function apiGet<T>(
  url: string, 
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  try {
    const result = await api.get<T>(url, config);
    return { ok: result.ok, data: result.data };
  } catch (error: unknown) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * POST request with typed response
 */
export async function apiPost<T>(
  url: string, 
  data?: unknown, 
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  try {
    const result = await api.post<T>(url, data, config);
    return { ok: result.ok, data: result.data };
  } catch (error: unknown) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * PUT request with typed response
 */
export async function apiPut<T>(
  url: string, 
  data?: unknown, 
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  try {
    const result = await api.put<T>(url, data, config);
    return { ok: result.ok, data: result.data };
  } catch (error: unknown) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * PATCH request with typed response
 */
export async function apiPatch<T>(
  url: string, 
  data?: unknown, 
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  try {
    const result = await api.patch<T>(url, data, config);
    return { ok: result.ok, data: result.data };
  } catch (error: unknown) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * DELETE request with typed response
 */
export async function apiDelete<T>(
  url: string, 
  config?: RequestConfig
): Promise<ApiResponse<T>> {
  try {
    const result = await api.delete<T>(url, config);
    return { ok: result.ok, data: result.data };
  } catch (error: unknown) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// ============= UTILITY FUNCTIONS =============

/**
 * Build query string from params object
 */
export function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  }
  
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

/**
 * File upload helper
 */
export async function uploadFile<T>(
  url: string,
  file: File,
  fieldName = 'file',
  additionalData?: Record<string, string>
): Promise<ApiResponse<T>> {
  try {
    const formData = new FormData();
    formData.append(fieldName, file);
    
    if (additionalData) {
      for (const [key, value] of Object.entries(additionalData)) {
        formData.append(key, value);
      }
    }

    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}${url}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // Don't set Content-Type for FormData - browser will set it with boundary
      },
      credentials: 'include',
      body: formData,
    });

    if (response.status === 401) {
      localStorage.removeItem('auth-storage');
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    const data = await response.json().catch(() => ({}));
    
    return { ok: response.ok, data: data as T };
  } catch (error: unknown) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

export default api;

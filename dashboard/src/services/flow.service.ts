/**
 * Flow Service - Frontend API client
 * Handles all Flow Builder API communications
 * 
 * IMPORTANT: All API responses have format { ok: boolean, ...data } or { ok: false, error: string }
 */

import { useAuthStore } from '../stores/authStore';
import type { 
  Flow, 
  FlowListItem, 
  FlowExecution,
  FlowVersion,
  FlowStats,
  OverallFlowStats,
  SimulationResult,
  FlowValidation,
  CreateFlowInput,
  UpdateFlowInput,
  TriggerType
} from '../types/flow';

const API_URL = '/api';

// ============= API HELPERS =============

const getAuthHeader = () => ({
  Authorization: `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json',
});

// Generic API response handler
async function handleResponse<T>(res: Response, dataKey?: string): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Error de conexión' }));
    throw new Error(errorData.error || `Error ${res.status}: ${res.statusText}`);
  }
  
  const data = await res.json();
  
  if (data.ok === false) {
    throw new Error(data.error || 'Error desconocido');
  }
  
  // If a specific key is requested, return that (e.g., 'flow', 'flows')
  if (dataKey && data[dataKey] !== undefined) {
    return data[dataKey];
  }
  
  // Return the full data object (for responses with multiple fields)
  return data;
}

// ============= FLOW CRUD =============

export const getFlows = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
  enabled?: boolean;
  search?: string;
  trigger?: TriggerType;
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<{
  flows: FlowListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> => {
  const queryParams = new URLSearchParams();
  
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.status) queryParams.set('status', params.status);
  if (params?.enabled !== undefined) queryParams.set('enabled', params.enabled.toString());
  if (params?.search) queryParams.set('search', params.search);
  if (params?.trigger) queryParams.set('trigger', params.trigger);
  if (params?.tags?.length) queryParams.set('tags', params.tags.join(','));
  if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);

  const res = await fetch(`${API_URL}/flows?${queryParams.toString()}`, {
    headers: getAuthHeader(),
  });
  
  const data = await handleResponse<{ flows: FlowListItem[]; total: number }>(res);
  return {
    flows: data.flows || [],
    total: data.total || 0,
    page: params?.page || 1,
    limit: params?.limit || 20,
    pages: Math.ceil((data.total || 0) / (params?.limit || 20)),
  };
};

export const getFlowById = async (id: string): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}`, {
    headers: getAuthHeader(),
  });
  return handleResponse<Flow>(res, 'flow');
};

export const createFlow = async (data: CreateFlowInput): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  return handleResponse<Flow>(res, 'flow');
};

export const updateFlow = async (id: string, data: UpdateFlowInput): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  return handleResponse<Flow>(res, 'flow');
};

export const deleteFlow = async (id: string): Promise<void> => {
  const res = await fetch(`${API_URL}/flows/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
    body: JSON.stringify({}),
  });
  await handleResponse<void>(res);
};

// ============= FLOW ACTIONS =============

export const publishFlow = async (id: string, changeDescription?: string): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}/publish`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ changeDescription }),
  });
  return handleResponse<Flow>(res, 'flow');
};

export const unpublishFlow = async (id: string): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}/unpublish`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return handleResponse<Flow>(res, 'flow');
};

export const duplicateFlow = async (id: string, name?: string): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}/duplicate`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ name }),
  });
  return handleResponse<Flow>(res, 'flow');
};

export const toggleFlowEnabled = async (id: string, enabled: boolean): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify({ enabled }),
  });
  return handleResponse<Flow>(res, 'flow');
};

// ============= VALIDATION =============

export const validateFlow = async (id: string): Promise<FlowValidation> => {
  const res = await fetch(`${API_URL}/flows/${id}/validate`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return handleResponse<FlowValidation>(res, 'validation');
};

// ============= SIMULATION =============

export const simulateFlow = async (
  id: string,
  triggerType: TriggerType,
  context?: Record<string, any>
): Promise<SimulationResult> => {
  const res = await fetch(`${API_URL}/flows/${id}/simulate`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ triggerType, context: context || {} }),
  });
  return handleResponse<SimulationResult>(res, 'simulation');
};

// ============= EXECUTIONS =============

export const getFlowExecutions = async (params?: {
  flowId?: string;
  sessionId?: string;
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{
  executions: FlowExecution[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> => {
  const queryParams = new URLSearchParams();
  if (params?.flowId) queryParams.set('flowId', params.flowId);
  if (params?.sessionId) queryParams.set('sessionId', params.sessionId);
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.status) queryParams.set('status', params.status);

  const res = await fetch(`${API_URL}/flows/executions?${queryParams.toString()}`, {
    headers: getAuthHeader(),
  });
  const data = await handleResponse<{ executions: FlowExecution[]; total: number; page: number; limit: number; pages: number }>(res);
  return {
    executions: data.executions || [],
    total: data.total || 0,
    page: data.page || 1,
    limit: data.limit || 20,
    pages: data.pages || 1,
  };
};

export const getExecutionById = async (executionId: string): Promise<FlowExecution> => {
  const res = await fetch(`${API_URL}/flows/executions/${executionId}`, {
    headers: getAuthHeader(),
  });
  return handleResponse<FlowExecution>(res, 'execution');
};

export const cancelExecution = async (executionId: string): Promise<FlowExecution> => {
  const res = await fetch(`${API_URL}/flows/executions/${executionId}/cancel`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return handleResponse<FlowExecution>(res, 'execution');
};

export const retryExecution = async (executionId: string): Promise<FlowExecution> => {
  const res = await fetch(`${API_URL}/flows/executions/${executionId}/retry`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return handleResponse<FlowExecution>(res, 'execution');
};

// ============= VERSIONS =============

export const getFlowVersions = async (flowId: string): Promise<{ versions: FlowVersion[]; currentVersion: number }> => {
  const res = await fetch(`${API_URL}/flows/${flowId}/versions`, {
    headers: getAuthHeader(),
  });
  const data = await handleResponse<{ versions: FlowVersion[]; currentVersion: number }>(res);
  return {
    versions: data.versions || [],
    currentVersion: data.currentVersion || 1,
  };
};

export const rollbackFlow = async (flowId: string, version: number): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${flowId}/rollback/${version}`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return handleResponse<Flow>(res, 'flow');
};

export const getFlowByVersion = async (flowId: string, version: number): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${flowId}/versions/${version}`, {
    headers: getAuthHeader(),
  });
  return handleResponse<Flow>(res, 'flow');
};

// ============= STATISTICS =============

export const getFlowStats = async (flowId: string): Promise<FlowStats> => {
  const res = await fetch(`${API_URL}/flows/${flowId}/stats`, {
    headers: getAuthHeader(),
  });
  return handleResponse<FlowStats>(res, 'stats');
};

export const getOverallFlowStats = async (): Promise<OverallFlowStats> => {
  const res = await fetch(`${API_URL}/flows/stats/overview`, {
    headers: getAuthHeader(),
  });
  return handleResponse<OverallFlowStats>(res, 'stats');
};

// ============= EXPORT/IMPORT =============

export const exportFlow = async (id: string): Promise<Blob> => {
  const res = await fetch(`${API_URL}/flows/${id}/export`, {
    headers: getAuthHeader(),
  });
  if (!res.ok) {
    throw new Error(`Error ${res.status}: ${res.statusText}`);
  }
  return res.blob();
};

export const importFlow = async (file: File): Promise<Flow> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_URL}/flows/import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${useAuthStore.getState().token}`,
    },
    body: formData,
  });
  return handleResponse<Flow>(res, 'flow');
};

// ============= HELPERS =============

export const downloadFlowAsJson = (flow: Flow) => {
  const data = JSON.stringify(flow, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `flow-${flow.name.toLowerCase().replace(/\s+/g, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Export all functions as service object
export const flowService = {
  getFlows,
  getFlowById,
  createFlow,
  updateFlow,
  deleteFlow,
  publishFlow,
  unpublishFlow,
  duplicateFlow,
  toggleFlowEnabled,
  validateFlow,
  simulateFlow,
  getFlowExecutions,
  getExecutionById,
  cancelExecution,
  retryExecution,
  getFlowVersions,
  rollbackFlow,
  getFlowByVersion,
  getFlowStats,
  getOverallFlowStats,
  exportFlow,
  importFlow,
  downloadFlowAsJson,
};

export default flowService;

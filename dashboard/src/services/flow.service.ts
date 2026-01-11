/**
 * Flow Service - Frontend API client
 * Handles all Flow Builder API communications
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

const getAuthHeader = () => ({
  Authorization: `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json',
});

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
  return res.json();
};

export const getFlowById = async (id: string): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}`, {
    headers: getAuthHeader(),
  });
  return res.json();
};

export const createFlow = async (data: CreateFlowInput): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const updateFlow = async (id: string, data: UpdateFlowInput): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const deleteFlow = async (id: string): Promise<void> => {
  await fetch(`${API_URL}/flows/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
    body: JSON.stringify({}),
  });
};

// ============= FLOW ACTIONS =============

export const publishFlow = async (id: string, changeDescription?: string): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}/publish`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ changeDescription }),
  });
  return res.json();
};

export const unpublishFlow = async (id: string): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}/unpublish`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return res.json();
};

export const duplicateFlow = async (id: string, name?: string): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}/duplicate`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ name }),
  });
  return res.json();
};

export const toggleFlowEnabled = async (id: string, enabled: boolean): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${id}`, {
    method: 'PUT',
    headers: getAuthHeader(),
    body: JSON.stringify({ enabled }),
  });
  return res.json();
};

// ============= VALIDATION =============

export const validateFlow = async (id: string): Promise<FlowValidation> => {
  const res = await fetch(`${API_URL}/flows/${id}/validate`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return res.json();
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
  return res.json();
};

// ============= EXECUTIONS =============

export const getFlowExecutions = async (
  flowId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
  }
): Promise<{
  executions: FlowExecution[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.set('page', params.page.toString());
  if (params?.limit) queryParams.set('limit', params.limit.toString());
  if (params?.status) queryParams.set('status', params.status);

  const res = await fetch(`${API_URL}/flows/${flowId}/executions?${queryParams.toString()}`, {
    headers: getAuthHeader(),
  });
  return res.json();
};

export const getExecutionById = async (executionId: string): Promise<FlowExecution> => {
  const res = await fetch(`${API_URL}/flows/executions/${executionId}`, {
    headers: getAuthHeader(),
  });
  return res.json();
};

export const cancelExecution = async (executionId: string): Promise<FlowExecution> => {
  const res = await fetch(`${API_URL}/flows/executions/${executionId}/cancel`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return res.json();
};

export const retryExecution = async (executionId: string): Promise<FlowExecution> => {
  const res = await fetch(`${API_URL}/flows/executions/${executionId}/retry`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return res.json();
};

// ============= VERSIONS =============

export const getFlowVersions = async (flowId: string): Promise<FlowVersion[]> => {
  const res = await fetch(`${API_URL}/flows/${flowId}/versions`, {
    headers: getAuthHeader(),
  });
  return res.json();
};

export const rollbackFlow = async (flowId: string, version: number): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${flowId}/rollback`, {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify({ version }),
  });
  return res.json();
};

export const getFlowByVersion = async (flowId: string, version: number): Promise<Flow> => {
  const res = await fetch(`${API_URL}/flows/${flowId}/versions/${version}`, {
    headers: getAuthHeader(),
  });
  return res.json();
};

// ============= STATISTICS =============

export const getFlowStats = async (flowId: string): Promise<FlowStats> => {
  const res = await fetch(`${API_URL}/flows/${flowId}/stats`, {
    headers: getAuthHeader(),
  });
  return res.json();
};

export const getOverallFlowStats = async (): Promise<OverallFlowStats> => {
  const res = await fetch(`${API_URL}/flows/stats/overview`, {
    headers: getAuthHeader(),
  });
  return res.json();
};

// ============= EXPORT/IMPORT =============

export const exportFlow = async (id: string): Promise<Blob> => {
  const res = await fetch(`${API_URL}/flows/${id}/export`, {
    headers: getAuthHeader(),
  });
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
  return res.json();
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

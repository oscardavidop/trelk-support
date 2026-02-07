/**
 * WebChat API Service
 * Client for webchat/live chat management endpoints
 */

import { api } from './api';

// ============= TYPES =============

export interface WebChatProject {
  _id: string;
  projectId: string;
  name: string;
  description?: string;
  allowedDomains: string[];
  apiKey: string;
  isActive: boolean;
  isOnline: boolean;
  createdAt: string;
  updatedAt: string;
  currentlyOnline?: boolean;
  onlineAgentCount?: number;
  config: WebChatProjectConfig;
}

export interface WebChatProjectConfig {
  theme: 'light' | 'dark' | 'auto';
  position: 'left' | 'right';
  primaryColor: string;
  headerText: string;
  welcomeMessage: string;
  offlineMessage: string;
  inputPlaceholder: string;
  requireEmail: boolean;
  requireName: boolean;
  collectPhone: boolean;
  showAgentPhotos: boolean;
  showAgentNames: boolean;
  enableAttachments: boolean;
  enableEmoji: boolean;
  enableSurvey: boolean;
  enableTypingIndicator: boolean;
  enableSoundNotifications: boolean;
  bubbleIcon: 'chat' | 'message' | 'support' | 'custom';
  customIconUrl?: string;
  logoUrl?: string;
  customCss?: string;
  autoOpenDelay: number;
  hideWhenOffline: boolean;
  showPoweredBy: boolean;
}

export interface SecurityEvent {
  type: 'rate_limit' | 'abuse' | 'ip_block' | 'domain_reject' | 'suspicious';
  visitorId?: string;
  ip?: string;
  projectId?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface CreateProjectData {
  name: string;
  description?: string;
  allowedDomains: string[];
  config?: Partial<WebChatProjectConfig>;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  allowedDomains?: string[];
  config?: Partial<WebChatProjectConfig>;
  isOnline?: boolean;
}

// ============= API METHODS =============

/**
 * List all webchat projects
 */
export async function listWebChatProjects(): Promise<WebChatProject[]> {
  const response = await api.get<{ ok: boolean; projects: WebChatProject[] }>('/api/webchat/projects');
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to list projects');
  }
  return response.data.projects;
}

/**
 * Get a single project by ID
 */
export async function getWebChatProject(projectId: string): Promise<WebChatProject> {
  const response = await api.get<{ ok: boolean; project: WebChatProject }>(`/api/webchat/projects/${projectId}`);
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to get project');
  }
  return response.data.project;
}

/**
 * Create a new webchat project
 */
export async function createWebChatProject(data: CreateProjectData): Promise<WebChatProject> {
  const response = await api.post<{ ok: boolean; project: WebChatProject }>('/api/webchat/projects', data);
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to create project');
  }
  return response.data.project;
}

/**
 * Update an existing project
 */
export async function updateWebChatProject(projectId: string, data: UpdateProjectData): Promise<WebChatProject> {
  const response = await api.patch<{ ok: boolean; project: WebChatProject }>(`/api/webchat/projects/${projectId}`, data);
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to update project');
  }
  return response.data.project;
}

/**
 * Delete a project (soft delete)
 */
export async function deleteWebChatProject(projectId: string): Promise<void> {
  const response = await api.delete<{ ok: boolean }>(`/api/webchat/projects/${projectId}`);
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to delete project');
  }
}

/**
 * Toggle project online status
 */
export async function toggleProjectStatus(projectId: string): Promise<boolean> {
  const response = await api.post<{ ok: boolean; isOnline: boolean }>(`/api/webchat/projects/${projectId}/toggle-status`);
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to toggle status');
  }
  return response.data.isOnline;
}

/**
 * Regenerate API key
 */
export async function regenerateApiKey(projectId: string): Promise<string> {
  const response = await api.post<{ ok: boolean; apiKey: string }>(`/api/webchat/projects/${projectId}/regenerate-key`);
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to regenerate API key');
  }
  return response.data.apiKey;
}

/**
 * Get embed code for project
 */
export async function getEmbedCode(projectId: string): Promise<{ embedCode: string; widgetUrl: string }> {
  const response = await api.get<{ ok: boolean; embedCode: string; widgetUrl: string }>(`/api/webchat/projects/${projectId}/embed-code`);
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to get embed code');
  }
  return { embedCode: response.data.embedCode, widgetUrl: response.data.widgetUrl };
}

// ============= SECURITY ENDPOINTS =============

/**
 * Get recent security events
 */
export async function getSecurityEvents(limit?: number, projectId?: string): Promise<SecurityEvent[]> {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (projectId) params.append('projectId', projectId);
  
  const url = `/api/webchat/security/events${params.toString() ? '?' + params.toString() : ''}`;
  const response = await api.get<{ ok: boolean; events: SecurityEvent[] }>(url);
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to get security events');
  }
  return response.data.events;
}

/**
 * Block an IP address
 */
export async function blockIP(ip: string, reason: string, durationMinutes: number = 60): Promise<void> {
  const response = await api.post<{ ok: boolean }>('/api/webchat/security/block-ip', {
    ip,
    reason,
    durationMinutes,
  });
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to block IP');
  }
}

/**
 * Unblock a visitor
 */
export async function unblockVisitor(visitorId: string): Promise<void> {
  const response = await api.post<{ ok: boolean }>('/api/webchat/security/unblock-visitor', { visitorId });
  if (!response.ok || !response.data.ok) {
    throw new Error('Failed to unblock visitor');
  }
}

// ============= DEFAULT CONFIG =============

export const DEFAULT_PROJECT_CONFIG: WebChatProjectConfig = {
  theme: 'auto',
  position: 'right',
  primaryColor: '#4F46E5',
  headerText: 'Soporte en vivo',
  welcomeMessage: '¡Hola! 👋 ¿En qué podemos ayudarte hoy?',
  offlineMessage: 'No hay agentes disponibles. Deja tu mensaje y te responderemos pronto.',
  inputPlaceholder: 'Escribe un mensaje...',
  requireEmail: false,
  requireName: false,
  collectPhone: false,
  showAgentPhotos: true,
  showAgentNames: true,
  enableAttachments: true,
  enableEmoji: true,
  enableSurvey: true,
  enableTypingIndicator: true,
  enableSoundNotifications: true,
  bubbleIcon: 'chat',
  autoOpenDelay: 0,
  hideWhenOffline: false,
  showPoweredBy: true,
};

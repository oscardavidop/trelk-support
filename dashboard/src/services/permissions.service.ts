/**
 * Permissions API Service
 * API calls for permission management
 */

import { api } from './api';
import type { 
  AgentWithPermissions, 
  Role, 
  PermissionCategory 
} from '../stores/permissionStore';

// ============= TYPES =============

export interface PermissionsResponse {
  ok: boolean;
  agent: AgentWithPermissions;
}

export interface CategoriesResponse {
  ok: boolean;
  categories: Record<string, PermissionCategory>;
  allPermissions: string[];
}

export interface AgentsListResponse {
  ok: boolean;
  agents: AgentWithPermissions[];
}

export interface RolesListResponse {
  ok: boolean;
  roles: Role[];
}

export interface UpdateRoleResponse {
  ok: boolean;
  agent: {
    _id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

export interface GrantRevokeResponse {
  ok: boolean;
  agent: {
    _id: string;
    name: string;
    permissions: string[];
    permissionsOverride: {
      allow: string[];
      deny: string[];
    };
  };
  granted?: string[];
  revoked?: string[];
}

// ============= API FUNCTIONS =============

/**
 * Get current user's permissions
 */
export async function getMyPermissions(): Promise<PermissionsResponse> {
  const response = await api.get<PermissionsResponse>('/api/permissions/me');
  return response.data;
}

/**
 * Get permission categories (for admin UI)
 */
export async function getPermissionCategories(): Promise<CategoriesResponse> {
  const response = await api.get<CategoriesResponse>('/api/permissions/categories');
  return response.data;
}

/**
 * List all agents with their permissions
 */
export async function getAgentsWithPermissions(): Promise<AgentsListResponse> {
  const response = await api.get<AgentsListResponse>('/api/permissions/agents');
  return response.data;
}

/**
 * Get specific agent's permissions
 */
export async function getAgentPermissions(agentId: string): Promise<PermissionsResponse> {
  const response = await api.get<PermissionsResponse>(`/api/permissions/agents/${agentId}`);
  return response.data;
}

/**
 * Update agent's base role
 */
export async function updateAgentRole(
  agentId: string, 
  role: string
): Promise<UpdateRoleResponse> {
  const response = await api.patch<UpdateRoleResponse>(
    `/api/permissions/agents/${agentId}/role`,
    { role }
  );
  return response.data;
}

/**
 * Update agent's permission overrides
 */
export async function updateAgentPermissions(
  agentId: string,
  overrides: { allow?: string[]; deny?: string[] }
): Promise<GrantRevokeResponse> {
  const response = await api.patch<GrantRevokeResponse>(
    `/api/permissions/agents/${agentId}/permissions`,
    overrides
  );
  return response.data;
}

/**
 * Grant specific permissions to an agent
 */
export async function grantPermissions(
  agentId: string,
  permissions: string[]
): Promise<GrantRevokeResponse> {
  const response = await api.post<GrantRevokeResponse>(
    `/api/permissions/agents/${agentId}/grant`,
    { permissions }
  );
  return response.data;
}

/**
 * Revoke specific permissions from an agent
 */
export async function revokePermissions(
  agentId: string,
  permissions: string[]
): Promise<GrantRevokeResponse> {
  const response = await api.post<GrantRevokeResponse>(
    `/api/permissions/agents/${agentId}/revoke`,
    { permissions }
  );
  return response.data;
}

/**
 * Reset agent permissions to role defaults
 */
export async function resetAgentPermissions(agentId: string): Promise<UpdateRoleResponse> {
  const response = await api.post<UpdateRoleResponse>(
    `/api/permissions/agents/${agentId}/reset`
  );
  return response.data;
}

/**
 * Get all roles
 */
export async function getRoles(): Promise<RolesListResponse> {
  const response = await api.get<RolesListResponse>('/api/permissions/roles');
  return response.data;
}

/**
 * Get role by ID
 */
export async function getRole(roleId: string): Promise<{ ok: boolean; role: Role }> {
  const response = await api.get<{ ok: boolean; role: Role }>(
    `/api/permissions/roles/${roleId}`
  );
  return response.data;
}

/**
 * Create custom role
 */
export async function createRole(data: {
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  priority?: number;
  color?: string;
  icon?: string;
}): Promise<{ ok: boolean; role: Role }> {
  const response = await api.post<{ ok: boolean; role: Role }>(
    '/api/permissions/roles',
    data
  );
  return response.data;
}

/**
 * Update role
 */
export async function updateRole(
  roleId: string,
  data: Partial<{
    displayName: string;
    description: string;
    permissions: string[];
    priority: number;
    color: string;
    icon: string;
    isActive: boolean;
  }>
): Promise<{ ok: boolean; role: Role }> {
  const response = await api.patch<{ ok: boolean; role: Role }>(
    `/api/permissions/roles/${roleId}`,
    data
  );
  return response.data;
}

/**
 * Delete custom role
 */
export async function deleteRole(roleId: string): Promise<{ ok: boolean; message: string }> {
  const response = await api.delete<{ ok: boolean; message: string }>(
    `/api/permissions/roles/${roleId}`
  );
  return response.data;
}

/**
 * Assign custom role to agent
 */
export async function assignRoleToAgent(
  roleId: string,
  agentId: string
): Promise<UpdateRoleResponse> {
  const response = await api.post<UpdateRoleResponse>(
    `/api/permissions/roles/${roleId}/assign/${agentId}`
  );
  return response.data;
}

/**
 * Permission Service - Centralized RBAC/ABAC Permission Management
 * 
 * This is the SINGLE SOURCE OF TRUTH for all permission checks.
 * Both API endpoints and UI should use this service.
 * 
 * Features:
 * - Role-based permissions
 * - Per-user permission overrides (allow/deny)
 * - Permission caching with invalidation
 * - Audit logging for permission changes
 * - Destructive action validation
 */

import { Types } from 'mongoose';
import { FastifyRequest } from 'fastify';
import { Agent, type IAgent, type AgentRole } from '../database/index.js';
import { 
  Role, 
  type IRole, 
  DEFAULT_ROLE_PERMISSIONS, 
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
} from '../database/models/Role.js';
import { logAuditFromRequest } from './audit-log.service.js';
import { getRedisClient } from './redis.js';
import { emitPermissionsUpdated, emitRoleChanged } from './socket.js';

// Re-export for convenience
export { ALL_PERMISSIONS, PERMISSION_CATEGORIES, DEFAULT_ROLE_PERMISSIONS };

/**
 * Permission check result with details
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  source?: 'role' | 'override_allow' | 'override_deny' | 'admin';
}

/**
 * Agent with effective permissions (for API responses)
 */
export interface AgentWithPermissions {
  _id: string;
  name: string;
  email: string;
  role: AgentRole;
  permissions: string[];
  canRequestPermissions: boolean;
  permissionsOverride?: {
    allow: string[];
    deny: string[];
  };
}

// Cache TTL in seconds
const PERMISSION_CACHE_TTL = 300; // 5 minutes

/**
 * Get cache key for agent permissions
 */
function getCacheKey(agentId: string): string {
  return `permissions:agent:${agentId}`;
}

/**
 * Get effective permissions for an agent
 * Combines role permissions with user overrides
 */
export async function getEffectivePermissions(agentId: string): Promise<string[]> {
  // Try cache first
  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(getCacheKey(agentId));
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('Permission cache read error:', err);
    }
  }

  // Fetch agent with role
  const agent = await Agent.findById(agentId).populate('roleId');
  if (!agent) {
    return [];
  }

  const permissions = await calculateEffectivePermissions(agent);

  // Cache the result
  if (redis) {
    try {
      await redis.setex(
        getCacheKey(agentId),
        PERMISSION_CACHE_TTL,
        JSON.stringify(permissions)
      );
    } catch (err) {
      console.warn('Permission cache write error:', err);
    }
  }

  return permissions;
}

/**
 * Calculate effective permissions for an agent
 * @internal Use getEffectivePermissions for cached version
 */
export async function calculateEffectivePermissions(agent: IAgent): Promise<string[]> {
  // Start with base role permissions
  let basePermissions: string[] = [];
  
  // Check for custom role first
  if (agent.roleId) {
    const customRole = await Role.findById(agent.roleId);
    if (customRole?.isActive) {
      basePermissions = [...customRole.permissions];
    }
  }
  
  // If no custom role, use default role permissions
  if (basePermissions.length === 0) {
    basePermissions = DEFAULT_ROLE_PERMISSIONS[agent.role] || [];
  }
  
  // Admin has all permissions
  if (basePermissions.includes('*')) {
    return ['*'];
  }
  
  // Apply overrides
  const overrides = agent.permissionsOverride;
  const effectivePermissions = new Set(basePermissions);
  
  // Add allowed permissions
  if (overrides?.allow) {
    overrides.allow.forEach(p => effectivePermissions.add(p));
  }
  
  // Remove denied permissions
  if (overrides?.deny) {
    overrides.deny.forEach(p => effectivePermissions.delete(p));
  }
  
  return Array.from(effectivePermissions);
}

/**
 * Check if agent has a specific permission
 */
export async function hasPermission(
  agentId: string, 
  permission: string
): Promise<PermissionCheckResult> {
  const agent = await Agent.findById(agentId).select('+isActive +permissionsOverride +roleId');
  if (!agent) {
    return { allowed: false, reason: 'Agent not found' };
  }
  
  return checkAgentPermission(agent, permission);
}

/**
 * Check permission for an already loaded agent
 */
export function checkAgentPermission(
  agent: IAgent, 
  permission: string
): PermissionCheckResult {
  // Inactive agents have no permissions
  if (!agent.isActive) {
    return { allowed: false, reason: 'Account is deactivated' };
  }

  // Check if explicitly denied first (highest priority)
  if (agent.permissionsOverride?.deny?.includes(permission)) {
    return { 
      allowed: false, 
      reason: 'Permission explicitly denied',
      source: 'override_deny',
    };
  }

  // Check if explicitly allowed (override)
  if (agent.permissionsOverride?.allow?.includes(permission)) {
    return { 
      allowed: true, 
      source: 'override_allow',
    };
  }

  // Get base role permissions
  const rolePermissions = DEFAULT_ROLE_PERMISSIONS[agent.role] || [];
  
  // Admin wildcard
  if (rolePermissions.includes('*')) {
    return { allowed: true, source: 'admin' };
  }
  
  // Check role permission
  if (rolePermissions.includes(permission)) {
    return { allowed: true, source: 'role' };
  }
  
  // Check category wildcard (e.g., 'chats.*')
  const category = permission.split('.')[0];
  if (rolePermissions.includes(`${category}.*`)) {
    return { allowed: true, source: 'role' };
  }
  
  return { 
    allowed: false, 
    reason: `Missing permission: ${permission}`,
  };
}

/**
 * Check if agent has any of the specified permissions
 */
export async function hasAnyPermission(
  agentId: string, 
  permissions: string[]
): Promise<boolean> {
  const agent = await Agent.findById(agentId);
  if (!agent || !agent.isActive) return false;
  
  return permissions.some(p => checkAgentPermission(agent, p).allowed);
}

/**
 * Check if agent has all specified permissions
 */
export async function hasAllPermissions(
  agentId: string, 
  permissions: string[]
): Promise<boolean> {
  const agent = await Agent.findById(agentId);
  if (!agent || !agent.isActive) return false;
  
  return permissions.every(p => checkAgentPermission(agent, p).allowed);
}

/**
 * Validate if a permission string is valid
 */
export function isValidPermission(permission: string): boolean {
  if (permission === '*') return true;
  if (permission.endsWith('.*')) {
    const category = permission.slice(0, -2);
    return Object.keys(PERMISSION_CATEGORIES).includes(category);
  }
  return ALL_PERMISSIONS.includes(permission);
}

/**
 * Invalidate permission cache for an agent
 */
export async function invalidatePermissionCache(agentId: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(getCacheKey(agentId));
    } catch (err) {
      console.warn('Permission cache invalidation error:', err);
    }
  }
  
  // Increment permission version in DB
  await Agent.updateOne(
    { _id: agentId },
    { $inc: { permissionVersion: 1 } }
  );
}

/**
 * Invalidate all permission caches (use sparingly)
 */
export async function invalidateAllPermissionCaches(): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const keys = await redis.keys('permissions:agent:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (err) {
      console.warn('Permission cache bulk invalidation error:', err);
    }
  }
}

// ============= PERMISSION MANAGEMENT =============

/**
 * Update agent's role
 */
export async function updateAgentRole(
  agentId: string,
  newRole: AgentRole,
  updatedBy: string,
  request?: FastifyRequest
): Promise<IAgent | null> {
  const agent = await Agent.findById(agentId);
  if (!agent) return null;
  
  const previousRole = agent.role;
  
  agent.role = newRole;
  agent.permissionVersion = (agent.permissionVersion || 0) + 1;
  await agent.save();
  
  // Invalidate cache
  await invalidatePermissionCache(agentId);
  
  // Get new effective permissions
  const newPermissions = await getEffectivePermissions(agentId);
  
  // Emit WebSocket event for real-time update
  const updater = request?.agent;
  await emitRoleChanged(agentId, {
    oldRole: previousRole,
    newRole,
    permissions: newPermissions,
    permissionVersion: agent.permissionVersion,
    updatedBy: {
      id: updatedBy,
      name: updater?.name || 'System',
    },
  });
  
  // Log audit
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'agent.role.update',
      category: 'agent',
      targetType: 'agent',
      targetId: agentId,
      targetDescription: agent.name,
      previousValue: { role: previousRole },
      newValue: { role: newRole },
      severity: 'high',
    });
  }
  
  return agent;
}

/**
 * Update agent's permission overrides
 */
export async function updatePermissionOverrides(
  agentId: string,
  overrides: { allow?: string[]; deny?: string[] },
  updatedBy: string,
  request?: FastifyRequest
): Promise<IAgent | null> {
  const agent = await Agent.findById(agentId);
  if (!agent) return null;
  
  const previousOverrides = { ...agent.permissionsOverride };
  
  // Validate permissions
  const allPerms = [...(overrides.allow || []), ...(overrides.deny || [])];
  const invalidPerms = allPerms.filter(p => !isValidPermission(p));
  
  if (invalidPerms.length > 0) {
    throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
  }
  
  // Update overrides
  agent.permissionsOverride = {
    allow: overrides.allow || [],
    deny: overrides.deny || [],
  };
  agent.permissionVersion = (agent.permissionVersion || 0) + 1;
  
  await agent.save();
  
  // Invalidate cache
  await invalidatePermissionCache(agentId);
  
  // Get new effective permissions
  const newPermissions = await getEffectivePermissions(agentId);
  
  // Emit WebSocket event for real-time update
  const updater = request?.agent;
  await emitPermissionsUpdated(agentId, {
    permissions: newPermissions,
    role: agent.role,
    permissionVersion: agent.permissionVersion,
    updatedBy: {
      id: updatedBy,
      name: updater?.name || 'System',
    },
  });
  
  // Log audit
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'agent.permissions.update',
      category: 'agent',
      targetType: 'agent',
      targetId: agentId,
      targetDescription: agent.name,
      previousValue: { permissionsOverride: previousOverrides },
      newValue: { permissionsOverride: agent.permissionsOverride },
      severity: 'high',
    });
  }
  
  return agent;
}

/**
 * Grant specific permissions to an agent
 */
export async function grantPermissions(
  agentId: string,
  permissions: string[],
  grantedBy: string,
  request?: FastifyRequest
): Promise<IAgent | null> {
  const agent = await Agent.findById(agentId);
  if (!agent) return null;
  
  // Validate permissions
  const invalidPerms = permissions.filter(p => !isValidPermission(p));
  if (invalidPerms.length > 0) {
    throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
  }
  
  const currentAllow = agent.permissionsOverride?.allow || [];
  const currentDeny = agent.permissionsOverride?.deny || [];
  
  // Add to allow, remove from deny
  const newAllow = [...new Set([...currentAllow, ...permissions])];
  const newDeny = currentDeny.filter(p => !permissions.includes(p));
  
  agent.permissionsOverride = { allow: newAllow, deny: newDeny };
  agent.permissionVersion = (agent.permissionVersion || 0) + 1;
  await agent.save();
  
  await invalidatePermissionCache(agentId);
  
  // Get new effective permissions
  const newPermissions = await getEffectivePermissions(agentId);
  
  // Emit WebSocket event for real-time update
  const updater = request?.agent;
  await emitPermissionsUpdated(agentId, {
    permissions: newPermissions,
    role: agent.role,
    permissionVersion: agent.permissionVersion,
    updatedBy: {
      id: grantedBy,
      name: updater?.name || 'System',
    },
  });
  
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'agent.permissions.grant',
      category: 'agent',
      targetType: 'agent',
      targetId: agentId,
      targetDescription: agent.name,
      newValue: { granted: permissions },
      severity: 'high',
    });
  }
  
  return agent;
}

/**
 * Revoke specific permissions from an agent
 */
export async function revokePermissions(
  agentId: string,
  permissions: string[],
  revokedBy: string,
  request?: FastifyRequest
): Promise<IAgent | null> {
  const agent = await Agent.findById(agentId);
  if (!agent) return null;
  
  const currentAllow = agent.permissionsOverride?.allow || [];
  const currentDeny = agent.permissionsOverride?.deny || [];
  
  // Remove from allow, add to deny
  const newAllow = currentAllow.filter(p => !permissions.includes(p));
  const newDeny = [...new Set([...currentDeny, ...permissions])];
  
  agent.permissionsOverride = { allow: newAllow, deny: newDeny };
  agent.permissionVersion = (agent.permissionVersion || 0) + 1;
  await agent.save();
  
  await invalidatePermissionCache(agentId);
  
  // Get new effective permissions
  const newPermissions = await getEffectivePermissions(agentId);
  
  // Emit WebSocket event for real-time update
  const updater = request?.agent;
  await emitPermissionsUpdated(agentId, {
    permissions: newPermissions,
    role: agent.role,
    permissionVersion: agent.permissionVersion,
    updatedBy: {
      id: revokedBy,
      name: updater?.name || 'System',
    },
  });
  
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'agent.permissions.revoke',
      category: 'agent',
      targetType: 'agent',
      targetId: agentId,
      targetDescription: agent.name,
      newValue: { revoked: permissions },
      severity: 'high',
    });
  }
  
  return agent;
}

/**
 * Reset agent permissions to role defaults
 */
export async function resetPermissionsToDefault(
  agentId: string,
  resetBy: string,
  request?: FastifyRequest
): Promise<IAgent | null> {
  const agent = await Agent.findById(agentId);
  if (!agent) return null;
  
  const previousOverrides = { ...agent.permissionsOverride };
  
  agent.permissionsOverride = { allow: [], deny: [] };
  agent.roleId = undefined;
  agent.permissionVersion = (agent.permissionVersion || 0) + 1;
  await agent.save();
  
  await invalidatePermissionCache(agentId);
  
  // Get new effective permissions (role defaults)
  const newPermissions = await getEffectivePermissions(agentId);
  
  // Emit WebSocket event for real-time update
  const updater = request?.agent;
  await emitPermissionsUpdated(agentId, {
    permissions: newPermissions,
    role: agent.role,
    permissionVersion: agent.permissionVersion,
    updatedBy: {
      id: resetBy,
      name: updater?.name || 'System',
    },
  });
  
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'agent.permissions.reset',
      category: 'agent',
      targetType: 'agent',
      targetId: agentId,
      targetDescription: agent.name,
      previousValue: { permissionsOverride: previousOverrides },
      newValue: { permissionsOverride: { allow: [], deny: [] } },
      severity: 'medium',
    });
  }
  
  return agent;
}

// ============= ROLE MANAGEMENT =============

/**
 * Get all roles
 */
export async function getAllRoles(): Promise<IRole[]> {
  return Role.find().sort({ priority: -1, name: 1 });
}

/**
 * Get role by ID
 */
export async function getRoleById(roleId: string): Promise<IRole | null> {
  return Role.findById(roleId);
}

/**
 * Get role by name
 */
export async function getRoleByName(name: string): Promise<IRole | null> {
  return Role.findOne({ name: name.toLowerCase() });
}

/**
 * Create custom role
 */
export async function createRole(
  data: {
    name: string;
    displayName: string;
    description?: string;
    permissions: string[];
    priority?: number;
    color?: string;
    icon?: string;
  },
  createdBy: string,
  request?: FastifyRequest
): Promise<IRole> {
  // Validate permissions
  const invalidPerms = data.permissions.filter(p => !isValidPermission(p));
  if (invalidPerms.length > 0) {
    throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
  }
  
  const role = await Role.create({
    name: data.name.toLowerCase(),
    displayName: data.displayName,
    description: data.description,
    permissions: data.permissions,
    priority: data.priority || 0,
    color: data.color,
    icon: data.icon,
    isSystem: false,
    createdBy: new Types.ObjectId(createdBy),
  });
  
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'role.create',
      category: 'security',
      targetType: 'setting',
      targetId: role._id.toString(),
      targetDescription: role.displayName,
      newValue: { role: role.toObject() },
      severity: 'high',
    });
  }
  
  return role;
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
  }>,
  updatedBy: string,
  request?: FastifyRequest
): Promise<IRole | null> {
  const role = await Role.findById(roleId);
  if (!role) return null;
  
  // System roles have limited editability
  if (role.isSystem) {
    // Only allow updating permissions, displayName, and color for system roles
    data = {
      permissions: data.permissions,
      displayName: data.displayName,
      color: data.color,
      icon: data.icon,
    };
  }
  
  // Validate permissions
  if (data.permissions) {
    const invalidPerms = data.permissions.filter(p => !isValidPermission(p));
    if (invalidPerms.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
    }
  }
  
  const previousValue = role.toObject();
  
  Object.assign(role, data);
  role.updatedBy = new Types.ObjectId(updatedBy);
  await role.save();
  
  // Invalidate all caches when role changes
  await invalidateAllPermissionCaches();
  
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'role.update',
      category: 'security',
      targetType: 'setting',
      targetId: roleId,
      targetDescription: role.displayName,
      previousValue: { role: previousValue },
      newValue: { role: role.toObject() },
      severity: 'high',
    });
  }
  
  return role;
}

/**
 * Delete role (non-system only)
 */
export async function deleteRole(
  roleId: string,
  deletedBy: string,
  request?: FastifyRequest
): Promise<boolean> {
  const role = await Role.findById(roleId);
  if (!role || role.isSystem) {
    return false;
  }
  
  // Remove this role from all agents
  await Agent.updateMany(
    { roleId: role._id },
    { $unset: { roleId: 1 } }
  );
  
  await role.deleteOne();
  
  // Invalidate all caches
  await invalidateAllPermissionCaches();
  
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'role.delete',
      category: 'security',
      targetType: 'setting',
      targetId: roleId,
      targetDescription: role.displayName,
      previousValue: { role: role.toObject() },
      severity: 'critical',
    });
  }
  
  return true;
}

/**
 * Assign custom role to agent
 */
export async function assignRoleToAgent(
  agentId: string,
  roleId: string,
  assignedBy: string,
  request?: FastifyRequest
): Promise<IAgent | null> {
  const role = await Role.findById(roleId);
  if (!role || !role.isActive) return null;
  
  const agent = await Agent.findById(agentId);
  if (!agent) return null;
  
  const previousRoleId = agent.roleId;
  
  agent.roleId = role._id;
  await agent.save();
  
  await invalidatePermissionCache(agentId);
  
  if (request) {
    await logAuditFromRequest({
      request,
      action: 'agent.role.assign',
      category: 'agent',
      targetType: 'agent',
      targetId: agentId,
      targetDescription: agent.name,
      previousValue: { roleId: previousRoleId?.toString() },
      newValue: { roleId: roleId, roleName: role.name },
      severity: 'high',
    });
  }
  
  return agent;
}

// ============= DESTRUCTIVE ACTION VALIDATION =============

/**
 * Permissions that require additional confirmation
 */
export const DESTRUCTIVE_PERMISSIONS = [
  'system.destructive',
  'chats.delete_all',
  'contacts.delete',
  'agents.delete',
];

/**
 * Check if action requires confirmation
 */
export function requiresConfirmation(permission: string): boolean {
  return DESTRUCTIVE_PERMISSIONS.includes(permission);
}

/**
 * Validate destructive action
 * Returns true if action is allowed to proceed
 */
export async function validateDestructiveAction(
  agentId: string,
  permission: string,
  confirmationText?: string,
  request?: FastifyRequest
): Promise<{ allowed: boolean; reason?: string }> {
  // Check basic permission
  const permCheck = await hasPermission(agentId, permission);
  if (!permCheck.allowed) {
    return permCheck;
  }
  
  // Destructive actions require admin role
  const agent = await Agent.findById(agentId);
  if (!agent || agent.role !== 'admin') {
    return { 
      allowed: false, 
      reason: 'Destructive actions require admin role' 
    };
  }
  
  // Require confirmation text for certain actions
  if (DESTRUCTIVE_PERMISSIONS.includes(permission)) {
    if (!confirmationText || confirmationText !== 'CONFIRM') {
      return { 
        allowed: false, 
        reason: 'Destructive action requires confirmation text "CONFIRM"' 
      };
    }
  }
  
  // Log the destructive action attempt
  if (request) {
    await logAuditFromRequest({
      request,
      action: `destructive.${permission}`,
      category: 'security',
      targetType: 'setting',
      targetId: 'system',
      targetDescription: `Destructive action: ${permission}`,
      severity: 'critical',
    });
  }
  
  return { allowed: true };
}

// ============= PERMISSION INFO FOR FRONTEND =============

/**
 * Get formatted permission categories for UI
 */
export function getPermissionCategories(): Record<string, { 
  name: string; 
  permissions: { key: string; label: string; description: string }[] 
}> {
  const categories: Record<string, { 
    name: string; 
    permissions: { key: string; label: string; description: string }[] 
  }> = {};
  
  const permissionLabels: Record<string, { label: string; description: string }> = {
    // Chats
    'chats.read': { label: 'Ver chats', description: 'Ver chats asignados' },
    'chats.read_all': { label: 'Ver todos los chats', description: 'Ver chats de otros agentes' },
    'chats.respond': { label: 'Responder', description: 'Enviar mensajes en chats' },
    'chats.close': { label: 'Cerrar', description: 'Cerrar sesiones de chat' },
    'chats.reopen': { label: 'Reabrir', description: 'Reabrir chats cerrados' },
    'chats.transfer': { label: 'Transferir', description: 'Transferir a otros agentes' },
    'chats.takeover': { label: 'Tomar control', description: 'Tomar chat de otro agente' },
    'chats.delete': { label: 'Eliminar', description: 'Eliminar chats individuales' },
    'chats.delete_all': { label: 'Eliminar todos', description: '⚠️ Eliminar todos los chats' },
    'chats.monitor': { label: 'Monitorear', description: 'Monitoreo en tiempo real' },
    'chats.export': { label: 'Exportar', description: 'Exportar transcripciones' },

    // Uploads
    'uploads.upload': { label: 'Subir archivos', description: 'Subir archivos en chats' },
    'uploads.delete': { label: 'Eliminar archivos', description: 'Eliminar archivos subidos' },
    
    
    // Contacts
    'contacts.read': { label: 'Ver contactos', description: 'Ver información de contactos' },
    'contacts.write': { label: 'Editar contactos', description: 'Modificar información' },
    'contacts.delete': { label: 'Eliminar contactos', description: '⚠️ Eliminar contactos' },
    'contacts.export': { label: 'Exportar contactos', description: 'Exportar datos' },
    'contacts.import': { label: 'Importar contactos', description: 'Importar contactos' },
    'contacts.block': { label: 'Bloquear usuarios', description: 'Bloquear/desbloquear' },
    'contacts.merge': { label: 'Fusionar contactos', description: 'Fusionar duplicados' },
    
    // Agents
    'agents.read': { label: 'Ver agentes', description: 'Ver lista de agentes' },
    'agents.write': { label: 'Gestionar agentes', description: 'Crear/editar agentes' },
    'agents.delete': { label: 'Eliminar agentes', description: '⚠️ Eliminar agentes' },
    'agents.permissions': { label: 'Gestionar permisos', description: 'Modificar roles y permisos' },
    'agents.status': { label: 'Cambiar estado', description: 'Cambiar estado de agentes' },
    'agents.teams': { label: 'Gestionar equipos', description: 'Asignar a equipos' },
    
    // ... más etiquetas según necesidad
  };
  
  for (const [category, permissions] of Object.entries(PERMISSION_CATEGORIES)) {
    categories[category] = {
      name: category.charAt(0).toUpperCase() + category.slice(1),
      permissions: permissions.map(p => ({
        key: p,
        label: permissionLabels[p]?.label || p.split('.')[1],
        description: permissionLabels[p]?.description || '',
      })),
    };
  }
  
  return categories;
}

/**
 * Get agent permissions summary for frontend
 */
export async function getAgentPermissionsSummary(agentId: string): Promise<AgentWithPermissions | null> {
  const agent = await Agent.findById(agentId);
  if (!agent) return null;
  
  const effectivePermissions = await getEffectivePermissions(agentId);
  
  return {
    _id: agent._id.toString(),
    name: agent.name,
    email: agent.email,
    role: agent.role,
    permissions: effectivePermissions,
    permissionsOverride: agent.permissionsOverride,
    canRequestPermissions: agent.canRequestPermissions !== false,
  };
}

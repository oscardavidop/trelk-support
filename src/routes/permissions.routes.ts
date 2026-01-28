/**
 * Permission Management Routes
 * API endpoints for RBAC administration
 * 
 * Endpoints:
 * - GET /api/permissions/me - Get current user's permissions
 * - GET /api/permissions/categories - Get all permission categories (for UI)
 * - GET /api/permissions/agents - List all agents with their permissions
 * - GET /api/permissions/agents/:agentId - Get specific agent's permissions
 * - PATCH /api/permissions/agents/:agentId/role - Update agent's role
 * - PATCH /api/permissions/agents/:agentId/permissions - Update agent's permission overrides
 * - POST /api/permissions/agents/:agentId/grant - Grant permissions
 * - POST /api/permissions/agents/:agentId/revoke - Revoke permissions
 * - POST /api/permissions/agents/:agentId/reset - Reset to role defaults
 * - GET /api/permissions/roles - List all roles
 * - POST /api/permissions/roles - Create custom role
 * - PATCH /api/permissions/roles/:roleId - Update role
 * - DELETE /api/permissions/roles/:roleId - Delete custom role
 * - POST /api/permissions/roles/:roleId/assign/:agentId - Assign role to agent
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { 
  authMiddleware, 
  requirePermission, 
  requireAllPermissions,
  can,
} from '../middleware/auth.js';
import {
  getEffectivePermissions,
  getAgentPermissionsSummary,
  getPermissionCategories,
  updateAgentRole,
  updatePermissionOverrides,
  grantPermissions,
  revokePermissions,
  resetPermissionsToDefault,
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToAgent,
  ALL_PERMISSIONS,
  isValidPermission,
} from '../services/permission.service.js';
import { getAllAgents, findAgentById } from '../services/agent.service.js';
import type { AgentRole } from '../database/index.js';
import { isValidObjectId } from 'mongoose';

// Type definitions
interface AgentParams {
  agentId: string;
}

interface RoleParams {
  roleId: string;
}

interface AssignRoleParams {
  roleId: string;
  agentId: string;
}

interface UpdateRoleBody {
  role: AgentRole;
}

interface UpdatePermissionsBody {
  allow?: string[];
  deny?: string[];
}

interface GrantRevokeBody {
  permissions: string[];
}

interface CreateRoleBody {
  name: string;
  displayName: string;
  description?: string;
  permissions: string[];
  priority?: number;
  color?: string;
  icon?: string;
}

interface UpdateRoleBody2 {
  displayName?: string;
  description?: string;
  permissions?: string[];
  priority?: number;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

export async function registerPermissionRoutes(fastify: FastifyInstance): Promise<void> {
  
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ============= CURRENT USER PERMISSIONS =============

  /**
   * Get current user's effective permissions
   * Any authenticated user can see their own permissions
   */
  fastify.get('/api/permissions/me', async (request) => {
    const agentId = request.agent!._id.toString();
    const summary = await getAgentPermissionsSummary(agentId);
    
    return {
      ok: true,
      agent: summary,
    };
  });

  /**
   * Get permission categories (for UI)
   * Any authenticated user can see categories
   */
  fastify.get('/api/permissions/categories', async () => {
    const categories = getPermissionCategories();
    
    return {
      ok: true,
      categories,
      allPermissions: ALL_PERMISSIONS,
    };
  });

  // ============= AGENT PERMISSION MANAGEMENT =============

  /**
   * List all agents with their permissions
   * Requires agents.permissions permission
   */
  fastify.get(
    '/api/permissions/agents',
    { preHandler: requirePermission('agents.permissions') },
    async () => {
      const agents = await getAllAgents();
      
      const agentsWithPermissions = await Promise.all(
        agents.map(async (agent) => {
          const permissions = await getEffectivePermissions(agent._id.toString());
          return {
            _id: agent._id.toString(),
            name: agent.name,
            email: agent.email,
            role: agent.role,
            roleId: agent.roleId?.toString(),
            isActive: agent.isActive,
            permissions,
            permissionsOverride: agent.permissionsOverride,
            permissionVersion: agent.permissionVersion,
            canRequestPermissions: agent.canRequestPermissions !== false,
          };
        })
      );
      
      return {
        ok: true,
        agents: agentsWithPermissions,
      };
    }
  );

  /**
   * Get specific agent's permissions
   */
  fastify.get<{ Params: AgentParams }>(
    '/api/permissions/agents/:agentId',
    { preHandler: requirePermission('agents.permissions') },
    async (request, reply) => {
      const { agentId } = request.params;
      
      if (!isValidObjectId(agentId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid agent ID' });
      }
      
      const summary = await getAgentPermissionsSummary(agentId);
      
      if (!summary) {
        return reply.code(404).send({ ok: false, error: 'Agent not found' });
      }
      
      return {
        ok: true,
        agent: summary,
      };
    }
  );

  /**
   * Update agent's base role
   */
  fastify.put<{ Params: AgentParams; Body: UpdateRoleBody }>(
    '/api/permissions/agents/:agentId/role',
    { preHandler: requirePermission('agents.permissions') },
    async (request, reply) => {
      const { agentId } = request.params;
      const { role } = request.body;
      
      if (!isValidObjectId(agentId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid agent ID' });
      }
      
      const validRoles: AgentRole[] = ['admin', 'supervisor', 'support', 'junior'];
      if (!validRoles.includes(role)) {
        return reply.code(400).send({ 
          ok: false, 
          error: `Invalid role. Must be one of: ${validRoles.join(', ')}` 
        });
      }
      
      // Only admin can assign admin role
      if (role === 'admin' && request.agent!.role !== 'admin') {
        return reply.code(403).send({ 
          ok: false, 
          error: 'Only admins can assign admin role' 
        });
      }
      
      // Can't change your own role (safety)
      if (agentId === request.agent!._id.toString()) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Cannot change your own role' 
        });
      }
      
      const agent = await updateAgentRole(
        agentId,
        role,
        request.agent!._id.toString(),
        request
      );
      
      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Agent not found' });
      }
      
      const permissions = await getEffectivePermissions(agentId);
      
      return {
        ok: true,
        agent: {
          _id: agent._id.toString(),
          name: agent.name,
          email: agent.email,
          role: agent.role,
          isActive: agent.isActive,
          permissions,
          permissionsOverride: agent.permissionsOverride,
          permissionVersion: agent.permissionVersion,
        },
      };
    }
  );

  /**
   * Update agent's permission overrides
   */
  fastify.patch<{ Params: AgentParams; Body: UpdatePermissionsBody }>(
    '/api/permissions/agents/:agentId/permissions',
    { preHandler: requirePermission('agents.permissions') },
    async (request, reply) => {
      const { agentId } = request.params;
      const { allow, deny } = request.body;
      
      if (!isValidObjectId(agentId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid agent ID' });
      }
      
      try {
        const agent = await updatePermissionOverrides(
          agentId,
          { allow, deny },
          request.agent!._id.toString(),
          request
        );
        
        if (!agent) {
          return reply.code(404).send({ ok: false, error: 'Agent not found' });
        }
        
        const permissions = await getEffectivePermissions(agentId);
        
        return {
          ok: true,
          agent: {
            _id: agent._id.toString(),
            name: agent.name,
            role: agent.role,
            permissions,
            permissionsOverride: agent.permissionsOverride,
          },
        };
      } catch (error) {
        return reply.code(400).send({ 
          ok: false, 
          error: error instanceof Error ? error.message : 'Invalid permissions' 
        });
      }
    }
  );

  /**
   * Grant specific permissions to an agent
   */
  fastify.post<{ Params: AgentParams; Body: GrantRevokeBody }>(
    '/api/permissions/agents/:agentId/grant',
    { preHandler: requirePermission('agents.permissions') },
    async (request, reply) => {
      const { agentId } = request.params;
      const { permissions } = request.body;
      
      if (!isValidObjectId(agentId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid agent ID' });
      }
      
      if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
        return reply.code(400).send({ ok: false, error: 'Permissions array required' });
      }
      
      // Validate all permissions
      const invalidPerms = permissions.filter(p => !isValidPermission(p));
      if (invalidPerms.length > 0) {
        return reply.code(400).send({ 
          ok: false, 
          error: `Invalid permissions: ${invalidPerms.join(', ')}` 
        });
      }
      
      try {
        const agent = await grantPermissions(
          agentId,
          permissions,
          request.agent!._id.toString(),
          request
        );
        
        if (!agent) {
          return reply.code(404).send({ ok: false, error: 'Agent not found' });
        }
        
        const effectivePerms = await getEffectivePermissions(agentId);
        
        return {
          ok: true,
          agent: {
            _id: agent._id.toString(),
            name: agent.name,
            email: agent.email,
            role: agent.role,
            isActive: agent.isActive,
            permissions: effectivePerms,
            permissionsOverride: agent.permissionsOverride,
            permissionVersion: agent.permissionVersion,
          },
          granted: permissions,
        };
      } catch (error) {
        return reply.code(400).send({ 
          ok: false, 
          error: error instanceof Error ? error.message : 'Failed to grant permissions' 
        });
      }
    }
  );

  /**
   * Revoke specific permissions from an agent
   */
  fastify.post<{ Params: AgentParams; Body: GrantRevokeBody }>(
    '/api/permissions/agents/:agentId/revoke',
    { preHandler: requirePermission('agents.permissions') },
    async (request, reply) => {
      const { agentId } = request.params;
      const { permissions } = request.body;
      
      if (!isValidObjectId(agentId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid agent ID' });
      }
      
      if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
        return reply.code(400).send({ ok: false, error: 'Permissions array required' });
      }
      
      try {
        const agent = await revokePermissions(
          agentId,
          permissions,
          request.agent!._id.toString(),
          request
        );
        
        if (!agent) {
          return reply.code(404).send({ ok: false, error: 'Agent not found' });
        }
        
        const effectivePerms = await getEffectivePermissions(agentId);
        
        return {
          ok: true,
          agent: {
            _id: agent._id.toString(),
            name: agent.name,
            email: agent.email,
            role: agent.role,
            isActive: agent.isActive,
            permissions: effectivePerms,
            permissionsOverride: agent.permissionsOverride,
            permissionVersion: agent.permissionVersion,
          },
          revoked: permissions,
        };
      } catch (error) {
        return reply.code(400).send({ 
          ok: false, 
          error: error instanceof Error ? error.message : 'Failed to revoke permissions' 
        });
      }
    }
  );

  /**
   * Reset agent permissions to role defaults
   */
  fastify.post<{ Params: AgentParams }>(
    '/api/permissions/agents/:agentId/reset',
    { preHandler: requirePermission('agents.permissions') },
    async (request, reply) => {
      const { agentId } = request.params;
      
      if (!isValidObjectId(agentId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid agent ID' });
      }
      
      const agent = await resetPermissionsToDefault(
        agentId,
        request.agent!._id.toString(),
        request
      );
      
      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Agent not found' });
      }
      
      const effectivePerms = await getEffectivePermissions(agentId);
      
      return {
        ok: true,
        agent: {
          _id: agent._id.toString(),
          name: agent.name,
          email: agent.email,
          role: agent.role,
          isActive: agent.isActive,
          permissions: effectivePerms,
          permissionsOverride: agent.permissionsOverride,
          permissionVersion: agent.permissionVersion,
        },
        message: 'Permissions reset to role defaults',
      };
    }
  );

  // ============= ROLE MANAGEMENT =============

  /**
   * List all roles
   */
  fastify.get(
    '/api/permissions/roles',
    { preHandler: requirePermission('agents.permissions') },
    async () => {
      const roles = await getAllRoles();
      
      return {
        ok: true,
        roles: roles.map(role => ({
          _id: role._id.toString(),
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          permissions: role.permissions,
          isSystem: role.isSystem,
          isActive: role.isActive,
          priority: role.priority,
          color: role.color,
          icon: role.icon,
        })),
      };
    }
  );

  /**
   * Get role by ID
   */
  fastify.get<{ Params: RoleParams }>(
    '/api/permissions/roles/:roleId',
    { preHandler: requirePermission('agents.permissions') },
    async (request, reply) => {
      const { roleId } = request.params;
      
      if (!isValidObjectId(roleId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid role ID' });
      }
      
      const role = await getRoleById(roleId);
      
      if (!role) {
        return reply.code(404).send({ ok: false, error: 'Role not found' });
      }
      
      return {
        ok: true,
        role: {
          _id: role._id.toString(),
          name: role.name,
          displayName: role.displayName,
          description: role.description,
          permissions: role.permissions,
          isSystem: role.isSystem,
          isActive: role.isActive,
          priority: role.priority,
          color: role.color,
          icon: role.icon,
        },
      };
    }
  );

  /**
   * Create custom role (admin only)
   */
  fastify.post<{ Body: CreateRoleBody }>(
    '/api/permissions/roles',
    { preHandler: requireAllPermissions(['agents.permissions', 'settings.write']) },
    async (request, reply) => {
      const { name, displayName, description, permissions, priority, color, icon } = request.body;
      
      if (!name || !displayName || !permissions) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'name, displayName, and permissions are required' 
        });
      }
      
      try {
        const role = await createRole(
          { name, displayName, description, permissions, priority, color, icon },
          request.agent!._id.toString(),
          request
        );
        
        return {
          ok: true,
          role: {
            _id: role._id.toString(),
            name: role.name,
            displayName: role.displayName,
            description: role.description,
            permissions: role.permissions,
            isSystem: role.isSystem,
            priority: role.priority,
            color: role.color,
            icon: role.icon,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create role';
        const isDuplicate = message.includes('duplicate') || message.includes('E11000');
        
        return reply.code(isDuplicate ? 409 : 400).send({ 
          ok: false, 
          error: isDuplicate ? 'Role name already exists' : message 
        });
      }
    }
  );

  /**
   * Update role
   */
  fastify.patch<{ Params: RoleParams; Body: UpdateRoleBody2 }>(
    '/api/permissions/roles/:roleId',
    { preHandler: requireAllPermissions(['agents.permissions', 'settings.write']) },
    async (request, reply) => {
      const { roleId } = request.params;
      
      if (!isValidObjectId(roleId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid role ID' });
      }
      
      try {
        const role = await updateRole(
          roleId,
          request.body,
          request.agent!._id.toString(),
          request
        );
        
        if (!role) {
          return reply.code(404).send({ ok: false, error: 'Role not found' });
        }
        
        return {
          ok: true,
          role: {
            _id: role._id.toString(),
            name: role.name,
            displayName: role.displayName,
            description: role.description,
            permissions: role.permissions,
            isSystem: role.isSystem,
            isActive: role.isActive,
            priority: role.priority,
            color: role.color,
            icon: role.icon,
          },
        };
      } catch (error) {
        return reply.code(400).send({ 
          ok: false, 
          error: error instanceof Error ? error.message : 'Failed to update role' 
        });
      }
    }
  );

  /**
   * Delete role (non-system only)
   */
  fastify.delete<{ Params: RoleParams }>(
    '/api/permissions/roles/:roleId',
    { preHandler: requireAllPermissions(['agents.permissions', 'settings.write']) },
    async (request, reply) => {
      const { roleId } = request.params;
      
      if (!isValidObjectId(roleId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid role ID' });
      }
      
      const deleted = await deleteRole(
        roleId,
        request.agent!._id.toString(),
        request
      );
      
      if (!deleted) {
        return reply.code(400).send({ 
          ok: false, 
          error: 'Role not found or is a system role (cannot be deleted)' 
        });
      }
      
      return {
        ok: true,
        message: 'Role deleted successfully',
      };
    }
  );

  /**
   * Assign custom role to agent
   */
  fastify.post<{ Params: AssignRoleParams }>(
    '/api/permissions/roles/:roleId/assign/:agentId',
    { preHandler: requirePermission('agents.permissions') },
    async (request, reply) => {
      const { roleId, agentId } = request.params;
      
      if (!isValidObjectId(roleId) || !isValidObjectId(agentId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid role or agent ID' });
      }
      
      const agent = await assignRoleToAgent(
        agentId,
        roleId,
        request.agent!._id.toString(),
        request
      );
      
      if (!agent) {
        return reply.code(404).send({ ok: false, error: 'Role or agent not found' });
      }
      
      const permissions = await getEffectivePermissions(agentId);
      
      return {
        ok: true,
        agent: {
          _id: agent._id.toString(),
          name: agent.name,
          role: agent.role,
          roleId: agent.roleId?.toString(),
          permissions,
        },
      };
    }
  );
}

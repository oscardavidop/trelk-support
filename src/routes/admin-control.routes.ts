/**
 * Admin Control Routes (Fastify)
 * Secure endpoints for system administration
 * Requires system.admin permission and re-authentication for destructive actions
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import * as AdminControl from '../services/admin-control.service.js';
import { Agent } from '../database/models/Agent.js';
import bcrypt, { compare } from 'bcryptjs';

import { logger } from '../services/logger.js';

// ============= TYPES =============

interface AdminContext {
  adminId: string;
  adminEmail: string;
  adminName: string;
  ip: string;
  userAgent?: string;
}

// ============= RATE LIMITING =============

const destructiveActionLimits = new Map<string, number>();
const DESTRUCTIVE_COOLDOWN = 10000; // 10 seconds

function checkRateLimit(agentId: string, action: string): { allowed: boolean; waitTime?: number } {
  const key = `${agentId}:${action}`;
  const lastAction = destructiveActionLimits.get(key);
  const now = Date.now();

  if (lastAction && now - lastAction < DESTRUCTIVE_COOLDOWN) {
    const waitTime = Math.ceil((DESTRUCTIVE_COOLDOWN - (now - lastAction)) / 1000);
    return { allowed: false, waitTime };
  }

  destructiveActionLimits.set(key, now);
  return { allowed: true };
}

// ============= HELPERS =============

function getAdminContext(request: FastifyRequest): AdminContext {
  const agent = request.agent!;
  return {
    adminId: agent._id.toString(),
    adminEmail: agent.email,
    adminName: agent.name,
    ip: request.ip || request.headers['x-forwarded-for']?.toString() || 'unknown',
    userAgent: request.headers['user-agent'],
  };
}

function checkAdminRole(request: FastifyRequest, reply: FastifyReply): boolean {
  const agent = request.agent;
  if (!agent || agent.role !== 'admin') {
    reply.code(403).send({ ok: false, error: 'Acceso denegado. Se requiere rol de administrador.' });
    return false;
  }
  return true;
}

// ============= ROUTES =============

export const adminControlRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication and system.admin permission
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requirePermission('system.admin'));

  // ============= PASSWORD VERIFICATION =============
  
  fastify.post<{ Body: { password: string } }>('/verify-password', async (request, reply) => {
    try {
      const { password } = request.body;
      const agent = request.agent!;
      
      const fullAgent = await Agent.findById(agent._id).select('+password');
      if (!fullAgent || !fullAgent.password) {
        return reply.code(401).send({ ok: false, error: 'Credenciales inválidas' });
      }

      const isValid = await bcrypt.compare(password, fullAgent.password);
      if (!isValid) {
        logger.warn('admin-control', { action: 'password_verify_failed', adminId: agent._id.toString() });
        return reply.code(401).send({ ok: false, error: 'Contraseña incorrecta' });
      }

      logger.info('admin-control', { action: 'password_verified', adminId: agent._id.toString() });
      return reply.send({ ok: true, verified: true });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'password_verify_error' });
      return reply.code(500).send({ ok: false, error: 'Error interno' });
    }
  });

  // ============= CHAT CONTROL =============

  fastify.get('/chats/stats', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const stats = await AdminControl.getChatStats();
      return reply.send({ ok: true, data: stats });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'get_chat_stats' });
      return reply.code(500).send({ ok: false, error: 'Error obteniendo estadísticas' });
    }
  });

  fastify.post<{ Body: { reason?: string } }>('/chats/close-all', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      
      const rateCheck = checkRateLimit(request.agent!._id.toString(), 'close_all_chats');
      if (!rateCheck.allowed) {
        return reply.code(429).send({ 
          ok: false, 
          error: `Acción limitada. Espera ${rateCheck.waitTime}s` 
        });
      }

      const ctx = getAdminContext(request);
      const result = await AdminControl.closeAllActiveChats(ctx, request.body.reason);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'close_all_chats' });
      return reply.code(500).send({ ok: false, error: 'Error cerrando chats' });
    }
  });

  fastify.post<{ Body: { agentId: string } }>('/chats/close-by-agent', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.closeChatsByAgent(ctx, request.body.agentId);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'close_chats_by_agent' });
      return reply.code(500).send({ ok: false, error: 'Error cerrando chats' });
    }
  });

  fastify.post<{ Body: { status: string } }>('/chats/close-by-status', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.closeChatsByStatus(ctx, request.body.status);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'close_chats_by_status' });
      return reply.code(500).send({ ok: false, error: 'Error cerrando chats' });
    }
  });

  fastify.post<{ Body: { period: '24h' | '7d' | 'all' } }>('/chats/delete-history', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      
      const rateCheck = checkRateLimit(request.agent!._id.toString(), 'delete_history');
      if (!rateCheck.allowed) {
        return reply.code(429).send({ ok: false, error: `Espera ${rateCheck.waitTime}s` });
      }

      const ctx = getAdminContext(request);
      const result = await AdminControl.deleteMessageHistory(ctx, request.body.period);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'delete_history' });
      return reply.code(500).send({ ok: false, error: 'Error eliminando historial' });
    }
  });

  fastify.post('/chats/delete-orphans', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.deleteOrphanChats(ctx);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'delete_orphans' });
      return reply.code(500).send({ ok: false, error: 'Error eliminando chats huérfanos' });
    }
  });

  fastify.post<{ Body: { fromAgentId: string; toAgentId: string } }>('/chats/reassign', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const { fromAgentId, toAgentId } = request.body;
      const result = await AdminControl.reassignChatsFromAgent(ctx, fromAgentId, toAgentId);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'reassign_chats' });
      return reply.code(500).send({ ok: false, error: 'Error reasignando chats' });
    }
  });

  // ============= FLOW CONTROL =============

  fastify.get('/flows/stats', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const stats = await AdminControl.getFlowStats(ctx);
      return reply.send({ ok: true, data: stats });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'get_flow_stats' });
      return reply.code(500).send({ ok: false, error: 'Error obteniendo estadísticas de flows' });
    }
  });

  fastify.post('/flows/disable-all', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      
      const rateCheck = checkRateLimit(request.agent!._id.toString(), 'disable_all_flows');
      if (!rateCheck.allowed) {
        return reply.code(429).send({ ok: false, error: `Espera ${rateCheck.waitTime}s` });
      }

      const ctx = getAdminContext(request);
      const result = await AdminControl.disableAllFlows(ctx);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'disable_all_flows' });
      return reply.code(500).send({ ok: false, error: 'Error desactivando flows' });
    }
  });

  fastify.post<{ Body: { flowIds: string[] } }>('/flows/enable', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.enableFlows(ctx, request.body.flowIds);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'enable_flows' });
      return reply.code(500).send({ ok: false, error: 'Error activando flows' });
    }
  });

  fastify.post('/flows/reload', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.reloadFlowsFromDB(ctx);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'reload_flows' });
      return reply.code(500).send({ ok: false, error: 'Error recargando flows' });
    }
  });

  fastify.post<{ Body: { inactiveDays?: number } }>('/flows/delete-inactive', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.deleteInactiveFlows(ctx, request.body.inactiveDays);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'delete_inactive_flows' });
      return reply.code(500).send({ ok: false, error: 'Error eliminando flows inactivos' });
    }
  });

  // ============= DATABASE CONTROL =============

  fastify.get('/database/collections', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const stats = await AdminControl.getCollectionStats();
      return reply.send({ ok: true, data: stats });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'get_collections' });
      return reply.code(500).send({ ok: false, error: 'Error obteniendo colecciones' });
    }
  });

  fastify.post<{ Body: { collectionName: string; confirmPhrase: string } }>('/database/drop-collection', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      
      const rateCheck = checkRateLimit(request.agent!._id.toString(), 'drop_collection');
      if (!rateCheck.allowed) {
        return reply.code(429).send({ ok: false, error: `Espera ${rateCheck.waitTime}s` });
      }

      const ctx = getAdminContext(request);
      const { collectionName, confirmPhrase } = request.body;
      const result = await AdminControl.dropCollection(ctx, collectionName, confirmPhrase);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'drop_collection' });
      return reply.code(500).send({ ok: false, error: 'Error eliminando colección' });
    }
  });

  fastify.post<{ Body: { collectionName: string; confirmPhrase: string } }>('/database/clear-collection', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      
      const rateCheck = checkRateLimit(request.agent!._id.toString(), 'clear_collection');
      if (!rateCheck.allowed) {
        return reply.code(429).send({ ok: false, error: `Espera ${rateCheck.waitTime}s` });
      }

      const ctx = getAdminContext(request);
      const { collectionName, confirmPhrase } = request.body;
      const result = await AdminControl.clearCollection(ctx, collectionName, confirmPhrase);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'clear_collection' });
      return reply.code(500).send({ ok: false, error: 'Error limpiando colección' });
    }
  });

  fastify.post<{ Body: { collectionName: string } }>('/database/rebuild-indexes', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.rebuildIndexes(ctx, request.body.collectionName);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'rebuild_indexes' });
      return reply.code(500).send({ ok: false, error: 'Error reconstruyendo índices' });
    }
  });

  // ============= CACHE CONTROL =============

  fastify.get('/cache/stats', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const stats = await AdminControl.getCacheStats();
      return reply.send({ ok: true, data: stats });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'get_cache_stats' });
      return reply.code(500).send({ ok: false, error: 'Error obteniendo estadísticas de cache' });
    }
  });

  fastify.post<{ Body: { prefix: string } }>('/cache/clear-prefix', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.clearCacheByPrefix(ctx, request.body.prefix);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'clear_cache_prefix' });
      return reply.code(500).send({ ok: false, error: 'Error limpiando cache' });
    }
  });

  fastify.post<{ Body: { confirmPhrase: string } }>('/cache/flush-all', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      
      const rateCheck = checkRateLimit(request.agent!._id.toString(), 'flush_cache');
      if (!rateCheck.allowed) {
        return reply.code(429).send({ ok: false, error: `Espera ${rateCheck.waitTime}s` });
      }

      const ctx = getAdminContext(request);
      const result = await AdminControl.flushAllCache(ctx, request.body.confirmPhrase);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'flush_cache' });
      return reply.code(500).send({ ok: false, error: 'Error limpiando cache' });
    }
  });

  // ============= QUEUE CONTROL =============

  fastify.get('/queue/stats', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const stats = await AdminControl.getQueueStats();
      return reply.send({ ok: true, data: stats });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'get_queue_stats' });
      return reply.code(500).send({ ok: false, error: 'Error obteniendo estadísticas de colas' });
    }
  });

  fastify.post<{ Body: { queueName: 'scheduled' | 'inactivity' | 'flow' | 'cleanup' | 'notifications' } }>('/queue/pause', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.pauseQueue(ctx, request.body.queueName);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'pause_queue' });
      return reply.code(500).send({ ok: false, error: 'Error pausando cola' });
    }
  });

  fastify.post<{ Body: { queueName: 'scheduled' | 'inactivity' | 'flow' | 'cleanup' | 'notifications' } }>('/queue/resume', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.resumeQueue(ctx, request.body.queueName);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'resume_queue' });
      return reply.code(500).send({ ok: false, error: 'Error reanudando cola' });
    }
  });

  fastify.post<{ Body: { queueName: 'scheduled' | 'inactivity' | 'flow' | 'cleanup' | 'notifications' } }>('/queue/clear-failed', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.clearFailedJobs(ctx, request.body.queueName);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'clear_failed_jobs' });
      return reply.code(500).send({ ok: false, error: 'Error limpiando jobs fallidos' });
    }
  });

  // ============= SESSION CONTROL =============

  fastify.get('/sessions/stats', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const stats = await AdminControl.getSessionStats();
      return reply.send({ ok: true, data: stats });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'get_session_stats' });
      return reply.code(500).send({ ok: false, error: 'Error obteniendo estadísticas de sesiones' });
    }
  });

  fastify.post<{ Body: { confirmPhrase: string } }>('/sessions/logout-all', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      
      const rateCheck = checkRateLimit(request.agent!._id.toString(), 'logout_all');
      if (!rateCheck.allowed) {
        return reply.code(429).send({ ok: false, error: `Espera ${rateCheck.waitTime}s` });
      }

      const ctx = getAdminContext(request);
      const result = await AdminControl.forceLogoutAllUsers(ctx, request.body.confirmPhrase);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'logout_all' });
      return reply.code(500).send({ ok: false, error: 'Error cerrando sesiones' });
    }
  });

  fastify.post<{ Body: { role: 'agent' | 'supervisor' | 'admin' } }>('/sessions/logout-by-role', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.forceLogoutByRole(ctx, request.body.role);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'logout_by_role' });
      return reply.code(500).send({ ok: false, error: 'Error cerrando sesiones' });
    }
  });

  fastify.post<{ Body: { agentId: string; reason: string } }>('/sessions/block-user', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const { agentId, reason } = request.body;
      const result = await AdminControl.blockUser(ctx, agentId, reason);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'block_user' });
      return reply.code(500).send({ ok: false, error: 'Error bloqueando usuario' });
    }
  });

  fastify.post<{ Body: { agentId: string } }>('/sessions/unblock-user', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.unblockUser(ctx, request.body.agentId);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'unblock_user' });
      return reply.code(500).send({ ok: false, error: 'Error desbloqueando usuario' });
    }
  });

  // ============= SYSTEM CONTROL =============

  fastify.get('/stats', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const stats = await AdminControl.getSystemStats();
      return reply.send({ ok: true, data: stats });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'get_system_stats' });
      return reply.code(500).send({ ok: false, error: 'Error obteniendo estadísticas del sistema' });
    }
  });

  fastify.get('/maintenance/status', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const status = await AdminControl.getMaintenanceStatus();
      return reply.send({ ok: true, data: status });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'get_maintenance_status' });
      return reply.code(500).send({ ok: false, error: 'Error obteniendo estado de mantenimiento' });
    }
  });

  fastify.post<{ Body: { message: string } }>('/maintenance/enable', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.enableMaintenanceMode(ctx, request.body.message);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'enable_maintenance' });
      return reply.code(500).send({ ok: false, error: 'Error activando modo mantenimiento' });
    }
  });

  fastify.post('/maintenance/disable', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const result = await AdminControl.disableMaintenanceMode(ctx);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'disable_maintenance' });
      return reply.code(500).send({ ok: false, error: 'Error desactivando modo mantenimiento' });
    }
  });

  // ============= AUDIT LOGS =============

  fastify.get<{ 
    Querystring: { 
      page?: number; 
      limit?: number; 
      category?: string; 
      severity?: string;
      action?: string;
      startDate?: string;
      endDate?: string;
    } 
  }>('/audit/logs', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      
      const { page = 1, limit = 50, category, severity, action, startDate, endDate } = request.query;
      
      const filters: Record<string, unknown> = {};
      if (category) filters.category = category;
      if (severity) filters.severity = severity;
      if (action) filters.action = action;
      if (startDate) filters.startDate = new Date(startDate);
      if (endDate) filters.endDate = new Date(endDate);

      const result = await AdminControl.getAuditLogs(
        filters as Parameters<typeof AdminControl.getAuditLogs>[0],
        page,
        limit
      );
      return reply.send({ ok: true, data: result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'get_audit_logs' });
      return reply.code(500).send({ ok: false, error: 'Error obteniendo logs de auditoría' });
    }
  });

  fastify.post<{ Body: { olderThanDays: number; confirmPhrase: string } }>('/audit/clear', async (request, reply) => {
    try {
      if (!checkAdminRole(request, reply)) return;
      const ctx = getAdminContext(request);
      const { olderThanDays, confirmPhrase } = request.body;
      const result = await AdminControl.clearAuditLogs(ctx, olderThanDays, confirmPhrase);
      return reply.send({ ok: result.success, ...result });
    } catch (error) {
      logger.error('admin-control', { error: String(error), action: 'clear_audit_logs' });
      return reply.code(500).send({ ok: false, error: 'Error limpiando logs de auditoría' });
    }
  });
};

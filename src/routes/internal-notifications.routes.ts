/**
 * Internal Notifications Routes
 * API endpoints for supervisor/admin to agent messaging
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Types } from 'mongoose';
import { internalNotificationService } from '../services/internal-notification.service.js';
import { Agent, ROLE_HIERARCHY } from '../database/models/Agent.js';
import { authMiddleware } from '../middleware/auth.js';

// ============= TYPES =============

interface SendNotificationBody {
  toAgentId: string;
  type?: 'message' | 'assignment' | 'reminder' | 'alert' | 'vip' | 'escalation';
  title?: string;
  message: string;
  priority?: 'normal' | 'urgent';
  relatedChatId?: string;
  relatedUserId?: string;
  actionUrl?: string;
  actionLabel?: string;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

// ============= ROUTES =============

export default async function internalNotificationsRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  /**
   * GET /api/notifications
   * Get notifications for the current agent
   */
  fastify.get('/', async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply) => {
    try {
      const { page = 1, limit = 20, unreadOnly = false } = request.query;
      const agentId = request.agent!._id.toString();

      const result = await internalNotificationService.getNotifications(agentId, {
        page: Number(page),
        limit: Number(limit),
        unreadOnly: unreadOnly === true || unreadOnly === 'true' as any,
      });

      return { ok: true, ...result };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al obtener notificaciones' });
    }
  });

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count
   */
  fastify.get('/unread-count', async (request, reply) => {
    try {
      const agentId = request.agent!._id.toString();
      const unreadCount = await internalNotificationService.getUnreadCount(agentId);
      return { ok: true, unreadCount };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al obtener contador' });
    }
  });

  /**
   * POST /api/notifications/send
   * Send a notification to an agent (supervisor/admin only)
   */
  fastify.post('/send', async (request: FastifyRequest<{ Body: SendNotificationBody }>, reply) => {
    try {
      const sender = request.agent!;
      const senderRole = sender.role;

      // Check permission: only supervisor and admin can send
      if (!['supervisor', 'admin'].includes(senderRole)) {
        return reply.code(403).send({ ok: false, error: 'No tienes permiso para enviar notificaciones' });
      }

      const { toAgentId, type, title, message, priority, relatedChatId, relatedUserId, actionUrl, actionLabel } = request.body;

      if (!toAgentId || !message) {
        return reply.code(400).send({ ok: false, error: 'Faltan campos requeridos' });
      }

      // Verify target agent exists
      const targetAgent = await Agent.findById(toAgentId).select('_id name role').lean();
      if (!targetAgent) {
        return reply.code(404).send({ ok: false, error: 'Agente no encontrado' });
      }

      // Check role hierarchy: can't send to higher role
      const senderLevel = ROLE_HIERARCHY[senderRole as keyof typeof ROLE_HIERARCHY] || 0;
      const targetLevel = ROLE_HIERARCHY[targetAgent.role as keyof typeof ROLE_HIERARCHY] || 0;
      
      if (targetLevel > senderLevel) {
        return reply.code(403).send({ ok: false, error: 'No puedes enviar notificaciones a un rol superior' });
      }

      const result = await internalNotificationService.sendNotification({
        toAgentId,
        fromAdminId: sender._id.toString(),
        type,
        title,
        message,
        priority,
        relatedChatId,
        relatedUserId,
        actionUrl,
        actionLabel,
      });

      return { 
        ok: true, 
        notification: result.notification,
        deliveredVia: result.deliveredVia,
      };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al enviar notificación' });
    }
  });

  /**
   * POST /api/notifications/:id/read
   * Mark a notification as read
   */
  fastify.post('/:id/read', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      const agentId = request.agent!._id.toString();

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ ok: false, error: 'ID inválido' });
      }

      const notification = await internalNotificationService.markAsRead(id, agentId);
      
      if (!notification) {
        return reply.code(404).send({ ok: false, error: 'Notificación no encontrada' });
      }

      return { ok: true, notification };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al marcar como leída' });
    }
  });

  /**
   * POST /api/notifications/read-all
   * Mark all notifications as read
   */
  fastify.post('/read-all', async (request, reply) => {
    try {
      const agentId = request.agent!._id.toString();
      const count = await internalNotificationService.markAllAsRead(agentId);
      return { ok: true, markedCount: count };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al marcar todas como leídas' });
    }
  });

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply) => {
    try {
      const { id } = request.params;
      const agentId = request.agent!._id.toString();

      if (!Types.ObjectId.isValid(id)) {
        return reply.code(400).send({ ok: false, error: 'ID inválido' });
      }

      const deleted = await internalNotificationService.deleteNotification(id, agentId);
      
      if (!deleted) {
        return reply.code(404).send({ ok: false, error: 'Notificación no encontrada' });
      }

      return { ok: true };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al eliminar notificación' });
    }
  });

  /**
   * GET /api/notifications/sent
   * Get notifications sent by the current user (supervisor/admin)
   */
  fastify.get('/sent', async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply) => {
    try {
      const sender = request.agent!;

      if (!['supervisor', 'admin'].includes(sender.role)) {
        return reply.code(403).send({ ok: false, error: 'No tienes permiso' });
      }

      const { page = 1, limit = 20 } = request.query;

      const result = await internalNotificationService.getSentNotifications(sender._id.toString(), {
        page: Number(page),
        limit: Number(limit),
      });

      return { ok: true, ...result };
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({ ok: false, error: 'Error al obtener notificaciones enviadas' });
    }
  });
}

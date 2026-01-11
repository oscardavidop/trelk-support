/**
 * Scheduled Messages Routes
 * API endpoints for managing scheduled messages
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  createScheduledMessage,
  cancelScheduledMessage,
  getSessionScheduledMessages,
  getAllPendingMessages,
  getScheduledMessageStats,
  triggerEventMessages,
} from '../services/scheduledMessage.service.js';
import { getWorkerHealth, forceProcessingCycle } from '../services/scheduledMessage.worker.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { ChatSession } from '../database/models/ChatSession.js';
import type { ScheduleType, TriggerEvent, MediaType } from '../database/models/ScheduledMessage.js';

// Request/Response types
interface CreateScheduledMessageBody {
  sessionId: string;
  type: ScheduleType;
  scheduledAt?: string;
  delayMinutes?: number;
  triggerEvent?: TriggerEvent;
  message: {
    text?: string;
    media?: {
      type: MediaType;
      fileId?: string;
      url?: string;
      caption?: string;
    };
    savedReplyId?: string;
  };
  expiresAt?: string;
}

interface SessionParams {
  sessionId: string;
}

interface MessageParams {
  messageId: string;
}

interface CancelBody {
  reason?: string;
}

interface TriggerEventBody {
  event: TriggerEvent;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export async function scheduledMessageRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  /**
   * POST /api/scheduled-messages
   * Create a new scheduled message
   */
  fastify.post<{ Body: CreateScheduledMessageBody }>(
    '/api/scheduled-messages',
    async (request: FastifyRequest<{ Body: CreateScheduledMessageBody }>, reply: FastifyReply) => {
      const agent = (request as any).agent;
      const body = request.body;

      // Validate required fields
      if (!body.sessionId || !body.type) {
        return reply.code(400).send({
          ok: false,
          error: 'sessionId and type are required',
        });
      }

      // Validate type-specific fields
      if (body.type === 'fixed_time' && !body.scheduledAt) {
        return reply.code(400).send({
          ok: false,
          error: 'scheduledAt is required for fixed_time type',
        });
      }

      if (body.type === 'after_inactivity' && !body.delayMinutes) {
        return reply.code(400).send({
          ok: false,
          error: 'delayMinutes is required for after_inactivity type',
        });
      }

      if (body.type === 'on_event' && !body.triggerEvent) {
        return reply.code(400).send({
          ok: false,
          error: 'triggerEvent is required for on_event type',
        });
      }

      // Validate message content
      if (!body.message?.text && !body.message?.media && !body.message?.savedReplyId) {
        return reply.code(400).send({
          ok: false,
          error: 'Message must have text, media, or savedReplyId',
        });
      }

      // Get session to get chatId
      const session = await ChatSession.findOne({ sessionId: body.sessionId })
        .populate('user');
      
      if (!session) {
        return reply.code(404).send({
          ok: false,
          error: 'Session not found',
        });
      }

      try {
        const scheduled = await createScheduledMessage({
          sessionId: body.sessionId,
          chatId: (session.user as any).telegramId,
          createdBy: agent._id.toString(),
          createdByName: agent.name,
          type: body.type,
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
          delayMinutes: body.delayMinutes,
          triggerEvent: body.triggerEvent,
          message: body.message,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
        });

        return {
          ok: true,
          data: formatScheduledMessage(scheduled),
        };
      } catch (error) {
        return reply.code(400).send({
          ok: false,
          error: error instanceof Error ? error.message : 'Failed to create scheduled message',
        });
      }
    }
  );

  /**
   * GET /api/scheduled-messages/session/:sessionId
   * Get scheduled messages for a session
   */
  fastify.get<{ Params: SessionParams; Querystring: { status?: string } }>(
    '/api/scheduled-messages/session/:sessionId',
    async (request, reply) => {
      const { sessionId } = request.params;
      const { status } = request.query;

      const statusFilter = status 
        ? (status.split(',') as any[])
        : undefined;

      const messages = await getSessionScheduledMessages(sessionId, statusFilter);

      return {
        ok: true,
        data: messages.map(formatScheduledMessage),
      };
    }
  );

  /**
   * DELETE /api/scheduled-messages/:messageId
   * Cancel a scheduled message
   */
  fastify.delete<{ Params: MessageParams; Body: CancelBody }>(
    '/api/scheduled-messages/:messageId',
    async (request, reply) => {
      const { messageId } = request.params;
      const { reason } = request.body || {};
      const agent = (request as any).agent;

      const cancelled = await cancelScheduledMessage(
        messageId,
        agent._id.toString(),
        reason
      );

      if (!cancelled) {
        return reply.code(404).send({
          ok: false,
          error: 'Scheduled message not found or already processed',
        });
      }

      return {
        ok: true,
        data: formatScheduledMessage(cancelled),
      };
    }
  );

  /**
   * GET /api/scheduled-messages/pending
   * Get all pending messages (admin/supervisor only)
   */
  fastify.get(
    '/api/scheduled-messages/pending',
    { preHandler: requireRole(['admin', 'supervisor']) },
    async () => {
      const messages = await getAllPendingMessages();

      return {
        ok: true,
        data: messages.map(formatScheduledMessage),
      };
    }
  );

  /**
   * GET /api/scheduled-messages/stats
   * Get scheduled message statistics
   */
  fastify.get(
    '/api/scheduled-messages/stats',
    { preHandler: requireRole(['admin', 'supervisor']) },
    async () => {
      const stats = await getScheduledMessageStats();
      const health = await getWorkerHealth();

      return {
        ok: true,
        data: {
          stats,
          worker: {
            isRunning: health.isRunning,
            lastRunAt: health.lastRunAt,
            consecutiveErrors: health.consecutiveErrors,
          },
        },
      };
    }
  );

  /**
   * POST /api/scheduled-messages/trigger
   * Manually trigger event-based messages (admin only)
   */
  fastify.post<{ Body: TriggerEventBody }>(
    '/api/scheduled-messages/trigger',
    { preHandler: requireRole(['admin']) },
    async (request, reply) => {
      const { event, sessionId, metadata } = request.body;

      if (!event) {
        return reply.code(400).send({
          ok: false,
          error: 'event is required',
        });
      }

      const triggered = await triggerEventMessages(event, sessionId, metadata);

      return {
        ok: true,
        data: { triggered },
      };
    }
  );

  /**
   * POST /api/scheduled-messages/process
   * Force run processing cycle (admin only)
   */
  fastify.post(
    '/api/scheduled-messages/process',
    { preHandler: requireRole(['admin']) },
    async () => {
      const result = await forceProcessingCycle();

      return {
        ok: true,
        data: result,
      };
    }
  );
}

// Helper function to format response
function formatScheduledMessage(message: any) {
  return {
    id: message._id.toString(),
    sessionId: message.sessionId,
    chatId: message.chatId,
    type: message.type,
    status: message.status,
    scheduledAt: message.scheduledAt,
    delayMinutes: message.delayMinutes,
    triggerEvent: message.triggerEvent,
    message: {
      text: message.message?.text,
      hasMedia: !!message.message?.media,
      mediaType: message.message?.media?.type,
    },
    createdBy: typeof message.createdBy === 'string' 
      ? message.createdBy 
      : message.createdBy?._id?.toString() || message.createdBy?.toString(),
    createdByName: message.createdByName || message.createdBy?.name,
    sentAt: message.sentAt,
    error: message.error,
    attempts: message.attempts,
    cancelledAt: message.cancelledAt,
    cancelReason: message.cancelReason || message.autoCancelledReason,
    expiresAt: message.expiresAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    // Calculate time remaining for pending messages
    timeRemaining: calculateTimeRemaining(message),
  };
}

function calculateTimeRemaining(message: any): number | null {
  if (message.status !== 'pending') return null;

  const now = Date.now();

  if (message.type === 'fixed_time' && message.scheduledAt) {
    return Math.max(0, new Date(message.scheduledAt).getTime() - now);
  }

  if (message.type === 'after_inactivity' && message.inactivityStartedAt && message.delayMinutes) {
    const triggerTime = new Date(message.inactivityStartedAt).getTime() + message.delayMinutes * 60000;
    return Math.max(0, triggerTime - now);
  }

  return null;
}

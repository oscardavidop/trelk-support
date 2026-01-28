/**
 * Broadcast Routes - Mass messaging campaigns
 * 
 * Routes:
 * - POST /api/broadcast - Create new broadcast
 * - POST /api/broadcast/:id/start - Start broadcast
 * - POST /api/broadcast/:id/pause - Pause broadcast
 * - POST /api/broadcast/:id/resume - Resume broadcast
 * - POST /api/broadcast/:id/cancel - Cancel broadcast
 * - GET /api/broadcast - List broadcasts
 * - GET /api/broadcast/stats - Get broadcast statistics
 * - GET /api/broadcast/:id - Get broadcast details
 * - GET /api/broadcast/:id/recipients - Get recipients with pagination
 * - GET /api/broadcast/:id/errors - Get error summary
 * - DELETE /api/broadcast/:id - Delete broadcast
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { broadcastService, CreateBroadcastParams } from '../services/broadcast.service.js';
import { BroadcastStatus, DeliveryStatus } from '../database/models/Broadcast.js';
import { authMiddleware, requirePermission, requireRole } from '../middleware/auth.js';
import { logger } from '../services/logger.js';

// ============= TYPES =============

interface BroadcastParams {
  id: string;
}

interface CreateBroadcastBody {
  title: string;
  messageType?: 'text' | 'photo' | 'video' | 'document' | 'audio' | 'poll';
  message?: string;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  // Media fields
  mediaUrl?: string;
  caption?: string;
  // Poll fields
  pollQuestion?: string;
  pollOptions?: string[];
  pollIsAnonymous?: boolean;
  pollAllowsMultiple?: boolean;
  // Targeting
  targetType: 'all' | 'segment' | 'manual';
  segmentId?: string;
  manualUserIds?: string[];
  scheduledAt?: string;
  batchSize?: number;
  batchDelayMs?: number;
}

interface ListBroadcastsQuery {
  page?: number;
  limit?: number;
  status?: BroadcastStatus;
}

interface RecipientsQuery {
  page?: number;
  limit?: number;
  status?: DeliveryStatus;
}

// ============= ROUTES =============

export async function broadcastRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  /**
   * POST /api/broadcast
   * Create a new broadcast campaign
   */
  fastify.post<{ Body: CreateBroadcastBody }>(
    '/',
    { preHandler: requirePermission('broadcasts.write') },
    async (
      request: FastifyRequest<{ Body: CreateBroadcastBody }>,
      reply: FastifyReply
    ) => {
      try {
        const agent = (request as any).agent;
        const {
          title,
          messageType = 'text',
          message,
          parseMode,
          mediaUrl,
          caption,
          pollQuestion,
          pollOptions,
          pollIsAnonymous,
          pollAllowsMultiple,
          targetType,
          segmentId,
          manualUserIds,
          scheduledAt,
          batchSize,
          batchDelayMs,
        } = request.body;

        // Validation - Title always required
        if (!title?.trim()) {
          return reply.status(400).send({
            success: false,
            error: 'Title is required',
          });
        }

        // Validation based on message type
        if (messageType === 'text') {
          if (!message?.trim()) {
            return reply.status(400).send({
              success: false,
              error: 'Message is required for text broadcasts',
            });
          }
          if (message.length > 4096) {
            return reply.status(400).send({
              success: false,
              error: 'Message exceeds Telegram limit (4096 characters)',
            });
          }
        } else if (['photo', 'video', 'document', 'audio'].includes(messageType)) {
          if (!mediaUrl?.trim()) {
            return reply.status(400).send({
              success: false,
              error: 'Media URL is required for media broadcasts',
            });
          }
        } else if (messageType === 'poll') {
          if (!pollQuestion?.trim()) {
            return reply.status(400).send({
              success: false,
              error: 'Poll question is required',
            });
          }
          if (!pollOptions || pollOptions.filter(o => o.trim()).length < 2) {
            return reply.status(400).send({
              success: false,
              error: 'At least 2 poll options are required',
            });
          }
        }

        if (!['all', 'segment', 'manual'].includes(targetType)) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid target type',
          });
        }

        if (targetType === 'segment' && !segmentId) {
          return reply.status(400).send({
            success: false,
            error: 'Segment ID is required for segment targeting',
          });
        }

        if (targetType === 'manual' && (!manualUserIds || manualUserIds.length === 0)) {
          return reply.status(400).send({
            success: false,
            error: 'User IDs are required for manual targeting',
          });
        }

        const params: CreateBroadcastParams = {
          title: title.trim(),
          messageType,
          message: message?.trim(),
          parseMode,
          mediaUrl: mediaUrl?.trim(),
          caption: caption?.trim(),
          pollQuestion: pollQuestion?.trim(),
          pollOptions,
          pollIsAnonymous,
          pollAllowsMultiple,
          targetType,
          segmentId,
          manualUserIds,
          scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
          batchSize,
          batchDelayMs,
          createdBy: agent._id.toString(),
        };

        const broadcast = await broadcastService.createBroadcast(params);

        logger.info('broadcast', {
          action: 'broadcast_created',
          broadcastId: broadcast._id.toString(),
          agentId: agent._id.toString(),
          messageType,
          targetType,
        });

        return reply.status(201).send({
          success: true,
          data: broadcast,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('broadcast', { action: 'create_error', error: errorMessage });
        
        return reply.status(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * POST /api/broadcast/:id/start
   * Start a broadcast campaign
   */
  fastify.post<{ Params: BroadcastParams }>(
    '/:id/start',
    { preHandler: requirePermission('broadcasts.send') },
    async (
      request: FastifyRequest<{ Params: BroadcastParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const agent = (request as any).agent;

        const broadcast = await broadcastService.startBroadcast(id);

        logger.info('broadcast', {
          action: 'broadcast_started',
          broadcastId: id,
          agentId: agent._id.toString(),
        });

        return reply.send({
          success: true,
          data: broadcast,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('broadcast', { action: 'start_error', error: errorMessage });
        
        return reply.status(400).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * POST /api/broadcast/:id/pause
   * Pause a running broadcast
   */
  fastify.post<{ Params: BroadcastParams }>(
    '/:id/pause',
    { preHandler: requirePermission('broadcasts.write') },
    async (
      request: FastifyRequest<{ Params: BroadcastParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const broadcast = await broadcastService.pauseBroadcast(id);

        logger.info('broadcast', {
          action: 'broadcast_paused',
          broadcastId: id,
        });

        return reply.send({
          success: true,
          data: broadcast,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(400).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * POST /api/broadcast/:id/resume
   * Resume a paused broadcast
   */
  fastify.post<{ Params: BroadcastParams }>(
    '/:id/resume',
    { preHandler: requirePermission('broadcasts.write') },
    async (
      request: FastifyRequest<{ Params: BroadcastParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const broadcast = await broadcastService.resumeBroadcast(id);

        logger.info('broadcast', {
          action: 'broadcast_resumed',
          broadcastId: id,
        });

        return reply.send({
          success: true,
          data: broadcast,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(400).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * POST /api/broadcast/:id/cancel
   * Cancel a broadcast
   */
  fastify.post<{ Params: BroadcastParams }>(
    '/:id/cancel',
    { preHandler: requirePermission('broadcasts.write') },
    async (
      request: FastifyRequest<{ Params: BroadcastParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const agent = (request as any).agent;

        const broadcast = await broadcastService.cancelBroadcast(id);

        logger.info('broadcast', {
          action: 'broadcast_cancelled',
          broadcastId: id,
          agentId: agent._id.toString(),
          sentCount: broadcast.progress.sent,
        });

        return reply.send({
          success: true,
          data: broadcast,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(400).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/broadcast/stats
   * Get broadcast statistics
   */
  fastify.get(
    '/stats',
    { preHandler: requirePermission('broadcasts.read') },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const stats = await broadcastService.getStats();
        
        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/broadcast
   * List broadcasts with pagination
   */
  fastify.get<{ Querystring: ListBroadcastsQuery }>(
    '/',
    { preHandler: requirePermission('broadcasts.read') },
    async (
      request: FastifyRequest<{ Querystring: ListBroadcastsQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { page = 1, limit = 20, status } = request.query;

        const result = await broadcastService.listBroadcasts({
          page: Number(page),
          limit: Number(limit),
          status,
        });

        return reply.send({
          success: true,
          data: result.broadcasts,
          pagination: {
            page: result.page,
            limit: Number(limit),
            total: result.total,
            totalPages: result.totalPages,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/broadcast/:id
   * Get broadcast details
   */
  fastify.get<{ Params: BroadcastParams }>(
    '/:id',
    { preHandler: requirePermission('broadcasts.read') },
    async (
      request: FastifyRequest<{ Params: BroadcastParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const broadcast = await broadcastService.getBroadcast(id);

        if (!broadcast) {
          return reply.status(404).send({
            success: false,
            error: 'Broadcast not found',
          });
        }

        return reply.send({
          success: true,
          data: broadcast,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/broadcast/:id/recipients
   * Get broadcast recipients with pagination
   */
  fastify.get<{ Params: BroadcastParams; Querystring: RecipientsQuery }>(
    '/:id/recipients',
    { preHandler: requirePermission('broadcasts.read') },
    async (
      request: FastifyRequest<{ Params: BroadcastParams; Querystring: RecipientsQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { page = 1, limit = 50, status } = request.query;

        const result = await broadcastService.getBroadcastRecipients(id, {
          page: Number(page),
          limit: Number(limit),
          status,
        });

        return reply.send({
          success: true,
          data: result.recipients,
          pagination: {
            page: result.page,
            limit: Number(limit),
            total: result.total,
            totalPages: result.totalPages,
          },
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * GET /api/broadcast/:id/errors
   * Get error summary for a broadcast
   */
  fastify.get<{ Params: BroadcastParams }>(
    '/:id/errors',
    { preHandler: requirePermission('broadcasts.read') },
    async (
      request: FastifyRequest<{ Params: BroadcastParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const errors = await broadcastService.getErrorSummary(id);

        return reply.send({
          success: true,
          data: errors,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );

  /**
   * DELETE /api/broadcast/:id
   * Delete a broadcast and its recipients
   */
  fastify.delete<{ Params: BroadcastParams }>(
    '/:id',
    { preHandler: requirePermission('broadcasts.delete') },
    async (
      request: FastifyRequest<{ Params: BroadcastParams }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const deleted = await broadcastService.deleteBroadcast(id);

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: 'Broadcast not found',
          });
        }

        logger.info('broadcast', {
          action: 'broadcast_deleted',
          broadcastId: id,
        });

        return reply.send({
          success: true,
          message: 'Broadcast deleted',
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(400).send({
          success: false,
          error: errorMessage,
        });
      }
    }
  );
}

export default broadcastRoutes;

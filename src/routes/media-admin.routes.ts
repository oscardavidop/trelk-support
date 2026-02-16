/**
 * Media Admin Routes
 * Enterprise media management API — admin/supervisor only
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  getStorageOverview,
  queryMedia,
  getMediaById,
  adminUploadMedia,
  softDeleteMedia,
  permanentDeleteMedia,
  restoreMedia,
  detectOrphans,
  purgeOldFiles,
  purgeOrphans,
  purgeAllFiles,
  syncExistingMedia,
  getStorageQuota,
  trackMedia,
} from '../services/media-admin.service.js';
import { logAuditFromRequest } from '../services/audit-log.service.js';
import { MediaFile } from '../database/models/MediaFile.js';

export async function mediaAdminRoutes(fastify: FastifyInstance): Promise<void> {

  // Register multipart for file uploads (50MB limit)
  await fastify.register(import('@fastify/multipart'), {
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // All routes require auth + admin/supervisor role
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = (request as any).agent;
    if (!agent || !['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Admin or Supervisor access required' });
    }
  });

  // ============= STORAGE OVERVIEW =============

  fastify.get('/overview', async (_request, reply) => {
    try {
      const overview = await getStorageOverview();
      return reply.send({ ok: true, data: overview });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Failed to load storage overview' });
    }
  });

  // ============= LIST / SEARCH MEDIA =============

  fastify.get('/files', async (request: FastifyRequest<{
    Querystring: {
      search?: string;
      type?: string;
      source?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
      chatSessionId?: string;
      isFlowAsset?: string;
      isOrphan?: string;
      minSize?: string;
      maxSize?: string;
      page?: string;
      limit?: string;
      sortField?: string;
      sortDirection?: string;
    };
  }>, reply) => {
    try {
      const q = request.query;
      const result = await queryMedia({
        search: q.search,
        type: q.type as any,
        source: q.source as any,
        status: q.status as any,
        dateFrom: q.dateFrom,
        dateTo: q.dateTo,
        chatSessionId: q.chatSessionId,
        isFlowAsset: q.isFlowAsset === 'true' ? true : q.isFlowAsset === 'false' ? false : undefined,
        isOrphan: q.isOrphan === 'true',
        minSize: q.minSize ? parseInt(q.minSize) : undefined,
        maxSize: q.maxSize ? parseInt(q.maxSize) : undefined,
        page: q.page ? parseInt(q.page) : 1,
        limit: q.limit ? Math.min(parseInt(q.limit), 100) : 30,
        sortField: q.sortField || 'createdAt',
        sortDirection: (q.sortDirection as 'asc' | 'desc') || 'desc',
      });

      return reply.send({ ok: true, ...result });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Failed to query media' });
    }
  });

  // ============= GET SINGLE MEDIA =============

  fastify.get<{ Params: { id: string } }>('/files/:id', async (request, reply) => {
    try {
      const media = await getMediaById(request.params.id);
      if (!media) return reply.code(404).send({ ok: false, error: 'Media not found' });

      // Increment download count
      await MediaFile.findByIdAndUpdate(media._id, {
        $inc: { downloadCount: 1 },
        lastAccessedAt: new Date(),
      });

      return reply.send({ ok: true, data: media });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Failed to get media' });
    }
  });

  // ============= UPLOAD FROM ADMIN =============

  fastify.post('/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ ok: false, error: 'No file uploaded' });
      }

      const agent = (request as any).agent;
      const buffer = await data.toBuffer();
      
      // Parse additional fields from multipart
      const fields = data.fields as Record<string, any>;
      const isFlowAsset = fields?.isFlowAsset?.value === 'true';
      const description = fields?.description?.value || '';
      const tags = fields?.tags?.value ? fields.tags.value.split(',').map((t: string) => t.trim()) : [];

      const result = await adminUploadMedia(
        buffer,
        data.filename,
        data.mimetype,
        agent._id.toString(),
        agent.name,
        { isFlowAsset, description, tags }
      );

      if (!result.ok) {
        return reply.code(400).send({ ok: false, error: result.error });
      }

      // Audit log
      await logAuditFromRequest({
        request,
        action: 'media.upload',
        category: 'settings',
        targetType: 'system',
        targetId: result.media!._id.toString(),
        targetDescription: `Upload: ${data.filename}`,
        severity: 'low',
        newValue: {
          filename: data.filename,
          mimeType: data.mimetype,
          size: buffer.length,
          isFlowAsset,
        },
      });

      return reply.send({ ok: true, data: result.media });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Upload failed' });
    }
  });

  // ============= SOFT DELETE =============

  fastify.delete<{ Params: { id: string }; Body: { reason?: string } }>('/files/:id', async (request, reply) => {
    try {
      const agent = (request as any).agent;
      const media = await softDeleteMedia(
        request.params.id,
        agent._id.toString(),
        request.body?.reason
      );

      if (!media) return reply.code(404).send({ ok: false, error: 'Media not found' });

      await logAuditFromRequest({
        request,
        action: 'media.soft_delete',
        category: 'settings',
        targetType: 'system',
        targetId: media._id.toString(),
        targetDescription: `Deleted: ${media.originalName}`,
        severity: 'medium',
        previousValue: { status: 'active' },
        newValue: { status: 'soft_deleted', reason: request.body?.reason },
      });

      return reply.send({ ok: true, data: media });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Delete failed' });
    }
  });

  // ============= PERMANENT DELETE (admin only) =============

  fastify.delete<{ Params: { id: string } }>('/files/:id/permanent', async (request, reply) => {
    const agent = (request as any).agent;
    if (agent.role !== 'admin') {
      return reply.code(403).send({ ok: false, error: 'Only admin can permanently delete files' });
    }

    try {
      const media = await getMediaById(request.params.id);
      if (!media) return reply.code(404).send({ ok: false, error: 'Media not found' });

      const result = await permanentDeleteMedia(request.params.id, agent._id.toString());

      if (!result.ok) return reply.code(500).send(result);

      await logAuditFromRequest({
        request,
        action: 'media.permanent_delete',
        category: 'settings',
        targetType: 'system',
        targetId: media._id.toString(),
        targetDescription: `Permanently deleted: ${media.originalName}`,
        severity: 'high',
        previousValue: { filename: media.originalName, size: media.size },
      });

      return reply.send({ ok: true, message: 'File permanently deleted' });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Permanent delete failed' });
    }
  });

  // ============= RESTORE =============

  fastify.post<{ Params: { id: string } }>('/files/:id/restore', async (request, reply) => {
    try {
      const media = await restoreMedia(request.params.id);
      if (!media) return reply.code(404).send({ ok: false, error: 'Media not found' });

      await logAuditFromRequest({
        request,
        action: 'media.restore',
        category: 'settings',
        targetType: 'system',
        targetId: media._id.toString(),
        targetDescription: `Restored: ${media.originalName}`,
        severity: 'low',
      });

      return reply.send({ ok: true, data: media });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Restore failed' });
    }
  });

  // ============= DETECT ORPHANS =============

  fastify.post('/orphans/detect', async (request, reply) => {
    try {
      const orphanCount = await detectOrphans();

      await logAuditFromRequest({
        request,
        action: 'media.detect_orphans',
        category: 'settings',
        targetType: 'system',
        targetId: 'media-system',
        targetDescription: `Detected ${orphanCount} orphan files`,
        severity: 'low',
        newValue: { orphanCount },
      });

      return reply.send({ ok: true, orphanCount });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Orphan detection failed' });
    }
  });

  // ============= PURGE OPERATIONS =============

  fastify.post<{ Body: { type: 'old' | 'orphans' | 'all'; daysOld?: number; confirmPhrase?: string } }>('/purge', async (request, reply) => {
    const agent = (request as any).agent;
    if (agent.role !== 'admin') {
      return reply.code(403).send({ ok: false, error: 'Only admin can purge files' });
    }

    const { type, daysOld, confirmPhrase } = request.body;

    // Require confirmation for dangerous operations
    if (type === 'all' && confirmPhrase !== 'DELETE ALL FILES') {
      return reply.code(400).send({ ok: false, error: 'Confirmation phrase required: DELETE ALL FILES' });
    }

    try {
      let purgedCount = 0;

      switch (type) {
        case 'old':
          purgedCount = await purgeOldFiles(daysOld || 30);
          break;
        case 'orphans':
          purgedCount = await purgeOrphans();
          break;
        case 'all':
          purgedCount = await purgeAllFiles();
          break;
        default:
          return reply.code(400).send({ ok: false, error: 'Invalid purge type' });
      }

      await logAuditFromRequest({
        request,
        action: 'media.purge',
        category: 'settings',
        targetType: 'system',
        targetId: 'media-storage',
        targetDescription: `Purged ${purgedCount} files (type: ${type})`,
        severity: type === 'all' ? 'critical' : 'high',
        newValue: { purgeType: type, purgedCount, daysOld },
      });

      return reply.send({ ok: true, purgedCount, message: `${purgedCount} files purged` });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Purge failed' });
    }
  });

  // ============= SYNC EXISTING =============

  fastify.post('/sync', async (request, reply) => {
    try {
      const result = await syncExistingMedia();

      await logAuditFromRequest({
        request,
        action: 'media.sync',
        category: 'settings',
        targetType: 'system',
        targetId: 'media-system',
        targetDescription: `Synced ${result.tracked} files (${result.errors} errors)`,
        severity: 'low',
        newValue: result,
      });

      return reply.send({ ok: true, ...result });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Sync failed' });
    }
  });

  // ============= QUOTA & LIMITS =============

  fastify.get('/quota', async (_request, reply) => {
    try {
      const quota = await getStorageQuota();
      return reply.send({ ok: true, data: quota });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Failed to get quota' });
    }
  });

  // ============= UPDATE MEDIA METADATA =============

  fastify.patch<{
    Params: { id: string };
    Body: { description?: string; tags?: string[]; isFlowAsset?: boolean };
  }>('/files/:id', async (request, reply) => {
    try {
      const { description, tags, isFlowAsset } = request.body;
      const update: Record<string, any> = {};
      if (description !== undefined) update.description = description;
      if (tags !== undefined) update.tags = tags;
      if (isFlowAsset !== undefined) update.isFlowAsset = isFlowAsset;

      const media = await MediaFile.findByIdAndUpdate(
        request.params.id,
        { $set: update },
        { new: true }
      );

      if (!media) return reply.code(404).send({ ok: false, error: 'Media not found' });

      return reply.send({ ok: true, data: media });
    } catch (error) {
      return reply.code(500).send({ ok: false, error: 'Update failed' });
    }
  });
}

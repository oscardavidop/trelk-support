/**
 * Contacts PRO Routes
 * API endpoints for contact management, bulk actions, and segmentation
 * Uses RBAC permissions for access control
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { contactsService, type ContactListParams } from '../services/contacts.service.js';
import { segmentService, type CreateSegmentParams, type UpdateSegmentParams } from '../services/segment.service.js';
import { SavedView, type IColumnConfig } from '../database/models/index.js';
import { ContactActivityType } from '../database/models/ContactActivity.js';
import type { IFilterGroup } from '../database/models/Segment.js';

// ==================== TYPES ====================

interface PaginationQuery {
  page?: string;
  limit?: string;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

interface ContactListQuery extends PaginationQuery {
  search?: string;
  segmentId?: string;
  tags?: string;
  blocked?: string;
  hasActiveSession?: string;
  language?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface ContactIdParam {
  contactId: string;
}

interface SegmentIdParam {
  segmentId: string;
}

interface ViewIdParam {
  viewId: string;
}

// ==================== ROUTE REGISTRATION ====================

export async function registerContactsProRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ============= CONTACT LIST =============

  /**
   * GET /api/contacts
   * Get paginated contact list with filters
   */
  fastify.get<{ Querystring: ContactListQuery }>(
    '/api/contacts',
    async (request, reply) => {
      const {
        page = '1',
        limit = '50',
        sortField = 'lastActivity',
        sortDirection = 'desc',
        search,
        segmentId,
        tags,
        blocked,
        hasActiveSession,
        language,
        dateFrom,
        dateTo,
      } = request.query;

      const params: ContactListParams = {
        page: parseInt(page, 10),
        limit: Math.min(parseInt(limit, 10), 100), // Max 100 per page
        sortField,
        sortDirection,
        search,
        segmentId,
        tags: tags ? tags.split(',') : undefined,
        blocked: blocked !== undefined ? blocked === 'true' : undefined,
        hasActiveSession: hasActiveSession !== undefined ? hasActiveSession === 'true' : undefined,
        language,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      };

      const result = await contactsService.listContacts(params);
      return { ok: true, ...result };
    }
  );

  /**
   * POST /api/contacts/search
   * Advanced search with complex filters
   */
  fastify.post<{ Body: { filters: IFilterGroup } & PaginationQuery }>(
    '/api/contacts/search',
    async (request, reply) => {
      const { filters, page = '1', limit = '50', sortField = 'lastActivity', sortDirection = 'desc' } = request.body;

      const params: ContactListParams = {
        page: parseInt(String(page), 10),
        limit: Math.min(parseInt(String(limit), 10), 100),
        sortField: String(sortField),
        sortDirection: sortDirection as 'asc' | 'desc',
        filters,
      };

      const result = await contactsService.listContacts(params);
      return { ok: true, ...result };
    }
  );

  // ============= CONTACT 360° PROFILE =============

  /**
   * GET /api/contacts/:contactId
   * Get complete 360° contact profile
   */
  fastify.get<{ Params: ContactIdParam }>(
    '/api/contacts/:contactId',
    async (request, reply) => {
      const { contactId } = request.params;

      const contact = await contactsService.getContact360(contactId);
      if (!contact) {
        return reply.code(404).send({ ok: false, error: 'Contact not found' });
      }

      return { ok: true, contact };
    }
  );

  /**
   * PATCH /api/contacts/:contactId
   * Update contact fields
   */
  fastify.patch<{
    Params: ContactIdParam;
    Body: {
      language?: string;
      firstName?: string;
      lastName?: string;
      metadata?: Record<string, any>;
    };
  }>(
    '/api/contacts/:contactId',
    async (request, reply) => {
      const { contactId } = request.params;
      const updates = request.body;

      const contact = await contactsService.updateContact(
        contactId,
        updates,
        request.agent!._id.toString(),
        'agent'
      );

      if (!contact) {
        return reply.code(404).send({ ok: false, error: 'Contact not found' });
      }

      return { ok: true, contact };
    }
  );

  /**
   * POST /api/contacts/:contactId/block
   * Block contact
   */
  fastify.post<{
    Params: ContactIdParam;
    Body: { reason?: string };
  }>(
    '/api/contacts/:contactId/block',
    async (request, reply) => {
      const { contactId } = request.params;
      const { reason } = request.body;

      const contact = await contactsService.setContactBlocked(
        contactId,
        true,
        reason,
        request.agent!._id.toString()
      );

      if (!contact) {
        return reply.code(404).send({ ok: false, error: 'Contact not found' });
      }

      return { ok: true, contact };
    }
  );

  /**
   * POST /api/contacts/:contactId/unblock
   * Unblock contact
   */
  fastify.post<{ Params: ContactIdParam }>(
    '/api/contacts/:contactId/unblock',
    async (request, reply) => {
      const { contactId } = request.params;

      const contact = await contactsService.setContactBlocked(
        contactId,
        false,
        undefined,
        request.agent!._id.toString()
      );

      if (!contact) {
        return reply.code(404).send({ ok: false, error: 'Contact not found' });
      }

      return { ok: true, contact };
    }
  );

  /**
   * DELETE /api/contacts/:contactId
   * Delete contact (soft delete)
   * Requires: contacts.delete
   */
  fastify.delete<{ Params: ContactIdParam }>(
    '/api/contacts/:contactId',
    { preHandler: requirePermission('contacts.delete') },
    async (request, reply) => {
      const { contactId } = request.params;

      const result = await contactsService.deleteContact(contactId, request.agent!._id.toString());

      if (!result) {
        return reply.code(404).send({ ok: false, error: 'Contact not found' });
      }

      return { ok: true };
    }
  );

  // ============= CONTACT ACTIVITY =============

  /**
   * GET /api/contacts/:contactId/activity
   * Get contact activity history
   */
  fastify.get<{
    Params: ContactIdParam;
    Querystring: PaginationQuery & { types?: string; dateFrom?: string; dateTo?: string };
  }>(
    '/api/contacts/:contactId/activity',
    async (request, reply) => {
      const { contactId } = request.params;
      const { page = '1', limit = '50', types, dateFrom, dateTo } = request.query;

      const result = await contactsService.getContactActivity(contactId, {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        types: types ? (types.split(',') as ContactActivityType[]) : undefined,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      });

      return { ok: true, ...result };
    }
  );

  // ============= BULK ACTIONS =============

  /**
   * POST /api/contacts/bulk/add-tag
   * Add tag to multiple contacts
   */
  fastify.post<{
    Body: { contactIds: string[]; tagId: string };
  }>(
    '/api/contacts/bulk/add-tag',
    async (request, reply) => {
      const { contactIds, tagId } = request.body;

      if (!contactIds?.length || !tagId) {
        return reply.code(400).send({ ok: false, error: 'Missing required fields' });
      }

      const result = await contactsService.bulkAddTag(
        contactIds,
        tagId,
        request.agent!._id.toString()
      );

      return { ok: true, ...result };
    }
  );

  /**
   * POST /api/contacts/bulk/remove-tag
   * Remove tag from multiple contacts
   */
  fastify.post<{
    Body: { contactIds: string[]; tagId: string };
  }>(
    '/api/contacts/bulk/remove-tag',
    async (request, reply) => {
      const { contactIds, tagId } = request.body;

      if (!contactIds?.length || !tagId) {
        return reply.code(400).send({ ok: false, error: 'Missing required fields' });
      }

      const result = await contactsService.bulkRemoveTag(
        contactIds,
        tagId,
        request.agent!._id.toString()
      );

      return { ok: true, ...result };
    }
  );

  /**
   * POST /api/contacts/bulk/set-field
   * Set custom field for multiple contacts
   */
  fastify.post<{
    Body: { contactIds: string[]; fieldKey: string; value: any };
  }>(
    '/api/contacts/bulk/set-field',
    async (request, reply) => {
      const { contactIds, fieldKey, value } = request.body;

      if (!contactIds?.length || !fieldKey) {
        return reply.code(400).send({ ok: false, error: 'Missing required fields' });
      }

      const result = await contactsService.bulkSetCustomField(
        contactIds,
        fieldKey,
        value,
        request.agent!._id.toString()
      );

      return { ok: true, ...result };
    }
  );

  /**
   * POST /api/contacts/bulk/block
   * Block multiple contacts
   * Requires: contacts.block
   */
  fastify.post<{
    Body: { contactIds: string[]; reason: string };
  }>(
    '/api/contacts/bulk/block',
    { preHandler: requirePermission('contacts.block') },
    async (request, reply) => {
      const { contactIds, reason } = request.body;

      if (!contactIds?.length) {
        return reply.code(400).send({ ok: false, error: 'Missing required fields' });
      }

      const result = await contactsService.bulkBlock(
        contactIds,
        reason || 'Bulk block',
        request.agent!._id.toString()
      );

      return { ok: true, ...result };
    }
  );

  /**
   * POST /api/contacts/bulk/unblock
   * Unblock multiple contacts
   * Requires: contacts.block
   */
  fastify.post<{
    Body: { contactIds: string[] };
  }>(
    '/api/contacts/bulk/unblock',
    { preHandler: requirePermission('contacts.block') },
    async (request, reply) => {
      const { contactIds } = request.body;

      if (!contactIds?.length) {
        return reply.code(400).send({ ok: false, error: 'Missing required fields' });
      }

      const result = await contactsService.bulkUnblock(contactIds, request.agent!._id.toString());

      return { ok: true, ...result };
    }
  );

  /**
   * POST /api/contacts/bulk/delete
   * Delete multiple contacts
   * Requires: contacts.delete
   */
  fastify.post<{
    Body: { contactIds: string[] };
  }>(
    '/api/contacts/bulk/delete',
    { preHandler: requirePermission('contacts.delete') },
    async (request, reply) => {
      const { contactIds } = request.body;

      if (!contactIds?.length) {
        return reply.code(400).send({ ok: false, error: 'Missing required fields' });
      }

      const result = await contactsService.bulkDelete(contactIds, request.agent!._id.toString());

      return { ok: true, ...result };
    }
  );

  // ============= EXPORT =============

  /**
   * POST /api/contacts/export
   * Export contacts to CSV/JSON
   */
  fastify.post<{
    Body: ContactListParams & { format?: 'csv' | 'json'; fields?: string[] };
  }>(
    '/api/contacts/export',
    async (request, reply) => {
      const { format = 'csv', fields, ...params } = request.body;

      const data = await contactsService.exportContacts(params, format, fields);

      if (format === 'json') {
        reply.header('Content-Type', 'application/json');
        reply.header('Content-Disposition', 'attachment; filename=contacts.json');
      } else {
        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename=contacts.csv');
      }

      return data;
    }
  );

  // ============= STATISTICS =============

  /**
   * GET /api/contacts/stats
   * Get contact statistics
   */
  fastify.get('/api/contacts/stats', async (request, reply) => {
    const stats = await contactsService.getContactStats();
    return { ok: true, stats };
  });

  // ============= SEGMENTS =============

  /**
   * GET /api/segments
   * Get all segments
   */
  fastify.get<{ Querystring: { includeInactive?: string } }>(
    '/api/segments',
    async (request, reply) => {
      const { includeInactive } = request.query;
      const segments = await segmentService.listSegments({
        includeInactive: includeInactive === 'true',
      });
      return { ok: true, segments };
    }
  );

  /**
   * GET /api/segments/:segmentId
   * Get segment details
   */
  fastify.get<{ Params: SegmentIdParam }>(
    '/api/segments/:segmentId',
    async (request, reply) => {
      const { segmentId } = request.params;

      const segment = await segmentService.getSegment(segmentId);
      if (!segment) {
        return reply.code(404).send({ ok: false, error: 'Segment not found' });
      }

      return { ok: true, segment };
    }
  );

  /**
   * GET /api/segments/:segmentId/contacts
   * Get contacts in segment
   */
  fastify.get<{ Params: SegmentIdParam; Querystring: PaginationQuery }>(
    '/api/segments/:segmentId/contacts',
    async (request, reply) => {
      const { segmentId } = request.params;
      const { page = '1', limit = '50', sortField, sortDirection } = request.query;

      try {
        const result = await segmentService.getSegmentContacts(segmentId, {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          sortField,
          sortDirection,
        });

        return { ok: true, ...result };
      } catch (error: any) {
        return reply.code(404).send({ ok: false, error: error.message });
      }
    }
  );

  /**
   * GET /api/segments/:segmentId/count
   * Get segment contact count (cached)
   */
  fastify.get<{ Params: SegmentIdParam }>(
    '/api/segments/:segmentId/count',
    async (request, reply) => {
      const { segmentId } = request.params;
      const count = await segmentService.getSegmentCount(segmentId);
      return { ok: true, count };
    }
  );

  /**
   * POST /api/segments
   * Create new segment
   */
  fastify.post<{
    Body: Omit<CreateSegmentParams, 'createdBy'>;
  }>(
    '/api/segments',
    async (request, reply) => {
      const params = {
        ...request.body,
        createdBy: request.agent!._id.toString(),
      };

      const segment = await segmentService.createSegment(params);
      return { ok: true, segment };
    }
  );

  /**
   * PATCH /api/segments/:segmentId
   * Update segment
   */
  fastify.patch<{
    Params: SegmentIdParam;
    Body: UpdateSegmentParams;
  }>(
    '/api/segments/:segmentId',
    async (request, reply) => {
      const { segmentId } = request.params;

      const segment = await segmentService.updateSegment(segmentId, request.body);
      if (!segment) {
        return reply.code(404).send({ ok: false, error: 'Segment not found' });
      }

      return { ok: true, segment };
    }
  );

  /**
   * DELETE /api/segments/:segmentId
   * Delete segment
   */
  fastify.delete<{ Params: SegmentIdParam }>(
    '/api/segments/:segmentId',
    async (request, reply) => {
      const { segmentId } = request.params;

      const result = await segmentService.deleteSegment(segmentId);
      if (!result) {
        return reply.code(404).send({ ok: false, error: 'Segment not found' });
      }

      return { ok: true };
    }
  );

  /**
   * POST /api/segments/:segmentId/duplicate
   * Duplicate segment
   */
  fastify.post<{ Params: SegmentIdParam }>(
    '/api/segments/:segmentId/duplicate',
    async (request, reply) => {
      const { segmentId } = request.params;

      const segment = await segmentService.duplicateSegment(segmentId, request.agent!._id.toString());
      if (!segment) {
        return reply.code(404).send({ ok: false, error: 'Segment not found' });
      }

      return { ok: true, segment };
    }
  );

  /**
   * POST /api/segments/preview
   * Preview segment (get count without saving)
   */
  fastify.post<{
    Body: { filters: IFilterGroup };
  }>(
    '/api/segments/preview',
    async (request, reply) => {
      const { filters } = request.body;

      if (!filters) {
        return reply.code(400).send({ ok: false, error: 'Filters required' });
      }

      const result = await segmentService.previewSegment(filters);
      return { ok: true, ...result };
    }
  );

  /**
   * POST /api/segments/refresh
   * Refresh all segment counts
   * Requires: segments.write
   */
  fastify.post('/api/segments/refresh', { preHandler: requirePermission('segments.write') }, async (request, reply) => {
    await segmentService.refreshAllCounts();
    return { ok: true };
  });

  // ============= SAVED VIEWS =============

  /**
   * GET /api/contacts/views
   * Get saved views for current agent
   */
  fastify.get('/api/contacts/views', async (request, reply) => {
    const views = await SavedView.find({
      $or: [{ createdBy: request.agent!._id }, { isGlobal: true }],
    })
      .sort({ isGlobal: 1, name: 1 })
      .lean();

    return { ok: true, views };
  });

  /**
   * POST /api/contacts/views
   * Create saved view
   */
  fastify.post<{
    Body: {
      name: string;
      description?: string;
      filters?: IFilterGroup;
      columns: IColumnConfig[];
      sortField?: string;
      sortDirection?: 'asc' | 'desc';
      isGlobal?: boolean;
    };
  }>(
    '/api/contacts/views',
    async (request, reply) => {
      const { isGlobal, ...viewData } = request.body;

      // Only admins can create global views
      const isAdmin = request.agent!.role === 'admin' || request.agent!.role === 'supervisor';
      const view = await SavedView.create({
        ...viewData,
        isGlobal: isGlobal && isAdmin,
        createdBy: request.agent!._id,
      });

      return { ok: true, view };
    }
  );

  /**
   * PATCH /api/contacts/views/:viewId
   * Update saved view
   */
  fastify.patch<{
    Params: ViewIdParam;
    Body: Partial<{
      name: string;
      description: string;
      filters: IFilterGroup;
      columns: IColumnConfig[];
      sortField: string;
      sortDirection: 'asc' | 'desc';
      isGlobal: boolean;
    }>;
  }>(
    '/api/contacts/views/:viewId',
    async (request, reply) => {
      const { viewId } = request.params;

      // Check ownership
      const existing = await SavedView.findById(viewId);
      if (!existing) {
        return reply.code(404).send({ ok: false, error: 'View not found' });
      }

      const isAdmin = request.agent!.role === 'admin' || request.agent!.role === 'supervisor';
      const isOwner = existing.createdBy.toString() === request.agent!._id.toString();

      if (!isOwner && !isAdmin) {
        return reply.code(403).send({ ok: false, error: 'Permission denied' });
      }

      const view = await SavedView.findByIdAndUpdate(viewId, request.body, { new: true });
      return { ok: true, view };
    }
  );

  /**
   * DELETE /api/contacts/views/:viewId
   * Delete saved view
   */
  fastify.delete<{ Params: ViewIdParam }>(
    '/api/contacts/views/:viewId',
    async (request, reply) => {
      const { viewId } = request.params;

      const existing = await SavedView.findById(viewId);
      if (!existing) {
        return reply.code(404).send({ ok: false, error: 'View not found' });
      }

      const isAdmin = request.agent!.role === 'admin' || request.agent!.role === 'supervisor';
      const isOwner = existing.createdBy.toString() === request.agent!._id.toString();

      if (!isOwner && !isAdmin) {
        return reply.code(403).send({ ok: false, error: 'Permission denied' });
      }

      await SavedView.findByIdAndDelete(viewId);
      return { ok: true };
    }
  );

  // ============= CONTACT NOTES =============

  /**
   * GET /api/contacts/:contactId/notes
   * Get all notes for a contact
   */
  fastify.get<{ Params: ContactIdParam }>(
    '/api/contacts/:contactId/notes',
    async (request, reply) => {
      const { contactId } = request.params;
      
      const { Note } = await import('../database/models/index.js');
      
      const notes = await Note.find({ user: contactId })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate('createdBy', 'name')
        .lean();
      
      return { 
        ok: true, 
        notes: notes.map(n => ({
          _id: n._id.toString(),
          content: n.content,
          isPinned: false,
          createdAt: n.createdAt,
          createdBy: {
            _id: (n.createdBy as any)?._id?.toString() || '',
            name: (n.createdBy as any)?.name || 'Unknown',
          },
        }))
      };
    }
  );

  /**
   * POST /api/contacts/:contactId/notes
   * Create a note for a contact
   */
  fastify.post<{ Params: ContactIdParam; Body: { content: string; sessionId?: string } }>(
    '/api/contacts/:contactId/notes',
    async (request, reply) => {
      const { contactId } = request.params;
      const { content, sessionId } = request.body;
      
      if (!content || content.trim().length === 0) {
        return reply.code(400).send({ ok: false, error: 'Content is required' });
      }
      
      const { Note, ChatSession } = await import('../database/models/index.js');
      const mongoose = await import('mongoose');
      
      // Resolve session if provided
      let sessionObjectId;
      if (sessionId) {
        if (mongoose.default.Types.ObjectId.isValid(sessionId) && sessionId.length === 24) {
          sessionObjectId = new mongoose.default.Types.ObjectId(sessionId);
        } else {
          const session = await ChatSession.findOne({ sessionId }).select('_id');
          sessionObjectId = session?._id;
        }
      }
      
      const note = await Note.create({
        user: new mongoose.default.Types.ObjectId(contactId),
        session: sessionObjectId,
        content: content.trim(),
        createdBy: request.agent!._id,
      });
      
      const populated = await Note.findById(note._id).populate('createdBy', 'name');
      
      // Log activity
      const { ContactActivity, ActivityTypes } = await import('../database/models/ContactActivity.js');
      await ContactActivity.create({
        user: new mongoose.default.Types.ObjectId(contactId),
        type: ActivityTypes.NOTE_ADDED,
        description: `Nota añadida por ${request.agent!.name}`,
        actor: {
          type: 'agent',
          id: request.agent!._id.toString(),
          name: request.agent!.name,
        },
        metadata: { noteId: note._id.toString() },
      });
      
      // Invalidate cache
      const { del: redisDel } = await import('../services/redis.js');
      await redisDel(`contacts:360:${contactId}`);
      
      return { 
        ok: true, 
        note: {
          _id: note._id!.toString(),
          content: note.content,
          isPinned: false,
          createdAt: note.createdAt,
          createdBy: {
            _id: request.agent!._id.toString(),
            name: (populated?.createdBy as any)?.name || 'Unknown',
          },
        }
      };
    }
  );

  /**
   * DELETE /api/contacts/:contactId/notes/:noteId
   * Delete a note
   */
  fastify.delete<{ Params: { contactId: string; noteId: string } }>(
    '/api/contacts/:contactId/notes/:noteId',
    async (request, reply) => {
      const { contactId, noteId } = request.params;
      
      const { Note } = await import('../database/models/index.js');
      const mongoose = await import('mongoose');
      
      const note = await Note.findById(noteId);
      if (!note) {
        return reply.code(404).send({ ok: false, error: 'Note not found' });
      }
      
      // Only the creator or admins can delete
      const isAdmin = request.agent!.role === 'admin' || request.agent!.role === 'supervisor';
      const isCreator = note.createdBy.toString() === request.agent!._id.toString();
      
      if (!isCreator && !isAdmin) {
        return reply.code(403).send({ ok: false, error: 'Permission denied' });
      }
      
      await Note.findByIdAndDelete(noteId);
      
      // Log activity
      const { ContactActivity, ActivityTypes } = await import('../database/models/ContactActivity.js');
      await ContactActivity.create({
        user: new mongoose.default.Types.ObjectId(contactId),
        type: ActivityTypes.NOTE_DELETED,
        description: `Nota eliminada por ${request.agent!.name}`,
        actor: {
          type: 'agent',
          id: request.agent!._id.toString(),
          name: request.agent!.name,
        },
      });
      
      // Invalidate cache
      const { del: redisDel } = await import('../services/redis.js');
      await redisDel(`contacts:360:${contactId}`);
      
      return { ok: true };
    }
  );
}

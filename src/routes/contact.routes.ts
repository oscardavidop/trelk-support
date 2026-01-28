/**
 * Contact Info Routes
 * API endpoints for sidebar contact information, notes, tags, and custom fields
 * Uses RBAC permissions for access control
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import { getContactInfo, getUserChatHistory } from '../services/contactInfo.service.js';
import { createNote, getUserNotes, deleteNote, updateNote } from '../services/notes.service.js';
import {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
  searchTags,
  getUserTags,
  addTagToUser,
  removeTagFromUser
} from '../services/tags.service.js';
import {
  getAllFieldDefinitions,
  createFieldDefinition,
  updateFieldDefinition,
  deleteFieldDefinition,
  getUserFieldValues,
  setUserFieldValue,
  clearUserFieldValue,
} from '../services/customFields.service.js';
import type { CustomFieldType } from '../database/index.js';
import { isValidObjectId } from 'mongoose';

interface SessionParams {
  sessionId: string;
}

interface UserParams {
  userId: string;
}

interface NoteParams {
  noteId: string;
}

interface TagParams {
  tagId: string;
}

interface FieldParams {
  fieldId: string;
}

export async function registerContactRoutes(fastify: FastifyInstance): Promise<void> {

  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ============= CONTACT INFO =============

  /**
   * Get complete contact info for a session (sidebar data)
   */
  fastify.get<{ Params: SessionParams }>(
    '/api/sessions/:sessionId/contact',
    async (request, reply) => {
      const { sessionId } = request.params;

      const contactInfo = await getContactInfo(sessionId);

      if (!contactInfo) {
        return reply.code(404).send({ ok: false, error: 'Session not found' });
      }

      return { ok: true, contact: contactInfo };
    }
  );

  /**
   * Get user's complete chat history
   */
  fastify.get<{ Params: UserParams; Querystring: { limit?: string } }>(
    '/api/users/:userId/history',
    async (request) => {
      const { userId } = request.params;
      const limit = request.query.limit ? parseInt(request.query.limit, 10) : 50;

      const history = await getUserChatHistory(userId, limit);
      return { ok: true, history };
    }
  );

  // ============= NOTES =============

  /**
   * Get all notes for a user
   */
  fastify.get<{ Params: UserParams }>(
    '/api/users/:userId/notes',
    {
      preHandler: requirePermission('notes.read')
    },
    async (request, reply) => {
      const { userId } = request.params;
      if (!isValidObjectId(userId)) {
        return reply.code(400).send({ ok: false, error: 'Invalid User ID format' });
      }
      const notes = await getUserNotes(userId);
      return { ok: true, notes };
    }
  );

  /**
   * Create a note for a user
   */
  fastify.post<{
    Params: UserParams;
    Body: { content: string; sessionId?: string }
  }>(
    '/api/users/:userId/notes',
    {
      preHandler: requirePermission('notes.write')
    },
    async (request, reply) => {
      const { userId } = request.params;
      const { content, sessionId } = request.body;

      if (!content || content.trim().length === 0) {
        return reply.code(400).send({ ok: false, error: 'Content is required' });
      }

      const note = await createNote({
        userId,
        sessionId,
        content: content.trim(),
        agentId: request.agent!._id.toString(),
      });

      return { ok: true, note };
    }
  );

  /**
   * Update a note
   */
  fastify.put<{ Params: NoteParams; Body: { content: string } }>(
    '/api/notes/:noteId',
      { preHandler: requirePermission('notes.write') },
    async (request, reply) => {
      const { noteId } = request.params;
      const { content } = request.body;

      if (!content || content.trim().length === 0) {
        return reply.code(400).send({ ok: false, error: 'Content is required' });
      }

      const note = await updateNote(noteId, content.trim());

      if (!note) {
        return reply.code(404).send({ ok: false, error: 'Note not found' });
      }

      return { ok: true, note };
    }
  );

  /**
   * Delete a note
   */
  fastify.delete<{ Params: NoteParams }>(
    '/api/notes/:noteId',
    { preHandler: requirePermission('notes.delete') },
    async (request, reply) => {
      const { noteId } = request.params;
      const deleted = await deleteNote(noteId, request.agent!._id.toString());

      if (!deleted) {
        return reply.code(404).send({ ok: false, error: 'Note not found' });
      }

      return { ok: true };
    }
  );

  // ============= TAGS =============

  /**
   * Get all tags
   */
  fastify.get('/api/tags', async () => {
    const tags = await getAllTags();
    return { ok: true, tags };
  });

  /**
   * Search tags
   */
  fastify.get<{ Querystring: { q: string } }>(
    '/api/tags/search',
    {
      preHandler: requirePermission('tags.read')
    },
    async (request) => {
      const tags = await searchTags(request.query.q || '');
      return { ok: true, tags };
    }
  );

  /**
   * Create a new tag
   * Requires: contacts.write (tags are part of contact management)
   */
  fastify.post<{ Body: { name: string; color: string; description?: string } }>(
    '/api/tags',
    { preHandler: requirePermission('tags.write') },
    async (request, reply) => {
      const { name, color, description } = request.body;

      if (!name || !color) {
        return reply.code(400).send({ ok: false, error: 'Name and color are required' });
      }

      try {
        const tag = await createTag({
          name: name.trim(),
          color,
          description,
          agentId: request.agent!._id.toString(),
        });
        return { ok: true, tag };
      } catch (error: any) {
        if (error.code === 11000) {
          return reply.code(409).send({ ok: false, error: 'Tag already exists' });
        }
        throw error;
      }
    }
  );

  /**
   * Update a tag
   * Requires: tags.write
   */
  fastify.put<{ Params: TagParams; Body: { name?: string; color?: string; description?: string } }>(
    '/api/tags/:tagId',
    { preHandler: requirePermission('tags.write') },
    async (request, reply) => {
      const { tagId } = request.params;
      const tag = await updateTag(tagId, request.body);

      if (!tag) {
        return reply.code(404).send({ ok: false, error: 'Tag not found' });
      }

      return { ok: true, tag };
    }
  );

  /**
   * Delete a tag
   * Requires: tags.write
   */
  fastify.delete<{ Params: TagParams }>(
    '/api/tags/:tagId',
    { preHandler: requirePermission('tags.delete') },
    async (request, reply) => {
      const { tagId } = request.params;
      const deleted = await deleteTag(tagId);

      if (!deleted) {
        return reply.code(404).send({ ok: false, error: 'Tag not found' });
      }

      return { ok: true };
    }
  );

  /**
   * Get tags for a user
   */
  fastify.get<{ Params: UserParams }>(
    '/api/users/:userId/tags',
    { preHandler: requirePermission('tags.read') },
    async (request) => {
      const { userId } = request.params;
      const tags = await getUserTags(userId);
      return { ok: true, tags };
    }
  );

  /**
   * Add tag to user
   */
  fastify.post<{ Params: UserParams; Body: { tagId: string } }>(
    '/api/users/:userId/tags',
    { preHandler: requirePermission('tags.write') },
    async (request, reply) => {
      const { userId } = request.params;
      const { tagId } = request.body;

      if (!tagId) {
        return reply.code(400).send({ ok: false, error: 'tagId is required' });
      }

      const added = await addTagToUser(userId, tagId, request.agent!._id.toString());

      if (!added) {
        return reply.code(409).send({ ok: false, error: 'Tag already assigned' });
      }

      return { ok: true };
    }
  );

  /**
   * Remove tag from user
   */
  fastify.delete<{ Params: UserParams & TagParams }>(
    '/api/users/:userId/tags/:tagId',
    { preHandler: requirePermission('tags.delete') },
    async (request, reply) => {
      const { userId, tagId } = request.params;
      const removed = await removeTagFromUser(userId, tagId);

      if (!removed) {
        return reply.code(404).send({ ok: false, error: 'Tag not assigned' });
      }

      return { ok: true };
    }
  );

  // ============= CUSTOM FIELDS =============
  // Requires: customFields.read, customFields.write, customFields.delete

  /**
   * Get all custom field definitions
   * Requires: customFields.read
   */
  fastify.get<{ Querystring: { all?: string } }>(
    '/api/custom-fields',
    { preHandler: requirePermission('customFields.read') },
    async (request) => {
      const activeOnly = request.query.all !== 'true';
      const fields = await getAllFieldDefinitions(activeOnly);
      return { ok: true, fields };
    }
  );

  /**
   * Create custom field definition
   * Requires: customFields.write
   */
  fastify.post<{
    Body: {
      name: string;
      key: string;
      type: CustomFieldType;
      description?: string;
      required?: boolean;
      options?: string[];
      defaultValue?: string | number | boolean;
      order?: number;
    }
  }>(
    '/api/custom-fields',
    { preHandler: requirePermission('customFields.write') },
    async (request, reply) => {
      const { name, key, type, ...rest } = request.body;

      if (!name || !key || !type) {
        return reply.code(400).send({ ok: false, error: 'Name, key, and type are required' });
      }

      try {
        const field = await createFieldDefinition({
          name: name.trim(),
          key: key.trim(),
          type,
          ...rest,
          agentId: request.agent!._id.toString(),
        });
        return { ok: true, field };
      } catch (error: any) {
        if (error.code === 11000) {
          return reply.code(409).send({ ok: false, error: 'Field key already exists' });
        }
        throw error;
      }
    }
  );

  /**
   * Update custom field definition
   * Requires: customFields.write
   */
  fastify.put<{
    Params: FieldParams;
    Body: Partial<{ name: string; description: string; required: boolean; options: string[]; order: number; isActive: boolean }>
  }>(
    '/api/custom-fields/:fieldId',
    { preHandler: requirePermission('customFields.write') },
    async (request, reply) => {
      const { fieldId } = request.params;
      const field = await updateFieldDefinition(fieldId, request.body);

      if (!field) {
        return reply.code(404).send({ ok: false, error: 'Field not found' });
      }

      return { ok: true, field };
    }
  );

  /**
   * Delete (deactivate) custom field definition
   * Requires: customFields.delete
   */
  fastify.delete<{ Params: FieldParams }>(
    '/api/custom-fields/:fieldId',
    { preHandler: requirePermission('customFields.delete') },
    async (request, reply) => {
      const { fieldId } = request.params;
      const deleted = await deleteFieldDefinition(fieldId);

      if (!deleted) {
        return reply.code(404).send({ ok: false, error: 'Field not found' });
      }

      return { ok: true };
    }
  );

  /**
   * Get custom field values for a user
   * Requires: customFields.read (to see field values on contacts)
   */
  fastify.get<{ Params: UserParams }>(
    '/api/users/:userId/custom-fields',
    { preHandler: requirePermission('customFields.read') },
    async (request) => {
      const { userId } = request.params;
      const values = await getUserFieldValues(userId);
      return { ok: true, values };
    }
  );

  /**
   * Set custom field value for a user
   * Requires: contacts.write (editing contact data)
   */
  fastify.put<{
    Params: UserParams & FieldParams;
    Body: { value: string | number | boolean | Date }
  }>(
    '/api/users/:userId/custom-fields/:fieldId',
    { preHandler: requirePermission('contacts.write') },
    async (request, reply) => {
      const { userId, fieldId } = request.params;
      const { value } = request.body;

      if (value === undefined) {
        return reply.code(400).send({ ok: false, error: 'Value is required' });
      }

      await setUserFieldValue(userId, fieldId, value, request.agent!._id.toString());
      return { ok: true };
    }
  );

  /**
   * Clear custom field value for a user
   * Requires: contacts.write
   */
  fastify.delete<{ Params: UserParams & FieldParams }>(
    '/api/users/:userId/custom-fields/:fieldId',
    { preHandler: requirePermission('contacts.write') },
    async (request) => {
      const { userId, fieldId } = request.params;
      await clearUserFieldValue(userId, fieldId);
      return { ok: true };
    }
  );
}

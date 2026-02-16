/**
 * Disposition Routes - API para gestión de tipificaciones de cierre de chat
 * Enterprise feature similar a Avaya, Zendesk, WhatsApp Business
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  DispositionCategory,
  DispositionTag,
  DispositionSettings,
  getActiveCategories,
  getActiveTags,
  getDispositionSettings,
  clearDispositionCache,
  initializeDefaultCategories,
  type IDispositionCategory,
  type IDispositionTag,
} from '../database/index.js';
import { logAuditFromRequest } from '../services/audit-log.service.js';

// ============= TYPES =============

interface CreateCategoryBody {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  requiresComment?: boolean;
  minCommentLength?: number;
  subcategories?: {
    name: string;
    code: string;
    description?: string;
  }[];
}

interface UpdateCategoryBody {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  requiresComment?: boolean;
  minCommentLength?: number;
  isActive?: boolean;
  order?: number;
}

interface CreateSubcategoryBody {
  name: string;
  code: string;
  description?: string;
}

interface UpdateSubcategoryBody {
  name?: string;
  description?: string;
  isActive?: boolean;
  order?: number;
}

interface CreateTagBody {
  name: string;
  code: string;
  color?: string;
  icon?: string;
}

interface UpdateTagBody {
  name?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  order?: number;
}

interface UpdateSettingsBody {
  requireDisposition?: boolean;
  requireComment?: boolean;
  minCommentLength?: number;
  maxCommentLength?: number;
  allowCustomTags?: boolean;
  defaultCategoryId?: string | null;
  flowDefaultCategoryId?: string;
  flowDefaultSubcategoryId?: string;
}

interface ReorderBody {
  items: { id: string; order: number }[];
}

// ============= ROUTES =============

export default async function dispositionRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ============= PUBLIC ENDPOINTS (for agents) =============

  /**
   * Get all active categories with subcategories (cached)
   * For the disposition modal dropdown
   */
  fastify.get('/api/dispositions/categories', async () => {
    const categories = await getActiveCategories();
    return { ok: true, categories };
  });

  /**
   * Get all active tags (cached)
   */
  fastify.get('/api/dispositions/tags', async () => {
    const tags = await getActiveTags();
    return { ok: true, tags };
  });

  /**
   * Get disposition settings (cached)
   */
  fastify.get('/api/dispositions/settings', async () => {
    const settings = await getDispositionSettings();
    return { ok: true, settings };
  });

  /**
   * Get all data for disposition modal in one call
   */
  fastify.get('/api/dispositions/modal-data', async () => {
    const [categories, tags, settings] = await Promise.all([
      getActiveCategories(),
      getActiveTags(),
      getDispositionSettings(),
    ]);
    return { ok: true, categories, tags, settings };
  });

  // ============= ADMIN ENDPOINTS =============

  /**
   * Get all categories (including inactive) for admin
   */
  fastify.get(
    '/api/admin/dispositions/categories',
    { preHandler: requirePermission('settings.write') },
    async () => {
      const categories = await DispositionCategory
        .find()
        .sort({ order: 1 })
        .populate('createdBy', 'name email')
        .lean();
      return { ok: true, categories };
    }
  );

  /**
   * Create new category
   */
  fastify.post<{ Body: CreateCategoryBody }>(
    '/api/admin/dispositions/categories',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { name, code, description, icon, color, requiresComment, minCommentLength, subcategories } = request.body;
      const agentId = request.agent!._id;

      // Validate required fields
      if (!name || !code) {
        return reply.code(400).send({ ok: false, error: 'Nombre y código son requeridos' });
      }

      // Check for duplicate code
      const existing = await DispositionCategory.findOne({ code });
      if (existing) {
        return reply.code(400).send({ ok: false, error: 'Ya existe una categoría con ese código' });
      }

      // Get max order
      const maxOrder = await DispositionCategory.findOne().sort({ order: -1 }).select('order').lean();
      const order = (maxOrder?.order || 0) + 1;

      // Create category
      const category = await DispositionCategory.create({
        name,
        code,
        description,
        icon,
        color,
        requiresComment: requiresComment || false,
        minCommentLength: minCommentLength || 10,
        subcategories: subcategories?.map((s, i) => ({
          ...s,
          isActive: true,
          order: i + 1,
        })) || [],
        order,
        createdBy: agentId,
      });

      clearDispositionCache();

      // Audit
      await logAuditFromRequest({
        request,
        action: 'disposition_category_created',
        category: 'settings',
        targetType: 'disposition',
        targetId: category._id.toString(),
        severity: 'low',
        metadata: { name, code },
      });

      return { ok: true, category };
    }
  );

  /**
   * Update category
   */
  fastify.patch<{ Params: { categoryId: string }; Body: UpdateCategoryBody }>(
    '/api/admin/dispositions/categories/:categoryId',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { categoryId } = request.params;
      const updates = request.body;

      const category = await DispositionCategory.findByIdAndUpdate(
        categoryId,
        { $set: updates },
        { new: true }
      );

      if (!category) {
        return reply.code(404).send({ ok: false, error: 'Categoría no encontrada' });
      }

      clearDispositionCache();

      await logAuditFromRequest({
        request,
        action: 'disposition_category_updated',
        category: 'settings',
        targetType: 'disposition',
        targetId: categoryId,
        severity: 'low',
        metadata: { ...updates },
      });

      return { ok: true, category };
    }
  );

  /**
   * Delete category
   */
  fastify.delete<{ Params: { categoryId: string } }>(
    '/api/admin/dispositions/categories/:categoryId',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { categoryId } = request.params;

      const category = await DispositionCategory.findByIdAndDelete(categoryId);
      if (!category) {
        return reply.code(404).send({ ok: false, error: 'Categoría no encontrada' });
      }

      clearDispositionCache();

      await logAuditFromRequest({
        request,
        action: 'disposition_category_deleted',
        category: 'settings',
        targetType: 'disposition',
        targetId: categoryId,
        severity: 'medium',
        metadata: { name: category.name, code: category.code },
      });

      return { ok: true };
    }
  );

  /**
   * Reorder categories
   */
  fastify.post<{ Body: ReorderBody }>(
    '/api/admin/dispositions/categories/reorder',
    { preHandler: requirePermission('settings.write') },
    async (request) => {
      const { items } = request.body;

      const bulkOps = items.map(item => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { order: item.order } },
        },
      }));

      await DispositionCategory.bulkWrite(bulkOps);
      clearDispositionCache();

      return { ok: true };
    }
  );

  // ============= SUBCATEGORY ENDPOINTS =============

  /**
   * Add subcategory to category
   */
  fastify.post<{ Params: { categoryId: string }; Body: CreateSubcategoryBody }>(
    '/api/admin/dispositions/categories/:categoryId/subcategories',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { categoryId } = request.params;
      const { name, code, description } = request.body;

      const category = await DispositionCategory.findById(categoryId);
      if (!category) {
        return reply.code(404).send({ ok: false, error: 'Categoría no encontrada' });
      }

      // Check duplicate code within category
      if (category.subcategories.some(s => s.code === code)) {
        return reply.code(400).send({ ok: false, error: 'Ya existe una subcategoría con ese código' });
      }

      const maxOrder = Math.max(0, ...category.subcategories.map(s => s.order));
      
      category.subcategories.push({
        name,
        code,
        description,
        isActive: true,
        order: maxOrder + 1,
      });

      await category.save();
      clearDispositionCache();

      await logAuditFromRequest({
        request,
        action: 'disposition_subcategory_created',
        category: 'settings',
        targetType: 'disposition',
        targetId: categoryId,
        severity: 'low',
        metadata: { subcategoryName: name, subcategoryCode: code },
      });

      return { ok: true, category };
    }
  );

  /**
   * Update subcategory
   */
  fastify.patch<{ Params: { categoryId: string; subcategoryId: string }; Body: UpdateSubcategoryBody }>(
    '/api/admin/dispositions/categories/:categoryId/subcategories/:subcategoryId',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { categoryId, subcategoryId } = request.params;
      const updates = request.body;

      const category = await DispositionCategory.findById(categoryId);
      if (!category) {
        return reply.code(404).send({ ok: false, error: 'Categoría no encontrada' });
      }

      const subcategory = (category.subcategories as any).id(subcategoryId);
      if (!subcategory) {
        return reply.code(404).send({ ok: false, error: 'Subcategoría no encontrada' });
      }

      Object.assign(subcategory, updates);
      await category.save();
      clearDispositionCache();

      return { ok: true, category };
    }
  );

  /**
   * Delete subcategory
   */
  fastify.delete<{ Params: { categoryId: string; subcategoryId: string } }>(
    '/api/admin/dispositions/categories/:categoryId/subcategories/:subcategoryId',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { categoryId, subcategoryId } = request.params;

      const category = await DispositionCategory.findById(categoryId);
      if (!category) {
        return reply.code(404).send({ ok: false, error: 'Categoría no encontrada' });
      }

      const subcategory = (category.subcategories as any).id(subcategoryId);
      if (!subcategory) {
        return reply.code(404).send({ ok: false, error: 'Subcategoría no encontrada' });
      }

      subcategory.deleteOne();
      await category.save();
      clearDispositionCache();

      return { ok: true };
    }
  );

  /**
   * Reorder subcategories within a category
   */
  fastify.post<{ Params: { categoryId: string }; Body: ReorderBody }>(
    '/api/admin/dispositions/categories/:categoryId/subcategories/reorder',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { categoryId } = request.params;
      const { items } = request.body;

      const category = await DispositionCategory.findById(categoryId);
      if (!category) {
        return reply.code(404).send({ ok: false, error: 'Categoría no encontrada' });
      }

      for (const item of items) {
        const subcategory = (category.subcategories as any).id(item.id);
        if (subcategory) {
          subcategory.order = item.order;
        }
      }

      await category.save();
      clearDispositionCache();

      return { ok: true };
    }
  );

  // ============= TAG ENDPOINTS =============

  /**
   * Get all tags (including inactive) for admin
   */
  fastify.get(
    '/api/admin/dispositions/tags',
    { preHandler: requirePermission('settings.write') },
    async () => {
      const tags = await DispositionTag.find().sort({ order: 1 }).lean();
      return { ok: true, tags };
    }
  );

  /**
   * Create tag
   */
  fastify.post<{ Body: CreateTagBody }>(
    '/api/admin/dispositions/tags',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { name, code, color, icon } = request.body;

      if (!name || !code) {
        return reply.code(400).send({ ok: false, error: 'Nombre y código son requeridos' });
      }

      const existing = await DispositionTag.findOne({ code });
      if (existing) {
        return reply.code(400).send({ ok: false, error: 'Ya existe un tag con ese código' });
      }

      const maxOrder = await DispositionTag.findOne().sort({ order: -1 }).select('order').lean();
      const order = (maxOrder?.order || 0) + 1;

      const tag = await DispositionTag.create({
        name,
        code,
        color,
        icon,
        order,
      });

      clearDispositionCache();

      return { ok: true, tag };
    }
  );

  /**
   * Update tag
   */
  fastify.patch<{ Params: { tagId: string }; Body: UpdateTagBody }>(
    '/api/admin/dispositions/tags/:tagId',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { tagId } = request.params;
      const updates = request.body;

      const tag = await DispositionTag.findByIdAndUpdate(
        tagId,
        { $set: updates },
        { new: true }
      );

      if (!tag) {
        return reply.code(404).send({ ok: false, error: 'Tag no encontrado' });
      }

      clearDispositionCache();

      return { ok: true, tag };
    }
  );

  /**
   * Delete tag
   */
  fastify.delete<{ Params: { tagId: string } }>(
    '/api/admin/dispositions/tags/:tagId',
    { preHandler: requirePermission('settings.write') },
    async (request, reply) => {
      const { tagId } = request.params;

      const tag = await DispositionTag.findByIdAndDelete(tagId);
      if (!tag) {
        return reply.code(404).send({ ok: false, error: 'Tag no encontrado' });
      }

      clearDispositionCache();

      return { ok: true };
    }
  );

  /**
   * Reorder tags
   */
  fastify.post<{ Body: ReorderBody }>(
    '/api/admin/dispositions/tags/reorder',
    { preHandler: requirePermission('settings.write') },
    async (request) => {
      const { items } = request.body;

      const bulkOps = items.map(item => ({
        updateOne: {
          filter: { _id: item.id },
          update: { $set: { order: item.order } },
        },
      }));

      await DispositionTag.bulkWrite(bulkOps);
      clearDispositionCache();

      return { ok: true };
    }
  );

  // ============= SETTINGS ENDPOINTS =============

  /**
   * Get settings for admin
   */
  fastify.get(
    '/api/admin/dispositions/settings',
    { preHandler: requirePermission('settings.write') },
    async () => {
      const settings = await getDispositionSettings();
      return { ok: true, settings };
    }
  );

  /**
   * Update settings
   */
  fastify.patch<{ Body: UpdateSettingsBody }>(
    '/api/admin/dispositions/settings',
    { preHandler: requirePermission('settings.write') },
    async (request) => {
      const updates = request.body;
      const agentId = request.agent!._id;

      let settings = await DispositionSettings.findOne();
      if (!settings) {
        settings = new DispositionSettings();
      }

      if (updates.defaultCategoryId == 'unset') {
        updates.defaultCategoryId = null;
      }

      if (updates.defaultCategoryId) {
        const category = await DispositionCategory.findById(updates.defaultCategoryId);
        if (!category) {
          return { ok: false, error: 'Categoría por defecto no encontrada' };
        }
      }

      Object.assign(settings, updates, { updatedBy: agentId });
      await settings.save();
      clearDispositionCache();

      await logAuditFromRequest({
        request,
        action: 'disposition_settings_updated',
        category: 'settings',
        targetType: 'system',
        targetId: 'disposition_settings',
        severity: 'low',
        metadata: { ...updates },
      });

      return { ok: true, settings };
    }
  );

  /**
   * Initialize default categories (one-time setup)
   */
  fastify.post(
    '/api/admin/dispositions/initialize',
    { preHandler: requirePermission('settings.write') },
    async () => {
      await initializeDefaultCategories();
      clearDispositionCache();
      return { ok: true, message: 'Categorías por defecto inicializadas' };
    }
  );

  // ============= STATISTICS =============

  /**
   * Get disposition statistics
   */
  fastify.get(
    '/api/admin/dispositions/stats',
    { preHandler: requirePermission('settings.read') },
    async () => {
      const [categories, tags] = await Promise.all([
        DispositionCategory.find().select('name code usageCount isActive subcategories').lean(),
        DispositionTag.find().select('name code usageCount isActive').lean(),
      ]);

      // Get recent dispositions from chat sessions
      const { ChatSession } = await import('../database/index.js');
      
      // Count total dispositions
      const totalDispositions = await ChatSession.countDocuments({
        'disposition.categoryId': { $exists: true }
      });

      // Get top categories by usage
      const topCategoriesAgg = await ChatSession.aggregate([
        { $match: { 'disposition.categoryId': { $exists: true } } },
        { $group: { _id: '$disposition.categoryName', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);

      const topCategories = topCategoriesAgg.map(c => ({
        name: c._id || 'Sin categoría',
        count: c.count,
      }));

      // Count subcategories
      const totalSubcategories = categories.reduce(
        (acc, cat) => acc + (cat.subcategories?.length || 0),
        0
      );

      return {
        ok: true,
        stats: {
          totalCategories: categories.length,
          activeCategories: categories.filter(c => c.isActive).length,
          totalSubcategories,
          totalTags: tags.length,
          activeTags: tags.filter(t => t.isActive).length,
          totalDispositions,
          topCategories,
          categories: categories.map(c => ({
            name: c.name,
            code: c.code,
            usageCount: c.usageCount,
          })),
          tags: tags.map(t => ({
            name: t.name,
            code: t.code,
            usageCount: t.usageCount,
          })),
        },
      };
    }
  );
}
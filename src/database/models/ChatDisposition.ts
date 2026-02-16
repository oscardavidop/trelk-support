/**
 * ChatDisposition Model - Categorías y subcategorías para tipificación de cierre de chat
 * Similar a sistemas enterprise como Avaya, Zendesk, WhatsApp Business
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============= INTERFACES =============

/**
 * Subcategoría de tipificación
 */
export interface IDispositionSubcategory {
  _id?: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  order: number;
}

/**
 * Categoría de tipificación
 */
export interface IDispositionCategory extends Document {
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  subcategories: IDispositionSubcategory[];
  requiresComment: boolean;
  minCommentLength: number;
  isActive: boolean;
  order: number;
  // Statistics
  usageCount: number;
  lastUsedAt?: Date;
  // Metadata
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tags rápidos para cierre de chat
 */
export interface IDispositionTag extends Document {
  name: string;
  code: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  order: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Configuración global de tipificaciones
 */
export interface IDispositionSettings extends Document {
  requireDisposition: boolean; // Requiere tipificación para cerrar
  requireComment: boolean; // Comentario siempre obligatorio
  minCommentLength: number;
  maxCommentLength: number;
  allowCustomTags: boolean;
  defaultCategoryId?: Types.ObjectId;
  // Para flows automáticos
  flowDefaultCategoryId?: Types.ObjectId;
  flowDefaultSubcategoryId?: Types.ObjectId;
  updatedAt: Date;
  updatedBy?: Types.ObjectId;
}

// ============= SCHEMAS =============

const SubcategorySchema = new Schema<IDispositionSubcategory>({
  name: { type: String, required: true },
  code: { type: String, required: true },
  description: String,
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
});

const DispositionCategorySchema = new Schema<IDispositionCategory>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: String,
    icon: String,
    color: { type: String, default: '#6366f1' },
    subcategories: [SubcategorySchema],
    requiresComment: { type: Boolean, default: false },
    minCommentLength: { type: Number, default: 10 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 },
    lastUsedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
  },
  { timestamps: true }
);

const DispositionTagSchema = new Schema<IDispositionTag>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    color: { type: String, default: '#f59e0b' },
    icon: String,
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const DispositionSettingsSchema = new Schema<IDispositionSettings>(
  {
    requireDisposition: { type: Boolean, default: true },
    requireComment: { type: Boolean, default: false },
    minCommentLength: { type: Number, default: 10 },
    maxCommentLength: { type: Number, default: 500 },
    allowCustomTags: { type: Boolean, default: false },
    defaultCategoryId: { type: Schema.Types.ObjectId, ref: 'DispositionCategory' },
    flowDefaultCategoryId: { type: Schema.Types.ObjectId, ref: 'DispositionCategory' },
    flowDefaultSubcategoryId: { type: Schema.Types.ObjectId },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
  },
  { timestamps: true }
);

// Indexes
DispositionCategorySchema.index({ isActive: 1, order: 1 });
DispositionCategorySchema.index({ code: 1 });
DispositionTagSchema.index({ isActive: 1, order: 1 });

// ============= MODELS =============

export const DispositionCategory = mongoose.model<IDispositionCategory>(
  'DispositionCategory',
  DispositionCategorySchema
);

export const DispositionTag = mongoose.model<IDispositionTag>(
  'DispositionTag',
  DispositionTagSchema
);

export const DispositionSettings = mongoose.model<IDispositionSettings>(
  'DispositionSettings',
  DispositionSettingsSchema
);

// ============= HELPER FUNCTIONS =============

// Cache for categories and settings
let categoriesCache: any[] | null = null;
let tagsCache: any[] | null = null;
let settingsCache: any | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Get all active categories with subcategories (cached)
 */
export async function getActiveCategories(): Promise<any[]> {
  const now = Date.now();
  if (categoriesCache && (now - cacheTimestamp) < CACHE_TTL) {
    return categoriesCache;
  }

  categoriesCache = await DispositionCategory
    .find({ isActive: true })
    .sort({ order: 1 })
    .lean()
    .exec();
  cacheTimestamp = now;
  return categoriesCache || [];
}

/**
 * Get all active tags (cached)
 */
export async function getActiveTags(): Promise<any[]> {
  const now = Date.now();
  if (tagsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return tagsCache;
  }

  tagsCache = await DispositionTag
    .find({ isActive: true })
    .sort({ order: 1 })
    .lean()
    .exec();
  return tagsCache || [];
}

/**
 * Get disposition settings (cached)
 */
export async function getDispositionSettings(): Promise<any> {
  const now = Date.now();
  if (settingsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return settingsCache;
  }

  let settings: any = await DispositionSettings.findOne().lean().exec();
  
  if (!settings) {
    // Create default settings
    const newSettings = await DispositionSettings.create({
      requireDisposition: true,
      requireComment: false,
      minCommentLength: 10,
      maxCommentLength: 500,
      allowCustomTags: false,
    });
    settings = newSettings.toObject();
  }

  settingsCache = settings;
  return settingsCache;
}

/**
 * Clear cache (call after updates)
 */
export function clearDispositionCache(): void {
  categoriesCache = null;
  tagsCache = null;
  settingsCache = null;
  cacheTimestamp = 0;
}

/**
 * Validate disposition data
 */
export async function validateDisposition(
  categoryId: string,
  subcategoryId?: string,
  comment?: string,
  tags?: string[]
): Promise<{ valid: boolean; error?: string }> {
  const settings = await getDispositionSettings();
  const categories = await getActiveCategories();

  // Find category
  const category = categories.find((c: any) => c._id?.toString() === categoryId);
  if (!category) {
    return { valid: false, error: 'Categoría no válida o inactiva' };
  }

  // Validate subcategory if category has subcategories
  if (category.subcategories.length > 0) {
    if (!subcategoryId) {
      return { valid: false, error: 'Subcategoría requerida' };
    }
    const subcategory = category.subcategories.find(
      (s: any) => s._id?.toString() === subcategoryId && s.isActive
    );
    if (!subcategory) {
      return { valid: false, error: 'Subcategoría no válida o inactiva' };
    }
  }

  // Validate comment
  const commentRequired = settings.requireComment || category.requiresComment;
  if (commentRequired) {
    if (!comment || comment.trim().length === 0) {
      return { valid: false, error: 'Comentario requerido para esta categoría' };
    }
    const minLength = category.minCommentLength || settings.minCommentLength;
    if (comment.trim().length < minLength) {
      return { valid: false, error: `El comentario debe tener al menos ${minLength} caracteres` };
    }
    if (comment.length > settings.maxCommentLength) {
      return { valid: false, error: `El comentario no puede exceder ${settings.maxCommentLength} caracteres` };
    }
  }

  // Validate tags
  if (tags && tags.length > 0) {
    const activeTags = await getActiveTags();
    const validTagCodes = activeTags.map(t => t.code);
    const invalidTags = tags.filter(t => !validTagCodes.includes(t));
    if (invalidTags.length > 0 && !settings.allowCustomTags) {
      return { valid: false, error: `Tags no válidos: ${invalidTags.join(', ')}` };
    }
  }

  return { valid: true };
}

/**
 * Increment category usage count
 */
export async function incrementCategoryUsage(categoryId: string): Promise<void> {
  await DispositionCategory.updateOne(
    { _id: categoryId },
    { $inc: { usageCount: 1 }, $set: { lastUsedAt: new Date() } }
  );
  clearDispositionCache();
}

/**
 * Increment tag usage counts
 */
export async function incrementTagUsage(tagCodes: string[]): Promise<void> {
  if (tagCodes.length === 0) return;
  await DispositionTag.updateMany(
    { code: { $in: tagCodes } },
    { $inc: { usageCount: 1 } }
  );
}

/**
 * Initialize default categories if none exist
 */
export async function initializeDefaultCategories(): Promise<void> {
  const count = await DispositionCategory.countDocuments();
  if (count > 0) return;

  const defaultCategories = [
    {
      name: 'Facturación',
      code: 'billing',
      icon: 'CreditCard',
      color: '#10b981',
      order: 1,
      subcategories: [
        { name: 'Consulta de pago', code: 'payment_inquiry', order: 1, isActive: true },
        { name: 'Problema con factura', code: 'invoice_issue', order: 2, isActive: true },
        { name: 'Reembolso', code: 'refund', order: 3, isActive: true },
      ],
      requiresComment: false,
    },
    {
      name: 'Soporte Técnico',
      code: 'technical_support',
      icon: 'Wrench',
      color: '#3b82f6',
      order: 2,
      subcategories: [
        { name: 'Error en login', code: 'login_error', order: 1, isActive: true },
        { name: 'Bug en sistema', code: 'system_bug', order: 2, isActive: true },
        { name: 'Integración Telegram', code: 'telegram_integration', order: 3, isActive: true },
        { name: 'Flow no ejecuta', code: 'flow_not_running', order: 4, isActive: true },
      ],
      requiresComment: false,
    },
    {
      name: 'Reclamo',
      code: 'complaint',
      icon: 'AlertTriangle',
      color: '#ef4444',
      order: 3,
      subcategories: [
        { name: 'Mal servicio', code: 'bad_service', order: 1, isActive: true },
        { name: 'Tiempo de respuesta', code: 'response_time', order: 2, isActive: true },
        { name: 'Información incorrecta', code: 'wrong_info', order: 3, isActive: true },
      ],
      requiresComment: true,
      minCommentLength: 20,
    },
    {
      name: 'Ventas',
      code: 'sales',
      icon: 'ShoppingCart',
      color: '#8b5cf6',
      order: 4,
      subcategories: [
        { name: 'Consulta de precio', code: 'price_inquiry', order: 1, isActive: true },
        { name: 'Demo solicitada', code: 'demo_request', order: 2, isActive: true },
        { name: 'Upgrade de plan', code: 'plan_upgrade', order: 3, isActive: true },
      ],
      requiresComment: false,
    },
    {
      name: 'Seguimiento',
      code: 'follow_up',
      icon: 'Clock',
      color: '#f59e0b',
      order: 5,
      subcategories: [
        { name: 'Caso pendiente', code: 'pending_case', order: 1, isActive: true },
        { name: 'Respuesta a ticket', code: 'ticket_reply', order: 2, isActive: true },
      ],
      requiresComment: false,
    },
    {
      name: 'Otro',
      code: 'other',
      icon: 'MoreHorizontal',
      color: '#6b7280',
      order: 99,
      subcategories: [],
      requiresComment: true,
      minCommentLength: 10,
    },
  ];

  await DispositionCategory.insertMany(defaultCategories);
  console.log('[Disposition] Default categories initialized');

  // Initialize default tags
  const defaultTags = [
    { name: 'Urgente', code: 'urgent', color: '#ef4444', icon: 'Zap', order: 1 },
    { name: 'Usuario molesto', code: 'angry_user', color: '#f97316', icon: 'Frown', order: 2 },
    { name: 'Escalado', code: 'escalated', color: '#8b5cf6', icon: 'ArrowUp', order: 3 },
    { name: 'Bug confirmado', code: 'bug_confirmed', color: '#dc2626', icon: 'Bug', order: 4 },
    { name: 'Requiere seguimiento', code: 'needs_followup', color: '#0891b2', icon: 'Calendar', order: 5 },
    { name: 'VIP', code: 'vip', color: '#eab308', icon: 'Star', order: 6 },
  ];

  await DispositionTag.insertMany(defaultTags);
  console.log('[Disposition] Default tags initialized');
}

/**
 * Contacts Service PRO
 * Complete contact management with filtering, bulk actions, and analytics
 */

import { Types, FilterQuery, PipelineStage } from 'mongoose';
import {
  User,
  IUser,
  ChatSession,
  Message,
  Tag,
  UserTag,
  Note,
  CustomFieldDefinition,
  UserCustomField,
  ContactActivity,
  Segment,
  ActivityTypes,
} from '../database/models/index.js';
import type {
  ContactActivityType,
  IFilterGroup,
  IFilterRule,
  FilterOperator,
} from '../database/models/index.js';
import { CacheKeys, CacheTTL, invalidate } from './cache.js';
import * as redis from './redis.js';
import { logger } from './logger.js';

// ==================== TYPES ====================

export interface ContactListParams {
  page?: number;
  limit?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  filters?: IFilterGroup;
  segmentId?: string;
  tags?: string[];
  blocked?: boolean;
  hasActiveSession?: boolean;
  language?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ContactListResult {
  contacts: IContactListItem[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

export interface IContactListItem {
  _id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  language?: string;
  isBlocked: boolean;
  createdAt: Date;
  lastActivity?: Date;
  // Computed fields
  tags: Array<{ _id: string; name: string; color: string }>;
  activeSession?: {
    sessionId: string;
    status: string;
    assignedAgent?: string;
  };
  totalSessions: number;
  totalMessages: number;
  customFields?: Record<string, any>;
}

export interface IContact360 {
  // Basic info
  _id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  language?: string;
  isBlocked: boolean;
  blockedReason?: string;
  createdAt: Date;
  updatedAt?: Date;
  lastActivity?: Date;
  metadata?: Record<string, any>;

  // Tags
  tags: Array<{ _id: string; name: string; color: string; addedAt: Date; addedBy?: string }>;

  // Custom fields
  customFields: Array<{
    fieldId: string;
    key: string;
    label: string;
    type: string;
    value: any;
    updatedAt?: Date;
  }>;

  // Notes
  notes: Array<{
    _id: string;
    content: string;
    createdAt: Date;
    createdBy: { _id: string; name: string };
  }>;

  // Session stats
  stats: {
    totalSessions: number;
    activeSession?: {
      sessionId: string;
      status: string;
      assignedAgent?: { _id: string; name: string };
      createdAt: Date;
    };
    avgSessionDuration: number;
    avgResponseTime: number;
    totalMessages: number;
    lastSessionDate?: Date;
    surveyAvgScore?: number;
  };

  // Flow history
  flowHistory: Array<{
    flowId: string;
    flowName: string;
    executedAt: Date;
    status: string;
    completedAt?: Date;
  }>;

  // Recent activity
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
    actor?: { type: string; name?: string };
    metadata?: any;
  }>;

  // Segments
  segments: Array<{ _id: string; name: string; color: string }>;
}

export interface BulkActionResult {
  success: number;
  failed: number;
  errors: Array<{ contactId: string; error: string }>;
}

// ==================== CACHE KEYS ====================

const CACHE_KEYS = {
  contactList: (hash: string) => `contacts:list:${hash}`,
  contact360: (id: string) => `contacts:360:${id}`,
  contactStats: (id: string) => `contacts:stats:${id}`,
  segmentCount: (id: string) => `segment:count:${id}`,
};

const CACHE_TTL = {
  contactList: 60, // 1 minute
  contact360: 120, // 2 minutes
  contactStats: 300, // 5 minutes
  segmentCount: 600, // 10 minutes
};

// ==================== FILTER ENGINE ====================

/**
 * Build MongoDB query from filter group
 */
function buildFilterQuery(filterGroup: IFilterGroup): FilterQuery<IUser> {
  const queries: FilterQuery<IUser>[] = [];

  // Process rules
  for (const rule of filterGroup.rules || []) {
    const query = buildRuleQuery(rule);
    if (query) queries.push(query);
  }

  // Process nested groups
  for (const group of filterGroup.groups || []) {
    const nestedQuery = buildFilterQuery(group);
    if (Object.keys(nestedQuery).length > 0) {
      queries.push(nestedQuery);
    }
  }

  if (queries.length === 0) return {};

  if (filterGroup.logic === 'OR') {
    return { $or: queries };
  }
  return { $and: queries };
}

function buildRuleQuery(rule: IFilterRule): FilterQuery<IUser> | null {
  const { field, operator, value, relativeDays, customFieldKey } = rule;

  switch (field) {
    // User fields
    case 'language':
      return buildOperatorQuery('language', operator, value);

    case 'isBlocked':
      return { isBlocked: value === 'true' || value === true };

    case 'createdAt':
    case 'lastActivity':
      return buildDateQuery(field, operator, value, relativeDays);

    case 'username':
      return buildOperatorQuery('username', operator, value);

    case 'firstName':
      return buildOperatorQuery('firstName', operator, value);

    case 'lastName':
      return buildOperatorQuery('lastName', operator, value);

    // Requires aggregation pipeline (handled separately)
    case 'tags':
    case 'hasTag':
    case 'hasAnyTag':
    case 'hasAllTags':
    case 'totalSessions':
    case 'totalMessages':
    case 'hasActiveSession':
    case 'executedFlow':
    case 'customField':
      // These are processed in the aggregation pipeline
      return null;

    default:
      logger.warn('contacts', { action: 'unknown_filter_field', field });
      return null;
  }
}

function buildOperatorQuery(
  fieldName: string,
  operator: FilterOperator,
  value: any
): FilterQuery<IUser> {
  switch (operator) {
    case 'equals':
      return { [fieldName]: value };
    case 'not_equals':
      return { [fieldName]: { $ne: value } };
    case 'contains':
      return { [fieldName]: { $regex: value, $options: 'i' } };
    case 'not_contains':
      return { [fieldName]: { $not: { $regex: value, $options: 'i' } } };
    case 'starts_with':
      return { [fieldName]: { $regex: `^${value}`, $options: 'i' } };
    case 'ends_with':
      return { [fieldName]: { $regex: `${value}$`, $options: 'i' } };
    case 'is_empty':
      return { $or: [{ [fieldName]: { $exists: false } }, { [fieldName]: null }, { [fieldName]: '' }] };
    case 'is_not_empty':
      return { $and: [{ [fieldName]: { $exists: true } }, { [fieldName]: { $ne: null } }, { [fieldName]: { $ne: '' } }] };
    case 'greater_than':
      return { [fieldName]: { $gt: value } };
    case 'less_than':
      return { [fieldName]: { $lt: value } };
    case 'greater_or_equal':
      return { [fieldName]: { $gte: value } };
    case 'less_or_equal':
      return { [fieldName]: { $lte: value } };
    case 'in':
      return { [fieldName]: { $in: Array.isArray(value) ? value : [value] } };
    case 'not_in':
      return { [fieldName]: { $nin: Array.isArray(value) ? value : [value] } };
    default:
      return { [fieldName]: value };
  }
}

function buildDateQuery(
  fieldName: string,
  operator: FilterOperator,
  value: any,
  relativeDays?: number
): FilterQuery<IUser> {
  let targetDate: Date;

  if (relativeDays !== undefined) {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - relativeDays);
  } else if (value) {
    targetDate = new Date(value);
  } else {
    return {};
  }

  switch (operator) {
    case 'before':
      return { [fieldName]: { $lt: targetDate } };
    case 'after':
      return { [fieldName]: { $gt: targetDate } };
    case 'within_last':
      return { [fieldName]: { $gte: targetDate } };
    case 'not_within_last':
      return { [fieldName]: { $lt: targetDate } };
    default:
      return { [fieldName]: { $gte: targetDate } };
  }
}

// ==================== MAIN SERVICE ====================
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export const contactsService = {
  /**
   * Get paginated contact list with filters
   */
  // async listContacts(params: ContactListParams): Promise<ContactListResult> {
  //   const {
  //     page = 1,
  //     limit = 50,
  //     sortField = 'lastActivity',
  //     sortDirection = 'desc',
  //     search,
  //     filters,
  //     segmentId,
  //     tags,
  //     blocked,
  //     hasActiveSession,
  //     language,
  //     dateFrom,
  //     dateTo,
  //   } = params;

  //   // Build base query
  //   let baseQuery: FilterQuery<IUser> = {};

  //   // Apply segment filters
  //   if (segmentId) {
  //     const segment = await Segment.findById(segmentId);
  //     if (segment?.filters) {
  //       baseQuery = { ...baseQuery, ...buildFilterQuery(segment.filters) };
  //     }
  //   }

  //   // Apply custom filters
  //   if (filters) {
  //     const filterQuery = buildFilterQuery(filters);
  //     baseQuery = { ...baseQuery, ...filterQuery };
  //   }

  //   // Simple filters
  //   if (search) {
  //     baseQuery.$or = [
  //       { username: { $regex: search, $options: 'i' } },
  //       { firstName: { $regex: search, $options: 'i' } },
  //       { lastName: { $regex: search, $options: 'i' } },
  //       { telegramId: isNaN(Number(search)) ? undefined : Number(search) },
  //     ].filter(Boolean);
  //   }

  //   if (blocked !== undefined) {
  //     baseQuery.isBlocked = blocked;
  //   }

  //   if (language) {
  //     baseQuery.language = language;
  //   }

  //   if (dateFrom || dateTo) {
  //     baseQuery.createdAt = {};
  //     if (dateFrom) baseQuery.createdAt.$gte = new Date(dateFrom);
  //     if (dateTo) baseQuery.createdAt.$lte = new Date(dateTo);
  //   }

  //   // Build aggregation pipeline
  //   const pipeline: PipelineStage[] = [
  //     { $match: baseQuery },
  //     // Lookup tags
  //     {
  //       $lookup: {
  //         from: 'usertags',
  //         localField: '_id',
  //         foreignField: 'userId',
  //         as: 'userTags',
  //       },
  //     },
  //     {
  //       $lookup: {
  //         from: 'tags',
  //         localField: 'userTags.tagId',
  //         foreignField: '_id',
  //         as: 'tags',
  //       },
  //     },
  //     // Filter by tags if specified
  //     ...(tags && tags.length > 0
  //       ? [
  //           {
  //             $match: {
  //               'tags._id': { $in: tags.map((t) => new Types.ObjectId(t)) },
  //             },
  //           } as PipelineStage,
  //         ]
  //       : []),
  //     // Lookup active session
  //     {
  //       $lookup: {
  //         from: 'chatsessions',
  //         let: { telegramId: '$telegramId' },
  //         pipeline: [
  //           {
  //             $match: {
  //               $expr: { $eq: ['$telegramChatId', '$$telegramId'] },
  //               status: { $in: ['active', 'waiting', 'pending'] },
  //             },
  //           },
  //           { $sort: { createdAt: -1 } },
  //           { $limit: 1 },
  //         ],
  //         as: 'activeSession',
  //       },
  //     },
  //     { $unwind: { path: '$activeSession', preserveNullAndEmptyArrays: true } },
  //     // Filter by active session if specified
  //     ...(hasActiveSession !== undefined
  //       ? [
  //           {
  //             $match: hasActiveSession
  //               ? { activeSession: { $exists: true } }
  //               : { activeSession: { $exists: false } },
  //           } as PipelineStage,
  //         ]
  //       : []),
  //     // Count sessions and messages
  //     {
  //       $lookup: {
  //         from: 'chatsessions',
  //         let: { telegramId: '$telegramId' },
  //         pipeline: [
  //           {
  //             $match: {
  //               $expr: { $eq: ['$telegramChatId', '$$telegramId'] },
  //             },
  //           },
  //           { $count: 'count' },
  //         ],
  //         as: 'sessionCount',
  //       },
  //     },
  //     {
  //       $lookup: {
  //         from: 'messages',
  //         let: { telegramId: '$telegramId' },
  //         pipeline: [
  //           {
  //             $match: {
  //               $expr: { $eq: ['$telegramChatId', '$$telegramId'] },
  //             },
  //           },
  //           { $count: 'count' },
  //         ],
  //         as: 'messageCount',
  //       },
  //     },
  //     // Project fields
  //     {
  //       $project: {
  //         telegramId: 1,
  //         username: 1,
  //         firstName: 1,
  //         lastName: 1,
  //         fullName: {
  //           $concat: [
  //             { $ifNull: ['$firstName', ''] },
  //             ' ',
  //             { $ifNull: ['$lastName', ''] },
  //           ],
  //         },
  //         language: 1,
  //         isBlocked: 1,
  //         createdAt: 1,
  //         lastActivity: 1,
  //         tags: {
  //           $map: {
  //             input: '$tags',
  //             as: 'tag',
  //             in: {
  //               _id: '$$tag._id',
  //               name: '$$tag.name',
  //               color: '$$tag.color',
  //             },
  //           },
  //         },
  //         activeSession: {
  //           $cond: {
  //             if: { $ifNull: ['$activeSession._id', false] },
  //             then: {
  //               sessionId: '$activeSession.sessionId',
  //               status: '$activeSession.status',
  //               assignedAgent: '$activeSession.assignedAgent',
  //             },
  //             else: '$$REMOVE',
  //           },
  //         },
  //         totalSessions: { $ifNull: [{ $arrayElemAt: ['$sessionCount.count', 0] }, 0] },
  //         totalMessages: { $ifNull: [{ $arrayElemAt: ['$messageCount.count', 0] }, 0] },
  //       },
  //     },
  //     // Sort
  //     { $sort: { [sortField]: sortDirection === 'desc' ? -1 : 1 } },
  //     // Pagination
  //     {
  //       $facet: {
  //         data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
  //         total: [{ $count: 'count' }],
  //       },
  //     },
  //   ];

  //   const result = await User.aggregate(pipeline);

  //   const contacts = result[0]?.data || [];
  //   const total = result[0]?.total[0]?.count || 0;

  //   return {
  //     contacts,
  //     total,
  //     page,
  //     totalPages: Math.ceil(total / limit),
  //     hasMore: page * limit < total,
  //   };
  // },
  async listContacts(params: ContactListParams): Promise<ContactListResult> {
    const {
      page = 1,
      limit = 50,
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
    } = params;

    // 1. Construir Query Base (Filtros rápidos que están en el modelo User)
    const baseQuery: any = {};

    if (blocked !== undefined) {
      baseQuery.isBlocked = blocked;
    }

    if (language) {
      baseQuery.language = language;
    }

    if (dateFrom || dateTo) {
      baseQuery.createdAt = {};
      if (dateFrom) baseQuery.createdAt.$gte = new Date(dateFrom);
      if (dateTo) baseQuery.createdAt.$lte = new Date(dateTo);
    }

    // Búsqueda (Nota: Para 5k+ usuarios, considera usar Índices de Texto en el futuro)
    if (search) {
      const searchRegex = { $regex: escapeRegExp(search), $options: 'i' };
      const searchNumber = Number(search);

      baseQuery.$or = [
        { username: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        // Solo busca por ID si es un número válido
        ...(!isNaN(searchNumber) ? [{ telegramId: searchNumber }] : [])
      ];
    }

    // Segment filters (asumiendo lógica externa)
    if (segmentId) {
      const segment = await Segment.findById(segmentId);
      if (segment?.filters) {
        const segmentFilterQuery = buildFilterQuery(segment.filters);
        Object.assign(baseQuery, segmentFilterQuery);
      }
    }

    const pipeline: PipelineStage[] = [
      { $match: baseQuery },
    ];

    // ==================================================================================
    // FASE 2: Filtros Pesados (Lookups necesarios para FILTRAR)
    // Solo agregamos estos pasos si el usuario pidió filtrar por Tags o Sesión Activa
    // ==================================================================================

    // A. Filtro por Tags (Solo si 'tags' tiene valor)
    if (tags && tags.length > 0) {
      pipeline.push(
        {
          $lookup: {
            from: 'usertags',
            localField: '_id',
            foreignField: 'userId',
            as: 'filterTags',
          },
        },
        {
          $match: {
            'filterTags.tagId': { $in: tags.map((t) => new Types.ObjectId(t)) },
          },
        },
        // Limpiamos para no cargar memoria
        { $project: { filterTags: 0 } }
      );
    }

    // B. Filtro por Sesión Activa (Solo si 'hasActiveSession' está definido)
    if (hasActiveSession !== undefined) {
      pipeline.push(
        {
          $lookup: {
            from: 'chatsessions',
            let: { telegramId: '$telegramId' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$telegramChatId', '$$telegramId'] },
                  status: { $in: ['active', 'waiting', 'pending'] },
                },
              },
              { $limit: 1 }, // Optimización: Solo necesitamos saber si existe 1
            ],
            as: 'checkSession',
          },
        },
        {
          $match: {
            checkSession: hasActiveSession ? { $ne: [] } : { $eq: [] },
          },
        },
        { $project: { checkSession: 0 } }
      );
    }

    // ==================================================================================
    // FASE 3: Paginación y Obtención de Datos
    // Usamos $facet para contar el total Y obtener la página actual en paralelo
    // ==================================================================================

    pipeline.push({
      $facet: {
        // Rama 1: Solo cuenta el total de resultados (rápido)
        metadata: [{ $count: 'total' }],

        // Rama 2: Obtiene los datos de la página actual
        data: [
          { $sort: { [sortField]: sortDirection === 'desc' ? -1 : 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },

          // -----------------------------------------------------------
          // AHORA SÍ: "Enrichment". Solo calculamos esto para los 50 usuarios finales
          // -----------------------------------------------------------

          // 1. Traer Tags (Visualización)
          {
            $lookup: {
              from: 'usertags',
              localField: '_id',
              foreignField: 'userId',
              as: 'userTagsRel',
            },
          },
          {
            $lookup: {
              from: 'tags',
              localField: 'userTagsRel.tagId',
              foreignField: '_id',
              as: 'tagsDetail',
            },
          },

          // 2. Traer Sesión Activa (Detalle)
          {
            $lookup: {
              from: 'chatsessions',
              let: { telegramId: '$telegramId' },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ['$telegramChatId', '$$telegramId'] },
                    status: { $in: ['active', 'waiting', 'pending'] },
                  },
                },
                { $sort: { createdAt: -1 } },
                { $limit: 1 },
              ],
              as: 'activeSessionData',
            },
          },
          { $unwind: { path: '$activeSessionData', preserveNullAndEmptyArrays: true } },

          // 3. Contar Sesiones Totales (Optimizada)
          {
            $lookup: {
              from: 'chatsessions',
              let: { telegramId: '$telegramId' },
              pipeline: [
                { $match: { $expr: { $eq: ['$telegramChatId', '$$telegramId'] } } },
                { $count: 'count' } // Solo devuelve el número, no los docs
              ],
              as: 'sessionCountData',
            },
          },

          // 4. Contar Mensajes Totales (Optimizada)
          {
            $lookup: {
              from: 'messages',
              let: { telegramId: '$telegramId' },
              pipeline: [
                { $match: { $expr: { $eq: ['$telegramChatId', '$$telegramId'] } } },
                { $count: 'count' }
              ],
              as: 'messageCountData',
            },
          },

          // 5. Proyección Final (Limpieza)
          {
            $project: {
              telegramId: 1,
              username: 1,
              firstName: 1,
              lastName: 1,
              fullName: {
                $concat: [
                  { $ifNull: ['$firstName', ''] },
                  ' ',
                  { $ifNull: ['$lastName', ''] },
                ],
              },
              language: 1,
              isBlocked: 1,
              createdAt: 1,
              lastActivity: 1,
              photoFileId: 1,
              // Formateo de tags
              tags: {
                $map: {
                  input: '$tagsDetail',
                  as: 'tag',
                  in: {
                    _id: '$$tag._id',
                    name: '$$tag.name',
                    color: '$$tag.color',
                  },
                },
              },
              // Formateo de sesión
              activeSession: {
                $cond: {
                  if: { $ifNull: ['$activeSessionData._id', false] },
                  then: {
                    sessionId: '$activeSessionData.sessionId', // Ajusta según tu modelo ChatSession
                    status: '$activeSessionData.status',
                    assignedAgent: '$activeSessionData.assignedAgent',
                  },
                  else: '$$REMOVE',
                },
              },
              // Extraer contadores de los arrays
              totalSessions: { $ifNull: [{ $arrayElemAt: ['$sessionCountData.count', 0] }, 0] },
              totalMessages: { $ifNull: [{ $arrayElemAt: ['$messageCountData.count', 0] }, 0] },
            },
          },
        ],
      },
    });

    const result = await User.aggregate(pipeline);

    // Extraer resultados del facet
    const metadata = result[0].metadata[0];
    const contacts = result[0].data;
    const total = metadata ? metadata.total : 0;

    return {
      contacts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total,
    };
  },
  /**
   * Get full 360° contact profile
   */
  async getContact360(contactId: string): Promise<IContact360 | null> {
    // Try cache first
    const cacheKey = CACHE_KEYS.contact360(contactId);
    const cached = await redis.getJSON<IContact360>(cacheKey);
    if (cached) return cached;

    // Get user
    const user = await User.findById(contactId);
    if (!user) return null;

    // Parallel data fetching
    const [
      userTagsData,
      customFieldsData,
      notesData,
      sessionsData,
      flowExecutionsData,
      recentActivityData,
      segmentsData,
    ] = await Promise.all([
      // Tags with details
      UserTag.find({ userId: contactId })
        .populate<{ tagId: { _id: Types.ObjectId; name: string; color: string } }>('tagId')
        .populate<{ addedBy: { _id: Types.ObjectId; name: string } | null }>('addedBy', 'name')
        .lean(),

      // Custom fields
      (async () => {
        const definitions = await CustomFieldDefinition.find({ isActive: true }).lean();
        const values = await UserCustomField.find({ user: new Types.ObjectId(contactId) }).lean();
        return definitions.map((def) => {
          const userValue = values.find((v) => v.field.toString() === def._id.toString());
          return {
            fieldId: def._id.toString(),
            key: def.key,
            label: def.name,
            type: def.type,
            value: userValue?.value ?? def.defaultValue ?? null,
            updatedAt: userValue?.updatedAt,
          };
        });
      })(),

      // Notes
      Note.find({ user: new Types.ObjectId(contactId) })
        .populate<{ createdBy: { _id: Types.ObjectId; name: string } }>('createdBy', 'name')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),

      // Sessions stats
      ChatSession.aggregate([
        { $match: { telegramChatId: user.telegramId } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            avgDuration: {
              $avg: {
                $cond: [
                  { $and: ['$closedAt', '$createdAt'] },
                  { $subtract: ['$closedAt', '$createdAt'] },
                  0,
                ],
              },
            },
            avgResponseTime: { $avg: '$firstResponseTime' },
            lastSessionDate: { $max: '$createdAt' },
          },
        },
      ]),

      // Flow executions
      (async () => {
        try {
          const FlowExecution = (await import('../database/models/FlowExecution.js')).FlowExecution;
          const Flow = (await import('../database/models/Flow.js')).Flow;

          const executions = await FlowExecution.find({ telegramChatId: user.telegramId })
            .sort({ startedAt: -1 })
            .limit(20)
            .lean();

          const flowIds = [...new Set(executions.map((e: any) => e.flowId))];
          const flows = await Flow.find({ _id: { $in: flowIds } })
            .select('name')
            .lean();
          const flowMap = new Map(flows.map((f: any) => [f._id.toString(), f.name]));

          return executions.map((e: any) => ({
            flowId: e.flowId,
            flowName: flowMap.get(e.flowId) || 'Unknown Flow',
            executedAt: e.startedAt,
            status: e.status,
            completedAt: e.completedAt,
          }));
        } catch {
          return [];
        }
      })(),

      // Recent activity
      ContactActivity.find({ user: new Types.ObjectId(contactId) })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),

      // Segments (find which segments this contact belongs to)
      (async () => {
        const segments = await Segment.find({ isActive: true }).lean();
        const matchingSegments: Array<{ _id: string; name: string; color: string }> = [];

        for (const segment of segments) {
          if (segment.filters) {
            const query = buildFilterQuery(segment.filters);
            const match = await User.findOne({ _id: contactId, ...query });
            if (match) {
              matchingSegments.push({
                _id: segment._id.toString(),
                name: segment.name,
                color: segment.color,
              });
            }
          }
        }

        return matchingSegments;
      })(),
    ]);

    // Get active session details
    const activeSession = await ChatSession.findOne({
      telegramChatId: user.telegramId,
      status: { $in: ['active', 'waiting', 'pending'] },
    })
      .populate<{ assignedAgent: { _id: Types.ObjectId; name: string } | null }>('assignedAgent', 'name')
      .lean();

    // Count total messages
    const totalMessages = await Message.countDocuments({ telegramChatId: user.telegramId });

    // Build 360° profile
    const contact360: IContact360 = {
      _id: user._id.toString(),
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || `User ${user.telegramId}`,
      language: user.language,
      isBlocked: user.isBlocked,
      blockedReason: (user as any).blockedReason,
      createdAt: user.createdAt,
      updatedAt: (user as any).updatedAt,
      lastActivity: user.lastActivity,
      metadata: (user as any).metadata,

      tags: userTagsData.map((ut) => ({
        _id: ut.tagId._id.toString(),
        name: ut.tagId.name,
        color: ut.tagId.color,
        addedAt: ut.createdAt,
        addedBy: ut.addedBy?.name,
      })),

      customFields: customFieldsData,

      notes: notesData.map((n) => ({
        _id: n._id.toString(),
        content: n.content,
        createdAt: n.createdAt,
        createdBy: {
          _id: n.createdBy._id.toString(),
          name: n.createdBy.name,
        },
      })),

      stats: {
        totalSessions: sessionsData[0]?.totalSessions || 0,
        activeSession: activeSession
          ? {
            sessionId: activeSession.sessionId,
            status: activeSession.status,
            assignedAgent: activeSession.assignedAgent
              ? {
                _id: activeSession.assignedAgent._id.toString(),
                name: activeSession.assignedAgent.name,
              }
              : undefined,
            createdAt: activeSession.createdAt,
          }
          : undefined,
        avgSessionDuration: Math.round((sessionsData[0]?.avgDuration || 0) / 1000 / 60), // minutes
        avgResponseTime: Math.round((sessionsData[0]?.avgResponseTime || 0) / 1000), // seconds
        totalMessages,
        lastSessionDate: sessionsData[0]?.lastSessionDate,
        surveyAvgScore: undefined, // TODO: Calculate from surveys
      },

      flowHistory: flowExecutionsData,

      recentActivity: recentActivityData.map((a) => ({
        type: a.type,
        description: a.description,
        timestamp: a.createdAt,
        actor: a.actor,
        metadata: a.metadata,
      })),

      segments: segmentsData,
    };

    // Cache result
    await redis.setJSON(cacheKey, contact360, CACHE_TTL.contact360);

    return contact360;
  },

  /**
   * Update contact fields
   */
  async updateContact(
    contactId: string,
    updates: {
      language?: string;
      firstName?: string;
      lastName?: string;
      isBlocked?: boolean;
      blockedReason?: string;
      metadata?: Record<string, any>;
    },
    actorId?: string,
    actorType: 'agent' | 'system' = 'agent'
  ): Promise<IUser | null> {
    const user = await User.findByIdAndUpdate(contactId, updates, { new: true });

    if (user) {
      // Log activity
      await this.logActivity(contactId, ActivityTypes.CONTACT_UPDATED, 'Contact info updated', actorId, actorType, { changes: updates });

      // Invalidate cache
      await redis.del(CACHE_KEYS.contact360(contactId));
    }

    return user;
  },

  /**
   * Block/unblock contact
   */
  async setContactBlocked(
    contactId: string,
    blocked: boolean,
    reason?: string,
    actorId?: string
  ): Promise<IUser | null> {
    const update: any = { isBlocked: blocked };
    if (blocked && reason) {
      update.blockedReason = reason;
    } else if (!blocked) {
      update.$unset = { blockedReason: 1 };
    }

    const user = await User.findByIdAndUpdate(contactId, update, { new: true });

    if (user) {
      await this.logActivity(
        contactId,
        blocked ? ActivityTypes.CONTACT_BLOCKED : ActivityTypes.CONTACT_UNBLOCKED,
        blocked ? `Contact blocked: ${reason || 'No reason'}` : 'Contact unblocked',
        actorId,
        'agent'
      );

      await redis.del(CACHE_KEYS.contact360(contactId));
    }

    return user;
  },

  /**
   * Delete contact and all related data
   */
  async deleteContact(contactId: string, actorId?: string): Promise<boolean> {
    const user = await User.findById(contactId);
    if (!user) return false;

    // Delete related data
    await Promise.all([
      UserTag.deleteMany({ userId: contactId }),
      UserCustomField.deleteMany({ userId: contactId }),
      Note.deleteMany({ user: new Types.ObjectId(contactId) }),
      ContactActivity.deleteMany({ user: new Types.ObjectId(contactId) }),
      // Keep sessions and messages for audit purposes, just mark user as deleted
    ]);

    // Mark user as deleted (soft delete)
    await User.findByIdAndUpdate(contactId, {
      isBlocked: true,
      blockedReason: 'DELETED',
      username: `deleted_${user.telegramId}`,
      firstName: 'Deleted',
      lastName: 'User',
    });

    // Log deletion
    await this.logActivity(contactId, ActivityTypes.CONTACT_DELETED, 'Contact deleted', actorId, 'agent');

    // Clear cache
    await redis.del(CACHE_KEYS.contact360(contactId));

    return true;
  },

  // ==================== BULK ACTIONS ====================

  /**
   * Add tag to multiple contacts
   */
  async bulkAddTag(contactIds: string[], tagId: string, actorId?: string): Promise<BulkActionResult> {
    const result: BulkActionResult = { success: 0, failed: 0, errors: [] };

    for (const contactId of contactIds) {
      try {
        // Check if tag already exists
        const existing = await UserTag.findOne({ userId: contactId, tagId });
        if (existing) {
          result.success++;
          continue;
        }

        await UserTag.create({
          userId: contactId,
          tagId,
          addedBy: actorId ? new Types.ObjectId(actorId) : undefined,
        });

        await this.logActivity(contactId, ActivityTypes.TAG_ADDED, 'Tag added (bulk)', actorId, 'agent', { tagId });
        await redis.del(CACHE_KEYS.contact360(contactId));

        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ contactId, error: error.message });
      }
    }

    return result;
  },

  /**
   * Remove tag from multiple contacts
   */
  async bulkRemoveTag(contactIds: string[], tagId: string, actorId?: string): Promise<BulkActionResult> {
    const result: BulkActionResult = { success: 0, failed: 0, errors: [] };

    for (const contactId of contactIds) {
      try {
        await UserTag.deleteOne({ userId: contactId, tagId });
        await this.logActivity(contactId, ActivityTypes.TAG_REMOVED, 'Tag removed (bulk)', actorId, 'agent', { tagId });
        await redis.del(CACHE_KEYS.contact360(contactId));
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ contactId, error: error.message });
      }
    }

    return result;
  },

  /**
   * Set custom field for multiple contacts
   */
  async bulkSetCustomField(
    contactIds: string[],
    fieldKey: string,
    value: any,
    actorId?: string
  ): Promise<BulkActionResult> {
    const result: BulkActionResult = { success: 0, failed: 0, errors: [] };

    // Find field definition
    const fieldDef = await CustomFieldDefinition.findOne({ key: fieldKey });
    if (!fieldDef) {
      return { success: 0, failed: contactIds.length, errors: [{ contactId: '*', error: 'Field not found' }] };
    }

    for (const contactId of contactIds) {
      try {
        await UserCustomField.findOneAndUpdate(
          { userId: contactId, fieldId: fieldDef._id },
          { value },
          { upsert: true }
        );

        await this.logActivity(contactId, ActivityTypes.CUSTOM_FIELD_UPDATED, `Custom field "${fieldKey}" updated (bulk)`, actorId, 'agent', { fieldKey, value });
        await redis.del(CACHE_KEYS.contact360(contactId));

        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ contactId, error: error.message });
      }
    }

    return result;
  },

  /**
   * Block multiple contacts
   */
  async bulkBlock(contactIds: string[], reason: string, actorId?: string): Promise<BulkActionResult> {
    const result: BulkActionResult = { success: 0, failed: 0, errors: [] };

    for (const contactId of contactIds) {
      try {
        await this.setContactBlocked(contactId, true, reason, actorId);
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ contactId, error: error.message });
      }
    }

    return result;
  },

  /**
   * Unblock multiple contacts
   */
  async bulkUnblock(contactIds: string[], actorId?: string): Promise<BulkActionResult> {
    const result: BulkActionResult = { success: 0, failed: 0, errors: [] };

    for (const contactId of contactIds) {
      try {
        await this.setContactBlocked(contactId, false, undefined, actorId);
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ contactId, error: error.message });
      }
    }

    return result;
  },

  /**
   * Delete multiple contacts
   */
  async bulkDelete(contactIds: string[], actorId?: string): Promise<BulkActionResult> {
    const result: BulkActionResult = { success: 0, failed: 0, errors: [] };

    for (const contactId of contactIds) {
      try {
        await this.deleteContact(contactId, actorId);
        result.success++;
      } catch (error: any) {
        result.failed++;
        result.errors.push({ contactId, error: error.message });
      }
    }

    return result;
  },

  /**
   * Export contacts to CSV/JSON
   */
  async exportContacts(
    params: ContactListParams,
    format: 'csv' | 'json' = 'csv',
    fields?: string[]
  ): Promise<string> {
    // Get all contacts (no pagination)
    const allParams = { ...params, page: 1, limit: 10000 };
    const { contacts } = await this.listContacts(allParams);

    const defaultFields = ['telegramId', 'username', 'firstName', 'lastName', 'language', 'isBlocked', 'createdAt', 'lastActivity', 'tags', 'totalSessions', 'totalMessages'];
    const exportFields = fields || defaultFields;

    if (format === 'json') {
      return JSON.stringify(contacts.map((c) => {
        const obj: any = {};
        for (const field of exportFields) {
          if (field === 'tags') {
            obj[field] = (c.tags || []).map((t) => t.name).join(', ');
          } else {
            obj[field] = (c as any)[field];
          }
        }
        return obj;
      }), null, 2);
    }

    // CSV format
    const header = exportFields.join(',');
    const rows = contacts.map((c) => {
      return exportFields
        .map((field) => {
          if (field === 'tags') {
            return `"${(c.tags || []).map((t) => t.name).join(', ')}"`;
          }
          const val = (c as any)[field];
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val ?? '';
        })
        .join(',');
    });

    return [header, ...rows].join('\n');
  },

  // ==================== ANALYTICS ====================

  /**
   * Get contact statistics
   */
  async getContactStats(): Promise<{
    totalContacts: number;
    activeContacts: number;
    blockedContacts: number;
    contactsWithActiveSession: number;
    newContactsToday: number;
    newContactsThisWeek: number;
    topLanguages: Array<{ language: string; count: number }>;
    contactsByMonth: Array<{ month: string; count: number }>;
  }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const [
      totalContacts,
      blockedContacts,
      activeSessionsCount,
      newContactsToday,
      newContactsThisWeek,
      topLanguages,
      contactsByMonth,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isBlocked: true }),
      ChatSession.distinct('telegramChatId', { status: { $in: ['active', 'waiting', 'pending'] } }),
      User.countDocuments({ createdAt: { $gte: startOfDay } }),
      User.countDocuments({ createdAt: { $gte: startOfWeek } }),
      User.aggregate([
        { $match: { language: { $exists: true, $ne: null } } },
        { $group: { _id: '$language', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { language: '$_id', count: 1, _id: 0 } },
      ]),
      User.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 12 },
        { $project: { month: '$_id', count: 1, _id: 0 } },
      ]),
    ]);

    // Active contacts = had activity in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeContacts = await User.countDocuments({
      lastActivity: { $gte: thirtyDaysAgo },
      isBlocked: false,
    });

    return {
      totalContacts,
      activeContacts,
      blockedContacts,
      contactsWithActiveSession: activeSessionsCount.length,
      newContactsToday,
      newContactsThisWeek,
      topLanguages,
      contactsByMonth: contactsByMonth.reverse(),
    };
  },

  // ==================== ACTIVITY LOGGING ====================

  /**
   * Log contact activity
   */
  async logActivity(
    contactId: string,
    type: ContactActivityType,
    description: string,
    actorId?: string,
    actorType: 'agent' | 'system' | 'user' | 'flow' = 'system',
    metadata?: any,
    relatedIds?: { sessionId?: string; flowId?: string; flowExecutionId?: string }
  ): Promise<void> {
    try {
      // Get actor name if agent
      let actorName: string | undefined;
      if (actorId && actorType === 'agent') {
        const { Agent } = await import('../database/models/Agent.js');
        const agent = await Agent.findById(actorId).select('name').lean();
        actorName = agent?.name;
      }

      await ContactActivity.create({
        user: new Types.ObjectId(contactId),
        type,
        description,
        actor: {
          type: actorType,
          id: actorId,
          name: actorName,
        },
        metadata,
        ...relatedIds,
      });
    } catch (error) {
      logger.error('contacts', { action: 'log_activity_failed', error: String(error) });
    }
  },

  /**
   * Get contact activity history
   */
  async getContactActivity(
    contactId: string,
    params: {
      page?: number;
      limit?: number;
      types?: ContactActivityType[];
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<{ activities: any[]; total: number }> {
    const { page = 1, limit = 50, types, dateFrom, dateTo } = params;

    const query: any = { user: new Types.ObjectId(contactId) };

    if (types?.length) {
      query.type = { $in: types };
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = dateFrom;
      if (dateTo) query.createdAt.$lte = dateTo;
    }

    const [activities, total] = await Promise.all([
      ContactActivity.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ContactActivity.countDocuments(query),
    ]);

    return { activities, total };
  },
};

/**
 * Segment Service
 * Dynamic contact segmentation with filter engine and caching
 */

import { Types, FilterQuery } from 'mongoose';
import {
  Segment,
  ISegment,
  IFilterGroup,
  User,
  IUser,
  UserTag,
  UserCustomField,
  CustomFieldDefinition,
} from '../database/models/index.js';
import { CacheKeys, CacheTTL, invalidate } from './cache.js';
import * as redis from './redis.js';
import { logger } from './logger.js';

// ==================== TYPES ====================

export interface SegmentListItem {
  _id: string;
  name: string;
  description?: string;
  color: string;
  contactCount: number;
  isActive: boolean;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SegmentWithContacts {
  segment: ISegment;
  contacts: IUser[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CreateSegmentParams {
  name: string;
  description?: string;
  color: string;
  filters: IFilterGroup;
  isActive?: boolean;
  isPinned?: boolean;
  createdBy: string;
}

export interface UpdateSegmentParams {
  name?: string;
  description?: string;
  color?: string;
  filters?: IFilterGroup;
  isActive?: boolean;
  isPinned?: boolean;
}

// ==================== CACHE KEYS ====================

const CACHE_KEYS = {
  segmentList: 'segments:list',
  segmentCount: (id: string) => `segment:count:${id}`,
  segmentContacts: (id: string, page: number) => `segment:contacts:${id}:${page}`,
};

const CACHE_TTL = {
  segmentList: 300, // 5 minutes
  segmentCount: 600, // 10 minutes
  segmentContacts: 120, // 2 minutes
};

// ==================== FILTER ENGINE ====================

/**
 * Build MongoDB aggregation pipeline for segment filters
 * This handles complex filters that require lookups (tags, custom fields, etc.)
 */
export function buildSegmentPipeline(filters: IFilterGroup): any[] {
  const pipeline: any[] = [];
  const matchConditions: any[] = [];

  // Process filter rules
  processFilterGroup(filters, matchConditions, pipeline);

  // Add initial match if there are simple conditions
  if (matchConditions.length > 0) {
    const logic = filters.logic === 'OR' ? '$or' : '$and';
    pipeline.unshift({ $match: { [logic]: matchConditions } });
  }

  return pipeline;
}

function processFilterGroup(group: IFilterGroup, conditions: any[], pipeline: any[]): void {
  for (const rule of group.rules || []) {
    const condition = processRule(rule, pipeline);
    if (condition) {
      conditions.push(condition);
    }
  }

  for (const nestedGroup of group.groups || []) {
    const nestedConditions: any[] = [];
    processFilterGroup(nestedGroup, nestedConditions, pipeline);

    if (nestedConditions.length > 0) {
      const nestedLogic = nestedGroup.logic === 'OR' ? '$or' : '$and';
      conditions.push({ [nestedLogic]: nestedConditions });
    }
  }
}

function processRule(rule: any, pipeline: any[]): any {
  const { field, operator, value, relativeDays, customFieldKey, flowId } = rule;

  switch (field) {
    // Simple user fields
    case 'language':
    case 'username':
    case 'firstName':
    case 'lastName':
      return buildOperatorCondition(field, operator, value);

    case 'isBlocked':
      return { isBlocked: value === 'true' || value === true };

    case 'createdAt':
    case 'lastActivity':
      return buildDateCondition(field, operator, value, relativeDays);

    // Complex fields requiring lookups
    case 'tags':
      // This will be handled in a separate lookup stage
      return buildTagCondition(operator, value, pipeline);

    case 'totalSessions':
      return buildSessionCountCondition(operator, value, pipeline);

    case 'totalMessages':
      return buildMessageCountCondition(operator, value, pipeline);

    case 'hasActiveSession':
      return buildActiveSessionCondition(value, pipeline);

    case 'customField':
      return buildCustomFieldCondition(customFieldKey, operator, value, pipeline);

    case 'executedFlow':
      return buildFlowExecutionCondition(flowId, operator, value, relativeDays, pipeline);

    default:
      logger.warn('segment', { action: 'unknown_filter_field', field });
      return null;
  }
}

function buildOperatorCondition(field: string, operator: string, value: any): any {
  switch (operator) {
    case 'equals':
      return { [field]: value };
    case 'not_equals':
      return { [field]: { $ne: value } };
    case 'contains':
      return { [field]: { $regex: value, $options: 'i' } };
    case 'not_contains':
      return { [field]: { $not: { $regex: value, $options: 'i' } } };
    case 'starts_with':
      return { [field]: { $regex: `^${value}`, $options: 'i' } };
    case 'ends_with':
      return { [field]: { $regex: `${value}$`, $options: 'i' } };
    case 'is_empty':
      return { $or: [{ [field]: { $exists: false } }, { [field]: null }, { [field]: '' }] };
    case 'is_not_empty':
      return { [field]: { $exists: true, $ne: null, $nin: ['', null] } };
    case 'greater_than':
      return { [field]: { $gt: parseFloat(value) } };
    case 'less_than':
      return { [field]: { $lt: parseFloat(value) } };
    case 'greater_or_equal':
      return { [field]: { $gte: parseFloat(value) } };
    case 'less_or_equal':
      return { [field]: { $lte: parseFloat(value) } };
    case 'in':
      return { [field]: { $in: Array.isArray(value) ? value : [value] } };
    case 'not_in':
      return { [field]: { $nin: Array.isArray(value) ? value : [value] } };
    default:
      return { [field]: value };
  }
}

function buildDateCondition(field: string, operator: string, value: any, relativeDays?: number): any {
  let targetDate: Date;

  if (relativeDays !== undefined) {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - relativeDays);
  } else if (value) {
    targetDate = new Date(value);
  } else {
    return null;
  }

  switch (operator) {
    case 'before':
      return { [field]: { $lt: targetDate } };
    case 'after':
      return { [field]: { $gt: targetDate } };
    case 'within_last':
      return { [field]: { $gte: targetDate } };
    case 'not_within_last':
      return { [field]: { $lt: targetDate } };
    case 'equals':
      // For date equals, match the whole day
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      return { [field]: { $gte: targetDate, $lt: nextDay } };
    default:
      return { [field]: { $gte: targetDate } };
  }
}

function buildTagCondition(operator: string, tagIds: string | string[], pipeline: any[]): any {
  // Add lookup for tags
  const tagIdArray = Array.isArray(tagIds) ? tagIds : [tagIds];
  const objectIds = tagIdArray.map((id) => new Types.ObjectId(id));

  pipeline.push({
    $lookup: {
      from: 'usertags',
      localField: '_id',
      foreignField: 'userId',
      as: '_userTags',
    },
  });

  switch (operator) {
    case 'has_any':
      return { '_userTags.tagId': { $in: objectIds } };
    case 'has_all':
      return { '_userTags.tagId': { $all: objectIds } };
    case 'has_none':
      return { '_userTags.tagId': { $nin: objectIds } };
    case 'is_empty':
      return { '_userTags': { $size: 0 } };
    case 'is_not_empty':
      return { '_userTags.0': { $exists: true } };
    default:
      return { '_userTags.tagId': { $in: objectIds } };
  }
}

function buildSessionCountCondition(operator: string, value: number, pipeline: any[]): any {
  pipeline.push({
    $lookup: {
      from: 'chatsessions',
      let: { telegramId: '$telegramId' },
      pipeline: [
        { $match: { $expr: { $eq: ['$telegramChatId', '$$telegramId'] } } },
        { $count: 'count' },
      ],
      as: '_sessionCount',
    },
  });

  pipeline.push({
    $addFields: {
      _totalSessions: { $ifNull: [{ $arrayElemAt: ['$_sessionCount.count', 0] }, 0] },
    },
  });

  return buildOperatorCondition('_totalSessions', operator, value);
}

function buildMessageCountCondition(operator: string, value: number, pipeline: any[]): any {
  pipeline.push({
    $lookup: {
      from: 'messages',
      let: { telegramId: '$telegramId' },
      pipeline: [
        { $match: { $expr: { $eq: ['$telegramChatId', '$$telegramId'] } } },
        { $count: 'count' },
      ],
      as: '_messageCount',
    },
  });

  pipeline.push({
    $addFields: {
      _totalMessages: { $ifNull: [{ $arrayElemAt: ['$_messageCount.count', 0] }, 0] },
    },
  });

  return buildOperatorCondition('_totalMessages', operator, value);
}

function buildActiveSessionCondition(hasActive: boolean, pipeline: any[]): any {
  pipeline.push({
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
        { $limit: 1 },
      ],
      as: '_activeSession',
    },
  });

  if (hasActive) {
    return { '_activeSession.0': { $exists: true } };
  } else {
    return { '_activeSession': { $size: 0 } };
  }
}

function buildCustomFieldCondition(fieldKey: string, operator: string, value: any, pipeline: any[]): any {
  // First, we need to find the field definition
  pipeline.push({
    $lookup: {
      from: 'usercustomfields',
      let: { userId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$userId', '$$userId'] },
          },
        },
        {
          $lookup: {
            from: 'customfielddefinitions',
            localField: 'fieldId',
            foreignField: '_id',
            as: 'definition',
          },
        },
        { $unwind: '$definition' },
        { $match: { 'definition.key': fieldKey } },
      ],
      as: '_customField',
    },
  });

  pipeline.push({
    $addFields: {
      [`_cf_${fieldKey}`]: { $arrayElemAt: ['$_customField.value', 0] },
    },
  });

  return buildOperatorCondition(`_cf_${fieldKey}`, operator, value);
}

function buildFlowExecutionCondition(
  flowId: string,
  operator: string,
  status: string,
  relativeDays: number | undefined,
  pipeline: any[]
): any {
  const matchConditions: any = {
    $expr: { $eq: ['$telegramChatId', '$$telegramId'] },
  };

  if (flowId) {
    matchConditions.flowId = flowId;
  }

  if (status) {
    matchConditions.status = status;
  }

  if (relativeDays !== undefined) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - relativeDays);
    matchConditions.startedAt = { $gte: targetDate };
  }

  pipeline.push({
    $lookup: {
      from: 'flowexecutions',
      let: { telegramId: '$telegramId' },
      pipeline: [{ $match: matchConditions }, { $limit: 1 }],
      as: '_flowExecution',
    },
  });

  if (operator === 'has_executed') {
    return { '_flowExecution.0': { $exists: true } };
  } else if (operator === 'has_not_executed') {
    return { '_flowExecution': { $size: 0 } };
  }

  return null;
}

// ==================== MAIN SERVICE ====================

export const segmentService = {
  /**
   * Get all segments with contact counts
   */
  async listSegments(options: { includeInactive?: boolean } = {}): Promise<SegmentListItem[]> {
    const { includeInactive = false } = options;

    // Try cache
    const cacheKey = `${CACHE_KEYS.segmentList}:${includeInactive}`;
    const cached = await redis.getJSON<SegmentListItem[]>(cacheKey);
    if (cached) return cached;

    const query: any = {};
    if (!includeInactive) {
      query.isActive = true;
    }

    const segments = await Segment.find(query).sort({ isPinned: -1, name: 1 }).lean();

    // Get counts (from cache or calculate)
    const result: SegmentListItem[] = await Promise.all(
      segments.map(async (segment) => {
        const count = await this.getSegmentCount(segment._id.toString());
        return {
          _id: segment._id.toString(),
          name: segment.name,
          description: segment.description,
          color: segment.color,
          contactCount: count,
          isActive: segment.isActive,
          isPinned: segment.isPinned,
          createdAt: segment.createdAt,
          updatedAt: segment.updatedAt,
        };
      })
    );

    // Cache result
    await redis.setJSON(cacheKey, result, CACHE_TTL.segmentList);

    return result;
  },

  /**
   * Get segment by ID
   */
  async getSegment(segmentId: string): Promise<ISegment | null> {
    const segment = await Segment.findById(segmentId).lean();
    return segment as ISegment | null;
  },

  /**
   * Get segment contact count (cached)
   */
  async getSegmentCount(segmentId: string): Promise<number> {
    const cacheKey = CACHE_KEYS.segmentCount(segmentId);
    const cached = await redis.getJSON<number>(cacheKey);
    if (cached !== null) return cached;

    const segment = await Segment.findById(segmentId);
    if (!segment || !segment.filters) return 0;

    const pipeline = buildSegmentPipeline(segment.filters);
    pipeline.push({ $count: 'total' });

    const result = await User.aggregate(pipeline);
    const count = result[0]?.total || 0;

    // Update cached count in segment document
    await Segment.findByIdAndUpdate(segmentId, {
      cachedCount: count,
      cacheUpdatedAt: new Date(),
    });

    // Cache in Redis
    await redis.setJSON(cacheKey, count, CACHE_TTL.segmentCount);

    return count;
  },

  /**
   * Get contacts in segment with pagination
   */
  async getSegmentContacts(
    segmentId: string,
    params: { page?: number; limit?: number; sortField?: string; sortDirection?: 'asc' | 'desc' } = {}
  ): Promise<SegmentWithContacts> {
    const { page = 1, limit = 50, sortField = 'lastActivity', sortDirection = 'desc' } = params;

    const segment = await Segment.findById(segmentId);
    if (!segment) {
      throw new Error('Segment not found');
    }

    const pipeline = buildSegmentPipeline(segment.filters || { logic: 'AND', rules: [], groups: [] });

    // Add sort
    pipeline.push({ $sort: { [sortField]: sortDirection === 'desc' ? -1 : 1 } });

    // Add pagination with facet
    pipeline.push({
      $facet: {
        data: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    });

    const result = await User.aggregate(pipeline);
    const contacts = result[0]?.data || [];
    const total = result[0]?.total[0]?.count || 0;

    return {
      segment: segment.toObject(),
      contacts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Create new segment
   */
  async createSegment(params: CreateSegmentParams): Promise<ISegment> {
    const segment = await Segment.create({
      name: params.name,
      description: params.description,
      color: params.color,
      filters: params.filters,
      isActive: params.isActive ?? true,
      isPinned: params.isPinned ?? false,
      createdBy: new Types.ObjectId(params.createdBy),
    });

    // Calculate initial count
    await this.getSegmentCount(segment._id.toString());

    // Invalidate list cache
    await redis.del(CACHE_KEYS.segmentList);
    await redis.del(`${CACHE_KEYS.segmentList}:true`);
    await redis.del(`${CACHE_KEYS.segmentList}:false`);

    return segment.toObject();
  },

  /**
   * Update segment
   */
  async updateSegment(segmentId: string, updates: UpdateSegmentParams): Promise<ISegment | null> {
    const segment = await Segment.findByIdAndUpdate(segmentId, updates, { new: true });

    if (segment) {
      // Recalculate count if filters changed
      if (updates.filters) {
        await redis.del(CACHE_KEYS.segmentCount(segmentId));
        await this.getSegmentCount(segmentId);
      }

      // Invalidate caches
      await redis.del(CACHE_KEYS.segmentList);
      await redis.del(`${CACHE_KEYS.segmentList}:true`);
      await redis.del(`${CACHE_KEYS.segmentList}:false`);
    }

    return segment?.toObject() || null;
  },

  /**
   * Delete segment
   */
  async deleteSegment(segmentId: string): Promise<boolean> {
    const result = await Segment.findByIdAndDelete(segmentId);

    if (result) {
      await redis.del(CACHE_KEYS.segmentCount(segmentId));
      await redis.del(CACHE_KEYS.segmentList);
      await redis.del(`${CACHE_KEYS.segmentList}:true`);
      await redis.del(`${CACHE_KEYS.segmentList}:false`);
    }

    return !!result;
  },

  /**
   * Duplicate segment
   */
  async duplicateSegment(segmentId: string, createdBy: string): Promise<ISegment | null> {
    const original = await Segment.findById(segmentId);
    if (!original) return null;

    const duplicate = await Segment.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      color: original.color,
      filters: original.filters,
      isActive: false, // Start inactive
      isPinned: false,
      createdBy: new Types.ObjectId(createdBy),
    });

    await redis.del(CACHE_KEYS.segmentList);

    return duplicate.toObject();
  },

  /**
   * Preview segment (get count without saving)
   */
  async previewSegment(filters: IFilterGroup): Promise<{ count: number; sample: IUser[] }> {
    const pipeline = buildSegmentPipeline(filters);

    // Get count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await User.aggregate(countPipeline);
    const count = countResult[0]?.total || 0;

    // Get sample
    const samplePipeline = [...pipeline, { $limit: 10 }];
    const sample = await User.aggregate(samplePipeline);

    return { count, sample };
  },

  /**
   * Refresh all segment counts
   */
  async refreshAllCounts(): Promise<void> {
    const segments = await Segment.find({ isActive: true });

    for (const segment of segments) {
      await redis.del(CACHE_KEYS.segmentCount(segment._id.toString()));
      await this.getSegmentCount(segment._id.toString());
    }

    // Clear list cache
    await redis.del(CACHE_KEYS.segmentList);
    await redis.del(`${CACHE_KEYS.segmentList}:true`);
    await redis.del(`${CACHE_KEYS.segmentList}:false`);

    logger.info('segment', { action: 'refreshed_counts', count: segments.length });
  },

  /**
   * Get segments that a contact belongs to
   */
  async getContactSegments(contactId: string): Promise<SegmentListItem[]> {
    const user = await User.findById(contactId);
    if (!user) return [];

    const segments = await Segment.find({ isActive: true }).lean();
    const matchingSegments: SegmentListItem[] = [];

    for (const segment of segments) {
      if (segment.filters) {
        const pipeline = buildSegmentPipeline(segment.filters);
        pipeline.unshift({ $match: { _id: new Types.ObjectId(contactId) } });
        pipeline.push({ $count: 'total' });

        const result = await User.aggregate(pipeline);
        if (result[0]?.total > 0) {
          matchingSegments.push({
            _id: segment._id.toString(),
            name: segment.name,
            description: segment.description,
            color: segment.color,
            contactCount: segment.cachedCount || 0,
            isActive: segment.isActive,
            isPinned: segment.isPinned,
            createdAt: segment.createdAt,
            updatedAt: segment.updatedAt,
          });
        }
      }
    }

    return matchingSegments;
  },
};

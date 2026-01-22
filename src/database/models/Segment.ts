/**
 * Segment Model - Dynamic contact segments for targeting
 * Supports complex filter rules for segmenting contacts
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============= FILTER TYPES =============

export type FilterOperator = 
  | 'equals' 
  | 'not_equals' 
  | 'contains' 
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than' 
  | 'less_than' 
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'is_empty' 
  | 'is_not_empty'
  | 'in'
  | 'not_in'
  | 'before'  // For dates
  | 'after'   // For dates
  | 'within_last' // For relative dates (days)
  | 'not_within_last';

export type FilterField = 
  // User fields
  | 'language'
  | 'username'
  | 'firstName'
  | 'lastName'
  | 'isBlocked'
  | 'isSubscriber'
  | 'createdAt'
  | 'lastActivity'
  // Session fields
  | 'lastSessionStatus'
  | 'lastSessionCategory'
  | 'totalSessions'
  // Engagement
  | 'totalMessages'
  | 'daysSinceLastActivity'
  | 'averageResponseTime'
  // Tags
  | 'hasTag'
  | 'hasAnyTag'
  | 'hasAllTags'
  | 'tags' // Alias for hasTag
  // Custom fields
  | 'customField'
  // Flow execution
  | 'executedFlow'
  | 'completedFlow'
  // Survey
  | 'surveyRating'
  | 'hasSurveyResponse'
  // Sessions
  | 'hasActiveSession';

export interface IFilterRule {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string | number | boolean | string[] | null;
  // For custom fields
  customFieldKey?: string;
  // For flow references
  flowId?: string;
  // For relative date calculations
  relativeDays?: number;
}

export type FilterLogic = 'AND' | 'OR';

export interface IFilterGroup {
  id: string;
  logic: FilterLogic;
  rules: IFilterRule[];
  groups?: IFilterGroup[]; // Nested groups for complex logic
}

// ============= SEGMENT INTERFACE =============

export interface ISegment extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  // Filter configuration
  filterLogic: FilterLogic;
  filters: IFilterGroup;
  // Cached count
  cachedCount: number;
  lastCountUpdate: Date;
  // Usage
  isActive: boolean;
  isPinned: boolean;
  usageCount: number;
  // Audit
  createdBy: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ============= SCHEMA =============

const FilterRuleSchema = new Schema<IFilterRule>(
  {
    id: { type: String, required: true },
    field: { type: String, required: true },
    operator: { type: String, required: true },
    value: Schema.Types.Mixed,
    customFieldKey: String,
    flowId: String,
    relativeDays: Number,
  },
  { _id: false }
);

const FilterGroupSchema = new Schema<IFilterGroup>(
  {
    id: { type: String, required: true },
    logic: { type: String, enum: ['AND', 'OR'], default: 'AND' },
    rules: [FilterRuleSchema],
  },
  { _id: false }
);

// Allow nested groups
FilterGroupSchema.add({
  groups: [FilterGroupSchema],
});

const SegmentSchema = new Schema<ISegment>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    color: {
      type: String,
      default: '#6366f1',
      match: /^#[0-9A-Fa-f]{6}$/,
    },
    icon: {
      type: String,
      default: 'users',
    },
    filterLogic: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND',
    },
    filters: {
      type: FilterGroupSchema,
      required: true,
    },
    cachedCount: {
      type: Number,
      default: 0,
    },
    lastCountUpdate: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SegmentSchema.index({ name: 'text', description: 'text' });
SegmentSchema.index({ isActive: 1, isPinned: -1, name: 1 });

export const Segment = mongoose.model<ISegment>('Segment', SegmentSchema);

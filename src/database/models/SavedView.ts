/**
 * SavedView Model - Saved filter/column configurations for contacts list
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IColumnConfig {
  id: string;
  visible: boolean;
  width?: number;
  order: number;
}

export interface ISavedView extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  // Filter configuration (same as segment filters)
  filters?: any;
  // Column configuration
  columns: IColumnConfig[];
  // Sort configuration
  sortField: string;
  sortDirection: 'asc' | 'desc';
  // Ownership
  isGlobal: boolean; // Available to all agents
  createdBy: Types.ObjectId;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ColumnConfigSchema = new Schema<IColumnConfig>(
  {
    id: { type: String, required: true },
    visible: { type: Boolean, default: true },
    width: Number,
    order: { type: Number, default: 0 },
  },
  { _id: false }
);

const SavedViewSchema = new Schema<ISavedView>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 300,
    },
    filters: Schema.Types.Mixed,
    columns: [ColumnConfigSchema],
    sortField: {
      type: String,
      default: 'lastActivity',
    },
    sortDirection: {
      type: String,
      enum: ['asc', 'desc'],
      default: 'desc',
    },
    isGlobal: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SavedViewSchema.index({ createdBy: 1, name: 1 });
SavedViewSchema.index({ isGlobal: 1 });

export const SavedView = mongoose.model<ISavedView>('SavedView', SavedViewSchema);

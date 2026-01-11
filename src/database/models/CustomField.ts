/**
 * CustomField Model - Custom fields configuration and user values
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Field type definitions
export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'url' | 'email';

// Field definition (schema)
export interface ICustomFieldDefinition extends Document {
  name: string;
  key: string; // Unique identifier for the field (slug)
  type: CustomFieldType;
  description?: string;
  required: boolean;
  options?: string[]; // For 'select' type
  defaultValue?: string | number | boolean;
  order: number; // Display order
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CustomFieldDefinitionSchema = new Schema<ICustomFieldDefinition>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_]+$/,
    },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'boolean', 'select', 'url', 'email'],
      required: true,
      default: 'text',
    },
    description: {
      type: String,
      maxlength: 500,
    },
    required: {
      type: Boolean,
      default: false,
    },
    options: [{
      type: String,
      trim: true,
    }],
    defaultValue: Schema.Types.Mixed,
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
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

CustomFieldDefinitionSchema.index({ key: 1 });
CustomFieldDefinitionSchema.index({ isActive: 1, order: 1 });

// User custom field values
export interface IUserCustomField extends Document {
  user: Types.ObjectId;
  field: Types.ObjectId; // Reference to CustomFieldDefinition
  value: string | number | boolean | Date;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const UserCustomFieldSchema = new Schema<IUserCustomField>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    field: {
      type: Schema.Types.ObjectId,
      ref: 'CustomFieldDefinition',
      required: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: one value per user per field
UserCustomFieldSchema.index({ user: 1, field: 1 }, { unique: true });

export const CustomFieldDefinition = mongoose.model<ICustomFieldDefinition>(
  'CustomFieldDefinition',
  CustomFieldDefinitionSchema
);

export const UserCustomField = mongoose.model<IUserCustomField>(
  'UserCustomField',
  UserCustomFieldSchema
);

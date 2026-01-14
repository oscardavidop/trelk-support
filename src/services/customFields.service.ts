/**
 * Custom Fields Service
 * CRUD for field definitions and user field values
 * 
 * Now with Redis caching for acceleration:
 * - CustomFieldDefinitions: Read-through cache (2h TTL)
 * - UserCustomFields: Write-behind to MongoDB
 */

import { CustomFieldDefinition, UserCustomField, type CustomFieldType } from '../database/index.js';
import mongoose from 'mongoose';
import { CustomFieldDefinitionCache, UserCustomFieldsCache } from './cache-models.service.js';

export interface FieldDefinition {
  id: string;
  name: string;
  key: string;
  type: CustomFieldType;
  description?: string;
  required: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
  order: number;
  isActive: boolean;
}

export interface UserFieldValue {
  fieldId: string;
  key: string;
  name: string;
  type: CustomFieldType;
  value: string | number | boolean | Date | null;
}

export interface CreateFieldInput {
  name: string;
  key: string;
  type: CustomFieldType;
  description?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
  order?: number;
  agentId: string;
}

// ============= FIELD DEFINITIONS =============

/**
 * Get all field definitions (cached)
 */
export async function getAllFieldDefinitions(activeOnly = true): Promise<FieldDefinition[]> {
  // Use cached version
  const fields = await CustomFieldDefinitionCache.getAll(activeOnly);

  return fields.map(f => ({
    id: f._id?.toString?.() || f._id,
    name: f.name,
    key: f.key,
    type: f.type,
    description: f.description,
    required: f.required,
    options: f.options,
    defaultValue: f.defaultValue as string | number | boolean | undefined,
    order: f.order,
    isActive: f.isActive,
  }));
}

/**
 * Create a new field definition
 */
export async function createFieldDefinition(input: CreateFieldInput): Promise<FieldDefinition> {
  const field = await CustomFieldDefinition.create({
    name: input.name,
    key: input.key.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    type: input.type,
    description: input.description,
    required: input.required || false,
    options: input.options,
    defaultValue: input.defaultValue,
    order: input.order || 0,
    createdBy: new mongoose.Types.ObjectId(input.agentId),
  });

  // Invalidate cache
  await CustomFieldDefinitionCache.invalidateAll();

  return {
    id: field._id!.toString(),
    name: field.name,
    key: field.key,
    type: field.type,
    description: field.description,
    required: field.required,
    options: field.options,
    defaultValue: field.defaultValue as string | number | boolean | undefined,
    order: field.order,
    isActive: field.isActive,
  };
}

/**
 * Update a field definition
 */
export async function updateFieldDefinition(
  fieldId: string,
  updates: Partial<Omit<CreateFieldInput, 'agentId' | 'key'>>
): Promise<FieldDefinition | null> {
  const field = await CustomFieldDefinition.findByIdAndUpdate(fieldId, updates, { new: true });
  if (!field) return null;

  // Invalidate cache
  await CustomFieldDefinitionCache.invalidate(fieldId, field.key);

  return {
    id: field._id!.toString(),
    name: field.name,
    key: field.key,
    type: field.type,
    description: field.description,
    required: field.required,
    options: field.options,
    defaultValue: field.defaultValue as string | number | boolean | undefined,
    order: field.order,
    isActive: field.isActive,
  };
}

/**
 * Delete (soft) a field definition
 */
export async function deleteFieldDefinition(fieldId: string): Promise<boolean> {
  const field = await CustomFieldDefinition.findByIdAndUpdate(fieldId, { isActive: false });
  if (field) {
    // Invalidate cache
    await CustomFieldDefinitionCache.invalidate(fieldId, field.key);
  }
  return !!field;
}

// ============= USER FIELD VALUES =============

/**
 * Get all custom field values for a user
 */
export async function getUserFieldValues(userId: string): Promise<UserFieldValue[]> {
  const [fields, values] = await Promise.all([
    CustomFieldDefinition.find({ isActive: true }).sort({ order: 1 }),
    UserCustomField.find({ user: userId }),
  ]);

  const valueMap = new Map(
    values.map(v => [(v.field as any).toString(), v.value])
  );

  return fields.map(f => ({
    fieldId: f._id!.toString(),
    key: f.key,
    name: f.name,
    type: f.type,
    value: valueMap.get(f._id!.toString()) ?? null,
  }));
}

/**
 * Set a custom field value for a user
 */
export async function setUserFieldValue(
  userId: string,
  fieldId: string,
  value: string | number | boolean | Date,
  agentId: string
): Promise<boolean> {
  await UserCustomField.findOneAndUpdate(
    {
      user: new mongoose.Types.ObjectId(userId),
      field: new mongoose.Types.ObjectId(fieldId),
    },
    {
      value,
      updatedBy: new mongoose.Types.ObjectId(agentId),
    },
    { upsert: true, new: true }
  );

  return true;
}

/**
 * Clear a custom field value for a user
 */
export async function clearUserFieldValue(userId: string, fieldId: string): Promise<boolean> {
  const result = await UserCustomField.deleteOne({
    user: new mongoose.Types.ObjectId(userId),
    field: new mongoose.Types.ObjectId(fieldId),
  });

  return result.deletedCount > 0;
}

/**
 * Set a custom field value by field KEY (for automations/flows)
 * Creates the field definition if it doesn't exist
 */
export async function setUserFieldByKey(
  userId: string,
  fieldKey: string,
  value: string | number | boolean | Date,
  systemAgentId?: string
): Promise<boolean> {
  // Find field definition from cache
  let fieldDef = await CustomFieldDefinitionCache.getByKey(fieldKey.toLowerCase());
  
  if (!fieldDef) {
    // Auto-create the field definition
    const type: CustomFieldType = 
      typeof value === 'number' ? 'number' :
      typeof value === 'boolean' ? 'boolean' :
      value instanceof Date ? 'date' : 'text';
    
    const newField = await CustomFieldDefinition.create({
      name: fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), // Convert key to title
      key: fieldKey.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      type,
      required: false,
      order: 999,
      isActive: true,
      createdBy: systemAgentId ? new mongoose.Types.ObjectId(systemAgentId) : new mongoose.Types.ObjectId('000000000000000000000000'),
    });
    
    // Invalidate cache after creation
    await CustomFieldDefinitionCache.invalidateAll();
    fieldDef = { _id: newField._id!.toString() };
  }

  // Set the value via write-behind cache
  const agentId = systemAgentId || '000000000000000000000000';
  await UserCustomFieldsCache.set(userId, fieldDef._id, value, agentId);

  return true;
}

/**
 * Get a custom field value by key (cached)
 */
export async function getUserFieldByKey(
  userId: string,
  fieldKey: string
): Promise<string | number | boolean | Date | null> {
  // Get field definition from cache
  const fieldDef = await CustomFieldDefinitionCache.getByKey(fieldKey.toLowerCase());
  if (!fieldDef) return null;

  const userField = await UserCustomField.findOne({
    user: new mongoose.Types.ObjectId(userId),
    field: new mongoose.Types.ObjectId(fieldDef._id),
  });

  return userField?.value ?? null;
}

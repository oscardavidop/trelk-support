/**
 * Tags Service
 * CRUD operations for tags and user-tag assignments
 */

import { Tag, ITag, UserTag } from '../database/index.js';
import mongoose from 'mongoose';

export interface TagInfo {
  id: string;
  name: string;
  color: string;
  description?: string;
  usageCount: number;
}

export interface CreateTagInput {
  name: string;
  color: string;
  description?: string;
  agentId: string;
}

// ============= TAG CRUD =============

/**
 * Get all tags
 */
export async function getAllTags(): Promise<TagInfo[]> {
  const tags = await Tag.find().sort({ name: 1 });
  return tags.map(t => ({
    id: t._id!.toString(),
    name: t.name,
    color: t.color,
    description: t.description,
    usageCount: t.usageCount,
  }));
}

/**
 * Create a new tag
 */
export async function createTag(input: CreateTagInput): Promise<TagInfo> {
  const tag = await Tag.create({
    name: input.name,
    color: input.color,
    description: input.description,
    createdBy: new mongoose.Types.ObjectId(input.agentId),
  });

  return {
    id: tag._id!.toString(),
    name: tag.name,
    color: tag.color,
    description: tag.description,
    usageCount: 0,
  };
}

/**
 * Update a tag
 */
export async function updateTag(tagId: string, updates: Partial<Pick<CreateTagInput, 'name' | 'color' | 'description'>>): Promise<TagInfo | null> {
  const tag = await Tag.findByIdAndUpdate(tagId, updates, { new: true });
  if (!tag) return null;

  return {
    id: tag._id!.toString(),
    name: tag.name,
    color: tag.color,
    description: tag.description,
    usageCount: tag.usageCount,
  };
}

/**
 * Delete a tag (also removes all user associations)
 */
export async function deleteTag(tagId: string): Promise<boolean> {
  await UserTag.deleteMany({ tag: tagId });
  const result = await Tag.deleteOne({ _id: tagId });
  return result.deletedCount > 0;
}

/**
 * Search tags by name
 */
export async function searchTags(query: string): Promise<TagInfo[]> {
  const tags = await Tag.find({
    name: { $regex: query, $options: 'i' },
  }).limit(20);

  return tags.map(t => ({
    id: t._id!.toString(),
    name: t.name,
    color: t.color,
    description: t.description,
    usageCount: t.usageCount,
  }));
}

// ============= USER TAG ASSIGNMENTS =============

/**
 * Get tags for a user
 */
export async function getUserTags(userId: string): Promise<TagInfo[]> {
  const userTags = await UserTag.find({ user: userId }).populate('tag');
  
  return userTags
    .filter(ut => ut.tag) // Filter out deleted tags
    .map(ut => {
      const tag = ut.tag as any;
      return {
        id: tag._id.toString(),
        name: tag.name,
        color: tag.color,
        description: tag.description,
        usageCount: tag.usageCount,
      };
    });
}

/**
 * Add tag to user
 */
export async function addTagToUser(userId: string, tagId: string, agentId: string): Promise<boolean> {
  try {
    await UserTag.create({
      user: new mongoose.Types.ObjectId(userId),
      tag: new mongoose.Types.ObjectId(tagId),
      addedBy: new mongoose.Types.ObjectId(agentId),
    });

    // Increment usage count
    await Tag.findByIdAndUpdate(tagId, { $inc: { usageCount: 1 } });

    return true;
  } catch (error: any) {
    // Duplicate key = already assigned
    if (error.code === 11000) {
      return false;
    }
    throw error;
  }
}

/**
 * Remove tag from user
 */
export async function removeTagFromUser(userId: string, tagId: string): Promise<boolean> {
  const result = await UserTag.deleteOne({
    user: new mongoose.Types.ObjectId(userId),
    tag: new mongoose.Types.ObjectId(tagId),
  });

  if (result.deletedCount > 0) {
    // Decrement usage count
    await Tag.findByIdAndUpdate(tagId, { $inc: { usageCount: -1 } });
    return true;
  }

  return false;
}

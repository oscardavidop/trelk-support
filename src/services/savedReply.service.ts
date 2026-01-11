/**
 * Saved Replies Service
 * Manages quick reply templates for agents
 */

import { SavedReply, type ISavedReply } from '../database/index.js';
import type { Types } from 'mongoose';
import { logger } from './logger.js';

// ============= PLACEHOLDERS =============

export interface PlaceholderContext {
  agentName?: string;
  userName?: string;
  userUsername?: string;
  chatId?: string;
  sessionId?: string;
}

/**
 * Available placeholder variables
 */
export const PLACEHOLDERS = {
  '{agentName}': 'Name of the support agent',
  '{userName}': 'User\'s first name',
  '{userUsername}': 'User\'s Telegram username',
  '{chatId}': 'Current chat ID',
  '{sessionId}': 'Current session ID',
  '{date}': 'Current date (YYYY-MM-DD)',
  '{time}': 'Current time (HH:MM)',
} as const;

/**
 * Replace placeholders in a message
 */
export function replacePlaceholders(content: string, context: PlaceholderContext): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0, 5);
  
  let result = content;
  
  result = result.replace(/\{agentName\}/g, context.agentName || 'Agent');
  result = result.replace(/\{userName\}/g, context.userName || 'User');
  result = result.replace(/\{userUsername\}/g, context.userUsername ? `@${context.userUsername}` : 'N/A');
  result = result.replace(/\{chatId\}/g, context.chatId || 'N/A');
  result = result.replace(/\{sessionId\}/g, context.sessionId || 'N/A');
  result = result.replace(/\{date\}/g, dateStr);
  result = result.replace(/\{time\}/g, timeStr);
  
  return result;
}

// ============= CRUD OPERATIONS =============

/**
 * Get all saved replies
 */
export async function getAllSavedReplies(includeInactive = false): Promise<ISavedReply[]> {
  const filter = includeInactive ? {} : { isActive: true };
  return SavedReply.find(filter)
    .populate('createdBy', 'name')
    .sort({ category: 1, title: 1 });
}

/**
 * Get saved replies by category
 */
export async function getSavedRepliesByCategory(category: string): Promise<ISavedReply[]> {
  return SavedReply.find({ category, isActive: true })
    .sort({ usageCount: -1, title: 1 });
}

/**
 * Get all categories
 */
export async function getCategories(): Promise<string[]> {
  const categories = await SavedReply.distinct('category', { isActive: true });
  return categories.filter((c): c is string => c !== null && c !== undefined);
}

/**
 * Search saved replies
 */
export async function searchSavedReplies(query: string): Promise<ISavedReply[]> {
  const searchRegex = new RegExp(query, 'i');
  return SavedReply.find({
    isActive: true,
    $or: [
      { title: searchRegex },
      { content: searchRegex },
      { shortcut: searchRegex },
    ],
  })
    .sort({ usageCount: -1 })
    .limit(10);
}

/**
 * Get saved reply by ID
 */
export async function getSavedReplyById(id: string): Promise<ISavedReply | null> {
  return SavedReply.findById(id);
}

/**
 * Get saved reply by shortcut
 */
export async function getSavedReplyByShortcut(shortcut: string): Promise<ISavedReply | null> {
  return SavedReply.findOne({ shortcut, isActive: true });
}

/**
 * Create saved reply
 */
export async function createSavedReply(
  data: {
    title: string;
    content: string;
    category?: string;
    shortcut?: string;
    isActive?: boolean;
  },
  createdBy?: string
): Promise<ISavedReply> {
  const reply = await SavedReply.create({
    ...data,
    createdBy: createdBy ? createdBy : undefined,
  });
  
  logger.info('saved_reply', { action: 'created', replyId: reply._id.toString() });
  
  return reply;
}

/**
 * Update saved reply
 */
export async function updateSavedReply(
  id: string,
  data: Partial<{
    title: string;
    content: string;
    category: string;
    shortcut: string;
    isActive: boolean;
  }>,
  updatedBy?: string
): Promise<ISavedReply | null> {
  const reply = await SavedReply.findByIdAndUpdate(
    id,
    {
      ...data,
      updatedBy: updatedBy ? updatedBy : undefined,
    },
    { new: true }
  );
  
  if (reply) {
    logger.info('saved_reply', { action: 'updated', replyId: id });
  }
  
  return reply;
}

/**
 * Delete saved reply
 */
export async function deleteSavedReply(id: string): Promise<boolean> {
  const result = await SavedReply.findByIdAndDelete(id);
  
  if (result) {
    logger.info('saved_reply', { action: 'deleted', replyId: id });
    return true;
  }
  
  return false;
}

/**
 * Increment usage count
 */
export async function incrementUsageCount(id: string): Promise<void> {
  await SavedReply.findByIdAndUpdate(id, { $inc: { usageCount: 1 } });
}

/**
 * Get usage statistics
 */
export async function getUsageStats(): Promise<{
  totalReplies: number;
  activeReplies: number;
  totalUsage: number;
  topReplies: { title: string; usageCount: number }[];
}> {
  const [total, active, usageAgg, topReplies] = await Promise.all([
    SavedReply.countDocuments(),
    SavedReply.countDocuments({ isActive: true }),
    SavedReply.aggregate([
      { $group: { _id: null, total: { $sum: '$usageCount' } } },
    ]),
    SavedReply.find({ isActive: true })
      .select('title usageCount')
      .sort({ usageCount: -1 })
      .limit(5),
  ]);
  
  return {
    totalReplies: total,
    activeReplies: active,
    totalUsage: usageAgg[0]?.total || 0,
    topReplies: topReplies.map(r => ({ title: r.title, usageCount: r.usageCount })),
  };
}

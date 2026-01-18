/**
 * User Database Service
 * Handles user CRUD operations with MongoDB
 */

import { User, type IUser } from '../database/index.js';
import type { TelegramUser, Language } from '../types/index.js';
import { getUserProfilePhotos } from './telegram.js';

/**
 * Get or create user from Telegram data
 */
export async function getOrCreateUser(telegramUser: TelegramUser, chatId: number): Promise<IUser> {
  const existingUser = await User.findOne({ telegramId: telegramUser.id });
  
  if (existingUser) {
    // Update last activity and any changed fields
    existingUser.lastActivity = new Date();
    if (telegramUser.username && telegramUser.username !== existingUser.username) {
      existingUser.username = telegramUser.username;
    }
    if (telegramUser.first_name !== existingUser.firstName) {
      existingUser.firstName = telegramUser.first_name;
    }
    if (telegramUser.last_name !== existingUser.lastName) {
      existingUser.lastName = telegramUser.last_name;
    }
    await existingUser.save();
    return existingUser;
  }
  
  // Detect language from Telegram settings
  const language: Language = telegramUser.language_code?.startsWith('es') ? 'es' : 'en';
  
  const newUser = await User.create({
    telegramId: telegramUser.id,
    username: telegramUser.username,
    firstName: telegramUser.first_name,
    lastName: telegramUser.last_name,
    language,
    photoFileId: await getTelegramPhoto(telegramUser.id)
  });
  
  return newUser;
}

export async function getTelegramPhoto(telegramId: number): Promise<string | null> {
  const photos = await getUserProfilePhotos(telegramId);
  if (photos && photos.total_count > 0 && photos.photos[0].length > 0) {
    const photo = photos.photos[0][0]; // Get the smallest size
    return photo.file_id;
  }
  return null;
}

/**
 * Update user language preference
 */
export async function updateUserLanguage(telegramId: number, language: Language): Promise<void> {
  await User.updateOne({ telegramId }, { language, lastActivity: new Date() });
}

/**
 * Get user by Telegram ID
 */
export async function getUserByTelegramId(telegramId: number): Promise<IUser | null> {
  return User.findOne({ telegramId });
}

/**
 * Get user by MongoDB ObjectId
 */
export async function getUserById(userId: string): Promise<IUser | null> {
  return User.findById(userId);
}

/**
 * Get total user count
 */
export async function getUserCount(): Promise<number> {
  return User.countDocuments();
}

/**
 * Get recent users
 */
export async function getRecentUsers(limit = 10): Promise<IUser[]> {
  return User.find()
    .sort({ lastActivity: -1 })
    .limit(limit);
}

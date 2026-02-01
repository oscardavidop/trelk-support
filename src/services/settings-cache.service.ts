/**
 * Settings Cache Service
 * High-performance settings access with Redis caching
 * Provides real-time settings for all system components
 */

import { getRedisClient } from './redis.js';
import { Settings, type ISettings, type IBotSettings, type IChatSettings, type IAgentRules, type ISecuritySettings, type INotificationSettings } from '../database/index.js';
import { logger } from './logger.js';
import { getIO } from './socket.js';

// ============= CONFIGURATION =============

const CACHE_KEY = 'settings:main';
const CACHE_TTL = 300; // 5 minutes

// ============= CACHED SETTINGS =============

// In-memory fallback cache (when Redis unavailable)
let memoryCache: ISettings | null = null;
let memoryCacheTime = 0;
const MEMORY_CACHE_TTL = 60000; // 1 minute for memory fallback

// ============= MAIN FUNCTIONS =============

/**
 * Get all settings (with multi-layer caching)
 * Priority: Redis -> Memory -> Database
 */
export async function getCachedSettings(): Promise<ISettings> {
  const redis = getRedisClient();
  
  // Try Redis cache first
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Also update memory cache
        memoryCache = parsed as ISettings;
        memoryCacheTime = Date.now();
        return parsed as ISettings;
      }
    } catch (error) {
      logger.warn('settings-cache', { message: 'Redis cache read failed', error: String(error) });
    }
  }
  
  // Try memory cache
  if (memoryCache && (Date.now() - memoryCacheTime) < MEMORY_CACHE_TTL) {
    return memoryCache;
  }
  
  // Fallback to database
  const settings = await loadSettingsFromDB();
  return settings;
}

/**
 * Get specific settings section (cached)
 */
export async function getBotSettings(): Promise<IBotSettings> {
  const settings = await getCachedSettings();
  return settings.bot;
}

export async function getChatSettings(): Promise<IChatSettings> {
  const settings = await getCachedSettings();
  return settings.chat;
}

export async function getAgentRules(): Promise<IAgentRules> {
  const settings = await getCachedSettings();
  return settings.agentRules;
}

export async function getSecuritySettings(): Promise<ISecuritySettings> {
  const settings = await getCachedSettings();
  return settings.security;
}

export async function getNotificationSettings(): Promise<INotificationSettings> {
  const settings = await getCachedSettings();
  return settings.notifications;
}

// ============= SPECIFIC SETTING GETTERS =============

/**
 * File upload settings
 */
export async function getFileUploadSettings(): Promise<{
  enabled: boolean;
  maxSizeMB: number;
  allowedTypes: string[];
}> {
  const settings = await getChatSettings();
  return {
    enabled: settings.enableFileSharing,
    maxSizeMB: settings.maxFileSizeMB,
    allowedTypes: settings.allowedFileTypes,
  };
}

/**
 * Queue settings
 */
export async function getQueueSettings(): Promise<{
  maxSize: number;
  maxWaitMinutes: number;
  inactivityMinutes: number;
}> {
  const settings = await getChatSettings();
  return {
    maxSize: settings.maxQueueSize,
    maxWaitMinutes: settings.maxWaitTimeMinutes,
    inactivityMinutes: settings.autoCloseInactiveMinutes,
  };
}

/**
 * Auto-assignment settings
 */
export async function getAssignmentSettings(): Promise<{
  autoAssign: boolean;
  mode: 'round-robin' | 'manual' | 'least-busy';
  maxChatsPerAgent: number;
  skillBased: boolean;
  priorityRouting: boolean;
}> {
  const rules = await getAgentRules();
  return {
    autoAssign: rules.autoAssignEnabled,
    mode: rules.assignmentMode,
    maxChatsPerAgent: rules.maxConcurrentChats,
    skillBased: rules.skillBasedRouting,
    priorityRouting: rules.priorityRouting,
  };
}

/**
 * Working hours settings
 */
export async function getWorkingHoursSettings(): Promise<{
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
}> {
  const rules = await getAgentRules();
  return {
    enabled: rules.workingHoursEnabled,
    start: rules.workingHoursStart,
    end: rules.workingHoursEnd,
    timezone: rules.workingHoursTimezone,
  };
}

/**
 * Check if within working hours
 */
export async function isWithinWorkingHours(): Promise<boolean> {
  const settings = await getWorkingHoursSettings();
  
  if (!settings.enabled) {
    return true; // No restrictions if disabled
  }
  
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: settings.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    
    const currentTime = formatter.format(now);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;
    
    const [startHour, startMinute] = settings.start.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    
    const [endHour, endMinute] = settings.end.split(':').map(Number);
    const endMinutes = endHour * 60 + endMinute;
    
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch (error) {
    logger.warn('settings-cache', { message: 'Error checking working hours', error: String(error) });
    return true; // Default to available on error
  }
}

/**
 * Sound notification settings
 */
export async function getSoundSettings(): Promise<{
  newChatSound: boolean;
  newMessageSound: boolean;
  volume: number;
}> {
  const settings = await getNotificationSettings();
  return {
    newChatSound: settings.newChatSoundEnabled,
    newMessageSound: settings.newMessageSoundEnabled,
    volume: settings.notificationVolume,
  };
}

/**
 * Auto-reply settings
 */
export async function getAutoReplySettings(): Promise<{
  enabled: boolean;
  delay: number;
  typingIndicator: boolean;
  welcomeMessage: string;
  offlineMessage: string;
}> {
  const bot = await getBotSettings();
  return {
    enabled: bot.autoReplyEnabled,
    delay: bot.autoReplyDelay,
    typingIndicator: bot.typingIndicator,
    welcomeMessage: bot.welcomeMessage,
    offlineMessage: bot.offlineMessage,
  };
}

// ============= UPDATE FUNCTIONS =============

/**
 * Update settings and invalidate cache
 */
export async function updateSettings(
  data: {
    bot?: Partial<IBotSettings>;
    chat?: Partial<IChatSettings>;
    agents?: Partial<IAgentRules>;
    security?: Partial<ISecuritySettings>;
    notifications?: Partial<INotificationSettings>;
  },
  updatedBy?: string
): Promise<ISettings> {
  const updateData: Record<string, unknown> = {};
  
  // Map frontend keys to database keys
  if (data.bot) {
    // Map frontend bot settings to database format
    const botMapping: Record<string, string> = {
      botName: 'name',
      welcomeMessage: 'welcomeMessage',
      offlineMessage: 'offlineMessage',
      language: 'defaultLanguage',
      autoReplyEnabled: 'autoReplyEnabled',
      autoReplyDelay: 'autoReplyDelay',
      typingIndicator: 'typingIndicator',
    };
    
    for (const [key, value] of Object.entries(data.bot)) {
      if (value !== undefined) {
        const dbKey = botMapping[key] || key;
        updateData[`bot.${dbKey}`] = value;
      }
    }
  }
  
  if (data.chat) {
    // Map frontend chat settings
    const chatMapping: Record<string, string> = {
      maxQueueSize: 'maxQueueSize',
      queueTimeout: 'maxWaitTimeMinutes',
      inactivityTimeout: 'autoCloseInactiveMinutes',
      enableFileSharing: 'enableFileSharing',
      maxFileSize: 'maxFileSizeMB',
      allowedFileTypes: 'allowedFileTypes',
      enableEmoji: 'enableEmoji',
      enableSuggestions: 'enableSuggestions',
    };
    
    for (const [key, value] of Object.entries(data.chat)) {
      if (value !== undefined) {
        const dbKey = chatMapping[key] || key;
        // Convert seconds to minutes for timeout fields
        if (key === 'queueTimeout' || key === 'inactivityTimeout') {
          updateData[`chat.${dbKey}`] = Math.ceil((value as number) / 60);
        } else {
          updateData[`chat.${dbKey}`] = value;
        }
      }
    }
  }
  
  if (data.agents) {
    // Map frontend agent settings
    const agentMapping: Record<string, string> = {
      defaultMaxChats: 'maxConcurrentChats',
      autoAssign: 'autoAssignEnabled',
      roundRobinEnabled: 'assignmentMode', // Special handling
      skillBasedRouting: 'skillBasedRouting',
      priorityRouting: 'priorityRouting',
      workingHoursEnabled: 'workingHoursEnabled',
      workingHoursStart: 'workingHoursStart',
      workingHoursEnd: 'workingHoursEnd',
    };
    
    for (const [key, value] of Object.entries(data.agents)) {
      if (value !== undefined) {
        if (key === 'roundRobinEnabled') {
          // Convert boolean to assignment mode
          updateData['agentRules.assignmentMode'] = value ? 'round-robin' : 'manual';
        } else {
          const dbKey = agentMapping[key] || key;
          updateData[`agentRules.${dbKey}`] = value;
        }
      }
    }
  }
  
  if (data.security) {
    // Map frontend security settings
    const securityMapping: Record<string, string> = {
      sessionTimeout: 'sessionTimeoutMinutes',
      maxLoginAttempts: 'maxLoginAttempts',
      twoFactorEnabled: 'twoFactorEnabled',
      auditLogRetention: 'auditLogRetentionDays',
    };
    
    for (const [key, value] of Object.entries(data.security)) {
      if (value !== undefined) {
        // Handle nested passwordPolicy
        if (key === 'passwordPolicy' && typeof value === 'object' && !Array.isArray(value)) {
          const policy = value as Record<string, unknown>;
          if (policy.minLength !== undefined) updateData['security.passwordMinLength'] = policy.minLength;
          if (policy.requireUppercase !== undefined) updateData['security.passwordRequireUppercase'] = policy.requireUppercase;
          if (policy.requireNumbers !== undefined) updateData['security.passwordRequireNumbers'] = policy.requireNumbers;
          if (policy.requireSpecial !== undefined) updateData['security.passwordRequireSpecial'] = policy.requireSpecial;
        } else {
          const dbKey = securityMapping[key] || key;
          updateData[`security.${dbKey}`] = value;
        }
      }
    }
  }
  
  if (data.notifications) {
    // Map frontend notification settings
    const notifMapping: Record<string, string> = {
      emailNotifications: 'emailNotificationsEnabled',
      newChatSound: 'newChatSoundEnabled',
      newMessageSound: 'newMessageSoundEnabled',
      desktopNotifications: 'desktopNotificationsEnabled',
      escalationAlerts: 'escalationAlertsEnabled',
      dailyReportEmail: 'dailyReportEnabled',
    };
    
    for (const [key, value] of Object.entries(data.notifications)) {
      if (value !== undefined) {
        const dbKey = notifMapping[key] || key;
        updateData[`notifications.${dbKey}`] = value;
      }
    }
  }
  
  if (updatedBy) {
    updateData.updatedBy = updatedBy;
  }
  
  // Update in database
  const settings = await Settings.findOneAndUpdate(
    { key: 'main' },
    { $set: updateData },
    { new: true, upsert: true }
  );
  
  // Invalidate caches
  await invalidateCache();
  
  // Notify all connected clients of settings change
  broadcastSettingsUpdate(settings!);
  
  logger.info('settings-cache', { 
    action: 'settings_updated', 
    updatedBy,
    sections: Object.keys(data).filter(k => data[k as keyof typeof data]),
  });
  
  return settings!;
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(updatedBy?: string): Promise<ISettings> {
  await Settings.deleteOne({ key: 'main' });
  const settings = await Settings.create({ key: 'main', updatedBy });
  
  await invalidateCache();
  broadcastSettingsUpdate(settings);
  
  logger.info('settings-cache', { action: 'settings_reset', updatedBy });
  
  return settings;
}

// ============= CACHE MANAGEMENT =============

/**
 * Load settings from database and update caches
 */
async function loadSettingsFromDB(): Promise<ISettings> {
  const settingsDoc = await Settings.findOne({ key: 'main' }).lean<ISettings>();
  
  let settings: ISettings;
  if (!settingsDoc) {
    const created = await Settings.create({ key: 'main' });
    settings = created.toObject() as ISettings;
  } else {
    settings = settingsDoc;
  }
  
  // Update memory cache
  memoryCache = settings;
  memoryCacheTime = Date.now();
  
  // Update Redis cache
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(settings));
    } catch (error) {
      logger.warn('settings-cache', { message: 'Redis cache write failed', error: String(error) });
    }
  }
  
  return settings;
}

/**
 * Invalidate all caches
 */
export async function invalidateCache(): Promise<void> {
  // Clear memory cache
  memoryCache = null;
  memoryCacheTime = 0;
  
  // Clear Redis cache
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(CACHE_KEY);
    } catch (error) {
      logger.warn('settings-cache', { message: 'Redis cache delete failed', error: String(error) });
    }
  }
}

/**
 * Warm up cache on server start
 */
export async function warmupCache(): Promise<void> {
  try {
    await loadSettingsFromDB();
    logger.info('settings-cache', { message: 'Settings cache warmed up' });
  } catch (error) {
    logger.error('settings-cache', { message: 'Failed to warm up settings cache', error: String(error) });
  }
}

// ============= BROADCAST =============

/**
 * Notify all connected clients of settings change
 */
function broadcastSettingsUpdate(settings: ISettings): void {
  try {
    const io = getIO();
    if (io) {
      io.emit('settings:updated', {
        timestamp: new Date().toISOString(),
        settings: formatSettingsForClient(settings),
      });
    }
  } catch {
    // IO might not be initialized yet
  }
}

/**
 * Format settings for frontend
 */
function formatSettingsForClient(settings: ISettings): Record<string, unknown> {
  return {
    bot: {
      botName: settings.bot.name,
      welcomeMessage: settings.bot.welcomeMessage,
      offlineMessage: settings.bot.offlineMessage,
      language: settings.bot.defaultLanguage,
      autoReplyEnabled: settings.bot.autoReplyEnabled,
      autoReplyDelay: settings.bot.autoReplyDelay,
      typingIndicator: settings.bot.typingIndicator,
    },
    chat: {
      maxQueueSize: settings.chat.maxQueueSize,
      queueTimeout: settings.chat.maxWaitTimeMinutes * 60,
      inactivityTimeout: settings.chat.autoCloseInactiveMinutes * 60,
      enableFileSharing: settings.chat.enableFileSharing,
      maxFileSize: settings.chat.maxFileSizeMB,
      allowedFileTypes: settings.chat.allowedFileTypes,
      enableEmoji: settings.chat.enableEmoji,
      enableSuggestions: settings.chat.enableSuggestions,
    },
    agents: {
      defaultMaxChats: settings.agentRules.maxConcurrentChats,
      autoAssign: settings.agentRules.autoAssignEnabled,
      roundRobinEnabled: settings.agentRules.assignmentMode === 'round-robin',
      skillBasedRouting: settings.agentRules.skillBasedRouting,
      priorityRouting: settings.agentRules.priorityRouting,
      workingHoursEnabled: settings.agentRules.workingHoursEnabled,
      workingHoursStart: settings.agentRules.workingHoursStart,
      workingHoursEnd: settings.agentRules.workingHoursEnd,
    },
    security: {
      sessionTimeout: settings.security.sessionTimeoutMinutes,
      maxLoginAttempts: settings.security.maxLoginAttempts,
      twoFactorEnabled: settings.security.twoFactorEnabled,
      auditLogRetention: settings.security.auditLogRetentionDays,
      passwordPolicy: {
        minLength: settings.security.passwordMinLength,
        requireUppercase: settings.security.passwordRequireUppercase,
        requireNumbers: settings.security.passwordRequireNumbers,
        requireSpecial: settings.security.passwordRequireSpecial,
      },
    },
    notifications: {
      emailNotifications: settings.notifications.emailNotificationsEnabled,
      newChatSound: settings.notifications.newChatSoundEnabled,
      newMessageSound: settings.notifications.newMessageSoundEnabled,
      desktopNotifications: settings.notifications.desktopNotificationsEnabled,
      escalationAlerts: settings.notifications.escalationAlertsEnabled,
      dailyReportEmail: settings.notifications.dailyReportEnabled,
    },
  };
}

// ============= EXPORTS =============

export {
  CACHE_KEY,
  CACHE_TTL,
  formatSettingsForClient,
};

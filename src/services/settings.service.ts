/**
 * Settings Service
 * Handles platform configuration management
 */

import { Settings, type ISettings, type IBotSettings, type IChatSettings, type IAgentRules, type ISecuritySettings } from '../database/index.js';

// ============= FIELD WHITELISTS =============
// Prevent arbitrary key injection into settings documents

const ALLOWED_BOT_FIELDS = new Set<string>([
  'name', 'username', 'welcomeMessage', 'transferMessage', 'offlineMessage',
  'defaultLanguage', 'autoReplyEnabled', 'autoReplyDelay', 'typingIndicator',
]);

const ALLOWED_CHAT_FIELDS = new Set<string>([
  'maxWaitTimeMinutes', 'autoCloseInactiveMinutes', 'queuedTimeoutMinutes',
  'autoResponseEnabled', 'defaultBotMessage', 'maxQueueSize',
  'enableFileSharing', 'maxFileSizeMB', 'allowedFileTypes',
  'enableEmoji', 'enableSuggestions',
]);

const ALLOWED_AGENT_RULES_FIELDS = new Set<string>([
  'maxConcurrentChats', 'autoAssignEnabled', 'assignmentMode',
  'skillBasedRouting', 'priorityRouting', 'workingHoursEnabled',
  'workingHoursStart', 'workingHoursEnd', 'workingHoursTimezone',
  'focusModeEnabled',
]);

const ALLOWED_SECURITY_FIELDS = new Set<string>([
  'jwtExpirationDays', 'rateLimitPerMinute', 'logCriticalEvents',
  'sessionTimeoutMinutes', 'maxLoginAttempts', 'maxSessionsPerAgent',
  'twoFactorEnabled', 'passwordMinLength', 'passwordRequireUppercase',
  'passwordRequireNumbers', 'passwordRequireSpecial', 'auditLogRetentionDays',
  'mfaRequiredForAll', 'mfaRequiredRoles', 'mfaBypassIPs',
  'mfaTrustDevicesEnabled', 'mfaAllowedMethods',
  'autoLockEnabled', 'autoLockTimeoutMinutes', 'autoLockRequirePassword',
  'autoLockRequireMFA', 'autoLockShowLastActivity', 'autoLockGracePeriodSeconds',
  'autoLockRoleTimeouts', 'autoLockExemptRoles',
]);

const ALLOWED_NOTIFICATION_FIELDS = new Set<string>([
  'emailNotificationsEnabled', 'escalationAlertsEnabled', 'dailyReportEnabled',
  'desktopNotificationsEnabled', 'newChatSoundEnabled', 'newMessageSoundEnabled',
  'notificationVolume',
]);

/** Strip keys not in whitelist */
function filterFields(data: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowed.has(key) && value !== undefined) {
      filtered[key] = value;
    }
  }
  return filtered;
}

// Cache settings in memory for performance
let cachedSettings: ISettings | null = null;

/**
 * Get current settings (cached)
 */
export async function getSettings(): Promise<ISettings> {
  if (cachedSettings) {
    return cachedSettings;
  }
  
  let settings = await Settings.findOne({ key: 'main' });
  
  if (!settings) {
    settings = await Settings.create({ key: 'main' });
  }
  
  cachedSettings = settings;
  return settings;
}

/**
 * Clear settings cache (call after updates)
 */
export function clearSettingsCache(): void {
  cachedSettings = null;
}

/**
 * Update bot settings
 */
export async function updateBotSettings(
  data: Partial<IBotSettings>,
  updatedBy?: string
): Promise<ISettings> {
  const updateData: Record<string, unknown> = {};
  const safe = filterFields(data as Record<string, unknown>, ALLOWED_BOT_FIELDS);
  
  for (const [key, value] of Object.entries(safe)) {
    updateData[`bot.${key}`] = value;
  }
  
  if (updatedBy) {
    updateData.updatedBy = updatedBy;
  }
  
  const settings = await Settings.findOneAndUpdate(
    { key: 'main' },
    { $set: updateData },
    { new: true, upsert: true }
  );
  
  clearSettingsCache();
  return settings!;
}

/**
 * Update chat settings
 */
export async function updateChatSettings(
  data: Partial<IChatSettings>,
  updatedBy?: string
): Promise<ISettings> {
  const updateData: Record<string, unknown> = {};
  const safe = filterFields(data as Record<string, unknown>, ALLOWED_CHAT_FIELDS);
  
  for (const [key, value] of Object.entries(safe)) {
    updateData[`chat.${key}`] = value;
  }
  
  if (updatedBy) {
    updateData.updatedBy = updatedBy;
  }
  
  const settings = await Settings.findOneAndUpdate(
    { key: 'main' },
    { $set: updateData },
    { new: true, upsert: true }
  );
  
  clearSettingsCache();
  return settings!;
}

/**
 * Update agent rules
 */
export async function updateAgentRules(
  data: Partial<IAgentRules>,
  updatedBy?: string
): Promise<ISettings> {
  const updateData: Record<string, unknown> = {};
  const safe = filterFields(data as Record<string, unknown>, ALLOWED_AGENT_RULES_FIELDS);
  
  for (const [key, value] of Object.entries(safe)) {
    updateData[`agentRules.${key}`] = value;
  }
  
  if (updatedBy) {
    updateData.updatedBy = updatedBy;
  }
  
  const settings = await Settings.findOneAndUpdate(
    { key: 'main' },
    { $set: updateData },
    { new: true, upsert: true }
  );
  
  clearSettingsCache();
  return settings!;
}

/**
 * Update security settings
 */
export async function updateSecuritySettings(
  data: Partial<ISecuritySettings>,
  updatedBy?: string
): Promise<ISettings> {
  const updateData: Record<string, unknown> = {};
  const safe = filterFields(data as Record<string, unknown>, ALLOWED_SECURITY_FIELDS);
  
  for (const [key, value] of Object.entries(safe)) {
    updateData[`security.${key}`] = value;
  }
  
  if (updatedBy) {
    updateData.updatedBy = updatedBy;
  }
  
  const settings = await Settings.findOneAndUpdate(
    { key: 'main' },
    { $set: updateData },
    { new: true, upsert: true }
  );
  
  clearSettingsCache();
  return settings!;
}

/**
 * Update all settings at once
 */
export async function updateAllSettings(
  data: {
    bot?: Partial<IBotSettings>;
    chat?: Partial<IChatSettings>;
    agentRules?: Partial<IAgentRules>;
    security?: Partial<ISecuritySettings>;
  },
  updatedBy?: string
): Promise<ISettings> {
  const updateData: Record<string, unknown> = {};
  
  if (data.bot) {
    const safe = filterFields(data.bot as Record<string, unknown>, ALLOWED_BOT_FIELDS);
    for (const [key, value] of Object.entries(safe)) {
      updateData[`bot.${key}`] = value;
    }
  }
  
  if (data.chat) {
    const safe = filterFields(data.chat as Record<string, unknown>, ALLOWED_CHAT_FIELDS);
    for (const [key, value] of Object.entries(safe)) {
      updateData[`chat.${key}`] = value;
    }
  }
  
  if (data.agentRules) {
    const safe = filterFields(data.agentRules as Record<string, unknown>, ALLOWED_AGENT_RULES_FIELDS);
    for (const [key, value] of Object.entries(safe)) {
      updateData[`agentRules.${key}`] = value;
    }
  }
  
  if (data.security) {
    const safe = filterFields(data.security as Record<string, unknown>, ALLOWED_SECURITY_FIELDS);
    for (const [key, value] of Object.entries(safe)) {
      updateData[`security.${key}`] = value;
    }
  }
  
  if (updatedBy) {
    updateData.updatedBy = updatedBy;
  }
  
  const settings = await Settings.findOneAndUpdate(
    { key: 'main' },
    { $set: updateData },
    { new: true, upsert: true }
  );
  
  clearSettingsCache();
  return settings!;
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(updatedBy?: string): Promise<ISettings> {
  await Settings.deleteOne({ key: 'main' });
  const settings = await Settings.create({ 
    key: 'main',
    updatedBy,
  });
  
  clearSettingsCache();
  return settings;
}

/**
 * Settings Service
 * Handles platform configuration management
 */

import { Settings, type ISettings, type IBotSettings, type IChatSettings, type IAgentRules, type ISecuritySettings } from '../database/index.js';

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
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateData[`bot.${key}`] = value;
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
 * Update chat settings
 */
export async function updateChatSettings(
  data: Partial<IChatSettings>,
  updatedBy?: string
): Promise<ISettings> {
  const updateData: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateData[`chat.${key}`] = value;
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
 * Update agent rules
 */
export async function updateAgentRules(
  data: Partial<IAgentRules>,
  updatedBy?: string
): Promise<ISettings> {
  const updateData: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      updateData[`agentRules.${key}`] = value;
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
 * Update security settings
 */
export async function updateSecuritySettings(
  data: Partial<ISecuritySettings>,
  updatedBy?: string
): Promise<ISettings> {
  const updateData: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
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
    for (const [key, value] of Object.entries(data.bot)) {
      if (value !== undefined) {
        updateData[`bot.${key}`] = value;
      }
    }
  }
  
  if (data.chat) {
    for (const [key, value] of Object.entries(data.chat)) {
      if (value !== undefined) {
        updateData[`chat.${key}`] = value;
      }
    }
  }
  
  if (data.agentRules) {
    for (const [key, value] of Object.entries(data.agentRules)) {
      if (value !== undefined) {
        updateData[`agentRules.${key}`] = value;
      }
    }
  }
  
  if (data.security) {
    for (const [key, value] of Object.entries(data.security)) {
      if (value !== undefined) {
        updateData[`security.${key}`] = value;
      }
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

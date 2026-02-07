/**
 * Channel Manager
 * Central registry for all channel adapters
 * Provides unified interface for sending messages across any channel
 */

import type { ChannelType, MediaContent, SendMessageOptions, SendMediaOptions, SurveyConfig, ChannelConfig } from '../types/omnichannel.js';
import { BaseChannelAdapter, SendResult, PollResult, SurveyResult } from './base.adapter.js';
import { telegramAdapter } from './telegram.adapter.js';
import { webChatAdapter, setWebChatSocketIO } from './webchat.adapter.js';
import { whatsAppAdapter } from './whatsapp.adapter.js';
import { logger } from '../services/logger.js';

// Registry of all channel adapters
const adapters: Map<ChannelType, BaseChannelAdapter> = new Map([
  ['telegram', telegramAdapter],
  ['web', webChatAdapter],
  ['whatsapp', whatsAppAdapter],
]);

/**
 * Get adapter for a specific channel
 */
export function getAdapter(channel: ChannelType): BaseChannelAdapter | undefined {
  return adapters.get(channel);
}

/**
 * Register a new channel adapter
 */
export function registerAdapter(adapter: BaseChannelAdapter): void {
  adapters.set(adapter.channelType, adapter);
  logger.info('channels', {
    action: 'registerAdapter',
    channel: adapter.channelType,
  });
}

/**
 * Get all registered channel types
 */
export function getRegisteredChannels(): ChannelType[] {
  return Array.from(adapters.keys());
}

/**
 * Get channel configuration
 */
export function getChannelConfig(channel: ChannelType): ChannelConfig | undefined {
  return adapters.get(channel)?.config;
}

/**
 * Check if a feature is supported by a channel
 */
export function channelSupportsFeature(
  channel: ChannelType,
  feature: keyof ChannelConfig['features']
): boolean {
  const adapter = adapters.get(channel);
  return adapter?.supportsFeature(feature) ?? false;
}

// ============= UNIFIED MESSAGING API =============

/**
 * Send message through the appropriate channel
 */
export async function sendMessage(
  channel: ChannelType,
  chatId: string | number,
  text: string,
  options?: SendMessageOptions
): Promise<SendResult> {
  const adapter = adapters.get(channel);
  
  if (!adapter) {
    logger.error('channels', {
      action: 'sendMessage',
      channel,
      error: `No adapter registered for channel: ${channel}`,
    });
    return { success: false, error: `Unknown channel: ${channel}` };
  }

  return adapter.sendMessage(chatId, text, options);
}

/**
 * Send media through the appropriate channel
 */
export async function sendMedia(
  channel: ChannelType,
  chatId: string | number,
  media: MediaContent,
  options?: SendMediaOptions
): Promise<SendResult> {
  const adapter = adapters.get(channel);
  
  if (!adapter) {
    return { success: false, error: `Unknown channel: ${channel}` };
  }

  // Check if channel supports media
  if (!adapter.supportsFeature('media')) {
    return { success: false, error: `Channel ${channel} does not support media` };
  }

  return adapter.sendMedia(chatId, media, options);
}

/**
 * Send typing indicator
 */
export async function sendTyping(
  channel: ChannelType,
  chatId: string | number
): Promise<void> {
  const adapter = adapters.get(channel);
  
  if (!adapter) {
    return;
  }

  // Check if channel supports typing
  if (!adapter.supportsFeature('typing')) {
    return;
  }

  await adapter.sendTyping(chatId);
}

/**
 * Edit a message (if supported)
 */
export async function editMessage(
  channel: ChannelType,
  chatId: string | number,
  messageId: string | number,
  text: string
): Promise<boolean> {
  const adapter = adapters.get(channel);
  
  if (!adapter || !adapter.supportsFeature('edit_messages')) {
    return false;
  }

  return adapter.editMessage(chatId, messageId, text);
}

/**
 * Delete a message (if supported)
 */
export async function deleteMessage(
  channel: ChannelType,
  chatId: string | number,
  messageId: string | number
): Promise<boolean> {
  const adapter = adapters.get(channel);
  
  if (!adapter || !adapter.supportsFeature('delete_messages')) {
    return false;
  }

  return adapter.deleteMessage(chatId, messageId);
}

/**
 * Send poll (if supported)
 */
export async function sendPoll(
  channel: ChannelType,
  chatId: string | number,
  question: string,
  options: string[]
): Promise<PollResult> {
  const adapter = adapters.get(channel);
  
  if (!adapter) {
    return { success: false, error: `Unknown channel: ${channel}` };
  }

  if (!adapter.supportsFeature('polls')) {
    return { success: false, error: `Channel ${channel} does not support polls` };
  }

  return adapter.sendPoll(chatId, question, options);
}

/**
 * Close chat
 */
export async function closeChat(
  channel: ChannelType,
  chatId: string | number,
  message?: string
): Promise<void> {
  const adapter = adapters.get(channel);
  
  if (!adapter) {
    return;
  }

  await adapter.closeChat(chatId, message);
}

/**
 * Send post-chat survey
 * Automatically uses the appropriate method for each channel
 */
export async function sendSurvey(
  channel: ChannelType,
  chatId: string | number,
  config: SurveyConfig
): Promise<SurveyResult> {
  const adapter = adapters.get(channel);
  
  if (!adapter) {
    return { success: false, error: `Unknown channel: ${channel}` };
  }

  return adapter.sendSurvey(chatId, config);
}

// ============= CHANNEL UI HELPERS =============

/**
 * Get display information for a channel
 */
export function getChannelDisplayInfo(channel: ChannelType): {
  name: string;
  icon: string;
  color: string;
} {
  const adapter = adapters.get(channel);
  
  if (!adapter) {
    return { name: channel, icon: '💬', color: '#888888' };
  }

  return {
    name: adapter.getDisplayName(),
    icon: adapter.getIcon(),
    color: adapter.getColor(),
  };
}

/**
 * Get all channel display info
 */
export function getAllChannelsDisplayInfo(): Array<{
  type: ChannelType;
  name: string;
  icon: string;
  color: string;
}> {
  return Array.from(adapters.entries()).map(([type, adapter]) => ({
    type,
    name: adapter.getDisplayName(),
    icon: adapter.getIcon(),
    color: adapter.getColor(),
  }));
}

// ============= INITIALIZATION =============

/**
 * Initialize channel manager
 * Call this during server startup
 */
export function initializeChannelManager(io?: any): void {
  // Set Socket.IO for web chat adapter
  if (io) {
    setWebChatSocketIO(io);
  }

  logger.info('channels', {
    action: 'initializeChannelManager',
    registeredChannels: getRegisteredChannels(),
  });
}

// Export adapters for direct access if needed
export { telegramAdapter, webChatAdapter, whatsAppAdapter };
export { setWebChatSocketIO };

/**
 * Base Channel Adapter Interface
 * All channel adapters must implement this interface
 */

import type { ChannelType, ChannelConfig, MediaContent, SendMessageOptions, SendMediaOptions, SurveyConfig } from '../types/omnichannel.js';

export interface SendResult {
  success: boolean;
  messageId?: string | number;
  error?: string;
}

export interface PollResult {
  success: boolean;
  pollId?: string;
  messageId?: string | number;
  error?: string;
}

export interface SurveyResult {
  success: boolean;
  surveyId?: string;
  error?: string;
}

/**
 * Abstract base class for channel adapters
 * Provides common functionality and ensures consistent interface
 */
export abstract class BaseChannelAdapter {
  abstract readonly channelType: ChannelType;
  abstract readonly config: ChannelConfig;

  /**
   * Check if a feature is supported by this channel
   */
  supportsFeature(feature: keyof ChannelConfig['features']): boolean {
    return this.config.features[feature] ?? false;
  }

  /**
   * Send a text message
   */
  abstract sendMessage(
    chatId: string | number,
    text: string,
    options?: SendMessageOptions
  ): Promise<SendResult>;

  /**
   * Send media (image, file, audio, etc.)
   */
  abstract sendMedia(
    chatId: string | number,
    media: MediaContent,
    options?: SendMediaOptions
  ): Promise<SendResult>;

  /**
   * Send typing indicator
   */
  abstract sendTyping(chatId: string | number): Promise<void>;

  /**
   * Edit a message (if supported)
   */
  async editMessage(
    chatId: string | number,
    messageId: string | number,
    text: string
  ): Promise<boolean> {
    if (!this.supportsFeature('edit_messages')) {
      return false;
    }
    // Override in subclass if supported
    return false;
  }

  /**
   * Delete a message (if supported)
   */
  async deleteMessage(
    chatId: string | number,
    messageId: string | number
  ): Promise<boolean> {
    if (!this.supportsFeature('delete_messages')) {
      return false;
    }
    // Override in subclass if supported
    return false;
  }

  /**
   * Send a poll (if supported)
   */
  async sendPoll(
    chatId: string | number,
    question: string,
    options: string[]
  ): Promise<PollResult> {
    if (!this.supportsFeature('polls')) {
      return { success: false, error: 'Polls not supported on this channel' };
    }
    // Override in subclass if supported
    return { success: false, error: 'Not implemented' };
  }

  /**
   * Close the chat with optional message
   */
  abstract closeChat(chatId: string | number, message?: string): Promise<void>;

  /**
   * Send post-chat survey
   * Uses poll for Telegram, rating UI for web
   */
  abstract sendSurvey(
    chatId: string | number,
    config: SurveyConfig
  ): Promise<SurveyResult>;

  /**
   * Get display name for the channel
   */
  getDisplayName(): string {
    return this.config.name;
  }

  /**
   * Get channel icon/emoji
   */
  getIcon(): string {
    return this.config.icon;
  }

  /**
   * Get channel primary color
   */
  getColor(): string {
    return this.config.color;
  }
}

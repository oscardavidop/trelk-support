/**
 * WhatsApp Channel Adapter (Placeholder)
 * Will be implemented when WhatsApp Business API integration is added
 */

import { BaseChannelAdapter, SendResult, SurveyResult } from './base.adapter.js';
import type { ChannelType, ChannelConfig, MediaContent, SendMessageOptions, SendMediaOptions, SurveyConfig } from '../types/omnichannel.js';
import { logger } from '../services/logger.js';

const WHATSAPP_CONFIG: ChannelConfig = {
  type: 'whatsapp',
  name: 'WhatsApp',
  icon: '📱',
  color: '#25D366',
  features: {
    typing: true,
    read_receipts: true,
    media: true,
    voice: true,
    stickers: true,
    polls: false,
    reactions: true,
    edit_messages: false,
    delete_messages: true,
  },
};

export class WhatsAppAdapter extends BaseChannelAdapter {
  readonly channelType: ChannelType = 'whatsapp';
  readonly config: ChannelConfig = WHATSAPP_CONFIG;

  /**
   * Send a text message via WhatsApp Business API
   * TODO: Implement when WhatsApp integration is added
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: SendMessageOptions
  ): Promise<SendResult> {
    logger.warn('channels', {
      adapter: 'whatsapp',
      action: 'sendMessage',
      message: 'WhatsApp adapter not yet implemented',
    });
    return { success: false, error: 'WhatsApp adapter not yet implemented' };
  }

  /**
   * Send media via WhatsApp
   * TODO: Implement when WhatsApp integration is added
   */
  async sendMedia(
    chatId: string | number,
    media: MediaContent,
    options?: SendMediaOptions
  ): Promise<SendResult> {
    logger.warn('channels', {
      adapter: 'whatsapp',
      action: 'sendMedia',
      message: 'WhatsApp adapter not yet implemented',
    });
    return { success: false, error: 'WhatsApp adapter not yet implemented' };
  }

  /**
   * Send typing indicator
   */
  async sendTyping(chatId: string | number): Promise<void> {
    // TODO: Implement
  }

  /**
   * Close chat
   */
  async closeChat(chatId: string | number, message?: string): Promise<void> {
    // TODO: Implement
  }

  /**
   * Send survey (uses rating message since WhatsApp doesn't support polls)
   */
  async sendSurvey(
    chatId: string | number,
    config: SurveyConfig
  ): Promise<SurveyResult> {
    logger.warn('channels', {
      adapter: 'whatsapp',
      action: 'sendSurvey',
      message: 'WhatsApp adapter not yet implemented',
    });
    return { success: false, error: 'WhatsApp adapter not yet implemented' };
  }
}

// Singleton instance
export const whatsAppAdapter = new WhatsAppAdapter();

/**
 * Telegram Channel Adapter
 * Implements the channel adapter interface for Telegram
 */

import { BaseChannelAdapter, SendResult, PollResult, SurveyResult } from './base.adapter.js';
import type { ChannelType, ChannelConfig, MediaContent, SendMessageOptions, SendMediaOptions, SurveyConfig, CHANNEL_CONFIGS } from '../types/omnichannel.js';
import {
  sendMessage as sendTelegramMessage,
  sendMessageWithId,
  sendPhoto,
  sendDocument,
  sendVoice,
  sendAudio,
  sendVideo,
  sendSticker,
  sendChatAction,
  editMessage as editTelegramMessage,
  deleteMessage as deleteTelegramMessage,
  sendPoll as sendTelegramPoll,
} from '../services/telegram.js';
import { logger } from '../services/logger.js';

const TELEGRAM_CONFIG: ChannelConfig = {
  type: 'telegram',
  name: 'Telegram',
  icon: '📨',
  color: '#0088cc',
  features: {
    typing: true,
    read_receipts: true,
    media: true,
    voice: true,
    stickers: true,
    polls: true,
    reactions: true,
    edit_messages: true,
    delete_messages: true,
  },
};

export class TelegramAdapter extends BaseChannelAdapter {
  readonly channelType: ChannelType = 'telegram';
  readonly config: ChannelConfig = TELEGRAM_CONFIG;

  /**
   * Send a text message via Telegram
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: SendMessageOptions
  ): Promise<SendResult> {
    try {
      const telegramChatId = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
      
      const messageId = await sendMessageWithId(telegramChatId, text, {
        parseMode: options?.parseMode === 'text' ? undefined : (options?.parseMode || 'HTML'),
        replyMarkup: options?.keyboard,
        disablePreview: options?.disablePreview,
        reply_to_message_id: options?.replyToMessageId as number | undefined,
      });

      if (messageId) {
        return { success: true, messageId };
      }
      
      return { success: false, error: 'Failed to send message' };
    } catch (error) {
      logger.error('channels', {
        adapter: 'telegram',
        action: 'sendMessage',
        chatId,
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send media via Telegram
   */
  async sendMedia(
    chatId: string | number,
    media: MediaContent,
    options?: SendMediaOptions
  ): Promise<SendResult> {
    try {
      const telegramChatId = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
      let success = false;
      const mediaOptions = options?.caption ? { caption: options.caption } : undefined;

      switch (media.type) {
        case 'image':
          success = await sendPhoto(telegramChatId, media.url, mediaOptions);
          break;
        case 'file':
          success = await sendDocument(telegramChatId, media.url, mediaOptions);
          break;
        case 'voice':
          success = await sendVoice(telegramChatId, media.url, mediaOptions);
          break;
        case 'audio':
          success = await sendAudio(telegramChatId, media.url, mediaOptions);
          break;
        case 'video':
          success = await sendVideo(telegramChatId, media.url, mediaOptions);
          break;
        case 'sticker':
          // sendSticker returns messageId or null
          success = (await sendSticker(telegramChatId, media.url)) !== null;
          break;
        default:
          success = await sendDocument(telegramChatId, media.url, mediaOptions);
      }

      return { success };
    } catch (error) {
      logger.error('channels', {
        adapter: 'telegram',
        action: 'sendMedia',
        chatId,
        mediaType: media.type,
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(chatId: string | number): Promise<void> {
    try {
      const telegramChatId = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
      await sendChatAction(telegramChatId, 'typing');
    } catch (error) {
      logger.warn('channels', {
        adapter: 'telegram',
        action: 'sendTyping',
        chatId,
        error: String(error),
      });
    }
  }

  /**
   * Edit a message
   */
  async editMessage(
    chatId: string | number,
    messageId: string | number,
    text: string
  ): Promise<boolean> {
    try {
      const telegramChatId = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
      const telegramMessageId = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
      return await editTelegramMessage(telegramChatId, telegramMessageId, text);
    } catch (error) {
      logger.error('channels', {
        adapter: 'telegram',
        action: 'editMessage',
        chatId,
        messageId,
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(
    chatId: string | number,
    messageId: string | number
  ): Promise<boolean> {
    try {
      const telegramChatId = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
      const telegramMessageId = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
      return await deleteTelegramMessage(telegramChatId, telegramMessageId);
    } catch (error) {
      logger.error('channels', {
        adapter: 'telegram',
        action: 'deleteMessage',
        chatId,
        messageId,
        error: String(error),
      });
      return false;
    }
  }

  /**
   * Send a poll (satisfaction survey style)
   */
  async sendPoll(
    chatId: string | number,
    question: string,
    options: string[]
  ): Promise<PollResult> {
    try {
      const telegramChatId = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
      const result = await sendTelegramPoll(telegramChatId, question, options);
      
      if (result) {
        return {
          success: true,
          pollId: result.poll.id,
          messageId: result.message_id,
        };
      }
      
      return { success: false, error: 'Failed to send poll' };
    } catch (error) {
      logger.error('channels', {
        adapter: 'telegram',
        action: 'sendPoll',
        chatId,
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Close chat with optional message
   */
  async closeChat(chatId: string | number, message?: string): Promise<void> {
    if (message) {
      await this.sendMessage(chatId, message);
    }
    // Telegram doesn't have a concept of "closing" a chat
    // The session is just marked as closed in our database
  }

  /**
   * Send satisfaction survey (uses Telegram poll)
   */
  async sendSurvey(
    chatId: string | number,
    config: SurveyConfig
  ): Promise<SurveyResult> {
    try {
      // For Telegram, we use native polls
      const options = config.options || ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'];
      const result = await this.sendPoll(chatId, config.question, options);
      
      if (result.success) {
        return {
          success: true,
          surveyId: result.pollId,
        };
      }
      
      return { success: false, error: result.error };
    } catch (error) {
      logger.error('channels', {
        adapter: 'telegram',
        action: 'sendSurvey',
        chatId,
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }
}

// Singleton instance
export const telegramAdapter = new TelegramAdapter();

/**
 * Web Chat Channel Adapter
 * Implements the channel adapter interface for web chat widget
 */

import { BaseChannelAdapter, SendResult, SurveyResult } from './base.adapter.js';
import type { ChannelType, ChannelConfig, MediaContent, SendMessageOptions, SendMediaOptions, SurveyConfig } from '../types/omnichannel.js';
import { logger } from '../services/logger.js';

// WebChat config
const WEBCHAT_CONFIG: ChannelConfig = {
  type: 'web',
  name: 'Web Chat',
  icon: '🌐',
  color: '#4F46E5',
  features: {
    typing: true,
    read_receipts: true,
    media: true,
    voice: true,
    stickers: false,
    polls: false,
    reactions: true,
    edit_messages: false,
    delete_messages: false,
  },
};

// Socket.IO server reference (will be set during initialization)
let webChatSocketIO: any = null;

export function setWebChatSocketIO(io: any) {
  webChatSocketIO = io;
}

export class WebChatAdapter extends BaseChannelAdapter {
  readonly channelType: ChannelType = 'web';
  readonly config: ChannelConfig = WEBCHAT_CONFIG;

  /**
   * Send a text message to web chat visitor
   * Uses Socket.IO to push message to connected client
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: SendMessageOptions
  ): Promise<SendResult> {
    try {
      if (!webChatSocketIO) {
        logger.error('channels', {
          adapter: 'webchat',
          action: 'sendMessage',
          error: 'Socket.IO not initialized',
        });
        return { success: false, error: 'Socket.IO not initialized' };
      }

      const messageId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const visitorId = String(chatId);

      // Emit message to the visitor's room
      webChatSocketIO.to(`webchat:${visitorId}`).emit('web:message:new', {
        id: messageId,
        sessionId: visitorId,
        channel: 'web',
        senderType: 'agent',
        contentType: 'text',
        content: text,
        timestamp: new Date().toISOString(),
      });

      logger.info('channels', {
        adapter: 'webchat',
        action: 'sendMessage',
        visitorId,
        messageId,
      });

      return { success: true, messageId };
    } catch (error) {
      logger.error('channels', {
        adapter: 'webchat',
        action: 'sendMessage',
        chatId,
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send media to web chat visitor
   */
  async sendMedia(
    chatId: string | number,
    media: MediaContent,
    options?: SendMediaOptions
  ): Promise<SendResult> {
    try {
      if (!webChatSocketIO) {
        return { success: false, error: 'Socket.IO not initialized' };
      }

      const messageId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const visitorId = String(chatId);

      // Map media type to content type
      const contentType = media.type === 'file' ? 'file' : media.type;

      webChatSocketIO.to(`webchat:${visitorId}`).emit('web:message:new', {
        id: messageId,
        sessionId: visitorId,
        channel: 'web',
        senderType: 'agent',
        contentType,
        content: options?.caption || media.fileName || 'Media',
        media: {
          type: media.type,
          url: media.url,
          thumbnailUrl: media.thumbnailUrl,
          fileName: media.fileName,
          fileSize: media.fileSize,
          mimeType: media.mimeType,
        },
        timestamp: new Date().toISOString(),
      });

      return { success: true, messageId };
    } catch (error) {
      logger.error('channels', {
        adapter: 'webchat',
        action: 'sendMedia',
        chatId,
        mediaType: media.type,
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Send typing indicator to visitor
   */
  async sendTyping(chatId: string | number): Promise<void> {
    try {
      if (!webChatSocketIO) return;

      const visitorId = String(chatId);
      webChatSocketIO.to(`webchat:${visitorId}`).emit('web:typing:agent', {
        agentId: 'system',
        agentName: 'Agente',
      });
    } catch (error) {
      logger.warn('channels', {
        adapter: 'webchat',
        action: 'sendTyping',
        chatId,
        error: String(error),
      });
    }
  }

  /**
   * Stop typing indicator
   */
  async stopTyping(chatId: string | number): Promise<void> {
    try {
      if (!webChatSocketIO) return;

      const visitorId = String(chatId);
      webChatSocketIO.to(`webchat:${visitorId}`).emit('web:typing:stop');
    } catch (error) {
      // Silent fail for typing stop
    }
  }

  /**
   * Close chat with message
   */
  async closeChat(chatId: string | number, message?: string): Promise<void> {
    try {
      if (!webChatSocketIO) return;

      const visitorId = String(chatId);

      // Send close message if provided
      if (message) {
        await this.sendMessage(chatId, message);
      }

      // Emit chat closed event
      webChatSocketIO.to(`webchat:${visitorId}`).emit('web:chat:closed', {
        reason: 'agent_closed',
        message: message || 'El chat ha sido cerrado.',
      });

      logger.info('channels', {
        adapter: 'webchat',
        action: 'closeChat',
        visitorId,
      });
    } catch (error) {
      logger.error('channels', {
        adapter: 'webchat',
        action: 'closeChat',
        chatId,
        error: String(error),
      });
    }
  }

  /**
   * Send post-chat survey (rating modal for web)
   */
  async sendSurvey(
    chatId: string | number,
    config: SurveyConfig
  ): Promise<SurveyResult> {
    try {
      if (!webChatSocketIO) {
        return { success: false, error: 'Socket.IO not initialized' };
      }

      const visitorId = String(chatId);
      const surveyId = `survey_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Emit survey request to show rating modal
      webChatSocketIO.to(`webchat:${visitorId}`).emit('web:survey:request', {
        surveyId,
        question: config.question,
        type: 'rating', // Web uses rating UI, not polls
        allowComment: config.allowComment ?? true,
      });

      logger.info('channels', {
        adapter: 'webchat',
        action: 'sendSurvey',
        visitorId,
        surveyId,
      });

      return { success: true, surveyId };
    } catch (error) {
      logger.error('channels', {
        adapter: 'webchat',
        action: 'sendSurvey',
        chatId,
        error: String(error),
      });
      return { success: false, error: String(error) };
    }
  }

  /**
   * Notify agent assignment
   */
  async notifyAgentAssigned(
    visitorId: string,
    agent: { id: string; name: string; photo?: string }
  ): Promise<void> {
    try {
      if (!webChatSocketIO) return;

      webChatSocketIO.to(`webchat:${visitorId}`).emit('web:agent:assigned', {
        agentId: agent.id,
        agentName: agent.name,
        agentPhoto: agent.photo,
      });
    } catch (error) {
      logger.error('channels', {
        adapter: 'webchat',
        action: 'notifyAgentAssigned',
        visitorId,
        error: String(error),
      });
    }
  }

  /**
   * Send error to visitor
   */
  async sendError(
    visitorId: string,
    code: string,
    message: string
  ): Promise<void> {
    try {
      if (!webChatSocketIO) return;

      webChatSocketIO.to(`webchat:${visitorId}`).emit('web:error', {
        code,
        message,
      });
    } catch (error) {
      // Silent fail for error sending
    }
  }
}

// Singleton instance
export const webChatAdapter = new WebChatAdapter();

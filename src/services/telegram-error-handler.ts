/**
 * Telegram Error Handler Service
 * Handles errors from Telegram API and manages user blocking
 * 
 * Detects when users block the bot or become unreachable and:
 * - Marks the user as blocked
 * - Closes any open chat sessions
 * - Notifies agents via socket
 */

import { User, type UserBlockReason, ChatSession } from '../database/models/index.js';
import { getIO } from './socket.js';
import { closeSession, getSessionById, addMessage } from './chat.service.js';
import { logger } from './logger.js';
import { TELEGRAM_API } from '../config/index.js';

// ============= ERROR PATTERNS =============

/**
 * Telegram error messages that indicate the user can't receive messages
 */
const BLOCK_ERROR_PATTERNS: { pattern: string; reason: UserBlockReason; message: string }[] = [
  { 
    pattern: 'bot was blocked by the user', 
    reason: 'bot_blocked',
    message: 'El usuario bloqueó el bot'
  },
  { 
    pattern: 'user is deactivated', 
    reason: 'user_deactivated',
    message: 'La cuenta del usuario fue desactivada'
  },
  { 
    pattern: 'chat not found', 
    reason: 'chat_not_found',
    message: 'El chat no existe'
  },
  { 
    pattern: 'bot can\'t initiate conversation', 
    reason: 'cant_initiate',
    message: 'El bot no puede iniciar conversación con este usuario'
  },
  { 
    pattern: 'bot was kicked', 
    reason: 'bot_kicked',
    message: 'El bot fue expulsado del chat'
  },
  {
    pattern: 'Forbidden',
    reason: 'bot_blocked',
    message: 'No se puede enviar mensaje al usuario'
  },
];

// ============= HELPER FUNCTIONS =============

/**
 * Check if an error message indicates the user blocked the bot or is unreachable
 */
export function isBlockingError(errorMessage: string): { isBlocking: boolean; reason?: UserBlockReason; userMessage?: string } {
  const lowerError = errorMessage.toLowerCase();
  
  for (const { pattern, reason, message } of BLOCK_ERROR_PATTERNS) {
    if (lowerError.includes(pattern.toLowerCase())) {
      return { isBlocking: true, reason, userMessage: message };
    }
  }
  
  return { isBlocking: false };
}

/**
 * Get human-readable message for block reason
 */
export function getBlockReasonMessage(reason: UserBlockReason): { es: string; en: string } {
  const messages: Record<UserBlockReason, { es: string; en: string }> = {
    bot_blocked: {
      es: '🚫 Chat cerrado: El usuario bloqueó el bot',
      en: '🚫 Chat closed: User blocked the bot',
    },
    user_deactivated: {
      es: '🚫 Chat cerrado: La cuenta del usuario fue desactivada',
      en: '🚫 Chat closed: User account was deactivated',
    },
    chat_not_found: {
      es: '🚫 Chat cerrado: El chat ya no existe',
      en: '🚫 Chat closed: Chat no longer exists',
    },
    bot_kicked: {
      es: '🚫 Chat cerrado: El bot fue expulsado del chat',
      en: '🚫 Chat closed: Bot was kicked from chat',
    },
    cant_initiate: {
      es: '🚫 Chat cerrado: No se puede iniciar conversación con este usuario',
      en: '🚫 Chat closed: Cannot initiate conversation with this user',
    },
    admin_blocked: {
      es: '🚫 Chat cerrado: Usuario bloqueado por administrador',
      en: '🚫 Chat closed: User blocked by administrator',
    },
  };
  
  return messages[reason] || messages.bot_blocked;
}

// ============= MAIN SERVICE =============

export const telegramErrorHandler = {
  /**
   * Handle a Telegram API error
   * Returns true if the error was handled (blocking error)
   */
  async handleError(
    error: Error | string,
    telegramId: number,
    sessionId?: string
  ): Promise<{ handled: boolean; reason?: UserBlockReason }> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const { isBlocking, reason, userMessage } = isBlockingError(errorMessage);
    
    if (!isBlocking || !reason) {
      return { handled: false };
    }
    
    logger.warn('telegram-error-handler', {
      action: 'blocking_error_detected',
      telegramId,
      sessionId,
      reason,
      errorMessage,
    });
    
    try {
      // NOTE: We no longer mark users as blocked in DB since we can't know when they unblock
      // Instead, we just close all active sessions for this user
      
      // Close any open sessions for this user
      await this.closeUserSessions(telegramId, reason, sessionId);
      
      return { handled: true, reason };
    } catch (err) {
      logger.error('telegram-error-handler', {
        action: 'handle_error_failed',
        telegramId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { handled: false };
    }
  },
  
  /**
   * Mark a user as having blocked the bot
   */
  async markUserBlocked(telegramId: number, reason: UserBlockReason): Promise<void> {
    await User.findOneAndUpdate(
      { telegramId },
      {
        $set: {
          hasBlockedBot: true,
          blockReason: reason,
          blockedAt: new Date(),
          lastBlockCheck: new Date(),
        },
      },
      { upsert: false }
    );
    
    logger.info('telegram-error-handler', {
      action: 'user_marked_blocked',
      telegramId,
      reason,
    });
  },
  
  /**
   * Mark a user as unblocked (when they send a new message)
   */
  async markUserUnblocked(telegramId: number): Promise<void> {
    await User.findOneAndUpdate(
      { telegramId },
      {
        $set: {
          hasBlockedBot: false,
          lastBlockCheck: new Date(),
        },
        $unset: {
          blockReason: 1,
          blockedAt: 1,
        },
      }
    );
    
    logger.info('telegram-error-handler', {
      action: 'user_marked_unblocked',
      telegramId,
    });
  },
  
  /**
   * Close all open sessions for a user due to blocking
   */
  async closeUserSessions(
    telegramId: number,
    reason: UserBlockReason,
    currentSessionId?: string
  ): Promise<void> {
    // Find all open sessions for this user using the correct field name
    const openSessions = await ChatSession.find({
      telegramChatId: telegramId,
      status: { $in: ['bot', 'queued', 'human'] },
    });
    
    logger.info('telegram-error-handler', {
      action: 'closing_user_sessions',
      telegramId,
      reason,
      sessionsFound: openSessions.length,
      sessionIds: openSessions.map(s => s.sessionId),
    });
    
    const io = getIO();
    const messages = getBlockReasonMessage(reason);
    
    for (const session of openSessions) {
      const sessionId = session.sessionId;
      
      try {
        // Add system message explaining why the chat was closed
        const savedMessage = await addMessage(sessionId, 'bot', messages.es, {
          messageType: 'system',
        });
        
        // Emit message to dashboard - to session room AND globally
        if (io) {
          const messageData = {
            _id: savedMessage._id.toString(),
            session: sessionId,
            sender: 'bot',
            content: messages.es,
            messageType: 'system' as const,
            createdAt: savedMessage.createdAt,
          };
          io.to(`session:${sessionId}`).emit('message:new', messageData);
        }
        
        // Close the session properly
        const closedSession = await closeSession(
          sessionId, 
          null,  // agentId - null because system is closing
          messages.es,  // reason
          'system'  // closedByType
        );
        
        // Emit events to update UI
        if (io) {
          // Emit to specific session room for agents viewing this chat
          io.to(`session:${sessionId}`).emit('chat:user_blocked', {
            sessionId,
            reason,
            message: messages.es,
            messageEn: messages.en,
          });
          
          // Emit chat:closed GLOBALLY so all agents see the chat move to closed
          io.emit('chat:closed', {
            sessionId,
            reason: messages.es,
            closedBy: 'system',
            closedAt: new Date().toISOString(),
            session: closedSession ? {
              _id: closedSession._id?.toString(),
              sessionId: closedSession.sessionId,
              status: closedSession.status,
              closedAt: closedSession.closedAt,
              closedByType: 'system',
              closeReason: 'user_blocked',
            } : undefined,
          });
          
          // Also emit session:closed for any listeners using that event
          io.emit('session:closed', sessionId);
        }
        
        logger.info('telegram-error-handler', {
          action: 'session_closed_due_to_block',
          sessionId,
          telegramId,
          reason,
        });
      } catch (err) {
        logger.error('telegram-error-handler', {
          action: 'close_session_error',
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  },
  
  /**
   * Check if a user can receive messages by calling getChat
   * Returns true if the bot can send messages to this user
   */
  async canSendToUser(telegramId: number): Promise<{ canSend: boolean; reason?: UserBlockReason }> {
    try {
      const url = TELEGRAM_API.getUrl('getChat');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramId }),
      });
      
      const data = await response.json() as { ok: boolean; result?: any; description?: string };
      
      if (data.ok) {
        // Update last check time
        await User.findOneAndUpdate(
          { telegramId },
          { $set: { lastBlockCheck: new Date() } }
        );
        
        // If user was previously marked as blocked, unmark them
        const user = await User.findOne({ telegramId });
        if (user?.hasBlockedBot) {
          await this.markUserUnblocked(telegramId);
        }
        
        return { canSend: true };
      }
      
      // Check the error
      const errorMessage = data.description || '';
      const { isBlocking, reason } = isBlockingError(errorMessage);
      
      if (isBlocking && reason) {
        await this.markUserBlocked(telegramId, reason);
        return { canSend: false, reason };
      }
      
      // Unknown error - assume can't send
      return { canSend: false, reason: 'bot_blocked' };
    } catch (error) {
      logger.error('telegram-error-handler', {
        action: 'can_send_check_error',
        telegramId,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // On error, return cached status from database
      const user = await User.findOne({ telegramId });
      if (user?.hasBlockedBot) {
        return { canSend: false, reason: user.blockReason || 'bot_blocked' };
      }
      
      // Assume can send if we don't have information
      return { canSend: true };
    }
  },
  
  /**
   * Get the block status of a user from database
   */
  async getUserBlockStatus(telegramId: number): Promise<{
    isBlocked: boolean;
    reason?: UserBlockReason;
    blockedAt?: Date;
  }> {
    const user = await User.findOne({ telegramId }).select('hasBlockedBot blockReason blockedAt');
    
    if (!user) {
      return { isBlocked: false };
    }
    
    return {
      isBlocked: user.hasBlockedBot || false,
      reason: user.blockReason,
      blockedAt: user.blockedAt,
    };
  },
};

export default telegramErrorHandler;

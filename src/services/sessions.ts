/**
 * Session Manager for User Conversations
 * In-memory storage for user sessions (can be replaced with Redis for production)
 */

import { ConversationState } from '../config/index.js';
import type { UserSession, Language, TelegramUser } from '../types/index.js';

// In-memory session store
const sessions = new Map<number, UserSession>();

// Session timeout: 24 hours
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000;

/**
 * Get or create a session for a user
 */
export function getSession(user: TelegramUser, chatId: number): UserSession {
  const existing = sessions.get(chatId);
  
  if (existing) {
    // Update last activity
    existing.lastActivity = Date.now();
    return existing;
  }
  
  // Detect language from Telegram settings
  const detectedLang: Language = user.language_code?.startsWith('es') ? 'es' : 'en';
  
  // Create new session
  const session: UserSession = {
    chatId,
    userId: user.id,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    language: detectedLang,
    state: ConversationState.IDLE,
    lastActivity: Date.now(),
    messageCount: 0,
    lastMessageTime: 0,
  };
  
  sessions.set(chatId, session);
  return session;
}

/**
 * Update session state
 */
export function updateSessionState(chatId: number, state: ConversationState): void {
  const session = sessions.get(chatId);
  if (session) {
    session.state = state;
    session.lastActivity = Date.now();
  }
}

/**
 * Update session language
 */
export function updateSessionLanguage(chatId: number, language: Language): void {
  const session = sessions.get(chatId);
  if (session) {
    session.language = language;
  }
}

/**
 * Update ticket draft in session
 */
export function updateTicketDraft(chatId: number, updates: Partial<UserSession['currentTicket']>): void {
  const session = sessions.get(chatId);
  if (session) {
    session.currentTicket = { ...session.currentTicket, ...updates };
  }
}

/**
 * Clear ticket draft
 */
export function clearTicketDraft(chatId: number): void {
  const session = sessions.get(chatId);
  if (session) {
    session.currentTicket = undefined;
  }
}

/**
 * Reset session to idle state
 */
export function resetSession(chatId: number): void {
  const session = sessions.get(chatId);
  if (session) {
    session.state = ConversationState.IDLE;
    session.currentTicket = undefined;
  }
}

/**
 * Track message for rate limiting
 */
export function trackMessage(chatId: number): { allowed: boolean; tooFast: boolean } {
  const session = sessions.get(chatId);
  if (!session) {
    return { allowed: true, tooFast: false };
  }
  
  const now = Date.now();
  const timeSinceLastMessage = now - session.lastMessageTime;
  
  // Check if messages are coming too fast (spam protection)
  if (timeSinceLastMessage < 500) {
    return { allowed: false, tooFast: true };
  }
  
  // Reset counter every minute
  if (timeSinceLastMessage > 60000) {
    session.messageCount = 0;
  }
  
  session.messageCount++;
  session.lastMessageTime = now;
  
  // Rate limit: 30 messages per minute
  if (session.messageCount > 30) {
    return { allowed: false, tooFast: false };
  }
  
  return { allowed: true, tooFast: false };
}

/**
 * Cleanup expired sessions
 */
export function cleanupSessions(): void {
  const now = Date.now();
  
  for (const [chatId, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(chatId);
    }
  }
}

/**
 * Get session stats
 */
export function getSessionStats(): { total: number; byState: Record<string, number> } {
  const stats = {
    total: sessions.size,
    byState: {} as Record<string, number>,
  };
  
  for (const session of sessions.values()) {
    stats.byState[session.state] = (stats.byState[session.state] || 0) + 1;
  }
  
  return stats;
}

// Cleanup expired sessions every hour
setInterval(cleanupSessions, 60 * 60 * 1000);

/**
 * Settings Routes
 * API endpoints for user account, preferences, security, and activity
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { Agent } from '../database/models/Agent.js';
import { 
  AgentPreferences, 
  getOrCreatePreferences,
  type IAgentPreferences 
} from '../database/models/AgentPreferences.js';
import { 
  AgentSession, 
  getActiveSessions, 
  invalidateSession,
  invalidateAllSessionsExcept 
} from '../database/models/AgentSession.js';
import { 
  AgentActivity, 
  logActivity, 
  getRecentActivities 
} from '../database/models/AgentActivity.js';
import { updateAgentPassword } from '../services/agent.service.js';
import { logger } from '../services/logger.js';
import crypto from 'crypto';

// ============= TYPES =============

interface UpdateProfileBody {
  name?: string;
  lastName?: string;
  avatar?: string;
  language?: string;
  timezone?: string;
}

interface UpdatePreferencesBody {
  theme?: 'light' | 'dark' | 'system';
  focusMode?: boolean;
  language?: string;
  timezone?: string;
  sounds?: {
    enabled?: boolean;
    newChat?: boolean;
    newMessage?: boolean;
    mention?: boolean;
    volume?: number;
  };
  autoScroll?: boolean;
  enterToSend?: boolean;
  showTypingIndicator?: boolean;
  markAsReadOnOpen?: boolean;
  shortcutsEnabled?: boolean;
  desktopNotifications?: boolean;
}

interface UpdateNotificationsBody {
  email?: {
    newChat?: boolean;
    chatReassigned?: boolean;
    chatTransferred?: boolean;
    mentioned?: boolean;
    negativeSurvey?: boolean;
  };
  inApp?: {
    newChat?: boolean;
    chatReassigned?: boolean;
    chatTransferred?: boolean;
    mentioned?: boolean;
    negativeSurvey?: boolean;
  };
  telegram?: {
    newChat?: boolean;
    chatReassigned?: boolean;
    chatTransferred?: boolean;
    mentioned?: boolean;
    negativeSurvey?: boolean;
  };
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

interface SessionParams {
  sessionId: string;
}

// ============= ROUTES =============

export async function registerSettingsRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ==================== ACCOUNT ====================

  /**
   * Get current agent's full profile
   */
  fastify.get('/api/settings/account', async (request) => {
    const agent = request.agent!;
    
    return { 
      ok: true, 
      account: {
        _id: agent._id,
        name: agent.name,
        email: agent.email,
        avatar: agent.avatar,
        role: agent.role,
        onlineStatus: agent.onlineStatus,
        activeChats: agent.activeChats,
        totalChatsHandled: agent.totalChatsHandled,
        lastLogin: agent.lastLogin,
        createdAt: agent.createdAt,
      }
    };
  });

  /**
   * Update current agent's profile
   */
  fastify.patch<{ Body: UpdateProfileBody }>('/api/settings/account', async (request, reply) => {
    const agentId = request.agent!._id.toString();
    const { name, lastName, avatar, language, timezone } = request.body;
    
    const updateData: any = {};
    if (name) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;
    
    const agent = await Agent.findByIdAndUpdate(
      agentId,
      { $set: updateData },
      { new: true }
    );
    
    if (!agent) {
      return reply.code(404).send({ ok: false, error: 'Agent not found' });
    }
    
    // Update preferences if language/timezone provided
    if (language || timezone) {
      const prefs = await getOrCreatePreferences(agentId);
      if (language) prefs.language = language;
      if (timezone) prefs.timezone = timezone;
      await prefs.save();
    }
    
    // Log activity
    await logActivity(agentId, 'profile_updated', 'Profile updated', {
      ip: request.ip,
    });
    
    logger.info('settings', { action: 'profile_updated', agentId });
    
    return { ok: true, agent };
  });

  // ==================== PREFERENCES ====================

  /**
   * Get current agent's preferences
   */
  fastify.get('/api/settings/preferences', async (request) => {
    const agentId = request.agent!._id.toString();
    const prefs = await getOrCreatePreferences(agentId);
    
    return { ok: true, preferences: prefs };
  });

  /**
   * Update current agent's preferences
   */
  fastify.patch<{ Body: UpdatePreferencesBody }>('/api/settings/preferences', async (request, reply) => {
    const agentId = request.agent!._id.toString();
    const updates = request.body;
    
    const prefs = await getOrCreatePreferences(agentId);
    
    // Update fields
    if (updates.theme !== undefined) prefs.theme = updates.theme;
    if (updates.focusMode !== undefined) prefs.focusMode = updates.focusMode;
    if (updates.language !== undefined) prefs.language = updates.language;
    if (updates.timezone !== undefined) prefs.timezone = updates.timezone;
    if (updates.autoScroll !== undefined) prefs.autoScroll = updates.autoScroll;
    if (updates.enterToSend !== undefined) prefs.enterToSend = updates.enterToSend;
    if (updates.showTypingIndicator !== undefined) prefs.showTypingIndicator = updates.showTypingIndicator;
    if (updates.markAsReadOnOpen !== undefined) prefs.markAsReadOnOpen = updates.markAsReadOnOpen;
    if (updates.shortcutsEnabled !== undefined) prefs.shortcutsEnabled = updates.shortcutsEnabled;
    if (updates.desktopNotifications !== undefined) prefs.desktopNotifications = updates.desktopNotifications;
    
    // Update sounds
    if (updates.sounds) {
      prefs.sounds = { ...prefs.sounds, ...updates.sounds };
    }
    
    await prefs.save();
    
    // Log activity
    await logActivity(agentId, 'settings_changed', 'Preferences updated', {
      ip: request.ip,
      metadata: { changedFields: Object.keys(updates) },
    });
    
    logger.info('settings', { action: 'preferences_updated', agentId });
    
    return { ok: true, preferences: prefs };
  });

  // ==================== NOTIFICATIONS ====================

  /**
   * Get notification settings
   */
  fastify.get('/api/settings/notifications', async (request) => {
    const agentId = request.agent!._id.toString();
    const prefs = await getOrCreatePreferences(agentId);
    
    return { 
      ok: true, 
      notifications: prefs.notifications,
      desktopNotifications: prefs.desktopNotifications,
    };
  });

  /**
   * Update notification settings
   */
  fastify.patch<{ Body: UpdateNotificationsBody }>('/api/settings/notifications', async (request, reply) => {
    const agentId = request.agent!._id.toString();
    const updates = request.body;
    
    const prefs = await getOrCreatePreferences(agentId);
    
    if (updates.email) {
      prefs.notifications.email = { ...prefs.notifications.email, ...updates.email };
    }
    if (updates.inApp) {
      prefs.notifications.inApp = { ...prefs.notifications.inApp, ...updates.inApp };
    }
    if (updates.telegram) {
      prefs.notifications.telegram = { ...prefs.notifications.telegram, ...updates.telegram };
    }
    
    prefs.markModified('notifications');
    await prefs.save();
    
    logger.info('settings', { action: 'notifications_updated', agentId });
    
    return { ok: true, notifications: prefs.notifications };
  });

  // ==================== SECURITY ====================

  /**
   * Change password
   */
  fastify.post<{ Body: ChangePasswordBody }>('/api/settings/security/password', async (request, reply) => {
    const agentId = request.agent!._id.toString();
    const { currentPassword, newPassword } = request.body;
    
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ ok: false, error: 'Current and new password required' });
    }
    
    if (newPassword.length < 8) {
      return reply.code(400).send({ ok: false, error: 'Password must be at least 8 characters' });
    }
    
    // Verify current password
    const agent = await Agent.findById(agentId).select('+password');
    
    if (!agent) {
      return reply.code(404).send({ ok: false, error: 'Agent not found' });
    }
    
    const isValid = await agent.comparePassword(currentPassword);
    
    if (!isValid) {
      return reply.code(401).send({ ok: false, error: 'Current password is incorrect' });
    }
    
    await updateAgentPassword(agentId, newPassword);
    
    // Log activity
    await logActivity(agentId, 'password_changed', 'Password changed', {
      ip: request.ip,
    });
    
    logger.info('settings', { action: 'password_changed', agentId });
    
    return { ok: true, message: 'Password updated successfully' };
  });

  /**
   * Get active sessions
   */
  fastify.get('/api/settings/security/sessions', async (request) => {
    const agentId = request.agent!._id.toString();
    const sessions = await getActiveSessions(agentId);
    
    // Get current session token hash
    const token = request.headers.authorization?.replace('Bearer ', '') || '';
    const currentTokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
    
    // Mark current session
    const sessionsWithCurrent = sessions.map(s => ({
      ...s,
      isCurrent: s.token === currentTokenHash,
    }));
    
    return { ok: true, sessions: sessionsWithCurrent };
  });

  /**
   * Revoke a specific session
   */
  fastify.delete<{ Params: SessionParams }>('/api/settings/security/sessions/:sessionId', async (request, reply) => {
    const agentId = request.agent!._id.toString();
    const { sessionId } = request.params;
    
    const success = await invalidateSession(sessionId, agentId);
    
    if (!success) {
      return reply.code(404).send({ ok: false, error: 'Session not found' });
    }
    
    logger.info('settings', { action: 'session_revoked', agentId, sessionId });
    
    return { ok: true };
  });

  /**
   * Revoke all other sessions
   */
  fastify.post('/api/settings/security/sessions/revoke-others', async (request) => {
    const agentId = request.agent!._id.toString();
    
    // Get current session token hash
    const token = request.headers.authorization?.replace('Bearer ', '') || '';
    const currentTokenHash = crypto.createHash('sha256').update(token).digest('hex').substring(0, 32);
    
    const revokedCount = await invalidateAllSessionsExcept(agentId, currentTokenHash);
    
    logger.info('settings', { action: 'all_sessions_revoked', agentId, revokedCount });
    
    return { ok: true, revokedCount };
  });

  // ==================== ACTIVITY ====================

  /**
   * Get recent activity
   */
  fastify.get('/api/settings/activity', async (request) => {
    const agentId = request.agent!._id.toString();
    const activities = await getRecentActivities(agentId, 100);
    
    return { ok: true, activities };
  });

  /**
   * Get activity summary (stats)
   */
  fastify.get('/api/settings/activity/summary', async (request) => {
    const agentId = request.agent!._id.toString();
    
    // Get last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const stats = await AgentActivity.aggregate([
      { 
        $match: { 
          agentId: request.agent!._id,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const summary = stats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {} as Record<string, number>);
    
    return { ok: true, summary };
  });
}

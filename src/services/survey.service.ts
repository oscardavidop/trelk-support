/**
 * Survey Service - Post-chat satisfaction surveys using Telegram native polls
 */

import { ChatSession, type IChatSession, type SatisfactionLevel } from '../database/index.js';
import { Agent } from '../database/models/Agent.js';
import { AuditLog } from '../database/models/AuditLog.js';
import { getIO } from './socket.js';
import { sendPoll, type SendPollResult } from './telegram.js';

// Survey configuration
const SURVEY_CONFIG = {
  question: '¿Cómo calificarías la atención recibida?',
  options: [
    '⭐⭐⭐⭐⭐ Excelente',
    '⭐⭐⭐⭐ Buena',
    '⭐⭐⭐ Regular',
    '⭐⭐ Mala',
    '⭐ Muy mala',
  ],
  openPeriod: 600, // 10 minutes
};

// Map option index to satisfaction level
const SATISFACTION_MAP: Record<number, SatisfactionLevel> = {
  0: 'positive',  // Excelente
  1: 'positive',  // Buena
  2: 'neutral',   // Regular
  3: 'negative',  // Mala
  4: 'negative',  // Muy mala
};

// Map option index to rating (1-5)
const RATING_MAP: Record<number, number> = {
  0: 5, // Excelente
  1: 4, // Buena
  2: 3, // Regular
  3: 2, // Mala
  4: 1, // Muy mala
};

// Store pending polls for answer correlation
const pendingPolls = new Map<string, string>(); // pollId -> sessionId

/**
 * Check if survey can be sent for a session
 */
async function canSendSurvey(session: IChatSession): Promise<{ canSend: boolean; reason?: string }> {
  // Already sent
  if (session.postChatSurvey?.sent) {
    return { canSend: false, reason: 'Survey already sent for this session' };
  }

  // Session was reopened - no new survey
  if (session.reopenCount > 0 && session.reopenedAt) {
    return { canSend: false, reason: 'Session was reopened, no duplicate survey' };
  }

  // Must be closed
  if (session.status !== 'closed') {
    return { canSend: false, reason: 'Session is not closed' };
  }

  // Must have valid close type
  const validCloseTypes = ['agent', 'system'];
  if (!session.closedByType || !validCloseTypes.includes(session.closedByType)) {
    return { canSend: false, reason: 'Invalid close type for survey' };
  }

  return { canSend: true };
}

/**
 * Send satisfaction survey to user
 */
export async function sendPostChatSurvey(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      return { success: false, error: 'Session not found' };
    }

    // Check if survey can be sent
    const { canSend, reason } = await canSendSurvey(session);
    if (!canSend) {
      console.log(`[Survey] Cannot send for ${sessionId}: ${reason}`);
      return { success: false, error: reason };
    }

    // Only send survey for telegram sessions
    if (!session.telegramChatId) {
      console.log(`[Survey] Cannot send for ${sessionId}: not a telegram session`);
      return { success: false, error: 'Not a telegram session' };
    }

    // Send the poll using Telegram API
    const result = await sendPoll(
      session.telegramChatId,
      SURVEY_CONFIG.question,
      SURVEY_CONFIG.options,
      {
        type: 'regular',
        is_anonymous: false,
        allows_multiple_answers: false,
        open_period: SURVEY_CONFIG.openPeriod,
        disable_notification: true,
        protect_content: true,
      }
    );

    if (!result) {
      // Failed to send - might be blocked
      await ChatSession.updateOne(
        { sessionId },
        {
          $set: {
            'postChatSurvey.sent': true,
            'postChatSurvey.failed': true,
            'postChatSurvey.failReason': 'Failed to send poll',
            'postChatSurvey.sentAt': new Date(),
          },
        }
      );
      return { success: false, error: 'Failed to send poll' };
    }

    // Store poll ID for answer correlation
    pendingPolls.set(result.poll.id, sessionId);

    // Update session with survey info
    await ChatSession.updateOne(
      { sessionId },
      {
        $set: {
          'postChatSurvey.sent': true,
          'postChatSurvey.pollId': result.poll.id,
          'postChatSurvey.messageId': result.message_id,
          'postChatSurvey.sentAt': new Date(),
          'postChatSurvey.answered': false,
        },
      }
    );

    console.log(`[Survey] Sent poll ${result.poll.id} for session ${sessionId}`);

    // Emit event to dashboard
    const io = getIO();
    if (io) {
      io.emit('survey:sent', { 
        sessionId, 
        pollId: result.poll.id,
        sentAt: new Date(),
      });
    }

    // Schedule poll expiration check
    setTimeout(async () => {
      await handlePollExpired(result.poll.id, sessionId);
    }, (SURVEY_CONFIG.openPeriod + 10) * 1000); // Add 10s buffer

    return { success: true };

  } catch (error: any) {
    console.error(`[Survey] Failed to send for ${sessionId}:`, error);

    // Handle specific Telegram errors
    const errorMsg = error.message || String(error);
    const isBotBlocked = errorMsg.includes('bot was blocked') || 
                         errorMsg.includes('user is deactivated') ||
                         errorMsg.includes('chat not found');

    if (isBotBlocked) {
      await ChatSession.updateOne(
        { sessionId },
        {
          $set: {
            'postChatSurvey.sent': true,
            'postChatSurvey.failed': true,
            'postChatSurvey.failReason': 'User blocked bot or chat not found',
            'postChatSurvey.sentAt': new Date(),
          },
        }
      );
    }

    return { success: false, error: error.message };
  }
}

/**
 * Handle poll answer from Telegram
 */
export async function handlePollAnswer(pollId: string, optionIndexes: number[], telegramUserId: number): Promise<void> {
  try {
    // Get session ID from pending polls
    let sessionId = pendingPolls.get(pollId);

    // If not in memory, search in database
    if (!sessionId) {
      const session = await ChatSession.findOne({ 'postChatSurvey.pollId': pollId });
      if (session) {
        sessionId = session.sessionId;
      }
    }

    if (!sessionId) {
      console.log(`[Survey] Poll ${pollId} not found in pending polls`);
      return;
    }

    const session = await ChatSession.findOne({ sessionId });
    if (!session) {
      console.log(`[Survey] Session ${sessionId} not found`);
      return;
    }

    // Deduplicate - check if already answered
    if (session.postChatSurvey?.answered) {
      console.log(`[Survey] Poll ${pollId} already answered, ignoring duplicate`);
      return;
    }

    const optionIndex = optionIndexes[0]; // Only one answer allowed
    const label = SURVEY_CONFIG.options[optionIndex];
    const satisfaction = SATISFACTION_MAP[optionIndex];
    const rating = RATING_MAP[optionIndex];

    // Update session
    await ChatSession.updateOne(
      { sessionId },
      {
        $set: {
          'postChatSurvey.answered': true,
          'postChatSurvey.answer': {
            optionIndex,
            label,
            receivedAt: new Date(),
          },
          satisfaction,
          rating,
        },
      }
    );

    // Remove from pending polls
    pendingPolls.delete(pollId);

    console.log(`[Survey] Received answer for ${sessionId}: ${label} (${satisfaction})`);

    // Update agent metrics if assigned
    if (session.assignedAgent) {
      await updateAgentRating(session.assignedAgent.toString(), rating);
    }

    // Check for low rating alerts
    if (optionIndex >= 3) { // Mala or Muy mala
      await triggerLowRatingAlert(session, optionIndex, label);
    }

    // Emit event to dashboard
    const io = getIO();
    if (io) {
      io.emit('survey:answered', {
        sessionId,
        rating,
        satisfaction,
        label,
        answeredAt: new Date(),
      });
    }

  } catch (error) {
    console.error(`[Survey] Error handling poll answer for ${pollId}:`, error);
  }
}

/**
 * Handle poll expiration
 */
async function handlePollExpired(pollId: string, sessionId: string): Promise<void> {
  try {
    const session = await ChatSession.findOne({ sessionId });
    if (!session) return;

    // Only mark as expired if not answered
    if (session.postChatSurvey?.sent && !session.postChatSurvey?.answered) {
      console.log(`[Survey] Poll ${pollId} expired without answer`);
      
      // Remove from pending
      pendingPolls.delete(pollId);

      // Note: We don't update DB because poll might still be answered
      // Telegram handles the actual expiration
    }
  } catch (error) {
    console.error(`[Survey] Error handling poll expiration:`, error);
  }
}

/**
 * Update agent's average rating
 */
async function updateAgentRating(agentId: string, rating: number): Promise<void> {
  try {
    // Get all ratings for this agent
    const sessions = await ChatSession.find({
      assignedAgent: agentId,
      rating: { $exists: true, $ne: null },
    }).select('rating');

    if (sessions.length === 0) return;

    const totalRating = sessions.reduce((sum, s) => sum + (s.rating || 0), 0);
    const avgRating = totalRating / sessions.length;

    await Agent.updateOne(
      { _id: agentId },
      {
        $set: {
          'metrics.averageRating': Math.round(avgRating * 100) / 100,
          'metrics.totalRatings': sessions.length,
        },
      }
    );

    console.log(`[Survey] Updated agent ${agentId} rating: ${avgRating.toFixed(2)} (${sessions.length} ratings)`);

  } catch (error) {
    console.error(`[Survey] Error updating agent rating:`, error);
  }
}

/**
 * Trigger alert for low rating
 */
async function triggerLowRatingAlert(session: IChatSession, optionIndex: number, label: string): Promise<void> {
  try {
    // Create audit log
    await AuditLog.create({
      action: 'low_rating_alert',
      targetType: 'chat',
      targetId: session._id,
      description: `Low satisfaction rating: ${label}`,
      metadata: {
        sessionId: session.sessionId,
        rating: RATING_MAP[optionIndex],
        optionIndex,
        label,
        assignedAgent: session.assignedAgent?.toString(),
      },
      severity: optionIndex === 4 ? 'high' : 'medium',
    });

    // Emit alert to supervisors
    const io = getIO();
    if (io) {
      io.to('supervisors').emit('alert:low-rating', {
        sessionId: session.sessionId,
        agentId: session.assignedAgent?.toString() || '',
        agentName: 'Unknown', // Will be populated by client if needed
        rating: RATING_MAP[optionIndex],
        ratingLabel: label,
        userName: `User ${session.telegramChatId}`,
        answeredAt: new Date(),
      });
    }

    console.log(`[Survey] Low rating alert triggered for session ${session.sessionId}`);

  } catch (error) {
    console.error(`[Survey] Error triggering low rating alert:`, error);
  }
}

/**
 * Survey statistics filter options
 */
export interface SurveyStatsFilters {
  startDate?: Date;
  endDate?: Date;
  agentId?: string;
}

/**
 * Get survey statistics
 */
export async function getSurveyStats(filters?: SurveyStatsFilters): Promise<{
  total: number;
  sent: number;
  answered: number;
  responseRate: number;
  averageRating: number;
  distribution: Record<string, number>;
  byAgent: Array<{ agentId: string; agentName: string; avgRating: number; count: number }>;
}> {
  const query: any = {};

  if (filters?.startDate || filters?.endDate) {
    query.closedAt = {};
    if (filters.startDate) query.closedAt.$gte = filters.startDate;
    if (filters.endDate) query.closedAt.$lte = filters.endDate;
  }

  if (filters?.agentId) {
    query.assignedAgent = filters.agentId;
  }

  query.status = 'closed';

  const sessions = await ChatSession.find(query)
    .populate('assignedAgent', 'name')
    .select('postChatSurvey satisfaction rating assignedAgent');

  const sent = sessions.filter(s => s.postChatSurvey?.sent).length;
  const answered = sessions.filter(s => s.postChatSurvey?.answered).length;

  const ratings = sessions.filter(s => s.rating).map(s => s.rating!);
  const averageRating = ratings.length > 0 
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
    : 0;

  // Distribution by option
  const distribution: Record<string, number> = {
    'Excelente': 0,
    'Buena': 0,
    'Regular': 0,
    'Mala': 0,
    'Muy mala': 0,
  };

  sessions.forEach(s => {
    if (s.postChatSurvey?.answer?.label) {
      const key = s.postChatSurvey.answer.label.replace(/⭐+\s*/g, '').trim();
      if (key in distribution) {
        distribution[key]++;
      }
    }
  });

  // By agent
  const agentMap = new Map<string, { name: string; ratings: number[] }>();
  sessions.forEach(s => {
    if (s.assignedAgent && s.rating) {
      const agentId = s.assignedAgent._id?.toString() || s.assignedAgent.toString();
      const agentName = (s.assignedAgent as any).name || 'Unknown';
      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, { name: agentName, ratings: [] });
      }
      agentMap.get(agentId)!.ratings.push(s.rating);
    }
  });

  const byAgent = Array.from(agentMap.entries()).map(([agentId, data]) => ({
    agentId,
    agentName: data.name,
    avgRating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length,
    count: data.ratings.length,
  })).sort((a, b) => b.avgRating - a.avgRating);

  return {
    total: sessions.length,
    sent,
    answered,
    responseRate: sent > 0 ? (answered / sent) * 100 : 0,
    averageRating: Math.round(averageRating * 100) / 100,
    distribution,
    byAgent,
  };
}

/**
 * Restore pending polls from database on restart
 */
export async function restorePendingPolls(): Promise<void> {
  try {
    const sessions = await ChatSession.find({
      'postChatSurvey.sent': true,
      'postChatSurvey.answered': false,
      'postChatSurvey.pollId': { $exists: true },
      'postChatSurvey.sentAt': { 
        $gte: new Date(Date.now() - SURVEY_CONFIG.openPeriod * 1000) 
      },
    });

    for (const session of sessions) {
      if (session.postChatSurvey?.pollId) {
        pendingPolls.set(session.postChatSurvey.pollId, session.sessionId);
      }
    }

    console.log(`[Survey] Restored ${sessions.length} pending polls from database`);

  } catch (error) {
    console.error('[Survey] Error restoring pending polls:', error);
  }
}

export { SURVEY_CONFIG, SATISFACTION_MAP, RATING_MAP };

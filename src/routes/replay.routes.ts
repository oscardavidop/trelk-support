/**
 * Chat Replay Routes
 * Enterprise QA feature — replay chat sessions with real timing, events & metrics
 * Accessible by admin/supervisor only
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { ChatSession, Message } from '../database/index.js';
import { ActivityLog } from '../database/models/ActivityLog.js';
import { Transfer } from '../database/models/Transfer.js';
import { logger } from '../services/logger.js';

interface ReplayParams {
  sessionId: string;
}

/**
 * A unified timeline item used by the replay engine.
 * `kind` differentiates messages from system events.
 */
interface ReplayTimelineItem {
  id: string;
  kind: 'message' | 'event';
  timestamp: string;
  // Message fields
  sender?: 'user' | 'bot' | 'agent' | 'system';
  senderAgent?: { name: string; avatar?: string };
  content?: string;
  messageType?: string;
  mediaUrl?: string;
  fileName?: string;
  replyToMessage?: { _id: string; sender: string; content: string; senderAgent?: { name: string } };
  isEdited?: boolean;
  isPinned?: boolean;
  // Event fields
  eventAction?: string;
  eventDescription?: string;
  eventActor?: { type: string; name?: string };
  eventColor?: string;
  eventIcon?: string;
  eventMetadata?: Record<string, unknown>;
}

interface ReplayMetrics {
  totalDuration: number;       // ms between first and last item
  totalMessages: number;
  userMessages: number;
  agentMessages: number;
  botMessages: number;
  systemEvents: number;
  avgAgentResponseTime: number; // ms
  maxSilenceGap: number;       // ms
  firstResponseTime: number;   // ms from first user msg to first agent msg
  transfers: number;
}

export async function replayRoutes(fastify: FastifyInstance): Promise<void> {

  // Auth required + admin/supervisor guard
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const agent = (request as any).agent;
    if (!agent || !['admin', 'supervisor'].includes(agent.role)) {
      return reply.code(403).send({ ok: false, error: 'Supervisor or Admin access required' });
    }
  });

  // ============= GET FULL REPLAY DATA =============
  fastify.get<{ Params: ReplayParams }>('/api/replay/:sessionId', async (request, reply) => {
    try {
      const { sessionId } = request.params;

      // 1. Get session
      const session = await ChatSession.findOne({ sessionId })
        .populate('assignedAgent', 'name avatar email role')
        .populate('closedBy', 'name avatar')
        .populate('user')
        .lean();

      if (!session) {
        return reply.code(404).send({ ok: false, error: 'Session not found' });
      }

      // 2. Get ALL messages (no pagination — replay needs everything)
      const messages = await Message.find({ session: session._id })
        .populate('senderAgent', 'name avatar')
        .populate('replyTo', 'sender content senderAgent')
        .sort({ createdAt: 1 })
        .lean();

      // 3. Get ALL activity events
      const activities = await ActivityLog.find({ sessionId })
        .sort({ createdAt: 1 })
        .lean();

      // 4. Get transfers
      const transfers = await Transfer.find({ session: session._id })
        .populate('fromAgent', 'name avatar')
        .populate('toAgent', 'name avatar')
        .sort({ transferredAt: 1 })
        .lean();

      // 5. Build unified timeline
      const timeline: ReplayTimelineItem[] = [];

      // Add messages
      for (const msg of messages) {
        timeline.push({
          id: msg._id.toString(),
          kind: 'message',
          timestamp: (msg as any).createdAt.toISOString(),
          sender: msg.sender as any,
          senderAgent: msg.senderAgent as any,
          content: msg.content,
          messageType: msg.messageType,
          mediaUrl: msg.mediaUrl,
          fileName: (msg as any).fileName,
          replyToMessage: msg.replyTo ? {
            _id: (msg.replyTo as any)._id?.toString(),
            sender: (msg.replyTo as any).sender,
            content: (msg.replyTo as any).content,
            senderAgent: (msg.replyTo as any).senderAgent,
          } : undefined,
          isEdited: (msg as any).isEdited || false,
          isPinned: (msg as any).isPinned || false,
        });
      }

      // Add activity events (exclude message_sent to avoid duplicates)
      const eventSkip = new Set(['message_sent', 'message_edited', 'message_deleted', 'message_pinned']);
      for (const act of activities) {
        if (eventSkip.has(act.action)) continue;
        timeline.push({
          id: act._id.toString(),
          kind: 'event',
          timestamp: (act as any).createdAt.toISOString(),
          eventAction: act.action,
          eventDescription: act.description,
          eventActor: act.actor ? { type: act.actor.type, name: act.actor.name } : undefined,
          eventColor: act.color || 'gray',
          eventIcon: act.icon,
          eventMetadata: act.metadata as Record<string, unknown>,
        });
      }

      // Add transfer events if not already in activities
      for (const t of transfers) {
        const fromName = (t.fromAgent as any)?.name || 'Agente';
        const toName = (t.toAgent as any)?.name || 'Agente';
        timeline.push({
          id: `transfer-${t._id.toString()}`,
          kind: 'event',
          timestamp: t.transferredAt.toISOString(),
          eventAction: 'session_transferred',
          eventDescription: `Transferido de ${fromName} a ${toName}: ${t.reason}`,
          eventActor: { type: 'agent', name: fromName },
          eventColor: 'yellow',
          eventIcon: '🔄',
          eventMetadata: {
            fromAgent: fromName,
            toAgent: toName,
            reason: t.reason,
            status: t.status,
          },
        });
      }

      // Sort by timestamp
      timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // De-duplicate transfer events (activity log may also have one)
      const seen = new Set<string>();
      const deduped: ReplayTimelineItem[] = [];
      for (const item of timeline) {
        // For transfer events, key by action+timestamp rounded to second
        if (item.eventAction === 'session_transferred') {
          const key = `transfer-${Math.floor(new Date(item.timestamp).getTime() / 1000)}`;
          if (seen.has(key)) continue;
          seen.add(key);
        }
        deduped.push(item);
      }

      // 6. Compute metrics
      const metrics = computeMetrics(deduped, transfers.length);

      // 7. Build session info
      const sessionInfo = {
        sessionId: session.sessionId,
        channel: session.channel,
        status: session.status,
        createdAt: (session as any).createdAt,
        closedAt: session.closedAt,
        closedByType: session.closedByType,
        closeReason: session.closeReason,
        closureReason: session.closureReason,
        assignedAgent: session.assignedAgent ? {
          name: (session.assignedAgent as any).name,
          avatar: (session.assignedAgent as any).avatar,
        } : null,
        closedBy: session.closedBy ? {
          name: (session.closedBy as any).name,
        } : null,
        user: session.user ? {
          firstName: (session.user as any).firstName,
          lastName: (session.user as any).lastName,
          username: (session.user as any).username,
        } : null,
        tags: (session as any).tags || [],
        category: (session as any).category,
        priority: (session as any).priority,
        rating: (session as any).rating,
        satisfaction: (session as any).satisfaction,
        firstResponseAt: (session as any).firstResponseAt,
        disposition: (session as any).disposition,
      };

      return reply.send({
        ok: true,
        data: {
          session: sessionInfo,
          timeline: deduped,
          metrics,
          totalItems: deduped.length,
        },
      });
    } catch (error) {
      logger.error('error', { error: (error as Error).message, sessionId: request.params.sessionId });
      return reply.code(500).send({ ok: false, error: 'Failed to load replay data' });
    }
  });

  // ============= EXPORT REPLAY JSON =============
  fastify.get<{ Params: ReplayParams }>('/api/replay/:sessionId/export', async (request, reply) => {
    try {
      const { sessionId } = request.params;

      const session = await ChatSession.findOne({ sessionId })
        .populate('assignedAgent', 'name email role')
        .populate('closedBy', 'name')
        .populate('user')
        .lean();

      if (!session) {
        return reply.code(404).send({ ok: false, error: 'Session not found' });
      }

      const messages = await Message.find({ session: session._id })
        .populate('senderAgent', 'name')
        .sort({ createdAt: 1 })
        .lean();

      const activities = await ActivityLog.find({ sessionId })
        .sort({ createdAt: 1 })
        .lean();

      const transfers = await Transfer.find({ session: session._id })
        .populate('fromAgent', 'name')
        .populate('toAgent', 'name')
        .sort({ transferredAt: 1 })
        .lean();

      const exportData = {
        exportedAt: new Date().toISOString(),
        exportedBy: (request as any).agent?.name || 'Unknown',
        session: {
          sessionId: session.sessionId,
          channel: session.channel,
          status: session.status,
          createdAt: (session as any).createdAt,
          closedAt: session.closedAt,
          user: session.user ? { firstName: (session.user as any).firstName, username: (session.user as any).username } : null,
          assignedAgent: session.assignedAgent ? { name: (session.assignedAgent as any).name } : null,
          tags: (session as any).tags || [],
          category: (session as any).category,
          rating: (session as any).rating,
        },
        messages: messages.map(m => ({
          sender: m.sender,
          senderName: (m.senderAgent as any)?.name || (m.sender === 'user' ? (session.user as any)?.firstName : m.sender),
          content: m.content,
          messageType: m.messageType,
          createdAt: (m as any).createdAt,
        })),
        events: activities.map(a => ({
          action: a.action,
          description: a.description,
          actor: a.actor?.name || a.actor?.type,
          createdAt: (a as any).createdAt,
        })),
        transfers: transfers.map(t => ({
          from: (t.fromAgent as any)?.name,
          to: (t.toAgent as any)?.name,
          reason: t.reason,
          at: t.transferredAt,
        })),
      };

      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="replay-${sessionId}-${Date.now()}.json"`);
      return reply.send(exportData);
    } catch (error) {
      logger.error('error', { error: (error as Error).message });
      return reply.code(500).send({ ok: false, error: 'Export failed' });
    }
  });
}

// ============= METRICS COMPUTATION =============

function computeMetrics(timeline: ReplayTimelineItem[], transferCount: number): ReplayMetrics {
  const messages = timeline.filter(t => t.kind === 'message');
  const events = timeline.filter(t => t.kind === 'event');

  const userMsgs = messages.filter(m => m.sender === 'user');
  const agentMsgs = messages.filter(m => m.sender === 'agent');
  const botMsgs = messages.filter(m => m.sender === 'bot');

  // Total duration
  let totalDuration = 0;
  if (timeline.length >= 2) {
    totalDuration = new Date(timeline[timeline.length - 1].timestamp).getTime() -
                    new Date(timeline[0].timestamp).getTime();
  }

  // Avg agent response time: time between user message and next agent message
  const agentResponseTimes: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].sender === 'user') {
      // Find next agent message
      for (let j = i + 1; j < messages.length; j++) {
        if (messages[j].sender === 'agent') {
          const delta = new Date(messages[j].timestamp).getTime() - new Date(messages[i].timestamp).getTime();
          agentResponseTimes.push(delta);
          break;
        }
        if (messages[j].sender === 'user') break; // Another user msg, skip
      }
    }
  }
  const avgAgentResponseTime = agentResponseTimes.length > 0
    ? agentResponseTimes.reduce((a, b) => a + b, 0) / agentResponseTimes.length
    : 0;

  // Max silence gap between any two consecutive items
  let maxSilenceGap = 0;
  for (let i = 1; i < timeline.length; i++) {
    const gap = new Date(timeline[i].timestamp).getTime() - new Date(timeline[i - 1].timestamp).getTime();
    if (gap > maxSilenceGap) maxSilenceGap = gap;
  }

  // First response time: first user msg → first agent msg
  let firstResponseTime = 0;
  const firstUserMsg = messages.find(m => m.sender === 'user');
  const firstAgentMsg = messages.find(m => m.sender === 'agent');
  if (firstUserMsg && firstAgentMsg) {
    firstResponseTime = new Date(firstAgentMsg.timestamp).getTime() - new Date(firstUserMsg.timestamp).getTime();
  }

  return {
    totalDuration,
    totalMessages: messages.length,
    userMessages: userMsgs.length,
    agentMessages: agentMsgs.length,
    botMessages: botMsgs.length,
    systemEvents: events.length,
    avgAgentResponseTime,
    maxSilenceGap,
    firstResponseTime,
    transfers: transferCount,
  };
}

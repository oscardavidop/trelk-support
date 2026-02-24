/**
 * Reconciliation Service
 * Handles system recovery after crashes, agent disconnections, and reconnections
 * 
 * Principles:
 * - System never breaks
 * - All events are idempotent
 * - Backend is the source of truth
 * - Auto-recovery is automatic
 */

import { ChatSession } from '../database/models/ChatSession.js';
import { Agent } from '../database/models/Agent.js';
import { 
  reconcileAgentStates, 
  getOfflineAgentsWithChats,
  isWithinGracePeriod,
  getAvailableAgents,
  resetActiveChats,
  RECONNECTION_GRACE_MINUTES,
} from './agent.service.js';
import { addToQueue, getQueuedSessions, assignAgent } from './chat.service.js';
import { getIO } from './socket.js';
import { logger } from './logger.js';
import * as redis from './redis.js';
import type { IAgent } from '../database/models/Agent.js';
import type { IChatSession } from '../database/models/ChatSession.js';
import { Types } from 'mongoose';

// Convert minutes to milliseconds for setTimeout
const GRACE_PERIOD_MS = RECONNECTION_GRACE_MINUTES * 60 * 1000;

// Fast debounce for disconnect handler (handles page refresh / browser close)
// Sessions are moved to queue/reassigned after this short window.
// If agent reconnects BEFORE this fires, the pending key is deleted → no action.
// If agent reconnects AFTER (but within GRACE_PERIOD_MS), handleAgentReconnection
// restores sessions from the queue.
const QUICK_DEBOUNCE_MS = 10_000; // 10 seconds

/**
 * Full system reconciliation on server startup
 * Called after database connection is established
 */
export async function performFullReconciliation(): Promise<{
  agentsMarkedOffline: number;
  chatsRequeued: number;
  chatsReassigned: number;
}> {
  logger.info('api', { action: 'reconciliation_start' });
  
  let agentsMarkedOffline = 0;
  let chatsRequeued = 0;
  let chatsReassigned = 0;
  
  try {
    // 1. Mark all agents as offline (they need to reconnect)
    const offlineAgents = await reconcileAgentStates();
    agentsMarkedOffline = offlineAgents.length;
    
    // 2. Find all active sessions that were assigned to now-offline agents
    const orphanedSessions = await ChatSession.find({
      status: 'human',
      assignedAgent: { $in: offlineAgents.map(a => a._id) },
    });
    
    // 3. Move orphaned sessions to queue
    for (const session of orphanedSessions) {
      await addToQueue(session.sessionId);
      chatsRequeued++;
    }
    
    // 4. Reset active chat counts for all agents
    for (const agent of offlineAgents) {
      await resetActiveChats(agent._id.toString(), 0);
    }
    
    logger.info('api', { 
      action: 'reconciliation_complete',
      agentsMarkedOffline,
      chatsRequeued,
      chatsReassigned,
    });
    
  } catch (error) {
    logger.error('api', { 
      action: 'reconciliation_error', 
      error: String(error) 
    });
  }
  
  return { agentsMarkedOffline, chatsRequeued, chatsReassigned };
}

/**
 * Handle agent disconnection
 * Called when socket disconnects.
 *
 * Strategy:
 *  1. Mark agent offline, set a Redis "pending-reassign" key.
 *  2. During the grace window the agent can reconnect and recover their chats.
 *  3. If the agent is still offline after the grace period:
 *     a. Acquire a Redis distributed lock (idempotency / race-condition guard).
 *     b. For each assigned session, find the best available agent and reassign.
 *     c. If no agent is available, move the session to the queue.
 *     d. Emit the correct socket events so clients update instantly.
 */
export async function handleAgentDisconnection(agentId: string): Promise<{
  affectedSessions: IChatSession[];
  action: 'queued' | 'grace_period';
}> {
  const agent = await Agent.findById(agentId);
  if (!agent) {
    return { affectedSessions: [], action: 'queued' };
  }
  
  // Mark agent as offline
  await Agent.updateOne(
    { _id: agentId },
    {
      onlineStatus: 'offline',
      socketId: null,
      lastDisconnect: new Date(),
    }
  );

  // Set a Redis marker so handleAgentReconnection can cancel the pending work
  const pendingKey = `agent:pending_reassign:${agentId}`;
  if (redis.isRedisAvailable()) {
    const ttlSeconds = Math.ceil(GRACE_PERIOD_MS / 1000) + 30;
    await redis.set(pendingKey, '1', ttlSeconds);
  }

  // Find sessions assigned to this agent
  const affectedSessions = await ChatSession.find({
    status: 'human',
    assignedAgent: new Types.ObjectId(agentId),
  });

  logger.info('api', { 
    action: 'agent_disconnected_grace_period',
    agentId,
    sessionsKeptAssigned: affectedSessions.length,
    gracePeriodMs: GRACE_PERIOD_MS,
  });

  // After a short debounce, attempt reassignment (not just queueing).
  // A 10-second debounce handles page refreshes while keeping sessions
  // accessible to others almost immediately when the agent truly disconnects.
  setTimeout(async () => {
    try {
      // Check if agent reconnected during grace period (idempotency)
      if (redis.isRedisAvailable()) {
        const pending = await redis.get(pendingKey);
        if (!pending && isWithinGracePeriod(agent)) {
          logger.info('api', {
            action: 'grace_period_cancelled',
            agentId,
            reason: 'agent_reconnected',
          });
          return;
        }
      } else {
        // Redis not available: fall back to DB check
        const currentAgent = await Agent.findById(agentId).select('onlineStatus').lean();
        if (currentAgent?.onlineStatus !== 'offline') return;
      }

      // Acquire distributed lock to prevent double-processing
      const lockKey = `reassign:${agentId}`;
      const lockValue = `pid:${process.pid}:${Date.now()}`;
      const lockAcquired = await redis.acquireLock(lockKey, GRACE_PERIOD_MS + 30_000, lockValue);
      if (!lockAcquired) {
        logger.warn('api', { action: 'grace_period_lock_failed', agentId });
        return;
      }

      try {
        const stillAssigned = await ChatSession.find({
          status: 'human',
          assignedAgent: new Types.ObjectId(agentId),
        }).populate('user');

        if (stillAssigned.length === 0) return;

        const io = getIO();

        for (const session of stillAssigned) {
          // Try to find the best available agent (fewest active chats)
          const availableAgents = await getAvailableAgents();
          const bestAgent = availableAgents.find(a => a._id.toString() !== agentId);

          if (bestAgent) {
            // ── Reassign to available agent ──────────────────────────────
            const reassigned = await assignAgent(session.sessionId, bestAgent._id.toString(), bestAgent.name);
            if (reassigned) {
              // Re-fetch with user populated for proper socket payload
              const populated = await ChatSession.findOne({ sessionId: session.sessionId })
                .populate('user')
                .populate('assignedAgent')
                .lean();
              if (populated) {
                io.emit('session:updated', {
                  sessionId: populated.sessionId,
                  status: populated.status,
                  assignedAgent: {
                    _id: bestAgent._id.toString(),
                    name: bestAgent.name,
                  },
                  user: {
                    _id: (populated.user as any)?._id?.toString() || '',
                    telegramId: (populated.user as any)?.telegramId,
                    firstName: (populated.user as any)?.firstName || 'Unknown',
                    username: (populated.user as any)?.username,
                  },
                  createdAt: populated.createdAt,
                  updatedAt: new Date(),
                } as any);
              }

              // Notify the newly assigned agent via their live socket
              const io2 = getIO();
              const agentSocketId = (bestAgent as any).socketId;
              const agentSocket = agentSocketId ? io2.sockets.sockets.get(agentSocketId) : null;
              if (agentSocket) {
                agentSocket.emit('session:assigned', {
                  sessionId: session.sessionId,
                  agentId: bestAgent._id.toString(),
                  agentName: bestAgent.name,
                });
              }

              logger.info('api', {
                action: 'grace_period_expired_session_reassigned',
                agentId,
                sessionId: session.sessionId,
                newAgentId: bestAgent._id.toString(),
                newAgentName: bestAgent.name,
              });
            }
          } else {
            // ── No available agent → send to queue ───────────────────────
            const queuedSession = await addToQueue(session.sessionId);
            if (queuedSession) {
              // Re-fetch with user populated
              const populated = await ChatSession.findOne({ sessionId: session.sessionId })
                .populate('user')
                .lean();
              const userData = (populated?.user as any) || (session.user as any);
              io.emit('session:queued', {
                sessionId: session.sessionId,
                status: 'queued',
                user: {
                  _id: userData?._id?.toString() || '',
                  telegramId: userData?.telegramId,
                  firstName: userData?.firstName || 'Unknown',
                  username: userData?.username,
                },
                category: session.category,
                createdAt: session.createdAt,
                updatedAt: new Date(),
              } as any);

              // Track queued session IDs so the agent can reclaim them on reconnect
              if (redis.isRedisAvailable()) {
                const recoverKey = `agent:recoverable_sessions:${agentId}`;
                const existingRaw = await redis.get(recoverKey);
                const ids: string[] = existingRaw ? JSON.parse(existingRaw) : [];
                ids.push(session.sessionId);
                await redis.set(recoverKey, JSON.stringify(ids), Math.ceil(GRACE_PERIOD_MS / 1000));
              }

              logger.info('api', {
                action: 'grace_period_expired_session_queued',
                agentId,
                sessionId: session.sessionId,
                reason: 'no_available_agent',
              });
            }
          }
        }

        logger.info('api', {
          action: 'grace_period_expired_processing_complete',
          agentId,
          totalSessions: stillAssigned.length,
        });

      } finally {
        await redis.releaseLock(lockKey, lockValue);
        // Clear the pending key
        if (redis.isRedisAvailable()) {
          await redis.del(pendingKey);
        }
      }
    } catch (err) {
      logger.error('api', {
        action: 'grace_period_reassign_error',
        agentId,
        error: String(err),
      });
    }
  }, QUICK_DEBOUNCE_MS);
  
  return { affectedSessions, action: 'grace_period' };
}

/**
 * Handle agent reconnection
 * Called when agent connects via socket
 */
export async function handleAgentReconnection(agentId: string, socketId: string): Promise<{
  recoveredSessions: IChatSession[];
  isGracePeriodRecovery: boolean;
}> {
  const agent = await Agent.findById(agentId);
  if (!agent) {
    return { recoveredSessions: [], isGracePeriodRecovery: false };
  }
  
  const withinGracePeriod = isWithinGracePeriod(agent);

  // Cancel any pending reassignment scheduled by handleAgentDisconnection
  if (redis.isRedisAvailable()) {
    await redis.del(`agent:pending_reassign:${agentId}`);
  }
  
  // Update agent status
  await Agent.updateOne(
    { _id: agentId },
    {
      onlineStatus: 'online',
      socketId,
      lastLogin: new Date(),
      lastActivity: new Date(),
    }
  );
  
  let recoveredSessions: IChatSession[] = [];
  
  // First, check for sessions still assigned to this agent (reconnected before timeout)
  const stillAssigned = await ChatSession.find({
    status: 'human',
    assignedAgent: new Types.ObjectId(agentId),
  }).populate('user').populate('assignedAgent');
  
  recoveredSessions = [...stillAssigned];
  
  if (withinGracePeriod && stillAssigned.length === 0) {
    // Try to recover sessions that were queued by the disconnect debounce.
    // First check the Redis key tracking exactly which sessions were queued.
    let recoverableIds: string[] = [];
    if (redis.isRedisAvailable()) {
      const recoverKey = `agent:recoverable_sessions:${agentId}`;
      const raw = await redis.get(recoverKey);
      if (raw) {
        recoverableIds = JSON.parse(raw);
        await redis.del(recoverKey);
      }
    }

    const io = getIO();

    if (recoverableIds.length > 0) {
      // Prefer the precise list tracked during queueing
      const toRecover = await ChatSession.find({
        sessionId: { $in: recoverableIds },
        status: { $in: ['queued', 'waiting'] },
      }).populate('user').populate('assignedAgent');

      for (const session of toRecover) {
        const assigned = await assignAgent(session.sessionId, agentId, agent.name);
        if (assigned) {
          recoveredSessions.push(assigned);
          io.emit('session:updated', {
            sessionId: session.sessionId,
            status: 'human',
            assignedAgent: { _id: agentId, name: agent.name },
            user: {
              _id: (session.user as any)?._id?.toString() || '',
              telegramId: (session.user as any)?.telegramId,
              firstName: (session.user as any)?.firstName || 'Unknown',
              username: (session.user as any)?.username,
            },
            createdAt: session.createdAt,
            updatedAt: new Date(),
          } as any);
        }
      }
    } else {
      // Fallback: query recently queued sessions from around the disconnect time
      const recentlyQueued = await ChatSession.find({
        status: { $in: ['queued', 'waiting'] },
        updatedAt: { $gte: agent.lastDisconnect },
      }).populate('user').populate('assignedAgent');

      for (const session of recentlyQueued) {
        const assigned = await assignAgent(session.sessionId, agentId);
        if (assigned) {
          recoveredSessions.push(assigned);
        }
      }
    }
    
    logger.info('api', { 
      action: 'agent_reconnected_grace_period',
      agentId,
      recoveredSessions: recoveredSessions.length,
    });
  } else {
    logger.info('api', { 
      action: 'agent_reconnected_fresh',
      agentId,
      stillAssignedCount: stillAssigned.length,
    });
  }
  
  return { recoveredSessions, isGracePeriodRecovery: withinGracePeriod };
}

/**
 * Get full state for agent sync on reconnection
 */
export async function getAgentSyncState(agentId: string): Promise<{
  agent: IAgent | null;
  mySessions: IChatSession[];
  queuedSessions: IChatSession[];
  stats: {
    myActive: number;
    queue: number;
  };
}> {
  const agent = await Agent.findById(agentId);
  if (!agent) {
    return { 
      agent: null, 
      mySessions: [], 
      queuedSessions: [], 
      stats: { myActive: 0, queue: 0 } 
    };
  }
  
  const isAdmin = agent.role === 'admin';
  
  // Get my assigned sessions
  const mySessions = await ChatSession.find({
    status: 'human',
    assignedAgent: new Types.ObjectId(agentId),
  }).populate('user').populate('assignedAgent');
  
  // Get queued sessions (visible to all)
  const queuedSessions = await getQueuedSessions();
  
  return {
    agent,
    mySessions,
    queuedSessions,
    stats: {
      myActive: mySessions.length,
      queue: queuedSessions.length,
    },
  };
}

/**
 * Attempt to auto-assign queued sessions to available agents
 * Called periodically or when agents become available
 */
export async function processQueue(): Promise<number> {
  const queuedSessions = await getQueuedSessions();
  const availableAgents = await getAvailableAgents();
  
  let assigned = 0;
  
  for (const session of queuedSessions) {
    // Find first available agent
    const agent = availableAgents.find(a => a.activeChats < 5);
    if (!agent) break;
    
    await assignAgent(session.sessionId, agent._id.toString());
    agent.activeChats++; // Update local count
    assigned++;
  }
  
  if (assigned > 0) {
    logger.info('api', { 
      action: 'queue_processed',
      sessionsAssigned: assigned,
    });
  }
  
  return assigned;
}

/**
 * Soft lock for session assignment (prevent double assignment)
 * Uses MongoDB's findOneAndUpdate with conditions
 */
export async function tryAssignSession(
  sessionId: string, 
  agentId: string
): Promise<IChatSession | null> {
  // Only assign if session is still unassigned
  const session = await ChatSession.findOneAndUpdate(
    {
      sessionId,
      status: { $in: ['queued', 'waiting'] },
      $or: [
        { assignedAgent: { $exists: false } },
        { assignedAgent: null },
      ],
    },
    {
      status: 'human',
      assignedAgent: new Types.ObjectId(agentId),
    },
    { new: true }
  ).populate('user').populate('assignedAgent');
  
  return session;
}

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
import { logger } from './logger.js';
import type { IAgent } from '../database/models/Agent.js';
import type { IChatSession } from '../database/models/ChatSession.js';
import { Types } from 'mongoose';

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
 * Called when socket disconnects
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
  
  // Find sessions assigned to this agent
  const affectedSessions = await ChatSession.find({
    status: 'human',
    assignedAgent: new Types.ObjectId(agentId),
  });
  
  // Move sessions to queue immediately (no grace period for now)
  for (const session of affectedSessions) {
    await addToQueue(session.sessionId);
  }
  
  logger.info('api', { 
    action: 'agent_disconnected_handled',
    agentId,
    sessionsQueued: affectedSessions.length,
  });
  
  return { affectedSessions, action: 'queued' };
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
  
  if (withinGracePeriod) {
    // Try to recover sessions that were recently queued
    // Find sessions that were queued around the time of disconnect
    const recentlyQueued = await ChatSession.find({
      status: 'queued',
      updatedAt: { $gte: agent.lastDisconnect },
    });
    
    // Re-assign these sessions to the reconnecting agent
    for (const session of recentlyQueued) {
      const assigned = await assignAgent(session.sessionId, agentId);
      if (assigned) {
        recoveredSessions.push(assigned);
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

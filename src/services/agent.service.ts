/**
 * Agent Database Service
 * Handles agent authentication and management
 */

import { Agent, type IAgent, type AgentRole, type OnlineStatus } from '../database/index.js';
import { MAX_CONCURRENT_CHATS, RECONNECTION_GRACE_MINUTES, type AvailabilityStatus } from '../database/models/Agent.js';

export { MAX_CONCURRENT_CHATS, RECONNECTION_GRACE_MINUTES };

/**
 * Create new agent
 */
export async function createAgent(data: {
  name: string;
  email: string;
  password: string;
  role?: AgentRole;
}): Promise<IAgent> {
  const agent = await Agent.create({
    name: data.name,
    email: data.email.toLowerCase(),
    password: data.password,
    role: data.role || 'support',
  });
  
  return agent;
}

/**
 * Find agent by email (for login)
 */
export async function findAgentByEmail(email: string): Promise<IAgent | null> {
  return Agent.findOne({ email: email.toLowerCase() }).select('+password');
}

/**
 * Find agent by ID
 */
export async function findAgentById(agentId: string): Promise<IAgent | null> {
  return Agent.findById(agentId);
}

/**
 * Update agent's online status
 */
export async function updateAgentStatus(agentId: string, status: OnlineStatus): Promise<void> {
  await Agent.updateOne({ _id: agentId }, { onlineStatus: status });
}

/**
 * Get all online agents
 */
export async function getOnlineAgents(): Promise<IAgent[]> {
  return Agent.find({ onlineStatus: { $in: ['online', 'away'] } });
}

/**
 * Get all agents
 */
export async function getAllAgents(): Promise<IAgent[]> {
  return Agent.find().sort({ name: 1 });
}

/**
 * Update agent profile
 */
export async function updateAgentProfile(
  agentId: string, 
  data: Partial<Pick<IAgent, 'name' | 'avatar'>>
): Promise<IAgent | null> {
  return Agent.findByIdAndUpdate(agentId, data, { new: true });
}

/**
 * Update agent password
 */
export async function updateAgentPassword(agentId: string, newPassword: string): Promise<void> {
  const agent = await Agent.findById(agentId).select('+password');
  if (!agent) throw new Error('Agent not found');
  
  agent.password = newPassword;
  await agent.save();
}

/**
 * Update last login time
 */
export async function updateLastLogin(agentId: string): Promise<void> {
  await Agent.updateOne({ _id: agentId }, { lastLogin: new Date() });
}

/**
 * Delete agent (admin only)
 */
export async function deleteAgent(agentId: string): Promise<boolean> {
  const result = await Agent.deleteOne({ _id: agentId });
  return result.deletedCount > 0;
}

/**
 * Get agent statistics
 */
export async function getAgentStats(): Promise<{
  total: number;
  online: number;
  away: number;
  offline: number;
}> {
  const stats = await Agent.aggregate([
    {
      $group: {
        _id: '$onlineStatus',
        count: { $sum: 1 },
      },
    },
  ]);
  
  const result = {
    total: 0,
    online: 0,
    away: 0,
    offline: 0,
  };
  
  for (const stat of stats) {
    result[stat._id as keyof typeof result] = stat.count;
    result.total += stat.count;
  }
  
  return result;
}

/**
 * Get availability status for an agent
 */
export function getAvailabilityStatus(agent: IAgent): AvailabilityStatus {
  if (agent.onlineStatus === 'offline') return 'offline';
  if (agent.activeChats >= MAX_CONCURRENT_CHATS) return 'busy';
  return 'available';
}

/**
 * Get available agents (online and not at max capacity)
 */
export async function getAvailableAgents(): Promise<IAgent[]> {
  return Agent.find({
    onlineStatus: { $in: ['online', 'away'] },
    isActive: true,
    activeChats: { $lt: MAX_CONCURRENT_CHATS },
  }).sort({ activeChats: 1 }); // Prefer agents with fewer active chats
}

/**
 * Increment agent's active chat count
 */
export async function incrementActiveChats(agentId: string): Promise<IAgent | null> {
  return Agent.findByIdAndUpdate(
    agentId,
    { 
      $inc: { activeChats: 1, totalChatsHandled: 1 },
      $set: { lastActivity: new Date() },
    },
    { new: true }
  );
}

/**
 * Decrement agent's active chat count
 */
export async function decrementActiveChats(agentId: string): Promise<IAgent | null> {
  return Agent.findByIdAndUpdate(
    agentId,
    { 
      $inc: { activeChats: -1 },
      $set: { lastActivity: new Date() },
    },
    { new: true }
  );
}

/**
 * Set agent socket ID (for tracking connection)
 */
export async function setAgentSocketId(agentId: string, socketId: string | null): Promise<void> {
  await Agent.updateOne(
    { _id: agentId },
    { 
      socketId,
      ...(socketId ? { onlineStatus: 'online' } : { lastDisconnect: new Date() }),
    }
  );
}

/**
 * Get agent by socket ID
 */
export async function getAgentBySocketId(socketId: string): Promise<IAgent | null> {
  return Agent.findOne({ socketId });
}

/**
 * Mark agent as disconnected and handle their chats
 */
export async function handleAgentDisconnect(agentId: string): Promise<{
  agent: IAgent | null;
  affectedChats: number;
}> {
  const agent = await Agent.findByIdAndUpdate(
    agentId,
    {
      onlineStatus: 'offline',
      socketId: null,
      lastDisconnect: new Date(),
    },
    { new: true }
  );
  
  return { agent, affectedChats: agent?.activeChats || 0 };
}

/**
 * Check if agent is within reconnection grace period
 */
export function isWithinGracePeriod(agent: IAgent): boolean {
  if (!agent.lastDisconnect) return false;
  const elapsed = Date.now() - agent.lastDisconnect.getTime();
  return elapsed < RECONNECTION_GRACE_MINUTES * 60 * 1000;
}

/**
 * Reconcile agent state on server restart
 * - Agents without socket connection -> offline
 * - Return list of agents that were marked offline
 */
export async function reconcileAgentStates(): Promise<IAgent[]> {
  const onlineAgents = await Agent.find({
    onlineStatus: { $ne: 'offline' },
  });
  
  // Mark all as offline (they need to reconnect)
  await Agent.updateMany(
    { onlineStatus: { $ne: 'offline' } },
    { 
      onlineStatus: 'offline',
      socketId: null,
      lastDisconnect: new Date(),
    }
  );
  
  return onlineAgents;
}

/**
 * Get agents with active chats who are offline (for reassignment)
 */
export async function getOfflineAgentsWithChats(): Promise<IAgent[]> {
  return Agent.find({
    onlineStatus: 'offline',
    activeChats: { $gt: 0 },
  });
}

/**
 * Reset agent's active chat count (for reconciliation)
 */
export async function resetActiveChats(agentId: string, count = 0): Promise<void> {
  await Agent.updateOne({ _id: agentId }, { activeChats: count });
}

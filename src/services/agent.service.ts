/**
 * Agent Database Service
 * Handles agent authentication and management
 */

import { Agent, type IAgent, type AgentRole, type OnlineStatus } from '../database/index.js';

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

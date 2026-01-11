/**
 * Supervisor Service - Live chat monitoring and whisper functionality
 */

import { Types } from 'mongoose';
import { Whisper, type IWhisper } from '../database/models/Whisper.js';
import { Agent, type IAgent } from '../database/models/Agent.js';
import { ChatSession, type IChatSession } from '../database/models/ChatSession.js';
import { ActivityLog } from '../database/models/ActivityLog.js';
import { io } from './socket.js';

interface SupervisorStats {
  liveChats: number;
  queuedChats: number;
  onlineAgents: number;
  awayAgents: number;
  slaAtRisk: number;
  avgResponseTime: number;
}

interface AgentOverview {
  _id: Types.ObjectId;
  name: string;
  email: string;
  onlineStatus: string;
  activeChats: number;
  availability: string;
  avgResponseTime?: number;
  currentSessions: {
    sessionId: string;
    userName: string;
    startedAt: Date;
    lastMessageAt?: Date;
  }[];
}

/**
 * Get supervisor dashboard stats
 */
export async function getSupervisorStats(): Promise<SupervisorStats> {
  const [liveChats, queuedChats, agents] = await Promise.all([
    ChatSession.countDocuments({ status: 'human' }),
    ChatSession.countDocuments({ status: { $in: ['queued', 'waiting'] } }),
    Agent.find({ isActive: true }).select('onlineStatus'),
  ]);

  const onlineAgents = agents.filter((a: IAgent) => a.onlineStatus === 'online').length;
  const awayAgents = agents.filter((a: IAgent) => a.onlineStatus === 'away').length;

  // TODO: Calculate SLA at risk based on response times
  const slaAtRisk = 0;
  const avgResponseTime = 0;

  return {
    liveChats,
    queuedChats,
    onlineAgents,
    awayAgents,
    slaAtRisk,
    avgResponseTime,
  };
}

/**
 * Get overview of all active agents with their current sessions
 */
export async function getAgentOverviews(): Promise<AgentOverview[]> {
  const agents = await Agent.find({
    isActive: true,
    onlineStatus: { $ne: 'offline' },
  }).lean<IAgent[]>();

  const agentIds = agents.map((a: IAgent) => a._id);
  
  const sessions = await ChatSession.find({
    status: 'human',
    assignedAgent: { $in: agentIds },
  })
    .populate('user', 'firstName lastName telegramUsername')
    .lean<IChatSession[]>();

  const sessionsByAgent = new Map<string, IChatSession[]>();
  for (const session of sessions) {
    const agentId = session.assignedAgent?.toString() || '';
    if (!sessionsByAgent.has(agentId)) {
      sessionsByAgent.set(agentId, []);
    }
    sessionsByAgent.get(agentId)!.push(session);
  }

  return agents.map((agent: IAgent) => ({
    _id: agent._id,
    name: agent.name,
    email: agent.email,
    onlineStatus: agent.onlineStatus,
    activeChats: agent.activeChats,
    availability: agent.activeChats >= 5 ? 'busy' : 'available',
    currentSessions: (sessionsByAgent.get(agent._id.toString()) || []).map((s: IChatSession) => ({
      sessionId: s.sessionId,
      userName: (s.user as any)?.firstName || 'Unknown',
      startedAt: s.createdAt,
      lastMessageAt: s.updatedAt,
    })),
  }));
}

/**
 * Send a whisper (private message) from supervisor to agent
 */
export async function sendWhisper(
  sessionId: string,
  fromSupervisorId: Types.ObjectId | string,
  content: string
): Promise<IWhisper> {
  // Get the session to find the assigned agent
  const session = await ChatSession.findOne({ sessionId });
  if (!session) {
    throw new Error('Session not found');
  }

  if (!session.assignedAgent) {
    throw new Error('No agent assigned to this session');
  }

  // Verify supervisor has permission
  const supervisor = await Agent.findById(fromSupervisorId);
  if (!supervisor || !['admin', 'supervisor'].includes(supervisor.role)) {
    throw new Error('Unauthorized: Only supervisors can send whispers');
  }

  // Create the whisper
  const whisper = await Whisper.create({
    sessionId,
    fromSupervisor: new Types.ObjectId(fromSupervisorId),
    toAgent: session.assignedAgent,
    content,
    isRead: false,
  });

  // Get agent's socket to send real-time notification
  const agent = await Agent.findById(session.assignedAgent).select('socketId');
  if (agent?.socketId) {
    io.to(agent.socketId).emit('whisper:received', {
      id: whisper._id.toString(),
      sessionId,
      fromSupervisor: {
        id: supervisor._id.toString(),
        name: supervisor.name,
      },
      content,
      createdAt: whisper.createdAt,
    });
  }

  // Log activity
  await ActivityLog.create({
    sessionId,
    action: 'whisper_sent',
    actor: {
      type: 'supervisor',
      id: supervisor._id,
      name: supervisor.name,
    },
    metadata: {
      toAgentId: session.assignedAgent.toString(),
      contentLength: content.length,
    },
    description: `Supervisor ${supervisor.name} sent a whisper`,
    icon: '👁️',
    color: 'blue',
  });

  return whisper;
}

/**
 * Mark a whisper as read
 */
export async function markWhisperAsRead(
  whisperId: string,
  agentId: Types.ObjectId | string
): Promise<void> {
  const whisper = await Whisper.findOneAndUpdate(
    {
      _id: whisperId,
      toAgent: new Types.ObjectId(agentId),
      isRead: false,
    },
    {
      isRead: true,
      readAt: new Date(),
    },
    { new: true }
  );

  if (whisper) {
    // Notify supervisor that whisper was read
    const supervisor = await Agent.findById(whisper.fromSupervisor).select('socketId');
    if (supervisor?.socketId) {
      io.to(supervisor.socketId).emit('whisper:read', {
        whisperId: whisper._id.toString(),
      });
    }

    // Log activity
    await ActivityLog.create({
      sessionId: whisper.sessionId,
      action: 'whisper_read',
      actor: {
        type: 'agent',
        id: new Types.ObjectId(agentId),
      },
      metadata: {
        whisperId: whisper._id.toString(),
      },
      description: 'Agent read supervisor whisper',
      icon: '✓',
      color: 'gray',
    });
  }
}

/**
 * Get unread whispers for an agent
 */
export async function getUnreadWhispers(agentId: Types.ObjectId | string) {
  return Whisper.find({
    toAgent: new Types.ObjectId(agentId),
    isRead: false,
  })
    .populate('fromSupervisor', 'name avatar')
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Get whispers for a specific session
 */
export async function getSessionWhispers(
  sessionId: string,
  agentId: Types.ObjectId | string
) {
  return Whisper.find({
    sessionId,
    toAgent: new Types.ObjectId(agentId),
  })
    .populate('fromSupervisor', 'name avatar')
    .sort({ createdAt: 1 })
    .lean();
}

/**
 * Start watching a session (supervisor mode)
 */
export async function startWatchingSession(
  supervisorId: Types.ObjectId | string,
  sessionId: string
): Promise<void> {
  const supervisor = await Agent.findById(supervisorId);
  if (!supervisor || !['admin', 'supervisor'].includes(supervisor.role)) {
    throw new Error('Unauthorized');
  }

  // Add to watching list
  await Agent.findByIdAndUpdate(supervisorId, {
    $addToSet: { watchingSessions: sessionId },
    isSupervisingEnabled: true,
  });

  // Log activity
  await ActivityLog.create({
    sessionId,
    action: 'supervisor_viewing',
    actor: {
      type: 'supervisor',
      id: supervisor._id,
      name: supervisor.name,
    },
    metadata: {},
    description: `${supervisor.name} started watching this chat`,
    icon: '👁️',
    color: 'blue',
  });

  // Notify the assigned agent
  const session = await ChatSession.findOne({ sessionId });
  if (session?.assignedAgent) {
    const agent = await Agent.findById(session.assignedAgent).select('socketId');
    if (agent?.socketId) {
      io.to(agent.socketId).emit('supervisor:watching', {
        supervisorId: supervisor._id.toString(),
        supervisorName: supervisor.name,
        action: 'start',
      });
    }
  }
}

/**
 * Stop watching a session
 */
export async function stopWatchingSession(
  supervisorId: Types.ObjectId | string,
  sessionId: string
): Promise<void> {
  await Agent.findByIdAndUpdate(supervisorId, {
    $pull: { watchingSessions: sessionId },
  });

  // Check if still watching any sessions
  const supervisor = await Agent.findById(supervisorId);
  if (supervisor?.watchingSessions?.length === 0) {
    await Agent.findByIdAndUpdate(supervisorId, {
      isSupervisingEnabled: false,
    });
  }

  // Log activity
  if (supervisor) {
    await ActivityLog.create({
      sessionId,
      action: 'supervisor_stopped',
      actor: {
        type: 'supervisor',
        id: supervisor._id,
        name: supervisor.name,
      },
      metadata: {},
      description: `${supervisor.name} stopped watching this chat`,
      icon: '👁️',
      color: 'gray',
    });
  }
}

/**
 * Takeover a chat from an agent
 */
export async function takeoverSession(
  supervisorId: Types.ObjectId | string,
  sessionId: string,
  reason?: string
): Promise<void> {
  const supervisor = await Agent.findById(supervisorId);
  if (!supervisor || !['admin', 'supervisor'].includes(supervisor.role)) {
    throw new Error('Unauthorized');
  }

  const session = await ChatSession.findOne({ sessionId });
  if (!session) {
    throw new Error('Session not found');
  }

  const previousAgentId = session.assignedAgent;

  // Decrement previous agent's chat count
  if (previousAgentId) {
    await Agent.findByIdAndUpdate(previousAgentId, {
      $inc: { activeChats: -1 },
    });
  }

  // Assign to supervisor
  await ChatSession.findByIdAndUpdate(session._id, {
    assignedAgent: supervisor._id,
  });

  // Increment supervisor's chat count
  await Agent.findByIdAndUpdate(supervisorId, {
    $inc: { activeChats: 1 },
  });

  // Log activity
  await ActivityLog.create({
    sessionId,
    action: 'session_transferred',
    actor: {
      type: 'supervisor',
      id: supervisor._id,
      name: supervisor.name,
    },
    metadata: {
      fromAgentId: previousAgentId?.toString(),
      reason: reason || 'Supervisor takeover',
      type: 'takeover',
    },
    description: `${supervisor.name} took over this chat`,
    icon: '🔄',
    color: 'yellow',
  });

  // Notify agents via WebSocket
  if (previousAgentId) {
    const previousAgent = await Agent.findById(previousAgentId).select('socketId');
    if (previousAgent?.socketId) {
      io.to(previousAgent.socketId).emit('session:takenOver', {
        sessionId,
        takenBy: {
          id: supervisor._id.toString(),
          name: supervisor.name,
        },
        reason: reason || 'Supervisor takeover',
        bySupervisor: {
          id: supervisor._id.toString(),
          name: supervisor.name,
        },
      });
    }
  }

  io.to(sessionId).emit('session:update', {
    sessionId,
    assignedAgent: {
      id: supervisor._id.toString(),
      name: supervisor.name,
    },
  });
}

/**
 * Get live chats for supervisor dashboard
 */
export async function getLiveChats() {
  const sessions = await ChatSession.find({
    status: { $in: ['human', 'queued', 'waiting'] },
  })
    .populate('user', 'firstName lastName telegramUsername telegramId')
    .populate('assignedAgent', 'name email')
    .sort({ updatedAt: -1 })
    .lean<IChatSession[]>();

  const { Message } = await import('../database/models/Message.js');
  
  // Get message counts and last messages for each session
  const chats = await Promise.all(
    sessions.map(async (session: IChatSession) => {
      const messages = await Message.find({ session: session._id })
        .sort({ createdAt: -1 })
        .limit(1)
        .lean();
      
      const messageCount = await Message.countDocuments({ session: session._id });
      
      const startTime = new Date(session.createdAt).getTime();
      const now = Date.now();
      const durationSeconds = Math.floor((now - startTime) / 1000);
      
      // Calculate SLA status based on wait time
      let slaStatus: 'ok' | 'warning' | 'critical' = 'ok';
      if (session.status === 'waiting' || session.status === 'queued') {
        const waitTimeMinutes = durationSeconds / 60;
        if (waitTimeMinutes > 10) slaStatus = 'critical';
        else if (waitTimeMinutes > 5) slaStatus = 'warning';
      }
      
      const user = session.user as any;
      const agent = session.assignedAgent as any;
      
      return {
        sessionId: session.sessionId,
        userId: user?._id?.toString() || '',
        userName: user?.firstName || user?.telegramUsername || 'Usuario',
        agentId: agent?._id?.toString() || '',
        agentName: agent?.name || 'Sin asignar',
        status: session.status,
        messagesCount: messageCount,
        duration: durationSeconds,
        lastMessage: messages[0]?.content || '',
        lastMessageAt: messages[0]?.createdAt || session.updatedAt,
        slaStatus,
      };
    })
  );
  
  return chats;
}

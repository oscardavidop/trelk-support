/**
 * Dashboard Metrics Service
 * Real-time aggregated metrics for the dashboard
 * Supports Admin, Supervisor, and Agent views
 */

import { ChatSession, Message, type IChatSession } from '../database/index.js';
import { Agent, type IAgent, type AvailabilityStatus } from '../database/models/Agent.js';
import { User } from '../database/models/User.js';
import { Flow } from '../database/models/Flow.js';
import { ScheduledMessage } from '../database/models/ScheduledMessage.js';
import { Broadcast } from '../database/models/Broadcast.js';
import { AuditLog } from '../database/models/AuditLog.js';
import { ActivityLog } from '../database/models/ActivityLog.js';
import { getRedisClient, isRedisConnected } from './redis.js';
import { logger } from './logger.js';

// ==================== TYPES ====================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface DashboardFilters {
  dateRange?: DateRange;
  channel?: string;
  teamId?: string;
  category?: string;
  agentId?: string;
}

export interface MetricCard {
  label: string;
  value: number;
  change?: number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: string;
  color?: string;
  link?: string;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
  color?: string;
}

export interface AgentMetrics {
  agentId: string;
  name: string;
  email: string;
  avatar?: string;
  status: AvailabilityStatus;
  activeChats: number;
  maxChats: number;
  closedToday: number;
  avgResponseTime: number;
  slaBreaches: number;
  rating: number;
  ratingCount: number;
  lastActivity?: Date;
}

export interface SystemHealth {
  redis: { status: 'healthy' | 'degraded' | 'down'; latency: number };
  mongodb: { status: 'healthy' | 'degraded' | 'down'; latency: number };
  workers: { running: number; failed: number };
  queues: { pending: number; backlog: number };
  webhooks: { success: number; failed: number };
}

export interface Insight {
  type: 'info' | 'warning' | 'success' | 'alert';
  title: string;
  description: string;
  metric?: string;
  link?: string;
  timestamp: Date;
}

export interface Alert {
  id: string;
  type: 'sla_breach' | 'agent_disconnect' | 'queue_saturated' | 'worker_down' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  entityId?: string;
  entityType?: string;
  timestamp: Date;
  acknowledged: boolean;
}

// ==================== HELPER FUNCTIONS ====================

function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getStartOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ==================== ADMIN METRICS ====================

/**
 * Get comprehensive admin dashboard metrics
 */
export async function getAdminMetrics(filters: DashboardFilters = {}): Promise<{
  cards: MetricCard[];
  chatsByHour: TimeSeriesPoint[];
  chatsByCategory: CategoryBreakdown[];
  slaCompliance: number;
  agentLoad: AgentMetrics[];
  flowStats: { name: string; executions: number; success: number }[];
  systemHealth: SystemHealth;
  alerts: Alert[];
  insights: Insight[];
}> {
  const today = getStartOfDay();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const last24h = new Date();
  last24h.setHours(last24h.getHours() - 24);

  try {
    // Run all queries in parallel for performance
    const [
      totalChatsToday,
      totalChatsYesterday,
      activeChatsNow,
      openTickets,
      slaAtRisk,
      activeUsers,
      flowsExecutedToday,
      scheduledPending,
      systemErrors,
      chatsByHourData,
      categoryData,
      agentData,
      flowData,
    ] = await Promise.all([
      // Total chats today
      ChatSession.countDocuments({
        createdAt: { $gte: today },
      }),
      // Total chats yesterday (for comparison)
      ChatSession.countDocuments({
        createdAt: { $gte: yesterday, $lt: today },
      }),
      // Active chats now
      ChatSession.countDocuments({
        status: { $in: ['human', 'waiting'] },
      }),
      // Open tickets (sessions waiting or with issues)
      ChatSession.countDocuments({
        status: 'waiting',
      }),
      // SLA at risk (sessions waiting > 5 min without response)
      ChatSession.countDocuments({
        status: 'waiting',
        createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) },
      }),
      // Active users (users with sessions today)
      ChatSession.distinct('user', {
        createdAt: { $gte: today },
      }).then(ids => ids.length),
      // Flows executed today
      ActivityLog.countDocuments({
        action: 'flow_executed',
        createdAt: { $gte: today },
      }),
      // Scheduled messages pending
      ScheduledMessage.countDocuments({
        status: 'pending',
        scheduledFor: { $gte: new Date() },
      }),
      // System errors last 24h
      AuditLog.countDocuments({
        action: { $regex: /error/i },
        timestamp: { $gte: last24h },
      }),
      // Chats by hour (last 24h)
      ChatSession.aggregate([
        { $match: { createdAt: { $gte: last24h } } },
        {
          $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Chats by category
      ChatSession.aggregate([
        { $match: { createdAt: { $gte: today } } },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
          },
        },
      ]),
      // Agent metrics
      getAgentMetrics(),
      // Flow stats
      getFlowStats(),
    ]);

    // Build metric cards
    const cards: MetricCard[] = [
      {
        label: 'Total Chats Hoy',
        value: totalChatsToday,
        change: totalChatsToday - totalChatsYesterday,
        changePercent: calculatePercentChange(totalChatsToday, totalChatsYesterday),
        trend: totalChatsToday >= totalChatsYesterday ? 'up' : 'down',
        icon: 'MessageCircle',
        color: 'blue',
        link: '/chats',
      },
      {
        label: 'Chats Activos',
        value: activeChatsNow,
        icon: 'Activity',
        color: 'green',
        link: '/chats?status=active',
      },
      {
        label: 'En Cola',
        value: openTickets,
        icon: 'Clock',
        color: openTickets > 10 ? 'red' : 'amber',
        link: '/chats?tab=queue',
      },
      {
        label: 'SLA en Riesgo',
        value: slaAtRisk,
        icon: 'AlertTriangle',
        color: slaAtRisk > 0 ? 'red' : 'green',
        link: '/supervisor?filter=sla-risk',
      },
      {
        label: 'Usuarios Activos',
        value: activeUsers,
        icon: 'Users',
        color: 'purple',
        link: '/contacts',
      },
      {
        label: 'Flujos Ejecutados',
        value: flowsExecutedToday,
        icon: 'Workflow',
        color: 'cyan',
        link: '/flows',
      },
      {
        label: 'Mensajes Programados',
        value: scheduledPending,
        icon: 'Calendar',
        color: 'indigo',
        link: '/scheduled',
      },
      {
        label: 'Errores (24h)',
        value: systemErrors,
        icon: 'AlertOctagon',
        color: systemErrors > 0 ? 'red' : 'green',
        link: '/system?tab=logs',
      },
    ];

    // Process chats by hour
    const chatsByHour: TimeSeriesPoint[] = Array.from({ length: 24 }, (_, i) => {
      const hourData = chatsByHourData.find(h => h._id === i);
      return {
        timestamp: `${i.toString().padStart(2, '0')}:00`,
        value: hourData?.count || 0,
        label: `${i}:00`,
      };
    });

    // Process categories
    const totalCategoryChats = categoryData.reduce((sum: number, c: any) => sum + c.count, 0);
    const categoryColors: Record<string, string> = {
      support: 'blue',
      sales: 'green',
      billing: 'amber',
      technical: 'purple',
      general: 'gray',
      null: 'gray',
    };
    const chatsByCategory: CategoryBreakdown[] = categoryData.map((c: any) => ({
      category: c._id || 'Sin categoría',
      count: c.count,
      percentage: totalCategoryChats > 0 ? Math.round((c.count / totalCategoryChats) * 100) : 0,
      color: categoryColors[c._id] || 'gray',
    }));

    // Calculate SLA compliance
    const totalSessionsWithSLA = await ChatSession.countDocuments({
      createdAt: { $gte: today },
      status: { $in: ['human', 'closed'] },
    });
    const sessionsWithBreaches = await ChatSession.countDocuments({
      createdAt: { $gte: today },
      'slaBreached': true,
    });
    const slaCompliance = totalSessionsWithSLA > 0
      ? Math.round(((totalSessionsWithSLA - sessionsWithBreaches) / totalSessionsWithSLA) * 100)
      : 100;

    // Get system health
    const systemHealth = await getSystemHealth();

    // Generate alerts
    const alerts = await generateAlerts(slaAtRisk, agentData, systemHealth);

    // Generate insights
    const insights = await generateInsights(chatsByHourData, agentData, categoryData);

    return {
      cards,
      chatsByHour,
      chatsByCategory,
      slaCompliance,
      agentLoad: agentData,
      flowStats: flowData,
      systemHealth,
      alerts,
      insights,
    };
  } catch (error) {
    logger.error('api', { message: 'Error getting admin metrics', error: String(error) });
    throw error;
  }
}

// ==================== SUPERVISOR METRICS ====================

/**
 * Get supervisor dashboard metrics focused on team management
 */
export async function getSupervisorMetrics(
  supervisorId: string,
  filters: DashboardFilters = {}
): Promise<{
  cards: MetricCard[];
  agentStatus: AgentMetrics[];
  queueLive: { sessionId: string; user: string; waitTime: number; category: string }[];
  recentTransfers: { from: string; to: string; sessionId: string; reason: string; time: Date }[];
  negativeRatings: { sessionId: string; agent: string; rating: number; comment: string; time: Date }[];
}> {
  const today = getStartOfDay();

  try {
    const [
      activeChats,
      chatsInQueue,
      avgResponseTime,
      closedToday,
      reopenedTickets,
      negativeRatingsCount,
      agentStatus,
      queueData,
      transferData,
      ratingsData,
    ] = await Promise.all([
      // Active chats with agents
      ChatSession.countDocuments({
        status: 'human',
      }),
      // Chats in queue
      ChatSession.countDocuments({
        status: 'waiting',
      }),
      // Average response time (from activity logs)
      ActivityLog.aggregate([
        {
          $match: {
            action: 'first_response',
            createdAt: { $gte: today },
          },
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$metadata.responseTimeSeconds' },
          },
        },
      ]).then(res => res[0]?.avgTime || 0),
      // Closed today
      ChatSession.countDocuments({
        status: 'closed',
        closedAt: { $gte: today },
      }),
      // Reopened tickets
      ChatSession.countDocuments({
        reopenedAt: { $gte: today },
      }),
      // Negative ratings (≤ 2 stars)
      ChatSession.countDocuments({
        'survey.rating': { $lte: 2 },
        createdAt: { $gte: today },
      }),
      // Agent status
      getAgentMetrics(),
      // Queue live data
      ChatSession.find({ status: 'waiting' })
        .populate('user', 'firstName lastName username')
        .sort({ createdAt: 1 })
        .limit(20)
        .lean(),
      // Recent transfers
      ActivityLog.find({
        action: 'session_transferred',
        createdAt: { $gte: today },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
      // Negative ratings details
      ChatSession.find({
        'survey.rating': { $lte: 2 },
        createdAt: { $gte: today },
      })
        .populate('assignedAgent', 'name')
        .sort({ 'survey.submittedAt': -1 })
        .limit(10)
        .lean(),
    ]);

    const cards: MetricCard[] = [
      {
        label: 'Chats Activos',
        value: activeChats,
        icon: 'MessageSquare',
        color: 'green',
      },
      {
        label: 'En Cola',
        value: chatsInQueue,
        icon: 'Clock',
        color: chatsInQueue > 5 ? 'red' : 'amber',
      },
      {
        label: 'Tiempo Resp. Promedio',
        value: Math.round(avgResponseTime / 60),
        icon: 'Timer',
        color: avgResponseTime > 300 ? 'red' : 'green',
      },
      {
        label: 'Cerrados Hoy',
        value: closedToday,
        icon: 'CheckCircle',
        color: 'blue',
      },
      {
        label: 'Tickets Reabiertos',
        value: reopenedTickets,
        icon: 'RotateCcw',
        color: reopenedTickets > 0 ? 'amber' : 'gray',
      },
      {
        label: 'Encuestas Negativas',
        value: negativeRatingsCount,
        icon: 'ThumbsDown',
        color: negativeRatingsCount > 0 ? 'red' : 'green',
      },
    ];

    // Process queue live
    const queueLive = queueData.map((session: any) => ({
      sessionId: session.sessionId,
      user: session.user?.firstName || session.user?.username || 'Usuario',
      waitTime: Math.round((Date.now() - new Date(session.createdAt).getTime()) / 60000),
      category: session.category || 'general',
    }));

    // Process transfers
    const recentTransfers = transferData.map((log: any) => ({
      from: log.metadata?.fromAgent || 'Sistema',
      to: log.metadata?.toAgent || 'Cola',
      sessionId: log.sessionId,
      reason: log.metadata?.reason || '',
      time: log.createdAt,
    }));

    // Process negative ratings
    const negativeRatings = ratingsData.map((session: any) => ({
      sessionId: session.sessionId,
      agent: session.assignedAgent?.name || 'Desconocido',
      rating: session.survey?.rating || 0,
      comment: session.survey?.comment || '',
      time: session.survey?.submittedAt || session.closedAt,
    }));

    return {
      cards,
      agentStatus,
      queueLive,
      recentTransfers,
      negativeRatings,
    };
  } catch (error) {
    logger.error('api', { message: 'Error getting supervisor metrics', error: String(error) });
    throw error;
  }
}

// ==================== AGENT METRICS ====================

/**
 * Get agent's personal dashboard metrics
 */
export async function getAgentPersonalMetrics(
  agentId: string
): Promise<{
  cards: MetricCard[];
  myChats: { sessionId: string; user: string; lastMessage: string; slaRisk: boolean; priority: string }[];
  upcomingActions: { type: string; description: string; dueAt: Date; link: string }[];
  recentActivity: { action: string; time: Date; details: string }[];
}> {
  const today = getStartOfDay();

  try {
    const agent = await Agent.findById(agentId);
    if (!agent) throw new Error('Agent not found');

    const [
      activeChats,
      closedToday,
      avgResponseTime,
      ratings,
      slaAtRisk,
      mySessions,
      scheduledMessages,
      myActivity,
    ] = await Promise.all([
      // My active chats
      ChatSession.countDocuments({
        assignedAgent: agentId,
        status: 'human',
      }),
      // Closed today by me
      ChatSession.countDocuments({
        assignedAgent: agentId,
        status: 'closed',
        closedAt: { $gte: today },
      }),
      // My average response time
      ActivityLog.aggregate([
        {
          $match: {
            action: 'first_response',
            actorId: agentId,
            createdAt: { $gte: today },
          },
        },
        {
          $group: {
            _id: null,
            avgTime: { $avg: '$metadata.responseTimeSeconds' },
          },
        },
      ]).then(res => res[0]?.avgTime || 0),
      // My ratings
      ChatSession.aggregate([
        {
          $match: {
            assignedAgent: agent._id,
            'survey.rating': { $exists: true },
            createdAt: { $gte: getStartOfWeek() },
          },
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$survey.rating' },
            count: { $sum: 1 },
          },
        },
      ]).then(res => res[0] || { avgRating: 0, count: 0 }),
      // My SLA at risk
      ChatSession.countDocuments({
        assignedAgent: agentId,
        status: 'human',
        lastMessageAt: { $lt: new Date(Date.now() - 3 * 60 * 1000) },
      }),
      // My active sessions
      ChatSession.find({
        assignedAgent: agentId,
        status: 'human',
      })
        .populate('user', 'firstName lastName username')
        .sort({ lastMessageAt: -1 })
        .limit(20)
        .lean(),
      // My scheduled messages
      ScheduledMessage.find({
        createdBy: agentId,
        status: 'pending',
        scheduledFor: { $gte: new Date(), $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      })
        .sort({ scheduledFor: 1 })
        .limit(10)
        .lean(),
      // My recent activity
      ActivityLog.find({
        actorId: agentId,
        createdAt: { $gte: today },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const cards: MetricCard[] = [
      {
        label: 'Chats Activos',
        value: activeChats,
        icon: 'MessageSquare',
        color: activeChats >= 5 ? 'red' : 'green',
      },
      {
        label: 'Cerrados Hoy',
        value: closedToday,
        icon: 'CheckCircle',
        color: 'blue',
      },
      {
        label: 'Tiempo Resp.',
        value: Math.round(avgResponseTime / 60),
        icon: 'Timer',
        color: avgResponseTime > 180 ? 'amber' : 'green',
      },
      {
        label: 'Rating',
        value: Number(ratings.avgRating?.toFixed(1)) || 0,
        icon: 'Star',
        color: ratings.avgRating >= 4 ? 'green' : ratings.avgRating >= 3 ? 'amber' : 'red',
      },
      {
        label: 'SLA en Riesgo',
        value: slaAtRisk,
        icon: 'AlertTriangle',
        color: slaAtRisk > 0 ? 'red' : 'green',
      },
    ];

    // Process my chats
    const myChats = mySessions.map((session: any) => {
      const lastMessageTime = session.lastMessageAt ? new Date(session.lastMessageAt).getTime() : 0;
      const slaRisk = Date.now() - lastMessageTime > 3 * 60 * 1000;
      return {
        sessionId: session.sessionId,
        user: session.user?.firstName || session.user?.username || 'Usuario',
        lastMessage: session.lastMessagePreview || '',
        slaRisk,
        priority: session.priority || 'normal',
      };
    });

    // Process upcoming actions
    const upcomingActions = scheduledMessages.map((msg: any) => ({
      type: 'scheduled_message',
      description: `Mensaje programado: ${msg.content?.substring(0, 50)}...`,
      dueAt: msg.scheduledFor,
      link: `/scheduled/${msg._id}`,
    }));

    // Process recent activity
    const recentActivity = myActivity.map((log: any) => ({
      action: log.action,
      time: log.createdAt,
      details: log.description || '',
    }));

    return {
      cards,
      myChats,
      upcomingActions,
      recentActivity,
    };
  } catch (error) {
    logger.error('api', { message: 'Error getting agent personal metrics', error: String(error) });
    throw error;
  }
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get all agents with their metrics
 */
async function getAgentMetrics(): Promise<AgentMetrics[]> {
  const today = getStartOfDay();

  const agents = await Agent.find({ isActive: true }).lean();

  const agentMetrics = await Promise.all(
    agents.map(async (agent) => {
      const [activeChats, closedToday, avgResponseData, ratingsData] = await Promise.all([
        ChatSession.countDocuments({
          assignedAgent: agent._id,
          status: 'human',
        }),
        ChatSession.countDocuments({
          assignedAgent: agent._id,
          status: 'closed',
          closedAt: { $gte: today },
        }),
        ActivityLog.aggregate([
          {
            $match: {
              action: 'first_response',
              actorId: agent._id.toString(),
              createdAt: { $gte: today },
            },
          },
          {
            $group: {
              _id: null,
              avgTime: { $avg: '$metadata.responseTimeSeconds' },
            },
          },
        ]),
        ChatSession.aggregate([
          {
            $match: {
              assignedAgent: agent._id,
              'survey.rating': { $exists: true },
              createdAt: { $gte: getStartOfWeek() },
            },
          },
          {
            $group: {
              _id: null,
              avgRating: { $avg: '$survey.rating' },
              count: { $sum: 1 },
            },
          },
        ]),
      ]);

      // Check SLA breaches
      const slaBreaches = await ChatSession.countDocuments({
        assignedAgent: agent._id,
        status: 'human',
        lastMessageAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) },
      });

      // Determine availability status based on onlineStatus and activeChats
      const status: AvailabilityStatus = agent.onlineStatus === 'offline' 
        ? 'offline' 
        : activeChats >= 5 ? 'busy' : 'available';

      return {
        agentId: agent._id.toString(),
        name: agent.name,
        email: agent.email,
        avatar: agent.avatar,
        status,
        activeChats,
        maxChats: 5,
        closedToday,
        avgResponseTime: avgResponseData[0]?.avgTime || 0,
        slaBreaches,
        rating: ratingsData[0]?.avgRating || 0,
        ratingCount: ratingsData[0]?.count || 0,
        lastActivity: agent.lastActivity,
      };
    })
  );

  return agentMetrics;
}

/**
 * Get flow execution stats
 */
async function getFlowStats(): Promise<{ name: string; executions: number; success: number }[]> {
  const today = getStartOfDay();

  const flowStats = await ActivityLog.aggregate([
    {
      $match: {
        action: 'flow_executed',
        createdAt: { $gte: today },
      },
    },
    {
      $group: {
        _id: '$metadata.flowId',
        executions: { $sum: 1 },
        success: {
          $sum: { $cond: [{ $eq: ['$metadata.success', true] }, 1, 0] },
        },
      },
    },
  ]);

  // Get flow names
  const flowIds = flowStats.map(f => f._id).filter(Boolean);
  const flows = await Flow.find({ _id: { $in: flowIds } }).lean();
  const flowMap = new Map(flows.map(f => [f._id.toString(), f.name]));

  return flowStats.map(stat => ({
    name: flowMap.get(stat._id) || 'Unknown Flow',
    executions: stat.executions,
    success: stat.success,
  }));
}

/**
 * Get system health metrics
 */
async function getSystemHealth(): Promise<SystemHealth> {
  let redisStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
  let redisLatency = 0;
  let mongoStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
  let mongoLatency = 0;

  // Check Redis
  try {
    const redisClient = getRedisClient();
    if (redisClient) {
      const start = Date.now();
      await redisClient.ping();
      redisLatency = Date.now() - start;
      if (redisLatency > 100) redisStatus = 'degraded';
    } else {
      redisStatus = 'down';
    }
  } catch {
    redisStatus = 'down';
  }

  // Check MongoDB
  try {
    const start = Date.now();
    await Agent.findOne().limit(1);
    mongoLatency = Date.now() - start;
    if (mongoLatency > 200) mongoStatus = 'degraded';
  } catch {
    mongoStatus = 'down';
  }

  // Get queue stats from Redis
  let queuePending = 0;
  let queueBacklog = 0;
  try {
    const redisClient = getRedisClient();
    if (redisClient) {
      queuePending = await redisClient.llen('message:queue') || 0;
      queueBacklog = await redisClient.llen('message:failed') || 0;
    }
  } catch {
    // Ignore
  }

  return {
    redis: { status: redisStatus, latency: redisLatency },
    mongodb: { status: mongoStatus, latency: mongoLatency },
    workers: { running: 1, failed: 0 }, // Would need worker manager integration
    queues: { pending: queuePending, backlog: queueBacklog },
    webhooks: { success: 0, failed: 0 }, // Would need webhook stats
  };
}

/**
 * Generate alerts based on current metrics
 */
async function generateAlerts(
  slaAtRisk: number,
  agentMetrics: AgentMetrics[],
  systemHealth: SystemHealth
): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // SLA breach alerts
  if (slaAtRisk > 0) {
    alerts.push({
      id: `sla-${Date.now()}`,
      type: 'sla_breach',
      severity: slaAtRisk > 5 ? 'critical' : slaAtRisk > 2 ? 'high' : 'medium',
      title: 'SLA en riesgo',
      description: `${slaAtRisk} conversaciones están cerca de violar el SLA`,
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  // Agent disconnect alerts
  const offlineAgentsWithChats = agentMetrics.filter(
    a => a.status === 'offline' && a.activeChats > 0
  );
  for (const agent of offlineAgentsWithChats) {
    alerts.push({
      id: `agent-${agent.agentId}-${Date.now()}`,
      type: 'agent_disconnect',
      severity: 'high',
      title: 'Agente desconectado con chats activos',
      description: `${agent.name} tiene ${agent.activeChats} chats activos pero está offline`,
      entityId: agent.agentId,
      entityType: 'agent',
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  // System health alerts
  if (systemHealth.redis.status === 'down') {
    alerts.push({
      id: `redis-${Date.now()}`,
      type: 'worker_down',
      severity: 'critical',
      title: 'Redis no disponible',
      description: 'El servidor Redis no está respondiendo',
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  if (systemHealth.queues.backlog > 100) {
    alerts.push({
      id: `queue-${Date.now()}`,
      type: 'queue_saturated',
      severity: 'high',
      title: 'Cola saturada',
      description: `${systemHealth.queues.backlog} mensajes en cola de fallos`,
      timestamp: new Date(),
      acknowledged: false,
    });
  }

  return alerts;
}

/**
 * Generate insights from metrics
 */
async function generateInsights(
  chatsByHour: { _id: number; count: number }[],
  agentMetrics: AgentMetrics[],
  categoryData: { _id: string; count: number }[]
): Promise<Insight[]> {
  const insights: Insight[] = [];

  // Peak hour insight
  if (chatsByHour.length > 0) {
    const peakHour = chatsByHour.reduce((max, h) => (h.count > max.count ? h : max), chatsByHour[0]);
    if (peakHour.count > 0) {
      insights.push({
        type: 'info',
        title: 'Hora pico',
        description: `Mayor carga hoy a las ${peakHour._id}:00 con ${peakHour.count} chats`,
        metric: `${peakHour.count} chats`,
        timestamp: new Date(),
      });
    }
  }

  // Best agent insight
  const onlineAgents = agentMetrics.filter(a => a.status !== 'offline' && a.closedToday > 0);
  if (onlineAgents.length > 0) {
    const bestAgent = onlineAgents.reduce((best, a) => {
      const score = a.rating * 0.4 + (1 / (a.avgResponseTime || 1)) * 0.3 + a.closedToday * 0.3;
      const bestScore = best.rating * 0.4 + (1 / (best.avgResponseTime || 1)) * 0.3 + best.closedToday * 0.3;
      return score > bestScore ? a : best;
    });
    insights.push({
      type: 'success',
      title: 'Mejor rendimiento',
      description: `${bestAgent.name} tiene el mejor rendimiento con ${bestAgent.closedToday} chats cerrados`,
      metric: `⭐ ${bestAgent.rating.toFixed(1)}`,
      timestamp: new Date(),
    });
  }

  // Top category insight
  if (categoryData.length > 0) {
    const topCategory = categoryData.reduce((max, c) => (c.count > max.count ? c : max), categoryData[0]);
    insights.push({
      type: 'info',
      title: 'Categoría más activa',
      description: `"${topCategory._id || 'General'}" con ${topCategory.count} tickets`,
      metric: `${topCategory.count}`,
      timestamp: new Date(),
    });
  }

  return insights;
}

// ==================== REAL-TIME UPDATES ====================

/**
 * Get quick stats for real-time updates (optimized for frequent calls)
 */
export async function getQuickStats(): Promise<{
  activeChats: number;
  queueLength: number;
  onlineAgents: number;
  slaAtRisk: number;
}> {
  const redisClient = getRedisClient();
  
  // Try cache first
  const cacheKey = 'dashboard:quick-stats';
  if (redisClient) {
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  }

  const [activeChats, queueLength, onlineAgents, slaAtRisk] = await Promise.all([
    ChatSession.countDocuments({ status: 'human' }),
    ChatSession.countDocuments({ status: 'waiting' }),
    Agent.countDocuments({ onlineStatus: { $in: ['online', 'away'] } }),
    ChatSession.countDocuments({
      status: 'waiting',
      createdAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) },
    }),
  ]);

  const stats = { activeChats, queueLength, onlineAgents, slaAtRisk };

  // Cache for 10 seconds
  if (redisClient) {
    await redisClient.set(cacheKey, JSON.stringify(stats), 'EX', 10);
  }

  return stats;
}

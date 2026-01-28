/**
 * Dashboard Types
 * Shared types for dashboard components
 */

export interface MetricCard {
  label: string;
  value: number | string;
  change?: number;
  changePercent?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan' | 'indigo' | 'gray';
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
  status: 'available' | 'busy' | 'away' | 'offline';
  activeChats: number;
  maxChats: number;
  closedToday: number;
  avgResponseTime: number;
  slaBreaches: number;
  rating: number;
  ratingCount: number;
  lastActivity?: string;
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
  timestamp: string;
}

export interface Alert {
  id: string;
  type: 'sla_breach' | 'agent_disconnect' | 'queue_saturated' | 'worker_down' | 'error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  entityId?: string;
  entityType?: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface FlowStat {
  name: string;
  executions: number;
  success: number;
}

export interface QueueItem {
  chatId: string;
  sessionId?: string;
  customerName: string;
  user?: string;
  waitTime: number;
  channel?: string;
  priority?: number;
  category?: string;
}

export interface Transfer {
  chatId: string;
  sessionId?: string;
  customerName?: string;
  fromAgent: string;
  toAgent?: string;
  toTeam?: string;
  from?: string;
  to?: string;
  reason?: string;
  requestedAt: string;
  time?: string;
}

export interface NegativeRating {
  chatId: string;
  sessionId?: string;
  agentId?: string;
  agentName: string;
  agent?: string;
  rating: number;
  comment?: string;
  timestamp: string;
  time?: string;
}

export interface MyChat {
  chatId: string;
  sessionId?: string;
  customerName: string;
  user?: string;
  lastMessage?: string;
  lastActivity?: string;
  unreadCount: number;
  channel?: string;
  slaDeadline?: string;
  slaRisk?: boolean;
  priority?: string;
}

export interface UpcomingAction {
  id: string;
  type: 'followup' | 'callback' | 'reminder' | string;
  title: string;
  description?: string;
  customerName?: string;
  dueAt: string;
  link?: string;
}

export interface RecentActivity {
  type: 'chat_closed' | 'chat_started' | 'transfer' | 'rating' | string;
  description: string;
  action?: string;
  timestamp: string;
  time?: string;
  details?: string;
}

// API Responses
export interface AdminDashboardData {
  cards: MetricCard[];
  chatsByHour: TimeSeriesPoint[];
  chatsByCategory: CategoryBreakdown[];
  slaCompliance: number;
  agentLoad: AgentMetrics[];
  flowStats: FlowStat[];
  systemHealth: SystemHealth;
  alerts: Alert[];
  insights: Insight[];
}

export interface SupervisorDashboardData {
  cards: MetricCard[];
  agentLoad: AgentMetrics[];
  agentStatus?: AgentMetrics[];
  queue: QueueItem[];
  queueLive?: QueueItem[];
  chatsByHour: TimeSeriesPoint[];
  transfers: Transfer[];
  recentTransfers?: Transfer[];
  negativeRatings: NegativeRating[];
}

export interface AgentDashboardData {
  cards: MetricCard[];
  myChats: MyChat[];
  upcomingActions: UpcomingAction[];
  recentActivity: RecentActivity[];
  performanceTrend?: TimeSeriesPoint[];
  todayResolved?: number;
  dailyGoal?: number;
  avgResponseTime?: number;
  csat?: number;
  avgRating?: number;
  weekTotal?: number;
  streak?: number;
}

export interface QuickStats {
  activeChats: number;
  queueLength: number;
  onlineAgents: number;
  slaAtRisk: number;
}

export interface DashboardFilters {
  startDate?: string;
  endDate?: string;
  channel?: string;
  teamId?: string;
  category?: string;
}

/**
 * Dashboard UI Components
 * Reusable components for the dashboard views
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageCircle,
  Activity,
  Clock,
  AlertTriangle,
  Users,
  Workflow,
  Calendar,
  AlertOctagon,
  CheckCircle,
  Timer,
  RotateCcw,
  ThumbsDown,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  RefreshCw,
  Server,
  Database,
  Cpu,
  Layers,
  Webhook,
  MessageSquare,
  X,
  Bell,
  Eye,
  ArrowRight,
  Zap,
} from 'lucide-react';
import type { MetricCard as MetricCardType, Alert, Insight, AgentMetrics, SystemHealth } from '../../types/dashboard';

// ==================== ICONS MAP ====================

const ICONS: Record<string, React.ElementType> = {
  MessageCircle,
  Activity,
  Clock,
  AlertTriangle,
  Users,
  Workflow,
  Calendar,
  AlertOctagon,
  CheckCircle,
  Timer,
  RotateCcw,
  ThumbsDown,
  Star,
  MessageSquare,
  Server,
  Database,
  Cpu,
  Layers,
  Webhook,
  Zap,
};

// ==================== COLOR UTILITIES ====================

const COLORS = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    fill: 'fill-blue-500',
    accent: 'bg-blue-500',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
    fill: 'fill-green-500',
    accent: 'bg-green-500',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    fill: 'fill-amber-500',
    accent: 'bg-amber-500',
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    fill: 'fill-red-500',
    accent: 'bg-red-500',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    fill: 'fill-purple-500',
    accent: 'bg-purple-500',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    fill: 'fill-cyan-500',
    accent: 'bg-cyan-500',
  },
  indigo: {
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400',
    fill: 'fill-indigo-500',
    accent: 'bg-indigo-500',
  },
  gray: {
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/30',
    text: 'text-gray-400',
    fill: 'fill-gray-500',
    accent: 'bg-gray-500',
  },
};

// ==================== METRIC CARD ====================

type ColorKey = keyof typeof COLORS;

interface MetricCardProps {
  card: MetricCardType;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export function MetricCard({ card, size = 'md', animate = true }: MetricCardProps) {
  const colorKey: ColorKey = (card.color || 'gray') as ColorKey;
  const color = COLORS[colorKey];
  const Icon = card.icon ? ICONS[card.icon] : Activity;

  const content = (
    <div
      className={`
        relative overflow-hidden rounded-xl border transition-all duration-300
        ${color.bg} ${color.border}
        ${card.link ? 'hover:scale-[1.02] hover:shadow-lg cursor-pointer' : ''}
        ${size === 'sm' ? 'p-3' : size === 'lg' ? 'p-6' : 'p-4'}
        ${animate ? 'animate-in fade-in slide-in-from-bottom-2 duration-500' : ''}
      `}
    >
      {/* Background Glow */}
      <div className={`absolute -top-4 -right-4 w-24 h-24 ${color.accent} opacity-5 blur-2xl rounded-full`} />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative">
        <div className={`p-2 rounded-lg ${color.bg}`}>
          <Icon className={`w-5 h-5 ${color.text}`} />
        </div>
        
        {card.trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            card.trend === 'up' ? 'text-green-400' :
            card.trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {card.trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {card.trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {card.trend === 'neutral' && <Minus className="w-3 h-3" />}
            {card.changePercent !== undefined && `${card.changePercent}%`}
          </div>
        )}
      </div>
      
      {/* Value */}
      <p className={`font-bold text-white mb-1 ${
        size === 'sm' ? 'text-2xl' : size === 'lg' ? 'text-4xl' : 'text-3xl'
      }`}>
        {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
      </p>
      
      {/* Label */}
      <p className="text-sm text-gray-400">{card.label}</p>
      
      {/* Change indicator */}
      {card.change !== undefined && card.change !== 0 && (
        <p className={`text-xs mt-1 ${card.change > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {card.change > 0 ? '+' : ''}{card.change} vs ayer
        </p>
      )}
      
      {/* Link indicator */}
      {card.link && (
        <ChevronRight className="absolute bottom-3 right-3 w-4 h-4 text-gray-600" />
      )}
    </div>
  );

  if (card.link) {
    return <Link to={card.link}>{content}</Link>;
  }
  
  return content;
}

// ==================== METRIC CARDS GRID ====================

interface MetricCardsGridProps {
  cards: MetricCardType[];
  columns?: 2 | 3 | 4 | 5;
}

export function MetricCardsGrid({ cards, columns = 4 }: MetricCardsGridProps) {
  const gridClass = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  };

  return (
    <div className={`grid gap-4 ${gridClass[columns]}`}>
      {cards.map((card, i) => (
        <MetricCard 
          key={card.label} 
          card={card} 
          animate
        />
      ))}
    </div>
  );
}

// ==================== DASHBOARD SECTION ====================

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function DashboardSection({ 
  title, 
  subtitle, 
  icon: Icon, 
  action, 
  children,
  className = '',
}: DashboardSectionProps) {
  return (
    <div className={`bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="p-2 bg-gray-800 rounded-lg">
              <Icon className="w-4 h-4 text-gray-400" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-5">
        {children}
      </div>
    </div>
  );
}

// ==================== SYSTEM HEALTH ====================

type HealthStatus = 'healthy' | 'degraded' | 'down';

interface SystemHealthCardProps {
  health: SystemHealth;
}

export function SystemHealthCard({ health }: SystemHealthCardProps) {
  const services: Array<{ name: string; status: HealthStatus; latency: number; icon: React.ElementType; extra?: string }> = [
    { name: 'Redis', ...health.redis, icon: Server },
    { name: 'MongoDB', ...health.mongodb, icon: Database },
    { name: 'Workers', status: health.workers.failed === 0 ? 'healthy' : 'degraded', latency: 0, icon: Cpu, extra: `${health.workers.running} running` },
    { name: 'Queues', status: (health.queues.backlog < 50 ? 'healthy' : health.queues.backlog < 100 ? 'degraded' : 'down') as HealthStatus, latency: 0, icon: Layers, extra: `${health.queues.pending} pending` },
  ];

  const statusColors: Record<HealthStatus, string> = {
    healthy: 'bg-green-500',
    degraded: 'bg-amber-500',
    down: 'bg-red-500',
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {services.map((service) => (
        <div 
          key={service.name}
          className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700"
        >
          <service.icon className="w-5 h-5 text-gray-400" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{service.name}</span>
              <span className={`w-2 h-2 rounded-full ${statusColors[service.status]}`} />
            </div>
            <p className="text-xs text-gray-500 truncate">
              {service.latency > 0 ? `${service.latency}ms` : service.extra || service.status}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== ALERTS PANEL ====================

type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
type AlertType = 'sla_breach' | 'agent_disconnect' | 'queue_saturated' | 'worker_down' | 'error';

interface AlertsPanelProps {
  alerts: Alert[];
  onAcknowledge: (id: string) => void;
  maxShow?: number;
}

export function AlertsPanel({ alerts, onAcknowledge, maxShow = 5 }: AlertsPanelProps) {
  const [showAll, setShowAll] = useState(false);
  const displayAlerts = showAll ? alerts : alerts.slice(0, maxShow);

  const severityColors: Record<AlertSeverity, string> = {
    low: 'border-gray-500 bg-gray-500/10',
    medium: 'border-amber-500 bg-amber-500/10',
    high: 'border-orange-500 bg-orange-500/10',
    critical: 'border-red-500 bg-red-500/10 animate-pulse',
  };

  const severityIcons: Record<AlertType, React.ElementType> = {
    sla_breach: Clock,
    agent_disconnect: Users,
    queue_saturated: Layers,
    worker_down: Cpu,
    error: AlertOctagon,
  };

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <CheckCircle className="w-10 h-10 mb-2 text-green-500/50" />
        <p className="text-sm">Sin alertas activas</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayAlerts.map((alert) => {
        const Icon = severityIcons[alert.type as AlertType] || AlertTriangle;
        const severityClass = severityColors[alert.severity as AlertSeverity] || severityColors.low;
        
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 p-3 rounded-lg border ${severityClass}`}
          >
            <Icon className={`w-5 h-5 mt-0.5 ${
              alert.severity === 'critical' ? 'text-red-400' :
              alert.severity === 'high' ? 'text-orange-400' :
              alert.severity === 'medium' ? 'text-amber-400' : 'text-gray-400'
            }`} />
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{alert.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{alert.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </p>
            </div>
            
            <button
              onClick={() => onAcknowledge(alert.id)}
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="Marcar como leída"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        );
      })}
      
      {alerts.length > maxShow && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full py-2 text-xs text-gray-400 hover:text-white transition-colors"
        >
          {showAll ? 'Mostrar menos' : `Ver ${alerts.length - maxShow} más`}
        </button>
      )}
    </div>
  );
}

// ==================== INSIGHTS PANEL ====================

type InsightType = 'info' | 'success' | 'warning' | 'alert';

interface InsightsPanelProps {
  insights: Insight[];
}

export function InsightsPanel({ insights }: InsightsPanelProps) {
  const typeStyles: Record<InsightType, { icon: React.ElementType; color: string; bg: string }> = {
    info: { icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    success: { icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    alert: { icon: Bell, color: 'text-red-400', bg: 'bg-red-500/10' },
  };

  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <Eye className="w-10 h-10 mb-2 opacity-50" />
        <p className="text-sm">Recopilando insights...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, i) => {
        const style = typeStyles[(insight.type as InsightType)] || typeStyles.info;
        const Icon = style.icon;
        
        return (
          <div
            key={i}
            className={`flex items-start gap-3 p-3 rounded-lg ${style.bg}`}
          >
            <Icon className={`w-5 h-5 mt-0.5 ${style.color}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white">{insight.title}</p>
                {insight.metric && (
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}>
                    {insight.metric}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{insight.description}</p>
            </div>
            {insight.link && (
              <Link to={insight.link} className="p-1 hover:bg-gray-700 rounded">
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==================== AGENT STATUS TABLE ====================

type AgentStatus = 'available' | 'busy' | 'away' | 'offline';

interface AgentStatusTableProps {
  agents: AgentMetrics[];
  onAction?: (action: string, agentId: string) => void;
  showActions?: boolean;
}

export function AgentStatusTable({ agents, onAction, showActions = false }: AgentStatusTableProps) {
  const statusColors: Record<AgentStatus, string> = {
    available: 'bg-green-500',
    busy: 'bg-amber-500',
    away: 'bg-gray-500',
    offline: 'bg-red-500',
  };

  const statusLabels: Record<AgentStatus, string> = {
    available: 'Disponible',
    busy: 'Ocupado',
    away: 'Ausente',
    offline: 'Offline',
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
            <th className="pb-3 font-medium">Agente</th>
            <th className="pb-3 font-medium">Estado</th>
            <th className="pb-3 font-medium text-center">Chats</th>
            <th className="pb-3 font-medium text-center">Tiempo Resp.</th>
            <th className="pb-3 font-medium text-center">SLA</th>
            <th className="pb-3 font-medium text-center">Rating</th>
            {showActions && <th className="pb-3 font-medium text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {agents.map((agent) => {
            const agentStatus = agent.status as AgentStatus;
            return (
              <tr key={agent.agentId} className="group hover:bg-gray-800/50 transition-colors">
                <td className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-medium text-white">
                      {agent.avatar ? (
                        <img src={agent.avatar} alt={agent.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        agent.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{agent.name}</p>
                      <p className="text-xs text-gray-500">{agent.email}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusColors[agentStatus]}`} />
                    <span className="text-sm text-gray-300">{statusLabels[agentStatus]}</span>
                  </div>
                </td>
                <td className="py-3 text-center">
                  <span className="text-sm text-white">
                    {agent.activeChats}/{agent.maxChats}
                  </span>
                </td>
                <td className="py-3 text-center">
                  <span className={`text-sm ${agent.avgResponseTime > 180 ? 'text-red-400' : 'text-gray-300'}`}>
                    {Math.round(agent.avgResponseTime / 60)}m
                  </span>
                </td>
                <td className="py-3 text-center">
                  {agent.slaBreaches > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle className="w-3 h-3" />
                      {agent.slaBreaches}
                    </span>
                  ) : (
                    <span className="text-xs text-green-400">✓</span>
                  )}
                </td>
                <td className="py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 text-amber-400" />
                    <span className="text-sm text-white">{agent.rating.toFixed(1)}</span>
                  </div>
                </td>
                {showActions && (
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onAction?.('reassign', agent.agentId)}
                        className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      title="Reasignar chats"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onAction?.('whisper', agent.agentId)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      title="Susurrar"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onAction?.('pause', agent.agentId)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      title="Pausar agente"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
      
      {agents.length === 0 && (
        <div className="py-8 text-center text-gray-500">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay agentes activos</p>
        </div>
      )}
    </div>
  );
}

// ==================== LOADING SKELETON ====================

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-gray-800/50 rounded-xl border border-gray-700" />
        ))}
      </div>
      
      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 bg-gray-800/50 rounded-xl border border-gray-700" />
        <div className="h-64 bg-gray-800/50 rounded-xl border border-gray-700" />
      </div>
      
      {/* Table skeleton */}
      <div className="h-80 bg-gray-800/50 rounded-xl border border-gray-700" />
    </div>
  );
}

// ==================== REFRESH BUTTON ====================

interface RefreshButtonProps {
  onClick: () => void;
  isRefreshing?: boolean;
}

export function RefreshButton({ onClick, isRefreshing }: RefreshButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={isRefreshing}
      className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      Actualizar
    </button>
  );
}

// ==================== DATE FILTER ====================

interface DateFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function DateFilter({ value, onChange }: DateFilterProps) {
  const options = [
    { value: 'today', label: 'Hoy' },
    { value: 'yesterday', label: 'Ayer' },
    { value: 'week', label: 'Última semana' },
    { value: 'month', label: 'Último mes' },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            value === option.value
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

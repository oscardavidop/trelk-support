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

const COLORS = {
  blue: {
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    glow: 'from-blue-500/20',
  },
  green: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    glow: 'from-emerald-500/20',
  },
  amber: {
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    glow: 'from-amber-500/20',
  },
  red: {
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    glow: 'from-red-500/20',
  },
  purple: {
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    glow: 'from-purple-500/20',
  },
  cyan: {
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    glow: 'from-cyan-500/20',
  },
  indigo: {
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    glow: 'from-indigo-500/20',
  },
  gray: {
    text: 'text-zinc-400',
    bg: 'bg-zinc-500/10',
    border: 'border-zinc-500/20',
    glow: 'from-zinc-500/10',
  },
};

type ColorKey = keyof typeof COLORS;

// ==================== METRIC CARD ====================

interface MetricCardProps {
  card: MetricCardType;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export function MetricCard({ card, size = 'md', animate = true }: MetricCardProps) {
  const colorKey: ColorKey = (card.color || 'gray') as ColorKey;
  const color = COLORS[colorKey];
  const Icon = card.icon && ICONS[card.icon] ? ICONS[card.icon] : Activity;

  // Clases de tamaño
  const sizeClasses = {
    sm: { padding: 'p-4', value: 'text-2xl', icon: 'p-1.5' },
    md: { padding: 'p-5', value: 'text-3xl', icon: 'p-2' },
    lg: { padding: 'p-6', value: 'text-4xl', icon: 'p-3' },
  }[size];

  const content = (
    <div
      className={`
        relative overflow-hidden rounded-2xl border bg-zinc-900 transition-all duration-300
        border-zinc-800 ${sizeClasses.padding}
        ${card.link ? 'hover:scale-[1.02] hover:border-zinc-700 hover:shadow-xl cursor-pointer group' : ''}
        ${animate ? 'animate-in fade-in slide-in-from-bottom-4 duration-500' : ''}
      `}
    >
      {/* Ambient Glow Gradient */}
      <div className={`absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br ${color.glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl pointer-events-none`} />
      
      {/* Header: Icon & Trend */}
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className={`rounded-xl border ${color.bg} ${color.border} ${sizeClasses.icon}`}>
          <Icon className={`w-5 h-5 ${color.text}`} />
        </div>
        
        {card.trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full border bg-zinc-950/50 backdrop-blur-sm
            ${card.trend === 'up' ? 'text-emerald-400 border-emerald-500/20' : 
              card.trend === 'down' ? 'text-red-400 border-red-500/20' : 
              'text-zinc-400 border-zinc-700'}
          `}>
            {card.trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {card.trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {card.trend === 'neutral' && <Minus className="w-3 h-3" />}
            {card.changePercent !== undefined && <span>{Math.abs(card.changePercent)}%</span>}
          </div>
        )}
      </div>
      
      {/* Main Value */}
      <div className="relative z-10">
        <p className={`font-bold text-zinc-50 tracking-tight leading-none ${sizeClasses.value}`}>
          {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
        </p>
        
        <div className="flex items-center justify-between mt-2">
          <p className="text-sm font-medium text-zinc-400 truncate pr-2">{card.label}</p>
          
          {/* Secondary change indicator (e.g., "+5 vs yesterday") */}
          {card.change !== undefined && card.change !== 0 && (
            <span className={`text-xs font-medium ${card.change > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {card.change > 0 ? '+' : ''}{card.change}
            </span>
          )}
        </div>
      </div>
      
      {/* Hover Arrow Indicator */}
      {card.link && (
        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        </div>
      )}
    </div>
  );

  if (card.link) {
    return <Link to={card.link} className="block">{content}</Link>;
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
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
  };

  return (
    <div className={`grid gap-4 ${gridClass[columns]}`}>
      {cards.map((card, i) => (
        <MetricCard 
          key={card.label + i} 
          card={card} 
          animate
        />
      ))}
    </div>
  );
}

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
    <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl shadow-sm hover:border-zinc-700/50 transition-colors flex flex-col ${className}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800/50 shrink-0">
        <div className="flex items-center gap-4">
          {Icon && (
            <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-400 shadow-sm">
              <Icon className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className="text-base font-bold text-zinc-50 tracking-tight leading-none">{title}</h3>
            {subtitle && <p className="text-xs text-zinc-500 mt-1.5 font-medium">{subtitle}</p>}
          </div>
        </div>
        
        {/* Action Area */}
        {action && (
          <div className="pl-4">
            {action}
          </div>
        )}
      </div>

      {/* Content Body */}
      <div className="p-6 flex-1">
        {children}
      </div>
    </div>
  );
}

// ==================== SYSTEM HEALTH ====================

type HealthStatus = 'healthy' | 'degraded' | 'down';

interface SystemHealthCardProps {
  health: {
    redis: { status: HealthStatus; latency: number };
    mongodb: { status: HealthStatus; latency: number };
    workers: { failed: number; running: number };
    queues: { backlog: number; pending: number };
  };
}

export function SystemHealthCard({ health }: SystemHealthCardProps) {
  
  // Mapeo de configuración visual por estado
  const getStatusConfig = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return { color: 'bg-emerald-500', text: 'text-emerald-500', glow: 'shadow-[0_0_10px_rgba(16,185,129,0.3)]' };
      case 'degraded':
        return { color: 'bg-amber-500', text: 'text-amber-500', glow: 'shadow-[0_0_10px_rgba(245,158,11,0.3)]' };
      case 'down':
        return { color: 'bg-red-500', text: 'text-red-500', glow: 'shadow-[0_0_10px_rgba(239,68,68,0.3)]' };
      default:
        return { color: 'bg-zinc-500', text: 'text-zinc-500', glow: '' };
    }
  };

  const services = [
    { 
      name: 'Redis', 
      status: health.redis.status, 
      value: `${health.redis.latency}ms`, 
      label: 'Latencia',
      icon: Server 
    },
    { 
      name: 'MongoDB', 
      status: health.mongodb.status, 
      value: `${health.mongodb.latency}ms`, 
      label: 'Latencia',
      icon: Database 
    },
    { 
      name: 'Workers', 
      status: health.workers.failed === 0 ? 'healthy' : 'degraded', 
      value: health.workers.running, 
      label: 'Procesos',
      icon: Cpu 
    },
    { 
      name: 'Colas', 
      status: (health.queues.backlog < 50 ? 'healthy' : health.queues.backlog < 100 ? 'degraded' : 'down') as HealthStatus, 
      value: health.queues.pending, 
      label: 'Pendientes',
      icon: Layers 
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {services.map((service) => {
        const style = getStatusConfig(service.status as HealthStatus);
        
        return (
          <div 
            key={service.name}
            className="group flex items-center justify-between p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all duration-300"
          >
            <div className="flex items-center gap-3">
              {/* Icon Box */}
              <div className={`p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 group-hover:border-zinc-700 transition-colors`}>
                <service.icon className={`w-5 h-5 ${style.text}`} />
              </div>
              
              <div>
                <h4 className="text-sm font-bold text-zinc-50 leading-none">{service.name}</h4>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="relative flex h-2 w-2">
                    {service.status === 'healthy' && (
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${style.color}`}></span>
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${style.color} ${style.glow}`}></span>
                  </div>
                  <span className={`text-[10px] font-medium uppercase${style.text}`}>
                    {service.status === 'healthy' ? 'Normal' : service.status === 'degraded' ? 'Lento' : 'Error'}
                  </span>
                </div>
              </div>
            </div>

            {/* Metric Value */}
            <div className="text-right">
              <p className="text-lg font-bold text-zinc-200 font-mono tracking-tight">{service.value}</p>
              <p className="text-[10px] text-zinc-500 font-medium">{service.label}</p>
            </div>
          </div>
        );
      })}
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

  const severityConfig: Record<AlertSeverity, { bg: string; text: string; border: string }> = {
    low: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/20' },
    medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    high: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
    critical: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' }, // Removed animate-pulse for cleaner UI
  };

  const severityIcons: Record<AlertType, React.ElementType> = {
    sla_breach: Clock, agent_disconnect: Users, queue_saturated: Layers, worker_down: Cpu, error: AlertOctagon,
  };

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
        <div className="p-3 bg-zinc-900 rounded-full mb-3 border border-zinc-800">
           <CheckCircle className="w-6 h-6 text-emerald-500 opacity-50" />
        </div>
        <p className="text-sm font-medium">Todo en orden</p>
        <p className="text-xs text-zinc-600">Sin alertas activas</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {displayAlerts.map((alert) => {
        const Icon = severityIcons[alert.type as AlertType] || AlertTriangle;
        const style = severityConfig[alert.severity as AlertSeverity] || severityConfig.low;
        
        return (
          <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-all hover:bg-zinc-900/50 ${style.bg} ${style.border}`}>
            <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${style.text}`} />
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                 <p className="text-sm font-bold text-zinc-200">{alert.title}</p>
                 <span className="text-[10px] text-zinc-500 font-mono">{new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{alert.description}</p>
            </div>
            
            <button onClick={() => onAcknowledge(alert.id)} className="p-1 hover:bg-black/20 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      
      {alerts.length > maxShow && (
        <button onClick={() => setShowAll(!showAll)} className="w-full py-2 text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors border-t border-zinc-800/50 mt-2">
          {showAll ? 'Mostrar menos' : `Ver ${alerts.length - maxShow} más alertas`}
        </button>
      )}
    </div>
  );
}

// ==================== INSIGHTS PANEL ====================

type InsightType = 'info' | 'success' | 'warning' | 'alert';
interface InsightsPanelProps { insights: Insight[]; }

export function InsightsPanel({ insights }: InsightsPanelProps) {
  const typeStyles: Record<InsightType, { icon: React.ElementType; color: string; bg: string; border: string }> = {
    info: { icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/5', border: 'border-blue-500/10' },
    success: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/5', border: 'border-emerald-500/10' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/10' },
    alert: { icon: Bell, color: 'text-red-400', bg: 'bg-red-500/5', border: 'border-red-500/10' },
  };

  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
        <Eye className="w-8 h-8 mb-2 opacity-20" />
        <p className="text-sm">Analizando datos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {insights.map((insight, i) => {
        const style = typeStyles[(insight.type as InsightType)] || typeStyles.info;
        const Icon = style.icon;
        
        return (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border transition-all hover:bg-zinc-900 ${style.bg} ${style.border}`}>
            <div className={`p-1.5 rounded-lg bg-zinc-950/50 border border-white/5 ${style.color}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-bold text-zinc-200">{insight.title}</p>
                {insight.metric && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${style.bg} ${style.color} ${style.border}`}>
                    {insight.metric}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{insight.description}</p>
            </div>
            {insight.link && (
              <Link to={insight.link} className="self-center p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300">
                <ArrowRight className="w-4 h-4" />
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
interface AgentStatusTableProps { agents: AgentMetrics[]; onAction?: (action: string, agentId: string) => void; showActions?: boolean; }

export function AgentStatusTable({ agents, onAction, showActions = false }: AgentStatusTableProps) {
  const statusConfig: Record<AgentStatus, { color: string; label: string }> = {
    available: { color: 'bg-emerald-500', label: 'Disponible' },
    busy: { color: 'bg-amber-500', label: 'Ocupado' },
    away: { color: 'bg-zinc-500', label: 'Ausente' },
    offline: { color: 'bg-red-500', label: 'Offline' },
  };

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <table className="w-full">
        <thead>
          <tr className="text-left text-[10px] font-bold text-zinc-500 border-b border-zinc-800 bg-zinc-900/50">
            <th className="px-4 py-3">Agente</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3 text-center">Chats</th>
            <th className="px-4 py-3 text-center">T. Resp</th>
            <th className="px-4 py-3 text-center">SLA</th>
            <th className="px-4 py-3 text-center">Rating</th>
            {showActions && <th className="px-4 py-3 text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {agents.map((agent) => {
            const status = statusConfig[agent.status as AgentStatus];
            return (
              <tr key={agent.agentId} className="group hover:bg-zinc-900/50 transition-colors text-sm">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 border border-zinc-700">
                      {agent.avatar ? <img src={agent.avatar} alt={agent.name} className="w-full h-full rounded-full object-cover" /> : agent.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-zinc-200">{agent.name}</p>
                      <p className="text-[10px] text-zinc-500 truncate max-w-[100px]">{agent.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${status.color} ring-4 ring-opacity-10 ${status.color.replace('bg-', 'ring-')}`} />
                    <span className="text-zinc-400 text-xs">{status.label}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-zinc-300 font-mono text-xs">
                  {agent.activeChats}<span className="text-zinc-600">/{agent.maxChats}</span>
                </td>
                <td className="px-4 py-3 text-center text-xs">
                  <span className={`${agent.avgResponseTime > 180 ? 'text-red-400' : 'text-zinc-400'}`}>{Math.round(agent.avgResponseTime / 60)}m</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {agent.slaBreaches > 0 ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded text-[10px] font-bold border border-red-500/20">
                      {agent.slaBreaches}
                    </span>
                  ) : <span className="text-emerald-500 text-xs">✓</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-zinc-300 font-medium">{agent.rating.toFixed(1)}</span>
                  </div>
                </td>
                {showActions && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onAction?.('whisper', agent.agentId)} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-50" title="Mensaje"><MessageSquare className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onAction?.('reassign', agent.agentId)} className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-50" title="Reasignar"><ArrowRight className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {agents.length === 0 && <div className="py-8 text-center text-zinc-500 text-sm">No hay agentes activos</div>}
    </div>
  );
}

// ==================== LOADING SKELETON ====================

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-zinc-900 rounded-2xl border border-zinc-800" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-zinc-900 rounded-2xl border border-zinc-800" />
        <div className="h-72 bg-zinc-900 rounded-2xl border border-zinc-800" />
      </div>
      <div className="h-80 bg-zinc-900 rounded-2xl border border-zinc-800" />
    </div>
  );
}

// ==================== REFRESH BUTTON ====================

interface RefreshButtonProps { onClick: () => void; isRefreshing?: boolean; }

export function RefreshButton({ onClick, isRefreshing }: RefreshButtonProps) {
  return (
    <button onClick={onClick} disabled={isRefreshing} className="group flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-50">
      <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-500' : 'group-hover:text-indigo-400'}`} />
      <span>{isRefreshing ? 'Actualizando...' : 'Actualizar'}</span>
    </button>
  );
}

// ==================== DATE FILTER ====================

interface DateFilterProps { value: string; onChange: (value: string) => void; }

export function DateFilter({ value, onChange }: DateFilterProps) {
  const options = [ { value: 'today', label: 'Hoy' }, { value: 'yesterday', label: 'Ayer' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' } ];

  return (
    <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
            value === opt.value
              ? 'bg-zinc-800 text-zinc-50 shadow-sm border border-zinc-700'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
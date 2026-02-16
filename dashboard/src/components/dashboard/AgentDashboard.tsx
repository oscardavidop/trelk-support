/**
 * Agent Dashboard Component
 * Personal view with individual metrics, current chats, and performance
 */

import { useAgentDashboard } from '../../hooks/useDashboard';
import {
  MetricCardsGrid,
  DashboardSection,
  RefreshButton,
  DashboardSkeleton,
} from './DashboardComponents';
import { ProgressBar, Sparkline } from './DashboardCharts';
import {
  MessageSquare,
  AlertTriangle,
  Clock,
  CalendarClock,
  History,
  Target,
  TrendingUp,
  Star,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowRightLeft,
} from 'lucide-react';
import type { MyChat, UpcomingAction, RecentActivity } from '../../types/dashboard';

interface MyChatListProps {
  chats: MyChat[];
  onOpenChat?: (chatId: string) => void;
}

function MyChatList({ chats, onOpenChat }: MyChatListProps) {
  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Sin chats activos</p>
        <p className="text-xs mt-1">Los chats nuevos aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {chats.map((chat, i) => {
        const slaMinutes = chat.slaDeadline 
          ? Math.floor((new Date(chat.slaDeadline).getTime() - Date.now()) / 60000)
          : null;
        const isAtRisk = slaMinutes !== null && slaMinutes < 10 && slaMinutes > 0;
        const isOverdue = slaMinutes !== null && slaMinutes <= 0;
        
        return (
          <div 
            key={chat.chatId || i}
            onClick={() => onOpenChat?.(chat.chatId)}
            className={`p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.01] ${
              isOverdue 
                ? 'bg-red-900/30 border-red-500/50 hover:border-red-500' 
                : isAtRisk 
                  ? 'bg-amber-900/20 border-amber-500/30 hover:border-amber-500'
                  : 'bg-gray-800/50 border-gray-700/50 hover:border-purple-500/50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-zinc-50 font-medium truncate">
                    {chat.customerName}
                  </p>
                  {chat.unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-purple-500 text-zinc-50 text-xs font-bold rounded-full">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 truncate mt-1">
                  {chat.lastMessage || 'Sin mensajes'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {chat.channel && (
                  <span className="px-1.5 py-0.5 bg-gray-700/50 text-gray-400 text-xs rounded">
                    {chat.channel}
                  </span>
                )}
                <span className="text-xs text-gray-500">
                  {chat.lastActivity 
                    ? new Date(chat.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
            </div>
            
            {/* SLA Indicator */}
            {slaMinutes !== null && (
              <div className={`flex items-center gap-2 mt-2 pt-2 border-t ${
                isOverdue ? 'border-red-500/30' :
                isAtRisk ? 'border-amber-500/30' : 'border-gray-700/30'
              }`}>
                <Clock className={`w-3 h-3 ${
                  isOverdue ? 'text-red-400' :
                  isAtRisk ? 'text-amber-400' : 'text-gray-500'
                }`} />
                <span className={`text-xs ${
                  isOverdue ? 'text-red-400 font-medium' :
                  isAtRisk ? 'text-amber-400' : 'text-gray-500'
                }`}>
                  {isOverdue 
                    ? `Vencido hace ${Math.abs(slaMinutes)}m` 
                    : `SLA en ${slaMinutes}m`}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface UpcomingActionsListProps {
  actions: UpcomingAction[];
  onAction?: (actionId: string) => void;
}

function UpcomingActionsList({ actions, onAction }: UpcomingActionsListProps) {
  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <CalendarClock className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Sin acciones pendientes</p>
      </div>
    );
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'followup': return Clock;
      case 'callback': return MessageSquare;
      case 'reminder': return AlertCircle;
      default: return Info;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'followup': return 'text-blue-400 bg-blue-500/20';
      case 'callback': return 'text-green-400 bg-green-500/20';
      case 'reminder': return 'text-amber-400 bg-amber-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {actions.map((action, i) => {
        const Icon = getActionIcon(action.type);
        const colorClass = getActionColor(action.type);
        const dueTime = new Date(action.dueAt);
        const isOverdue = dueTime < new Date();
        
        return (
          <div 
            key={action.id || i}
            onClick={() => onAction?.(action.id)}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              isOverdue 
                ? 'bg-red-900/20 border-red-500/30 hover:border-red-500' 
                : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className={`p-2 rounded-lg ${colorClass}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-50 truncate">{action.title}</p>
              <p className="text-xs text-gray-500">
                {action.customerName} • {dueTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {isOverdue && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                Vencido
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface RecentActivityListProps {
  activities: RecentActivity[];
}

function RecentActivityList({ activities }: RecentActivityListProps) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <History className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Sin actividad reciente</p>
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'chat_closed': return CheckCircle2;
      case 'chat_started': return MessageSquare;
      case 'transfer': return ArrowRightLeft;
      case 'rating': return Star;
      default: return Info;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'chat_closed': return 'text-green-400';
      case 'chat_started': return 'text-blue-400';
      case 'transfer': return 'text-amber-400';
      case 'rating': return 'text-purple-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-1">
      {activities.map((activity, i) => {
        const Icon = getActivityIcon(activity.type);
        const colorClass = getActivityColor(activity.type);
        
        return (
          <div 
            key={i}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/30 transition-colors"
          >
            <Icon className={`w-4 h-4 ${colorClass}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300 truncate">{activity.description}</p>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AgentDashboard() {
  const { data, isLoading, isRefreshing, error, refresh } = useAgentDashboard();

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No se pudieron cargar tus métricas</p>
        <p className="text-sm mt-1">{error || 'Intenta de nuevo más tarde'}</p>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-zinc-50 rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const handleOpenChat = (chatId: string) => {
    // TODO: Navigate to chat
    console.log('Open chat:', chatId);
  };

  const handleAction = (actionId: string) => {
    // TODO: Handle action
    console.log('Handle action:', actionId);
  };

  return (
    <div className="space-y-6">
      {/* Refresh indicator */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Última actualización: {new Date().toLocaleTimeString()}
        </p>
        <RefreshButton onClick={refresh} isRefreshing={isRefreshing} />
      </div>

      {/* Personal Performance Cards */}
      <MetricCardsGrid cards={data.cards} columns={5} />

      {/* Performance Trend */}
      {data.performanceTrend && data.performanceTrend.length > 0 && (
        <DashboardSection
          title="Tu Rendimiento"
          subtitle="Últimos 7 días"
          icon={TrendingUp}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Sparkline 
                data={data.performanceTrend} 
                height={60}
                color="#8b5cf6"
              />
            </div>
            <div className="ml-6 text-right">
              <p className="text-2xl font-bold text-zinc-50">
                {data.performanceTrend[data.performanceTrend.length - 1]?.value || 0}
              </p>
              <p className="text-xs text-gray-500">Chats hoy</p>
            </div>
          </div>
        </DashboardSection>
      )}

      {/* Current Chats & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Chats */}
        <DashboardSection
          title="Mis Chats Activos"
          subtitle={`${data.myChats.length} conversaciones`}
          icon={MessageSquare}
          action={
            data.myChats.filter(c => c.unreadCount > 0).length > 0 && (
              <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full">
                {data.myChats.reduce((sum, c) => sum + (c.unreadCount || 0), 0)} nuevos
              </span>
            )
          }
        >
          <MyChatList 
            chats={data.myChats}
            onOpenChat={handleOpenChat}
          />
        </DashboardSection>

        {/* Upcoming Actions */}
        <DashboardSection
          title="Acciones Pendientes"
          subtitle={`${data.upcomingActions.length} tareas`}
          icon={CalendarClock}
          action={
            data.upcomingActions.filter(a => new Date(a.dueAt) < new Date()).length > 0 && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                {data.upcomingActions.filter(a => new Date(a.dueAt) < new Date()).length} vencidas
              </span>
            )
          }
        >
          <UpcomingActionsList 
            actions={data.upcomingActions}
            onAction={handleAction}
          />
        </DashboardSection>
      </div>

      {/* Goals & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Goals */}
        <DashboardSection
          title="Objetivos del Día"
          subtitle="Tu progreso"
          icon={Target}
        >
          <div className="space-y-4">
            {/* Chats Goal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Chats resueltos</span>
                <span className="text-sm text-zinc-50 font-medium">
                  {data.todayResolved || 0} / {data.dailyGoal || 20}
                </span>
              </div>
              <ProgressBar 
                value={((data.todayResolved || 0) / (data.dailyGoal || 20)) * 100}
                color="bg-purple-500"
                showLabel
              />
            </div>

            {/* Response Time Goal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Tiempo de respuesta</span>
                <span className="text-sm text-zinc-50 font-medium">
                  {Math.round((data.avgResponseTime || 0) / 60)}m
                </span>
              </div>
              <ProgressBar 
                value={Math.max(0, 100 - ((data.avgResponseTime || 0) / 3))}
                color={
                  (data.avgResponseTime || 0) < 60 ? 'bg-green-500' :
                  (data.avgResponseTime || 0) < 180 ? 'bg-amber-500' : 'bg-red-500'
                }
                showLabel
              />
            </div>

            {/* CSAT Goal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-300">Satisfacción</span>
                <span className="text-sm text-zinc-50 font-medium">
                  {data.csat || 0}%
                </span>
              </div>
              <ProgressBar 
                value={data.csat || 0}
                color={
                  (data.csat || 0) >= 90 ? 'bg-green-500' :
                  (data.csat || 0) >= 70 ? 'bg-amber-500' : 'bg-red-500'
                }
                showLabel
              />
            </div>
          </div>
        </DashboardSection>

        {/* Recent Activity */}
        <DashboardSection
          title="Actividad Reciente"
          subtitle="Hoy"
          icon={History}
        >
          <RecentActivityList activities={data.recentActivity} />
        </DashboardSection>
      </div>

      {/* Motivational Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-900/30 to-green-800/10 p-4 rounded-xl border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <span className="text-sm text-green-300">Resueltos Hoy</span>
          </div>
          <p className="text-2xl font-bold text-zinc-50">{data.todayResolved || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-900/30 to-purple-800/10 p-4 rounded-xl border border-purple-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-purple-400" />
            <span className="text-sm text-purple-300">Calificación</span>
          </div>
          <p className="text-2xl font-bold text-zinc-50">{data.avgRating?.toFixed(1) || '0.0'}</p>
        </div>

        <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/10 p-4 rounded-xl border border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-blue-300">Esta Semana</span>
          </div>
          <p className="text-2xl font-bold text-zinc-50">{data.weekTotal || 0}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-900/30 to-amber-800/10 p-4 rounded-xl border border-amber-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-amber-400" />
            <span className="text-sm text-amber-300">Racha</span>
          </div>
          <p className="text-2xl font-bold text-zinc-50">{data.streak || 0} días</p>
        </div>
      </div>
    </div>
  );
}

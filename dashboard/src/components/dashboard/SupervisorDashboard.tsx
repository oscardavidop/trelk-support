/**
 * Supervisor Dashboard Component
 * Operational view with team management, queue monitoring, and real-time metrics
 */

import { useSupervisorDashboard } from '../../hooks/useDashboard';
import {
  MetricCardsGrid,
  DashboardSection,
  AgentStatusTable,
  RefreshButton,
  DashboardSkeleton,
} from './DashboardComponents';
import { BarChart, DonutChart, ProgressBar } from './DashboardCharts';
import {
  Users,
  AlertTriangle,
  Clock,
  ArrowRightLeft,
  ThumbsDown,
  Inbox,
  Timer,
  MessageSquare,
} from 'lucide-react';
import type { QueueItem, Transfer, NegativeRating } from '../../types/dashboard';

interface QueueListProps {
  items: QueueItem[];
  onAssign?: (chatId: string) => void;
}

function QueueList({ items, onAssign }: QueueListProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <Inbox className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Cola vacía</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {items.map((item, i) => {
        const waitMinutes = Math.floor(item.waitTime / 60);
        const isUrgent = waitMinutes > 5;
        const isCritical = waitMinutes > 10;
        
        return (
          <div 
            key={item.chatId || i} 
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              isCritical 
                ? 'bg-red-900/20 border-red-500/30' 
                : isUrgent 
                  ? 'bg-amber-900/20 border-amber-500/30'
                  : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm text-zinc-50 font-medium truncate">
                  {item.customerName}
                </p>
                {item.channel && (
                  <span className="px-1.5 py-0.5 bg-gray-700/50 text-gray-400 text-xs rounded">
                    {item.channel}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Clock className="w-3 h-3 text-gray-500" />
                <span className={`text-xs ${
                  isCritical ? 'text-red-400' :
                  isUrgent ? 'text-amber-400' : 'text-gray-500'
                }`}>
                  {waitMinutes}m en espera
                </span>
                {item.priority && item.priority > 1 && (
                  <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
                    Prioridad {item.priority}
                  </span>
                )}
              </div>
            </div>
            {onAssign && (
              <button
                onClick={() => onAssign(item.chatId)}
                className="ml-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-zinc-50 text-xs font-medium rounded-lg transition-colors"
              >
                Asignar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface TransferListProps {
  transfers: Transfer[];
  onApprove?: (transferId: string) => void;
  onReject?: (transferId: string) => void;
}

function TransferList({ transfers, onApprove, onReject }: TransferListProps) {
  if (transfers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <ArrowRightLeft className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Sin transferencias pendientes</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {transfers.map((transfer, i) => (
        <div 
          key={transfer.chatId || i}
          className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-50 font-medium">
              {transfer.customerName || 'Cliente'}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(transfer.requestedAt).toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <span>{transfer.fromAgent}</span>
            <ArrowRightLeft className="w-3 h-3" />
            <span>{transfer.toAgent || transfer.toTeam || 'Sin asignar'}</span>
          </div>
          {transfer.reason && (
            <p className="text-xs text-gray-500 mb-2 italic">
              "{transfer.reason}"
            </p>
          )}
          {(onApprove || onReject) && (
            <div className="flex gap-2">
              {onApprove && (
                <button
                  onClick={() => onApprove(transfer.chatId)}
                  className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-zinc-50 text-xs font-medium rounded transition-colors"
                >
                  Aprobar
                </button>
              )}
              {onReject && (
                <button
                  onClick={() => onReject(transfer.chatId)}
                  className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-zinc-50 text-xs font-medium rounded transition-colors"
                >
                  Rechazar
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface NegativeRatingsListProps {
  ratings: NegativeRating[];
  onReview?: (chatId: string) => void;
}

function NegativeRatingsList({ ratings, onReview }: NegativeRatingsListProps) {
  if (ratings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <ThumbsDown className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Sin calificaciones negativas</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {ratings.map((rating, i) => (
        <div 
          key={rating.chatId || i}
          className="p-3 bg-gray-800/50 rounded-lg border border-red-500/20"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-zinc-50 font-medium">
              {rating.agentName}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(rating.timestamp).toLocaleTimeString()}
            </span>
          </div>
          {rating.comment && (
            <p className="text-xs text-gray-400 mb-2">
              "{rating.comment}"
            </p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(star => (
                <span 
                  key={star}
                  className={`text-xs ${star <= rating.rating ? 'text-amber-400' : 'text-gray-600'}`}
                >
                  ★
                </span>
              ))}
            </div>
            {onReview && (
              <button
                onClick={() => onReview(rating.chatId)}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-zinc-50 text-xs rounded transition-colors"
              >
                Ver chat
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SupervisorDashboard() {
  const { data, isLoading, isRefreshing, error, refresh } = useSupervisorDashboard();

  if (isLoading && !data) {
    return <DashboardSkeleton />;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
        <AlertTriangle className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">No se pudieron cargar las métricas</p>
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

  const handleAssignChat = (chatId: string) => {
    // TODO: Implement chat assignment
    console.log('Assign chat:', chatId);
  };

  const handleApproveTransfer = (chatId: string) => {
    // TODO: Implement transfer approval
    console.log('Approve transfer:', chatId);
  };

  const handleRejectTransfer = (chatId: string) => {
    // TODO: Implement transfer rejection
    console.log('Reject transfer:', chatId);
  };

  const handleReviewRating = (chatId: string) => {
    // TODO: Navigate to chat review
    console.log('Review rating:', chatId);
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

      {/* Metric Cards */}
      <MetricCardsGrid cards={data.cards} columns={4} />

      {/* Agent Performance & Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Status */}
        <DashboardSection
          title="Equipo Activo"
          subtitle={`${data.agentLoad.filter(a => a.status !== 'offline').length} agentes`}
          icon={Users}
          className="lg:col-span-2"
        >
          <AgentStatusTable 
            agents={data.agentLoad}
            showActions
          />
        </DashboardSection>

        {/* Queue */}
        <DashboardSection
          title="Cola de Espera"
          subtitle={`${data.queue.length} en cola`}
          icon={Inbox}
          action={
            data.queue.length > 0 && (
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                data.queue.length > 10 
                  ? 'bg-red-500/20 text-red-400' 
                  : data.queue.length > 5 
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-green-500/20 text-green-400'
              }`}>
                {data.queue.length}
              </span>
            )
          }
        >
          <QueueList 
            items={data.queue}
            onAssign={handleAssignChat}
          />
        </DashboardSection>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chats by Hour */}
        <DashboardSection
          title="Actividad del Equipo"
          subtitle="Chats por hora"
          icon={MessageSquare}
        >
          <BarChart 
            data={data.chatsByHour} 
            height={160}
            color="bg-purple-500"
          />
        </DashboardSection>

        {/* Response Times */}
        <DashboardSection
          title="Tiempos de Respuesta"
          subtitle="Distribución del equipo"
          icon={Timer}
        >
          <div className="space-y-3">
            {data.agentLoad
              .filter(a => a.status !== 'offline')
              .slice(0, 5)
              .map((agent, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-300">{agent.name}</span>
                    <span className="text-gray-500">
                      {Math.round((agent.avgResponseTime || 0) / 60)}m avg
                    </span>
                  </div>
                  <ProgressBar 
                    value={Math.min(100, (300 - (agent.avgResponseTime || 0)) / 3)}
                    color={
                      (agent.avgResponseTime || 0) < 60 ? 'bg-green-500' :
                      (agent.avgResponseTime || 0) < 180 ? 'bg-amber-500' : 'bg-red-500'
                    }
                    height={6}
                  />
                </div>
              ))}
          </div>
        </DashboardSection>
      </div>

      {/* Transfers & Negative Ratings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfers */}
        <DashboardSection
          title="Transferencias Pendientes"
          subtitle={`${data.transfers.length} solicitudes`}
          icon={ArrowRightLeft}
          action={
            data.transfers.length > 0 && (
              <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
                {data.transfers.length}
              </span>
            )
          }
        >
          <TransferList 
            transfers={data.transfers}
            onApprove={handleApproveTransfer}
            onReject={handleRejectTransfer}
          />
        </DashboardSection>

        {/* Negative Ratings */}
        <DashboardSection
          title="Calificaciones Negativas"
          subtitle="Últimas 24h"
          icon={ThumbsDown}
          action={
            data.negativeRatings.length > 0 && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                {data.negativeRatings.length}
              </span>
            )
          }
        >
          <NegativeRatingsList 
            ratings={data.negativeRatings}
            onReview={handleReviewRating}
          />
        </DashboardSection>
      </div>
    </div>
  );
}

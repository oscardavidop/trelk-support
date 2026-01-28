/**
 * Admin Dashboard Component
 * Full executive view with all metrics, system health, and alerts
 */

import { useAdminDashboard } from '../../hooks/useDashboard';
import {
  MetricCardsGrid,
  DashboardSection,
  SystemHealthCard,
  AlertsPanel,
  InsightsPanel,
  AgentStatusTable,
  RefreshButton,
  DashboardSkeleton,
} from './DashboardComponents';
import { BarChart, DonutChart, GaugeChart } from './DashboardCharts';
import {
  Activity,
  Users,
  AlertTriangle,
  Lightbulb,
  Server,
  TrendingUp,
  Workflow,
} from 'lucide-react';

export function AdminDashboard() {
  const { data, activeAlerts, isLoading, isRefreshing, error, refresh, acknowledgeAlert } = useAdminDashboard();

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
          className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          Reintentar
        </button>
      </div>
    );
  }

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chats by Hour */}
        <DashboardSection
          title="Chats por Hora"
          subtitle="Últimas 24 horas"
          icon={Activity}
          className="lg:col-span-2"
        >
          <BarChart 
            data={data.chatsByHour} 
            height={200}
            color="bg-purple-500"
          />
        </DashboardSection>

        {/* SLA Compliance */}
        <DashboardSection
          title="SLA Compliance"
          subtitle="Cumplimiento del día"
          icon={TrendingUp}
        >
          <div className="flex flex-col items-center justify-center py-4">
            <GaugeChart 
              value={data.slaCompliance} 
              label="Cumplimiento SLA"
              thresholds={[
                { value: 80, color: '#ef4444' },
                { value: 95, color: '#f59e0b' },
                { value: 100, color: '#10b981' },
              ]}
            />
          </div>
        </DashboardSection>
      </div>

      {/* Category Distribution & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chats by Category */}
        <DashboardSection
          title="Chats por Categoría"
          subtitle="Distribución del día"
          icon={Activity}
        >
          {data.chatsByCategory.length > 0 ? (
            <DonutChart data={data.chatsByCategory} />
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <p className="text-sm">Sin datos de categorías</p>
            </div>
          )}
        </DashboardSection>

        {/* Alerts */}
        <DashboardSection
          title="Alertas Activas"
          subtitle={`${activeAlerts.length} pendientes`}
          icon={AlertTriangle}
          action={
            activeAlerts.length > 0 && (
              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
                {activeAlerts.length}
              </span>
            )
          }
        >
          <AlertsPanel 
            alerts={activeAlerts} 
            onAcknowledge={acknowledgeAlert}
          />
        </DashboardSection>
      </div>

      {/* Agent Load & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Status */}
        <DashboardSection
          title="Estado de Agentes"
          subtitle={`${data.agentLoad.filter(a => a.status !== 'offline').length} activos`}
          icon={Users}
          className="lg:col-span-2"
        >
          <AgentStatusTable agents={data.agentLoad} />
        </DashboardSection>

        {/* Insights */}
        <DashboardSection
          title="Insights"
          subtitle="Análisis automático"
          icon={Lightbulb}
        >
          <InsightsPanel insights={data.insights} />
        </DashboardSection>
      </div>

      {/* System Health & Flow Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Health */}
        <DashboardSection
          title="Estado del Sistema"
          subtitle="Infraestructura"
          icon={Server}
        >
          <SystemHealthCard health={data.systemHealth} />
        </DashboardSection>

        {/* Flow Stats */}
        <DashboardSection
          title="Flujos Ejecutados"
          subtitle="Hoy"
          icon={Workflow}
        >
          {data.flowStats.length > 0 ? (
            <div className="space-y-3">
              {data.flowStats.slice(0, 5).map((flow, i) => {
                const successRate = flow.executions > 0 
                  ? Math.round((flow.success / flow.executions) * 100) 
                  : 0;
                return (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <p className="text-sm text-white truncate">{flow.name}</p>
                      <p className="text-xs text-gray-500">
                        {flow.executions} ejecuciones
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            successRate >= 90 ? 'bg-green-500' :
                            successRate >= 70 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${successRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-10 text-right">
                        {successRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <p className="text-sm">Sin flujos ejecutados hoy</p>
            </div>
          )}
        </DashboardSection>
      </div>
    </div>
  );
}

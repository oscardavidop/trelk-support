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
  Clock,
  CheckCircle2
} from 'lucide-react';

export function AdminDashboard() {
  const { data, activeAlerts, isLoading, isRefreshing, error, refresh, acknowledgeAlert } = useAdminDashboard();

  if (isLoading && !data) return <DashboardSkeleton />;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-zinc-500 animate-in fade-in">
        <div className="p-4 bg-zinc-900 rounded-full mb-4 border border-zinc-800">
           <AlertTriangle className="w-8 h-8 text-zinc-600" />
        </div>
        <p className="text-lg font-medium text-zinc-300">No se pudieron cargar las métricas</p>
        <p className="text-sm mt-1 mb-6 text-zinc-500">{error || 'Error de conexión con el servidor de métricas'}</p>
        <button onClick={refresh} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-900/20">
          Reintentar Conexión
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800/50">
          <Clock className="w-3 h-3" />
          <span>Actualizado: {new Date().toLocaleTimeString()}</span>
        </div>
        <RefreshButton onClick={refresh} isRefreshing={isRefreshing} />
      </div>

      {/* KPI Cards */}
      <MetricCardsGrid cards={data.cards} columns={4} />

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Activity Chart */}
        <DashboardSection
          title="Volumen de Chats"
          subtitle="Últimas 24 horas"
          icon={Activity}
          className="lg:col-span-2"
        >
          <div className="pt-4 h-[250px] w-full">
             <BarChart data={data.chatsByHour} height={250} color="#6366f1" />
          </div>
        </DashboardSection>

        {/* SLA Gauge */}
        <DashboardSection
          title="Cumplimiento SLA"
          subtitle="Objetivo diario"
          icon={TrendingUp}
        >
          <div className="flex flex-col items-center justify-center h-[250px]">
            <GaugeChart 
              value={data.slaCompliance} 
              label="Nivel de Servicio"
              thresholds={[
                { value: 80, color: '#ef4444' }, // Red
                { value: 95, color: '#f59e0b' }, // Amber
                { value: 100, color: '#10b981' }, // Emerald
              ]}
            />
            <div className="mt-4 text-center">
                <p className="text-zinc-400 text-sm">Tiempo promedio de respuesta</p>
                <p className="text-xl font-bold text-white font-mono">1m 45s</p>
            </div>
          </div>
        </DashboardSection>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Categories Donut */}
        <DashboardSection
          title="Distribución por Categoría"
          subtitle="Temas más frecuentes"
          icon={Activity}
        >
          <div className="h-[300px] flex items-center justify-center">
            {data.chatsByCategory.length > 0 ? (
              <DonutChart data={data.chatsByCategory} />
            ) : (
              <div className="text-center text-zinc-500">
                <p>Sin datos suficientes</p>
              </div>
            )}
          </div>
        </DashboardSection>

        {/* Alerts Panel */}
        <DashboardSection
          title="Centro de Alertas"
          subtitle="Incidencias activas"
          icon={AlertTriangle}
          action={activeAlerts.length > 0 && (
            <span className="px-2.5 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-bold rounded-full animate-pulse">
              {activeAlerts.length} ACTIVAS
            </span>
          )}
        >
          <div className="h-[300px] overflow-y-auto custom-scrollbar pr-2">
             <AlertsPanel alerts={activeAlerts} onAcknowledge={acknowledgeAlert} />
          </div>
        </DashboardSection>
      </div>

      {/* Operations Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Agent Status */}
        <DashboardSection
          title="Fuerza de Trabajo"
          subtitle="Disponibilidad en tiempo real"
          icon={Users}
          className="lg:col-span-2"
        >
          <AgentStatusTable agents={data.agentLoad} />
        </DashboardSection>

        {/* AI Insights */}
        <DashboardSection
          title="IA Insights"
          subtitle="Análisis predictivo"
          icon={Lightbulb}
        >
          <div className="h-[400px] overflow-y-auto custom-scrollbar pr-2">
             <InsightsPanel insights={data.insights} />
          </div>
        </DashboardSection>
      </div>

      {/* Infrastructure Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* System Health */}
        <DashboardSection
          title="Salud del Sistema"
          subtitle="Estado de infraestructura"
          icon={Server}
        >
          <SystemHealthCard health={data.systemHealth} />
        </DashboardSection>

        {/* Flows Stats */}
        <DashboardSection
          title="Rendimiento de Flows"
          subtitle="Ejecuciones automáticas"
          icon={Workflow}
        >
          <div className="space-y-4 pt-2">
            {data.flowStats.length > 0 ? (
              data.flowStats.slice(0, 5).map((flow, i) => {
                const successRate = flow.executions > 0 ? Math.round((flow.success / flow.executions) * 100) : 0;
                return (
                  <div key={i} className="group">
                    <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{flow.name}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">{flow.executions} execs</span>
                            <span className={`text-xs font-bold ${successRate >= 90 ? 'text-emerald-400' : successRate >= 70 ? 'text-amber-400' : 'text-red-400'}`}>{successRate}% éxito</span>
                        </div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${successRate >= 90 ? 'bg-emerald-500' : successRate >= 70 ? 'bg-amber-500' : 'bg-red-500'}`} 
                            style={{ width: `${successRate}%` }} 
                        />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-zinc-500">
                <Workflow className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">Sin actividad de flows</p>
              </div>
            )}
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
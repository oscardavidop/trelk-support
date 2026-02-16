/**
 * Dashboard Overview Page - Enterprise Edition
 * UI Refactor: Premium Zinc Style
 */

import { useAuthStore } from '../stores/authStore';
import { useTranslation } from 'react-i18next';
import { useDashboardStore } from '../stores/dashboardStore';
import { useQuickStats, useDashboardSocket } from '../hooks/useDashboard';
import { AdminDashboard } from '../components/dashboard/AdminDashboard';
import { SupervisorDashboard } from '../components/dashboard/SupervisorDashboard';
import { AgentDashboard } from '../components/dashboard/AgentDashboard';
import { DateFilter } from '../components/dashboard/DashboardComponents';
import {
  LayoutDashboard,
  Activity,
  Clock,
  Users,
  AlertTriangle,
  Wifi,
  WifiOff,
} from 'lucide-react';

export default function OverviewPage() {
  const { t } = useTranslation('dashboard');
  const agent = useAuthStore((s) => s.agent);
  const role = agent?.role || 'support';

  // Selectors
  const error = useDashboardStore((s) => s.error);
  const datePreset = useDashboardStore((s) => s.datePreset);
  const setDatePreset = useDashboardStore((s) => s.setDatePreset);

  // Real-time hooks
  const { stats } = useQuickStats();
  const { isConnected } = useDashboardSocket();


  // Logic
  const isAdmin = role === 'admin';
  const isSupervisor = role === 'admin' || role === 'supervisor';

  // Stats Configuration

  // Ejemplo de uso de traducción en el título principal
  // Antes: <h1>Dashboard Overview</h1>
  // Después:
  // <h1>{t('overview')}</h1>
  const quickStatsItems = [
    {
      label: 'Chats Activos',
      value: stats?.activeChats ?? '-',
      icon: Activity,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20'
    },
    {
      label: 'En Cola',
      value: stats?.queueLength ?? '-',
      icon: Clock,
      color: (stats?.queueLength || 0) > 5 ? 'text-red-400' : 'text-amber-400',
      bg: (stats?.queueLength || 0) > 5 ? 'bg-red-500/10' : 'bg-amber-500/10',
      border: (stats?.queueLength || 0) > 5 ? 'border-red-500/20' : 'border-amber-500/20'
    },
    {
      label: 'Agentes Online',
      value: stats?.onlineAgents ?? '-',
      icon: Users,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20'
    },
    {
      label: 'SLA Riesgo',
      value: stats?.slaAtRisk ?? '-',
      icon: AlertTriangle,
      color: (stats?.slaAtRisk || 0) > 0 ? 'text-red-400' : 'text-zinc-400',
      bg: (stats?.slaAtRisk || 0) > 0 ? 'bg-red-500/10' : 'bg-zinc-800/50',
      border: (stats?.slaAtRisk || 0) > 0 ? 'border-red-500/20' : 'border-zinc-700/50'
    },
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30 overflow-hidden relative">

      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-indigo-900/5 rounded-full blur-[120px] pointer-events-none" />

      {/* HEADER SECTION */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md z-20">

        {/* Top Bar */}
        <div className="flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-indigo-900/10">
              <LayoutDashboard className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-zinc-50 tracking-tight">{t('overview')}</h1>
              <p className="text-sm text-zinc-400">
                {isAdmin ? 'Vista Ejecutiva Global' : isSupervisor ? 'Supervisión de Equipo' : 'Mi Espacio de Trabajo'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Connection Status Badge */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isConnected
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
              }`}>
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="text-xs font-bold ">
                {isConnected ? 'Conectado' : 'Offline'}
              </span>
            </div>

            {/* Date Filter */}
            {isSupervisor && (
              <>
                <div className="h-6 w-px bg-zinc-800" />
                <DateFilter
                  value={datePreset}
                  onChange={(v) => setDatePreset(v as any)}
                />
              </>
            )}
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="px-8 pb-6 pt-1">
          <div className="flex items-center gap-4 overflow-x-auto custom-scrollbar pb-2">
            {quickStatsItems.map((item) => (
              <div key={item.label} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-zinc-900/50 ${item.border}`}>
                <div className={`p-1.5 rounded-lg ${item.bg}`}>
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <p className={`text-lg font-bold leading-none ${item.color}`}>
                    {item.value}
                  </p>
                  <p className="text-[10px] font-bold text-zinc-500 uppercasemt-0.5">{item.label}</p>
                </div>
              </div>
            ))}

            {/* Live Pulse Indicator */}
            <div className="ml-auto flex items-center gap-2 pl-4 border-l border-zinc-800/50">
              <div className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </div>
              <span className="text-[10px] font-medium text-zinc-500 st">En Vivo</span>
            </div>
          </div>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="mx-8 mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-red-400 block text-sm">Error de Carga</span>
            <p className="text-sm text-red-300/80">{error}</p>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
        <div className="p-8 pb-20">
          {/* Dashboard Component Render */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isAdmin ? (
              <AdminDashboard />
            ) : isSupervisor ? (
              <SupervisorDashboard />
            ) : (
              <AgentDashboard />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
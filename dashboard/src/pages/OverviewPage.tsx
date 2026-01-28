/**
 * Dashboard Overview Page - Enterprise Edition
 * 
 * Real-time dashboard with role-based views:
 * - Admin: Full metrics, system health, alerts
 * - Supervisor: Team management, queue, agent status
 * - Agent: Personal stats, my chats, quick actions
 */

import { useAuthStore } from '../stores/authStore';
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
  const agent = useAuthStore((s) => s.agent);
  const role = agent?.role || 'support';
  
  // Use individual selectors to prevent unnecessary re-renders
  const error = useDashboardStore((s) => s.error);
  const datePreset = useDashboardStore((s) => s.datePreset);
  const setDatePreset = useDashboardStore((s) => s.setDatePreset);
  
  // Real-time quick stats
  const { stats } = useQuickStats();
  
  // Socket connection for real-time updates
  const { isConnected } = useDashboardSocket();

  // Determine which dashboard to show
  const isAdmin = role === 'admin';
  const isSupervisor = role === 'admin' || role === 'supervisor';

  // Quick stats bar items
  const quickStatsItems = [
    { 
      label: 'Chats Activos', 
      value: stats?.activeChats ?? '-', 
      icon: Activity,
      color: 'text-green-400',
    },
    { 
      label: 'En Cola', 
      value: stats?.queueLength ?? '-', 
      icon: Clock,
      color: (stats?.queueLength || 0) > 5 ? 'text-red-400' : 'text-amber-400',
    },
    { 
      label: 'Agentes Online', 
      value: stats?.onlineAgents ?? '-', 
      icon: Users,
      color: 'text-blue-400',
    },
    { 
      label: 'SLA en Riesgo', 
      value: stats?.slaAtRisk ?? '-', 
      icon: AlertTriangle,
      color: (stats?.slaAtRisk || 0) > 0 ? 'text-red-400' : 'text-green-400',
    },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-950 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-gray-800">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-xl">
              <LayoutDashboard className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Dashboard Overview</h1>
              <p className="text-sm text-gray-500">
                {isAdmin ? 'Vista Ejecutiva' : isSupervisor ? 'Vista Operativa' : 'Mi Panel'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Connection status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              isConnected 
                ? 'border-green-500/30 bg-green-500/10 text-green-400' 
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span className="text-xs font-medium">
                {isConnected ? 'En vivo' : 'Desconectado'}
              </span>
            </div>
            
            {/* Date filter (only for admin/supervisor) */}
            {isSupervisor && (
              <DateFilter 
                value={datePreset} 
                onChange={(v) => setDatePreset(v as any)} 
              />
            )}
          </div>
        </div>
        
        {/* Quick Stats Bar */}
        <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-800/50">
          <div className="flex items-center gap-8">
            {quickStatsItems.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="p-1.5 bg-gray-800 rounded-lg">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div>
                  <p className={`text-lg font-bold ${item.color}`}>
                    {item.value}
                  </p>
                  <p className="text-xs text-gray-500">{item.label}</p>
                </div>
              </div>
            ))}
            
            {/* Live indicator */}
            <div className="ml-auto flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-xs text-gray-500">Actualización en tiempo real</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Error al cargar el dashboard</span>
          </div>
          <p className="text-sm text-red-400/80 mt-1">{error}</p>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Dashboard handles its own loading state internally */}
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
  );
}

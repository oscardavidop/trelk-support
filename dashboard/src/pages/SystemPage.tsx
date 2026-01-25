/**
 * System Monitoring Page
 * Real-time monitoring for Queues, Workers, Flows, Scheduled Messages
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Server, 
  Database, 
  Cpu,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Workflow,
  Timer,
  Users,
  AlertCircle,
  TrendingUp,
  Zap
} from 'lucide-react';
import { getSocket } from '../services/socket';
import { 
  getSystemHealth,
  type SystemHealth
} from '../services/system.service';

// Import tab components
import { QueuesTab } from '../components/system/QueuesTab';
import { FlowsTab } from '../components/system/FlowsTab';
import { ScheduledTab } from '../components/system/ScheduledTab';
import { WorkersTab } from '../components/system/WorkersTab';
import { ErrorsTab } from '../components/system/ErrorsTab';

type TabId = 'overview' | 'queues' | 'flows' | 'scheduled' | 'workers' | 'errors';

interface Tab {
  id: TabId;
  label: string;
  icon: typeof Activity;
}

const TABS: Tab[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'queues', label: 'Queues', icon: Server },
  { id: 'flows', label: 'Flows', icon: Workflow },
  { id: 'scheduled', label: 'Scheduled', icon: Timer },
  { id: 'workers', label: 'Workers', icon: Cpu },
  { id: 'errors', label: 'Errors', icon: AlertTriangle },
];

export default function SystemPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const loadHealth = useCallback(async () => {
    // Skip if access was denied (403)
    if (accessDenied) return;
    
    const result = await getSystemHealth();
    if (result.ok && result.data) {
      setHealth(result.data);
      setLastUpdate(new Date());
      setError(null);
    } else {
      // Check for 403 to stop polling
      if (result.error?.includes('403') || result.error?.includes('access required') || result.error?.includes('Access denied')) {
        setAccessDenied(true);
        setAutoRefresh(false);
      }
      setError(result.error || 'Error loading system health');
    }
    setLoading(false);
  }, [accessDenied]);

  // Initial load
  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(loadHealth, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadHealth]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleRedisStatus = (data: { connected: boolean }) => {
      if (health) {
        setHealth({
          ...health,
          services: {
            ...health.services,
            redis: { status: data.connected ? 'up' : 'down' }
          }
        });
      }
    };

    socket.on('system:redis:status', handleRedisStatus);
    
    return () => {
      socket.off('system:redis:status', handleRedisStatus);
    };
  }, [health]);

  const getStatusColor = (status: 'up' | 'down'): string => {
    return status === 'up' ? 'text-green-400' : 'text-red-400';
  };

  const getStatusBg = (status: 'up' | 'down'): string => {
    return status === 'up' ? 'bg-green-400/10' : 'bg-red-400/10';
  };

  const getHealthBadge = (status: 'healthy' | 'degraded' | 'down') => {
    switch (status) {
      case 'healthy':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Healthy
          </span>
        );
      case 'degraded':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-yellow-500/10 text-yellow-400 rounded-full text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            Degraded
          </span>
        );
      case 'down':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-400 rounded-full text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Down
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-950 min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-xl">
              <Activity className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">System Monitor</h1>
              <p className="text-sm text-gray-400">Real-time automation status</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {health && getHealthBadge(health.status)}
            
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Updated {lastUpdate.toLocaleTimeString()}</span>
            </div>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`p-2 rounded-lg transition-colors ${
                autoRefresh 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
              title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            >
              <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} 
                style={{ animationDuration: '3s' }} />
            </button>
            
            <button
              onClick={loadHealth}
              disabled={loading}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 -mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-gray-950 text-white border-t border-x border-gray-800'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'overview' && (
          <OverviewContent health={health} loading={loading} error={error} />
        )}
        {activeTab === 'queues' && <QueuesTab />}
        {activeTab === 'flows' && <FlowsTab />}
        {activeTab === 'scheduled' && <ScheduledTab />}
        {activeTab === 'workers' && <WorkersTab />}
        {activeTab === 'errors' && <ErrorsTab />}
      </div>
    </div>
  );
}

// ============= OVERVIEW CONTENT =============

interface OverviewContentProps {
  health: SystemHealth | null;
  loading: boolean;
  error: string | null;
}

function OverviewContent({ health, loading, error }: OverviewContentProps) {
  if (loading && !health) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
        <AlertTriangle className="w-12 h-12 text-red-500" />
        <div className="text-center">
          <p className="text-white font-medium">Error loading system health</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Failed to load system health
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Service Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ServiceCard
          name="Redis"
          icon={Database}
          status={health.services.redis.status}
          latency={health.services.redis.latencyMs}
          description="Cache & Queue storage"
        />
        <ServiceCard
          name="MongoDB"
          icon={Database}
          status={health.services.mongodb.status}
          latency={health.services.mongodb.latencyMs}
          description="Primary database"
        />
        <ServiceCard
          name="BullMQ Queues"
          icon={Server}
          status={health.services.queues.status}
          description={health.services.queues.initialized ? 'All queues initialized' : 'Not initialized'}
        />
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active Flows"
          value={health.metrics.activeFlows}
          icon={Workflow}
          color="purple"
          description="Published and running"
        />
        <MetricCard
          title="Pending Jobs"
          value={health.metrics.pendingJobs}
          icon={Clock}
          color="blue"
          description="In queue waiting"
        />
        <MetricCard
          title="Scheduled Messages"
          value={health.metrics.scheduledMessages}
          icon={Timer}
          color="yellow"
          description="Pending delivery"
        />
        <MetricCard
          title="Failed Jobs (24h)"
          value={health.metrics.failedJobs24h}
          icon={AlertTriangle}
          color="red"
          description="Errors in last 24 hours"
          alert={health.metrics.failedJobs24h > 10}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-medium text-white mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAction
            icon={RefreshCw}
            label="Retry Failed Jobs"
            description="Retry all failed jobs in queues"
            onClick={() => {/* TODO */}}
          />
          <QuickAction
            icon={Zap}
            label="Clear Cache"
            description="Clear all Redis caches"
            onClick={() => {/* TODO */}}
          />
          <QuickAction
            icon={TrendingUp}
            label="View Metrics"
            description="Detailed performance metrics"
            onClick={() => {/* TODO */}}
          />
          <QuickAction
            icon={Users}
            label="Worker Status"
            description="Check worker health"
            onClick={() => {/* TODO */}}
          />
        </div>
      </div>
    </div>
  );
}

// ============= COMPONENTS =============

interface ServiceCardProps {
  name: string;
  icon: typeof Database;
  status: 'up' | 'down';
  latency?: number;
  description: string;
}

function ServiceCard({ name, icon: Icon, status, latency, description }: ServiceCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${
      status === 'up' 
        ? 'bg-gray-900/50 border-gray-800' 
        : 'bg-red-500/5 border-red-500/30'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            status === 'up' ? 'bg-green-500/10' : 'bg-red-500/10'
          }`}>
            <Icon className={`w-5 h-5 ${
              status === 'up' ? 'text-green-400' : 'text-red-400'
            }`} />
          </div>
          <div>
            <h3 className="font-medium text-white">{name}</h3>
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {latency !== undefined && (
            <span className="text-xs text-gray-400">{latency}ms</span>
          )}
          {status === 'up' ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number;
  icon: typeof Activity;
  color: 'purple' | 'blue' | 'yellow' | 'red' | 'green';
  description: string;
  alert?: boolean;
}

function MetricCard({ title, value, icon: Icon, color, description, alert }: MetricCardProps) {
  const colors = {
    purple: 'from-purple-500/20 to-purple-600/10 text-purple-400',
    blue: 'from-blue-500/20 to-blue-600/10 text-blue-400',
    yellow: 'from-yellow-500/20 to-yellow-600/10 text-yellow-400',
    red: 'from-red-500/20 to-red-600/10 text-red-400',
    green: 'from-green-500/20 to-green-600/10 text-green-400',
  };

  return (
    <div className={`rounded-xl border border-gray-800 bg-gradient-to-br ${colors[color]} p-5 ${
      alert ? 'animate-pulse' : ''
    }`}>
      <div className="flex items-center justify-between mb-3">
        <Icon className="w-5 h-5" />
        {alert && <AlertCircle className="w-4 h-4 text-red-400" />}
      </div>
      <div className="text-3xl font-bold text-white mb-1">{value.toLocaleString()}</div>
      <div className="text-sm font-medium text-white/80">{title}</div>
      <div className="text-xs text-gray-500 mt-1">{description}</div>
    </div>
  );
}

interface QuickActionProps {
  icon: typeof Activity;
  label: string;
  description: string;
  onClick: () => void;
}

function QuickAction({ icon: Icon, label, description, onClick }: QuickActionProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl transition-colors text-center"
    >
      <Icon className="w-6 h-6 text-gray-400" />
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
    </button>
  );
}

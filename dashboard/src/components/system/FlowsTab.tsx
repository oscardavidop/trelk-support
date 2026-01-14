/**
 * Flows Tab - Flow Execution Monitoring
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Workflow, 
  RefreshCw, 
  Play, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Zap,
  ChevronDown,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { getSocket } from '../../services/socket';
import { getFlowStats, type FlowStats } from '../../services/system.service';

export function FlowsTab() {
  const [flows, setFlows] = useState<FlowStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFlow, setExpandedFlow] = useState<string | null>(null);

  const loadFlows = useCallback(async () => {
    const result = await getFlowStats();
    if (result.ok && result.data) {
      setFlows(result.data.flows);
    }
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadFlows();
  }, [loadFlows]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(loadFlows, 10000);
    return () => clearInterval(interval);
  }, [loadFlows]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleFlowUpdate = () => {
      loadFlows();
    };

    socket.on('flow:updated', handleFlowUpdate);
    
    return () => {
      socket.off('flow:updated', handleFlowUpdate);
    };
  }, [loadFlows]);

  if (loading && flows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  const activeFlows = flows.filter(f => f.status === 'active');
  const draftFlows = flows.filter(f => f.status === 'draft');
  const disabledFlows = flows.filter(f => f.status === 'disabled');

  // Calculate totals
  const totalExecutions = flows.reduce((sum, f) => sum + f.totalExecutions, 0);
  const totalErrors = flows.reduce((sum, f) => sum + f.failedExecutions, 0);
  const successRate = totalExecutions > 0 
    ? Math.round(((totalExecutions - totalErrors) / totalExecutions) * 100) 
    : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Flow Automations</h2>
        <button
          onClick={loadFlows}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard
          title="Active Flows"
          value={activeFlows.length}
          icon={Play}
          color="green"
        />
        <StatsCard
          title="Total Executions"
          value={totalExecutions}
          icon={BarChart3}
          color="blue"
        />
        <StatsCard
          title="Failed Executions"
          value={totalErrors}
          icon={AlertTriangle}
          color="red"
        />
        <StatsCard
          title="Success Rate"
          value={`${successRate}%`}
          icon={CheckCircle}
          color="purple"
        />
      </div>

      {/* Flow List */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3">Flow</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Triggers</th>
              <th className="px-4 py-3 text-center">Executions</th>
              <th className="px-4 py-3 text-center">Success</th>
              <th className="px-4 py-3 text-center">Failed</th>
              <th className="px-4 py-3 text-center">Cached</th>
              <th className="px-4 py-3">Last Run</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {flows.map((flow) => (
              <FlowRow
                key={flow.id}
                flow={flow}
                expanded={expandedFlow === flow.id}
                onToggle={() => setExpandedFlow(expandedFlow === flow.id ? null : flow.id)}
              />
            ))}
          </tbody>
        </table>

        {flows.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Workflow className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No flows found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= COMPONENTS =============

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: typeof Play;
  color: 'green' | 'blue' | 'red' | 'purple';
}

function StatsCard({ title, value, icon: Icon, color }: StatsCardProps) {
  const colors = {
    green: 'bg-green-500/10 text-green-400',
    blue: 'bg-blue-500/10 text-blue-400',
    red: 'bg-red-500/10 text-red-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
    </div>
  );
}

interface FlowRowProps {
  flow: FlowStats;
  expanded: boolean;
  onToggle: () => void;
}

function FlowRow({ flow, expanded, onToggle }: FlowRowProps) {
  const getStatusBadge = () => {
    switch (flow.status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs">
            <Play className="w-3 h-3" />
            Active
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-500/10 text-gray-400 rounded text-xs">
            Draft
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded text-xs">
            Disabled
          </span>
        );
    }
  };

  const getTriggerIcon = (trigger: string) => {
    if (trigger.includes('message')) return '💬';
    if (trigger.includes('session')) return '🔔';
    if (trigger.includes('agent')) return '👤';
    if (trigger.includes('keyword')) return '🔑';
    return '⚡';
  };

  const successRate = flow.totalExecutions > 0 
    ? Math.round((flow.successfulExecutions / flow.totalExecutions) * 100) 
    : 100;

  return (
    <>
      <tr className="hover:bg-gray-800/50 transition-colors">
        {/* Expand Toggle */}
        <td className="px-4 py-3">
          <button onClick={onToggle} className="text-gray-400 hover:text-white">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        
        {/* Flow Name */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-purple-400" />
            <span className="font-medium text-white">{flow.name}</span>
          </div>
        </td>
        
        {/* Status */}
        <td className="px-4 py-3">
          {getStatusBadge()}
        </td>
        
        {/* Triggers */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 flex-wrap">
            {flow.triggers.map((trigger, i) => (
              <span 
                key={i} 
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-xs"
                title={trigger}
              >
                {getTriggerIcon(trigger)}
                {trigger.replace(/_/g, ' ')}
              </span>
            ))}
            {flow.triggers.length === 0 && (
              <span className="text-gray-500 text-xs">No triggers</span>
            )}
          </div>
        </td>
        
        {/* Executions */}
        <td className="px-4 py-3 text-center">
          <span className="font-medium text-white">{flow.totalExecutions.toLocaleString()}</span>
        </td>
        
        {/* Success */}
        <td className="px-4 py-3 text-center">
          <span className="text-green-400">{flow.successfulExecutions.toLocaleString()}</span>
        </td>
        
        {/* Failed */}
        <td className="px-4 py-3 text-center">
          {flow.failedExecutions > 0 ? (
            <span className="text-red-400">{flow.failedExecutions.toLocaleString()}</span>
          ) : (
            <span className="text-gray-600">0</span>
          )}
        </td>
        
        {/* Cached */}
        <td className="px-4 py-3 text-center">
          {flow.cachedInRedis ? (
            <Database className="w-4 h-4 text-green-400 mx-auto" />
          ) : (
            <span className="text-gray-600">-</span>
          )}
        </td>
        
        {/* Last Run */}
        <td className="px-4 py-3 text-sm text-gray-400">
          {flow.lastExecutedAt ? (
            new Date(flow.lastExecutedAt).toLocaleString()
          ) : (
            <span className="text-gray-600">Never</span>
          )}
        </td>
      </tr>
      
      {/* Expanded Details */}
      {expanded && (
        <tr>
          <td colSpan={9} className="px-4 py-0 bg-gray-950">
            <div className="py-4 grid grid-cols-3 gap-4">
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Performance</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Success Rate</span>
                    <span className={successRate >= 90 ? 'text-green-400' : successRate >= 70 ? 'text-yellow-400' : 'text-red-400'}>
                      {successRate}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Avg Execution Time</span>
                    <span className="text-white">
                      {flow.avgExecutionTimeMs ? `${flow.avgExecutionTimeMs}ms` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Cache Status</h4>
                <div className="flex items-center gap-2">
                  {flow.cachedInRedis ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-green-400">Cached in Redis</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-400">Not cached</span>
                    </>
                  )}
                </div>
              </div>
              
              <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Triggers</h4>
                <div className="space-y-1">
                  {flow.triggers.map((trigger, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Zap className="w-3 h-3 text-yellow-400" />
                      <span className="text-gray-300">{trigger}</span>
                    </div>
                  ))}
                  {flow.triggers.length === 0 && (
                    <span className="text-gray-500 text-sm">No triggers configured</span>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

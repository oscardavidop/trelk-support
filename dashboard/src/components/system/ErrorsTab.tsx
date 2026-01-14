/**
 * Errors Tab - Error Monitoring and Log View
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  RefreshCw, 
  Clock,
  Server,
  ChevronDown,
  ChevronRight,
  Filter,
  Calendar,
  XCircle,
  RotateCcw,
  Copy,
  CheckCircle
} from 'lucide-react';
import { getSocket } from '../../services/socket';
import { getSystemErrors, type ErrorLogEntry } from '../../services/system.service';

export function ErrorsTab() {
  const [errors, setErrors] = useState<ErrorLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [queueFilter, setQueueFilter] = useState<string>('');
  const [hoursFilter, setHoursFilter] = useState<number>(24);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  const loadErrors = useCallback(async () => {
    const result = await getSystemErrors({ 
      queue: queueFilter || undefined, 
      hours: hoursFilter,
      limit: 100 
    });
    if (result.ok && result.data) {
      setErrors(result.data.errors);
      setTotal(result.data.total);
    }
    setLoading(false);
  }, [queueFilter, hoursFilter]);

  // Initial load
  useEffect(() => {
    loadErrors();
  }, [loadErrors]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadErrors, 30000);
    return () => clearInterval(interval);
  }, [loadErrors]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewError = (data: { queue: string; jobId: string; error: string; attempt: number }) => {
      setErrors(prev => [{
        id: `${Date.now()}`,
        timestamp: new Date().toISOString(),
        queue: data.queue,
        jobId: data.jobId,
        jobName: 'unknown',
        error: data.error,
        attempt: data.attempt,
        resolved: false,
      }, ...prev.slice(0, 99)]);
    };

    socket.on('system:job:failed', handleNewError);
    
    return () => {
      socket.off('system:job:failed', handleNewError);
    };
  }, []);

  // Get unique queues for filter
  const uniqueQueues = [...new Set(errors.map(e => e.queue))];

  if (loading && errors.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Errors & Retries</h2>
        <button
          onClick={loadErrors}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">Filters:</span>
        </div>
        
        {/* Queue Filter */}
        <select
          value={queueFilter}
          onChange={(e) => setQueueFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          <option value="">All Queues</option>
          {uniqueQueues.map(queue => (
            <option key={queue} value={queue}>{queue}</option>
          ))}
        </select>
        
        {/* Time Filter */}
        <select
          value={hoursFilter}
          onChange={(e) => setHoursFilter(Number(e.target.value))}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
        >
          <option value={1}>Last hour</option>
          <option value={6}>Last 6 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last week</option>
        </select>
        
        <span className="text-sm text-gray-500">
          Showing {errors.length} of {total} errors
        </span>
      </div>

      {/* Summary */}
      {errors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard
            title="Total Errors"
            value={total}
            icon={AlertTriangle}
            color="red"
          />
          <SummaryCard
            title="Unique Jobs"
            value={new Set(errors.map(e => e.jobId)).size}
            icon={Server}
            color="yellow"
          />
          <SummaryCard
            title="Affected Queues"
            value={uniqueQueues.length}
            icon={XCircle}
            color="purple"
          />
          <SummaryCard
            title="Avg Retries"
            value={errors.length > 0 
              ? (errors.reduce((sum, e) => sum + e.attempt, 0) / errors.length).toFixed(1)
              : '0'}
            icon={RotateCcw}
            color="blue"
          />
        </div>
      )}

      {/* Error List */}
      <div className="space-y-2">
        {errors.length === 0 ? (
          <div className="text-center py-12 text-gray-500 bg-gray-900/50 rounded-xl border border-gray-800">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500 opacity-50" />
            <p className="text-lg font-medium">No Errors Found</p>
            <p className="text-sm mt-1">System is running smoothly in the selected time period</p>
          </div>
        ) : (
          errors.map((error) => (
            <ErrorCard
              key={error.id}
              error={error}
              expanded={expandedError === error.id}
              onToggle={() => setExpandedError(expandedError === error.id ? null : error.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============= COMPONENTS =============

interface SummaryCardProps {
  title: string;
  value: number | string;
  icon: typeof AlertTriangle;
  color: 'red' | 'yellow' | 'purple' | 'blue';
}

function SummaryCard({ title, value, icon: Icon, color }: SummaryCardProps) {
  const colors = {
    red: 'bg-red-500/10 text-red-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    purple: 'bg-purple-500/10 text-purple-400',
    blue: 'bg-blue-500/10 text-blue-400',
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

interface ErrorCardProps {
  error: ErrorLogEntry;
  expanded: boolean;
  onToggle: () => void;
}

function ErrorCard({ error, expanded, onToggle }: ErrorCardProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diff = now.getTime() - time.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ago`;
    }
    if (hours > 0) {
      return `${hours}h ago`;
    }
    if (minutes > 0) {
      return `${minutes}m ago`;
    }
    return 'Just now';
  };

  return (
    <div className="bg-gray-900/50 border border-red-500/20 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
        
        <div className="flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white truncate">{error.error}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
            <span className="flex items-center gap-1">
              <Server className="w-3 h-3" />
              {error.queue}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {getTimeAgo(error.timestamp)}
            </span>
            <span>Job: {error.jobName}</span>
            <span>Attempt: {error.attempt}</span>
          </div>
        </div>
        
        <div className="flex-shrink-0 text-xs text-gray-500">
          {new Date(error.timestamp).toLocaleTimeString()}
        </div>
      </button>
      
      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800">
          {/* Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div>
              <span className="text-xs text-gray-500">Queue</span>
              <div className="font-medium text-white">{error.queue}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Job ID</span>
              <div className="font-mono text-sm text-white truncate">{error.jobId}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Job Name</span>
              <div className="font-medium text-white">{error.jobName}</div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Attempt</span>
              <div className="font-medium text-white">{error.attempt}</div>
            </div>
          </div>
          
          {/* Error Message */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">Error Message</span>
              <button
                onClick={() => copyToClipboard(error.error)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              >
                {copied ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg font-mono text-sm text-red-300 whitespace-pre-wrap break-all">
              {error.error}
            </div>
          </div>
          
          {/* Stack Trace */}
          {error.stack && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Stack Trace</span>
                <button
                  onClick={() => copyToClipboard(error.stack || '')}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
              <div className="p-3 bg-gray-950 border border-gray-800 rounded-lg font-mono text-xs text-gray-400 overflow-x-auto max-h-48 whitespace-pre">
                {error.stack}
              </div>
            </div>
          )}
          
          {/* Timestamp */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-800 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(error.timestamp).toLocaleString()}
            </span>
            {error.resolved && (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="w-3 h-3" />
                Resolved
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

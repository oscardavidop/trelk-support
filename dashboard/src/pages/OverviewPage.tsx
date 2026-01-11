// Overview/Stats Page
import { useChatStore } from '../stores/chatStore';
import { 
  MessageCircle, 
  Users, 
  Clock, 
  CheckCircle,
  TrendingUp,
  Activity
} from 'lucide-react';

export default function OverviewPage() {
  const stats = useChatStore((state) => state.stats);

  const sessionStats = [
    { 
      label: 'Active', 
      value: stats?.sessions.human || 0, 
      icon: MessageCircle, 
      color: 'text-secondary',
      bgColor: 'bg-secondary/10' 
    },
    { 
      label: 'Waiting', 
      value: stats?.sessions.waiting || 0, 
      icon: Clock, 
      color: 'text-warning',
      bgColor: 'bg-warning/10' 
    },
    { 
      label: 'Bot Handling', 
      value: stats?.sessions.bot || 0, 
      icon: Activity, 
      color: 'text-primary',
      bgColor: 'bg-primary/10' 
    },
    { 
      label: 'Closed Today', 
      value: stats?.sessions.closed || 0, 
      icon: CheckCircle, 
      color: 'text-gray-400',
      bgColor: 'bg-gray-800' 
    },
  ];

  const agentStats = [
    { 
      label: 'Online', 
      value: stats?.agents.online || 0, 
      color: 'bg-secondary' 
    },
    { 
      label: 'Away', 
      value: stats?.agents.away || 0, 
      color: 'bg-warning' 
    },
    { 
      label: 'Offline', 
      value: stats?.agents.offline || 0, 
      color: 'bg-gray-500' 
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Dashboard Overview</h1>
          <p className="text-gray-500">Monitor your support operations in real-time</p>
        </div>

        {/* Session Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {sessionStats.map((stat) => (
            <div 
              key={stat.label}
              className="bg-gray-800/50 border border-gray-700 rounded-xl p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <TrendingUp className="w-4 h-4 text-gray-600" />
              </div>
              <p className="text-3xl font-bold text-white mb-1">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Agents Section */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-white">Agent Status</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {agentStats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${stat.color}`} />
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                </div>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a 
              href="/dashboard/chat" 
              className="flex items-center gap-3 p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <MessageCircle className="w-5 h-5 text-primary" />
              <span className="text-white">View Conversations</span>
            </a>
            <a 
              href="/dashboard/agents" 
              className="flex items-center gap-3 p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Users className="w-5 h-5 text-secondary" />
              <span className="text-white">Manage Agents</span>
            </a>
            <a 
              href="/dashboard/settings" 
              className="flex items-center gap-3 p-4 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Activity className="w-5 h-5 text-warning" />
              <span className="text-white">View Analytics</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

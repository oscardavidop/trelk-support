// Sidebar component
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useConnectionStore } from '../stores/connectionStore';
import { 
  MessageCircle, 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut,
  Circle,
  ChevronDown,
  MessageSquare,
  Wifi,
  WifiOff,
  Loader2,
  Eye,
  Activity,
  Download,
  GitBranch
} from 'lucide-react';
import type { Agent, DashboardStats, AvailabilityStatus } from '../types';
import { useState } from 'react';
import { updateAgentStatus } from '../services/socket';

interface SidebarProps {
  agent: Agent | null;
  stats: DashboardStats | null;
}

export default function Sidebar({ agent, stats }: SidebarProps) {
  const location = useLocation();
  const logout = useAuthStore((state) => state.logout);
  const { status: connectionStatus } = useConnectionStore();
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const isAdmin = agent?.role === 'admin';
  const isSupervisor = agent?.role === 'supervisor';
  const canSupervise = isAdmin || isSupervisor;

  // Calculate availability status based on activeChats
  const MAX_CONCURRENT_CHATS = 5;
  const getAvailabilityStatus = (): AvailabilityStatus => {
    if (!agent || agent.onlineStatus === 'offline') return 'offline';
    if ((agent.activeChats || 0) >= MAX_CONCURRENT_CHATS) return 'busy';
    return 'available';
  };
  
  const availabilityStatus = agent?.availability || getAvailabilityStatus();

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Overview', requireRole: null },
    { path: '/dashboard/chat', icon: MessageCircle, label: 'Chat', badge: stats?.sessions.waiting, requireRole: null },
    { path: '/dashboard/supervisor', icon: Eye, label: 'Supervisor', requireRole: 'supervisor' as const },
    { path: '/dashboard/audit', icon: Activity, label: 'Actividad', requireRole: 'supervisor' as const },
    { path: '/dashboard/exports', icon: Download, label: 'Exportar', requireRole: 'supervisor' as const },
    { path: '/dashboard/saved-replies', icon: MessageSquare, label: 'Saved Replies', requireRole: 'admin' as const },
    { path: '/dashboard/flows', icon: GitBranch, label: 'Flows', requireRole: 'admin' as const },
    { path: '/dashboard/agents', icon: Users, label: 'Agents', requireRole: 'admin' as const },
    { path: '/dashboard/settings', icon: Settings, label: 'Settings', requireRole: 'admin' as const },
  ].filter(item => {
    if (item.requireRole === null) return true;
    if (item.requireRole === 'admin') return isAdmin;
    if (item.requireRole === 'supervisor') return canSupervise;
    return false;
  });

  const statusColors = {
    online: 'bg-secondary',
    away: 'bg-warning',
    offline: 'bg-gray-500',
  };

  const availabilityColors = {
    available: 'text-secondary',
    busy: 'text-warning',
    offline: 'text-gray-500',
  };

  const availabilityLabels = {
    available: 'Available',
    busy: 'Busy',
    offline: 'Offline',
  };

  const handleStatusChange = (status: 'online' | 'away' | 'offline') => {
    updateAgentStatus(status);
    setShowStatusMenu(false);
  };

  return (
    <aside className="w-64 bg-gray-950 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-white">Trelk Support</h1>
            <p className="text-xs text-gray-500">Agent Dashboard</p>
          </div>
        </div>
      </div>

      {/* Connection & Availability Status */}
      <div className="px-4 py-2 border-b border-gray-800">
        <div className="flex items-center justify-between text-xs">
          {/* Connection Status */}
          <div className="flex items-center gap-1.5">
            {connectionStatus === 'ready' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-secondary" />
                <span className="text-secondary">Connected</span>
              </>
            ) : connectionStatus === 'reconnecting' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-warning animate-spin" />
                <span className="text-warning">Reconnecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-danger" />
                <span className="text-danger">Disconnected</span>
              </>
            )}
          </div>
          
          {/* Availability Status */}
          {agent && (
            <div className={`flex items-center gap-1.5 ${availabilityColors[availabilityStatus]}`}>
              <span className="font-medium">{availabilityLabels[availabilityStatus]}</span>
              {availabilityStatus === 'busy' && (
                <span className="text-gray-500">({agent.activeChats || 0}/{MAX_CONCURRENT_CHATS})</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
              {item.badge ? (
                <span className="ml-auto px-2 py-0.5 bg-warning text-gray-900 text-xs font-bold rounded-full">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Stats Summary */}
      {stats && (
        <div className="px-4 py-3 border-t border-gray-800">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2 bg-gray-800/50 rounded-lg">
              <p className="text-lg font-bold text-white">{stats.sessions.human}</p>
              <p className="text-xs text-gray-500">Active</p>
            </div>
            <div className="p-2 bg-gray-800/50 rounded-lg">
              <p className="text-lg font-bold text-warning">{stats.sessions.waiting}</p>
              <p className="text-xs text-gray-500">Waiting</p>
            </div>
          </div>
        </div>
      )}

      {/* Agent Profile */}
      <div className="p-4 border-t border-gray-800">
        <div className="relative">
          <button 
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <div className="relative">
              <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-medium">
                {agent?.name.charAt(0).toUpperCase()}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-950 ${statusColors[agent?.onlineStatus || 'offline']}`} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium text-white truncate">{agent?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{agent?.onlineStatus}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {/* Status Menu */}
          {showStatusMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl">
              <button 
                onClick={() => handleStatusChange('online')}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors"
              >
                <Circle className="w-3 h-3 fill-secondary text-secondary" />
                <span className="text-sm text-white">Online</span>
              </button>
              <button 
                onClick={() => handleStatusChange('away')}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors"
              >
                <Circle className="w-3 h-3 fill-warning text-warning" />
                <span className="text-sm text-white">Away</span>
              </button>
              <button 
                onClick={() => handleStatusChange('offline')}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors"
              >
                <Circle className="w-3 h-3 fill-gray-500 text-gray-500" />
                <span className="text-sm text-white">Offline</span>
              </button>
              <div className="border-t border-gray-700" />
              <button 
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors text-danger"
              >
                <LogOut className="w-4 h-4" />
                <span className="text-sm">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

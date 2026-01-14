// Sidebar component
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
  GitBranch,
  ChevronLeft,
  ChevronRight,
  User,
  Sliders,
  Bell,
  Shield,
  History,
  ListChecks,
  Server
} from 'lucide-react';
import type { Agent, DashboardStats, AvailabilityStatus } from '../types';
import { useState, useEffect, useRef } from 'react';
import { updateAgentStatus } from '../services/socket';

interface SidebarProps {
  agent: Agent | null;
  stats: DashboardStats | null;
}

// Routes where sidebar should be collapsed by default
const COLLAPSED_ROUTES = ['/dashboard/flows'];

export default function Sidebar({ agent, stats }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const { status: connectionStatus } = useConnectionStore();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    };

    if (showStatusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStatusMenu]);

  // Collapsed state - check localStorage for user preference
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) return saved === 'true';
    // Default: collapsed on specific routes
    return COLLAPSED_ROUTES.some(route => location.pathname.startsWith(route));
  });

  // Auto-collapse on specific routes (only on first navigation)
  useEffect(() => {
    const shouldAutoCollapse = COLLAPSED_ROUTES.some(route => location.pathname.startsWith(route));
    const userPreference = localStorage.getItem('sidebar-collapsed');

    // Only auto-collapse if user hasn't set a preference
    if (shouldAutoCollapse && userPreference === null) {
      setIsCollapsed(true);
    }
  }, [location.pathname]);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

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
    { path: '/dashboard/system', icon: Server, label: 'Sistema', requireRole: 'supervisor' as const },
    { path: '/dashboard/saved-replies', icon: MessageSquare, label: 'Saved Replies', requireRole: 'admin' as const },
    { path: '/dashboard/flows', icon: GitBranch, label: 'Flows', requireRole: 'admin' as const },
    { path: '/dashboard/custom-fields', icon: ListChecks, label: 'Campos', requireRole: 'admin' as const },
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
    <aside className={`${isCollapsed ? 'w-16' : 'w-64'} bg-gray-950 border-r border-gray-800 flex flex-col transition-all duration-300 relative`}>
      {/* Collapse Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-20 z-10 w-6 h-6 bg-gray-800 border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        title={isCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Logo */}
      <div className="p-3 border-b border-gray-800 h-[56px]">
        <div className="flex items-center gap-3">
          {
            isCollapsed ? (
              <img src="/assets/img/logo-small-dark.png" alt="Logo" className="rounded-sm" />
            ) : (
              <div className="flex items-center gap-2 text-white font-semibold">
                <img src="/assets/img/logo-dark.png" alt="Logo" className="rounded-sm" style={{ maxHeight: '35px' }} />
                Support
              </div>
            )
          }
        </div>
      </div>

      {/* Connection & Availability Status */}
      <div className="px-4 py-2 border-b border-gray-800">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} text-xs`}>
          {/* Connection Status */}
          <div className="flex items-center gap-1.5" title={connectionStatus === 'ready' ? 'Connected' : connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}>
            {connectionStatus === 'ready' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-secondary" />
                {!isCollapsed && <span className="text-secondary">Connected</span>}
              </>
            ) : connectionStatus === 'reconnecting' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-warning animate-spin" />
                {!isCollapsed && <span className="text-warning">Reconnecting...</span>}
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-danger" />
                {!isCollapsed && <span className="text-danger">Disconnected</span>}
              </>
            )}
          </div>

          {/* Availability Status */}
          {agent && !isCollapsed && (
            <div className={`flex items-center gap-1.5 ${availabilityColors[availabilityStatus]}`}>
              <span className="font-medium">{availabilityLabels[availabilityStatus]}</span>
              {availabilityStatus === 'busy' && (
                <span className="text-gray-500">({agent.activeChats || 0}/{MAX_CONCURRENT_CHATS})</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation - Scrollable */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center ${isCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium">{item.label}</span>}
              {item.badge && !isCollapsed ? (
                <span className="ml-auto px-2 py-0.5 bg-warning text-gray-900 text-xs font-bold rounded-full">
                  {item.badge}
                </span>
              ) : item.badge && isCollapsed ? (
                <span className="absolute right-2 top-1 w-2 h-2 bg-warning rounded-full" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Stats Summary - Fixed */}
      {stats && (
        <div className="px-4 py-3 border-t border-gray-800 flex-shrink-0">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 bg-gray-800/50 rounded-lg flex items-center justify-center" title={`${stats.sessions.human} Active`}>
                <span className="text-xs font-bold text-white">{stats.sessions.human}</span>
              </div>
              <div className="w-8 h-8 bg-gray-800/50 rounded-lg flex items-center justify-center" title={`${stats.sessions.waiting} Waiting`}>
                <span className="text-xs font-bold text-warning">{stats.sessions.waiting}</span>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* Agent Profile - Fixed at bottom */}
      <div className="p-4 border-t border-gray-800 flex-shrink-0 mt-auto">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : ''} gap-3 p-2 rounded-lg hover:bg-gray-800 transition-colors`}
            title={isCollapsed ? agent?.name : undefined}
          >
            <div className="relative flex-shrink-0">
              {agent?.avatar ? (
                <img
                  src={agent.avatar}
                  alt={agent.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-medium">
                  {agent?.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-950 ${statusColors[agent?.onlineStatus || 'offline']}`} />
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 text-left overflow-hidden">
                  <p className="text-sm font-medium text-white truncate">{agent?.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{agent?.onlineStatus}</p>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
              </>
            )}
          </button>

          {/* Status Menu */}
          {showStatusMenu && (
            <div className={`absolute bottom-full mb-2 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-xl z-50 ${isCollapsed ? 'left-full ml-2 w-64' : 'left-0 right-0'}`}>
              {/* Status Section */}
              <div className="px-3 py-2 border-b border-gray-700">
                <p className="text-xs text-gray-500 uppercase font-semibold">Status</p>
              </div>
              <button
                onClick={() => handleStatusChange('online')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors ${agent?.onlineStatus === 'online' ? 'bg-gray-700/50' : ''}`}
              >
                <Circle className="w-3 h-3 fill-secondary text-secondary" />
                <span className="text-sm text-white">Online</span>
                {agent?.onlineStatus === 'online' && <span className="ml-auto text-xs text-secondary">✓</span>}
              </button>
              <button
                onClick={() => handleStatusChange('away')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors ${agent?.onlineStatus === 'away' ? 'bg-gray-700/50' : ''}`}
              >
                <Circle className="w-3 h-3 fill-warning text-warning" />
                <span className="text-sm text-white">Away</span>
                <span className="ml-auto text-xs text-gray-500">No new chats</span>
              </button>
              <button
                onClick={() => handleStatusChange('offline')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors ${agent?.onlineStatus === 'offline' ? 'bg-gray-700/50' : ''}`}
              >
                <Circle className="w-3 h-3 fill-gray-500 text-gray-500" />
                <span className="text-sm text-white">Offline</span>
              </button>
              {availabilityStatus === 'busy' && (
                <div className="flex items-center gap-3 px-4 py-2 bg-warning/10 border-t border-gray-700">
                  <Circle className="w-3 h-3 fill-warning text-warning animate-pulse" />
                  <span className="text-sm text-warning">Busy</span>
                  <span className="ml-auto text-xs text-gray-400">{agent?.activeChats}/{MAX_CONCURRENT_CHATS} chats</span>
                </div>
              )}
              
              {/* Settings Section */}
              <div className="border-t border-gray-700">
                <div className="px-3 py-2 border-b border-gray-700">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Settings</p>
                </div>
                <button
                  onClick={() => { navigate('/dashboard/my-settings/account'); setShowStatusMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-white">My Account</span>
                </button>
                <button
                  onClick={() => { navigate('/dashboard/my-settings/preferences'); setShowStatusMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors"
                >
                  <Sliders className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-white">Preferences</span>
                </button>
                <button
                  onClick={() => { navigate('/dashboard/my-settings/notifications'); setShowStatusMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors"
                >
                  <Bell className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-white">Notifications</span>
                </button>
                <button
                  onClick={() => { navigate('/dashboard/my-settings/security'); setShowStatusMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors"
                >
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-white">Security</span>
                </button>
                <button
                  onClick={() => { navigate('/dashboard/my-settings/activity'); setShowStatusMenu(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-700 transition-colors"
                >
                  <History className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-white">Activity</span>
                </button>
              </div>

              {/* Sign Out */}
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

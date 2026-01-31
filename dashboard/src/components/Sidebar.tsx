import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useConnectionStore } from '../stores/connectionStore';
import { usePermissions } from '../hooks/usePermissions';
import {
  MessageCircle, LayoutDashboard, Users, Settings, LogOut, Circle,
  ChevronDown, MessageSquare, Wifi, WifiOff, Loader2, Eye, Activity,
  Download, GitBranch, ChevronLeft, ChevronRight, User, Sliders, Bell,
  Shield, History, ListChecks, Server, Languages, Contact, Megaphone,
  KeyRound
} from 'lucide-react';
import type { Agent, DashboardStats, AvailabilityStatus } from '../types';
import { useState, useEffect, useRef } from 'react';
import { updateAgentStatus } from '../services/socket';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  agent: Agent | null;
  stats: DashboardStats | null;
}

const COLLAPSED_ROUTES = ['/dashboard/flows', '/dashboard/chat'];
const HIDDEN_ROUTES = ['/dashboard/chat'];

export default function Sidebar({ agent, stats }: SidebarProps) {
  const { t } = useTranslation('common');
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const { status: connectionStatus } = useConnectionStore();
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  if (HIDDEN_ROUTES.some(route => location.pathname.startsWith(route))) {
    // return null;
  }

  // Close dropdown logic
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    if (showStatusMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusMenu]);

  // Collapse logic
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) return saved === 'true';
    return COLLAPSED_ROUTES.some(route => location.pathname.startsWith(route));
  });

  useEffect(() => {
    const shouldAutoCollapse = COLLAPSED_ROUTES.some(route => location.pathname.startsWith(route));
    const userPreference = localStorage.getItem('sidebar-collapsed');
    if (shouldAutoCollapse && userPreference === null) setIsCollapsed(true);
  }, [location.pathname]);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  // Permissions & Status Logic
  const { can } = usePermissions();
  const MAX_CONCURRENT_CHATS = 5;

  const getAvailabilityStatus = (): AvailabilityStatus => {
    if (!agent || agent.onlineStatus === 'offline') return 'offline';
    if ((agent.activeChats || 0) >= MAX_CONCURRENT_CHATS) return 'busy';
    return 'available';
  };

  const availabilityStatus = agent?.availability || getAvailabilityStatus();

  const handleStatusChange = (status: 'online' | 'away' | 'offline') => {
    updateAgentStatus(status);
    setShowStatusMenu(false);
  };

  // Navigation Item Type
  type NavItem = {
    path: string;
    icon: React.ForwardRefExoticComponent<any>;
    label: string;
    permission: string | null;
    badge?: number;
  };

  // Navigation Config
  const navItems: {
    section: string;
    items: NavItem[];
  }[] = [
    {
      section: t('sidebar.sections.principal'),
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: t('sidebar.nav.overview'), permission: null },
        { path: '/dashboard/chat', icon: MessageCircle, label: t('sidebar.nav.chat'), permission: 'chats.read' },
        { path: '/dashboard/contacts', icon: Contact, label: t('sidebar.nav.contacts'), permission: 'contacts.read' },
      ]
    },
    {
      section: t('sidebar.sections.operations'),
      items: [
        { path: '/dashboard/broadcast', icon: Megaphone, label: t('sidebar.nav.broadcast'), permission: 'broadcast.read' },
        { path: '/dashboard/supervisor', icon: Eye, label: t('sidebar.nav.supervisor'), permission: 'supervisor.monitor' },
        { path: '/dashboard/flows', icon: GitBranch, label: t('sidebar.nav.flowBuilder'), permission: 'flows.read' },
      ]
    },
    {
      section: t('sidebar.sections.management'),
      items: [
        { path: '/dashboard/agents', icon: Users, label: t('sidebar.nav.agents'), permission: 'agents.read' },
        { path: '/dashboard/saved-replies', icon: MessageSquare, label: t('sidebar.nav.replies'), permission: 'replies.write' },
        { path: '/dashboard/custom-fields', icon: ListChecks, label: t('sidebar.nav.fields'), permission: 'customFields.read' },
        { path: '/dashboard/texts', icon: Languages, label: t('sidebar.nav.texts'), permission: 'settings.write' },
      ]
    },
    {
      section: t('sidebar.sections.system'),
      items: [
        { path: '/dashboard/audit', icon: Activity, label: t('sidebar.nav.activity'), permission: 'system.audit' },
        { path: '/dashboard/exports', icon: Download, label: t('sidebar.nav.exports'), permission: 'exports.create' },
        { path: '/dashboard/system', icon: Server, label: t('sidebar.nav.monitor'), permission: 'system.read' },
        { path: '/dashboard/system-control', icon: Sliders, label: t('sidebar.nav.control'), permission: 'system.admin' },
        { path: '/dashboard/permissions', icon: KeyRound, label: t('sidebar.nav.permissions'), permission: 'agents.permissions' },
        { path: '/dashboard/settings', icon: Settings, label: t('sidebar.nav.settings'), permission: 'settings.read' },
      ]
    }
  ];

  // Helper colors
  const statusConfig = {
    online: { color: 'text-emerald-500', bg: 'bg-emerald-500', ring: 'ring-emerald-500/20' },
    away: { color: 'text-amber-500', bg: 'bg-amber-500', ring: 'ring-amber-500/20' },
    offline: { color: 'text-zinc-500', bg: 'bg-zinc-500', ring: 'ring-zinc-500/20' },
  };

  const availabilityColors = {
    available: 'text-emerald-500',
    busy: 'text-amber-500',
    offline: 'text-zinc-500',
  };

  const currentStatusStyle = statusConfig[agent?.onlineStatus || 'offline'];

  return (
    <aside
      className={`${isCollapsed ? 'w-[72px]' : 'w-72'} bg-zinc-950 border-r border-zinc-800 flex flex-col transition-all duration-300 relative z-50`}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-11 z-50 w-6 h-6 bg-zinc-900 border border-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shadow-lg"
      >
        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* 1. Header & Logo (RESTAURADO) */}
      <div className="h-[56px] flex items-center px-4 border-b border-zinc-800/50 bg-zinc-950">
        <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center w-full' : ''}`}>
          {isCollapsed ? (
            <img src="/assets/img/logo-small-dark.png" alt="Logo" className="w-8 h-8 rounded-sm object-contain" />
          ) : (
            <div className="flex items-center gap-2 text-white font-semibold">
              <img src="/assets/img/logo-dark.png" alt="Logo" className="rounded-sm object-contain h-8 w-auto" />
              <span className="font-bold text-zinc-100 text-sm tracking-wide">Support</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Connection Status (RESTAURADO & ESTILIZADO) */}
      <div className="">
        <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-2' : 'justify-between'} text-xs bg-zinc-900/50 p-2`}>

          {/* Connection Icon/Text */}
          <div className="flex items-center gap-2" title={connectionStatus === 'ready' ? 'System Connected' : 'Disconnected'}>
            {connectionStatus === 'ready' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-500" />
                {!isCollapsed && <span className="text-emerald-500 font-medium">Conectado</span>}
              </>
            ) : connectionStatus === 'reconnecting' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                {!isCollapsed && <span className="text-amber-500 font-medium">Reconectando...</span>}
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-500" />
                {!isCollapsed && <span className="text-red-500 font-medium">Sin Conexión</span>}
              </>
            )}
          </div>

          {/* Availability Status (Only visible when expanded or via dot when collapsed) */}
          {agent && (
            isCollapsed ? (
              // Collapsed: Small dot indicating agent availability
              <div className={`w-2 h-2 rounded-full ${availabilityStatus === 'available' ? 'bg-emerald-500' : availabilityStatus === 'busy' ? 'bg-amber-500' : 'bg-zinc-600'}`} title={availabilityStatus} />
            ) : (
              // Expanded: Full Text
              <div className={`flex items-center gap-1.5 ${availabilityColors[availabilityStatus]}`}>
                <span className="font-medium capitalize">{availabilityStatus}</span>
                {availabilityStatus === 'busy' && (
                  <span className="text-zinc-500">({agent.activeChats || 0}/{MAX_CONCURRENT_CHATS})</span>
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* 3. Navigation */}
      {/* only show scrollbar on hover */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-hover custom-scrollbar">
        {navItems.map((group, groupIdx) => {
          const visibleItems = group.items.filter(item => item.permission === null || can(item.permission));
          if (visibleItems.length === 0) return null;

          return (
            <div key={groupIdx}>
              {!isCollapsed && (
                <h3 className="px-3 text-[10px] font-bold text-zinc-500 uppercasemb-2 uppercase">
                  {group.section}
                </h3>
              ) || (
                  groupIdx > 0 && <div className="border-t border-zinc-800 my-2" />
                )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={isCollapsed ? item.label : undefined}
                      className={`
                        relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group
                        ${isActive
                          ? 'bg-zinc-800/80 text-white shadow-inner'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
                        }
                        ${isCollapsed ? 'justify-center' : ''}
                      `}
                    >
                      <item.icon className={`w-5 h-5 transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />

                      {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}

                      {/* Active Indicator Line */}
                      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />}

                      {/* Badge */}
                      {item.badge && item.badge > 0 && (
                        <div className={`
                          flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold 
                          ${isCollapsed ? 'absolute -top-1 -right-1 border border-zinc-950' : 'ml-auto'}
                          bg-indigo-500 text-white
                        `}>
                          {item.badge}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* 4. User Profile Footer */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-950" ref={dropdownRef}>
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all border border-transparent hover:border-zinc-800 hover:bg-zinc-900 ${isCollapsed ? 'justify-center' : ''}`}
          >
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold border border-zinc-700">
                {agent?.name.charAt(0).toUpperCase()}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 ${currentStatusStyle.bg}`} />
            </div>

            {!isCollapsed && (
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{agent?.name}</p>
                <p className={`text-xs truncate ${currentStatusStyle.color} capitalize`}>{agent?.onlineStatus}</p>
              </div>
            )}

            {!isCollapsed && <ChevronDown className="w-4 h-4 text-zinc-600" />}
          </button>

          {/* Popup Menu */}
          {showStatusMenu && (
            <div className={`absolute bottom-full mb-3 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden p-1 w-64 z-50 ${isCollapsed ? 'left-14' : 'left-0 right-0'}`}>

              {/* Profile Header in Menu */}
              <div className="p-3 border-b border-zinc-800/50 mb-1">
                <p className="text-xs font-medium text-zinc-500 uppercasemb-2">Estado</p>
                <div className="space-y-1">
                  <StatusButton
                    status="online"
                    label="En línea"
                    active={agent?.onlineStatus === 'online'}
                    onClick={() => handleStatusChange('online')}
                    color="bg-emerald-500"
                  />
                  <StatusButton
                    status="away"
                    label="Ausente"
                    active={agent?.onlineStatus === 'away'}
                    onClick={() => handleStatusChange('away')}
                    color="bg-amber-500"
                  />
                  <StatusButton
                    status="offline"
                    label="Desconectado"
                    active={agent?.onlineStatus === 'offline'}
                    onClick={() => handleStatusChange('offline')}
                    color="bg-zinc-500"
                  />
                </div>
              </div>

              {/* Menu Links */}
              <div className="space-y-0.5 p-1">
                <MenuLink icon={User} label="Mi Cuenta" onClick={() => navigate('/dashboard/my-settings/account')} />
                <MenuLink icon={Settings} label="Preferencias" onClick={() => navigate('/dashboard/my-settings/preferences')} />
                <div className="h-px bg-zinc-800 my-1 mx-2" />
                <MenuLink icon={LogOut} label="Cerrar Sesión" onClick={logout} danger />
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

// ============= SUB-COMPONENTS =============

function StatusButton({ status, label, active, onClick, color }: { status: string; label: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
        }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${color} ${active ? 'ring-2 ring-white/10' : ''}`} />
      <span>{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/50" />}
    </button>
  );
}

function MenuLink({ icon: Icon, label, onClick, danger }: { icon: React.ComponentType<any>; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${danger
        ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
        }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
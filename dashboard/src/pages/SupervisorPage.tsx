/**
 * SupervisorPage - Full-page supervisor dashboard
 * Live monitoring of agents, chats, whispers, and performance
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSupervisorStore, type AgentOverview } from '../stores/supervisorStore';
import { supervisorService } from '../services/supervisor.service';
import { Navigate } from 'react-router-dom';
import { ChatPreview } from '../components/supervisor/ChatPreview';
import { 
  Eye, 
  Users, 
  MessageCircle, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Send,
  PhoneForwarded,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Activity
} from 'lucide-react';

interface LiveChat {
  sessionId: string;
  userId: string;
  userName: string;
  agentId: string;
  agentName: string;
  status: string;
  messagesCount: number;
  duration: number;
  lastMessage: string;
  lastMessageAt: string;
  slaStatus: 'ok' | 'warning' | 'critical';
}

export default function SupervisorPage() {
  const { agent } = useAuthStore();
  const {
    stats,
    agents,
    setStats,
    setAgents,
    setLoadingStats,
    setLoadingAgents,
    isLoadingStats,
    isLoadingAgents,
  } = useSupervisorStore();

  const [liveChats, setLiveChats] = useState<LiveChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<LiveChat | null>(null);
  const [whisperText, setWhisperText] = useState('');
  const [whisperSending, setWhisperSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'agents' | 'chats' | 'sla'>('agents');
  const [refreshing, setRefreshing] = useState(false);

  // Access control
  const canAccess = agent?.role === 'admin' || agent?.role === 'supervisor';

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!canAccess) return;

    setLoadingStats(true);
    setLoadingAgents(true);

    try {
      const [statsRes, agentsRes, chatsRes] = await Promise.all([
        supervisorService.getStats(),
        supervisorService.getAgentOverviews(),
        supervisorService.getLiveChats(),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (agentsRes.success) setAgents(agentsRes.data);
      if (chatsRes.success) setLiveChats(chatsRes.data || []);
    } catch (error) {
      console.error('Failed to load supervisor data:', error);
    } finally {
      setLoadingStats(false);
      setLoadingAgents(false);
    }
  }, [canAccess, setStats, setAgents, setLoadingStats, setLoadingAgents]);

  useEffect(() => {
    if (canAccess) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [canAccess, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Send whisper to agent
  const handleSendWhisper = async () => {
    if (!selectedChat || !whisperText.trim()) return;
    
    setWhisperSending(true);
    try {
      await supervisorService.sendWhisper(selectedChat.sessionId, selectedChat.agentId, whisperText);
      setWhisperText('');
    } catch (error) {
      console.error('Failed to send whisper:', error);
    } finally {
      setWhisperSending(false);
    }
  };

  // Take over chat
  const handleTakeOver = async (sessionId: string) => {
    try {
      await supervisorService.takeOverChat(sessionId);
      await fetchData();
    } catch (error) {
      console.error('Failed to take over chat:', error);
    }
  };

  if (!canAccess) {
    return <Navigate to="/dashboard" replace />;
  }

  const slaAtRisk = liveChats.filter(c => c.slaStatus === 'critical').length;
  const slaWarning = liveChats.filter(c => c.slaStatus === 'warning').length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-xl">
            <Eye className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Panel de Supervisor</h1>
            <p className="text-sm text-gray-400">Monitoreo en tiempo real de agentes y conversaciones</p>
          </div>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 p-6 border-b border-gray-800">
        <StatCard
          icon={<MessageCircle className="w-5 h-5" />}
          label="Chats Activos"
          value={stats?.totalActiveSessions || liveChats.length}
          color="blue"
          loading={isLoadingStats}
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="En Espera"
          value={stats?.queuedSessions || 0}
          color="yellow"
          loading={isLoadingStats}
        />
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Agentes Online"
          value={stats?.onlineAgents || agents.filter(a => a.status === 'online').length}
          subValue={`/ ${agents.length} total`}
          color="green"
          loading={isLoadingAgents}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="SLA en Riesgo"
          value={slaAtRisk}
          subValue={slaWarning > 0 ? `+${slaWarning} advertencias` : undefined}
          color="red"
          loading={isLoadingStats}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Tabs */}
        <div className="w-2/3 border-r border-gray-800 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            <TabButton
              active={activeTab === 'agents'}
              onClick={() => setActiveTab('agents')}
              icon={<Users className="w-4 h-4" />}
              label="Agentes"
              badge={agents.length}
            />
            <TabButton
              active={activeTab === 'chats'}
              onClick={() => setActiveTab('chats')}
              icon={<MessageCircle className="w-4 h-4" />}
              label="Chats en Vivo"
              badge={liveChats.length}
            />
            <TabButton
              active={activeTab === 'sla'}
              onClick={() => setActiveTab('sla')}
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Alertas SLA"
              badge={slaAtRisk + slaWarning}
              badgeColor={slaAtRisk > 0 ? 'red' : 'yellow'}
            />
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'agents' && (
              <AgentGrid agents={agents} loading={isLoadingAgents} />
            )}
            {activeTab === 'chats' && (
              <LiveChatsList 
                chats={liveChats} 
                selectedChat={selectedChat}
                onSelectChat={setSelectedChat}
                onTakeOver={handleTakeOver}
              />
            )}
            {activeTab === 'sla' && (
              <SLAAlerts 
                chats={liveChats.filter(c => c.slaStatus !== 'ok')} 
                onSelectChat={setSelectedChat}
              />
            )}
          </div>
        </div>

        {/* Right Panel - Chat Preview & Whisper */}
        <div className="w-1/3 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Info */}
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{selectedChat.userName}</h3>
                    <p className="text-sm text-gray-400">
                      Agente: {selectedChat.agentName}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTakeOver(selectedChat.sessionId)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 transition-colors text-sm"
                    >
                      <PhoneForwarded className="w-4 h-4" />
                      <span>Tomar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Preview (Read-only) */}
              <div className="flex-1 overflow-hidden flex flex-col bg-gray-900/50">
                <ChatPreview
                  sessionId={selectedChat.sessionId}
                  userName={selectedChat.userName}
                  agentName={selectedChat.agentName}
                />
              </div>

              {/* Whisper Box */}
              <div className="p-4 border-t border-gray-800 bg-gray-900">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-400">Whisper al agente</span>
                  <span className="text-xs text-gray-500">(Solo el agente verá esto)</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={whisperText}
                    onChange={(e) => setWhisperText(e.target.value)}
                    placeholder="Escribe un mensaje privado para el agente..."
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendWhisper()}
                  />
                  <button
                    onClick={handleSendWhisper}
                    disabled={!whisperText.trim() || whisperSending}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {whisperSending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Eye className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Selecciona un chat para ver detalles</p>
                <p className="text-sm mt-1">y enviar whispers al agente</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components

function StatCard({ 
  icon, 
  label, 
  value, 
  subValue, 
  color, 
  loading 
}: { 
  icon: React.ReactNode;
  label: string;
  value: number;
  subValue?: string;
  color: 'blue' | 'yellow' | 'green' | 'red';
  loading?: boolean;
}) {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold text-white">
              {loading ? '...' : value}
            </p>
            {subValue && (
              <span className="text-sm text-gray-500">{subValue}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ 
  active, 
  onClick, 
  icon, 
  label, 
  badge, 
  badgeColor = 'gray' 
}: { 
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: 'gray' | 'red' | 'yellow';
}) {
  const badgeColors = {
    gray: 'bg-gray-700 text-gray-300',
    red: 'bg-red-500 text-white',
    yellow: 'bg-yellow-500 text-gray-900',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
        active
          ? 'border-purple-500 text-purple-400 bg-purple-500/10'
          : 'border-transparent text-gray-400 hover:text-white hover:bg-gray-800'
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      {badge !== undefined && (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColors[badgeColor]}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function AgentGrid({ agents, loading }: { agents: AgentOverview[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="p-4 bg-gray-800/50 rounded-xl animate-pulse h-32" />
        ))}
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No hay agentes disponibles</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {agents.map(agent => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}

function AgentCard({ agent }: { agent: AgentOverview }) {
  const statusColors = {
    online: 'bg-green-500',
    away: 'bg-yellow-500',
    offline: 'bg-gray-500',
  };

  const statusLabels = {
    online: 'En línea',
    away: 'Ausente',
    offline: 'Desconectado',
  };

  return (
    <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="relative">
          <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-medium">
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${statusColors[agent.status]}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{agent.name}</p>
          <p className="text-xs text-gray-400">{statusLabels[agent.status]}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="p-2 bg-gray-900/50 rounded-lg">
          <p className="text-lg font-bold text-white">{agent.activeChats}</p>
          <p className="text-xs text-gray-500">Activos</p>
        </div>
        <div className="p-2 bg-gray-900/50 rounded-lg">
          <p className="text-lg font-bold text-white">{agent.avgResponseTime || '--'}</p>
          <p className="text-xs text-gray-500">Promedio</p>
        </div>
      </div>
    </div>
  );
}

function LiveChatsList({ 
  chats, 
  selectedChat, 
  onSelectChat, 
  onTakeOver 
}: { 
  chats: LiveChat[];
  selectedChat: LiveChat | null;
  onSelectChat: (chat: LiveChat) => void;
  onTakeOver: (sessionId: string) => void;
}) {
  if (chats.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No hay chats activos en este momento</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {chats.map(chat => (
        <div
          key={chat.sessionId}
          onClick={() => onSelectChat(chat)}
          className={`p-4 rounded-xl border cursor-pointer transition-colors ${
            selectedChat?.sessionId === chat.sessionId
              ? 'bg-purple-500/10 border-purple-500'
              : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">{chat.userName}</span>
              <SLABadge status={chat.slaStatus} />
            </div>
            <span className="text-xs text-gray-500">
              {Math.floor(chat.duration / 60)}:{(chat.duration % 60).toString().padStart(2, '0')}
            </span>
          </div>
          <p className="text-sm text-gray-400 truncate">{chat.lastMessage || 'Sin mensajes'}</p>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">Agente: {chat.agentName}</span>
            <span className="text-xs text-gray-500">{chat.messagesCount} mensajes</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SLABadge({ status }: { status: 'ok' | 'warning' | 'critical' }) {
  const styles = {
    ok: 'bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    critical: 'bg-red-500/20 text-red-400',
  };

  const labels = {
    ok: 'OK',
    warning: 'Advertencia',
    critical: 'Crítico',
  };

  const icons = {
    ok: <CheckCircle2 className="w-3 h-3" />,
    warning: <Clock className="w-3 h-3" />,
    critical: <XCircle className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {icons[status]}
      {labels[status]}
    </span>
  );
}

function SLAAlerts({ 
  chats, 
  onSelectChat 
}: { 
  chats: LiveChat[];
  onSelectChat: (chat: LiveChat) => void;
}) {
  if (chats.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50 text-green-500" />
        <p className="text-green-400">Todos los chats están dentro del SLA</p>
        <p className="text-sm mt-1">No hay alertas en este momento</p>
      </div>
    );
  }

  const critical = chats.filter(c => c.slaStatus === 'critical');
  const warning = chats.filter(c => c.slaStatus === 'warning');

  return (
    <div className="space-y-6">
      {critical.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-red-400 font-medium mb-3">
            <XCircle className="w-4 h-4" />
            Críticos ({critical.length})
          </h3>
          <div className="space-y-2">
            {critical.map(chat => (
              <AlertCard key={chat.sessionId} chat={chat} onClick={() => onSelectChat(chat)} />
            ))}
          </div>
        </div>
      )}
      
      {warning.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-yellow-400 font-medium mb-3">
            <AlertTriangle className="w-4 h-4" />
            Advertencias ({warning.length})
          </h3>
          <div className="space-y-2">
            {warning.map(chat => (
              <AlertCard key={chat.sessionId} chat={chat} onClick={() => onSelectChat(chat)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertCard({ chat, onClick }: { chat: LiveChat; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-colors ${
        chat.slaStatus === 'critical'
          ? 'bg-red-500/10 border-red-500/30 hover:border-red-500'
          : 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-white">{chat.userName}</span>
        <span className="text-xs text-gray-400">
          Esperando {Math.floor(chat.duration / 60)} min
        </span>
      </div>
      <p className="text-sm text-gray-400">Agente: {chat.agentName}</p>
    </button>
  );
}

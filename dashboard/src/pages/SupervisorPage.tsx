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
  Activity,
  Shield
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
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-purple-500/30">

      {/* Purple Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">

        {/* Header Section */}
        <div className="px-8 py-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-purple-900/10">
                <Shield className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Panel de Supervisor</h1>
                <p className="text-sm text-zinc-400">Monitoreo y gestión en tiempo real</p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all flex items-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
              <span className="text-sm font-medium">Actualizar</span>
            </button>
          </div>

          {/* Stats Bar (Glassy) */}
          <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6 overflow-x-auto">
            <StatBadge icon={MessageCircle} count={stats?.totalActiveSessions || liveChats.length} label="Chats Activos" color="text-blue-400" bg="bg-blue-500/10" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Clock} count={stats?.queuedSessions || 0} label="En Espera" color="text-amber-400" bg="bg-amber-500/10" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Users} count={stats?.onlineAgents || agents.filter(a => a.status === 'online').length} label="Agentes Online" color="text-emerald-400" bg="bg-emerald-500/10" />
            {(slaAtRisk > 0 || slaWarning > 0) && (
              <>
                <div className="h-4 w-px bg-white/10" />
                <StatBadge icon={AlertTriangle} count={slaAtRisk} label="SLA Crítico" color="text-red-400" bg="bg-red-500/10" alert />
              </>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden border-t border-zinc-800/50">

          {/* Left Panel: Lists */}
          <div className="w-2/5 xl:w-1/3 border-r border-zinc-800 flex flex-col bg-zinc-900/30">
            {/* Tabs */}
            <div className="flex border-b border-zinc-800 bg-zinc-950/50">
              <TabButton active={activeTab === 'agents'} onClick={() => setActiveTab('agents')} icon={Users} label="Agentes" badge={agents.length} />
              <TabButton active={activeTab === 'chats'} onClick={() => setActiveTab('chats')} icon={MessageCircle} label="Chats" badge={liveChats.length} />
              <TabButton active={activeTab === 'sla'} onClick={() => setActiveTab('sla')} icon={AlertTriangle} label="SLA" badge={slaAtRisk + slaWarning} alert={slaAtRisk > 0} />
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
              {activeTab === 'agents' && (
                isLoadingAgents ? <LoadingSkeleton /> : <AgentList agents={agents} />
              )}

              {activeTab === 'chats' && (
                <LiveChatsList chats={liveChats} selectedChat={selectedChat} onSelectChat={setSelectedChat} />
              )}

              {activeTab === 'sla' && (
                <SLAAlerts chats={liveChats.filter(c => c.slaStatus !== 'ok')} onSelectChat={setSelectedChat} />
              )}
            </div>
          </div>

          {/* Right Panel: Chat Detail */}
          <div className="flex-1 flex flex-col bg-zinc-950/80 relative">
            {selectedChat ? (
              <>
                {/* Chat Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-white font-bold border border-white/10">
                      {selectedChat.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{selectedChat.userName}</h3>
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <span>Agente: <span className="text-zinc-300">{selectedChat.agentName}</span></span>
                        <span>•</span>
                        <SLABadge status={selectedChat.slaStatus} />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleTakeOver(selectedChat.sessionId)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium border border-orange-500/20 transition-colors"
                  >
                    <PhoneForwarded className="w-4 h-4" />
                    <span>Tomar Control</span>
                  </button>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-hidden relative">
                  <ChatPreview
                    sessionId={selectedChat.sessionId}
                    userName={selectedChat.userName}
                    agentName={selectedChat.agentName}
                  />
                </div>

                {/* Supervisor Whisper Input */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-900">
                  <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercasetext-purple-400">
                    <Eye className="w-3 h-3" /> Modo Supervisión (Privado)
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={whisperText}
                      onChange={(e) => setWhisperText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendWhisper()}
                      placeholder="Escribe un mensaje privado para el agente..."
                      className="w-full pl-4 pr-12 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                    />
                    <button
                      onClick={handleSendWhisper}
                      disabled={!whisperText.trim() || whisperSending}
                      className="absolute right-2 top-1.5 p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:bg-zinc-800"
                    >
                      {whisperSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 opacity-60">
                <MessageSquare className="w-16 h-16 mb-4 stroke-1" />
                <p className="text-lg font-medium">Selecciona una conversación</p>
                <p className="text-sm">para monitorear o intervenir</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components


function StatBadge({ icon: Icon, count, label, color, bg, alert }: any) {
  return (
    <div className={`flex items-center gap-3 px-3 py-1 rounded-xl transition-all min-w-fit ${alert ? 'animate-pulse' : ''}`}>
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-lg ${color}`}>{count}</span>
        <span className="text-[10px] font-bold text-zinc-500">{label}</span>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, badge, alert }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition-all ${active
          ? 'border-purple-500 text-purple-400 bg-purple-500/5'
          : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900'
        }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm font-medium">{label}</span>
      {badge > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${alert ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function AgentList({ agents }: { agents: AgentOverview[] }) {
  if (agents.length === 0) return <EmptyState icon={Users} text="No hay agentes conectados" />;

  return (
    <>
      {agents.map(agent => (
        <div key={agent.id} className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:bg-zinc-800/50 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center text-xs font-bold text-zinc-300 border border-zinc-700">
                  {agent.name.charAt(0)}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${agent.status === 'online' ? 'bg-emerald-500' : agent.status === 'away' ? 'bg-amber-500' : 'bg-zinc-500'
                  }`} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{agent.name}</p>
                <p className="text-[10px] text-zinc-500 capitalize">{agent.status}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-white">{agent.activeChats}</p>
              <p className="text-[10px] text-zinc-500">Chats</p>
            </div>
          </div>
          <div className="flex gap-2">
            <MetricPill label="Avg Time" value={agent.avgResponseTime || '-'} />
            {/* Add more metrics if needed */}
          </div>
        </div>
      ))}
    </>
  );
}

function LiveChatsList({ chats, selectedChat, onSelectChat }: { chats: LiveChat[], selectedChat: LiveChat | null, onSelectChat: (chat: LiveChat) => void }) {
  if (chats.length === 0) return <EmptyState icon={MessageCircle} text="No hay chats activos" />;

  return (
    <>
      {chats.map(chat => (
        <button
          key={chat.sessionId}
          onClick={() => onSelectChat(chat)}
          className={`w-full text-left p-3 rounded-xl border transition-all ${selectedChat?.sessionId === chat.sessionId
              ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
              : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
            }`}
        >
          <div className="flex justify-between items-start mb-1">
            <span className="font-medium text-zinc-200 text-sm">{chat.userName}</span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {Math.floor(chat.duration / 60)}:{(chat.duration % 60).toString().padStart(2, '0')}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-zinc-500 truncate max-w-[120px]">{chat.agentName}</span>
            <SLABadge status={chat.slaStatus} mini />
          </div>

          <p className="text-xs text-zinc-400 truncate opacity-80 pl-2 border-l-2 border-zinc-700">
            {chat.lastMessage || '...'}
          </p>
        </button>
      ))}
    </>
  );
}

function SLAAlerts({ chats, onSelectChat }: { chats: LiveChat[], onSelectChat: (chat: LiveChat) => void }) {
  if (chats.length === 0) return <EmptyState icon={CheckCircle2} text="Todo bajo control" color="text-emerald-500" />;

  return (
    <>
      {chats.map(chat => (
        <button
          key={chat.sessionId}
          onClick={() => onSelectChat(chat)}
          className={`w-full text-left p-3 rounded-xl border mb-2 transition-all ${chat.slaStatus === 'critical'
              ? 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20'
              : 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
            }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-white text-sm">{chat.userName}</span>
            <AlertTriangle className={`w-4 h-4 ${chat.slaStatus === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
          </div>
          <div className="flex justify-between items-center text-xs opacity-80">
            <span className={chat.slaStatus === 'critical' ? 'text-red-300' : 'text-amber-300'}>
              {chat.agentName}
            </span>
            <span className="font-mono">
              Wait: {Math.floor(chat.duration / 60)}m
            </span>
          </div>
        </button>
      ))}
    </>
  );
}

const MetricPill = ({ label, value }: { label: string, value: string | number }) => (
  <div className="px-2 py-1 bg-zinc-950 rounded text-[10px] text-zinc-400 border border-zinc-800">
    <span className="opacity-70 mr-1">{label}:</span>
    <span className="text-zinc-200 font-medium">{value}</span>
  </div>
);

const SLABadge = ({ status, mini }: { status: string, mini?: boolean }) => {
  const styles = {
    ok: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  };
  const s = styles[status as keyof typeof styles] || styles.ok;

  if (mini) return <div className={`w-2 h-2 rounded-full ${s.split(' ')[1].replace('/10', '')}`} />;

  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercaseborder ${s}`}>
      {status}
    </span>
  );
};

const EmptyState = ({ icon: Icon, text, color = 'text-zinc-500' }: any) => (
  <div className={`flex flex-col items-center justify-center py-10 opacity-60 ${color}`}>
    <Icon className="w-10 h-10 mb-2 stroke-1" />
    <p className="text-sm font-medium">{text}</p>
  </div>
);

const LoadingSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-900/50 rounded-xl animate-pulse" />)}
  </div>
);
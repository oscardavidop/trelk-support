/**
 * SupervisorPanel - Live monitoring dashboard for supervisors
 * Shows agent overview, live stats, and allows whispers/takeovers
 */

import { useEffect, useState, useCallback } from 'react';
import { 
  useSupervisorStore, 
  type AgentOverview, 
  type SupervisorStats 
} from '../../stores/supervisorStore';
import { useAuthStore } from '../../stores/authStore';
import { supervisorService } from '../../services/supervisor.service';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SupervisorPanel({ isOpen, onClose }: Props) {
  const { agent } = useAuthStore();
  const { 
    stats, 
    agents, 
    isLoadingStats, 
    isLoadingAgents,
    selectedAgentId,
    setStats,
    setAgents,
    setLoadingStats,
    setLoadingAgents,
    setSelectedAgent,
  } = useSupervisorStore();
  
  const [refreshing, setRefreshing] = useState(false);
  
  // Check if user can access supervisor panel
  const canAccess = agent?.role === 'admin' || agent?.role === 'supervisor';
  
  // Fetch data
  const fetchData = useCallback(async () => {
    if (!canAccess) return;
    
    setLoadingStats(true);
    setLoadingAgents(true);
    
    try {
      const [statsRes, agentsRes] = await Promise.all([
        supervisorService.getStats(),
        supervisorService.getAgentOverviews(),
      ]);
      
      if (statsRes.success) setStats(statsRes.data);
      if (agentsRes.success) setAgents(agentsRes.data);
    } catch (error) {
      console.error('Failed to load supervisor data:', error);
    } finally {
      setLoadingStats(false);
      setLoadingAgents(false);
    }
  }, [canAccess, setStats, setAgents, setLoadingStats, setLoadingAgents]);
  
  useEffect(() => {
    if (isOpen && canAccess) {
      fetchData();
      
      // Refresh every 30 seconds
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [isOpen, canAccess, fetchData]);
  
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };
  
  if (!canAccess) {
    return null;
  }
  
  if (!isOpen) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="relative ml-auto h-full w-full max-w-4xl bg-gray-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-50">Panel de Supervisor</h2>
              <p className="text-sm text-gray-400">Monitoreo en tiempo real</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-400 hover:text-zinc-50 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-zinc-50 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Stats Overview */}
        <StatsOverview stats={stats} loading={isLoadingStats} />
        
        {/* Agent List */}
        <div className="flex-1 overflow-hidden flex">
          <AgentList 
            agents={agents} 
            loading={isLoadingAgents} 
            selectedAgentId={selectedAgentId}
            onSelectAgent={setSelectedAgent}
          />
          
          {/* Agent Detail */}
          {selectedAgentId && (
            <AgentDetail 
              agent={agents.find(a => a.id === selectedAgentId)} 
              onClose={() => setSelectedAgent(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Stats Overview Component
function StatsOverview({ stats, loading }: { stats: SupervisorStats | null; loading: boolean }) {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-5 gap-4 p-6 border-b border-gray-700">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
            <div className="h-4 w-20 bg-gray-700 rounded mb-2" />
            <div className="h-8 w-12 bg-gray-700 rounded" />
          </div>
        ))}
      </div>
    );
  }
  
  if (!stats) return null;
  
  const items = [
    { label: 'Agentes Online', value: stats.onlineAgents, total: stats.totalAgents, color: 'text-green-400' },
    { label: 'Disponibles', value: stats.availableAgents, icon: '✓', color: 'text-blue-400' },
    { label: 'Sesiones Activas', value: stats.totalActiveSessions, color: 'text-yellow-400' },
    { label: 'En Cola', value: stats.queuedSessions, color: 'text-orange-400' },
    { label: 'Resueltas Hoy', value: stats.resolutionsToday, color: 'text-purple-400' },
  ];
  
  return (
    <div className="grid grid-cols-5 gap-4 p-6 border-b border-gray-700">
      {items.map((item, i) => (
        <div key={i} className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 uppercasemb-1">{item.label}</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-2xl font-bold ${item.color}`}>{item.value}</span>
            {item.total !== undefined && (
              <span className="text-sm text-gray-500">/ {item.total}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Agent List Component
function AgentList({ 
  agents, 
  loading, 
  selectedAgentId,
  onSelectAgent 
}: { 
  agents: AgentOverview[]; 
  loading: boolean;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
}) {
  if (loading && agents.length === 0) {
    return (
      <div className="w-80 border-r border-gray-700 p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-700 rounded-full" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-gray-700 rounded mb-2" />
                <div className="h-3 w-16 bg-gray-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="w-80 border-r border-gray-700 overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercasemb-3">
          Agentes ({agents.length})
        </h3>
        
        <div className="space-y-2">
          {agents.map(agent => (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.id === selectedAgentId ? null : agent.id)}
              className={`w-full p-3 rounded-lg text-left transition-colors ${
                selectedAgentId === agent.id 
                  ? 'bg-purple-500/20 border border-purple-500/50' 
                  : 'bg-gray-800/50 hover:bg-gray-800 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar with status */}
                <div className="relative">
                  <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-zinc-50 font-medium">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${
                    agent.status === 'online' ? 'bg-green-400' :
                    agent.status === 'away' ? 'bg-yellow-400' : 'bg-gray-500'
                  }`} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-50 truncate">{agent.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className={
                      agent.availability === 'available' ? 'text-green-400' :
                      agent.availability === 'busy' ? 'text-yellow-400' : 'text-gray-500'
                    }>
                      {agent.availability === 'available' ? 'Disponible' :
                       agent.availability === 'busy' ? 'Ocupado' : 'No disponible'}
                    </span>
                    <span>•</span>
                    <span>{agent.activeChats}/{agent.maxChats} chats</span>
                  </div>
                </div>
                
                {/* Stats badges */}
                <div className="text-right">
                  <p className="text-sm font-medium text-zinc-50">{agent.resolvedToday}</p>
                  <p className="text-xs text-gray-500">hoy</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Agent Detail Component
function AgentDetail({ agent, onClose }: { agent?: AgentOverview; onClose: () => void }) {
  const [whisperContent, setWhisperContent] = useState('');
  const [sending, setSending] = useState(false);
  
  if (!agent) return null;
  
  const handleSendWhisper = async (sessionId: string) => {
    if (!whisperContent.trim()) return;
    
    setSending(true);
    try {
      await supervisorService.sendWhisper(sessionId, agent.id, whisperContent);
      setWhisperContent('');
    } catch (error) {
      console.error('Failed to send whisper:', error);
    } finally {
      setSending(false);
    }
  };
  
  const handleTakeover = async (sessionId: string) => {
    if (!confirm('¿Tomar control de esta sesión? El agente será notificado.')) return;
    
    try {
      await supervisorService.takeoverSession(sessionId, 'Intervención de supervisor');
    } catch (error) {
      console.error('Failed to takeover session:', error);
    }
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Agent header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center text-zinc-50 text-2xl font-medium">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-gray-900 ${
              agent.status === 'online' ? 'bg-green-400' :
              agent.status === 'away' ? 'bg-yellow-400' : 'bg-gray-500'
            }`} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-50">{agent.name}</h3>
            <p className="text-sm text-gray-400">{agent.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                agent.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                agent.role === 'supervisor' ? 'bg-purple-500/20 text-purple-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {agent.role}
              </span>
            </div>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-zinc-50 hover:bg-gray-800 rounded-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Agent metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Chats Activos</p>
          <p className="text-2xl font-bold text-zinc-50">{agent.activeChats}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Tiempo Respuesta Prom.</p>
          <p className="text-2xl font-bold text-zinc-50">{Math.round(agent.avgResponseTime / 1000)}s</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-4">
          <p className="text-xs text-gray-400 mb-1">Resueltas Hoy</p>
          <p className="text-2xl font-bold text-zinc-50">{agent.resolvedToday}</p>
        </div>
      </div>
      
      {/* Active sessions */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 uppercasemb-3">
          Sesiones Activas ({agent.sessions.length})
        </h4>
        
        {agent.sessions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Sin sesiones activas</p>
        ) : (
          <div className="space-y-3">
            {agent.sessions.map(session => (
              <div 
                key={session.id}
                className="bg-gray-800/50 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-50">
                      {session.user.firstName}
                      {session.user.username && (
                        <span className="text-gray-400 ml-1">@{session.user.username}</span>
                      )}
                    </p>
                    {session.lastMessage && (
                      <p className="text-xs text-gray-400 truncate mt-1">
                        {session.lastMessage}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {session.category && (
                        <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                          {session.category}
                        </span>
                      )}
                      {session.unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">
                          {session.unreadCount} sin leer
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleTakeover(session.id)}
                      className="p-2 text-yellow-400 hover:bg-yellow-500/20 rounded-lg transition-colors"
                      title="Tomar control"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Whisper input */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={whisperContent}
                    onChange={(e) => setWhisperContent(e.target.value)}
                    placeholder="Enviar whisper al agente..."
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-zinc-50 placeholder-gray-400 focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendWhisper(session.id);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleSendWhisper(session.id)}
                    disabled={sending || !whisperContent.trim()}
                    className="px-3 py-2 bg-purple-500 text-zinc-50 rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SupervisorPanel;

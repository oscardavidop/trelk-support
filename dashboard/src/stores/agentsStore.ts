// Agents store using Zustand
import { create } from 'zustand';
import type { Agent } from '../types';

export type AvailabilityStatus = 'available' | 'busy' | 'offline';

interface AgentsState {
  agents: Agent[];
  onlineAgents: string[];
  
  // Actions
  setAgents: (agents: Agent[]) => void;
  updateAgent: (agent: Agent) => void;
  removeAgent: (agentId: string) => void;
  setAgentOnline: (agentId: string) => void;
  setAgentOffline: (agentId: string) => void;
  updateAgentStatus: (agentId: string, status: Agent['onlineStatus']) => void;
  updateAgentAvailability: (agentId: string, availability: AvailabilityStatus, activeChats: number) => void;
}

export const useAgentsStore = create<AgentsState>((set) => ({
  agents: [],
  onlineAgents: [],

  setAgents: (agents) => set({ 
    agents,
    onlineAgents: agents.filter(a => a.onlineStatus !== 'offline').map(a => a._id),
  }),
  
  updateAgent: (agent) => set((state) => ({
    agents: state.agents.map(a => a._id === agent._id ? agent : a),
  })),
  
  removeAgent: (agentId) => set((state) => ({
    agents: state.agents.filter(a => a._id !== agentId),
    onlineAgents: state.onlineAgents.filter(id => id !== agentId),
  })),
  
  setAgentOnline: (agentId) => set((state) => ({
    onlineAgents: [...new Set([...state.onlineAgents, agentId])],
    agents: state.agents.map(a => 
      a._id === agentId ? { ...a, onlineStatus: 'online' as const } : a
    ),
  })),
  
  setAgentOffline: (agentId) => set((state) => ({
    onlineAgents: state.onlineAgents.filter(id => id !== agentId),
    agents: state.agents.map(a => 
      a._id === agentId ? { ...a, onlineStatus: 'offline' as const } : a
    ),
  })),
  
  updateAgentStatus: (agentId, status) => set((state) => ({
    onlineAgents: status === 'offline' 
      ? state.onlineAgents.filter(id => id !== agentId)
      : [...new Set([...state.onlineAgents, agentId])],
    agents: state.agents.map(a => 
      a._id === agentId ? { ...a, onlineStatus: status } : a
    ),
  })),
  
  updateAgentAvailability: (agentId, availability, activeChats) => set((state) => ({
    agents: state.agents.map(a => 
      a._id === agentId ? { ...a, availability, activeChats } : a
    ),
  })),
}));

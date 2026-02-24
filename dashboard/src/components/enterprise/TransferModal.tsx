/**
 * TransferModal - Premium Zinc Refactor
 * High-fidelity modal for transferring chat sessions between agents.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select-advanced';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import type { Agent } from '../../types';
import { ArrowRightLeft, Loader2, Search, Info } from 'lucide-react';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  currentAgentId?: string;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  currentAgentId,
}) => {
  const { socket } = useSocket();
  const { agent: currentAgent } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available agents
  useEffect(() => {
    const fetchAgents = async () => {
      setIsFetching(true);
      try {
        const token = JSON.parse(localStorage.getItem('trelk-support-auth') || '{}')?.state?.token as any;
        const response = await fetch('/api/agents', {
          headers: { Authorization: `Bearer ${token}` },
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          // Filter out current agent and offline agents
          const available = data.agents.filter(
            (a: Agent) =>
              a._id !== currentAgentId &&
              a._id !== currentAgent?._id &&
              a.onlineStatus !== 'offline' &&
              a.isActive
          );
          // Sort by online status first, then load
          available.sort((a: Agent, b: Agent) => {
            if (a.onlineStatus === b.onlineStatus) return a.activeChats - b.activeChats;
            return a.onlineStatus === 'online' ? -1 : 1;
          });
          setAgents(available);
        }
      } catch (err) {
        console.error('Failed to fetch agents:', err);
        setError('No se pudo cargar la lista de agentes.');
      } finally {
        setIsFetching(false);
      }
    };

    if (isOpen) {
      fetchAgents();
      setSelectedAgentId('');
      setReason('');
      setError(null);
    }
  }, [isOpen, currentAgentId, currentAgent]);

  const handleTransfer = async () => {
    if (!selectedAgentId || !reason.trim()) {
      setError('Debes seleccionar un agente y proporcionar una razón');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      socket?.emit('session:transfer', {
        sessionId,
        toAgentId: selectedAgentId,
        reason: reason.trim(),
      });

      // Close modal after a short delay
      setTimeout(() => {
        setIsLoading(false);
        onClose();
        setSelectedAgentId('');
        setReason('');
      }, 500);
    } catch (err) {
      setError('Error al transferir el chat');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 bg-zinc-950 border-zinc-800 shadow-2xl overflow-hidden gap-0">
        
        {/* === HEADER === */}
        <div className="relative px-6 py-5 border-b border-zinc-800/50 bg-gradient-to-b from-indigo-500/10 to-transparent">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/50" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl ring-1 ring-indigo-500/20 shadow-inner">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 tracking-tight">Transferir Chat</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Asigna esta conversación a otro agente disponible.
              </p>
            </div>
          </div>
        </div>

        {/* === BODY === */}
        <div className="px-6 py-5 space-y-5">
          
          {/* Agent Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase ">
              Agente Destino
            </label>
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId} disabled={isFetching}>
              <SelectTrigger className="w-full bg-zinc-900 border-zinc-800 text-zinc-200 focus:ring-indigo-500/20 focus:border-indigo-500/50">
                <SelectValue placeholder={isFetching ? "Cargando agentes..." : "Selecciona un agente..."} />
              </SelectTrigger>
              <SelectContent className="bg-zinc-950 border-zinc-800 max-h-60">
                {agents.length === 0 && !isFetching ? (
                  <div className="p-4 text-center text-xs text-zinc-500">
                    <Search className="w-6 h-6 mx-auto mb-2 opacity-20" />
                    No hay otros agentes disponibles
                  </div>
                ) : (
                  agents.map((agent) => (
                    <SelectItem 
                      key={agent._id} 
                      value={agent._id}
                      className="hover:bg-zinc-900 focus:bg-zinc-900 data-[state=checked]:bg-indigo-500/10 data-[state=checked]:text-indigo-400"
                    >
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-2.5">
                          <span className="relative flex h-2.5 w-2.5">
                            {agent.onlineStatus === 'online' && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            )}
                            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${agent.onlineStatus === 'online' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          </span>
                          <span className="font-medium">{agent.name}</span>
                        </div>
                        <span className="text-[10px] font-mono bg-zinc-800/80 px-1.5 py-0.5 rounded text-zinc-500 ml-4">
                          {agent.activeChats} chats
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Transfer Reason */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase  flex items-center gap-1.5">
              Motivo de Transferencia <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="Ej: El cliente necesita soporte técnico especializado Nivel 2..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 outline-none resize-none transition-all"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-xs font-medium text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20 animate-in fade-in">
              <Info className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* === FOOTER === */}
        <div className="px-6 py-4 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleTransfer}
            disabled={isLoading || !selectedAgentId || !reason.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            Confirmar Transferencia
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default TransferModal;
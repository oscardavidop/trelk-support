/**
 * Transfer Modal Component
 * Modal to transfer a chat session to another agent
 */

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/Button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
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
import { ArrowRightLeft, Loader2 } from 'lucide-react';

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
    const [error, setError] = useState<string | null>(null);

    // Fetch available agents
    useEffect(() => {
        const fetchAgents = async () => {
            try {
                const token = JSON.parse(localStorage.getItem('trelk-support-auth') || '{}').state.token as any;
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
                    setAgents(available);
                }
            } catch (err) {
                console.error('Failed to fetch agents:', err);
            }
        };

        if (isOpen) {
            fetchAgents();
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
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="w-5 h-5" />
                        Transferir Chat
                    </DialogTitle>
                    <DialogDescription>
                        Transfiere este chat a otro agente de soporte disponible.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="agent">Agente destino</Label>
                        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un agente..." />
                            </SelectTrigger>
                            <SelectContent>
                                {agents.length === 0 ? (
                                    <SelectItem value="_none" disabled>
                                        No hay agentes disponibles
                                    </SelectItem>
                                ) : (
                                    agents.map((agent) => (
                                        <SelectItem key={agent._id} value={agent._id}>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`w-2 h-2 rounded-full ${agent.onlineStatus === 'online'
                                                        ? 'bg-green-500'
                                                        : 'bg-yellow-500'
                                                        }`}
                                                />
                                                {agent.name}
                                                <span className="text-muted-foreground text-xs">
                                                    ({agent.activeChats} chats activos)
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="reason">Razón de la transferencia *</Label>
                        <Textarea
                            id="reason"
                            placeholder="Ej: El cliente necesita asistencia técnica especializada..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                        />
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleTransfer} disabled={isLoading || !selectedAgentId}>
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Transferir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default TransferModal;

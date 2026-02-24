/**
 * AgentDetailPanel – Slide-in right panel shown when clicking an agent in the
 * Supervisor > Agents tab.  Provides full visibility + action controls over a
 * single agent and their assigned sessions.
 */

import { useState } from 'react';
import {
  X,
  User,
  MessageCircle,
  Clock,
  Activity,
  PhoneForwarded,
  LogOut,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import type { AgentOverview } from '../../stores/supervisorStore';
import { supervisorService } from '../../services/supervisor.service';

interface Props {
  agent: AgentOverview;
  supervisorId: string;
  onClose: () => void;
  onRefresh: () => void;
  onOpenChat?: (sessionId: string) => void;
}

export function AgentDetailPanel({ agent, onClose, onRefresh, onOpenChat }: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);

  const busy = (key: string) => loadingAction === key;

  async function run(key: string, fn: () => Promise<{ success: boolean; error?: string }>) {
    setLoadingAction(key);
    setFeedback(null);
    try {
      const res = await fn();
      if (res.success) {
        setFeedback({ type: 'ok', msg: 'Acción completada' });
        onRefresh();
      } else {
        setFeedback({ type: 'error', msg: res.error || 'Error desconocido' });
      }
    } catch {
      setFeedback({ type: 'error', msg: 'Error de conexión' });
    } finally {
      setLoadingAction(null);
    }
  }

  const handleTakeAllChats = async () => {
    if (!agent.sessions?.length) return;
    if (!confirm(`¿Tomar control de todos los chats de ${agent.name}?`)) return;
    for (const s of agent.sessions) {
      await supervisorService.takeOverChat(s.id);
    }
    onRefresh();
  };

  const handleUnassignAll = async () => {
    if (!agent.sessions?.length) return;
    if (!confirm(`¿Devolver todos los chats de ${agent.name} a la cola?`)) return;
    for (const s of agent.sessions) {
      await supervisorService.unassignSession(s.id, `Supervisor devolvió chat a cola`);
    }
    onRefresh();
  };

  const handleForceLogout = () => {
    if (!confirm(`¿Forzar desconexión de ${agent.name}?`)) return;
    run('force_logout', () =>
      supervisorService.forceLogoutAgent(agent.id, `Desconexión forzada por supervisor`)
    );
  };

  const statusColor = {
    online: 'bg-emerald-500',
    away: 'bg-amber-500',
    offline: 'bg-zinc-500',
  }[agent.status] || 'bg-zinc-500';

  const availabilityLabel = {
    available: { label: 'Disponible', cls: 'text-emerald-400 bg-emerald-500/10' },
    busy: { label: 'Ocupado', cls: 'text-amber-400 bg-amber-500/10' },
    unavailable: { label: 'No disponible', cls: 'text-zinc-400 bg-zinc-500/10' },
  }[agent.availability] || { label: agent.availability, cls: 'text-zinc-400 bg-zinc-500/10' };

  const capacityPct = agent.maxChats > 0 ? Math.round((agent.activeChats / agent.maxChats) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-l border-zinc-800 w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-100 border border-zinc-700">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${statusColor}`} />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-50 leading-tight">{agent.name}</h3>
            <p className="text-xs text-zinc-500">{agent.email}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={`px-4 py-2 text-xs flex items-center gap-2 ${feedback.type === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {feedback.type === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          {feedback.msg}
        </div>
      )}

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Status + Availability */}
        <div className="grid grid-cols-2 gap-3">
          <InfoCard icon={Activity} label="Estado" value={
            <span className="capitalize text-zinc-100">{agent.status}</span>
          } />
          <InfoCard icon={User} label="Disponibilidad" value={
            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${availabilityLabel.cls}`}>
              {availabilityLabel.label}
            </span>
          } />
        </div>

        {/* Capacity */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <MessageCircle className="w-3.5 h-3.5" />
              Capacidad de chats
            </div>
            <span className="text-sm font-bold text-zinc-100">{agent.activeChats} / {agent.maxChats}</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(capacityPct, 100)}%` }}
            />
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard icon={Clock} label="Tiempo resp. prom." value={
            agent.avgResponseTime ? `${Math.round(agent.avgResponseTime / 60)}m` : '—'
          } />
          <MetricCard icon={CheckCircle2} label="Resueltos hoy" value={agent.resolvedToday ?? '—'} />
        </div>

        {/* Active sessions */}
        <div>
          <h4 className="text-xs font-bold uppercase text-zinc-500 mb-2 flex items-center gap-1.5">
            <MessageCircle className="w-3 h-3" />
            Chats asignados ({agent.sessions?.length || 0})
          </h4>
          {!agent.sessions?.length ? (
            <p className="text-xs text-zinc-600 py-3 text-center">Sin chats activos</p>
          ) : (
            <div className="space-y-2">
              {agent.sessions.map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onViewChat={() => onOpenChat?.(s.id)}
                  onTakeOver={() => run(`take_${s.id}`, () => supervisorService.takeOverChat(s.id))}
                  onUnassign={() => run(`unassign_${s.id}`, () => supervisorService.unassignSession(s.id))}
                  loading={busy(`take_${s.id}`) || busy(`unassign_${s.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bulk actions */}
        <div className="border-t border-zinc-800 pt-4 space-y-2">
          <h4 className="text-xs font-bold uppercase text-zinc-500 mb-3">Acciones masivas</h4>

          <ActionButton
            icon={PhoneForwarded}
            label="Tomar todos los chats"
            color="text-orange-400 hover:bg-orange-500/10 border-orange-500/20"
            onClick={handleTakeAllChats}
            disabled={!agent.sessions?.length || !!loadingAction}
          />

          <ActionButton
            icon={RotateCcw}
            label="Devolver todos a la cola"
            color="text-amber-400 hover:bg-amber-500/10 border-amber-500/20"
            onClick={handleUnassignAll}
            disabled={!agent.sessions?.length || !!loadingAction}
          />

          <ActionButton
            icon={LogOut}
            label="Forzar logout del agente"
            color="text-red-400 hover:bg-red-500/10 border-red-500/20"
            onClick={handleForceLogout}
            disabled={agent.status === 'offline' || !!loadingAction}
            loading={busy('force_logout')}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className="text-lg font-bold text-zinc-50">{value}</div>
    </div>
  );
}

function SessionRow({
  session,
  onViewChat,
  onTakeOver,
  onUnassign,
  loading,
}: {
  session: AgentOverview['sessions'][0];
  onViewChat: () => void;
  onTakeOver: () => void;
  onUnassign: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const clientName = session.user.firstName || session.user.username || 'Cliente';

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-zinc-800/50 transition-colors text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
            {clientName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-100 truncate">{clientName}</p>
            {session.lastMessage && (
              <p className="text-[10px] text-zinc-500 truncate">{session.lastMessage}</p>
            )}
          </div>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-zinc-600 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-zinc-800 px-3 py-2 flex flex-wrap gap-2">
          <MiniBtn onClick={onViewChat} label="Ver chat" color="text-blue-400 hover:bg-blue-500/10" />
          <MiniBtn onClick={onTakeOver} label="Tomar control" color="text-orange-400 hover:bg-orange-500/10" disabled={loading} />
          <MiniBtn onClick={onUnassign} label="Desasignar" color="text-zinc-400 hover:bg-zinc-700" disabled={loading} />
        </div>
      )}
    </div>
  );
}

function MiniBtn({ onClick, label, color, disabled }: { onClick: () => void; label: string; color: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors border border-transparent ${color} disabled:opacity-40`}
    >
      {label}
    </button>
  );
}

function ActionButton({
  icon: Icon,
  label,
  color,
  onClick,
  disabled,
  loading,
}: {
  icon: any;
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border bg-transparent transition-colors text-sm font-medium disabled:opacity-40 ${color}`}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {label}
    </button>
  );
}

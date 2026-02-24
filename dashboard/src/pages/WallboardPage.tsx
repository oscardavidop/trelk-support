/**
 * WallboardPage - Live Supervisor Wallboard
 * Style: zinc-950 + purple accent matching the rest of the admin dashboard.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  getAllPresences, getTeamSummary, exportPresenceReport,
  forceAgentState, setAgentMaxChats,
  type AgentPresence, type AgentTimeStats, getAuxiliaryStates, type AuxiliaryState,
} from '../services/presence.service';
import { useSocket } from '../hooks/useSocket';
import { formatLiveTime } from '../stores/presenceStore';
import {
  Monitor, RefreshCw, Download, Users, MessageCircle,
  Clock, Activity, ChevronDown, MoreVertical, AlertTriangle,
  Search, Filter, X,
} from 'lucide-react';

// ─── Date presets ─────────────────────────────────────────────────────────────

const todayRange = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return { from: d.toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] };
};
const yesterday = () => {
  const d = new Date(); d.setDate(d.getDate() - 1);
  const s = d.toISOString().split('T')[0]; return { from: s, to: s };
};
const thisWeek = () => {
  const d = new Date(); const day = d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return { from: mon.toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] };
};
const thisMonth = () => {
  const d = new Date();
  return { from: new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] };
};

const DATE_PRESETS = [
  { label: 'Hoy', fn: todayRange },
  { label: 'Ayer', fn: yesterday },
  { label: 'Esta semana', fn: thisWeek },
  { label: 'Este mes', fn: thisMonth },
];

// ─── State category helper ────────────────────────────────────────────────────

type Category = 'available' | 'busy' | 'break' | 'offline';

function getCategory(stateCode: string, auxStates: AuxiliaryState[]): Category {
  if (!stateCode || stateCode === 'offline') return 'offline';
  if (stateCode === 'available') return 'available';
  if (stateCode === 'busy') return 'busy';
  const aux = auxStates.find(s => s.code === stateCode);
  if (!aux) return 'offline';
  return aux.receivesChats ? 'available' : 'break';
}

// ─── Live timer ───────────────────────────────────────────────────────────────

function useLiveTimer(changedAt: string | null) {
  const [s, setS] = useState(() => changedAt ? Math.floor((Date.now() - new Date(changedAt).getTime()) / 1000) : 0);
  useEffect(() => {
    const base = changedAt ? new Date(changedAt).getTime() : Date.now();
    const id = setInterval(() => setS(Math.floor((Date.now() - base) / 1000)), 1000);
    return () => clearInterval(id);
  }, [changedAt]);
  return s;
}

// ─── Agent row (left panel list) ─────────────────────────────────────────────

const AgentRow: React.FC<{
  agent: AgentPresence;
  auxStates: AuxiliaryState[];
  isSelected: boolean;
  onSelect: () => void;
  onForceState: (code: string) => void;
  onSetMaxChats: (n: number) => void;
}> = ({ agent, auxStates, isSelected, onSelect, onForceState, onSetMaxChats }) => {
  const seconds = useLiveTimer(agent.changedAt ?? null);
  const state = auxStates.find(s => s.code === agent.stateCode);
  const dotColor = agent.color || state?.color || '#52525b';
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isIdle = agent.stateCode === 'available' && seconds > 15 * 60;
  const capPct = agent.maxChats > 0 ? Math.round((agent.activeChats / agent.maxChats) * 100) : 0;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div
      onClick={onSelect}
      className={`group w-full text-left p-3 rounded-xl border cursor-pointer transition-all ${
        isSelected
          ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.1)]'
          : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-900"
              style={{ backgroundColor: dotColor }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-zinc-50 truncate">{agent.name}</p>
              {isIdle && <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />}
            </div>
            <p className="text-[10px] truncate font-medium" style={{ color: dotColor }}>
              {state?.label || agent.stateCode}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <p className="text-sm font-bold text-zinc-50">{agent.activeChats}</p>
            <p className="text-[10px] text-zinc-500 font-mono">{formatLiveTime(seconds)}</p>
          </div>
          <div ref={menuRef} className="relative" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowMenu(v => !v)}
              className="p-1 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-7 w-44 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-30 overflow-hidden">
                <div className="p-1 border-b border-zinc-800">
                  <p className="px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase">Forzar estado</p>
                  {[
                    { code: 'available', label: 'Disponible', color: '#22c55e' },
                    { code: 'break', label: 'Descanso', color: '#eab308' },
                    { code: 'offline', label: 'Offline', color: '#52525b' },
                  ].map(s => (
                    <button key={s.code} onClick={() => { onForceState(s.code); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="p-1">
                  <p className="px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase">Cap. chats</p>
                  <div className="flex gap-1 px-2 py-1 flex-wrap">
                    {[1, 2, 3, 5].map(n => (
                      <button key={n} onClick={() => { onSetMaxChats(n); setShowMenu(false); }}
                        className={`w-7 h-7 rounded-lg text-xs font-bold border transition-colors ${
                          agent.maxChats === n ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                        }`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(capPct, 100)}%`,
            backgroundColor: capPct >= 90 ? '#ef4444' : capPct >= 70 ? '#f97316' : dotColor,
          }}
        />
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WallboardPage() {
  const { socket } = useSocket();

  const [presences, setPresences] = useState<AgentPresence[]>([]);
  const [auxStates, setAuxStates] = useState<AuxiliaryState[]>([]);
  const [teamStats, setTeamStats] = useState<AgentTimeStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Category | 'all'>('all');

  // Date range
  const [activePreset, setActivePreset] = useState('Hoy');
  const [dateRange, setDateRange] = useState(todayRange());
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Dedup agents by agentId
  const dedup = useCallback((list: AgentPresence[]): AgentPresence[] => {
    const seen = new Set<string>();
    return list.filter(p => { if (seen.has(p.agentId)) return false; seen.add(p.agentId); return true; });
  }, []);

  // Live counts from presence data (all, not filtered)
  const counts = useMemo(() => {
    return presences.reduce(
      (acc, p) => {
        acc.total++;
        const cat = getCategory(p.stateCode, auxStates);
        acc[cat]++;
        return acc;
      },
      { total: 0, available: 0, busy: 0, break: 0, offline: 0 }
    );
  }, [presences, auxStates]);

  const totalActiveChats = useMemo(() => presences.reduce((a, p) => a + p.activeChats, 0), [presences]);

  // Filtered + sorted presences
  const filteredPresences = useMemo(() => {
    let list = [...presences];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.stateCode.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(p => getCategory(p.stateCode, auxStates) === statusFilter);
    }

    // Sort: available > busy > break > offline
    const catOrder: Category[] = ['available', 'busy', 'break', 'offline'];
    list.sort((a, b) =>
      catOrder.indexOf(getCategory(a.stateCode, auxStates)) - catOrder.indexOf(getCategory(b.stateCode, auxStates))
    );

    return list;
  }, [presences, auxStates, searchQuery, statusFilter]);

  // Filtered teamStats for productivity table
  const filteredStats = useMemo(() => {
    if (!searchQuery.trim()) return teamStats;
    const q = searchQuery.toLowerCase();
    return teamStats.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  }, [teamStats, searchQuery]);

  const loadLive = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const [p, s] = await Promise.all([getAllPresences(), getAuxiliaryStates()]);
      setPresences(dedup(p));
      setAuxStates(s);
      setLastRefresh(new Date());
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, [dedup]);

  const loadStats = useCallback(async (range: { from: string; to: string }) => {
    try {
      const t = await getTeamSummary(range.from, range.to);
      setTeamStats(t);
    } catch { setTeamStats([]); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadLive(true), loadStats(dateRange)]);
      setLoading(false);
    })();
    const id = setInterval(() => loadLive(true), 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close date picker on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Socket updates
  useEffect(() => {
    if (!socket) return;
    const onState = (data: { agentId: string; stateCode: string; color: string; changedAt: string }) => {
      setPresences(prev => dedup(prev.map(p =>
        p.agentId === data.agentId
          ? { ...p, stateCode: data.stateCode, color: data.color, changedAt: data.changedAt }
          : p
      )));
    };
    const onCap = (data: { agentId: string; maxChats: number }) => {
      setPresences(prev => prev.map(p => p.agentId === data.agentId ? { ...p, maxChats: data.maxChats } : p));
    };
    socket.on('agent:state_changed', onState);
    socket.on('agent:capacity_changed', onCap);
    return () => { socket.off('agent:state_changed', onState); socket.off('agent:capacity_changed', onCap); };
  }, [socket, dedup]);

  const applyPreset = async (preset: typeof DATE_PRESETS[number]) => {
    const range = preset.fn();
    setActivePreset(preset.label);
    setDateRange(range);
    setShowCustom(false);
    setShowDatePicker(false);
    await loadStats(range);
  };

  const applyCustom = async () => {
    if (!customFrom || !customTo) return;
    const range = { from: customFrom, to: customTo };
    setActivePreset('');
    setDateRange(range);
    setShowCustom(false);
    setShowDatePicker(false);
    await loadStats(range);
  };

  const handleForceState = async (agentId: string, code: string) => {
    await forceAgentState(agentId, code).catch(() => {});
  };

  const handleSetMaxChats = async (agentId: string, n: number) => {
    await setAgentMaxChats(agentId, n).catch(() => {});
    setPresences(prev => prev.map(p => p.agentId === agentId ? { ...p, maxChats: n } : p));
  };

  const handleExport = async () => {
    setExporting(true);
    await exportPresenceReport(undefined, dateRange.from, dateRange.to).catch(() => {});
    setExporting(false);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadLive(true), loadStats(dateRange)]);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-purple-500/30">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">

        {/* ── Header ── */}
        <div className="px-8 py-6 pb-4 border-b border-zinc-800/50">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-purple-900/10">
                <Monitor className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Wallboard en Vivo</h1>
                <p className="text-sm text-zinc-400">
                  Última actualización: {lastRefresh.toLocaleTimeString('es')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleRefresh} disabled={refreshing}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-50 transition-all flex items-center gap-2 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
                <span className="text-sm font-medium">Actualizar</span>
              </button>
              <button onClick={handleExport} disabled={exporting}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-50 transition-all flex items-center gap-2 disabled:opacity-50">
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">{exporting ? 'Exportando…' : 'Exportar Excel'}</span>
              </button>
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-1 p-1.5 bg-zinc-900/60 border border-white/5 rounded-2xl w-fit overflow-x-auto">
            <StatBadge icon={Users}         value={counts.total}       label="Total"        color="text-zinc-300"   bg="bg-zinc-700/30" />
            <Sep />
            <StatBadge icon={Activity}      value={counts.available}   label="Disponibles"  color="text-emerald-400" bg="bg-emerald-500/10" />
            <Sep />
            <StatBadge icon={MessageCircle} value={counts.busy}        label="Ocupados"     color="text-orange-400"  bg="bg-orange-500/10" />
            <Sep />
            <StatBadge icon={Clock}         value={counts.break}       label="Descanso"     color="text-amber-400"  bg="bg-amber-500/10" />
            <Sep />
            <StatBadge icon={Users}         value={counts.offline}     label="Offline"      color="text-zinc-500"   bg="bg-zinc-700/20" />
            <Sep />
            <StatBadge icon={MessageCircle} value={totalActiveChats}   label="Chats activos" color="text-purple-400" bg="bg-purple-500/10" />
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left: agent list */}
          <div className="w-80 xl:w-96 border-r border-zinc-800 flex flex-col bg-zinc-900/20 shrink-0">
            <div className="px-3 py-3 border-b border-zinc-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Agentes
                </p>
                <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                  {filteredPresences.length}/{presences.length}
                </span>
              </div>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Buscar agente..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-all"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status filter pills */}
              <div className="flex items-center gap-1 flex-wrap">
                {([
                  { key: 'all' as const, label: 'Todos', color: 'text-zinc-400' },
                  { key: 'available' as const, label: 'Disp.', color: 'text-emerald-400' },
                  { key: 'busy' as const, label: 'Ocup.', color: 'text-orange-400' },
                  { key: 'break' as const, label: 'Break', color: 'text-amber-400' },
                  { key: 'offline' as const, label: 'Off', color: 'text-zinc-500' },
                ]).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${
                      statusFilter === f.key
                        ? `${f.color} bg-zinc-800 border border-zinc-700`
                        : 'text-zinc-600 hover:text-zinc-400 border border-transparent'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {filteredPresences.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 opacity-60">
                  <Users className="w-10 h-10 mb-2 stroke-1" />
                  <p className="text-sm font-medium">
                    {searchQuery || statusFilter !== 'all' ? 'Sin resultados' : 'Sin agentes'}
                  </p>
                </div>
              )}
              {filteredPresences.map(agent => (
                <AgentRow
                  key={agent.agentId}
                  agent={agent}
                  auxStates={auxStates}
                  isSelected={selectedAgentId === agent.agentId}
                  onSelect={() => setSelectedAgentId(prev => prev === agent.agentId ? null : agent.agentId)}
                  onForceState={code => handleForceState(agent.agentId, code)}
                  onSetMaxChats={n => handleSetMaxChats(agent.agentId, n)}
                />
              ))}
            </div>
          </div>

          {/* Right: productivity & detail */}
          <div className="flex-1 flex flex-col bg-zinc-950/80 overflow-hidden">
            {selectedAgentId ? (
              <AgentDetail
                agent={presences.find(p => p.agentId === selectedAgentId) ?? null}
                auxStates={auxStates}
                stats={teamStats.find(s => s.agentId === selectedAgentId) ?? null}
                onClose={() => setSelectedAgentId(null)}
              />
            ) : (
              /* Productivity table */
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="flex items-center gap-3 mb-5 flex-wrap">
                  <h2 className="text-base font-bold text-zinc-200">Productividad</h2>

                  {/* Date picker */}
                  <div className="relative ml-2" ref={datePickerRef}>
                    <button
                      onClick={() => setShowDatePicker(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 text-purple-400" />
                      {activePreset || `${dateRange.from} → ${dateRange.to}`}
                      <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${showDatePicker ? 'rotate-180' : ''}`} />
                    </button>
                    {showDatePicker && (
                      <div className="absolute left-0 top-10 z-20 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-2 w-56">
                        {DATE_PRESETS.map(p => (
                          <button key={p.label} onClick={() => applyPreset(p)}
                            className={`w-full text-left px-3 py-2 text-sm rounded-xl transition-colors ${
                              activePreset === p.label
                                ? 'bg-purple-500/20 text-purple-300'
                                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                            }`}>
                            {p.label}
                          </button>
                        ))}
                        <div className="border-t border-zinc-800 mt-1 pt-1">
                          <button onClick={() => setShowCustom(v => !v)}
                            className="w-full text-left px-3 py-2 text-sm rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors">
                            Rango personalizado…
                          </button>
                          {showCustom && (
                            <div className="px-2 pt-1 pb-2 space-y-2">
                              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                                className="w-full text-xs bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-purple-500" />
                              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                                className="w-full text-xs bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-200 focus:outline-none focus:border-purple-500" />
                              <button onClick={applyCustom}
                                className="w-full py-1.5 text-xs font-bold rounded-lg bg-purple-600/30 text-purple-300 hover:bg-purple-600/50 border border-purple-500/20 transition-colors">
                                Aplicar
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-xs text-zinc-600 ml-auto">
                    {dateRange.from === dateRange.to ? dateRange.from : `${dateRange.from} — ${dateRange.to}`}
                  </span>
                </div>

                {filteredStats.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
                    <Activity className="w-12 h-12 mb-3 stroke-1" />
                    <p className="text-sm font-medium">Sin datos para el período</p>
                    <p className="text-xs mt-1">Los datos aparecen cuando los agentes cambian estado</p>
                  </div>
                ) : (
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800 bg-zinc-900/70">
                          {['Agente', 'Disponible', 'Ocupado', 'Descanso', 'Offline', 'Total', 'Utilización', 'Desconex.'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStats.map(s => {
                          const util = s.utilizationPct;
                          return (
                            <tr
                              key={s.agentId}
                              className={`border-b border-zinc-800/60 transition-colors cursor-pointer ${
                                selectedAgentId === s.agentId
                                  ? 'bg-purple-500/10'
                                  : 'hover:bg-zinc-800/30'
                              }`}
                              onClick={() => setSelectedAgentId(prev => prev === s.agentId ? null : s.agentId)}
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium text-zinc-100">{s.name}</div>
                                <div className="text-xs text-zinc-500">{s.email}</div>
                              </td>
                              <td className="px-4 py-3 text-emerald-400 text-xs font-medium tabular-nums">
                                {s.byState['available']?.durationHuman || <Dash />}
                              </td>
                              <td className="px-4 py-3 text-orange-400 text-xs font-medium tabular-nums">
                                {s.byState['busy']?.durationHuman || <Dash />}
                              </td>
                              <td className="px-4 py-3 text-amber-400 text-xs font-medium tabular-nums">
                                {s.byState['break']?.durationHuman || <Dash />}
                              </td>
                              <td className="px-4 py-3 text-zinc-500 text-xs font-medium tabular-nums">
                                {s.byState['offline']?.durationHuman || <Dash />}
                              </td>
                              <td className="px-4 py-3 text-zinc-300 text-xs font-medium tabular-nums">
                                {s.totalLoggedMs > 0 ? formatMs(s.totalLoggedMs) : <Dash />}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${util >= 80 ? 'bg-emerald-500' : util >= 50 ? 'bg-amber-500' : 'bg-zinc-600'}`}
                                      style={{ width: `${util}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-zinc-400 tabular-nums">{util}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium tabular-nums ${s.unexpectedDisconnects > 3 ? 'text-red-400' : 'text-zinc-500'}`}>
                                  {s.unexpectedDisconnects}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Agent detail right panel ─────────────────────────────────────────────────

const AgentDetail: React.FC<{
  agent: AgentPresence | null;
  auxStates: AuxiliaryState[];
  stats: AgentTimeStats | null;
  onClose: () => void;
}> = ({ agent, auxStates, stats, onClose }) => {
  const seconds = useLiveTimer(agent?.changedAt ?? null);
  if (!agent) return null;
  const state = auxStates.find(s => s.code === agent.stateCode);
  const dotColor = agent.color || state?.color || '#52525b';

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl font-bold text-zinc-200">
              {agent.name.charAt(0).toUpperCase()}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-zinc-950"
              style={{ backgroundColor: dotColor }} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-50">{agent.name}</h3>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium" style={{ color: dotColor }}>{state?.label || agent.stateCode}</span>
              <span className="text-zinc-500">•</span>
              <span className="font-mono text-zinc-400">{formatLiveTime(seconds)}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-sm">
          ✕
        </button>
      </div>

      {/* Capacity */}
      <div className="mb-5 p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl">
        <div className="flex justify-between text-xs text-zinc-400 mb-2">
          <span>Chats activos</span>
          <span className="font-mono font-bold text-zinc-200">{agent.activeChats} / {agent.maxChats}</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (agent.activeChats / Math.max(1, agent.maxChats)) * 100)}%`,
              backgroundColor: dotColor,
            }}
          />
        </div>
      </div>

      {/* Period stats */}
      {stats ? (
        <div>
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">Resumen del período</h4>
          <div className="space-y-2">
            {Object.entries(stats.byState).map(([code, data]) => (
              <div key={code} className="flex items-center gap-3 p-2.5 bg-zinc-900/40 rounded-xl border border-zinc-800">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: (data as { color: string }).color }} />
                <span className="text-xs text-zinc-400 flex-1">{(data as { label: string }).label}</span>
                <span className="text-xs font-mono font-bold text-zinc-200">{(data as { durationHuman: string }).durationHuman}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <Activity className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="text-xs text-zinc-400 flex-1">Utilización</span>
              <span className="text-xs font-mono font-bold text-purple-300">{stats.utilizationPct}%</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 opacity-60">
          <Activity className="w-8 h-8 mb-2 stroke-1" />
          <p className="text-sm">Sin datos de productividad para el período</p>
        </div>
      )}
    </div>
  );
};

// ─── UI helpers ───────────────────────────────────────────────────────────────

function StatBadge({ icon: Icon, value, label, color, bg }: {
  icon: React.ElementType; value: number; label: string; color: string; bg: string;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl min-w-fit">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-3.5 h-3.5 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-sm ${color}`}>{value}</span>
        <span className="text-[10px] font-semibold text-zinc-500 mt-0.5">{label}</span>
      </div>
    </div>
  );
}

function Sep() {
  return <div className="h-5 w-px bg-white/[0.06] shrink-0 mx-0.5" />;
}

function Dash() {
  return <span className="text-zinc-600">—</span>;
}

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/**
 * InternalBroadcastsPage - Enterprise Internal Communications
 * Diseño consistente con PermissionsPage, SavedRepliesPage, ContactsPage
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Megaphone, Plus, AlertCircle, AlertTriangle, Info, Loader2,
  Trash2, Eye, CheckCircle2, Clock, Users, RefreshCw, BarChart3,
  Search, Radio, Pin, CheckCircle
} from 'lucide-react';
import api from '../services/api';
import { CreateBroadcastModal } from '../components/modals/CreateBroadcastModal';
import { BroadcastStatsModal } from '../components/modals/BroadcastStatsModal';

// ==================== TYPES ====================

interface Broadcast {
  _id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  targetAudience: 'all' | 'role' | 'team' | 'individual';
  targetRoles?: string[];
  requireAck: boolean;
  isPinned: boolean;
  expiresAt?: string;
  createdBy: { _id: string; name: string };
  cancelledAt?: string;
  stats?: { totalTargeted: number; delivered: number; seen: number; acknowledged: number };
  createdAt: string;
}

// ==================== CONSTANTS ====================

const LEVEL_CONFIG = {
  info: {
    icon: Info,
    label: 'Información',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  warning: {
    icon: AlertTriangle,
    label: 'Advertencia',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  critical: {
    icon: AlertCircle,
    label: 'Crítico',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badge: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
};

// ==================== STAT BADGE ====================

function StatBadge({ icon: Icon, count, label, color, bg }: { 
  icon: React.ElementType; 
  count: number; 
  label: string; 
  color: string; 
  bg: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-lg ${color}`}>{count.toLocaleString()}</span>
        <span className="text-[10px] font-bold text-zinc-500 uppercase">{label}</span>
      </div>
    </div>
  );
}

// ==================== BROADCAST CARD ====================

function BroadcastCard({ 
  broadcast, 
  onViewStats, 
  onCancel 
}: { 
  broadcast: Broadcast; 
  onViewStats: (id: string) => void; 
  onCancel: (id: string) => void;
}) {
  const config = LEVEL_CONFIG[broadcast.level];
  const Icon = config.icon;
  const isCancelled = !!broadcast.cancelledAt;
  const isExpired = broadcast.expiresAt && new Date(broadcast.expiresAt) < new Date();
  const isInactive = isCancelled || isExpired;

  return (
    <div className={`group relative bg-zinc-900/60 backdrop-blur-sm border rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-black/20 overflow-hidden flex flex-col ${
      isInactive
        ? 'border-zinc-800/50 opacity-60'
        : 'border-zinc-800 hover:border-blue-500/30'
    }`}>
      
      {/* Pinned Indicator */}
      {broadcast.isPinned && !isInactive && (
        <div className="absolute top-3 right-3 z-10">
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
        </div>
      )}

      {/* Content */}
      <div className="p-5 flex-1">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`p-2.5 rounded-xl ${config.bg} border ${config.border}`}>
            <Icon className={`w-5 h-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-zinc-100 truncate">{broadcast.title}</h3>
              {isInactive && (
                <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-500 border border-zinc-700">
                  {isCancelled ? 'Cancelado' : 'Expirado'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="text-zinc-400">{broadcast.createdBy.name}</span>
              <span>•</span>
              <span>{new Date(broadcast.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
            </div>
          </div>
        </div>

        {/* Message Preview */}
        <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50 mb-4">
          <p className="text-sm text-zinc-400 leading-relaxed line-clamp-2">
            {broadcast.message}
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase border ${config.badge}`}>
            <Icon className="w-3 h-3" />
            {config.label}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
            <Users className="w-3 h-3" />
            {broadcast.targetAudience === 'all' ? 'Todos' : broadcast.targetRoles?.join(', ') || 'Roles'}
          </span>
          {broadcast.requireAck && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <CheckCircle2 className="w-3 h-3" />
              Firma
            </span>
          )}
          {broadcast.isPinned && !isInactive && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Pin className="w-3 h-3" />
              Fijado
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-zinc-800/50 bg-zinc-900/30 flex items-center justify-between">
        {/* Mini Stats */}
        {broadcast.stats ? (
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-zinc-300 font-medium">{broadcast.stats.totalTargeted}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-400 font-medium">{broadcast.stats.seen}</span>
            </div>
            {broadcast.requireAck && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">{broadcast.stats.acknowledged}</span>
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-zinc-600">Sin stats</span>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onViewStats(broadcast._id)}
            className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
            title="Ver estadísticas"
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          {!isInactive && (
            <button
              onClick={() => onCancel(broadcast._id)}
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Cancelar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================

export default function InternalBroadcastsPage() {
  // Data state
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warning' | 'critical'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled' | 'expired'>('active');

  // ==================== API ====================

  const fetchBroadcasts = useCallback(async () => {
    try {
      const { data } = await api.get<{ ok: boolean; broadcasts: Broadcast[]; error?: string }>('/api/internal-broadcasts');
      if (data.ok) {
        setBroadcasts(data.broadcasts);
        setError(null);
      } else {
        setError(data.error || 'Error al cargar');
      }
    } catch {
      setError('Error de conexión');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await fetchBroadcasts();
      setIsLoading(false);
    };
    init();
  }, [fetchBroadcasts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBroadcasts();
    setIsRefreshing(false);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('¿Cancelar este anuncio? Los agentes ya no lo verán.')) return;
    try {
      await api.post(`/api/internal-broadcasts/${id}/cancel`, {});
      fetchBroadcasts();
    } catch {
      alert('Error al cancelar');
    }
  };

  const handleViewStats = (id: string) => {
    setSelectedBroadcastId(id);
    setShowStatsModal(true);
  };

  // ==================== FILTERS ====================

  const filteredBroadcasts = useMemo(() => {
    return broadcasts.filter(b => {
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!b.title.toLowerCase().includes(q) && !b.message.toLowerCase().includes(q)) {
          return false;
        }
      }

      // Level filter
      if (levelFilter !== 'all' && b.level !== levelFilter) return false;

      // Status filter
      const isCancelled = !!b.cancelledAt;
      const isExpired = b.expiresAt && new Date(b.expiresAt) < new Date();
      
      if (statusFilter === 'active') return !isCancelled && !isExpired;
      if (statusFilter === 'cancelled') return isCancelled;
      if (statusFilter === 'expired') return isExpired && !isCancelled;
      
      return true;
    });
  }, [broadcasts, searchQuery, levelFilter, statusFilter]);

  // ==================== STATS ====================

  const stats = useMemo(() => {
    const total = broadcasts.length;
    const active = broadcasts.filter(b => !b.cancelledAt && (!b.expiresAt || new Date(b.expiresAt) > new Date())).length;
    const critical = broadcasts.filter(b => b.level === 'critical' && !b.cancelledAt).length;
    const pending = broadcasts.filter(b => b.requireAck && !b.cancelledAt && (b.stats?.acknowledged || 0) < (b.stats?.totalTargeted || 1)).length;
    return { total, active, critical, pending };
  }, [broadcasts]);

  // ==================== RENDER ====================

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-zinc-950">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-blue-500/30">
      
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        
        {/* Header Section */}
        <div className="px-8 py-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-blue-900/10">
                <Megaphone className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Centro de Anuncios</h1>
                <p className="text-sm text-zinc-400">Comunicaciones internas para tu equipo</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
              </button>
              
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                <span>Nuevo Anuncio</span>
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6">
            <StatBadge icon={Megaphone} count={stats.total} label="Total" color="text-zinc-200" bg="bg-zinc-800" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Radio} count={stats.active} label="Activos" color="text-blue-400" bg="bg-blue-500/10" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={AlertCircle} count={stats.critical} label="Críticos" color="text-red-400" bg="bg-red-500/10" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Clock} count={stats.pending} label="Sin firmar" color="text-amber-400" bg="bg-amber-500/10" />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[280px] max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título o mensaje..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              />
            </div>

            {/* Level Filter */}
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
              className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 cursor-pointer"
            >
              <option value="all">Todos los niveles</option>
              <option value="info">Info</option>
              <option value="warning">Advertencia</option>
              <option value="critical">Crítico</option>
            </select>

            {/* Status Filter */}
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              {(['active', 'all', 'cancelled', 'expired'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {status === 'active' ? 'Activos' : status === 'all' ? 'Todos' : status === 'cancelled' ? 'Cancelados' : 'Expirados'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 custom-scrollbar">
          {error ? (
            <div className="flex flex-col items-center justify-center py-20">
              <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
              <p className="text-lg font-medium text-red-400">{error}</p>
              <button onClick={handleRefresh} className="mt-4 text-sm text-blue-400 hover:underline">
                Reintentar
              </button>
            </div>
          ) : filteredBroadcasts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
              <Megaphone className="w-16 h-16 mb-4 stroke-1" />
              <p className="text-lg font-medium">No se encontraron anuncios</p>
              <p className="text-sm mt-1">Crea uno nuevo para comunicarte con tu equipo</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredBroadcasts.map((broadcast) => (
                <BroadcastCard
                  key={broadcast._id}
                  broadcast={broadcast}
                  onViewStats={handleViewStats}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateBroadcastModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchBroadcasts}
      />

      <BroadcastStatsModal
        isOpen={showStatsModal}
        onClose={() => { setShowStatsModal(false); setSelectedBroadcastId(null); }}
        broadcastId={selectedBroadcastId}
      />
    </div>
  );
}

export { InternalBroadcastsPage };

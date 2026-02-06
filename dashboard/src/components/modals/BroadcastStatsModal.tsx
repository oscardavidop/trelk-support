/**
 * BroadcastStatsModal - Detailed Statistics for Internal Broadcasts
 * Premium Zinc Design
 */

import React, { useState, useEffect } from 'react';
import {
  X, BarChart3, Users, Eye, CheckCircle2, Clock, Loader2,
  AlertCircle, AlertTriangle, Info, User, Check
} from 'lucide-react';
import api from '../../services/api';

// ============= TYPES =============

interface BroadcastReceipt {
  _id: string;
  agentId: {
    _id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  deliveredAt?: string;
  seenAt?: string;
  acknowledgedAt?: string;
}

interface BroadcastDetail {
  _id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  requireAck: boolean;
  isPinned: boolean;
  createdBy: { _id: string; name: string };
  createdAt: string;
  expiresAt?: string;
  cancelledAt?: string;
  stats: {
    totalTargeted: number;
    delivered: number;
    seen: number;
    acknowledged: number;
  };
  receipts: BroadcastReceipt[];
}

interface BroadcastStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  broadcastId: string | null;
}

// ============= LEVEL CONFIG =============

const LEVEL_CONFIG = {
  info: {
    icon: Info,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  critical: {
    icon: AlertCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
};

// ============= COMPONENT =============

export const BroadcastStatsModal: React.FC<BroadcastStatsModalProps> = ({
  isOpen,
  onClose,
  broadcastId,
}) => {
  const [loading, setLoading] = useState(true);
  const [broadcast, setBroadcast] = useState<BroadcastDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'seen' | 'acknowledged' | 'pending'>('all');

  // Fetch broadcast details
  useEffect(() => {
    if (!isOpen || !broadcastId) return;

    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await api.get<{ ok: boolean; broadcast: BroadcastDetail; error?: string }>(
          `/api/internal-broadcasts/${broadcastId}/stats`
        );
        if (data.ok) {
          setBroadcast(data.broadcast);
        } else {
          setError(data.error || 'Error al cargar estadísticas');
        }
      } catch {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [isOpen, broadcastId]);

  if (!isOpen) return null;

  const levelConfig = broadcast ? LEVEL_CONFIG[broadcast.level] : LEVEL_CONFIG.info;
  const LevelIcon = levelConfig.icon;

  // Filter receipts
  const filteredReceipts = broadcast?.receipts.filter(r => {
    if (filter === 'seen') return r.seenAt && !r.acknowledgedAt;
    if (filter === 'acknowledged') return r.acknowledgedAt;
    if (filter === 'pending') return !r.seenAt;
    return true;
  }) || [];

  // Calculate percentages
  const seenPercent = broadcast?.stats ? Math.round((broadcast.stats.seen / broadcast.stats.totalTargeted) * 100) : 0;
  const ackPercent = broadcast?.stats && broadcast.requireAck 
    ? Math.round((broadcast.stats.acknowledged / broadcast.stats.totalTargeted) * 100) 
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-zinc-900 rounded-xl border border-zinc-800">
                <BarChart3 className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Estadísticas del Anuncio</h2>
                <p className="text-xs text-zinc-500">Seguimiento de alcance y engagement</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-zinc-500">Cargando estadísticas...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          ) : broadcast ? (
            <div className="p-5 space-y-6">
              
              {/* Broadcast Info Card */}
              <div className={`p-4 rounded-xl border ${levelConfig.bg} ${levelConfig.border}`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl border ${levelConfig.bg} ${levelConfig.border}`}>
                    <LevelIcon className={`w-6 h-6 ${levelConfig.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-zinc-100 mb-1">{broadcast.title}</h3>
                    <p className="text-sm text-zinc-400 line-clamp-2">{broadcast.message}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
                      <span>Por: <span className="text-zinc-400">{broadcast.createdBy.name}</span></span>
                      <span>•</span>
                      <span>{new Date(broadcast.createdAt).toLocaleDateString('es-ES', { 
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                      })}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs text-zinc-500 uppercase font-bold">Total</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{broadcast.stats.totalTargeted}</p>
                </div>

                <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-zinc-500 uppercase font-bold">Vistos</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-400">{broadcast.stats.seen}</p>
                  <p className="text-xs text-zinc-600 mt-1">{seenPercent}% alcance</p>
                </div>

                {broadcast.requireAck && (
                  <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs text-zinc-500 uppercase font-bold">Firmados</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-400">{broadcast.stats.acknowledged}</p>
                    <p className="text-xs text-zinc-600 mt-1">{ackPercent}% completado</p>
                  </div>
                )}

                <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-zinc-500 uppercase font-bold">Pendientes</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-400">
                    {broadcast.stats.totalTargeted - broadcast.stats.seen}
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Progreso de visualización</span>
                  <span className="text-zinc-400 font-bold">{seenPercent}%</span>
                </div>
                <div className="h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${seenPercent}%` }}
                  />
                </div>
              </div>

              {/* Receipts List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-zinc-300">Destinatarios</h4>
                  
                  {/* Filter Tabs */}
                  <div className="flex p-1 bg-zinc-900 rounded-lg border border-zinc-800">
                    {(['all', 'seen', 'acknowledged', 'pending'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${
                          filter === f 
                            ? 'bg-zinc-800 text-white' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {f === 'all' ? 'Todos' : f === 'seen' ? 'Vistos' : f === 'acknowledged' ? 'Firmados' : 'Pendientes'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recipients */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredReceipts.length === 0 ? (
                    <div className="text-center py-8 text-zinc-600 text-sm">
                      No hay destinatarios en esta categoría
                    </div>
                  ) : (
                    filteredReceipts.map(receipt => (
                      <div 
                        key={receipt._id}
                        className="flex items-center justify-between p-3 bg-zinc-900/30 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
                            {receipt.agentId.avatar ? (
                              <img src={receipt.agentId.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-zinc-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">{receipt.agentId.name}</p>
                            {receipt.agentId.email && (
                              <p className="text-xs text-zinc-600">{receipt.agentId.email}</p>
                            )}
                          </div>
                        </div>

                        {/* Status Indicators */}
                        <div className="flex items-center gap-2">
                          {receipt.acknowledgedAt ? (
                            <span className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[10px] font-bold uppercase">
                              <Check className="w-3 h-3" /> Firmado
                            </span>
                          ) : receipt.seenAt ? (
                            <span className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-[10px] font-bold uppercase">
                              <Eye className="w-3 h-3" /> Visto
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-500 text-[10px] font-bold uppercase">
                              <Clock className="w-3 h-3" /> Pendiente
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default BroadcastStatsModal;

/**
 * Internal Broadcasts Page
 * Admin page for managing broadcast announcements
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Plus,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  Send,
  Loader2,
  Trash2,
  Eye,
  CheckCircle,
  Clock,
  Pin,
  Users,
  RefreshCw,
} from 'lucide-react';
import api from '../services/api';

// ============= TYPES =============

interface Broadcast {
  _id: string;
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  targetAudience: 'all' | 'role' | 'team' | 'individual';
  targetRoles?: string[];
  targetTeams?: string[];
  targetAgents?: string[];
  requireAck: boolean;
  isPinned: boolean;
  expiresAt?: string;
  createdBy: {
    _id: string;
    name: string;
  };
  cancelledAt?: string;
  cancelledBy?: string;
  stats?: {
    totalTargeted: number;
    delivered: number;
    seen: number;
    acknowledged: number;
  };
  createdAt: string;
}

interface CreateBroadcastPayload {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'critical';
  targetAudience: 'all' | 'role' | 'team' | 'individual';
  targetRoles?: string[];
  requireAck: boolean;
  isPinned: boolean;
  expiresAt?: string;
}

// ============= LEVEL STYLES =============

const levelStyles: Record<Broadcast['level'], {
  bg: string;
  border: string;
  badge: string;
  icon: React.ElementType;
}> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
    icon: Info,
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
    icon: AlertTriangle,
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    icon: AlertCircle,
  },
};

// ============= BROADCAST CARD =============

interface BroadcastCardProps {
  broadcast: Broadcast;
  onViewStats: (id: string) => void;
  onCancel: (id: string) => void;
}

const BroadcastCard: React.FC<BroadcastCardProps> = ({ broadcast, onViewStats, onCancel }) => {
  const styles = levelStyles[broadcast.level];
  const Icon = styles.icon;
  const isCancelled = !!broadcast.cancelledAt;
  const isExpired = broadcast.expiresAt && new Date(broadcast.expiresAt) < new Date();

  return (
    <div
      className={`
        relative border rounded-lg overflow-hidden transition-all
        ${isCancelled || isExpired ? 'opacity-60' : ''}
        ${styles.bg} ${styles.border}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-200/50 dark:border-gray-700/50">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${styles.badge}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {broadcast.title}
              </h3>
              {broadcast.isPinned && (
                <Pin className="w-4 h-4 text-blue-500" />
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {broadcast.createdBy.name} • {new Date(broadcast.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${styles.badge}`}>
            {broadcast.level.toUpperCase()}
          </span>
          {isCancelled && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Cancelado
            </span>
          )}
          {isExpired && !isCancelled && (
            <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              Expirado
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
          {broadcast.message}
        </p>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            {broadcast.targetAudience === 'all' 
              ? 'Todos los agentes' 
              : broadcast.targetAudience === 'role'
                ? `Roles: ${broadcast.targetRoles?.join(', ')}`
                : broadcast.targetAudience}
          </span>
          
          {broadcast.requireAck && (
            <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
              <CheckCircle className="w-4 h-4" />
              Requiere confirmación
            </span>
          )}
          
          {broadcast.expiresAt && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              Expira: {new Date(broadcast.expiresAt).toLocaleString()}
            </span>
          )}
        </div>

        {/* Stats */}
        {broadcast.stats && (
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {broadcast.stats.totalTargeted}
              </p>
              <p className="text-xs text-gray-500">Destinatarios</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {broadcast.stats.delivered}
              </p>
              <p className="text-xs text-gray-500">Entregados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {broadcast.stats.seen}
              </p>
              <p className="text-xs text-gray-500">Vistos</p>
            </div>
            {broadcast.requireAck && (
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">
                  {broadcast.stats.acknowledged}
                </p>
                <p className="text-xs text-gray-500">Confirmados</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {!isCancelled && !isExpired && (
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50">
          <button
            onClick={() => onViewStats(broadcast._id)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Eye className="w-4 h-4" />
            Ver detalles
          </button>
          <button
            onClick={() => onCancel(broadcast._id)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};

// ============= CREATE MODAL =============

interface CreateBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateBroadcastModal: React.FC<CreateBroadcastModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState<Broadcast['level']>('info');
  const [targetAudience, setTargetAudience] = useState<'all' | 'role'>('all');
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [requireAck, setRequireAck] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');

  const availableRoles = ['agent', 'supervisor', 'admin'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('📤 Submitting broadcast...', { title, message, level });

    if (!title.trim() || !message.trim()) {
      setError('Título y mensaje son requeridos');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: CreateBroadcastPayload = {
        title: title.trim(),
        message: message.trim(),
        level,
        targetAudience,
        requireAck,
        isPinned,
      };

      if (targetAudience === 'role' && targetRoles.length > 0) {
        payload.targetRoles = targetRoles;
      }

      if (hasExpiry && expiresAt) {
        payload.expiresAt = new Date(expiresAt).toISOString();
      }

      console.log('📤 Payload:', payload);

      interface CreateResponse {
        ok: boolean;
        error?: string;
      }
      
      const { data } = await api.post<CreateResponse>('/api/internal-broadcasts', payload);
      console.log('📥 Response:', data);

      if (data.ok) {
        onCreated();
        onClose();
        // Reset form
        setTitle('');
        setMessage('');
        setLevel('info');
        setTargetAudience('all');
        setTargetRoles([]);
        setRequireAck(false);
        setIsPinned(false);
        setHasExpiry(false);
        setExpiresAt('');
      } else {
        setError(data.error || 'Error al crear broadcast');
      }
    } catch (err: unknown) {
      console.error('❌ Error creating broadcast:', err);
      const errorMessage = err instanceof Error ? err.message : 'Error de conexión';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = (role: string) => {
    setTargetRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl mx-4 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Crear Nuevo Broadcast
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Título
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título del anuncio"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                maxLength={150}
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Mensaje
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Contenido del broadcast..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                required
                maxLength={2000}
              />
              <p className="mt-1 text-xs text-gray-400">{message.length}/2000</p>
            </div>

            {/* Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nivel
              </label>
              <div className="flex gap-2">
                {(['info', 'warning', 'critical'] as const).map((l) => {
                  const Icon = levelStyles[l].icon;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setLevel(l)}
                      className={`
                        flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors
                        ${level === l
                          ? levelStyles[l].badge + ' border-current'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-sm font-medium capitalize">{l}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target audience */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Audiencia
              </label>
              <div className="flex gap-4 mb-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    checked={targetAudience === 'all'}
                    onChange={() => setTargetAudience('all')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Todos los agentes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    checked={targetAudience === 'role'}
                    onChange={() => setTargetAudience('role')}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Por rol</span>
                </label>
              </div>
              
              {targetAudience === 'role' && (
                <div className="flex gap-2 mt-2">
                  {availableRoles.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`
                        px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors
                        ${targetRoles.includes(role)
                          ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }
                      `}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireAck}
                  onChange={(e) => setRequireAck(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Requiere confirmación
                  </span>
                  <p className="text-xs text-gray-500">Los agentes deben confirmar que leyeron el mensaje</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Fijar mensaje
                  </span>
                  <p className="text-xs text-gray-500">Mantiene el mensaje visible hasta que expire o se cancele</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasExpiry}
                  onChange={(e) => setHasExpiry(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Establecer expiración
                </span>
              </label>

              {hasExpiry && (
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Enviar Broadcast
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============= MAIN PAGE =============

export const InternalBroadcastsPage: React.FC = () => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'cancelled'>('all');

  // Fetch broadcasts
  const fetchBroadcasts = useCallback(async () => {
    try {
      setLoading(true);
      
      interface BroadcastsResponse {
        ok: boolean;
        broadcasts: Broadcast[];
        error?: string;
      }
      
      const { data } = await api.get<BroadcastsResponse>('/api/internal-broadcasts');
      
      if (data.ok) {
        setBroadcasts(data.broadcasts);
        setError(null);
      } else {
        setError(data.error || 'Error al cargar broadcasts');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBroadcasts();
  }, [fetchBroadcasts]);

  // Cancel broadcast
  const handleCancel = async (id: string) => {
    if (!confirm('¿Estás seguro de cancelar este broadcast?')) return;

    try {
      interface CancelResponse {
        ok: boolean;
        error?: string;
      }
      
      const { data } = await api.post<CancelResponse>(`/api/internal-broadcasts/${id}/cancel`);
      
      if (data.ok) {
        fetchBroadcasts();
      } else {
        alert(data.error || 'Error al cancelar');
      }
    } catch (err) {
      alert('Error de conexión');
    }
  };

  // View stats (TODO: implement detail modal)
  const handleViewStats = (id: string) => {
    console.log('View stats for:', id);
    // Could open a modal with detailed receipts
  };

  // Filter broadcasts
  const filteredBroadcasts = broadcasts.filter(b => {
    if (filter === 'active') {
      return !b.cancelledAt && (!b.expiresAt || new Date(b.expiresAt) > new Date());
    }
    if (filter === 'cancelled') {
      return !!b.cancelledAt;
    }
    return true;
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Megaphone className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Broadcasts Internos
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestiona anuncios y comunicados para los agentes
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBroadcasts}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Refrescar"
          >
            <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo Broadcast
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        {(['all', 'active', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              px-4 py-2 text-sm font-medium rounded-lg transition-colors
              ${filter === f
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }
            `}
          >
            {f === 'all' ? 'Todos' : f === 'active' ? 'Activos' : 'Cancelados'}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Content */}
      {loading && broadcasts.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      ) : filteredBroadcasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Megaphone className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No hay broadcasts</p>
          <p className="text-sm mt-1">Crea uno nuevo para comunicarte con los agentes</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBroadcasts.map(broadcast => (
            <BroadcastCard
              key={broadcast._id}
              broadcast={broadcast}
              onViewStats={handleViewStats}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateBroadcastModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchBroadcasts}
      />
    </div>
  );
};

export default InternalBroadcastsPage;

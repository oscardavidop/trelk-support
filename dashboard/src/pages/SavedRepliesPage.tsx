/**
 * SavedRepliesPage - Modern UI for managing quick response templates
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Copy, 
  Tag, 
  TrendingUp, 
  Zap, 
  Code, 
  Loader2,
  RefreshCw,
  Filter,
  CheckCircle,
  X,
  Sparkles,
  Clock
} from 'lucide-react';
import type { SavedReply, SavedReplyStats } from '../types';
import { PLACEHOLDERS } from '../types';

interface ReplyFormData {
  title: string;
  content: string;
  category: string;
  shortcut: string;
  isActive: boolean;
}

const initialFormData: ReplyFormData = {
  title: '',
  content: '',
  category: '',
  shortcut: '',
  isActive: true,
};

export default function SavedRepliesPage() {
  const token = useAuthStore((state) => state.token);
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState<SavedReplyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPlaceholdersModal, setShowPlaceholdersModal] = useState(false);
  const [editingReply, setEditingReply] = useState<SavedReply | null>(null);
  const [formData, setFormData] = useState<ReplyFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadReplies();
  }, []);

  const loadReplies = async () => {
    try {
      const res = await fetch('/api/admin/saved-replies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setReplies(data.replies);
        setCategories(data.categories || []);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to load saved replies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReplies();
    setRefreshing(false);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    setIsSaving(true);
    try {
      const url = editingReply 
        ? `/api/admin/saved-replies/${editingReply._id}`
        : '/api/admin/saved-replies';
      
      const res = await fetch(url, {
        method: editingReply ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          category: formData.category.trim() || undefined,
          shortcut: formData.shortcut.trim() || undefined,
        }),
      });
      const data = await res.json();
      
      if (data.ok) {
        if (editingReply) {
          setReplies(replies.map((r) => (r._id === editingReply._id ? data.reply : r)));
        } else {
          setReplies([...replies, data.reply]);
        }
        closeFormModal();
        if (formData.category && !categories.includes(formData.category)) {
          setCategories([...categories, formData.category]);
        }
      }
    } catch (error) {
      console.error('Failed to save reply:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingReply) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/saved-replies/${editingReply._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setReplies(replies.filter((r) => r._id !== editingReply._id));
        setShowDeleteModal(false);
        setEditingReply(null);
      }
    } catch (error) {
      console.error('Failed to delete reply:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const openFormModal = (reply?: SavedReply) => {
    if (reply) {
      setEditingReply(reply);
      setFormData({
        title: reply.title,
        content: reply.content,
        category: reply.category || '',
        shortcut: reply.shortcut || '',
        isActive: reply.isActive,
      });
    } else {
      setEditingReply(null);
      setFormData(initialFormData);
    }
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    setShowFormModal(false);
    setEditingReply(null);
    setFormData(initialFormData);
  };

  const openDeleteModal = (reply: SavedReply) => {
    setEditingReply(reply);
    setShowDeleteModal(true);
  };

  const copyToClipboard = (text: string, id?: string) => {
    navigator.clipboard.writeText(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Filter replies
  const filteredReplies = replies.filter((reply) => {
    const matchesSearch =
      reply.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      reply.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || reply.category === selectedCategory;
    const matchesActive = showInactive || reply.isActive;
    return matchesSearch && matchesCategory && matchesActive;
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-gray-950">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl">
            <MessageSquare className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Respuestas Guardadas</h1>
            <p className="text-sm text-gray-400">Plantillas de respuesta rápida para soporte</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowPlaceholdersModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105"
          >
            <Code className="w-4 h-4" />
            <span>Variables</span>
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all hover:scale-105 ${
              showFilters 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                : 'bg-gray-800/80 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => openFormModal()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl text-white font-medium transition-all hover:scale-105 shadow-lg shadow-blue-500/25"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Respuesta</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 p-6 border-b border-gray-800">
          <StatCard
            icon={<MessageSquare className="w-5 h-5" />}
            label="Total Respuestas"
            value={stats.totalReplies}
            color="blue"
          />
          <StatCard
            icon={<Zap className="w-5 h-5" />}
            label="Activas"
            value={stats.activeReplies}
            color="green"
          />
          <StatCard
            icon={<TrendingUp className="w-5 h-5" />}
            label="Uso Total"
            value={stats.totalUsage}
            color="purple"
          />
          <StatCard
            icon={<Tag className="w-5 h-5" />}
            label="Categorías"
            value={categories.length}
            color="yellow"
          />
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="border-b border-gray-800 px-6 py-4 bg-gray-900/50">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar respuestas..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all min-w-40"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                showInactive 
                  ? 'bg-blue-500 border-blue-500' 
                  : 'border-gray-600 group-hover:border-gray-500'
              }`}>
                {showInactive && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="hidden"
              />
              <span className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">Mostrar inactivas</span>
            </label>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {filteredReplies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <div className="p-4 bg-gray-800/50 rounded-2xl mb-4">
              <MessageSquare className="w-12 h-12 opacity-50" />
            </div>
            <p className="text-lg font-medium">No se encontraron respuestas</p>
            {searchQuery && <p className="text-sm mt-1">Intenta ajustar tu búsqueda</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredReplies.map((reply) => (
              <ReplyCard
                key={reply._id}
                reply={reply}
                onEdit={() => openFormModal(reply)}
                onDelete={() => openDeleteModal(reply)}
                onCopy={() => copyToClipboard(reply.content, reply._id)}
                isCopied={copiedId === reply._id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <FormModal
          isEditing={!!editingReply}
          formData={formData}
          setFormData={setFormData}
          categories={categories}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onClose={closeFormModal}
        />
      )}

      {/* Delete Modal */}
      {showDeleteModal && editingReply && (
        <DeleteModal
          reply={editingReply}
          isSaving={isSaving}
          onDelete={handleDelete}
          onClose={() => {
            setShowDeleteModal(false);
            setEditingReply(null);
          }}
        />
      )}

      {/* Placeholders Modal */}
      {showPlaceholdersModal && (
        <PlaceholdersModal onClose={() => setShowPlaceholdersModal(false)} />
      )}
    </div>
  );
}

// Sub-components

function StatCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'blue' | 'green' | 'purple' | 'yellow';
}) {
  const colors = {
    blue: 'from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/20',
    green: 'from-green-500/20 to-green-600/10 text-green-400 border-green-500/20',
    purple: 'from-purple-500/20 to-purple-600/10 text-purple-400 border-purple-500/20',
    yellow: 'from-yellow-500/20 to-yellow-600/10 text-yellow-400 border-yellow-500/20',
  };

  const iconColors = {
    blue: 'bg-blue-500/20',
    green: 'bg-green-500/20',
    purple: 'bg-purple-500/20',
    yellow: 'bg-yellow-500/20',
  };

  return (
    <div className={`p-4 bg-gradient-to-br ${colors[color]} rounded-xl border`}>
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${iconColors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

function ReplyCard({ 
  reply, 
  onEdit, 
  onDelete, 
  onCopy,
  isCopied
}: { 
  reply: SavedReply;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  isCopied?: boolean;
}) {
  return (
    <div className={`group p-5 bg-gray-800/40 rounded-xl border transition-all duration-200 ${
      reply.isActive 
        ? 'border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/60' 
        : 'border-gray-800/50 opacity-50'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-white truncate">{reply.title}</h3>
            {!reply.isActive && (
              <span className="px-2 py-0.5 bg-gray-700/50 text-gray-400 text-xs rounded-full">
                Inactiva
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reply.category && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-700/50 rounded-lg text-xs text-gray-400">
                <Tag className="w-3 h-3" />
                {reply.category}
              </span>
            )}
            {reply.shortcut && (
              <span className="px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-mono">
                /{reply.shortcut}
              </span>
            )}
            <span className="flex items-center gap-1 px-2.5 py-1 bg-gray-700/50 rounded-lg text-xs text-gray-500">
              <TrendingUp className="w-3 h-3" />
              {reply.usageCount || 0} usos
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onCopy}
            className={`p-2 rounded-lg transition-all ${
              isCopied 
                ? 'text-green-400 bg-green-500/10' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title="Copiar"
          >
            {isCopied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={onEdit}
            className="p-2 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
            title="Editar"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">{reply.content}</p>

      {reply.createdBy && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>Creado por {reply.createdBy.name}</span>
        </div>
      )}
    </div>
  );
}

function FormModal({
  isEditing,
  formData,
  setFormData,
  categories,
  isSaving,
  onSubmit,
  onClose,
}: {
  isEditing: boolean;
  formData: ReplyFormData;
  setFormData: (data: ReplyFormData) => void;
  categories: string[];
  isSaving: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-gray-900 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              {isEditing ? <Edit3 className="w-5 h-5 text-blue-400" /> : <Plus className="w-5 h-5 text-blue-400" />}
            </div>
            <h2 className="text-lg font-bold text-white">
              {isEditing ? 'Editar Respuesta' : 'Nueva Respuesta'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Título</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ej: Saludo inicial"
              className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Contenido</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Escribe el contenido de la respuesta..."
              rows={5}
              className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
            />
            <p className="flex items-center gap-1.5 text-xs text-gray-500 mt-2">
              <Code className="w-3 h-3" />
              Usa variables como {'{userName}'}, {'{agentName}'} para personalizar
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Categoría</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ej: Saludos"
                list="categories"
                className="w-full px-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <datalist id="categories">
                {categories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Atajo</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono">/</span>
                <input
                  type="text"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value.replace(/\s/g, '') })}
                  placeholder="saludo"
                  className="w-full pl-8 pr-4 py-3 bg-gray-800/80 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
                />
              </div>
            </div>
          </div>
          
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-12 h-7 rounded-full transition-all relative ${
              formData.isActive ? 'bg-blue-500' : 'bg-gray-600'
            }`}>
              <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-md ${
                formData.isActive ? 'left-6' : 'left-1'
              }`} />
            </div>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              Respuesta activa
            </span>
          </label>
        </div>
        
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700/50 bg-gray-800/30">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={onSubmit}
            disabled={isSaving || !formData.title.trim() || !formData.content.trim()}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>{isEditing ? 'Guardar Cambios' : 'Crear Respuesta'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({
  reply,
  isSaving,
  onDelete,
  onClose,
}: {
  reply: SavedReply;
  isSaving: boolean;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl border border-gray-700/50 p-6">
        <div className="text-center">
          <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Eliminar Respuesta</h2>
          <p className="text-gray-400 mb-6 leading-relaxed">
            ¿Estás seguro de eliminar "<span className="text-white font-medium">{reply.title}</span>"?
            <br />
            <span className="text-sm">Esta acción no se puede deshacer.</span>
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-5 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl transition-all font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={onDelete}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all font-medium disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            <span>Eliminar</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaceholdersModal({ onClose }: { onClose: () => void }) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  const copyPlaceholder = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const placeholderList = Object.entries(PLACEHOLDERS || {
    '{userName}': 'Nombre del usuario',
    '{agentName}': 'Nombre del agente',
    '{date}': 'Fecha actual',
    '{time}': 'Hora actual',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-gray-900 rounded-2xl shadow-2xl border border-gray-700/50 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Code className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Variables Disponibles</h2>
              <p className="text-sm text-gray-400">Usa estas variables en tus respuestas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-2 max-h-96 overflow-auto">
          {placeholderList.map(([key, description]) => (
            <div
              key={key}
              className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition-all group"
            >
              <div>
                <code className="text-purple-400 font-mono font-medium">{key}</code>
                <p className="text-sm text-gray-400 mt-0.5">{description}</p>
              </div>
              <button
                onClick={() => copyPlaceholder(key)}
                className={`p-2.5 rounded-lg transition-all ${
                  copiedKey === key
                    ? 'text-green-400 bg-green-500/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700 opacity-0 group-hover:opacity-100'
                }`}
              >
                {copiedKey === key ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

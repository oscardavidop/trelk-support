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
  Clock,
  Keyboard
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
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-blue-500/30">
      
      {/* Blue Ambient Glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        
        {/* Header Section */}
        <div className="px-8 py-6 pb-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-blue-900/10">
                <MessageSquare className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Respuestas Rápidas</h1>
                <p className="text-sm text-zinc-400">Plantillas y atajos para el chat</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowPlaceholdersModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl text-zinc-300 transition-all"
              >
                <Code className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-medium">Variables</span>
              </button>

              <button 
                onClick={handleRefresh}
                disabled={refreshing}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
              </button>
              
              <button
                onClick={() => openFormModal()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl shadow-lg shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                <span>Nueva Respuesta</span>
              </button>
            </div>
          </div>

          {/* Stats Bar (Glassy) */}
          {stats && (
            <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6">
              <StatBadge icon={MessageSquare} count={stats.totalReplies} label="Total" color="text-zinc-200" bg="bg-zinc-800" />
              <div className="h-4 w-px bg-white/10" />
              <StatBadge icon={Zap} count={stats.activeReplies} label="Activas" color="text-blue-400" bg="bg-blue-500/10" />
              <div className="h-4 w-px bg-white/10" />
              <StatBadge icon={TrendingUp} count={stats.totalUsage} label="Usos" color="text-purple-400" bg="bg-purple-500/10" />
              <div className="h-4 w-px bg-white/10" />
              <StatBadge icon={Tag} count={categories.length} label="Categorías" color="text-amber-400" bg="bg-amber-500/10" />
            </div>
          )}

          {/* Toolbar (Search & Filters) */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[280px] max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título o contenido..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 cursor-pointer"
              >
                <option value="all">Todas las categorías</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                  showInactive 
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {showInactive ? <CheckCircle className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-zinc-600" />}
                <span>Inactivas</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 custom-scrollbar">
          {filteredReplies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
              <MessageSquare className="w-16 h-16 mb-4 stroke-1" />
              <p className="text-lg font-medium">No se encontraron respuestas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
      </div>

      {/* Modals */}
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

      {showDeleteModal && editingReply && (
        <DeleteModal
          reply={editingReply}
          isSaving={isSaving}
          onDelete={handleDelete}
          onClose={() => { setShowDeleteModal(false); setEditingReply(null); }}
        />
      )}

      {showPlaceholdersModal && (
        <PlaceholdersModal onClose={() => setShowPlaceholdersModal(false)} />
      )}
    </div>
  );
}

// Sub-components

function StatBadge({ icon: Icon, count, label, color, bg }: any) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-lg ${color}`}>{count.toLocaleString()}</span>
        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">{label}</span>
      </div>
    </div>
  );
}


function ReplyCard({ reply, onEdit, onDelete, onCopy, isCopied }: any) {
  return (
    <div className={`group relative bg-zinc-900/60 backdrop-blur-sm border rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-black/20 overflow-hidden flex flex-col ${
      reply.isActive 
        ? 'border-zinc-800 hover:border-blue-500/30' 
        : 'border-zinc-800/50 opacity-60 bg-zinc-900/30'
    }`}>
      
      <div className="p-5 flex-1">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0 pr-4">
            <h3 className="font-semibold text-zinc-100 truncate text-lg mb-1">{reply.title}</h3>
            
            <div className="flex flex-wrap items-center gap-2">
              {reply.category && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-md text-[10px] uppercase font-bold tracking-wider border border-zinc-700/50">
                  {reply.category}
                </span>
              )}
              {reply.shortcut && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-md text-xs font-mono border border-blue-500/20">
                  <Keyboard className="w-3 h-3" />
                  /{reply.shortcut}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
            <button onClick={onEdit} className="p-2 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
              <Edit3 className="w-4 h-4" />
            </button>
            <button onClick={onDelete} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50 text-sm text-zinc-400 font-mono leading-relaxed line-clamp-3">
            {reply.content}
          </div>
          <button
            onClick={onCopy}
            className={`absolute bottom-2 right-2 p-1.5 rounded-lg border shadow-sm transition-all ${
              isCopied 
                ? 'bg-green-500 text-white border-green-600' 
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white hover:border-zinc-500'
            }`}
          >
            {isCopied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-zinc-800/50 bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
          <span>{reply.usageCount || 0} usos</span>
        </div>
        {reply.createdBy && (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{reply.createdBy.name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FormModal({ isEditing, formData, setFormData, categories, isSaving, onSubmit, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
              {isEditing ? <Edit3 className="w-5 h-5 text-blue-500" /> : <Plus className="w-5 h-5 text-blue-500" />}
            </div>
            <h2 className="text-lg font-bold text-white">{isEditing ? 'Editar Respuesta' : 'Nueva Respuesta'}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Título</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ej: Saludo inicial"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">
                Contenido
                <span className="normal-case text-zinc-500 ml-2 font-normal tracking-normal">(Soporta variables)</span>
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Hola {userName}, ¿en qué puedo ayudarte hoy?"
                rows={5}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Categoría</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ej: Soporte"
                    list="categories"
                    className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  <datalist id="categories">
                    {categories.map((cat: string) => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">Atajo (Shortcut)</label>
                <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-lg group-focus-within:text-blue-500">/</span>
                  <input
                    type="text"
                    value={formData.shortcut}
                    onChange={(e) => setFormData({ ...formData, shortcut: e.target.value.replace(/\s/g, '') })}
                    placeholder="saludo"
                    className="w-full pl-7 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-6 rounded-full relative transition-colors ${formData.isActive ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                  <input 
                    type="checkbox" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${formData.isActive ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-sm font-medium text-zinc-300">Respuesta Activa</span>
              </div>
              <span className="text-xs text-zinc-500">
                {formData.isActive ? 'Visible en el chat' : 'Oculta para los agentes'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-zinc-900/50 border-t border-zinc-800">
          <button onClick={onClose} className="px-5 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all font-medium">Cancelar</button>
          <button
            onClick={onSubmit}
            disabled={isSaving || !formData.title || !formData.content}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span>{isEditing ? 'Guardar Cambios' : 'Crear Respuesta'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ reply, isSaving, onDelete, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <Trash2 className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Eliminar Respuesta</h2>
        <p className="text-zinc-400 mb-6">
          ¿Eliminar la respuesta "<span className="text-white font-medium">{reply.title}</span>"? <br/>
          Esta acción no se puede deshacer.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all font-medium">Cancelar</button>
          <button 
            onClick={onDelete} 
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all font-medium shadow-lg shadow-red-900/20"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in zoom-in-95 duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <Code className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="font-bold text-white">Variables Dinámicas</h2>
              <p className="text-xs text-zinc-400">Haz clic para copiar e insertar en tus respuestas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
          {placeholderList.map(([key, description]) => (
            <button
              key={key}
              onClick={() => copyPlaceholder(key)}
              className="w-full flex items-center justify-between p-4 bg-zinc-800/40 rounded-xl hover:bg-zinc-800 border border-transparent hover:border-purple-500/30 transition-all group text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 font-mono text-xs border border-purple-500/20">
                  {'{ }'}
                </div>
                <div>
                  <code className="text-zinc-200 font-mono font-medium block mb-0.5">{key}</code>
                  <p className="text-xs text-zinc-500">{description}</p>
                </div>
              </div>
              <div className={`p-2 rounded-lg transition-all ${
                copiedKey === key ? 'text-green-400 bg-green-500/10' : 'text-zinc-500 group-hover:text-white group-hover:bg-zinc-700'
              }`}>
                {copiedKey === key ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

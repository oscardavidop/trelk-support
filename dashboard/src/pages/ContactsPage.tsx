/**
 * ContactsPage - Complete CRM/Contact Management Module
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Tag,
  UserX,
  UserCheck,
  Trash2,
  Download,
  Upload,
  Eye,
  Edit3,
  X,
  Check,
  Plus,
  Settings,
  Grid,
  List,
  Calendar,
  MessageSquare,
  Clock,
  Globe,
  Ban,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Hash,
  Save,
  Copy,
  Star,
  Bookmark,
  Activity,
  TrendingUp
} from 'lucide-react';
import Contact360Panel from '../components/Contact360Panel';
import SegmentsManager from '../components/SegmentsManager';

// ==================== TYPES ====================

interface IContactListItem {
  _id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  language?: string;
  isBlocked: boolean;
  createdAt: string;
  lastActivity?: string;
  tags: Array<{ _id: string; name: string; color: string }>;
  activeSession?: {
    sessionId: string;
    status: string;
    assignedAgent?: string;
  };
  totalSessions: number;
  totalMessages: number;
}

interface ISegment {
  _id: string;
  name: string;
  description?: string;
  color: string;
  contactCount: number;
  isActive: boolean;
  isPinned: boolean;
}

interface ITag {
  _id: string;
  name: string;
  color: string;
}

interface ISavedView {
  _id: string;
  name: string;
  isGlobal: boolean;
}

interface ContactStats {
  totalContacts: number;
  activeContacts: number;
  blockedContacts: number;
  contactsWithActiveSession: number;
  newContactsToday: number;
  newContactsThisWeek: number;
  topLanguages: Array<{ language: string; count: number }>;
}

interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width?: number;
}

// ==================== DEFAULTS ====================

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'select', label: '', visible: true, width: 40 },
  { id: 'fullName', label: 'Nombre', visible: true, width: 200 },
  { id: 'telegramId', label: 'ID Telegram', visible: true, width: 120 },
  { id: 'username', label: 'Username', visible: true, width: 140 },
  { id: 'language', label: 'Idioma', visible: true, width: 80 },
  { id: 'tags', label: 'Etiquetas', visible: true, width: 200 },
  { id: 'status', label: 'Estado', visible: true, width: 100 },
  { id: 'totalSessions', label: 'Sesiones', visible: true, width: 80 },
  { id: 'totalMessages', label: 'Mensajes', visible: true, width: 80 },
  { id: 'lastActivity', label: 'Última Actividad', visible: true, width: 150 },
  { id: 'createdAt', label: 'Creado', visible: false, width: 150 },
  { id: 'actions', label: '', visible: true, width: 60 },
];

const LANGUAGE_FLAGS: Record<string, string> = {
  es: '🇪🇸',
  en: '🇺🇸',
  pt: '🇧🇷',
  fr: '🇫🇷',
  de: '🇩🇪',
  it: '🇮🇹',
  ru: '🇷🇺',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
  ar: '🇸🇦',
};

// ==================== MAIN COMPONENT ====================

export default function ContactsPage() {
  const token = useAuthStore((state) => state.token);
  const currentAgent = useAuthStore((state) => state.agent);

  // Data state
  const [contacts, setContacts] = useState<IContactListItem[]>([]);
  const [segments, setSegments] = useState<ISegment[]>([]);
  const [tags, setTags] = useState<ITag[]>([]);
  const [savedViews, setSavedViews] = useState<ISavedView[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // Selection state
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Sort state
  const [sortField, setSortField] = useState('lastActivity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [blockedFilter, setBlockedFilter] = useState<boolean | null>(null);
  const [hasActiveSessionFilter, setHasActiveSessionFilter] = useState<boolean | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Panel state
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showContact360, setShowContact360] = useState(false);
  const [showSegmentsManager, setShowSegmentsManager] = useState(false);

  // Bulk action state
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkActionModal, setBulkActionModal] = useState<string | null>(null);
  const [bulkTagId, setBulkTagId] = useState<string>('');
  const [bulkBlockReason, setBulkBlockReason] = useState('');

  // ==================== API CALLS ====================

  const fetchContacts = useCallback(async () => {
    if (!token) return;

    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));
      params.append('sortField', sortField);
      params.append('sortDirection', sortDirection);

      if (searchQuery) params.append('search', searchQuery);
      if (selectedSegment) params.append('segmentId', selectedSegment);
      if (selectedTags.length) params.append('tags', selectedTags.join(','));
      if (blockedFilter !== null) params.append('blocked', String(blockedFilter));
      if (hasActiveSessionFilter !== null) params.append('hasActiveSession', String(hasActiveSessionFilter));
      if (languageFilter) params.append('language', languageFilter);

      const response = await fetch(`/api/contacts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch contacts');

      const data = await response.json();
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token, page, limit, sortField, sortDirection, searchQuery, selectedSegment, selectedTags, blockedFilter, hasActiveSessionFilter, languageFilter]);

  const fetchSegments = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/segments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSegments(data.segments || []);
      }
    } catch (err) {
      console.error('Error fetching segments:', err);
    }
  }, [token]);

  const fetchTags = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/tags', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTags(data.tags || []);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  }, [token]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/contacts/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, [token]);

  const fetchSavedViews = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/contacts/views', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSavedViews(data.views || []);
      }
    } catch (err) {
      console.error('Error fetching views:', err);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchContacts(), fetchSegments(), fetchTags(), fetchStats(), fetchSavedViews()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Reload contacts when filters change
  useEffect(() => {
    fetchContacts();
  }, [page, limit, sortField, sortDirection, searchQuery, selectedSegment, selectedTags, blockedFilter, hasActiveSessionFilter, languageFilter]);

  // Refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchContacts(), fetchSegments(), fetchStats()]);
    setIsRefreshing(false);
  };

  // ==================== SELECTION ====================

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedContacts(new Set());
      setSelectAll(false);
    } else {
      setSelectedContacts(new Set(contacts.map((c) => c._id)));
      setSelectAll(true);
    }
  };

  const handleSelectContact = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedContacts(newSelected);
    setSelectAll(newSelected.size === contacts.length);
  };

  // ==================== SORTING ====================

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  // ==================== BULK ACTIONS ====================

  const executeBulkAction = async (action: string, payload: any) => {
    if (!token || selectedContacts.size === 0) return;

    setBulkActionLoading(true);
    try {
      const response = await fetch(`/api/contacts/bulk/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contactIds: Array.from(selectedContacts),
          ...payload,
        }),
      });

      if (!response.ok) throw new Error('Bulk action failed');

      const data = await response.json();
      alert(`Acción completada: ${data.success} éxitos, ${data.failed} fallos`);

      // Refresh data
      await fetchContacts();
      setSelectedContacts(new Set());
      setSelectAll(false);
      setBulkActionModal(null);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ==================== EXPORT ====================

  const handleExport = async (format: 'csv' | 'json') => {
    if (!token) return;

    try {
      const response = await fetch('/api/contacts/export', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          search: searchQuery,
          segmentId: selectedSegment,
          tags: selectedTags,
          blocked: blockedFilter,
        }),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error exportando: ${err.message}`);
    }
  };

  // ==================== RENDER HELPERS ====================

  const formatDate = (date: string | undefined) => {
    if (!date) return '—';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days} días`;
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
  };

  const visibleColumns = useMemo(() => columns.filter((c) => c.visible), [columns]);

  // ==================== RENDER ====================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-950">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Contactos</h1>
              <p className="text-sm text-gray-400">Gestiona tu base de contactos CRM</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowSegmentsManager(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg text-white font-medium transition-colors"
            >
              <Bookmark className="w-4 h-4" />
              <span>Segmentos</span>
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {stats && (
          <div className="px-6 py-3 bg-gray-900/50 border-b border-gray-800">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 rounded-lg">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-white font-semibold">{stats.totalContacts.toLocaleString()}</span>
                <span className="text-gray-400 text-sm">contactos</span>
              </div>
              <div className="h-4 w-px bg-gray-700" />
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-green-500/20 rounded-lg">
                  <Activity className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-green-400 font-medium">{stats.activeContacts.toLocaleString()}</span>
                <span className="text-gray-400 text-sm">activos</span>
              </div>
              <div className="h-4 w-px bg-gray-700" />
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-purple-500/20 rounded-lg">
                  <MessageSquare className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-purple-400 font-medium">{stats.contactsWithActiveSession}</span>
                <span className="text-gray-400 text-sm">en chat</span>
              </div>
              <div className="h-4 w-px bg-gray-700" />
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-cyan-500/20 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-cyan-400 font-medium">+{stats.newContactsToday}</span>
                <span className="text-gray-400 text-sm">hoy</span>
              </div>
              {stats.blockedContacts > 0 && (
                <>
                  <div className="h-4 w-px bg-gray-700" />
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-red-500/20 rounded-lg">
                      <Ban className="w-4 h-4 text-red-400" />
                    </div>
                    <span className="text-red-400 font-medium">{stats.blockedContacts}</span>
                    <span className="text-gray-400 text-sm">bloqueados</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Search & Filters */}
            <div className="flex items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, username o ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
              </div>

              {/* Segment Selector */}
              <select
                value={selectedSegment || ''}
                onChange={(e) => {
                  setSelectedSegment(e.target.value || null);
                  setPage(1);
                }}
                className="px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">Todos los contactos</option>
                {segments.filter((s) => s.isActive).map((segment) => (
                  <option key={segment._id} value={segment._id}>
                    {segment.name} ({segment.contactCount})
                  </option>
                ))}
              </select>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showFilters ? 'bg-blue-600 text-white' : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtros
                {(selectedTags.length > 0 || blockedFilter !== null || hasActiveSessionFilter !== null || languageFilter) && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-500 rounded-full">
                    {[selectedTags.length > 0, blockedFilter !== null, hasActiveSessionFilter !== null, languageFilter].filter(Boolean).length}
                  </span>
                )}
              </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Bulk Actions */}
              {selectedContacts.size > 0 && (
                <div className="flex items-center gap-2 mr-4 pr-4 border-r border-gray-600">
                  <span className="text-sm text-gray-400">{selectedContacts.size} seleccionados</span>
                  <button
                    onClick={() => setBulkActionModal('add-tag')}
                    className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg"
                    title="Añadir etiqueta"
                  >
                    <Tag className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setBulkActionModal('block')}
                    className="p-2 text-gray-300 hover:text-red-400 hover:bg-gray-700/50 rounded-lg"
                    title="Bloquear"
                  >
                    <Ban className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSelectedContacts(new Set())}
                    className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg"
                    title="Limpiar selección"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Export */}
              <div className="relative">
                <button
                  onClick={() => setShowBulkActions(!showBulkActions)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 rounded-lg"
                >
                  <Download className="w-4 h-4" />
                  Exportar
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showBulkActions && (
                  <div className="absolute right-0 top-full mt-2 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                    <button
                      onClick={() => {
                        handleExport('csv');
                        setShowBulkActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700/50 first:rounded-t-lg"
                    >
                      Exportar CSV
                    </button>
                    <button
                      onClick={() => {
                        handleExport('json');
                        setShowBulkActions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-gray-300 hover:bg-gray-700/50 last:rounded-b-lg"
                    >
                      Exportar JSON
                    </button>
                  </div>
                )}
              </div>

              {/* Column Settings */}
              <button
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg"
                title="Configurar columnas"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Refresh */}
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <div className="mt-4 flex flex-wrap items-center gap-3 pt-4 border-t border-gray-700/50">
              {/* Tags */}
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-gray-400" />
                <select
                  value=""
                  onChange={(e) => {
                    if (e.target.value && !selectedTags.includes(e.target.value)) {
                      setSelectedTags([...selectedTags, e.target.value]);
                      setPage(1);
                    }
                  }}
                  className="px-3 py-1.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-white"
                >
                  <option value="">Filtrar por etiqueta...</option>
                  {tags.map((tag) => (
                    <option key={tag._id} value={tag._id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                {selectedTags.map((tagId) => {
                  const tag = tags.find((t) => t._id === tagId);
                  return tag ? (
                    <span
                      key={tagId}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
                    >
                      {tag.name}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => {
                          setSelectedTags(selectedTags.filter((t) => t !== tagId));
                          setPage(1);
                        }}
                      />
                    </span>
                  ) : null;
                })}
              </div>

              <div className="h-4 w-px bg-gray-600" />

              {/* Blocked Filter */}
              <select
                value={blockedFilter === null ? '' : String(blockedFilter)}
                onChange={(e) => {
                  setBlockedFilter(e.target.value === '' ? null : e.target.value === 'true');
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-white"
              >
                <option value="">Todos los estados</option>
                <option value="false">Solo activos</option>
                <option value="true">Solo bloqueados</option>
              </select>

              {/* Active Session Filter */}
              <select
                value={hasActiveSessionFilter === null ? '' : String(hasActiveSessionFilter)}
                onChange={(e) => {
                  setHasActiveSessionFilter(e.target.value === '' ? null : e.target.value === 'true');
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-white"
              >
                <option value="">Sesión activa: Todos</option>
                <option value="true">Con sesión activa</option>
                <option value="false">Sin sesión activa</option>
              </select>

              {/* Language Filter */}
              <select
                value={languageFilter || ''}
                onChange={(e) => {
                  setLanguageFilter(e.target.value || null);
                  setPage(1);
                }}
                className="px-3 py-1.5 bg-gray-700/50 border border-gray-600/50 rounded-lg text-sm text-white"
              >
                <option value="">Todos los idiomas</option>
                {stats?.topLanguages.map(({ language }) => (
                  <option key={language} value={language}>
                    {LANGUAGE_FLAGS[language] || '🌐'} {language.toUpperCase()}
                  </option>
                ))}
              </select>

              {/* Clear Filters */}
              {(selectedTags.length > 0 || blockedFilter !== null || hasActiveSessionFilter !== null || languageFilter) && (
                <button
                  onClick={() => {
                    setSelectedTags([]);
                    setBlockedFilter(null);
                    setHasActiveSessionFilter(null);
                    setLanguageFilter(null);
                    setPage(1);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50 sticky top-0 z-10">
              <tr>
                {visibleColumns.map((col) => (
                  <th
                    key={col.id}
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider ${
                      col.id !== 'select' && col.id !== 'actions' ? 'cursor-pointer hover:text-white' : ''
                    }`}
                    style={{ width: col.width }}
                    onClick={() => col.id !== 'select' && col.id !== 'actions' && handleSort(col.id)}
                  >
                    <div className="flex items-center gap-2">
                      {col.id === 'select' ? (
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500/50"
                        />
                      ) : (
                        <>
                          {col.label}
                          {sortField === col.id && (
                            sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                          )}
                        </>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {contacts.map((contact) => (
                <tr
                  key={contact._id}
                  className={`hover:bg-gray-800/30 transition-colors ${
                    selectedContacts.has(contact._id) ? 'bg-blue-900/20' : ''
                  }`}
                >
                  {visibleColumns.map((col) => (
                    <td key={col.id} className="px-4 py-3 text-sm">
                      {col.id === 'select' ? (
                        <input
                          type="checkbox"
                          checked={selectedContacts.has(contact._id)}
                          onChange={() => handleSelectContact(contact._id)}
                          className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500/50"
                        />
                      ) : col.id === 'fullName' ? (
                        <button
                          onClick={() => {
                            setSelectedContactId(contact._id);
                            setShowContact360(true);
                          }}
                          className="flex items-center gap-3 text-left hover:text-blue-400 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium">
                            {contact.firstName?.[0] || contact.username?.[0] || '?'}
                          </div>
                          <div>
                            <div className="font-medium text-white">{contact.fullName || `User ${contact.telegramId}`}</div>
                            {contact.username && (
                              <div className="text-xs text-gray-400">@{contact.username}</div>
                            )}
                          </div>
                        </button>
                      ) : col.id === 'telegramId' ? (
                        <span className="font-mono text-gray-400">{contact.telegramId}</span>
                      ) : col.id === 'username' ? (
                        contact.username ? (
                          <span className="text-gray-300">@{contact.username}</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )
                      ) : col.id === 'language' ? (
                        <span className="text-lg" title={contact.language?.toUpperCase()}>
                          {LANGUAGE_FLAGS[contact.language || ''] || '🌐'}
                        </span>
                      ) : col.id === 'tags' ? (
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag._id}
                              className="px-2 py-0.5 rounded-full text-xs"
                              style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {contact.tags.length > 3 && (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-700 text-gray-400">
                              +{contact.tags.length - 3}
                            </span>
                          )}
                        </div>
                      ) : col.id === 'status' ? (
                        <div className="flex items-center gap-2">
                          {contact.isBlocked ? (
                            <span className="flex items-center gap-1 text-red-400">
                              <Ban className="w-4 h-4" />
                              Bloqueado
                            </span>
                          ) : contact.activeSession ? (
                            <span className="flex items-center gap-1 text-green-400">
                              <MessageSquare className="w-4 h-4" />
                              En chat
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-gray-400">
                              <CheckCircle className="w-4 h-4" />
                              Activo
                            </span>
                          )}
                        </div>
                      ) : col.id === 'totalSessions' ? (
                        <span className="text-gray-300">{contact.totalSessions}</span>
                      ) : col.id === 'totalMessages' ? (
                        <span className="text-gray-300">{contact.totalMessages}</span>
                      ) : col.id === 'lastActivity' ? (
                        <span className="text-gray-400">{formatDate(contact.lastActivity)}</span>
                      ) : col.id === 'createdAt' ? (
                        <span className="text-gray-400">{formatDate(contact.createdAt)}</span>
                      ) : col.id === 'actions' ? (
                        <button
                          onClick={() => {
                            setSelectedContactId(contact._id);
                            setShowContact360(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}

              {contacts.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <div className="font-medium">No se encontraron contactos</div>
                    <div className="text-sm mt-1">Prueba ajustando los filtros de búsqueda</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-700/50 bg-gray-800/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">
                Mostrando {(page - 1) * limit + 1} - {Math.min(page * limit, total)} de {total.toLocaleString()}
              </span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 bg-gray-700/50 border border-gray-600/50 rounded text-sm text-white"
              >
                <option value={25}>25 por página</option>
                <option value={50}>50 por página</option>
                <option value={100}>100 por página</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Segments Sidebar */}
      <div className="w-64 border-l border-gray-700/50 bg-gray-800/30 flex flex-col">
        <div className="p-4 border-b border-gray-700/50">
          <h3 className="font-medium text-white flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-blue-400" />
            Segmentos
          </h3>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {/* All Contacts */}
          <button
            onClick={() => setSelectedSegment(null)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
              !selectedSegment ? 'bg-blue-600/20 text-blue-400' : 'text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            <span>Todos los contactos</span>
            <span className="text-xs">{stats?.totalContacts.toLocaleString()}</span>
          </button>

          {/* Pinned Segments */}
          {segments.filter((s) => s.isPinned && s.isActive).length > 0 && (
            <div className="mt-4">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">Fijados</div>
              {segments
                .filter((s) => s.isPinned && s.isActive)
                .map((segment) => (
                  <button
                    key={segment._id}
                    onClick={() => setSelectedSegment(segment._id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedSegment === segment._id ? 'bg-blue-600/20 text-blue-400' : 'text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Star className="w-3 h-3" style={{ color: segment.color }} />
                      <span className="truncate">{segment.name}</span>
                    </div>
                    <span className="text-xs">{segment.contactCount.toLocaleString()}</span>
                  </button>
                ))}
            </div>
          )}

          {/* Other Segments */}
          {segments.filter((s) => !s.isPinned && s.isActive).length > 0 && (
            <div className="mt-4">
              <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase">Segmentos</div>
              {segments
                .filter((s) => !s.isPinned && s.isActive)
                .map((segment) => (
                  <button
                    key={segment._id}
                    onClick={() => setSelectedSegment(segment._id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                      selectedSegment === segment._id ? 'bg-blue-600/20 text-blue-400' : 'text-gray-300 hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: segment.color }} />
                      <span className="truncate">{segment.name}</span>
                    </div>
                    <span className="text-xs">{segment.contactCount.toLocaleString()}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Create Segment Button */}
        <div className="p-4 border-t border-gray-700/50">
          <button
            onClick={() => setShowSegmentsManager(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear Segmento
          </button>
        </div>
      </div>

      {/* Contact 360° Panel */}
      {showContact360 && selectedContactId && (
        <Contact360Panel
          contactId={selectedContactId}
          onClose={() => {
            setShowContact360(false);
            setSelectedContactId(null);
          }}
          onUpdate={fetchContacts}
        />
      )}

      {/* Column Settings Modal */}
      {showColumnSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-gray-800 rounded-xl shadow-xl w-80 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between">
              <h3 className="font-medium text-white">Configurar Columnas</h3>
              <button onClick={() => setShowColumnSettings(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {columns
                .filter((c) => c.id !== 'select' && c.id !== 'actions')
                .map((col) => (
                  <label key={col.id} className="flex items-center gap-3 py-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={col.visible}
                      onChange={() => {
                        setColumns(columns.map((c) => (c.id === col.id ? { ...c, visible: !c.visible } : c)));
                      }}
                      className="w-4 h-4 rounded border-gray-600 text-blue-500 focus:ring-blue-500/50"
                    />
                    <span className="text-gray-300">{col.label}</span>
                  </label>
                ))}
            </div>
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={() => setColumns(DEFAULT_COLUMNS)}
                className="w-full px-4 py-2 text-sm text-gray-400 hover:text-white"
              >
                Restablecer columnas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Tag Modal */}
      {bulkActionModal === 'add-tag' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-gray-800 rounded-xl shadow-xl w-96 p-6">
            <h3 className="text-lg font-medium text-white mb-4">Añadir Etiqueta</h3>
            <p className="text-gray-400 text-sm mb-4">
              Añadir etiqueta a {selectedContacts.size} contacto(s)
            </p>
            <select
              value={bulkTagId}
              onChange={(e) => setBulkTagId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white mb-4"
            >
              <option value="">Seleccionar etiqueta...</option>
              {tags.map((tag) => (
                <option key={tag._id} value={tag._id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setBulkActionModal(null);
                  setBulkTagId('');
                }}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeBulkAction('add-tag', { tagId: bulkTagId })}
                disabled={!bulkTagId || bulkActionLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
              >
                {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Añadir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Block Modal */}
      {bulkActionModal === 'block' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-gray-800 rounded-xl shadow-xl w-96 p-6">
            <h3 className="text-lg font-medium text-white mb-4">Bloquear Contactos</h3>
            <p className="text-gray-400 text-sm mb-4">
              Bloquear {selectedContacts.size} contacto(s). Esta acción puede deshacerse.
            </p>
            <input
              type="text"
              placeholder="Motivo del bloqueo (opcional)"
              value={bulkBlockReason}
              onChange={(e) => setBulkBlockReason(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white mb-4"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setBulkActionModal(null);
                  setBulkBlockReason('');
                }}
                className="px-4 py-2 text-gray-300 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={() => executeBulkAction('block', { reason: bulkBlockReason })}
                disabled={bulkActionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg disabled:opacity-50"
              >
                {bulkActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Segments Manager Modal */}
      {showSegmentsManager && (
        <SegmentsManager
          onClose={() => setShowSegmentsManager(false)}
          onSegmentCreated={() => {
            fetchSegments();
            setShowSegmentsManager(false);
          }}
        />
      )}
    </div>
  );
}

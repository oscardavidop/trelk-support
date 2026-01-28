import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  Users, Search, Filter, RefreshCw, Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  MoreVertical, Tag, UserX, UserCheck, Trash2, Download, Upload, Eye, Edit3, X, Check,
  Plus, Settings, Grid, List, Calendar, MessageSquare, Clock, Globe, Ban, AlertTriangle,
  CheckCircle, XCircle, Hash, Save, Copy, Star, Bookmark, Activity, TrendingUp, Layers, Layout
} from 'lucide-react';
import Contact360Panel from '../components/Contact360Panel';
import SegmentsManager from '../components/SegmentsManager';

// ============= TYPES =============
interface IContactListItem { _id: string; telegramId: number; username?: string; firstName?: string; lastName?: string; fullName: string; language?: string; isBlocked: boolean; createdAt: string; lastActivity?: string; tags: Array<{ _id: string; name: string; color: string }>; activeSession?: { sessionId: string; status: string; assignedAgent?: string; }; totalSessions: number; totalMessages: number; }
interface ISegment { _id: string; name: string; description?: string; color: string; contactCount: number; isActive: boolean; isPinned: boolean; }
interface ITag { _id: string; name: string; color: string; }
interface ISavedView { _id: string; name: string; isGlobal: boolean; }
interface ContactStats { totalContacts: number; activeContacts: number; blockedContacts: number; contactsWithActiveSession: number; newContactsToday: number; newContactsThisWeek: number; topLanguages: Array<{ language: string; count: number }>; }
interface ColumnConfig { id: string; label: string; visible: boolean; width?: number; }

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
  { id: 'lastActivity', label: 'Actividad', visible: true, width: 150 },
  { id: 'actions', label: '', visible: true, width: 60 },
];

const LANGUAGE_FLAGS: Record<string, string> = { es: '🇪🇸', en: '🇺🇸', pt: '🇧🇷', fr: '🇫🇷', de: '🇩🇪', it: '🇮🇹', ru: '🇷🇺', zh: '🇨🇳', ja: '🇯🇵', ko: '🇰🇷', ar: '🇸🇦' };

// ============= MAIN COMPONENT =============

export default function ContactsPage() {
  const token = useAuthStore((state) => state.token);
  const currentAgent = useAuthStore((state) => state.agent);

  // --- DATA STATE ---
  const [contacts, setContacts] = useState<IContactListItem[]>([]);
  const [segments, setSegments] = useState<ISegment[]>([]);
  const [tags, setTags] = useState<ITag[]>([]);
  const [savedViews, setSavedViews] = useState<ISavedView[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);

  // --- UI STATE ---
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [showColumnSettings, setShowColumnSettings] = useState(false);

  // --- SELECTION & PAGINATION ---
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [sortField, setSortField] = useState('lastActivity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // --- FILTERS ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [blockedFilter, setBlockedFilter] = useState<boolean | null>(null);
  const [hasActiveSessionFilter, setHasActiveSessionFilter] = useState<boolean | null>(null);
  const [languageFilter, setLanguageFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // --- PANELS & MODALS ---
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showContact360, setShowContact360] = useState(false);
  const [showSegmentsManager, setShowSegmentsManager] = useState(false);

  // --- BULK ACTIONS STATE ---
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [bulkActionModal, setBulkActionModal] = useState<string | null>(null);
  const [bulkTagId, setBulkTagId] = useState<string>('');
  const [bulkBlockReason, setBulkBlockReason] = useState('');

  // ==================== API CALLS (RESTAURADOS) ====================

  const fetchContacts = useCallback(async () => {
    if (!token) return;
    setIsRefreshing(true);
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

      const response = await fetch(`/api/contacts?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const data = await response.json();
      if (selectedSegment && data.segment) {
        // Update segment contact count
        setContacts([]);
        setSegments((prev) => prev.map((s) => s._id === data.segment._id ? { ...s, contactCount: data.segment.contactCount } : s));

      }
      setContacts(data.contacts || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
      setError(null);
    } catch (err: any) { setError(err.message); }
    finally { setIsRefreshing(false); }
  }, [token, page, limit, sortField, sortDirection, searchQuery, selectedSegment, selectedTags, blockedFilter, hasActiveSessionFilter, languageFilter]);

  const fetchSegments = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/segments', { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) { const data = await response.json(); setSegments(data.segments || []); }
    } catch (err) { console.error('Error fetching segments:', err); }
  }, [token]);

  const fetchTags = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/tags', { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) { const data = await response.json(); setTags(data.tags || []); }
    } catch (err) { console.error('Error fetching tags:', err); }
  }, [token]);

  const fetchStats = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/contacts/stats', { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) { const data = await response.json(); setStats(data.stats); }
    } catch (err) { console.error('Error fetching stats:', err); }
  }, [token]);

  const fetchSavedViews = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/contacts/views', { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) { const data = await response.json(); setSavedViews(data.views || []); }
    } catch (err) { console.error('Error fetching views:', err); }
  }, [token]);

  // Initial Load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchContacts(), fetchSegments(), fetchTags(), fetchStats(), fetchSavedViews()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Filter Reload
  useEffect(() => { fetchContacts(); }, [page, limit, sortField, sortDirection, searchQuery, selectedSegment, selectedTags, blockedFilter, hasActiveSessionFilter, languageFilter]);

  // ==================== HANDLERS (RESTAURADOS) ====================

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchContacts(), fetchSegments(), fetchStats()]);
    setIsRefreshing(false);
  };

  const handleSelectAll = () => {
    if (selectAll) { setSelectedContacts(new Set()); setSelectAll(false); }
    else { setSelectedContacts(new Set(contacts.map((c) => c._id))); setSelectAll(true); }
  };

  const handleSelectContact = (id: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
    setSelectedContacts(newSelected);
    setSelectAll(newSelected.size === contacts.length);
  };

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('desc'); }
    setPage(1);
  };

  const executeBulkAction = async (action: string, payload: any) => {
    if (!token || selectedContacts.size === 0) return;
    setBulkActionLoading(true);
    try {
      const response = await fetch(`/api/contacts/bulk/${action}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: Array.from(selectedContacts), ...payload }),
      });
      if (!response.ok) throw new Error('Bulk action failed');
      const data = await response.json();
      alert(`Acción completada: ${data.success} éxitos, ${data.failed} fallos`);
      await fetchContacts();
      setSelectedContacts(new Set());
      setSelectAll(false);
      setBulkActionModal(null);
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setBulkActionLoading(false); }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    if (!token) return;
    try {
      const response = await fetch('/api/contacts/export', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, search: searchQuery, segmentId: selectedSegment, tags: selectedTags, blocked: blockedFilter }),
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) { alert(`Error exportando: ${err.message}`); }
  };

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

  if (isLoading) {
    return <div className="flex items-center justify-center h-full bg-zinc-950"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  // ============= UI RENDER =============

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-blue-500/30">

      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* RIGHT SIDEBAR: Segments */}
      <div className="w-72 bg-zinc-900/30 border-r border-zinc-800 flex flex-col shrink-0 z-20">
        <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
          <h3 className="font-bold text-zinc-300 text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" /> Segmentos
          </h3>
          <button onClick={() => setShowSegmentsManager(true)} className="p-1.5 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded transition-colors"><Settings className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
          {/* Main */}
          <div className="space-y-1">
            <NavButton active={!selectedSegment} onClick={() => setSelectedSegment(null)} label="Todos" icon={Users} count={stats?.totalContacts} />
            <NavButton active={false} onClick={() => { }} label="Con sesión activa" icon={MessageSquare} count={stats?.contactsWithActiveSession} />
            <NavButton active={false} onClick={() => { }} label="Bloqueados" icon={Ban} count={stats?.blockedContacts} />
          </div>

          {/* User Segments */}
          <div>
            <div className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex justify-between items-center">
              <span>Personalizados</span>
              <button onClick={() => setShowSegmentsManager(true)} className="hover:text-blue-400"><Plus className="w-3 h-3" /></button>
            </div>
            <div className="space-y-1">
              {segments.map(s => (
                <SegmentItem key={s._id} segment={s} active={selectedSegment === s._id} onClick={() => setSelectedSegment(s._id)} />
              ))}
            </div>
          </div>

          {/* Saved Views (Restaurado) */}
          {savedViews.length > 0 && (
            <div>
              <div className="px-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Vistas Guardadas</div>
              <div className="space-y-1">
                {savedViews.map(view => (
                  <button key={view._id} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 transition-all">
                    <Layout className="w-4 h-4" />
                    <span>{view.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">

        {/* HEADER */}
        <div className="px-8 py-6 pb-2 bg-zinc-950">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-blue-900/10">
                <Users className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Contactos</h1>
                <p className="text-sm text-zinc-400">Base de datos CRM</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleRefresh} disabled={isRefreshing} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all">
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowBulkActions(!showBulkActions)} className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-medium rounded-xl transition-all relative">
                <Download className="w-4 h-4" /> Exportar
                {showBulkActions && (
                  <div className="absolute right-0 top-full mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col p-1">
                    <button onClick={() => handleExport('csv')} className="text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg">CSV</button>
                    <button onClick={() => handleExport('json')} className="text-left px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg">JSON</button>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* STATS STRIP */}
          {stats && (
            <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6 overflow-x-auto">
              <StatBadge icon={Users} value={stats.totalContacts} label="Total" />
              <div className="h-4 w-px bg-white/10" />
              <StatBadge icon={Activity} value={stats.activeContacts} label="Activos" color="text-emerald-400" />
              <div className="h-4 w-px bg-white/10" />
              <StatBadge icon={MessageSquare} value={stats.contactsWithActiveSession} label="En Chat" color="text-blue-400" />
              {stats.blockedContacts > 0 && (
                <>
                  <div className="h-4 w-px bg-white/10" />
                  <StatBadge icon={Ban} value={stats.blockedContacts} label="Bloqueados" color="text-red-400" />
                </>
              )}
            </div>
          )}

          {/* ERROR BANNER */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* TOOLBAR */}
          <div className="flex items-center justify-between gap-4 border-b border-zinc-800/50 pb-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative max-w-md w-full group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Buscar contactos..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                />
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${showFilters ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
              >
                <Filter className="w-4 h-4" /> Filtros
                {(selectedTags.length > 0 || blockedFilter !== null) && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </button>

              <button
                onClick={() => setShowColumnSettings(!showColumnSettings)}
                className="p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
                title="Configurar columnas"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            {selectedContacts.size > 0 && (
              <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl animate-in slide-in-from-top-2 fade-in">
                <span className="text-sm font-medium text-blue-300 mr-2">{selectedContacts.size} seleccionados</span>
                <div className="h-4 w-px bg-blue-500/20" />
                <button onClick={() => setBulkActionModal('add-tag')} className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-500/20 rounded-lg"><Tag className="w-4 h-4" /></button>
                <button onClick={() => setBulkActionModal('block')} className="p-1.5 text-blue-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg"><Ban className="w-4 h-4" /></button>
                <button onClick={() => setSelectedContacts(new Set())} className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-500/20 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
            )}
          </div>

          {/* FILTERS PANEL */}
          {showFilters && (
            <div className="py-4 border-b border-zinc-800/50 grid grid-cols-4 gap-4 animate-in slide-in-from-top-2">
              <FilterSelect label="Etiquetas" value="" onChange={(v: string) => { if (v) { setSelectedTags([...selectedTags, v]); setPage(1); } }} options={tags.map(t => ({ value: t._id, label: t.name }))} />
              <FilterSelect label="Estado" value={blockedFilter === null ? '' : String(blockedFilter)} onChange={(v: string) => { setBlockedFilter(v === '' ? null : v === 'true'); setPage(1); }} options={[{ value: 'false', label: 'Activos' }, { value: 'true', label: 'Bloqueados' }]} />
              <FilterSelect label="Sesión" value={hasActiveSessionFilter === null ? '' : String(hasActiveSessionFilter)} onChange={(v: string) => { setHasActiveSessionFilter(v === '' ? null : v === 'true'); setPage(1); }} options={[{ value: 'true', label: 'Con Chat' }, { value: 'false', label: 'Sin Chat' }]} />
              <FilterSelect label="Idioma" value={languageFilter || ''} onChange={(v: string) => { setLanguageFilter(v || null); setPage(1); }} options={stats?.topLanguages.map(l => ({ value: l.language, label: l.language.toUpperCase() })) || []} />
            </div>
          )}
        </div>

        {/* TABLE */}
        {
          isRefreshing ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : <div className="flex-1 overflow-auto custom-scrollbar px-8">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800">
                <tr>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.id}
                      className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider first:pl-2"
                      style={{ width: col.width }}
                    >
                      <div className="flex items-center gap-2 cursor-pointer hover:text-zinc-300" onClick={() => col.id !== 'select' && col.id !== 'actions' && handleSort(col.id)}>
                        {col.id === 'select' ? (
                          <input type="checkbox" checked={selectAll} onChange={handleSelectAll} className="rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-offset-0 focus:ring-blue-500/50" />
                        ) : (
                          <>
                            {col.label}
                            {sortField === col.id && (sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                          </>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-6 py-20 text-center text-zinc-500">
                      <div className="flex flex-col items-center justify-center opacity-50">
                        <Users className="w-12 h-12 mb-4 stroke-1" />
                        <p className="text-lg">No se encontraron contactos</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact) => (
                    <tr key={contact._id} className={`group hover:bg-zinc-900/40 transition-colors ${selectedContacts.has(contact._id) ? 'bg-blue-500/5' : ''}`}>
                      {visibleColumns.map((col) => (
                        <td key={col.id} className="px-6 py-3 whitespace-nowrap first:pl-2">
                          {renderCell(col.id, contact, selectedContacts.has(contact._id), () => handleSelectContact(contact._id), () => { setSelectedContactId(contact._id); setShowContact360(true); }, formatDate)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        }


        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between text-xs text-zinc-500">
          <span>Mostrando {(page - 1) * limit + 1} - {Math.min(page * limit, total)} de {total.toLocaleString()}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 hover:bg-zinc-900 rounded-lg disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 py-2 bg-zinc-900 rounded-lg border border-zinc-800 font-mono text-zinc-300">{page}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 hover:bg-zinc-900 rounded-lg disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
          </div>
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
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === pageNum
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

      {/* MODALS */}
      {showContact360 && selectedContactId && (
        <Contact360Panel contactId={selectedContactId} onClose={() => { setShowContact360(false); setSelectedContactId(null); }} onUpdate={handleRefresh} />
      )}

      {showSegmentsManager && (
        <SegmentsManager onClose={() => setShowSegmentsManager(false)} onSegmentCreated={handleRefresh} />
      )}

      {/* Bulk Tag Modal (Restaurado) */}
      {bulkActionModal === 'add-tag' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-white mb-4">Añadir Etiqueta</h3>
            <p className="text-zinc-400 text-sm mb-4">Selecciona una etiqueta para {selectedContacts.size} contactos.</p>
            <select value={bulkTagId} onChange={(e) => setBulkTagId(e.target.value)} className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white mb-6 focus:border-blue-500 outline-none">
              <option value="">Seleccionar...</option>
              {tags.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
            </select>
            <div className="flex justify-end gap-3">
              <button onClick={() => setBulkActionModal(null)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancelar</button>
              <button onClick={() => executeBulkAction('add-tag', { tagId: bulkTagId })} disabled={!bulkTagId || bulkActionLoading} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-50 flex items-center gap-2">
                {bulkActionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Block Modal (Restaurado) */}
      {bulkActionModal === 'block' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4 text-red-500">
              <Ban className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Bloquear Contactos</h3>
            </div>
            <p className="text-zinc-400 text-sm mb-4">Se bloquearán {selectedContacts.size} contactos. No podrán enviarte mensajes.</p>
            <input type="text" value={bulkBlockReason} onChange={(e) => setBulkBlockReason(e.target.value)} placeholder="Motivo (opcional)" className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white mb-6 focus:border-red-500 outline-none" />
            <div className="flex justify-end gap-3">
              <button onClick={() => setBulkActionModal(null)} className="px-4 py-2 text-zinc-400 hover:text-white">Cancelar</button>
              <button onClick={() => executeBulkAction('block', { reason: bulkBlockReason })} disabled={bulkActionLoading} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl disabled:opacity-50 flex items-center gap-2">
                {bulkActionLoading && <Loader2 className="w-4 h-4 animate-spin" />} Bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Column Settings Modal (Restaurado) */}
      {showColumnSettings && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-80 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h3 className="font-bold text-white">Columnas</h3>
              <button onClick={() => setShowColumnSettings(false)}><X className="w-5 h-5 text-zinc-500 hover:text-white" /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {columns.filter(c => c.id !== 'select' && c.id !== 'actions').map(col => (
                <label key={col.id} className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={col.visible} onChange={() => setColumns(columns.map(c => c.id === col.id ? { ...c, visible: !c.visible } : c))} className="rounded bg-zinc-950 border-zinc-700 text-blue-500 focus:ring-offset-0" />
                  <span className="text-zinc-300 text-sm">{col.label}</span>
                </label>
              ))}
            </div>
            <div className="p-4 border-t border-zinc-800">
              <button onClick={() => setColumns(DEFAULT_COLUMNS)} className="w-full py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg">Restaurar defecto</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ============= HELPER COMPONENTS =============

function StatBadge({ icon: Icon, value, label, color = 'text-zinc-200' }: any) {
  return (
    <div className="flex items-baseline gap-2 px-2">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className={`font-bold ${color}`}>{value?.toLocaleString() || 0}</span>
      <span className="text-xs text-zinc-500 font-medium hidden lg:inline">{label}</span>
    </div>
  );
}

function NavButton({ active, onClick, label, icon: Icon, count }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all group ${active ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 ${active ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-400'}`} />
        <span className="font-medium">{label}</span>
      </div>
      {count !== undefined && <span className="text-[10px] font-mono opacity-50 bg-zinc-950 px-1.5 py-0.5 rounded">{count}</span>}
    </button>
  );
}

function SegmentItem({ segment, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all group ${active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/30'}`}>
      <div className="flex items-center gap-2.5">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: segment.color || '#71717a' }} />
        <span className="truncate">{segment.name}</span>
      </div>
      <span className="text-[10px] text-zinc-600 group-hover:text-zinc-500">{segment.contactCount}</span>
    </button>
  );
}

function FilterSelect({ label, value, onChange, options }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pl-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none">
        <option value="">Todos</option>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// Render Helper
function renderCell(colId: string, contact: IContactListItem, selected: boolean, onSelect: () => void, onView: () => void, formatDate: any) {
  switch (colId) {
    case 'select': return (
      <input type="checkbox" checked={selected} onChange={onSelect} className="rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-offset-0 focus:ring-blue-500/50" />
    );
    case 'fullName': return (
      <button onClick={onView} className="flex items-center gap-3 text-left group-hover:text-white transition-colors">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-xs font-bold text-white shadow-sm">{contact.firstName?.[0] || '?'}</div>
        <div>
          <div className="font-medium text-zinc-200">{contact.fullName}</div>
          {contact.username && <div className="text-xs text-zinc-500">@{contact.username}</div>}
        </div>
      </button>
    );
    case 'telegramId': return <span className="font-mono text-xs text-zinc-500">{contact.telegramId}</span>;
    case 'language': return <span className="text-lg">{LANGUAGE_FLAGS[contact.language || ''] || '🌐'}</span>;
    case 'tags': return (
      <div className="flex flex-wrap gap-1">
        {contact.tags.slice(0, 2).map(t => <span key={t._id} className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-300 border border-zinc-700">{t.name}</span>)}
        {contact.tags.length > 2 && <span className="text-[10px] text-zinc-500">+{contact.tags.length - 2}</span>}
      </div>
    );
    case 'status': return contact.isBlocked ? <Badge label="Bloqueado" color="red" icon={Ban} /> : contact.activeSession ? <Badge label="En Chat" color="blue" icon={MessageSquare} /> : <Badge label="Activo" color="green" icon={CheckCircle} />;
    case 'totalSessions': return <span className="text-zinc-400">{contact.totalSessions}</span>;
    case 'totalMessages': return <span className="text-zinc-400">{contact.totalMessages}</span>;
    case 'lastActivity': return <span className="text-zinc-500 text-xs">{formatDate(contact.lastActivity)}</span>;
    case 'actions': return <button onClick={onView} className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded"><Eye className="w-4 h-4" /></button>;
    default: return (contact as any)[colId];
  }
}

function Badge({ label, color, icon: Icon }: any) {
  const s = { red: 'text-red-400 bg-red-500/10 border-red-500/20', blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20', green: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' }[color as string];
  return <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${s}`}>{Icon && <Icon className="w-3 h-3" />}{label}</span>;
}
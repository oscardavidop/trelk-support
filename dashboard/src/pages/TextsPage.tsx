/**
 * TextsPage - i18n Text Registry Management
 * Consistent with CustomFieldsPage, Supervisor, Agents pages
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Languages,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Edit3,
  Eye,
  Copy,
  Globe,
  Tag,
  Sparkles,
  Check,
  X,
  Loader2,
  Database,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import {
  getTexts,
  getCategories,
  getLanguages,
  getTextStats,
  createText,
  updateText,
  deleteText,
  translateAndSave,
  exportTexts,
  importTexts,
  reloadCache,
  seedDefaultTexts,
  type TextEntry,
  type CategoryInfo,
  type SupportedLanguage,
  type TextStats,
} from '../services/texts';
import { useSocket } from '../hooks/useSocket';
import { toast } from '../components/ui';

// ============= STAT CARD COMPONENT =============
interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'indigo';
  loading?: boolean;
}

const colorClasses = {
  blue: 'from-blue-500/20 to-cyan-500/20 text-blue-400',
  green: 'from-green-500/20 to-emerald-500/20 text-green-400',
  purple: 'from-purple-500/20 to-violet-500/20 text-purple-400',
  amber: 'from-amber-500/20 to-orange-500/20 text-amber-400',
  red: 'from-red-500/20 to-rose-500/20 text-red-400',
  indigo: 'from-indigo-500/20 to-blue-500/20 text-indigo-400',
};


// ============= DEFAULT VALUES =============
const DEFAULT_CATEGORIES: CategoryInfo[] = [
  { value: 'welcome', label: 'Bienvenida', icon: '👋' },
  { value: 'farewell', label: 'Despedida', icon: '👋' },
  { value: 'follow-up', label: 'Seguimiento', icon: '📩' },
  { value: 'notification', label: 'Notificación', icon: '🔔' },
  { value: 'error', label: 'Error', icon: '❌' },
  { value: 'menu', label: 'Menú', icon: '📋' },
  { value: 'button', label: 'Botón', icon: '🔘' },
  { value: 'system', label: 'Sistema', icon: '⚙️' },
  { value: 'custom', label: 'Personalizado', icon: '✏️' },
];

const DEFAULT_LANGUAGES: SupportedLanguage[] = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];


// ============= TEXT MODAL =============
interface TextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<TextEntry>) => Promise<void>;
  editingText: TextEntry | null;
  languages: SupportedLanguage[];
  categories: CategoryInfo[];
}

// ============= DELETE MODAL =============
interface DeleteModalProps {
  textKey: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}


// ============= MAIN PAGE =============
export default function TextsPage() {
  const [texts, setTexts] = useState<TextEntry[]>([]);
  const [languages, setLanguages] = useState<SupportedLanguage[]>(DEFAULT_LANGUAGES);
  const [categories, setCategories] = useState<CategoryInfo[]>(DEFAULT_CATEGORIES);
  const [stats, setStats] = useState<TextStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingText, setEditingText] = useState<TextEntry | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);

  const { socket } = useSocket();

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [textsRes, langsRes, catsRes, statsRes] = await Promise.all([
        getTexts({ search: searchQuery, category: selectedCategory }),
        getLanguages().catch(() => DEFAULT_LANGUAGES),
        getCategories().catch(() => DEFAULT_CATEGORIES),
        getTextStats().catch(() => null),
      ]);

      setTexts(textsRes?.data || []);
      setLanguages(langsRes || DEFAULT_LANGUAGES);
      setCategories(catsRes || DEFAULT_CATEGORIES);
      setStats(statsRes);
    } catch (error) {
      console.error('Failed to load texts:', error);
      toast.error('Error al cargar los textos');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Socket listener for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleTextsUpdated = () => {
      loadData();
    };

    socket.on('texts:updated', handleTextsUpdated);

    return () => {
      socket.off('texts:updated', handleTextsUpdated);
    };
  }, [socket, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Filtered texts
  const filteredTexts = useMemo(() => {
    return (texts || []).filter(text => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!text.key.toLowerCase().includes(query) &&
          !text.description?.toLowerCase().includes(query) &&
          !(text.tags || []).some(t => t.toLowerCase().includes(query))) {
          return false;
        }
      }
      if (selectedCategory && text.category !== selectedCategory) {
        return false;
      }
      return true;
    });
  }, [texts, searchQuery, selectedCategory]);

  // Handlers
  const handleCreate = async (data: Partial<TextEntry>) => {
    try {
      await createText({
        key: data.key!,
        defaultLang: data.defaultLang || 'es',
        texts: data.texts || {},
        description: data.description,
        category: data.category,
        tags: data.tags,
      });
      toast.success('Texto creado correctamente');
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Error al crear texto');
      throw error;
    }
  };

  const handleUpdate = async (data: Partial<TextEntry>) => {
    if (!editingText) return;

    try {
      await updateText(editingText.key, {
        texts: data.texts,
        description: data.description,
        category: data.category,
        tags: data.tags,
        defaultLang: data.defaultLang,
      });
      toast.success('Texto actualizado');
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Error al actualizar');
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deleteKey) return;

    try {
      await deleteText(deleteKey);
      toast.success('Texto eliminado');
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Error al eliminar');
    } finally {
      setDeleteKey(null);
    }
  };

  const handleTranslate = async (text: TextEntry, targetLang: string) => {
    try {
      const result = await translateAndSave(text.key, targetLang);
      toast.success(`Traducido: ${result.translatedText?.slice(0, 50)}...`);
      loadData();
    } catch (error: any) {
      toast.error(error?.message || 'Error al traducir');
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportTexts();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `texts-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exportado correctamente');
    } catch {
      toast.error('Error al exportar');
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const content = await file.text();
        const data = JSON.parse(content);
        const result = await importTexts(data, 'merge');
        toast.success(`Importados: ${result.imported}, Actualizados: ${result.updated}`);
        loadData();
      } catch {
        toast.error('Error al importar archivo');
      }
    };
    input.click();
  };

  const handleReloadCache = async () => {
    try {
      const message = await reloadCache();
      toast.success(message);
      loadData();
    } catch {
      toast.error('Error al recargar cache');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await seedDefaultTexts();
      toast.success('Textos predeterminados creados');
      loadData();
    } catch {
      toast.error('Error al crear textos predeterminados');
    }
  };

  // Stats
  const pageStats = {
    total: texts?.length || 0,
    categories: new Set((texts || []).map(t => t.category)).size,
    languages: languages?.length || 0,
    translationActive: stats?.translation?.available || false,
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-gray-950">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
     <div className="flex h-full bg-zinc-950 text-zinc-100 font-sans relative selection:bg-indigo-500/30">
       
       {/* Indigo Ambient Glow */}
       <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
 
       <div className="flex-1 flex flex-col overflow-hidden relative z-10">
         
         {/* Header Section */}
         <div className="px-8 py-6 pb-2">
           <div className="flex items-center justify-between mb-6">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-indigo-900/10">
                 <Languages className="w-6 h-6 text-indigo-500" />
               </div>
               <div>
                 <h1 className="text-2xl font-bold text-white tracking-tight">Registro de Textos</h1>
                 <p className="text-sm text-zinc-400">Internacionalización y mensajes del sistema</p>
               </div>
             </div>
 
             <div className="flex gap-3">
               <div className="flex bg-zinc-900/50 rounded-xl border border-zinc-800 p-1">
                 <button onClick={handleExport} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Exportar">
                   <Download className="w-4 h-4" />
                 </button>
                 <div className="w-px bg-zinc-800 my-1" />
                 <button onClick={handleImport} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Importar">
                   <Upload className="w-4 h-4" />
                 </button>
               </div>
 
               <button 
                 onClick={handleRefresh}
                 disabled={refreshing}
                 className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all"
               >
                 <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
               </button>
               
               <button
                 onClick={() => { setEditingText(null); setShowFormModal(true); }}
                 className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
               >
                 <Plus className="w-5 h-5" />
                 <span>Nuevo Texto</span>
               </button>
             </div>
           </div>
 
           {/* Stats Bar (Glassy) */}
           <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6">
             <StatBadge icon={Database} count={pageStats.total} label="Textos" color="text-zinc-200" bg="bg-zinc-800" />
             <div className="h-4 w-px bg-white/10" />
             <StatBadge icon={Tag} count={pageStats.categories} label="Categorías" color="text-purple-400" bg="bg-purple-500/10" />
             <div className="h-4 w-px bg-white/10" />
             <StatBadge icon={Globe} count={pageStats.languages} label="Idiomas" color="text-indigo-400" bg="bg-indigo-500/10" />
             <div className="h-4 w-px bg-white/10" />
             <StatBadge 
               icon={Sparkles} 
               count={pageStats.translationActive ? 'ON' : 'OFF'} 
               label="AI Translate" 
               color={pageStats.translationActive ? 'text-emerald-400' : 'text-zinc-500'} 
               bg={pageStats.translationActive ? 'bg-emerald-500/10' : 'bg-zinc-800'} 
             />
           </div>
 
           {/* Toolbar */}
           <div className="flex flex-wrap items-center gap-3">
             <div className="relative flex-1 min-w-[280px] max-w-md group">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
               <input
                 type="text"
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Buscar por key o contenido..."
                 className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
               />
             </div>
 
             <div className="flex items-center gap-3">
               <select
                 value={selectedCategory}
                 onChange={(e) => setSelectedCategory(e.target.value)}
                 className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 cursor-pointer"
               >
                 <option value="">Todas las categorías</option>
                 {categories.map((cat) => (
                   <option key={cat.value} value={cat.value}>
                     {cat.icon} {cat.label}
                   </option>
                 ))}
               </select>
 
               <button
                 onClick={handleReloadCache}
                 className="flex items-center gap-2 px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
               >
                 <RefreshCw className="w-4 h-4" />
                 <span className="hidden sm:inline">Recargar Cache</span>
               </button>
             </div>
           </div>
         </div>
 
         {/* Content Grid */}
         <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 custom-scrollbar">
           {filteredTexts.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
               <Languages className="w-16 h-16 mb-4 stroke-1" />
               <p className="text-lg font-medium">{searchQuery ? 'Sin resultados' : 'No hay textos configurados'}</p>
               {!searchQuery && (
                 <button onClick={handleSeedDefaults} className="mt-4 text-sm text-indigo-400 hover:underline">
                   Cargar textos predeterminados
                 </button>
               )}
             </div>
           ) : (
             <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
               {filteredTexts.map(text => (
                 <TextCard
                   key={text.key}
                   text={text}
                   languages={languages}
                   onEdit={() => { setEditingText(text); setShowFormModal(true); }}
                   onDelete={(key: string) => setDeleteKey(key)}
                   onTranslate={handleTranslate}
                 />
               ))}
             </div>
           )}
         </div>
       </div>
 
       {/* Modals */}
       {showFormModal && (
         <TextModal
           isOpen={showFormModal}
           onClose={() => { setShowFormModal(false); setEditingText(null); }}
           onSave={editingText ? handleUpdate : handleCreate}
           editingText={editingText}
           languages={languages}
           categories={categories}
         />
       )}
       
       {deleteKey && (
         <DeleteModal
           textKey={deleteKey}
           isOpen={!!deleteKey}
           onClose={() => setDeleteKey(null)}
           onConfirm={handleDelete}
         />
       )}
     </div>
   );
}


function StatBadge({ icon: Icon, count, label, color, bg }: any) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-lg ${color}`}>{count}</span>
        <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">{label}</span>
      </div>
    </div>
  );
}

function TextCard({ text, languages, onEdit, onDelete, onTranslate }: any) {
  const [expanded, setExpanded] = useState(false);
  const safeTexts = text.texts || {};
  const availableLangs = Object.keys(safeTexts);
  const safeLangs = languages || DEFAULT_LANGUAGES;
  const missingLangs = safeLangs.filter((l: any) => !availableLangs.includes(l.code));

  const categoryInfo = DEFAULT_CATEGORIES.find(c => c.value === text.category) || { icon: '✏️', label: text.category };

  return (
    <div className={`group relative bg-zinc-900/60 backdrop-blur-sm border rounded-2xl transition-all duration-300 hover:shadow-xl hover:shadow-black/20 overflow-hidden flex flex-col ${expanded ? 'border-indigo-500/30 bg-zinc-900/80' : 'border-zinc-800/50 hover:border-indigo-500/20'}`}>

      <div className="p-5 flex-1">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <code className="text-sm font-bold text-indigo-400 font-mono bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 truncate max-w-full">
                {text.key}
              </code>
              {text.isLocked && <LockIcon />}
            </div>
            {text.description && <p className="text-sm text-zinc-500 truncate">{text.description}</p>}
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setExpanded(!expanded)} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={() => onEdit(text)} className="p-2 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg">
              <Edit3 className="w-4 h-4" />
            </button>
            {!text.isLocked && (
              <button onClick={() => onDelete(text.key)} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Tags & Category */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[10px] px-2 py-0.5 bg-zinc-800 rounded-md text-zinc-400 border border-zinc-700 flex items-center gap-1">
            <span>{categoryInfo.icon}</span> {categoryInfo.label}
          </span>
          {(text.tags || []).map((tag: string) => (
            <span key={tag} className="text-[10px] px-2 py-0.5 bg-indigo-500/10 rounded-md text-indigo-300 border border-indigo-500/20">
              #{tag}
            </span>
          ))}
        </div>

        {/* Language Grid */}
        <div className="flex flex-wrap gap-2">
          {availableLangs.map(lang => {
            const langInfo = safeLangs.find((l: any) => l.code === lang);
            return (
              <div key={lang} className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg" title={langInfo?.name}>
                <span className="text-xs">{langInfo?.flag || lang}</span>
                <span className="text-[10px] font-bold text-emerald-400 uppercase">{lang}</span>
              </div>
            );
          })}
          {missingLangs.length > 0 && (
            <div className="flex items-center gap-1">
              {missingLangs.slice(0, 2).map((lang: any) => (
                <button
                  key={lang.code}
                  onClick={() => onTranslate(text, lang.code)}
                  className="px-2 py-1 bg-zinc-800 border border-zinc-700 hover:border-indigo-500/50 hover:text-indigo-300 rounded-lg text-[10px] text-zinc-500 transition-colors flex items-center gap-1"
                >
                  {lang.flag} <span className="uppercase">+</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-5 pb-5 pt-0 bg-zinc-900/50 border-t border-zinc-800/50 space-y-3 animate-in slide-in-from-top-2">
          <div className="h-2" />
          {Object.entries(safeTexts).map(([lang, content]: any) => {
            const langInfo = safeLangs.find((l: any) => l.code === lang);
            return (
              <div key={lang} className="relative group/text">
                <div className="absolute left-3 top-2.5 text-base select-none">{langInfo?.flag}</div>
                <div className="pl-10 pr-8 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-300 font-mono leading-relaxed">
                  {content}
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(content); toast.success('Copiado'); }}
                  className="absolute right-2 top-2 p-1.5 text-zinc-600 hover:text-white rounded transition-colors opacity-0 group-hover/text:opacity-100"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const LockIcon = () => (
  <div className="p-0.5 bg-amber-500/10 rounded border border-amber-500/20" title="Sistema">
    <div className="w-3 h-3 text-amber-500">🔒</div>
  </div>
);

// ============= MODALS =============

function TextModal({ isOpen, onClose, onSave, editingText, languages, categories }: TextModalProps) {
  if (!isOpen) return null;

  // Local state for form
  const [formData, setFormData] = useState({
    key: editingText?.key || '',
    description: editingText?.description || '',
    category: editingText?.category || 'custom',
    tags: (editingText?.tags || []).join(', '),
    defaultLang: editingText?.defaultLang || 'es',
    texts: editingText?.texts || { es: '' }
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      ...formData,
      tags: formData.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
    });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              {editingText ? <Edit3 className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
            </div>
            <h2 className="text-lg font-bold text-white">{editingText ? 'Editar Texto' : 'Nuevo Texto'}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          <div className="grid grid-cols-2 gap-5">
            <InputGroup
              label="Clave (Key)"
              value={formData.key}
              onChange={(e: any) => setFormData({ ...formData, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
              placeholder="MENU_WELCOME"
              disabled={!!editingText}
              mono
            />
            <InputGroup
              label="Categoría"
              type="select"
              value={formData.category}
              onChange={(e: any) => setFormData({ ...formData, category: e.target.value })}
              options={categories.map((c: any) => ({ value: c.value, label: `${c.icon} ${c.label}` }))}
            />
          </div>

          <InputGroup
            label="Descripción"
            value={formData.description}
            onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Descripción interna del uso de este texto"
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Traducciones</label>
              <div className="flex gap-2">
                {languages.filter((l: any) => !formData.texts[l.code]).map((l: any) => (
                  <button
                    key={l.code}
                    onClick={() => setFormData({ ...formData, texts: { ...formData.texts, [l.code]: '' } })}
                    className="text-xs px-2 py-1 bg-zinc-800 hover:bg-indigo-600 hover:text-white rounded border border-zinc-700 transition-colors"
                  >
                    + {l.flag} {l.code.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              {Object.entries(formData.texts).map(([lang, text]: any) => {
                const langInfo = languages.find((l: any) => l.code === lang) || { flag: '🌐', name: lang };
                return (
                  <div key={lang} className="relative group">
                    <div className="absolute left-3 top-3 text-lg select-none" title={langInfo.name}>{langInfo.flag}</div>
                    <textarea
                      value={text}
                      onChange={(e) => setFormData({ ...formData, texts: { ...formData.texts, [lang]: e.target.value } })}
                      placeholder={`Traducción en ${langInfo.name}...`}
                      rows={2}
                      className="w-full pl-10 pr-10 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                    />
                    {Object.keys(formData.texts).length > 1 && (
                      <button
                        onClick={() => {
                          const newTexts = { ...formData.texts };
                          delete newTexts[lang];
                          setFormData({ ...formData, texts: newTexts });
                        }}
                        className="absolute right-2 top-2 p-1 text-zinc-600 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <InputGroup
            label="Etiquetas (Tags)"
            value={formData.tags}
            onChange={(e: any) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="bot, error, menu..."
          />
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-zinc-900/50 border-t border-zinc-800">
          <button onClick={onClose} className="px-5 py-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all font-medium">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.key}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{editingText ? 'Guardar Cambios' : 'Crear Texto'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ textKey, isOpen, onClose, onConfirm }: DeleteModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <Trash2 className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Eliminar Texto</h2>
        <p className="text-zinc-400 mb-6">
          ¿Estás seguro de eliminar <span className="text-white font-mono bg-zinc-800 px-1 rounded">{textKey}</span>? <br />
          Esta acción podría afectar a los flujos que lo utilicen.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all font-medium">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all font-medium shadow-lg shadow-red-900/20">Eliminar</button>
        </div>
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder, type = "text", options, mono, disabled }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wide">{label}</label>
      {type === 'select' ? (
        <div className="relative">
          <select
            value={value}
            onChange={onChange}
            disabled={disabled}
            className="w-full pl-4 pr-10 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          >
            {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        </div>
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all ${mono ? 'font-mono' : ''} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
      )}
    </div>
  );
}
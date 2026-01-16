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

function StatCard({ icon, label, value, color, loading }: StatCardProps) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          {loading ? (
            <Loader2 className="w-5 h-5 text-gray-500 animate-spin mt-1" />
          ) : (
            <p className="text-2xl font-bold text-white">{value}</p>
          )}
        </div>
      </div>
    </div>
  );
}

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

// ============= TEXT CARD COMPONENT =============
function TextCard({ 
  text, 
  languages,
  onEdit, 
  onDelete,
  onTranslate,
}: { 
  text: TextEntry;
  languages: SupportedLanguage[];
  onEdit: (text: TextEntry) => void;
  onDelete: (key: string) => void;
  onTranslate: (text: TextEntry, lang: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const safeTexts = text.texts || {};
  const availableLangs = Object.keys(safeTexts);
  const safeLangs = languages || DEFAULT_LANGUAGES;
  const missingLangs = safeLangs.filter(l => !availableLangs.includes(l.code));
  
  const getCategoryInfo = (cat: string) => {
    const info = DEFAULT_CATEGORIES.find(c => c.value === cat);
    return info || { icon: '✏️', label: cat };
  };
  
  const categoryInfo = getCategoryInfo(text.category);
  
  return (
    <div className="group flex flex-col p-4 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-gray-700 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <code className="text-sm font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
              {text.key}
            </code>
            {text.isLocked && (
              <span className="text-xs text-amber-400" title="Usado en flows">
                🔒
              </span>
            )}
          </div>
          {text.description && (
            <p className="text-sm text-gray-500 mt-1 truncate">
              {text.description}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(text)}
            className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
            title="Editar"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>
          {!text.isLocked && (
            <button
              onClick={() => onDelete(text.key)}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Category & Tags */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="text-xs px-2 py-0.5 bg-gray-800 rounded-full text-gray-300 border border-gray-700">
          {categoryInfo.icon} {categoryInfo.label}
        </span>
        {(text.tags || []).slice(0, 3).map(tag => (
          <span 
            key={tag}
            className="text-xs px-2 py-0.5 bg-blue-500/10 rounded-full text-blue-400 border border-blue-500/20"
          >
            {tag}
          </span>
        ))}
        {(text.tags || []).length > 3 && (
          <span className="text-xs text-gray-500">+{text.tags.length - 3}</span>
        )}
      </div>
      
      {/* Languages Preview */}
      <div className="flex flex-wrap gap-1 mb-2">
        {availableLangs.map(lang => {
          const langInfo = safeLangs.find(l => l.code === lang);
          return (
            <span 
              key={lang}
              className="text-sm px-1.5 py-0.5 bg-green-500/10 rounded text-green-400 border border-green-500/20"
              title={langInfo?.name || lang}
            >
              {langInfo?.flag || lang}
            </span>
          );
        })}
        {missingLangs.slice(0, 3).map(lang => (
          <button
            key={lang.code}
            onClick={() => onTranslate(text, lang.code)}
            className="text-sm px-1.5 py-0.5 bg-gray-800 rounded text-gray-500 hover:bg-indigo-500/10 hover:text-indigo-400 transition-colors border border-gray-700 hover:border-indigo-500/30"
            title={`Traducir a ${lang.name}`}
          >
            {lang.flag}+
          </button>
        ))}
      </div>
      
      {/* Expanded View */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-800 space-y-2">
          {Object.entries(safeTexts).map(([lang, content]) => {
            const langInfo = safeLangs.find(l => l.code === lang);
            return (
              <div key={lang} className="flex items-start gap-2">
                <span className="text-sm shrink-0 w-8">{langInfo?.flag || lang}</span>
                <p className="text-sm text-gray-300 break-words flex-1">
                  {content}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(content);
                    toast.success('Copiado al portapapeles');
                  }}
                  className="p-1 text-gray-500 hover:text-gray-300 shrink-0"
                >
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          
          {/* Usage Info */}
          {(text.usedIn || []).length > 0 && (
            <div className="pt-2 border-t border-gray-800">
              <p className="text-xs text-gray-500">
                Usado en {text.usedIn.length} flow(s): {text.usedIn.map(u => u.flowName).join(', ')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============= TEXT MODAL =============
interface TextModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<TextEntry>) => Promise<void>;
  editingText: TextEntry | null;
  languages: SupportedLanguage[];
  categories: CategoryInfo[];
}

function TextModal({
  isOpen,
  onClose,
  onSave,
  editingText,
  languages,
  categories,
}: TextModalProps) {
  const safeLangs = languages?.length ? languages : DEFAULT_LANGUAGES;
  const safeCats = categories?.length ? categories : DEFAULT_CATEGORIES;
  
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('custom');
  const [tags, setTags] = useState('');
  const [defaultLang, setDefaultLang] = useState('es');
  const [texts, setTexts] = useState<Record<string, string>>({ es: '' });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      if (editingText) {
        setKey(editingText.key);
        setDescription(editingText.description || '');
        setCategory(editingText.category);
        setTags((editingText.tags || []).join(', '));
        setDefaultLang(editingText.defaultLang);
        setTexts(editingText.texts || { es: '' });
      } else {
        setKey('');
        setDescription('');
        setCategory('custom');
        setTags('');
        setDefaultLang('es');
        setTexts({ es: '' });
      }
      setErrors({});
      setShowLangDropdown(false);
    }
  }, [editingText, isOpen]);
  
  const handleAddLanguage = (lang: string) => {
    if (!texts[lang]) {
      setTexts({ ...texts, [lang]: '' });
    }
  };
  
  const handleRemoveLanguage = (lang: string) => {
    if (Object.keys(texts).length > 1) {
      const newTexts = { ...texts };
      delete newTexts[lang];
      setTexts(newTexts);
      if (defaultLang === lang) {
        setDefaultLang(Object.keys(newTexts)[0]);
      }
    }
  };
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!key.trim()) {
      newErrors.key = 'La clave es requerida';
    } else if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
      newErrors.key = 'Debe empezar con letra, solo mayúsculas, números y _';
    }
    
    if (Object.values(texts).every(t => !t.trim())) {
      newErrors.texts = 'Al menos un texto es requerido';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSave = async () => {
    if (!validate()) return;
    
    setSaving(true);
    try {
      await onSave({
        key,
        description,
        category: category as TextEntry['category'],
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        defaultLang,
        texts,
      });
      onClose();
    } catch {
      // Error handled in parent
    } finally {
      setSaving(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl">
              <Languages className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">
              {editingText ? 'Editar Texto' : 'Nuevo Texto'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Key */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Key (identificador) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              placeholder="WELCOME_MESSAGE"
              disabled={!!editingText}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            {errors.key && <p className="mt-1 text-sm text-red-400">{errors.key}</p>}
          </div>
          
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descripción
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Mensaje de bienvenida inicial"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {/* Category & Default Lang */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {safeCats.map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Idioma por defecto
              </label>
              <select
                value={defaultLang}
                onChange={(e) => setDefaultLang(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {Object.keys(texts).map(lang => {
                  const langInfo = safeLangs.find(l => l.code === lang);
                  return (
                    <option key={lang} value={lang}>
                      {langInfo?.flag} {langInfo?.name || lang}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          
          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Etiquetas (separadas por coma)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="bot, bienvenida, onboarding"
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          {/* Translations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-300">
                Traducciones <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <button 
                  type="button"
                  onClick={() => setShowLangDropdown(!showLangDropdown)}
                  className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-indigo-500/10"
                >
                  <Plus className="w-4 h-4" /> Añadir idioma
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showLangDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-gray-800 rounded-xl shadow-xl border border-gray-700 py-1 min-w-[160px] z-50">
                    {safeLangs.filter(l => !texts[l.code]).map(lang => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          handleAddLanguage(lang.code);
                          setShowLangDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 flex items-center gap-2 text-gray-300"
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                    {safeLangs.filter(l => !texts[l.code]).length === 0 && (
                      <p className="px-4 py-2 text-sm text-gray-500">Todos los idiomas agregados</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              {Object.keys(texts).map(lang => {
                const langInfo = safeLangs.find(l => l.code === lang);
                return (
                  <div key={lang} className="relative">
                    <div className="absolute left-3 top-3 text-sm">
                      {langInfo?.flag || lang}
                    </div>
                    <textarea
                      value={texts[lang]}
                      onChange={(e) => setTexts({ ...texts, [lang]: e.target.value })}
                      placeholder={`Texto en ${langInfo?.name || lang}...`}
                      rows={2}
                      className="w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {Object.keys(texts).length > 1 && (
                      <button
                        onClick={() => handleRemoveLanguage(lang)}
                        className="absolute right-2 top-2 p-1 text-gray-500 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {errors.texts && <p className="mt-1 text-sm text-red-400">{errors.texts}</p>}
            
            <p className="text-xs text-gray-500 mt-2">
              Variables: {'{{user.firstName}}'}, {'{{agent.name}}'}, {'{{custom.field}}'}
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {editingText ? 'Guardar cambios' : 'Crear texto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= DELETE MODAL =============
interface DeleteModalProps {
  textKey: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteModal({ textKey, isOpen, onClose, onConfirm }: DeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 text-red-400 mb-4">
          <div className="p-2 bg-red-500/20 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Eliminar texto</h3>
        </div>
        <p className="text-gray-400 mb-2">
          ¿Eliminar el texto <strong className="text-white">"{textKey}"</strong>?
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium rounded-xl hover:from-red-600 hover:to-rose-700 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl">
            <Languages className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Textos Internacionalizados</h1>
            <p className="text-sm text-gray-400">Gestiona los textos del sistema en múltiples idiomas</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExport}
            className="p-2.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105"
            title="Exportar JSON"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={handleImport}
            className="p-2.5 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-xl text-gray-300 transition-all hover:scale-105"
            title="Importar JSON"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all hover:scale-105 ${
              showFilters
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
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
            onClick={() => {
              setEditingText(null);
              setShowFormModal(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl text-white font-medium transition-all hover:scale-105 shadow-lg shadow-indigo-500/25"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Texto</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 p-6 border-b border-gray-800">
        <StatCard icon={<Database className="w-5 h-5" />} label="Total Textos" value={pageStats.total} color="indigo" />
        <StatCard icon={<Tag className="w-5 h-5" />} label="Categorías" value={pageStats.categories} color="purple" />
        <StatCard icon={<Globe className="w-5 h-5" />} label="Idiomas" value={pageStats.languages} color="blue" />
        <StatCard 
          icon={<Sparkles className="w-5 h-5" />} 
          label="Auto-traducción" 
          value={pageStats.translationActive ? 'Activa' : 'Inactiva'} 
          color={pageStats.translationActive ? 'green' : 'amber'} 
        />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="border-b border-gray-800 px-6 py-4 bg-gray-900/50">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por key, descripción o etiqueta..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-40"
            >
              <option value="">Todas las categorías</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.icon} {cat.label}
                </option>
              ))}
            </select>
            
            <button
              onClick={handleReloadCache}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-xl text-gray-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recargar Cache
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTexts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-gray-800/50 rounded-2xl mb-4">
              <Languages className="w-12 h-12 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {searchQuery || selectedCategory ? 'Sin resultados' : 'Sin textos configurados'}
            </h3>
            <p className="text-gray-500 mb-6 text-center max-w-md">
              {searchQuery || selectedCategory 
                ? 'No se encontraron textos que coincidan'
                : 'Crea textos internacionalizados o carga los predeterminados'}
            </p>
            {!searchQuery && !selectedCategory && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFormModal(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Crear Texto
                </button>
                <button
                  onClick={handleSeedDefaults}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-xl transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Usar predeterminados
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Textos configurados ({filteredTexts.length})
              </h3>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredTexts.map(text => (
                  <TextCard
                    key={text.key}
                    text={text}
                    languages={languages}
                    onEdit={(t) => {
                      setEditingText(t);
                      setShowFormModal(true);
                    }}
                    onDelete={(key) => setDeleteKey(key)}
                    onTranslate={handleTranslate}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Modals */}
      <TextModal
        isOpen={showFormModal}
        onClose={() => {
          setShowFormModal(false);
          setEditingText(null);
        }}
        onSave={editingText ? handleUpdate : handleCreate}
        editingText={editingText}
        languages={languages}
        categories={categories}
      />
      
      <DeleteModal
        textKey={deleteKey || ''}
        isOpen={!!deleteKey}
        onClose={() => setDeleteKey(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

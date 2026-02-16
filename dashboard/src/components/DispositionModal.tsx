/**
 * DispositionModal - Premium Zinc Refactor
 * Enterprise-grade session closure & disposition UI
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  X, Search, ChevronDown, Check, AlertCircle, Tag, MessageSquare, Loader2,
  Zap, Frown, ArrowUp, Bug, Calendar, Star, CreditCard, Wrench,
  AlertTriangle, ShoppingCart, Clock, MoreHorizontal, LayoutGrid, FileText
} from 'lucide-react';

// ============= TYPES =============

interface Subcategory {
  _id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  order: number;
}

interface Category {
  _id: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  color?: string;
  subcategories: Subcategory[];
  requiresComment: boolean;
  minCommentLength: number;
  isActive: boolean;
  order: number;
}

interface DispositionTag {
  _id: string;
  name: string;
  code: string;
  color?: string;
  icon?: string;
  isActive: boolean;
}

interface DispositionSettings {
  requireDisposition: boolean;
  requireComment: boolean;
  minCommentLength: number;
  maxCommentLength: number;
  allowCustomTags: boolean;
}

interface DispositionData {
  categoryId: string;
  subcategoryId?: string;
  comment?: string;
  tags?: string[];
}

interface DispositionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (disposition: DispositionData) => void;
  sessionId: string;
  contactName?: string;
  isLoading?: boolean;
}

// ============= UTILS =============

const ICON_MAP: Record<string, React.ReactNode> = {
  CreditCard: <CreditCard className="h-4 w-4" />,
  Wrench: <Wrench className="h-4 w-4" />,
  AlertTriangle: <AlertTriangle className="h-4 w-4" />,
  ShoppingCart: <ShoppingCart className="h-4 w-4" />,
  Clock: <Clock className="h-4 w-4" />,
  MoreHorizontal: <MoreHorizontal className="h-4 w-4" />,
  Zap: <Zap className="h-4 w-4" />,
  Frown: <Frown className="h-4 w-4" />,
  ArrowUp: <ArrowUp className="h-4 w-4" />,
  Bug: <Bug className="h-4 w-4" />,
  Calendar: <Calendar className="h-4 w-4" />,
  Star: <Star className="h-4 w-4" />,
};

// ============= COMPONENT =============

export function DispositionModal({
  isOpen,
  onClose,
  onConfirm,
  sessionId,
  contactName,
  isLoading: externalLoading,
}: DispositionModalProps) {
  // --- State ---
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<DispositionTag[]>([]);
  const [settings, setSettings] = useState<DispositionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<Subcategory | null>(null);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // UI State
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [subcategoryDropdownOpen, setSubcategoryDropdownOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [subcategorySearch, setSubcategorySearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Refs
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const subcategoryInputRef = useRef<HTMLInputElement>(null);
  const categoryListRef = useRef<HTMLDivElement>(null);
  const subcategoryListRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      setLoading(true); setError('');
      try {
        const res = await fetch('/api/dispositions/modal-data');
        const data = await res.json();
        if (data.ok) {
          setCategories(data.categories || []);
          setTags(data.tags || []);
          setSettings(data.settings || null);
          if (data.settings.defaultCategoryId) {
            const defaultCat = data.categories.find((c: Category) => c._id === data.settings.defaultCategoryId);
            if (defaultCat) setSelectedCategory(defaultCat);
          }
        } else setError(data.error || 'Error al cargar datos');
      } catch { setError('Error de conexión'); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSelectedCategory(null); setSelectedSubcategory(null);
      setComment(''); setSelectedTags([]);
      setCategorySearch(''); setSubcategorySearch('');
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  // --- Logic ---

  const filteredCategories = useMemo(() => {
    if (!categorySearch) return categories;
    const search = categorySearch.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(search) || c.code.toLowerCase().includes(search));
  }, [categories, categorySearch]);

  const filteredSubcategories = useMemo(() => {
    if (!selectedCategory) return [];
    const subs = selectedCategory.subcategories.filter(s => s.isActive);
    if (!subcategorySearch) return subs;
    const search = subcategorySearch.toLowerCase();
    return subs.filter(s => s.name.toLowerCase().includes(search) || s.code.toLowerCase().includes(search));
  }, [selectedCategory, subcategorySearch]);

  const commentRequired = useMemo(() => settings?.requireComment || selectedCategory?.requiresComment || false, [settings, selectedCategory]);
  const minCommentLength = useMemo(() => selectedCategory?.minCommentLength || settings?.minCommentLength || 10, [selectedCategory, settings]);

  const isValid = useMemo(() => {
    if (!selectedCategory) return false;
    if (selectedCategory.subcategories.filter(s => s.isActive).length > 0 && !selectedSubcategory) return false;
    if (commentRequired && (!comment.trim() || comment.trim().length < minCommentLength)) return false;
    if (settings && comment.length > settings.maxCommentLength) return false;
    return true;
  }, [selectedCategory, selectedSubcategory, comment, commentRequired, minCommentLength, settings]);

  // --- Handlers ---

  const handleSelectCategory = (category: Category) => {
    setSelectedCategory(category);
    setSelectedSubcategory(null);
    setCategoryDropdownOpen(false);
    setCategorySearch('');
    
    // Auto-open subcategory if available
    if (category.subcategories.filter(s => s.isActive).length > 0) {
      setTimeout(() => { setSubcategoryDropdownOpen(true); subcategoryInputRef.current?.focus(); }, 100);
    }
  };

  const handleConfirm = () => {
    if (!isValid || !selectedCategory) return;
    onConfirm({
      categoryId: selectedCategory._id,
      subcategoryId: selectedSubcategory?._id,
      comment: comment.trim() || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    });
  };

  // Click Outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.category-dropdown')) setCategoryDropdownOpen(false);
      if (!target.closest('.subcategory-dropdown')) setSubcategoryDropdownOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 tracking-tight">Finalizar Conversación</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Tipifica el contacto con {contactName || 'el usuario'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" /> {error}
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Category Select */}
              <div className="category-dropdown relative space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase r flex items-center gap-1.5">
                  <LayoutGrid className="w-3 h-3" /> Categoría <span className="text-red-500">*</span>
                </label>
                
                <div 
                  className={`relative cursor-pointer bg-zinc-950 border rounded-xl transition-all ${categoryDropdownOpen ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-zinc-800 hover:border-zinc-700'}`}
                >
                  <div 
                    className="flex items-center justify-between px-4 py-3"
                    onClick={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setHighlightedIndex(0); }}
                  >
                    {selectedCategory ? (
                      <div className="flex items-center gap-2.5">
                        <span 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: selectedCategory.color || '#6366f1', boxShadow: `0 0 8px ${selectedCategory.color}40` }} 
                        />
                        <span className="text-sm font-medium text-zinc-100">{selectedCategory.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-500">Seleccionar categoría...</span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${categoryDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Dropdown Menu */}
                  {categoryDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                      <div className="p-2 border-b border-zinc-800">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                          <input
                            ref={categoryInputRef}
                            type="text"
                            value={categorySearch}
                            onChange={(e) => { setCategorySearch(e.target.value); setHighlightedIndex(0); }}
                            placeholder="Buscar..."
                            className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-50 focus:border-indigo-500 outline-none"
                            autoFocus
                          />
                        </div>
                      </div>
                      <div ref={categoryListRef} className="max-h-48 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-zinc-700">
                        {filteredCategories.length === 0 ? (
                          <div className="py-3 text-center text-xs text-zinc-500">No hay resultados</div>
                        ) : (
                          filteredCategories.map((cat, idx) => (
                            <div
                              key={cat._id}
                              onClick={() => handleSelectCategory(cat)}
                              className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                selectedCategory?._id === cat._id ? 'bg-indigo-500/10' : 'hover:bg-zinc-800'
                              }`}
                            >
                              <div className="p-1.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700">
                                {ICON_MAP[cat.icon || 'MoreHorizontal']}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${selectedCategory?._id === cat._id ? 'text-indigo-400' : 'text-zinc-200'}`}>
                                  {cat.name}
                                </p>
                                {cat.description && <p className="text-[10px] text-zinc-500 truncate">{cat.description}</p>}
                              </div>
                              {selectedCategory?._id === cat._id && <Check className="w-3.5 h-3.5 text-indigo-500" />}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Subcategory Select */}
              {selectedCategory && selectedCategory.subcategories.filter(s => s.isActive).length > 0 && (
                <div className="subcategory-dropdown relative space-y-2 animate-in fade-in slide-in-from-top-1">
                  <label className="text-xs font-bold text-zinc-500 uppercase r flex items-center gap-1.5">
                    <ArrowUp className="w-3 h-3 rotate-45" /> Subcategoría <span className="text-red-500">*</span>
                  </label>
                  
                  <div 
                    className={`relative cursor-pointer bg-zinc-950 border rounded-xl transition-all ${subcategoryDropdownOpen ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 'border-zinc-800 hover:border-zinc-700'}`}
                  >
                    <div 
                      className="flex items-center justify-between px-4 py-3"
                      onClick={() => { setSubcategoryDropdownOpen(!subcategoryDropdownOpen); setHighlightedIndex(0); }}
                    >
                      {selectedSubcategory ? (
                        <span className="text-sm font-medium text-zinc-100">{selectedSubcategory.name}</span>
                      ) : (
                        <span className="text-sm text-zinc-500">Seleccionar subcategoría...</span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-zinc-500 transition-transform ${subcategoryDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {subcategoryDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in">
                        <div className="p-2 border-b border-zinc-800">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                            <input
                              ref={subcategoryInputRef}
                              type="text"
                              value={subcategorySearch}
                              onChange={(e) => setSubcategorySearch(e.target.value)}
                              placeholder="Buscar..."
                              className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-50 focus:border-indigo-500 outline-none"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div ref={subcategoryListRef} className="max-h-40 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-zinc-700">
                          {filteredSubcategories.length === 0 ? (
                            <div className="py-3 text-center text-xs text-zinc-500">Sin resultados</div>
                          ) : (
                            filteredSubcategories.map((sub, idx) => (
                              <div
                                key={sub._id}
                                onClick={() => { setSelectedSubcategory(sub); setSubcategoryDropdownOpen(false); }}
                                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                  selectedSubcategory?._id === sub._id ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-300 hover:bg-zinc-800'
                                }`}
                              >
                                <span className="text-sm">{sub.name}</span>
                                {selectedSubcategory?._id === sub._id && <Check className="w-3.5 h-3.5" />}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comment Box */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase r flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> 
                  Comentario {commentRequired && <span className="text-red-500">*</span>}
                </label>
                <div className="relative group">
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={`Detalles de la gestión${commentRequired ? ` (mínimo ${minCommentLength} caracteres)` : ''}...`}
                    className={`w-full px-4 py-3 bg-zinc-950 border rounded-xl text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all ${
                      commentRequired && comment.length > 0 && comment.length < minCommentLength 
                        ? 'border-red-500/50 focus:border-red-500' 
                        : 'border-zinc-800 focus:border-indigo-500'
                    }`}
                    rows={3}
                    maxLength={settings?.maxCommentLength || 500}
                  />
                  <div className="absolute bottom-2 right-2 text-[10px] text-zinc-600 font-mono">
                    {comment.length}/{settings?.maxCommentLength || 500}
                  </div>
                </div>
                {commentRequired && comment.length > 0 && comment.length < minCommentLength && (
                  <p className="text-xs text-red-400 flex items-center gap-1 animate-in slide-in-from-left-1">
                    <AlertCircle className="w-3 h-3" /> Faltan {minCommentLength - comment.length} caracteres
                  </p>
                )}
              </div>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase r flex items-center gap-1.5">
                    <Tag className="w-3 h-3" /> Tags Rápidos
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => {
                      const isSelected = selectedTags.includes(tag.code);
                      return (
                        <button
                          key={tag._id}
                          type="button"
                          onClick={() => setSelectedTags(p => p.includes(tag.code) ? p.filter(t => t !== tag.code) : [...p, tag.code])}
                          className={`
                            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                            ${isSelected 
                              ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300 ring-1 ring-indigo-500/20' 
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-900'
                            }
                          `}
                        >
                          {ICON_MAP[tag.icon || 'Tag'] || <Tag className="w-3 h-3" />}
                          {tag.name}
                          {isSelected && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <div className="flex flex-col gap-0.5">
             <div className="flex items-center gap-2 text-xs text-zinc-500">
               <span className={`w-1.5 h-1.5 rounded-full ${selectedCategory ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
               Categoría
             </div>
             {selectedCategory?.subcategories && selectedCategory.subcategories.length > 0 && (
               <div className="flex items-center gap-2 text-xs text-zinc-500">
                 <span className={`w-1.5 h-1.5 rounded-full ${selectedSubcategory ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
                 Subcategoría
               </div>
             )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-xl transition-colors uppercase "
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValid || externalLoading}
              className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 text-zinc-50 text-xs font-bold uppercase  rounded-xl shadow-lg shadow-red-500/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {externalLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cerrando...
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" /> Confirmar Cierre
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
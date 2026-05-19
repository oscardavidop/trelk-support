/**
 * DispositionsPage - Enterprise Chat Disposition (Tipificación) Management
 * Manage categories, subcategories, tags and settings for chat closing
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTranslation } from '../../node_modules/react-i18next';
import {
    Tag,
    Plus,
    Search,
    Edit3,
    Trash2,
    Loader2,
    RefreshCw,
    Filter,
    CheckCircle,
    X,
    Layers,
    FolderTree,
    Settings2,
    ChevronDown,
    ChevronRight,
    GripVertical,
    MessageSquare,
    BarChart3,
    AlertCircle,
    Save,
    ToggleLeft,
    ToggleRight,
    FileText,
    Hash,
    ArrowLeft
} from 'lucide-react';
import { toast } from '../stores/toastStore';

// Types
interface DispositionSubcategory {
    _id: string;
    name: string;
    code?: string;
    description?: string;
    order: number;
    isActive: boolean;
}

interface DispositionCategory {
    _id: string;
    name: string;
    code: string;
    description?: string;
    color: string;
    icon?: string;
    order: number;
    isActive: boolean;
    requiresComment: boolean;
    subcategories: DispositionSubcategory[];
    usageCount: number;
    createdAt: string;
    updatedAt: string;
}

interface DispositionTag {
    _id: string;
    name: string;
    code: string;
    color: string;
    description?: string;
    isActive: boolean;
    usageCount: number;
}

interface DispositionSettings {
    requireDisposition: boolean;
    allowCustomComment: boolean;
    minCommentLength: number;
    maxCommentLength: number;
    defaultCategoryId?: string;
}

interface Stats {
    totalCategories: number;
    activeCategories: number;
    totalSubcategories: number;
    totalTags: number;
    totalDispositions: number;
    topCategories: { name: string; count: number }[];
}

// Color options for categories and tags
const COLORS = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#84CC16', // Lime
];

type TabType = 'categories' | 'tags' | 'settings' | 'stats';

export default function DispositionsPage() {
    const { t } = useTranslation();
    const token = useAuthStore((state) => state.token);

    // Data state
    const [categories, setCategories] = useState<DispositionCategory[]>([]);
    const [tags, setTags] = useState<DispositionTag[]>([]);
    const [settings, setSettings] = useState<DispositionSettings>({
        requireDisposition: true,
        allowCustomComment: true,
        minCommentLength: 0,
        maxCommentLength: 1000,
    });
    const [stats, setStats] = useState<Stats | null>(null);

    // UI state
    const [activeTab, setActiveTab] = useState<TabType>('categories');
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    // Modal state
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
    const [showTagModal, setShowTagModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState<DispositionCategory | null>(null);
    const [editingSubcategory, setEditingSubcategory] = useState<DispositionSubcategory | null>(null);
    const [editingTag, setEditingTag] = useState<DispositionTag | null>(null);
    const [parentCategoryId, setParentCategoryId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'category' | 'subcategory' | 'tag'; id: string; parentId?: string } | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [savingSettings, setSavingSettings] = useState(false);

    // Form state
    const [categoryForm, setCategoryForm] = useState({
        name: '',
        code: '',
        description: '',
        color: COLORS[0],
        requiresComment: false,
        isActive: true,
    });
    const [subcategoryForm, setSubcategoryForm] = useState({
        name: '',
        code: '',
        description: '',
        isActive: true,
    });
    const [tagForm, setTagForm] = useState({
        name: '',
        code: '',
        description: '',
        color: COLORS[0],
        isActive: true,
    });

    // Load data on mount
    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setIsLoading(true);
        try {
            await Promise.all([loadCategories(), loadTags(), loadSettings(), loadStats()]);
        } finally {
            setIsLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const res = await fetch('/api/admin/dispositions/categories?includeInactive=true', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.ok) {
                setCategories(data.categories);
            }
        } catch (error) {
            console.error('Failed to load categories:', error);
        }
    };

    const loadTags = async () => {
        try {
            const res = await fetch('/api/admin/dispositions/tags?includeInactive=true', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.ok) {
                setTags(data.tags);
            }
        } catch (error) {
            console.error('Failed to load tags:', error);
        }
    };

    const loadSettings = async () => {
        try {
            const res = await fetch('/api/admin/dispositions/settings', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.ok && data.settings) {
                setSettings(data.settings);
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    };

    const loadStats = async () => {
        try {
            const res = await fetch('/api/admin/dispositions/stats', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (data.ok) {
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAllData();
        setRefreshing(false);
    };

    // Category handlers
    const openCategoryModal = (category?: DispositionCategory) => {
        if (category) {
            setEditingCategory(category);
            setCategoryForm({
                name: category.name,
                code: category.code || '',
                description: category.description || '',
                color: category.color,
                requiresComment: category.requiresComment,
                isActive: category.isActive,
            });
        } else {
            setEditingCategory(null);
            setCategoryForm({
                name: '',
                code: '',
                description: '',
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                requiresComment: false,
                isActive: true,
            });
        }
        setShowCategoryModal(true);
    };

    const saveCategory = async () => {
        if (!categoryForm.name.trim()) return;

        setIsSaving(true);
        try {
            const url = editingCategory
                ? `/api/admin/dispositions/categories/${editingCategory._id}`
                : '/api/admin/dispositions/categories';

            const res = await fetch(url, {
                method: editingCategory ? 'PATCH' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(categoryForm),
            });

            const data = await res.json();
            if (data.ok) {
                await loadCategories();
                setShowCategoryModal(false);
            }
        } catch (error) {
            console.error('Failed to save category:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Subcategory handlers
    const openSubcategoryModal = (categoryId: string, subcategory?: DispositionSubcategory) => {
        setParentCategoryId(categoryId);
        if (subcategory) {
            setEditingSubcategory(subcategory);
            setSubcategoryForm({
                name: subcategory.name,
                code: subcategory.code || '',
                description: subcategory.description || '',
                isActive: subcategory.isActive,
            });
        } else {
            setEditingSubcategory(null);
            setSubcategoryForm({
                name: '',
                code: '',
                description: '',
                isActive: true,
            });
        }
        setShowSubcategoryModal(true);
    };

    const saveSubcategory = async () => {
        if (!subcategoryForm.name.trim() || !parentCategoryId) return;

        setIsSaving(true);
        try {
            const url = editingSubcategory
                ? `/api/admin/dispositions/categories/${parentCategoryId}/subcategories/${editingSubcategory._id}`
                : `/api/admin/dispositions/categories/${parentCategoryId}/subcategories`;

            const res = await fetch(url, {
                method: editingSubcategory ? 'PATCH' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(subcategoryForm),
            });

            const data = await res.json();
            if (data.ok) {
                await loadCategories();
                setShowSubcategoryModal(false);
            }
        } catch (error) {
            console.error('Failed to save subcategory:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Tag handlers
    const openTagModal = (tag?: DispositionTag) => {
        if (tag) {
            setEditingTag(tag);
            setTagForm({
                name: tag.name,
                code: tag.code || '',
                description: tag.description || '',
                color: tag.color,
                isActive: tag.isActive,
            });
        } else {
            setEditingTag(null);
            setTagForm({
                name: '',
                code: '',
                description: '',
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                isActive: true,
            });
        }
        setShowTagModal(true);
    };

    const saveTag = async () => {
        if (!tagForm.name.trim()) return;

        setIsSaving(true);
        try {
            const url = editingTag
                ? `/api/admin/dispositions/tags/${editingTag._id}`
                : '/api/admin/dispositions/tags';

            const res = await fetch(url, {
                method: editingTag ? 'PATCH' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(tagForm),
            });

            const data = await res.json();
            if (data.ok) {
                await loadTags();
                setShowTagModal(false);
            }
        } catch (error) {
            console.error('Failed to save tag:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Delete handlers
    const confirmDelete = (type: 'category' | 'subcategory' | 'tag', id: string, parentId?: string) => {
        setDeleteTarget({ type, id, parentId });
        setShowDeleteModal(true);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;

        setIsSaving(true);
        try {
            let url = '';
            if (deleteTarget.type === 'category') {
                url = `/api/admin/dispositions/categories/${deleteTarget.id}`;
            } else if (deleteTarget.type === 'subcategory' && deleteTarget.parentId) {
                url = `/api/admin/dispositions/categories/${deleteTarget.parentId}/subcategories/${deleteTarget.id}`;
            } else if (deleteTarget.type === 'tag') {
                url = `/api/admin/dispositions/tags/${deleteTarget.id}`;
            }

            const res = await fetch(url, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            const data = await res.json();
            if (data.ok) {
                if (deleteTarget.type === 'tag') {
                    await loadTags();
                } else {
                    await loadCategories();
                }
                setShowDeleteModal(false);
                setDeleteTarget(null);
            }
        } catch (error) {
            console.error('Failed to delete:', error);
        } finally {
            setIsSaving(false);
        }
    };

    // Settings handlers
    const saveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch('/api/admin/dispositions/settings', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(settings),
            });

            const data = await res.json();
            if (data.ok) {
                toast.success('Configuración guardada', 'Los ajustes de tipificación se han actualizado correctamente.');
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
        } finally {
            setSavingSettings(false);
        }
    };

    // Toggle category expansion
    const toggleCategoryExpand = (categoryId: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) {
                next.delete(categoryId);
            } else {
                next.add(categoryId);
            }
            return next;
        });
    };

    // Filter categories by search
    const filteredCategories = categories.filter(cat => {
        if (!showInactive && !cat.isActive) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (cat.name.toLowerCase().includes(query)) return true;
            if (cat.description?.toLowerCase().includes(query)) return true;
            if (cat.subcategories.some(sub => sub.name.toLowerCase().includes(query))) return true;
            return false;
        }
        return true;
    });

    // Filter tags by search
    const filteredTags = tags.filter(tag => {
        if (!showInactive && !tag.isActive) return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return tag.name.toLowerCase().includes(query) || tag.description?.toLowerCase().includes(query);
        }
        return true;
    });

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full bg-zinc-950">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
                            {/* back boton */}
                            <button
                                onClick={() => window.history.back()}
                                className="p-2 rounded-lg hover:bg-zinc-800/50 transition-colors"
                            >
                                <ArrowLeft className="w-6 h-6 text-blue-500" />
                            </button>
                            <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-blue-900/10">
                                <Tag className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Tipificación de Chats</h1>
                                <p className="text-sm text-zinc-400">Gestiona categorías, subcategorías y etiquetas para el cierre</p>
                            </div>
                        </div>

                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-50 transition-all"
                        >
                            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
                        </button>
                    </div>

                    {/* Quick Stats Bar */}
                    <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6">
                        <StatBadge icon={FolderTree} count={categories.filter(c => c.isActive).length} label="Categorías" color="text-blue-400" bg="bg-blue-500/10" />
                        <div className="h-4 w-px bg-white/10" />
                        <StatBadge icon={Layers} count={categories.reduce((acc, cat) => acc + cat.subcategories.filter(s => s.isActive).length, 0)} label="Subcategorías" color="text-purple-400" bg="bg-purple-500/10" />
                        <div className="h-4 w-px bg-white/10" />
                        <StatBadge icon={Tag} count={tags.filter(t => t.isActive).length} label="Etiquetas" color="text-amber-400" bg="bg-amber-500/10" />
                        <div className="h-4 w-px bg-white/10" />
                        <StatBadge icon={BarChart3} count={stats?.totalDispositions || 0} label="Usos" color="text-green-400" bg="bg-green-500/10" />
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg w-fit mb-4">
                        {[
                            { id: 'categories', label: 'Categorías', icon: FolderTree },
                            { id: 'tags', label: 'Etiquetas', icon: Tag },
                            { id: 'settings', label: 'Configuración', icon: Settings2 },
                            { id: 'stats', label: 'Estadísticas', icon: BarChart3 },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as TabType)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.id
                                        ? 'bg-blue-600 text-zinc-50'
                                        : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">

                    {/* Search and Filters */}
                    {(activeTab === 'categories' || activeTab === 'tags') && (
                        <div className="flex items-center gap-4 mb-6">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showInactive}
                                    onChange={(e) => setShowInactive(e.target.checked)}
                                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-blue-500"
                                />
                                Mostrar inactivos
                            </label>

                            <button
                                onClick={() => activeTab === 'categories' ? openCategoryModal() : openTagModal()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-zinc-50 rounded-lg transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                {activeTab === 'categories' ? 'Nueva Categoría' : 'Nueva Etiqueta'}
                            </button>
                        </div>
                    )}

                    {/* Categories Tab */}
                    {activeTab === 'categories' && (
                        <div className="space-y-3">
                            {filteredCategories.length === 0 ? (
                                <div className="text-center py-12 text-zinc-500">
                                    <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No hay categorías {searchQuery ? 'que coincidan con la búsqueda' : 'creadas'}</p>
                                    <button
                                        onClick={() => openCategoryModal()}
                                        className="mt-4 text-blue-500 hover:text-blue-400"
                                    >
                                        Crear primera categoría
                                    </button>
                                </div>
                            ) : (
                                filteredCategories.map(category => (
                                    <div
                                        key={category._id}
                                        className={`bg-zinc-900 border rounded-xl overflow-hidden ${category.isActive ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'
                                            }`}
                                    >
                                        {/* Category Header */}
                                        <div className="flex items-center gap-3 p-4">
                                            <button
                                                onClick={() => toggleCategoryExpand(category._id)}
                                                className="p-1 hover:bg-zinc-800 rounded transition-colors"
                                            >
                                                {expandedCategories.has(category._id) ? (
                                                    <ChevronDown className="w-5 h-5 text-zinc-400" />
                                                ) : (
                                                    <ChevronRight className="w-5 h-5 text-zinc-400" />
                                                )}
                                            </button>

                                            <div
                                                className="w-4 h-4 rounded-full"
                                                style={{ backgroundColor: category.color }}
                                            />

                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-medium text-zinc-50">{category.name}</h3>
                                                    {category.requiresComment && (
                                                        <span className="px-2 py-0.5 text-xs bg-amber-500/10 text-amber-500 rounded">
                                                            Requiere comentario
                                                        </span>
                                                    )}
                                                    {!category.isActive && (
                                                        <span className="px-2 py-0.5 text-xs bg-zinc-700 text-zinc-400 rounded">
                                                            Inactivo
                                                        </span>
                                                    )}
                                                </div>
                                                {category.description && (
                                                    <p className="text-sm text-zinc-500">{category.description}</p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 text-zinc-500">
                                                <span className="text-sm">
                                                    {category.subcategories.filter(s => s.isActive).length} subcategorías
                                                </span>
                                                <span className="text-sm px-2 py-0.5 bg-zinc-800 rounded">
                                                    {category.usageCount} usos
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openSubcategoryModal(category._id)}
                                                    className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors"
                                                    title="Añadir subcategoría"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => openCategoryModal(category)}
                                                    className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete('category', category._id)}
                                                    className="p-2 text-zinc-400 hover:text-red-500 hover:bg-zinc-800 rounded-lg transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Subcategories */}
                                        {expandedCategories.has(category._id) && category.subcategories.length > 0 && (
                                            <div className="border-t border-zinc-800 bg-zinc-950/50">
                                                {category.subcategories
                                                    .filter(sub => showInactive || sub.isActive)
                                                    .map(sub => (
                                                        <div
                                                            key={sub._id}
                                                            className={`flex items-center gap-3 px-4 py-3 pl-14 border-b border-zinc-800/50 last:border-0 ${!sub.isActive ? 'opacity-50' : ''
                                                                }`}
                                                        >
                                                            <Layers className="w-4 h-4 text-zinc-600" />
                                                            <div className="flex-1">
                                                                <span className="text-zinc-50">{sub.name}</span>
                                                                {sub.description && (
                                                                    <span className="text-zinc-500 text-sm ml-2">— {sub.description}</span>
                                                                )}
                                                            </div>
                                                            {!sub.isActive && (
                                                                <span className="px-2 py-0.5 text-xs bg-zinc-700 text-zinc-400 rounded">
                                                                    Inactivo
                                                                </span>
                                                            )}
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => openSubcategoryModal(category._id, sub)}
                                                                    className="p-1.5 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded transition-colors"
                                                                >
                                                                    <Edit3 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => confirmDelete('subcategory', sub._id, category._id)}
                                                                    className="p-1.5 text-zinc-500 hover:text-red-500 hover:bg-zinc-800 rounded transition-colors"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Tags Tab */}
                    {activeTab === 'tags' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredTags.length === 0 ? (
                                <div className="col-span-full text-center py-12 text-zinc-500">
                                    <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No hay etiquetas {searchQuery ? 'que coincidan con la búsqueda' : 'creadas'}</p>
                                    <button
                                        onClick={() => openTagModal()}
                                        className="mt-4 text-blue-500 hover:text-blue-400"
                                    >
                                        Crear primera etiqueta
                                    </button>
                                </div>
                            ) : (
                                filteredTags.map(tag => (
                                    <div
                                        key={tag._id}
                                        className={`bg-zinc-900 border rounded-xl p-4 ${tag.isActive ? 'border-zinc-800' : 'border-zinc-800/50 opacity-60'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: tag.color }}
                                                />
                                                <div>
                                                    <h3 className="font-medium text-zinc-50">{tag.name}</h3>
                                                    {tag.description && (
                                                        <p className="text-sm text-zinc-500 mt-0.5">{tag.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openTagModal(tag)}
                                                    className="p-1.5 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded transition-colors"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => confirmDelete('tag', tag._id)}
                                                    className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-800 rounded transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-3 text-sm">
                                            <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                                                {tag.usageCount} usos
                                            </span>
                                            {!tag.isActive && (
                                                <span className="px-2 py-0.5 bg-zinc-700 text-zinc-400 rounded">
                                                    Inactivo
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Settings Tab */}
                    {activeTab === 'settings' && (
                        <div className="max-w-2xl">
                            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
                                <h2 className="text-lg font-semibold text-zinc-50 flex items-center gap-2">
                                    <Settings2 className="w-5 h-5 text-blue-500" />
                                    Configuración de Tipificación
                                </h2>

                                <div className="space-y-4">
                                    {/* Require Disposition */}
                                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-lg">
                                        <div>
                                            <h3 className="font-medium text-zinc-50">Tipificación obligatoria</h3>
                                            <p className="text-sm text-zinc-500">
                                                Los agentes deben tipificar antes de cerrar una conversación
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setSettings(s => ({ ...s, requireDisposition: !s.requireDisposition }))}
                                            className={`relative w-12 h-6 rounded-full transition-colors ${settings.requireDisposition ? 'bg-blue-600' : 'bg-zinc-700'
                                                }`}
                                        >
                                            <span
                                                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.requireDisposition ? 'left-7' : 'left-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Allow Custom Comment */}
                                    <div className="flex items-center justify-between p-4 bg-zinc-950 rounded-lg">
                                        <div>
                                            <h3 className="font-medium text-zinc-50">Permitir comentarios personalizados</h3>
                                            <p className="text-sm text-zinc-500">
                                                Los agentes pueden agregar un comentario adicional al tipificar
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setSettings(s => ({ ...s, allowCustomComment: !s.allowCustomComment }))}
                                            className={`relative w-12 h-6 rounded-full transition-colors ${settings.allowCustomComment ? 'bg-blue-600' : 'bg-zinc-700'
                                                }`}
                                        >
                                            <span
                                                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.allowCustomComment ? 'left-7' : 'left-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Comment Length */}
                                    {settings.allowCustomComment && (
                                        <div className="p-4 bg-zinc-950 rounded-lg space-y-4">
                                            <h3 className="font-medium text-zinc-50">Longitud del comentario</h3>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-sm text-zinc-500">Mínimo</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={settings.minCommentLength}
                                                        onChange={(e) => setSettings(s => ({ ...s, minCommentLength: parseInt(e.target.value) || 0 }))}
                                                        className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-sm text-zinc-500">Máximo</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={settings.maxCommentLength}
                                                        onChange={(e) => setSettings(s => ({ ...s, maxCommentLength: parseInt(e.target.value) || 1000 }))}
                                                        className="w-full mt-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Default Category */}
                                    <div className="p-4 bg-zinc-950 rounded-lg">
                                        <h3 className="font-medium text-zinc-50">Categoría por defecto</h3>
                                        <p className="text-sm text-zinc-500 mb-3">
                                            Categoría preseleccionada al abrir el modal de tipificación
                                        </p>
                                        <select
                                            value={settings.defaultCategoryId || ''}
                                            onChange={(e) => setSettings(s => ({ ...s, defaultCategoryId: e.target.value || undefined }))}
                                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="unset">Ninguna</option>
                                            {categories.filter(c => c.isActive).map(cat => (
                                                <option key={cat._id} value={cat._id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t border-zinc-800">
                                    <button
                                        onClick={saveSettings}
                                        disabled={savingSettings}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-zinc-50 rounded-lg transition-colors"
                                    >
                                        {savingSettings ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        Guardar configuración
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats Tab */}
                    {activeTab === 'stats' && stats && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Top Categories */}
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                    <h3 className="text-lg font-semibold text-zinc-50 mb-4 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-blue-500" />
                                        Categorías más usadas
                                    </h3>
                                    {stats.topCategories && stats.topCategories.length > 0 ? (
                                        <div className="space-y-3">
                                            {stats.topCategories.slice(0, 10).map((cat, i) => (
                                                <div key={i} className="flex items-center gap-3">
                                                    <span className="w-6 text-zinc-500 text-sm">{i + 1}.</span>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-zinc-50">{cat.name}</span>
                                                            <span className="text-zinc-400 text-sm">{cat.count}</span>
                                                        </div>
                                                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-blue-600 rounded-full"
                                                                style={{
                                                                    width: `${(cat.count / Math.max(...stats.topCategories.map(c => c.count))) * 100}%`
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-zinc-500 text-center py-8">
                                            No hay datos de uso todavía
                                        </p>
                                    )}
                                </div>

                                {/* Summary Stats */}
                                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                                    <h3 className="text-lg font-semibold text-zinc-50 mb-4 flex items-center gap-2">
                                        <Hash className="w-5 h-5 text-purple-500" />
                                        Resumen
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg">
                                            <span className="text-zinc-400">Total de categorías</span>
                                            <span className="text-zinc-50 font-semibold">{stats.totalCategories}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg">
                                            <span className="text-zinc-400">Categorías activas</span>
                                            <span className="text-zinc-50 font-semibold">{stats.activeCategories}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg">
                                            <span className="text-zinc-400">Total de subcategorías</span>
                                            <span className="text-zinc-50 font-semibold">{stats.totalSubcategories}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg">
                                            <span className="text-zinc-400">Total de etiquetas</span>
                                            <span className="text-zinc-50 font-semibold">{stats.totalTags}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg">
                                            <span className="text-zinc-400">Tipificaciones realizadas</span>
                                            <span className="text-zinc-50 font-semibold">{stats.totalDispositions}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Category Modal */}
                {showCategoryModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                                <h2 className="text-lg font-semibold text-zinc-50">
                                    {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
                                </h2>
                                <button
                                    onClick={() => setShowCategoryModal(false)}
                                    className="p-1 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">Nombre *</label>
                                    <input
                                        type="text"
                                        value={categoryForm.name}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            const autoCode = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                                            setCategoryForm(f => ({
                                                ...f,
                                                name,
                                                code: f.code || autoCode
                                            }));
                                        }}
                                        placeholder="Ej: Consulta técnica"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">Código *</label>
                                    <input
                                        type="text"
                                        value={categoryForm.code}
                                        onChange={(e) => setCategoryForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                                        placeholder="consulta_tecnica"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    />
                                    <p className="text-xs text-zinc-500 mt-1">Identificador único (solo letras, números y guion bajo)</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">Descripción</label>
                                    <input
                                        type="text"
                                        value={categoryForm.description}
                                        onChange={(e) => setCategoryForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Descripción breve de la categoría"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setCategoryForm(f => ({ ...f, color }))}
                                                className={`w-8 h-8 rounded-full transition-transform ${categoryForm.color === color ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg">
                                    <div>
                                        <p className="font-medium text-zinc-50">Requiere comentario</p>
                                        <p className="text-sm text-zinc-500">El agente debe agregar un comentario obligatorio</p>
                                    </div>
                                    <button
                                        onClick={() => setCategoryForm(f => ({ ...f, requiresComment: !f.requiresComment }))}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${categoryForm.requiresComment ? 'bg-blue-600' : 'bg-zinc-700'
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${categoryForm.requiresComment ? 'left-5' : 'left-0.5'
                                                }`}
                                        />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg">
                                    <div>
                                        <p className="font-medium text-zinc-50">Activo</p>
                                        <p className="text-sm text-zinc-500">Visible para los agentes al tipificar</p>
                                    </div>
                                    <button
                                        onClick={() => setCategoryForm(f => ({ ...f, isActive: !f.isActive }))}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${categoryForm.isActive ? 'bg-blue-600' : 'bg-zinc-700'
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${categoryForm.isActive ? 'left-5' : 'left-0.5'
                                                }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-800">
                                <button
                                    onClick={() => setShowCategoryModal(false)}
                                    className="px-4 py-2 text-zinc-400 hover:text-zinc-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveCategory}
                                    disabled={!categoryForm.name.trim() || (!editingCategory && !categoryForm.code.trim()) || isSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-50 rounded-lg transition-colors"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    {editingCategory ? 'Guardar cambios' : 'Crear categoría'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Subcategory Modal */}
                {showSubcategoryModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                                <h2 className="text-lg font-semibold text-zinc-50">
                                    {editingSubcategory ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
                                </h2>
                                <button
                                    onClick={() => setShowSubcategoryModal(false)}
                                    className="p-1 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">Nombre *</label>
                                    <input
                                        type="text"
                                        value={subcategoryForm.name}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            const autoCode = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                                            setSubcategoryForm(f => ({
                                                ...f,
                                                name,
                                                code: f.code || autoCode
                                            }));
                                        }}
                                        placeholder="Ej: Problema de conexión"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">Código *</label>
                                    <input
                                        type="text"
                                        value={subcategoryForm.code}
                                        onChange={(e) => setSubcategoryForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                                        placeholder="problema_conexion"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">Descripción</label>
                                    <input
                                        type="text"
                                        value={subcategoryForm.description}
                                        onChange={(e) => setSubcategoryForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Descripción breve"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg">
                                    <div>
                                        <p className="font-medium text-zinc-50">Activo</p>
                                        <p className="text-sm text-zinc-500">Visible para los agentes</p>
                                    </div>
                                    <button
                                        onClick={() => setSubcategoryForm(f => ({ ...f, isActive: !f.isActive }))}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${subcategoryForm.isActive ? 'bg-blue-600' : 'bg-zinc-700'
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${subcategoryForm.isActive ? 'left-5' : 'left-0.5'
                                                }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-800">
                                <button
                                    onClick={() => setShowSubcategoryModal(false)}
                                    className="px-4 py-2 text-zinc-400 hover:text-zinc-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveSubcategory}
                                    disabled={!subcategoryForm.name.trim() || (!editingSubcategory && !subcategoryForm.code.trim()) || isSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-50 rounded-lg transition-colors"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    {editingSubcategory ? 'Guardar cambios' : 'Crear subcategoría'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tag Modal */}
                {showTagModal && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md">
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                                <h2 className="text-lg font-semibold text-zinc-50">
                                    {editingTag ? 'Editar Etiqueta' : 'Nueva Etiqueta'}
                                </h2>
                                <button
                                    onClick={() => setShowTagModal(false)}
                                    className="p-1 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">Nombre *</label>
                                    <input
                                        type="text"
                                        value={tagForm.name}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            const autoCode = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                                            setTagForm(f => ({
                                                ...f,
                                                name,
                                                code: f.code || autoCode
                                            }));
                                        }}
                                        placeholder="Ej: Urgente"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">Código *</label>
                                    <input
                                        type="text"
                                        value={tagForm.code}
                                        onChange={(e) => setTagForm(f => ({ ...f, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                                        placeholder="urgente"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-1">Descripción</label>
                                    <input
                                        type="text"
                                        value={tagForm.description}
                                        onChange={(e) => setTagForm(f => ({ ...f, description: e.target.value }))}
                                        placeholder="Descripción de la etiqueta"
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-50 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-zinc-300 mb-2">Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {COLORS.map(color => (
                                            <button
                                                key={color}
                                                onClick={() => setTagForm(f => ({ ...f, color }))}
                                                className={`w-8 h-8 rounded-full transition-transform ${tagForm.color === color ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : ''
                                                    }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-lg">
                                    <div>
                                        <p className="font-medium text-zinc-50">Activo</p>
                                        <p className="text-sm text-zinc-500">Visible para los agentes</p>
                                    </div>
                                    <button
                                        onClick={() => setTagForm(f => ({ ...f, isActive: !f.isActive }))}
                                        className={`relative w-10 h-5 rounded-full transition-colors ${tagForm.isActive ? 'bg-blue-600' : 'bg-zinc-700'
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${tagForm.isActive ? 'left-5' : 'left-0.5'
                                                }`}
                                        />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-800">
                                <button
                                    onClick={() => setShowTagModal(false)}
                                    className="px-4 py-2 text-zinc-400 hover:text-zinc-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={saveTag}
                                    disabled={!tagForm.name.trim() || (!editingTag && !tagForm.code.trim()) || isSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-zinc-50 rounded-lg transition-colors"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                    {editingTag ? 'Guardar cambios' : 'Crear etiqueta'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteModal && deleteTarget && (
                    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                        <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-sm">
                            <div className="p-6 text-center">
                                <div className="w-12 h-12 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                </div>
                                <h2 className="text-lg font-semibold text-zinc-50 mb-2">
                                    Confirmar eliminación
                                </h2>
                                <p className="text-zinc-400 text-sm">
                                    {deleteTarget.type === 'category' && 'Esta acción eliminará la categoría y todas sus subcategorías.'}
                                    {deleteTarget.type === 'subcategory' && 'Esta acción eliminará la subcategoría.'}
                                    {deleteTarget.type === 'tag' && 'Esta acción eliminará la etiqueta.'}
                                    {' '}Esta acción no se puede deshacer.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-800">
                                <button
                                    onClick={() => {
                                        setShowDeleteModal(false);
                                        setDeleteTarget(null);
                                    }}
                                    className="px-4 py-2 text-zinc-400 hover:text-zinc-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isSaving}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-zinc-50 rounded-lg transition-colors"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper Component for Stats
function StatBadge({ icon: Icon, count, label, color, bg }: any) {
    return (
        <div className="flex items-center gap-3 px-3">
            <div className={`p-1.5 rounded-lg ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div className="flex flex-col leading-none">
                <span className={`font-bold text-lg ${color}`}>{typeof count === 'number' ? count.toLocaleString() : count}</span>
                <span className="text-[10px] font-bold text-zinc-500">{label}</span>
            </div>
        </div>
    );
}

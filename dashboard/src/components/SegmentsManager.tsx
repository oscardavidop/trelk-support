import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
    X, Plus, Save, Trash2, Loader2, ChevronDown, Bookmark, Users, AlertTriangle, Eye
} from 'lucide-react';
import { uuidv4 } from '../utils/uuid';

// ==================== TYPES (Mismos originales) ====================
type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty' | 'before' | 'after' | 'within_last' | 'not_within_last' | 'has_any' | 'has_all' | 'has_none' | 'has_executed' | 'has_not_executed';
type FilterField = 'language' | 'username' | 'firstName' | 'lastName' | 'isBlocked' | 'createdAt' | 'lastActivity' | 'tags' | 'totalSessions' | 'totalMessages' | 'hasActiveSession' | 'customField' | 'executedFlow';

interface IFilterRule { id?: string; field: FilterField; operator: FilterOperator; value?: any; customFieldKey?: string; flowId?: string; relativeDays?: number; }
interface IFilterGroup { id?: string; logic: 'AND' | 'OR'; rules: IFilterRule[]; groups: IFilterGroup[]; }
interface ISegment { _id: string; name: string; description?: string; color: string; filters: IFilterGroup; isActive: boolean; isPinned: boolean; cachedCount?: number; createdAt: string; updatedAt: string; }
interface ITag { _id: string; name: string; color: string; }
interface ICustomField { _id: string; key: string; label: string; type: string; }
interface Props { onClose: () => void; onSegmentCreated?: (segment: ISegment) => void; editingSegment?: ISegment | null; }

// ==================== CONSTANTS ====================
const PRESET_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#6366F1'];

const FIELD_OPTIONS: Array<{ value: FilterField; label: string; category: string }> = [
    { value: 'language', label: 'Idioma', category: 'Usuario' },
    { value: 'username', label: 'Username', category: 'Usuario' },
    { value: 'firstName', label: 'Nombre', category: 'Usuario' },
    { value: 'lastName', label: 'Apellido', category: 'Usuario' },
    { value: 'isBlocked', label: 'Bloqueado', category: 'Usuario' },
    { value: 'createdAt', label: 'Fecha de registro', category: 'Usuario' },
    { value: 'lastActivity', label: 'Última actividad', category: 'Usuario' },
    { value: 'tags', label: 'Etiquetas', category: 'Etiquetas' },
    { value: 'totalSessions', label: 'Total de sesiones', category: 'Engagement' },
    { value: 'totalMessages', label: 'Total de mensajes', category: 'Engagement' },
    { value: 'hasActiveSession', label: 'Tiene sesión activa', category: 'Engagement' },
    { value: 'customField', label: 'Campo personalizado', category: 'Campos' },
    { value: 'executedFlow', label: 'Ha ejecutado flow', category: 'Flows' },
];

const getOperatorsForField = (field: FilterField): Array<{ value: FilterOperator; label: string }> => {
    if (['language', 'username', 'firstName', 'lastName'].includes(field)) return [{ value: 'equals', label: 'Es igual a' }, { value: 'contains', label: 'Contiene' }, { value: 'starts_with', label: 'Empieza con' }];
    if (['isBlocked', 'hasActiveSession'].includes(field)) return [{ value: 'equals', label: 'Es' }];
    if (['createdAt', 'lastActivity'].includes(field)) return [{ value: 'before', label: 'Antes de' }, { value: 'after', label: 'Después de' }, { value: 'within_last', label: 'En los últimos X días' }];
    if (field === 'tags') return [{ value: 'has_any', label: 'Tiene alguna' }, { value: 'has_all', label: 'Tiene todas' }, { value: 'has_none', label: 'No tiene ninguna' }];
    if (['totalSessions', 'totalMessages'].includes(field)) return [{ value: 'greater_than', label: 'Mayor que' }, { value: 'less_than', label: 'Menor que' }, { value: 'equals', label: 'Igual a' }];
    return [{ value: 'equals', label: 'Es igual a' }];
};

// ==================== COMPONENT ====================

export default function SegmentsManager({ onClose, onSegmentCreated, editingSegment }: Props) {
    const token = useAuthStore((state) => state.token);

    // Form State
    const [name, setName] = useState(editingSegment?.name || '');
    const [description, setDescription] = useState(editingSegment?.description || '');
    const [color, setColor] = useState(editingSegment?.color || PRESET_COLORS[0]);
    const [isActive, setIsActive] = useState(editingSegment?.isActive ?? true);
    const [isPinned, setIsPinned] = useState(editingSegment?.isPinned ?? false);
    const [filters, setFilters] = useState<IFilterGroup>(editingSegment?.filters || { logic: 'AND', rules: [], groups: [] });

    // Data State
    const [tags, setTags] = useState<ITag[]>([]);
    const [customFields, setCustomFields] = useState<ICustomField[]>([]);
    const [flows, setFlows] = useState<Array<{ _id: string; name: string }>>([]);

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewCount, setPreviewCount] = useState<number | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);

    // --- DATA LOADING ---
    useEffect(() => {
        const loadData = async () => {
            if (!token) return;
            setIsLoading(true);
            try {
                const [tagsRes, fieldsRes, flowsRes] = await Promise.all([
                    fetch('/api/tags', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch('/api/custom-fields', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch('/api/flows', { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                if (tagsRes.ok) setTags((await tagsRes.json()).tags || []);
                if (fieldsRes.ok) setCustomFields((await fieldsRes.json()).fields || []);
                if (flowsRes.ok) setFlows((await flowsRes.json()).flows || []);
            } catch (err) { console.error(err); } finally { setIsLoading(false); }
        };
        loadData();
    }, [token]);

    // --- FILTER HELPERS ---
    const getTargetGroup = (root: IFilterGroup, path: number[]) => {
        let target = root;
        for (const idx of path) target = target.groups[idx];
        return target;
    };

    const addRule = (path: number[]) => {
        setFilters(prev => {
            const clone = JSON.parse(JSON.stringify(prev));
            getTargetGroup(clone, path).rules.push({ field: 'language', operator: 'equals', value: '' });
            return clone;
        });
    };
    const addGroup = (path: number[]) => {
        setFilters(prev => {
            const clone = JSON.parse(JSON.stringify(prev));
            getTargetGroup(clone, path).groups.push({ logic: 'AND', rules: [], groups: [] });
            return clone;
        });
    };
    const updateRule = (path: number[], idx: number, updates: any) => {
        setFilters(prev => {
            const clone = JSON.parse(JSON.stringify(prev));
            const rules = getTargetGroup(clone, path).rules;
            rules[idx] = { ...rules[idx], ...updates };
            return clone;
        });
    };
    const deleteRule = (path: number[], idx: number) => {
        setFilters(prev => {
            const clone = JSON.parse(JSON.stringify(prev));
            getTargetGroup(clone, path).rules.splice(idx, 1);
            return clone;
        });
    };
    const deleteGroup = (path: number[]) => {
        if (path.length === 0) return;
        setFilters(prev => {
            const clone = JSON.parse(JSON.stringify(prev));
            const parent = getTargetGroup(clone, path.slice(0, -1));
            parent.groups.splice(path[path.length - 1], 1);
            return clone;
        });
    };
    const toggleLogic = (path: number[]) => {
        setFilters(prev => {
            const clone = JSON.parse(JSON.stringify(prev));
            const group = getTargetGroup(clone, path);
            group.logic = group.logic === 'AND' ? 'OR' : 'AND';
            return clone;
        });
    };

    function assignIdsToFilters(group: IFilterGroup): IFilterGroup {
        const groupId = group.id || uuidv4();
        return {
            ...group,
            id: groupId,
            rules: group.rules.map(rule => ({ ...rule, id: rule.id || uuidv4() })),
            groups: group.groups.map(assignIdsToFilters),
        };
    }
    // --- HANDLERS ---
    const handlePreview = async () => {
        if (!token) return;
        setIsPreviewing(true);
        try {
            const res = await fetch('/api/segments/preview', {
                method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ filters }),
            });
            if (res.ok) setPreviewCount((await res.json()).count);
        } catch (e: any) { setError(e.message); } finally { setIsPreviewing(false); }
    };

    const handleSave = async () => {
        if (!token || !name.trim()) { setError('Nombre requerido'); return; }
        setIsSaving(true); setError(null);
        try {
            const url = editingSegment ? `/api/segments/${editingSegment._id}` : '/api/segments';
            // Asignar ids antes de guardar
            const filtersWithIds = assignIdsToFilters(filters);
            const res = await fetch(url, {
                method: editingSegment ? 'PATCH' : 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, description, color, filters: filtersWithIds, isActive, isPinned }),
            });
            if (!res.ok) throw new Error('Error guardando');
            onSegmentCreated?.((await res.json()).segment);
            onClose();
        } catch (e: any) { setError(e.message); } finally { setIsSaving(false); }
    };

    // --- RENDER RECURSIVO ---
    const renderFilterGroup = (group: IFilterGroup, path: number[] = []) => {
        const isRoot = path.length === 0;
        return (
            <div className={`space-y-3 ${!isRoot ? 'ml-4 pl-4 border-l border-zinc-700' : ''}`}>

                {/* Logic Header */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => toggleLogic(path)}
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors ${group.logic === 'AND' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}
                    >
                        {group.logic === 'AND' ? 'Y (Todas)' : 'O (Alguna)'}
                    </button>
                    {!isRoot && (
                        <button onClick={() => deleteGroup(path)} className="p-1 hover:bg-red-500/20 text-red-400 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Rules List */}
                <div className="space-y-2">
                    {group.rules.map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-zinc-900/50 p-2 rounded-lg border border-zinc-700/50">
                            {/* Field */}
                            <select
                                value={rule.field}
                                onChange={(e) => updateRule(path, idx, { field: e.target.value })}
                                className="bg-zinc-800 text-xs text-zinc-200 border-none rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none w-32"
                            >
                                {FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>

                            {/* Operator */}
                            <select
                                value={rule.operator}
                                onChange={(e) => updateRule(path, idx, { operator: e.target.value })}
                                className="bg-zinc-800 text-xs text-zinc-400 border-none rounded px-2 py-1.5 focus:ring-1 focus:ring-blue-500 outline-none w-28"
                            >
                                {getOperatorsForField(rule.field).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>

                            {/* Value Input (Dynamic) */}
                            <div className="flex-1">
                                {rule.field === 'tags' ? (
                                    <select
                                        multiple
                                        value={Array.isArray(rule.value) ? rule.value : []}
                                        onChange={(e) => updateRule(path, idx, { value: Array.from(e.target.selectedOptions, o => o.value) })}
                                        className="w-full bg-zinc-800 text-xs text-white rounded border border-zinc-700 px-2 py-1"
                                    >
                                        {tags.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={rule.value || ''}
                                        onChange={(e) => updateRule(path, idx, { value: e.target.value })}
                                        placeholder="Valor..."
                                        className="w-full bg-zinc-800 text-xs text-white rounded border border-zinc-700 px-2 py-1.5 focus:border-blue-500 focus:outline-none"
                                    />
                                )}
                            </div>

                            <button onClick={() => deleteRule(path, idx)} className="p-1 text-zinc-500 hover:text-red-400 transition-colors"><X className="w-3.5 h-3.5" /></button>
                        </div>
                    ))}
                </div>

                {/* Nested Groups */}
                {group.groups.map((g, i) => <div key={i}>{renderFilterGroup(g, [...path, i])}</div>)}

                {/* Add Buttons */}
                <div className="flex gap-2 pt-1 opacity-60 hover:opacity-100 transition-opacity">
                    <button onClick={() => addRule(path)} className="flex items-center gap-1 text-[10px] uppercase font-bold text-zinc-400 hover:text-white px-2 py-1 hover:bg-zinc-700/50 rounded"><Plus className="w-3 h-3" /> Regla</button>
                    <button onClick={() => addGroup(path)} className="flex items-center gap-1 text-[10px] uppercase font-bold text-zinc-400 hover:text-white px-2 py-1 hover:bg-zinc-700/50 rounded"><Plus className="w-3 h-3" /> Grupo</button>
                </div>
            </div>
        );
    };

    // ==================== MAIN UI ====================

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-zinc-900 w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl border border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-500 shadow-lg shadow-blue-500/10">
                            <Bookmark className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">{editingSegment ? 'Editar Segmento' : 'Nuevo Segmento'}</h2>
                            <p className="text-xs text-zinc-400">Define reglas para agrupar tus contactos automáticamente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"><X className="w-5 h-5" /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

                    {/* 1. Basic Info Section */}
                    <div className="space-y-5">
                        <div className="grid grid-cols-12 gap-6">
                            {/* Name & Desc */}
                            <div className="col-span-8 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Nombre</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Ej: Clientes VIP"
                                        className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Descripción</label>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Opcional"
                                        className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 focus:border-blue-500 focus:outline-none transition-all"
                                    />
                                </div>
                            </div>

                            {/* Color & Toggles */}
                            <div className="col-span-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Color</label>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl border border-zinc-700 shadow-sm transition-colors" style={{ backgroundColor: color }} />
                                        <div className="flex-1 grid grid-cols-5 gap-1.5">
                                            {PRESET_COLORS.slice(0, 5).map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => setColor(c)}
                                                    className={`w-6 h-6 rounded-full border transition-all hover:scale-110 ${color === c ? 'border-white scale-110' : 'border-transparent hover:border-zinc-500'}`}
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded bg-zinc-800 border-zinc-700 text-blue-500 focus:ring-offset-0" />
                                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Activo</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer group">
                                        <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="rounded bg-zinc-800 border-zinc-700 text-yellow-500 focus:ring-offset-0" />
                                        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">Fijado al inicio</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Filters Section */}
                    <div className="border-t border-zinc-800 pt-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Users className="w-4 h-4 text-zinc-500" /> Reglas de Segmentación
                            </h3>

                            <button
                                onClick={handlePreview}
                                disabled={isPreviewing}
                                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors border border-blue-500/20"
                            >
                                {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                                {previewCount !== null ? `${previewCount} contactos coinciden` : 'Vista Previa'}
                            </button>
                        </div>

                        <div className="bg-zinc-950/50 p-5 rounded-xl border border-zinc-800 min-h-[150px]">
                            {isLoading ? (
                                <div className="flex justify-center items-center h-20"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                            ) : (
                                renderFilterGroup(filters)
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2 animate-in slide-in-from-bottom-2">
                            <AlertTriangle className="w-4 h-4" />{error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900 flex justify-end gap-3">
                    <button onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-blue-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:transform-none"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {editingSegment ? 'Guardar Cambios' : 'Crear Segmento'}
                    </button>
                </div>

            </div>
        </div>
    );
}
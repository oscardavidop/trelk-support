/**
 * SegmentsManager - Create and manage contact segments
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  X,
  Plus,
  Save,
  Trash2,
  Copy,
  Edit3,
  Loader2,
  ChevronDown,
  ChevronRight,
  Bookmark,
  Users,
  AlertTriangle,
  Check,
  Palette,
  Star,
  Eye,
  EyeOff
} from 'lucide-react';

// ==================== TYPES ====================

type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'in'
  | 'not_in'
  | 'is_empty'
  | 'is_not_empty'
  | 'before'
  | 'after'
  | 'within_last'
  | 'not_within_last'
  | 'has_any'
  | 'has_all'
  | 'has_none'
  | 'has_executed'
  | 'has_not_executed';

type FilterField =
  | 'language'
  | 'username'
  | 'firstName'
  | 'lastName'
  | 'isBlocked'
  | 'createdAt'
  | 'lastActivity'
  | 'tags'
  | 'totalSessions'
  | 'totalMessages'
  | 'hasActiveSession'
  | 'customField'
  | 'executedFlow';

interface IFilterRule {
  field: FilterField;
  operator: FilterOperator;
  value?: any;
  customFieldKey?: string;
  flowId?: string;
  relativeDays?: number;
}

interface IFilterGroup {
  logic: 'AND' | 'OR';
  rules: IFilterRule[];
  groups: IFilterGroup[];
}

interface ISegment {
  _id: string;
  name: string;
  description?: string;
  color: string;
  filters: IFilterGroup;
  isActive: boolean;
  isPinned: boolean;
  cachedCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface ITag {
  _id: string;
  name: string;
  color: string;
}

interface ICustomField {
  _id: string;
  key: string;
  label: string;
  type: string;
}

interface Props {
  onClose: () => void;
  onSegmentCreated?: (segment: ISegment) => void;
  editingSegment?: ISegment | null;
}

// ==================== CONSTANTS ====================

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#6366F1',
];

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
  switch (field) {
    case 'language':
    case 'username':
    case 'firstName':
    case 'lastName':
      return [
        { value: 'equals', label: 'Es igual a' },
        { value: 'not_equals', label: 'No es igual a' },
        { value: 'contains', label: 'Contiene' },
        { value: 'not_contains', label: 'No contiene' },
        { value: 'starts_with', label: 'Empieza con' },
        { value: 'ends_with', label: 'Termina con' },
        { value: 'is_empty', label: 'Está vacío' },
        { value: 'is_not_empty', label: 'No está vacío' },
      ];
    case 'isBlocked':
    case 'hasActiveSession':
      return [
        { value: 'equals', label: 'Es' },
      ];
    case 'createdAt':
    case 'lastActivity':
      return [
        { value: 'before', label: 'Antes de' },
        { value: 'after', label: 'Después de' },
        { value: 'within_last', label: 'En los últimos X días' },
        { value: 'not_within_last', label: 'No en los últimos X días' },
      ];
    case 'tags':
      return [
        { value: 'has_any', label: 'Tiene alguna de' },
        { value: 'has_all', label: 'Tiene todas' },
        { value: 'has_none', label: 'No tiene ninguna de' },
        { value: 'is_empty', label: 'Sin etiquetas' },
        { value: 'is_not_empty', label: 'Con etiquetas' },
      ];
    case 'totalSessions':
    case 'totalMessages':
      return [
        { value: 'equals', label: 'Es igual a' },
        { value: 'not_equals', label: 'No es igual a' },
        { value: 'greater_than', label: 'Mayor que' },
        { value: 'less_than', label: 'Menor que' },
        { value: 'greater_or_equal', label: 'Mayor o igual a' },
        { value: 'less_or_equal', label: 'Menor o igual a' },
      ];
    case 'executedFlow':
      return [
        { value: 'has_executed', label: 'Ha ejecutado' },
        { value: 'has_not_executed', label: 'No ha ejecutado' },
      ];
    case 'customField':
      return [
        { value: 'equals', label: 'Es igual a' },
        { value: 'not_equals', label: 'No es igual a' },
        { value: 'contains', label: 'Contiene' },
        { value: 'is_empty', label: 'Está vacío' },
        { value: 'is_not_empty', label: 'No está vacío' },
        { value: 'greater_than', label: 'Mayor que' },
        { value: 'less_than', label: 'Menor que' },
      ];
    default:
      return [{ value: 'equals', label: 'Es igual a' }];
  }
};

// ==================== COMPONENT ====================

export default function SegmentsManager({ onClose, onSegmentCreated, editingSegment }: Props) {
  const token = useAuthStore((state) => state.token);

  // Form state
  const [name, setName] = useState(editingSegment?.name || '');
  const [description, setDescription] = useState(editingSegment?.description || '');
  const [color, setColor] = useState(editingSegment?.color || PRESET_COLORS[0]);
  const [isActive, setIsActive] = useState(editingSegment?.isActive ?? true);
  const [isPinned, setIsPinned] = useState(editingSegment?.isPinned ?? false);
  const [filters, setFilters] = useState<IFilterGroup>(
    editingSegment?.filters || { logic: 'AND', rules: [], groups: [] }
  );

  // Data state
  const [tags, setTags] = useState<ITag[]>([]);
  const [customFields, setCustomFields] = useState<ICustomField[]>([]);
  const [flows, setFlows] = useState<Array<{ _id: string; name: string }>>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // ==================== DATA LOADING ====================

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

        if (tagsRes.ok) {
          const data = await tagsRes.json();
          setTags(data.tags || []);
        }

        if (fieldsRes.ok) {
          const data = await fieldsRes.json();
          setCustomFields(data.fields || []);
        }

        if (flowsRes.ok) {
          const data = await flowsRes.json();
          setFlows(data.flows || []);
        }
      } catch (err) {
        console.error('Error loading data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [token]);

  // ==================== FILTER MANAGEMENT ====================

  const addRule = (groupPath: number[] = []) => {
    const newRule: IFilterRule = {
      field: 'language',
      operator: 'equals',
      value: '',
    };

    setFilters((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      let target = updated;
      for (const idx of groupPath) {
        target = target.groups[idx];
      }
      target.rules.push(newRule);
      return updated;
    });
  };

  const addGroup = (groupPath: number[] = []) => {
    const newGroup: IFilterGroup = {
      logic: 'AND',
      rules: [],
      groups: [],
    };

    setFilters((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      let target = updated;
      for (const idx of groupPath) {
        target = target.groups[idx];
      }
      target.groups.push(newGroup);
      return updated;
    });
  };

  const updateRule = (groupPath: number[], ruleIndex: number, updates: Partial<IFilterRule>) => {
    setFilters((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      let target = updated;
      for (const idx of groupPath) {
        target = target.groups[idx];
      }
      target.rules[ruleIndex] = { ...target.rules[ruleIndex], ...updates };
      return updated;
    });
  };

  const deleteRule = (groupPath: number[], ruleIndex: number) => {
    setFilters((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      let target = updated;
      for (const idx of groupPath) {
        target = target.groups[idx];
      }
      target.rules.splice(ruleIndex, 1);
      return updated;
    });
  };

  const deleteGroup = (groupPath: number[]) => {
    if (groupPath.length === 0) return; // Can't delete root group

    setFilters((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      const parentPath = groupPath.slice(0, -1);
      const groupIndex = groupPath[groupPath.length - 1];

      let parent = updated;
      for (const idx of parentPath) {
        parent = parent.groups[idx];
      }
      parent.groups.splice(groupIndex, 1);
      return updated;
    });
  };

  const toggleLogic = (groupPath: number[] = []) => {
    setFilters((prev) => {
      const updated = JSON.parse(JSON.stringify(prev));
      let target = updated;
      for (const idx of groupPath) {
        target = target.groups[idx];
      }
      target.logic = target.logic === 'AND' ? 'OR' : 'AND';
      return updated;
    });
  };

  // ==================== PREVIEW ====================

  const handlePreview = async () => {
    if (!token) return;

    setIsPreviewing(true);
    try {
      const response = await fetch('/api/segments/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filters }),
      });

      if (!response.ok) throw new Error('Preview failed');

      const data = await response.json();
      setPreviewCount(data.count);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsPreviewing(false);
    }
  };

  // ==================== SAVE ====================

  const handleSave = async () => {
    if (!token || !name.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const url = editingSegment ? `/api/segments/${editingSegment._id}` : '/api/segments';
      const method = editingSegment ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description,
          color,
          filters,
          isActive,
          isPinned,
        }),
      });

      if (!response.ok) throw new Error('Failed to save segment');

      const data = await response.json();
      onSegmentCreated?.(data.segment);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ==================== RENDER FILTER GROUP ====================

  const renderFilterGroup = (group: IFilterGroup, path: number[] = []) => {
    const isRoot = path.length === 0;

    return (
      <div
        className={`${isRoot ? '' : 'ml-4 pl-4 border-l-2 border-gray-600'} space-y-3`}
      >
        {/* Logic Toggle & Group Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleLogic(path)}
            className={`px-3 py-1 text-xs font-medium rounded-full ${
              group.logic === 'AND'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-orange-500/20 text-orange-400'
            }`}
          >
            {group.logic === 'AND' ? 'Y (todas)' : 'O (alguna)'}
          </button>

          {!isRoot && (
            <button
              onClick={() => deleteGroup(path)}
              className="p-1 text-red-400 hover:bg-red-500/20 rounded"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Rules */}
        {group.rules.map((rule, ruleIndex) => (
          <div key={ruleIndex} className="flex items-center gap-2 flex-wrap">
            {/* Field Selector */}
            <select
              value={rule.field}
              onChange={(e) => {
                const newField = e.target.value as FilterField;
                const newOperators = getOperatorsForField(newField);
                updateRule(path, ruleIndex, {
                  field: newField,
                  operator: newOperators[0]?.value || 'equals',
                  value: '',
                  customFieldKey: undefined,
                  flowId: undefined,
                });
              }}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            >
              {FIELD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Custom Field Key (if customField) */}
            {rule.field === 'customField' && (
              <select
                value={rule.customFieldKey || ''}
                onChange={(e) => updateRule(path, ruleIndex, { customFieldKey: e.target.value })}
                className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                <option value="">Seleccionar campo...</option>
                {customFields.map((field) => (
                  <option key={field._id} value={field.key}>
                    {field.label}
                  </option>
                ))}
              </select>
            )}

            {/* Flow Selector (if executedFlow) */}
            {rule.field === 'executedFlow' && (
              <select
                value={rule.flowId || ''}
                onChange={(e) => updateRule(path, ruleIndex, { flowId: e.target.value })}
                className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                <option value="">Cualquier flow</option>
                {flows.map((flow) => (
                  <option key={flow._id} value={flow._id}>
                    {flow.name}
                  </option>
                ))}
              </select>
            )}

            {/* Operator Selector */}
            <select
              value={rule.operator}
              onChange={(e) => updateRule(path, ruleIndex, { operator: e.target.value as FilterOperator })}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            >
              {getOperatorsForField(rule.field).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Value Input */}
            {!['is_empty', 'is_not_empty'].includes(rule.operator) && (
              <>
                {rule.field === 'isBlocked' || rule.field === 'hasActiveSession' ? (
                  <select
                    value={String(rule.value)}
                    onChange={(e) => updateRule(path, ruleIndex, { value: e.target.value === 'true' })}
                    className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  >
                    <option value="true">Sí</option>
                    <option value="false">No</option>
                  </select>
                ) : rule.field === 'tags' ? (
                  <select
                    multiple
                    value={Array.isArray(rule.value) ? rule.value : []}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, (opt) => opt.value);
                      updateRule(path, ruleIndex, { value: selected });
                    }}
                    className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm min-w-[150px]"
                    size={3}
                  >
                    {tags.map((tag) => (
                      <option key={tag._id} value={tag._id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                ) : ['within_last', 'not_within_last'].includes(rule.operator) ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={rule.relativeDays || ''}
                      onChange={(e) => updateRule(path, ruleIndex, { relativeDays: parseInt(e.target.value) })}
                      placeholder="30"
                      className="w-20 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                    />
                    <span className="text-gray-400 text-sm">días</span>
                  </div>
                ) : ['createdAt', 'lastActivity'].includes(rule.field) &&
                  ['before', 'after'].includes(rule.operator) ? (
                  <input
                    type="date"
                    value={rule.value || ''}
                    onChange={(e) => updateRule(path, ruleIndex, { value: e.target.value })}
                    className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  />
                ) : ['totalSessions', 'totalMessages'].includes(rule.field) ? (
                  <input
                    type="number"
                    value={rule.value || ''}
                    onChange={(e) => updateRule(path, ruleIndex, { value: parseInt(e.target.value) })}
                    placeholder="0"
                    className="w-24 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={rule.value || ''}
                    onChange={(e) => updateRule(path, ruleIndex, { value: e.target.value })}
                    placeholder="Valor"
                    className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  />
                )}
              </>
            )}

            {/* Delete Rule */}
            <button
              onClick={() => deleteRule(path, ruleIndex)}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Nested Groups */}
        {group.groups.map((nestedGroup, groupIndex) => (
          <div key={groupIndex}>
            {renderFilterGroup(nestedGroup, [...path, groupIndex])}
          </div>
        ))}

        {/* Add Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => addRule(path)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:bg-blue-500/10 rounded"
          >
            <Plus className="w-4 h-4" />
            Añadir regla
          </button>
          <button
            onClick={() => addGroup(path)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-purple-400 hover:bg-purple-500/10 rounded"
          >
            <Plus className="w-4 h-4" />
            Añadir grupo
          </button>
        </div>
      </div>
    );
  };

  // ==================== MAIN RENDER ====================

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-blue-400" />
            {editingSegment ? 'Editar Segmento' : 'Nuevo Segmento'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="flex gap-4">
              {/* Name */}
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nombre del segmento"
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              {/* Color */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-1">Color</label>
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="w-12 h-10 rounded-lg border-2 border-gray-600"
                  style={{ backgroundColor: color }}
                />
                {showColorPicker && (
                  <div className="absolute right-0 top-full mt-2 p-2 bg-gray-700 border border-gray-600 rounded-lg shadow-lg z-10 flex flex-wrap gap-1 w-36">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setColor(c);
                          setShowColorPicker(false);
                        }}
                        className={`w-6 h-6 rounded ${color === c ? 'ring-2 ring-white' : ''}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Descripción (opcional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción del segmento"
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {/* Options */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-blue-500"
                />
                <span className="text-sm text-gray-300">Activo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 text-yellow-500"
                />
                <span className="text-sm text-gray-300">Fijado</span>
              </label>
            </div>
          </div>

          {/* Filters */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-gray-300">Filtros</label>
              <button
                onClick={handlePreview}
                disabled={isPreviewing}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
              >
                {isPreviewing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
                Vista previa
                {previewCount !== null && (
                  <span className="ml-1 px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                    {previewCount.toLocaleString()}
                  </span>
                )}
              </button>
            </div>

            <div className="bg-gray-700/30 rounded-lg p-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : (
                renderFilterGroup(filters)
              )}

              {filters.rules.length === 0 && filters.groups.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-4">
                  Añade reglas para filtrar contactos
                </p>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editingSegment ? 'Guardar Cambios' : 'Crear Segmento'}
          </button>
        </div>
      </div>
    </div>
  );
}

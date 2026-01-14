/**
 * CustomFieldsPage - Modern UI for managing custom field definitions
 * Consistent with Supervisor, Agents, SavedReplies pages
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  Link,
  Mail,
  Edit3,
  Archive,
  RotateCcw,
  Loader2,
  X,
  Check,
  AlertTriangle,
  RefreshCw,
  Database,
  CheckCircle,
  FileText,
  Layers,
} from 'lucide-react';
import {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
  restoreCustomField,
  generateFieldKey,
  isValidFieldKey,
  FIELD_TYPE_LABELS,
  type CustomField,
  type CustomFieldType,
  type CreateCustomFieldInput,
} from '../services/customFieldsApi';
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

// ============= FIELD TYPE ICON MAPPING =============
const FieldTypeIcon = ({ type, className = "w-4 h-4" }: { type: CustomFieldType; className?: string }) => {
  switch (type) {
    case 'text': return <Type className={className} />;
    case 'number': return <Hash className={className} />;
    case 'date': return <Calendar className={className} />;
    case 'boolean': return <ToggleLeft className={className} />;
    case 'select': return <List className={className} />;
    case 'url': return <Link className={className} />;
    case 'email': return <Mail className={className} />;
    default: return <Type className={className} />;
  }
};

// ============= FIELD TYPE SELECTOR =============
const FIELD_TYPES: { type: CustomFieldType; label: string; description: string }[] = [
  { type: 'text', label: 'Texto', description: 'Campo de texto libre' },
  { type: 'number', label: 'Número', description: 'Valores numéricos' },
  { type: 'email', label: 'Email', description: 'Dirección de correo electrónico' },
  { type: 'url', label: 'URL', description: 'Enlaces web' },
  { type: 'date', label: 'Fecha', description: 'Selector de fecha' },
  { type: 'boolean', label: 'Sí/No', description: 'Valor booleano' },
  { type: 'select', label: 'Lista', description: 'Lista de opciones predefinidas' },
];

// ============= FIELD MODAL =============
interface FieldModalProps {
  field?: CustomField;
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: CustomField) => void;
}

function FieldModal({ field, isOpen, onClose, onSave }: FieldModalProps) {
  const isEdit = !!field;
  
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [description, setDescription] = useState('');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState('');
  const [defaultValue, setDefaultValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (field) {
      setName(field.name);
      setKey(field.key);
      setType(field.type);
      setDescription(field.description || '');
      setRequired(field.required);
      setOptions(field.options || []);
      setDefaultValue(field.defaultValue?.toString() || '');
      setKeyTouched(true);
    } else {
      setName('');
      setKey('');
      setType('text');
      setDescription('');
      setRequired(false);
      setOptions([]);
      setDefaultValue('');
      setKeyTouched(false);
    }
    setErrors({});
  }, [field, isOpen]);

  const handleNameChange = (value: string) => {
    setName(value);
    if (!keyTouched && !isEdit) {
      setKey(generateFieldKey(value));
    }
  };

  const handleKeyChange = (value: string) => {
    setKeyTouched(true);
    // Primero reemplazar espacios por guiones bajos, luego limpiar caracteres inválidos
    setKey(value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
  };

  const addOption = () => {
    const trimmed = newOption.trim();
    if (trimmed && !options.includes(trimmed)) {
      setOptions(prev => [...prev, trimmed]);
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    
    if (!key.trim()) {
      newErrors.key = 'La clave es requerida';
    } else if (!isValidFieldKey(key)) {
      newErrors.key = 'Solo letras minúsculas, números y guiones bajos';
    }
    
    if (type === 'select' && options.length === 0) {
      newErrors.options = 'Agrega al menos una opción';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    setIsSaving(true);
    try {
      let parsedDefault: string | number | boolean | undefined = undefined;
      if (defaultValue) {
        if (type === 'number') {
          parsedDefault = parseFloat(defaultValue);
        } else if (type === 'boolean') {
          parsedDefault = defaultValue === 'true';
        } else {
          parsedDefault = defaultValue;
        }
      }

      if (isEdit && field) {
        const result = await updateCustomField(field.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          required,
          options: type === 'select' ? options : undefined,
          defaultValue: parsedDefault,
        });
        
        if (result.ok && result.field) {
          toast.success('Campo actualizado correctamente');
          onSave(result.field);
          onClose();
        } else {
          toast.error(result.error || 'Error al actualizar');
        }
      } else {
        const input: CreateCustomFieldInput = {
          name: name.trim(),
          key: key.trim(),
          type,
          description: description.trim() || undefined,
          required,
          options: type === 'select' ? options : undefined,
          defaultValue: parsedDefault,
        };
        
        const result = await createCustomField(input);
        
        if (result.ok && result.field) {
          toast.success('Campo creado correctamente');
          onSave(result.field);
          onClose();
        } else {
          if (result.error?.includes('already exists')) {
            setErrors({ key: 'Esta clave ya existe' });
          } else {
            toast.error(result.error || 'Error al crear');
          }
        }
      }
    } catch (error) {
      toast.error('Error al guardar el campo');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Sidebar Panel */}
      <div className="relative bg-gray-900 border-l border-gray-800 shadow-2xl w-full max-w-md h-full overflow-hidden flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-xl">
              {isEdit ? <Edit3 className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
            </div>
            <h2 className="text-lg font-semibold text-white">
              {isEdit ? 'Editar Campo' : 'Nuevo Campo'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nombre <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Número de cliente"
              className={`w-full px-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                errors.name ? 'border-red-500' : 'border-gray-700'
              }`}
            />
            {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
          </div>

          {/* Key (only for new) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Clave interna <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono">$</span>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  placeholder="numero_cliente"
                  className={`w-full pl-8 pr-4 py-3 bg-gray-800 border rounded-xl text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    errors.key ? 'border-red-500' : 'border-gray-700'
                  }`}
                />
              </div>
              {errors.key ? (
                <p className="mt-1 text-sm text-red-400">{errors.key}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-500">
                  Usa en flujos: <code className="text-indigo-400">{`{{custom.${key || 'campo'}}}`}</code>
                </p>
              )}
            </div>
          )}

          {/* Type (only for new) */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Tipo <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FIELD_TYPES.map(({ type: t, label, description }) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      type === t 
                        ? 'border-indigo-500 bg-indigo-500/10' 
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${type === t ? 'bg-indigo-500/20' : 'bg-gray-700'}`}>
                      <FieldTypeIcon type={t} className={`w-4 h-4 ${type === t ? 'text-indigo-400' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${type === t ? 'text-indigo-300' : 'text-gray-300'}`}>
                        {label}
                      </p>
                      <p className="text-xs text-gray-500">{description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Type badge for edit */}
          {isEdit && (
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-800 rounded-xl border border-gray-700">
              <FieldTypeIcon type={type} className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">
                Tipo: <span className="text-white font-medium">{FIELD_TYPE_LABELS[type]}</span>
              </span>
              <span className="text-xs text-gray-500 ml-auto">(no editable)</span>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Descripción
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional para los agentes"
              rows={2}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Options for select type */}
          {type === 'select' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Opciones <span className="text-red-400">*</span>
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="flex-1 px-4 py-2 bg-gray-800 rounded-lg text-sm text-gray-300 border border-gray-700">
                      {option}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        addOption();
                      }
                    }}
                    placeholder="Nueva opción"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addOption();
                    }}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      newOption.trim() 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 cursor-pointer' 
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {errors.options && <p className="mt-1 text-sm text-red-400">{errors.options}</p>}
            </div>
          )}

          {/* Required toggle */}
          <div className="flex items-center justify-between py-3 border-t border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-300">Campo requerido</p>
              <p className="text-xs text-gray-500">Los flujos validarán este campo</p>
            </div>
            <button
              type="button"
              onClick={() => setRequired(!required)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                required ? 'bg-indigo-600' : 'bg-gray-700'
              }`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                required ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Default value */}
          {type !== 'select' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Valor por defecto
              </label>
              {type === 'boolean' ? (
                <select
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Sin valor</option>
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type={type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'url' ? 'url' : type === 'date' ? 'date' : 'text'}
                  value={defaultValue}
                  onChange={(e) => setDefaultValue(e.target.value)}
                  placeholder="Opcional"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              )}
            </div>
          )}

          {type === 'select' && options.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Valor por defecto
              </label>
              <select
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Sin valor</option>
                {options.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 bg-gray-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {isEdit ? 'Guardar' : 'Crear Campo'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= DELETE MODAL =============
interface DeleteModalProps {
  field: CustomField;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteModal({ field, isOpen, onClose, onConfirm }: DeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 text-amber-400 mb-4">
          <div className="p-2 bg-amber-500/20 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">Archivar campo</h3>
        </div>
        <p className="text-gray-400 mb-2">
          ¿Archivar el campo <strong className="text-white">"{field.name}"</strong>?
        </p>
        <p className="text-sm text-gray-500 mb-6">
          El campo quedará inactivo. Los valores existentes se conservarán.
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
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all"
          >
            <Archive className="w-4 h-4" />
            Archivar
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= MAIN PAGE =============
export default function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<CustomFieldType | ''>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | undefined>();
  const [deleteField, setDeleteField] = useState<CustomField | null>(null);

  const loadFields = async () => {
    const data = await getCustomFields(showInactive);
    setFields(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadFields();
  }, [showInactive]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFields();
    setRefreshing(false);
  };

  const filteredFields = useMemo(() => {
    return fields.filter(field => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!field.name.toLowerCase().includes(query) && !field.key.toLowerCase().includes(query)) {
          return false;
        }
      }
      if (selectedType && field.type !== selectedType) {
        return false;
      }
      return true;
    });
  }, [fields, searchQuery, selectedType]);

  const activeFields = filteredFields.filter(f => f.isActive);
  const archivedFields = filteredFields.filter(f => !f.isActive);

  const handleNewField = () => {
    setEditingField(undefined);
    setShowFormModal(true);
  };

  const handleEditField = (field: CustomField) => {
    setEditingField(field);
    setShowFormModal(true);
  };

  const handleSaveField = (savedField: CustomField) => {
    setFields(prev => {
      const index = prev.findIndex(f => f.id === savedField.id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = savedField;
        return updated;
      }
      return [...prev, savedField];
    });
  };

  const handleDeleteField = async () => {
    if (!deleteField) return;
    
    const result = await deleteCustomField(deleteField.id);
    if (result.ok) {
      toast.success('Campo archivado');
      setFields(prev => prev.map(f => 
        f.id === deleteField.id ? { ...f, isActive: false } : f
      ));
    } else {
      toast.error(result.error || 'Error al archivar');
    }
    setDeleteField(null);
  };

  const handleRestoreField = async (field: CustomField) => {
    const result = await restoreCustomField(field.id);
    if (result.ok) {
      toast.success('Campo restaurado');
      setFields(prev => prev.map(f => 
        f.id === field.id ? { ...f, isActive: true } : f
      ));
    } else {
      toast.error(result.error || 'Error al restaurar');
    }
  };

  // Stats
  const stats = {
    total: fields.length,
    active: fields.filter(f => f.isActive).length,
    archived: fields.filter(f => !f.isActive).length,
    types: new Set(fields.map(f => f.type)).size,
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
            <Database className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Campos Personalizados</h1>
            <p className="text-sm text-gray-400">Define campos para recopilar información de contactos</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
            onClick={handleNewField}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 rounded-xl text-white font-medium transition-all hover:scale-105 shadow-lg shadow-indigo-500/25"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Campo</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 p-6 border-b border-gray-800">
        <StatCard icon={<Database className="w-5 h-5" />} label="Total Campos" value={stats.total} color="indigo" />
        <StatCard icon={<CheckCircle className="w-5 h-5" />} label="Activos" value={stats.active} color="green" />
        <StatCard icon={<Archive className="w-5 h-5" />} label="Archivados" value={stats.archived} color="amber" />
        <StatCard icon={<Layers className="w-5 h-5" />} label="Tipos Usados" value={stats.types} color="purple" />
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="border-b border-gray-800 px-6 py-4 bg-gray-900/50">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar por nombre o clave..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as CustomFieldType | '')}
              className="px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-40"
            >
              <option value="">Todos los tipos</option>
              {FIELD_TYPES.map(({ type, label }) => (
                <option key={type} value={type}>{label}</option>
              ))}
            </select>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-400">Mostrar archivados</span>
            </label>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredFields.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="p-4 bg-gray-800/50 rounded-2xl mb-4">
              <Database className="w-12 h-12 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              {searchQuery || selectedType ? 'Sin resultados' : 'Sin campos personalizados'}
            </h3>
            <p className="text-gray-500 mb-6 text-center max-w-md">
              {searchQuery || selectedType 
                ? 'No se encontraron campos que coincidan'
                : 'Crea campos personalizados para recopilar información adicional de tus contactos'}
            </p>
            {!searchQuery && !selectedType && (
              <button
                onClick={handleNewField}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all"
              >
                <Plus className="w-4 h-4" />
                Crear Campo
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Fields */}
            {activeFields.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Campos activos ({activeFields.length})
                </h3>
                <div className="grid gap-3">
                  {activeFields.map((field) => (
                    <div
                      key={field.id}
                      className="group flex items-center gap-4 p-4 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-gray-700 transition-all"
                    >
                      {/* Icon */}
                      <div className="p-3 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-xl border border-indigo-500/20">
                        <FieldTypeIcon type={field.type} className="w-5 h-5 text-indigo-400" />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-white truncate">{field.name}</h4>
                          {field.required && (
                            <span className="px-2 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                              Requerido
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          <code className="text-xs bg-gray-800 text-indigo-400 px-2 py-0.5 rounded font-mono">${field.key}</code>
                          <span className="text-gray-500">{FIELD_TYPE_LABELS[field.type]}</span>
                          {field.description && (
                            <>
                              <span className="text-gray-700">•</span>
                              <span className="text-gray-500 truncate">{field.description}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleEditField(field)}
                          className="p-2 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteField(field)}
                          className="p-2 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                          title="Archivar"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Archived Fields */}
            {showInactive && archivedFields.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                  <Archive className="w-4 h-4 text-amber-500" />
                  Archivados ({archivedFields.length})
                </h3>
                <div className="grid gap-3 opacity-60">
                  {archivedFields.map((field) => (
                    <div
                      key={field.id}
                      className="group flex items-center gap-4 p-4 bg-gray-900/30 border border-gray-800/50 rounded-xl hover:border-gray-700 transition-all"
                    >
                      {/* Icon */}
                      <div className="p-3 bg-gray-800/50 rounded-xl">
                        <FieldTypeIcon type={field.type} className="w-5 h-5 text-gray-500" />
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-400 truncate">{field.name}</h4>
                        <div className="flex items-center gap-3 text-sm">
                          <code className="text-xs bg-gray-800/50 text-gray-500 px-2 py-0.5 rounded font-mono">${field.key}</code>
                          <span className="text-gray-600">{FIELD_TYPE_LABELS[field.type]}</span>
                        </div>
                      </div>
                      
                      {/* Restore */}
                      <button
                        onClick={() => handleRestoreField(field)}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-indigo-400 hover:bg-indigo-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Usage Hint */}
            <div className="p-4 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 rounded-xl border border-indigo-500/20">
              <h4 className="font-medium text-indigo-300 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Uso en Flujos
              </h4>
              <p className="text-sm text-gray-400">
                Usa campos en mensajes con <code className="bg-gray-800 text-indigo-400 px-1.5 py-0.5 rounded">{`{{custom.nombre_campo}}`}</code>.
                Ejemplo: <code className="bg-gray-800 text-indigo-400 px-1.5 py-0.5 rounded">{`Hola, tu número es {{custom.numero_cliente}}`}</code>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <FieldModal
        field={editingField}
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSave={handleSaveField}
      />

      {deleteField && (
        <DeleteModal
          field={deleteField}
          isOpen={!!deleteField}
          onClose={() => setDeleteField(null)}
          onConfirm={handleDeleteField}
        />
      )}
    </div>
  );
}

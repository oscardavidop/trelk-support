/**
 * Contact360Panel - Complete Contact Profile Sidebar
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  X,
  User,
  Phone,
  Globe,
  MessageSquare,
  Calendar,
  Clock,
  Tag,
  Edit3,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Activity,
  BarChart3,
  FileText,
  History,
  Bookmark,
  Ban,
  UserCheck,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  Send,
  Workflow,
  Star,
  PinIcon,
  Hash,
  Settings,
  Type,
  ToggleLeft,
  List,
  Link,
  Mail,
  Archive,
  RotateCcw,
  Search
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
import { toast } from './ui';

// ==================== TYPES ====================

interface IContact360 {
  _id: string;
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  language?: string;
  isBlocked: boolean;
  blockedReason?: string;
  createdAt: string;
  updatedAt?: string;
  lastActivity?: string;
  metadata?: Record<string, any>;
  tags: Array<{ _id: string; name: string; color: string; addedAt: string; addedBy?: string }>;
  customFields: Array<{
    fieldId: string;
    key: string;
    label: string;
    type: string;
    value: any;
    updatedAt?: string;
  }>;
  notes: Array<{
    _id: string;
    content: string;
    isPinned: boolean;
    createdAt: string;
    createdBy: { _id: string; name: string };
  }>;
  stats: {
    totalSessions: number;
    activeSession?: {
      sessionId: string;
      status: string;
      assignedAgent?: { _id: string; name: string };
      createdAt: string;
    };
    avgSessionDuration: number;
    avgResponseTime: number;
    totalMessages: number;
    lastSessionDate?: string;
    surveyAvgScore?: number;
  };
  flowHistory: Array<{
    flowId: string;
    flowName: string;
    executedAt: string;
    status: string;
    completedAt?: string;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
    actor?: { type: string; name?: string };
    metadata?: any;
  }>;
  segments: Array<{ _id: string; name: string; color: string }>;
}

interface ITag {
  _id: string;
  name: string;
  color: string;
}

interface Props {
  contactId: string;
  onClose: () => void;
  onUpdate?: () => void;
}

// ==================== FIELD TYPE HELPERS ====================
const FIELD_TYPES: { type: CustomFieldType; label: string; description: string }[] = [
  { type: 'text', label: 'Texto', description: 'Campo de texto libre' },
  { type: 'number', label: 'Número', description: 'Valores numéricos' },
  { type: 'email', label: 'Email', description: 'Correo electrónico' },
  { type: 'url', label: 'URL', description: 'Enlaces web' },
  { type: 'date', label: 'Fecha', description: 'Selector de fecha' },
  { type: 'boolean', label: 'Sí/No', description: 'Valor booleano' },
  { type: 'select', label: 'Lista', description: 'Opciones predefinidas' },
];

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

// ==================== CUSTOM FIELDS MANAGER MODAL ====================
interface FieldsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFieldsChanged: () => void;
}

function FieldsManagerModal({ isOpen, onClose, onFieldsChanged }: FieldsManagerModalProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    type: 'text' as CustomFieldType,
    description: '',
    required: false,
    options: [] as string[],
    defaultValue: '',
  });
  const [newOption, setNewOption] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [keyTouched, setKeyTouched] = useState(false);

  const loadFields = useCallback(async () => {
    setIsLoading(true);
    const data = await getCustomFields(showInactive);
    setFields(data);
    setIsLoading(false);
  }, [showInactive]);

  useEffect(() => {
    if (isOpen) {
      loadFields();
    }
  }, [isOpen, loadFields]);

  const filteredFields = useMemo(() => {
    return fields.filter(field => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!field.name.toLowerCase().includes(query) && !field.key.toLowerCase().includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [fields, searchQuery]);

  const activeFields = filteredFields.filter(f => f.isActive);
  const archivedFields = filteredFields.filter(f => !f.isActive);

  const resetForm = () => {
    setFormData({
      name: '',
      key: '',
      type: 'text',
      description: '',
      required: false,
      options: [],
      defaultValue: '',
    });
    setNewOption('');
    setErrors({});
    setKeyTouched(false);
    setEditingField(null);
    setShowNewForm(false);
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, name: value }));
    if (!keyTouched && !editingField) {
      setFormData(prev => ({ ...prev, key: generateFieldKey(value) }));
    }
  };

  const handleKeyChange = (value: string) => {
    setKeyTouched(true);
    setFormData(prev => ({ 
      ...prev, 
      key: value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') 
    }));
  };

  const addOption = () => {
    const trimmed = newOption.trim();
    if (trimmed && !formData.options.includes(trimmed)) {
      setFormData(prev => ({ ...prev, options: [...prev.options, trimmed] }));
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    setFormData(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  };

  const openEditForm = (field: CustomField) => {
    setEditingField(field);
    setFormData({
      name: field.name,
      key: field.key,
      type: field.type,
      description: field.description || '',
      required: field.required,
      options: field.options || [],
      defaultValue: field.defaultValue?.toString() || '',
    });
    setKeyTouched(true);
    setShowNewForm(true);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido';
    if (!formData.key.trim()) newErrors.key = 'La clave es requerida';
    else if (!isValidFieldKey(formData.key)) newErrors.key = 'Solo letras minúsculas, números y _';
    if (formData.type === 'select' && formData.options.length === 0) newErrors.options = 'Agrega al menos una opción';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    setIsSaving(true);
    try {
      let parsedDefault: string | number | boolean | undefined = undefined;
      if (formData.defaultValue) {
        if (formData.type === 'number') parsedDefault = parseFloat(formData.defaultValue);
        else if (formData.type === 'boolean') parsedDefault = formData.defaultValue === 'true';
        else parsedDefault = formData.defaultValue;
      }

      if (editingField) {
        const result = await updateCustomField(editingField.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          required: formData.required,
          options: formData.type === 'select' ? formData.options : undefined,
          defaultValue: parsedDefault,
        });
        
        if (result.ok && result.field) {
          toast.success('Campo actualizado');
          setFields(prev => prev.map(f => f.id === result.field!.id ? result.field! : f));
          resetForm();
          onFieldsChanged();
        } else {
          toast.error(result.error || 'Error al actualizar');
        }
      } else {
        const input: CreateCustomFieldInput = {
          name: formData.name.trim(),
          key: formData.key.trim(),
          type: formData.type,
          description: formData.description.trim() || undefined,
          required: formData.required,
          options: formData.type === 'select' ? formData.options : undefined,
          defaultValue: parsedDefault,
        };
        
        const result = await createCustomField(input);
        
        if (result.ok && result.field) {
          toast.success('Campo creado');
          setFields(prev => [...prev, result.field!]);
          resetForm();
          onFieldsChanged();
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

  const handleArchive = async (field: CustomField) => {
    const result = await deleteCustomField(field.id);
    if (result.ok) {
      toast.success('Campo archivado');
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, isActive: false } : f));
      onFieldsChanged();
    } else {
      toast.error(result.error || 'Error al archivar');
    }
  };

  const handleRestore = async (field: CustomField) => {
    const result = await restoreCustomField(field.id);
    if (result.ok) {
      toast.success('Campo restaurado');
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, isActive: true } : f));
      onFieldsChanged();
    } else {
      toast.error(result.error || 'Error al restaurar');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl">
              <Settings className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Gestionar Campos Personalizados</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {showNewForm ? (
            // Form View
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">{editingField ? 'Editar Campo' : 'Nuevo Campo'}</h3>
                <button onClick={resetForm} className="text-sm text-gray-400 hover:text-white">
                  ← Volver a la lista
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ej: Número de cliente"
                  className={`w-full px-4 py-2.5 bg-gray-800 border rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.name ? 'border-red-500' : 'border-gray-700'}`}
                />
                {errors.name && <p className="mt-1 text-sm text-red-400">{errors.name}</p>}
              </div>

              {/* Key (only new) */}
              {!editingField && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Clave interna *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono">$</span>
                    <input
                      type="text"
                      value={formData.key}
                      onChange={(e) => handleKeyChange(e.target.value)}
                      placeholder="numero_cliente"
                      className={`w-full pl-8 pr-4 py-2.5 bg-gray-800 border rounded-xl text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.key ? 'border-red-500' : 'border-gray-700'}`}
                    />
                  </div>
                  {errors.key ? (
                    <p className="mt-1 text-sm text-red-400">{errors.key}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">Usa en flujos: <code className="text-purple-400">{`{{custom.${formData.key || 'campo'}}}`}</code></p>
                  )}
                </div>
              )}

              {/* Type (only new) */}
              {!editingField && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {FIELD_TYPES.map(({ type: t, label }) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, type: t }))}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-all ${
                          formData.type === t 
                            ? 'border-purple-500 bg-purple-500/10 text-purple-300' 
                            : 'border-gray-700 hover:border-gray-600 bg-gray-800/50 text-gray-300'
                        }`}
                      >
                        <FieldTypeIcon type={t} className="w-4 h-4" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Type badge (edit) */}
              {editingField && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 rounded-xl border border-gray-700">
                  <FieldTypeIcon type={formData.type} className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-400">Tipo: <span className="text-white">{FIELD_TYPE_LABELS[formData.type]}</span></span>
                </div>
              )}

              {/* Options for select */}
              {formData.type === 'select' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Opciones *</label>
                  <div className="space-y-2">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm text-gray-300 border border-gray-700">{option}</div>
                        <button onClick={() => removeOption(index)} className="p-2 text-gray-400 hover:text-red-400 rounded-lg">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newOption}
                        onChange={(e) => setNewOption(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                        placeholder="Nueva opción"
                        className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button onClick={addOption} disabled={!newOption.trim()} className={`px-3 py-2 rounded-lg ${newOption.trim() ? 'bg-purple-600 text-white hover:bg-purple-500' : 'bg-gray-700 text-gray-500'}`}>
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {errors.options && <p className="mt-1 text-sm text-red-400">{errors.options}</p>}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descripción opcional"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Required */}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-300">Campo requerido</span>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, required: !prev.required }))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${formData.required ? 'bg-purple-600' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.required ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button onClick={resetForm} className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg">
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {editingField ? 'Guardar' : 'Crear Campo'}
                </button>
              </div>
            </div>
          ) : (
            // List View
            <div className="space-y-4">
              {/* Search & Actions */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar campos..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button
                  onClick={() => setShowNewForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo
                </button>
              </div>

              {/* Toggle archived */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowInactive(!showInactive)}
                  className={`text-xs px-2 py-1 rounded ${showInactive ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  {showInactive ? 'Ocultar archivados' : 'Mostrar archivados'}
                </button>
              </div>

              {/* Loading */}
              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
                </div>
              )}

              {/* Active Fields */}
              {!isLoading && activeFields.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Campos Activos ({activeFields.length})</h4>
                  {activeFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-700 rounded-lg">
                          <FieldTypeIcon type={field.type} className="w-4 h-4 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">{field.name}</p>
                          <p className="text-xs text-gray-500 font-mono">${field.key}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditForm(field)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleArchive(field)} className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded">
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Archived Fields */}
              {!isLoading && showInactive && archivedFields.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="text-xs font-medium text-amber-500/70 uppercase tracking-wider">Archivados ({archivedFields.length})</h4>
                  {archivedFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg border border-gray-800 group opacity-60">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-800 rounded-lg">
                          <FieldTypeIcon type={field.type} className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-400">{field.name}</p>
                          <p className="text-xs text-gray-600 font-mono">${field.key}</p>
                        </div>
                      </div>
                      <button onClick={() => handleRestore(field)} className="flex items-center gap-1 px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        <RotateCcw className="w-3 h-3" />
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!isLoading && activeFields.length === 0 && !searchQuery && (
                <div className="text-center py-8">
                  <Hash className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No hay campos personalizados</p>
                  <button
                    onClick={() => setShowNewForm(true)}
                    className="mt-3 text-sm text-purple-400 hover:text-purple-300"
                  >
                    Crear primer campo →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== COMPONENT ====================

export default function Contact360Panel({ contactId, onClose, onUpdate }: Props) {
  const token = useAuthStore((state) => state.token);
  const currentAgent = useAuthStore((state) => state.agent);

  // Data state
  const [contact, setContact] = useState<IContact360 | null>(null);
  const [allTags, setAllTags] = useState<ITag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'flows' | 'notes'>('overview');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['info', 'tags', 'fields', 'stats']));
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<{ firstName?: string; lastName?: string; language?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  // Tags state
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [tagLoading, setTagLoading] = useState(false);

  // Notes state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  // Custom Fields state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingFieldValue, setEditingFieldValue] = useState<any>(null);
  const [showFieldsManager, setShowFieldsManager] = useState(false);

  // ==================== API CALLS ====================

  const fetchContact = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch contact');

      const data = await response.json();
      setContact(data.contact);
      setEditData({
        firstName: data.contact.firstName,
        lastName: data.contact.lastName,
        language: data.contact.language,
      });
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }, [token, contactId]);

  const fetchTags = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/tags', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAllTags(data.tags || []);
      }
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  }, [token]);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchContact(), fetchTags()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchContact, fetchTags]);

  // ==================== ACTIONS ====================

  const handleSaveEdit = async () => {
    if (!token || !contact) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData),
      });

      if (!response.ok) throw new Error('Failed to update contact');

      await fetchContact();
      setIsEditing(false);
      onUpdate?.();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    if (!token) return;

    setTagLoading(true);
    try {
      const response = await fetch(`/api/users/${contactId}/tags`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tagId }),
      });

      if (!response.ok) throw new Error('Failed to add tag');

      await fetchContact();
      setShowTagPicker(false);
      onUpdate?.();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setTagLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!token) return;

    setTagLoading(true);
    try {
      const response = await fetch(`/api/users/${contactId}/tags/${tagId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to remove tag');

      await fetchContact();
      onUpdate?.();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setTagLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!token || !newNoteContent.trim()) return;

    setNoteLoading(true);
    try {
      const response = await fetch(`/api/contacts/${contactId}/notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newNoteContent }),
      });

      if (!response.ok) throw new Error('Failed to add note');

      await fetchContact();
      setNewNoteContent('');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!token || !confirm('¿Eliminar esta nota?')) return;

    try {
      const response = await fetch(`/api/contacts/${contactId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete note');

      await fetchContact();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleBlockToggle = async () => {
    if (!token || !contact) return;

    const action = contact.isBlocked ? 'unblock' : 'block';
    const reason = contact.isBlocked ? undefined : prompt('Motivo del bloqueo:');

    if (!contact.isBlocked && reason === null) return; // Cancelled

    try {
      const response = await fetch(`/api/contacts/${contactId}/${action}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) throw new Error(`Failed to ${action} contact`);

      await fetchContact();
      onUpdate?.();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleSaveCustomField = async (fieldId: string) => {
    if (!token) return;

    try {
      const response = await fetch(`/api/users/${contactId}/custom-fields/${fieldId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ value: editingFieldValue }),
      });

      if (!response.ok) throw new Error('Failed to update field');

      await fetchContact();
      setEditingField(null);
      setEditingFieldValue(null);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ==================== HELPERS ====================

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('es', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (date: string | undefined) => {
    if (!date) return '—';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Hace un momento';
    if (minutes < 60) return `Hace ${minutes} min`;
    if (hours < 24) return `Hace ${hours} horas`;
    if (days < 7) return `Hace ${days} días`;
    return d.toLocaleDateString('es', { day: '2-digit', month: 'short' });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'message_sent':
      case 'message_received':
        return <MessageSquare className="w-4 h-4" />;
      case 'session_created':
      case 'session_closed':
        return <Activity className="w-4 h-4" />;
      case 'tag_added':
      case 'tag_removed':
        return <Tag className="w-4 h-4" />;
      case 'flow_triggered':
      case 'flow_completed':
        return <Workflow className="w-4 h-4" />;
      case 'contact_blocked':
      case 'contact_unblocked':
        return <Ban className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  const availableTagsToAdd = allTags.filter(
    (tag) => !contact?.tags.some((t) => t._id === tag._id)
  );

  // ==================== RENDER ====================

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-[480px] bg-gray-950 border-l border-gray-800 z-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="fixed inset-y-0 right-0 w-[480px] bg-gray-950 border-l border-gray-800 z-50 flex flex-col items-center justify-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-400">{error || 'Contact not found'}</p>
        <button onClick={onClose} className="mt-4 text-blue-400 hover:text-blue-300">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] bg-gray-950 border-l border-gray-800 z-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
              {contact.firstName?.[0] || contact.username?.[0] || '?'}
            </div>

            {/* Name & Status */}
            <div>
              {isEditing ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editData.firstName || ''}
                    onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                    placeholder="Nombre"
                    className="w-24 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  />
                  <input
                    type="text"
                    value={editData.lastName || ''}
                    onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                    placeholder="Apellido"
                    className="w-24 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                  />
                </div>
              ) : (
                <h2 className="text-xl font-bold text-white">{contact.fullName}</h2>
              )}
              {contact.username && (
                <p className="text-gray-400">@{contact.username}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                {contact.isBlocked ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                    <Ban className="w-3 h-3" />
                    Bloqueado
                  </span>
                ) : contact.stats.activeSession ? (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                    <MessageSquare className="w-3 h-3" />
                    En chat
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                    <UserCheck className="w-3 h-3" />
                    Activo
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="p-2 text-green-400 hover:bg-gray-700/50 rounded-lg"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="p-2 text-gray-400 hover:bg-gray-700/50 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg"
                  title="Editar"
                >
                  <Edit3 className="w-5 h-5" />
                </button>
                <button
                  onClick={handleBlockToggle}
                  className={`p-2 rounded-lg ${contact.isBlocked ? 'text-green-400 hover:bg-green-500/20' : 'text-red-400 hover:bg-red-500/20'}`}
                  title={contact.isBlocked ? 'Desbloquear' : 'Bloquear'}
                >
                  {contact.isBlocked ? <UserCheck className="w-5 h-5" /> : <Ban className="w-5 h-5" />}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Segments */}
        {contact.segments.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {contact.segments.map((segment) => (
              <span
                key={segment._id}
                className="px-2 py-0.5 text-xs rounded-full flex items-center gap-1"
                style={{ backgroundColor: `${segment.color}20`, color: segment.color }}
              >
                <Bookmark className="w-3 h-3" />
                {segment.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-gray-800">
        {[
          { id: 'overview', label: 'General', icon: User },
          { id: 'activity', label: 'Actividad', icon: Activity },
          { id: 'flows', label: 'Flows', icon: Workflow },
          { id: 'notes', label: 'Notas', icon: FileText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* Basic Info Section */}
            <div className="bg-gray-900/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('info')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-900/50"
              >
                <span className="font-medium text-white">Información</span>
                {expandedSections.has('info') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedSections.has('info') && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Telegram ID */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Telegram ID</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white">{contact.telegramId}</span>
                      <button
                        onClick={() => copyToClipboard(String(contact.telegramId), 'telegramId')}
                        className="text-gray-400 hover:text-white"
                      >
                        {copiedField === 'telegramId' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Username */}
                  {contact.username && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Username</span>
                      <span className="text-white">@{contact.username}</span>
                    </div>
                  )}

                  {/* Language */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Idioma</span>
                    {isEditing ? (
                      <select
                        value={editData.language || ''}
                        onChange={(e) => setEditData({ ...editData, language: e.target.value })}
                        className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      >
                        <option value="">—</option>
                        <option value="es">🇪🇸 Español</option>
                        <option value="en">🇺🇸 English</option>
                        <option value="pt">🇧🇷 Português</option>
                        <option value="fr">🇫🇷 Français</option>
                        <option value="de">🇩🇪 Deutsch</option>
                      </select>
                    ) : (
                      <span className="text-white">{contact.language?.toUpperCase() || '—'}</span>
                    )}
                  </div>

                  {/* Created */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Contacto desde</span>
                    <span className="text-white">{formatDate(contact.createdAt)}</span>
                  </div>

                  {/* Last Activity */}
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Última actividad</span>
                    <span className="text-white">{formatRelativeTime(contact.lastActivity)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Tags Section */}
            <div className="bg-gray-900/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('tags')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-900/50"
              >
                <span className="font-medium text-white flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-400" />
                  Etiquetas ({contact.tags.length})
                </span>
                {expandedSections.has('tags') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedSections.has('tags') && (
                <div className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag._id}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-sm"
                        style={{ backgroundColor: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40` }}
                      >
                        {tag.name}
                        <button
                          onClick={() => handleRemoveTag(tag._id)}
                          className="hover:opacity-70"
                          disabled={tagLoading}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}

                    {/* Add Tag Button */}
                    <div className="relative">
                      <button
                        onClick={() => setShowTagPicker(!showTagPicker)}
                        className="flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-gray-800/50 text-gray-300 hover:bg-gray-700"
                        disabled={tagLoading}
                      >
                        <Plus className="w-3 h-3" />
                        Añadir
                      </button>

                      {showTagPicker && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-auto">
                          {availableTagsToAdd.length === 0 ? (
                            <p className="p-3 text-gray-400 text-sm">No hay más etiquetas</p>
                          ) : (
                            availableTagsToAdd.map((tag) => (
                              <button
                                key={tag._id}
                                onClick={() => handleAddTag(tag._id)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-800/50"
                              >
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: tag.color }}
                                />
                                <span className="text-white">{tag.name}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Fields Section */}
            <div className="bg-gray-900/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('fields')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-900/50"
              >
                <span className="font-medium text-white flex items-center gap-2">
                  <Hash className="w-4 h-4 text-purple-400" />
                  Campos Personalizados
                </span>
                {expandedSections.has('fields') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedSections.has('fields') && (
                <div className="px-4 pb-4 space-y-3">
                  {contact.customFields.map((field) => (
                    <div key={field.fieldId} className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">{field.label}</span>
                      {editingField === field.fieldId ? (
                        <div className="flex items-center gap-2">
                          {field.type === 'boolean' ? (
                            <select
                              value={String(editingFieldValue)}
                              onChange={(e) => setEditingFieldValue(e.target.value === 'true')}
                              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                            >
                              <option value="true">Sí</option>
                              <option value="false">No</option>
                            </select>
                          ) : field.type === 'number' ? (
                            <input
                              type="number"
                              value={editingFieldValue || ''}
                              onChange={(e) => setEditingFieldValue(Number(e.target.value))}
                              className="w-24 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                            />
                          ) : (
                            <input
                              type="text"
                              value={editingFieldValue || ''}
                              onChange={(e) => setEditingFieldValue(e.target.value)}
                              className="w-32 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                            />
                          )}
                          <button onClick={() => handleSaveCustomField(field.fieldId)} className="text-green-400">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditingField(null)} className="text-gray-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-white">
                            {field.type === 'boolean'
                              ? field.value
                                ? 'Sí'
                                : 'No'
                              : field.value ?? '—'}
                          </span>
                          <button
                            onClick={() => {
                              setEditingField(field.fieldId);
                              setEditingFieldValue(field.value);
                            }}
                            className="text-gray-400 hover:text-white"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {contact.customFields.length === 0 && (
                    <p className="text-gray-400 text-sm text-center py-2">No hay campos personalizados</p>
                  )}

                  {/* Manage Fields Button */}
                  <button
                    onClick={() => setShowFieldsManager(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 mt-2 text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg border border-dashed border-gray-700 hover:border-purple-500/50 transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    Gestionar campos
                  </button>
                </div>
              )}
            </div>

            {/* Stats Section */}
            <div className="bg-gray-900/50 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('stats')}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-900/50"
              >
                <span className="font-medium text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-green-400" />
                  Estadísticas
                </span>
                {expandedSections.has('stats') ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedSections.has('stats') && (
                <div className="px-4 pb-4 grid grid-cols-2 gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{contact.stats.totalSessions}</div>
                    <div className="text-xs text-gray-400">Sesiones</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{contact.stats.totalMessages}</div>
                    <div className="text-xs text-gray-400">Mensajes</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{contact.stats.avgSessionDuration || 0}m</div>
                    <div className="text-xs text-gray-400">Duración media</div>
                  </div>
                  <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{contact.stats.avgResponseTime || 0}s</div>
                    <div className="text-xs text-gray-400">Tiempo respuesta</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="p-4">
            <div className="space-y-3">
              {contact.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-gray-300">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{formatRelativeTime(activity.timestamp)}</span>
                      {activity.actor?.name && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-xs text-gray-400">{activity.actor.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {contact.recentActivity.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay actividad reciente</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'flows' && (
          <div className="p-4">
            <div className="space-y-3">
              {contact.flowHistory.map((flow, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      flow.status === 'completed'
                        ? 'bg-green-500/20 text-green-400'
                        : flow.status === 'running'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    <Workflow className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{flow.flowName}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          flow.status === 'completed'
                            ? 'bg-green-500/20 text-green-400'
                            : flow.status === 'running'
                            ? 'bg-blue-500/20 text-blue-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {flow.status === 'completed' ? 'Completado' : flow.status === 'running' ? 'En ejecución' : flow.status}
                      </span>
                      <span className="text-xs text-gray-400">{formatRelativeTime(flow.executedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {contact.flowHistory.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Workflow className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No ha ejecutado ningún flow</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="p-4">
            {/* Add Note */}
            <div className="mb-4">
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Añadir una nota interna..."
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                rows={3}
              />
              <button
                onClick={handleAddNote}
                disabled={!newNoteContent.trim() || noteLoading}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
              >
                {noteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Añadir Nota
              </button>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              {contact.notes.map((note) => (
                <div
                  key={note._id}
                  className={`p-3 rounded-lg ${note.isPinned ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-gray-900/50'}`}
                >
                  {note.isPinned && (
                    <div className="flex items-center gap-1 text-xs text-yellow-500 mb-2">
                      <PinIcon className="w-3 h-3" />
                      Fijada
                    </div>
                  )}
                  <p className="text-white text-sm whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-gray-400">
                      {note.createdBy.name} • {formatRelativeTime(note.createdAt)}
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note._id)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {contact.notes.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No hay notas</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom Fields Manager Modal */}
      <FieldsManagerModal
        isOpen={showFieldsManager}
        onClose={() => setShowFieldsManager(false)}
        onFieldsChanged={fetchContact}
      />
    </div>
  );
}

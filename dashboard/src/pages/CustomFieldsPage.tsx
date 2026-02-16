import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Filter, Type, Hash, Calendar, ToggleLeft, List, Link, Mail,
  Edit3, Archive, RotateCcw, Loader2, X, Check, AlertTriangle, RefreshCw,
  Database, CheckCircle, FileText, Layers, Trash2
} from 'lucide-react';
import {
  getCustomFields, createCustomField, updateCustomField, deleteCustomField,
  restoreCustomField, generateFieldKey, isValidFieldKey, FIELD_TYPE_LABELS,
  type CustomField, type CustomFieldType, type CreateCustomFieldInput,
} from '../services/customFieldsApi';
import { toast } from '../components/ui';

// ============= CONFIG =============

const FIELD_TYPES: { type: CustomFieldType; label: string; description: string; icon: any }[] = [
  { type: 'text', label: 'Texto', description: 'Texto libre', icon: Type },
  { type: 'number', label: 'Número', description: 'Valores numéricos', icon: Hash },
  { type: 'email', label: 'Email', description: 'Correo electrónico', icon: Mail },
  { type: 'url', label: 'URL', description: 'Enlaces web', icon: Link },
  { type: 'date', label: 'Fecha', description: 'Selector de fecha', icon: Calendar },
  { type: 'boolean', label: 'Sí/No', description: 'Interruptor', icon: ToggleLeft },
  { type: 'select', label: 'Lista', description: 'Opciones fijas', icon: List },
];

// ============= MAIN PAGE =============

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<CustomFieldType | ''>('');

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | undefined>();
  const [deleteField, setDeleteField] = useState<CustomField | null>(null);

  const loadFields = async () => {
    const data = await getCustomFields(showInactive);
    setFields(data);
    setIsLoading(false);
  };

  useEffect(() => { loadFields(); }, [showInactive]);

  const handleRefresh = async () => { setRefreshing(true); await loadFields(); setRefreshing(false); };

  const filteredFields = useMemo(() => {
    return fields.filter(field => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!field.name.toLowerCase().includes(query) && !field.key.toLowerCase().includes(query)) return false;
      }
      if (selectedType && field.type !== selectedType) return false;
      return true;
    });
  }, [fields, searchQuery, selectedType]);

  const activeFields = filteredFields.filter(f => f.isActive);
  const archivedFields = filteredFields.filter(f => !f.isActive);

  // Handlers
  const handleSaveField = (savedField: CustomField) => {
    setFields(prev => {
      const index = prev.findIndex(f => f.id === savedField.id);
      return index >= 0 ? prev.map((f, i) => i === index ? savedField : f) : [...prev, savedField];
    });
  };

  const handleDeleteField = async () => {
    if (!deleteField) return;
    const result = await deleteCustomField(deleteField.id);
    if (result.ok) {
      toast.success('Campo archivado');
      setFields(prev => prev.map(f => f.id === deleteField.id ? { ...f, isActive: false } : f));
    } else {
      toast.error(result.error || 'Error al archivar');
    }
    setDeleteField(null);
  };

  const handleRestoreField = async (field: CustomField) => {
    const result = await restoreCustomField(field.id);
    if (result.ok) {
      toast.success('Campo restaurado');
      setFields(prev => prev.map(f => f.id === field.id ? { ...f, isActive: true } : f));
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
      <div className="flex-1 flex items-center justify-center h-full bg-zinc-950">
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
                <Database className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Campos Personalizados</h1>
                <p className="text-sm text-zinc-400">Estructura de datos para contactos</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="group p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-50 transition-all"
              >
                <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform'}`} />
              </button>

              <button
                onClick={() => { setEditingField(undefined); setShowFormModal(true); }}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-zinc-50 font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                <span>Nuevo Campo</span>
              </button>
            </div>
          </div>

          {/* Stats Bar (Glassy) */}
          <div className="flex items-center gap-4 p-1.5 bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl w-fit mb-6">
            <StatBadge icon={Layers} count={stats.total} label="Total" color="text-zinc-200" bg="bg-zinc-800" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={CheckCircle} count={stats.active} label="Activos" color="text-emerald-400" bg="bg-emerald-500/10" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Archive} count={stats.archived} label="Archivados" color="text-amber-400" bg="bg-amber-500/10" />
            <div className="h-4 w-px bg-white/10" />
            <StatBadge icon={Type} count={stats.types} label="Tipos" color="text-indigo-400" bg="bg-indigo-500/10" />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[280px] max-w-md group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar campos..."
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-xl text-sm text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as CustomFieldType | '')}
                className="px-3 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 cursor-pointer"
              >
                <option value="">Todos los tipos</option>
                {FIELD_TYPES.map(({ type, label }) => (
                  <option key={type} value={type}>{label}</option>
                ))}
              </select>

              <button
                onClick={() => setShowInactive(!showInactive)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${showInactive
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                {showInactive ? <Archive className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-zinc-600" />}
                <span>Archivados</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-4 custom-scrollbar">
          {filteredFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 opacity-60">
              <Database className="w-16 h-16 mb-4 stroke-1" />
              <p className="text-lg font-medium">{searchQuery ? 'Sin resultados' : 'No hay campos creados'}</p>
            </div>
          ) : (
            <div className="space-y-8">

              {/* Active Fields */}
              {activeFields.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-zinc-500 st pl-1">Campos Activos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeFields.map(field => (
                      <FieldCard
                        key={field.id}
                        field={field}
                        onEdit={() => { setEditingField(field); setShowFormModal(true); }}
                        onDelete={() => setDeleteField(field)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Archived Fields */}
              {showInactive && archivedFields.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                  <h3 className="text-xs font-bold text-amber-500/70 st pl-1 flex items-center gap-2">
                    <Archive className="w-3 h-3" /> Archivados
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-75 grayscale-[0.3]">
                    {archivedFields.map(field => (
                      <FieldCard
                        key={field.id}
                        field={field}
                        archived
                        onRestore={() => handleRestoreField(field)}
                      />
                    ))}
                  </div>
                </div>
              )}

               <div className="bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 mt-4">
                <FileText className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-indigo-300 mb-1">Uso en Flows</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Puedes referenciar estos campos en tus mensajes usando la sintaxis: 
                    <code className="mx-1 bg-black/30 px-1.5 py-0.5 rounded text-indigo-200 border border-indigo-500/30">{'{{custom.clave_campo}}'}</code>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        
      </div>

      {/* Modals */}
      {showFormModal && (
        <FieldModal
          isOpen={showFormModal}
          onClose={() => { setShowFormModal(false); setEditingField(undefined); }}
          onSave={handleSaveField}
          field={editingField}
        />
      )}

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

// ============= SUB-COMPONENTS =============

function StatBadge({ icon: Icon, count, label, color, bg }: any) {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-bold text-lg ${color}`}>{count}</span>
        <span className="text-[10px] font-bold text-zinc-500">{label}</span>
      </div>
    </div>
  );
}

function FieldCard({ field, onEdit, onDelete, onRestore, archived }: any) {
  const typeInfo = FIELD_TYPES.find(t => t.type === field.type) || FIELD_TYPES[0];
  const Icon = typeInfo.icon;

  return (
    <div className={`group relative bg-zinc-900/60 backdrop-blur-sm border rounded-xl p-4 transition-all duration-300 ${archived ? 'border-zinc-800/50 bg-zinc-900/30' : 'border-zinc-800 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-black/20'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${archived ? 'bg-zinc-800 border-zinc-700 text-zinc-500' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className={`font-medium truncate ${archived ? 'text-zinc-500' : 'text-zinc-200'}`}>{field.name}</h4>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-zinc-500">{typeInfo.label}</span>
              {field.required && (
                <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded border border-red-500/20 text-[10px] font-bold ">
                  Req
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {archived ? (
            <button onClick={onRestore} className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors" title="Restaurar">
              <RotateCcw className="w-4 h-4" />
            </button>
          ) : (
            <>
              <button onClick={onEdit} className="p-1.5 text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors">
                <Edit3 className="w-4 h-4" />
              </button>
              <button onClick={onDelete} className="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors" title="Archivar">
                <Archive className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50">
        <code className="text-[10px] font-mono text-zinc-500 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800">
          ${field.key}
        </code>
        {field.description && (
          <span className="text-xs text-zinc-600 truncate max-w-[150px]" title={field.description}>
            {field.description}
          </span>
        )}
      </div>
    </div>
  );
}

// ============= FIELD FORM SIDEBAR (The Fix) =============

interface FieldModalProps {
  field?: CustomField;
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: CustomField) => void;
}

function FieldModal({ field, isOpen, onClose, onSave }: FieldModalProps) {
  if (!isOpen) return null;

  const isEdit = !!field;
  const [formData, setFormData] = useState({
    name: field?.name || '',
    key: field?.key || '',
    type: field?.type || 'text',
    description: field?.description || '',
    required: field?.required || false,
    options: field?.options || [],
    defaultValue: field?.defaultValue?.toString() || ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [newOption, setNewOption] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [keyTouched, setKeyTouched] = useState(!!field);

  // Auto-generate key logic
  const handleNameChange = (val: string) => {
    const newState = { ...formData, name: val };
    if (!keyTouched && !isEdit) {
      newState.key = generateFieldKey(val);
    }
    setFormData(newState);
    if (errors.name) setErrors({ ...errors, name: null });
  };

  const handleKeyChange = (val: string) => {
    setKeyTouched(true);
    setFormData({ ...formData, key: val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') });
  };

  const addOption = () => {
    const trimmed = newOption.trim();
    if (trimmed) {
      if (!formData.options.includes(trimmed)) {
        setFormData(prev => ({
          ...prev,
          options: [...prev.options, trimmed]
        }));
        setNewOption('');
        // Clear error if exists
        if (errors.options) setErrors(prev => ({ ...prev, options: null }));
      } else {
        setErrors(prev => ({ ...prev, options: 'Esta opción ya existe' }));
      }
    }
  };

  const removeOption = (idx: number) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== idx)
    }));
  };

  const handleSave = async () => {
    const newErrors: Record<string, string | null> = {};
    if (!formData.name.trim()) newErrors.name = 'Requerido';
    if (!formData.key.trim()) newErrors.key = 'Requerido';
    if (formData.type === 'select' && formData.options.length === 0) newErrors.options = 'Añade al menos una opción';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      // Fix: Ensure correct types for default value
      let parsedDefault: any = formData.defaultValue;
      if (formData.type === 'number' && parsedDefault) parsedDefault = parseFloat(formData.defaultValue);
      if (formData.type === 'boolean') parsedDefault = formData.defaultValue === 'true';
      if (!formData.defaultValue) parsedDefault = undefined;

      const payload = {
        id: field?.id,
        ...formData,
        name: formData.name.trim(),
        key: formData.key.trim(),
        description: formData.description.trim() || undefined,
        options: formData.type === 'select' ? formData.options : undefined,
        defaultValue: parsedDefault
      };

      if (isEdit) {
        const result = await updateCustomField(field.id, payload);
        if (result.ok && result.field) {
          toast.success('Actualizado');
          onSave(result.field);
          onClose();
        } else if (result.error) toast.error(result.error);
      } else {
        const result = await createCustomField(payload as any);
        if (result.ok && result.field) {
          toast.success('Creado');
          onSave(result.field);
          onClose();
        } else if (result.error) toast.error(result.error);
      }
    } catch (e) {
      toast.error('Error inesperado');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-zinc-900 border-l border-zinc-800 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-900/95">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
              {isEdit ? <Edit3 className="w-5 h-5 text-indigo-500" /> : <Plus className="w-5 h-5 text-indigo-500" />}
            </div>
            <h2 className="text-lg font-bold text-zinc-50">{isEdit ? 'Editar Campo' : 'Nuevo Campo'}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          <div className="space-y-5">
            {/* NAME */}
            <InputGroup
              label="Nombre"
              value={formData.name}
              onChange={(e: any) => handleNameChange(e.target.value)}
              placeholder="Ej: Número de Cliente"
              error={errors.name}
            />

            {/* KEY (Only new) */}
            {!isEdit ? (
              <InputGroup
                label="Clave Interna"
                value={formData.key}
                onChange={(e: any) => handleKeyChange(e.target.value)}
                placeholder="numero_cliente"
                mono
                prefix="$"
                error={errors.key}
              />
            ) : (
              <div className="p-3 bg-zinc-800/30 border border-zinc-800 rounded-xl flex flex-col gap-1">
                <span className="text-xs text-zinc-500 font-bold">Clave Interna</span>
                <code className="text-sm text-indigo-300 font-mono">${formData.key}</code>
              </div>
            )}

            {/* TYPE SELECTION */}
            {!isEdit ? (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2 ">Tipo de Dato</label>
                <div className="grid grid-cols-2 gap-2">
                  {FIELD_TYPES.map(({ type, label, icon: Icon }) => (
                    <button
                      key={type}
                      onClick={() => setFormData({ ...formData, type })}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${formData.type === type
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_10px_rgba(99,102,241,0.1)]'
                          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                        }`}
                    >
                      <Icon className={`w-4 h-4 ${formData.type === type ? 'text-indigo-400' : 'text-zinc-500'}`} />
                      <span className={`text-sm ${formData.type === type ? 'text-zinc-50' : 'text-zinc-400'}`}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-zinc-800/30 border border-zinc-800 rounded-xl flex items-center justify-between">
                <span className="text-xs text-zinc-500 font-bold">Tipo de dato</span>
                <span className="text-sm font-medium text-zinc-50">{FIELD_TYPE_LABELS[formData.type]}</span>
              </div>
            )}

            {/* DESCRIPTION */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 ">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Para uso interno..."
                rows={2}
                className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
              />
            </div>

            {/* --- FIXED LIST (SELECT) OPTIONS SECTION --- */}
            {formData.type === 'select' && (
              <div className="bg-zinc-900/50 p-4 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-zinc-400 ">Opciones de Lista</label>
                  <span className="text-xs text-zinc-500">{formData.options.length} opciones</span>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addOption();
                      }
                    }}
                    placeholder="Escribe y presiona Enter..."
                    className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-50 focus:border-indigo-500 outline-none"
                  />
                  <button
                    onClick={(e) => { e.preventDefault(); addOption(); }}
                    type="button"
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-50 border border-zinc-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable list of options */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar bg-zinc-950/30 p-2 rounded-lg border border-zinc-800/50">
                  {formData.options.length === 0 && (
                    <p className="text-xs text-zinc-500 text-center py-2 italic">No hay opciones añadidas</p>
                  )}
                  {formData.options.map((opt, i) => (
                    <div key={i} className="flex justify-between items-center px-3 py-1.5 bg-zinc-800/50 rounded border border-zinc-800/50 group">
                      <span className="text-sm text-zinc-300">{opt}</span>
                      <button
                        type="button"
                        onClick={() => removeOption(i)}
                        className="text-zinc-500 hover:text-red-400 opacity-60 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {errors.options && <p className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {errors.options}</p>}
              </div>
            )}

            {/* CONFIG TOGGLES */}
            <div className="flex items-center justify-between py-2 border-t border-zinc-800 mt-4">
              <div>
                <p className="text-sm font-medium text-zinc-200">Requerido</p>
                <p className="text-xs text-zinc-500">Obligatorio en formularios</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, required: !formData.required })}
                className={`w-10 h-6 rounded-full relative transition-colors ${formData.required ? 'bg-indigo-600' : 'bg-zinc-700'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${formData.required ? 'left-5' : 'left-1'}`} />
              </button>
            </div>

            {/* --- DYNAMIC DEFAULT VALUE INPUT --- */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5 ">Valor por Defecto</label>

              {/* Logic for different input types based on field type */}
              {formData.type === 'text' || formData.type === 'email' || formData.type === 'url' ? (
                <input
                  type={formData.type === 'text' ? 'text' : formData.type}
                  value={formData.defaultValue}
                  onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                  placeholder="Opcional"
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              ) : formData.type === 'number' ? (
                <input
                  type="number"
                  value={formData.defaultValue}
                  onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              ) : formData.type === 'date' ? (
                <input
                  type="date"
                  value={formData.defaultValue}
                  onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                />
              ) : formData.type === 'boolean' ? (
                <select
                  value={formData.defaultValue}
                  onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Sin valor por defecto</option>
                  <option value="true">Sí (Verdadero)</option>
                  <option value="false">No (Falso)</option>
                </select>
              ) : formData.type === 'select' ? (
                <select
                  value={formData.defaultValue}
                  onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-indigo-500"
                  disabled={formData.options.length === 0}
                >
                  <option value="">Selecciona una opción por defecto</option>
                  {formData.options.map((o, i) => <option key={i} value={o}>{o}</option>)}
                </select>
              ) : null}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/95">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-xl transition-all font-medium">Cancelar</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-medium rounded-xl shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{isEdit ? 'Guardar Cambios' : 'Crear Campo'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ field, isOpen, onClose, onConfirm }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-6 text-center">
        <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
          <Trash2 className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-zinc-50 mb-2">Archivar Campo</h2>
        <p className="text-zinc-400 mb-6">
          El campo <strong className="text-zinc-50">{field.name}</strong> dejará de estar disponible. Los datos existentes se mantendrán.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all font-medium">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-zinc-50 rounded-xl transition-all font-medium shadow-lg shadow-amber-900/20">Archivar</button>
        </div>
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder, mono, prefix, error, type = 'text' }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5 ">{label}</label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">{prefix}</span>}
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full ${prefix ? 'pl-7' : 'px-3'} py-2.5 bg-zinc-950 border ${error ? 'border-red-500' : 'border-zinc-800'} rounded-xl text-zinc-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all ${mono ? 'font-mono' : ''}`}
        />
      </div>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
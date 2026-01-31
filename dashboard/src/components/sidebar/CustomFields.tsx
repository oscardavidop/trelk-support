import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Settings, Edit2, Check, X, Loader2, Type, Hash, Link as LinkIcon, 
  CheckSquare, Calendar, Plus, Search, Archive, RotateCcw, 
  ToggleLeft, List, Mail, Trash2, ArrowLeft 
} from 'lucide-react';
import type { CustomFieldValue } from '../../types';
import { setUserFieldValue } from '../../services/contactApi';
import {
  getCustomFields, createCustomField, updateCustomField, deleteCustomField, restoreCustomField,
  generateFieldKey, isValidFieldKey, FIELD_TYPE_LABELS,
  type CustomField, type CustomFieldType, type CreateCustomFieldInput,
} from '../../services/customFieldsApi';
import { toast } from '../../stores/toastStore';

interface CustomFieldsProps {
  userId: string;
  fields: CustomFieldValue[];
  onFieldUpdated: () => void;
}

// Configuración de Tipos
const FIELD_TYPES: { type: CustomFieldType; label: string }[] = [
  { type: 'text', label: 'Texto' },
  { type: 'number', label: 'Número' },
  { type: 'email', label: 'Email' },
  { type: 'url', label: 'URL' },
  { type: 'date', label: 'Fecha' },
  { type: 'boolean', label: 'Sí/No' },
  { type: 'select', label: 'Lista' },
];

const FieldTypeIcon = ({ type, className = "w-4 h-4" }: { type: string; className?: string }) => {
  switch (type) {
    case 'text': return <Type className={className} />;
    case 'number': return <Hash className={className} />;
    case 'date': return <Calendar className={className} />;
    case 'boolean': return <ToggleLeft className={className} />;
    case 'select': return <List className={className} />;
    case 'url': return <LinkIcon className={className} />;
    case 'email': return <Mail className={className} />;
    default: return <Type className={className} />;
  }
};

// ============= FIELDS MANAGER MODAL (Premium Zinc) =============

function FieldsManagerModal({ isOpen, onClose, onFieldsChanged }: { isOpen: boolean; onClose: () => void; onFieldsChanged: () => void; }) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({ name: '', key: '', type: 'text' as CustomFieldType, description: '', required: false, options: [] as string[], defaultValue: '' });
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

  useEffect(() => { if (isOpen) loadFields(); }, [isOpen, loadFields]);

  const filteredFields = useMemo(() => fields.filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.key.includes(searchQuery.toLowerCase())), [fields, searchQuery]);
  const activeFields = filteredFields.filter(f => f.isActive);
  const archivedFields = filteredFields.filter(f => !f.isActive);

  const resetForm = () => {
    setFormData({ name: '', key: '', type: 'text', description: '', required: false, options: [], defaultValue: '' });
    setNewOption(''); setErrors({}); setKeyTouched(false); setEditingField(null); setShowNewForm(false);
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, name: value }));
    if (!keyTouched && !editingField) setFormData(prev => ({ ...prev, key: generateFieldKey(value) }));
  };

  const handleKeyChange = (value: string) => {
    setKeyTouched(true);
    setFormData(prev => ({ ...prev, key: value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }));
  };

  const addOption = () => {
    if (newOption.trim() && !formData.options.includes(newOption.trim())) {
      setFormData(prev => ({ ...prev, options: [...prev.options, newOption.trim()] }));
      setNewOption('');
    }
  };

  const handleSave = async () => {
    // Basic validation logic simplified for UI demo
    if (!formData.name || !formData.key) return setErrors({ name: !formData.name ? 'Requerido' : '', key: !formData.key ? 'Requerido' : '' });
    setIsSaving(true);
    
    try {
      const payload: any = { ...formData, description: formData.description || undefined, options: formData.type === 'select' ? formData.options : undefined };
      
      let result;
      if (editingField) result = await updateCustomField(editingField.id, payload);
      else result = await createCustomField(payload as CreateCustomFieldInput);

      if (result.ok) {
        toast.success(editingField ? 'Campo actualizado' : 'Campo creado');
        if (editingField) setFields(prev => prev.map(f => f.id === result.field!.id ? result.field! : f));
        else setFields(prev => [...prev, result.field!]);
        resetForm();
        onFieldsChanged();
      } else {
        toast.error(result.error || 'Error al guardar');
      }
    } catch { toast.error('Error de conexión'); } 
    finally { setIsSaving(false); }
  };

  const handleArchive = async (field: CustomField) => {
    const res = await deleteCustomField(field.id);
    if (res.ok) { setFields(prev => prev.map(f => f.id === field.id ? { ...f, isActive: false } : f)); onFieldsChanged(); }
  };

  const handleRestore = async (field: CustomField) => {
    const res = await restoreCustomField(field.id);
    if (res.ok) { setFields(prev => prev.map(f => f.id === field.id ? { ...f, isActive: true } : f)); onFieldsChanged(); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 w-full h-full">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-base font-bold text-white">Gestor de Campos</h2>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {showNewForm ? (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-200">{editingField ? 'Editar Campo' : 'Nuevo Campo Personalizado'}</h3>
                <button onClick={resetForm} className="text-xs flex items-center gap-1 text-zinc-500 hover:text-white transition-colors">
                  <ArrowLeft className="w-3 h-3"/> Volver a la lista
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Nombre</label>
                  <input type="text" value={formData.name} onChange={e => handleNameChange(e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" placeholder="Ej: ID Cliente" />
                </div>
                {!editingField && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase">Clave (Variable)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-zinc-500 text-sm">$</span>
                      <input type="text" value={formData.key} onChange={e => handleKeyChange(e.target.value)} className="w-full pl-6 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 font-mono text-sm focus:border-indigo-500 outline-none" placeholder="id_cliente" />
                    </div>
                  </div>
                )}
              </div>

              {!editingField && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Tipo de Dato</label>
                  <div className="grid grid-cols-4 gap-2">
                    {FIELD_TYPES.map((ft) => (
                      <button key={ft.type} onClick={() => setFormData(prev => ({...prev, type: ft.type}))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${formData.type === ft.type ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:border-zinc-700'}`}
                      >
                        <FieldTypeIcon type={ft.type} className="w-3.5 h-3.5"/> {ft.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Options for Select */}
              {formData.type === 'select' && (
                <div className="space-y-3 p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl">
                  <label className="text-xs font-bold text-zinc-500 uppercase">Opciones de Lista</label>
                  <div className="flex gap-2">
                    <input type="text" value={newOption} onChange={e => setNewOption(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addOption())} className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white text-sm focus:border-indigo-500 outline-none" placeholder="Nueva opción..." />
                    <button onClick={addOption} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg border border-zinc-700"><Plus className="w-4 h-4"/></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-1 pl-3 pr-1 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-300">
                        {opt} <button onClick={() => setFormData(prev => ({...prev, options: prev.options.filter((_, idx) => idx !== i)}))} className="p-1 hover:text-red-400"><X className="w-3 h-3"/></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-zinc-800">
                <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
                  {editingField ? 'Guardar Cambios' : 'Crear Campo'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                  <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-indigo-500 outline-none placeholder-zinc-600" placeholder="Buscar campos..." />
                </div>
                <button onClick={() => setShowNewForm(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-900/20">
                  <Plus className="w-4 h-4"/> Nuevo
                </button>
              </div>

              {/* List */}
              <div className="space-y-4">
                {isLoading ? (
                  <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto"/></div>
                ) : activeFields.length === 0 && !showInactive ? (
                  <div className="text-center py-10 text-zinc-500">
                    <Hash className="w-10 h-10 mx-auto mb-3 opacity-20"/>
                    <p className="text-sm">No hay campos configurados</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeFields.map(field => (
                      <div key={field.id} className="group flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl transition-all">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-zinc-900 rounded-lg text-zinc-400 border border-zinc-800">
                            <FieldTypeIcon type={field.type} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{field.name}</p>
                            <code className="text-[10px] text-zinc-500 font-mono">${field.key}</code>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { setEditingField(field); setFormData({ ...field, options: field.options || [], defaultValue: field.defaultValue?.toString() || '', description: field.description ?? '' }); setShowNewForm(true); }} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"><Edit2 className="w-3.5 h-3.5"/></button>
                          <button onClick={() => handleArchive(field)} className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg"><Archive className="w-3.5 h-3.5"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Archived Toggle */}
                <div className="pt-4 border-t border-zinc-800">
                   <button onClick={() => setShowInactive(!showInactive)} className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-2">
                      {showInactive ? 'Ocultar archivados' : 'Ver campos archivados'}
                      {showInactive ? <ArrowLeft className="w-3 h-3 rotate-90"/> : <ArrowLeft className="w-3 h-3 -rotate-90"/>}
                   </button>
                   
                   {showInactive && archivedFields.length > 0 && (
                      <div className="mt-3 space-y-2 opacity-60">
                         {archivedFields.map(field => (
                            <div key={field.id} className="flex items-center justify-between p-2 bg-zinc-900/50 border border-zinc-800 rounded-lg">
                               <span className="text-xs text-zinc-400">{field.name}</span>
                               <button onClick={() => handleRestore(field)} className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1"><RotateCcw className="w-3 h-3"/> Restaurar</button>
                            </div>
                         ))}
                      </div>
                   )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============= SIDEBAR COMPONENT (Premium Zinc) =============

export function SidebarCustomFields({ userId, fields, onFieldUpdated }: CustomFieldsProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showManager, setShowManager] = useState(false);

  const handleEdit = (field: CustomFieldValue) => {
    setEditingField(field.key);
    setEditValue(field.value?.toString() || '');
  };

  const handleSave = async (field: CustomFieldValue) => {
    if (!field.fieldId) return;
    setIsSaving(true);
    try {
      let value: any = editValue;
      if (field.type === 'number') value = parseFloat(editValue) || 0;
      else if (field.type === 'boolean') value = editValue === 'true';
      await setUserFieldValue(userId, field.fieldId, value);
      onFieldUpdated();
      setEditingField(null);
    } catch (e) { console.error(e); } 
    finally { setIsSaving(false); }
  };

  const renderValue = (field: CustomFieldValue) => {
    if (field.value === null || field.value === undefined || field.value === '') return <span className="text-xs text-zinc-600 italic">Sin valor</span>;
    if (field.type === 'boolean') return <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${field.value ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>{field.value ? 'SÍ' : 'NO'}</span>;
    if (field.type === 'url') return <a href={String(field.value)} target="_blank" className="text-xs text-indigo-400 hover:underline truncate block max-w-[140px]">{String(field.value)}</a>;
    return <span className="text-xs text-zinc-300 truncate block max-w-[140px]">{String(field.value)}</span>;
  };

  if (fields.length === 0) {
    return (
      <>
        <div className="px-4 py-6 text-center">
          <p className="text-xs text-zinc-500 mb-3">Sin campos configurados</p>
          <button onClick={() => setShowManager(true)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 transition-all">
            <Settings className="w-3.5 h-3.5" /> Configurar
          </button>
        </div>
        <FieldsManagerModal isOpen={showManager} onClose={() => setShowManager(false)} onFieldsChanged={onFieldUpdated} />
      </>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {fields.map((field, index) => {
          const Icon = field.type === 'number' ? Hash : field.type === 'url' ? LinkIcon : field.type === 'date' ? Calendar : Type;
          const isEditing = editingField === field.key;

          return (
            <div key={field.key} className={`group px-4 py-3 ${index !== fields.length - 1 ? 'border-b border-zinc-800' : ''} ${isEditing ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30 transition-colors'}`}>
              
              {/* Header: Label */}
              <div className="flex items-center gap-2 mb-1">
                 <Icon className="w-3 h-3 text-zinc-500" />
                 <span className="text-xs font-medium text-zinc-400">{field.name}</span>
              </div>

              {/* Body: Value / Edit */}
              {isEditing ? (
                <div className="flex items-center gap-2 mt-1 animate-in fade-in duration-200">
                   {field.type === 'boolean' ? (
                      <select value={editValue} onChange={e => setEditValue(e.target.value)} className="flex-1 h-7 text-xs bg-zinc-950 border border-zinc-700 rounded px-2 text-white focus:border-indigo-500 outline-none">
                         <option value="true">Sí</option>
                         <option value="false">No</option>
                      </select>
                   ) : (
                      <input 
                        type={field.type === 'number' ? 'number' : 'text'} 
                        value={editValue} 
                        onChange={e => setEditValue(e.target.value)} 
                        className="flex-1 h-7 text-xs bg-zinc-950 border border-zinc-700 rounded px-2 text-white focus:border-indigo-500 outline-none"
                        autoFocus
                      />
                   )}
                   <button onClick={() => handleSave(field)} disabled={isSaving} className="h-7 w-7 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded"><Check className="w-3 h-3"/></button>
                   <button onClick={() => setEditingField(null)} className="h-7 w-7 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded"><X className="w-3 h-3"/></button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                   {renderValue(field)}
                   <button onClick={() => handleEdit(field)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-indigo-400 transition-all">
                      <Edit2 className="w-3 h-3"/>
                   </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-center">
        <button onClick={() => setShowManager(true)} className="text-[10px] text-zinc-500 hover:text-indigo-400 flex items-center gap-1.5 transition-colors py-1">
          <Settings className="w-3 h-3" /> Administrar campos
        </button>
      </div>

      <FieldsManagerModal isOpen={showManager} onClose={() => setShowManager(false)} onFieldsChanged={onFieldUpdated} />
    </div>
  );
}
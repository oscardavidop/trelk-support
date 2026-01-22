// // Custom Fields Section
// import { useState } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { Settings, Edit2, Check, X, Loader2 } from 'lucide-react';
// import type { CustomFieldValue } from '../../types';
// import { setUserFieldValue } from '../../services/contactApi';

// interface CustomFieldsProps {
//   userId: string;
//   fields: CustomFieldValue[];
//   onFieldUpdated: () => void;
// }

// export function SidebarCustomFields({ userId, fields, onFieldUpdated }: CustomFieldsProps) {
//   const navigate = useNavigate();
//   const [editingField, setEditingField] = useState<string | null>(null);
//   const [editValue, setEditValue] = useState<string>('');
//   const [isSaving, setIsSaving] = useState(false);

//   const handleEdit = (field: CustomFieldValue) => {
//     setEditingField(field.key);
//     setEditValue(field.value?.toString() || '');
//   };

//   const handleSave = async (field: CustomFieldValue) => {
//     if (!field.fieldId) return;
    
//     setIsSaving(true);
//     try {
//       let value: string | number | boolean = editValue;
      
//       // Convert based on type
//       if (field.type === 'number') {
//         value = parseFloat(editValue) || 0;
//       } else if (field.type === 'boolean') {
//         value = editValue === 'true';
//       }
      
//       await setUserFieldValue(userId, field.fieldId, value);
//       onFieldUpdated();
//       setEditingField(null);
//     } catch (error) {
//       console.error('Error saving field:', error);
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   const handleCancel = () => {
//     setEditingField(null);
//     setEditValue('');
//   };

//   const renderValue = (field: CustomFieldValue) => {
//     if (field.value === null || field.value === undefined || field.value === '') {
//       return <span className="text-gray-400 italic text-xs">No establecido</span>;
//     }

//     if (field.type === 'boolean') {
//       return (
//         <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
//           field.value ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
//                       : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
//         }`}>
//           {field.value ? 'Sí' : 'No'}
//         </span>
//       );
//     }

//     if (field.type === 'url') {
//       return (
//         <a
//           href={field.value as string}
//           target="_blank"
//           rel="noopener noreferrer"
//           className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[120px] block"
//         >
//           {field.value as string}
//         </a>
//       );
//     }

//     return <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[120px] block">{String(field.value)}</span>;
//   };

//   const renderEditInput = (field: CustomFieldValue) => {
//     if (field.type === 'boolean') {
//       return (
//         <select
//           value={editValue}
//           onChange={(e) => setEditValue(e.target.value)}
//           className="text-xs px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded 
//                      bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
//         >
//           <option value="true">Sí</option>
//           <option value="false">No</option>
//         </select>
//       );
//     }

//     return (
//       <input
//         type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
//         value={editValue}
//         onChange={(e) => setEditValue(e.target.value)}
//         className="flex-1 text-xs px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded 
//                    bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full"
//         autoFocus
//       />
//     );
//   };

//   if (fields.length === 0) {
//     return (
//       <div className="px-4 py-2">
//         <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-2">
//           Sin campos personalizados
//         </p>
//         <button
//           onClick={() => navigate('/dashboard/custom-fields')}
//           className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
//         >
//           <Settings className="w-3 h-3" />
//           Gestionar campos personalizados
//         </button>
//       </div>
//     );
//   }

//   return (
//     <div className="px-4 py-2 space-y-2">
//       {fields.map((field) => (
//         <div key={field.key} className="group">
//           {editingField === field.key ? (
//             <div className="space-y-1">
//               <label className="text-[10px] text-gray-500 dark:text-gray-400">{field.name}</label>
//               <div className="flex items-center gap-1">
//                 {renderEditInput(field)}
//                 <button
//                   onClick={() => handleSave(field)}
//                   disabled={isSaving}
//                   className="p-0.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
//                 >
//                   {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
//                 </button>
//                 <button
//                   onClick={handleCancel}
//                   className="p-0.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
//                 >
//                   <X className="w-3 h-3" />
//                 </button>
//               </div>
//             </div>
//           ) : (
//             <div className="flex items-center justify-between">
//               <span className="text-xs text-gray-500 dark:text-gray-400">{field.name}</span>
//               <div className="flex items-center gap-1">
//                 {renderValue(field)}
//                 <button
//                   onClick={() => handleEdit(field)}
//                   className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-opacity"
//                   title="Editar"
//                 >
//                   <Edit2 className="w-3 h-3 text-gray-400" />
//                 </button>
//               </div>
//             </div>
//           )}
//         </div>
//       ))}

//       <button
//         onClick={() => navigate('/dashboard/custom-fields')}
//         className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 mt-2"
//       >
//         <Settings className="w-3 h-3" />
//         Gestionar campos
//       </button>
//     </div>
//   );
// }


// SidebarCustomFields.tsx - Refactored UI
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings, Edit2, Check, X, Loader2, Type, Hash, Link as LinkIcon, CheckSquare, Calendar, Plus, Search, Archive, RotateCcw, ToggleLeft, List, Mail } from 'lucide-react';
import type { CustomFieldValue } from '../../types';
import { setUserFieldValue } from '../../services/contactApi';
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
} from '../../services/customFieldsApi';
import { toast } from '../ui';

interface CustomFieldsProps {
  userId: string;
  fields: CustomFieldValue[];
  onFieldUpdated: () => void;
}

// Field types config
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

// ============= FIELDS MANAGER MODAL =============
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
    if (isOpen) loadFields();
  }, [isOpen, loadFields]);

  const filteredFields = useMemo(() => {
    return fields.filter(field => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!field.name.toLowerCase().includes(query) && !field.key.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [fields, searchQuery]);

  const activeFields = filteredFields.filter(f => f.isActive);
  const archivedFields = filteredFields.filter(f => !f.isActive);

  const resetForm = () => {
    setFormData({ name: '', key: '', type: 'text', description: '', required: false, options: [], defaultValue: '' });
    setNewOption('');
    setErrors({});
    setKeyTouched(false);
    setEditingField(null);
    setShowNewForm(false);
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
        } else toast.error(result.error || 'Error al actualizar');
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
          if (result.error?.includes('already exists')) setErrors({ key: 'Esta clave ya existe' });
          else toast.error(result.error || 'Error al crear');
        }
      }
    } catch { toast.error('Error al guardar'); }
    finally { setIsSaving(false); }
  };

  const handleArchive = async (field: CustomField) => {
    const result = await deleteCustomField(field.id);
    if (result.ok) { toast.success('Campo archivado'); setFields(prev => prev.map(f => f.id === field.id ? { ...f, isActive: false } : f)); onFieldsChanged(); }
    else toast.error(result.error || 'Error al archivar');
  };

  const handleRestore = async (field: CustomField) => {
    const result = await restoreCustomField(field.id);
    if (result.ok) { toast.success('Campo restaurado'); setFields(prev => prev.map(f => f.id === field.id ? { ...f, isActive: true } : f)); onFieldsChanged(); }
    else toast.error(result.error || 'Error al restaurar');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-xl">
              <Settings className="w-5 h-5 text-purple-500 dark:text-purple-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Gestionar Campos</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {showNewForm ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-gray-900 dark:text-white font-medium text-sm">{editingField ? 'Editar Campo' : 'Nuevo Campo'}</h3>
                <button onClick={resetForm} className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-white">← Volver</button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nombre *</label>
                <input type="text" value={formData.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ej: Número de cliente"
                  className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.name ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
              </div>

              {/* Key (only new) */}
              {!editingField && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Clave interna *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm">$</span>
                    <input type="text" value={formData.key} onChange={(e) => handleKeyChange(e.target.value)} placeholder="numero_cliente"
                      className={`w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border rounded-lg text-gray-900 dark:text-white placeholder-gray-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${errors.key ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'}`}
                    />
                  </div>
                  {errors.key ? <p className="mt-1 text-xs text-red-500">{errors.key}</p> : <p className="mt-1 text-[10px] text-gray-400">Usa en flujos: <code className="text-purple-500">{`{{custom.${formData.key || 'campo'}}}`}</code></p>}
                </div>
              )}

              {/* Type (only new) */}
              {!editingField && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Tipo *</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {FIELD_TYPES.map(({ type: t, label }) => (
                      <button key={t} type="button" onClick={() => setFormData(prev => ({ ...prev, type: t }))}
                        className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs transition-all ${formData.type === t ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300'}`}
                      >
                        <FieldTypeIcon type={t} className="w-3.5 h-3.5" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Type badge (edit) */}
              {editingField && (
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <FieldTypeIcon type={formData.type} className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Tipo: <span className="text-gray-900 dark:text-white">{FIELD_TYPE_LABELS[formData.type]}</span></span>
                </div>
              )}

              {/* Options for select */}
              {formData.type === 'select' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Opciones *</label>
                  <div className="space-y-1.5">
                    {formData.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">{option}</div>
                        <button onClick={() => removeOption(index)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input type="text" value={newOption} onChange={(e) => setNewOption(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }} placeholder="Nueva opción"
                        className="flex-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button onClick={addOption} disabled={!newOption.trim()} className={`px-3 py-1.5 rounded-lg text-xs ${newOption.trim() ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {errors.options && <p className="mt-1 text-xs text-red-500">{errors.options}</p>}
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                <button onClick={resetForm} className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">Cancelar</button>
                <button onClick={handleSave} disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 text-xs"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {editingField ? 'Guardar' : 'Crear'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Search & Actions */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <button onClick={() => setShowNewForm(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Nuevo
                </button>
              </div>

              {/* Toggle archived */}
              <button onClick={() => setShowInactive(!showInactive)}
                className={`text-[10px] px-2 py-1 rounded ${showInactive ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-white'}`}
              >
                {showInactive ? 'Ocultar archivados' : 'Mostrar archivados'}
              </button>

              {/* Loading */}
              {isLoading && <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-purple-500" /></div>}

              {/* Active Fields */}
              {!isLoading && activeFields.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Activos ({activeFields.length})</h4>
                  {activeFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 group">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                          <FieldTypeIcon type={field.type} className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-gray-900 dark:text-white">{field.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">${field.key}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditForm(field)} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 rounded"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleArchive(field)} className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded"><Archive className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Archived Fields */}
              {!isLoading && showInactive && archivedFields.length > 0 && (
                <div className="space-y-1.5 mt-3">
                  <h4 className="text-[10px] font-medium text-amber-500/70 uppercase tracking-wider">Archivados ({archivedFields.length})</h4>
                  {archivedFields.map((field) => (
                    <div key={field.id} className="flex items-center justify-between p-2.5 bg-gray-50/50 dark:bg-gray-800/30 rounded-lg border border-gray-200/50 dark:border-gray-800 group opacity-60">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg"><FieldTypeIcon type={field.type} className="w-3.5 h-3.5 text-gray-400" /></div>
                        <div>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{field.name}</p>
                          <p className="text-[10px] text-gray-400 font-mono">${field.key}</p>
                        </div>
                      </div>
                      <button onClick={() => handleRestore(field)} className="flex items-center gap-1 px-2 py-1 text-[10px] text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        <RotateCcw className="w-3 h-3" />
                        Restaurar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Empty */}
              {!isLoading && activeFields.length === 0 && !searchQuery && (
                <div className="text-center py-6">
                  <Hash className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">No hay campos personalizados</p>
                  <button onClick={() => setShowNewForm(true)} className="mt-2 text-xs text-purple-500 hover:text-purple-600">Crear primer campo →</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SidebarCustomFields({ userId, fields, onFieldUpdated }: CustomFieldsProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showManager, setShowManager] = useState(false);

  // Mapeo de iconos por tipo de campo
  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'number': return Hash;
      case 'url': return LinkIcon;
      case 'boolean': return CheckSquare;
      case 'date': return Calendar;
      default: return Type;
    }
  };

  const handleEdit = (field: CustomFieldValue) => {
    setEditingField(field.key);
    setEditValue(field.value?.toString() || '');
  };

  const handleSave = async (field: CustomFieldValue) => {
    if (!field.fieldId) return;
    setIsSaving(true);
    try {
      let value: string | number | boolean = editValue;
      if (field.type === 'number') value = parseFloat(editValue) || 0;
      else if (field.type === 'boolean') value = editValue === 'true';
      
      await setUserFieldValue(userId, field.fieldId, value);
      onFieldUpdated();
      setEditingField(null);
    } catch (error) {
      console.error('Error saving field:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditValue('');
  };

  const renderValue = (field: CustomFieldValue) => {
    if (field.value === null || field.value === undefined || field.value === '') {
      return <span className="text-xs text-gray-400 italic">Vacío</span>;
    }

    if (field.type === 'boolean') {
      return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
          field.value 
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
        }`}>
          {field.value ? 'Sí' : 'No'}
        </span>
      );
    }

    if (field.type === 'url') {
      return (
        <a
          href={field.value as string}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-500 hover:text-indigo-600 hover:underline truncate max-w-[120px] block"
          onClick={(e) => e.stopPropagation()}
        >
          {field.value as string}
        </a>
      );
    }

    return <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[120px] block">{String(field.value)}</span>;
  };

  if (fields.length === 0) {
    return (
      <>
        <div className="px-3 py-4 text-center">
          <p className="text-xs text-gray-400 mb-2">No hay campos personalizados configurados.</p>
          <button
            onClick={() => setShowManager(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-xs font-medium text-gray-600 dark:text-gray-300 transition-colors"
          >
            <Settings className="w-3 h-3" />
            Configurar campos
          </button>
        </div>
        <FieldsManagerModal isOpen={showManager} onClose={() => setShowManager(false)} onFieldsChanged={onFieldUpdated} />
      </>
    );
  }

  return (
    <>
      <div className="px-3 py-2">
        <div className="bg-white dark:bg-[#1a1d26] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
          {fields.map((field, index) => {
            const Icon = getFieldIcon(field.type);
            const isEditing = editingField === field.key;

            return (
              <div 
                key={field.key} 
                className={`
                  group px-3 py-2.5 
                  ${index !== fields.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}
                  ${isEditing ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors'}
                `}
              >
                {isEditing ? (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      <Icon className="w-3 h-3" />
                      {field.name}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {field.type === 'boolean' ? (
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 h-7 text-xs border border-indigo-300 dark:border-indigo-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          autoFocus
                        >
                          <option value="true">Sí</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 h-7 text-xs border border-indigo-300 dark:border-indigo-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          autoFocus
                        />
                      )}
                      
                      <button
                        onClick={() => handleSave(field)}
                        disabled={isSaving}
                        className="h-7 w-7 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={handleCancel}
                        disabled={isSaving}
                        className="h-7 w-7 flex items-center justify-center bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 rounded transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate" title={field.name}>{field.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 pl-2">
                      {renderValue(field)}
                      <button
                        onClick={() => handleEdit(field)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-indigo-500 transition-all"
                        title="Editar valor"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex justify-center">
          <button
            onClick={() => setShowManager(true)}
            className="text-[10px] text-gray-400 hover:text-indigo-500 flex items-center gap-1 transition-colors"
          >
            <Settings className="w-3 h-3" />
            Gestionar campos
          </button>
        </div>
      </div>
      
      <FieldsManagerModal isOpen={showManager} onClose={() => setShowManager(false)} onFieldsChanged={onFieldUpdated} />
    </>
  );
}
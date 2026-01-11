// Custom Fields Section
import { useState } from 'react';
import { Settings, Edit2, Check, X, Loader2 } from 'lucide-react';
import type { CustomFieldValue } from '../../types';
import { setUserFieldValue } from '../../services/contactApi';

interface CustomFieldsProps {
  userId: string;
  fields: CustomFieldValue[];
  onFieldUpdated: () => void;
}

export function SidebarCustomFields({ userId, fields, onFieldUpdated }: CustomFieldsProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = (field: CustomFieldValue) => {
    setEditingField(field.key);
    setEditValue(field.value?.toString() || '');
  };

  const handleSave = async (field: CustomFieldValue) => {
    if (!field.fieldId) return;
    
    setIsSaving(true);
    try {
      let value: string | number | boolean = editValue;
      
      // Convert based on type
      if (field.type === 'number') {
        value = parseFloat(editValue) || 0;
      } else if (field.type === 'boolean') {
        value = editValue === 'true';
      }
      
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
      return <span className="text-gray-400 italic text-xs">No establecido</span>;
    }

    if (field.type === 'boolean') {
      return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
          field.value ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
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
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate max-w-[120px] block"
        >
          {field.value as string}
        </a>
      );
    }

    return <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[120px] block">{String(field.value)}</span>;
  };

  const renderEditInput = (field: CustomFieldValue) => {
    if (field.type === 'boolean') {
      return (
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="text-xs px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="true">Sí</option>
          <option value="false">No</option>
        </select>
      );
    }

    return (
      <input
        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        className="flex-1 text-xs px-1.5 py-0.5 border border-gray-300 dark:border-gray-600 rounded 
                   bg-white dark:bg-gray-700 text-gray-900 dark:text-white w-full"
        autoFocus
      />
    );
  };

  if (fields.length === 0) {
    return (
      <div className="px-4 py-2">
        <p className="text-xs text-gray-400 dark:text-gray-500 italic mb-2">
          Sin campos personalizados
        </p>
        <button
          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
        >
          <Settings className="w-3 h-3" />
          Gestionar campos personalizados
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 space-y-2">
      {fields.map((field) => (
        <div key={field.key} className="group">
          {editingField === field.key ? (
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 dark:text-gray-400">{field.name}</label>
              <div className="flex items-center gap-1">
                {renderEditInput(field)}
                <button
                  onClick={() => handleSave(field)}
                  disabled={isSaving}
                  className="p-0.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                </button>
                <button
                  onClick={handleCancel}
                  className="p-0.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">{field.name}</span>
              <div className="flex items-center gap-1">
                {renderValue(field)}
                <button
                  onClick={() => handleEdit(field)}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-opacity"
                  title="Editar"
                >
                  <Edit2 className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 mt-2"
      >
        <Settings className="w-3 h-3" />
        Gestionar campos
      </button>
    </div>
  );
}

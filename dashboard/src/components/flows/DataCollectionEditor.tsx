/**
 * DataCollectionEditor - Premium Zinc Refactor
 * UI for configuring wait_for_response action
 */

import React, { useState } from 'react';
import {
  Type, Mail, Phone, Hash, Link, Calendar, List,
  Variable, Plus, Trash2, AlertCircle, CheckCircle2,
  ChevronDown, MessageSquare, Settings2, Clock, RotateCw
} from 'lucide-react';
import type {
  DataCollectionConfig,
  DataCollectionType,
  DataCollectionChoice,
  ActionConfig,
} from '../../types/flow';

interface DataCollectionEditorProps {
  config: ActionConfig;
  onChange: (updates: Partial<ActionConfig>) => void;
  readOnly?: boolean;
}

const VALIDATION_TYPES: { value: DataCollectionType; label: string; icon: any }[] = [
  { value: 'text', label: 'Texto', icon: Type },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Teléfono', icon: Phone },
  { value: 'number', label: 'Número', icon: Hash },
  { value: 'url', label: 'URL', icon: Link },
  { value: 'date', label: 'Fecha', icon: Calendar },
  { value: 'choice', label: 'Opciones', icon: List },
];

const AVAILABLE_VARIABLES = [
  { path: 'user.firstName', label: 'Nombre' },
  { path: 'user.lastName', label: 'Apellido' },
  { path: 'user.username', label: 'Username' },
];

// Estilo base para inputs
const inputBase = "bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 outline-none transition-all placeholder-zinc-600";

const DataCollectionEditor: React.FC<DataCollectionEditorProps> = ({
  config,
  onChange,
  readOnly,
}) => {
  const [showVariables, setShowVariables] = useState(false);
  const dataCollection = config.dataCollection || {
    question: '',
    variableName: '',
    validationType: 'text' as DataCollectionType,
    expiresInMinutes: 30,
    maxRetries: 3,
    errorMessage: 'Por favor, ingresa una respuesta válida.',
  };

  const updateDataCollection = (updates: Partial<DataCollectionConfig>) => {
    onChange({
      dataCollection: { ...dataCollection, ...updates },
    });
  };

  // --- Logic Helpers ---
  const addChoice = () => {
    const choices = dataCollection.choices || [];
    updateDataCollection({
      choices: [...choices, { id: Date.now().toString(), label: `Opción ${choices.length + 1}`, value: `opt_${choices.length + 1}` }],
    });
  };

  const updateChoice = (index: number, updates: Partial<DataCollectionChoice>) => {
    const choices = [...(dataCollection.choices || [])];
    choices[index] = { ...choices[index], ...updates };
    updateDataCollection({ choices });
  };

  const removeChoice = (index: number) => {
    updateDataCollection({ choices: (dataCollection.choices || []).filter((_, i) => i !== index) });
  };

  const insertVariable = (variable: string) => {
    updateDataCollection({ question: (dataCollection.question || '') + `{{${variable}}}` });
    setShowVariables(false);
  };

  return (
    <div className="space-y-6 w-full max-w-full">

      {/* 1. Header Card */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex items-start gap-4">
        <div className="p-2.5 bg-violet-500/10 rounded-xl border border-violet-500/20 text-violet-400 shrink-0">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-zinc-200">Recolección de Datos</h4>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            El bot detendrá el flujo para esperar una respuesta del usuario, la validará y guardará el resultado en una variable.
          </p>
        </div>
      </div>

      {/* 2. Question Input */}
      <div className="space-y-2 relative">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-zinc-500 uppercase r">Pregunta al Usuario</label>
          <button
            type="button"
            onClick={() => setShowVariables(!showVariables)}
            className="flex items-center gap-1.5 text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition-colors border border-zinc-700"
          >
            <Variable className="w-3 h-3" /> Insertar Variable
          </button>

          {/* Variable Dropdown */}
          {showVariables && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowVariables(false)} />
              <div className="absolute right-0 top-7 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-2 bg-zinc-950 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase">Disponibles</div>
                {AVAILABLE_VARIABLES.map((v) => (
                  <button
                    key={v.path}
                    onClick={() => insertVariable(v.path)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-violet-500/10 hover:text-violet-300 text-zinc-400 transition-colors flex justify-between items-center group"
                  >
                    <span>{v.label}</span>
                    <span className="opacity-0 group-hover:opacity-100 font-mono text-[9px] text-zinc-600">{`{{${v.path.split('.')[1]}}}`}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="relative group">
          <textarea
            value={dataCollection.question || ''}
            onChange={(e) => updateDataCollection({ question: e.target.value })}
            disabled={readOnly}
            rows={3}
            className={`${inputBase} w-full px-4 py-3 resize-none leading-relaxed`}
            placeholder="Ej: Hola {{user.firstName}}, ¿cuál es tu correo electrónico?"
          />
          <div className="absolute bottom-2 right-2 pointer-events-none opacity-50">
            <div className="w-2 h-2 border-r border-b border-zinc-600" />
          </div>
        </div>
      </div>

      {/* 3. Variable Name */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-zinc-500 uppercase r">Guardar respuesta en</label>
        <div className="flex items-center group focus-within:ring-1 focus-within:ring-violet-500/50 rounded-lg transition-all">
          <div className="bg-zinc-950 border border-r-0 border-zinc-800 rounded-l-lg px-3 py-2.5 text-xs text-zinc-500 font-mono select-none">
            {'{{variables.'}
          </div>
          <input
            type="text"
            value={dataCollection.variableName || ''}
            onChange={(e) => updateDataCollection({ variableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
            disabled={readOnly}
            className="flex-1 px-0 py-2.5 text-xs border-y border-zinc-800 bg-zinc-950 text-violet-400 font-mono focus:outline-none placeholder-zinc-700"
            placeholder="email_usuario"
          />
          <div className="bg-zinc-950 border border-l-0 border-zinc-800 rounded-r-lg px-3 py-2.5 text-xs text-zinc-500 font-mono select-none">
            {'}}'}
          </div>
        </div>
      </div>

      {/* 4. Validation Type Grid */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold text-zinc-500 uppercase r">Tipo de Dato Esperado</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {VALIDATION_TYPES.map((type) => {
            const isSelected = dataCollection.validationType === type.value;
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => updateDataCollection({ validationType: type.value })}
                disabled={readOnly}
                className={`
                  flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 gap-2
                  ${isSelected
                    ? 'bg-violet-500/10 border-violet-500/50 text-violet-300 ring-1 ring-violet-500/20'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 hover:border-zinc-700'}
                `}
              >
                <Icon className={`w-4 h-4 ${isSelected ? 'text-violet-400' : 'text-zinc-500'}`} />
                <span className="text-[10px] font-medium">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Choices Editor */}
      {dataCollection.validationType === 'choice' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-bold text-zinc-500 uppercase r">Opciones de Respuesta</label>
            <span className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
              {(dataCollection.choices || []).length}
            </span>
          </div>

          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 space-y-2">
            {(dataCollection.choices || []).map((choice, index) => (
              <div key={choice.id} className="flex items-center gap-2 group animate-in slide-in-from-left-2 duration-300">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={choice.label}
                    onChange={(e) => updateChoice(index, { label: e.target.value })}
                    className={`${inputBase} px-2 py-1.5 text-xs bg-zinc-900 border-zinc-800 focus:border-violet-500`}
                    placeholder="Etiqueta"
                  />
                  <input
                    type="text"
                    value={choice.value}
                    onChange={(e) => updateChoice(index, { value: e.target.value })}
                    className={`${inputBase} px-2 py-1.5 text-xs bg-zinc-900 border-zinc-800 font-mono text-zinc-400 focus:border-violet-500`}
                    placeholder="Valor"
                  />
                </div>
                {!readOnly && (
                  <button
                    onClick={() => removeChoice(index)}
                    className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}

            {!readOnly && (
              <button
                onClick={addChoice}
                className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-violet-400 hover:text-violet-300 border border-dashed border-zinc-800 hover:border-violet-500/30 rounded-lg bg-zinc-900/50 hover:bg-zinc-900 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir Opción
              </button>
            )}
          </div>
        </div>
      )}

      {/* 6. Error Message */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-zinc-500 uppercase r">Mensaje de Error</label>
        <input
          type="text"
          value={dataCollection.errorMessage || ''}
          onChange={(e) => updateDataCollection({ errorMessage: e.target.value })}
          disabled={readOnly}
          className={`${inputBase} w-full px-3 py-2 text-red-300 border-red-900/30 focus:border-red-500/50 placeholder-red-900/50`}
          placeholder="Ej: Formato no válido, intenta de nuevo."
        />
      </div>

      {/* 7. Advanced Settings (Styled Details) */}
      <details className="group border border-zinc-800 rounded-xl bg-zinc-900/30 overflow-hidden transition-all [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-zinc-900 transition-colors">
          <div className="flex items-center gap-2 text-zinc-400 group-hover:text-zinc-200">
            <Settings2 className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Configuración Avanzada</span>
          </div>
          <ChevronDown className="w-4 h-4 text-zinc-500 transition-transform group-open:rotate-180" />
        </summary>

        <div className="p-4 pt-0 border-t border-zinc-800 space-y-4 mt-2 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                <RotateCw className="w-3 h-3" /> Máx. Intentos
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={dataCollection.maxRetries || 3}
                onChange={(e) => updateDataCollection({ maxRetries: parseInt(e.target.value) || 3 })}
                disabled={readOnly}
                className={`${inputBase} w-full px-3 py-2 text-center`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" /> Expiración (min)
              </label>
              <input
                type="number"
                min={1}
                value={dataCollection.expiresInMinutes || 30}
                onChange={(e) => updateDataCollection({ expiresInMinutes: parseInt(e.target.value) || 30 })}
                disabled={readOnly}
                className={`${inputBase} w-full px-3 py-2 text-center`}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase font-bold">Si expira sin respuesta</label>
            <select
              value={dataCollection.onExpireAction || 'continue'}
              onChange={(e) => updateDataCollection({ onExpireAction: e.target.value as any })}
              disabled={readOnly}
              className={`${inputBase} w-full px-3 py-2 cursor-pointer appearance-none`}
            >
              <option value="continue">Continuar flujo (Variable vacía)</option>
              <option value="end_flow">Terminar flujo inmediatamente</option>
            </select>
          </div>

          {dataCollection.validationType === 'text' && (
            <div className="pt-2 border-t border-zinc-800 space-y-3">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">Validación de Texto</span>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number" placeholder="Min chars"
                  value={dataCollection.validation?.minLength || ''}
                  onChange={(e) => updateDataCollection({ validation: { ...dataCollection.validation, type: 'text', minLength: parseInt(e.target.value) } })}
                  className={`${inputBase} px-2 py-1.5`}
                />
                <input
                  type="number" placeholder="Max chars"
                  value={dataCollection.validation?.maxLength || ''}
                  onChange={(e) => updateDataCollection({ validation: { ...dataCollection.validation, type: 'text', maxLength: parseInt(e.target.value) } })}
                  className={`${inputBase} px-2 py-1.5`}
                />
              </div>
              <input
                type="text" placeholder="Regex Pattern (Opcional)"
                value={dataCollection.validation?.pattern || ''}
                onChange={(e) => updateDataCollection({ validation: { ...dataCollection.validation, type: 'text', pattern: e.target.value } })}
                className={`${inputBase} w-full px-3 py-2 font-mono text-xs text-orange-300 border-orange-900/30 focus:border-orange-500`}
              />
            </div>
          )}
        </div>
      </details>

      {/* 8. Status Footer */}
      {dataCollection.variableName && (
        <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
          <div className="p-1 bg-emerald-500/10 rounded-full text-emerald-500">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-400">Configuración válida</p>
            <p className="text-[10px] text-emerald-500/70 font-mono mt-0.5">
              Variable: {dataCollection.variableName}
            </p>
          </div>
        </div>
      )}

    </div>
  );
};

export default DataCollectionEditor;
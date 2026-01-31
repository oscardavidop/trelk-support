/**
 * DataCollectionEditor - UI for configuring wait_for_response action
 * Allows collecting user input with validation
 */

import React, { useState } from 'react';
import type {
  DataCollectionConfig,
  DataCollectionType,
  DataCollectionChoice,
  ActionConfig,
} from '../../types/flow';

// Iconos inline para evitar dependencias externas en este snippet
const Icons = {
  Text: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>,
  Email: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Phone: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  Number: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>,
  Url: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>,
  Date: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  Choice: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>,
  Variable: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Plus: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  Trash: () => <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
};

interface DataCollectionEditorProps {
  config: ActionConfig;
  onChange: (updates: Partial<ActionConfig>) => void;
  readOnly?: boolean;
}

const VALIDATION_TYPES: { value: DataCollectionType; label: string; icon: React.FC }[] = [
  { value: 'text', label: 'Texto', icon: Icons.Text },
  { value: 'email', label: 'Email', icon: Icons.Email },
  { value: 'phone', label: 'Teléfono', icon: Icons.Phone },
  { value: 'number', label: 'Número', icon: Icons.Number },
  { value: 'url', label: 'Web URL', icon: Icons.Url },
  { value: 'date', label: 'Fecha', icon: Icons.Date },
  { value: 'choice', label: 'Opciones', icon: Icons.Choice },
];

const AVAILABLE_VARIABLES = [
  { path: 'user.firstName', label: 'Nombre' },
  { path: 'user.lastName', label: 'Apellido' },
  { path: 'user.username', label: 'Username' },
];

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

  const addChoice = () => {
    const choices = dataCollection.choices || [];
    updateDataCollection({
      choices: [
        ...choices,
        {
          id: Date.now().toString(),
          label: `Opción ${choices.length + 1}`,
          value: `opt_${choices.length + 1}`,
        },
      ],
    });
  };

  const updateChoice = (index: number, updates: Partial<DataCollectionChoice>) => {
    const choices = [...(dataCollection.choices || [])];
    choices[index] = { ...choices[index], ...updates };
    updateDataCollection({ choices });
  };

  const removeChoice = (index: number) => {
    const choices = (dataCollection.choices || []).filter((_, i) => i !== index);
    updateDataCollection({ choices });
  };

  const insertVariable = (variable: string) => {
    const newQuestion = dataCollection.question + `{{${variable}}}`;
    updateDataCollection({ question: newQuestion });
    setShowVariables(false);
  };

  return (
    <div className="space-y-5">

      {/* 1. Header Card */}
      <div className="bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800 border border-purple-100 dark:border-purple-800/50 rounded-xl p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-lg">
            <Icons.Choice />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Recolección de Datos</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              El bot pausará y esperará una respuesta del usuario. Esta respuesta se validará y se guardará en una variable.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Question Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide">
            Pregunta al usuario
          </label>

          {/* Variable Inserter */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowVariables(!showVariables)}
              className="flex items-center gap-1 text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded transition-colors"
            >
              <Icons.Variable /> Insertar Variable
            </button>
            {showVariables && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowVariables(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-20 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900/50 text-[10px] font-bold text-gray-400 uppercase">Variables Disponibles</div>
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.path}
                      onClick={() => insertVariable(v.path)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-200 transition-colors"
                    >
                      {v.label} <span className="opacity-50 ml-1 font-mono text-[10px]">
                        {'{{' + v.path + '}}'}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="relative">
          <textarea
            value={dataCollection.question || ''}
            onChange={(e) => updateDataCollection({ question: e.target.value })}
            disabled={readOnly}
            rows={3}
            className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all placeholder-gray-400 resize-none shadow-sm"
            placeholder="Ej: Hola, ¿podrías indicarme tu correo electrónico?"
          />
          {/* Decoración esquina */}
          <div className="absolute bottom-2 right-2 opacity-20 pointer-events-none">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-gray-500"><path d="M10 10H0L10 0V10Z" /></svg>
          </div>
        </div>
      </div>

      {/* 3. Variable Name Input */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide">
          Guardar respuesta en
        </label>
        <div className="flex items-center">
          <div className="bg-gray-100 dark:bg-gray-800 border border-r-0 border-gray-200 dark:border-gray-700 rounded-l-lg px-3 py-2 text-sm text-gray-500 font-mono select-none">
            {'{{variables.'}
          </div>
          <input
            type="text"
            value={dataCollection.variableName || ''}
            onChange={(e) => updateDataCollection({ variableName: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
            disabled={readOnly}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 font-mono transition-all z-10"
            placeholder="email_usuario"
          />
          <div className="bg-gray-100 dark:bg-gray-800 border border-l-0 border-gray-200 dark:border-gray-700 rounded-r-lg px-3 py-2 text-sm text-gray-500 font-mono select-none">
            {'}}'}
          </div>
        </div>
      </div>

      {/* 4. Validation Type Grid */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide">
          Tipo de Validación
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {VALIDATION_TYPES.map((type) => {
            const isSelected = dataCollection.validationType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => updateDataCollection({ validationType: type.value })}
                disabled={readOnly}
                className={`
                  flex flex-col items-center justify-center p-2 rounded-lg border transition-all duration-200 gap-1.5
                  ${isSelected
                    ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500 shadow-sm'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-purple-300 hover:bg-gray-50 dark:hover:bg-gray-700'}
                `}
              >
                <type.icon />
                <span className="text-[10px] font-medium">{type.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Choices Editor (Conditional) */}
      {dataCollection.validationType === 'choice' && (
        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Opciones Definidas</span>
            <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">{(dataCollection.choices || []).length}</span>
          </div>

          <div className="space-y-2">
            {(dataCollection.choices || []).map((choice, index) => (
              <div key={choice.id} className="flex items-center gap-2 group">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={choice.label}
                    onChange={(e) => updateChoice(index, { label: e.target.value })}
                    disabled={readOnly}
                    className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:border-purple-500 focus:outline-none"
                    placeholder="Etiqueta (ej. Sí)"
                  />
                  <input
                    type="text"
                    value={choice.value}
                    onChange={(e) => updateChoice(index, { value: e.target.value })}
                    disabled={readOnly}
                    className="px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 focus:border-purple-500 focus:outline-none font-mono text-gray-500"
                    placeholder="Valor (ej. yes)"
                  />
                </div>
                {!readOnly && (
                  <button
                    onClick={() => removeChoice(index)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Icons.Trash />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!readOnly && (
            <button
              onClick={addChoice}
              className="w-full py-1.5 flex items-center justify-center gap-1.5 text-xs font-medium text-purple-600 dark:text-purple-400 border border-dashed border-purple-300 dark:border-purple-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
            >
              <Icons.Plus /> Añadir Opción
            </button>
          )}
        </div>
      )}

      {/* 6. Error Message Input */}
      <div>
        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wide mb-1.5 block">
          Mensaje de error (si falla validación)
        </label>
        <input
          type="text"
          value={dataCollection.errorMessage || ''}
          onChange={(e) => updateDataCollection({ errorMessage: e.target.value })}
          disabled={readOnly}
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-red-500/50 focus:border-red-400 transition-all placeholder-gray-400"
          placeholder="Ej: Lo siento, ese no parece un email válido."
        />
      </div>

      {/* 7. Advanced Settings (Accordion Style) */}
      <details className="group border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-900/30 overflow-hidden transition-all">
        <summary className="flex items-center align-center justify-between px-4 py-3 cursor-pointer list-none hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Configuración Avanzada (Intentos, Tiempo)</span>
          <svg className="w-4 h-4 text-gray-400 transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </summary>

        <div className="p-4 pt-0 border-t border-gray-200 dark:border-gray-700 space-y-4 mt-3">

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Máx. Intentos</label>
              <input
                type="number"
                min={1}
                max={10}
                value={dataCollection.maxRetries || 3}
                onChange={(e) => updateDataCollection({ maxRetries: parseInt(e.target.value) || 3 })}
                disabled={readOnly}
                /* CORRECCIÓN: Añadido text-gray-900 dark:text-gray-100 */
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Expiración (min)</label>
              <input
                type="number"
                min={1}
                value={dataCollection.expiresInMinutes || 30}
                onChange={(e) => updateDataCollection({ expiresInMinutes: parseInt(e.target.value) || 30 })}
                disabled={readOnly}
                /* CORRECCIÓN: Añadido text-gray-900 dark:text-gray-100 */
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Acción al expirar</label>
            <select
              value={dataCollection.onExpireAction || 'continue'}
              onChange={(e) => updateDataCollection({ onExpireAction: e.target.value as any })}
              disabled={readOnly}
              /* CORRECCIÓN: Añadido text-gray-900 dark:text-gray-100 */
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 cursor-pointer"
            >
              <option value="continue">Continuar flujo (sin dato)</option>
              <option value="end_flow">Terminar flujo</option>
            </select>
          </div>

          {/* Extra Validation for TEXT */}
          {dataCollection.validationType === 'text' && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-xs font-bold text-gray-400 mb-2 uppercase">Límites de Texto</label>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="number"
                  placeholder="Min chars"
                  /* CORRECCIÓN: Añadido text-gray-900 dark:text-gray-100 y placeholder-gray-400 */
                  className="px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  value={dataCollection.validation?.minLength || ''}
                  onChange={(e) => updateDataCollection({ validation: { ...dataCollection.validation, type: 'text', minLength: parseInt(e.target.value) } })}
                />
                <input
                  type="number"
                  placeholder="Max chars"
                  /* CORRECCIÓN: Añadido text-gray-900 dark:text-gray-100 */
                  className="px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  value={dataCollection.validation?.maxLength || ''}
                  onChange={(e) => updateDataCollection({ validation: { ...dataCollection.validation, type: 'text', maxLength: parseInt(e.target.value) } })}
                />
              </div>
              <input
                type="text"
                placeholder="Regex Pattern (Opcional)"
                /* CORRECCIÓN: Añadido text-gray-900 dark:text-gray-100 */
                className="mt-2 w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 font-mono text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                value={dataCollection.validation?.pattern || ''}
                onChange={(e) => updateDataCollection({ validation: { ...dataCollection.validation, type: 'text', pattern: e.target.value } })}
              />
            </div>
          )}
        </div>
      </details>

      {/* 8. Success Status Bar */}
      {dataCollection.variableName && (
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl">
          <div className="p-1 bg-green-100 dark:bg-green-900 rounded-full text-green-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-green-700 dark:text-green-300">Configuración válida</span>
            <span className="text-[10px] text-green-600 dark:text-green-400">
              Se guardará en <code className="font-mono bg-green-100 dark:bg-green-900/50 px-1 rounded">variables.{dataCollection.variableName}</code>
            </span>
          </div>
        </div>
      )}

    </div>
  );
};

export default DataCollectionEditor;
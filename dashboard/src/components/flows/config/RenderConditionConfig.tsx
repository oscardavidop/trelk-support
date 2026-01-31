import React from 'react';
import { 
  Plus, Trash2, GitFork, AlertCircle, Check, X, 
  AlignLeft, Type, Hash, Calendar, ToggleLeft, List 
} from 'lucide-react';
import type { ConditionConfig, ConditionOperator } from '../../../types/flow';
// import { OPERATOR_LABELS, AVAILABLE_FIELDS, SUPPORTED_LANGUAGES } from '../../../types/flow';
import type { TriggerConfig } from '../../../types/flow';

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'es igual a',
  not_equals: 'no es igual a',
  contains: 'contiene',
  not_contains: 'no contiene',
  regex: 'coincide con regex',
  greater_than: 'mayor que',
  less_than: 'menor que',
  greater_or_equal: 'mayor o igual',
  less_or_equal: 'menor o igual',
  exists: 'existe',
  not_exists: 'no existe',
  is_empty: 'está vacío',
  is_not_empty: 'no está vacío',
  starts_with: 'empieza con',
  ends_with: 'termina con',
};

const AVAILABLE_FIELDS = [
  { path: 'message.text', label: 'Mensaje', type: 'string' },
  { path: 'user.firstName', label: 'Nombre del usuario', type: 'string' },
  { path: 'user.lastName', label: 'Apellido del usuario', type: 'string' },
  { path: 'user.username', label: 'Username', type: 'string' },
  { path: 'user.language', label: 'Idioma del usuario', type: 'language' },
  { path: 'session.category', label: 'Categoría', type: 'string' },
  { path: 'session.priority', label: 'Prioridad', type: 'string' },
  { path: 'session.tags', label: 'Tags', type: 'array' },
  { path: 'session.messageCount', label: 'Número de mensajes', type: 'number' },
  { path: 'agent.name', label: 'Nombre del agente', type: 'string' },
  { path: 'customFields', label: 'Campo personalizado', type: 'customField' },
  { path: 'variables', label: 'Variable', type: 'variable' },
];

// Idiomas soportados para condiciones
const SUPPORTED_LANGUAGES = [
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
];


const RenderConditionConfig = (config: ConditionConfig, updateConfig: (key: string, value: any) => void, readOnly: boolean) => {
  const conditionConfig = config as ConditionConfig;
  const groups = conditionConfig.groups || [{ id: '1', operator: 'AND', rules: [] }];

  const addRule = (groupIndex: number) => {
    const newGroups = [...groups];
    newGroups[groupIndex].rules.push({
      id: Date.now().toString(),
      field: 'message.text',
      operator: 'contains',
      value: '',
    });
    updateConfig('groups', newGroups);
  };

  const updateRule = (groupIndex: number, ruleIndex: number, field: string, value: any) => {
    const newGroups = [...groups];
    newGroups[groupIndex].rules[ruleIndex] = {
      ...newGroups[groupIndex].rules[ruleIndex],
      [field]: value,
    };
    updateConfig('groups', newGroups);
  };

  const removeRule = (groupIndex: number, ruleIndex: number) => {
    const newGroups = [...groups];
    newGroups[groupIndex].rules.splice(ruleIndex, 1);
    updateConfig('groups', newGroups);
  };

  // Helper para iconos de tipo de campo
  const getFieldIcon = (type: string) => {
    switch (type) {
        case 'number': return Hash;
        case 'date': return Calendar;
        case 'boolean': return ToggleLeft;
        case 'select': return List;
        default: return Type;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      
      {groups.map((group, groupIndex) => (
        <div
          key={group.id}
          className="relative bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden group/card hover:border-zinc-700 transition-all"
        >
          {/* Group Header */}
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 rounded-md border border-indigo-500/20 text-indigo-400">
                <GitFork className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                Grupo #{groupIndex + 1}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-zinc-500 uppercase">Lógica:</span>
              <div className="relative">
                <select
                  value={group.operator}
                  onChange={(e) => {
                    const newGroups = [...groups];
                    newGroups[groupIndex].operator = e.target.value as 'AND' | 'OR';
                    updateConfig('groups', newGroups);
                  }}
                  disabled={readOnly}
                  className={`
                    appearance-none pl-3 pr-8 py-1 text-xs font-bold rounded-md border outline-none cursor-pointer transition-colors
                    ${group.operator === 'AND' 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'}
                  `}
                >
                  <option value="AND">Y (Todas)</option>
                  <option value="OR">O (Alguna)</option>
                </select>
                {/* Custom arrow if needed, otherwise browser default is hidden by appearance-none on some browsers, check Tailwind reset */}
              </div>
            </div>
          </div>

          {/* Rules List */}
          <div className="p-4 space-y-3">
            {group.rules.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-zinc-800 rounded-lg">
                <p className="text-xs text-zinc-500 italic">Sin reglas definidas</p>
                <button 
                    onClick={() => addRule(groupIndex)}
                    className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 underline decoration-indigo-500/30"
                >
                    Añadir primera regla
                </button>
              </div>
            ) : (
              group.rules.map((rule, ruleIndex) => {
                const fieldInfo = AVAILABLE_FIELDS.find(f => f.path === rule.field);
                const FieldIcon = getFieldIcon(fieldInfo?.type || 'string');

                return (
                  <div key={rule.id} className="relative group/rule pl-3 border-l-2 border-zinc-800 hover:border-indigo-500/50 transition-colors">
                    <div className="grid gap-2">
                      
                      {/* Row 1: Field & Operator */}
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                            <div className="absolute left-2.5 top-2.5 text-zinc-500 pointer-events-none">
                                <FieldIcon className="w-3.5 h-3.5" />
                            </div>
                            <select
                                value={rule.field}
                                onChange={(e) => updateRule(groupIndex, ruleIndex, 'field', e.target.value)}
                                disabled={readOnly}
                                className="w-full pl-8 pr-2 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:border-indigo-500 outline-none appearance-none"
                            >
                                {AVAILABLE_FIELDS.map(f => <option key={f.path} value={f.path}>{f.label}</option>)}
                            </select>
                        </div>
                        
                        <div className="w-1/3">
                            <select
                                value={rule.operator}
                                onChange={(e) => updateRule(groupIndex, ruleIndex, 'operator', e.target.value)}
                                disabled={readOnly}
                                className="w-full px-2 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-400 font-medium focus:border-indigo-500 outline-none appearance-none text-center"
                            >
                                {Object.entries(OPERATOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                      </div>

                      {/* Row 2: Value Input */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                            {/* Dynamic Value Input */}
                            {(() => {
                                const type = fieldInfo?.type || 'string';
                                
                                if (type === 'language' || rule.field === 'user.language') {
                                    return (
                                        <select
                                            value={rule.value || ''}
                                            onChange={(e) => updateRule(groupIndex, ruleIndex, 'value', e.target.value)}
                                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:border-indigo-500 outline-none"
                                        >
                                            <option value="">Seleccionar...</option>
                                            {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
                                        </select>
                                    );
                                }

                                if (type === 'customField' || rule.field === 'customFields') {
                                    return (
                                        <div className="flex gap-2">
                                            <input 
                                                placeholder="Key" 
                                                value={rule.customFieldName || ''}
                                                onChange={e => {
                                                    updateRule(groupIndex, ruleIndex, 'customFieldName', e.target.value);
                                                    updateRule(groupIndex, ruleIndex, 'field', `customFields.${e.target.value}`);
                                                }}
                                                className="w-1/2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:border-indigo-500 outline-none"
                                            />
                                            <input 
                                                placeholder="Valor" 
                                                value={rule.value || ''}
                                                onChange={e => updateRule(groupIndex, ruleIndex, 'value', e.target.value)}
                                                className="w-1/2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                    );
                                }

                                return (
                                    <input
                                        type="text"
                                        value={rule.value || ''}
                                        onChange={(e) => updateRule(groupIndex, ruleIndex, 'value', e.target.value)}
                                        placeholder="Valor a comparar..."
                                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600 focus:border-indigo-500 outline-none transition-all"
                                    />
                                );
                            })()}
                        </div>

                        {!readOnly && (
                            <button
                                onClick={() => removeRule(groupIndex, ruleIndex)}
                                className="p-2 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Eliminar regla"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })
            )}

            {/* Add Rule Button */}
            {!readOnly && (
              <button
                onClick={() => addRule(groupIndex)}
                className="w-full py-2 flex items-center justify-center gap-2 text-xs font-medium text-zinc-500 hover:text-indigo-400 border border-dashed border-zinc-800 hover:border-indigo-500/50 rounded-lg bg-zinc-900/30 hover:bg-zinc-900 transition-all group"
              >
                <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                Nueva Condición
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RenderConditionConfig;
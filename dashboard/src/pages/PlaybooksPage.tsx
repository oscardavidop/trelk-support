/**
 * PlaybooksPage — Admin panel para gestionar Playbooks / Scripts Guiados
 * Solo Admin/Supervisor
 */
import { useState, useEffect } from 'react';
import {
  BookOpen, Plus, Search, Filter, ToggleLeft, ToggleRight,
  Trash2, Edit, ChevronDown, ChevronRight, GripVertical,
  AlertTriangle, Check, X, Copy, Play, Loader2,
  CheckCircle2, XCircle, SkipForward, MessageSquare,
  Tag, Zap, ArrowUpRight, FileText, Shield, Eye, Sparkles,
  ListChecks, Settings,
} from 'lucide-react';
import { usePlaybookStore } from '../stores/playbookStore';
import type {
  Playbook, PlaybookStep, PlaybookTrigger,
  PlaybookStepType, PlaybookStepAction, PlaybookTriggerType,
} from '../services/playbook.service';

// ─── Constants ──────────────────────────────────────────────

const STEP_TYPES: { value: PlaybookStepType; label: string; icon: React.ReactNode }[] = [
  { value: 'checklist', label: 'Checklist', icon: <CheckCircle2 className="w-4 h-4" /> },
  { value: 'action_button', label: 'Botón de Acción', icon: <Zap className="w-4 h-4" /> },
  { value: 'question', label: 'Pregunta', icon: <MessageSquare className="w-4 h-4" /> },
  { value: 'escalation', label: 'Escalación', icon: <ArrowUpRight className="w-4 h-4" /> },
  { value: 'internal_note', label: 'Nota Interna', icon: <FileText className="w-4 h-4" /> },
  { value: 'link', label: 'Enlace', icon: <ArrowUpRight className="w-4 h-4" /> },
  { value: 'validation', label: 'Validación', icon: <Shield className="w-4 h-4" /> },
  { value: 'category_change', label: 'Cambiar Categoría', icon: <Tag className="w-4 h-4" /> },
];

const STEP_ACTIONS: { value: PlaybookStepAction; label: string }[] = [
  { value: 'none', label: 'Ninguna' },
  { value: 'send_template', label: 'Enviar plantilla' },
  { value: 'assign_tag', label: 'Asignar etiqueta' },
  { value: 'change_category', label: 'Cambiar categoría' },
  { value: 'create_note', label: 'Crear nota' },
  { value: 'escalate_supervisor', label: 'Escalar supervisor' },
  { value: 'open_link', label: 'Abrir enlace' },
  { value: 'open_modal', label: 'Abrir modal' },
];

const TRIGGER_TYPES: { value: PlaybookTriggerType; label: string }[] = [
  { value: 'disposition', label: 'Tipificación' },
  { value: 'tag', label: 'Etiqueta' },
  { value: 'category', label: 'Categoría' },
  { value: 'intent', label: 'Intención' },
  { value: 'manual', label: 'Manual' },
];

const CATEGORIES = [
  'refund', 'technical_support', 'complaint', 'vip_onboarding',
  'billing', 'cancellation', 'general', 'sales', 'onboarding', 'other',
];

// ─── Main Component ─────────────────────────────────────────

export default function PlaybooksPage() {
  const {
    playbooks, isLoadingPlaybooks,
    fetchPlaybooks, createPlaybook, updatePlaybook, deletePlaybook, togglePlaybook, seedDefaults,
  } = usePlaybookStore();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  const filtered = playbooks.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase());
    const matchCategory = !categoryFilter || p.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const handleCreate = () => {
    setEditingPlaybook(null);
    setShowEditor(true);
  };

  const handleEdit = (p: Playbook) => {
    setEditingPlaybook(p);
    setShowEditor(true);
  };

  const handleDelete = async (id: string) => {
    await deletePlaybook(id);
    setDeleteConfirm(null);
  };

  const handleToggle = async (p: Playbook) => {
    await togglePlaybook(p._id, !p.isActive);
  };

  const handleSeed = async () => {
    await seedDefaults();
  };

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100">
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <div className="px-8 py-6 pb-2 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-sm z-20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-xl shadow-indigo-900/10">
                <BookOpen className="w-6 h-6 text-indigo-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-zinc-50 tracking-tight">Playbooks</h1>
                <p className="text-zinc-400 text-sm mt-0.5">Scripts guiados para agentes — gestiona flujos de atención</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {playbooks.length === 0 && (
                <button onClick={handleSeed} className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl hover:bg-amber-500/20 transition-all text-sm">
                  <Sparkles className="w-4 h-4" /> Cargar Defaults
                </button>
              )}
              <button onClick={handleCreate} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-zinc-50 font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                <Plus className="w-4 h-4" /> Nuevo Playbook
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mt-4 mb-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar playbooks..."
                className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-300 focus:border-indigo-500/50 focus:outline-none"
            >
              <option value="">Todas las categorías</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="text-xs text-zinc-500 ml-auto">
              {filtered.length} playbook{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {isLoadingPlaybooks ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
              <BookOpen className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">No hay playbooks</p>
              <p className="text-sm mt-1">Crea tu primer playbook o carga los defaults</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filtered.map(p => (
                <PlaybookCard
                  key={p._id}
                  playbook={p}
                  onEdit={() => handleEdit(p)}
                  onToggle={() => handleToggle(p)}
                  onDelete={() => setDeleteConfirm(p._id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Editor Modal */}
        {showEditor && (
          <PlaybookEditor
            playbook={editingPlaybook}
            onClose={() => setShowEditor(false)}
            onSave={async (data) => {
              if (editingPlaybook) {
                await updatePlaybook(editingPlaybook._id, data);
              } else {
                await createPlaybook(data);
              }
              setShowEditor(false);
            }}
          />
        )}

        {/* Delete Confirm */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setDeleteConfirm(null)}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-500/10 rounded-xl"><AlertTriangle className="w-5 h-5 text-red-400" /></div>
                <h3 className="text-lg font-bold text-zinc-100">Eliminar Playbook</h3>
              </div>
              <p className="text-zinc-400 text-sm mb-6">¿Estás seguro? Los chats con progreso activo perderán su playbook.</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-xl">Cancelar</button>
                <button onClick={() => handleDelete(deleteConfirm)} className="px-4 py-2 text-sm text-red-50 bg-red-600 hover:bg-red-500 rounded-xl">Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Playbook Card ──────────────────────────────────────────

function PlaybookCard({ playbook, onEdit, onToggle, onDelete }: {
  playbook: Playbook; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const criticalCount = playbook.steps.filter(s => s.isCritical).length;

  return (
    <div className={`bg-zinc-900/80 border rounded-2xl transition-all hover:shadow-lg ${playbook.isActive ? 'border-zinc-800 hover:border-indigo-500/30' : 'border-zinc-800/50 opacity-60'}`}>
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-zinc-100">{playbook.name}</h3>
              {playbook.isMandatory && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500/10 text-red-400 rounded-md border border-red-500/20 uppercase">Obligatorio</span>
              )}
            </div>
            {playbook.description && <p className="text-zinc-400 text-sm line-clamp-2">{playbook.description}</p>}
          </div>
          <div className="flex items-center gap-1 ml-3">
            <button onClick={onEdit} className="p-2 text-zinc-500 hover:text-indigo-400 hover:bg-zinc-800 rounded-lg transition-all" title="Editar">
              <Edit className="w-4 h-4" />
            </button>
            <button onClick={onToggle} className="p-2 text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800 rounded-lg transition-all" title={playbook.isActive ? 'Desactivar' : 'Activar'}>
              {playbook.isActive ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
            </button>
            <button onClick={onDelete} className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-all" title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tags / metadata */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="px-2.5 py-1 text-xs font-medium bg-indigo-500/10 text-indigo-300 rounded-lg border border-indigo-500/20">{playbook.category}</span>
          <span className="px-2.5 py-1 text-xs text-zinc-400 bg-zinc-800 rounded-lg">{playbook.steps.length} pasos</span>
          {criticalCount > 0 && (
            <span className="px-2.5 py-1 text-xs text-amber-300 bg-amber-500/10 rounded-lg border border-amber-500/20">{criticalCount} críticos</span>
          )}
          <span className="text-[10px] text-zinc-600 ml-auto">v{playbook.version}</span>
        </div>

        {/* Triggers */}
        {playbook.triggers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {playbook.triggers.map((t, i) => (
              <span key={i} className="px-2 py-0.5 text-[10px] text-zinc-400 bg-zinc-800/80 rounded border border-zinc-700/50">
                {t.type}: {t.value}
              </span>
            ))}
          </div>
        )}

        {/* Expand steps */}
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mt-1">
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {expanded ? 'Ocultar pasos' : 'Ver pasos'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800/50 px-5 py-3 space-y-2">
          {playbook.steps.sort((a, b) => a.order - b.order).map((step, idx) => (
            <div key={step.stepId} className="flex items-start gap-3 py-2">
              <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-bold text-zinc-500 bg-zinc-800 rounded-full">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">{step.label}</span>
                  {step.isCritical && <Shield className="w-3 h-3 text-red-400 flex-shrink-0" />}
                </div>
                {step.description && <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">{step.type}</span>
                  {step.action !== 'none' && <span className="text-[10px] px-1.5 py-0.5 bg-indigo-500/10 text-indigo-300 rounded">{step.action}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Playbook Editor Modal ──────────────────────────────────

function PlaybookEditor({ playbook, onClose, onSave }: {
  playbook: Playbook | null; onClose: () => void; onSave: (data: Partial<Playbook>) => Promise<void>;
}) {
  const [name, setName] = useState(playbook?.name || '');
  const [description, setDescription] = useState(playbook?.description || '');
  const [category, setCategory] = useState(playbook?.category || 'general');
  const [isMandatory, setIsMandatory] = useState(playbook?.isMandatory ?? false);
  const [steps, setSteps] = useState<PlaybookStep[]>(playbook?.steps || []);
  const [triggers, setTriggers] = useState<PlaybookTrigger[]>(playbook?.triggers || []);
  const [saving, setSaving] = useState(false);
  const [activeStepIdx, setActiveStepIdx] = useState<number | null>(null);

  const addStep = () => {
    const newStep: PlaybookStep = {
      stepId: `step_${Date.now()}`,
      type: 'checklist',
      label: '',
      action: 'none',
      isCritical: false,
      order: steps.length + 1,
      skipRequiresComment: false,
    };
    setSteps([...steps, newStep]);
    setActiveStepIdx(steps.length);
  };

  const updateStep = (idx: number, patch: Partial<PlaybookStep>) => {
    setSteps(steps.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const removeStep = (idx: number) => {
    setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
    setActiveStepIdx(null);
  };

  const moveStep = (idx: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newSteps.length) return;
    [newSteps[idx], newSteps[targetIdx]] = [newSteps[targetIdx], newSteps[idx]];
    setSteps(newSteps.map((s, i) => ({ ...s, order: i + 1 })));
    setActiveStepIdx(targetIdx);
  };

  const addTrigger = () => {
    setTriggers([...triggers, { type: 'category', value: '' }]);
  };

  const updateTrigger = (idx: number, patch: Partial<PlaybookTrigger>) => {
    setTriggers(triggers.map((t, i) => i === idx ? { ...t, ...patch } : t));
  };

  const removeTrigger = (idx: number) => {
    setTriggers(triggers.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name, description, category, isMandatory, steps, triggers });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-100">
            {playbook ? 'Editar Playbook' : 'Nuevo Playbook'}
          </h2>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nombre</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Proceso de Reembolso" className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Descripción</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Descripción del playbook..." className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 placeholder:text-zinc-500 focus:border-indigo-500/50 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Categoría</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 focus:border-indigo-500/50 focus:outline-none">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={isMandatory} onChange={e => setIsMandatory(e.target.checked)} className="w-4 h-4 rounded accent-red-500" />
                <div>
                  <span className="text-sm font-medium text-zinc-200">Obligatorio</span>
                  <p className="text-xs text-zinc-500">Chat no se puede cerrar sin completar pasos críticos</p>
                </div>
              </label>
            </div>
          </div>

          {/* Triggers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-zinc-300">Disparadores</label>
              <button onClick={addTrigger} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar</button>
            </div>
            <div className="space-y-2">
              {triggers.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={t.type} onChange={e => updateTrigger(i, { type: e.target.value as PlaybookTriggerType })} className="px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none">
                    {TRIGGER_TYPES.map(tt => <option key={tt.value} value={tt.value}>{tt.label}</option>)}
                  </select>
                  <input value={t.value} onChange={e => updateTrigger(i, { value: e.target.value })} placeholder="Valor del trigger" className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 placeholder:text-zinc-500 focus:outline-none" />
                  <button onClick={() => removeTrigger(i)} className="p-1.5 text-zinc-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-zinc-300">Pasos ({steps.length})</label>
              <button onClick={addStep} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar Paso</button>
            </div>
            <div className="space-y-2">
              {steps.map((step, idx) => (
                <div key={step.stepId} className={`border rounded-xl transition-all ${activeStepIdx === idx ? 'border-indigo-500/40 bg-zinc-900/80' : 'border-zinc-800 bg-zinc-900/40'}`}>
                  {/* Step header */}
                  <div className="flex items-center gap-2 px-4 py-3 cursor-pointer" onClick={() => setActiveStepIdx(activeStepIdx === idx ? null : idx)}>
                    <GripVertical className="w-4 h-4 text-zinc-600" />
                    <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-zinc-400 bg-zinc-800 rounded-full">{idx + 1}</span>
                    <span className="text-sm font-medium text-zinc-200 flex-1">{step.label || '(Sin título)'}</span>
                    {step.isCritical && <Shield className="w-3.5 h-3.5 text-red-400" />}
                    <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">{step.type}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={e => { e.stopPropagation(); moveStep(idx, 'up'); }} disabled={idx === 0} className="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-30">↑</button>
                      <button onClick={e => { e.stopPropagation(); moveStep(idx, 'down'); }} disabled={idx === steps.length - 1} className="p-1 text-zinc-600 hover:text-zinc-300 disabled:opacity-30">↓</button>
                      <button onClick={e => { e.stopPropagation(); removeStep(idx); }} className="p-1 text-zinc-600 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  {/* Step details (expanded) */}
                  {activeStepIdx === idx && (
                    <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/50 pt-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Título</label>
                          <input value={step.label} onChange={e => updateStep(idx, { label: e.target.value })} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Tipo</label>
                          <select value={step.type} onChange={e => updateStep(idx, { type: e.target.value as PlaybookStepType })} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none">
                            {STEP_TYPES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-500 mb-1 block">Descripción</label>
                        <input value={step.description || ''} onChange={e => updateStep(idx, { description: e.target.value })} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Acción</label>
                          <select value={step.action} onChange={e => updateStep(idx, { action: e.target.value as PlaybookStepAction })} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none">
                            {STEP_ACTIONS.map(sa => <option key={sa.value} value={sa.value}>{sa.label}</option>)}
                          </select>
                        </div>
                        <div className="flex items-end gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={step.isCritical} onChange={e => updateStep(idx, { isCritical: e.target.checked })} className="accent-red-500" />
                            <span className="text-xs text-zinc-300">Crítico</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={step.skipRequiresComment} onChange={e => updateStep(idx, { skipRequiresComment: e.target.checked })} className="accent-amber-500" />
                            <span className="text-xs text-zinc-300">Skip requiere comentario</span>
                          </label>
                        </div>
                      </div>

                      {/* Action-specific fields */}
                      {(step.action === 'send_template') && (
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Texto de plantilla (soporta {'{{variables}}'})</label>
                          <textarea value={step.templateText || ''} onChange={e => updateStep(idx, { templateText: e.target.value })} rows={2} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none resize-none font-mono" placeholder="Hola {{user.firstName}}, ¿en qué puedo ayudarte?" />
                        </div>
                      )}
                      {step.action === 'assign_tag' && (
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Nombre de etiqueta</label>
                          <input value={step.tagName || ''} onChange={e => updateStep(idx, { tagName: e.target.value })} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none" />
                        </div>
                      )}
                      {step.action === 'open_link' && (
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">URL</label>
                          <input value={step.linkUrl || ''} onChange={e => updateStep(idx, { linkUrl: e.target.value })} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none" />
                        </div>
                      )}
                      {step.action === 'open_modal' && (
                        <div>
                          <label className="text-xs text-zinc-500 mb-1 block">Tipo de modal</label>
                          <input value={step.modalType || ''} onChange={e => updateStep(idx, { modalType: e.target.value })} placeholder="Ej: identity_validation" className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 focus:outline-none" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="px-5 py-2.5 text-sm text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 rounded-xl transition-all">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-zinc-50 font-medium rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {playbook ? 'Guardar Cambios' : 'Crear Playbook'}
          </button>
        </div>
      </div>
    </div>
  );
}

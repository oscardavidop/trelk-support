/**
 * SidebarPlaybook — Playbook widget for the ChatInfoSidebar.
 * Shows active playbook progress, suggested playbooks, step execution.
 * Reacts to disposition/tags/category changes to auto-suggest matching playbooks.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen, Play, CheckCircle2, Circle, SkipForward, X, Loader2,
  Shield, ChevronDown, ChevronRight, Zap, MessageSquare, ArrowUpRight,
  FileText, Tag, AlertTriangle, Send, ExternalLink, Percent,
  List, Search,
} from 'lucide-react';
import { usePlaybookStore } from '../../stores/playbookStore';
import type { PlaybookProgress, PlaybookStep, Playbook } from '../../services/playbook.service';
import type { ContactInfo } from '../../types';

interface SidebarPlaybookProps {
  sessionId: string;
  contactInfo: ContactInfo;
}

export function SidebarPlaybook({ sessionId, contactInfo }: SidebarPlaybookProps) {
  const {
    activeProgress, suggestedPlaybooks, availablePlaybooks,
    fetchProgress, fetchSuggestions, fetchAvailable,
    startPlaybook, completeStep, skipStep, abandonPlaybook,
  } = usePlaybookStore();

  const [loading, setLoading] = useState(true);
  const [skipModal, setSkipModal] = useState<{ stepId: string; requiresComment: boolean } | null>(null);
  const [skipComment, setSkipComment] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [browseMode, setBrowseMode] = useState(false);
  const [browseFilter, setBrowseFilter] = useState('');

  const progress = activeProgress[sessionId];

  // Build matching context from contactInfo — send all disposition info for flexible matching
  const matchContext = useMemo(() => ({
    dispositionId: contactInfo.session.disposition?.categoryId || undefined,
    dispositionCode: contactInfo.session.disposition?.categoryCode || undefined,
    dispositionName: contactInfo.session.disposition?.categoryName || undefined,
    category: contactInfo.session.category || undefined,
    tags: contactInfo.tags?.length ? contactInfo.tags.map(t => typeof t === 'string' ? t : t.name) : undefined,
  }), [
    contactInfo.session.disposition?.categoryId,
    contactInfo.session.disposition?.categoryCode,
    contactInfo.session.disposition?.categoryName,
    contactInfo.session.category,
    contactInfo.tags,
  ]);

  // Serialized key to detect changes
  const contextKey = useMemo(() =>
    JSON.stringify([matchContext.dispositionId, matchContext.dispositionCode, matchContext.dispositionName, matchContext.category, matchContext.tags?.sort()]),
    [matchContext]
  );

  // Fetch progress + suggestions on mount and when context changes
  const prevContextKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    const isFirstLoad = prevContextKeyRef.current === null;
    prevContextKeyRef.current = contextKey;

    if (isFirstLoad) {
      setLoading(true);
      Promise.all([
        fetchProgress(sessionId),
        fetchSuggestions(matchContext),
      ]).finally(() => setLoading(false));
    } else {
      // Context changed (disposition/tags/category updated) — re-fetch suggestions only
      fetchSuggestions(matchContext);
    }
  }, [sessionId, contextKey, fetchProgress, fetchSuggestions, matchContext]);

  const handleStart = async (playbookId: string) => {
    await startPlaybook(sessionId, playbookId);
    setBrowseMode(false);
  };

  const handleComplete = async (stepId: string) => {
    await completeStep(sessionId, stepId);
  };

  const handleSkipRequest = (step: PlaybookStep) => {
    if (step.skipRequiresComment || step.isCritical) {
      setSkipModal({ stepId: step.stepId, requiresComment: true });
    } else {
      skipStep(sessionId, step.stepId, 'Sin razón proporcionada');
    }
  };

  const handleSkipConfirm = async () => {
    if (!skipModal) return;
    await skipStep(sessionId, skipModal.stepId, skipModal.requiresComment ? skipComment.trim() : 'Sin razón proporcionada');
    setSkipModal(null);
    setSkipComment('');
  };

  const handleAbandon = async () => {
    if (confirm('¿Abandonar este playbook?')) {
      await abandonPlaybook(sessionId);
    }
  };

  const handleBrowse = async () => {
    setBrowseMode(true);
    setBrowseFilter('');
    await fetchAvailable();
  };

  const filteredBrowse = useMemo(() => {
    if (!browseFilter.trim()) return availablePlaybooks;
    const q = browseFilter.toLowerCase();
    return availablePlaybooks.filter(pb =>
      pb.name.toLowerCase().includes(q) || pb.description?.toLowerCase().includes(q) || pb.category?.toLowerCase().includes(q)
    );
  }, [availablePlaybooks, browseFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
      </div>
    );
  }

  // Active playbook — show progress
  if (progress && progress.status === 'active') {
    return (
      <div className="px-3 pb-3">
        <ActivePlaybookView
          progress={progress}
          sessionId={sessionId}
          onComplete={handleComplete}
          onSkip={handleSkipRequest}
          onAbandon={handleAbandon}
        />

        {/* Skip modal */}
        {skipModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSkipModal(null)}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 w-full max-w-xs shadow-xl" onClick={e => e.stopPropagation()}>
              <h4 className="text-sm font-bold text-zinc-100 mb-2 flex items-center gap-2">
                <SkipForward className="w-4 h-4 text-amber-400" /> Saltar paso
              </h4>
              <p className="text-xs text-zinc-400 mb-3">Este paso requiere un comentario para saltar.</p>
              <textarea
                value={skipComment}
                onChange={e => setSkipComment(e.target.value)}
                placeholder="Razón para saltar..."
                rows={2}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none resize-none mb-3"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setSkipModal(null)} className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-800 rounded-lg">Cancelar</button>
                <button onClick={handleSkipConfirm} disabled={skipModal.requiresComment && !skipComment.trim()} className="px-3 py-1.5 text-xs text-amber-50 bg-amber-600 hover:bg-amber-500 rounded-lg disabled:opacity-50">Saltar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Completed playbook — show summary
  if (progress && progress.status === 'completed') {
    const playbook = typeof progress.playbookId === 'object' ? (progress.playbookId as Playbook) : null;
    const playbookName = playbook?.name || 'Playbook';
    const completedCount = progress.steps.filter(s => s.status === 'completed').length;
    const skippedCount = progress.steps.filter(s => s.status === 'skipped').length;
    return (
      <div className="px-3 pb-3 pt-3">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-emerald-300">Completado</h4>
          </div>
          <p className="text-xs text-zinc-300 font-medium">{playbookName}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-zinc-500">
            <span>{completedCount} completados</span>
            {skippedCount > 0 && <span>{skippedCount} saltados</span>}
            <span>{progress.completionPercent}%</span>
          </div>
          {progress.completedAt && (
            <p className="text-[10px] text-zinc-600 mt-1">
              Completado: {new Date(progress.completedAt).toLocaleString('es')}
            </p>
          )}
        </div>
        {/* Allow starting another playbook */}
        <button
          onClick={handleBrowse}
          className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 rounded-lg transition-all"
        >
          <List className="w-3.5 h-3.5" /> Iniciar otro playbook
        </button>
      </div>
    );
  }

  // Browse mode — show all available playbooks
  if (browseMode) {
    return (
      <div className="px-3 pb-3 space-y-3 pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
            <List className="w-3.5 h-3.5 text-indigo-400" /> Todos los Playbooks
          </h4>
          <button onClick={() => setBrowseMode(false)} className="text-[10px] text-zinc-500 hover:text-zinc-300">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="relative mb-2">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={browseFilter}
            onChange={e => setBrowseFilter(e.target.value)}
            placeholder="Buscar playbook..."
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/40"
          />
        </div>
        {filteredBrowse.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {filteredBrowse.map(pb => (
              <SuggestedPlaybookCard key={pb._id} playbook={pb} onStart={() => handleStart(pb._id)} />
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-zinc-600 text-center py-3">No se encontraron playbooks</p>
        )}
      </div>
    );
  }

  // No active playbook — show suggestions + browse
  return (
    <div className="px-3 pb-3 space-y-3 pt-3">
      {suggestedPlaybooks.length > 0 ? (
        <div>
          <button onClick={() => setShowSuggestions(!showSuggestions)} className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200 mb-2 w-full">
            {showSuggestions ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <span>{suggestedPlaybooks.length} playbook{suggestedPlaybooks.length !== 1 ? 's' : ''} sugerido{suggestedPlaybooks.length !== 1 ? 's' : ''}</span>
          </button>
          {showSuggestions && (
            <div className="space-y-2">
              {suggestedPlaybooks.map(pb => (
                <SuggestedPlaybookCard key={pb._id} playbook={pb} onStart={() => handleStart(pb._id)} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-3">
          <BookOpen className="w-7 h-7 text-zinc-700 mx-auto mb-1.5" />
          <p className="text-xs text-zinc-500">No hay playbooks sugeridos</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Asigna una categoría o etiqueta para ver sugerencias</p>
        </div>
      )}

      {/* Browse all button */}
      <button
        onClick={handleBrowse}
        className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/20 rounded-lg transition-all"
      >
        <List className="w-3.5 h-3.5" /> Ver todos los playbooks
      </button>
    </div>
  );
}

// ─── Active Playbook View ───────────────────────────────────

function ActivePlaybookView({ progress, sessionId, onComplete, onSkip, onAbandon }: {
  progress: PlaybookProgress;
  sessionId: string;
  onComplete: (stepId: string) => void;
  onSkip: (step: PlaybookStep) => void;
  onAbandon: () => void;
}) {
  const playbook = typeof progress.playbookId === 'object' ? (progress.playbookId as Playbook) : undefined;
  const playbookName = playbook?.name || 'Playbook';
  const completedCount = progress.steps.filter(s => s.status === 'completed').length;
  const skippedCount = progress.steps.filter(s => s.status === 'skipped').length;
  const totalCount = progress.steps.length;
  const pct = progress.completionPercent || Math.round(((completedCount + skippedCount) / totalCount) * 100);

  return (
    <div className='py-4'>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 flex-shrink-0">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-zinc-100 truncate">{playbookName}</h4>
            <p className="text-[10px] text-zinc-500">{completedCount}/{totalCount} pasos</p>
          </div>
        </div>
        <button onClick={onAbandon} className="p-1 text-zinc-600 hover:text-red-400 transition-colors" title="Abandonar playbook">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-zinc-500">Progreso</span>
          <span className="text-[10px] font-bold text-indigo-400">{pct}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-1">
        {progress.steps.map((sp, idx) => {
          const stepDef = playbook?.steps?.find(s => s.stepId === sp.stepId);
          return (
            <StepItem
              key={sp.stepId}
              step={sp}
              stepDef={stepDef}
              index={idx}
              sessionId={sessionId}
              onComplete={() => onComplete(sp.stepId)}
              onSkip={() => stepDef && onSkip(stepDef)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Step Item ──────────────────────────────────────────────

/** Dispatch a custom event so AgentComposer inserts text */
function insertIntoComposer(text: string) {
  window.dispatchEvent(new CustomEvent('playbook:insertText', { detail: { text } }));
}

function StepItem({ step, stepDef, index, sessionId, onComplete, onSkip }: {
  step: PlaybookProgress['steps'][0];
  stepDef?: PlaybookStep;
  index: number;
  sessionId: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const isCompleted = step.status === 'completed';
  const isSkipped = step.status === 'skipped';
  const isPending = step.status === 'pending';
  const isCritical = stepDef?.isCritical ?? false;

  const handleSendTemplate = () => {
    const text = stepDef?.templateText || '';
    if (text) {
      insertIntoComposer(text);
    }
    // Auto-complete this step after inserting
    onComplete();
  };

  return (
    <div className={`flex items-start gap-2 py-2 px-2 rounded-lg transition-all ${
      isCompleted ? 'bg-emerald-500/5' : isSkipped ? 'bg-zinc-800/30 opacity-60' : 'hover:bg-zinc-800/50'
    }`}>
      {/* Status icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : isSkipped ? (
          <SkipForward className="w-4 h-4 text-zinc-500" />
        ) : (
          <Circle className="w-4 h-4 text-zinc-600" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-medium ${isCompleted ? 'text-emerald-300 line-through' : isSkipped ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
            {stepDef?.label || step.stepId}
          </span>
          {isCritical && <Shield className="w-3 h-3 text-red-400 flex-shrink-0" />}
        </div>
        {stepDef?.description && (
          <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{stepDef.description}</p>
        )}

        {/* Action buttons for pending steps */}
        {isPending && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {stepDef?.action === 'send_template' && stepDef.templateText ? (
              <button onClick={handleSendTemplate} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 rounded-md border border-cyan-500/20 transition-all" title="Insertar texto en el compositor y completar">
                <Send className="w-3 h-3" /> Enviar y completar
              </button>
            ) : (
              <button onClick={onComplete} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 rounded-md border border-indigo-500/20 transition-all">
                <CheckCircle2 className="w-3 h-3" /> Completar
              </button>
            )}
            {!isCritical && (
              <button onClick={onSkip} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-md transition-all">
                <SkipForward className="w-3 h-3" /> Saltar
              </button>
            )}
            {stepDef?.action === 'open_link' && stepDef?.linkUrl && (
              <a href={stepDef.linkUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-400 hover:bg-blue-500/10 rounded-md transition-all">
                <ExternalLink className="w-3 h-3" /> Abrir
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Suggested Playbook Card ────────────────────────────────

function SuggestedPlaybookCard({ playbook, onStart }: { playbook: Playbook; onStart: () => void }) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-3 hover:border-indigo-500/30 transition-all">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h5 className="text-xs font-bold text-zinc-200 truncate">{playbook.name}</h5>
          {playbook.description && <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{playbook.description}</p>}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-zinc-500">{playbook.steps.length} pasos</span>
            {playbook.isMandatory && (
              <span className="text-[10px] text-red-400 font-medium">Obligatorio</span>
            )}
          </div>
        </div>
        <button onClick={onStart} className="flex-shrink-0 ml-2 p-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg border border-indigo-500/20 transition-all" title="Iniciar playbook">
          <Play className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

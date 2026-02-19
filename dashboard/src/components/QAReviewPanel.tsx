/**
 * QAReviewPanel - Premium Zinc Refactor
 * High-fidelity QA evaluation form with dynamic scoring
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, CheckCircle2, XCircle, Minus, HelpCircle,
  Save, AlertTriangle, MessageSquare, Star, Loader2, Eye,
  Check, FileText, Pencil, History, ShieldAlert, Tag, BookOpen, ChevronDown, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import * as qaService from '../services/qa.service';
import * as playbookApi from '../services/playbook.service';
import type { PlaybookQAData } from '../services/playbook.service';
import type { QACheckItem, QACheckResult, QAReview, QASettings, CoachingTag } from '../services/qa.service';

// ============= UTILS =============

function resultToScore(r: QACheckResult): number {
  if (r === 'yes') return 100;
  if (r === 'partial') return 50;
  return 0; 
}

function calcWeightedScore(checks: { weight: number; result: QACheckResult }[]): number {
  let totalW = 0;
  let sum = 0;
  for (const c of checks) {
    if (c.result === 'na') continue;
    totalW += c.weight;
    sum += (resultToScore(c.result) / 100) * c.weight;
  }
  return totalW === 0 ? 0 : Math.round((sum / totalW) * 100);
}

function getScoreStyle(s: number) {
  if (s >= 90) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
  if (s >= 70) return { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
  if (s >= 50) return { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
  return { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };
}

const CATEGORY_LABELS: Record<string, string> = {
  greeting: '👋 Saludo y Apertura',
  resolution: '✅ Resolución',
  tone: '💬 Tono y Etiqueta',
  procedure: '📋 Procedimientos',
  closing: '🏁 Cierre',
  general: '🌐 General',
};

const COACHING_TAG_OPTIONS: { value: CoachingTag; label: string }[] = [
  { value: 'tone_issue', label: 'Problema de tono' },
  { value: 'slow_response', label: 'Respuesta lenta' },
  { value: 'wrong_category', label: 'Categoría incorrecta' },
  { value: 'policy_violation', label: 'Violación de política' },
  { value: 'other', label: 'Otro' },
];

// ============= SUB-COMPONENT: RESULT BUTTON =============

function ResultButton({ result, current, onClick, disabled }: { result: QACheckResult; current: QACheckResult; onClick: () => void; disabled?: boolean }) {
  const config = {
    yes: { icon: CheckCircle2, label: 'Sí', active: 'bg-emerald-600 text-zinc-50 border-emerald-500', hover: 'hover:bg-emerald-500/20 hover:text-emerald-400' },
    partial: { icon: Minus, label: 'Parcial', active: 'bg-amber-600 text-zinc-50 border-amber-500', hover: 'hover:bg-amber-500/20 hover:text-amber-400' },
    no: { icon: XCircle, label: 'No', active: 'bg-red-600 text-zinc-50 border-red-500', hover: 'hover:bg-red-500/20 hover:text-red-400' },
    na: { icon: HelpCircle, label: 'N/A', active: 'bg-zinc-600 text-zinc-50 border-zinc-500', hover: 'hover:bg-zinc-800 hover:text-zinc-300' },
  }[result];

  const Icon = config.icon;
  const isActive = current === result;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center justify-center p-1.5 rounded-lg border transition-all duration-200
        ${isActive ? `${config.active} shadow-sm` : `bg-transparent border-transparent text-zinc-600 ${!disabled && config.hover}`}
        ${disabled && !isActive ? 'opacity-30 cursor-not-allowed' : ''}
      `}
      title={config.label}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

// ============= MAIN COMPONENT =============

interface CheckState {
  checkItemId: string;
  checkName: string;
  checkCategory: string;
  weight: number;
  result: QACheckResult;
  note: string;
}

export default function QAReviewPanel({ sessionId, agentId, compact = false, onReviewSaved }: any) {
  const [checklist, setChecklist] = useState<QACheckItem[]>([]);
  const [settings, setSettings] = useState<QASettings | null>(null);
  const [checks, setChecks] = useState<CheckState[]>([]);
  const [comment, setComment] = useState('');
  const [playbookQA, setPlaybookQA] = useState<PlaybookQAData | null>(null);
  const [existingReview, setExistingReview] = useState<QAReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNoteFor, setShowNoteFor] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState(false);

  // Edit mode for admin/supervisor
  const agent = useAuthStore((s) => s.agent);
  const canEdit = agent && ['admin', 'supervisor'].includes(agent.role || '');
  const [editMode, setEditMode] = useState(false);
  const [editReason, setEditReason] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editTags, setEditTags] = useState<CoachingTag[]>([]);
  const [editRecommendations, setEditRecommendations] = useState('');
  const [showAuditLog, setShowAuditLog] = useState(false);

  const totalScore = calcWeightedScore(checks);
  const needsComment = settings ? totalScore < settings.lowScoreThreshold : totalScore < 70;
  const scoreStyle = getScoreStyle(totalScore);

  // --- Load Data ---
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [items, qaSettings, existing] = await Promise.all([
          qaService.getChecklist(),
          qaService.getQASettings().catch(() => null),
          qaService.getReviewBySession(sessionId),
        ]);
        // Fetch playbook compliance data
        try {
          const pbData = await playbookApi.getPlaybookQAData(sessionId);
          setPlaybookQA(pbData);
        } catch { /* no playbook data */ }
        setChecklist(items || []); setSettings(qaSettings);

        if (existing && existing.checks) {
          setExistingReview(existing); setViewMode(true);
          setChecks(existing.checks.map((c: any) => ({ ...c, note: c.note || '' })));
          setComment(existing.comment || '');
          setEditTags(existing.coachingTags || []);
          setEditRecommendations((existing.trainingRecommendations || []).join('\n'));
        } else {
          setChecks((items || []).map((item) => ({
            checkItemId: item._id, checkName: item.name, checkCategory: item.category,
            weight: item.weight, result: 'na', note: '',
          })));
        }
      } catch (err) { console.error(err); } 
      finally { setLoading(false); }
    };
    load();
  }, [sessionId]);

  // --- Handlers ---
  const setResult = (idx: number, result: QACheckResult) => {
    if (viewMode && !editMode) return;
    setChecks(prev => prev.map((c, i) => (i === idx ? { ...c, result } : c)));
  };

  const setNote = (idx: number, note: string) => {
    if (viewMode && !editMode) return;
    setChecks(prev => prev.map((c, i) => (i === idx ? { ...c, note } : c)));
  };

  const handleEnterEditMode = () => {
    setEditMode(true);
    setEditReason('');
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditReason('');
    // Revert checks to saved state
    if (existingReview) {
      setChecks(existingReview.checks.map((c: any) => ({ ...c, note: c.note || '' })));
      setComment(existingReview.comment || '');
      setEditTags(existingReview.coachingTags || []);
      setEditRecommendations((existingReview.trainingRecommendations || []).join('\n'));
    }
  };

  const handleSaveEdit = async () => {
    if (!existingReview || !editReason.trim()) return;
    setEditSaving(true);
    try {
      const recs = editRecommendations.split('\n').map(r => r.trim()).filter(Boolean);
      const updated = await qaService.editReviewWithAudit(existingReview._id, {
        editReason,
        checks: checks.map(c => ({
          checkItemId: c.checkItemId, checkName: c.checkName, checkCategory: c.checkCategory,
          weight: c.weight, result: c.result, note: c.note || undefined,
        })),
        comment,
        coachingTags: editTags,
        trainingRecommendations: recs,
      });
      if (updated) {
        setExistingReview(updated);
        setEditMode(false);
        onReviewSaved?.(updated);
      }
    } catch (err) {
      alert('Error al editar evaluación');
    } finally {
      setEditSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (needsComment && !comment.trim()) return alert('Se requiere un comentario para scores bajos.');
    setSaving(true);
    try {
      const review = await qaService.submitReview({
        sessionId, agentId,
        checks: checks.map(c => ({ 
          checkItemId: c.checkItemId, checkName: c.checkName, checkCategory: c.checkCategory,
          weight: c.weight, result: c.result, note: c.note || undefined 
        })),
        comment, status: 'completed'
      });
      setExistingReview(review); setViewMode(true); onReviewSaved?.(review);
    } catch (err) { alert('Error al guardar'); } 
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;
  if (checklist.length === 0 && !existingReview) return <div className="text-center py-8 text-zinc-500 text-sm">No hay checklist configurado.</div>;

  const grouped = checks.reduce<Record<string, CheckState[]>>((acc, c) => {
    const cat = c.checkCategory || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(c);
    return acc;
  }, {});

  return (
    <div className={`space-y-5 animate-in fade-in duration-300 ${compact ? 'px-2' : ''}`}>
      
      {/* Score Card */}
      <div className={`flex items-center justify-between p-4 rounded-xl border ${scoreStyle.bg} ${scoreStyle.border}`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full bg-white/10 ${scoreStyle.text}`}>
            <Star className="w-5 h-5 fill-current" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 font-bold uppercase ">Score Total</p>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-black ${scoreStyle.text}`}>{totalScore}</span>
              <span className="text-sm text-zinc-500 font-medium">/ 100</span>
            </div>
          </div>
        </div>
        {viewMode && (
          <div className="flex flex-col items-end gap-1.5">
            <span className="px-2 py-1 rounded bg-zinc-900/50 border border-zinc-700/50 text-[10px] text-zinc-400 font-medium uppercase  flex items-center gap-1">
              <Eye className="w-3 h-3" /> {editMode ? 'Editando' : 'Solo Lectura'}
            </span>
            {existingReview?.status === 'completed' && !editMode && <span className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1"><Check className="w-3 h-3" /> Completado</span>}
            {existingReview?.escalated && <span className="text-[10px] text-red-400 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Escalada</span>}
          </div>
        )}
      </div>

      {/* Playbook Compliance Card */}
      {playbookQA && (
        <PlaybookComplianceCard data={playbookQA} />
      )}
      {!playbookQA && (
        <div className="p-3 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <p className="text-xs font-medium text-amber-300">Sin playbook ejecutado</p>
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">No se ejecutó ningún playbook durante esta conversación.</p>
        </div>
      )}

      {/* Categories List */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([cat, catChecks]) => (
          <div key={cat} className="space-y-2">
            <h4 className="text-xs font-bold text-zinc-500 uppercase  px-1">
              {CATEGORY_LABELS[cat] || cat}
            </h4>
            <div className="space-y-1">
              {catChecks.map((check) => {
                const globalIdx = checks.findIndex(c => c.checkItemId === check.checkItemId);
                return (
                  <div key={check.checkItemId} className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-zinc-700 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 leading-snug">{check.checkName}</p>
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-500 font-mono">
                          Peso: {check.weight}%
                        </span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800 shrink-0">
                        {(['yes', 'partial', 'no', 'na'] as const).map(r => (
                          <ResultButton 
                            key={r} 
                            result={r} 
                            current={check.result} 
                            onClick={() => setResult(globalIdx, r)} 
                            disabled={viewMode && !editMode}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Note Input Toggle */}
                    {(!viewMode || editMode || check.note) && (
                      <div className="mt-2 pt-2 border-t border-zinc-800/50">
                        {(showNoteFor === check.checkItemId || check.note) ? (
                          <div className="relative">
                            <input
                              type="text"
                              value={check.note}
                              onChange={e => setNote(globalIdx, e.target.value)}
                              readOnly={viewMode && !editMode}
                              placeholder="Añadir observación..."
                              className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-lg py-1.5 px-3 text-xs text-zinc-300 placeholder-zinc-600 focus:border-indigo-500/50 focus:bg-zinc-950 focus:outline-none transition-all"
                            />
                            {(!viewMode || editMode) && !check.note && (
                              <button 
                                onClick={() => setShowNoteFor(null)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                              >
                                <XCircle className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowNoteFor(check.checkItemId)}
                            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-indigo-400 transition-colors"
                          >
                            <FileText className="w-3 h-3" /> Agregar nota
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* General Comment */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase ">
          <MessageSquare className="w-3 h-3" /> 
          Feedback General {needsComment && !viewMode && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          readOnly={viewMode && !editMode}
          rows={3}
          placeholder={needsComment ? 'Debes justificar la calificación baja...' : 'Comentario opcional para el agente...'}
          className={`w-full bg-zinc-900 border rounded-xl p-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none transition-all ${
            needsComment && !comment.trim() && !viewMode ? 'border-red-500/30 focus:border-red-500' : 'border-zinc-800 focus:border-indigo-500'
          }`}
        />
        {needsComment && !viewMode && (
          <div className="flex items-center gap-2 text-xs text-amber-500/80 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Calificación baja: Comentario obligatorio.</span>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {!viewMode && (
        <div className="pt-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:translate-y-[-1px] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Guardando...' : 'Finalizar Evaluación'}
          </button>
        </div>
      )}

      {/* === ADMIN/SUPERVISOR ACTIONS === */}
      {viewMode && canEdit && existingReview && !editMode && (
        <div className="pt-3 border-t border-zinc-800 space-y-2">
          <button
            onClick={handleEnterEditMode}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl border border-zinc-700 transition-colors"
          >
            <Pencil className="w-4 h-4" /> Editar Evaluación
          </button>

          {/* Audit Log Toggle */}
          {existingReview.editHistory && existingReview.editHistory.length > 0 && (
            <div>
              <button
                onClick={() => setShowAuditLog(!showAuditLog)}
                className="flex items-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showAuditLog ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <History className="w-3 h-3" /> Historial de ediciones ({existingReview.editHistory.length})
              </button>
              {showAuditLog && (
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {existingReview.editHistory.map((log, i) => {
                    const editor = typeof log.editedBy === 'object' ? log.editedBy : null;
                    return (
                      <div key={i} className="p-2 bg-zinc-800/50 rounded-lg text-xs border border-zinc-800">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-300 font-medium">{editor?.name || 'Admin'}</span>
                          <span className="text-zinc-600">{new Date(log.editedAt).toLocaleString('es')}</span>
                        </div>
                        <p className="text-zinc-400 mt-1">{log.editReason}</p>
                        {log.previousScore !== log.newScore && (
                          <div className="mt-1 flex items-center gap-1">
                            <span className="text-zinc-500">Score:</span>
                            <span className="text-red-400">{log.previousScore}</span>
                            <span className="text-zinc-600">→</span>
                            <span className="text-emerald-400">{log.newScore}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Coaching Tags display */}
          {existingReview.coachingTags && existingReview.coachingTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag className="w-3 h-3 text-zinc-600" />
              {existingReview.coachingTags.map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 text-[10px] bg-zinc-800 text-zinc-400 rounded">
                  {COACHING_TAG_OPTIONS.find(t => t.value === tag)?.label || tag}
                </span>
              ))}
            </div>
          )}

          {/* Training Recommendations display */}
          {existingReview.trainingRecommendations && existingReview.trainingRecommendations.length > 0 && (
            <div className="space-y-1">
              <span className="flex items-center gap-1 text-[10px] text-indigo-400 font-medium uppercase">
                <BookOpen className="w-3 h-3" /> Recomendaciones
              </span>
              {existingReview.trainingRecommendations.map((rec, i) => (
                <p key={i} className="text-xs text-zinc-400 pl-4">• {rec}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === EDIT MODE FORM === */}
      {viewMode && editMode && existingReview && (
        <div className="pt-3 border-t border-indigo-500/30 space-y-3 bg-indigo-500/5 -mx-2 p-3 rounded-xl">
          {/* Edit reason (required) */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Razón de edición <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Correcciones, revisión de score..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-50 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Coaching Tags */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Etiquetas de coaching</label>
            <div className="flex flex-wrap gap-1.5">
              {COACHING_TAG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEditTags(prev =>
                    prev.includes(opt.value) ? prev.filter(t => t !== opt.value) : [...prev, opt.value]
                  )}
                  className={`px-2 py-1 text-[11px] rounded-lg border transition-colors ${
                    editTags.includes(opt.value)
                      ? 'bg-indigo-600/20 border-indigo-500/30 text-indigo-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Training Recommendations */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Recomendaciones de entrenamiento (una por línea)</label>
            <textarea
              value={editRecommendations}
              onChange={(e) => setEditRecommendations(e.target.value)}
              rows={2}
              placeholder="Ej: Revisar protocolo de saludo..."
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-50 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Save / Cancel */}
          <div className="flex gap-2">
            <button
              onClick={handleCancelEdit}
              className="flex-1 py-2 text-sm text-zinc-400 hover:text-zinc-50 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={editSaving || !editReason.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-zinc-50 text-sm font-medium rounded-xl transition-colors"
            >
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar edición
            </button>
          </div>
        </div>
      )}
    </div>
  );
}















/**
 * QAReviewPanel - Premium Zinc Refactor
 * High-fidelity QA evaluation form with dynamic scoring and audit trails.
 */

// import { useState, useEffect } from 'react';
// import {
//   ClipboardCheck, CheckCircle2, XCircle, Minus, HelpCircle,
//   Save, AlertTriangle, MessageSquare, Star, Loader2, Eye,
//   Check, FileText, Pencil, History, ShieldAlert, Tag, BookOpen, 
//   ChevronDown, ChevronRight, X, AlertOctagon, Trophy
// } from 'lucide-react';
// import { useAuthStore } from '../stores/authStore';
// import * as qaService from '../services/qa.service';
// import type { QACheckItem, QACheckResult, QAReview, QASettings, CoachingTag } from '../services/qa.service';

// // ============= UTILS & CONFIG =============

// function resultToScore(r: QACheckResult): number {
//   if (r === 'yes') return 100;
//   if (r === 'partial') return 50;
//   return 0; 
// }

// function calcWeightedScore(checks: { weight: number; result: QACheckResult }[]): number {
//   let totalW = 0;
//   let sum = 0;
//   for (const c of checks) {
//     if (c.result === 'na') continue;
//     totalW += c.weight;
//     sum += (resultToScore(c.result) / 100) * c.weight;
//   }
//   return totalW === 0 ? 0 : Math.round((sum / totalW) * 100);
// }

// function getScoreConfig(s: number) {
//   if (s >= 90) return { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Trophy };
//   if (s >= 70) return { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: CheckCircle2 };
//   if (s >= 50) return { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle };
//   return { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertOctagon };
// }

// const CATEGORY_LABELS: Record<string, string> = {
//   greeting: '👋 Saludo y Apertura',
//   resolution: '✅ Resolución',
//   tone: '💬 Tono y Etiqueta',
//   procedure: '📋 Procedimientos',
//   closing: '🏁 Cierre',
//   general: '🌐 General',
// };

// const COACHING_TAG_OPTIONS: { value: CoachingTag; label: string }[] = [
//   { value: 'tone_issue', label: 'Tono Inadecuado' },
//   { value: 'slow_response', label: 'Lentitud' },
//   { value: 'wrong_category', label: 'Error de Categoría' },
//   { value: 'policy_violation', label: 'Violación de Política' },
//   { value: 'other', label: 'Otro' },
// ];

// // ============= SUB-COMPONENT: RESULT BUTTON =============

// function ResultButton({ result, current, onClick, disabled }: { result: QACheckResult; current: QACheckResult; onClick: () => void; disabled?: boolean }) {
//   const config = {
//     yes: { icon: CheckCircle2, label: 'Sí', active: 'bg-emerald-600 text-zinc-50 border-emerald-500 shadow-emerald-900/20', hover: 'hover:bg-emerald-500/10 hover:text-emerald-400' },
//     partial: { icon: Minus, label: 'Parcial', active: 'bg-amber-600 text-zinc-50 border-amber-500 shadow-amber-900/20', hover: 'hover:bg-amber-500/10 hover:text-amber-400' },
//     no: { icon: XCircle, label: 'No', active: 'bg-red-600 text-zinc-50 border-red-500 shadow-red-900/20', hover: 'hover:bg-red-500/10 hover:text-red-400' },
//     na: { icon: HelpCircle, label: 'N/A', active: 'bg-zinc-600 text-zinc-50 border-zinc-500 shadow-zinc-900/20', hover: 'hover:bg-zinc-800 hover:text-zinc-300' },
//   }[result];

//   const Icon = config.icon;
//   const isActive = current === result;

//   return (
//     <button
//       onClick={onClick}
//       disabled={disabled}
//       className={`
//         flex items-center justify-center p-1.5 rounded-lg border transition-all duration-200
//         ${isActive ? `${config.active} shadow-md scale-105` : `bg-transparent border-transparent text-zinc-600 ${!disabled && config.hover}`}
//         ${disabled && !isActive ? 'opacity-20 cursor-not-allowed' : ''}
//       `}
//       title={config.label}
//     >
//       <Icon className="w-4 h-4" />
//     </button>
//   );
// }

// // ============= MAIN COMPONENT =============

// interface CheckState {
//   checkItemId: string;
//   checkName: string;
//   checkCategory: string;
//   weight: number;
//   result: QACheckResult;
//   note: string;
// }

// export default function QAReviewPanel({ sessionId, agentId, compact = false, onReviewSaved }: any) {
//   const [checklist, setChecklist] = useState<QACheckItem[]>([]);
//   const [settings, setSettings] = useState<QASettings | null>(null);
//   const [checks, setChecks] = useState<CheckState[]>([]);
//   const [comment, setComment] = useState('');
//   const [existingReview, setExistingReview] = useState<QAReview | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [saving, setSaving] = useState(false);
//   const [showNoteFor, setShowNoteFor] = useState<string | null>(null);
//   const [viewMode, setViewMode] = useState(false);

//   // Edit Mode (Admin/Supervisor)
//   const agent = useAuthStore((s) => s.agent);
//   const canEdit = agent && ['admin', 'supervisor'].includes(agent.role || '');
//   const [editMode, setEditMode] = useState(false);
//   const [editReason, setEditReason] = useState('');
//   const [editSaving, setEditSaving] = useState(false);
//   const [editTags, setEditTags] = useState<CoachingTag[]>([]);
//   const [editRecommendations, setEditRecommendations] = useState('');
//   const [showAuditLog, setShowAuditLog] = useState(false);

//   const totalScore = calcWeightedScore(checks);
//   const needsComment = settings ? totalScore < settings.lowScoreThreshold : totalScore < 70;
//   const scoreConfig = getScoreConfig(totalScore);
//   const ScoreIcon = scoreConfig.icon;

//   // --- Load Logic ---
//   useEffect(() => {
//     const load = async () => {
//       setLoading(true);
//       try {
//         const [items, qaSettings, existing] = await Promise.all([
//           qaService.getChecklist(),
//           qaService.getQASettings().catch(() => null),
//           qaService.getReviewBySession(sessionId),
//         ]);
//         setChecklist(items || []); setSettings(qaSettings);

//         if (existing && existing.checks) {
//           setExistingReview(existing); setViewMode(true);
//           setChecks(existing.checks.map((c: any) => ({ ...c, note: c.note || '' })));
//           setComment(existing.comment || '');
//           setEditTags(existing.coachingTags || []);
//           setEditRecommendations((existing.trainingRecommendations || []).join('\n'));
//         } else {
//           setChecks((items || []).map((item) => ({
//             checkItemId: item._id, checkName: item.name, checkCategory: item.category,
//             weight: item.weight, result: 'na', note: '',
//           })));
//         }
//       } catch (err) { console.error(err); } 
//       finally { setLoading(false); }
//     };
//     load();
//   }, [sessionId]);

//   // --- Handlers ---
//   const setResult = (idx: number, result: QACheckResult) => {
//     if (viewMode && !editMode) return;
//     setChecks(prev => prev.map((c, i) => (i === idx ? { ...c, result } : c)));
//   };

//   const setNote = (idx: number, note: string) => {
//     if (viewMode && !editMode) return;
//     setChecks(prev => prev.map((c, i) => (i === idx ? { ...c, note } : c)));
//   };

//   const handleEnterEditMode = () => {
//     setEditMode(true); setEditReason('');
//   };

//   const handleCancelEdit = () => {
//     setEditMode(false); setEditReason('');
//     // Revert state
//     if (existingReview) {
//       setChecks(existingReview.checks.map((c: any) => ({ ...c, note: c.note || '' })));
//       setComment(existingReview.comment || '');
//       setEditTags(existingReview.coachingTags || []);
//       setEditRecommendations((existingReview.trainingRecommendations || []).join('\n'));
//     }
//   };

//   const handleSaveEdit = async () => {
//     if (!existingReview || !editReason.trim()) return;
//     setEditSaving(true);
//     try {
//       const recs = editRecommendations.split('\n').map(r => r.trim()).filter(Boolean);
//       const updated = await qaService.editReviewWithAudit(existingReview._id, {
//         editReason,
//         checks: checks.map(c => ({
//           checkItemId: c.checkItemId, checkName: c.checkName, checkCategory: c.checkCategory,
//           weight: c.weight, result: c.result, note: c.note || undefined,
//         })),
//         comment, coachingTags: editTags, trainingRecommendations: recs,
//       });
//       if (updated) {
//         setExistingReview(updated); setEditMode(false); onReviewSaved?.(updated);
//       }
//     } catch (err) { alert('Error al editar evaluación'); } 
//     finally { setEditSaving(false); }
//   };

//   const handleSubmit = async () => {
//     if (needsComment && !comment.trim()) return alert('Comentario obligatorio para score bajo.');
//     setSaving(true);
//     try {
//       const review = await qaService.submitReview({
//         sessionId, agentId,
//         checks: checks.map(c => ({ 
//           checkItemId: c.checkItemId, checkName: c.checkName, checkCategory: c.checkCategory,
//           weight: c.weight, result: c.result, note: c.note || undefined 
//         })),
//         comment, status: 'completed'
//       });
//       setExistingReview(review); setViewMode(true); onReviewSaved?.(review);
//     } catch (err) { alert('Error al guardar'); } 
//     finally { setSaving(false); }
//   };

//   if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;
//   if (checklist.length === 0 && !existingReview) return <div className="text-center py-8 text-zinc-500 text-sm">Checklist QA no configurado.</div>;

//   const grouped = checks.reduce<Record<string, CheckState[]>>((acc, c) => {
//     const cat = c.checkCategory || 'general';
//     if (!acc[cat]) acc[cat] = [];
//     acc[cat].push(c);
//     return acc;
//   }, {});

//   return (
//     <div className={`space-y-6 animate-in fade-in duration-300 ${compact ? 'px-2' : ''}`}>
      
//       {/* === SCORE HEADER === */}
//       <div className={`relative overflow-hidden flex items-center justify-between p-5 rounded-2xl border bg-zinc-950 ${scoreConfig.border}`}>
//         {/* Background Glow */}
//         <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-3xl opacity-20 ${scoreConfig.bg.replace('/10', '')}`} />
        
//         <div className="flex items-center gap-4 relative z-10">
//           <div className={`w-16 h-16 rounded-xl flex items-center justify-center border shadow-xl bg-zinc-900 ${scoreConfig.border} ${scoreConfig.color}`}>
//             <span className="text-3xl font-black">{totalScore}</span>
//           </div>
//           <div>
//             <h3 className={`text-sm font-bold uppercase  mb-1 ${scoreConfig.color} flex items-center gap-2`}>
//               <ScoreIcon className="w-4 h-4" /> Calificación Final
//             </h3>
//             <p className="text-zinc-500 text-xs">Puntaje máximo posible: 100</p>
//           </div>
//         </div>

//         {viewMode && (
//           <div className="flex flex-col items-end gap-1.5 relative z-10">
//             <span className={`px-3 py-1 rounded-full border text-[10px] font-bold uppercase  flex items-center gap-1.5 ${editMode ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
//               {editMode ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
//               {editMode ? 'Modo Edición' : 'Solo Lectura'}
//             </span>
//             {existingReview?.status === 'completed' && !editMode && (
//               <span className="text-[10px] text-emerald-500 flex items-center gap-1">
//                 <Check className="w-3 h-3" /> Completado
//               </span>
//             )}
//           </div>
//         )}
//       </div>

//       {/* === CHECKLIST CATEGORIES === */}
//       <div className="space-y-8">
//         {Object.entries(grouped).map(([cat, catChecks]) => (
//           <div key={cat} className="space-y-3">
//             <h4 className="text-xs font-bold text-zinc-500 uppercase  flex items-center gap-2 px-1">
//               {CATEGORY_LABELS[cat] || cat}
//               <div className="h-px bg-zinc-800 flex-1" />
//             </h4>
            
//             <div className="space-y-2">
//               {catChecks.map((check) => {
//                 const globalIdx = checks.findIndex(c => c.checkItemId === check.checkItemId);
//                 return (
//                   <div key={check.checkItemId} className="group relative bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-zinc-700 transition-all">
                    
//                     <div className="flex items-start justify-between gap-4">
//                       <div className="flex-1 min-w-0">
//                         <div className="flex items-center gap-2 mb-1">
//                           <span className="text-xs font-bold text-zinc-600 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800/50">
//                             {check.weight}%
//                           </span>
//                           <p className="text-sm font-medium text-zinc-200 leading-snug">{check.checkName}</p>
//                         </div>
//                       </div>
                      
//                       {/* Interaction Buttons */}
//                       <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-lg border border-zinc-800 shrink-0">
//                         {(['yes', 'partial', 'no', 'na'] as const).map(r => (
//                           <ResultButton 
//                             key={r} 
//                             result={r} 
//                             current={check.result} 
//                             onClick={() => setResult(globalIdx, r)} 
//                             disabled={viewMode && !editMode}
//                           />
//                         ))}
//                       </div>
//                     </div>

//                     {/* Conditional Note Area */}
//                     {(!viewMode || editMode || check.note) && (
//                       <div className="mt-2 pl-9">
//                         {(showNoteFor === check.checkItemId || check.note) ? (
//                           <div className="relative group/input">
//                             <input
//                               type="text"
//                               value={check.note}
//                               onChange={e => setNote(globalIdx, e.target.value)}
//                               readOnly={viewMode && !editMode}
//                               placeholder="Añadir observación..."
//                               className="w-full bg-zinc-950/50 border border-zinc-800/50 rounded-lg py-1.5 pl-3 pr-8 text-xs text-zinc-300 placeholder-zinc-700 focus:border-indigo-500/50 focus:bg-zinc-950 focus:outline-none transition-all"
//                             />
//                             {(!viewMode || editMode) && !check.note && (
//                               <button onClick={() => setShowNoteFor(null)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400">
//                                 <X className="w-3 h-3" />
//                               </button>
//                             )}
//                           </div>
//                         ) : (
//                           <button
//                             onClick={() => setShowNoteFor(check.checkItemId)}
//                             className="text-[10px] font-medium text-zinc-600 hover:text-indigo-400 transition-colors flex items-center gap-1"
//                           >
//                             <FileText className="w-3 h-3" /> Añadir nota
//                           </button>
//                         )}
//                       </div>
//                     )}
//                   </div>
//                 );
//               })}
//             </div>
//           </div>
//         ))}
//       </div>

//       {/* === GENERAL FEEDBACK === */}
//       <div className="pt-4 border-t border-zinc-800">
//         <label className="flex items-center gap-2 text-xs font-bold text-zinc-500 uppercase  mb-2">
//           <MessageSquare className="w-3.5 h-3.5" /> 
//           Feedback General {needsComment && (!viewMode || editMode) && <span className="text-red-500">*</span>}
//         </label>
//         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 focus-within:ring-1 focus-within:ring-indigo-500/50 focus-within:border-indigo-500/50 transition-all">
//           <textarea
//             value={comment}
//             onChange={e => setComment(e.target.value)}
//             readOnly={viewMode && !editMode}
//             rows={3}
//             placeholder={needsComment ? 'Justifica la calificación baja aquí...' : 'Comentarios generales opcionales...'}
//             className="w-full bg-transparent border-none text-sm text-zinc-200 placeholder-zinc-700 p-2 focus:ring-0 resize-none"
//           />
//         </div>
//         {needsComment && (!viewMode || editMode) && (
//           <div className="flex items-center gap-2 mt-2 text-xs text-amber-500/80">
//             <AlertTriangle className="w-3.5 h-3.5" />
//             <span>Calificación crítica: Comentario obligatorio.</span>
//           </div>
//         )}
//       </div>

//       {/* === INITIAL SUBMIT ACTION === */}
//       {!viewMode && (
//         <div className="pt-4 sticky bottom-0 bg-gradient-to-t from-zinc-950 via-zinc-950 to-transparent pb-4 -mx-4 px-4 border-t border-zinc-800">
//           <button
//             onClick={handleSubmit}
//             disabled={saving}
//             className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed"
//           >
//             {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
//             {saving ? 'Guardando Evaluación...' : 'Finalizar Evaluación'}
//           </button>
//         </div>
//       )}

//       {/* === ADMIN EDIT SUITE === */}
//       {viewMode && canEdit && existingReview && !editMode && (
//         <div className="pt-4 border-t border-zinc-800 space-y-3">
//           <button
//             onClick={handleEnterEditMode}
//             className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium text-sm rounded-xl border border-zinc-800 transition-colors"
//           >
//             <Pencil className="w-3.5 h-3.5" /> Editar Evaluación
//           </button>

//           {/* Audit Log Toggle */}
//           {existingReview.editHistory && existingReview.editHistory.length > 0 && (
//             <div>
//               <button
//                 onClick={() => setShowAuditLog(!showAuditLog)}
//                 className="flex items-center gap-2 text-xs font-bold text-zinc-600 hover:text-zinc-400 transition-colors uppercase "
//               >
//                 {showAuditLog ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
//                 <History className="w-3 h-3" /> Historial de Cambios ({existingReview.editHistory.length})
//               </button>
              
//               {showAuditLog && (
//                 <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
//                   {existingReview.editHistory.map((log, i) => (
//                     <div key={i} className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs">
//                       <div className="flex justify-between items-center mb-1">
//                         <span className="font-bold text-zinc-300">{(typeof log.editedBy === 'object' ? log.editedBy.name : 'Admin')}</span>
//                         <span className="text-zinc-600 font-mono">{new Date(log.editedAt).toLocaleDateString()}</span>
//                       </div>
//                       <p className="text-zinc-400 italic">"{log.editReason}"</p>
//                       {log.previousScore !== log.newScore && (
//                         <div className="mt-1.5 flex items-center gap-2 bg-zinc-950 px-2 py-1 rounded w-fit">
//                           <span className="text-zinc-500">Score:</span>
//                           <span className="text-red-400 line-through decoration-red-400/50">{log.previousScore}</span>
//                           <span className="text-zinc-600">→</span>
//                           <span className="text-emerald-400 font-bold">{log.newScore}</span>
//                         </div>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               )}
//             </div>
//           )}

//           {/* Read-Only Details */}
//           {existingReview.coachingTags?.length > 0 && (
//             <div className="flex flex-wrap gap-2 pt-2">
//               {existingReview.coachingTags.map(tag => (
//                 <span key={tag} className="px-2 py-1 text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 rounded-md">
//                   {COACHING_TAG_OPTIONS.find(t => t.value === tag)?.label || tag}
//                 </span>
//               ))}
//             </div>
//           )}
//         </div>
//       )}

//       {/* === EDIT MODE PANEL === */}
//       {viewMode && editMode && existingReview && (
//         <div className="mt-4 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl space-y-4 animate-in fade-in slide-in-from-bottom-4">
//           <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase  mb-2">
//             <ShieldAlert className="w-4 h-4" /> Panel de Edición
//           </div>

//           <div>
//             <label className="text-xs text-zinc-400 mb-1 block">Razón del cambio <span className="text-red-500">*</span></label>
//             <input
//               type="text"
//               value={editReason}
//               onChange={e => setEditReason(e.target.value)}
//               placeholder="Ej: Recalificación por error en criterio..."
//               className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none"
//             />
//           </div>

//           <div>
//             <label className="text-xs text-zinc-400 mb-1.5 block">Etiquetas de Coaching</label>
//             <div className="flex flex-wrap gap-1.5">
//               {COACHING_TAG_OPTIONS.map(opt => (
//                 <button
//                   key={opt.value}
//                   onClick={() => setEditTags(p => p.includes(opt.value) ? p.filter(t => t !== opt.value) : [...p, opt.value])}
//                   className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${
//                     editTags.includes(opt.value) 
//                       ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
//                       : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
//                   }`}
//                 >
//                   {opt.label}
//                 </button>
//               ))}
//             </div>
//           </div>

//           <div>
//             <label className="text-xs text-zinc-400 mb-1 block">Recomendaciones (1 por línea)</label>
//             <textarea
//               value={editRecommendations}
//               onChange={e => setEditRecommendations(e.target.value)}
//               rows={3}
//               className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-200 focus:border-indigo-500 focus:outline-none resize-none"
//             />
//           </div>

//           <div className="flex gap-3 pt-2">
//             <button
//               onClick={handleCancelEdit}
//               className="flex-1 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-50 bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors"
//             >
//               Cancelar
//             </button>
//             <button
//               onClick={handleSaveEdit}
//               disabled={editSaving || !editReason.trim()}
//               className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 text-xs font-bold rounded-lg transition-all disabled:opacity-50"
//             >
//               {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
//               Guardar Cambios
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// ─── Playbook Compliance Card (for QA) ──────────────────────

function PlaybookComplianceCard({ data }: { data: PlaybookQAData }) {
  const isGood = data.wasCompleted && data.completionPercent >= 80;
  const isWarning = data.wasAbandoned || (data.isMandatory && !data.wasCompleted);
  const isBad = data.isMandatory && data.wasAbandoned;

  const borderColor = isBad ? 'border-red-500/30' : isWarning ? 'border-amber-500/30' : isGood ? 'border-emerald-500/30' : 'border-zinc-800';
  const bgColor = isBad ? 'bg-red-500/5' : isWarning ? 'bg-amber-500/5' : isGood ? 'bg-emerald-500/5' : 'bg-zinc-900/50';

  return (
    <div className={`p-3 rounded-xl border ${borderColor} ${bgColor} space-y-2`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className={`w-4 h-4 ${isBad ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}`} />
          <span className="text-xs font-bold text-zinc-200">{data.playbookName}</span>
        </div>
        {data.isMandatory && (
          <span className="text-[10px] font-bold text-red-400 px-1.5 py-0.5 bg-red-500/10 rounded border border-red-500/20">Obligatorio</span>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {data.wasCompleted ? (
          <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Completado
          </span>
        ) : data.wasAbandoned ? (
          <span className="text-[10px] font-medium text-red-400 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Abandonado
          </span>
        ) : (
          <span className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Incompleto
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-zinc-900/50 rounded-lg p-1.5">
          <p className="text-[10px] text-zinc-500">Pasos</p>
          <p className="text-xs font-bold text-zinc-200">{data.completedSteps}/{data.totalSteps}</p>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-1.5">
          <p className="text-[10px] text-zinc-500">Saltados</p>
          <p className="text-xs font-bold text-zinc-200">{data.skippedSteps}</p>
        </div>
        <div className="bg-zinc-900/50 rounded-lg p-1.5">
          <p className="text-[10px] text-zinc-500">Críticos</p>
          <p className="text-xs font-bold text-zinc-200">{data.criticalCompleted}/{data.criticalTotal}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-zinc-500">Cumplimiento</span>
          <span className={`text-[10px] font-bold ${data.completionPercent >= 80 ? 'text-emerald-400' : data.completionPercent >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
            {data.completionPercent}%
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${data.completionPercent >= 80 ? 'bg-emerald-500' : data.completionPercent >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${data.completionPercent}%` }}
          />
        </div>
      </div>

      {/* Warning message for mandatory + incomplete */}
      {data.isMandatory && !data.wasCompleted && (
        <div className="flex items-start gap-1.5 pt-1">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-red-300">
            Este playbook era obligatorio y {data.wasAbandoned ? 'fue abandonado' : 'no se completó'}. Considerar en la evaluación.
          </p>
        </div>
      )}
    </div>
  );
}
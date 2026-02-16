/**
 * QACoachingModal - Premium Zinc Refactor
 * Blocking full-screen modal for high-fidelity QA acknowledgement.
 */

import { useState, useEffect, useCallback } from 'react';
import {
    Shield, Loader2, ChevronRight, ChevronDown,
    ThumbsUp, Tag, ClipboardList, CheckCircle2,
    XCircle, AlertTriangle, Minus, Trophy, TrendingUp, AlertOctagon
} from 'lucide-react';
import * as qaService from '../services/qa.service';
import type { QAReview, CoachingTag } from '../services/qa.service';

// ============= UTILS & CONFIG =============

function getScoreConfig(s: number) {
    if (s >= 90) return {
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        icon: Trophy,
        gradient: 'from-emerald-500/20 to-transparent',
        title: '¡Excelente Trabajo!',
        subtitle: 'Tu desempeño ha sido sobresaliente.'
    };
    if (s >= 70) return {
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: TrendingUp,
        gradient: 'from-blue-500/20 to-transparent',
        title: 'Buen Desempeño',
        subtitle: 'Cumples con los estándares, sigue mejorando.'
    };
    if (s >= 60) return {
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        icon: AlertTriangle,
        gradient: 'from-amber-500/20 to-transparent',
        title: 'Atención Requerida',
        subtitle: 'Hay áreas importantes que necesitan mejora.'
    };
    return {
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: AlertOctagon,
        gradient: 'from-red-500/20 to-transparent',
        title: 'Nivel Crítico',
        subtitle: 'Tu desempeño está por debajo del mínimo aceptable.'
    };
}

const COACHING_TAGS: Record<CoachingTag, { label: string; color: string }> = {
    tone_issue: { label: 'Tono Inadecuado', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    slow_response: { label: 'Lentitud', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    wrong_category: { label: 'Error de Categoría', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
    policy_violation: { label: 'Violación de Política', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    other: { label: 'Otro', color: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

// ============= SUB-COMPONENT: REVIEW CARD =============

function ReviewCard({ review, onAcknowledge, acknowledging }: { review: QAReview; onAcknowledge: (id: string, feedback: string) => void; acknowledging: boolean }) {
    const [expanded, setExpanded] = useState(true);
    const [feedback, setFeedback] = useState('');

    const score = review.totalScore;
    const config = getScoreConfig(score);
    const Icon = config.icon;
    const isCritical = score < 60;

    return (
        <div className="w-full max-w-2xl mx-auto bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

            {/* Header Banner */}
            <div className={`relative p-8 border-b border-zinc-800 bg-gradient-to-br ${config.gradient}`}>
                <div className="flex items-start gap-6 relative z-10">

                    {/* Score Badge */}
                    <div className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center shrink-0 bg-zinc-950 border ${config.border} shadow-xl`}>
                        <span className={`text-4xl font-black ${config.color}`}>{score}</span>
                        <span className="text-xs font-bold text-zinc-500 uppercase  mt-1">Score</span>
                    </div>

                    <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2 mb-1">
                            <Icon className={`w-5 h-5 ${config.color}`} />
                            <h2 className={`text-2xl font-bold text-zinc-50 tracking-tight`}>{config.title}</h2>
                        </div>
                        <p className="text-zinc-400 leading-relaxed mb-4">{config.subtitle}</p>

                        <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                            <span className="bg-zinc-900/50 px-2 py-1 rounded border border-zinc-800">
                                {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                            {typeof review.reviewedBy === 'object' && (
                                <span className="flex items-center gap-1.5">
                                    <Shield className="w-3 h-3" /> Evaluado por: <span className="text-zinc-300">{review.reviewedBy.name}</span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 bg-zinc-900/30">

                {/* Tags */}
                {review.coachingTags && review.coachingTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {review.coachingTags.map(tag => {
                            const info = COACHING_TAGS[tag] || COACHING_TAGS.other;
                            return (
                                <span key={tag} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${info.color}`}>
                                    <Tag className="w-3 h-3" /> {info.label}
                                </span>
                            );
                        })}
                    </div>
                )}

                {/* Breakdown Accordion */}
                <div className="border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden">
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-900 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                            <ClipboardList className="w-4 h-4 text-indigo-500" />
                            Desglose de Evaluación
                        </div>
                        {expanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                    </button>

                    {expanded && (
                        <div className="px-4 pb-4 space-y-1 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
                            {review.checks.map((check, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 rounded hover:bg-zinc-900/50 transition-colors group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="shrink-0">
                                            {check.result === 'yes' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                            {check.result === 'partial' && <Minus className="w-4 h-4 text-amber-500" />}
                                            {check.result === 'no' && <XCircle className="w-4 h-4 text-red-500" />}
                                            {check.result === 'na' && <span className="text-[10px] font-bold text-zinc-600 bg-zinc-900 px-1 rounded">N/A</span>}
                                        </div>
                                        <span className="text-xs text-zinc-300 truncate group-hover:text-zinc-50 transition-colors">{check.checkName}</span>
                                    </div>
                                    <span className={`text-xs font-mono font-bold ${check.result === 'yes' ? 'text-emerald-500' :
                                            check.result === 'no' ? 'text-red-500' :
                                                check.result === 'partial' ? 'text-amber-500' : 'text-zinc-600'
                                        }`}>
                                        {check.result === 'na' ? '-' : `${check.score}%`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Supervisor Comments */}
                {review.comment && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-zinc-500 uppercase ">Feedback del Supervisor</h4>
                        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-300 leading-relaxed">
                            {review.comment}
                        </div>
                    </div>
                )}

                {/* Critical Warning */}
                {isCritical && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                        <div>
                            <h4 className="text-sm font-bold text-red-400">Acción Requerida</h4>
                            <p className="text-xs text-red-400/80 mt-1">Este resultado requiere una sesión de coaching obligatoria con tu supervisor.</p>
                        </div>
                    </div>
                )}

                {/* Acknowledge Form */}
                <div className="pt-4 border-t border-zinc-800 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-zinc-400">Tu compromiso (Opcional)</label>
                        <textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            placeholder="Escribe aquí tus comentarios o plan de acción..."
                            className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none resize-none transition-all"
                            rows={2}
                        />
                    </div>

                    <button
                        onClick={() => onAcknowledge(review._id, feedback)}
                        disabled={acknowledging}
                        className={`
              w-full py-3.5 rounded-xl text-sm font-bold text-zinc-50 shadow-lg transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2
              ${isCritical
                                ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
                                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'
                            }
            `}
                    >
                        {acknowledging ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                        {isCritical ? 'Entendido, me comprometo a mejorar' : 'Confirmar lectura y continuar'}
                    </button>
                </div>

            </div>
        </div>
    );
}

// ============= MAIN COMPONENT: MODAL WRAPPER =============

interface QACoachingModalProps {
    agentId: string;
    onAllAcknowledged: () => void;
}

export default function QACoachingModal({ agentId, onAllAcknowledged }: QACoachingModalProps) {
    const [reviews, setReviews] = useState<QAReview[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [acknowledging, setAcknowledging] = useState(false);
    const load = async () => {
        try {
            const pending = await qaService.getMyPendingReviews();
            setReviews(pending);
            if (pending.length === 0) onAllAcknowledged();
        } catch (err) {
            console.error(err);
            onAllAcknowledged(); // Fail open so agent can work
        } finally { setLoading(false); }
    };

    useEffect(() => {
        load();
    }, []);

    // Block Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); }
        };
        window.addEventListener('keydown', handler, true);
        return () => window.removeEventListener('keydown', handler, true);
    }, []);

    const handleAcknowledge = async (reviewId: string, feedback: string) => {
        setAcknowledging(true);
        try {
            await qaService.acknowledgeReview(reviewId, feedback || undefined);
            const remaining = reviews.filter(r => r._id !== reviewId);
            setReviews(remaining);
            if (remaining.length === 0) onAllAcknowledged();
            else setCurrentIndex(Math.min(currentIndex, remaining.length - 1));
        } catch (err) { console.error(err); }
        finally { setAcknowledging(false); }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 z-[200] bg-zinc-950 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                <p className="text-zinc-500 text-sm font-medium animate-pulse">Sincronizando evaluaciones de calidad...</p>
            </div>
        );
    }

    if (reviews.length === 0) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4">

            {/* Multi-review Pagination Dots */}
            {reviews.length > 1 && (
                <div className="flex gap-2 mb-6">
                    {reviews.map((r, idx) => (
                        <button
                            key={r._id}
                            onClick={() => setCurrentIndex(idx)}
                            className={`w-2.5 h-2.5 rounded-full transition-all ${idx === currentIndex ? 'bg-indigo-500 scale-125' : 'bg-zinc-800 hover:bg-zinc-700'
                                }`}
                        />
                    ))}
                </div>
            )}

            <ReviewCard
                review={reviews[currentIndex]}
                onAcknowledge={handleAcknowledge}
                acknowledging={acknowledging}
            />

            <div className="mt-6 text-center">
                <p className="text-xs text-zinc-500 font-medium">
                    Tienes <span className="text-zinc-50">{reviews.length}</span> evaluación(es) pendiente(s) de revisión.
                </p>
                <p className="text-[10px] text-zinc-600 mt-1">Debes completar todas para acceder al sistema.</p>
            </div>
        </div>
    );
}
/**
 * TranslationReportModal — Modal shown when agent clicks "Reportar traducción"
 * Agent selects category, writes reason, and submits.
 */

import { useState, useCallback } from 'react';
import { X, AlertTriangle, Send, Loader2, Flag } from 'lucide-react';
import { submitTranslationReport, type ReportCategory } from '../../services/translation.service';
import { toast } from '../../stores/toastStore';
import type { Message, ChatSession } from '../../types';

interface TranslationReportModalProps {
  isOpen: boolean;
  message: Message;
  session: ChatSession;
  onClose: () => void;
}

const CATEGORIES: { value: ReportCategory; label: string; emoji: string; description: string }[] = [
  { value: 'wrong_translation', label: 'Traducción incorrecta', emoji: '❌', description: 'El significado de la traducción es incorrecto' },
  { value: 'wrong_language', label: 'Idioma incorrecto', emoji: '🌐', description: 'Se detectó o tradujo al idioma equivocado' },
  { value: 'incomplete', label: 'Incompleta', emoji: '✂️', description: 'La traducción está cortada o le falta contenido' },
  { value: 'offensive', label: 'Ofensiva / Inapropiada', emoji: '⚠️', description: 'Contiene contenido ofensivo o inapropiado' },
  { value: 'improvement', label: 'Sugerencia de mejora', emoji: '💡', description: 'La traducción podría ser mejor' },
  { value: 'bug', label: 'Bug técnico', emoji: '🐛', description: 'Error de sistema, no se tradujo, o se rompió el formato' },
  { value: 'other', label: 'Otro', emoji: '📝', description: 'Otro motivo no listado' },
];

export default function TranslationReportModal({ isOpen, message, session, onClose }: TranslationReportModalProps) {
  const [category, setCategory] = useState<ReportCategory | null>(null);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  const translationData = message.incomingTranslation || (message.translation?.isTranslated ? {
    translatedContent: message.content,
    sourceLang: message.translation.sourceLang,
    targetLang: message.translation.targetLang,
    provider: message.translation.provider,
    latencyMs: message.translation.latencyMs,
  } : null);

  const handleSubmit = useCallback(async () => {
    if (!category || !reason.trim() || !translationData) return;

    setSending(true);
    try {
      await submitTranslationReport({
        messageId: message._id,
        sessionId: session.sessionId,
        category,
        reason: reason.trim(),
        originalContent: message.content,
        translatedContent: (translationData as any).translatedContent || '',
        sourceLang: translationData.sourceLang || 'auto',
        targetLang: translationData.targetLang || '',
        provider: translationData.provider || 'unknown',
        direction: message.incomingTranslation ? 'incoming' : 'outgoing',
        latencyMs: translationData.latencyMs,
      });
      toast.success('Reporte enviado', 'Gracias por tu feedback. Un supervisor revisará el reporte.');
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err.message || 'Error al enviar reporte';
      toast.error('Error', errMsg);
    } finally {
      setSending(false);
    }
  }, [category, reason, translationData, message, session.sessionId, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20">
              <Flag className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">Reportar Traducción</h2>
              <p className="text-xs text-zinc-500">Ayúdanos a mejorar la calidad de las traducciones</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Translation Preview */}
        <div className="px-6 py-3 border-b border-zinc-800/50">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold text-zinc-500 uppercase ">Original</span>
              <p className="text-xs text-zinc-300 mt-1 line-clamp-3 leading-relaxed">{message.content}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-cyan-500 uppercase ">Traducción</span>
              <p className="text-xs text-cyan-300 mt-1 line-clamp-3 leading-relaxed">
                {(translationData as any)?.translatedContent || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-600">
            <span>{translationData?.sourceLang} → {translationData?.targetLang}</span>
            <span>•</span>
            <span>{translationData?.provider}</span>
            {translationData?.latencyMs && <><span>•</span><span>{translationData.latencyMs}ms</span></>}
          </div>
        </div>

        {/* Category Selection */}
        <div className="px-6 py-4">
          <label className="text-xs font-bold text-zinc-400 uppercase  mb-3 block">Categoría del reporte</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`text-left px-3 py-2.5 rounded-xl border transition-all ${
                  category === cat.value
                    ? 'border-indigo-500/50 bg-indigo-500/10 text-zinc-100'
                    : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{cat.emoji}</span>
                  <span className="text-xs font-medium">{cat.label}</span>
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5 ml-6">{cat.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div className="px-6 pb-4">
          <label className="text-xs font-bold text-zinc-400 uppercase  mb-2 block">Motivo del reporte</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Describe el problema con la traducción..."
            rows={3}
            maxLength={2000}
            className="w-full bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none transition-all"
          />
          <div className="flex justify-end mt-1">
            <span className="text-[10px] text-zinc-600">{reason.length}/2000</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 rounded-b-2xl">
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <AlertTriangle className="w-3 h-3" />
            <span>Los reportes son revisados por supervisores</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={!category || !reason.trim() || sending}
              className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar Reporte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

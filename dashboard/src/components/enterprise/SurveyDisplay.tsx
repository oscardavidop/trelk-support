import React from 'react';
import { Star, MessageSquare, Quote, Calendar, User, AlertCircle } from 'lucide-react';
import type { Survey } from '../../types';

interface SurveyDisplayProps {
  survey?: Survey | null;
  compact?: boolean;
}

export const SurveyDisplay: React.FC<SurveyDisplayProps> = ({ survey, compact = false }) => {
  
  // Configuración visual basada en el rating (Sentimiento Refinado)
  const getSentimentConfig = (rating: number) => {
    if (rating >= 4) return {
      color: 'text-emerald-400',
      fill: 'fill-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      label: 'Positiva',
      gradient: 'from-emerald-500/20 to-transparent'
    };
    if (rating === 3) return {
      color: 'text-amber-400',
      fill: 'fill-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      label: 'Neutral',
      gradient: 'from-amber-500/20 to-transparent'
    };
    return {
      color: 'text-rose-400',
      fill: 'fill-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      label: 'Negativa',
      gradient: 'from-rose-500/20 to-transparent'
    };
  };

  // --- ESTADO VACÍO ---
  if (!survey) {
    return compact ? (
      <span className="text-xs text-zinc-600">-</span>
    ) : (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/30 text-zinc-500">
        <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
        <span className="text-sm font-medium">El usuario no dejó encuesta</span>
      </div>
    );
  }

  const sentiment = getSentimentConfig(survey.rating);

  // Componente de Estrellas
  const StarRating = ({ size = "md" }: { size?: "sm" | "md" }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`
            ${size === "sm" ? "w-3 h-3" : "w-5 h-5"} 
            ${star <= survey.rating ? sentiment.color + " " + sentiment.fill : "text-zinc-700"}
            transition-all duration-300
          `}
        />
      ))}
    </div>
  );

  // --- MODO COMPACTO (Tablas) ---
  if (compact) {
    return (
      <div className="flex items-center gap-2 group cursor-help" title={survey.comment || 'Sin comentarios'}>
        <StarRating size="sm" />
        <span className={`text-xs font-bold font-mono ${sentiment.color}`}>{survey.rating}.0</span>
        {survey.comment && <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-zinc-400 transition-colors" />}
      </div>
    );
  }

  // --- MODO COMPLETO (Detalles) ---
  return (
    <div className={`
      relative overflow-hidden rounded-2xl border p-6 transition-all shadow-sm
      bg-zinc-900 ${sentiment.border}
    `}>
      
      {/* Background Gradient Glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${sentiment.gradient} opacity-20 blur-2xl pointer-events-none`} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h4 className="text-sm font-bold text-white tracking-tight">
              Resultados de Encuesta
            </h4>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercaseborder ${sentiment.bg} ${sentiment.color} ${sentiment.border}`}>
              {sentiment.label}
            </span>
          </div>
          <p className="text-xs text-zinc-400">Feedback enviado por el cliente</p>
        </div>
        
        <div className="flex flex-col items-end">
          <StarRating />
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-2xl font-bold leading-none ${sentiment.color}`}>
              {survey.rating}
            </span>
            <span className="text-xs text-zinc-600 font-medium">/ 5</span>
          </div>
        </div>
      </div>

      {/* Comment Section */}
      <div className="mb-6">
        {survey.comment ? (
          <div className="relative p-4 bg-black/20 rounded-xl border border-zinc-800/50">
            <Quote className="absolute top-3 left-3 w-4 h-4 text-zinc-600 opacity-50" />
            <p className="text-sm text-zinc-300 italic pl-6 leading-relaxed relative z-10">
              "{survey.comment}"
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-zinc-500 italic px-2 py-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 border-dashed justify-center">
            <AlertCircle className="w-3.5 h-3.5" /> Sin comentarios adicionales
          </div>
        )}
      </div>

      {/* Footer Metadata */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80 text-xs">
        <div className="flex items-center gap-2 text-zinc-500">
          <Calendar className="w-3.5 h-3.5" />
          <span className="font-mono">{new Date(survey.submittedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
        
        {survey.agent && (
          <div className="flex items-center gap-2 pl-3 py-1 border-l border-zinc-800">
            <div className="p-1 bg-zinc-800 rounded text-zinc-400">
                <User className="w-3 h-3" />
            </div>
            <span className="font-medium text-zinc-300 truncate max-w-[120px]">{survey.agent.name}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyDisplay;
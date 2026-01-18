import React from 'react';
import { Star, MessageSquare, Quote, Calendar, User, AlertCircle } from 'lucide-react';
import type { Survey } from '../../types';

interface SurveyDisplayProps {
  survey?: Survey | null;
  compact?: boolean;
}

export const SurveyDisplay: React.FC<SurveyDisplayProps> = ({ survey, compact = false }) => {
  // Configuración visual basada en el rating (Sentimiento)
  const getSentimentConfig = (rating: number) => {
    if (rating >= 4) return {
      color: 'text-emerald-500',
      fill: 'fill-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/10',
      border: 'border-emerald-100 dark:border-emerald-900/30',
      label: 'Experiencia Positiva'
    };
    if (rating === 3) return {
      color: 'text-amber-500',
      fill: 'fill-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-900/10',
      border: 'border-amber-100 dark:border-amber-900/30',
      label: 'Experiencia Neutral'
    };
    return {
      color: 'text-rose-500',
      fill: 'fill-rose-500',
      bg: 'bg-rose-50 dark:bg-rose-900/10',
      border: 'border-rose-100 dark:border-rose-900/30',
      label: 'Experiencia Negativa'
    };
  };

  if (!survey) {
    return compact ? (
      <span className="text-xs text-gray-400">-</span>
    ) : (
      <div className="flex flex-col items-center justify-center p-6 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50/50 dark:bg-gray-800/30 text-gray-400">
        <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
        <span className="text-sm italic">El usuario no dejó encuesta</span>
      </div>
    );
  }

  const sentiment = getSentimentConfig(survey.rating);

  // Renderizado de estrellas reutilizable
  const StarRating = ({ size = "md" }: { size?: "sm" | "md" }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`
            ${size === "sm" ? "w-3 h-3" : "w-5 h-5"} 
            ${star <= survey.rating ? sentiment.color + " " + sentiment.fill : "text-gray-200 dark:text-gray-700"}
          `}
        />
      ))}
    </div>
  );

  // --- MODO COMPACTO (Para tablas o listas) ---
  if (compact) {
    return (
      <div className="flex items-center gap-2" title={`Comentario: ${survey.comment || 'Ninguno'}`}>
        <StarRating size="sm" />
        <span className={`text-xs font-bold ${sentiment.color}`}>{survey.rating}.0</span>
      </div>
    );
  }

  // --- MODO COMPLETO (Para detalles de chat) ---
  return (
    <div className={`
      relative overflow-hidden rounded-xl border p-5 transition-all
      bg-white dark:bg-[#1a1d26] ${sentiment.border}
    `}>
      {/* Background decoration */}
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-10 ${sentiment.bg.replace('/10', '')}`} />

      {/* Header */}
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            Resultados de Encuesta
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${sentiment.bg} ${sentiment.color}`}>
              {sentiment.label}
            </span>
          </h4>
          <p className="text-xs text-gray-500 mt-1">Feedback del cliente</p>
        </div>
        
        <div className="flex flex-col items-end">
          <StarRating />
          <span className={`text-2xl font-bold leading-none mt-1 ${sentiment.color}`}>
            {survey.rating}<span className="text-sm text-gray-300 font-normal">/5</span>
          </span>
        </div>
      </div>

      {/* Comment Section */}
      {survey.comment ? (
        <div className="relative p-4 bg-gray-50 dark:bg-black/20 rounded-lg border border-gray-100 dark:border-gray-800">
          <Quote className="absolute top-3 left-3 w-4 h-4 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-700 dark:text-gray-300 italic pl-6 leading-relaxed relative z-10">
            "{survey.comment}"
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-gray-400 italic p-2">
          <AlertCircle className="w-3.5 h-3.5" /> Sin comentarios adicionales
        </div>
      )}

      {/* Footer Metadata */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" />
          <span>{new Date(survey.submittedAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        </div>
        
        {survey.agent && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-md">
            <User className="w-3 h-3" />
            <span className="font-medium truncate max-w-[150px]">{survey.agent.name}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurveyDisplay;
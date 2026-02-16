/**
 * SurveyDisplay - Premium Zinc Refactor
 * High-fidelity customer feedback presentation component.
 */

import React from 'react';
import { Star, MessageSquare, Quote, Calendar, User, AlertCircle, TrendingUp, Minus, TrendingDown } from 'lucide-react';
import type { Survey } from '../../types';

// ============= CONFIGURATION =============

interface SurveyDisplayProps {
  survey?: Survey | null;
  compact?: boolean;
}

const SENTIMENT_CONFIG = {
  positive: {
    color: 'text-emerald-400',
    fill: 'fill-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: TrendingUp,
    label: 'Positiva',
    gradient: 'from-emerald-500/10 to-transparent'
  },
  neutral: {
    color: 'text-amber-400',
    fill: 'fill-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: Minus,
    label: 'Neutral',
    gradient: 'from-amber-500/10 to-transparent'
  },
  negative: {
    color: 'text-rose-400',
    fill: 'fill-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    icon: TrendingDown,
    label: 'Negativa',
    gradient: 'from-rose-500/10 to-transparent'
  }
};

const getSentiment = (rating: number) => {
  if (rating >= 4) return SENTIMENT_CONFIG.positive;
  if (rating === 3) return SENTIMENT_CONFIG.neutral;
  return SENTIMENT_CONFIG.negative;
};

// ============= COMPONENT =============

export const SurveyDisplay: React.FC<SurveyDisplayProps> = ({ survey, compact = false }) => {
  
  // --- EMPTY STATE ---
  if (!survey) {
    if (compact) return <span className="text-xs font-mono text-zinc-600">-</span>;
    
    return (
      <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/30 text-zinc-500 animate-in fade-in zoom-in-95">
        <div className="p-3 bg-zinc-900 rounded-full mb-3 shadow-inner">
          <MessageSquare className="w-6 h-6 opacity-40" />
        </div>
        <span className="text-xs font-medium uppercase ">Sin Encuesta Registrada</span>
      </div>
    );
  }

  const sentiment = getSentiment(survey.rating);
  const SentimentIcon = sentiment.icon;

  // --- COMPACT MODE (Table Cell) ---
  if (compact) {
    return (
      <div className="flex items-center gap-2.5 group cursor-help transition-opacity hover:opacity-80" title={survey.comment || 'Sin comentarios'}>
        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${sentiment.bg} ${sentiment.border}`}>
          <Star className={`w-3 h-3 ${sentiment.color} ${sentiment.fill}`} />
          <span className={`text-xs font-bold font-mono ${sentiment.color}`}>{survey.rating.toFixed(1)}</span>
        </div>
        {survey.comment && (
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover:bg-zinc-500 transition-colors" />
        )}
      </div>
    );
  }

  // --- FULL MODE (Details Panel) ---
  return (
    <div className={`
      relative overflow-hidden rounded-2xl border bg-zinc-950 shadow-xl transition-all duration-300
      ${sentiment.border}
    `}>
      
      {/* Background Glow Effect */}
      <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl ${sentiment.gradient} opacity-30 blur-3xl pointer-events-none`} />

      {/* Header Section */}
      <div className="relative p-6 border-b border-zinc-800/50 flex justify-between items-start z-10">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase  border ${sentiment.bg} ${sentiment.color} ${sentiment.border}`}>
              <SentimentIcon className="w-3 h-3" />
              {sentiment.label}
            </span>
            <span className="text-xs text-zinc-500 font-medium">Encuesta de Satisfacción</span>
          </div>
          <h3 className="text-lg font-bold text-zinc-50 tracking-tight">Feedback del Cliente</h3>
        </div>

        {/* Big Rating Badge */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 ${star <= survey.rating ? `${sentiment.color} ${sentiment.fill}` : 'text-zinc-800'}`}
              />
            ))}
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`text-3xl font-black ${sentiment.color} tracking-tight`}>
              {survey.rating}
            </span>
            <span className="text-sm font-medium text-zinc-600">/ 5.0</span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 relative z-10">
        
        {/* Comment Box */}
        {survey.comment ? (
          <div className="relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800 group-hover:bg-zinc-700 transition-colors rounded-full" />
            <div className="pl-5 py-1">
              <Quote className="w-4 h-4 text-zinc-600 mb-2 rotate-180" />
              <p className="text-sm text-zinc-300 italic leading-relaxed">
                "{survey.comment}"
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-4 px-4 bg-zinc-900/50 border border-zinc-800/50 border-dashed rounded-xl text-xs text-zinc-500">
            <AlertCircle className="w-4 h-4" />
            El usuario no dejó comentarios adicionales.
          </div>
        )}

        {/* Meta Footer */}
        <div className="mt-6 pt-4 border-t border-zinc-800/50 flex items-center justify-between text-xs">
          
          <div className="flex items-center gap-2 text-zinc-500">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-mono">
              {new Date(survey.submittedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
              <span className="mx-1.5 opacity-30">|</span>
              {new Date(survey.submittedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {survey.agent && (
            <div className="flex items-center gap-2 pl-4 border-l border-zinc-800/50">
              <div className="p-1 bg-zinc-800 rounded-md text-zinc-400">
                <User className="w-3 h-3" />
              </div>
              <span className="font-medium text-zinc-300">{survey.agent.name}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SurveyDisplay;
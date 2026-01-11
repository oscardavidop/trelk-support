/**
 * Survey Display Component
 * Shows survey results for a closed session
 */

import React from 'react';
import { Star, MessageSquare } from 'lucide-react';
import type { Survey } from '../../types';

interface SurveyDisplayProps {
  survey?: Survey | null;
  compact?: boolean;
}

export const SurveyDisplay: React.FC<SurveyDisplayProps> = ({ survey, compact = false }) => {
  if (!survey) {
    return compact ? null : (
      <div className="text-sm text-muted-foreground italic">
        Sin encuesta
      </div>
    );
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? 'text-yellow-500 fill-yellow-500'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {renderStars(survey.rating)}
        <span className="text-sm text-muted-foreground">({survey.rating}/5)</span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border bg-card">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4" />
        Encuesta Post-Chat
      </h4>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Calificación:</span>
          <div className="flex items-center gap-2">
            {renderStars(survey.rating)}
            <span className="text-sm font-medium">{survey.rating}/5</span>
          </div>
        </div>

        {survey.comment && (
          <div>
            <span className="text-sm text-muted-foreground">Comentario:</span>
            <p className="text-sm mt-1 p-2 rounded bg-muted">{survey.comment}</p>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Enviado: {new Date(survey.submittedAt).toLocaleString('es-ES')}
          </span>
          {survey.agent && (
            <span>Agente: {survey.agent.name}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurveyDisplay;

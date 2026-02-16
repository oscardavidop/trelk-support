/**
 * CopilotPanel - AI-powered suggestions sidebar
 * Shows response suggestions, summaries, and sentiment analysis
 */

import { useState, useCallback } from 'react';
import { useCopilotStore, type CopilotSuggestion, type SuggestionType } from '../../stores/copilotStore';
import { copilotService } from '../../services/copilot.service';

interface Props {
  sessionId: string;
  onApplySuggestion?: (content: string) => void;
}

export function CopilotPanel({ sessionId, onApplySuggestion }: Props) {
  const {
    suggestions,
    activeSuggestion,
    isGenerating,
    isEnabled,
    isPanelOpen,
    addSuggestion,
    setActiveSuggestion,
    markSuggestionUsed,
    rateSuggestion,
    setGenerating,
    togglePanel,
  } = useCopilotStore();
  
  const sessionSuggestions = suggestions[sessionId] || [];
  
  // Generate suggestion
  const generateSuggestion = useCallback(async (type: SuggestionType) => {
    if (!isEnabled || isGenerating[type]) return;
    
    setGenerating(type, true);
    try {
      let result;
      switch (type) {
        case 'response':
          result = await copilotService.suggestResponse(sessionId);
          break;
        case 'summary':
          result = await copilotService.summarize(sessionId);
          break;
        case 'category':
          result = await copilotService.categorize(sessionId);
          break;
        case 'close_ready':
          result = await copilotService.checkCloseReady(sessionId);
          break;
        case 'sentiment':
          result = await copilotService.getSentiment(sessionId);
          break;
      }
      
      if (result.success && result.data) {
        addSuggestion({
          id: result.data.id || Date.now().toString(),
          sessionId,
          type,
          content: result.data.content || result.data.summary || '',
          confidence: result.data.confidence || 0.8,
          categories: result.data.categories,
          sentiment: result.data.sentiment,
          closeReady: result.data.closeReady,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error(`Failed to generate ${type} suggestion:`, error);
    } finally {
      setGenerating(type, false);
    }
  }, [sessionId, isEnabled, isGenerating, addSuggestion, setGenerating]);
  
  // Apply suggestion to composer
  const handleApply = useCallback((suggestion: CopilotSuggestion) => {
    markSuggestionUsed(suggestion.id, sessionId);
    onApplySuggestion?.(suggestion.content);
    setActiveSuggestion(null);
  }, [sessionId, markSuggestionUsed, onApplySuggestion, setActiveSuggestion]);
  
  // Rate suggestion
  const handleRate = useCallback(async (suggestion: CopilotSuggestion, rating: 'positive' | 'negative') => {
    rateSuggestion(suggestion.id, sessionId, rating);
    await copilotService.recordFeedback(suggestion.id, rating);
  }, [sessionId, rateSuggestion]);
  
  if (!isEnabled) {
    return null;
  }
  
  return (
    <div className={`transition-all duration-300 ${isPanelOpen ? 'w-80' : 'w-12'}`}>
      {/* Toggle button */}
      <button
        onClick={togglePanel}
        className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-zinc-50 rounded-l-lg shadow-lg hover:from-indigo-600 hover:to-purple-600 transition-colors ${
          isPanelOpen ? '-translate-x-80' : ''
        }`}
        title="AI Copilot"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </button>
      
      {isPanelOpen && (
        <div className="h-full bg-gray-900 border-l border-gray-700 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg">
                <svg className="w-4 h-4 text-zinc-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-50">AI Copilot</h3>
                <p className="text-xs text-gray-400">Asistencia inteligente</p>
              </div>
            </div>
          </div>
          
          {/* Quick actions */}
          <div className="p-3 border-b border-gray-700">
            <p className="text-xs text-gray-400 uppercasemb-2">Acciones Rápidas</p>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton
                label="Sugerir"
                icon="💬"
                loading={isGenerating['response']}
                onClick={() => generateSuggestion('response')}
              />
              <ActionButton
                label="Resumir"
                icon="📝"
                loading={isGenerating['summary']}
                onClick={() => generateSuggestion('summary')}
              />
              <ActionButton
                label="Categorizar"
                icon="🏷️"
                loading={isGenerating['category']}
                onClick={() => generateSuggestion('category')}
              />
              <ActionButton
                label="Sentimiento"
                icon="😊"
                loading={isGenerating['sentiment']}
                onClick={() => generateSuggestion('sentiment')}
              />
            </div>
          </div>
          
          {/* Suggestions list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {sessionSuggestions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <p className="text-sm">Sin sugerencias aún</p>
                <p className="text-xs text-gray-600 mt-1">
                  Usa las acciones rápidas para generar sugerencias
                </p>
              </div>
            ) : (
              sessionSuggestions.map(suggestion => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  isActive={activeSuggestion?.id === suggestion.id}
                  onSelect={() => setActiveSuggestion(suggestion)}
                  onApply={() => handleApply(suggestion)}
                  onRate={(rating) => handleRate(suggestion, rating)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Action Button Component
function ActionButton({ 
  label, 
  icon, 
  loading, 
  onClick 
}: { 
  label: string; 
  icon: string; 
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-zinc-50 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <span>{icon}</span>
      )}
      <span>{label}</span>
    </button>
  );
}

// Suggestion Card Component
function SuggestionCard({
  suggestion,
  isActive,
  onSelect,
  onApply,
  onRate,
}: {
  suggestion: CopilotSuggestion;
  isActive: boolean;
  onSelect: () => void;
  onApply: () => void;
  onRate: (rating: 'positive' | 'negative') => void;
}) {
  const typeLabels: Record<SuggestionType, { label: string; color: string; icon: string }> = {
    response: { label: 'Respuesta', color: 'bg-blue-500/20 text-blue-400', icon: '💬' },
    summary: { label: 'Resumen', color: 'bg-green-500/20 text-green-400', icon: '📝' },
    category: { label: 'Categoría', color: 'bg-yellow-500/20 text-yellow-400', icon: '🏷️' },
    close_ready: { label: 'Cerrar', color: 'bg-purple-500/20 text-purple-400', icon: '✓' },
    sentiment: { label: 'Sentimiento', color: 'bg-pink-500/20 text-pink-400', icon: '😊' },
  };
  
  const typeInfo = typeLabels[suggestion.type];
  
  return (
    <div 
      className={`bg-gray-800/50 rounded-lg p-3 border transition-colors cursor-pointer ${
        isActive ? 'border-purple-500' : 'border-gray-700 hover:border-gray-600'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeInfo.color}`}>
          {typeInfo.icon} {typeInfo.label}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-500">
            {Math.round(suggestion.confidence * 100)}%
          </span>
          {suggestion.isUsed && (
            <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
              ✓ Usado
            </span>
          )}
        </div>
      </div>
      
      {/* Content */}
      <p className="text-sm text-gray-300 line-clamp-3 mb-2">
        {suggestion.content}
      </p>
      
      {/* Categories */}
      {suggestion.categories && suggestion.categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {suggestion.categories.map((cat, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
              {cat}
            </span>
          ))}
        </div>
      )}
      
      {/* Sentiment */}
      {suggestion.sentiment && (
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs ${
            suggestion.sentiment.label === 'positive' ? 'text-green-400' :
            suggestion.sentiment.label === 'negative' ? 'text-red-400' :
            suggestion.sentiment.label === 'frustrated' ? 'text-orange-400' :
            'text-gray-400'
          }`}>
            {suggestion.sentiment.label === 'positive' ? '😊 Positivo' :
             suggestion.sentiment.label === 'negative' ? '😟 Negativo' :
             suggestion.sentiment.label === 'frustrated' ? '😤 Frustrado' :
             '😐 Neutral'}
          </span>
        </div>
      )}
      
      {/* Actions */}
      {isActive && suggestion.type === 'response' && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-700">
          <button
            onClick={(e) => { e.stopPropagation(); onApply(); }}
            className="flex-1 py-1.5 bg-purple-500 hover:bg-purple-600 text-zinc-50 text-sm rounded-lg transition-colors"
          >
            Usar respuesta
          </button>
          
          {!suggestion.feedbackGiven && (
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onRate('positive'); }}
                className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded transition-colors"
                title="Buena sugerencia"
              >
                👍
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onRate('negative'); }}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                title="Mala sugerencia"
              >
                👎
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CopilotPanel;

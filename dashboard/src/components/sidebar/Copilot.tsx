// CopilotSection.tsx - Refactored UI
import { useState } from 'react';
import { 
  StickyNote, Bot, Tag, CheckCircle2, RefreshCw, 
  Copy, Check, Wand2, ArrowRight, Sparkles, Sliders,
  AlertCircle, ChevronRight
} from 'lucide-react';
import { useCopilotStore, type SuggestionType } from '../../stores/copilotStore';
import { copilotService } from '../../services/copilot.service';

interface CopilotSectionProps {
  sessionId: string;
}

export function CopilotSection({ sessionId }: CopilotSectionProps) {
  const { suggestions, isGenerating, isEnabled, addSuggestion, setGenerating } = useCopilotStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const sessionSuggestions = suggestions[sessionId] || [];

  const handleGenerate = async (type: SuggestionType) => {
    if (!isEnabled || isGenerating[type]) return;
    setGenerating(type, true);
    try {
      let result;
      switch (type) {
        case 'response': result = await copilotService.suggestResponse(sessionId); break;
        case 'summary': result = await copilotService.summarize(sessionId); break;
        case 'category': result = await copilotService.categorize(sessionId); break;
        case 'close_ready': result = await copilotService.checkCloseReady(sessionId); break;
        case 'sentiment': result = await copilotService.getSentiment(sessionId); break;
      }
      
      if (result?.success && result.data) {
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
      console.error(`Copilot error (${type}):`, error);
    } finally {
      setGenerating(type, false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const latestSummary = sessionSuggestions.find(s => s.type === 'summary');
  const latestCategory = sessionSuggestions.find(s => s.type === 'category');
  const latestResponse = sessionSuggestions.find(s => s.type === 'response');
  const latestCloseReady = sessionSuggestions.find(s => s.type === 'close_ready');

  return (
    <div className="px-3 py-2 space-y-4">
      
      {/* 1. Summary Card */}
      <SuggestionCard
        title="Resumen Inteligente"
        icon={StickyNote}
        loading={isGenerating['summary']}
        onAction={() => handleGenerate('summary')}
        hasData={!!latestSummary}
        actionLabel="Generar Resumen"
      >
        {latestSummary && (
          <div className="relative group">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              {latestSummary.content}
            </p>
            <div className="flex justify-end mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700">
              <button
                onClick={() => handleCopy(latestSummary.content, latestSummary.id)}
                className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                {copiedId === latestSummary.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedId === latestSummary.id ? 'Copiado' : 'Copiar texto'}
              </button>
            </div>
          </div>
        )}
      </SuggestionCard>

      {/* 2. Suggested Response */}
      <SuggestionCard
        title="Respuesta Sugerida"
        icon={Bot}
        loading={isGenerating['response']}
        onAction={() => handleGenerate('response')}
        hasData={!!latestResponse}
        actionLabel="Generar Respuesta"
        gradient
      >
        {latestResponse && (
          <div>
            <div className="relative pl-3 border-l-2 border-violet-400/50 mb-3">
              <p className="text-xs italic text-gray-700 dark:text-gray-200 leading-relaxed">
                "{latestResponse.content}"
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium rounded-lg shadow-sm shadow-violet-500/20 transition-all active:scale-95">
                 <ArrowRight className="w-3 h-3" /> Insertar
              </button>
              <button className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg transition-all">
                 Editar
              </button>
            </div>
          </div>
        )}
      </SuggestionCard>

      {/* 3. Classification */}
      <SuggestionCard
        title="Clasificación"
        icon={Tag}
        loading={isGenerating['category']}
        onAction={() => handleGenerate('category')}
        hasData={!!latestCategory?.categories?.length}
        actionLabel="Analizar Chat"
      >
        {latestCategory?.categories && (
          <div className="flex flex-wrap gap-2">
            {latestCategory.categories.slice(0, 3).map((cat, i) => (
              <div 
                key={i} 
                className={`
                  flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium
                  ${i === 0 
                    ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300' 
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'}
                `}
              >
                <span>{cat}</span>
                {i === 0 && latestCategory.confidence && (
                   <span className="text-[9px] opacity-70 bg-black/5 dark:bg-white/10 px-1 rounded">
                     {Math.round(latestCategory.confidence * 100)}%
                   </span>
                )}
              </div>
            ))}
          </div>
        )}
      </SuggestionCard>

      {/* 4. Close Audit */}
      <SuggestionCard
        title="Auditoría de Cierre"
        icon={CheckCircle2}
        loading={isGenerating['close_ready']}
        onAction={() => handleGenerate('close_ready')}
        hasData={!!latestCloseReady}
        actionLabel="Verificar Cierre"
      >
        {latestCloseReady && (
          <div className="space-y-3">
            <div className={`flex items-center gap-2 p-2 rounded-lg border ${
                latestCloseReady.closeReady?.ready 
                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400'
            }`}>
              {latestCloseReady.closeReady?.ready ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span className="text-xs font-bold uppercase tracking-wide">
                {latestCloseReady.closeReady?.ready ? 'Listo para cerrar' : 'Acciones pendientes'}
              </span>
            </div>
            
            {latestCloseReady.closeReady?.reasons && (
              <ul className="space-y-1.5 pl-1">
                {latestCloseReady.closeReady.reasons.map((reason: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${latestCloseReady.closeReady?.ready ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    {reason}
                  </li>
                ))}
              </ul>
            )}
            
            {latestCloseReady.closeReady?.ready && (
              <button className="w-full py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Cerrar Ticket
              </button>
            )}
          </div>
        )}
      </SuggestionCard>

      {/* Settings Toggle Footer */}
      <div className="pt-2">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 hover:text-violet-500 transition-colors mx-auto"
        >
          <Sliders className="w-3 h-3" />
          Configuración de IA {showSettings ? <ChevronRight className="w-3 h-3 rotate-90" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {showSettings && (
          <div className="mt-3 space-y-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2 fade-in">
            <ToggleOption label="Auto-sugerir respuestas" defaultChecked />
            <ToggleOption label="Categorización automática" defaultChecked />
            <ToggleOption label="Análisis de sentimiento" />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helper Components ---

function SuggestionCard({ 
  title, 
  icon: Icon, 
  children, 
  loading, 
  onAction, 
  hasData, 
  actionLabel,
  gradient = false
}: any) {
  return (
    <div className={`
      relative overflow-hidden rounded-xl border transition-all duration-300
      ${gradient && hasData
        ? 'bg-gradient-to-br from-white to-violet-50/50 dark:from-[#1a1d26] dark:to-violet-900/10 border-violet-200 dark:border-violet-800/50 shadow-md shadow-violet-500/5' 
        : 'bg-white dark:bg-[#1a1d26] border-gray-200 dark:border-gray-800 shadow-sm hover:border-gray-300 dark:hover:border-gray-700'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/30 dark:bg-white/5">
        <div className="flex items-center gap-2">
           <div className={`p-1 rounded-md ${gradient ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
             <Icon className="w-3.5 h-3.5" />
           </div>
           <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wider">{title}</span>
        </div>
        
        {hasData && (
          <button 
            onClick={onAction} 
            disabled={loading}
            className="text-gray-400 hover:text-violet-500 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Regenerar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-violet-500' : ''}`} />
          </button>
        )}
      </div>

      {/* Content Body */}
      <div className="p-3">
        {loading && !hasData ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        ) : !hasData ? (
          <button 
            onClick={onAction}
            className="w-full group flex flex-col items-center justify-center py-3 gap-2 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 transition-all cursor-pointer"
          >
            <div className="p-2 rounded-full bg-gray-50 dark:bg-gray-800 group-hover:scale-110 transition-transform">
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 group-hover:text-violet-600 dark:group-hover:text-violet-300">
              {actionLabel}
            </span>
          </button>
        ) : (
          <div className="animate-in fade-in duration-300">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleOption({ label, defaultChecked }: { label: string, defaultChecked?: boolean }) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">{label}</span>
      <div className="relative">
        <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
        <div className="w-7 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-violet-600"></div>
      </div>
    </label>
  );
}
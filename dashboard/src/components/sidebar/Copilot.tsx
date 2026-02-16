import { useState } from 'react';
import { 
  StickyNote, Bot, Tag, CheckCircle2, RefreshCw, 
  Copy, Check, ArrowRight, Sparkles, Sliders,
  AlertCircle, ChevronRight, Wand2
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
            <p className="text-xs text-zinc-300 leading-relaxed italic">
              "{latestSummary.content}"
            </p>
            <div className="flex justify-end mt-2 pt-2 border-t border-zinc-800 border-dashed">
              <button
                onClick={() => handleCopy(latestSummary.content, latestSummary.id)}
                className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 hover:text-pink-400 transition-colors"
              >
                {copiedId === latestSummary.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedId === latestSummary.id ? 'Copiado' : 'Copiar'}
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
        actionLabel="Sugerir Respuesta"
        gradient
      >
        {latestResponse && (
          <div className="space-y-3">
            <div className="relative p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200">
              <div className="absolute left-0 top-3 bottom-3 w-0.5 bg-gradient-to-b from-pink-500 to-purple-600 rounded-r-full" />
              <p className="pl-2 leading-relaxed">{latestResponse.content}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-pink-600 hover:bg-pink-500 text-zinc-50 text-xs font-medium rounded-lg shadow-lg shadow-pink-900/20 transition-all active:scale-95">
                 <ArrowRight className="w-3 h-3" /> Insertar
              </button>
              <button className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-all">
                 Editar
              </button>
            </div>
          </div>
        )}
      </SuggestionCard>

      {/* 3. Classification */}
      <SuggestionCard
        title="Clasificación Auto"
        icon={Tag}
        loading={isGenerating['category']}
        onAction={() => handleGenerate('category')}
        hasData={!!latestCategory?.categories?.length}
        actionLabel="Analizar Contexto"
      >
        {latestCategory?.categories && (
          <div className="flex flex-wrap gap-2">
            {latestCategory.categories.slice(0, 3).map((cat, i) => (
              <div 
                key={i} 
                className={`
                  flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold 
                  ${i === 0 
                    ? 'bg-pink-500/10 border-pink-500/20 text-pink-400' 
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'}
                `}
              >
                <span>{cat}</span>
                {i === 0 && latestCategory.confidence && (
                   <span className="opacity-60 font-mono">
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
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              {latestCloseReady.closeReady?.ready ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              <span className="text-xs font-bold ">
                {latestCloseReady.closeReady?.ready ? 'Listo para cerrar' : 'Acciones pendientes'}
              </span>
            </div>
            
            {latestCloseReady.closeReady?.reasons && (
              <div className="space-y-1 pl-1">
                {latestCloseReady.closeReady.reasons.map((reason: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-400">
                    <div className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${latestCloseReady.closeReady?.ready ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    {reason}
                  </div>
                ))}
              </div>
            )}
            
            {latestCloseReady.closeReady?.ready && (
              <button className="w-full py-2 text-xs font-bold text-zinc-50 bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Cerrar Ticket Ahora
              </button>
            )}
          </div>
        )}
      </SuggestionCard>

      {/* Settings Footer */}
      <div className="pt-2 border-t border-zinc-800/50">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center justify-between w-full text-[10px] font-bold text-zinc-500 hover:text-zinc-300 transition-colors  px-1"
        >
          <span className="flex items-center gap-1.5"><Sliders className="w-3 h-3" /> Configuración AI</span>
          <ChevronRight className={`w-3 h-3 transition-transform ${showSettings ? 'rotate-90' : ''}`} />
        </button>

        {showSettings && (
          <div className="mt-3 space-y-1 bg-zinc-900 p-2 rounded-lg border border-zinc-800 animate-in slide-in-from-top-1">
            <ToggleOption label="Auto-sugerir respuestas" defaultChecked />
            <ToggleOption label="Categorización automática" defaultChecked />
            <ToggleOption label="Análisis de sentimiento" />
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helper Components (Premium Zinc Style) ---

function SuggestionCard({ 
  title, icon: Icon, children, loading, onAction, hasData, actionLabel, gradient = false 
}: any) {
  return (
    <div className={`
      relative overflow-hidden rounded-xl border transition-all duration-300 group
      ${gradient && hasData
        ? 'bg-zinc-900 border-pink-500/20 shadow-sm shadow-pink-500/5' 
        : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'}
    `}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800/50 bg-zinc-900">
        <div className="flex items-center gap-2">
           <div className={`p-1 rounded-md ${gradient ? 'bg-pink-500/10 text-pink-400' : 'bg-zinc-800 text-zinc-400'}`}>
             <Icon className="w-3.5 h-3.5" />
           </div>
           <span className={`text-[10px] font-bold  ${gradient ? 'text-pink-200' : 'text-zinc-400'}`}>{title}</span>
        </div>
        
        {hasData && (
          <button 
            onClick={onAction} 
            disabled={loading}
            className="text-zinc-500 hover:text-zinc-50 transition-colors p-1 rounded hover:bg-zinc-800"
            title="Regenerar"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-pink-500' : ''}`} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        {loading && !hasData ? (
          <div className="space-y-2 animate-pulse py-2">
            <div className="h-2 bg-zinc-800 rounded w-3/4"></div>
            <div className="h-2 bg-zinc-800 rounded w-1/2"></div>
          </div>
        ) : !hasData ? (
          <button 
            onClick={onAction}
            className="w-full flex flex-col items-center justify-center py-4 gap-2 border border-dashed border-zinc-800 hover:border-pink-500/30 rounded-lg hover:bg-pink-500/5 transition-all group/btn"
          >
            <div className="p-2 rounded-full bg-zinc-950 group-hover/btn:bg-pink-500/10 transition-colors">
              <Sparkles className="w-4 h-4 text-zinc-600 group-hover/btn:text-pink-400 transition-colors" />
            </div>
            <span className="text-xs font-medium text-zinc-500 group-hover/btn:text-pink-300">
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
    <label className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-zinc-800 cursor-pointer group transition-colors">
      <span className="text-xs text-zinc-400 group-hover:text-zinc-200">{label}</span>
      <div className="relative">
        <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
        <div className="w-7 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-pink-600 peer-checked:after:bg-white border border-zinc-700 peer-checked:border-pink-500"></div>
      </div>
    </label>
  );
}
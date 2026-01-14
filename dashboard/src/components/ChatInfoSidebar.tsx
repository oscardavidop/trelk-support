// Chat Info Sidebar - Main component
import { useState, useEffect, useCallback } from 'react';
import { 
  X, User, MessageSquare, Clock, Tag, StickyNote, Settings, History,
  Zap, ChevronDown, ChevronRight, Loader2, AlertCircle, Activity, Sparkles,
  RefreshCw, Copy, Check, ThumbsUp, ThumbsDown, Timer
} from 'lucide-react';
import type { ContactInfo, Tag as TagType } from '../types';
import { getContactInfo } from '../services/contactApi';
import { SidebarConversationStatus } from './sidebar/ConversationStatus';
import { SidebarUserIdentity } from './sidebar/UserIdentity';
import { SidebarNotes } from './sidebar/Notes';
import { SidebarTags } from './sidebar/Tags';
import { SidebarHistory } from './sidebar/History';
import { SidebarCustomFields } from './sidebar/CustomFields';
import { SidebarSystemFields } from './sidebar/SystemFields';
import { LiveContactTimer } from './sidebar/LiveContactTimer';
import { ActivityTimeline } from './sidebar/ActivityTimeline';
import { ScheduledMessagesList } from './scheduled/ScheduledMessagesList';
import { useCopilotStore, type CopilotSuggestion, type SuggestionType } from '../stores/copilotStore';
import { copilotService } from '../services/copilot.service';

interface ChatInfoSidebarProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatInfoSidebar({ sessionId, isOpen, onClose }: ChatInfoSidebarProps) {
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['status', 'identity', 'notes', 'tags'])
  );

  // Fetch contact info when session changes
  const fetchContactInfo = useCallback(async () => {
    if (!sessionId) {
      setContactInfo(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const info = await getContactInfo(sessionId);
      if (info) {
        setContactInfo(info);
      } else {
        setError('Could not load contact information');
      }
    } catch (err) {
      setError('Error loading contact info');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchContactInfo();
  }, [fetchContactInfo]);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  // Format duration
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return 'Desconocido';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 h-[56px]">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <User className="w-4 h-4" />
          Información del Contacto
        </h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <X className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{error}</p>
            <button
              onClick={fetchContactInfo}
              className="mt-3 text-sm text-indigo-600 hover:text-indigo-700"
            >
              Reintentar
            </button>
          </div>
        )}

        {!sessionId && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Selecciona un chat para ver la información del contacto
            </p>
          </div>
        )}

        {contactInfo && !isLoading && (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {/* User Profile Card - Always visible */}
            <div className="p-4 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
              <div className="flex flex-col items-center text-center">
                {/* Avatar */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-3">
                  {contactInfo.user.firstName.charAt(0).toUpperCase()}
                  {contactInfo.user.lastName ? contactInfo.user.lastName.charAt(0).toUpperCase() : ''}
                </div>
                
                {/* Name */}
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {contactInfo.user.firstName} {contactInfo.user.lastName || ''}
                </h2>
                
                {/* Username */}
                {contactInfo.user.username && (
                  <a 
                    href={`https://t.me/${contactInfo.user.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    @{contactInfo.user.username}
                  </a>
                )}
                
                {/* Telegram ID */}
                <code className="mt-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-500">
                  ID: {contactInfo.user.telegramId}
                </code>
                
                {/* Quick stats */}
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    <span>{contactInfo.stats.totalMessages} msgs</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <History className="w-3 h-3" />
                    <span>{contactInfo.stats.totalSessions} chats</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversation Status Section */}
            <SidebarSection
              title="Estado de la conversación"
              icon={<MessageSquare className="w-4 h-4" />}
              isExpanded={expandedSections.has('status')}
              onToggle={() => toggleSection('status')}
            >
              <SidebarConversationStatus
                status={contactInfo.session.status}
                createdAt={contactInfo.session.createdAt}
                updatedAt={contactInfo.session.updatedAt}
                closedAt={contactInfo.session.closedAt}
                closedBy={contactInfo.session.closedBy}
                closureReason={contactInfo.session.closureReason}
              />
            </SidebarSection>

            {/* Contact Time - Live Timer */}
            <SidebarSection
              title="Tiempo de contacto"
              icon={<Clock className="w-4 h-4" />}
              isExpanded={expandedSections.has('time')}
              onToggle={() => toggleSection('time')}
            >
              <LiveContactTimer
                startTime={contactInfo.session.createdAt}
                messageCount={contactInfo.stats.totalMessages}
                isClosed={contactInfo.session.status === 'closed'}
                endTime={contactInfo.session.closedAt}
              />
            </SidebarSection>

            {/* User Identity */}
            <SidebarSection
              title="Identidad del usuario"
              icon={<User className="w-4 h-4" />}
              isExpanded={expandedSections.has('identity')}
              onToggle={() => toggleSection('identity')}
            >
              <SidebarUserIdentity user={contactInfo.user} />
            </SidebarSection>

            {/* History */}
            <SidebarSection
              title="Historial"
              icon={<History className="w-4 h-4" />}
              isExpanded={expandedSections.has('history')}
              onToggle={() => toggleSection('history')}
            >
              <SidebarHistory 
                userId={contactInfo.user.id} 
                totalSessions={contactInfo.stats.totalSessions}
                currentSessionId={sessionId || ''}
              />
            </SidebarSection>

            {/* Automations */}
            <SidebarSection
              title="Automatizaciones"
              icon={<Zap className="w-4 h-4" />}
              isExpanded={expandedSections.has('automations')}
              onToggle={() => toggleSection('automations')}
            >
              <div className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    contactInfo.automations.active 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {contactInfo.automations.active ? '⚡ Activas' : '⏸️ Sin automatizaciones'}
                  </span>
                </div>
              </div>
            </SidebarSection>

            {/* Scheduled Messages */}
            <SidebarSection
              title="Mensajes programados"
              icon={<Timer className="w-4 h-4" />}
              isExpanded={expandedSections.has('scheduled')}
              onToggle={() => toggleSection('scheduled')}
              badge={scheduledCount > 0 ? scheduledCount : undefined}
            >
              <ScheduledMessagesList
                sessionId={sessionId || ''}
                onCountChange={setScheduledCount}
              />
            </SidebarSection>

            {/* Notes */}
            <SidebarSection
              title="Notas internas"
              icon={<StickyNote className="w-4 h-4" />}
              isExpanded={expandedSections.has('notes')}
              onToggle={() => toggleSection('notes')}
              badge={contactInfo.notes.count > 0 ? contactInfo.notes.count : undefined}
            >
              <SidebarNotes
                userId={contactInfo.user.id}
                sessionId={sessionId || ''}
                notesCount={contactInfo.notes.count}
                latestNote={contactInfo.notes.latest}
                onNoteAdded={fetchContactInfo}
              />
            </SidebarSection>

            {/* Tags */}
            <SidebarSection
              title="Etiquetas de contacto"
              icon={<Tag className="w-4 h-4" />}
              isExpanded={expandedSections.has('tags')}
              onToggle={() => toggleSection('tags')}
              badge={contactInfo.tags.length > 0 ? contactInfo.tags.length : undefined}
            >
              <SidebarTags
                userId={contactInfo.user.id}
                tags={contactInfo.tags}
                onTagsChanged={fetchContactInfo}
              />
            </SidebarSection>

            {/* System Fields */}
            <SidebarSection
              title="Campos del sistema"
              icon={<User className="w-4 h-4" />}
              isExpanded={expandedSections.has('system')}
              onToggle={() => toggleSection('system')}
            >
              <SidebarSystemFields user={contactInfo.user} />
            </SidebarSection>

            {/* Custom Fields */}
            <SidebarSection
              title="Campos personalizados"
              icon={<Settings className="w-4 h-4" />}
              isExpanded={expandedSections.has('custom')}
              onToggle={() => toggleSection('custom')}
            >
              <SidebarCustomFields
                userId={contactInfo.user.id}
                fields={contactInfo.customFields}
                onFieldUpdated={fetchContactInfo}
              />
            </SidebarSection>
            {/* Activity Timeline */}
            <SidebarSection
              title="Línea de tiempo"
              icon={<Activity className="w-4 h-4" />}
              isExpanded={expandedSections.has('activity')}
              onToggle={() => toggleSection('activity')}
            >
              {sessionId && <ActivityTimeline sessionId={sessionId} />}
            </SidebarSection>

            {/* AI Copilot */}
            <SidebarSection
              title="AI Copilot"
              icon={<Sparkles className="w-4 h-4" />}
              isExpanded={expandedSections.has('copilot')}
              onToggle={() => toggleSection('copilot')}
            >
              {sessionId && <CopilotSection sessionId={sessionId} />}
            </SidebarSection>
          </div>
        )}
      </div>
    </div>
  );
}

// Collapsible section component
interface SidebarSectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: number;
  children: React.ReactNode;
}

function SidebarSection({ title, icon, isExpanded, onToggle, badge, children }: SidebarSectionProps) {
  return (
    <div className="py-1">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          {icon}
          {title}
          {badge !== undefined && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {isExpanded && children}
    </div>
  );
}
// AI Copilot Section Component
interface CopilotSectionProps {
  sessionId: string;
}

function CopilotSection({ sessionId }: CopilotSectionProps) {
  const {
    suggestions,
    isGenerating,
    isEnabled,
    addSuggestion,
    setGenerating,
  } = useCopilotStore();
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
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
  
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  
  // Find latest suggestions by type
  const latestSummary = sessionSuggestions.find(s => s.type === 'summary');
  const latestCategory = sessionSuggestions.find(s => s.type === 'category');
  const latestResponse = sessionSuggestions.find(s => s.type === 'response');
  const latestCloseReady = sessionSuggestions.find(s => s.type === 'close_ready');
  
  return (
    <div className="px-3 py-2 space-y-3">
      {/* Conversation Summary */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
            📝 Resumen de conversación
          </h4>
          <button
            onClick={() => generateSuggestion('summary')}
            disabled={isGenerating['summary']}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Generar resumen"
          >
            <RefreshCw className={`w-3 h-3 text-gray-500 ${isGenerating['summary'] ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {latestSummary ? (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4">
              {latestSummary.content}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => handleCopy(latestSummary.content, latestSummary.id)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                {copiedId === latestSummary.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedId === latestSummary.id ? 'Copiado' : 'Copiar'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">
            Haz clic en actualizar para generar un resumen
          </p>
        )}
      </div>
      
      {/* Suggested Category */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
            🏷️ Categoría sugerida
          </h4>
          <button
            onClick={() => generateSuggestion('category')}
            disabled={isGenerating['category']}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Analizar categoría"
          >
            <RefreshCw className={`w-3 h-3 text-gray-500 ${isGenerating['category'] ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {latestCategory?.categories && latestCategory.categories.length > 0 ? (
          <div className="space-y-1">
            {latestCategory.categories.slice(0, 3).map((cat, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className={`text-sm ${i === 0 ? 'text-indigo-600 dark:text-indigo-400 font-medium' : 'text-gray-500'}`}>
                  {i === 0 ? '🔹' : '🔸'} {cat}
                </span>
                {i === 0 && (
                  <span className="text-xs text-gray-500">
                    {Math.round((latestCategory.confidence || 0.85) * 100)}%
                  </span>
                )}
              </div>
            ))}
            <button className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
              Aplicar
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">
            Haz clic en actualizar para analizar categoría
          </p>
        )}
      </div>
      
      {/* Suggested Response */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
            ✍️ Respuesta sugerida
          </h4>
          <button
            onClick={() => generateSuggestion('response')}
            disabled={isGenerating['response']}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Generar respuesta"
          >
            <RefreshCw className={`w-3 h-3 text-gray-500 ${isGenerating['response'] ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {latestResponse ? (
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4 italic">
              "{latestResponse.content}"
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 transition-colors">
                Insertar
              </button>
              <button className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                Editar
              </button>
              <button className="px-2 py-1 text-gray-500 text-xs hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                Omitir
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">
            Haz clic en actualizar para generar una respuesta
          </p>
        )}
      </div>
      
      {/* Resolution Readiness */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
            ✅ Preparación para cerrar
          </h4>
          <button
            onClick={() => generateSuggestion('close_ready')}
            disabled={isGenerating['close_ready']}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Verificar si está listo"
          >
            <RefreshCw className={`w-3 h-3 text-gray-500 ${isGenerating['close_ready'] ? 'animate-spin' : ''}`} />
          </button>
        </div>
        {latestCloseReady ? (
          <div>
            <div className={`flex items-center gap-2 mb-2 ${
              latestCloseReady.closeReady?.ready 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-yellow-600 dark:text-yellow-400'
            }`}>
              <span className="text-lg">
                {latestCloseReady.closeReady?.ready ? '🟢' : '🟡'}
              </span>
              <span className="text-sm font-medium">
                {latestCloseReady.closeReady?.ready 
                  ? 'Chat listo para cerrar' 
                  : 'Aún hay cosas pendientes'}
              </span>
            </div>
            {latestCloseReady.closeReady?.reasons && latestCloseReady.closeReady.reasons.length > 0 && (
              <ul className="text-xs text-gray-500 space-y-1 ml-6">
                {latestCloseReady.closeReady.reasons.map((reason: string, i: number) => (
                  <li key={i} className="flex items-center gap-1">
                    <span>{latestCloseReady.closeReady?.ready ? '✓' : '○'}</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            )}
            {latestCloseReady.closeReady?.ready && (
              <button className="mt-3 w-full px-3 py-2 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors">
                Cerrar chat con resumen
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">
            Haz clic en actualizar para verificar
          </p>
        )}
      </div>
      
      {/* Copilot Settings */}
      <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
          ⚙️ Configuración Copilot
        </h4>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded border-gray-300 dark:border-gray-600" />
            Auto-sugerir respuestas
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" defaultChecked className="rounded border-gray-300 dark:border-gray-600" />
            Mostrar sugerencias de categoría
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
            <input type="checkbox" className="rounded border-gray-300 dark:border-gray-600" />
            Auto-resumir al asignar
          </label>
        </div>
      </div>
    </div>
  );
}
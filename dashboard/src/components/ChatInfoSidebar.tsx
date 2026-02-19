import { useState, useEffect, useCallback } from 'react';
import {
  X, User, MessageSquare, Clock, Tag, StickyNote, Settings, History,
  ChevronDown, ChevronRight, Loader2, AlertCircle, Activity, Timer, Bot,
  SquareDashedMousePointerIcon,
  MessageCircle, ClipboardCheck, Paperclip, Download, BookOpen,
  Globe, Languages
} from 'lucide-react';
import type { ContactInfo } from '../types';
import { getContactInfo } from '../services/contactApi';
import { getOutgoingConfig, updateSessionTranslation, type OutgoingConfig, getIncomingConfig, updateSessionIncomingTranslation, type IncomingConfig } from '../services/translation.service';

// Sub-components imports (Mantenemos la lógica de importación existente)
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
import { CopilotSection } from './sidebar/Copilot';
import { SidebarDisposition } from './sidebar/Disposition';
import { SidebarMedia } from './sidebar/Media';
import { SidebarPlaybook } from './sidebar/SidebarPlaybook';
import ContactProfileHeader from './0';
import QAReviewPanel from './QAReviewPanel';
import ExportPanel from './sidebar/ExportPanel';

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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['status']));
  const [outgoingCfg, setOutgoingCfg] = useState<OutgoingConfig | null>(null);
  const [incomingCfg, setIncomingCfg] = useState<IncomingConfig | null>(null);

  const fetchContactInfo = useCallback(async () => {
    if (!sessionId) {
      setContactInfo(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const info = await getContactInfo(sessionId);
      if (info) setContactInfo(info);
      else {
        setContactInfo(null);
        setError('No se encontró información para este chat');
      }
    } catch (err) {
      setError('Error cargando información');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchContactInfo();
  }, [fetchContactInfo]);

  // Load outgoing translation config for this session
  useEffect(() => {
    if (!sessionId) { setOutgoingCfg(null); return; }
    getOutgoingConfig(sessionId).then(setOutgoingCfg).catch(() => setOutgoingCfg(null));
  }, [sessionId]);

  // Load incoming translation config for this session
  useEffect(() => {
    if (!sessionId) { setIncomingCfg(null); return; }
    getIncomingConfig(sessionId).then(setIncomingCfg).catch(() => setIncomingCfg(null));
  }, [sessionId]);

  // Re-fetch contactInfo when session updates (disposition, tags, category changes)
  useEffect(() => {
    if (!sessionId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sessionId === sessionId) {
        fetchContactInfo();
      }
    };
    // Listen for session updates from socket and disposition saves
    window.addEventListener('session:updated', handler);
    window.addEventListener('disposition:saved', handler);
    return () => {
      window.removeEventListener('session:updated', handler);
      window.removeEventListener('disposition:saved', handler);
    };
  }, [sessionId, fetchContactInfo]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };
  const [isExpanded, setIsExpanded] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="w-100 bg-zinc-950 border-l border-zinc-800 flex flex-col h-full shadow-2xl transition-all duration-300">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md shrink-0 h-[56px]">
        <h3 className="font-bold text-zinc-100 flex items-center gap-2 text-sm ">
          <User className="w-4 h-4 text-indigo-500" />
          Detalles del Contacto
        </h3>
        <button
          onClick={onClose}
          className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-xs text-zinc-500 animate-pulse">Sincronizando perfil...</p>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="m-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-xs text-red-300 font-medium">{error}</p>
            <button onClick={fetchContactInfo} className="mt-3 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg transition-colors">
              Reintentar
            </button>
          </div>
        )}

        {/* Empty State */}
        {!sessionId && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center opacity-50">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800">
              <MessageSquare className="w-8 h-8 text-zinc-600" />
            </div>
            <p className="text-sm font-medium text-zinc-400">Selecciona un chat</p>
            <p className="text-xs text-zinc-600 mt-1">Para ver los detalles del usuario</p>
          </div>
        )}

        {/* Contact Data */}
        {contactInfo && !isLoading && (
          <div className="pb-10">


            <ContactProfileHeader contactInfo={contactInfo} />

            {/* Accordion Sections */}
            <SidebarSection
              title="Estado Actual"
              icon={<Activity className="w-4 h-4 text-blue-400" />}
              isExpanded={expandedSections.has('status')}
              onToggle={() => toggleSection('status')}
            >
              <SidebarConversationStatus {...contactInfo.session} />
            </SidebarSection>

            <SidebarSection
              title="Tipificación"
              icon={<ClipboardCheck className="w-4 h-4 text-cyan-400" />}
              isExpanded={expandedSections.has('disposition')}
              onToggle={() => toggleSection('disposition')}
              badge={contactInfo.session.disposition?.categoryId ? 1 : 0}
            >
              <SidebarDisposition
                sessionId={sessionId || ''}
                disposition={contactInfo.session.disposition}
                sessionStatus={contactInfo.session.status}
              />
            </SidebarSection>

            <SidebarSection
              title="Playbook"
              icon={<BookOpen className="w-4 h-4 text-indigo-400" />}
              isExpanded={expandedSections.has('playbook')}
              onToggle={() => toggleSection('playbook')}
              headerClassName="hover:bg-indigo-500/10"
            >
              {sessionId && contactInfo && <SidebarPlaybook sessionId={sessionId} contactInfo={contactInfo} />}
            </SidebarSection>

            <SidebarSection
              title="Tiempo Activo"
              icon={<Timer className="w-4 h-4 text-orange-400" />}
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

            <SidebarSection
              title="Notas Internas"
              icon={<StickyNote className="w-4 h-4 text-yellow-400" />}
              isExpanded={expandedSections.has('notes')}
              onToggle={() => toggleSection('notes')}
              badge={contactInfo.notes.count}
            >
              <SidebarNotes
                userId={contactInfo.user.id}
                sessionId={sessionId || ''}
                notesCount={contactInfo.notes.count}
                latestNote={contactInfo.notes.latest}
                onNoteAdded={fetchContactInfo}
              />
            </SidebarSection>

            <SidebarSection
              title="Media"
              icon={<Paperclip className="w-4 h-4 text-pink-400" />}
              isExpanded={expandedSections.has('media')}
              onToggle={() => toggleSection('media')}
            >
              <SidebarMedia sessionId={sessionId || ''} contactInfo={contactInfo} />
            </SidebarSection>

            <SidebarSection
              title="Etiquetas"
              icon={<Tag className="w-4 h-4 text-emerald-400" />}
              isExpanded={expandedSections.has('tags')}
              onToggle={() => toggleSection('tags')}
              badge={contactInfo.tags.length}
            >
              <SidebarTags
                userId={contactInfo.user.id}
                tags={contactInfo.tags}
                onTagsChanged={fetchContactInfo}
              />
            </SidebarSection>

            <SidebarSection
              title="Mensajes Programados"
              icon={<Clock className="w-4 h-4 text-teal-400" />}
              isExpanded={expandedSections.has('scheduled')}
              onToggle={() => toggleSection('scheduled')}
              badge={scheduledCount}
            >
              <ScheduledMessagesList sessionId={sessionId || ''} onCountChange={setScheduledCount} />
            </SidebarSection>

            <SidebarSection
              title="Historial de Chats"
              icon={<History className="w-4 h-4 text-zinc-400" />}
              isExpanded={expandedSections.has('history')}
              onToggle={() => toggleSection('history')}
            >
              <SidebarHistory
                userId={contactInfo.user.id}
                totalSessions={contactInfo.stats.totalSessions}
                currentSessionId={sessionId || ''}
              />
            </SidebarSection>

            <SidebarSection
              title="Línea de Tiempo"
              icon={<Activity className="w-4 h-4 text-indigo-400" />}
              isExpanded={expandedSections.has('activity')}
              onToggle={() => toggleSection('activity')}
            >
              {sessionId && <ActivityTimeline sessionId={sessionId} />}
            </SidebarSection>
            <SidebarSection
              title="AI Copilot"
              icon={<Bot className="w-4 h-4 text-pink-500" />}
              isExpanded={expandedSections.has('copilot')}
              onToggle={() => toggleSection('copilot')}
              headerClassName="hover:bg-pink-500/10"
            >
              {sessionId && <CopilotSection sessionId={sessionId} />}
            </SidebarSection>
            {/* QA Review Section — only for closed chats */}
            {contactInfo.session.status === 'closed' && sessionId && contactInfo.session.assignedAgent && (
              <SidebarSection
                title="Evaluación QA"
                icon={<ClipboardCheck className="w-4 h-4 text-indigo-400" />}
                isExpanded={expandedSections.has('qa')}
                onToggle={() => toggleSection('qa')}
                headerClassName="hover:bg-indigo-500/10"
              >
                <div className="px-2 pb-2">
                  <QAReviewPanel
                    sessionId={sessionId}
                    agentId={typeof contactInfo.session.assignedAgent === 'object'
                      ? (contactInfo.session.assignedAgent as any)._id
                      : contactInfo.session.assignedAgent}
                    compact={true}
                  />
                </div>
              </SidebarSection>
            )}

            {/* Export Section */}
            {sessionId && (
              <SidebarSection
                title="Exportar Chat"
                icon={<Download className="w-4 h-4 text-cyan-400" />}
                isExpanded={expandedSections.has('export')}
                onToggle={() => toggleSection('export')}
                headerClassName="hover:bg-cyan-500/10"
                className='overflow-x-auto'
              >
                <ExportPanel sessionId={sessionId} />
              </SidebarSection>
            )}

            {/* Translation Section */}
            {sessionId && outgoingCfg && (
              <SidebarSection
                title="Traducción"
                icon={<Globe className="w-4 h-4 text-indigo-400" />}
                isExpanded={expandedSections.has('translation')}
                onToggle={() => toggleSection('translation')}
                headerClassName="hover:bg-indigo-500/10"
              >
                <SidebarTranslation
                  sessionId={sessionId}
                  config={outgoingCfg}
                  onConfigChange={setOutgoingCfg}
                />
                {incomingCfg && (
                  <SidebarIncomingTranslation
                    sessionId={sessionId}
                    config={incomingCfg}
                    onConfigChange={setIncomingCfg}
                  />
                )}
              </SidebarSection>
            )}

            {/* Meta Data Divider */}
            <div className="pt-6 pb-2 px-2">
              <p className="text-[12px] font-bold text-zinc-600 st">Información Técnica</p>
            </div>

            <SidebarSection
              title="Identidad de Usuario"
              icon={<User className="w-4 h-4 text-zinc-500" />}
              isExpanded={expandedSections.has('identity')}
              onToggle={() => toggleSection('identity')}
            >
              <SidebarUserIdentity user={contactInfo.user} />
            </SidebarSection>

            <SidebarSection
              title="Campos del Sistema"
              icon={<Settings className="w-4 h-4 text-zinc-500" />}
              isExpanded={expandedSections.has('system')}
              onToggle={() => toggleSection('system')}
            >
              <SidebarSystemFields user={contactInfo.user} />
            </SidebarSection>

            <SidebarSection
              title="Campos Personalizados"
              icon={<Settings className="w-4 h-4 text-zinc-500" />}
              isExpanded={expandedSections.has('custom')}
              onToggle={() => toggleSection('custom')}
            >
              <SidebarCustomFields
                userId={contactInfo.user.id}
                fields={contactInfo.customFields}
                onFieldUpdated={fetchContactInfo}
              />
            </SidebarSection>

            {/* Highlighted AI Section */}
            <div className="mb-4">

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============= HELPER COMPONENTS =============

function SidebarTranslation({ sessionId, config, onConfigChange }: {
  sessionId: string;
  config: OutgoingConfig;
  onConfigChange: (cfg: OutgoingConfig) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [targetLang, setTargetLang] = useState(config.targetLang || '');

  const toggleEnabled = async () => {
    setSaving(true);
    try {
      const next = !config.enabled;
      await updateSessionTranslation(sessionId, { outgoingEnabled: next, outgoingTargetLang: targetLang || undefined });
      onConfigChange({ ...config, enabled: next });
      // Notify composer to refresh its config
      window.dispatchEvent(new CustomEvent('translation:sessionUpdated', { detail: { sessionId } }));
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleLangChange = async (lang: string) => {
    setTargetLang(lang);
    setSaving(true);
    try {
      await updateSessionTranslation(sessionId, { outgoingEnabled: config.enabled, outgoingTargetLang: lang });
      onConfigChange({ ...config, targetLang: lang });
      window.dispatchEvent(new CustomEvent('translation:sessionUpdated', { detail: { sessionId } }));
    } catch { /* silent */ }
    setSaving(false);
  };

  return (
    <div className="px-4 pb-3 space-y-3 pt-4">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-indigo-400" />
          <span className="text-sm text-zinc-200 font-medium">Auto-Translate saliente</span>
        </div>
        <button
          onClick={toggleEnabled}
          disabled={saving || !config.agentOverrideAllowed}
          className={`relative w-10 h-5 rounded-full transition-colors ${config.enabled ? 'bg-indigo-600' : 'bg-zinc-700'} ${!config.agentCanOverride ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {!config.agentOverrideAllowed && (
        <p className="text-[13px] text-zinc-600">Controlado por el admin — no puedes cambiar esto</p>
      )}

      {/* Target language override */}
      {config.agentOverrideAllowed && (
        <div>
          <label className="block text-[12px] text-zinc-500 mb-1 font-bold">Idioma destino (este chat)</label>
          <select
            value={targetLang}
            onChange={e => handleLangChange(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Auto-detectar</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="pt">Português</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="it">Italiano</option>
            <option value="ru">Русский</option>
            <option value="zh">中文</option>
            <option value="ar">العربية</option>
            <option value="ja">日本語</option>
          </select>
        </div>
      )}

      {/* Info */}
      <div className="text-[11px] text-zinc-500">
        {config.enabled
          ? `Los mensajes salientes se traducirán a ${config.targetLang?.toUpperCase() || 'auto'} antes de enviarse al usuario.`
          : 'La traducción automática está desactivada para este chat.'}
        {config.deliveryMode === 'both' && config.enabled && (
          <span className="block mt-1 text-indigo-400/70">Modo: Original + Traducción</span>
        )}
      </div>
    </div>
  );
}

function SidebarIncomingTranslation({ sessionId, config, onConfigChange }: {
  sessionId: string;
  config: IncomingConfig;
  onConfigChange: (cfg: IncomingConfig) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [targetLang, setTargetLang] = useState('');

  const toggleEnabled = async () => {
    if (!config.agentOverrideAllowed) return;
    setSaving(true);
    try {
      const next = !config.enabled;
      await updateSessionIncomingTranslation(sessionId, { incomingEnabled: next });
      onConfigChange({ ...config, enabled: next });
    } catch { /* silent */ }
    setSaving(false);
  };

  const handleLangChange = async (lang: string) => {
    setTargetLang(lang);
    setSaving(true);
    try {
      await updateSessionIncomingTranslation(sessionId, { incomingTargetLang: lang || undefined });
      onConfigChange({ ...config, targetLang: lang || config.targetLang });
    } catch { /* silent */ }
    setSaving(false);
  };

  return (
    <div className="px-4 pb-3 space-y-3 pt-2 border-t border-zinc-800/50">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-cyan-400" />
          <span className="text-sm text-zinc-200 font-medium">Auto-Translate entrante</span>
        </div>
        <button
          onClick={toggleEnabled}
          disabled={saving || !config.agentOverrideAllowed}
          className={`relative w-10 h-5 rounded-full transition-colors ${config.enabled ? 'bg-cyan-600' : 'bg-zinc-700'} ${!config.agentOverrideAllowed ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {!config.agentOverrideAllowed && (
        <p className="text-[13px] text-zinc-600">Controlado por el admin — no puedes cambiar esto</p>
      )}

      {/* Target language override */}
      {config.agentOverrideAllowed && (
        <div>
          <label className="block text-[12px] text-zinc-500 mb-1 font-bold">Idioma destino entrante (este chat)</label>
          <select
            value={targetLang}
            onChange={e => handleLangChange(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-2 py-1.5 text-xs focus:border-cyan-500 focus:outline-none"
          >
            <option value="">Usar default del sistema</option>
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="pt">Português</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="it">Italiano</option>
            <option value="ru">Русский</option>
            <option value="zh">中文</option>
            <option value="ar">العربية</option>
            <option value="ja">日本語</option>
          </select>
        </div>
      )}

      {/* Info */}
      <div className="text-[11px] text-zinc-500">
        {config.enabled
          ? `Los mensajes del usuario se traducirán a ${config.targetLang?.toUpperCase() || 'auto'} en tiempo real.`
          : 'La traducción entrante está desactivada para este chat.'}
        {config.showOriginal && config.enabled && (
          <span className="block mt-1 text-cyan-400/70">Se mostrará el mensaje original junto a la traducción.</span>
        )}
      </div>
    </div>
  );
}


interface SidebarSectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: number;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
}

function SidebarSection({ title, icon, isExpanded, onToggle, badge, children, className, headerClassName }: SidebarSectionProps) {
  return (
    <div className={`overflow-hidden transition-all duration-300 ${className || 'border-b border-zinc-800/50 last:border-0'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-4 group transition-all rounded-lg ${isExpanded
          ? 'bg-zinc-900/50 text-zinc-50'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/30'
          } ${headerClassName}`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-md transition-colors ${isExpanded ? 'bg-zinc-800' : 'bg-zinc-900 group-hover:bg-zinc-800'}`}>
            {icon}
          </div>
          <span className="text-sm font-medium">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 rounded-md border border-indigo-500/20 min-w-[20px] text-center">
              {badge}
            </span>
          )}
        </div>

        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </div>
      </button>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
          }`}
      >
        <div className="p-0 pt-0">
          {children}
        </div>
      </div>
    </div>
  );
}
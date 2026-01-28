// Chat Info Sidebar - Main component

import { useState, useEffect, useCallback } from 'react';
import {
  X, User, MessageSquare, Clock, Tag, StickyNote, Settings, History, ChevronDown, ChevronRight, Loader2, AlertCircle, Activity, Timer
  // for copilot
  , Bot,
} from 'lucide-react';
import type { ContactInfo } from '../types';
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
import { CopilotPanel } from './copilot';
import { CopilotSection } from './sidebar/Copilot';

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
  // Default expanded sections logic
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set([])
  );

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
      else setError('No se pudo cargar la información');
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };
  if (!isOpen) return null;

  return (
    <div className="w-70 bg-white dark:bg-[#0f1117] border-l border-gray-200 dark:border-zinc-800 flex flex-col h-full shadow-xl z-0">

      {/* Header Compacto */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800 bg-zinc-900/90 h-[56px]">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm tracking-wide">
          <User className="w-4 h-4 text-indigo-500" />
          Detalles del Contacto
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-xs text-gray-400">Cargando perfil...</p>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="m-6 p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg text-center">
            <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
            <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>
            <button onClick={fetchContactInfo} className="mt-2 text-xs text-red-700 underline">
              Reintentar
            </button>
          </div>
        )}

        {/* Empty State */}
        {!sessionId && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center opacity-60">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">Selecciona un chat para ver detalles</p>
          </div>
        )}

        {/* Content */}
        {contactInfo && !isLoading && (
          <div className="pb-10">
            {/* Profile Header Card */}
            <div className="px-6 py-6 bg-gradient-to-b from-gray-50/80 to-white dark:from-gray-900/50 dark:to-[#0f1117] border-b border-gray-100 dark:border-gray-800">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-3">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold ring-4 ring-white dark:ring-[#0f1117] ${contactInfo.user?.photoFileId ? '' : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20'}`}>
                    {
                      contactInfo.user?.photoFileId ? (
                        <img
                          src={`/api/media/${contactInfo.user.photoFileId}`}
                          alt={`${contactInfo.user.firstName} ${contactInfo.user.lastName}`}
                          className="w-full h-full object-cover rounded-full"
                        />
                      ) : (
                        <>
                          {contactInfo.user.firstName.charAt(0).toUpperCase()}
                          {contactInfo.user.lastName ? contactInfo.user.lastName.charAt(0).toUpperCase() : ''}
                        </>
                      )
                    }
                  </div>
                  {/* Status Indicator */}
                  <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-[#0f1117] ${contactInfo.session.status === 'open' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                </div>

                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {contactInfo.user.firstName} {contactInfo.user.lastName}
                </h2>

                {contactInfo.user.username && (
                  <a
                    href={`https://t.me/${contactInfo.user.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors mt-0.5"
                  >
                    @{contactInfo.user.username}
                  </a>
                )}

                <div className="flex items-center gap-4 mt-4 w-full justify-center">
                  <div className="flex flex-col items-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 min-w-[70px]">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Chats</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{contactInfo.stats.totalSessions}</span>
                  </div>
                  <div className="flex flex-col items-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 min-w-[70px]">
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Msgs</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{contactInfo.stats.totalMessages}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sections */}
            <div className="px-2 mt-2 space-y-1">
              {/* Copilot Section (Highlighted) */}

              <SidebarSection
                title="Estado"
                icon={<Activity className="w-4 h-4 text-blue-500" />}
                isExpanded={expandedSections.has('status')}
                onToggle={() => toggleSection('status')}
              >
                <SidebarConversationStatus {...contactInfo.session} />
              </SidebarSection>

              <SidebarSection
                title="Tiempo activo"
                icon={<Timer className="w-4 h-4 text-orange-500" />}
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
                title="Notas"
                icon={<StickyNote className="w-4 h-4 text-yellow-500" />}
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
                title="Etiquetas"
                icon={<Tag className="w-4 h-4 text-emerald-500" />}
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
                title="Programados"
                icon={<Clock className="w-4 h-4 text-teal-500" />}
                isExpanded={expandedSections.has('scheduled')}
                onToggle={() => toggleSection('scheduled')}
                badge={scheduledCount}
              >
                <ScheduledMessagesList sessionId={sessionId || ''} onCountChange={setScheduledCount} />
              </SidebarSection>

              <SidebarSection
                title="Historial"
                icon={<History className="w-4 h-4 text-gray-500" />}
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
                title='Linea de tiempo'
                icon={<Activity className="w-4 h-4 text-yellow-600" />}
                isExpanded={expandedSections.has('activity')}
                onToggle={() => toggleSection('activity')}
              >
                {sessionId && <ActivityTimeline sessionId={sessionId} />}
              </SidebarSection>

              <SidebarSection
                title="AI Copilot"
                icon={<> <Bot className="w-4 h-4 text-pink-500" /> </>}
                isExpanded={expandedSections.has('copilot')}
                onToggle={() => toggleSection('copilot')}
              >
                {sessionId && <CopilotSection sessionId={sessionId} />}
              </SidebarSection>


              {/* Advanced / Meta Sections */}
              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800 mx-2">
                <p className="px-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Metadatos</p>

                <SidebarSection
                  title="Identidad"
                  icon={<User className="w-4 h-4 text-gray-400" />}
                  isExpanded={expandedSections.has('identity')}
                  onToggle={() => toggleSection('identity')}
                >
                  <SidebarUserIdentity user={contactInfo.user} />
                </SidebarSection>

                <SidebarSection
                  title="Campos Sistema"
                  icon={<Settings className="w-4 h-4 text-gray-400" />}
                  isExpanded={expandedSections.has('system')}
                  onToggle={() => toggleSection('system')}
                >
                  <SidebarSystemFields user={contactInfo.user} />
                </SidebarSection>
                <SidebarSection
                  title="Campos Personalizados"
                  icon={<Settings className="w-4 h-4 text-gray-400" />}
                  isExpanded={expandedSections.has('custom')}
                  onToggle={() => toggleSection('custom')}
                >
                  <SidebarCustomFields
                    userId={contactInfo.user.id}
                    fields={contactInfo.customFields}
                    onFieldUpdated={fetchContactInfo}
                  />
                </SidebarSection>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Collapsible section component con mejor UI
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
    <div className={`transition-all duration-200 ${className || 'border-b border-transparent'}`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 group transition-colors rounded-lg ${isExpanded ? 'bg-gray-50 dark:bg-gray-800/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
          } ${headerClassName}`}
      >
        <div className="flex items-center gap-3">
          <div className={`opacity-70 group-hover:opacity-100 transition-opacity ${isExpanded ? 'opacity-100' : ''}`}>
            {icon}
          </div>
          <span className={`text-sm font-medium ${isExpanded ? 'text-gray-900 dark:text-gray-100' : 'text-gray-600 dark:text-gray-400'}`}>
            {title}
          </span>
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
        )}
      </button>

      {isExpanded && (
        <div className="animate-in slide-in-from-top-1 fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
}


// Chat Info Sidebar - Main component
import { useState, useEffect, useCallback } from 'react';
import { 
  X, User, MessageSquare, Clock, Tag, StickyNote, Settings, History,
  Zap, ChevronDown, ChevronRight, Loader2, AlertCircle
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

interface ChatInfoSidebarProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatInfoSidebar({ sessionId, isOpen, onClose }: ChatInfoSidebarProps) {
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
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

            {/* Entry Source */}
            <SidebarSection
              title="Origen del ingreso"
              icon={<MessageSquare className="w-4 h-4" />}
              isExpanded={expandedSections.has('source')}
              onToggle={() => toggleSection('source')}
            >
              <div className="px-4 py-2">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Aceptación de ingreso a través de
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-medium">
                    📱 {contactInfo.user.platform === 'telegram' ? 'Telegram' : contactInfo.user.platform}
                  </span>
                </div>
              </div>
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

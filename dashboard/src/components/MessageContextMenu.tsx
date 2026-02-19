import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Reply, Copy, Pin, Link2, Pencil, Trash2,
  Star, Ban, Tag, FileText, AlertTriangle,
  Quote, PinOff, Languages, Eye, EyeOff, ClipboardCopy, Globe, Flag
} from 'lucide-react';
import type { Message } from '../types';
import { useAuthStore } from '../stores/authStore';

// ============= TYPES =============

export interface MessageAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'warning';
  disabled?: boolean;
}

interface MessageContextMenuProps {
  message: Message;
  position: { x: number; y: number };
  isPinned?: boolean;
  onClose: () => void;
  onReply: (message: Message) => void;
  onCopy: (message: Message) => void;
  onPin: (message: Message) => void;
  onUnpin: (message: Message) => void;
  onCopyLink: (message: Message) => void;
  onEdit?: (message: Message) => void;
  onDelete?: (message: Message) => void;
  onSaveQuickReply?: (message: Message) => void;
  onBlockUser?: (message: Message) => void;
  onAddTag?: (message: Message) => void;
  onAddNote?: (message: Message) => void;
  onReportSpam?: (message: Message) => void;
  onTranslate?: (message: Message, targetLang: string) => void;
  onDisableIncomingTranslate?: (message: Message) => void;
  onReportTranslation?: (message: Message) => void;
}

// ============= CONSTANTS =============

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ============= COMPONENT =============

export default function MessageContextMenu({
  message,
  position,
  isPinned,
  onClose,
  onReply,
  onCopy,
  onPin,
  onUnpin,
  onCopyLink,
  onEdit,
  onDelete,
  onSaveQuickReply,
  onBlockUser,
  onAddTag,
  onAddNote,
  onReportSpam,
  onTranslate,
  onDisableIncomingTranslate,
  onReportTranslation,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const agent = useAuthStore((state) => state.agent);
  const [showTranslateSub, setShowTranslateSub] = useState(false);
  const translateBtnRef = useRef<HTMLButtonElement>(null);
  const [translateSubPos, setTranslateSubPos] = useState<{ top: number; left: number } | null>(null);

  // ============= LOGIC =============

  const isAgentMessage = message.sender === 'agent';
  const isUserMessage = message.sender === 'user';
  const isSystemMessage = message.sender === 'bot' && message.messageType === 'system';

  const isOwnMessage = isAgentMessage && message.senderAgent?.name === agent?.name;
  const messageAge = Date.now() - new Date(message.createdAt).getTime();
  const isEditable = isOwnMessage && messageAge < ONE_DAY_MS;

  const actions: MessageAction[] = [];

  // cuando se hace scroll, el menu se cierra
  useEffect(() => {
    const handleScroll = (e: Event) => {
      // Don't close when scrolling inside the translate sub-menu or the menu itself
      const target = e.target as HTMLElement;
      if (target?.closest?.('[data-translate-portal]') || menuRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  // 1. Interactions
  if (!isSystemMessage) {
    actions.push({ id: 'reply', label: 'Responder', icon: <Reply className="w-4 h-4" />, onClick: () => { onReply(message); onClose(); } });
  }
  actions.push({ id: 'copy', label: 'Copiar texto', icon: <Copy className="w-4 h-4" />, onClick: () => { onCopy(message); onClose(); } });

  // ─── Outgoing Translation Actions ───
  if (message.translation?.isTranslated && isAgentMessage) {
    actions.push({
      id: 'view-original',
      label: 'Ver original',
      icon: <Eye className="w-4 h-4" />,
      onClick: () => {
        navigator.clipboard.writeText(message.translation!.originalContent);
        // Dispatch event for ChatWindow to show original as tooltip/toast
        window.dispatchEvent(new CustomEvent('translation:showOriginal', {
          detail: { messageId: message._id, originalContent: message.translation!.originalContent }
        }));
        onClose();
      },
    });
    actions.push({
      id: 'copy-translated',
      label: 'Copiar traducido',
      icon: <ClipboardCopy className="w-4 h-4" />,
      onClick: () => {
        navigator.clipboard.writeText(message.content);
        onClose();
      },
    });
  }

  // ─── Incoming Translation Actions ───
  if (message.incomingTranslation?.translatedContent && isUserMessage) {
    actions.push({
      id: 'view-original-incoming',
      label: 'Ver original',
      icon: <Eye className="w-4 h-4" />,
      onClick: () => {
        navigator.clipboard.writeText(message.content);
        window.dispatchEvent(new CustomEvent('translation:showOriginal', {
          detail: { messageId: message._id, originalContent: message.content }
        }));
        onClose();
      },
    });
    actions.push({
      id: 'copy-incoming-translated',
      label: 'Copiar traducción',
      icon: <ClipboardCopy className="w-4 h-4" />,
      onClick: () => {
        navigator.clipboard.writeText(message.incomingTranslation!.translatedContent);
        onClose();
      },
    });
    if (onDisableIncomingTranslate) {
      actions.push({
        id: 'disable-incoming-translate',
        label: 'Desactivar auto-translate',
        icon: <EyeOff className="w-4 h-4" />,
        onClick: () => { onDisableIncomingTranslate(message); onClose(); },
        variant: 'warning',
      });
    }
    if (onReportTranslation) {
      actions.push({
        id: 'report-translation',
        label: 'Reportar traducción',
        icon: <Flag className="w-4 h-4" />,
        onClick: () => { onReportTranslation(message); onClose(); },
        variant: 'warning',
      });
    }
  }

  // Translate action (available on all non-system messages with content)
  if (!isSystemMessage && message.content && onTranslate) {
    actions.push({
      id: 'translate',
      label: 'Traducir',
      icon: <Languages className="w-4 h-4" />,
      onClick: () => {
        setShowTranslateSub(prev => {
          const next = !prev;
          if (next && translateBtnRef.current) {
            const rect = translateBtnRef.current.getBoundingClientRect();
            const sub_w = 176; // w-44
            const sub_h = 280;
            let left = rect.right + 4;
            let top = rect.top;
            if (left + sub_w > window.innerWidth) left = rect.left - sub_w - 4;
            if (top + sub_h > window.innerHeight) top = window.innerHeight - sub_h - 8;
            setTranslateSubPos({ top, left });
          }
          return next;
        });
      },
    });
  }

  // 2. Organization
  if (!isSystemMessage) {
    actions.push({
      id: isPinned ? 'unpin' : 'pin',
      label: isPinned ? 'Desfijar' : 'Fijar',
      icon: isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />,
      onClick: () => { (isPinned ? onUnpin : onPin)(message); onClose(); }
    });
  }

  // 3. Agent Tools
  if (isAgentMessage && isOwnMessage) {
    if (isEditable && onEdit) {
      actions.push({ id: 'edit', label: 'Editar', icon: <Pencil className="w-4 h-4" />, onClick: () => { onEdit(message); onClose(); } });
    }
    if (onSaveQuickReply) {
      actions.push({ id: 'save-reply', label: 'Guardar', icon: <Star className="w-4 h-4" />, onClick: () => { onSaveQuickReply(message); onClose(); } });
    }
    if (onDelete) {
      actions.push({ id: 'delete', label: 'Eliminar', icon: <Trash2 className="w-4 h-4" />, onClick: () => { onDelete(message); onClose(); }, variant: 'danger' });
    }
  }

  // 4. User Tools
  if (isUserMessage) {
    if (onAddTag) actions.push({ id: 'tag', label: 'Etiquetar', icon: <Tag className="w-4 h-4" />, onClick: () => { onAddTag(message); onClose(); } });
    if (onAddNote) actions.push({ id: 'note', label: 'Crear nota', icon: <FileText className="w-4 h-4" />, onClick: () => { onAddNote(message); onClose(); } });
    actions.push({ id: 'link', label: 'Copiar enlace', icon: <Link2 className="w-4 h-4" />, onClick: () => { onCopyLink(message); onClose(); } });

    // Danger Zone
    if (onReportSpam) actions.push({ id: 'spam', label: 'Reportar Spam', icon: <AlertTriangle className="w-4 h-4" />, onClick: () => { onReportSpam(message); onClose(); }, variant: 'warning' });
    if (onBlockUser) actions.push({ id: 'block', label: 'Bloquear Usuario', icon: <Ban className="w-4 h-4" />, onClick: () => { onBlockUser(message); onClose(); }, variant: 'danger' });
  }

  // ============= EFFECTS =============

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
          menuRef.current &&
          !menuRef.current.contains(e.target as Node) &&
          !(e.target as HTMLElement).closest?.('[data-translate-portal]')
        ) onClose();
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = position.y;
      let left = position.x;

      if (left + rect.width > viewportWidth) left = left - rect.width;
      if (top + rect.height > viewportHeight) top = top - rect.height;

      menuRef.current.style.top = `${top}px`;
      menuRef.current.style.left = `${left}px`;
      menuRef.current.style.opacity = '1';
    }
  }, [position]);

  // ============= RENDER =============

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[240px] flex flex-col bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150 opacity-0 overflow-hidden"
      style={{ top: position.y, left: position.x }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header Preview */}
      {/* <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`p-1 rounded-md ${message.sender === 'user' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            <Quote className="w-3 h-3" />
          </div>
          <span className="text-[10px] font-bold text-zinc-500 st">
            {message.sender === 'user' ? 'Usuario' : 'Agente'}
          </span>
        </div>
        <p className="text-xs text-zinc-300 line-clamp-2 italic font-medium">
          "{message.content || 'Adjunto'}"
        </p>
      </div> */}

      {/* Actions List */}
      <div className="p-1.5 flex flex-col gap-0.5">
        {actions.map((action) => (
          <div key={action.id} className="relative">
            <button
              onClick={action.onClick}
              ref={action.id === 'translate' ? translateBtnRef : undefined}
              disabled={action.disabled}
              className={`
                group flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-all duration-200 w-full text-left
                ${action.variant === 'danger'
                  ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                  : action.variant === 'warning'
                    ? 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }
                ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              <div className="flex items-center gap-3">
                <span className={`transition-opacity ${action.variant === 'danger' ? 'text-red-500' : 'text-zinc-500 group-hover:text-current'}`}>
                  {action.icon}
                </span>
                <span className="font-medium">{action.label}</span>
              </div>
              {action.id === 'translate' && (
                <span className="text-zinc-600 text-xs">▸</span>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Translate sub-menu — Portal to avoid overflow clipping */}
      {showTranslateSub && translateSubPos && createPortal(
        <TranslateLanguageSubMenu
          position={translateSubPos}
          onSelect={(lang) => { onTranslate?.(message, lang); onClose(); }}
          onClose={() => setShowTranslateSub(false)}
        />,
        document.body,
      )}
    </div>
  );
}

// ─── Translate Language Sub-Menu ────────────────────────────

const TRANSLATE_LANGS = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'it', name: 'Italiano' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ar', name: 'العربية' },
];

function TranslateLanguageSubMenu({ position, onSelect, onClose }: {
  position: { top: number; left: number };
  onSelect: (lang: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handler); };
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-translate-portal
      className="fixed w-44 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-xl shadow-2xl z-[99999] animate-in fade-in slide-in-from-left-1 duration-150 overflow-hidden"
      style={{ top: position.top, left: position.left }}
    >
      <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase">
          <Languages className="w-3 h-3" />
          Traducir a
        </div>
      </div>
      <div className="max-h-52 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-zinc-700">
        {TRANSLATE_LANGS.map((lang) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => onSelect(lang.code)}
            className="w-full text-left px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-all flex items-center justify-between"
          >
            <span className="font-medium">{lang.name}</span>
            <span className="text-[10px] font-mono text-zinc-600 uppercase">{lang.code}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
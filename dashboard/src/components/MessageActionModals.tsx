/**
 * Message Action Modals
 * Modals for edit, delete, save quick reply, etc.
 */

import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Save, Pencil, Star, FileText, Tag, CheckCircle } from 'lucide-react';
import type { Message } from '../types';

// ============= BASE MODAL =============

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

function BaseModal({ isOpen, onClose, title, children, footer }: BaseModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 animate-modal-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ============= EDIT MESSAGE MODAL =============

interface EditMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  onSave: (messageId: string, newContent: string) => void;
}

export function EditMessageModal({ isOpen, onClose, message, onSave }: EditMessageModalProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (message) {
      setContent(message.content);
    }
  }, [message]);

  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(content.length, content.length);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!message || !content.trim() || content === message.content) return;

    setIsSaving(true);
    try {
      await onSave(message._id, content.trim());
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = message && content.trim() !== message.content;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar mensaje"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⟳</span>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-sm text-gray-400">
          <Pencil className="w-4 h-4 inline mr-2" />
          Edita el contenido del mensaje. El cambio será visible para el usuario.
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="Escribe el mensaje..."
        />
        <p className="text-xs text-gray-500">
          El mensaje mostrará "(editado)" después de guardarse.
        </p>
      </div>
    </BaseModal>
  );
}

// ============= DELETE MESSAGE MODAL =============

interface DeleteMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  onConfirm: (messageId: string) => void;
}

export function DeleteMessageModal({ isOpen, onClose, message, onConfirm }: DeleteMessageModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!message) return;

    setIsDeleting(true);
    try {
      await onConfirm(message._id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Eliminar mensaje"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <span className="animate-spin">⟳</span>
                Eliminando...
              </>
            ) : (
              'Eliminar'
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-400">
            Esta acción no se puede deshacer. El mensaje será reemplazado por "Mensaje eliminado por el agente".
          </div>
        </div>

        {message && (
          <div className="p-3 bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-400 mb-1">Mensaje a eliminar:</p>
            <p className="text-white text-sm">{message.content}</p>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

// ============= SAVE QUICK REPLY MODAL =============

interface SaveQuickReplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
  onSave: (data: { title: string; content: string; category: string; shortcut?: string }) => void;
}

const REPLY_CATEGORIES = [
  'General',
  'Soporte',
  'Facturación',
  'Técnico',
  'Saludos',
  'Despedidas',
  'Otro',
];

export function SaveQuickReplyModal({ isOpen, onClose, message, onSave }: SaveQuickReplyModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [shortcut, setShortcut] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (message) {
      setContent(message.content);
      setTitle('');
      setShortcut('');
    }
  }, [message]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;

    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        content: content.trim(),
        category,
        shortcut: shortcut.trim() || undefined,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const isValid = title.trim() && content.trim();

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Guardar como respuesta rápida"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || isSaving}
            className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⟳</span>
                Guardando...
              </>
            ) : (
              <>
                <Star className="w-4 h-4" />
                Guardar
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <Star className="w-4 h-4" />
          Guarda este mensaje para usarlo rápidamente con /atajo
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Nombre *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Ej: Saludo inicial"
          />
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Categoría
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {REPLY_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Shortcut */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Atajo (opcional)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">/</span>
            <input
              type="text"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
              className="w-full pl-7 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="saludo"
            />
          </div>
        </div>

        {/* Content */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Contenido *
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder="Escribe el contenido..."
          />
        </div>
      </div>
    </BaseModal>
  );
}

// ============= ADD NOTE MODAL =============

interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
}

export function AddNoteModal({ isOpen, onClose, onSave }: AddNoteModalProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      await onSave(content.trim());
      setContent('');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar nota interna"
      footer={
        <>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim() || isSaving}
            className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⟳</span>
                Guardando...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Guardar
              </>
            )}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Las notas internas solo son visibles para los agentes.
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-32 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          placeholder="Escribe una nota sobre este chat o usuario..."
          autoFocus
        />
      </div>
    </BaseModal>
  );
}

// ============= TAG SELECTOR MODAL =============

interface TagSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (tag: string) => void;
  existingTags?: string[];
}

const PREDEFINED_TAGS = [
  { id: 'bug', label: 'Bug', color: 'bg-red-500' },
  { id: 'billing', label: 'Facturación', color: 'bg-green-500' },
  { id: 'feedback', label: 'Feedback', color: 'bg-purple-500' },
  { id: 'urgent', label: 'Urgente', color: 'bg-orange-500' },
  { id: 'vip', label: 'VIP', color: 'bg-yellow-500' },
  { id: 'resolved', label: 'Resuelto', color: 'bg-blue-500' },
];

export function TagSelectorModal({ isOpen, onClose, onSelect, existingTags = [] }: TagSelectorModalProps) {
  const [customTag, setCustomTag] = useState('');

  const handleSelectTag = (tagId: string) => {
    onSelect(tagId);
    onClose();
  };

  const handleAddCustom = () => {
    if (customTag.trim()) {
      onSelect(customTag.trim().toLowerCase());
      setCustomTag('');
      onClose();
    }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Añadir etiqueta"
    >
      <div className="space-y-4">
        <div className="text-sm text-gray-400 flex items-center gap-2">
          <Tag className="w-4 h-4" />
          Selecciona o crea una etiqueta para este usuario.
        </div>

        {/* Predefined tags */}
        <div className="flex flex-wrap gap-2">
          {PREDEFINED_TAGS.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleSelectTag(tag.id)}
              disabled={existingTags.includes(tag.id)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${existingTags.includes(tag.id)
                  ? 'opacity-50 cursor-not-allowed bg-gray-700 text-gray-400'
                  : `${tag.color} text-white hover:opacity-80`
                }
              `}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Custom tag input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={customTag}
            onChange={(e) => setCustomTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Etiqueta personalizada..."
          />
          <button
            onClick={handleAddCustom}
            disabled={!customTag.trim()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Añadir
          </button>
        </div>
      </div>
    </BaseModal>
  );
}

// ============= REPLY PREVIEW COMPONENT =============

interface ReplyPreviewProps {
  message: Message;
  onClear: () => void;
}

export function ReplyPreview({ message, onClear }: ReplyPreviewProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border-l-2 border-primary rounded-r-lg">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-primary font-medium">
          Respondiendo a {message.sender === 'user' ? 'Usuario' : message.senderAgent?.name || 'Agente'}
        </p>
        <p className="text-sm text-gray-400 truncate">{message.content}</p>
      </div>
      <button
        onClick={onClear}
        className="p-1 text-gray-500 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ============= PINNED MESSAGE MODAL CONFIRMATION COMPONENT =============
interface PinnedMessageConfirmationModalProps {
  isOpen: boolean;
  message: Message;
  onConfirm: () => void;
  onCancel: () => void;
  pinForUser: boolean;
  onPinForUserChange: (value: boolean) => void;
}

export function PinnedMessageConfirmationModal({ isOpen, message, onConfirm, onCancel, pinForUser, onPinForUserChange }: PinnedMessageConfirmationModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      title="Confirmar mensaje fijado"
      footer={
        <>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg transition-colors flex items-center gap-2"
          >
            Confirmar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {message && (
          <>
            <div className="p-3 bg-gray-800 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">Mensaje a fijar:</p>
              <p className="text-white text-sm">{message.content}</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={pinForUser}
                onChange={onPinForUserChange}
                label="Fijar también para el usuario"
              />
            </div>
          </>
        )}
      </div>
    </BaseModal>
  );

}


function Checkbox({ 
  checked, 
  onChange, 
  label 
}: { 
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group" onClick={() => onChange(!checked)}>
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-600 group-hover:border-gray-500'}`}>
        {checked && <CheckCircle className="w-3 h-3 text-white" />}
      </div>
      <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{label}</span>
    </label>
  );
}
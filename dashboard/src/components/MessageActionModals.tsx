import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Save, Pencil, Star, FileText, Tag, CheckCircle, Loader2 } from 'lucide-react';
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
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900">
          <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ============= EDIT MESSAGE MODAL =============

interface EditMessageModalProps { isOpen: boolean; onClose: () => void; message: Message | null; onSave: (id: string, content: string) => void; }

export function EditMessageModal({ isOpen, onClose, message, onSave }: EditMessageModalProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (message) setContent(message.content); }, [message]);
  useEffect(() => { if (isOpen) { textareaRef.current?.focus(); textareaRef.current?.setSelectionRange(content.length, content.length); } }, [isOpen]);

  const handleSave = async () => {
    if (!message || !content.trim() || content === message.content) return;
    setIsSaving(true);
    try { await onSave(message._id, content.trim()); onClose(); } finally { setIsSaving(false); }
  };

  const hasChanges = message && content.trim() !== message.content;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Editar mensaje"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">Cancelar</button>
          <button onClick={handleSave} disabled={!hasChanges || isSaving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-300 text-sm">
          <Pencil className="w-4 h-4 mt-0.5 shrink-0" />
          <p>Estás editando un mensaje enviado. El cambio será visible para el usuario.</p>
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-32 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-all text-sm leading-relaxed"
          placeholder="Escribe el mensaje..."
        />
        <p className="text-xs text-zinc-500 text-right">Se añadirá la etiqueta (editado)</p>
      </div>
    </BaseModal>
  );
}

// ============= DELETE MESSAGE MODAL =============

interface DeleteMessageModalProps { isOpen: boolean; onClose: () => void; message: Message | null; onConfirm: (id: string) => void; }

export function DeleteMessageModal({ isOpen, onClose, message, onConfirm }: DeleteMessageModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!message) return;
    setIsDeleting(true);
    try { await onConfirm(message._id); onClose(); } finally { setIsDeleting(false); }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Eliminar mensaje"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">Cancelar</button>
          <button onClick={handleDelete} disabled={isDeleting} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="text-sm text-red-300">Esta acción no se puede deshacer. El mensaje será reemplazado por un aviso de eliminación.</div>
        </div>
        {message && (
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
            <p className="text-xs text-zinc-500 font-bold mb-2">Mensaje a eliminar</p>
            <p className="text-zinc-300 text-sm italic">"{message.content}"</p>
          </div>
        )}
      </div>
    </BaseModal>
  );
}

// ============= SAVE QUICK REPLY MODAL =============

interface SaveQuickReplyModalProps { isOpen: boolean; onClose: () => void; message: Message | null; onSave: (data: any) => void; }
const REPLY_CATEGORIES = ['General', 'Soporte', 'Facturación', 'Técnico', 'Saludos', 'Despedidas', 'Otro'];

export function SaveQuickReplyModal({ isOpen, onClose, message, onSave }: SaveQuickReplyModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('General');
  const [shortcut, setShortcut] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { if (message) { setContent(message.content); setTitle(''); setShortcut(''); } }, [message]);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setIsSaving(true);
    try { await onSave({ title: title.trim(), content: content.trim(), category, shortcut: shortcut.trim() || undefined }); onClose(); } finally { setIsSaving(false); }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Respuesta Rápida"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">Cancelar</button>
          <button onClick={handleSave} disabled={!title.trim() || !content.trim() || isSaving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />} Guardar
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1.5">Nombre</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none transition-all" placeholder="Ej: Saludo" />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1.5">Categoría</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none transition-all">
              {REPLY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">Atajo (Opcional)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm font-mono">/</span>
            <input type="text" value={shortcut} onChange={(e) => setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} className="w-full pl-6 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none transition-all font-mono" placeholder="saludo" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">Contenido</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full h-24 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-indigo-500 focus:outline-none resize-none transition-all" placeholder="Texto del mensaje..." />
        </div>
      </div>
    </BaseModal>
  );
}

// ============= ADD NOTE MODAL =============

interface AddNoteModalProps { isOpen: boolean; onClose: () => void; onSave: (content: string) => void; }

export function AddNoteModal({ isOpen, onClose, onSave }: AddNoteModalProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setIsSaving(true);
    try { await onSave(content.trim()); setContent(''); onClose(); } finally { setIsSaving(false); }
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar Nota Interna"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">Cancelar</button>
          <button onClick={handleSave} disabled={!content.trim() || isSaving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} Guardar Nota
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="text-xs text-zinc-500 flex items-center gap-2 bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
          <FileText className="w-4 h-4 text-zinc-400" />
          Las notas son privadas y solo visibles para el equipo.
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-32 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-all text-sm leading-relaxed"
          placeholder="Escribe detalles importantes sobre este usuario..."
          autoFocus
        />
      </div>
    </BaseModal>
  );
}

// ============= TAG SELECTOR MODAL =============

interface TagSelectorModalProps { isOpen: boolean; onClose: () => void; onSelect: (tag: string) => void; existingTags?: string[]; }
const PREDEFINED_TAGS = [
  { id: 'bug', label: 'Bug', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  { id: 'billing', label: 'Facturación', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { id: 'feedback', label: 'Feedback', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  { id: 'urgent', label: 'Urgente', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { id: 'vip', label: 'VIP', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { id: 'resolved', label: 'Resuelto', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
];

export function TagSelectorModal({ isOpen, onClose, onSelect, existingTags = [] }: TagSelectorModalProps) {
  const [customTag, setCustomTag] = useState('');
  const handleAddCustom = () => { if (customTag.trim()) { onSelect(customTag.trim().toLowerCase()); setCustomTag(''); onClose(); } };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Etiquetar Usuario">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {PREDEFINED_TAGS.map((tag) => (
            <button
              key={tag.id}
              onClick={() => { onSelect(tag.id); onClose(); }}
              disabled={existingTags.includes(tag.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${existingTags.includes(tag.id) ? 'opacity-30 cursor-not-allowed bg-zinc-800 text-zinc-500 border-zinc-700' : `${tag.color} hover:opacity-80`
                }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input type="text" value={customTag} onChange={(e) => setCustomTag(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()} className="flex-1 px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-white text-sm focus:border-indigo-500 outline-none transition-all placeholder-zinc-600" placeholder="Nueva etiqueta..." />
          <button onClick={handleAddCustom} disabled={!customTag.trim()} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">Añadir</button>
        </div>
      </div>
    </BaseModal>
  );
}

// ============= CONFIRM PIN MODAL =============

interface PinnedMessageConfirmationModalProps { isOpen: boolean; message: Message; onConfirm: () => void; onCancel: () => void; pinForUser: boolean; onPinForUserChange: (v: boolean) => void; }

export function PinnedMessageConfirmationModal({ isOpen, message, onConfirm, onCancel, pinForUser, onPinForUserChange }: PinnedMessageConfirmationModalProps) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      title="Fijar Mensaje"
      footer={
        <>
          <button onClick={onCancel} className="px-4 py-2 text-zinc-400 hover:text-white transition-colors text-sm font-medium">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-900/20">Confirmar</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
          <p className="text-zinc-300 text-sm italic">"{message?.content}"</p>
        </div>
        <Checkbox checked={pinForUser} onChange={onPinForUserChange} label="Fijar también para el usuario (visible en su chat)" />
      </div>
    </BaseModal>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string; }) {
  return (
    <div className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-zinc-900/50 rounded-lg transition-colors" onClick={() => onChange(!checked)}>
      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-zinc-600 group-hover:border-zinc-500'}`}>
        {checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
      </div>
      <span className="text-sm text-zinc-300 group-hover:text-white transition-colors select-none">{label}</span>
    </div>
  );
}
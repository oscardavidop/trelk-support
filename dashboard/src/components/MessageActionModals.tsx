/**
 * Chat Modals - Premium Zinc Refactor
 * High-fidelity modals for chat actions (Edit, Delete, Note, Pin, etc.)
 */

import { useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Save, Pencil, Star, FileText, Tag, CheckCircle, Loader2, Info, MessageSquare } from 'lucide-react';
import type { Message } from '../types';

// ============= BASE MODAL =============

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

function BaseModal({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-md' }: BaseModalProps) {
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={modalRef}
        className={`bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 w-full ${maxWidth} flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-300`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/30 border-b border-zinc-800/50 shrink-0">
          <h3 className="text-lg font-bold text-zinc-100 tracking-tight">{title}</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 bg-zinc-900/30 border-t border-zinc-800/50 flex justify-end gap-3 shrink-0">
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
      title="Editar Mensaje"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancelar</button>
          <button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving} 
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
            Guardar Cambios
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-xs leading-relaxed">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>Estás editando un mensaje ya enviado. Este cambio será visible para el usuario y se marcará como (editado).</p>
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-32 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none transition-all"
          placeholder="Escribe el mensaje modificado..."
        />
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
      title="Eliminar Mensaje"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancelar</button>
          <button 
            onClick={handleDelete} 
            disabled={isDeleting} 
            className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Eliminar Permanentemente'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-400/90 leading-relaxed">
            <strong>Esta acción no se puede deshacer.</strong> El mensaje será reemplazado por un aviso de eliminación en el chat del usuario.
          </div>
        </div>
        {message && (
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl border-l-2 border-l-red-500">
            <p className="text-[10px] text-zinc-500 font-bold uppercase  mb-1.5">Mensaje a eliminar</p>
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
      title="Crear Respuesta Rápida"
      maxWidth="max-w-lg"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancelar</button>
          <button 
            onClick={handleSave} 
            disabled={!title.trim() || !content.trim() || isSaving} 
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />} 
            Guardar Plantilla
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase ">Nombre Interno</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all" 
              placeholder="Ej: Saludo Inicial" 
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-500 uppercase ">Categoría</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)} 
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all"
            >
              {REPLY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase ">Atajo Rápido (Opcional)</label>
          <div className="relative flex items-center">
            <div className="absolute left-0 top-0 bottom-0 px-3 bg-zinc-900 border-r border-zinc-800 rounded-l-xl flex items-center justify-center text-zinc-500 font-mono text-sm">/</div>
            <input 
              type="text" 
              value={shortcut} 
              onChange={(e) => setShortcut(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} 
              className="w-full pl-10 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 text-sm font-mono focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none transition-all" 
              placeholder="saludo" 
            />
          </div>
          <p className="text-[10px] text-zinc-600">Úsalo escribiendo '/' seguido del atajo en el chat.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold text-zinc-500 uppercase ">Contenido del Mensaje</label>
          <textarea 
            value={content} 
            onChange={(e) => setContent(e.target.value)} 
            className="w-full h-28 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 text-sm focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 focus:outline-none resize-none transition-all leading-relaxed" 
            placeholder="Texto completo que se enviará al cliente..." 
          />
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
      title="Añadir Nota Interna"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancelar</button>
          <button 
            onClick={handleSave} 
            disabled={!content.trim() || isSaving} 
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} 
            Guardar Nota
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
          <FileText className="w-4 h-4 shrink-0" />
          <p>Las notas son privadas. El cliente no podrá ver este contenido.</p>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full h-32 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 resize-none transition-all leading-relaxed"
          placeholder="Añade contexto importante sobre este cliente o caso..."
          autoFocus
        />
      </div>
    </BaseModal>
  );
}

// ============= TAG SELECTOR MODAL =============

interface TagSelectorModalProps { isOpen: boolean; onClose: () => void; onSelect: (tag: string) => void; existingTags?: string[]; }
const PREDEFINED_TAGS = [
  { id: 'bug', label: 'Bug', color: 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' },
  { id: 'billing', label: 'Facturación', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' },
  { id: 'feedback', label: 'Feedback', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20' },
  { id: 'urgent', label: 'Urgente', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20' },
  { id: 'vip', label: 'VIP', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20' },
  { id: 'resolved', label: 'Resuelto', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20' },
];

export function TagSelectorModal({ isOpen, onClose, onSelect, existingTags = [] }: TagSelectorModalProps) {
  const [customTag, setCustomTag] = useState('');
  const handleAddCustom = () => { if (customTag.trim()) { onSelect(customTag.trim().toLowerCase()); setCustomTag(''); onClose(); } };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Etiquetar Conversación">
      <div className="space-y-6">
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase  mb-2 block">Etiquetas Rápidas</label>
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_TAGS.map((tag) => {
              const isAssigned = existingTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => { onSelect(tag.id); onClose(); }}
                  disabled={isAssigned}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isAssigned 
                      ? 'opacity-30 cursor-not-allowed bg-zinc-900 text-zinc-500 border-zinc-800' 
                      : tag.color
                  }`}
                >
                  <span className="flex items-center gap-1.5"><Tag className="w-3 h-3" /> {tag.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-500 uppercase  block">Crear Etiqueta Personalizada</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              value={customTag} 
              onChange={(e) => setCustomTag(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()} 
              className="flex-1 px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all" 
              placeholder="Ej: Seguimiento Semanal" 
            />
            <button 
              onClick={handleAddCustom} 
              disabled={!customTag.trim()} 
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              Añadir
            </button>
          </div>
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
          <button onClick={onCancel} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancelar</button>
          <button 
            onClick={onConfirm} 
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-500/20"
          >
            Fijar Mensaje
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="p-4 bg-zinc-900 border border-zinc-800 border-l-2 border-l-indigo-500 rounded-xl relative">
          <MessageSquare className="w-4 h-4 text-zinc-700 absolute top-4 left-4" />
          <p className="text-zinc-300 text-sm italic pl-7 leading-relaxed">"{message?.content}"</p>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 p-2 rounded-xl">
          <Checkbox checked={pinForUser} onChange={onPinForUserChange} label="Fijar también en el chat del cliente (ambos lados)" />
        </div>
      </div>
    </BaseModal>
  );
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string; }) {
  return (
    <div className="flex items-center gap-3 cursor-pointer group p-2 hover:bg-zinc-800/50 rounded-lg transition-colors" onClick={() => onChange(!checked)}>
      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${checked ? 'bg-indigo-600 border-indigo-500' : 'bg-zinc-900 border-zinc-600 group-hover:border-zinc-500'}`}>
        {checked && <CheckCircle className="w-3.5 h-3.5 text-white" />}
      </div>
      <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors select-none">{label}</span>
    </div>
  );
}

// ============= CLOSE CHAT MODAL =============

interface CloseChatModalProps { isOpen: boolean; onClose: () => void; onConfirm: () => void; closingChat: boolean; }

export function CloseChatModal({ isOpen, onClose, onConfirm, closingChat }: CloseChatModalProps) {
  return (
    closingChat ? (
      <BaseModal isOpen={isOpen} onClose={onClose} title="Cerrando Sesión">
        <div className="flex flex-col items-center justify-center gap-4 py-10">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse" />
            <Loader2 className="relative w-10 h-10 text-red-500 animate-spin" />
          </div>
          <p className="text-sm font-medium text-zinc-300">Finalizando y archivando conversación...</p>
        </div>
      </BaseModal>
    ) : (
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        title="Finalizar Conversación"
        footer={
          <>
            <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancelar</button>
            <button 
              onClick={onConfirm} 
              disabled={closingChat} 
              className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
            >
              Cerrar Chat Definitivamente
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-red-400/90 leading-relaxed">
              ¿Estás seguro de que quieres cerrar esta conversación? El cliente no podrá enviar más mensajes hasta que inicie una nueva sesión. Todo el historial permanecerá guardado.
            </div>
          </div>
        </div>
      </BaseModal>
    )
  );
}
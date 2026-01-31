import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Loader2, RefreshCw, StickyNote, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Note } from '../../types';
import { createNote, getUserNotes, deleteNote } from '../../services/contactApi';
import { toast } from '../../stores/toastStore';
import usePermissions from '../../hooks/usePermissions';

interface NotesProps {
  userId: string;
  sessionId: string;
  notesCount: number;
  latestNote?: { content: string; createdAt: string; createdBy: string; };
  onNoteAdded: () => void;
}

type NoteStatus = 'pending' | 'saved' | 'error';
interface OptimisticNote extends Note { _status?: NoteStatus; _tempId?: string; }

export function SidebarNotes({ userId, sessionId, notesCount, latestNote, onNoteAdded }: NotesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [allNotes, setAllNotes] = useState<OptimisticNote[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { can } = usePermissions();

  useEffect(() => { if (isAdding) textareaRef.current?.focus(); }, [isAdding]);

  // --- Logic Handlers ---
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const tempId = `temp_${Date.now()}`;
    const optimisticNote: OptimisticNote = { id: tempId, _tempId: tempId, _status: 'pending', content: newNote.trim(), createdAt: new Date().toISOString(), createdBy: { id: 'me', name: 'Tú' }, sessionId };

    if (showAll) setAllNotes(prev => [optimisticNote, ...prev]);
    setNewNote(''); setIsAdding(false);

    try {
      const note = await createNote(userId, optimisticNote.content, sessionId);
      if (note) {
        if (showAll) setAllNotes(prev => prev.map(n => n._tempId === tempId ? { ...note, _status: 'saved' } : n));
        onNoteAdded(); toast.success('Nota guardada');
      }
    } catch {
      if (showAll) setAllNotes(prev => prev.map(n => n._tempId === tempId ? { ...n, _status: 'error' } : n));
      toast.error('Error al guardar');
    }
  };

  const handleShowAll = async () => {
    if (showAll) { setShowAll(false); return; }
    setIsLoadingAll(true);
    try { const notes = await getUserNotes(userId); setAllNotes(notes.map(n => ({ ...n, _status: 'saved' }))); setShowAll(true); } 
    catch { toast.error('Error cargando historial'); } 
    finally { setIsLoadingAll(false); }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('¿Eliminar nota?')) return;
    setPendingDeletes(prev => new Set(prev).add(noteId));
    try { await deleteNote(noteId); setAllNotes(prev => prev.filter(n => n.id !== noteId)); onNoteAdded(); } 
    catch { toast.error('Error al eliminar'); } 
    finally { setPendingDeletes(prev => { const next = new Set(prev); next.delete(noteId); return next; }); }
  };

  if (!can('notes.read')) return <div className="px-4 py-2 text-xs text-zinc-500 italic">Sin permisos para ver notas.</div>;

  return (
    <div className="px-3 py-2 space-y-4">
      
      {/* 1. Add Note Input */}
      {!isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-zinc-700 hover:border-indigo-500/50 rounded-xl text-xs text-zinc-400 hover:text-indigo-400 hover:bg-zinc-900/50 transition-all group"
        >
          <Plus className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
          <span>Añadir nota interna</span>
        </button>
      ) : (
        <div className="bg-zinc-900 border border-indigo-500/30 rounded-xl p-3 shadow-lg shadow-indigo-900/10 animate-in zoom-in-95 duration-200">
          <textarea
            ref={textareaRef}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Escribe una nota..."
            className="w-full text-xs text-zinc-200 bg-transparent border-none p-0 focus:ring-0 resize-none min-h-[60px] outline-none placeholder-zinc-600"
            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
          />
          <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-zinc-800">
            <button onClick={() => setIsAdding(false)} className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Cancelar</button>
            <button onClick={handleAddNote} disabled={!newNote.trim()} className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-sm disabled:opacity-50 transition-all flex items-center gap-1.5">
              Guardar <Send className="w-3 h-3"/>
            </button>
          </div>
        </div>
      )}

      {/* 2. Latest Note Preview */}
      {!showAll && latestNote && !isAdding && (
        <div className="relative group pl-3">
            <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-yellow-500/50 rounded-full"></div>
            <div className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 rounded-lg p-3 transition-colors">
                <div className="flex justify-between items-start mb-1.5">
                    <span className="text-[10px] font-bold text-yellow-500  flex items-center gap-1.5">
                       <StickyNote className="w-3 h-3"/> Última nota
                    </span>
                    <span className="text-[10px] text-zinc-500">{formatDistanceToNow(new Date(latestNote.createdAt), { addSuffix: true, locale: es })}</span>
                </div>
                <p className="text-xs text-zinc-300 italic leading-relaxed line-clamp-3">"{latestNote.content}"</p>
                <div className="mt-2 text-[10px] font-medium text-zinc-500 flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 text-[9px] border border-zinc-700">
                        {latestNote.createdBy.charAt(0).toUpperCase()}
                    </div>
                    {latestNote.createdBy}
                </div>
            </div>
        </div>
      )}

      {/* 3. History Toggle */}
      {notesCount > 0 && (
        <button
            onClick={handleShowAll}
            disabled={isLoadingAll}
            className="w-full flex items-center justify-center gap-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 py-1 transition-colors"
        >
            {isLoadingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : showAll ? 'Ocultar historial' : `Ver ${notesCount} notas anteriores`}
        </button>
      )}

      {/* 4. Full List */}
      {showAll && allNotes.length > 0 && (
        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
          {allNotes.map((note) => (
            <div key={note.id} className="relative group bg-zinc-900 border border-zinc-800 rounded-xl p-3 hover:border-zinc-700 transition-all">
                <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[10px] font-bold text-zinc-400">{typeof note.createdBy === 'string' ? note.createdBy : note.createdBy.name}</span>
                    <span className="text-[10px] text-zinc-600">{formatDistanceToNow(new Date(note.createdAt), { locale: es })}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">{note.content}</p>
                
                {/* Actions */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {note._status === 'error' ? (
                        <button onClick={() => {}} className="p-1 text-red-400 hover:bg-red-500/10 rounded"><RefreshCw className="w-3 h-3"/></button>
                    ) : (
                        <button onClick={() => handleDeleteNote(note.id)} className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded transition-colors"><Trash2 className="w-3 h-3"/></button>
                    )}
                </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
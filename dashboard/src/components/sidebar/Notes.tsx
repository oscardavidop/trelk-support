// Notes Section with Optimistic UI
import { useState, useCallback } from 'react';
import { Plus, Trash2, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Note } from '../../types';
import { createNote, getUserNotes, deleteNote } from '../../services/contactApi';
import { toast } from '../../stores/toastStore';

interface NotesProps {
  userId: string;
  sessionId: string;
  notesCount: number;
  latestNote?: {
    content: string;
    createdAt: string;
    createdBy: string;
  };
  onNoteAdded: () => void;
}

// Optimistic note state
type NoteStatus = 'pending' | 'saved' | 'error';
interface OptimisticNote extends Note {
  _status?: NoteStatus;
  _tempId?: string;
}

export function SidebarNotes({ userId, sessionId, notesCount, latestNote, onNoteAdded }: NotesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [allNotes, setAllNotes] = useState<OptimisticNote[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    const tempId = `temp_${Date.now()}`;
    const optimisticNote: OptimisticNote = {
      id: tempId,
      _tempId: tempId,
      _status: 'pending',
      content: newNote.trim(),
      createdAt: new Date().toISOString(),
      createdBy: { id: 'me', name: 'Tú' },
      sessionId,
    };

    // Optimistic update
    if (showAll) {
      setAllNotes(prev => [optimisticNote, ...prev]);
    }
    setNewNote('');
    setIsAdding(false);
    setIsSaving(true);

    try {
      const note = await createNote(userId, optimisticNote.content, sessionId);
      if (note) {
        // Replace optimistic note with real one
        if (showAll) {
          setAllNotes(prev => prev.map(n => 
            n._tempId === tempId ? { ...note, _status: 'saved' as NoteStatus } : n
          ));
        }
        onNoteAdded();
        toast.success('Nota guardada', 'La nota se ha guardado correctamente');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      // Mark as error
      if (showAll) {
        setAllNotes(prev => prev.map(n => 
          n._tempId === tempId ? { ...n, _status: 'error' as NoteStatus } : n
        ));
      }
      toast.error('Error', 'No se pudo guardar la nota');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetryNote = async (note: OptimisticNote) => {
    if (!note._tempId) return;
    
    // Reset status to pending
    setAllNotes(prev => prev.map(n => 
      n._tempId === note._tempId ? { ...n, _status: 'pending' as NoteStatus } : n
    ));

    try {
      const savedNote = await createNote(userId, note.content, sessionId);
      if (savedNote) {
        setAllNotes(prev => prev.map(n => 
          n._tempId === note._tempId ? { ...savedNote, _status: 'saved' as NoteStatus } : n
        ));
        onNoteAdded();
        toast.success('Nota guardada', 'La nota se ha guardado correctamente');
      }
    } catch (error) {
      setAllNotes(prev => prev.map(n => 
        n._tempId === note._tempId ? { ...n, _status: 'error' as NoteStatus } : n
      ));
      toast.error('Error', 'No se pudo guardar la nota');
    }
  };

  const handleShowAll = async () => {
    if (showAll) {
      setShowAll(false);
      return;
    }
    
    setIsLoadingAll(true);
    try {
      const notes = await getUserNotes(userId);
      setAllNotes(notes.map(n => ({ ...n, _status: 'saved' as NoteStatus })));
      setShowAll(true);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast.error('Error', 'No se pudieron cargar las notas');
    } finally {
      setIsLoadingAll(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    
    // Optimistic delete - mark as pending
    setPendingDeletes(prev => new Set(prev).add(noteId));
    
    try {
      await deleteNote(noteId);
      setAllNotes(prev => prev.filter(n => n.id !== noteId));
      onNoteAdded();
      toast.info('Nota eliminada');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Error', 'No se pudo eliminar la nota');
    } finally {
      setPendingDeletes(prev => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    }
  };

  return (
    <div className="px-4 py-2 space-y-3">
      {/* Add note button */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          <Plus className="w-3 h-3" />
          Añadir nota
        </button>
      )}

      {/* Add note form */}
      {isAdding && (
        <div className="space-y-2">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Escribe una nota privada..."
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none
                       focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            rows={3}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddNote}
              disabled={isSaving || !newNote.trim()}
              className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 
                         disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Guardar
            </button>
            <button
              onClick={() => {
                setIsAdding(false);
                setNewNote('');
              }}
              className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Latest note preview */}
      {!showAll && latestNote && (
        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-md">
          <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
            {latestNote.content}
          </p>
          <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
            <span>{latestNote.createdBy}</span>
            <span>{formatDistanceToNow(new Date(latestNote.createdAt), { addSuffix: true, locale: es })}</span>
          </div>
        </div>
      )}

      {/* Show all notes button */}
      {notesCount > 0 && (
        <button
          onClick={handleShowAll}
          disabled={isLoadingAll}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
        >
          {isLoadingAll && <Loader2 className="w-3 h-3 animate-spin" />}
          {showAll ? 'Ocultar historial' : `Ver todas (${notesCount})`}
        </button>
      )}

      {/* All notes list */}
      {showAll && allNotes.length > 0 && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {allNotes.map((note) => {
            const isPending = note._status === 'pending';
            const hasError = note._status === 'error';
            const isDeleting = pendingDeletes.has(note.id);
            
            return (
              <div
                key={note.id}
                className={`group p-2 rounded-md text-xs relative transition-all ${
                  isPending ? 'bg-blue-50 dark:bg-blue-900/20 animate-pulse' :
                  hasError ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
                  isDeleting ? 'opacity-50 scale-95' :
                  'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                {/* Status indicator */}
                {isPending && (
                  <div className="absolute top-1 right-1">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                  </div>
                )}
                {hasError && (
                  <div className="absolute top-1 right-1 flex items-center gap-1">
                    <button
                      onClick={() => handleRetryNote(note)}
                      className="p-0.5 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded"
                      title="Reintentar"
                    >
                      <RefreshCw className="w-3 h-3 text-orange-500" />
                    </button>
                    <AlertCircle className="w-3 h-3 text-red-500" />
                  </div>
                )}
                
                <p className={`text-gray-700 dark:text-gray-300 pr-6 ${isPending ? 'opacity-70' : ''}`}>
                  {note.content}
                </p>
                <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    {note._status === 'saved' && <Check className="w-2.5 h-2.5 text-green-500" />}
                    {typeof note.createdBy === 'string' ? note.createdBy : note.createdBy.name}
                  </span>
                  <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: es })}</span>
                </div>
                
                {/* Delete button - only for saved notes */}
                {note._status === 'saved' && !isDeleting && (
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="absolute top-1 right-1 p-0.5 opacity-0 group-hover:opacity-100 
                               hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity"
                    title="Eliminar nota"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {notesCount === 0 && !isAdding && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          Sin notas todavía
        </p>
      )}
    </div>
  );
}

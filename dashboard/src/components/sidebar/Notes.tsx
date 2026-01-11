// Notes Section
import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Note } from '../../types';
import { createNote, getUserNotes, deleteNote } from '../../services/contactApi';

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

export function SidebarNotes({ userId, sessionId, notesCount, latestNote, onNoteAdded }: NotesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setIsSaving(true);
    try {
      const note = await createNote(userId, newNote.trim(), sessionId);
      if (note) {
        setNewNote('');
        setIsAdding(false);
        onNoteAdded();
        if (showAll) {
          setAllNotes(prev => [note, ...prev]);
        }
      }
    } catch (error) {
      console.error('Error adding note:', error);
    } finally {
      setIsSaving(false);
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
      setAllNotes(notes);
      setShowAll(true);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setIsLoadingAll(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    
    try {
      await deleteNote(noteId);
      setAllNotes(prev => prev.filter(n => n.id !== noteId));
      onNoteAdded();
    } catch (error) {
      console.error('Error deleting note:', error);
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
          {allNotes.map((note) => (
            <div
              key={note.id}
              className="group p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-xs relative"
            >
              <p className="text-gray-700 dark:text-gray-300 pr-5">{note.content}</p>
              <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                <span>{note.createdBy.name}</span>
                <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: es })}</span>
              </div>
              <button
                onClick={() => handleDeleteNote(note.id)}
                className="absolute top-1 right-1 p-0.5 opacity-0 group-hover:opacity-100 
                           hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity"
                title="Eliminar nota"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          ))}
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

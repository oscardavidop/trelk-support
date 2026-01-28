// // Notes Section with Optimistic UI
// import { useState, useCallback } from 'react';
// import { Plus, Trash2, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
// import { formatDistanceToNow } from 'date-fns';
// import { es } from 'date-fns/locale';
// import type { Note } from '../../types';
// import { createNote, getUserNotes, deleteNote } from '../../services/contactApi';
// import { toast } from '../../stores/toastStore';

// interface NotesProps {
//   userId: string;
//   sessionId: string;
//   notesCount: number;
//   latestNote?: {
//     content: string;
//     createdAt: string;
//     createdBy: string;
//   };
//   onNoteAdded: () => void;
// }

// // Optimistic note state
// type NoteStatus = 'pending' | 'saved' | 'error';
// interface OptimisticNote extends Note {
//   _status?: NoteStatus;
//   _tempId?: string;
// }

// export function SidebarNotes({ userId, sessionId, notesCount, latestNote, onNoteAdded }: NotesProps) {
//   const [isAdding, setIsAdding] = useState(false);
//   const [isSaving, setIsSaving] = useState(false);
//   const [newNote, setNewNote] = useState('');
//   const [allNotes, setAllNotes] = useState<OptimisticNote[]>([]);
//   const [showAll, setShowAll] = useState(false);
//   const [isLoadingAll, setIsLoadingAll] = useState(false);
//   const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

//   const handleAddNote = async () => {
//     if (!newNote.trim()) return;
    
//     const tempId = `temp_${Date.now()}`;
//     const optimisticNote: OptimisticNote = {
//       id: tempId,
//       _tempId: tempId,
//       _status: 'pending',
//       content: newNote.trim(),
//       createdAt: new Date().toISOString(),
//       createdBy: { id: 'me', name: 'Tú' },
//       sessionId,
//     };

//     // Optimistic update
//     if (showAll) {
//       setAllNotes(prev => [optimisticNote, ...prev]);
//     }
//     setNewNote('');
//     setIsAdding(false);
//     setIsSaving(true);

//     try {
//       const note = await createNote(userId, optimisticNote.content, sessionId);
//       if (note) {
//         // Replace optimistic note with real one
//         if (showAll) {
//           setAllNotes(prev => prev.map(n => 
//             n._tempId === tempId ? { ...note, _status: 'saved' as NoteStatus } : n
//           ));
//         }
//         onNoteAdded();
//         toast.success('Nota guardada', 'La nota se ha guardado correctamente');
//       }
//     } catch (error) {
//       console.error('Error adding note:', error);
//       // Mark as error
//       if (showAll) {
//         setAllNotes(prev => prev.map(n => 
//           n._tempId === tempId ? { ...n, _status: 'error' as NoteStatus } : n
//         ));
//       }
//       toast.error('Error', 'No se pudo guardar la nota');
//     } finally {
//       setIsSaving(false);
//     }
//   };

//   const handleRetryNote = async (note: OptimisticNote) => {
//     if (!note._tempId) return;
    
//     // Reset status to pending
//     setAllNotes(prev => prev.map(n => 
//       n._tempId === note._tempId ? { ...n, _status: 'pending' as NoteStatus } : n
//     ));

//     try {
//       const savedNote = await createNote(userId, note.content, sessionId);
//       if (savedNote) {
//         setAllNotes(prev => prev.map(n => 
//           n._tempId === note._tempId ? { ...savedNote, _status: 'saved' as NoteStatus } : n
//         ));
//         onNoteAdded();
//         toast.success('Nota guardada', 'La nota se ha guardado correctamente');
//       }
//     } catch (error) {
//       setAllNotes(prev => prev.map(n => 
//         n._tempId === note._tempId ? { ...n, _status: 'error' as NoteStatus } : n
//       ));
//       toast.error('Error', 'No se pudo guardar la nota');
//     }
//   };

//   const handleShowAll = async () => {
//     if (showAll) {
//       setShowAll(false);
//       return;
//     }
    
//     setIsLoadingAll(true);
//     try {
//       const notes = await getUserNotes(userId);
//       setAllNotes(notes.map(n => ({ ...n, _status: 'saved' as NoteStatus })));
//       setShowAll(true);
//     } catch (error) {
//       console.error('Error loading notes:', error);
//       toast.error('Error', 'No se pudieron cargar las notas');
//     } finally {
//       setIsLoadingAll(false);
//     }
//   };

//   const handleDeleteNote = async (noteId: string) => {
//     if (!confirm('¿Eliminar esta nota?')) return;
    
//     // Optimistic delete - mark as pending
//     setPendingDeletes(prev => new Set(prev).add(noteId));
    
//     try {
//       await deleteNote(noteId);
//       setAllNotes(prev => prev.filter(n => n.id !== noteId));
//       onNoteAdded();
//       toast.info('Nota eliminada');
//     } catch (error) {
//       console.error('Error deleting note:', error);
//       toast.error('Error', 'No se pudo eliminar la nota');
//     } finally {
//       setPendingDeletes(prev => {
//         const next = new Set(prev);
//         next.delete(noteId);
//         return next;
//       });
//     }
//   };

//   return (
//     <div className="px-4 py-2 space-y-3">
//       {/* Add note button */}
//       {!isAdding && (
//         <button
//           onClick={() => setIsAdding(true)}
//           className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
//         >
//           <Plus className="w-3 h-3" />
//           Añadir nota
//         </button>
//       )}

//       {/* Add note form */}
//       {isAdding && (
//         <div className="space-y-2">
//           <textarea
//             value={newNote}
//             onChange={(e) => setNewNote(e.target.value)}
//             placeholder="Escribe una nota privada..."
//             className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
//                        bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none
//                        focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
//             rows={3}
//             autoFocus
//           />
//           <div className="flex items-center gap-2">
//             <button
//               onClick={handleAddNote}
//               disabled={isSaving || !newNote.trim()}
//               className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 
//                          disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
//             >
//               {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
//               Guardar
//             </button>
//             <button
//               onClick={() => {
//                 setIsAdding(false);
//                 setNewNote('');
//               }}
//               className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
//             >
//               Cancelar
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Latest note preview */}
//       {!showAll && latestNote && (
//         <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/50 rounded-md">
//           <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2">
//             {latestNote.content}
//           </p>
//           <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
//             <span>{latestNote.createdBy}</span>
//             <span>{formatDistanceToNow(new Date(latestNote.createdAt), { addSuffix: true, locale: es })}</span>
//           </div>
//         </div>
//       )}

//       {/* Show all notes button */}
//       {notesCount > 0 && (
//         <button
//           onClick={handleShowAll}
//           disabled={isLoadingAll}
//           className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
//         >
//           {isLoadingAll && <Loader2 className="w-3 h-3 animate-spin" />}
//           {showAll ? 'Ocultar historial' : `Ver todas (${notesCount})`}
//         </button>
//       )}

//       {/* All notes list */}
//       {showAll && allNotes.length > 0 && (
//         <div className="space-y-2 max-h-60 overflow-y-auto">
//           {allNotes.map((note) => {
//             const isPending = note._status === 'pending';
//             const hasError = note._status === 'error';
//             const isDeleting = pendingDeletes.has(note.id);
            
//             return (
//               <div
//                 key={note.id}
//                 className={`group p-2 rounded-md text-xs relative transition-all ${
//                   isPending ? 'bg-blue-50 dark:bg-blue-900/20 animate-pulse' :
//                   hasError ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800' :
//                   isDeleting ? 'opacity-50 scale-95' :
//                   'bg-gray-50 dark:bg-gray-700/50'
//                 }`}
//               >
//                 {/* Status indicator */}
//                 {isPending && (
//                   <div className="absolute top-1 right-1">
//                     <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
//                   </div>
//                 )}
//                 {hasError && (
//                   <div className="absolute top-1 right-1 flex items-center gap-1">
//                     <button
//                       onClick={() => handleRetryNote(note)}
//                       className="p-0.5 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded"
//                       title="Reintentar"
//                     >
//                       <RefreshCw className="w-3 h-3 text-orange-500" />
//                     </button>
//                     <AlertCircle className="w-3 h-3 text-red-500" />
//                   </div>
//                 )}
                
//                 <p className={`text-gray-700 dark:text-gray-300 pr-6 ${isPending ? 'opacity-70' : ''}`}>
//                   {note.content}
//                 </p>
//                 <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
//                   <span className="flex items-center gap-1">
//                     {note._status === 'saved' && <Check className="w-2.5 h-2.5 text-green-500" />}
//                     {typeof note.createdBy === 'string' ? note.createdBy : note.createdBy.name}
//                   </span>
//                   <span>{formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: es })}</span>
//                 </div>
                
//                 {/* Delete button - only for saved notes */}
//                 {note._status === 'saved' && !isDeleting && (
//                   <button
//                     onClick={() => handleDeleteNote(note.id)}
//                     className="absolute top-1 right-1 p-0.5 opacity-0 group-hover:opacity-100 
//                                hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity"
//                     title="Eliminar nota"
//                   >
//                     <Trash2 className="w-3 h-3 text-red-500" />
//                   </button>
//                 )}
//               </div>
//             );
//           })}
//         </div>
//       )}

//       {/* Empty state */}
//       {notesCount === 0 && !isAdding && (
//         <p className="text-xs text-gray-400 dark:text-gray-500 italic">
//           Sin notas todavía
//         </p>
//       )}
//     </div>
//   );
// }

// SidebarNotes.tsx - Refactored UI
import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Loader2, Check, AlertCircle, RefreshCw, X, StickyNote } from 'lucide-react';
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
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { can } = usePermissions();

  // Auto-focus when opening add mode
  useEffect(() => {
    if (isAdding && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isAdding]);

  // --- Logic Handlers (Misma lógica, UI diferente) ---

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
    setIsSaving(true); // Flag global para el botón externo si se quisiera usar

    try {
      const note = await createNote(userId, optimisticNote.content, sessionId);
      if (note) {
        if (showAll) {
          setAllNotes(prev => prev.map(n => 
            n._tempId === tempId ? { ...note, _status: 'saved' as NoteStatus } : n
          ));
        }
        onNoteAdded();
        toast.success('Nota guardada');
      }
    } catch (error) {
      console.error('Error adding note:', error);
      if (showAll) {
        setAllNotes(prev => prev.map(n => 
          n._tempId === tempId ? { ...n, _status: 'error' as NoteStatus } : n
        ));
      }
      toast.error('No se pudo guardar la nota');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetryNote = async (note: OptimisticNote) => {
    if (!note._tempId) return;
    setAllNotes(prev => prev.map(n => n._tempId === note._tempId ? { ...n, _status: 'pending' as NoteStatus } : n));

    try {
      const savedNote = await createNote(userId, note.content, sessionId);
      if (savedNote) {
        setAllNotes(prev => prev.map(n => n._tempId === note._tempId ? { ...savedNote, _status: 'saved' as NoteStatus } : n));
        onNoteAdded();
        toast.success('Nota recuperada y guardada');
      }
    } catch (error) {
      setAllNotes(prev => prev.map(n => n._tempId === note._tempId ? { ...n, _status: 'error' as NoteStatus } : n));
      toast.error('Error al reintentar');
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
      toast.error('Error al cargar historial de notas');
    } finally {
      setIsLoadingAll(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    // Confirmación visual o nativa (aquí nativa por simplicidad)
    if (!confirm('¿Eliminar esta nota permanentemente?')) return;
    
    setPendingDeletes(prev => new Set(prev).add(noteId));
    try {
      await deleteNote(noteId);
      setAllNotes(prev => prev.filter(n => n.id !== noteId));
      onNoteAdded();
    } catch (error) {
      toast.error('No se pudo eliminar');
    } finally {
      setPendingDeletes(prev => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    }
  };

  // --- Render ---
  
  if (!can('notes.read')) {
    return (
      <div className="px-3 py-2">
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          No tienes permiso para ver las notas.
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-3">
      
      {/* 1. Add Note Input Area */}
      {!isAdding ? (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-xs text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all group"
        >
          <div className="p-1 rounded-md bg-gray-100 dark:bg-gray-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors">
             <Plus className="w-3.5 h-3.5" />
          </div>
          <span>Añadir nota interna</span>
        </button>
      ) : (
        <div className="bg-white dark:bg-[#1a1d26] border border-indigo-200 dark:border-indigo-900/50 rounded-lg shadow-sm p-2 animate-in fade-in zoom-in-95 duration-200">
          <textarea
            ref={textareaRef}
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Escribe una nota..."
            className="w-full text-xs text-gray-800 dark:text-gray-200 bg-transparent border-none p-1 focus:ring-0 resize-none min-h-[60px] outline-none"
            onKeyDown={(e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddNote();
                }
            }}
          />
          <div className="flex justify-end gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={() => setIsAdding(false)}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddNote}
              disabled={!newNote.trim()}
              className="px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
            >
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* 2. Latest Note Preview (Collapsed View) */}
      {!showAll && latestNote && !isAdding && (
        <div className="relative group">
            <div className="absolute top-0 bottom-0 left-0 w-1 bg-yellow-400 rounded-l-md"></div>
            <div className="bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-200/60 dark:border-yellow-500/20 rounded-r-md p-2.5 pl-3">
                <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold text-yellow-800 dark:text-yellow-500/90 uppercase tracking-wide">
                        Última nota
                    </span>
                    <span className="text-[10px] text-yellow-700/60 dark:text-yellow-500/50">
                        {formatDistanceToNow(new Date(latestNote.createdAt), { addSuffix: true, locale: es })}
                    </span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed italic">
                    "{latestNote.content}"
                </p>
                <div className="mt-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <div className="w-4 h-4 rounded-full bg-yellow-200 dark:bg-yellow-900/40 flex items-center justify-center text-yellow-700 dark:text-yellow-400">
                        {latestNote.createdBy.charAt(0).toUpperCase()}
                    </div>
                    {latestNote.createdBy}
                </div>
            </div>
        </div>
      )}

      {/* 3. History Toggle */}
      {notesCount > 0 && (
        <div className="flex justify-center">
            <button
                onClick={handleShowAll}
                disabled={isLoadingAll}
                className="text-[11px] font-medium text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 py-1"
            >
                {isLoadingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <StickyNote className="w-3 h-3" />}
                {showAll ? 'Ocultar historial' : `Ver historial (${notesCount})`}
            </button>
        </div>
      )}

      {/* 4. Full List (Expanded View) */}
      {showAll && allNotes.length > 0 && (
        <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
          {allNotes.map((note) => {
            const isPending = note._status === 'pending';
            const hasError = note._status === 'error';
            const isDeleting = pendingDeletes.has(note.id);
            
            return (
              <div
                key={note.id}
                className={`relative group rounded-lg border p-3 transition-all duration-300 ${
                  isPending 
                    ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-70' 
                  : hasError 
                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' 
                  : isDeleting
                    ? 'bg-red-100 dark:bg-red-900/30 scale-95 opacity-50'
                    : 'bg-white dark:bg-[#15171f] border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 shadow-sm'
                }`}
              >
                {/* Header: Author & Time */}
                <div className="flex justify-between items-center mb-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {typeof note.createdBy === 'string' ? note.createdBy : note.createdBy.name}
                        </span>
                    </div>
                    <span className="text-[10px] text-gray-400">
                        {formatDistanceToNow(new Date(note.createdAt), { locale: es })}
                    </span>
                </div>

                {/* Content */}
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed break-words">
                    {note.content}
                </p>

                {/* Footer Actions / Status */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                    {isPending && <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />}
                    
                    {hasError && (
                        <button onClick={() => handleRetryNote(note)} className="p-1 hover:bg-red-100 rounded-full text-red-500 transition-colors" title="Reintentar">
                            <RefreshCw className="w-3 h-3" />
                        </button>
                    )}

                    {!isPending && !hasError && !isDeleting && (
                        <button 
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all opacity-0 group-hover:opacity-100"
                            title="Eliminar"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {showAll && allNotes.length === 0 && (
          <div className="text-center py-4 text-xs text-gray-400 italic">
              No hay notas en el historial.
          </div>
      )}
    </div>
  );
}
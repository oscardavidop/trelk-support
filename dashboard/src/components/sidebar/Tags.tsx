// // Tags Section
// import { useState, useEffect, useRef } from 'react';
// import { Plus, X, Loader2, Check } from 'lucide-react';
// import type { Tag } from '../../types';
// import { getAllTags, addTagToUser, removeTagFromUser, createTag } from '../../services/contactApi';

// interface TagsProps {
//   userId: string;
//   tags: Tag[];
//   onTagsChanged: () => void;
// }

// const TAG_COLORS = [
//   '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
//   '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
// ];

// export function SidebarTags({ userId, tags, onTagsChanged }: TagsProps) {
//   const [isAdding, setIsAdding] = useState(false);
//   const [searchQuery, setSearchQuery] = useState('');
//   const [availableTags, setAvailableTags] = useState<Tag[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [isCreating, setIsCreating] = useState(false);
//   const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
//   const inputRef = useRef<HTMLInputElement>(null);

//   // Load available tags
//   useEffect(() => {
//     if (isAdding) {
//       loadTags();
//       inputRef.current?.focus();
//     }
//   }, [isAdding]);

//   const loadTags = async () => {
//     setIsLoading(true);
//     try {
//       const allTags = await getAllTags();
//       // Filter out already assigned tags
//       const assignedIds = new Set(tags.map(t => t.id));
//       setAvailableTags(allTags.filter(t => !assignedIds.has(t.id)));
//     } catch (error) {
//       console.error('Error loading tags:', error);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleAddTag = async (tagId: string) => {
//     try {
//       await addTagToUser(userId, tagId);
//       onTagsChanged();
//       setIsAdding(false);
//       setSearchQuery('');
//     } catch (error) {
//       console.error('Error adding tag:', error);
//     }
//   };

//   const handleRemoveTag = async (tagId: string) => {
//     try {
//       await removeTagFromUser(userId, tagId);
//       onTagsChanged();
//     } catch (error) {
//       console.error('Error removing tag:', error);
//     }
//   };

//   const handleCreateTag = async () => {
//     if (!searchQuery.trim()) return;

//     setIsCreating(true);
//     try {
//       const newTag = await createTag(searchQuery.trim(), newTagColor);
//       if (newTag) {
//         // Add the new tag to the user
//         await addTagToUser(userId, newTag.id);
//         onTagsChanged();
//         setIsAdding(false);
//         setSearchQuery('');
//       }
//     } catch (error) {
//       console.error('Error creating tag:', error);
//     } finally {
//       setIsCreating(false);
//     }
//   };

//   const filteredTags = availableTags.filter(t =>
//     t.name.toLowerCase().includes(searchQuery.toLowerCase())
//   );

//   const showCreateOption = searchQuery.trim() && 
//     !availableTags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase()) &&
//     !tags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase());

//   return (
//     <div className="px-4 py-2 space-y-3">
//       {/* Current tags */}
//       <div className="flex flex-wrap gap-1.5">
//         {tags.map((tag) => (
//           <span
//             key={tag.id}
//             className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
//             style={{ backgroundColor: tag.color }}
//           >
//             {tag.name}
//             <button
//               onClick={() => handleRemoveTag(tag.id)}
//               className="opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded-full p-0.5 transition-opacity"
//               title="Quitar etiqueta"
//             >
//               <X className="w-3 h-3" />
//             </button>
//           </span>
//         ))}

//         {tags.length === 0 && !isAdding && (
//           <span className="text-xs text-gray-400 italic">Sin etiquetas</span>
//         )}
//       </div>

//       {/* Add tag button */}
//       {!isAdding && (
//         <button
//           onClick={() => setIsAdding(true)}
//           className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
//         >
//           <Plus className="w-3 h-3" />
//           Añadir etiqueta
//         </button>
//       )}

//       {/* Tag selector */}
//       {isAdding && (
//         <div className="space-y-2">
//           <div className="relative">
//             <input
//               ref={inputRef}
//               type="text"
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//               placeholder="Buscar o crear etiqueta..."
//               className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
//                          bg-white dark:bg-gray-700 text-gray-900 dark:text-white
//                          focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
//             />
//           </div>

//           {/* Available tags dropdown */}
//           <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
//             {isLoading ? (
//               <div className="flex items-center justify-center py-3">
//                 <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
//               </div>
//             ) : (
//               <>
//                 {filteredTags.map((tag) => (
//                   <button
//                     key={tag.id}
//                     onClick={() => handleAddTag(tag.id)}
//                     className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm 
//                                hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
//                   >
//                     <span
//                       className="w-3 h-3 rounded-full"
//                       style={{ backgroundColor: tag.color }}
//                     />
//                     <span className="text-gray-700 dark:text-gray-300">{tag.name}</span>
//                   </button>
//                 ))}

//                 {/* Create new tag option */}
//                 {showCreateOption && (
//                   <div className="border-t border-gray-200 dark:border-gray-600 p-2">
//                     <div className="flex items-center gap-2 mb-2">
//                       <span className="text-xs text-gray-500">Color:</span>
//                       <div className="flex gap-1">
//                         {TAG_COLORS.map((color) => (
//                           <button
//                             key={color}
//                             onClick={() => setNewTagColor(color)}
//                             className={`w-4 h-4 rounded-full ${
//                               newTagColor === color ? 'ring-2 ring-offset-1 ring-indigo-500' : ''
//                             }`}
//                             style={{ backgroundColor: color }}
//                           />
//                         ))}
//                       </div>
//                     </div>
//                     <button
//                       onClick={handleCreateTag}
//                       disabled={isCreating}
//                       className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-sm 
//                                  bg-indigo-600 text-white rounded hover:bg-indigo-700 
//                                  disabled:opacity-50 disabled:cursor-not-allowed"
//                     >
//                       {isCreating ? (
//                         <Loader2 className="w-3 h-3 animate-spin" />
//                       ) : (
//                         <Plus className="w-3 h-3" />
//                       )}
//                       Crear "{searchQuery}"
//                     </button>
//                   </div>
//                 )}

//                 {filteredTags.length === 0 && !showCreateOption && (
//                   <div className="px-2 py-3 text-xs text-center text-gray-400">
//                     No hay etiquetas disponibles
//                   </div>
//                 )}
//               </>
//             )}
//           </div>

//           <button
//             onClick={() => {
//               setIsAdding(false);
//               setSearchQuery('');
//             }}
//             className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
//           >
//             Cancelar
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// SidebarTags.tsx - Refactored UI
import { useState, useEffect, useRef } from 'react';
import { Plus, X, Loader2, Search, Tag as TagIcon, Palette } from 'lucide-react';
import type { Tag } from '../../types';
import { getAllTags, addTagToUser, removeTagFromUser, createTag } from '../../services/contactApi';
import usePermissions from '../../hooks/usePermissions';

interface TagsProps {
  userId: string;
  tags: Tag[];
  onTagsChanged: () => void;
}

const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

export function SidebarTags({ userId, tags, onTagsChanged }: TagsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { can } = usePermissions();

  // Load available tags
  useEffect(() => {
    if (isAdding) {
      loadTags();
      // Small delay to ensure render before focus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isAdding]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const allTags = await getAllTags();
      // Filter out already assigned tags
      const assignedIds = new Set(tags.map(t => t.id));
      setAvailableTags(allTags.filter(t => !assignedIds.has(t.id)));
    } catch (error) {
      console.error('Error loading tags:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    try {
      await addTagToUser(userId, tagId);
      onTagsChanged();
      setIsAdding(false);
      setSearchQuery('');
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagFromUser(userId, tagId);
      onTagsChanged();
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  const handleCreateTag = async () => {
    if (!searchQuery.trim()) return;

    setIsCreating(true);
    try {
      const newTag = await createTag(searchQuery.trim(), newTagColor);
      if (newTag) {
        await addTagToUser(userId, newTag.id);
        onTagsChanged();
        setIsAdding(false);
        setSearchQuery('');
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const filteredTags = availableTags.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showCreateOption = searchQuery.trim() &&
    !availableTags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase()) &&
    !tags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase());

  if (!can('tags.read')) {
    return (
      <div className="px-3 py-2">
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          No tienes permiso para ver las etiquetas.
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 space-y-3">

      {/* 1. Current Tags List */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-white shadow-sm transition-all hover:shadow-md cursor-default"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveTag(tag.id);
              }}
              className="opacity-60 group-hover:opacity-100 hover:bg-black/20 rounded-full p-0.5 transition-all"
              title="Quitar etiqueta"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Add Button (Inline if there are few tags, or below) */}
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:text-indigo-400 dark:hover:border-indigo-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all"
          >
            <Plus className="w-3 h-3" />
            <span>Añadir</span>
          </button>
        )}
      </div>

      {tags.length === 0 && !isAdding && (
        <div className="text-center py-4 text-xs text-gray-400 italic bg-gray-50 dark:bg-gray-800/30 rounded-lg border border-dashed border-gray-200 dark:border-gray-800">
          Sin etiquetas asignadas
        </div>
      )}

      {/* 2. Tag Selector / Creator Panel */}
      {isAdding && (
        <div className="bg-white dark:bg-[#1a1d26] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">

          {/* Search Input */}
          <div className="relative border-b border-gray-100 dark:border-gray-800 p-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar o crear..."
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-gray-50 dark:bg-gray-800 border-none rounded-md focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white placeholder-gray-500 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsAdding(false);
              }}
            />
            <button
              onClick={() => setIsAdding(false)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* List of Tags */}
          <div className="max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 p-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              </div>
            ) : (
              <>
                {/* Existing Tags */}
                {filteredTags.length > 0 && (
                  <div className="grid grid-cols-1 gap-0.5">
                    {filteredTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleAddTag(tag.id)}
                        className="flex items-center gap-2 px-2 py-1.5 text-left text-xs rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full ring-1 ring-black/5 dark:ring-white/10"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{tag.name}</span>
                        <Plus className="w-3 h-3 ml-auto text-gray-400 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Create New Tag */}
                {showCreateOption && (
                  <div className="p-2 bg-gray-50 dark:bg-gray-800/50 rounded-md mt-1 border border-gray-100 dark:border-gray-700/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <Palette className="w-3 h-3" /> Nueva etiqueta
                      </span>
                    </div>

                    {/* Color Picker */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setNewTagColor(color)}
                          className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${newTagColor === color
                            ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-gray-800 ring-indigo-500 scale-110'
                            : 'opacity-80 hover:opacity-100'
                            }`}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>

                    <button
                      onClick={handleCreateTag}
                      disabled={isCreating}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
                    >
                      {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                      Crear "{searchQuery}"
                    </button>
                  </div>
                )}

                {/* Empty State */}
                {filteredTags.length === 0 && !showCreateOption && (
                  <div className="py-4 text-center">
                    <TagIcon className="w-6 h-6 text-gray-300 mx-auto mb-1" />
                    <p className="text-xs text-gray-400">No se encontraron etiquetas</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
// Tags Section
import { useState, useEffect, useRef } from 'react';
import { Plus, X, Loader2, Check } from 'lucide-react';
import type { Tag } from '../../types';
import { getAllTags, addTagToUser, removeTagFromUser, createTag } from '../../services/contactApi';

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
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load available tags
  useEffect(() => {
    if (isAdding) {
      loadTags();
      inputRef.current?.focus();
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
        // Add the new tag to the user
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

  return (
    <div className="px-4 py-2 space-y-3">
      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="group inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded-full p-0.5 transition-opacity"
              title="Quitar etiqueta"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        
        {tags.length === 0 && !isAdding && (
          <span className="text-xs text-gray-400 italic">Sin etiquetas</span>
        )}
      </div>

      {/* Add tag button */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
        >
          <Plus className="w-3 h-3" />
          Añadir etiqueta
        </button>
      )}

      {/* Tag selector */}
      {isAdding && (
        <div className="space-y-2">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar o crear etiqueta..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                         focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Available tags dropdown */}
          <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700">
            {isLoading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {filteredTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAddTag(tag.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm 
                               hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-gray-700 dark:text-gray-300">{tag.name}</span>
                  </button>
                ))}
                
                {/* Create new tag option */}
                {showCreateOption && (
                  <div className="border-t border-gray-200 dark:border-gray-600 p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500">Color:</span>
                      <div className="flex gap-1">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewTagColor(color)}
                            className={`w-4 h-4 rounded-full ${
                              newTagColor === color ? 'ring-2 ring-offset-1 ring-indigo-500' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleCreateTag}
                      disabled={isCreating}
                      className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-sm 
                                 bg-indigo-600 text-white rounded hover:bg-indigo-700 
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                      Crear "{searchQuery}"
                    </button>
                  </div>
                )}
                
                {filteredTags.length === 0 && !showCreateOption && (
                  <div className="px-2 py-3 text-xs text-center text-gray-400">
                    No hay etiquetas disponibles
                  </div>
                )}
              </>
            )}
          </div>

          <button
            onClick={() => {
              setIsAdding(false);
              setSearchQuery('');
            }}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

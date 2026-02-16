/**
 * SidebarTags - Premium Zinc Refactor
 * High-fidelity tag management for the contact sidebar
 */

import { useState, useEffect, useRef } from 'react';
import { Plus, X, Loader2, Search, Tag as TagIcon, Palette, Check } from 'lucide-react';
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
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[4]); // Default teal
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { can } = usePermissions();

  // Load tags
  useEffect(() => {
    if (isAdding) {
      loadTags();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isAdding]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsAdding(false);
      }
    };
    if (isAdding) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAdding]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const allTags = await getAllTags();
      const assignedIds = new Set(tags.map(t => t.id));
      setAvailableTags(allTags.filter(t => !assignedIds.has(t.id)));
    } catch (error) { console.error(error); } 
    finally { setIsLoading(false); }
  };

  const handleAddTag = async (tagId: string) => {
    try {
      await addTagToUser(userId, tagId);
      onTagsChanged();
      setIsAdding(false);
      setSearchQuery('');
    } catch (error) { console.error(error); }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagFromUser(userId, tagId);
      onTagsChanged();
    } catch (error) { console.error(error); }
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
    } catch (error) { console.error(error); } 
    finally { setIsCreating(false); }
  };

  const filteredTags = availableTags.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showCreateOption = searchQuery.trim() &&
    !availableTags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase()) &&
    !tags.some(t => t.name.toLowerCase() === searchQuery.toLowerCase());

  if (!can('tags.read')) return null;

  return (
    <div className="px-4 py-3 space-y-3" ref={containerRef}>
      
      {/* Header Label */}
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-bold text-zinc-500 uppercase  flex items-center gap-1.5">
          <TagIcon className="w-3 h-3" /> Etiquetas
        </h4>
        {tags.length > 0 && !isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-indigo-400 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 1. Current Tags List */}
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all"
            style={{ 
              backgroundColor: `${tag.color}15`, 
              color: tag.color,
              borderColor: `${tag.color}25`
            }}
          >
            {tag.name}
            <button
              onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag.id); }}
              className="opacity-0 group-hover:opacity-100 hover:bg-zinc-950/50 rounded-full p-0.5 transition-all"
              style={{ color: tag.color }}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Add Button (Large if empty, hidden if open) */}
        {!isAdding && tags.length === 0 && (
          <button
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/50 transition-all w-full justify-center"
          >
            <Plus className="w-3.5 h-3.5" /> Asignar etiqueta
          </button>
        )}
      </div>

      {/* 2. Popover Panel */}
      {isAdding && (
        <div className="relative mt-2">
          {/* Popover Arrow */}
          <div className="absolute -top-1.5 left-4 w-3 h-3 bg-zinc-900 border-t border-l border-zinc-800 rotate-45 z-20" />
          
          <div className="relative z-10 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-black/50">
            
            {/* Search Input */}
            <div className="relative border-b border-zinc-800 p-2">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar o crear..."
                className="w-full pl-8 pr-8 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                onKeyDown={(e) => e.key === 'Escape' && setIsAdding(false)}
              />
              <button
                onClick={() => setIsAdding(false)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-50 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* List Content */}
            <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 p-1.5 bg-zinc-900/50">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                </div>
              ) : (
                <>
                  {/* Existing Tags List */}
                  {filteredTags.length > 0 && (
                    <div className="space-y-0.5">
                      {filteredTags.map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => handleAddTag(tag.id)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left text-xs rounded-lg hover:bg-zinc-800 transition-colors group"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-2 h-2 rounded-full shadow-[0_0_6px_currentColor]"
                              style={{ backgroundColor: tag.color, color: tag.color }}
                            />
                            <span className="text-zinc-300 font-medium group-hover:text-zinc-50">{tag.name}</span>
                          </div>
                          <Plus className="w-3 h-3 text-zinc-600 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Create New Tag Section */}
                  {showCreateOption && (
                    <div className="mt-1 p-2 bg-zinc-950 border border-zinc-800 rounded-lg animate-in fade-in slide-in-from-top-1">
                      <div className="flex items-center gap-2 mb-3 px-1">
                        <Palette className="w-3 h-3 text-indigo-400" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase">Nueva Etiqueta</span>
                      </div>

                      {/* Color Palette */}
                      <div className="flex flex-wrap gap-2 mb-3 px-1">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setNewTagColor(color)}
                            className={`w-5 h-5 rounded-full transition-all flex items-center justify-center ${
                              newTagColor === color 
                                ? 'ring-2 ring-offset-2 ring-offset-zinc-950 ring-indigo-500 scale-110' 
                                : 'hover:scale-110 opacity-70 hover:opacity-100'
                            }`}
                            style={{ backgroundColor: color }}
                          >
                            {newTagColor === color && <Check className="w-3 h-3 text-zinc-50/90 drop-shadow-md" />}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={handleCreateTag}
                        disabled={isCreating}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold bg-indigo-600 text-zinc-50 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
                      >
                        {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        Crear "{searchQuery}"
                      </button>
                    </div>
                  )}

                  {/* Empty State */}
                  {filteredTags.length === 0 && !showCreateOption && (
                    <div className="py-6 text-center">
                      <TagIcon className="w-8 h-8 text-zinc-800 mx-auto mb-2" />
                      <p className="text-xs text-zinc-500">No se encontraron etiquetas</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
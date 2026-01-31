import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Tag, Loader2, Zap } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import type { SavedReply } from '../types';

interface QuickReplyDropdownProps {
  isOpen: boolean;
  searchQuery: string;
  onSelect: (content: string, replyId: string) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export default function QuickReplyDropdown({
  isOpen,
  searchQuery,
  onSelect,
  onClose,
}: QuickReplyDropdownProps) {
  const token = useAuthStore((state) => state.token);
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [filteredReplies, setFilteredReplies] = useState<SavedReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && replies.length === 0) loadReplies();
  }, [isOpen]);

  useEffect(() => {
    if (!searchQuery || searchQuery === '/') {
      setFilteredReplies(replies.slice(0, 8));
    } else {
      const query = searchQuery.slice(1).toLowerCase();
      const filtered = replies.filter(
        (reply) =>
          reply.title.toLowerCase().includes(query) ||
          reply.content.toLowerCase().includes(query) ||
          (reply.shortcut && reply.shortcut.toLowerCase().includes(query)) ||
          (reply.category && reply.category.toLowerCase().includes(query))
      );
      setFilteredReplies(filtered.slice(0, 8));
    }
    setSelectedIndex(0);
  }, [searchQuery, replies]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredReplies.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Enter' && filteredReplies.length > 0) {
        e.preventDefault();
        handleSelect(filteredReplies[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredReplies]);

  useEffect(() => {
    if (dropdownRef.current && filteredReplies.length > 0) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const loadReplies = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/saved-replies', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.ok) setReplies(data.replies.filter((r: SavedReply) => r.isActive));
    } catch (error) { console.error('Failed to load saved replies:', error); } 
    finally { setIsLoading(false); }
  };

  const handleSelect = (reply: SavedReply) => {
    onSelect(reply.content, reply._id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 mx-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
      
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-500 ">
          <Zap className="w-3 h-3 text-amber-500" />
          <span>Respuestas Rápidas</span>
        </div>
        <div className="flex gap-2 text-[10px] text-zinc-600 font-mono">
          <span>↵ SELECCIONAR</span>
          <span>ESC CERRAR</span>
        </div>
      </div>

      {/* List */}
      <div ref={dropdownRef} className="max-h-64 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-indigo-500 animate-spin" /></div>
        ) : filteredReplies.length === 0 ? (
          <div className="py-8 text-center text-zinc-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sin resultados</p>
          </div>
        ) : (
          filteredReplies.map((reply, index) => (
            <button
              key={reply._id}
              onClick={() => handleSelect(reply)}
              className={`w-full text-left px-4 py-3 border-l-2 transition-all duration-150 group ${
                index === selectedIndex
                  ? 'bg-zinc-800 border-indigo-500'
                  : 'hover:bg-zinc-800/50 border-transparent'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className={`text-sm font-medium truncate ${index === selectedIndex ? 'text-white' : 'text-zinc-300'}`}>
                    {reply.title}
                  </span>
                  {reply.shortcut && (
                    <span className="text-[10px] font-mono bg-zinc-950 px-1.5 py-0.5 rounded text-zinc-500 border border-zinc-800">
                      /{reply.shortcut}
                    </span>
                  )}
                </div>
                {reply.category && (
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
                    <Tag className="w-2.5 h-2.5" /> {reply.category}
                  </span>
                )}
              </div>
              
              <p className="text-xs text-zinc-500 truncate pr-4 group-hover:text-zinc-400 transition-colors">
                {reply.content}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
// Quick Reply Dropdown Component
// Shows saved replies when agent types "/" in chat input
import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Tag, Loader2 } from 'lucide-react';
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

  // Load saved replies on first open
  useEffect(() => {
    if (isOpen && replies.length === 0) {
      loadReplies();
    }
  }, [isOpen]);

  // Filter replies based on search query
  useEffect(() => {
    if (!searchQuery || searchQuery === '/') {
      setFilteredReplies(replies.slice(0, 8)); // Show first 8
    } else {
      const query = searchQuery.slice(1).toLowerCase(); // Remove leading /
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

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredReplies.length - 1 ? prev + 1 : prev
        );
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

  // Scroll selected item into view
  useEffect(() => {
    if (dropdownRef.current && filteredReplies.length > 0) {
      const selectedElement = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const loadReplies = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/saved-replies', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setReplies(data.replies.filter((r: SavedReply) => r.isActive));
      }
    } catch (error) {
      console.error('Failed to load saved replies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (reply: SavedReply) => {
    onSelect(reply.content, reply._id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2"
    >
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <MessageSquare className="w-4 h-4" />
          <span>Quick Replies</span>
        </div>
        <span className="text-xs text-gray-600">
          ↑↓ Navigate • Enter Select • Esc Close
        </span>
      </div>

      {/* Content */}
      <div ref={dropdownRef} className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : filteredReplies.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No replies found</p>
            <p className="text-xs mt-1">Try a different search or create new replies</p>
          </div>
        ) : (
          filteredReplies.map((reply, index) => (
            <button
              key={reply._id}
              onClick={() => handleSelect(reply)}
              className={`w-full text-left px-4 py-3 border-b border-gray-800/50 last:border-b-0 transition-colors ${
                index === selectedIndex
                  ? 'bg-primary/10 border-l-2 border-l-primary'
                  : 'hover:bg-gray-800/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">
                      {reply.title}
                    </span>
                    {reply.shortcut && (
                      <code className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded font-mono">
                        {reply.shortcut}
                      </code>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {reply.content.slice(0, 80)}
                    {reply.content.length > 80 ? '...' : ''}
                  </p>
                </div>
                {reply.category && (
                  <span className="flex items-center gap-1 text-xs text-gray-600 ml-2">
                    <Tag className="w-3 h-3" />
                    {reply.category}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

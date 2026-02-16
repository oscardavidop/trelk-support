// Simple Emoji Picker Component
// import { useState, useRef, useEffect } from 'react';
import { Heart, ThumbsUp, Utensils, Plane, Activity, Flag, Hash } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Search, X, Clock, Smile, SearchX } from 'lucide-react';
interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

// Emoji categories with common emojis
const EMOJI_CATEGORIES = [
  {
    id: 'recent',
    name: 'Recientes',
    icon: Clock,
    emojis: [] // Will be populated from localStorage
  },
  {
    id: 'smileys',
    name: 'Caritas',
    icon: Smile,
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '👿', '😈', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖']
  },
  {
    id: 'gestures',
    name: 'Gestos',
    icon: ThumbsUp,
    emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '💋']
  },
  {
    id: 'hearts',
    name: 'Corazones',
    icon: Heart,
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💐', '🌹', '🥀', '🌺', '🌷', '🌸', '💮', '🏵️', '🌻', '🌼', '✨', '⭐', '🌟', '💫', '🔥', '💥', '💢', '💯']
  },
  {
    id: 'food',
    name: 'Comida',
    icon: Utensils,
    emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥕', '🌽', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🧂', '🥤', '🧋', '☕', '🍵', '🧃', '🥛', '🍼', '🫖', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊']
  },
  {
    id: 'travel',
    name: 'Viajes',
    icon: Plane,
    emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '✈️', '🛫', '🛬', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '🛖', '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒', '🗾', '🎑', '🏞️', '🌅', '🌄', '🌠', '🎇', '🎆', '🌇', '🌆', '🏙️', '🌃', '🌌', '🌉', '🌁']
  },
  {
    id: 'activities',
    name: 'Actividades',
    icon: Activity,
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '⛑️', '🧘', '🎮', '🕹️', '🎲', '🧩', '♠️', '♥️', '♦️', '♣️', '🃏', '🀄', '🎴', '🎭', '🖼️', '🎨', '🎤', '🎧', '🎼', '🎹', '🥁', '🪘', '🎷', '🎺', '🪗', '🎸', '🪕', '🎻', '🎬', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎪', '🎟️', '🎫', '🎁', '🎀', '🎊', '🎉', '🎈', '🪅', '🪆', '🎃', '🎄', '🎋', '🎍', '🎎', '🎏', '🎐', '🧧']
  },
  {
    id: 'symbols',
    name: 'Símbolos',
    icon: Hash,
    emojis: ['✅', '❌', '❗', '❓', '❕', '❔', '⭕', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '💠', '🔘', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '⬛', '⬜', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️', '↕️', '↔️', '↩️', '↪️', '⤴️', '⤵️', '🔃', '🔄', '🔙', '🔚', '🔛', '🔜', '🔝', '✔️', '☑️', '✖️', '➕', '➖', '➗', '✳️', '✴️', '❇️', '‼️', '⁉️', '〰️', '©️', '®️', '™️', '#️⃣', '*️⃣', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '💯', '🔢', '🔣', '🔤', '🅰️', '🆎', '🅱️', '🆑', '🆒', '🆓', 'ℹ️', '🆔', 'Ⓜ️', '🆕', '🆖', '🅾️', '🆗', '🅿️', '🆘', '🆙', '🆚', '🈁', '🈂️', '🈷️', '🈶', '🉐', '🈹', '🈚', '🈲', '🉑', '🈸', '🈴', '🈳', '㊗️', '㊙️', '🈺', '🈵']
  },
  {
    id: 'flags',
    name: 'Banderas',
    icon: Flag,
    emojis: ['🏳️', '🏴', '🏴‍☠️', '🏁', '🚩', '🎌', '🇦🇷', '🇧🇴', '🇧🇷', '🇨🇱', '🇨🇴', '🇨🇷', '🇨🇺', '🇩🇴', '🇪🇨', '🇸🇻', '🇬🇹', '🇭🇳', '🇲🇽', '🇳🇮', '🇵🇦', '🇵🇾', '🇵🇪', '🇵🇷', '🇺🇾', '🇻🇪', '🇪🇸', '🇺🇸', '🇬🇧', '🇫🇷', '🇩🇪', '🇮🇹', '🇵🇹', '🇳🇱', '🇧🇪', '🇨🇭', '🇦🇹', '🇵🇱', '🇨🇿', '🇷🇺', '🇺🇦', '🇯🇵', '🇰🇷', '🇨🇳', '🇹🇼', '🇮🇳', '🇦🇺', '🇨🇦']
  }
];
/**
 * EmojiPicker - Premium Zinc Refactor
 * High-fidelity floating emoji selector
 */


// Asumiendo que EMOJI_CATEGORIES viene de un archivo config/types
// import { EMOJI_CATEGORIES } from '../config/emojis';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const RECENT_EMOJIS_KEY = 'trelk_recent_emojis';

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent emojis
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
      if (stored) setRecentEmojis(JSON.parse(stored));
    } catch (e) { console.error('Failed to load recent emojis', e); }
  }, []);

  // Save recent emoji
  const saveRecentEmoji = (emoji: string) => {
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 24);
    setRecentEmojis(updated);
    try { localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated)); } 
    catch (e) { console.error('Failed to save recent emojis', e); }
  };

  const handleSelect = (emoji: string) => {
    saveRecentEmoji(emoji);
    onSelect(emoji);
  };

  // Mocks/Helpers (Assuming EMOJI_CATEGORIES is available)
  const getAllEmojis = () => EMOJI_CATEGORIES.flatMap(cat => cat.emojis);

  const getFilteredEmojis = () => {
    if (!searchQuery) return null;
    return getAllEmojis().slice(0, 48); // Basic mock search
  };

  const getCategoriesWithRecent = () => {
    return EMOJI_CATEGORIES.map(cat => 
      cat.id === 'recent' ? { ...cat, emojis: recentEmojis } : cat
    );
  };

  const categories = getCategoriesWithRecent();
  const filteredEmojis = getFilteredEmojis();
  const currentCategory = categories.find(c => c.id === activeCategory);

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-[calc(100%+12px)] left-0 w-[320px] bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {/* Header & Search */}
      <div className="flex items-center gap-2 p-3 border-b border-zinc-800/50 bg-zinc-900/30">
        <div className="relative flex-1 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar emoji..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
            autoFocus
          />
        </div>
        <button
          onClick={onClose}
          className="p-2 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded-xl transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-800 overflow-x-auto scrollbar-none">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              title={category.name}
              className={`p-2 rounded-xl transition-all shrink-0 ${
                activeCategory === category.id
                  ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-inset ring-indigo-500/20 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              <category.icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid Area */}
      <div className="p-2 h-[260px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent relative">
        
        {searchQuery && filteredEmojis ? (
          filteredEmojis.length > 0 ? (
            <div className="grid grid-cols-8 gap-0.5">
              {filteredEmojis.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  onClick={() => handleSelect(emoji)}
                  className="flex items-center justify-center p-1.5 text-2xl hover:bg-zinc-800 rounded-xl transition-all hover:scale-110 active:scale-95"
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-2">
              <SearchX className="w-6 h-6 opacity-50" />
              <span className="text-xs">No se encontraron emojis</span>
            </div>
          )
        ) : (
          <>
            {/* Sticky Category Title */}
            <div className="sticky top-0 bg-zinc-950/90 backdrop-blur-md text-[10px] font-bold text-zinc-500 uppercase  px-2 py-1.5 mb-1 z-10 rounded">
              {currentCategory?.name}
            </div>
            
            {/* Emoji List */}
            {currentCategory?.emojis.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-zinc-500 gap-2">
                <Clock className="w-6 h-6 opacity-50" />
                <span className="text-xs">Sin emojis recientes</span>
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-0.5">
                {currentCategory?.emojis.map((emoji, index) => (
                  <button
                    key={`${emoji}-${index}`}
                    onClick={() => handleSelect(emoji)}
                    className="flex items-center justify-center p-1.5 text-2xl hover:bg-zinc-800 rounded-xl transition-all hover:scale-110 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
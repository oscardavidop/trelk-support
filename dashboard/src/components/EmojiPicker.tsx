// Simple Emoji Picker Component
import { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, Smile, Heart, ThumbsUp, Utensils, Plane, Activity, Flag, Hash } from 'lucide-react';

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

// Recent emojis storage key
const RECENT_EMOJIS_KEY = 'trelk_recent_emojis';

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent emojis from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load recent emojis', e);
    }
  }, []);

  // Save recent emoji
  const saveRecentEmoji = (emoji: string) => {
    const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 24);
    setRecentEmojis(updated);
    try {
      localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save recent emojis', e);
    }
  };

  // Handle emoji selection
  const handleSelect = (emoji: string) => {
    saveRecentEmoji(emoji);
    onSelect(emoji);
  };

  // Get all emojis for search
  const getAllEmojis = () => {
    return EMOJI_CATEGORIES.flatMap(cat => cat.emojis);
  };

  // Filter emojis based on search
  const getFilteredEmojis = () => {
    if (!searchQuery) return null;
    const allEmojis = getAllEmojis();
    // Simple search - just return all emojis that match somehow
    // For a real implementation, you'd want emoji names/keywords
    return allEmojis.slice(0, 50);
  };

  // Get categories with recent emojis populated
  const getCategoriesWithRecent = () => {
    return EMOJI_CATEGORIES.map(cat => {
      if (cat.id === 'recent') {
        return { ...cat, emojis: recentEmojis };
      }
      return cat;
    });
  };

  const categories = getCategoriesWithRecent();
  const filteredEmojis = getFilteredEmojis();
  const currentCategory = categories.find(c => c.id === activeCategory);

  return (
    <div 
      ref={containerRef}
      className="absolute bottom-full left-4 mb-2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2"
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar emoji..."
            className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
        <div className="flex items-center gap-1 p-2 border-b border-gray-800 overflow-x-auto">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              title={category.name}
              className={`p-2 rounded-lg transition-colors shrink-0 ${
                activeCategory === category.id
                  ? 'bg-primary/20 text-primary'
                  : 'text-gray-500 hover:text-white hover:bg-gray-800'
              }`}
            >
              <category.icon className="w-4 h-4" />
            </button>
          ))}
        </div>
      )}

      {/* Emoji Grid */}
      <div className="p-2 max-h-64 overflow-y-auto">
        {searchQuery && filteredEmojis ? (
          <div className="grid grid-cols-8 gap-1">
            {filteredEmojis.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => handleSelect(emoji)}
                className="p-2 text-xl hover:bg-gray-800 rounded-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <>
            {/* Category Title */}
            <div className="text-xs text-gray-500 px-2 py-1 mb-1">
              {currentCategory?.name}
            </div>
            
            {/* Emojis */}
            {currentCategory?.emojis.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No hay emojis recientes
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {currentCategory?.emojis.map((emoji, index) => (
                  <button
                    key={`${emoji}-${index}`}
                    onClick={() => handleSelect(emoji)}
                    className="p-2 text-xl hover:bg-gray-800 rounded-lg transition-colors"
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

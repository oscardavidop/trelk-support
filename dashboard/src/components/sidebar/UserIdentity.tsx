import { useState } from 'react';
import { Copy, Check, ExternalLink, Hash, Globe, Smartphone, AtSign } from 'lucide-react';

interface UserIdentityProps {
  user: {
    id: string;
    telegramId: number;
    username?: string;
    firstName: string;
    lastName?: string;
    language: string;
    platform: 'telegram';
  };
}

const LANGUAGE_MAP: Record<string, { label: string; flag: string }> = {
  es: { label: 'Español', flag: '🇪🇸' },
  en: { label: 'English', flag: '🇺🇸' },
  pt: { label: 'Português', flag: '🇧🇷' },
  fr: { label: 'Français', flag: '🇫🇷' },
  de: { label: 'Deutsch', flag: '🇩🇪' },
  it: { label: 'Italiano', flag: '🇮🇹' },
};

export function SidebarUserIdentity({ user }: UserIdentityProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const langConfig = LANGUAGE_MAP[user.language] || { label: user.language?.toUpperCase() || 'UNK', flag: '🌐' };

  return (
    <div className="px-3 py-2">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        
        {/* 1. Telegram ID */}
        <div 
          className="group flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
          onClick={() => handleCopy(String(user.telegramId), 'telegramId')}
        >
          <div className="flex items-center gap-2.5 text-zinc-400">
            <div className="p-1.5 bg-zinc-950 rounded border border-zinc-800 text-zinc-500 group-hover:text-zinc-300 transition-colors">
               <Hash className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium">ID Telegram</span>
          </div>
          
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-zinc-300 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 group-hover:border-zinc-700 transition-colors">
              {user.telegramId}
            </code>
            <div className="w-4 h-4 flex items-center justify-center">
              {copiedField === 'telegramId' ? (
                <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-300" />
              )}
            </div>
          </div>
        </div>

        {/* 2. Username */}
        <div className="group flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors">
          <div className="flex items-center gap-2.5 text-zinc-400">
            <div className="p-1.5 bg-zinc-950 rounded border border-zinc-800 text-zinc-500 group-hover:text-zinc-300 transition-colors">
               <AtSign className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-medium">Username</span>
          </div>
          
          <div className="flex items-center gap-2">
            {user.username ? (
              <>
                <a
                  href={`https://t.me/${user.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{user.username}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
                <button
                  onClick={() => handleCopy(`@${user.username}`, 'username')}
                  className="w-4 h-4 flex items-center justify-center hover:bg-zinc-800 rounded transition-colors"
                >
                  {copiedField === 'username' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500 animate-in zoom-in" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-300" />
                  )}
                </button>
              </>
            ) : (
              <span className="text-xs text-zinc-600 italic">No establecido</span>
            )}
          </div>
        </div>

        {/* 3. Platform & Language Grid */}
        <div className="grid grid-cols-2 divide-x divide-zinc-800">
            
            {/* Platform */}
            <div className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Smartphone className="w-3 h-3" />
                    <span>Plataforma</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></div>
                    <span className="text-[10px] font-bold text-sky-400 tracking-wide">Telegram</span>
                </div>
            </div>

            {/* Language */}
            <div className="flex flex-col items-center justify-center gap-1.5 px-3 py-3 hover:bg-zinc-800/30 transition-colors">
                <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Globe className="w-3 h-3" />
                    <span>Idioma</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950 border border-zinc-800">
                    <span className="text-xs leading-none">{langConfig.flag}</span>
                    <span className="text-[10px] font-medium text-zinc-300">{langConfig.label}</span>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
}
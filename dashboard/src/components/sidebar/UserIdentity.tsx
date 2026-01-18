// // User Identity Section
// import { Copy, ExternalLink } from 'lucide-react';

// interface UserIdentityProps {
//   user: {
//     id: string;
//     telegramId: number;
//     username?: string;
//     firstName: string;
//     lastName?: string;
//     language: string;
//     platform: 'telegram';
//   };
// }

// export function SidebarUserIdentity({ user }: UserIdentityProps) {
//   const copyToClipboard = (text: string) => {
//     navigator.clipboard.writeText(text);
//     // Could add toast notification here
//   };

//   return (
//     <div className="px-4 py-2 space-y-2">
//       {/* Telegram ID */}
//       <div className="flex items-center justify-between group">
//         <span className="text-xs text-gray-500 dark:text-gray-400">ID Telegram</span>
//         <div className="flex items-center gap-1">
//           <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
//             {user.telegramId}
//           </code>
//           <button
//             onClick={() => copyToClipboard(String(user.telegramId))}
//             className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-opacity"
//             title="Copiar ID"
//           >
//             <Copy className="w-3 h-3 text-gray-400" />
//           </button>
//         </div>
//       </div>

//       {/* Username */}
//       <div className="flex items-center justify-between group">
//         <span className="text-xs text-gray-500 dark:text-gray-400">Username</span>
//         <div className="flex items-center gap-1">
//           {user.username ? (
//             <>
//               <a
//                 href={`https://t.me/${user.username}`}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
//               >
//                 @{user.username}
//                 <ExternalLink className="w-3 h-3" />
//               </a>
//               <button
//                 onClick={() => copyToClipboard(`@${user.username}`)}
//                 className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-opacity"
//                 title="Copiar username"
//               >
//                 <Copy className="w-3 h-3 text-gray-400" />
//               </button>
//             </>
//           ) : (
//             <span className="text-xs text-gray-400 italic">No establecido</span>
//           )}
//         </div>
//       </div>

//       {/* Platform badge */}
//       <div className="flex items-center justify-between">
//         <span className="text-xs text-gray-500 dark:text-gray-400">Plataforma</span>
//         <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
//           📱 Telegram
//         </span>
//       </div>

//       {/* Language */}
//       <div className="flex items-center justify-between">
//         <span className="text-xs text-gray-500 dark:text-gray-400">Idioma</span>
//         <span className="text-xs text-gray-700 dark:text-gray-300">
//           {user.language === 'es' ? '🇪🇸 Español' : '🇺🇸 English'}
//         </span>
//       </div>
//     </div>
//   );
// }
// SidebarUserIdentity.tsx - Refactored UI
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
  // Default fallback handled in component
};

export function SidebarUserIdentity({ user }: UserIdentityProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const langConfig = LANGUAGE_MAP[user.language] || { label: user.language.toUpperCase(), flag: '🌐' };

  return (
    <div className="px-3 py-2">
      <div className="bg-white dark:bg-[#1a1d26] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        
        {/* 1. Telegram ID */}
        <div 
          className="group flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
          onClick={() => handleCopy(String(user.telegramId), 'telegramId')}
        >
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <Hash className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">ID Telegram</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
              {user.telegramId}
            </code>
            <div className="w-3.5 h-3.5 flex items-center justify-center">
              {copiedField === 'telegramId' ? (
                <Check className="w-3 h-3 text-green-500 animate-in zoom-in" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </div>
        </div>

        {/* 2. Username */}
        <div className="group flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
            <AtSign className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">Username</span>
          </div>
          <div className="flex items-center gap-2">
            {user.username ? (
              <>
                <a
                  href={`https://t.me/${user.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()} // Prevent triggering parent copy if wrapped
                >
                  @{user.username}
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
                <button
                  onClick={() => handleCopy(`@${user.username}`, 'username')}
                  className="w-3.5 h-3.5 flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
                >
                  {copiedField === 'username' ? (
                    <Check className="w-3 h-3 text-green-500" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-400 italic">No establecido</span>
            )}
          </div>
        </div>

        {/* 3. Platform & Language Row */}
        <div className="flex divide-x divide-gray-100 dark:divide-gray-800">
            
            {/* Platform */}
            <div className="flex-1 px-3 py-2.5 flex flex-col gap-1 items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Smartphone className="w-3 h-3" />
                    <span>Plataforma</span>
                </div>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300">
                    Telegram
                </span>
            </div>

            {/* Language */}
            <div className="flex-1 px-3 py-2.5 flex flex-col gap-1 items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Globe className="w-3 h-3" />
                    <span>Idioma</span>
                </div>
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                    <span>{langConfig.flag}</span>
                    {langConfig.label}
                </span>
            </div>

        </div>
      </div>
    </div>
  );
}
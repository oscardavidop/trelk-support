// User Identity Section
import { Copy, ExternalLink } from 'lucide-react';

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

export function SidebarUserIdentity({ user }: UserIdentityProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add toast notification here
  };

  return (
    <div className="px-4 py-2 space-y-2">
      {/* Telegram ID */}
      <div className="flex items-center justify-between group">
        <span className="text-xs text-gray-500 dark:text-gray-400">ID Telegram</span>
        <div className="flex items-center gap-1">
          <code className="text-xs font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-300">
            {user.telegramId}
          </code>
          <button
            onClick={() => copyToClipboard(String(user.telegramId))}
            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-opacity"
            title="Copiar ID"
          >
            <Copy className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Username */}
      <div className="flex items-center justify-between group">
        <span className="text-xs text-gray-500 dark:text-gray-400">Username</span>
        <div className="flex items-center gap-1">
          {user.username ? (
            <>
              <a
                href={`https://t.me/${user.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
              >
                @{user.username}
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                onClick={() => copyToClipboard(`@${user.username}`)}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-opacity"
                title="Copiar username"
              >
                <Copy className="w-3 h-3 text-gray-400" />
              </button>
            </>
          ) : (
            <span className="text-xs text-gray-400 italic">No establecido</span>
          )}
        </div>
      </div>

      {/* Platform badge */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">Plataforma</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          📱 Telegram
        </span>
      </div>

      {/* Language */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">Idioma</span>
        <span className="text-xs text-gray-700 dark:text-gray-300">
          {user.language === 'es' ? '🇪🇸 Español' : '🇺🇸 English'}
        </span>
      </div>
    </div>
  );
}

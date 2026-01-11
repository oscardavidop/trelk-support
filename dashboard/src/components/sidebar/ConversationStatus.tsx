// Conversation Status Section
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ConversationStatusProps {
  status: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closedBy?: string;
  closureReason?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  bot: { label: 'Bot', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300', icon: '🤖' },
  waiting: { label: 'En espera', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: '⏳' },
  human: { label: 'Abierto', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: '💬' },
  closed: { label: 'Cerrado', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: '✅' },
};

export function SidebarConversationStatus({
  status,
  createdAt,
  updatedAt,
  closedAt,
  closedBy,
  closureReason,
}: ConversationStatusProps) {
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.bot;
  const lastEventDate = closedAt || updatedAt;

  return (
    <div className="px-4 py-2 space-y-3">
      {/* Status badge */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusConfig.color}`}>
          {statusConfig.icon} {statusConfig.label}
        </span>
      </div>

      {/* Last event */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center justify-between">
          <span>Última actividad:</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {formatDistanceToNow(new Date(lastEventDate), { addSuffix: true, locale: es })}
          </span>
        </div>
        <div className="text-right text-[10px] text-gray-400 mt-0.5">
          {format(new Date(lastEventDate), "dd MMM yyyy, HH:mm", { locale: es })}
        </div>
      </div>

      {/* Created at */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center justify-between">
          <span>Iniciado:</span>
          <span className="text-gray-700 dark:text-gray-300">
            {format(new Date(createdAt), "dd MMM yyyy, HH:mm", { locale: es })}
          </span>
        </div>
      </div>

      {/* Closure info */}
      {status === 'closed' && closedAt && (
        <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md text-xs space-y-1">
          {closedBy && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">Cerrado por:</span>
              <span className="font-medium text-gray-700 dark:text-gray-300">{closedBy}</span>
            </div>
          )}
          {closureReason && (
            <div className="text-gray-600 dark:text-gray-400 italic">
              "{closureReason}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

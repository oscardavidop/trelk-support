// ActivityTimeline.tsx - Refactored UI
import { useEffect, useState, useMemo } from 'react';
import { useSupervisorStore, type ActivityItem } from '../../stores/supervisorStore';
import { useAuthStore } from '../../stores/authStore';
import { 
  MessageSquare, User, CheckCircle2, Lock, 
  Crown, Trash2, Pin, ArrowRightLeft, FileText, 
  Tag, FolderOpen, Settings, Bot, Mic, ShieldBan, 
  AlertCircle, Clock, StickyNote, Activity
} from 'lucide-react';

interface Props {
  sessionId: string;
}

// Configuración de estilos minimalista
const getActivityConfig = (type: string) => {
  const configs: Record<string, { icon: any; color: string; bg: string }> = {
    session_created: { icon: Clock, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    session_assigned: { icon: User, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    session_transferred: { icon: ArrowRightLeft, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-500/10' },
    session_closed: { icon: CheckCircle2, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
    session_reopened: { icon: Lock, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-500/10' },
    message_sent: { icon: MessageSquare, color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10' },
    message_received: { icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
    note_added: { icon: StickyNote, color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-500/10' },
    tag_added: { icon: Tag, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-500/10' },
    category_changed: { icon: FolderOpen, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-500/10' },
    system_event: { icon: Settings, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800/50' },
    automation_triggered: { icon: Bot, color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-500/10' },
    default: { icon: Activity, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800' },
  };
  return configs[type] || configs.default;
};

// Badges para metadatos
const MetadataRenderer = ({ type, metadata }: { type: string; metadata?: any }) => {
  if (!metadata || Object.keys(metadata).length === 0) return null;

  // Renderizado especial para notas (bloque destacado)
  if (type === 'note_added' && metadata.note) {
    return (
      <div className="mt-1.5 p-2 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-800/30 rounded text-xs italic text-gray-600 dark:text-gray-300 break-words">
        "{metadata.note}"
      </div>
    );
  }

  // Renderizado genérico (chips)
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {Object.entries(metadata).map(([key, value]) => {
        if (['agentName', 'toAgentName', 'note'].includes(key)) return null;
        return (
          <span key={key} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 max-w-full">
            <span className="opacity-70 mr-1">{key}:</span> 
            <span className="truncate max-w-[100px] font-medium">{String(value)}</span>
          </span>
        );
      })}
    </div>
  );
};

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));
};

export function ActivityTimeline({ sessionId }: Props) {
  const { sessionActivities, setSessionActivities } = useSupervisorStore();
  const token = useAuthStore((s) => s.token);
  const [loading, setLoading] = useState(false);
  
  const activities = sessionActivities[sessionId] || [];
  
  useEffect(() => {
    const loadActivities = async () => {
        if (!sessionId) return;
        setLoading(true);
        try {
          const res = await fetch(`/api/sessions/${sessionId}/timeline`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data.success && data.data) {
             const transformed = data.data.map((item: any) => ({
                id: item._id || item.id,
                sessionId: item.sessionId,
                type: item.action || item.type,
                description: item.description,
                agentId: item.actor?.id,
                agentName: item.actor?.name || 'Sistema',
                metadata: item.metadata,
                createdAt: new Date(item.createdAt),
             }));
             setSessionActivities(sessionId, transformed);
          }
        } catch (e) { console.error(e) } 
        finally { setLoading(false); }
    };
    loadActivities();
  }, [sessionId, token, setSessionActivities]);
  
  const groupedActivities = useMemo(() => {
    return activities.reduce((groups, activity) => {
        const d = new Date(activity.createdAt);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateKey = d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
        if (d.toDateString() === today.toDateString()) dateKey = 'Hoy';
        else if (d.toDateString() === yesterday.toDateString()) dateKey = 'Ayer';
        
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(activity);
        return groups;
    }, {} as Record<string, ActivityItem[]>);
  }, [activities]);

  if (loading) return <div className="py-8 text-center text-xs text-gray-400 animate-pulse">Cargando historial...</div>;
  if (activities.length === 0) return <div className="py-8 text-center text-xs text-gray-400">Sin actividad registrada</div>;

  return (
    <div className="px-3 py-2 w-full overflow-hidden">
      <div className="relative">
        
        {/* Línea vertical continua (Absolute background line) */}
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-800" />

        {Object.entries(groupedActivities).map(([date, dayActivities]) => (
          <div key={date} className="relative mb-6 last:mb-0">
            
            {/* Header de Fecha Sticky */}
            <div className="sticky top-0 z-10 py-1 mb-3 bg-white/95 dark:bg-[#0f1117]/95 backdrop-blur-sm -ml-3 pl-3">
               <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50 px-2 py-0.5 rounded border border-gray-100 dark:border-gray-800">
                 {date}
               </span>
            </div>

            <div className="space-y-5">
              {dayActivities.map((activity) => {
                const style = getActivityConfig(activity.type);
                const Icon = style.icon;

                return (
                  <div key={activity.id} className="relative pl-8 group">
                    
                    {/* Icono en la línea de tiempo */}
                    <div className={`
                        absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center
                        border border-white dark:border-[#0f1117] ring-4 ring-white dark:ring-[#0f1117]
                        ${style.bg} ${style.color} z-10
                    `}>
                      <Icon className="w-3 h-3" />
                    </div>

                    {/* Contenido */}
                    <div className="flex flex-col gap-0.5">
                      <div className="flex justify-between items-start gap-2">
                         <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-tight">
                            {activity.description || activity.type}
                         </p>
                         <time className="text-[10px] text-gray-400 font-mono shrink-0 whitespace-nowrap">
                            {formatTime(activity.createdAt)}
                         </time>
                      </div>

                      {/* Agente */}
                      {activity.agentName && (
                        <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] ${activity.agentName === 'Sistema' ? 'text-gray-400 italic' : 'text-indigo-500 dark:text-indigo-400 font-medium'}`}>
                                {activity.agentName}
                            </span>
                        </div>
                      )}

                      {/* Metadatos adicionales */}
                      <MetadataRenderer type={activity.type} metadata={activity.metadata} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActivityTimeline;
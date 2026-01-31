import { useEffect, useState, useMemo } from 'react';
import { useSupervisorStore, type ActivityItem } from '../../stores/supervisorStore';
import { useAuthStore } from '../../stores/authStore';
import { 
  MessageSquare, User, CheckCircle2, Lock, 
  Crown, Trash2, Pin, ArrowRightLeft, FileText, 
  Tag, FolderOpen, Settings, Bot, Mic, ShieldBan, 
  AlertCircle, Clock, StickyNote, Activity, Download
} from 'lucide-react';

interface Props {
  sessionId: string;
}

// Configuración de Estilos (Premium Zinc)
const getActivityConfig = (type: string) => {
  const defaults = { icon: Activity, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
  
  const configs: Record<string, typeof defaults> = {
    session_created: { icon: Clock, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    session_assigned: { icon: User, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    session_transferred: { icon: ArrowRightLeft, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    session_closed: { icon: CheckCircle2, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
    session_reopened: { icon: Lock, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    message_sent: { icon: MessageSquare, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    message_received: { icon: MessageSquare, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    note_added: { icon: StickyNote, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    tag_added: { icon: Tag, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
    category_changed: { icon: FolderOpen, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    system_event: { icon: Settings, color: 'text-zinc-500', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
    automation_triggered: { icon: Bot, color: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  };
  return configs[type] || defaults;
};

// Renderizador de Metadatos
const MetadataRenderer = ({ type, metadata }: { type: string; metadata?: any }) => {
  if (!metadata || Object.keys(metadata).length === 0) return null;

  // Notas destacadas
  if (type === 'note_added' && metadata.note) {
    return (
      <div className="mt-2 p-2.5 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-xs italic text-zinc-300 break-words relative">
        <div className="absolute top-0 left-0 w-0.5 h-full bg-yellow-500/50 rounded-l-lg" />
        "{metadata.note}"
      </div>
    );
  }

  // Chips genéricos
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {Object.entries(metadata).map(([key, value]) => {
        if (['agentName', 'toAgentName', 'note'].includes(key)) return null;
        return (
          <span key={key} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 font-mono">
            <span className="opacity-50 mr-1">{key}:</span> 
            <span className="text-zinc-300 truncate max-w-[120px]">{String(value)}</span>
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

  if (loading && activities.length === 0) {
      return (
          <div className="py-8 space-y-4 px-4">
              {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800" />
                      <div className="flex-1 space-y-2 py-1">
                          <div className="h-2 bg-zinc-900 rounded w-3/4" />
                          <div className="h-2 bg-zinc-900 rounded w-1/2" />
                      </div>
                  </div>
              ))}
          </div>
      );
  }

  if (activities.length === 0) return <div className="py-8 text-center text-xs text-zinc-500 italic">Sin actividad registrada</div>;

  return (
    <div className="px-2 py-2 w-full">
      <div className="relative ml-2">
        
        {/* Línea Vertical Continua */}
        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-zinc-800/60" />

        {Object.entries(groupedActivities).map(([date, dayActivities]) => (
          <div key={date} className="relative mb-8 last:mb-0">
            
            {/* Date Header Sticky */}
            <div className="sticky top-0 z-10 py-2 mb-4 bg-zinc-950/90 backdrop-blur-sm">
               <span className="relative z-20 text-[10px] font-bold text-zinc-500 tracking-widest bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full shadow-sm">
                 {date}
               </span>
            </div>

            <div className="space-y-6">
              {dayActivities.map((activity) => {
                const style = getActivityConfig(activity.type);
                const Icon = style.icon;

                return (
                  <div key={activity.id} className="relative pl-10 group">
                    
                    {/* Icon Marker */}
                    <div className={`
                        absolute left-[3px] top-0 w-6 h-6 rounded-full flex items-center justify-center
                        border ring-4 ring-zinc-950 z-10 transition-transform group-hover:scale-110
                        ${style.bg} ${style.border} ${style.color}
                    `}>
                      <Icon className="w-3 h-3" />
                    </div>

                    {/* Content Body */}
                    <div className="flex flex-col">
                      <div className="flex justify-between items-start gap-3">
                          <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                            {activity.description || activity.type.replace('_', ' ')}
                          </p>
                          <time className="text-[9px] text-zinc-500 font-mono shrink-0 pt-0.5">
                            {formatTime(activity.createdAt)}
                          </time>
                      </div>

                      {/* Actor */}
                      {activity.agentName && (
                        <div className="mt-0.5">
                            <span className={`text-[10px] ${activity.agentName === 'Sistema' ? 'text-zinc-500' : 'text-indigo-400 font-medium'}`}>
                                {activity.agentName}
                            </span>
                        </div>
                      )}

                      {/* Metadata */}
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
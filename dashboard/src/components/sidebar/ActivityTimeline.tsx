import { useEffect, useState, useMemo } from 'react';
import { useSupervisorStore, type ActivityItem } from '../../stores/supervisorStore';
import { useAuthStore } from '../../stores/authStore';
import {
  MessageSquare, User, CheckCircle2, Lock,
  Crown, Trash2, Pin, ArrowRightLeft, FileText,
  Tag, FolderOpen, Settings, Bot, Mic, ShieldBan,
  AlertCircle, Clock, StickyNote
} from 'lucide-react';

interface Props {
  sessionId: string;
}

// Configuración de estilos más sutil
const getActivityConfig = (type: string) => {
  // Usamos colores de texto vibrantes pero fondos transparentes o muy sutiles
  const configs: Record<string, { icon: any; color: string; border: string }> = {
    session_created: { icon: Clock, color: 'text-emerald-400', border: 'border-emerald-500/30' },
    session_assigned: { icon: User, color: 'text-blue-400', border: 'border-blue-500/30' },
    session_transferred: { icon: ArrowRightLeft, color: 'text-amber-400', border: 'border-amber-500/30' },
    session_closed: { icon: CheckCircle2, color: 'text-slate-400', border: 'border-slate-500/30' },
    session_reopened: { icon: Lock, color: 'text-orange-400', border: 'border-orange-500/30' },
    message_sent: { icon: MessageSquare, color: 'text-blue-400', border: 'border-blue-500/30' },
    message_received: { icon: MessageSquare, color: 'text-emerald-400', border: 'border-emerald-500/30' },
    note_added: { icon: StickyNote, color: 'text-yellow-400', border: 'border-yellow-500/30' },
    system_event: { icon: Settings, color: 'text-slate-500', border: 'border-slate-500/30' },
    automation_triggered: { icon: Bot, color: 'text-sky-400', border: 'border-sky-500/30' },
    default: { icon: AlertCircle, color: 'text-gray-400', border: 'border-gray-600/30' },
  };
  return configs[type] || configs.default;
};

// Componente para badges de metadata
const MetadataBadge = ({ label, value }: { label: string, value: any }) => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-800/50 border border-gray-700 text-gray-400 max-w-full">
    <span className="opacity-50 mr-1 shrink-0">{label}:</span>
    <span className="truncate max-w-[120px]">{String(value)}</span>
  </span>
);

const MetadataRenderer = ({ type, metadata }: { type: string; metadata?: any }) => {
  if (!metadata || Object.keys(metadata).length === 0) return null;

  // Renderizado especial para notas
  if (type === 'note_added' && metadata.note) {
    return (
      <div className="mt-2 pl-3 border-l-2 border-yellow-500/30 text-sm italic text-gray-400 break-words">
        {metadata.note}
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {Object.entries(metadata).map(([key, value]) => {
        if (['agentName', 'toAgentName', 'note'].includes(key)) return null;
        return <MetadataBadge key={key} label={key} value={value} />;
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
      let dateKey = d.toLocaleDateString('es', { day: 'numeric', month: 'long' });
      if (d.toDateString() === today.toDateString()) dateKey = 'Hoy';
      else if (d.toDateString() === yesterday.toDateString()) dateKey = 'Ayer';
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(activity);
      return groups;
    }, {} as Record<string, ActivityItem[]>);
  }, [activities]);

  if (loading) return <div className="p-8 text-center text-gray-500 text-xs animate-pulse">Cargando...</div>;
  if (activities.length === 0) return <div className="p-8 text-center text-gray-500 text-xs">Sin actividad</div>;

  return (
    <div className="w-full max-w-full overflow-x-hidden px-4 py-4">
      {/* Contenedor Relativo para la línea maestra */}
      <div className="relative">

        {/* LÍNEA MAESTRA: 
            Conecta todo de arriba a abajo.
            left-[19px] es el centro exacto si el icono mide w-10 (40px)
        */}
        <div className="absolute left-[15px] top-2 bottom-0 w-px bg-gray-600" />

        {Object.entries(groupedActivities).map(([date, dayActivities]) => (

          <div key={date} className="relative mb-6">

            {/* CABECERA DE FECHA: 
                Fondo sólido para tapar la línea y flotar sobre ella.
            */}
            <div className="relative z-10 mb-4 pl-0.5">
              <span className="inline-block px-3 py-1 rounded bg-gray-800/80 border border-gray-700 text-xs font-semibold text-gray-300 backdrop-blur-sm shadow-sm">
                {date}
              </span>
            </div>

            <div className="space-y-6">
              {dayActivities.map((activity) => {
                const style = getActivityConfig(activity.type);
                const Icon = style.icon;

                return (
                  <>
                  <hr className="border-t border-gray-700 my-4" />

                  <div key={activity.id} className="relative flex gap-4 group">

                    {/* ICONO: 
                        1. bg-gray-900: Fondo sólido para que no se vea la línea a través del icono.
                        2. z-10: Para estar encima de la línea.
                        3. Sin rings molestos, solo un borde sutil coloreado.
                    */}
                    <div className={`
                        relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                        bg-gray-900 border ${style.border} ${style.color}
                        shadow-sm transition-all group-hover:scale-110 group-hover:bg-gray-800
                    `}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* CONTENIDO DEL EVENTO */}
                    <div className="flex-1 min-w-0 pt-1 pb-1">
                      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">

                        {/* Descripción */}
                        <p className="text-sm text-gray-300 break-words leading-snug">
                          {activity.description || activity.type}
                        </p>

                        {/* Hora */}
                        <time className="text-[13px] text-gray-400 font-mono shrink-0 select-none">
                          {formatTime(activity.createdAt)}
                        </time>
                      </div>

                      {/* Agente */}
                      {activity.agentName && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={`text-[13px] ${activity.agentName === 'Sistema' ? 'text-gray-500 uppercase tracking-wider' : 'text-gray-500 font-medium'}`}>
                            {activity.agentName}
                          </span>
                        </div>
                      )}

                      {/* Metadatos */}
                      <MetadataRenderer type={activity.type} metadata={activity.metadata} />
                    </div>
                  </div>
                  </>
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
/**
 * ActivityTimeline - Shows activity log for a session
 * Displays all actions: messages, transfers, notes, agent changes, etc.
 */

import { useEffect, useState } from 'react';
import { useSupervisorStore, type ActivityItem } from '../../stores/supervisorStore';
import { useAuthStore } from '../../stores/authStore';

interface Props {
  sessionId: string;
}

const activityIcons: Record<string, { icon: string; color: string }> = {
  // Session lifecycle
  session_created: { icon: '🆕', color: 'text-green-400' },
  session_assigned: { icon: '👤', color: 'text-blue-400' },
  session_transferred: { icon: '🔄', color: 'text-yellow-400' },
  session_closed: { icon: '✅', color: 'text-gray-400' },
  session_reopened: { icon: '🔓', color: 'text-orange-400' },
  session_takeover: { icon: '👑', color: 'text-purple-400' },
  
  // Messages
  message_sent: { icon: '💬', color: 'text-blue-400' },
  message_received: { icon: '📨', color: 'text-green-400' },
  message_edited: { icon: '✏️', color: 'text-yellow-400' },
  message_deleted: { icon: '🗑️', color: 'text-red-400' },
  message_pinned: { icon: '📌', color: 'text-purple-400' },
  
  // Agent actions
  agent_joined: { icon: '➡️', color: 'text-green-400' },
  agent_left: { icon: '⬅️', color: 'text-gray-400' },
  agent_status_changed: { icon: '🔵', color: 'text-blue-400' },
  
  // Contact actions
  note_added: { icon: '📝', color: 'text-yellow-400' },
  note_deleted: { icon: '📝', color: 'text-red-400' },
  tag_added: { icon: '🏷️', color: 'text-blue-400' },
  tag_removed: { icon: '🏷️', color: 'text-gray-400' },
  category_changed: { icon: '📁', color: 'text-purple-400' },
  
  // System
  system_event: { icon: '⚙️', color: 'text-gray-400' },
  automation_triggered: { icon: '🤖', color: 'text-cyan-400' },
  whisper_sent: { icon: '🤫', color: 'text-purple-400' },
  
  // User actions
  user_blocked: { icon: '🚫', color: 'text-red-400' },
  user_unblocked: { icon: '✅', color: 'text-green-400' },
  
  default: { icon: '•', color: 'text-gray-400' },
};

function getActivityStyle(type: string) {
  return activityIcons[type] || activityIcons.default;
}

function formatTime(date: Date) {
  const d = new Date(date);
  return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (d.toDateString() === today.toDateString()) {
    return 'Hoy';
  } else if (d.toDateString() === yesterday.toDateString()) {
    return 'Ayer';
  }
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function formatActivityDescription(action: string, metadata?: Record<string, unknown>): string {
  const descriptions: Record<string, string> = {
    session_created: 'Sesión iniciada',
    session_assigned: `Asignado a ${metadata?.agentName || 'agente'}`,
    session_transferred: `Transferido a ${metadata?.toAgentName || 'otro agente'}`,
    session_closed: 'Sesión cerrada',
    message_sent: 'Mensaje enviado',
    message_received: 'Mensaje recibido',
    category_changed: `Categoría cambiada a ${metadata?.category || 'nueva'}`,
    note_added: 'Nota añadida',
    tag_added: `Etiqueta "${metadata?.tag || ''}" añadida`,
    tag_removed: `Etiqueta "${metadata?.tag || ''}" removida`,
  };
  return descriptions[action] || action.replace(/_/g, ' ');
}

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
        // Use the sessions API endpoint that's accessible to all agents
        const res = await fetch(`/api/sessions/${sessionId}/timeline`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.success) {
          // Transform data to ActivityItem format
          const transformed = (data.data || []).map((item: any) => ({
            id: item._id || item.id,
            sessionId: item.sessionId,
            type: item.action || item.type,
            description: item.description || formatActivityDescription(item.action, item.metadata),
            agentId: item.actor?.id,
            agentName: item.actor?.name,
            metadata: item.metadata,
            createdAt: new Date(item.createdAt),
          }));
          setSessionActivities(sessionId, transformed);
        }
      } catch (error) {
        console.error('Failed to load activities:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadActivities();
  }, [sessionId, token, setSessionActivities]);
  
  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const dateKey = formatDate(activity.createdAt);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);
    return groups;
  }, {} as Record<string, ActivityItem[]>);
  
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-700 rounded-full" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-gray-700 rounded mb-1" />
              <div className="h-3 w-20 bg-gray-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  if (activities.length === 0) {
    return (
      <div className="p-4 text-center">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-gray-500">Sin actividad registrada</p>
      </div>
    );
  }
  
  return (
    <div className="p-4 space-y-4">
      {Object.entries(groupedActivities).map(([date, dayActivities]) => (
        <div key={date}>
          {/* Date header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-gray-700" />
            <span className="text-xs text-gray-500 font-medium">{date}</span>
            <div className="h-px flex-1 bg-gray-700" />
          </div>
          
          {/* Activities */}
          <div className="space-y-3">
            {dayActivities.map((activity, index) => {
              const style = getActivityStyle(activity.type);
              
              return (
                <div key={activity.id || index} className="flex gap-3">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-sm ${style.color}`}>
                    {style.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">
                        {formatTime(activity.createdAt)}
                      </span>
                      {activity.agentName && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-xs text-gray-400">
                            {activity.agentName}
                          </span>
                        </>
                      )}
                    </div>
                    
                    {/* Metadata */}
                    {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                      <div className="mt-2 p-2 bg-gray-800/50 rounded text-xs text-gray-400">
                        {Object.entries(activity.metadata).map(([key, value]) => (
                          <div key={key} className="flex gap-2">
                            <span className="text-gray-500">{key}:</span>
                            <span>{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ActivityTimeline;

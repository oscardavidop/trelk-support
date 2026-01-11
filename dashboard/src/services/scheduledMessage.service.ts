/**
 * Scheduled Message Service - API calls for scheduled messages
 */

import { useAuthStore } from '../stores/authStore';
import type { 
  ScheduledMessage, 
  CreateScheduledMessageInput, 
  ScheduledMessageStatus,
  ScheduledMessageStats 
} from '../types/scheduledMessage';

const getAuthHeader = () => ({
  Authorization: `Bearer ${useAuthStore.getState().token}`,
  'Content-Type': 'application/json',
});

/**
 * Create a new scheduled message
 */
export async function createScheduledMessage(
  input: CreateScheduledMessageInput
): Promise<{ ok: boolean; data?: ScheduledMessage; error?: string }> {
  const res = await fetch('/api/scheduled-messages', {
    method: 'POST',
    headers: getAuthHeader(),
    body: JSON.stringify(input),
  });
  
  const json = await res.json();
  return json;
}

/**
 * Get scheduled messages for a session
 */
export async function getSessionScheduledMessages(
  sessionId: string,
  status?: ScheduledMessageStatus[]
): Promise<{ ok: boolean; data?: ScheduledMessage[]; error?: string }> {
  const params = new URLSearchParams();
  if (status && status.length > 0) {
    params.set('status', status.join(','));
  }
  
  const url = `/api/scheduled-messages/session/${sessionId}${params.toString() ? `?${params}` : ''}`;
  const res = await fetch(url, {
    headers: getAuthHeader(),
  });
  
  return res.json();
}

/**
 * Cancel a scheduled message
 */
export async function cancelScheduledMessage(
  messageId: string,
  reason?: string
): Promise<{ ok: boolean; data?: ScheduledMessage; error?: string }> {
  const res = await fetch(`/api/scheduled-messages/${messageId}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
    body: JSON.stringify({ reason }),
  });
  
  return res.json();
}

/**
 * Get all pending scheduled messages (admin/supervisor)
 */
export async function getAllPendingMessages(): Promise<{ ok: boolean; data?: ScheduledMessage[]; error?: string }> {
  const res = await fetch('/api/scheduled-messages/pending', {
    headers: getAuthHeader(),
  });
  
  return res.json();
}

/**
 * Get scheduled message stats (admin/supervisor)
 */
export async function getScheduledMessageStats(): Promise<{ 
  ok: boolean; 
  data?: { 
    stats: ScheduledMessageStats;
    worker: {
      isRunning: boolean;
      lastRunAt: string | null;
      consecutiveErrors: number;
    };
  }; 
  error?: string;
}> {
  const res = await fetch('/api/scheduled-messages/stats', {
    headers: getAuthHeader(),
  });
  
  return res.json();
}

/**
 * Format time remaining to human readable string
 * @param scheduledAt - ISO date string or milliseconds remaining
 */
export function formatTimeRemaining(scheduledAt: string | number | null): string {
  if (scheduledAt === null) return '—';
  
  let ms: number;
  if (typeof scheduledAt === 'string') {
    // It's a date string, calculate time remaining
    ms = new Date(scheduledAt).getTime() - Date.now();
  } else {
    ms = scheduledAt;
  }
  
  if (ms <= 0) return 'Ahora';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

/**
 * Get status display label
 */
export function getStatusDisplay(status: ScheduledMessageStatus): string {
  const statusMap: Record<ScheduledMessageStatus, string> = {
    pending: 'Pendiente',
    processing: 'Enviando',
    sent: 'Enviado',
    cancelled: 'Cancelado',
    failed: 'Fallido',
    expired: 'Expirado',
  };
  
  return statusMap[status] || 'Pendiente';
}

/**
 * Get schedule type display
 */
export function getScheduleTypeDisplay(type: string): string {
  const typeMap: Record<string, string> = {
    fixed_time: '📅 Hora fija',
    after_inactivity: '⏱️ Por inactividad',
    on_event: '🔔 Por evento',
  };
  
  return typeMap[type] || type;
}

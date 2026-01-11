/**
 * Scheduled Message Types for Frontend
 */

export type ScheduleType = 'fixed_time' | 'after_inactivity' | 'on_event';
export type TriggerEvent = 'agent_online' | 'chat_assigned' | 'chat_reopened' | 'sla_warning' | 'chat_transferred';
export type ScheduledMessageStatus = 'pending' | 'processing' | 'sent' | 'cancelled' | 'failed' | 'expired';
export type MediaType = 'photo' | 'audio' | 'document' | 'video' | 'voice';

export interface ScheduledMessage {
  id: string;
  sessionId: string;
  chatId: number;
  type: ScheduleType;
  status: ScheduledMessageStatus;
  scheduledAt?: string;
  delayMinutes?: number;
  triggerEvent?: TriggerEvent;
  message: {
    text?: string;
    hasMedia: boolean;
    mediaType?: MediaType;
  };
  createdBy: string;
  createdByName?: string;
  sentAt?: string;
  error?: string;
  attempts: number;
  cancelledAt?: string;
  cancelReason?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  timeRemaining: number | null;
}

export interface CreateScheduledMessageInput {
  sessionId: string;
  type: ScheduleType;
  scheduledAt?: string;
  delayMinutes?: number;
  triggerEvent?: TriggerEvent;
  message: {
    text?: string;
    media?: {
      type: MediaType;
      fileId?: string;
      url?: string;
      caption?: string;
    };
    savedReplyId?: string;
  };
  expiresAt?: string;
}

export interface ScheduledMessageStats {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
}

// Types for the support dashboard

export type AvailabilityStatus = 'available' | 'busy' | 'offline';

// Agent roles with hierarchy: admin > supervisor > support > junior
export type AgentRole = 'admin' | 'supervisor' | 'support' | 'junior';

export type OnlineStatus = 'available' | 'busy' | 'away' | 'offline';

export interface Agent {
  _id: string;
  id?: string; // Alias for compatibility
  name: string;
  email: string;
  role: AgentRole;
  onlineStatus: 'online' | 'away' | 'offline';
  status?: OnlineStatus; // Live status for agent cards
  availability?: AvailabilityStatus;
  isActive: boolean;
  avatar?: string;
  lastLogin?: string;
  lastActivity?: string;
  activeChats: number;
  totalChatsHandled: number;
  createdAt: string;
  updatedAt: string;
  // Enterprise fields
  teamId?: string;
  isSupervisingEnabled?: boolean;
  watchingSessions?: string[];
  // Additional agent fields
  department?: string;
  skills?: string[];
  maxConcurrentChats?: number;
  avgResponseTime?: string;
  rating?: number;
}

export interface User {
  _id: string;
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  language: 'en' | 'es';
  isSubscriber: boolean;
}

export interface ChatSession {
  _id: string;
  sessionId: string;
  user: User;
  telegramChatId: number;
  status: 'bot' | 'queued' | 'waiting' | 'human' | 'closed';
  assignedAgent?: Agent;
  closedBy?: Agent;
  closedByType?: 'user' | 'agent' | 'system';
  closeReason?: 'manual' | 'inactivity' | 'resolved' | 'spam';
  closureReason?: string;
  closedAt?: string;
  unreadCount?: number;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  _id: string;
  session: string;
  sender: 'user' | 'bot' | 'agent';
  senderAgent?: { name: string };
  content: string;
  messageType: 'text' | 'image' | 'document' | 'file' | 'sticker' | 'voice' | 'audio' | 'system';
  mediaUrl?: string;
  mediaType?: 'photo' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'animation';
  fileName?: string;
  telegramMessageId?: number;
  isRead: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt: string;
  // Reply support
  replyToMessage?: {
    _id: string;
    sender: 'user' | 'bot' | 'agent';
    senderAgent?: { name: string };
    content: string;
  };
  // Meta
  isEdited?: boolean;
  editedAt?: string;
  isPinned?: boolean;
  internalNote?: string;
  tags?: string[];
}

export interface DashboardStats {
  sessions: {
    total: number;
    bot: number;
    waiting: number;
    human: number;
    closed: number;
  };
  agents: {
    total: number;
    online: number;
    away: number;
    offline: number;
  };
}

export interface AuthState {
  agent: Agent | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
}

// Settings types
export interface BotSettings {
  name: string;
  username: string;
  welcomeMessage: string;
  transferMessage: string;
  offlineMessage: string;
  defaultLanguage: 'en' | 'es';
}

export interface ChatSettings {
  maxWaitTimeMinutes: number;
  autoCloseInactiveMinutes: number;
  autoResponseEnabled: boolean;
  defaultBotMessage: string;
}

export interface AgentRules {
  maxConcurrentChats: number;
  autoAssignEnabled: boolean;
  assignmentMode: 'round-robin' | 'manual' | 'least-busy';
}

export interface SecuritySettings {
  jwtExpirationDays: number;
  rateLimitPerMinute: number;
  logCriticalEvents: boolean;
}

export interface Settings {
  _id: string;
  bot: BotSettings;
  chat: ChatSettings;
  agentRules: AgentRules;
  security: SecuritySettings;
  updatedAt: string;
}

// SavedReply types
export interface SavedReply {
  _id: string;
  title: string;
  content: string;
  category?: string;
  shortcut?: string;
  isActive: boolean;
  usageCount: number;
  createdBy?: { name: string };
  createdAt: string;
  updatedAt: string;
}

export interface SavedReplyStats {
  totalReplies: number;
  activeReplies: number;
  totalUsage: number;
  topReplies: { title: string; usageCount: number }[];
}

export const PLACEHOLDERS: Record<string, string> = {
  '{agentName}': 'Name of the support agent',
  '{userName}': "User's first name",
  '{userUsername}': "User's Telegram username",
  '{chatId}': 'Current chat ID',
  '{sessionId}': 'Current session ID',
  '{date}': 'Current date (YYYY-MM-DD)',
  '{time}': 'Current time (HH:MM)',
};

// ============= CONTACT SIDEBAR TYPES =============

export interface ContactInfo {
  user: {
    id: string;
    telegramId: number;
    username?: string;
    firstName: string;
    lastName?: string;
    language: string;
    platform: 'telegram';
    createdAt: string;
    lastActivity: string;
  };
  session: {
    sessionId: string;
    status: string;
    priority: string;
    category?: string;
    createdAt: string;
    updatedAt: string;
    closedAt?: string;
    closedBy?: string;
    closureReason?: string;
    assignedAgent?: {
      id: string;
      name: string;
    };
  };
  stats: {
    totalMessages: number;
    totalSessions: number;
    firstContactDate: string;
    chatDuration?: number; // seconds
  };
  tags: Tag[];
  notes: {
    count: number;
    latest?: {
      content: string;
      createdAt: string;
      createdBy: string;
    };
  };
  customFields: CustomFieldValue[];
  automations: {
    active: boolean;
    inactivityTimer?: {
      startedAt: string;
      expiresAt: string;
    };
  };
}

export interface Note {
  id: string;
  content: string;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  sessionId?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  description?: string;
  usageCount?: number;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  key: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'select' | 'url' | 'email';
  description?: string;
  required: boolean;
  options?: string[];
  defaultValue?: string | number | boolean;
  order: number;
  isActive: boolean;
}

export interface CustomFieldValue {
  fieldId?: string;
  key: string;
  name: string;
  type: string;
  value: string | number | boolean | null;
}

export interface UserHistorySession {
  sessionId: string;
  status: string;
  category?: string;
  messageCount: number;
  createdAt: string;
  closedAt?: string;
}

// ============= ENTERPRISE TYPES =============

export type ChatCategory = 'support' | 'billing' | 'bug' | 'feedback' | 'other';

export interface Transfer {
  _id: string;
  session: string;
  fromAgent: {
    _id: string;
    name: string;
  };
  toAgent: {
    _id: string;
    name: string;
  };
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  transferredAt: string;
  acceptedAt?: string;
}

export interface UserBlock {
  _id: string;
  user?: string;
  telegramId: number;
  blockType: 'temporary' | 'permanent';
  reason: string;
  blockedBy: {
    _id: string;
    name: string;
  };
  expiresAt?: string;
  unblockedAt?: string;
  unblockedBy?: {
    _id: string;
    name: string;
  };
  isActive: boolean;
  createdAt: string;
}

export interface Survey {
  _id: string;
  session: string;
  user?: {
    _id: string;
    firstName: string;
  };
  agent?: {
    _id: string;
    name: string;
  };
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  submittedAt: string;
}

export interface MetricsData {
  avgFirstResponseTime: number;
  totalChats: number;
  chatsByAgent: { agentId: string; agentName: string; count: number }[];
  closedByInactivity: number;
  peakHours: { hour: number; count: number }[];
  avgRating: number;
  ratingDistribution: { rating: number; count: number }[];
  categoryDistribution: { category: string; count: number }[];
}

// Socket.IO Events for enterprise features
export interface TypingEvent {
  sessionId: string;
  agentId?: string;
  agentName?: string;
  userId?: number;
}

export interface TransferEvent {
  sessionId: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  reason: string;
}

export interface ReopenEvent {
  sessionId: string;
  reopenedBy: string;
  agentName: string;
}

export interface BlockEvent {
  telegramId: number;
  username?: string;
  reason: string;
  blockType: 'temporary' | 'permanent';
  expiresAt?: string;
  blockedBy: string;
}

export interface UnblockEvent {
  telegramId: number;
  username?: string;
  unblockedBy: string;
}

// Extended ChatSession with enterprise fields
export interface ChatSessionExtended extends ChatSession {
  category?: ChatCategory;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenCount?: number;
  firstResponseAt?: string;
  firstResponseBy?: string;
}


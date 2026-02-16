// Types for the support dashboard

// ============= OMNICHANNEL TYPES =============
export type ChannelType = 'telegram' | 'web' | 'whatsapp' | 'instagram' | 'email';

export interface ChannelMetadata {
  // Web specific - visitor info
  visitorName?: string;
  visitorEmail?: string;
  visitorId?: string;
  // Web specific - page/browser info
  pageUrl?: string;
  pageTitle?: string;
  referrer?: string;
  userAgent?: string;
  browserName?: string;
  os?: string;
  device?: string;
  screenResolution?: string;
  ipAddress?: string;
  geoLocation?: {
    country?: string;
    city?: string;
  };
  // Telegram specific (already have telegramChatId)
  telegramBotId?: string;
  // WhatsApp specific
  whatsappPhoneNumber?: string;
  whatsappWaId?: string;
}

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
  // MFA fields
  mfaEnabled?: boolean;
  mfaVerifiedAt?: string;
  mfaEnforcedByAdmin?: boolean;
  mfaBypassUntil?: string;
  mfaDisabledAt?: string;
  mfaDisabledBy?: string;
  // Telegram integration
  telegramUserId?: number;
  telegramId?: number;
  metrics: {
    totalChats?: number;
    resolvedChats?: number;
    averageRating?: number;
    averageResponseTime?: number;
  };
}

export interface User {
  _id: string;
  telegramId: number;
  username?: string;
  firstName: string;
  lastName?: string;
  language: 'en' | 'es';
  isSubscriber: boolean;
  photoFileId?: string;
}

export interface ChatSession {
  _id: string;
  sessionId: string;
  user: User;
  telegramChatId: number;
  externalChatId?: string; // Universal chat ID for omnichannel
  channel: ChannelType; // Omnichannel support
  channelMetadata?: ChannelMetadata; // Extra channel info
  status: 'bot' | 'queued' | 'waiting' | 'human' | 'closed';
  assignedAgent?: Agent;
  closedBy?: Agent;
  closedByType?: 'user' | 'agent' | 'system' | 'admin';
  closeReason?: 'manual' | 'inactivity' | 'resolved' | 'spam'  | 'admin_force';
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
  senderAgent?: { name: string, avatar?: string };
  senderUser?: {
    _id: string;
    telegramId: number;
    username?: string;
    firstName: string;
    photoFileId?: string;
  };
  content: string;
  channel?: ChannelType; // Omnichannel
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
    senderAgent?: { name: string, avatar?: string };
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
    photoFileId?: string;
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
    disposition?: {
      categoryId?: string;
      categoryCode?: string;
      categoryName?: string;
      subcategoryId?: string;
      subcategoryCode?: string;
      subcategoryName?: string;
      comment?: string;
      tags?: string[];
      completedAt?: string;
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

// ============= AGENT PREFERENCES & SETTINGS =============

export interface AgentPreferences {
  _id?: string;
  agentId: string;
  
  // Appearance
  theme: 'light' | 'dark' | 'system';
  focusMode: boolean;
  language: string;
  timezone: string;
  
  // Sounds
  sounds: {
    enabled: boolean;
    newChat: boolean;
    newMessage: boolean;
    mention: boolean;
    volume: number;
  };
  
  // Chat behavior
  autoScroll: boolean;
  enterToSend: boolean;
  showTypingIndicator: boolean;
  showReadReceipts: boolean;
  
  // Shortcuts
  shortcutsEnabled: boolean;
  
  // Notifications
  notifications: {
    email: {
      enabled: boolean;
      onNewChat: boolean;
      onMention: boolean;
      onAssignment: boolean;
      dailyDigest: boolean;
    };
    inApp: {
      enabled: boolean;
      sound: boolean;
      onNewMessage: boolean;
      onNewChat: boolean;
      onMention: boolean;
    };
    telegram: {
      enabled: boolean;
      chatId?: number;
      onNewChat: boolean;
      onMention: boolean;
    };
    desktop: {
      enabled: boolean;
      onNewMessage: boolean;
      onNewChat: boolean;
    };
  };
  organizationSettings?: {
    agentRules: {
      focusModeEnabled: boolean;
    }
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentSession {
  _id: string;
  agentId: string;
  tokenHash?: string;
  
  // Device info
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser?: string;
  os?: string;
  ip?: string;
  location?: string;
  
  // Status
  isActive: boolean;
  isCurrent?: boolean;
  loginAt: string;
  lastSeenAt: string;
  logoutAt?: string;
  
  createdAt: string;
  updatedAt: string;
}

export type AgentActivityType = 
  | 'status_change'
  | 'login'
  | 'logout'
  | 'chat_opened'
  | 'chat_closed'
  | 'chat_transferred'
  | 'message_sent'
  | 'settings_changed'
  | 'password_changed'
  | 'session_revoked'
  | 'other';

export interface AgentActivity {
  _id: string;
  agentId: string;
  type: AgentActivityType;
  description: string;
  
  // Context
  sessionId?: string;
  targetAgentId?: string;
  metadata?: Record<string, unknown>;
  
  // Location
  ip?: string;
  userAgent?: string;
  
  createdAt: string;
}


export const roleLabels: Record<string, string> = {
  support: "Agente",
  junior: "Junior",
  supervisor: "Supervisor",
  admin: "Administrador",
};
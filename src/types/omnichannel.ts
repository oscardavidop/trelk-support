/**
 * Omnichannel Types - Universal messaging across all channels
 * Supports: Telegram, Web Chat, WhatsApp (future), Instagram (future), Email (future)
 */

// ============= CHANNEL DEFINITIONS =============

export type ChannelType = 'telegram' | 'web' | 'whatsapp' | 'instagram' | 'email';

export interface ChannelConfig {
  type: ChannelType;
  name: string;
  icon: string;
  color: string;
  features: {
    typing: boolean;
    read_receipts: boolean;
    media: boolean;
    voice: boolean;
    stickers: boolean;
    polls: boolean;
    reactions: boolean;
    edit_messages: boolean;
    delete_messages: boolean;
  };
}

export const CHANNEL_CONFIGS: Record<ChannelType, ChannelConfig> = {
  telegram: {
    type: 'telegram',
    name: 'Telegram',
    icon: '📨',
    color: '#0088cc',
    features: {
      typing: true,
      read_receipts: true,
      media: true,
      voice: true,
      stickers: true,
      polls: true,
      reactions: true,
      edit_messages: true,
      delete_messages: true,
    },
  },
  web: {
    type: 'web',
    name: 'Web Chat',
    icon: '🌐',
    color: '#4F46E5',
    features: {
      typing: true,
      read_receipts: true,
      media: true,
      voice: true,
      stickers: false,
      polls: false,
      reactions: true,
      edit_messages: false,
      delete_messages: false,
    },
  },
  whatsapp: {
    type: 'whatsapp',
    name: 'WhatsApp',
    icon: '📱',
    color: '#25D366',
    features: {
      typing: true,
      read_receipts: true,
      media: true,
      voice: true,
      stickers: true,
      polls: false,
      reactions: true,
      edit_messages: false,
      delete_messages: true,
    },
  },
  instagram: {
    type: 'instagram',
    name: 'Instagram',
    icon: '📷',
    color: '#E4405F',
    features: {
      typing: true,
      read_receipts: true,
      media: true,
      voice: false,
      stickers: false,
      polls: false,
      reactions: true,
      edit_messages: false,
      delete_messages: false,
    },
  },
  email: {
    type: 'email',
    name: 'Email',
    icon: '📧',
    color: '#EA4335',
    features: {
      typing: false,
      read_receipts: true,
      media: true,
      voice: false,
      stickers: false,
      polls: false,
      reactions: false,
      edit_messages: false,
      delete_messages: false,
    },
  },
};

// ============= NORMALIZED MESSAGE FORMAT =============

export type MessageContentType = 'text' | 'image' | 'audio' | 'voice' | 'video' | 'file' | 'sticker' | 'location' | 'contact' | 'poll' | 'system';
export type MessageSenderType = 'user' | 'agent' | 'bot' | 'system';

export interface NormalizedMessage {
  id: string;
  sessionId: string;
  channel: ChannelType;
  senderType: MessageSenderType;
  senderId?: string;
  senderName?: string;
  contentType: MessageContentType;
  content: string;
  media?: MediaContent;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  // Channel-specific reference
  externalMessageId?: string | number;
  // Reply context
  replyTo?: {
    messageId: string;
    preview: string;
  };
  // Status
  isRead: boolean;
  readAt?: Date;
  isEdited?: boolean;
  editedAt?: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
}

export interface MediaContent {
  type: 'image' | 'audio' | 'voice' | 'video' | 'file' | 'sticker';
  url: string;
  thumbnailUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number; // For audio/video
  width?: number;    // For images/video
  height?: number;
}

// ============= CONTACT IDENTITY =============

export interface ChannelIdentity {
  channel: ChannelType;
  externalId: string; // telegramId, visitorId, whatsappNumber, etc.
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  metadata?: Record<string, unknown>;
  linkedAt: Date;
  lastSeen?: Date;
  isVerified?: boolean;
}

export interface UnifiedContact {
  _id: string;
  primaryIdentity: ChannelIdentity;
  identities: ChannelIdentity[];
  // Merged profile
  displayName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  // Metadata
  tags: string[];
  customFields: Record<string, unknown>;
  notes?: string;
  // Stats
  totalConversations: number;
  lastActiveAt: Date;
  createdAt: Date;
}

// ============= WEB CHAT SPECIFIC =============

export interface WebVisitor {
  visitorId: string;
  fingerprint?: string;
  // Session info
  currentPageUrl?: string;
  currentPageTitle?: string;
  referrerUrl?: string;
  // Device info
  userAgent?: string;
  browser?: string;
  os?: string;
  device?: string;
  // Geo info
  ipAddress?: string;
  country?: string;
  city?: string;
  timezone?: string;
  // Tracking
  firstVisit: Date;
  lastVisit: Date;
  totalVisits: number;
  pagesViewed: string[];
}

export interface WebChatConfig {
  projectId: string;
  theme: 'light' | 'dark' | 'auto';
  position: 'left' | 'right';
  primaryColor: string;
  welcomeMessage?: string;
  offlineMessage?: string;
  requireEmail: boolean;
  requireName: boolean;
  showAgentPhotos: boolean;
  showAgentNames: boolean;
  enableAttachments: boolean;
  enableEmoji: boolean;
  enableSurvey: boolean;
  customCss?: string;
  allowedDomains: string[];
}

// ============= CHANNEL ADAPTER INTERFACE =============

export interface SendMessageOptions {
  parseMode?: 'HTML' | 'Markdown' | 'text';
  replyToMessageId?: string | number;
  keyboard?: any;
  replyMarkup?: any; // Telegram-style keyboard format
  disablePreview?: boolean;
}

export interface SendMediaOptions extends SendMessageOptions {
  caption?: string;
  fileName?: string;
}

export interface ChannelAdapterInterface {
  readonly channelType: ChannelType;
  readonly config: ChannelConfig;
  
  // Core messaging
  sendMessage(chatId: string | number, text: string, options?: SendMessageOptions): Promise<{ messageId: string | number; success: boolean }>;
  sendMedia(chatId: string | number, media: MediaContent, options?: SendMediaOptions): Promise<{ messageId: string | number; success: boolean }>;
  
  // Typing indicators
  sendTyping(chatId: string | number): Promise<void>;
  
  // Message management (if supported)
  editMessage?(chatId: string | number, messageId: string | number, text: string): Promise<boolean>;
  deleteMessage?(chatId: string | number, messageId: string | number): Promise<boolean>;
  
  // Channel-specific features
  sendPoll?(chatId: string | number, question: string, options: string[]): Promise<{ pollId: string; messageId: string | number }>;
  
  // Session management
  closeChat?(chatId: string | number, message?: string): Promise<void>;
  
  // Survey
  sendSurvey?(chatId: string | number, surveyConfig: SurveyConfig): Promise<{ surveyId: string }>;
}

export interface SurveyConfig {
  type: 'rating' | 'poll' | 'form';
  question: string;
  options?: string[];
  allowComment?: boolean;
}

// ============= WEBCHAT SOCKET EVENTS =============

export interface WebChatClientToServerEvents {
  'web:connect': (data: { visitorId: string; projectId: string; user?: { name?: string; email?: string } }) => void;
  'web:message:send': (data: { content: string; contentType: MessageContentType; media?: MediaContent }) => void;
  'web:typing:start': () => void;
  'web:typing:stop': () => void;
  'web:read': (data: { messageIds: string[] }) => void;
  'web:survey:submit': (data: { rating: number; comment?: string }) => void;
  'web:page:change': (data: { url: string; title: string }) => void;
}

export interface WebChatServerToClientEvents {
  'web:connected': (data: { sessionId: string; visitorId: string; existingMessages?: NormalizedMessage[] }) => void;
  'web:message:new': (message: NormalizedMessage) => void;
  'web:typing:agent': (data: { agentId: string; agentName: string }) => void;
  'web:typing:stop': () => void;
  'web:agent:assigned': (data: { agentId: string; agentName: string; agentPhoto?: string }) => void;
  'web:chat:closed': (data: { reason: string; message?: string }) => void;
  'web:survey:request': (data: { surveyId: string; question: string }) => void;
  'web:error': (data: { code: string; message: string }) => void;
  'web:reconnect': (data: { sessionId: string }) => void;
}

// ============= ROUTING RULES =============

export interface OmnichannelRoutingRule {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  conditions: {
    channels?: ChannelType[];
    keywords?: string[];
    categories?: string[];
    visitorCountry?: string[];
    timeRange?: { start: string; end: string };
  };
  actions: {
    assignToTeam?: string;
    assignToAgent?: string;
    setPriority?: 'low' | 'medium' | 'high' | 'urgent';
    setCategory?: string;
    addTags?: string[];
    sendAutoReply?: string;
  };
}

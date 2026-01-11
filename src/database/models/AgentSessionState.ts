/**
 * AgentSessionState Model - Agent UI state persistence for recovery
 * Enables seamless reconnection with preserved drafts, scroll positions, and UI state
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IActiveChat {
  sessionId: string;
  scrollPosition?: number;
  draft?: string;
  lastViewedMessageId?: string;
  openedAt: Date;
  lastInteractionAt: Date;
}

export interface IDraft {
  sessionId: string;
  content: string;
  savedAt: Date;
  cursorPosition?: number;
}

export interface IUIState {
  activeTab: string;
  sidebarOpen: boolean;
  focusModeEnabled: boolean;
  selectedSessionId?: string;
  infoSidebarTab?: string;
  queueFilters?: {
    categories?: string[];
    priorities?: string[];
    sortBy?: string;
  };
  theme?: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

export interface IAgentSessionState extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  
  // Active chats state
  activeChats: IActiveChat[];
  
  // UI state
  uiState: IUIState;
  
  // Drafts (auto-saved)
  drafts: IDraft[];
  
  // Connection tracking
  lastSyncAt: Date;
  lastConnectedAt?: Date;
  lastDisconnectAt?: Date;
  currentSocketId?: string;
  
  // Device info (for multi-device handling)
  deviceInfo?: {
    browser: string;
    os: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
  };
  
  // Recovery flags
  needsRecovery: boolean;
  recoveredAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const AgentSessionStateSchema = new Schema<IAgentSessionState>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      unique: true,
      index: true,
    },
    activeChats: [{
      sessionId: { type: String, required: true },
      scrollPosition: Number,
      draft: String,
      lastViewedMessageId: String,
      openedAt: { type: Date, default: Date.now },
      lastInteractionAt: { type: Date, default: Date.now },
    }],
    uiState: {
      activeTab: { type: String, default: 'queue' },
      sidebarOpen: { type: Boolean, default: true },
      focusModeEnabled: { type: Boolean, default: false },
      selectedSessionId: String,
      infoSidebarTab: String,
      queueFilters: {
        categories: [String],
        priorities: [String],
        sortBy: String,
      },
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      notificationsEnabled: { type: Boolean, default: true },
      soundEnabled: { type: Boolean, default: true },
    },
    drafts: [{
      sessionId: { type: String, required: true },
      content: { type: String, required: true },
      savedAt: { type: Date, default: Date.now },
      cursorPosition: Number,
    }],
    lastSyncAt: {
      type: Date,
      default: Date.now,
    },
    lastConnectedAt: Date,
    lastDisconnectAt: Date,
    currentSocketId: String,
    deviceInfo: {
      browser: String,
      os: String,
      deviceType: { type: String, enum: ['desktop', 'mobile', 'tablet'] },
    },
    needsRecovery: {
      type: Boolean,
      default: false,
    },
    recoveredAt: Date,
  },
  {
    timestamps: true,
  }
);

// Auto-update lastSyncAt
AgentSessionStateSchema.pre('save', function(next) {
  this.lastSyncAt = new Date();
  next();
});

export const AgentSessionState = mongoose.model<IAgentSessionState>('AgentSessionState', AgentSessionStateSchema);

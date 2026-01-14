/**
 * Agent Preferences Model
 * Stores user preferences for theme, notifications, sounds, etc.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotificationSettings {
  newChat: boolean;
  chatReassigned: boolean;
  chatTransferred: boolean;
  mentioned: boolean;
  negativeSurvey: boolean;
}

export interface IAgentPreferences extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  
  // Theme & Display
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
    volume: number; // 0-100
  };
  
  // Chat behavior
  autoScroll: boolean;
  enterToSend: boolean;
  showTypingIndicator: boolean;
  markAsReadOnOpen: boolean;
  
  // Keyboard shortcuts
  shortcutsEnabled: boolean;
  
  // Notifications
  notifications: {
    email: INotificationSettings;
    inApp: INotificationSettings;
    telegram: INotificationSettings;
  };
  
  // Desktop notifications
  desktopNotifications: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSettingsSchema = new Schema({
  newChat: { type: Boolean, default: true },
  chatReassigned: { type: Boolean, default: true },
  chatTransferred: { type: Boolean, default: true },
  mentioned: { type: Boolean, default: true },
  negativeSurvey: { type: Boolean, default: true },
}, { _id: false });

const AgentPreferencesSchema = new Schema<IAgentPreferences>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      unique: true,
      index: true,
    },
    
    // Theme & Display
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
    },
    focusMode: {
      type: Boolean,
      default: false,
    },
    language: {
      type: String,
      default: 'es',
    },
    timezone: {
      type: String,
      default: 'America/Mexico_City',
    },
    
    // Sounds
    sounds: {
      enabled: { type: Boolean, default: true },
      newChat: { type: Boolean, default: true },
      newMessage: { type: Boolean, default: true },
      mention: { type: Boolean, default: true },
      volume: { type: Number, default: 80, min: 0, max: 100 },
    },
    
    // Chat behavior
    autoScroll: { type: Boolean, default: true },
    enterToSend: { type: Boolean, default: true },
    showTypingIndicator: { type: Boolean, default: true },
    markAsReadOnOpen: { type: Boolean, default: true },
    
    // Keyboard shortcuts
    shortcutsEnabled: { type: Boolean, default: true },
    
    // Notifications
    notifications: {
      email: { type: NotificationSettingsSchema, default: () => ({}) },
      inApp: { type: NotificationSettingsSchema, default: () => ({}) },
      telegram: { type: NotificationSettingsSchema, default: () => ({}) },
    },
    
    // Desktop notifications
    desktopNotifications: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const AgentPreferences = mongoose.model<IAgentPreferences>('AgentPreferences', AgentPreferencesSchema);

/**
 * Get or create preferences for an agent
 */
export async function getOrCreatePreferences(agentId: string): Promise<IAgentPreferences> {
  let prefs = await AgentPreferences.findOne({ agentId });
  
  if (!prefs) {
    prefs = await AgentPreferences.create({ agentId });
  }
  
  return prefs;
}

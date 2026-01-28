/**
 * Settings Model - Platform configuration stored in MongoDB
 * Full settings with all frontend options for real system integration
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBotSettings {
  name: string;
  username: string;
  welcomeMessage: string;
  transferMessage: string;
  offlineMessage: string;
  defaultLanguage: 'en' | 'es';
  autoReplyEnabled: boolean;
  autoReplyDelay: number;
  typingIndicator: boolean;
}

export interface IChatSettings {
  maxWaitTimeMinutes: number;
  autoCloseInactiveMinutes: number;
  queuedTimeoutMinutes: number;
  autoResponseEnabled: boolean;
  defaultBotMessage: string;
  maxQueueSize: number;
  // File settings
  enableFileSharing: boolean;
  maxFileSizeMB: number;
  allowedFileTypes: string[];
  // Features
  enableEmoji: boolean;
  enableSuggestions: boolean;
}

export interface IAgentRules {
  maxConcurrentChats: number;
  autoAssignEnabled: boolean;
  assignmentMode: 'round-robin' | 'manual' | 'least-busy';
  skillBasedRouting: boolean;
  priorityRouting: boolean;
  // Working hours
  workingHoursEnabled: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingHoursTimezone: string;
}

export interface ISecuritySettings {
  jwtExpirationDays: number;
  rateLimitPerMinute: number;
  logCriticalEvents: boolean;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  maxSessionsPerAgent: number; // Max concurrent sessions per agent (0 = unlimited)
  twoFactorEnabled: boolean;
  // Password policy
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecial: boolean;
  // Audit
  auditLogRetentionDays: number;
}

export interface INotificationSettings {
  emailNotificationsEnabled: boolean;
  escalationAlertsEnabled: boolean;
  dailyReportEnabled: boolean;
  desktopNotificationsEnabled: boolean;
  newChatSoundEnabled: boolean;
  newMessageSoundEnabled: boolean;
  notificationVolume: number;
}

export interface ISettings extends Document {
  _id: Types.ObjectId;
  key: string;
  bot: IBotSettings;
  chat: IChatSettings;
  agentRules: IAgentRules;
  security: ISecuritySettings;
  notifications: INotificationSettings;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'main',
    },
    bot: {
      name: { type: String, default: 'Trelk Support' },
      username: { type: String, default: 'TrelkSupportBot' },
      welcomeMessage: { 
        type: String, 
        default: '👋 Welcome to Trelk Support! How can we help you today?' 
      },
      transferMessage: { 
        type: String, 
        default: '🔄 Connecting you with a support agent. Please wait...' 
      },
      offlineMessage: { 
        type: String, 
        default: '😴 Our support team is currently offline. We will get back to you soon!' 
      },
      defaultLanguage: { type: String, enum: ['en', 'es'], default: 'es' },
      autoReplyEnabled: { type: Boolean, default: true },
      autoReplyDelay: { type: Number, default: 1000 },
      typingIndicator: { type: Boolean, default: true },
    },
    chat: {
      maxWaitTimeMinutes: { type: Number, default: 5 },
      autoCloseInactiveMinutes: { type: Number, default: 30 },
      queuedTimeoutMinutes: { type: Number, default: 10 },
      autoResponseEnabled: { type: Boolean, default: true },
      defaultBotMessage: { 
        type: String, 
        default: "I'm here to help! Please describe your issue." 
      },
      maxQueueSize: { type: Number, default: 50 },
      enableFileSharing: { type: Boolean, default: true },
      maxFileSizeMB: { type: Number, default: 10 },
      allowedFileTypes: { 
        type: [String], 
        default: ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'gif', 'webp'] 
      },
      enableEmoji: { type: Boolean, default: true },
      enableSuggestions: { type: Boolean, default: true },
    },
    agentRules: {
      maxConcurrentChats: { type: Number, default: 5 },
      autoAssignEnabled: { type: Boolean, default: false },
      assignmentMode: { 
        type: String, 
        enum: ['round-robin', 'manual', 'least-busy'],
        default: 'manual',
      },
      skillBasedRouting: { type: Boolean, default: true },
      priorityRouting: { type: Boolean, default: false },
      workingHoursEnabled: { type: Boolean, default: false },
      workingHoursStart: { type: String, default: '09:00' },
      workingHoursEnd: { type: String, default: '18:00' },
      workingHoursTimezone: { type: String, default: 'America/Bogota' },
    },
    security: {
      jwtExpirationDays: { type: Number, default: 7 },
      rateLimitPerMinute: { type: Number, default: 60 },
      logCriticalEvents: { type: Boolean, default: true },
      sessionTimeoutMinutes: { type: Number, default: 480 },
      maxLoginAttempts: { type: Number, default: 5 },
      maxSessionsPerAgent: { type: Number, default: 3 }, // 0 = unlimited
      twoFactorEnabled: { type: Boolean, default: false },
      passwordMinLength: { type: Number, default: 8 },
      passwordRequireUppercase: { type: Boolean, default: true },
      passwordRequireNumbers: { type: Boolean, default: true },
      passwordRequireSpecial: { type: Boolean, default: false },
      auditLogRetentionDays: { type: Number, default: 90 },
    },
    notifications: {
      emailNotificationsEnabled: { type: Boolean, default: true },
      escalationAlertsEnabled: { type: Boolean, default: true },
      dailyReportEnabled: { type: Boolean, default: false },
      desktopNotificationsEnabled: { type: Boolean, default: true },
      newChatSoundEnabled: { type: Boolean, default: true },
      newMessageSoundEnabled: { type: Boolean, default: true },
      notificationVolume: { type: Number, default: 0.5, min: 0, max: 1 },
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure single settings document
SettingsSchema.statics.getSettings = async function(): Promise<ISettings> {
  let settings = await this.findOne({ key: 'main' });
  if (!settings) {
    settings = await this.create({ key: 'main' });
  }
  return settings;
};

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);

/**
 * Settings Model - Platform configuration stored in MongoDB
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBotSettings {
  name: string;
  username: string;
  welcomeMessage: string;
  transferMessage: string;
  offlineMessage: string;
  defaultLanguage: 'en' | 'es';
}

export interface IChatSettings {
  maxWaitTimeMinutes: number;
  autoCloseInactiveMinutes: number;
  queuedTimeoutMinutes: number;
  autoResponseEnabled: boolean;
  defaultBotMessage: string;
}

export interface IAgentRules {
  maxConcurrentChats: number;
  autoAssignEnabled: boolean;
  assignmentMode: 'round-robin' | 'manual' | 'least-busy';
}

export interface ISecuritySettings {
  jwtExpirationDays: number;
  rateLimitPerMinute: number;
  logCriticalEvents: boolean;
}

export interface ISettings extends Document {
  _id: Types.ObjectId;
  key: string;
  bot: IBotSettings;
  chat: IChatSettings;
  agentRules: IAgentRules;
  security: ISecuritySettings;
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
      defaultLanguage: { type: String, enum: ['en', 'es'], default: 'en' },
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
    },
    agentRules: {
      maxConcurrentChats: { type: Number, default: 5 },
      autoAssignEnabled: { type: Boolean, default: false },
      assignmentMode: { 
        type: String, 
        enum: ['round-robin', 'manual', 'least-busy'],
        default: 'manual',
      },
    },
    security: {
      jwtExpirationDays: { type: Number, default: 7 },
      rateLimitPerMinute: { type: Number, default: 60 },
      logCriticalEvents: { type: Boolean, default: true },
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

/**
 * WebChat Project Configuration Model
 * Stores configuration for embeddable web chat widgets
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWebChatProject extends Document {
  _id: Types.ObjectId;
  projectId: string; // Unique identifier used in widget.js
  name: string;
  description?: string;
  
  // Widget Configuration
  config: {
    theme: 'light' | 'dark' | 'auto';
    position: 'left' | 'right';
    primaryColor: string;
    headerText: string;
    welcomeMessage: string;
    offlineMessage: string;
    inputPlaceholder: string;
    // User requirements
    requireEmail: boolean;
    requireName: boolean;
    collectPhone: boolean;
    // Features
    showAgentPhotos: boolean;
    showAgentNames: boolean;
    enableAttachments: boolean;
    enableEmoji: boolean;
    enableSurvey: boolean;
    enableTypingIndicator: boolean;
    enableSoundNotifications: boolean;
    // Appearance
    bubbleIcon: 'chat' | 'support' | 'custom';
    customIconUrl?: string;
    logoUrl?: string;
    customCss?: string;
    // Behavior
    autoOpenDelay?: number; // ms to auto-open, 0 = disabled
    hideWhenOffline: boolean;
    showPoweredBy: boolean;
  };
  
  // Security
  allowedDomains: string[]; // List of allowed domains for CORS
  apiKey: string; // API key for authentication
  rateLimitPerMinute: number;
  
  // Assignment
  defaultTeam?: Types.ObjectId;
  defaultAgent?: Types.ObjectId;
  routingMode: 'round-robin' | 'manual' | 'least-busy';
  
  // Status
  isActive: boolean;
  isOnline: boolean; // Manual online/offline toggle
  
  // Analytics
  totalConversations: number;
  totalMessages: number;
  avgResponseTime?: number;
  lastActivityAt?: Date;
  
  // Audit
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WebChatProjectSchema = new Schema<IWebChatProject>(
  {
    projectId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: String,
    
    config: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'auto'],
        default: 'auto',
      },
      position: {
        type: String,
        enum: ['left', 'right'],
        default: 'right',
      },
      primaryColor: {
        type: String,
        default: '#4F46E5',
      },
      headerText: {
        type: String,
        default: 'Soporte en vivo',
      },
      welcomeMessage: {
        type: String,
        default: '¡Hola! 👋 ¿En qué podemos ayudarte hoy?',
      },
      offlineMessage: {
        type: String,
        default: 'No hay agentes disponibles. Deja tu mensaje y te responderemos pronto.',
      },
      inputPlaceholder: {
        type: String,
        default: 'Escribe un mensaje...',
      },
      requireEmail: {
        type: Boolean,
        default: false,
      },
      requireName: {
        type: Boolean,
        default: false,
      },
      collectPhone: {
        type: Boolean,
        default: false,
      },
      showAgentPhotos: {
        type: Boolean,
        default: true,
      },
      showAgentNames: {
        type: Boolean,
        default: true,
      },
      enableAttachments: {
        type: Boolean,
        default: true,
      },
      enableEmoji: {
        type: Boolean,
        default: true,
      },
      enableSurvey: {
        type: Boolean,
        default: true,
      },
      enableTypingIndicator: {
        type: Boolean,
        default: true,
      },
      enableSoundNotifications: {
        type: Boolean,
        default: true,
      },
      bubbleIcon: {
        type: String,
        enum: ['chat', 'support', 'custom'],
        default: 'chat',
      },
      customIconUrl: String,
      logoUrl: String,
      customCss: String,
      autoOpenDelay: {
        type: Number,
        default: 0,
      },
      hideWhenOffline: {
        type: Boolean,
        default: false,
      },
      showPoweredBy: {
        type: Boolean,
        default: true,
      },
    },
    
    allowedDomains: [{
      type: String,
    }],
    apiKey: {
      type: String,
      required: true,
      unique: true,
    },
    rateLimitPerMinute: {
      type: Number,
      default: 60,
    },
    
    defaultTeam: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
    },
    defaultAgent: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    routingMode: {
      type: String,
      enum: ['round-robin', 'manual', 'least-busy'],
      default: 'round-robin',
    },
    
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isOnline: {
      type: Boolean,
      default: true,
    },
    
    totalConversations: {
      type: Number,
      default: 0,
    },
    totalMessages: {
      type: Number,
      default: 0,
    },
    avgResponseTime: Number,
    lastActivityAt: Date,
    
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
WebChatProjectSchema.index({ apiKey: 1 });
WebChatProjectSchema.index({ isActive: 1, isOnline: 1 });

export const WebChatProject = mongoose.model<IWebChatProject>('WebChatProject', WebChatProjectSchema);

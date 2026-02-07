/**
 * Web Visitor Model
 * Tracks visitors who use the web chat widget
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWebVisitor extends Document {
  _id: Types.ObjectId;
  visitorId: string; // Unique identifier stored in visitor's browser
  projectId: string; // Associated WebChat project
  
  // Profile (can be provided or collected)
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  
  // Device fingerprint
  fingerprint?: string;
  
  // Current session info
  currentPageUrl?: string;
  currentPageTitle?: string;
  referrerUrl?: string;
  
  // Device info
  userAgent?: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  screenResolution?: string;
  
  // Geo info
  ipAddress?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  region?: string;
  timezone?: string;
  language?: string;
  
  // Tracking
  firstVisit: Date;
  lastVisit: Date;
  totalVisits: number;
  totalPageViews: number;
  pagesViewed: Array<{
    url: string;
    title: string;
    visitedAt: Date;
    duration?: number;
  }>;
  
  // Chat history
  totalConversations: number;
  lastChatAt?: Date;
  currentSessionId?: string;
  
  // Identity linking
  linkedUserId?: Types.ObjectId; // If linked to a User from another channel
  linkedIdentities?: Array<{
    channel: 'telegram' | 'whatsapp' | 'instagram' | 'email';
    externalId: string;
    linkedAt: Date;
  }>;
  
  // Custom data
  customFields?: Record<string, unknown>;
  tags?: string[];
  notes?: string;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const WebVisitorSchema = new Schema<IWebVisitor>(
  {
    visitorId: {
      type: String,
      required: true,
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    
    // Profile
    name: String,
    email: {
      type: String,
      sparse: true,
      index: true,
    },
    phone: String,
    avatarUrl: String,
    
    fingerprint: String,
    
    // Current session
    currentPageUrl: String,
    currentPageTitle: String,
    referrerUrl: String,
    
    // Device
    userAgent: String,
    browser: String,
    browserVersion: String,
    os: String,
    osVersion: String,
    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet'],
    },
    screenResolution: String,
    
    // Geo
    ipAddress: String,
    country: String,
    countryCode: String,
    city: String,
    region: String,
    timezone: String,
    language: String,
    
    // Tracking
    firstVisit: {
      type: Date,
      default: Date.now,
    },
    lastVisit: {
      type: Date,
      default: Date.now,
    },
    totalVisits: {
      type: Number,
      default: 1,
    },
    totalPageViews: {
      type: Number,
      default: 0,
    },
    pagesViewed: [{
      url: String,
      title: String,
      visitedAt: { type: Date, default: Date.now },
      duration: Number,
    }],
    
    // Chat history
    totalConversations: {
      type: Number,
      default: 0,
    },
    lastChatAt: Date,
    currentSessionId: String,
    
    // Identity linking
    linkedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    linkedIdentities: [{
      channel: {
        type: String,
        enum: ['telegram', 'whatsapp', 'instagram', 'email'],
      },
      externalId: String,
      linkedAt: Date,
    }],
    
    // Custom
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
    tags: [String],
    notes: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
WebVisitorSchema.index({ projectId: 1, visitorId: 1 }, { unique: true });
WebVisitorSchema.index({ projectId: 1, email: 1 });
WebVisitorSchema.index({ projectId: 1, lastVisit: -1 });

export const WebVisitor = mongoose.model<IWebVisitor>('WebVisitor', WebVisitorSchema);

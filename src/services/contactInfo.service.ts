/**
 * Contact Info Service
 * Provides unified contact information for the sidebar
 * Supports both Telegram users and WebChat visitors
 */

import {
  User, IUser, ChatSession, IChatSession, Note, INote, Tag, UserTag,
  CustomFieldDefinition, UserCustomField, Message, WebVisitor, IWebVisitor
} from '../database/index.js';
import mongoose from 'mongoose';

// ============= TYPES =============

export interface ContactInfo {
  user: {
    id: string;
    // Telegram fields
    telegramId?: number;
    username?: string;
    firstName: string;
    lastName?: string;
    language?: string;
    photoFileId?: string;
    // WebChat fields
    email?: string;
    phone?: string;
    visitorId?: string;
    // Device info (webchat)
    browser?: string;
    browserVersion?: string;
    os?: string;
    osVersion?: string;
    device?: string;
    // Geo info (webchat)
    country?: string;
    city?: string;
    // Page info (webchat)
    currentPageUrl?: string;
    currentPageTitle?: string;
    referrerUrl?: string;
    // Common fields
    platform: 'telegram' | 'web' | 'whatsapp';
    createdAt: Date;
    lastActivity: Date;
  };
  session: {
    sessionId: string;
    status: string;
    priority: string;
    category?: string;
    createdAt: Date;
    updatedAt: Date;
    closedAt?: Date;
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
      completedAt?: Date;
    };
  };
  stats: {
    totalMessages: number;
    totalSessions: number;
    averageResponseTime?: number;
    firstContactDate: Date;
    chatDuration?: number; // in seconds
  };
  tags: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  notes: {
    count: number;
    latest?: {
      content: string;
      createdAt: Date;
      createdBy: string;
    };
  };
  customFields: Array<{
    fieldId: string;
    key: string;
    name: string;
    type: string;
    value: string | number | boolean | Date | null;
  }>;
  automations: {
    active: boolean;
    inactivityTimer?: {
      startedAt: Date;
      expiresAt: Date;
    };
  };
}

// ============= MAIN FUNCTIONS =============

/**
 * Get complete contact info for sidebar
 * Supports both Telegram users and WebChat visitors
 */
export async function getContactInfo(sessionId: string): Promise<ContactInfo | null> {
  const session = await ChatSession.findOne({ sessionId })
    .populate<{ user: IUser }>('user')
    .populate<{ webVisitor: IWebVisitor }>('webVisitor')
    .populate('assignedAgent', 'name email')
    .populate('closedBy', 'name');

  if (!session) {
    return null;
  }

  // Determine if this is a Telegram or WebChat session
  const isTelegramSession = session.channel === 'telegram' && session.user;
  const isWebChatSession = session.channel === 'web' && session.webVisitor;

  if (!isTelegramSession && !isWebChatSession) {
    return null;
  }

  // Handle Telegram session
  if (isTelegramSession && session.user) {
    return getTelegramContactInfo(session as any, session.user);
  }

  // Handle WebChat session
  if (isWebChatSession && session.webVisitor) {
    return getWebChatContactInfo(session as any, session.webVisitor);
  }

  return null;
}

/**
 * Get contact info for Telegram user
 */
async function getTelegramContactInfo(session: IChatSession, user: IUser): Promise<ContactInfo> {
  const userId = user._id as mongoose.Types.ObjectId;

  // Get parallel data
  const [
    totalMessages,
    totalSessions,
    firstSession,
    userTags,
    notesCount,
    latestNote,
    customFieldValues,
    customFieldDefs,
  ] = await Promise.all([
    Message.countDocuments({ session: session._id }).lean(),
    ChatSession.countDocuments({ user: userId }).lean(),
    ChatSession.findOne({ user: userId }).sort({ createdAt: 1 }).select('createdAt').lean(),
    UserTag.find({ user: userId }).populate('tag', 'name color').lean(),
    Note.countDocuments({ user: userId }).lean(),
    Note.findOne({ user: userId }).sort({ createdAt: -1 }).populate('createdBy', 'name').lean(),
    UserCustomField.find({ user: userId }).populate('field').lean(),
    CustomFieldDefinition.find({ isActive: true }).sort({ order: 1 }).lean(),
  ]);

  // Calculate chat duration
  let chatDuration: number | undefined;
  if (session.status === 'closed' && session.closedAt) {
    chatDuration = Math.floor((session.closedAt.getTime() - session.createdAt.getTime()) / 1000);
  } else if (session.status !== 'closed') {
    chatDuration = Math.floor((Date.now() - session.createdAt.getTime()) / 1000);
  }

  // Build custom fields with values
  const customFieldsMap = new Map(
    customFieldValues.map(cf => [(cf.field as any)?._id?.toString(), cf.value])
  );

  const customFields = customFieldDefs.map(def => ({
    fieldId: def._id?.toString(),
    key: def.key,
    name: def.name,
    type: def.type,
    value: customFieldsMap.get(def._id?.toString()) ?? null,
  }));

  return {
    user: {
      id: userId.toString(),
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      language: user.language,
      platform: 'telegram',
      createdAt: user.createdAt,
      lastActivity: user.lastActivity,
      photoFileId: user.photoFileId,
    },
    session: {
      sessionId: session.sessionId,
      status: session.status,
      priority: session.priority,
      category: session.category,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      closedAt: session.closedAt,
      closedBy: (session.closedBy as any)?.name,
      closureReason: session.closureReason,
      assignedAgent: session.assignedAgent ? {
        id: (session.assignedAgent as any)._id.toString(),
        name: (session.assignedAgent as any).name,
      } : undefined,
      disposition: session.disposition ? {
        categoryId: session.disposition.categoryId?.toString(),
        categoryCode: session.disposition.categoryCode,
        categoryName: session.disposition.categoryName,
        subcategoryId: session.disposition.subcategoryId?.toString(),
        subcategoryCode: session.disposition.subcategoryCode,
        subcategoryName: session.disposition.subcategoryName,
        comment: session.disposition.comment,
        tags: session.disposition.tags,
        completedAt: session.disposition.completedAt,
      } : undefined,
    },
    stats: {
      totalMessages,
      totalSessions,
      firstContactDate: firstSession?.createdAt || session.createdAt,
      chatDuration,
    },
    tags: userTags.map(ut => ({
      id: (ut.tag as any)._id.toString(),
      name: (ut.tag as any).name,
      color: (ut.tag as any).color,
    })),
    notes: {
      count: notesCount,
      latest: latestNote ? {
        content: latestNote.content,
        createdAt: latestNote.createdAt,
        createdBy: (latestNote.createdBy as any)?.name || 'Unknown',
      } : undefined,
    },
    customFields,
    automations: {
      active: false,
    },
  };
}

/**
 * Get contact info for WebChat visitor
 */
async function getWebChatContactInfo(session: IChatSession, visitor: IWebVisitor): Promise<ContactInfo> {
  const visitorId = visitor._id as mongoose.Types.ObjectId;

  // Get parallel data
  const [
    totalMessages,
    totalSessions,
    firstSession,
  ] = await Promise.all([
    Message.countDocuments({ session: session._id }).lean(),
    ChatSession.countDocuments({ webVisitor: visitorId }).lean(),
    ChatSession.findOne({ webVisitor: visitorId }).sort({ createdAt: 1 }).select('createdAt').lean(),
  ]);

  // Calculate chat duration
  let chatDuration: number | undefined;
  if (session.status === 'closed' && session.closedAt) {
    chatDuration = Math.floor((session.closedAt.getTime() - session.createdAt.getTime()) / 1000);
  } else if (session.status !== 'closed') {
    chatDuration = Math.floor((Date.now() - session.createdAt.getTime()) / 1000);
  }

  return {
    user: {
      id: visitorId.toString(),
      visitorId: visitor.visitorId,
      firstName: visitor.name || 'Web Visitor',
      email: visitor.email,
      phone: visitor.phone,
      // Device info
      browser: visitor.browser,
      browserVersion: visitor.browserVersion,
      os: visitor.os,
      osVersion: visitor.osVersion,
      device: visitor.device,
      // Geo info
      country: visitor.country,
      city: visitor.city,
      // Page info
      currentPageUrl: visitor.currentPageUrl,
      currentPageTitle: visitor.currentPageTitle,
      referrerUrl: visitor.referrerUrl,
      // Common
      platform: 'web',
      createdAt: visitor.firstVisit || visitor.createdAt,
      lastActivity: visitor.lastVisit || visitor.updatedAt,
    },
    session: {
      sessionId: session.sessionId,
      status: session.status,
      priority: session.priority,
      category: session.category,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      closedAt: session.closedAt,
      closedBy: (session.closedBy as any)?.name,
      closureReason: session.closureReason,
      assignedAgent: session.assignedAgent ? {
        id: (session.assignedAgent as any)._id.toString(),
        name: (session.assignedAgent as any).name,
      } : undefined,
      disposition: session.disposition ? {
        categoryId: session.disposition.categoryId?.toString(),
        categoryCode: session.disposition.categoryCode,
        categoryName: session.disposition.categoryName,
        subcategoryId: session.disposition.subcategoryId?.toString(),
        subcategoryCode: session.disposition.subcategoryCode,
        subcategoryName: session.disposition.subcategoryName,
        comment: session.disposition.comment,
        tags: session.disposition.tags,
        completedAt: session.disposition.completedAt,
      } : undefined,
    },
    stats: {
      totalMessages,
      totalSessions,
      firstContactDate: firstSession?.createdAt || session.createdAt,
      chatDuration,
    },
    // WebChat visitors don't have traditional tags/notes yet
    // They could have custom fields from the project config
    tags: [],
    notes: {
      count: 0,
      latest: undefined,
    },
    customFields: [],
    automations: {
      active: false,
    },
  };
}

/**
 * Get user's complete chat history
 */
export async function getUserChatHistory(userId: string, limit = 50): Promise<Array<{
  sessionId: string;
  status: string;
  category?: string;
  messageCount: number;
  createdAt: Date;
  closedAt?: Date;
}>> {
  const sessions = await ChatSession.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('sessionId status category createdAt closedAt');

  const result = await Promise.all(
    sessions.map(async (s) => ({
      sessionId: s.sessionId,
      status: s.status,
      category: s.category,
      messageCount: await Message.countDocuments({ session: s._id }),
      createdAt: s.createdAt,
      closedAt: s.closedAt,
    }))
  );

  return result;
}

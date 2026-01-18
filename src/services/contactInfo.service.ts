/**
 * Contact Info Service
 * Provides unified contact information for the sidebar
 */

import { User, IUser, ChatSession, IChatSession, Note, INote, Tag, UserTag, 
  CustomFieldDefinition, UserCustomField, Message } from '../database/index.js';
import mongoose from 'mongoose';

// ============= TYPES =============

export interface ContactInfo {
  user: {
    id: string;
    telegramId: number;
    username?: string;
    firstName: string;
    lastName?: string;
    language: string;
    platform: 'telegram';
    createdAt: Date;
    lastActivity: Date;
    photoFileId?: string;
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
 */
export async function getContactInfo(sessionId: string): Promise<ContactInfo | null> {
  const session = await ChatSession.findOne({ sessionId })
    .populate<{ user: IUser }>('user')
    .populate('assignedAgent', 'name email')
    .populate('closedBy', 'name');

  if (!session || !session.user) {
    return null;
  }

  const user = session.user;
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
    Message.countDocuments({ session: session._id }),
    ChatSession.countDocuments({ user: userId }),
    ChatSession.findOne({ user: userId }).sort({ createdAt: 1 }).select('createdAt'),
    UserTag.find({ user: userId }).populate('tag', 'name color'),
    Note.countDocuments({ user: userId }),
    Note.findOne({ user: userId }).sort({ createdAt: -1 }).populate('createdBy', 'name'),
    UserCustomField.find({ user: userId }).populate('field'),
    CustomFieldDefinition.find({ isActive: true }).sort({ order: 1 }),
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

  // Build response
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
      active: false, // TODO: integrate with inactivity service
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

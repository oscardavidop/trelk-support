/**
 * Notes Service
 * CRUD operations for internal notes
 */

import { Note, INote, ChatSession } from '../database/index.js';
import mongoose from 'mongoose';

export interface CreateNoteInput {
  userId: string;
  sessionId?: string; // Optional: can be MongoDB ObjectId or session UUID
  content: string;
  agentId: string;
}

export interface NoteWithAgent {
  id: string;
  content: string;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
  };
  sessionId?: string;
}

/**
 * Helper to resolve session ObjectId from sessionId (UUID) or ObjectId string
 */
async function resolveSessionId(sessionId?: string): Promise<mongoose.Types.ObjectId | undefined> {
  if (!sessionId) return undefined;
  
  // Check if it's already a valid MongoDB ObjectId format (24 hex chars)
  if (mongoose.Types.ObjectId.isValid(sessionId) && sessionId.length === 24) {
    return new mongoose.Types.ObjectId(sessionId);
  }
  
  // Otherwise, treat as session UUID and look up the session
  const session = await ChatSession.findOne({ sessionId }).select('_id');
  return session?._id;
}

/**
 * Create a new note
 */
export async function createNote(input: CreateNoteInput): Promise<NoteWithAgent> {
  // Resolve sessionId to MongoDB ObjectId
  const sessionObjectId = await resolveSessionId(input.sessionId);
  
  const note = await Note.create({
    user: new mongoose.Types.ObjectId(input.userId),
    session: sessionObjectId,
    content: input.content,
    createdBy: new mongoose.Types.ObjectId(input.agentId),
  });

  const populated = await Note.findById(note._id).populate('createdBy', 'name');

  return {
    id: note._id!.toString(),
    content: note.content,
    createdAt: note.createdAt,
    createdBy: {
      id: input.agentId,
      name: (populated?.createdBy as any)?.name || 'Unknown',
    },
    sessionId: input.sessionId,
  };
}

/**
 * Get all notes for a user
 */
export async function getUserNotes(userId: string, limit = 50): Promise<NoteWithAgent[]> {
  const notes = await Note.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('createdBy', 'name')
    .populate('session', 'sessionId')
    .lean();

  return notes.map(n => ({
    id: n._id!.toString(),
    content: n.content,
    createdAt: n.createdAt,
    createdBy: {
      id: (n.createdBy as any)?._id?.toString() || '',
      name: (n.createdBy as any)?.name || 'Unknown',
    },
    sessionId: (n.session as any)?.sessionId,
  }));
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: string, agentId: string): Promise<boolean> {
  const result = await Note.deleteOne({ _id: noteId }).lean();
  return result.deletedCount > 0;
}

/**
 * Update a note
 */
export async function updateNote(noteId: string, content: string): Promise<NoteWithAgent | null> {
  const note = await Note.findByIdAndUpdate(
    noteId,
    { content },
    { new: true }
  ).populate('createdBy', 'name');

  if (!note) return null;

  return {
    id: note._id!.toString(),
    content: note.content,
    createdAt: note.createdAt,
    createdBy: {
      id: (note.createdBy as any)?._id?.toString() || '',
      name: (note.createdBy as any)?.name || 'Unknown',
    },
  };
}

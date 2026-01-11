/**
 * Notes Service
 * CRUD operations for internal notes
 */

import { Note, INote } from '../database/index.js';
import mongoose from 'mongoose';

export interface CreateNoteInput {
  userId: string;
  sessionId?: string; // Optional: tie to specific session
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
 * Create a new note
 */
export async function createNote(input: CreateNoteInput): Promise<NoteWithAgent> {
  const note = await Note.create({
    user: new mongoose.Types.ObjectId(input.userId),
    session: input.sessionId ? new mongoose.Types.ObjectId(input.sessionId) : undefined,
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
    .populate('session', 'sessionId');

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
  const result = await Note.deleteOne({ _id: noteId });
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

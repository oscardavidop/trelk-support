/**
 * Export Service - Enterprise Chat Export System
 * Supports: JSON (ZIP), Excel (.xlsx), HTML report, CSV, PDF
 * Features: media bundling, PII redaction, GDPR mode, scheduled messages, whispers, QA reviews
 */

import { Types } from 'mongoose';
import { ExportJob, type IExportJob, type ExportFormat } from '../database/models/ExportJob.js';
import { ChatSession, type IChatSession } from '../database/models/ChatSession.js';
import { Message, type IMessage } from '../database/models/Message.js';
import { Note, type INote } from '../database/models/Note.js';
import { ActivityLog, type IActivityLog } from '../database/models/ActivityLog.js';
import { Transfer, type ITransfer } from '../database/models/Transfer.js';
import { ScheduledMessage } from '../database/models/ScheduledMessage.js';
import { Whisper } from '../database/models/Whisper.js';
import { MediaFile } from '../database/models/MediaFile.js';
import { QAReview } from '../database/models/QAReview.js';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import archiver from 'archiver';
import ExcelJS from 'exceljs';

const EXPORTS_DIR = path.join(process.cwd(), 'exports');

// ============= TYPES =============

interface ExportMessageData {
  id: string;
  content: string;
  sender: string;
  senderName?: string;
  messageType: string;
  mediaUrl?: string;
  media?: {
    type: string;
    url?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  };
  createdAt: Date;
  isEdited?: boolean;
  editedAt?: Date;
  deliveryStatus?: string;
}

interface SessionExportData {
  session: {
    id: string;
    status: string;
    channel: string;
    category?: string;
    priority: string;
    tags: string[];
    createdAt: Date;
    closedAt?: Date;
    closedByType?: string;
    closedByName?: string;
    closeReason?: string;
    rating?: number;
    feedback?: string;
    firstResponseAt?: Date;
    firstResponseTime?: string;
    reopenCount?: number;
    duration?: string;
    durationMinutes?: number;
    lastMessageAt?: Date;
  };
  user: {
    id?: string;
    name?: string;
    telegramId?: number;
    username?: string;
  };
  agent?: {
    id: string;
    name: string;
    email: string;
  };
  disposition?: {
    categoryCode?: string;
    categoryName?: string;
    subcategoryCode?: string;
    subcategoryName?: string;
    comment?: string;
    tags?: string[];
  };
  messages: ExportMessageData[];
  notes?: Array<{
    id: string;
    content: string;
    createdBy: string;
    createdAt: Date;
  }>;
  transfers?: Array<{
    fromAgent: string;
    toAgent: string;
    reason?: string;
    createdAt: Date;
  }>;
  activities?: Array<{
    action: string;
    actor: string;
    description: string;
    createdAt: Date;
  }>;
  scheduledMessages?: Array<{
    id: string;
    type: string;
    status: string;
    scheduledAt?: Date;
    sentAt?: Date;
    messageText?: string;
    createdByName?: string;
  }>;
  whispers?: Array<{
    id: string;
    content: string;
    fromSupervisor: string;
    toAgent: string;
    createdAt: Date;
  }>;
  mediaFiles?: Array<{
    id: string;
    filename: string;
    originalName: string;
    type: string;
    mimeType: string;
    size: number;
    url: string;
    storagePath: string;
  }>;
  qaReview?: {
    totalScore: number;
    status: string;
    coaching: string;
    comment: string;
    reviewedBy: string;
    checks: Array<{
      checkName: string;
      checkCategory: string;
      result: string;
      score: number;
      note?: string;
    }>;
    createdAt: Date;
  };
  contactHistory?: Array<{
    sessionId: string;
    status: string;
    category?: string;
    createdAt: Date;
    closedAt?: Date;
    messageCount: number;
  }>;
}

// ============= PII REDACTION =============

const PII_PATTERNS = [
  { pattern: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/gi, replacement: '[EMAIL_REDACTED]' },
  { pattern: /\b\+?[1-9]\d{1,14}\b/g, replacement: '[PHONE_REDACTED]' },
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: '[SSN_REDACTED]' },
  { pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/g, replacement: '[CARD_REDACTED]' },
];

function redactPII(text: string): string {
  if (!text) return text;
  let result = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function redactSessionData(data: SessionExportData, gdprMode: boolean): SessionExportData {
  const cloned = JSON.parse(JSON.stringify(data)) as SessionExportData;

  // Redact user info
  if (gdprMode) {
    cloned.user = {
      id: '[REDACTED]',
      name: '[REDACTED]',
      telegramId: undefined,
      username: undefined,
    };
  }

  // Redact message content
  cloned.messages = cloned.messages.map(m => ({
    ...m,
    content: redactPII(m.content),
  }));

  // Redact notes
  if (cloned.notes) {
    cloned.notes = cloned.notes.map(n => ({
      ...n,
      content: redactPII(n.content),
    }));
  }

  // Redact whispers
  if (cloned.whispers) {
    cloned.whispers = cloned.whispers.map(w => ({
      ...w,
      content: redactPII(w.content),
    }));
  }

  return cloned;
}

// ============= DATA GATHERING =============

async function ensureExportsDir(): Promise<void> {
  try {
    await fs.access(EXPORTS_DIR);
  } catch {
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
  }
}

/**
 * Gather all data for a single session export (enhanced)
 */
async function gatherSessionData(
  sessionId: string,
  include: IExportJob['include'],
  advanced?: IExportJob['advanced']
): Promise<SessionExportData | null> {
  const session = await ChatSession.findOne({ sessionId })
    .populate('user', 'firstName lastName telegramId telegramUsername')
    .populate('assignedAgent', 'name email')
    .populate('closedBy', 'name email')
    .lean();

  if (!session) return null;

  // Calculate session duration
  const durationMs = session.closedAt
    ? new Date(session.closedAt).getTime() - new Date(session.createdAt).getTime()
    : Date.now() - new Date(session.createdAt).getTime();
  const durationMinutes = Math.round(durationMs / 60000);
  const durationFormatted = durationMinutes >= 60
    ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
    : `${durationMinutes}m`;

  // Calculate first response time
  const firstResponseMs = session.firstResponseAt
    ? new Date(session.firstResponseAt).getTime() - new Date(session.createdAt).getTime()
    : undefined;
  const firstResponseFormatted = firstResponseMs !== undefined
    ? firstResponseMs >= 60000
      ? `${Math.floor(firstResponseMs / 60000)}m ${Math.round((firstResponseMs % 60000) / 1000)}s`
      : `${Math.round(firstResponseMs / 1000)}s`
    : undefined;

  const closedByAgent = session.closedBy as any;

  const data: SessionExportData = {
    session: {
      id: session.sessionId,
      status: session.status,
      channel: session.channel || 'telegram',
      category: session.category,
      priority: session.priority,
      tags: session.tags || [],
      createdAt: session.createdAt,
      closedAt: session.closedAt,
      closedByType: session.closedByType,
      closedByName: closedByAgent?.name || undefined,
      closeReason: session.closeReason,
      rating: session.rating,
      feedback: session.feedback,
      firstResponseAt: session.firstResponseAt,
      firstResponseTime: firstResponseFormatted,
      reopenCount: session.reopenCount,
      duration: durationFormatted,
      durationMinutes,
      lastMessageAt: session.lastMessageAt,
    },
    user: {
      id: (session.user as any)?._id?.toString(),
      name: `${(session.user as any)?.firstName || ''} ${(session.user as any)?.lastName || ''}`.trim() || 'Unknown',
      telegramId: (session.user as any)?.telegramId,
      username: (session.user as any)?.telegramUsername,
    },
    agent: session.assignedAgent ? {
      id: (session.assignedAgent as any)._id.toString(),
      name: (session.assignedAgent as any).name,
      email: (session.assignedAgent as any).email,
    } : undefined,
    messages: [],
  };

  // Disposition
  if (include.disposition && session.disposition) {
    data.disposition = {
      categoryCode: session.disposition.categoryCode,
      categoryName: session.disposition.categoryName,
      subcategoryCode: session.disposition.subcategoryCode,
      subcategoryName: session.disposition.subcategoryName,
      comment: session.disposition.comment,
      tags: session.disposition.tags,
    };
  }

  // Messages (enhanced with media data)
  if (include.messages) {
    const messages = await Message.find({ session: session._id })
      .sort({ createdAt: 1 })
      .lean();

    data.messages = messages.map(m => ({
      id: m._id.toString(),
      content: m.content,
      sender: m.sender,
      senderName: (m as any).senderName,
      messageType: (m as any).messageType || 'text',
      mediaUrl: (m as any).mediaUrl,
      media: (m as any).media ? {
        type: (m as any).media.type,
        url: (m as any).media.url,
        fileName: (m as any).media.fileName,
        fileSize: (m as any).media.fileSize,
        mimeType: (m as any).media.mimeType,
      } : undefined,
      createdAt: m.createdAt,
      isEdited: m.isEdited,
      editedAt: m.editedAt,
      deliveryStatus: (m as any).deliveryStatus,
    }));
  }

  // Notes
  if (include.notes) {
    const notes = await Note.find({ session: session._id })
      .populate('createdBy', 'name')
      .sort({ createdAt: 1 })
      .lean();

    data.notes = notes.map(n => ({
      id: n._id.toString(),
      content: n.content,
      createdBy: (n.createdBy as any)?.name || 'Unknown',
      createdAt: n.createdAt,
    }));
  }

  // Transfers
  if (include.transfers) {
    const transfers = await Transfer.find({ session: session._id })
      .populate('fromAgent', 'name')
      .populate('toAgent', 'name')
      .sort({ transferredAt: 1 })
      .lean();

    data.transfers = transfers.map((t: any) => ({
      fromAgent: t.fromAgent?.name || 'Unknown',
      toAgent: t.toAgent?.name || 'Unknown',
      reason: t.reason,
      createdAt: t.transferredAt,
    }));
  }

  // Activity logs
  if (include.systemLogs || include.agentActions) {
    const activities = await ActivityLog.find({ sessionId })
      .sort({ createdAt: 1 })
      .lean();

    data.activities = activities.map((a: any) => ({
      action: a.action,
      actor: a.actor?.name || a.actor?.type || 'system',
      description: a.description,
      createdAt: a.createdAt,
    }));
  }

  // Scheduled messages
  if (include.scheduledMessages) {
    const scheduled = await ScheduledMessage.find({ sessionId })
      .sort({ createdAt: 1 })
      .lean();

    data.scheduledMessages = scheduled.map(s => ({
      id: s._id.toString(),
      type: s.type,
      status: s.status,
      scheduledAt: s.scheduledAt,
      sentAt: s.sentAt,
      messageText: s.message?.text,
      createdByName: s.createdByName,
    }));
  }

  // Whispers
  if (include.whispers) {
    const whispers = await Whisper.find({ sessionId })
      .populate('fromSupervisor', 'name')
      .populate('toAgent', 'name')
      .sort({ createdAt: 1 })
      .lean();

    data.whispers = whispers.map((w: any) => ({
      id: w._id.toString(),
      content: w.content,
      fromSupervisor: w.fromSupervisor?.name || 'Unknown',
      toAgent: w.toAgent?.name || 'Unknown',
      createdAt: w.createdAt,
    }));
  }

  // Media files
  if (include.media) {
    const mediaFiles = await MediaFile.find({
      chatSessionId: sessionId,
      status: 'active',
    })
      .sort({ createdAt: 1 })
      .lean();

    data.mediaFiles = mediaFiles.map(mf => ({
      id: mf._id.toString(),
      filename: mf.filename,
      originalName: mf.originalName,
      type: mf.type,
      mimeType: mf.mimeType,
      size: mf.size,
      url: mf.url,
      storagePath: mf.storagePath,
    }));
  }

  // QA Review
  if (include.qaReview) {
    const review = await QAReview.findOne({ sessionId })
      .populate('reviewedBy', 'name')
      .lean();

    if (review) {
      data.qaReview = {
        totalScore: review.totalScore,
        status: review.status,
        coaching: review.coaching,
        comment: review.comment,
        reviewedBy: (review.reviewedBy as any)?.name || 'Unknown',
        checks: review.checks.map(c => ({
          checkName: c.checkName,
          checkCategory: c.checkCategory,
          result: c.result,
          score: c.score,
          note: c.note,
        })),
        createdAt: review.createdAt,
      };
    }
  }

  // Contact history (other sessions from same user)
  if (include.contactHistory && session.user) {
    const userId = (session.user as any)?._id;
    if (userId) {
      const otherSessions = await ChatSession.find({
        user: userId,
        sessionId: { $ne: sessionId },
      })
        .select('sessionId status category createdAt closedAt')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

      const history = [];
      for (const s of otherSessions) {
        const msgCount = await Message.countDocuments({ session: s._id });
        history.push({
          sessionId: s.sessionId,
          status: s.status,
          category: s.category,
          createdAt: s.createdAt,
          closedAt: s.closedAt,
          messageCount: msgCount,
        });
      }
      data.contactHistory = history;
    }
  }

  // Apply PII redaction if configured
  if (advanced?.redactPII || advanced?.gdprMode) {
    return redactSessionData(data, !!advanced.gdprMode);
  }

  return data;
}

// ============= FORMAT: JSON =============

async function generateJsonExport(job: IExportJob): Promise<{ filePath: string; fileSize: number }> {
  await ensureExportsDir();

  let data: SessionExportData[] = [];

  if (job.type === 'session' && job.sessionId) {
    const sessionData = await gatherSessionData(job.sessionId, job.include, job.advanced);
    if (sessionData) data.push(sessionData);
  } else if (job.type === 'sessions') {
    const query = buildSessionQuery(job.filters);
    const sessions = await ChatSession.find(query).select('sessionId').lean();
    
    for (let i = 0; i < sessions.length; i++) {
      const sessionData = await gatherSessionData(sessions[i].sessionId, job.include, job.advanced);
      if (sessionData) data.push(sessionData);

      await ExportJob.findByIdAndUpdate(job._id, {
        progress: Math.round(((i + 1) / sessions.length) * 100),
        processedItems: i + 1,
        totalItems: sessions.length,
        currentStep: `Procesando sesión ${i + 1} de ${sessions.length}`,
      });
    }
  }

  const fileName = `export_${job._id}_${Date.now()}.json`;
  const filePath = path.join(EXPORTS_DIR, fileName);

  const jsonContent = JSON.stringify({
    exportedAt: new Date().toISOString(),
    exportedBy: job.requestedBy.toString(),
    format: 'json',
    version: '2.0',
    totalSessions: data.length,
    sessions: data,
  }, null, 2);

  await fs.writeFile(filePath, jsonContent, 'utf-8');
  const stats = await fs.stat(filePath);

  return { filePath: fileName, fileSize: stats.size };
}

// ============= FORMAT: ZIP (JSON + Media) =============

async function generateZipExport(job: IExportJob): Promise<{ filePath: string; fileSize: number }> {
  await ensureExportsDir();

  let data: SessionExportData[] = [];

  if (job.type === 'session' && job.sessionId) {
    const sessionData = await gatherSessionData(job.sessionId, job.include, job.advanced);
    if (sessionData) data.push(sessionData);
  } else if (job.type === 'sessions') {
    const query = buildSessionQuery(job.filters);
    const sessions = await ChatSession.find(query).select('sessionId').lean();
    for (let i = 0; i < sessions.length; i++) {
      const sessionData = await gatherSessionData(sessions[i].sessionId, job.include, job.advanced);
      if (sessionData) data.push(sessionData);
      await ExportJob.findByIdAndUpdate(job._id, {
        progress: Math.round(((i + 1) / sessions.length) * 70),
        processedItems: i + 1,
        totalItems: sessions.length,
        currentStep: `Recopilando datos ${i + 1}/${sessions.length}`,
      });
    }
  }

  const fileName = `export_${job._id}_${Date.now()}.zip`;
  const filePath = path.join(EXPORTS_DIR, fileName);

  // Collect media files that exist before creating the archive
  const mediaFilesToBundle: Array<{ absolutePath: string; archiveName: string }> = [];
  for (const session of data) {
    const prefix = data.length > 1 ? `sessions/${session.session.id}/` : '';
    if (session.mediaFiles?.length) {
      for (const mf of session.mediaFiles) {
        const absolutePath = path.join(process.cwd(), mf.storagePath);
        try {
          await fs.access(absolutePath);
          mediaFilesToBundle.push({ absolutePath, archiveName: `${prefix}media/${mf.originalName}` });
        } catch {
          // skip missing files
        }
      }
    }
  }

  return new Promise((resolve, reject) => {
    const output = createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 6 } });

    output.on('close', async () => {
      const stats = await fs.stat(filePath);
      resolve({ filePath: fileName, fileSize: stats.size });
    });
    archive.on('error', reject);
    archive.pipe(output);

    // ---- Structured folder layout ----
    for (const session of data) {
      const prefix = data.length > 1 ? `sessions/${session.session.id}/` : '';

      // Main chat data
      archive.append(JSON.stringify(session.session, null, 2), { name: `${prefix}session.json` });
      archive.append(JSON.stringify(session.user, null, 2), { name: `${prefix}contact.json` });

      if (session.agent) {
        archive.append(JSON.stringify(session.agent, null, 2), { name: `${prefix}agent.json` });
      }

      // Messages
      if (session.messages.length > 0) {
        archive.append(JSON.stringify(session.messages, null, 2), { name: `${prefix}messages.json` });
      }

      // Disposition
      if (session.disposition) {
        archive.append(JSON.stringify(session.disposition, null, 2), { name: `${prefix}disposition.json` });
      }

      // Notes
      if (session.notes?.length) {
        archive.append(JSON.stringify(session.notes, null, 2), { name: `${prefix}notes.json` });
      }

      // Transfers
      if (session.transfers?.length) {
        archive.append(JSON.stringify(session.transfers, null, 2), { name: `${prefix}transfers.json` });
      }

      // Activities timeline
      if (session.activities?.length) {
        archive.append(JSON.stringify(session.activities, null, 2), { name: `${prefix}timeline.json` });
      }

      // Scheduled messages
      if (session.scheduledMessages?.length) {
        archive.append(JSON.stringify(session.scheduledMessages, null, 2), { name: `${prefix}scheduled-messages.json` });
      }

      // Whispers
      if (session.whispers?.length) {
        archive.append(JSON.stringify(session.whispers, null, 2), { name: `${prefix}whispers.json` });
      }

      // QA Review
      if (session.qaReview) {
        archive.append(JSON.stringify(session.qaReview, null, 2), { name: `${prefix}qa-review.json` });
      }

      // Contact history
      if (session.contactHistory?.length) {
        archive.append(JSON.stringify(session.contactHistory, null, 2), { name: `${prefix}contact-history.json` });
      }
    }

    // Bundle pre-validated media files
    for (const mf of mediaFilesToBundle) {
      archive.file(mf.absolutePath, { name: mf.archiveName });
    }

    // Export metadata
    archive.append(JSON.stringify({
      exportedAt: new Date().toISOString(),
      format: 'zip',
      version: '2.0',
      totalSessions: data.length,
      include: job.include,
      advanced: job.advanced,
    }, null, 2), { name: 'metadata.json' });

    archive.finalize();
  });
}

// ============= FORMAT: XLSX =============

async function generateXlsxExport(job: IExportJob): Promise<{ filePath: string; fileSize: number }> {
  await ensureExportsDir();

  let data: SessionExportData[] = [];

  if (job.type === 'session' && job.sessionId) {
    const sessionData = await gatherSessionData(job.sessionId, job.include, job.advanced);
    if (sessionData) data.push(sessionData);
  } else if (job.type === 'sessions') {
    const query = buildSessionQuery(job.filters);
    const sessions = await ChatSession.find(query).select('sessionId').lean();
    for (let i = 0; i < sessions.length; i++) {
      const sessionData = await gatherSessionData(sessions[i].sessionId, job.include, job.advanced);
      if (sessionData) data.push(sessionData);
      await ExportJob.findByIdAndUpdate(job._id, {
        progress: Math.round(((i + 1) / sessions.length) * 70),
        processedItems: i + 1,
        totalItems: sessions.length,
        currentStep: `Recopilando datos ${i + 1}/${sessions.length}`,
      });
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Trelk Support';
  wb.created = new Date();

  const headerStyle: Partial<ExcelJS.Style> = {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } },
    alignment: { horizontal: 'center' },
  };

  // --- Sheet 1: Sessions Overview ---
  const sessionsSheet = wb.addWorksheet('Sesiones');
  sessionsSheet.columns = [
    { header: 'Session ID', key: 'sessionId', width: 32 },
    { header: 'Canal', key: 'channel', width: 12 },
    { header: 'Estado', key: 'status', width: 12 },
    { header: 'Categoría', key: 'category', width: 16 },
    { header: 'Prioridad', key: 'priority', width: 12 },
    { header: 'Tags', key: 'tags', width: 24 },
    { header: 'Usuario', key: 'userName', width: 20 },
    { header: 'Agente', key: 'agentName', width: 20 },
    { header: 'Mensajes', key: 'msgCount', width: 10 },
    { header: 'Duración', key: 'duration', width: 14 },
    { header: '1ra Respuesta', key: 'firstResponseTime', width: 14 },
    { header: 'Rating', key: 'rating', width: 8 },
    { header: 'Feedback', key: 'feedback', width: 30 },
    { header: 'Disposición', key: 'disposition', width: 24 },
    { header: 'Creado', key: 'createdAt', width: 20 },
    { header: 'Cerrado', key: 'closedAt', width: 20 },
    { header: 'Cerrado por', key: 'closedBy', width: 16 },
    { header: 'Tipo cierre', key: 'closedByType', width: 12 },
    { header: 'Motivo cierre', key: 'closeReason', width: 16 },
    { header: 'Reaperturas', key: 'reopenCount', width: 12 },
  ];
  sessionsSheet.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });

  for (const s of data) {
    sessionsSheet.addRow({
      sessionId: s.session.id,
      channel: s.session.channel,
      status: s.session.status,
      category: s.session.category || '',
      priority: s.session.priority,
      tags: s.session.tags.join(', '),
      userName: s.user.name,
      agentName: s.agent?.name || '',
      msgCount: s.messages.length,
      duration: s.session.duration || '',
      firstResponseTime: s.session.firstResponseTime || '',
      rating: s.session.rating || '',
      feedback: s.session.feedback || '',
      disposition: s.disposition ? `${s.disposition.categoryName || ''} > ${s.disposition.subcategoryName || ''}` : '',
      createdAt: s.session.createdAt,
      closedAt: s.session.closedAt || '',
      closedBy: s.session.closedByName || '',
      closedByType: s.session.closedByType || '',
      closeReason: s.session.closeReason || '',
      reopenCount: s.session.reopenCount || 0,
    });
  }

  // --- Sheet 2: Messages ---
  const msgSheet = wb.addWorksheet('Mensajes');
  msgSheet.columns = [
    { header: 'Session ID', key: 'sessionId', width: 32 },
    { header: 'Fecha', key: 'createdAt', width: 20 },
    { header: 'Remitente', key: 'sender', width: 12 },
    { header: 'Nombre', key: 'senderName', width: 20 },
    { header: 'Tipo', key: 'messageType', width: 12 },
    { header: 'Contenido', key: 'content', width: 60 },
    { header: 'Media URL', key: 'mediaUrl', width: 30 },
    { header: 'Editado', key: 'isEdited', width: 8 },
  ];
  msgSheet.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });

  for (const s of data) {
    for (const m of s.messages) {
      msgSheet.addRow({
        sessionId: s.session.id,
        createdAt: m.createdAt,
        sender: m.sender,
        senderName: m.senderName || '',
        messageType: m.messageType,
        content: m.content,
        mediaUrl: m.mediaUrl || m.media?.url || '',
        isEdited: m.isEdited ? 'Sí' : '',
      });
    }
  }

  // --- Sheet 3: Notes ---
  if (data.some(s => s.notes?.length)) {
    const notesSheet = wb.addWorksheet('Notas');
    notesSheet.columns = [
      { header: 'Session ID', key: 'sessionId', width: 32 },
      { header: 'Fecha', key: 'createdAt', width: 20 },
      { header: 'Autor', key: 'createdBy', width: 20 },
      { header: 'Contenido', key: 'content', width: 60 },
    ];
    notesSheet.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });
    for (const s of data) {
      for (const n of (s.notes || [])) {
        notesSheet.addRow({
          sessionId: s.session.id,
          createdAt: n.createdAt,
          createdBy: n.createdBy,
          content: n.content,
        });
      }
    }
  }

  // --- Sheet 4: Timeline ---
  if (data.some(s => s.activities?.length)) {
    const timelineSheet = wb.addWorksheet('Timeline');
    timelineSheet.columns = [
      { header: 'Session ID', key: 'sessionId', width: 32 },
      { header: 'Fecha', key: 'createdAt', width: 20 },
      { header: 'Acción', key: 'action', width: 24 },
      { header: 'Actor', key: 'actor', width: 20 },
      { header: 'Descripción', key: 'description', width: 50 },
    ];
    timelineSheet.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });
    for (const s of data) {
      for (const a of (s.activities || [])) {
        timelineSheet.addRow({
          sessionId: s.session.id,
          createdAt: a.createdAt,
          action: a.action,
          actor: a.actor,
          description: a.description,
        });
      }
    }
  }

  // --- Sheet 5: Scheduled Messages ---
  if (data.some(s => s.scheduledMessages?.length)) {
    const schedSheet = wb.addWorksheet('Programados');
    schedSheet.columns = [
      { header: 'Session ID', key: 'sessionId', width: 32 },
      { header: 'Tipo', key: 'type', width: 16 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Programado', key: 'scheduledAt', width: 20 },
      { header: 'Enviado', key: 'sentAt', width: 20 },
      { header: 'Mensaje', key: 'messageText', width: 50 },
      { header: 'Creado por', key: 'createdByName', width: 20 },
    ];
    schedSheet.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });
    for (const s of data) {
      for (const sm of (s.scheduledMessages || [])) {
        schedSheet.addRow({
          sessionId: s.session.id,
          type: sm.type,
          status: sm.status,
          scheduledAt: sm.scheduledAt || '',
          sentAt: sm.sentAt || '',
          messageText: sm.messageText || '',
          createdByName: sm.createdByName || '',
        });
      }
    }
  }

  // --- Sheet 6: QA Reviews ---
  if (data.some(s => s.qaReview)) {
    const qaSheet = wb.addWorksheet('QA Reviews');
    qaSheet.columns = [
      { header: 'Session ID', key: 'sessionId', width: 32 },
      { header: 'Score', key: 'totalScore', width: 10 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Coaching', key: 'coaching', width: 14 },
      { header: 'Revisor', key: 'reviewedBy', width: 20 },
      { header: 'Comentario', key: 'comment', width: 50 },
      { header: 'Fecha', key: 'createdAt', width: 20 },
    ];
    qaSheet.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });
    for (const s of data) {
      if (s.qaReview) {
        qaSheet.addRow({
          sessionId: s.session.id,
          totalScore: s.qaReview.totalScore,
          status: s.qaReview.status,
          coaching: s.qaReview.coaching,
          reviewedBy: s.qaReview.reviewedBy,
          comment: s.qaReview.comment,
          createdAt: s.qaReview.createdAt,
        });
      }
    }
  }

  // --- Sheet 7: Whispers ---
  if (data.some(s => s.whispers?.length)) {
    const whispersSheet = wb.addWorksheet('Whispers');
    whispersSheet.columns = [
      { header: 'Session ID', key: 'sessionId', width: 32 },
      { header: 'Fecha', key: 'createdAt', width: 20 },
      { header: 'De (Supervisor)', key: 'fromSupervisor', width: 20 },
      { header: 'Para (Agente)', key: 'toAgent', width: 20 },
      { header: 'Contenido', key: 'content', width: 60 },
    ];
    whispersSheet.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });
    for (const s of data) {
      for (const w of (s.whispers || [])) {
        whispersSheet.addRow({
          sessionId: s.session.id,
          createdAt: w.createdAt,
          fromSupervisor: w.fromSupervisor,
          toAgent: w.toAgent,
          content: w.content,
        });
      }
    }
  }

  // --- Sheet 8: Media Files ---
  if (data.some(s => s.mediaFiles?.length)) {
    const mediaSheet = wb.addWorksheet('Media');
    mediaSheet.columns = [
      { header: 'Session ID', key: 'sessionId', width: 32 },
      { header: 'Nombre Original', key: 'originalName', width: 30 },
      { header: 'Tipo', key: 'type', width: 12 },
      { header: 'MIME', key: 'mimeType', width: 24 },
      { header: 'Tamaño (KB)', key: 'sizeKB', width: 14 },
      { header: 'URL', key: 'url', width: 50 },
    ];
    mediaSheet.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });
    for (const s of data) {
      for (const mf of (s.mediaFiles || [])) {
        mediaSheet.addRow({
          sessionId: s.session.id,
          originalName: mf.originalName,
          type: mf.type,
          mimeType: mf.mimeType,
          sizeKB: Math.round(mf.size / 1024),
          url: mf.url,
        });
      }
    }
  }

  // --- Sheet 9: Transfers ---
  if (data.some(s => s.transfers?.length)) {
    const transfersSheet = wb.addWorksheet('Transferencias');
    transfersSheet.columns = [
      { header: 'Session ID', key: 'sessionId', width: 32 },
      { header: 'Fecha', key: 'createdAt', width: 20 },
      { header: 'De', key: 'fromAgent', width: 20 },
      { header: 'Para', key: 'toAgent', width: 20 },
      { header: 'Razón', key: 'reason', width: 40 },
    ];
    transfersSheet.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });
    for (const s of data) {
      for (const t of (s.transfers || [])) {
        transfersSheet.addRow({
          sessionId: s.session.id,
          createdAt: t.createdAt,
          fromAgent: t.fromAgent,
          toAgent: t.toAgent,
          reason: t.reason || '',
        });
      }
    }
  }

  // --- Sheet 10: Contact History ---
  if (data.some(s => s.contactHistory?.length)) {
    const historySheet = wb.addWorksheet('Historial Contacto');
    historySheet.columns = [
      { header: 'Sesión Actual', key: 'currentSession', width: 32 },
      { header: 'Sesión Previa', key: 'sessionId', width: 32 },
      { header: 'Estado', key: 'status', width: 12 },
      { header: 'Categoría', key: 'category', width: 16 },
      { header: 'Mensajes', key: 'messageCount', width: 10 },
      { header: 'Creado', key: 'createdAt', width: 20 },
      { header: 'Cerrado', key: 'closedAt', width: 20 },
    ];
    historySheet.getRow(1).eachCell(c => { Object.assign(c, { style: headerStyle }); });
    for (const s of data) {
      for (const h of (s.contactHistory || [])) {
        historySheet.addRow({
          currentSession: s.session.id,
          sessionId: h.sessionId,
          status: h.status,
          category: h.category || '',
          messageCount: h.messageCount,
          createdAt: h.createdAt,
          closedAt: h.closedAt || '',
        });
      }
    }
  }

  const fileName = `export_${job._id}_${Date.now()}.xlsx`;
  const filePath = path.join(EXPORTS_DIR, fileName);
  await wb.xlsx.writeFile(filePath);
  const stats = await fs.stat(filePath);

  return { filePath: fileName, fileSize: stats.size };
}

// ============= FORMAT: CSV =============

async function generateCsvExport(job: IExportJob): Promise<{ filePath: string; fileSize: number }> {
  await ensureExportsDir();

  const rows: string[] = [];
  
  const headers = [
    'Session ID', 'Canal', 'User Name', 'User Telegram ID', 'Agent Name',
    'Status', 'Category', 'Priority', 'Tags', 'Disposición',
    'Created At', 'Closed At', 'Close Reason', 'Closed By Type',
    'Duration (min)', 'First Response Time',
    'Rating', 'Feedback', 'Message Count', 'Reopen Count',
  ];
  rows.push(headers.join(','));

  const query: Record<string, unknown> = {};
  if (job.sessionId) {
    query.sessionId = job.sessionId;
  } else if (job.filters) {
    Object.assign(query, buildSessionQuery(job.filters));
  }

  const sessions = await ChatSession.find(query)
    .populate('user', 'firstName lastName telegramId')
    .populate('assignedAgent', 'name')
    .populate('closedBy', 'name')
    .lean();

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const messageCount = await Message.countDocuments({ session: session._id });

    const escapeCsv = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const disp = session.disposition
      ? `${session.disposition.categoryName || ''} > ${session.disposition.subcategoryName || ''}`
      : '';

    // Calculate duration
    const csvDurationMs = session.closedAt
      ? new Date(session.closedAt).getTime() - new Date(session.createdAt).getTime()
      : Date.now() - new Date(session.createdAt).getTime();
    const csvDurationMin = Math.round(csvDurationMs / 60000);

    // Calculate first response time  
    const csvFrtMs = session.firstResponseAt
      ? new Date(session.firstResponseAt).getTime() - new Date(session.createdAt).getTime()
      : undefined;
    const csvFrt = csvFrtMs !== undefined
      ? csvFrtMs >= 60000
        ? `${Math.floor(csvFrtMs / 60000)}m ${Math.round((csvFrtMs % 60000) / 1000)}s`
        : `${Math.round(csvFrtMs / 1000)}s`
      : '';

    const row = [
      escapeCsv(session.sessionId),
      escapeCsv(session.channel),
      escapeCsv(`${(session.user as any)?.firstName || ''} ${(session.user as any)?.lastName || ''}`.trim()),
      escapeCsv((session.user as any)?.telegramId),
      escapeCsv((session.assignedAgent as any)?.name),
      escapeCsv(session.status),
      escapeCsv(session.category),
      escapeCsv(session.priority),
      escapeCsv((session.tags || []).join('; ')),
      escapeCsv(disp),
      escapeCsv(session.createdAt.toISOString()),
      escapeCsv(session.closedAt?.toISOString()),
      escapeCsv(session.closeReason),
      escapeCsv(session.closedByType),
      escapeCsv(csvDurationMin),
      escapeCsv(csvFrt),
      escapeCsv(session.rating),
      escapeCsv(session.feedback),
      escapeCsv(messageCount),
      escapeCsv(session.reopenCount),
    ];
    rows.push(row.join(','));

    if (i % 10 === 0) {
      await ExportJob.findByIdAndUpdate(job._id, {
        progress: Math.round(((i + 1) / sessions.length) * 100),
        processedItems: i + 1,
        totalItems: sessions.length,
      });
    }
  }

  const fileName = `export_${job._id}_${Date.now()}.csv`;
  const filePath = path.join(EXPORTS_DIR, fileName);
  await fs.writeFile(filePath, rows.join('\n'), 'utf-8');
  const stats = await fs.stat(filePath);

  return { filePath: fileName, fileSize: stats.size };
}

// ============= FORMAT: HTML (Professional Report) =============

async function generateHtmlExport(job: IExportJob): Promise<{ filePath: string; fileSize: number }> {
  await ensureExportsDir();

  let data: SessionExportData[] = [];

  if (job.type === 'session' && job.sessionId) {
    const sessionData = await gatherSessionData(job.sessionId, job.include, job.advanced);
    if (sessionData) data.push(sessionData);
  } else if (job.type === 'sessions') {
    const query = buildSessionQuery(job.filters);
    const sessions = await ChatSession.find(query).select('sessionId').lean();
    for (let i = 0; i < sessions.length; i++) {
      const sessionData = await gatherSessionData(sessions[i].sessionId, job.include, job.advanced);
      if (sessionData) data.push(sessionData);
      await ExportJob.findByIdAndUpdate(job._id, {
        progress: Math.round(((i + 1) / sessions.length) * 100),
        processedItems: i + 1,
        totalItems: sessions.length,
        currentStep: `Procesando sesión ${i + 1} de ${sessions.length}`,
      });
    }
  }

  const companyName = job.pdfOptions?.companyName || 'Trelk Support';
  const fmtDate = (d: Date | string | undefined) => d ? new Date(d).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  const sessionsHtml = data.map(s => `
    <div class="session-card">
      <div class="session-header">
        <div class="session-title">
          <span class="channel-badge channel-${s.session.channel}">${s.session.channel}</span>
          <h2>${s.session.id}</h2>
          <span class="status-badge status-${s.session.status}">${s.session.status}</span>
        </div>
        <div class="session-meta">
          <div class="meta-item"><span class="label">Usuario:</span> ${s.user.name}${s.user.username ? ` (@${s.user.username})` : ''}</div>
          <div class="meta-item"><span class="label">Agente:</span> ${s.agent?.name || 'Sin asignar'}</div>
          <div class="meta-item"><span class="label">Categoría:</span> ${s.session.category || 'N/A'}</div>
          <div class="meta-item"><span class="label">Prioridad:</span> ${s.session.priority}</div>
          <div class="meta-item"><span class="label">Creado:</span> ${fmtDate(s.session.createdAt)}</div>
          ${s.session.closedAt ? `<div class="meta-item"><span class="label">Cerrado:</span> ${fmtDate(s.session.closedAt)}</div>` : ''}
          ${s.session.duration ? `<div class="meta-item"><span class="label">⏱ Duración:</span> <strong>${s.session.duration}</strong></div>` : ''}
          ${s.session.firstResponseTime ? `<div class="meta-item"><span class="label">1ra Respuesta:</span> ${s.session.firstResponseTime}</div>` : ''}
          ${s.session.closedByName ? `<div class="meta-item"><span class="label">Cerrado por:</span> ${s.session.closedByName} (${s.session.closedByType || ''})</div>` : s.session.closedByType ? `<div class="meta-item"><span class="label">Cerrado por:</span> ${s.session.closedByType}</div>` : ''}
          ${s.session.closeReason ? `<div class="meta-item"><span class="label">Motivo:</span> ${s.session.closeReason}</div>` : ''}
          ${s.session.reopenCount ? `<div class="meta-item"><span class="label">Reaperturas:</span> ${s.session.reopenCount}</div>` : ''}
          ${s.session.rating ? `<div class="meta-item"><span class="label">Rating:</span> ${'★'.repeat(s.session.rating)}${'☆'.repeat(5 - s.session.rating)}</div>` : ''}
          ${s.session.feedback ? `<div class="meta-item" style="grid-column:1/-1"><span class="label">Feedback:</span> "${s.session.feedback}"</div>` : ''}
          <div class="meta-item"><span class="label">Mensajes:</span> ${s.messages.length}</div>
        </div>
      </div>

      ${s.disposition ? `
        <div class="section">
          <h3>📋 Disposición</h3>
          <div class="disposition-box">
            <strong>${s.disposition.categoryName || ''}</strong>
            ${s.disposition.subcategoryName ? ` › ${s.disposition.subcategoryName}` : ''}
            ${s.disposition.comment ? `<p class="dispo-comment">${s.disposition.comment}</p>` : ''}
          </div>
        </div>
      ` : ''}

      ${s.session.tags.length ? `
        <div class="tags-bar">${s.session.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      ` : ''}

      <div class="section">
        <h3>💬 Mensajes (${s.messages.length})</h3>
        <div class="chat-container">
          ${s.messages.map(msg => {
            const isUser = msg.sender === 'user';
            const isBot = msg.sender === 'bot';
            const align = isUser ? 'left' : 'right';
            const cls = isUser ? 'msg-user' : isBot ? 'msg-bot' : 'msg-agent';
            const senderLabel = isUser ? s.user.name : isBot ? 'Bot' : (msg.senderName || s.agent?.name || 'Agent');
            const mediaHtml = msg.messageType !== 'text' && msg.messageType
              ? `<div class="media-indicator">📎 ${msg.messageType}${msg.media?.fileName ? ': ' + msg.media.fileName : ''}</div>`
              : '';
            return `
              <div class="chat-msg ${cls}" style="text-align:${align}">
                <div class="bubble">
                  <div class="sender">${senderLabel}</div>
                  ${mediaHtml}
                  <div class="content">${(msg.content || '').replace(/\n/g, '<br>')}</div>
                  <div class="time">${fmtDate(msg.createdAt)}${msg.isEdited ? ' <em>(editado)</em>' : ''}</div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>

      ${s.notes?.length ? `
        <div class="section">
          <h3>📝 Notas Internas (${s.notes.length})</h3>
          ${s.notes.map(n => `
            <div class="note-item">
              <strong>${n.createdBy}</strong> <span class="time">${fmtDate(n.createdAt)}</span>
              <p>${n.content}</p>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${s.transfers?.length ? `
        <div class="section">
          <h3>🔄 Transferencias</h3>
          ${s.transfers.map(t => `
            <div class="transfer-item">${t.fromAgent} → ${t.toAgent}${t.reason ? ` (${t.reason})` : ''} <span class="time">${fmtDate(t.createdAt)}</span></div>
          `).join('')}
        </div>
      ` : ''}

      ${s.whispers?.length ? `
        <div class="section">
          <h3>👁 Whispers Internos</h3>
          ${s.whispers.map(w => `
            <div class="whisper-item">
              <strong>${w.fromSupervisor}</strong> → ${w.toAgent}: ${w.content}
              <span class="time">${fmtDate(w.createdAt)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${s.scheduledMessages?.length ? `
        <div class="section">
          <h3>⏰ Mensajes Programados</h3>
          ${s.scheduledMessages.map(sm => `
            <div class="scheduled-item">
              <span class="status-badge status-${sm.status}">${sm.status}</span>
              ${sm.messageText || '(media)'} — ${sm.scheduledAt ? fmtDate(sm.scheduledAt) : sm.type}
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${s.activities?.length ? `
        <div class="section">
          <h3>📊 Línea de Tiempo</h3>
          <div class="timeline">
            ${s.activities.map(a => `
              <div class="tl-item">
                <div class="tl-dot"></div>
                <div class="tl-content">
                  <strong>${a.action}</strong> — ${a.description}
                  <span class="time">${fmtDate(a.createdAt)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${s.qaReview ? `
        <div class="section qa-section">
          <h3>✅ QA Review — Score: ${s.qaReview.totalScore}/100</h3>
          <div class="qa-bar"><div class="qa-fill" style="width:${s.qaReview.totalScore}%"></div></div>
          <p>Revisor: ${s.qaReview.reviewedBy} | Estado: ${s.qaReview.status} | Coaching: ${s.qaReview.coaching}</p>
          ${s.qaReview.comment ? `<p class="qa-comment">${s.qaReview.comment}</p>` : ''}
        </div>
      ` : ''}

      ${s.contactHistory?.length ? `
        <div class="section">
          <h3>📚 Historial del Contacto (${s.contactHistory.length} sesiones previas)</h3>
          <table class="history-table">
            <thead><tr><th>Session</th><th>Estado</th><th>Categoría</th><th>Mensajes</th><th>Fecha</th></tr></thead>
            <tbody>
              ${s.contactHistory.map(h => `
                <tr>
                  <td>${h.sessionId.slice(0, 12)}...</td>
                  <td><span class="status-badge status-${h.status}">${h.status}</span></td>
                  <td>${h.category || '—'}</td>
                  <td>${h.messageCount}</td>
                  <td>${fmtDate(h.createdAt)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      ${s.mediaFiles?.length ? `
        <div class="section">
          <h3>📎 Archivos Media (${s.mediaFiles.length})</h3>
          <table class="history-table">
            <thead><tr><th>Archivo</th><th>Tipo</th><th>MIME</th><th>Tamaño</th><th>URL</th></tr></thead>
            <tbody>
              ${s.mediaFiles.map(mf => `
                <tr>
                  <td>${mf.originalName}</td>
                  <td>${mf.type}</td>
                  <td>${mf.mimeType}</td>
                  <td>${Math.round(mf.size / 1024)} KB</td>
                  <td><a href="${mf.url}" target="_blank">Ver</a></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    </div>
  `).join('<div class="page-break"></div>');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Chat Export — ${companyName}</title>
  <style>
    :root { --primary: #4F46E5; --bg: #f8fafc; --card: #fff; --text: #1e293b; --muted: #64748b; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--bg); color: var(--text); padding: 30px; line-height: 1.6; }
    .report-header { text-align: center; padding: 30px 0; border-bottom: 3px solid var(--primary); margin-bottom: 30px; }
    .report-header h1 { color: var(--primary); font-size: 28px; }
    .report-header .subtitle { color: var(--muted); margin-top: 6px; }
    .session-card { background: var(--card); border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 24px; margin-bottom: 30px; }
    .session-header { margin-bottom: 20px; }
    .session-title { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .session-title h2 { font-size: 16px; font-family: monospace; color: var(--muted); }
    .channel-badge { padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .channel-telegram { background: #E0F2FE; color: #0369A1; }
    .channel-web { background: #F0FDF4; color: #166534; }
    .channel-whatsapp { background: #ECFDF5; color: #047857; }
    .status-badge { padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-open { background: #DCFCE7; color: #166534; }
    .status-closed { background: #F1F5F9; color: #475569; }
    .status-pending, .status-waiting { background: #FEF3C7; color: #92400E; }
    .status-sent { background: #DBEAFE; color: #1E40AF; }
    .status-cancelled, .status-failed { background: #FEE2E2; color: #991B1B; }
    .session-meta { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
    .meta-item { font-size: 13px; }
    .meta-item .label { font-weight: 600; color: var(--muted); }
    .section { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
    .section h3 { color: var(--primary); font-size: 15px; margin-bottom: 12px; }
    .chat-container { max-width: 100%; }
    .chat-msg { margin: 6px 0; }
    .bubble { display: inline-block; max-width: 70%; padding: 10px 14px; border-radius: 14px; font-size: 13px; }
    .msg-user .bubble { background: #E0E7FF; border-bottom-left-radius: 4px; text-align: left; }
    .msg-agent .bubble { background: #DCFCE7; border-bottom-right-radius: 4px; }
    .msg-bot .bubble { background: #FEF3C7; border-bottom-left-radius: 4px; text-align: left; }
    .bubble .sender { font-weight: 700; font-size: 11px; color: var(--primary); margin-bottom: 2px; }
    .bubble .content { word-break: break-word; }
    .bubble .time { font-size: 10px; color: var(--muted); margin-top: 4px; }
    .media-indicator { font-size: 11px; color: #7C3AED; padding: 2px 0; }
    .note-item { background: #FFFBEB; border-left: 4px solid #F59E0B; padding: 10px 14px; border-radius: 6px; margin: 6px 0; }
    .note-item p { margin-top: 4px; font-size: 13px; }
    .transfer-item, .whisper-item, .scheduled-item { padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .whisper-item { background: #F0F9FF; padding: 8px 12px; border-radius: 6px; margin: 4px 0; }
    .tags-bar { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    .tag { background: #EEF2FF; color: #4338CA; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .disposition-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; font-size: 13px; }
    .dispo-comment { color: var(--muted); font-style: italic; margin-top: 6px; }
    .timeline { border-left: 3px solid #E2E8F0; padding-left: 20px; }
    .tl-item { position: relative; padding: 8px 0; }
    .tl-dot { position: absolute; left: -27px; top: 14px; width: 10px; height: 10px; border-radius: 50%; background: var(--primary); }
    .tl-content { font-size: 13px; }
    .time { color: var(--muted); font-size: 11px; }
    .qa-section { background: #F5F3FF; border-radius: 8px; padding: 16px; }
    .qa-bar { width: 100%; height: 8px; background: #E2E8F0; border-radius: 4px; margin: 8px 0; }
    .qa-fill { height: 100%; background: var(--primary); border-radius: 4px; transition: width .3s; }
    .qa-comment { font-style: italic; color: var(--muted); margin-top: 8px; }
    .history-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .history-table th { background: #F1F5F9; padding: 8px; text-align: left; font-weight: 600; }
    .history-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
    .page-break { page-break-after: always; margin: 40px 0; border-top: 2px dashed #E2E8F0; }
    footer { text-align: center; color: var(--muted); font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 2px solid var(--primary); }
    @media print { body { padding: 10px; } .session-card { box-shadow: none; border: 1px solid #e2e8f0; } .page-break { page-break-after: always; } }
  </style>
</head>
<body style="max-width: 800px; margin: auto;">
  <div class="report-header">
    ${job.pdfOptions?.logoUrl ? `<img src="${job.pdfOptions.logoUrl}" alt="Logo" style="max-height:50px;margin-bottom:10px;">` : ''}
    <h1>${companyName}</h1>
    <div class="subtitle">Chat Export Report — ${data.length} sesión(es) — ${fmtDate(new Date())}</div>
  </div>
  ${sessionsHtml}
  <footer>${job.pdfOptions?.footerText || `Generado por ${companyName} el ${fmtDate(new Date())} — Confidencial`}</footer>
</body>
</html>`;

  const fileName = `export_${job._id}_${Date.now()}.html`;
  const filePath = path.join(EXPORTS_DIR, fileName);
  await fs.writeFile(filePath, html, 'utf-8');
  const stats = await fs.stat(filePath);

  return { filePath: fileName, fileSize: stats.size };
}

// ============= QUERY HELPERS =============

function buildSessionQuery(filters?: IExportJob['filters']): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  if (!filters) return query;

  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {} as any;
    if (filters.dateFrom) (query.createdAt as any).$gte = filters.dateFrom;
    if (filters.dateTo) (query.createdAt as any).$lte = filters.dateTo;
  }
  if (filters.agentIds?.length) {
    query.assignedAgent = { $in: filters.agentIds };
  }
  if (filters.categories?.length) {
    query.category = { $in: filters.categories };
  }
  if (filters.statuses?.length) {
    query.status = { $in: filters.statuses };
  }
  if (filters.tags?.length) {
    query.tags = { $in: filters.tags };
  }
  return query;
}

// ============= JOB PROCESSOR =============

/**
 * Process an export job — dispatches to the correct format generator
 */
export async function processExportJob(jobId: Types.ObjectId | string): Promise<void> {
  const job = await ExportJob.findById(jobId);
  if (!job) {
    throw new Error('Export job not found');
  }

  try {
    await ExportJob.findByIdAndUpdate(job._id, {
      status: 'processing',
      startedAt: new Date(),
      progress: 0,
    });

    let result: { filePath: string; fileSize: number };

    switch (job.format) {
      case 'json':
        result = await generateJsonExport(job);
        break;
      case 'csv':
        result = await generateCsvExport(job);
        break;
      case 'pdf':
        result = await generateHtmlExport(job);
        break;
      case 'xlsx':
        result = await generateXlsxExport(job);
        break;
      case 'zip':
        result = await generateZipExport(job);
        break;
      default:
        throw new Error(`Formato no soportado: ${job.format}`);
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await ExportJob.findByIdAndUpdate(job._id, {
      status: 'completed',
      progress: 100,
      completedAt: new Date(),
      fileUrl: `/api/exports/${result.filePath}`,
      fileName: result.filePath,
      fileSize: result.fileSize,
      expiresAt,
    });
  } catch (error) {
    await ExportJob.findByIdAndUpdate(job._id, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorDetails: { stack: error instanceof Error ? error.stack : undefined },
    });
    throw error;
  }
}

/**
 * Create a new export job
 */
export async function createExportJob(
  requestedBy: Types.ObjectId | string,
  params: {
    type: IExportJob['type'];
    sessionId?: string;
    filters?: IExportJob['filters'];
    include?: Partial<IExportJob['include']>;
    format: ExportFormat;
    pdfOptions?: IExportJob['pdfOptions'];
    advanced?: IExportJob['advanced'];
  }
): Promise<IExportJob> {
  const job = await ExportJob.create({
    type: params.type,
    sessionId: params.sessionId,
    filters: params.filters,
    include: {
      messages: params.include?.messages ?? true,
      notes: params.include?.notes ?? true,
      systemLogs: params.include?.systemLogs ?? false,
      agentActions: params.include?.agentActions ?? false,
      transfers: params.include?.transfers ?? true,
      ratings: params.include?.ratings ?? true,
      userInfo: params.include?.userInfo ?? true,
      media: params.include?.media ?? false,
      scheduledMessages: params.include?.scheduledMessages ?? false,
      whispers: params.include?.whispers ?? false,
      contactHistory: params.include?.contactHistory ?? false,
      qaReview: params.include?.qaReview ?? false,
      disposition: params.include?.disposition ?? true,
    },
    format: params.format,
    pdfOptions: params.pdfOptions,
    advanced: params.advanced,
    status: 'pending',
    requestedBy: new Types.ObjectId(requestedBy.toString()),
    requestedAt: new Date(),
  });

  // Start processing in background
  setImmediate(() => {
    processExportJob(job._id).catch(err => {
      console.error('Export job failed:', err);
    });
  });

  return job;
}

/**
 * Get export job status
 */
export async function getExportJobStatus(jobId: Types.ObjectId | string) {
  const result = await ExportJob.findById(jobId).lean();
  return result as unknown as IExportJob | null;
}

/**
 * Get export file path
 */
export async function getExportFilePath(fileName: string): Promise<string | null> {
  const filePath = path.join(EXPORTS_DIR, fileName);
  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

/**
 * Track download and return file path
 */
export async function trackDownload(jobId: Types.ObjectId | string): Promise<string | null> {
  const job = await ExportJob.findByIdAndUpdate(
    jobId,
    {
      $inc: { downloadCount: 1 },
      lastDownloadAt: new Date(),
    },
    { new: true }
  );

  if (!job?.fileName) return null;
  return getExportFilePath(job.fileName);
}

/**
 * Export Service - Generate PDF, JSON, and CSV exports
 */

import { Types } from 'mongoose';
import { ExportJob, type IExportJob, type ExportFormat } from '../database/models/ExportJob.js';
import { ChatSession, type IChatSession } from '../database/models/ChatSession.js';
import { Message, type IMessage } from '../database/models/Message.js';
import { Note, type INote } from '../database/models/Note.js';
import { ActivityLog, type IActivityLog } from '../database/models/ActivityLog.js';
import { Transfer, type ITransfer } from '../database/models/Transfer.js';
import fs from 'fs/promises';
import path from 'path';

const EXPORTS_DIR = path.join(process.cwd(), 'exports');

interface SessionExportData {
  session: {
    id: string;
    status: string;
    category?: string;
    priority: string;
    tags: string[];
    createdAt: Date;
    closedAt?: Date;
    rating?: number;
    feedback?: string;
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
  messages: Array<{
    id: string;
    content: string;
    sender: string;
    createdAt: Date;
    isEdited?: boolean;
    editedAt?: Date;
  }>;
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
}

/**
 * Ensure exports directory exists
 */
async function ensureExportsDir(): Promise<void> {
  try {
    await fs.access(EXPORTS_DIR);
  } catch {
    await fs.mkdir(EXPORTS_DIR, { recursive: true });
  }
}

/**
 * Gather all data for a single session export
 */
async function gatherSessionData(
  sessionId: string,
  include: IExportJob['include']
): Promise<SessionExportData | null> {
  const session = await ChatSession.findOne({ sessionId })
    .populate('user', 'firstName lastName telegramId telegramUsername')
    .populate('assignedAgent', 'name email')
    .lean();

  if (!session) return null;

  const data: SessionExportData = {
    session: {
      id: session.sessionId,
      status: session.status,
      category: session.category,
      priority: session.priority,
      tags: session.tags || [],
      createdAt: session.createdAt,
      closedAt: session.closedAt,
      rating: session.rating,
      feedback: session.feedback,
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

  // Messages
  if (include.messages) {
    const messages = await Message.find({ sessionId })
      .sort({ createdAt: 1 })
      .lean();

    data.messages = messages.map(m => ({
      id: m._id.toString(),
      content: m.content,
      sender: m.sender,
      createdAt: m.createdAt,
      isEdited: m.isEdited,
      editedAt: m.editedAt,
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
      actor: a.actor.name || a.actor.type,
      description: a.description,
      createdAt: a.createdAt,
    }));
  }

  return data;
}

/**
 * Generate JSON export
 */
async function generateJsonExport(job: IExportJob): Promise<{ filePath: string; fileSize: number }> {
  await ensureExportsDir();

  let data: SessionExportData[] = [];

  if (job.type === 'session' && job.sessionId) {
    const sessionData = await gatherSessionData(job.sessionId, job.include);
    if (sessionData) data.push(sessionData);
  } else if (job.type === 'sessions') {
    const query: Record<string, unknown> = {};
    
    if (job.filters?.dateFrom || job.filters?.dateTo) {
      query.createdAt = {};
      if (job.filters.dateFrom) (query.createdAt as any).$gte = job.filters.dateFrom;
      if (job.filters.dateTo) (query.createdAt as any).$lte = job.filters.dateTo;
    }
    if (job.filters?.agentIds?.length) {
      query.assignedAgent = { $in: job.filters.agentIds };
    }
    if (job.filters?.categories?.length) {
      query.category = { $in: job.filters.categories };
    }
    if (job.filters?.statuses?.length) {
      query.status = { $in: job.filters.statuses };
    }

    const sessions = await ChatSession.find(query).select('sessionId').lean();
    
    for (let i = 0; i < sessions.length; i++) {
      const sessionData = await gatherSessionData(sessions[i].sessionId, job.include);
      if (sessionData) data.push(sessionData);

      // Update progress
      await ExportJob.findByIdAndUpdate(job._id, {
        progress: Math.round(((i + 1) / sessions.length) * 100),
        processedItems: i + 1,
        totalItems: sessions.length,
        currentStep: `Processing session ${i + 1} of ${sessions.length}`,
      });
    }
  }

  const fileName = `export_${job._id}_${Date.now()}.json`;
  const filePath = path.join(EXPORTS_DIR, fileName);

  const jsonContent = JSON.stringify({
    exportedAt: new Date().toISOString(),
    exportedBy: job.requestedBy.toString(),
    totalSessions: data.length,
    sessions: data,
  }, null, 2);

  await fs.writeFile(filePath, jsonContent, 'utf-8');
  const stats = await fs.stat(filePath);

  return { filePath: fileName, fileSize: stats.size };
}

/**
 * Generate CSV export
 */
async function generateCsvExport(job: IExportJob): Promise<{ filePath: string; fileSize: number }> {
  await ensureExportsDir();

  const rows: string[] = [];
  
  // Header
  const headers = [
    'Session ID',
    'User Name',
    'User Telegram ID',
    'Agent Name',
    'Status',
    'Category',
    'Priority',
    'Tags',
    'Created At',
    'Closed At',
    'Rating',
    'Feedback',
    'Message Count',
  ];
  rows.push(headers.join(','));

  const query: Record<string, unknown> = {};
  
  if (job.sessionId) {
    query.sessionId = job.sessionId;
  } else if (job.filters) {
    if (job.filters.dateFrom || job.filters.dateTo) {
      query.createdAt = {};
      if (job.filters.dateFrom) (query.createdAt as any).$gte = job.filters.dateFrom;
      if (job.filters.dateTo) (query.createdAt as any).$lte = job.filters.dateTo;
    }
    if (job.filters.agentIds?.length) {
      query.assignedAgent = { $in: job.filters.agentIds };
    }
    if (job.filters.categories?.length) {
      query.category = { $in: job.filters.categories };
    }
    if (job.filters.statuses?.length) {
      query.status = { $in: job.filters.statuses };
    }
  }

  const sessions = await ChatSession.find(query)
    .populate('user', 'firstName lastName telegramId')
    .populate('assignedAgent', 'name')
    .lean();

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    const messageCount = await Message.countDocuments({ sessionId: session.sessionId });

    const escapeCsv = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const row = [
      escapeCsv(session.sessionId),
      escapeCsv(`${(session.user as any)?.firstName || ''} ${(session.user as any)?.lastName || ''}`.trim()),
      escapeCsv((session.user as any)?.telegramId),
      escapeCsv((session.assignedAgent as any)?.name),
      escapeCsv(session.status),
      escapeCsv(session.category),
      escapeCsv(session.priority),
      escapeCsv((session.tags || []).join('; ')),
      escapeCsv(session.createdAt.toISOString()),
      escapeCsv(session.closedAt?.toISOString()),
      escapeCsv(session.rating),
      escapeCsv(session.feedback),
      escapeCsv(messageCount),
    ];
    rows.push(row.join(','));

    // Update progress
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

/**
 * Generate PDF export (simplified - uses HTML to PDF)
 */
async function generatePdfExport(job: IExportJob): Promise<{ filePath: string; fileSize: number }> {
  // For a real implementation, use a library like puppeteer or pdfkit
  // This is a placeholder that generates an HTML file instead
  
  await ensureExportsDir();

  let data: SessionExportData[] = [];

  if (job.sessionId) {
    const sessionData = await gatherSessionData(job.sessionId, job.include);
    if (sessionData) data.push(sessionData);
  }

  const companyName = job.pdfOptions?.companyName || 'Support Dashboard';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chat Export - ${companyName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; border-bottom: 2px solid #4F46E5; padding-bottom: 10px; }
    h2 { color: #4F46E5; margin-top: 30px; }
    .session-info { background: #f5f5f5; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .message { padding: 10px; margin: 5px 0; border-radius: 8px; }
    .message.user { background: #E0E7FF; margin-right: 20%; }
    .message.agent { background: #DCFCE7; margin-left: 20%; }
    .message.bot { background: #FEF3C7; margin-right: 20%; }
    .message-meta { font-size: 0.8em; color: #666; margin-top: 5px; }
    .note { background: #FEF3C7; padding: 10px; margin: 5px 0; border-radius: 8px; border-left: 4px solid #F59E0B; }
    .activity { padding: 5px 0; border-bottom: 1px solid #eee; }
    footer { margin-top: 50px; text-align: center; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  ${job.pdfOptions?.includeBranding ? `
  <header>
    ${job.pdfOptions.logoUrl ? `<img src="${job.pdfOptions.logoUrl}" alt="Logo" style="max-height: 50px;">` : ''}
    <h1>${companyName} - Chat Export</h1>
  </header>
  ` : '<h1>Chat Export</h1>'}

  ${data.map(session => `
    <div class="session-info">
      <strong>Session ID:</strong> ${session.session.id}<br>
      <strong>User:</strong> ${session.user.name} ${session.user.username ? `(@${session.user.username})` : ''}<br>
      <strong>Agent:</strong> ${session.agent?.name || 'Not assigned'}<br>
      <strong>Status:</strong> ${session.session.status}<br>
      <strong>Category:</strong> ${session.session.category || 'N/A'}<br>
      <strong>Created:</strong> ${session.session.createdAt.toISOString()}<br>
      ${session.session.closedAt ? `<strong>Closed:</strong> ${session.session.closedAt.toISOString()}<br>` : ''}
      ${session.session.rating ? `<strong>Rating:</strong> ${session.session.rating}/5<br>` : ''}
    </div>

    <h2>Messages (${session.messages.length})</h2>
    ${session.messages.map(msg => `
      <div class="message ${msg.sender}">
        <strong>${msg.sender === 'user' ? session.user.name : msg.sender === 'agent' ? (session.agent?.name || 'Agent') : 'Bot'}:</strong>
        ${msg.content.replace(/\n/g, '<br>')}
        <div class="message-meta">
          ${msg.createdAt.toISOString()}
          ${msg.isEdited ? ' (edited)' : ''}
        </div>
      </div>
    `).join('')}

    ${session.notes?.length ? `
      <h2>Internal Notes (${session.notes.length})</h2>
      ${session.notes.map(note => `
        <div class="note">
          <strong>${note.createdBy}:</strong> ${note.content}
          <div class="message-meta">${note.createdAt.toISOString()}</div>
        </div>
      `).join('')}
    ` : ''}

    ${session.activities?.length ? `
      <h2>Activity Log</h2>
      ${session.activities.map(act => `
        <div class="activity">
          <strong>${act.action}</strong> - ${act.description}
          <span style="color: #666; font-size: 0.9em;">(${act.createdAt.toISOString()})</span>
        </div>
      `).join('')}
    ` : ''}
  `).join('<hr style="margin: 40px 0;">')}

  <footer>
    ${job.pdfOptions?.footerText || `Exported on ${new Date().toISOString()} by ${companyName}`}
  </footer>
</body>
</html>
  `;

  // For now, save as HTML (in production, convert to PDF using puppeteer)
  const fileName = `export_${job._id}_${Date.now()}.html`;
  const filePath = path.join(EXPORTS_DIR, fileName);

  await fs.writeFile(filePath, html, 'utf-8');
  const stats = await fs.stat(filePath);

  return { filePath: fileName, fileSize: stats.size };
}

/**
 * Process an export job
 */
export async function processExportJob(jobId: Types.ObjectId | string): Promise<void> {
  const job = await ExportJob.findById(jobId);
  if (!job) {
    throw new Error('Export job not found');
  }

  try {
    // Update status to processing
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
        result = await generatePdfExport(job);
        break;
      default:
        throw new Error(`Unsupported format: ${job.format}`);
    }

    // Calculate expiry (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Update job as completed
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
    // Update job as failed
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
    },
    format: params.format,
    pdfOptions: params.pdfOptions,
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

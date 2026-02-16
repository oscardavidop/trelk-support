/**
 * Media Admin Service
 * Enterprise media management, storage analytics, orphan detection, and purge
 * Reuses the existing upload.service.ts for actual file I/O
 */

import { Types } from 'mongoose';
import { existsSync, readdirSync, statSync } from 'fs';
import { unlink, stat, readdir } from 'fs/promises';
import { join, extname, basename } from 'path';
import { MediaFile, type IMediaFile, type MediaSource, type MediaType, type MediaStatus } from '../database/models/MediaFile.js';
import { Message } from '../database/models/Message.js';
import { ChatSession } from '../database/models/ChatSession.js';
import { uploadImage, uploadFile, uploadAudio, uploadVideo, deleteUpload, type UploadResult } from './upload.service.js';
import { logAudit } from './audit-log.service.js';
import { logger } from './logger.js';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// ============= TYPES =============

export interface StorageOverview {
  totalFiles: number;
  totalSize: number;
  totalSizeFormatted: string;
  diskUsage: {
    images: { count: number; size: number; sizeFormatted: string };
    videos: { count: number; size: number; sizeFormatted: string };
    audios: { count: number; size: number; sizeFormatted: string };
    documents: { count: number; size: number; sizeFormatted: string };
    other: { count: number; size: number; sizeFormatted: string };
  };
  bySource: Record<string, { count: number; size: number }>;
  orphanCount: number;
  recentUploads: number; // last 24h
  softDeletedCount: number;
}

export interface MediaQuery {
  search?: string;
  type?: MediaType;
  source?: MediaSource;
  status?: MediaStatus;
  dateFrom?: string;
  dateTo?: string;
  chatSessionId?: string;
  isFlowAsset?: boolean;
  isOrphan?: boolean;
  minSize?: number;
  maxSize?: number;
  page?: number;
  limit?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface MediaQueryResult {
  files: IMediaFile[];
  total: number;
  page: number;
  totalPages: number;
}

// ============= HELPERS =============

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function mimeToType(mimeType: string): MediaType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('text/') ||
    mimeType.includes('zip') ||
    mimeType.includes('msword') ||
    mimeType.includes('excel')
  ) return 'document';
  return 'other';
}

// ============= STORAGE OVERVIEW =============

/**
 * Get comprehensive storage metrics from DB + disk
 */
export async function getStorageOverview(): Promise<StorageOverview> {
  // Aggregate from MediaFile collection
  const [typePipeline, sourcePipeline, orphanCount, recentCount, softDeletedCount] = await Promise.all([
    MediaFile.aggregate([
      { $match: { status: { $ne: 'permanent_deleted' } } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          size: { $sum: '$size' },
        },
      },
    ]),
    MediaFile.aggregate([
      { $match: { status: { $ne: 'permanent_deleted' } } },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
          size: { $sum: '$size' },
        },
      },
    ]),
    MediaFile.countDocuments({ status: 'orphan' }),
    MediaFile.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    }),
    MediaFile.countDocuments({ status: 'soft_deleted' }),
  ]);

  // Process type stats
  const diskUsage: StorageOverview['diskUsage'] = {
    images: { count: 0, size: 0, sizeFormatted: '0 B' },
    videos: { count: 0, size: 0, sizeFormatted: '0 B' },
    audios: { count: 0, size: 0, sizeFormatted: '0 B' },
    documents: { count: 0, size: 0, sizeFormatted: '0 B' },
    other: { count: 0, size: 0, sizeFormatted: '0 B' },
  };

  let totalFiles = 0;
  let totalSize = 0;

  for (const entry of typePipeline) {
    const key =
      entry._id === 'image' ? 'images' :
      entry._id === 'video' ? 'videos' :
      entry._id === 'audio' || entry._id === 'voice' ? 'audios' :
      entry._id === 'document' ? 'documents' : 'other';

    diskUsage[key].count += entry.count;
    diskUsage[key].size += entry.size;
    diskUsage[key].sizeFormatted = formatBytes(diskUsage[key].size);
    totalFiles += entry.count;
    totalSize += entry.size;
  }

  // Source stats
  const bySource: Record<string, { count: number; size: number }> = {};
  for (const entry of sourcePipeline) {
    bySource[entry._id] = { count: entry.count, size: entry.size };
  }

  return {
    totalFiles,
    totalSize,
    totalSizeFormatted: formatBytes(totalSize),
    diskUsage,
    bySource,
    orphanCount,
    recentUploads: recentCount,
    softDeletedCount,
  };
}

// ============= QUERY MEDIA =============

/**
 * List media files with filters, search, and pagination
 */
export async function queryMedia(params: MediaQuery): Promise<MediaQueryResult> {
  const {
    search,
    type,
    source,
    status,
    dateFrom,
    dateTo,
    chatSessionId,
    isFlowAsset,
    isOrphan,
    minSize,
    maxSize,
    page = 1,
    limit = 30,
    sortField = 'createdAt',
    sortDirection = 'desc',
  } = params;

  const query: Record<string, unknown> = {};

  // Don't show permanently deleted
  if (status) {
    query.status = status;
  } else {
    query.status = { $ne: 'permanent_deleted' };
  }

  if (type) query.type = type;
  if (source) query.source = source;
  if (chatSessionId) query.chatSessionId = chatSessionId;
  if (isFlowAsset !== undefined) query.isFlowAsset = isFlowAsset;
  if (isOrphan) query.status = 'orphan';

  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) (query.createdAt as any).$gte = new Date(dateFrom);
    if (dateTo) (query.createdAt as any).$lte = new Date(dateTo);
  }

  if (minSize || maxSize) {
    query.size = {};
    if (minSize) (query.size as any).$gte = minSize;
    if (maxSize) (query.size as any).$lte = maxSize;
  }

  if (search) {
    query.$or = [
      { originalName: { $regex: search, $options: 'i' } },
      { filename: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
    ];
  }

  const sortObj: Record<string, 1 | -1> = {
    [sortField]: sortDirection === 'asc' ? 1 : -1,
  };

  const [files, total] = await Promise.all([
    MediaFile.find(query)
      .sort(sortObj)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    MediaFile.countDocuments(query),
  ]);

  return {
    files: files as unknown as IMediaFile[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ============= GET SINGLE MEDIA =============

export async function getMediaById(id: string): Promise<IMediaFile | null> {
  return MediaFile.findById(id).lean() as Promise<IMediaFile | null>;
}

// ============= TRACK MEDIA =============

/**
 * Register a new media file in the tracking DB
 * Called after an upload or when receiving from Telegram
 */
export async function trackMedia(data: {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  storagePath: string;
  source: MediaSource;
  chatSessionId?: string;
  messageId?: string;
  flowId?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  userId?: string;
  userName?: string;
  telegramFileId?: string;
  isFlowAsset?: boolean;
  width?: number;
  height?: number;
  duration?: number;
  description?: string;
  tags?: string[];
}): Promise<IMediaFile> {
  const extension = extname(data.originalName || data.filename).toLowerCase().replace('.', '');
  const type = mimeToType(data.mimeType);

  const media = await MediaFile.create({
    filename: data.filename,
    originalName: data.originalName,
    mimeType: data.mimeType,
    size: data.size,
    extension,
    url: data.url,
    storagePath: data.storagePath,
    type,
    source: data.source,
    chatSessionId: data.chatSessionId,
    messageId: data.messageId ? new Types.ObjectId(data.messageId) : undefined,
    flowId: data.flowId ? new Types.ObjectId(data.flowId) : undefined,
    uploadedBy: data.uploadedBy ? new Types.ObjectId(data.uploadedBy) : undefined,
    uploadedByName: data.uploadedByName,
    userId: data.userId ? new Types.ObjectId(data.userId) : undefined,
    userName: data.userName,
    telegramFileId: data.telegramFileId,
    isFlowAsset: data.isFlowAsset || false,
    width: data.width,
    height: data.height,
    duration: data.duration,
    description: data.description,
    tags: data.tags || [],
    status: 'active',
  });

  return media;
}

// ============= ADMIN UPLOAD =============

/**
 * Upload a file from Admin panel — reuses existing upload functions
 */
export async function adminUploadMedia(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  agentId: string,
  agentName: string,
  options?: {
    isFlowAsset?: boolean;
    description?: string;
    tags?: string[];
  }
): Promise<{ ok: boolean; media?: IMediaFile; error?: string }> {
  let result: UploadResult;
  const type = mimeToType(mimeType);

  // Route to appropriate existing upload handler
  switch (type) {
    case 'image':
      result = await uploadImage(buffer, originalName, mimeType);
      break;
    case 'video':
      result = await uploadVideo(buffer, originalName, mimeType);
      break;
    case 'audio':
    case 'voice':
      result = await uploadAudio(buffer, originalName, mimeType);
      break;
    default:
      result = await uploadFile(buffer, originalName, mimeType);
  }

  if (!result.ok || !result.url) {
    return { ok: false, error: result.error || 'Upload failed' };
  }

  // Track in MediaFile collection
  const media = await trackMedia({
    filename: result.filename || basename(result.url!),
    originalName,
    mimeType,
    size: result.size || buffer.length,
    url: result.url,
    storagePath: join(UPLOAD_DIR, result.url!.replace('/uploads/', '')),
    source: 'admin',
    uploadedBy: agentId,
    uploadedByName: agentName,
    isFlowAsset: options?.isFlowAsset,
    description: options?.description,
    tags: options?.tags,
  });

  return { ok: true, media };
}

// ============= DELETE OPERATIONS =============

/**
 * Soft-delete a media file
 */
export async function softDeleteMedia(
  mediaId: string,
  agentId: string,
  reason?: string
): Promise<IMediaFile | null> {
  const media = await MediaFile.findByIdAndUpdate(
    mediaId,
    {
      status: 'soft_deleted',
      deletedAt: new Date(),
      deletedBy: new Types.ObjectId(agentId),
      deleteReason: reason || 'Admin action',
    },
    { new: true }
  );

  return media;
}

/**
 * Permanent delete — removes file from disk + DB
 */
export async function permanentDeleteMedia(
  mediaId: string,
  agentId: string
): Promise<{ ok: boolean; error?: string }> {
  const media = await MediaFile.findById(mediaId);
  if (!media) return { ok: false, error: 'Media not found' };

  try {
    // Delete from disk
    if (media.storagePath && existsSync(media.storagePath)) {
      await unlink(media.storagePath);
    } else if (media.url) {
      // Try via the URL path
      await deleteUpload(media.url).catch(() => {});
    }

    // Mark as permanently deleted
    await MediaFile.findByIdAndUpdate(mediaId, {
      status: 'permanent_deleted',
      deletedAt: new Date(),
      deletedBy: new Types.ObjectId(agentId),
    });

    return { ok: true };
  } catch (error) {
    logger.error('media-admin', { action: 'permanent_delete_error', mediaId, error: String(error) });
    return { ok: false, error: 'Failed to delete file from storage' };
  }
}

/**
 * Restore a soft-deleted media file
 */
export async function restoreMedia(mediaId: string): Promise<IMediaFile | null> {
  return MediaFile.findByIdAndUpdate(
    mediaId,
    {
      status: 'active',
      $unset: { deletedAt: 1, deletedBy: 1, deleteReason: 1 },
    },
    { new: true }
  );
}

// ============= ORPHAN DETECTION =============

/**
 * Detect orphan files — files not referenced by any message, flow, or note
 */
export async function detectOrphans(): Promise<number> {
  // Get all active media IDs with message references
  const mediaWithMessages = await MediaFile.find({
    status: 'active',
    messageId: { $exists: true, $ne: null },
  }).select('messageId').lean();

  // Check which messages still exist
  const messageIds = mediaWithMessages
    .filter(m => m.messageId)
    .map(m => m.messageId);

  const existingMessages = await Message.find({
    _id: { $in: messageIds },
  }).select('_id').lean();

  const existingMessageIdSet = new Set(existingMessages.map(m => m._id.toString()));

  // Find media whose message no longer exists
  let orphanCount = 0;
  for (const media of mediaWithMessages) {
    if (media.messageId && !existingMessageIdSet.has(media.messageId.toString())) {
      await MediaFile.findByIdAndUpdate(media._id, { status: 'orphan' });
      orphanCount++;
    }
  }

  // Also detect files on disk not tracked in DB
  const dirs = ['images', 'videos', 'audio', 'files'];
  for (const dir of dirs) {
    const fullDir = join(UPLOAD_DIR, dir);
    if (!existsSync(fullDir)) continue;

    try {
      const diskFiles = readdirSync(fullDir);
      for (const file of diskFiles) {
        const url = `/uploads/${dir}/${file}`;
        const exists = await MediaFile.findOne({ url }).lean();
        if (!exists) {
          // Track as orphan
          const filePath = join(fullDir, file);
          try {
            const fileStat = statSync(filePath);
            const ext = extname(file).toLowerCase().replace('.', '');
            await MediaFile.create({
              filename: file,
              originalName: file,
              mimeType: `application/octet-stream`,
              size: fileStat.size,
              extension: ext,
              url,
              storagePath: filePath,
              type: dir === 'images' ? 'image' : dir === 'videos' ? 'video' : dir === 'audio' ? 'audio' : 'document',
              source: 'system',
              status: 'orphan',
              isFlowAsset: false,
              tags: [],
            });
            orphanCount++;
          } catch { /* skip unreadable files */ }
        }
      }
    } catch { /* skip unreadable dirs */ }
  }

  return orphanCount;
}

// ============= PURGE OPERATIONS =============

/**
 * Purge old files (older than X days, soft-deleted)
 */
export async function purgeOldFiles(daysOld: number): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const toDelete = await MediaFile.find({
    status: { $in: ['soft_deleted', 'orphan'] },
    createdAt: { $lt: cutoff },
  }).lean();

  let purged = 0;
  for (const file of toDelete) {
    try {
      if (file.storagePath && existsSync(file.storagePath)) {
        await unlink(file.storagePath);
      }
      await MediaFile.findByIdAndUpdate(file._id, { status: 'permanent_deleted' });
      purged++;
    } catch { /* continue */ }
  }

  return purged;
}

/**
 * Purge orphan files
 */
export async function purgeOrphans(): Promise<number> {
  const orphans = await MediaFile.find({ status: 'orphan' }).lean();
  let purged = 0;

  for (const file of orphans) {
    try {
      if (file.storagePath && existsSync(file.storagePath)) {
        await unlink(file.storagePath);
      }
      await MediaFile.findByIdAndUpdate(file._id, { status: 'permanent_deleted' });
      purged++;
    } catch { /* continue */ }
  }

  return purged;
}

/**
 * DANGEROUS: Purge ALL files from storage
 */
export async function purgeAllFiles(): Promise<number> {
  const allFiles = await MediaFile.find({
    status: { $in: ['active', 'soft_deleted', 'orphan'] },
  }).lean();

  let purged = 0;
  for (const file of allFiles) {
    try {
      if (file.storagePath && existsSync(file.storagePath)) {
        await unlink(file.storagePath);
      }
      await MediaFile.findByIdAndUpdate(file._id, { status: 'permanent_deleted' });
      purged++;
    } catch { /* continue */ }
  }

  return purged;
}

// ============= SYNC EXISTING FILES =============

/**
 * Scan disk + messages to populate MediaFile collection (one-time migration)
 */
export async function syncExistingMedia(): Promise<{ tracked: number; errors: number }> {
  let tracked = 0;
  let errors = 0;

  // 1. Scan messages with media
  const messagesWithMedia = await Message.find({
    $or: [
      { mediaUrl: { $exists: true, $nin: [null, ''] } },
      { 'media.url': { $exists: true, $ne: null } },
    ],
  })
    .select('session media mediaUrl sender createdAt')
    .lean();

  for (const msg of messagesWithMedia) {
    try {
      const mediaUrl = (msg.media?.url || msg.mediaUrl) as string;
      if (!mediaUrl) continue;

      // Skip if already tracked
      const exists = await MediaFile.findOne({ url: mediaUrl }).lean();
      if (exists) continue;

      const filename = basename(mediaUrl);
      const ext = extname(filename).toLowerCase().replace('.', '');
      const mimeType = msg.media?.mimeType || 'application/octet-stream';
      const storagePath = join(UPLOAD_DIR, mediaUrl.replace('/uploads/', ''));
      let fileSize = msg.media?.fileSize || 0;

      // Get size from disk if possible
      if (!fileSize && existsSync(storagePath)) {
        try {
          const s = statSync(storagePath);
          fileSize = s.size;
        } catch { /* use 0 */ }
      }

      // Determine source from channel/sender
      const session = await ChatSession.findById(msg.session).select('channel').lean();
      const source: MediaSource = session?.channel === 'telegram' ? 'telegram' :
        session?.channel === 'web' ? 'webchat' : 'livechat';

      await MediaFile.create({
        filename,
        originalName: msg.media?.fileName || filename,
        mimeType,
        size: fileSize,
        extension: ext,
        url: mediaUrl,
        storagePath,
        type: mimeToType(mimeType),
        source,
        chatSessionId: msg.session?.toString(),
        messageId: msg._id,
        status: 'active',
        isFlowAsset: false,
        tags: [],
        width: msg.media?.width,
        height: msg.media?.height,
        duration: msg.media?.duration,
        createdAt: msg.createdAt,
      });

      tracked++;
    } catch (err) {
      errors++;
      logger.warn('media-sync', { message: 'Failed to track message media', msgId: msg._id, error: String(err) });
    }
  }

  // 2. Scan disk for untracked files
  const dirs = ['images', 'videos', 'audio', 'files'];
  for (const dir of dirs) {
    const fullDir = join(UPLOAD_DIR, dir);
    if (!existsSync(fullDir)) continue;

    try {
      const diskFiles = readdirSync(fullDir);
      for (const file of diskFiles) {
        const url = `/uploads/${dir}/${file}`;
        const exists = await MediaFile.findOne({ url }).lean();
        if (exists) continue;

        try {
          const filePath = join(fullDir, file);
          const fileStat = statSync(filePath);
          const ext = extname(file).toLowerCase().replace('.', '');

          await MediaFile.create({
            filename: file,
            originalName: file,
            mimeType: 'application/octet-stream',
            size: fileStat.size,
            extension: ext,
            url,
            storagePath: filePath,
            type: dir === 'images' ? 'image' : dir === 'videos' ? 'video' : dir === 'audio' ? 'audio' : 'document',
            source: 'system',
            status: 'active',
            isFlowAsset: false,
            tags: [],
            createdAt: fileStat.birthtime || fileStat.mtime,
          });
          tracked++;
        } catch {
          errors++;
        }
      }
    } catch { /* skip dir */ }
  }

  logger.info('media-sync', { action: 'sync_completed', tracked, errors });
  return { tracked, errors };
}

// ============= QUOTA / LIMITS =============

export interface StorageQuota {
  maxUploadSizeMB: number;
  maxStorageBytes: number;
  maxFileSizeBytes: number;
  allowedTypes: string[];
  retentionDays: number;
  usedStorageBytes: number;
  usedStorageFormatted: string;
  usedPercent: number;
  remainingBytes: number;
}

export async function getStorageQuota(): Promise<StorageQuota> {
  const totalSize = await MediaFile.aggregate([
    { $match: { status: { $ne: 'permanent_deleted' } } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);

  const used = totalSize[0]?.total || 0;
  const maxStorageBytes = 10 * 1024 * 1024 * 1024; // 10 GB
  const maxFileSizeBytes = 50 * 1024 * 1024; // 50 MB
  const usedPercent = maxStorageBytes > 0 ? (used / maxStorageBytes) * 100 : 0;
  const remainingBytes = Math.max(0, maxStorageBytes - used);

  return {
    maxUploadSizeMB: 50,
    maxStorageBytes,
    maxFileSizeBytes,
    allowedTypes: ['image/*', 'video/*', 'audio/*', 'application/pdf', 'application/zip', 'text/*'],
    retentionDays: 90,
    usedStorageBytes: used,
    usedStorageFormatted: formatBytes(used),
    usedPercent,
    remainingBytes,
  };
}

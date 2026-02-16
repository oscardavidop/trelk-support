/**
 * Media Routes
 * Serves local files from telegram-bot-api local mode
 * 
 * When using telegram-bot-api in --local mode, files are stored locally
 * and getFile returns a local path like:
 * /home/quinton/support/7574633044:AAE.../photos/file_1.jpg
 * 
 * This endpoint accepts a file_id, calls getFile to get the local path,
 * and serves the file directly without exposing the bot token.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { getFile, getFileBuffer } from '../services/telegram.js';
import { Message } from '../database/index.js';
import { ChatSession } from '../database/index.js';
import fs from 'fs';
import path from 'path';

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  // Images
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  // Audio
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  // Video
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mov': 'video/quicktime',
  // Documents
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.zip': 'application/zip',
  '.rar': 'application/x-rar-compressed',
  '.7z': 'application/x-7z-compressed',
  '.tar': 'application/x-tar',
  '.gz': 'application/gzip',
  // Stickers
  '.tgs': 'application/x-tgsticker',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

interface MediaParams {
  fileId: string;
}

export async function registerMediaRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/media/:fileId
   * Serves a file by its Telegram file_id
   * 
   * Flow:
   * 1. Call getFile(fileId) to get the local path
   * 2. Read and serve the file
   */
  fastify.get<{ Params: MediaParams }>(
    '/api/media/:fileId',
    { preHandler: authMiddleware },
    async (request: FastifyRequest<{ Params: MediaParams }>, reply: FastifyReply) => {
      try {
        const { fileId } = request.params;
        const { download } = request.query as { download?: string };

        if (!fileId) {
          return reply.status(400).send({ ok: false, error: 'File ID required' });
        }

        // Get file info from Telegram API
        const file = await getFile(fileId);
        console.log('file', file)

        if (!file || !file.file_path) {
          console.error('File not found:', fileId);
          return reply.status(404).send({ ok: false, error: 'File not found' });
        }

        let localPath = file.file_path;
        console.log('Serving local file:', localPath);

        // Security check - ensure path doesn't escape allowed directories
        // The path should be under the telegram-bot-api working directory
        if (!localPath.startsWith('/home/quinton/support/')) {
          console.error('Invalid file path:', localPath);
          // localPath= './uploads/notfound.jpg'
          // return reply.status(403).send({ ok: false, error: 'Access denied' });
        }

        // Check if file exists
        if (!fs.existsSync(localPath)) {
          console.error('File does not exist:', localPath);
          try {
            localPath = `./uploads/api/${path.basename(localPath)}`;
            const fileBuffer = await getFileBuffer(file.file_path);
            fs.writeFileSync(localPath, Buffer.from(fileBuffer));
            console.log('File downloaded and saved to disk:', localPath);
          } catch (error) {
            console.error('Failed to download file from Telegram:', error);
            return reply.status(404).send({ ok: false, error: 'File not found on disk' });
          }
        }

        // Get file stats
        const stats = fs.statSync(localPath);
        const mimeType = getMimeType(localPath);
        const fileName = path.basename(localPath);

        // Set headers
        reply.header('Content-Type', mimeType);
        reply.header('Content-Length', stats.size);
        reply.header('Content-Disposition', download === 'true' ? `attachment; filename="${fileName}"` : `inline; filename="${fileName}"`);
        reply.header('Cache-Control', 'public, max-age=2592000'); // Cache for 30 days

        // Stream the file
        const stream = fs.createReadStream(localPath);
        return reply.send(stream);

      } catch (error) {
        console.error('Media serve error:', error);
        return reply.status(500).send({ ok: false, error: 'Failed to serve file' });
      }
    }
  );

  /**
   * GET /api/download/:fileId
   * Download a file by its Telegram file_id (forces download)
   */
  fastify.get<{ Params: MediaParams }>(
    '/api/download/:fileId',
    { preHandler: authMiddleware },
    async (request: FastifyRequest<{ Params: MediaParams }>, reply: FastifyReply) => {
      try {
        const { fileId } = request.params;

        if (!fileId) {
          return reply.status(400).send({ ok: false, error: 'File ID required' });
        }

        // Get file info from Telegram API
        const file = await getFile(fileId);

        if (!file || !file.file_path) {
          return reply.status(404).send({ ok: false, error: 'File not found' });
        }

        const localPath = file.file_path;

        // Security check
        if (!localPath.startsWith('/home/quinton/support/')) {
          return reply.status(403).send({ ok: false, error: 'Access denied' });
        }

        // Check if file exists
        if (!fs.existsSync(localPath)) {
          return reply.status(404).send({ ok: false, error: 'File not found on disk' });
        }

        // Get file stats
        const stats = fs.statSync(localPath);
        const mimeType = getMimeType(localPath);
        const fileName = path.basename(localPath);

        // Set headers for download
        reply.header('Content-Type', mimeType);
        reply.header('Content-Length', stats.size);
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);

        // Stream the file
        const stream = fs.createReadStream(localPath);
        return reply.send(stream);

      } catch (error) {
        console.error('Download error:', error);
        return reply.status(500).send({ ok: false, error: 'Failed to download file' });
      }
    }
  );

  /**
   * GET /api/media/chat/:sessionId
   * Get all media from a chat session organized by type
   */
  fastify.get<{ Params: { sessionId: string }; Querystring: { cursor?: string; limit?: string } }>(
    '/api/media/chat/:sessionId',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { sessionId } = request.params;
        const { cursor, limit = '50' } = request.query;
        const limitNum = Math.min(parseInt(limit) || 50, 100);

        // Verify session exists and agent has access
        const session = await ChatSession.findOne({ sessionId }).lean();
        if (!session) {
          return reply.status(404).send({ ok: false, error: 'Session not found' });
        }

        // Build query for media messages
        const mediaTypes = ['image', 'video', 'audio', 'voice', 'file', 'document', 'sticker'];
        const query: any = {
          session: session._id,
          messageType: { $in: mediaTypes },
          isDeleted: { $ne: true }
        };

        // Cursor pagination
        if (cursor) {
          query._id = { $lt: cursor };
        }

        // Fetch media messages
        const messages = await Message.find(query)
          .sort({ createdAt: -1 })
          .limit(limitNum + 1) // +1 to check if there are more
          .select('_id messageType media mediaUrl content sender senderName createdAt metadata')
          .lean();

        const hasMore = messages.length > limitNum;
        const items = hasMore ? messages.slice(0, -1) : messages;

        // Organize by type
        const mediaByType = {
          images: [] as any[],
          videos: [] as any[],
          audios: [] as any[],
          files: [] as any[],
          stickers: [] as any[]
        };

        for (const msg of items) {
          const mediaItem = {
            id: msg._id.toString(),
            type: msg.messageType,
            url: msg.media?.url || msg.mediaUrl || '',
            thumbnailUrl: msg.media?.thumbnailUrl,
            fileName: msg.media?.fileName || msg.content || 'Unknown',
            fileSize: msg.media?.fileSize,
            mimeType: msg.media?.mimeType,
            duration: msg.media?.duration,
            width: msg.media?.width,
            height: msg.media?.height,
            caption: msg.content,
            sender: msg.sender,
            senderName: msg.senderName,
            createdAt: msg.createdAt,
            metadata: msg.metadata
          };

          switch (msg.messageType) {
            case 'image':
              mediaByType.images.push(mediaItem);
              break;
            case 'video':
              mediaByType.videos.push(mediaItem);
              break;
            case 'audio':
            case 'voice':
              mediaByType.audios.push(mediaItem);
              break;
            case 'file':
            case 'document':
              mediaByType.files.push(mediaItem);
              break;
            case 'sticker':
              mediaByType.stickers.push(mediaItem);
              break;
          }
        }

        // Get counts for each type
        const counts = await Message.aggregate([
          { $match: { session: session._id, messageType: { $in: mediaTypes }, isDeleted: { $ne: true } } },
          { $group: { _id: '$messageType', count: { $sum: 1 } } }
        ]);

        const countsMap: Record<string, number> = {};
        for (const c of counts) {
          countsMap[c._id] = c.count;
        }

        return reply.send({
          ok: true,
          media: mediaByType,
          counts: {
            images: countsMap['image'] || 0,
            videos: countsMap['video'] || 0,
            audios: (countsMap['audio'] || 0) + (countsMap['voice'] || 0),
            files: (countsMap['file'] || 0) + (countsMap['document'] || 0),
            stickers: countsMap['sticker'] || 0,
            total: Object.values(countsMap).reduce((a, b) => a + b, 0)
          },
          hasMore,
          nextCursor: hasMore ? items[items.length - 1]._id.toString() : null
        });

      } catch (error) {
        console.error('Chat media error:', error);
        return reply.status(500).send({ ok: false, error: 'Failed to get chat media' });
      }
    }
  );
}

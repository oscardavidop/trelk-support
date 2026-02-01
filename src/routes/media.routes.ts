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
import { getFile } from '../services/telegram.js';
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
          localPath= './uploads/notfound.jpg'
          // return reply.status(403).send({ ok: false, error: 'Access denied' });
        }

        // Check if file exists
        if (!fs.existsSync(localPath)) {
          console.error('File does not exist:', localPath);
          return reply.status(404).send({ ok: false, error: 'File not found on disk' });
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
}

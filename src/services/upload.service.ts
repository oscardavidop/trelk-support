/**
 * Upload Service
 * Handles file uploads for images, documents, and audio
 */

import { mkdir, writeFile, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { logger } from './logger.js';

// ============= CONFIGURATION =============

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_AUDIO_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

const ALLOWED_AUDIO_TYPES = [
  'audio/ogg',
  'audio/webm',
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/opus',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
];

const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

// ============= TYPES =============

export interface UploadResult {
  ok: boolean;
  url?: string;
  filename?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  error?: string;
}

export interface UploadOptions {
  maxSize?: number;
  allowedTypes?: string[];
  subfolder?: string;
}

// ============= HELPER FUNCTIONS =============

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(subfolder: string): Promise<string> {
  const dir = join(UPLOAD_DIR, subfolder);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

/**
 * Generate unique filename
 */
function generateFilename(originalName: string): string {
  const ext = extname(originalName).toLowerCase();
  const timestamp = Date.now().toString(36);
  const uuid = randomUUID().slice(0, 8);
  return `${timestamp}-${uuid}${ext}`;
}

/**
 * Validate file type
 */
function validateMimeType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType);
}

/**
 * Validate file size
 */
function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

// ============= UPLOAD FUNCTIONS =============

/**
 * Upload an image
 */
export async function uploadImage(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    // Validate type
    if (!validateMimeType(mimeType, ALLOWED_IMAGE_TYPES)) {
      return {
        ok: false,
        error: `Invalid image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
      };
    }

    // Validate size
    if (!validateFileSize(buffer.length, MAX_IMAGE_SIZE)) {
      return {
        ok: false,
        error: `Image too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
      };
    }

    // Ensure directory exists
    const dir = await ensureUploadDir('images');
    
    // Generate filename and save
    const filename = generateFilename(originalName);
    const filepath = join(dir, filename);
    await writeFile(filepath, buffer);

    // Build public URL
    const url = `/uploads/images/${filename}`;

    logger.info('upload', { type: 'image', filename, size: buffer.length });

    return {
      ok: true,
      url,
      filename,
      originalName,
      mimeType,
      size: buffer.length,
    };
  } catch (error) {
    logger.error('upload', { type: 'image', error: String(error) });
    return {
      ok: false,
      error: 'Failed to upload image',
    };
  }
}

/**
 * Upload a file (document)
 */
export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    // Validate type
    if (!validateMimeType(mimeType, ALLOWED_FILE_TYPES)) {
      return {
        ok: false,
        error: `Invalid file type. Allowed: PDF, DOCX, ZIP, XLSX, TXT, CSV`,
      };
    }

    // Validate size
    if (!validateFileSize(buffer.length, MAX_FILE_SIZE)) {
      return {
        ok: false,
        error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    // Ensure directory exists
    const dir = await ensureUploadDir('files');
    
    // Generate filename and save
    const filename = generateFilename(originalName);
    const filepath = join(dir, filename);
    await writeFile(filepath, buffer);

    // Build public URL
    const url = `/uploads/files/${filename}`;

    logger.info('upload', { type: 'file', filename, size: buffer.length, mimeType });

    return {
      ok: true,
      url,
      filename,
      originalName,
      mimeType,
      size: buffer.length,
    };
  } catch (error) {
    logger.error('upload', { type: 'file', error: String(error) });
    return {
      ok: false,
      error: 'Failed to upload file',
    };
  }
}

/**
 * Upload audio
 */
export async function uploadAudio(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    // Validate type (be lenient with audio types from MediaRecorder)
    const isValidAudio = ALLOWED_AUDIO_TYPES.some(type => 
      mimeType.startsWith(type.split('/')[0]) || mimeType.includes('audio')
    );
    
    if (!isValidAudio && !mimeType.includes('audio') && !mimeType.includes('ogg') && !mimeType.includes('webm')) {
      return {
        ok: false,
        error: `Invalid audio type: ${mimeType}`,
      };
    }

    // Validate size
    if (!validateFileSize(buffer.length, MAX_AUDIO_SIZE)) {
      return {
        ok: false,
        error: `Audio too large. Max size: ${MAX_AUDIO_SIZE / 1024 / 1024}MB`,
      };
    }

    // Ensure directory exists
    const dir = await ensureUploadDir('audio');
    
    // Generate filename with proper extension
    let ext = '.ogg';
    if (mimeType.includes('webm')) ext = '.webm';
    else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) ext = '.mp3';
    else if (mimeType.includes('wav')) ext = '.wav';
    
    const baseFilename = originalName.replace(/\.[^.]+$/, '');
    const filename = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}${ext}`;
    const filepath = join(dir, filename);
    await writeFile(filepath, buffer);

    // Build public URL
    const url = `/uploads/audio/${filename}`;

    logger.info('upload', { type: 'audio', filename, size: buffer.length, mimeType });

    return {
      ok: true,
      url,
      filename,
      originalName,
      mimeType,
      size: buffer.length,
    };
  } catch (error) {
    logger.error('upload', { type: 'audio', error: String(error) });
    return {
      ok: false,
      error: 'Failed to upload audio',
    };
  }
}

/**
 * Upload video
 */
export async function uploadVideo(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<UploadResult> {
  try {
    // Validate type
    const isValidVideo = ALLOWED_VIDEO_TYPES.some(type => 
      mimeType === type || mimeType.startsWith('video/')
    );
    
    if (!isValidVideo) {
      return {
        ok: false,
        error: `Invalid video type: ${mimeType}. Allowed: MP4, WebM, MOV, AVI, MKV`,
      };
    }

    // Validate size
    if (!validateFileSize(buffer.length, MAX_VIDEO_SIZE)) {
      return {
        ok: false,
        error: `Video too large. Max size: ${MAX_VIDEO_SIZE / 1024 / 1024}MB`,
      };
    }

    // Ensure directory exists
    const dir = await ensureUploadDir('videos');
    
    // Generate filename
    const filename = generateFilename(originalName);
    const filepath = join(dir, filename);
    await writeFile(filepath, buffer);

    // Build public URL
    const url = `/uploads/videos/${filename}`;

    logger.info('upload', { type: 'video', filename, size: buffer.length, mimeType });

    return {
      ok: true,
      url,
      filename,
      originalName,
      mimeType,
      size: buffer.length,
    };
  } catch (error) {
    logger.error('upload', { type: 'video', error: String(error) });
    return {
      ok: false,
      error: 'Failed to upload video',
    };
  }
}

/**
 * Delete uploaded file
 */
export async function deleteUpload(url: string): Promise<boolean> {
  try {
    const filepath = join(UPLOAD_DIR, url.replace('/uploads/', ''));
    await unlink(filepath);
    return true;
  } catch (error) {
    logger.error('upload', { action: 'delete', error: String(error) });
    return false;
  }
}

/**
 * Get file info
 */
export async function getFileInfo(url: string): Promise<{ size: number; exists: boolean }> {
  try {
    const filepath = join(UPLOAD_DIR, url.replace('/uploads/', ''));
    const stats = await stat(filepath);
    return { size: stats.size, exists: true };
  } catch {
    return { size: 0, exists: false };
  }
}

/**
 * Get absolute path for uploaded file
 */
export function getAbsolutePath(url: string): string {
  return join(process.cwd(), UPLOAD_DIR, url.replace('/uploads/', ''));
}

export const UPLOAD_CONFIG = {
  MAX_IMAGE_SIZE,
  MAX_FILE_SIZE,
  MAX_AUDIO_SIZE,
  MAX_VIDEO_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_FILE_TYPES,
  ALLOWED_AUDIO_TYPES,
  ALLOWED_VIDEO_TYPES,
};

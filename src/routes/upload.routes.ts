/**
 * Upload Routes
 * Handles image, file, and audio uploads for agent messages
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { uploadImage, uploadFile, uploadAudio, UPLOAD_CONFIG, getAbsolutePath } from '../services/upload.service.js';
import { verifyToken } from '../services/auth.service.js';
import { join } from 'path';

// ============= AUTH MIDDLEWARE =============

async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({ ok: false, error: 'Authorization required' });
    return;
  }
  
  const token = authHeader.replace('Bearer ', '');
  const payload = verifyToken(token);
  
  if (!payload) {
    reply.status(401).send({ ok: false, error: 'Invalid or expired token' });
    return;
  }
  
  // Store agent info on request
  (request as any).agent = payload;
}

// ============= REGISTER ROUTES =============

export async function registerUploadRoutes(fastify: FastifyInstance): Promise<void> {
  // Register multipart support for file uploads
  await fastify.register(import('@fastify/multipart'), {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max
    },
  });

  // ============= UPLOAD IMAGE =============
  fastify.post('/api/upload/image', {
    preHandler: [authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await request.file();
        
        if (!data) {
          return reply.status(400).send({ ok: false, error: 'No file uploaded' });
        }

        const buffer = await data.toBuffer();
        const result = await uploadImage(buffer, data.filename, data.mimetype);

        if (!result.ok) {
          return reply.status(400).send(result);
        }

        return reply.send(result);
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ ok: false, error: 'Upload failed' });
      }
    },
  });

  // ============= UPLOAD FILE =============
  fastify.post('/api/upload/file', {
    preHandler: [authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await request.file();
        
        if (!data) {
          return reply.status(400).send({ ok: false, error: 'No file uploaded' });
        }

        const buffer = await data.toBuffer();
        const result = await uploadFile(buffer, data.filename, data.mimetype);

        if (!result.ok) {
          return reply.status(400).send(result);
        }

        return reply.send(result);
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ ok: false, error: 'Upload failed' });
      }
    },
  });

  // ============= UPLOAD AUDIO =============
  fastify.post('/api/upload/audio', {
    preHandler: [authenticate],
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const data = await request.file();
        
        if (!data) {
          return reply.status(400).send({ ok: false, error: 'No file uploaded' });
        }

        const buffer = await data.toBuffer();
        const result = await uploadAudio(buffer, data.filename, data.mimetype);

        if (!result.ok) {
          return reply.status(400).send(result);
        }

        return reply.send(result);
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ ok: false, error: 'Upload failed' });
      }
    },
  });

  // ============= GET UPLOAD CONFIG =============
  fastify.get('/api/upload/config', {
    preHandler: [authenticate],
    handler: async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        ok: true,
        config: {
          maxImageSize: UPLOAD_CONFIG.MAX_IMAGE_SIZE,
          maxFileSize: UPLOAD_CONFIG.MAX_FILE_SIZE,
          maxAudioSize: UPLOAD_CONFIG.MAX_AUDIO_SIZE,
          allowedImageTypes: UPLOAD_CONFIG.ALLOWED_IMAGE_TYPES,
          allowedFileTypes: UPLOAD_CONFIG.ALLOWED_FILE_TYPES,
          allowedAudioTypes: UPLOAD_CONFIG.ALLOWED_AUDIO_TYPES,
        },
      });
    },
  });
}

// ============= STATIC FILES PLUGIN =============

export async function registerStaticUploads(fastify: FastifyInstance): Promise<void> {
  await fastify.register(import('@fastify/static'), {
    root: join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });
}

/**
 * Export Routes - Generate and download exports
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Types } from 'mongoose';
import {
  createExportJob,
  getExportJobStatus,
  trackDownload,
} from '../services/export.service.js';
import { ExportJob, type ExportFormat } from '../database/models/ExportJob.js';
import { authMiddleware, requireRole, can } from '../middleware/auth.js';
import { logAuditFromRequest, AuditActions } from '../services/audit-log.service.js';
import { exportRateLimit } from '../middleware/rate-limit.js';
import { trackExportRequest, logSecurityAnomaly } from '../services/fraud-detection.service.js';
import { ChatSession } from '../database/models/ChatSession.js';
import fs from 'fs';
import path from 'path';

interface SessionParams {
  sessionId: string;
}

interface JobParams {
  jobId: string;
}

interface ExportBody {
  include?: {
    messages?: boolean;
    notes?: boolean;
    systemLogs?: boolean;
    agentActions?: boolean;
    transfers?: boolean;
    ratings?: boolean;
    userInfo?: boolean;
    media?: boolean;
    scheduledMessages?: boolean;
    whispers?: boolean;
    contactHistory?: boolean;
    qaReview?: boolean;
    disposition?: boolean;
  };
  format: string; // validated at runtime; allows 'html' which maps to 'pdf'
  pdfOptions?: {
    includeBranding?: boolean;
    logoUrl?: string;
    companyName?: string;
    headerText?: string;
    footerText?: string;
  };
  advanced?: {
    redactPII?: boolean;
    gdprMode?: boolean;
  };
}

interface BatchExportBody extends ExportBody {
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    agentIds?: string[];
    categories?: string[];
    statuses?: string[];
    tags?: string[];
  };
}

interface PaginationQuery {
  page?: number;
  limit?: number;
  status?: string;
}

export async function exportRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  /**
   * POST /api/exports/session/:sessionId
   * Export a single session — with ownership check & rate limit
   */
  fastify.post<{ Params: SessionParams; Body: ExportBody }>(
    '/session/:sessionId',
    { preHandler: exportRateLimit },
    async (
      request: FastifyRequest<{ Params: SessionParams; Body: ExportBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { sessionId } = request.params;
        const { include, format, pdfOptions, advanced } = request.body;
        const agent = (request as any).agent;

        if (!format || !['pdf', 'json', 'csv', 'xlsx', 'zip', 'html'].includes(format)) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid format. Must be pdf, json, csv, xlsx, zip, or html',
          });
        }

        // IDOR FIX: Verify agent has access to this session
        const session = await ChatSession.findOne({ sessionId }).lean();
        if (!session) {
          return reply.status(404).send({ success: false, error: 'Session not found' });
        }
        
        // Only assigned agent, supervisor, or admin can export
        const isOwner = session.assignedAgent?.toString() === agent._id.toString();
        const isSupervisor = ['admin', 'supervisor'].includes(agent.role);
        if (!isOwner && !isSupervisor) {
          return reply.status(403).send({ success: false, error: 'Not authorized to export this session' });
        }

        // Fraud detection: track export requests
        const fraudCheck = await trackExportRequest(agent._id.toString(), 'session');
        if (fraudCheck.flagged) {
          await logSecurityAnomaly(request, 'mass_export', {
            agentId: agent._id.toString(),
            reason: fraudCheck.reason,
          }, 'high');
          return reply.status(429).send({ success: false, error: 'Export rate limit exceeded' });
        }

        const job = await createExportJob(agent._id, {
          type: 'session',
          sessionId,
          include,
          format: (format === 'html' ? 'pdf' : format) as ExportFormat,
          pdfOptions,
          advanced,
        });

        // Audit log
        await logAuditFromRequest({
          request,
          action: AuditActions.EXPORT_CREATE,
          category: 'export',
          targetType: 'export',
          targetId: job._id.toString(),
          sessionId,
          newValue: { format, sessionId },
          severity: 'low',
        });

        return reply.status(202).send({
          success: true,
          data: {
            jobId: job._id.toString(),
            status: job.status,
            message: 'Export job created. Check status at /api/exports/jobs/:jobId',
          },
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create export',
        });
      }
    }
  );

  /**
   * POST /api/exports/batch
   * Export multiple sessions with filters (supervisor/admin only)
   */
  fastify.post<{ Body: BatchExportBody }>(
    '/batch',
    { preHandler: requireRole(['supervisor', 'admin']) },
    async (request: FastifyRequest<{ Body: BatchExportBody }>, reply: FastifyReply) => {
      try {
        const { filters, include, format, pdfOptions, advanced } = (request.body as any);
        const agent = (request as any).agent;

        if (!format || !['pdf', 'json', 'csv', 'xlsx', 'zip', 'html'].includes(format)) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid format. Must be pdf, json, csv, xlsx, zip, or html',
          });
        }

        // Parse filters
        const parsedFilters: any = {};
        if (filters) {
          if (filters.dateFrom) parsedFilters.dateFrom = new Date(filters.dateFrom);
          if (filters.dateTo) parsedFilters.dateTo = new Date(filters.dateTo);
          if (filters.agentIds?.length) {
            parsedFilters.agentIds = filters.agentIds.map((id: string) => new Types.ObjectId(id));
          }
          if (filters.categories?.length) parsedFilters.categories = filters.categories;
          if (filters.statuses?.length) parsedFilters.statuses = filters.statuses;
          if (filters.tags?.length) parsedFilters.tags = filters.tags;
        }

        const job = await createExportJob(agent._id, {
          type: 'sessions',
          filters: parsedFilters,
          include,
          format: (format === 'html' ? 'pdf' : format) as ExportFormat,
          pdfOptions,
          advanced,
        });

        // Audit log
        await logAuditFromRequest({
          request,
          action: AuditActions.EXPORT_CREATE,
          category: 'export',
          targetType: 'export',
          targetId: job._id.toString(),
          newValue: { format, filters: !!filters },
          severity: 'medium',
        });

        return reply.status(202).send({
          success: true,
          data: {
            jobId: job._id.toString(),
            status: job.status,
            message: 'Batch export job created. Check status at /api/exports/jobs/:jobId',
          },
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create batch export',
        });
      }
    }
  );

  /**
   * GET /api/exports/jobs
   * List export jobs for the current user
   */
  fastify.get<{ Querystring: PaginationQuery }>(
    '/jobs',
    async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply: FastifyReply) => {
      try {
        const agent = (request as any).agent;
        const { page = 1, limit = 20, status } = request.query;
        const skip = (page - 1) * limit;

        const query: Record<string, unknown> = {};

        // Admins/supervisors can see all jobs, others only their own
        if (!['admin', 'supervisor'].includes(agent.role)) {
          query.requestedBy = agent._id;
        }

        if (status) {
          query.status = status;
        }

        const [jobs, total] = await Promise.all([
          ExportJob.find(query)
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('requestedBy', 'name')
            .lean(),
          ExportJob.countDocuments(query),
        ]);

        return {
          success: true,
          data: jobs.map(job => ({
            _id: job._id.toString(),
            id: job._id.toString(),
            type: job.type,
            format: job.format,
            status: job.status,
            progress: job.progress,
            fileSize: job.fileSize,
            recordCount: job.totalItems,
            error: job.error,
            createdAt: job.requestedAt,
            requestedAt: job.requestedAt,
            completedAt: job.completedAt,
            expiresAt: job.expiresAt,
            requestedBy: (job.requestedBy as any)?.name,
            downloadUrl: job.status === 'completed' && job.fileUrl
              ? `/api/exports/jobs/${job._id}/download`
              : undefined,
            filters: job.filters,
            options: {
              includeMessages: job.include.messages,
              includeNotes: job.include.notes,
              includeSystemLogs: job.include.systemLogs,
            }
          })),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get export jobs',
        });
      }
    }
  );

  /**
   * GET /api/exports/jobs/:jobId
   * Get export job status — with ownership check
   */
  fastify.get<{ Params: JobParams }>(
    '/jobs/:jobId',
    async (request: FastifyRequest<{ Params: JobParams }>, reply: FastifyReply) => {
      try {
        const { jobId } = request.params;
        const agent = (request as any).agent;

        const job = await getExportJobStatus(jobId);
        if (!job) {
          return reply.status(404).send({
            success: false,
            error: 'Export job not found',
          });
        }

        // IDOR FIX: Only creator, admin, or supervisor can view job status
        const isCreator = job.requestedBy?.toString() === agent._id.toString();
        const isSupervisor = ['admin', 'supervisor'].includes(agent.role);
        if (!isCreator && !isSupervisor) {
          return reply.status(403).send({ success: false, error: 'Not authorized to view this export job' });
        }

        return {
          success: true,
          data: {
            id: job._id.toString(),
            type: job.type,
            format: job.format,
            status: job.status,
            progress: job.progress,
            currentStep: job.currentStep,
            totalItems: job.totalItems,
            processedItems: job.processedItems,
            fileUrl: job.status === 'completed' ? job.fileUrl : undefined,
            fileSize: job.fileSize,
            error: job.error,
            requestedAt: job.requestedAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            expiresAt: job.expiresAt,
            downloadCount: job.downloadCount,
          },
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get job status',
        });
      }
    }
  );

  /**
   * GET /api/exports/jobs/:jobId/download
   * Download the exported file — with ownership check
   */
  fastify.get<{ Params: JobParams }>(
    '/jobs/:jobId/download',
    async (request: FastifyRequest<{ Params: JobParams }>, reply: FastifyReply) => {
      try {
        const { jobId } = request.params;
        const agent = (request as any).agent;

        // IDOR FIX: Check ownership before allowing download
        const jobRecord = await ExportJob.findById(jobId);
        if (!jobRecord) {
          return reply.status(404).send({ success: false, error: 'Export job not found' });
        }
        const isCreator = jobRecord.requestedBy?.toString() === agent._id.toString();
        const isSupervisor = ['admin', 'supervisor'].includes(agent.role);
        if (!isCreator && !isSupervisor) {
          await logSecurityAnomaly(request, 'unauthorized_export_download', {
            agentId: agent._id.toString(),
            jobId,
            jobOwner: jobRecord.requestedBy?.toString(),
          }, 'high');
          return reply.status(403).send({ success: false, error: 'Not authorized to download this export' });
        }

        const filePath = await trackDownload(jobId);
        if (!filePath) {
          return reply.status(404).send({
            success: false,
            error: 'Export file not found or expired',
          });
        }

        // Audit log
        await logAuditFromRequest({
          request,
          action: AuditActions.EXPORT_DOWNLOAD,
          category: 'export',
          targetType: 'export',
          targetId: jobId,
          severity: 'low',
        });

        // Get file info
        const job = await ExportJob.findById(jobId);
        const fileName = job?.fileName || path.basename(filePath);

        // Set content type based on format
        let contentType = 'application/octet-stream';
        if (fileName.endsWith('.json')) contentType = 'application/json';
        else if (fileName.endsWith('.csv')) contentType = 'text/csv';
        else if (fileName.endsWith('.pdf')) contentType = 'application/pdf';
        else if (fileName.endsWith('.html')) contentType = 'text/html';
        else if (fileName.endsWith('.xlsx')) contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (fileName.endsWith('.zip')) contentType = 'application/zip';

        reply.header('Content-Type', contentType);
        reply.header('Content-Disposition', `attachment; filename="${fileName}"`);

        const stream = fs.createReadStream(filePath);
        return reply.send(stream);
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to download export',
        });
      }
    }
  );

  /**
   * DELETE /api/exports/jobs/:jobId
   * Cancel or delete an export job
   */
  fastify.delete<{ Params: JobParams }>(
    '/jobs/:jobId',
    async (request: FastifyRequest<{ Params: JobParams }>, reply: FastifyReply) => {
      try {
        const { jobId } = request.params;
        const agent = (request as any).agent;

        const job = await ExportJob.findById(jobId);
        if (!job) {
          return reply.status(404).send({
            success: false,
            error: 'Export job not found',
          });
        }

        // Only creator or admin can delete
        if (job.requestedBy.toString() !== agent._id.toString() && agent.role !== 'admin') {
          return reply.status(403).send({
            success: false,
            error: 'Not authorized to delete this export',
          });
        }

        // Delete file if exists
        if (job.fileName) {
          const filePath = path.join(process.cwd(), 'exports', job.fileName);
          try {
            await fs.promises.unlink(filePath);
          } catch {
            // File might not exist
          }
        }

        await ExportJob.findByIdAndDelete(jobId);

        return { success: true, message: 'Export job deleted' };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete export job',
        });
      }
    }
  );
}

export default exportRoutes;

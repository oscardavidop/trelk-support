/**
 * ExportJob Model - Async export job tracking
 * Handles PDF, JSON, and CSV exports for sessions and analytics
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type ExportType = 'session' | 'sessions' | 'analytics' | 'audit';
export type ExportFormat = 'pdf' | 'json' | 'csv';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IExportFilters {
  dateFrom?: Date;
  dateTo?: Date;
  agentIds?: Types.ObjectId[];
  categories?: string[];
  statuses?: string[];
  userIds?: Types.ObjectId[];
  tags?: string[];
}

export interface IExportInclude {
  messages: boolean;
  notes: boolean;
  systemLogs: boolean;
  agentActions: boolean;
  transfers: boolean;
  ratings: boolean;
  userInfo: boolean;
}

export interface IPdfOptions {
  includeBranding?: boolean;
  logoUrl?: string;
  companyName?: string;
  headerText?: string;
  footerText?: string;
  pageSize?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
}

export interface IExportJob extends Document {
  _id: Types.ObjectId;
  
  // What to export
  type: ExportType;
  
  // For single session
  sessionId?: string;
  
  // For multiple sessions
  filters?: IExportFilters;
  
  // What to include
  include: IExportInclude;
  
  // Output format
  format: ExportFormat;
  
  // PDF options
  pdfOptions?: IPdfOptions;
  
  // Status tracking
  status: ExportStatus;
  progress: number;                 // 0-100
  currentStep?: string;
  totalItems?: number;
  processedItems?: number;
  
  // Result
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  checksum?: string;
  
  // Error handling
  error?: string;
  errorDetails?: Record<string, unknown>;
  
  // Timing
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;                 // Auto-delete file after this
  
  // Audit
  requestedBy: Types.ObjectId;
  downloadCount: number;
  lastDownloadAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const ExportJobSchema = new Schema<IExportJob>(
  {
    type: {
      type: String,
      enum: ['session', 'sessions', 'analytics', 'audit'],
      required: true,
    },
    sessionId: String,
    filters: {
      dateFrom: Date,
      dateTo: Date,
      agentIds: [{ type: Schema.Types.ObjectId, ref: 'Agent' }],
      categories: [String],
      statuses: [String],
      userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      tags: [String],
    },
    include: {
      messages: { type: Boolean, default: true },
      notes: { type: Boolean, default: true },
      systemLogs: { type: Boolean, default: false },
      agentActions: { type: Boolean, default: false },
      transfers: { type: Boolean, default: true },
      ratings: { type: Boolean, default: true },
      userInfo: { type: Boolean, default: true },
    },
    format: {
      type: String,
      enum: ['pdf', 'json', 'csv'],
      required: true,
    },
    pdfOptions: {
      includeBranding: { type: Boolean, default: true },
      logoUrl: String,
      companyName: String,
      headerText: String,
      footerText: String,
      pageSize: { type: String, enum: ['A4', 'Letter'], default: 'A4' },
      orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currentStep: String,
    totalItems: Number,
    processedItems: Number,
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    checksum: String,
    error: String,
    errorDetails: Schema.Types.Mixed,
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    startedAt: Date,
    completedAt: Date,
    expiresAt: {
      type: Date,
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    lastDownloadAt: Date,
  },
  {
    timestamps: true,
  }
);

// Index for finding pending jobs
ExportJobSchema.index({ status: 1, requestedAt: 1 });

// TTL index for expired files cleanup
ExportJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const ExportJob = mongoose.model<IExportJob>('ExportJob', ExportJobSchema);

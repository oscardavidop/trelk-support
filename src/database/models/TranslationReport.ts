/**
 * Translation Report Model
 * Stores reports submitted by agents for incorrect/bad translations.
 * Used for QA review, provider quality tracking, and cost optimization.
 */

import mongoose, { Schema, type Document, type Types } from 'mongoose';

// ─── TYPES ──────────────────────────────────────────────────

export type ReportCategory = 'wrong_translation' | 'wrong_language' | 'offensive' | 'incomplete' | 'improvement' | 'bug' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface ITranslationReport extends Document {
  messageId: Types.ObjectId;
  sessionId: string;
  reportedBy: Types.ObjectId;          // Agent who reported
  reportedByName: string;               // Denormalized for fast display
  category: ReportCategory;
  reason: string;                        // Free-text reason from agent
  // Translation details snapshot
  originalContent: string;
  translatedContent: string;
  sourceLang: string;
  targetLang: string;
  provider: string;
  direction: 'incoming' | 'outgoing';
  latencyMs?: number;
  // Review
  status: ReportStatus;
  reviewedBy?: Types.ObjectId;
  reviewedByName?: string;
  reviewNote?: string;
  reviewedAt?: Date;
  // Block flag
  reporterBlocked: boolean;             // Block this agent from submitting more reports
  blockedBy?: Types.ObjectId;
  blockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── SCHEMA ─────────────────────────────────────────────────

const TranslationReportSchema = new Schema<ITranslationReport>({
  messageId: { type: Schema.Types.ObjectId, ref: 'Message', required: true, index: true },
  sessionId: { type: String, required: true, index: true },
  reportedBy: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  reportedByName: { type: String, required: true },
  category: {
    type: String,
    enum: ['wrong_translation', 'wrong_language', 'offensive', 'incomplete', 'improvement', 'bug', 'other'],
    required: true,
    index: true,
  },
  reason: { type: String, required: true, maxlength: 2000 },
  // Snapshot
  originalContent: { type: String, required: true, maxlength: 10000 },
  translatedContent: { type: String, required: true, maxlength: 10000 },
  sourceLang: { type: String, required: true },
  targetLang: { type: String, required: true },
  provider: { type: String, required: true },
  direction: { type: String, enum: ['incoming', 'outgoing'], default: 'incoming' },
  latencyMs: { type: Number },
  // Review
  status: { type: String, enum: ['pending', 'reviewed', 'resolved', 'dismissed'], default: 'pending', index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
  reviewedByName: { type: String },
  reviewNote: { type: String, maxlength: 2000 },
  reviewedAt: { type: Date },
  // Block
  reporterBlocked: { type: Boolean, default: false },
  blockedBy: { type: Schema.Types.ObjectId, ref: 'Agent' },
  blockedAt: { type: Date },
}, {
  timestamps: true,
  collection: 'translation_reports',
});

// Compound indexes
TranslationReportSchema.index({ status: 1, createdAt: -1 });
TranslationReportSchema.index({ reportedBy: 1, createdAt: -1 });
TranslationReportSchema.index({ provider: 1, createdAt: -1 });

export const TranslationReport = mongoose.model<ITranslationReport>('TranslationReport', TranslationReportSchema);

// ─── HELPERS ────────────────────────────────────────────────

export async function createTranslationReport(data: Partial<ITranslationReport>): Promise<ITranslationReport> {
  return TranslationReport.create(data);
}

export async function getTranslationReports(opts: {
  status?: ReportStatus;
  category?: ReportCategory;
  reportedBy?: string;
  provider?: string;
  page?: number;
  limit?: number;
}) {
  const { status, category, reportedBy, provider, page = 1, limit = 20 } = opts;
  const filter: Record<string, unknown> = {};

  if (status) filter.status = status;
  if (category) filter.category = category;
  if (reportedBy) filter.reportedBy = new mongoose.Types.ObjectId(reportedBy);
  if (provider) filter.provider = provider;

  const [reports, total] = await Promise.all([
    TranslationReport.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('reportedBy', 'name email avatar')
      .populate('reviewedBy', 'name email')
      .lean(),
    TranslationReport.countDocuments(filter),
  ]);

  return { reports, total, page, pages: Math.ceil(total / limit) };
}

export async function updateReportStatus(
  reportId: string,
  data: { status: ReportStatus; reviewNote?: string; reviewedBy: string; reviewedByName: string },
): Promise<any> {
  return TranslationReport.findByIdAndUpdate(reportId, {
    $set: {
      status: data.status,
      reviewNote: data.reviewNote,
      reviewedBy: new mongoose.Types.ObjectId(data.reviewedBy),
      reviewedByName: data.reviewedByName,
      reviewedAt: new Date(),
    },
  }, { new: true }).lean();
}

export async function blockReporter(
  reportedBy: string,
  blockedBy: string,
): Promise<void> {
  await TranslationReport.updateMany(
    { reportedBy: new mongoose.Types.ObjectId(reportedBy) },
    { $set: { reporterBlocked: true, blockedBy: new mongoose.Types.ObjectId(blockedBy), blockedAt: new Date() } },
  );
}

export async function unblockReporter(reportedBy: string): Promise<void> {
  await TranslationReport.updateMany(
    { reportedBy: new mongoose.Types.ObjectId(reportedBy) },
    { $set: { reporterBlocked: false }, $unset: { blockedBy: 1, blockedAt: 1 } },
  );
}

export async function isReporterBlocked(agentId: string): Promise<boolean> {
  const doc = await TranslationReport.findOne({
    reportedBy: new mongoose.Types.ObjectId(agentId),
    reporterBlocked: true,
  }).lean();
  return !!doc;
}

export async function getReportStats() {
  const [byStatus, byCategory, byProvider, topReporters] = await Promise.all([
    TranslationReport.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    TranslationReport.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
    TranslationReport.aggregate([
      { $group: { _id: '$provider', count: { $sum: 1 } } },
    ]),
    TranslationReport.aggregate([
      { $group: { _id: '$reportedBy', name: { $first: '$reportedByName' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  return { byStatus, byCategory, byProvider, topReporters };
}

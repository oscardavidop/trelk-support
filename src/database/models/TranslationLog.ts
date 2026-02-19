/**
 * Translation Audit Log Model
 * Logs every translation request for auditing and analytics
 */

import mongoose, { Schema, type Document } from 'mongoose';
import type { TranslationProvider } from './TranslationSettings.js';

// ─── TYPES ──────────────────────────────────────────────────

export interface ITranslationLog extends Document {
  agentId: mongoose.Types.ObjectId;
  sessionId?: string;
  messageId?: string;
  provider: TranslationProvider;
  sourceLang: string;
  targetLang: string;
  detectedLang?: string;
  sourceText: string;
  translatedText: string;
  characterCount: number;
  cached: boolean;
  latencyMs: number;
  direction: 'incoming' | 'outgoing' | 'manual';  // incoming = user msg, outgoing = agent msg, manual = context menu
  error?: string;
  createdAt: Date;
}

// ─── SCHEMA ─────────────────────────────────────────────────

const TranslationLogSchema = new Schema<ITranslationLog>({
  agentId: { type: Schema.Types.ObjectId, ref: 'Agent', required: true, index: true },
  sessionId: { type: String, index: true },
  messageId: { type: String },
  provider: { type: String, enum: ['free', 'deepl', 'google', 'azure'], required: true },
  sourceLang: { type: String, required: true },
  targetLang: { type: String, required: true },
  detectedLang: { type: String },
  sourceText: { type: String, required: true, maxlength: 10000 },
  translatedText: { type: String, required: true, maxlength: 10000 },
  characterCount: { type: Number, required: true },
  cached: { type: Boolean, default: false },
  latencyMs: { type: Number, default: 0 },
  direction: { type: String, enum: ['incoming', 'outgoing', 'manual'], default: 'manual' },
  error: { type: String },
}, {
  timestamps: { createdAt: true, updatedAt: false },
  collection: 'translation_logs',
});

// TTL index: auto-delete logs after 90 days
TranslationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound indexes for analytics
TranslationLogSchema.index({ agentId: 1, createdAt: -1 });
TranslationLogSchema.index({ provider: 1, createdAt: -1 });

export const TranslationLog = mongoose.model<ITranslationLog>('TranslationLog', TranslationLogSchema);

/**
 * Log a translation request
 */
export async function logTranslation(data: Partial<ITranslationLog>): Promise<ITranslationLog> {
  return TranslationLog.create(data);
}

/**
 * Get translation logs with pagination and filters
 */
export async function getTranslationLogs(opts: {
  agentId?: string;
  sessionId?: string;
  provider?: string;
  page?: number;
  limit?: number;
}) {
  const { agentId, sessionId, provider, page = 1, limit = 50 } = opts;
  const filter: Record<string, unknown> = {};
  
  if (agentId) filter.agentId = new mongoose.Types.ObjectId(agentId);
  if (sessionId) filter.sessionId = sessionId;
  if (provider) filter.provider = provider;

  const [logs, total] = await Promise.all([
    TranslationLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('agentId', 'name email')
      .lean(),
    TranslationLog.countDocuments(filter),
  ]);

  return { logs, total, page, pages: Math.ceil(total / limit) };
}

/**
 * Get translation usage stats  
 */
export async function getTranslationStats(days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totalStats, byProvider, byAgent] = await Promise.all([
    TranslationLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: null,
          totalTranslations: { $sum: 1 },
          totalCharacters: { $sum: '$characterCount' },
          cachedHits: { $sum: { $cond: ['$cached', 1, 0] } },
          avgLatency: { $avg: '$latencyMs' },
        },
      },
    ]),
    TranslationLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
          chars: { $sum: '$characterCount' },
        },
      },
    ]),
    TranslationLog.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: '$agentId',
          count: { $sum: 1 },
          chars: { $sum: '$characterCount' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'agents',
          localField: '_id',
          foreignField: '_id',
          as: 'agent',
        },
      },
      { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          agentName: '$agent.name',
          count: 1,
          chars: 1,
        },
      },
    ]),
  ]);

  return {
    ...(totalStats[0] || { totalTranslations: 0, totalCharacters: 0, cachedHits: 0, avgLatency: 0 }),
    byProvider,
    byAgent,
  };
}

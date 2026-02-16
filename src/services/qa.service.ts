/**
 * QA & Coaching Service
 * Business logic for quality assurance evaluations, scoring, and analytics.
 */

import mongoose, { Types } from 'mongoose';
import {
  QACheckItem,
  QASettings,
  QAReview,
  ChatSession,
  type IQACheckItem,
  type IQASettings,
  type IQAReview,
  type IQACheckEval,
  type QACheckResult,
  type CoachingStatus,
  type CoachingTag,
  type IQAEditLog,
} from '../database/index.js';

// ─── QA Checklist Config CRUD ──────────────────────────────────────────

export async function getActiveChecklist() {
  return QACheckItem.find({ isActive: true }).sort({ order: 1, createdAt: 1 }).lean();
}

export async function getAllChecklistItems() {
  return QACheckItem.find().sort({ order: 1, createdAt: 1 }).lean();
}

export async function createChecklistItem(
  data: { name: string; description?: string; category?: string; weight: number; order?: number },
  agentId: string
): Promise<IQACheckItem> {
  const item = new QACheckItem({
    ...data,
    createdBy: new Types.ObjectId(agentId),
  });
  return item.save();
}

export async function updateChecklistItem(
  itemId: string,
  data: Partial<{ name: string; description: string; category: string; weight: number; isActive: boolean; order: number }>,
  agentId: string
): Promise<IQACheckItem | null> {
  return QACheckItem.findByIdAndUpdate(
    itemId,
    { ...data, updatedBy: new Types.ObjectId(agentId) },
    { new: true, runValidators: true }
  );
}

export async function deleteChecklistItem(itemId: string): Promise<boolean> {
  const result = await QACheckItem.findByIdAndDelete(itemId);
  return !!result;
}

export async function reorderChecklist(
  items: { id: string; order: number }[]
): Promise<void> {
  const bulkOps = items.map((item) => ({
    updateOne: {
      filter: { _id: new Types.ObjectId(item.id) },
      update: { $set: { order: item.order } },
    },
  }));
  if (bulkOps.length > 0) {
    await QACheckItem.bulkWrite(bulkOps);
  }
}

// ─── QA Settings (singleton) ──────────────────────────────────────────

export async function getQASettings() {
  let settings = await QASettings.findOne().lean();
  if (!settings) {
    const doc = new QASettings({});
    settings = (await doc.save()).toObject() as any;
  }
  return settings;
}

export async function updateQASettings(
  data: Partial<{ lowScoreThreshold: number; coachingEnabled: boolean; autoFlagThreshold: number; rollingWindowDays: number }>,
  agentId: string
): Promise<IQASettings> {
  const settings = await QASettings.findOneAndUpdate(
    {},
    { ...data, updatedBy: new Types.ObjectId(agentId) },
    { new: true, upsert: true, runValidators: true }
  );
  return settings as IQASettings;
}

// ─── Score Calculation ────────────────────────────────────────────────

function resultToScore(result: QACheckResult): number {
  switch (result) {
    case 'yes':
      return 100;
    case 'partial':
      return 50;
    case 'no':
      return 0;
    case 'na':
      return -1; // excluded
  }
}

export function calculateTotalScore(checks: { weight: number; result: QACheckResult }[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const check of checks) {
    const score = resultToScore(check.result);
    if (score < 0) continue; // skip N/A
    totalWeight += check.weight;
    weightedSum += (score / 100) * check.weight;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100);
}

// ─── QA Review CRUD ───────────────────────────────────────────────────

export async function createReview(data: {
  sessionId: string;
  sessionObjectId: string;
  agentId: string;
  reviewedBy: string;
  checks: { checkItemId: string; checkName: string; checkCategory: string; weight: number; result: QACheckResult; note?: string }[];
  comment?: string;
  status?: 'draft' | 'completed';
}): Promise<IQAReview> {
  const checks: IQACheckEval[] = data.checks.map((c) => ({
    checkItemId: new Types.ObjectId(c.checkItemId) as any,
    checkName: c.checkName,
    checkCategory: c.checkCategory,
    weight: c.weight,
    result: c.result,
    score: Math.max(0, resultToScore(c.result)),
    note: c.note,
  }));

  const totalScore = calculateTotalScore(data.checks);

  const review = new QAReview({
    sessionId: data.sessionId,
    session: new Types.ObjectId(data.sessionObjectId),
    agentId: new Types.ObjectId(data.agentId),
    reviewedBy: new Types.ObjectId(data.reviewedBy),
    checks,
    totalScore,
    comment: data.comment || '',
    status: data.status || 'completed',
    coaching: totalScore < 60 ? 'pending' : 'none',
    coachingTags: [],
    trainingRecommendations: [],
    editHistory: [],
  });

  const saved = await review.save();

  // Check escalation rule after review creation
  if (totalScore < 70) {
    await checkEscalationRule(data.agentId);
  }

  return saved;
}

export async function updateReview(
  reviewId: string,
  data: {
    checks?: { checkItemId: string; checkName: string; checkCategory: string; weight: number; result: QACheckResult; note?: string }[];
    comment?: string;
    status?: 'draft' | 'completed';
  }
): Promise<IQAReview | null> {
  const update: Record<string, unknown> = {};
  if (data.comment !== undefined) update.comment = data.comment;
  if (data.status !== undefined) update.status = data.status;

  if (data.checks) {
    update.checks = data.checks.map((c) => ({
      checkItemId: new Types.ObjectId(c.checkItemId),
      checkName: c.checkName,
      checkCategory: c.checkCategory,
      weight: c.weight,
      result: c.result,
      score: Math.max(0, resultToScore(c.result)),
      note: c.note,
    }));
    update.totalScore = calculateTotalScore(data.checks);
  }

  return QAReview.findByIdAndUpdate(reviewId, update, { new: true, runValidators: true });
}

export async function getReviewBySession(sessionId: string) {
  return QAReview.findOne({ sessionId })
    .populate('agentId', 'name email avatar')
    .populate('reviewedBy', 'name email avatar')
    .populate('coachingBy', 'name email avatar')
    .lean();
}

export async function getReviewsByAgent(
  agentId: string,
  options: { limit?: number; skip?: number; status?: string } = {}
): Promise<{ reviews: any[]; total: number }> {
  const filter: Record<string, unknown> = { agentId: new Types.ObjectId(agentId), status: 'completed' };
  if (options.status) filter.status = options.status;

  const [reviews, total] = await Promise.all([
    QAReview.find(filter)
      .sort({ createdAt: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 20)
      .populate('reviewedBy', 'name avatar')
      .populate('session', 'sessionId channel closedAt')
      .lean(),
    QAReview.countDocuments(filter),
  ]);

  return { reviews, total };
}

// ─── Coaching Workflow ────────────────────────────────────────────────

export async function updateCoachingStatus(
  reviewId: string,
  coaching: CoachingStatus,
  data?: { coachingNotes?: string; coachingBy?: string; coachingScheduledAt?: Date }
): Promise<IQAReview | null> {
  const update: Record<string, unknown> = { coaching };
  if (data?.coachingNotes) update.coachingNotes = data.coachingNotes;
  if (data?.coachingBy) update.coachingBy = new Types.ObjectId(data.coachingBy);
  if (data?.coachingScheduledAt) update.coachingScheduledAt = data.coachingScheduledAt;
  if (coaching === 'completed') update.coachingCompletedAt = new Date();

  return QAReview.findByIdAndUpdate(reviewId, update, { new: true });
}

export async function acknowledgeReview(
  reviewId: string,
  agentFeedback?: string
): Promise<IQAReview | null> {
  return QAReview.findByIdAndUpdate(
    reviewId,
    {
      agentAcknowledged: true,
      agentAcknowledgedAt: new Date(),
      requiresReack: false,
      ...(agentFeedback ? { agentFeedback } : {}),
    },
    { new: true }
  );
}

// ─── Analytics ────────────────────────────────────────────────────────

export interface AgentQAStats {
  agentId: string;
  agentName: string;
  agentAvatar?: string;
  reviewCount: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
  pendingCoaching: number;
}

export async function getAgentStats(
  agentId: string,
  days: number = 30
): Promise<{ avgScore: number; reviewCount: number; trend: number[]; byCategory: Record<string, number> }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const reviews = await QAReview.find({
    agentId: new Types.ObjectId(agentId),
    status: 'completed',
    createdAt: { $gte: since },
  })
    .sort({ createdAt: 1 })
    .lean();

  const trend = reviews.map((r) => r.totalScore);
  const avgScore = trend.length > 0 ? Math.round(trend.reduce((a, b) => a + b, 0) / trend.length) : 0;

  // Aggregate by check category
  const categoryScores: Record<string, { total: number; count: number }> = {};
  for (const review of reviews) {
    for (const check of review.checks) {
      if (check.result === 'na') continue;
      if (!categoryScores[check.checkCategory]) categoryScores[check.checkCategory] = { total: 0, count: 0 };
      categoryScores[check.checkCategory].total += check.score;
      categoryScores[check.checkCategory].count += 1;
    }
  }
  const byCategory: Record<string, number> = {};
  for (const [cat, vals] of Object.entries(categoryScores)) {
    byCategory[cat] = vals.count > 0 ? Math.round(vals.total / vals.count) : 0;
  }

  return { avgScore, reviewCount: reviews.length, trend, byCategory };
}

export async function getTeamAnalytics(days: number = 30): Promise<{
  agents: AgentQAStats[];
  globalAvg: number;
  totalReviews: number;
  mostFailedChecks: { checkName: string; failRate: number; count: number }[];
  scoreBrackets: { bracket: string; count: number }[];
}> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Per-agent stats
  const agentAgg = await QAReview.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: since } } },
    {
      $group: {
        _id: '$agentId',
        reviewCount: { $sum: 1 },
        avgScore: { $avg: '$totalScore' },
        minScore: { $min: '$totalScore' },
        maxScore: { $max: '$totalScore' },
        pendingCoaching: { $sum: { $cond: [{ $eq: ['$coaching', 'pending'] }, 1, 0] } },
      },
    },
    { $sort: { avgScore: -1 } },
  ]);

  // Lookup agent names
  const Agent = mongoose.model('Agent');
  const agentIds = agentAgg.map((a) => a._id);
  const agents = await Agent.find({ _id: { $in: agentIds } }).select('name avatar').lean();
  const agentMap = new Map(agents.map((a: any) => [a._id.toString(), a]));

  const agentStats: AgentQAStats[] = agentAgg.map((a) => {
    const agent = agentMap.get(a._id.toString());
    return {
      agentId: a._id.toString(),
      agentName: agent?.name || 'Unknown',
      agentAvatar: agent?.avatar,
      reviewCount: a.reviewCount,
      avgScore: Math.round(a.avgScore),
      minScore: a.minScore,
      maxScore: a.maxScore,
      pendingCoaching: a.pendingCoaching,
    };
  });

  // Global average
  const globalAgg = await QAReview.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: since } } },
    { $group: { _id: null, avg: { $avg: '$totalScore' }, count: { $sum: 1 } } },
  ]);
  const globalAvg = globalAgg[0] ? Math.round(globalAgg[0].avg) : 0;
  const totalReviews = globalAgg[0]?.count || 0;

  // Most failed checks — unwind checks and find highest failure rate
  const checkAgg = await QAReview.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: since } } },
    { $unwind: '$checks' },
    { $match: { 'checks.result': { $ne: 'na' } } },
    {
      $group: {
        _id: '$checks.checkName',
        total: { $sum: 1 },
        failures: { $sum: { $cond: [{ $eq: ['$checks.result', 'no'] }, 1, 0] } },
      },
    },
    { $addFields: { failRate: { $cond: [{ $gt: ['$total', 0] }, { $divide: ['$failures', '$total'] }, 0] } } },
    { $sort: { failRate: -1 } },
    { $limit: 10 },
  ]);

  const mostFailedChecks = checkAgg.map((c) => ({
    checkName: c._id,
    failRate: Math.round(c.failRate * 100),
    count: c.failures,
  }));

  // Score distribution brackets
  const bracketAgg = await QAReview.aggregate([
    { $match: { status: 'completed', createdAt: { $gte: since } } },
    {
      $bucket: {
        groupBy: '$totalScore',
        boundaries: [0, 40, 60, 70, 80, 90, 101],
        default: 'other',
        output: { count: { $sum: 1 } },
      },
    },
  ]);
  const bracketLabels: Record<number | string, string> = { 0: '0-39', 40: '40-59', 60: '60-69', 70: '70-79', 80: '80-89', 90: '90-100', other: 'N/A' };
  const scoreBrackets = bracketAgg.map((b) => ({
    bracket: bracketLabels[b._id] || `${b._id}`,
    count: b.count,
  }));

  return { agents: agentStats, globalAvg, totalReviews, mostFailedChecks, scoreBrackets };
}

// ─── Pending Reviews (for supervisors) ────────────────────────────────

export async function getPendingCoachingSessions(
  options: { limit?: number; skip?: number } = {}
): Promise<{ reviews: any[]; total: number }> {
  const filter = { coaching: { $in: ['pending', 'scheduled'] }, status: 'completed' };
  const [reviews, total] = await Promise.all([
    QAReview.find(filter)
      .sort({ createdAt: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 20)
      .populate('agentId', 'name avatar email')
      .populate('reviewedBy', 'name avatar')
      .populate('session', 'sessionId channel closedAt')
      .lean(),
    QAReview.countDocuments(filter),
  ]);
  return { reviews, total };
}

/**
 * Get recently closed sessions that don't have a QA review yet.
 * These are "pending evaluation" — they need a QA review before coaching can begin.
 */
export async function getSessionsPendingReview(
  options: { limit?: number; skip?: number; days?: number } = {}
): Promise<{ sessions: any[]; total: number }> {
  const daysCutoff = options.days || 7;
  const since = new Date(Date.now() - daysCutoff * 24 * 60 * 60 * 1000);

  // Get all sessionIds that already have a review
  const reviewedSessionIds = await QAReview.distinct('sessionId', {
    createdAt: { $gte: since },
  });

  // Find closed sessions without a review
  const filter = {
    status: 'closed',
    closedAt: { $gte: since },
    sessionId: { $nin: reviewedSessionIds.map((id: any) => id.toString()) },
    // Exclude bot-only sessions (those that never reached a human agent)
    assignedAgent: { $ne: null },
  };

  const [sessions, total] = await Promise.all([
    ChatSession.find(filter)
      .sort({ closedAt: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 20)
      .populate('assignedAgent', 'name avatar email')
      .select('sessionId channel closedAt assignedAgent customerName lastMessage createdAt status')
      .lean(),
    ChatSession.countDocuments(filter),
  ]);

  return { sessions, total };
}

// ─── Agent-facing: Pending reviews that need acknowledgement ──────────

export async function getUnacknowledgedReviewsForAgent(
  agentId: string
): Promise<any[]> {
  const reviews = await QAReview.find({
    agentId: new Types.ObjectId(agentId),
    status: 'completed',
    $or: [
      { agentAcknowledged: false },
      { requiresReack: true },
    ],
  })
    .sort({ createdAt: -1 })
    .populate('reviewedBy', 'name avatar email')
    .populate('session', 'sessionId channel closedAt')
    .lean();
  return reviews;
}

// ─── Edit Review with Audit Log ───────────────────────────────────────

export async function editReviewWithAudit(
  reviewId: string,
  editorId: string,
  editReason: string,
  data: {
    checks?: { checkItemId: string; checkName: string; checkCategory: string; weight: number; result: QACheckResult; note?: string }[];
    comment?: string;
    coachingTags?: string[];
    trainingRecommendations?: string[];
  }
): Promise<IQAReview | null> {
  const existing = await QAReview.findById(reviewId);
  if (!existing) return null;

  const previousScore = existing.totalScore;
  const update: Record<string, unknown> = {};

  if (data.comment !== undefined) update.comment = data.comment;
  if (data.coachingTags) update.coachingTags = data.coachingTags;
  if (data.trainingRecommendations) update.trainingRecommendations = data.trainingRecommendations;

  if (data.checks) {
    update.checks = data.checks.map((c) => ({
      checkItemId: new Types.ObjectId(c.checkItemId),
      checkName: c.checkName,
      checkCategory: c.checkCategory,
      weight: c.weight,
      result: c.result,
      score: Math.max(0, resultToScore(c.result)),
      note: c.note,
    }));
    update.totalScore = calculateTotalScore(data.checks);
  }

  const newScore = (update.totalScore as number) ?? previousScore;

  const auditEntry = {
    editedAt: new Date(),
    editedBy: new Types.ObjectId(editorId),
    editReason,
    previousScore,
    newScore,
  };

  const requiresReack = existing.agentAcknowledged;

  const updated = await QAReview.findByIdAndUpdate(
    reviewId,
    {
      ...update,
      $push: { editHistory: auditEntry },
      ...(requiresReack ? { requiresReack: true, agentAcknowledged: false } : {}),
    },
    { new: true, runValidators: true }
  );

  return updated;
}

// ─── Escalation Check ─────────────────────────────────────────────────

export async function checkEscalationRule(agentId: string): Promise<{
  shouldEscalate: boolean;
  lowScoreCount: number;
}> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const lowScoreReviews = await QAReview.countDocuments({
    agentId: new Types.ObjectId(agentId),
    status: 'completed',
    totalScore: { $lt: 70 },
    createdAt: { $gte: sevenDaysAgo },
  });

  if (lowScoreReviews >= 3) {
    await QAReview.updateMany(
      {
        agentId: new Types.ObjectId(agentId),
        status: 'completed',
        totalScore: { $lt: 70 },
        createdAt: { $gte: sevenDaysAgo },
        escalated: { $ne: true },
      },
      {
        $set: {
          escalated: true,
          escalatedAt: new Date(),
          escalatedReason: `${lowScoreReviews} scores below 70 in last 7 days`,
        },
      }
    );
    return { shouldEscalate: true, lowScoreCount: lowScoreReviews };
  }
  return { shouldEscalate: false, lowScoreCount: lowScoreReviews };
}

// ─── Agent QA Performance Summary ─────────────────────────────────────

export async function getAgentQAPerformance(agentId: string): Promise<{
  recentReviews: any[];
  avgScore: number;
  weeklyTrend: number[];
  pendingAcknowledgements: number;
  totalReviews: number;
}> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const [recentReviews, pendingAcknowledgements] = await Promise.all([
    QAReview.find({
      agentId: new Types.ObjectId(agentId),
      status: 'completed',
      createdAt: { $gte: thirtyDaysAgo },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('reviewedBy', 'name avatar')
      .lean(),
    QAReview.countDocuments({
      agentId: new Types.ObjectId(agentId),
      status: 'completed',
      $or: [{ agentAcknowledged: false }, { requiresReack: true }],
    }),
  ]);

  const scores = recentReviews.map((r) => r.totalScore);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  const weeklyTrend: number[] = [];
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(Date.now() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(Date.now() - w * 7 * 24 * 60 * 60 * 1000);
    const weekReviews = recentReviews.filter(
      (r) => new Date(r.createdAt) >= weekStart && new Date(r.createdAt) < weekEnd
    );
    const weekAvg = weekReviews.length > 0
      ? Math.round(weekReviews.reduce((a, r) => a + r.totalScore, 0) / weekReviews.length)
      : 0;
    weeklyTrend.push(weekAvg);
  }

  return { recentReviews, avgScore, weeklyTrend, pendingAcknowledgements, totalReviews: recentReviews.length };
}

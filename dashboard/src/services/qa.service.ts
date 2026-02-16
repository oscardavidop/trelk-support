/**
 * QA & Coaching API Service
 * Frontend API calls for quality assurance system
 */

import api from './api';

// ─── Types ────────────────────────────────────────────────────────────

export type QACheckCategory = 'greeting' | 'resolution' | 'tone' | 'procedure' | 'closing' | 'general';
export type QACheckResult = 'yes' | 'no' | 'partial' | 'na';
export type QAReviewStatus = 'draft' | 'completed';
export type CoachingStatus = 'none' | 'pending' | 'scheduled' | 'completed' | 'dismissed';
export type CoachingTag = 'tone_issue' | 'slow_response' | 'wrong_category' | 'policy_violation' | 'other';

export interface QACheckItem {
  _id: string;
  name: string;
  description: string;
  category: QACheckCategory;
  weight: number;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface QASettings {
  _id: string;
  lowScoreThreshold: number;
  coachingEnabled: boolean;
  autoFlagThreshold: number;
  rollingWindowDays: number;
}

export interface QACheckEval {
  checkItemId: string;
  checkName: string;
  checkCategory: string;
  weight: number;
  result: QACheckResult;
  score: number;
  note?: string;
}

export interface QAEditLog {
  editedAt: string;
  editedBy: string | { _id: string; name: string; avatar?: string };
  editReason: string;
  previousScore: number;
  newScore: number;
}

export interface QAReview {
  _id: string;
  sessionId: string;
  session?: { sessionId: string; channel: string; closedAt: string };
  agentId: string | { _id: string; name: string; avatar?: string; email?: string };
  reviewedBy: string | { _id: string; name: string; avatar?: string };
  checks: QACheckEval[];
  totalScore: number;
  comment: string;
  status: QAReviewStatus;
  coaching: CoachingStatus;
  coachingNotes?: string;
  coachingScheduledAt?: string;
  coachingCompletedAt?: string;
  coachingBy?: string | { _id: string; name: string; avatar?: string };
  coachingTags: CoachingTag[];
  trainingRecommendations: string[];
  agentAcknowledged: boolean;
  agentAcknowledgedAt?: string;
  agentFeedback?: string;
  requiresReack: boolean;
  editHistory: QAEditLog[];
  escalated: boolean;
  escalatedAt?: string;
  escalatedReason?: string;
  createdAt: string;
  updatedAt: string;
}

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

export interface TeamAnalytics {
  agents: AgentQAStats[];
  globalAvg: number;
  totalReviews: number;
  mostFailedChecks: { checkName: string; failRate: number; count: number }[];
  scoreBrackets: { bracket: string; count: number }[];
}

export interface AgentAnalytics {
  avgScore: number;
  reviewCount: number;
  trend: number[];
  byCategory: Record<string, number>;
}

export interface AgentQAPerformance {
  recentReviews: QAReview[];
  avgScore: number;
  weeklyTrend: number[];
  pendingAcknowledgements: number;
  totalReviews: number;
}

// ─── Checklist Config ─────────────────────────────────────────────────

export async function getChecklist(): Promise<QACheckItem[]> {
  const res = await api.get<{ items: QACheckItem[] }>('/api/qa/checklist');
  if (!res.ok) return [];
  return res.data?.items || [];
}

export async function getAllChecklistItems(): Promise<QACheckItem[]> {
  const res = await api.get<{ items: QACheckItem[] }>('/api/qa/checklist/all');
  if (!res.ok) return [];
  return res.data?.items || [];
}

export async function createChecklistItem(data: {
  name: string;
  description?: string;
  category?: QACheckCategory;
  weight: number;
  order?: number;
}): Promise<QACheckItem> {
  const res = await api.post<QACheckItem>('/api/qa/checklist', data);
  return res.data;
}

export async function updateChecklistItem(id: string, data: Partial<{
  name: string;
  description: string;
  category: QACheckCategory;
  weight: number;
  isActive: boolean;
  order: number;
}>): Promise<QACheckItem> {
  const res = await api.put<QACheckItem>(`/api/qa/checklist/${id}`, { ...data });
  return res.data;
}

export async function deleteChecklistItem(id: string): Promise<void> {
  await api.delete(`/api/qa/checklist/${id}`, { data: { hardDelete: true } });
}

export async function reorderChecklist(items: { id: string; order: number }[]): Promise<void> {
  await api.patch('/api/qa/checklist/reorder', { items });
}

// ─── QA Settings ──────────────────────────────────────────────────────

export async function getQASettings(): Promise<QASettings> {
  const res = await api.get<QASettings>('/api/qa/settings');
  if (!res.ok) throw new Error('Failed to fetch QA settings');
  return res.data;
}

export async function updateQASettings(data: Partial<{
  lowScoreThreshold: number;
  coachingEnabled: boolean;
  autoFlagThreshold: number;
  rollingWindowDays: number;
}>): Promise<QASettings> {
  const res = await api.put<QASettings>('/api/qa/settings', data);
  return res.data;
}

// ─── Reviews ──────────────────────────────────────────────────────────

export async function submitReview(data: {
  sessionId: string;
  agentId: string;
  checks: {
    checkItemId: string;
    checkName: string;
    checkCategory: string;
    weight: number;
    result: QACheckResult;
    note?: string;
  }[];
  comment?: string;
  status?: QAReviewStatus;
}): Promise<QAReview> {
  const res = await api.post<QAReview>('/api/qa/reviews', { ...data });
  return res.data;
}

export async function updateReview(id: string, data: {
  checks?: {
    checkItemId: string;
    checkName: string;
    checkCategory: string;
    weight: number;
    result: QACheckResult;
    note?: string;
  }[];
  comment?: string;
  status?: QAReviewStatus;
}): Promise<QAReview> {
  const res = await api.put<QAReview>(`/api/qa/reviews/${id}`, { ...data });
  return res.data;
}

export async function getReviewBySession(sessionId: string): Promise<QAReview | null> {
  try {
    const res = await api.get<QAReview>(`/api/qa/reviews/session/${sessionId}`);
    if (!res.ok || !res.data?.checks) return null;
    return res.data;
  } catch {
    return null;
  }
}

export async function getAgentReviews(agentId: string, params?: { limit?: number; skip?: number }): Promise<{ reviews: QAReview[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.skip) qs.set('skip', String(params.skip));
  const res = await api.get<{ reviews: QAReview[]; total: number }>(`/api/qa/reviews/agent/${agentId}?${qs}`);
  if (!res.ok) return { reviews: [], total: 0 };
  return res.data;
}

// ─── Coaching ─────────────────────────────────────────────────────────

export async function updateCoachingStatus(reviewId: string, data: {
  coaching: CoachingStatus;
  coachingNotes?: string;
  coachingScheduledAt?: string;
}): Promise<QAReview> {
  const res = await api.patch<QAReview>(`/api/qa/reviews/${reviewId}/coaching`, data);
  return res.data;
}

export async function acknowledgeReview(reviewId: string, agentFeedback?: string): Promise<QAReview> {
  const res = await api.patch<QAReview>(`/api/qa/reviews/${reviewId}/acknowledge`, { agentFeedback });
  return res.data;
}

export async function getPendingCoaching(params?: { limit?: number; skip?: number }): Promise<{ reviews: QAReview[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.skip) qs.set('skip', String(params.skip));
  const res = await api.get<{ reviews: QAReview[]; total: number }>(`/api/qa/coaching/pending?${qs}`);
  if (!res.ok) return { reviews: [], total: 0 };
  return res.data;
}

export interface UnreviewedSession {
  _id: string;
  sessionId: string;
  channel: string;
  closedAt: string;
  createdAt: string;
  customerName?: string;
  lastMessage?: { content?: string };
  assignedAgent?: { _id: string; name: string; avatar?: string; email?: string };
}

export async function getUnreviewedSessions(params?: { limit?: number; days?: number }): Promise<{ sessions: UnreviewedSession[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.days) qs.set('days', String(params.days));
  const res = await api.get<{ sessions: UnreviewedSession[]; total: number }>(`/api/qa/coaching/unreviewed?${qs}`);
  if (!res.ok) return { sessions: [], total: 0 };
  return res.data;
}

// ─── Analytics ────────────────────────────────────────────────────────

export async function getAgentAnalytics(agentId: string, days?: number): Promise<AgentAnalytics> {
  const qs = days ? `?days=${days}` : '';
  const res = await api.get<AgentAnalytics>(`/api/qa/analytics/agent/${agentId}${qs}`);
  return res.data;
}

export async function getTeamAnalytics(days?: number): Promise<TeamAnalytics> {
  const qs = days ? `?days=${days}` : '';
  const res = await api.get<TeamAnalytics>(`/api/qa/analytics/team${qs}`);
  if (!res.ok) throw new Error('Failed to fetch team analytics');
  return res.data;
}

// ─── Agent-facing (own data) ──────────────────────────────────────────

export async function getMyPendingReviews(): Promise<QAReview[]> {
  const res = await api.get<{ reviews: QAReview[] }>('/api/qa/my/pending');
  if (!res.ok) return [];
  return res.data?.reviews || [];
}

export async function getMyPerformance(): Promise<AgentQAPerformance | null> {
  const res = await api.get<AgentQAPerformance>('/api/qa/my/performance');
  if (!res.ok) return null;
  return res.data;
}

// ─── Review editing with audit (admin/supervisor) ─────────────────────

export async function editReviewWithAudit(reviewId: string, data: {
  editReason: string;
  checks?: {
    checkItemId: string;
    checkName: string;
    checkCategory: string;
    weight: number;
    result: QACheckResult;
    note?: string;
  }[];
  comment?: string;
  coachingTags?: CoachingTag[];
  trainingRecommendations?: string[];
}): Promise<QAReview> {
  const res = await api.patch<QAReview>(`/api/qa/reviews/${reviewId}/edit`, data);
  return res.data;
}

// ─── Escalations ──────────────────────────────────────────────────────

export async function getEscalations(): Promise<QAReview[]> {
  const res = await api.get<{ reviews: QAReview[] }>('/api/qa/escalations');
  if (!res.ok) return [];
  return res.data?.reviews || [];
}

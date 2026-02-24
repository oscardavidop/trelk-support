/**
 * Playbook API Service — Frontend API calls & types
 */

import api from './api';

// ─── TYPES ──────────────────────────────────────────────────

export type PlaybookStepType =
  | 'checklist' | 'action_button' | 'question' | 'escalation'
  | 'internal_note' | 'link' | 'validation' | 'category_change';

export type PlaybookStepAction =
  | 'send_template' | 'assign_tag' | 'change_category' | 'create_note'
  | 'escalate_supervisor' | 'open_link' | 'open_modal' | 'none';

export type PlaybookTriggerType = 'disposition' | 'tag' | 'category' | 'intent' | 'manual';
export type StepStatus = 'pending' | 'completed' | 'skipped';
export type ProgressStatus = 'active' | 'completed' | 'abandoned';

export interface PlaybookStep {
  stepId: string;
  type: PlaybookStepType;
  label: string;
  description?: string;
  action: PlaybookStepAction;
  templateId?: string;
  templateText?: string;
  tagName?: string;
  categoryId?: string;
  linkUrl?: string;
  modalType?: string;
  isCritical: boolean;
  order: number;
  skipRequiresComment: boolean;
  estimatedSeconds?: number;
}

export interface PlaybookTrigger {
  type: PlaybookTriggerType;
  value: string;
}

export interface Playbook {
  _id: string;
  name: string;
  description?: string;
  category: string;
  isActive: boolean;
  isMandatory: boolean;
  version: number;
  steps: PlaybookStep[];
  triggers: PlaybookTrigger[];
  createdBy: { _id: string; name: string; email: string } | string;
  updatedBy?: { _id: string; name: string; email: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface StepProgress {
  stepId: string;
  status: StepStatus;
  completedAt?: string;
  completedBy?: string;
  skipReason?: string;
  actionResult?: string;
}

export interface PlaybookProgress {
  _id: string;
  sessionId: string;
  playbookId: Playbook | string;
  playbookVersion: number;
  agentId: { _id: string; name: string; email: string } | string;
  steps: StepProgress[];
  status: ProgressStatus;
  completionPercent: number;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaybookQAData {
  playbookName: string;
  isMandatory: boolean;
  totalSteps: number;
  completedSteps: number;
  skippedSteps: number;
  completionPercent: number;
  criticalTotal: number;
  criticalCompleted: number;
  wasCompleted: boolean;
  wasAbandoned: boolean;
}

export interface CloseValidation {
  [x: string]: any;
  canClose: boolean;
  pendingCriticalSteps: { stepId: string; label: string }[];
  playbookName: string | null;
}

// ─── API CALLS ──────────────────────────────────────────────

// -- CRUD --

export async function getPlaybooks(params?: { isActive?: boolean; category?: string }): Promise<Playbook[]> {
  const query = new URLSearchParams();
  if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
  if (params?.category) query.set('category', params.category);
  const qs = query.toString();
  const res = await api.get<{ ok: boolean; playbooks: Playbook[] }>(`/api/playbooks${qs ? `?${qs}` : ''}`);
  return res.data.playbooks;
}

export async function getPlaybook(id: string): Promise<Playbook> {
  const res = await api.get<{ ok: boolean; playbook: Playbook }>(`/api/playbooks/${id}`);
  return res.data.playbook;
}

export async function createPlaybook(data: Partial<Playbook>): Promise<Playbook> {
  const res = await api.post<{ ok: boolean; playbook: Playbook }>('/api/playbooks', data);
  return res.data.playbook;
}

export async function updatePlaybook(id: string, data: Partial<Playbook>): Promise<Playbook> {
  const res = await api.put<{ ok: boolean; playbook: Playbook }>(`/api/playbooks/${id}`, data);
  return res.data.playbook;
}

export async function deletePlaybook(id: string): Promise<void> {
  await api.delete(`/api/playbooks/${id}`);
}

export async function togglePlaybook(id: string, isActive: boolean): Promise<Playbook> {
  const res = await api.patch<{ ok: boolean; playbook: Playbook }>(`/api/playbooks/${id}/toggle`, { isActive });
  return res.data.playbook;
}

export async function seedPlaybooks(): Promise<void> {
  await api.post('/api/playbooks/seed', {});
}

// -- MATCHING --

export async function matchPlaybooks(context: {
  dispositionId?: string;
  dispositionCode?: string;
  dispositionName?: string;
  tags?: string[];
  category?: string;
  intent?: string;
}): Promise<Playbook[]> {
  const res = await api.post<{ ok: boolean; playbooks: Playbook[] }>('/api/playbooks/match', context);
  return res.data.playbooks;
}

export async function getAvailablePlaybooks(): Promise<Playbook[]> {
  const res = await api.get<{ ok: boolean; playbooks: Playbook[] }>('/api/playbooks/available');
  return res.data.playbooks;
}

// -- PROGRESS --

export async function startPlaybook(sessionId: string, playbookId: string): Promise<PlaybookProgress> {
  const res = await api.post<{ ok: boolean; progress: PlaybookProgress }>(`/api/playbooks/progress/${sessionId}/start`, { playbookId });
  return res.data.progress;
}

export async function getActiveProgress(sessionId: string): Promise<PlaybookProgress | null> {
  const res = await api.get<{ ok: boolean; progress: PlaybookProgress | null }>(`/api/playbooks/progress/${sessionId}`);
  return res.data.progress;
}

export async function getProgressHistory(sessionId: string): Promise<PlaybookProgress[]> {
  const res = await api.get<{ ok: boolean; history: PlaybookProgress[] }>(`/api/playbooks/progress/${sessionId}/history`);
  return res.data.history;
}

export async function completeStep(sessionId: string, stepId: string, actionResult?: string): Promise<PlaybookProgress> {
  const res = await api.post<{ ok: boolean; progress: PlaybookProgress }>(
    `/api/playbooks/progress/${sessionId}/step/${stepId}/complete`,
    actionResult ? { actionResult } : {}
  );
  return res.data.progress;
}

export async function skipStep(sessionId: string, stepId: string, reason: string): Promise<PlaybookProgress> {
  const res = await api.post<{ ok: boolean; progress: PlaybookProgress }>(
    `/api/playbooks/progress/${sessionId}/step/${stepId}/skip`,
    { reason }
  );
  return res.data.progress;
}

export async function abandonPlaybook(sessionId: string): Promise<PlaybookProgress> {
  const res = await api.post<{ ok: boolean; progress: PlaybookProgress }>(`/api/playbooks/progress/${sessionId}/abandon`, {});
  return res.data.progress;
}

// -- VALIDATION --

export async function validateBeforeClose(sessionId: string): Promise<CloseValidation> {
  const res = await api.get<{ ok: boolean } & CloseValidation>(`/api/playbooks/validate-close/${sessionId}`);
  return { canClose: res.data.canClose, pendingCriticalSteps: res.data.pendingCriticalSteps, playbookName: res.data.playbookName };
}

// -- QA --

export async function getPlaybookQAData(sessionId: string): Promise<PlaybookQAData | null> {
  const res = await api.get<{ ok: boolean; data: PlaybookQAData | null }>(`/api/playbooks/qa/${sessionId}`);
  return res.data.data;
}

// -- TEMPLATE --

export async function previewTemplate(text: string, context: Record<string, string>): Promise<string> {
  const res = await api.post<{ ok: boolean; resolved: string }>('/api/playbooks/preview-template', { text, context });
  return res.data.resolved;
}

/**
 * Presence Service - Frontend API client for agent status management
 */

import { api } from './api';

const BASE = '/api/presence';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface AuxiliaryState {
  isActive: boolean;
  _id: string;
  code: string;
  label: string;
  color: string;
  icon?: string;
  isDefault: boolean;
  receivesChats: boolean;
  countsPaidTime: boolean;
  visibleInWallboard: boolean;
  autoExpireMinutes?: number;
  requiresReason: boolean;
  allowedReasons: string[];
  maxDailyMinutes?: number;
  blocksAssignment: boolean;
  affectsSla: boolean;
  allowedFromStates: string[];
  allowedToStates: string[];
  allowAgentManualSet: boolean;
  requiresSupervisorApproval: boolean;
  sortOrder: number;
}

export interface AgentPresence {
  agentId: string;
  name: string;
  email: string;
  stateCode: string;
  color: string;
  label?: string;
  changedAt: string | null;
  activeChats: number;
  maxChats: number;
}

export interface AgentTimeStats {
  agentId: string;
  name: string;
  email: string;
  byState: Record<string, { label: string; durationMs: number; durationHuman: string; color: string }>;
  totalLoggedMs: number;
  totalPaidMs: number;
  totalBreakMs: number;
  totalAvailableMs: number;
  totalBusyMs: number;
  utilizationPct: number;
  unexpectedDisconnects: number;
}

export interface StatusLogEntry {
  _id: string;
  agentId: string;
  auxiliaryStateCode: string;
  auxiliaryStateLabel: string;
  reason?: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  ip: string;
  triggeredBy: string;
  triggeredByAgentId?: string;
  isUnexpected: boolean;
}

// ─── Agent self ───────────────────────────────────────────────────────────

export async function sendHeartbeat(): Promise<void> {
  await api.post(`${BASE}/heartbeat`, {});
}

export async function getMyPresence(): Promise<{
  presence: AgentPresence;
  todayStats: AgentTimeStats;
  availableStates: AuxiliaryState[];
  maxChats: number;
  idleRiskSince: string | null;
}> {
  const res = await api.get<any>(`${BASE}/me`);
  return res.data.data;
}

export async function setMyState(stateCode: string, reason?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.post(`${BASE}/state`, { stateCode, reason });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.response?.data?.error || 'Error changing state' };
  }
}

// ─── Supervisor ───────────────────────────────────────────────────────────

export async function getAllPresences(): Promise<AgentPresence[]> {
  const res = await api.get<any>(`${BASE}/all`);
  return res.data.data;
}

export async function forceAgentState(agentId: string, stateCode: string, reason?: string): Promise<void> {
  await api.post(`${BASE}/${agentId}/state`, { stateCode, reason });
}

export async function setAgentMaxChats(agentId: string, maxChats: number): Promise<void> {
  await api.post(`${BASE}/${agentId}/max-chats`, { maxChats });
}

export async function getAgentHistory(agentId: string, from?: string, to?: string): Promise<{
  history: StatusLogEntry[];
  unexpected: StatusLogEntry[];
}> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const res = await api.get<any>(`${BASE}/${agentId}/history?${params}`);
  return res.data.data;
}

export async function getAgentStats(agentId: string, from?: string, to?: string): Promise<{
  stats: AgentTimeStats;
  daily: any[];
}> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const res = await api.get<any>(`${BASE}/${agentId}/stats?${params}`);
  return res.data.data;
}

export async function getTeamSummary(from?: string, to?: string): Promise<AgentTimeStats[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const res = await api.get<any>(`${BASE}/report/summary?${params}`);
  return res.data.data;
}

export async function exportPresenceReport(agentIds?: string[], from?: string, to?: string): Promise<void> {
  const token = (() => {
    try {
      const s = localStorage.getItem('trelk-support-auth');
      return s ? JSON.parse(s).state?.token : null;
    } catch { return null; }
  })();

  const res = await fetch('/api/presence/report/export', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ agentIds, from, to }),
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename="(.+?)"/);
  a.download = match?.[1] || 'reporte-estados.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Auxiliary states management ─────────────────────────────────────────

export async function getAuxiliaryStates(): Promise<AuxiliaryState[]> {
  const res = await api.get<any>(`${BASE}/auxiliaries`);
  return res.data.data;
}

export async function createAuxiliaryState(data: Partial<AuxiliaryState>): Promise<AuxiliaryState> {
  const res = await api.post<any>(`${BASE}/auxiliaries`, data);
  return res.data.data;
}

export async function updateAuxiliaryState(code: string, data: Partial<AuxiliaryState>): Promise<AuxiliaryState> {
  const res = await api.patch<any>(`${BASE}/auxiliaries/${code}`, data);
  return res.data.data;
}

export async function deleteAuxiliaryState(code: string): Promise<void> {
  await api.delete(`${BASE}/auxiliaries/${code}`);
}

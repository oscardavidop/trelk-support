/**
 * Agent Engine Service - Frontend API client for Agent Rule Engine configuration
 */

import { api } from './api';

const BASE = '/api/agent-engine';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface EngineConfig {
  maxChatsDefault: number;
  allowMultiSession: boolean;
  blockAssignmentIfNoHeartbeat: boolean;
  autoSetBusyWhenMaxChats: boolean;
  allowStateChangeWithActiveChats: boolean;
  maxConcurrentSessions: number;
  enableDynamicCapacity: boolean;
  heartbeatTimeoutSeconds: number;
  reconcileOnBoot: boolean;
  maxDailyBreakMinutes: number;
  breakRequiresReason: boolean;
  countBreakAsPaid: boolean;
  strictPayrollMode: boolean;
  autoBreakOnIdleMinutes: number;
  autoBreakTargetStateCode: string;
  allowSupervisorForceState: boolean;
  allowManualBusy: boolean;
  enableAuxiliaryRules: boolean;
  enableSlaImpact: boolean;
}

export interface EngineConfigDoc extends EngineConfig {
  _id: string;
  scope: 'global' | 'team' | 'agent';
  scopeRef: string | null;
  label: string;
  version: number;
}

export interface BreakAccumulation {
  dailyMs: number;
  weeklyMs: number;
  monthlyMs: number;
  dailyLimitMs: number;
  weeklyLimitMs: number;
  monthlyLimitMs: number;
}

// ─── Global Config ────────────────────────────────────────────────────────────

export async function getGlobalConfig(): Promise<{ data: EngineConfig; defaults: EngineConfig }> {
  const res = await api.get<{ data: EngineConfig; defaults: EngineConfig }>(`${BASE}/config`);
  return res.data;
}

export async function updateGlobalConfig(data: Partial<EngineConfig>): Promise<EngineConfigDoc> {
  const res = await api.put<{ data: EngineConfigDoc }>(`${BASE}/config`, data);
  return res.data.data;
}

// ─── Team Config ──────────────────────────────────────────────────────────────

export async function getTeamConfig(teamId: string): Promise<Partial<EngineConfig> | null> {
  const res = await api.get<{ data: Partial<EngineConfig> | null }>(`${BASE}/config/team/${teamId}`);
  return res.data.data;
}

export async function updateTeamConfig(teamId: string, data: Partial<EngineConfig>): Promise<EngineConfigDoc> {
  const res = await api.put<{ data: EngineConfigDoc }>(`${BASE}/config/team/${teamId}`, data);
  return res.data.data;
}

// ─── Agent Config ─────────────────────────────────────────────────────────────

export async function getAgentEngineConfig(agentId: string): Promise<Partial<EngineConfig> | null> {
  const res = await api.get<{ data: Partial<EngineConfig> | null }>(`${BASE}/config/agent/${agentId}`);
  return res.data.data;
}

export async function updateAgentEngineConfig(agentId: string, data: Partial<EngineConfig>): Promise<EngineConfigDoc> {
  const res = await api.put<{ data: EngineConfigDoc }>  (`${BASE}/config/agent/${agentId}`, data);
  return res.data.data;
}

// ─── Resolved Config ──────────────────────────────────────────────────────────

export async function getResolvedConfig(agentId: string): Promise<EngineConfig> {
  const res = await api.get<{ data: EngineConfig }>(`${BASE}/config/resolved/${agentId}`);
  return res.data.data;
}

// ─── List All Configs ─────────────────────────────────────────────────────────

export async function listAllConfigs(): Promise<EngineConfigDoc[]> {
  const res = await api.get<{ data: EngineConfigDoc[] }>(`${BASE}/configs`);
  return res.data.data;
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export async function rebuildCache(): Promise<{ ok: boolean; version: number }> {
  const res = await api.post<{ ok: boolean; version: number }>(`${BASE}/cache/rebuild`);
  return res.data;
}

// ─── Version ──────────────────────────────────────────────────────────────────

export async function getEngineVersion(): Promise<{ version: number; defaults: EngineConfig }> {
  const res = await api.get<{ version: number; defaults: EngineConfig }>(`${BASE}/version`);
  return res.data;
}

// ─── Break Tracking ──────────────────────────────────────────────────────────

export async function getBreakAccumulation(agentId: string): Promise<BreakAccumulation> {
  const res = await api.get<{ data: BreakAccumulation }>(`${BASE}/break/${agentId}`);
  return res.data.data;
}

export async function resetBreakCounter(agentId: string): Promise<void> {
  await api.post(`${BASE}/break/${agentId}/reset`);
}

// ─── Supervisor Actions ───────────────────────────────────────────────────────

export async function suspendAgent(agentId: string): Promise<void> {
  await api.post(`${BASE}/supervisor/${agentId}/suspend`);
}

export async function unblockAgent(agentId: string): Promise<void> {
  await api.post(`${BASE}/supervisor/${agentId}/unblock`);
}

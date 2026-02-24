/**
 * Agent Rule Engine - Central validation gateway
 *
 * Every state change, assignment, and supervisor action MUST pass through
 * this engine.  It reads from AgentConfigService (cached) and AuxiliaryState
 * config – never hard-coded constants.
 *
 * Public surface:
 *   validateStateChange()   – called by presence.service before changing state
 *   validateAssignment()    – called by smart-routing before assigning a chat
 *   validateSupervisorAction() – called by routes for supervisor force-state / suspend
 *   getBreakAccumulation()  – daily / weekly / monthly break totals
 */

import * as redis from './redis.js';
import { resolveConfig, resolveAgentCapacity, type ResolvedConfig } from './agent-config.service.js';
import { AuxiliaryState, type IAuxiliaryState } from '../database/models/AuxiliaryState.js';
import { Agent } from '../database/models/Agent.js';
import { AgentStatusLog } from '../database/models/AgentStatusLog.js';
import { logger } from './logger.js';

// ─── Aux state cache (re-uses presence service pattern) ──────────────────────

const AUX_CACHE_TTL = 30_000;
let _auxMap: Map<string, IAuxiliaryState> = new Map();
let _auxTs = 0;

async function getAuxMap(): Promise<Map<string, IAuxiliaryState>> {
  if (Date.now() - _auxTs < AUX_CACHE_TTL && _auxMap.size > 0) return _auxMap;
  const cached = await redis.get('presence:aux_states');
  if (cached) {
    const arr: IAuxiliaryState[] = JSON.parse(cached);
    _auxMap = new Map(arr.map(s => [s.code, s]));
  } else {
    const states = await AuxiliaryState.find({ isActive: true }).lean<IAuxiliaryState[]>();
    _auxMap = new Map(states.map(s => [s.code, s]));
    await redis.set('presence:aux_states', JSON.stringify(states), 300);
  }
  _auxTs = Date.now();
  return _auxMap;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StateChangeRequest {
  agentId: string;
  currentStateCode: string;
  nextStateCode: string;
  hasActiveChats: boolean;
  reason?: string;
  triggeredBy: string;        // 'agent' | 'supervisor' | 'system_auto' | 'login' | 'logout' etc.
  supervisorId?: string;
}

export interface StateChangeResult {
  allowed: boolean;
  reason?: string;
}

export interface AssignmentRequest {
  agentId: string;
}

export interface AssignmentResult {
  allowed: boolean;
  reason?: string;
  effectiveCapacity: number;
}

// ─── 1. STATE CHANGE VALIDATION ──────────────────────────────────────────────

export async function validateStateChange(req: StateChangeRequest): Promise<StateChangeResult> {
  const cfg = await resolveConfig(req.agentId);
  const auxMap = await getAuxMap();

  const nextState = auxMap.get(req.nextStateCode);
  if (!nextState) {
    return { allowed: false, reason: `Unknown auxiliary state: ${req.nextStateCode}` };
  }
  const currentState = auxMap.get(req.currentStateCode);

  // 1a. Transition rules: allowedFromStates on the *target* state
  if (nextState.allowedFromStates && nextState.allowedFromStates.length > 0) {
    if (!nextState.allowedFromStates.includes(req.currentStateCode)) {
      // Supervisor and system can bypass transition rules
      if (req.triggeredBy !== 'supervisor' && req.triggeredBy !== 'system_auto'
          && req.triggeredBy !== 'heartbeat_timeout' && req.triggeredBy !== 'auto_expire'
          && req.triggeredBy !== 'login' && req.triggeredBy !== 'logout') {
        return { allowed: false, reason: `Cannot transition from '${req.currentStateCode}' to '${req.nextStateCode}'` };
      }
    }
  }

  // 1b. Transition rules: allowedToStates on the *current* state
  if (currentState?.allowedToStates && currentState.allowedToStates.length > 0) {
    if (!currentState.allowedToStates.includes(req.nextStateCode)) {
      if (req.triggeredBy !== 'supervisor' && req.triggeredBy !== 'system_auto'
          && req.triggeredBy !== 'heartbeat_timeout' && req.triggeredBy !== 'auto_expire'
          && req.triggeredBy !== 'login' && req.triggeredBy !== 'logout') {
        return { allowed: false, reason: `Cannot leave '${req.currentStateCode}' to '${req.nextStateCode}'` };
      }
    }
  }

  // 1c. Anti-fraud: cannot set busy without active chats (unless config allows)
  if (req.nextStateCode === 'busy' && !req.hasActiveChats && !cfg.allowManualBusy) {
    return { allowed: false, reason: 'Cannot set busy without active chats' };
  }

  // 1d. HARD BLOCK: Cannot enter a state that blocksAssignment while having active chats
  //     (e.g. break with open chats is never allowed — agent must close/transfer first)
  if (req.hasActiveChats && nextState.blocksAssignment && req.nextStateCode !== 'offline') {
    if (req.triggeredBy !== 'system_auto' && req.triggeredBy !== 'heartbeat_timeout' && req.triggeredBy !== 'auto_expire') {
      return { allowed: false, reason: 'Debes cerrar o transferir todos tus chats antes de entrar en este estado' };
    }
  }

  // 1d-bis. General active chats check (when config flag is off)
  if (req.hasActiveChats && !cfg.allowStateChangeWithActiveChats) {
    if (req.nextStateCode !== 'busy' && req.triggeredBy !== 'supervisor'
        && req.triggeredBy !== 'system_auto' && req.triggeredBy !== 'heartbeat_timeout') {
      return { allowed: false, reason: 'Cannot change state while you have active chats' };
    }
  }

  // 1e. Requires reason
  if (nextState.requiresReason && !req.reason) {
    if (cfg.breakRequiresReason && req.triggeredBy !== 'system_auto' && req.triggeredBy !== 'auto_expire') {
      return { allowed: false, reason: `A reason is required to enter '${nextState.label}'` };
    }
  }

  // 1f. Break quota (daily)
  if (nextState.maxDailyMinutes || (req.nextStateCode.startsWith('break') && cfg.maxDailyBreakMinutes > 0)) {
    const quotaResult = await checkDailyBreakQuota(req.agentId, req.nextStateCode, cfg, nextState);
    if (!quotaResult.allowed) return quotaResult;
  }

  // 1g. Requires supervisor approval
  if (nextState.requiresSupervisorApproval && req.triggeredBy !== 'supervisor' && req.triggeredBy !== 'system_auto') {
    return { allowed: false, reason: `State '${nextState.label}' requires supervisor approval` };
  }

  // 1h. Agent manual set permission
  if (!nextState.allowAgentManualSet && req.triggeredBy === 'agent') {
    return { allowed: false, reason: `You cannot set '${nextState.label}' manually` };
  }

  return { allowed: true };
}

// ─── 2. ASSIGNMENT VALIDATION ────────────────────────────────────────────────

/**
 * Full validation before assigning a chat to an agent.
 * Returns allowed + effectiveCapacity.
 */
export async function validateAssignment(req: AssignmentRequest): Promise<AssignmentResult> {
  const cfg = await resolveConfig(req.agentId);
  const auxMap = await getAuxMap();

  const agent = await Agent.findById(req.agentId)
    .select('auxiliaryStateCode activeChats maxChatsOverride isActive breakQuotaBlockedUntil presenceSessionId')
    .lean() as any;

  if (!agent || !agent.isActive) {
    return { allowed: false, reason: 'Agent not active', effectiveCapacity: 0 };
  }

  // 2a. Check live state from Redis first
  const presenceRaw = await redis.get(`presence:${req.agentId}`);
  const stateCode = presenceRaw
    ? JSON.parse(presenceRaw).stateCode
    : (agent.auxiliaryStateCode || 'offline');

  const auxState = auxMap.get(stateCode);

  // Must receive chats
  if (auxState && !auxState.receivesChats) {
    return { allowed: false, reason: `State '${auxState.label}' does not receive chats`, effectiveCapacity: 0 };
  }
  if (!auxState && stateCode !== 'available') {
    return { allowed: false, reason: `Unknown state '${stateCode}' does not receive chats`, effectiveCapacity: 0 };
  }

  // blocksAssignment flag
  if (auxState?.blocksAssignment) {
    return { allowed: false, reason: `State '${auxState.label}' blocks assignment`, effectiveCapacity: 0 };
  }

  // 2b. Heartbeat check
  if (cfg.blockAssignmentIfNoHeartbeat) {
    const beat = await redis.get(`heartbeat:${req.agentId}`);
    if (!beat) {
      return { allowed: false, reason: 'No heartbeat detected', effectiveCapacity: 0 };
    }
    const elapsed = Date.now() - parseInt(beat);
    if (elapsed > cfg.heartbeatTimeoutSeconds * 1000) {
      return { allowed: false, reason: 'Heartbeat timed out', effectiveCapacity: 0 };
    }
  }

  // 2c. Session check
  if (!agent.presenceSessionId && !cfg.allowMultiSession) {
    return { allowed: false, reason: 'No active session', effectiveCapacity: 0 };
  }

  // 2d. Break quota block
  if (agent.breakQuotaBlockedUntil && new Date(agent.breakQuotaBlockedUntil) > new Date()) {
    return { allowed: false, reason: 'Agent is break-quota blocked', effectiveCapacity: 0 };
  }

  // 2e. Capacity
  const effectiveCapacity = await resolveAgentCapacity(req.agentId);
  if ((agent.activeChats || 0) >= effectiveCapacity) {
    return { allowed: false, reason: 'At capacity', effectiveCapacity };
  }

  return { allowed: true, effectiveCapacity };
}

// ─── 3. SUPERVISOR ACTION VALIDATION ─────────────────────────────────────────

export async function validateSupervisorAction(
  supervisorId: string,
  targetAgentId: string,
  action: 'force_state' | 'invalidate_session' | 'block_assignment' | 'suspend' | 'reset_break_counter'
): Promise<StateChangeResult> {
  const cfg = await resolveConfig(targetAgentId);

  if (!cfg.allowSupervisorForceState && (action === 'force_state' || action === 'suspend')) {
    return { allowed: false, reason: 'Supervisor force-state is disabled in config' };
  }

  // All supervisor actions are allowed if the config flag is on
  return { allowed: true };
}

// ─── 4. BREAK ACCUMULATION & CONTROL ─────────────────────────────────────────

const breakDayKey   = (agentId: string, d: string) => `engine:break:day:${agentId}:${d}`;
const breakWeekKey  = (agentId: string, w: string) => `engine:break:week:${agentId}:${w}`;
const breakMonthKey = (agentId: string, m: string) => `engine:break:month:${agentId}:${m}`;

function todayStr(): string { return new Date().toISOString().split('T')[0]; }
function weekStr(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}
function monthStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Record break time after a break-state log is closed.
 */
export async function recordBreakTime(agentId: string, stateCode: string, durationMs: number): Promise<void> {
  const day = todayStr();
  const week = weekStr();
  const month = monthStr();
  const secUntilEOD = 86400 - (Math.floor(Date.now() / 1000) % 86400) + 3600;

  // Day
  const dKey = breakDayKey(agentId, day);
  const dCur = await redis.get(dKey);
  await redis.set(dKey, String((dCur ? parseInt(dCur) : 0) + durationMs), secUntilEOD);

  // Week
  const wKey = breakWeekKey(agentId, week);
  const wCur = await redis.get(wKey);
  await redis.set(wKey, String((wCur ? parseInt(wCur) : 0) + durationMs), 7 * 86400);

  // Month
  const mKey = breakMonthKey(agentId, month);
  const mCur = await redis.get(mKey);
  await redis.set(mKey, String((mCur ? parseInt(mCur) : 0) + durationMs), 31 * 86400);
}

/**
 * Get accumulated break times.
 */
export async function getBreakAccumulation(agentId: string): Promise<{
  dailyMs: number; weeklyMs: number; monthlyMs: number;
  dailyLimitMs: number; weeklyLimitMs: number; monthlyLimitMs: number;
}> {
  const cfg = await resolveConfig(agentId);
  const dailyLimitMs = cfg.maxDailyBreakMinutes * 60_000;

  const [dRaw, wRaw, mRaw] = await Promise.all([
    redis.get(breakDayKey(agentId, todayStr())),
    redis.get(breakWeekKey(agentId, weekStr())),
    redis.get(breakMonthKey(agentId, monthStr())),
  ]);

  return {
    dailyMs:  dRaw ? parseInt(dRaw) : 0,
    weeklyMs: wRaw ? parseInt(wRaw) : 0,
    monthlyMs: mRaw ? parseInt(mRaw) : 0,
    dailyLimitMs,
    weeklyLimitMs: dailyLimitMs * 5,   // 5 working days
    monthlyLimitMs: dailyLimitMs * 22,  // ~22 working days
  };
}

async function checkDailyBreakQuota(
  agentId: string,
  nextStateCode: string,
  cfg: ResolvedConfig,
  auxState: IAuxiliaryState
): Promise<StateChangeResult> {
  const stateLimit = auxState.maxDailyMinutes;
  const globalLimit = cfg.maxDailyBreakMinutes;
  const effectiveLimit = stateLimit ?? globalLimit;
  if (!effectiveLimit || effectiveLimit <= 0) return { allowed: true };

  const day = todayStr();
  const key = breakDayKey(agentId, day);
  const raw = await redis.get(key);
  const usedMs = raw ? parseInt(raw) : 0;
  const usedMin = usedMs / 60_000;

  if (usedMin >= effectiveLimit) {
    return {
      allowed: false,
      reason: `Break quota exceeded: ${Math.floor(usedMin)}/${effectiveLimit} min used today`,
    };
  }

  // Warn at 80%
  if (usedMin >= effectiveLimit * 0.8) {
    logger.warn('presence', {
      action: 'break_quota_warning',
      agentId,
      usedMin: Math.floor(usedMin),
      limitMin: effectiveLimit,
    });
  }

  return { allowed: true };
}

// ─── 5. IDLE DETECTION ───────────────────────────────────────────────────────

/**
 * Called periodically by the heartbeat monitor. If enableAutoBreak and
 * agent has been idle (no chats, state = available) for > autoBreakOnIdleMinutes,
 * returns the target state code for auto-transition.
 */
export async function checkIdleAutoBreak(agentId: string): Promise<string | null> {
  const cfg = await resolveConfig(agentId);
  if (cfg.autoBreakOnIdleMinutes <= 0) return null;

  const agent = await Agent.findById(agentId)
    .select('auxiliaryStateCode activeChats lastActivity')
    .lean() as any;
  if (!agent) return null;

  if (agent.auxiliaryStateCode !== 'available') return null;
  if ((agent.activeChats || 0) > 0) return null;

  const lastAct = agent.lastActivity ? new Date(agent.lastActivity).getTime() : 0;
  const idleMs = Date.now() - lastAct;
  if (idleMs > cfg.autoBreakOnIdleMinutes * 60_000) {
    return cfg.autoBreakTargetStateCode || 'break';
  }

  return null;
}

// ─── 6. SUPERVISOR BREAK RESET ───────────────────────────────────────────────

export async function resetBreakCounter(agentId: string, supervisorId: string): Promise<void> {
  const day = todayStr();
  await redis.del(breakDayKey(agentId, day));
  logger.info('presence', { action: 'break_counter_reset', agentId, supervisorId });
}

// ─── 7. AUTO-BUSY WHEN MAX CHATS ────────────────────────────────────────────

/**
 * Called after a chat is assigned. If enableAutoSetBusyWhenMaxChats and
 * agent is now at capacity, trigger state change to 'busy'.
 */
export async function checkAutoBusyAfterAssignment(agentId: string): Promise<boolean> {
  const cfg = await resolveConfig(agentId);
  if (!cfg.autoSetBusyWhenMaxChats) return false;

  const agent = await Agent.findById(agentId)
    .select('activeChats maxChatsOverride auxiliaryStateCode')
    .lean() as any;
  if (!agent || agent.auxiliaryStateCode !== 'available') return false;

  const capacity = await resolveAgentCapacity(agentId);
  if ((agent.activeChats || 0) >= capacity) {
    return true; // Caller should trigger state change to 'busy'
  }
  return false;
}

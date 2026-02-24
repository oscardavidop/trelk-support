/**
 * AgentEngineConfig Model - Central configuration for the Agent Rule Engine
 *
 * Stored in collection `agent_engine_configs`.
 * Three scopes: 'global' | 'team' | 'agent'
 * Priority resolution: agent > team > global > hardcoded defaults.
 *
 * Only ONE document per scope + scopeRef combination.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IAgentEngineConfig extends Document {
  _id: Types.ObjectId;

  /** 'global' | 'team' | 'agent' */
  scope: 'global' | 'team' | 'agent';

  /** ObjectId of Team/Agent when scope != 'global'. null for global. */
  scopeRef: string | null;

  /** Human label for dashboard display */
  label: string;

  // ── Assignment & Capacity ──
  maxChatsDefault: number;
  allowMultiSession: boolean;
  blockAssignmentIfNoHeartbeat: boolean;
  autoSetBusyWhenMaxChats: boolean;
  allowStateChangeWithActiveChats: boolean;
  maxConcurrentSessions: number;
  enableDynamicCapacity: boolean;

  // ── Heartbeat & Presence ──
  heartbeatTimeoutSeconds: number;
  reconcileOnBoot: boolean;

  // ── Break ──
  maxDailyBreakMinutes: number;
  breakRequiresReason: boolean;
  countBreakAsPaid: boolean;

  // ── Payroll ──
  strictPayrollMode: boolean;

  // ── Idle Detection ──
  autoBreakOnIdleMinutes: number;          // 0 = disabled
  autoBreakTargetStateCode: string;        // e.g. 'break' or 'auto-break'

  // ── Supervisor ──
  allowSupervisorForceState: boolean;
  allowManualBusy: boolean;

  // ── Feature Flags ──
  enableAuxiliaryRules: boolean;
  enableSlaImpact: boolean;

  /** Version counter — incremented on every save for cache invalidation */
  version: number;

  createdAt: Date;
  updatedAt: Date;
}

// ─── Plain config shape (without Mongoose Document methods) ──────────────────

export type EngineConfigFields = {
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
};

// ─── Hardcoded defaults (fallback of last resort) ─────────────────────────────

export const ENGINE_DEFAULTS: EngineConfigFields = {
  maxChatsDefault: 5,
  allowMultiSession: false,
  blockAssignmentIfNoHeartbeat: true,
  autoSetBusyWhenMaxChats: true,
  allowStateChangeWithActiveChats: true,
  maxConcurrentSessions: 1,
  enableDynamicCapacity: false,

  heartbeatTimeoutSeconds: 90,
  reconcileOnBoot: true,

  maxDailyBreakMinutes: 60,
  breakRequiresReason: true,
  countBreakAsPaid: false,

  strictPayrollMode: false,

  autoBreakOnIdleMinutes: 0,
  autoBreakTargetStateCode: 'break',

  allowSupervisorForceState: true,
  allowManualBusy: true,

  enableAuxiliaryRules: true,
  enableSlaImpact: false,
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const AgentEngineConfigSchema = new Schema<IAgentEngineConfig>(
  {
    scope: {
      type: String,
      enum: ['global', 'team', 'agent'],
      required: true,
    },
    scopeRef: {
      type: String,
      default: null,
      index: true,
    },
    label: {
      type: String,
      default: 'Global Config',
    },

    // Assignment & Capacity
    maxChatsDefault:                  { type: Number,  default: ENGINE_DEFAULTS.maxChatsDefault },
    allowMultiSession:                { type: Boolean, default: ENGINE_DEFAULTS.allowMultiSession },
    blockAssignmentIfNoHeartbeat:     { type: Boolean, default: ENGINE_DEFAULTS.blockAssignmentIfNoHeartbeat },
    autoSetBusyWhenMaxChats:          { type: Boolean, default: ENGINE_DEFAULTS.autoSetBusyWhenMaxChats },
    allowStateChangeWithActiveChats:  { type: Boolean, default: ENGINE_DEFAULTS.allowStateChangeWithActiveChats },
    maxConcurrentSessions:            { type: Number,  default: ENGINE_DEFAULTS.maxConcurrentSessions },
    enableDynamicCapacity:            { type: Boolean, default: ENGINE_DEFAULTS.enableDynamicCapacity },

    // Heartbeat & Presence
    heartbeatTimeoutSeconds: { type: Number,  default: ENGINE_DEFAULTS.heartbeatTimeoutSeconds },
    reconcileOnBoot:         { type: Boolean, default: ENGINE_DEFAULTS.reconcileOnBoot },

    // Break
    maxDailyBreakMinutes: { type: Number,  default: ENGINE_DEFAULTS.maxDailyBreakMinutes },
    breakRequiresReason:  { type: Boolean, default: ENGINE_DEFAULTS.breakRequiresReason },
    countBreakAsPaid:     { type: Boolean, default: ENGINE_DEFAULTS.countBreakAsPaid },

    // Payroll
    strictPayrollMode: { type: Boolean, default: ENGINE_DEFAULTS.strictPayrollMode },

    // Idle Detection
    autoBreakOnIdleMinutes:    { type: Number, default: ENGINE_DEFAULTS.autoBreakOnIdleMinutes },
    autoBreakTargetStateCode:  { type: String, default: ENGINE_DEFAULTS.autoBreakTargetStateCode },

    // Supervisor
    allowSupervisorForceState: { type: Boolean, default: ENGINE_DEFAULTS.allowSupervisorForceState },
    allowManualBusy:           { type: Boolean, default: ENGINE_DEFAULTS.allowManualBusy },

    // Feature Flags
    enableAuxiliaryRules: { type: Boolean, default: ENGINE_DEFAULTS.enableAuxiliaryRules },
    enableSlaImpact:      { type: Boolean, default: ENGINE_DEFAULTS.enableSlaImpact },

    version: { type: Number, default: 1 },
  },
  { timestamps: true, collection: 'agent_engine_configs' }
);

AgentEngineConfigSchema.index({ scope: 1, scopeRef: 1 }, { unique: true });

// Auto-increment version on save
AgentEngineConfigSchema.pre('save', function () {
  if (!this.isNew) {
    this.version = (this.version || 0) + 1;
  }
});

export const AgentEngineConfig = mongoose.model<IAgentEngineConfig>(
  'AgentEngineConfig',
  AgentEngineConfigSchema
);

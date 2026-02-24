/**
 * AuxiliaryState Model - Configurable agent status states
 * 
 * These define the "auxiliaries" (states like available, busy, break_lunch, etc.)
 * Each can have custom rules: receives chats, counts paid time, expiry, break quota, etc.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAuxiliaryState extends Document {
  _id: Types.ObjectId;

  // Identity
  code: string;           // Unique code, e.g. 'available', 'break_lunch', 'break_tech'
  label: string;          // Display name
  color: string;          // Hex color for UI (#22c55e)
  icon?: string;          // Emoji or icon name

  // System flag (built-in states cannot be deleted)
  isDefault: boolean;

  // Rules
  receivesChats: boolean;         // Can receive new chat assignments
  countsPaidTime: boolean;        // Counts as paid working time
  visibleInWallboard: boolean;    // Show on supervisor wallboard
  autoExpireMinutes?: number;     // Auto-transition after X minutes (null = never)
  transitionToCode?: string;      // Which state to auto-transition to after expiry

  // Break config
  requiresReason: boolean;        // Must pick a reason when entering this state
  allowedReasons: string[];       // Selectable reasons (e.g. ['Almuerzo', 'Personal'])
  maxDailyMinutes?: number;       // Break quota: max minutes per day in this state

  // Transition rules
  blocksAssignment: boolean;      // Blocks chat assignment while in this state
  affectsSla: boolean;            // Whether this state pauses SLA timers
  allowedFromStates: string[];    // Codes from which you can transition TO this state (empty = any)
  allowedToStates: string[];      // Codes you can transition FROM this state to (empty = any)

  // Access control
  allowAgentManualSet: boolean;   // Agent can set this themselves
  requiresSupervisorApproval: boolean;

  // Ordering
  sortOrder: number;
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const AuxiliaryStateSchema = new Schema<IAuxiliaryState>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      default: '#6b7280',
    },
    icon: String,
    isDefault: {
      type: Boolean,
      default: false,
    },

    // Rules
    receivesChats: {
      type: Boolean,
      default: false,
    },
    countsPaidTime: {
      type: Boolean,
      default: true,
    },
    visibleInWallboard: {
      type: Boolean,
      default: true,
    },
    autoExpireMinutes: {
      type: Number,
      default: null,
    },
    transitionToCode: {
      type: String,
      default: 'available',
    },

    // Break config
    requiresReason: {
      type: Boolean,
      default: false,
    },
    allowedReasons: {
      type: [String],
      default: [],
    },
    maxDailyMinutes: {
      type: Number,
      default: null,
    },

    // Transition rules
    blocksAssignment: {
      type: Boolean,
      default: false,
    },
    affectsSla: {
      type: Boolean,
      default: false,
    },
    allowedFromStates: {
      type: [String],
      default: [],
    },
    allowedToStates: {
      type: [String],
      default: [],
    },

    // Access control
    allowAgentManualSet: {
      type: Boolean,
      default: true,
    },
    requiresSupervisorApproval: {
      type: Boolean,
      default: false,
    },

    sortOrder: {
      type: Number,
      default: 99,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

AuxiliaryStateSchema.index({ code: 1 }, { unique: true });
AuxiliaryStateSchema.index({ isActive: 1, sortOrder: 1 });

export const AuxiliaryState = mongoose.model<IAuxiliaryState>(
  'AuxiliaryState',
  AuxiliaryStateSchema
);

// ─── Default states seeded on first boot ─────────────────────────────────────

export const DEFAULT_AUXILIARY_STATES: Omit<IAuxiliaryState, '_id' | 'createdAt' | 'updatedAt'>[] = [
  {
    code: 'available',
    label: 'Disponible',
    color: '#22c55e',
    icon: '🟢',
    isDefault: true,
    receivesChats: true,
    countsPaidTime: true,
    visibleInWallboard: true,
    autoExpireMinutes: undefined,
    transitionToCode: undefined,
    requiresReason: false,
    allowedReasons: [],
    maxDailyMinutes: undefined,
    blocksAssignment: false,
    affectsSla: false,
    allowedFromStates: [],
    allowedToStates: [],
    allowAgentManualSet: true,
    requiresSupervisorApproval: false,
    sortOrder: 1,
    isActive: true,
  } as any,
  {
    code: 'busy',
    label: 'Ocupado',
    color: '#f97316',
    icon: '🟠',
    isDefault: true,
    receivesChats: false,
    countsPaidTime: true,
    visibleInWallboard: true,
    autoExpireMinutes: undefined,
    transitionToCode: undefined,
    requiresReason: false,
    allowedReasons: [],
    maxDailyMinutes: undefined,
    blocksAssignment: true,
    affectsSla: false,
    allowedFromStates: ['available'],
    allowedToStates: ['available'],
    allowAgentManualSet: true,
    requiresSupervisorApproval: false,
    sortOrder: 2,
    isActive: true,
  } as any,
  {
    code: 'break',
    label: 'Descanso',
    color: '#eab308',
    icon: '🟡',
    isDefault: true,
    receivesChats: false,
    countsPaidTime: false,
    visibleInWallboard: true,
    autoExpireMinutes: 30,
    transitionToCode: 'available',
    requiresReason: true,
    allowedReasons: ['Personal', 'Almuerzo', 'Técnico', 'Reunión', 'Otro'],
    maxDailyMinutes: 60,
    blocksAssignment: true,
    affectsSla: false,
    allowedFromStates: ['available'],
    allowedToStates: ['available'],
    allowAgentManualSet: true,
    requiresSupervisorApproval: false,
    sortOrder: 3,
    isActive: true,
  } as any,
  {
    code: 'offline',
    label: 'Desconectado',
    color: '#6b7280',
    icon: '⚫',
    isDefault: true,
    receivesChats: false,
    countsPaidTime: false,
    visibleInWallboard: false,
    autoExpireMinutes: undefined,
    transitionToCode: undefined,
    requiresReason: false,
    allowedReasons: [],
    maxDailyMinutes: undefined,
    blocksAssignment: true,
    affectsSla: false,
    allowedFromStates: [],
    allowedToStates: ['available'],
    allowAgentManualSet: false,
    requiresSupervisorApproval: false,
    sortOrder: 99,
    isActive: true,
  } as any,
];

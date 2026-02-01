/**
 * Agent Model - Support agents who respond via dashboard
 * 
 * Roles:
 * - admin: Full access, manage settings, rules, and agents
 * - supervisor: Live monitoring, whisper, view all chats, intervene
 * - support: Handle assigned chats, basic actions
 * - junior: Limited access, supervised mode, cannot close chats without approval
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export type AgentRole = 'admin' | 'supervisor' | 'support' | 'junior';
export type OnlineStatus = 'online' | 'away' | 'offline';
export type AvailabilityStatus = 'available' | 'busy' | 'offline';

// Maximum concurrent chats per agent before becoming "busy"
export const MAX_CONCURRENT_CHATS = 5;

// Reconnection grace period in minutes
export const RECONNECTION_GRACE_MINUTES = 5;

// Role hierarchy (higher number = more permissions)
export const ROLE_HIERARCHY: Record<AgentRole, number> = {
  junior: 1,
  support: 2,
  supervisor: 3,
  admin: 4,
};

// Role permissions
export const ROLE_PERMISSIONS: Record<AgentRole, string[]> = {
  junior: [
    'chat:view',
    'chat:respond',
    'chat:transfer',
    'note:create',
    'note:view',
  ],
  support: [
    'chat:view',
    'chat:respond',
    'chat:close',
    'chat:transfer',
    'chat:reopen',
    'note:create',
    'note:view',
    'note:edit',
    'tag:add',
    'tag:remove',
    'savedReply:use',
  ],
  supervisor: [
    'chat:view',
    'chat:viewAll',
    'chat:respond',
    'chat:close',
    'chat:transfer',
    'chat:reopen',
    'chat:takeover',
    'chat:monitor',
    'whisper:send',
    'note:create',
    'note:view',
    'note:edit',
    'note:delete',
    'tag:add',
    'tag:remove',
    'savedReply:use',
    'savedReply:create',
    'export:session',
    'agent:viewStatus',
    'analytics:view',
  ],
  admin: [
    '*', // All permissions
  ],
};

export interface IAgentMetrics {
  averageRating?: number;
  totalRatings?: number;
  satisfactionPositive?: number;
  satisfactionNeutral?: number;
  satisfactionNegative?: number;
}

/**
 * Permission overrides for individual agents
 * Allows granting/revoking specific permissions beyond their role
 */
export interface IPermissionsOverride {
  allow: string[];   // Additional permissions granted
  deny: string[];    // Permissions explicitly denied
}

export interface IAgent extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: AgentRole;
  onlineStatus: OnlineStatus;
  isActive: boolean;
  avatar?: string;
  telegramId?: number;
  lastLogin?: Date;
  lastActivity?: Date;
  lastDisconnect?: Date;
  socketId?: string;
  activeChats: number;
  totalChatsHandled: number;
  
  // Agent metrics
  metrics?: IAgentMetrics;
  
  // Team membership
  teamId?: Types.ObjectId;
  
  // Supervisor-specific
  isSupervisingEnabled?: boolean;
  watchingSessions?: string[];
  
  // RBAC: Custom role reference (if using custom roles)
  roleId?: Types.ObjectId;
  
  // RBAC: Permission overrides per user
  permissionsOverride?: IPermissionsOverride;
  
  // RBAC: Cached effective permissions (for quick lookup)
  // This is populated at login and refreshed when permissions change
  _effectivePermissions?: string[];
  
  // Permission version for cache invalidation
  permissionVersion?: number;
  
  // Whether the agent can request permissions (can be blocked by admin)
  canRequestPermissions?: boolean;
  
  // Password management
  forcePasswordChange?: boolean;         // Force user to change password on next login
  lastPasswordChangeAt?: Date;           // When password was last changed
  passwordResetBlockedUntil?: Date;      // Rate limit: blocked until this time
  passwordResetAttempts?: number;        // Number of reset attempts in current window
  passwordResetAttemptsResetAt?: Date;   // When to reset the attempt counter
  
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  getAvailabilityStatus(): AvailabilityStatus;
  hasPermission(permission: string): boolean;
  canSupervise(): boolean;
}

const AgentSchema = new Schema<IAgent>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'supervisor', 'support', 'junior'],
      default: 'support',
    },
    onlineStatus: {
      type: String,
      enum: ['online', 'away', 'offline'],
      default: 'offline',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    avatar: String,
    telegramId: {
      type: Number,
      sparse: true,
    },
    lastLogin: Date,
    lastActivity: Date,
    lastDisconnect: Date,
    socketId: {
      type: String,
      sparse: true,
    },
    activeChats: {
      type: Number,
      default: 0,
    },
    totalChatsHandled: {
      type: Number,
      default: 0,
    },
    // Team membership
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      index: true,
    },
    // Supervisor-specific
    isSupervisingEnabled: {
      type: Boolean,
      default: false,
    },
    watchingSessions: [{
      type: String,
    }],
    // RBAC: Custom role reference
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'Role',
      index: true,
    },
    // RBAC: Permission overrides
    permissionsOverride: {
      allow: [{
        type: String,
        trim: true,
      }],
      deny: [{
        type: String,
        trim: true,
      }],
    },
    // RBAC: Permission version for cache invalidation
    permissionVersion: {
      type: Number,
      default: 1,
    },
    // Whether the agent can request permissions
    canRequestPermissions: {
      type: Boolean,
      default: true,
    },
    // Password management
    forcePasswordChange: {
      type: Boolean,
      default: false,
    },
    lastPasswordChangeAt: {
      type: Date,
      default: null,
    },
    passwordResetBlockedUntil: {
      type: Date,
      default: null,
    },
    passwordResetAttempts: {
      type: Number,
      default: 0,
    },
    passwordResetAttemptsResetAt: {
      type: Date,
      default: null,
    },
    // Survey metrics
    metrics: {
      averageRating: {
        type: Number,
        default: 0,
      },
      totalRatings: {
        type: Number,
        default: 0,
      },
      satisfactionPositive: {
        type: Number,
        default: 0,
      },
      satisfactionNeutral: {
        type: Number,
        default: 0,
      },
      satisfactionNegative: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
AgentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
AgentSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get availability status based on active chats
AgentSchema.methods.getAvailabilityStatus = function (): AvailabilityStatus {
  if (this.onlineStatus === 'offline') return 'offline';
  if (this.activeChats >= MAX_CONCURRENT_CHATS) return 'busy';
  return 'available';
};

// Check if agent has a specific permission
AgentSchema.methods.hasPermission = function (permission: string): boolean {
  const rolePermissions = ROLE_PERMISSIONS[this.role as AgentRole] || [];
  return rolePermissions.includes('*') || rolePermissions.includes(permission);
};

// Check if agent can supervise other agents
AgentSchema.methods.canSupervise = function (): boolean {
  return ROLE_HIERARCHY[this.role as AgentRole] >= ROLE_HIERARCHY.supervisor;
};

// Remove sensitive data when converting to JSON
AgentSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const { password, ...rest } = ret.toObject ? ret.toObject() : ret;
    return rest;
  },
});

export const Agent = mongoose.model<IAgent>('Agent', AgentSchema);

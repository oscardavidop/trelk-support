/**
 * Login Policy Model - Agent login rules and restrictions
 * Configurable policies that are evaluated after successful authentication
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============= INTERFACES =============

/**
 * Time range for working hours
 */
export interface ITimeRange {
  start: string;  // HH:mm format
  end: string;    // HH:mm format
}

/**
 * Role-based redirect configuration
 */
export interface IRoleRedirect {
  role: string;
  redirectTo: string;
}

/**
 * IP/Country restriction configuration
 */
export interface ILocationRestriction {
  enabled: boolean;
  allowedCountries: string[];  // ISO country codes
  allowedIpRanges: string[];   // CIDR notation
  blockAction: 'block' | 'alert' | 'mfa';
}

/**
 * Device trust configuration
 */
export interface IDeviceTrust {
  enabled: boolean;
  requireMFAOnNewDevice: boolean;
  maxTrustedDevices: number;
  trustDurationDays: number;
}

/**
 * Session policy configuration
 */
export interface ISessionPolicy {
  maxConcurrentSessions: number;
  forceLogoutOnNewLogin: boolean;
  maxSessionAgeHours: number;
  requireReauthAfterHours: number;
  forceLogoutAtTime?: string;  // HH:mm format
}

/**
 * Profile requirements
 */
export interface IProfileRequirements {
  requireTelegramLink: boolean;
  requireMFAEnabled: boolean;
  requireDisplayName: boolean;
  requireAvatar: boolean;
  blockUntilComplete: boolean;
}

/**
 * Auto status configuration
 */
export interface IAutoStatus {
  enabled: boolean;
  defaultStatusOnLogin: 'online' | 'away' | 'busy';
  statusOutsideHours: 'away' | 'offline';
  setOfflineOnLogout: boolean;
}

/**
 * Auto queue assignment
 */
export interface IAutoQueueAssignment {
  enabled: boolean;
  queues: string[];  // Queue IDs or names
  byRole: { role: string; queues: string[] }[];
}

/**
 * Global broadcast/alert configuration
 */
export interface IGlobalAlert {
  enabled: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical';
  requireAcknowledge: boolean;
  showFullScreen: boolean;
  expiresAt?: Date;
}

/**
 * Maintenance mode configuration
 */
export interface IMaintenanceMode {
  enabled: boolean;
  allowedRoles: string[];
  readOnlyForOthers: boolean;
  message: string;
}

/**
 * Supervisor notifications configuration
 */
export interface ISupervisorAlerts {
  onLoginOutsideHours: boolean;
  onNewDeviceLogin: boolean;
  onBlockedLogin: boolean;
  onSuspiciousActivity: boolean;
  onMultipleFailedAttempts: boolean;
}

/**
 * Policy acceptance requirement
 */
export interface IPolicyAcceptance {
  enabled: boolean;
  version: string;
  title: string;
  content: string;
  updatedAt: Date;
}

/**
 * Chat action rules - rules for in-chat actions
 */
export interface IChatActionRule {
  id: string;
  name: string;
  enabled: boolean;
  action: 'close_chat' | 'transfer_chat' | 'reopen_chat' | 'delete_message' | 'block_user' | 'send_file' | 'use_canned_response';
  condition: {
    type: 'require_note' | 'require_tag' | 'require_approval' | 'role_restriction' | 'time_restriction' | 'custom';
    roles?: string[];
    minNoteLength?: number;
    requiredTags?: string[];
    approvalRoles?: string[];
    allowedHours?: ITimeRange;
    customCheck?: string;  // JavaScript expression for advanced checks
  };
  errorMessage: string;
  bypassRoles: string[];
}

/**
 * Main Login Policy Document
 */
export interface ILoginPolicy extends Document {
  _id: Types.ObjectId;
  
  // Working hours
  workingHours: {
    enabled: boolean;
    schedule: ITimeRange;
    timezone: string;
    daysOfWeek: number[];  // 0-6, Sunday = 0
    blockOutsideHours: boolean;
    allowReadOnlyOutsideHours: boolean;
  };

  // Redirects
  redirects: {
    defaultLandingPage: string;
    roleBasedRedirects: IRoleRedirect[];
    forceCompleteProfile: boolean;
    profileCompletionPage: string;
  };

  // Location restrictions
  locationRestriction: ILocationRestriction;

  // Device trust
  deviceTrust: IDeviceTrust;

  // Session policy
  sessionPolicy: ISessionPolicy;

  // Profile requirements
  profileRequirements: IProfileRequirements;

  // Auto status
  autoStatus: IAutoStatus;

  // Auto queue assignment
  autoQueueAssignment: IAutoQueueAssignment;

  // Global alerts
  globalAlert: IGlobalAlert;

  // Maintenance mode
  maintenanceMode: IMaintenanceMode;

  // Supervisor alerts
  supervisorAlerts: ISupervisorAlerts;

  // Policy acceptance
  policyAcceptance: IPolicyAcceptance;

  // Chat action rules
  chatActionRules: IChatActionRule[];

  // Audit settings
  audit: {
    logAllLogins: boolean;
    logFailedAttempts: boolean;
    logRuleEvaluations: boolean;
    retentionDays: number;
  };

  // Metadata
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ============= SCHEMA =============

const LoginPolicySchema = new Schema<ILoginPolicy>(
  {
    // Working hours
    workingHours: {
      enabled: { type: Boolean, default: false },
      schedule: {
        start: { type: String, default: '09:00' },
        end: { type: String, default: '18:00' },
      },
      timezone: { type: String, default: 'America/Bogota' },
      daysOfWeek: { type: [Number], default: [1, 2, 3, 4, 5] },  // Mon-Fri
      blockOutsideHours: { type: Boolean, default: false },
      allowReadOnlyOutsideHours: { type: Boolean, default: true },
    },

    // Redirects
    redirects: {
      defaultLandingPage: { type: String, default: '/chat' },
      roleBasedRedirects: [{
        role: { type: String, required: true },
        redirectTo: { type: String, required: true },
      }],
      forceCompleteProfile: { type: Boolean, default: true },
      profileCompletionPage: { type: String, default: '/my-settings' },
    },

    // Location restrictions
    locationRestriction: {
      enabled: { type: Boolean, default: false },
      allowedCountries: { type: [String], default: [] },
      allowedIpRanges: { type: [String], default: [] },
      blockAction: { type: String, enum: ['block', 'alert', 'mfa'], default: 'alert' },
    },

    // Device trust
    deviceTrust: {
      enabled: { type: Boolean, default: true },
      requireMFAOnNewDevice: { type: Boolean, default: true },
      maxTrustedDevices: { type: Number, default: 5 },
      trustDurationDays: { type: Number, default: 30 },
    },

    // Session policy
    sessionPolicy: {
      maxConcurrentSessions: { type: Number, default: 1 },
      forceLogoutOnNewLogin: { type: Boolean, default: true },
      maxSessionAgeHours: { type: Number, default: 24 },
      requireReauthAfterHours: { type: Number, default: 12 },
      forceLogoutAtTime: { type: String, default: '' },
    },

    // Profile requirements
    profileRequirements: {
      requireTelegramLink: { type: Boolean, default: true },
      requireMFAEnabled: { type: Boolean, default: false },
      requireDisplayName: { type: Boolean, default: true },
      requireAvatar: { type: Boolean, default: false },
      blockUntilComplete: { type: Boolean, default: false },
    },

    // Auto status
    autoStatus: {
      enabled: { type: Boolean, default: true },
      defaultStatusOnLogin: { type: String, enum: ['online', 'away', 'busy'], default: 'online' },
      statusOutsideHours: { type: String, enum: ['away', 'offline'], default: 'away' },
      setOfflineOnLogout: { type: Boolean, default: true },
    },

    // Auto queue assignment
    autoQueueAssignment: {
      enabled: { type: Boolean, default: false },
      queues: { type: [String], default: [] },
      byRole: [{
        role: { type: String, required: true },
        queues: { type: [String], default: [] },
      }],
    },

    // Global alerts
    globalAlert: {
      enabled: { type: Boolean, default: false },
      title: { type: String, default: '' },
      message: { type: String, default: '' },
      type: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
      requireAcknowledge: { type: Boolean, default: false },
      showFullScreen: { type: Boolean, default: false },
      expiresAt: { type: Date },
    },

    // Maintenance mode
    maintenanceMode: {
      enabled: { type: Boolean, default: false },
      allowedRoles: { type: [String], default: ['admin'] },
      readOnlyForOthers: { type: Boolean, default: true },
      message: { type: String, default: 'El sistema está en mantenimiento. Solo lectura disponible.' },
    },

    // Supervisor alerts
    supervisorAlerts: {
      onLoginOutsideHours: { type: Boolean, default: true },
      onNewDeviceLogin: { type: Boolean, default: true },
      onBlockedLogin: { type: Boolean, default: true },
      onSuspiciousActivity: { type: Boolean, default: true },
      onMultipleFailedAttempts: { type: Boolean, default: true },
    },

    // Policy acceptance
    policyAcceptance: {
      enabled: { type: Boolean, default: false },
      version: { type: String, default: '1.0' },
      title: { type: String, default: 'Términos y Condiciones de Uso' },
      content: { type: String, default: '' },
      updatedAt: { type: Date, default: Date.now },
    },

    // Chat action rules
    chatActionRules: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      enabled: { type: Boolean, default: true },
      action: { 
        type: String, 
        enum: ['close_chat', 'transfer_chat', 'reopen_chat', 'delete_message', 'block_user', 'send_file', 'use_canned_response'],
        required: true 
      },
      condition: {
        type: { 
          type: String, 
          enum: ['require_note', 'require_tag', 'require_approval', 'role_restriction', 'time_restriction', 'custom'],
          required: true 
        },
        roles: { type: [String], default: [] },
        minNoteLength: { type: Number, default: 10 },
        requiredTags: { type: [String], default: [] },
        approvalRoles: { type: [String], default: ['supervisor', 'admin'] },
        allowedHours: {
          start: { type: String },
          end: { type: String },
        },
        customCheck: { type: String },
      },
      errorMessage: { type: String, required: true },
      bypassRoles: { type: [String], default: ['admin'] },
    }],

    // Audit settings
    audit: {
      logAllLogins: { type: Boolean, default: true },
      logFailedAttempts: { type: Boolean, default: true },
      logRuleEvaluations: { type: Boolean, default: true },
      retentionDays: { type: Number, default: 90 },
    },

    // Metadata
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
  },
  {
    timestamps: true,
  }
);

// ============= STATICS =============

/**
 * Get the singleton policy document (create if not exists)
 */
LoginPolicySchema.statics.getPolicy = async function(): Promise<ILoginPolicy> {
  let policy = await this.findOne({});
  if (!policy) {
    policy = await this.create({
      // Default chat action rules
      chatActionRules: [
        {
          id: 'close_requires_note',
          name: 'Cerrar chat requiere nota',
          enabled: true,
          action: 'close_chat',
          condition: {
            type: 'require_note',
            minNoteLength: 10,
          },
          errorMessage: 'Debes agregar una nota (mínimo 10 caracteres) antes de cerrar el chat',
          bypassRoles: ['admin', 'supervisor'],
        },
        {
          id: 'transfer_supervisor_only',
          name: 'Solo supervisores pueden transferir',
          enabled: false,
          action: 'transfer_chat',
          condition: {
            type: 'role_restriction',
            roles: ['supervisor', 'admin'],
          },
          errorMessage: 'Solo supervisores y administradores pueden transferir chats',
          bypassRoles: ['admin'],
        },
        {
          id: 'close_requires_tag',
          name: 'Cerrar chat requiere etiqueta',
          enabled: false,
          action: 'close_chat',
          condition: {
            type: 'require_tag',
            requiredTags: ['resolved', 'spam', 'duplicate'],
          },
          errorMessage: 'Debes agregar una etiqueta de resolución antes de cerrar',
          bypassRoles: ['admin'],
        },
        {
          id: 'block_requires_approval',
          name: 'Bloquear usuario requiere aprobación',
          enabled: false,
          action: 'block_user',
          condition: {
            type: 'require_approval',
            approvalRoles: ['supervisor', 'admin'],
          },
          errorMessage: 'Bloquear usuarios requiere aprobación de un supervisor',
          bypassRoles: ['admin'],
        },
      ],
    });
  }
  return policy;
};

// Interface for static methods
interface ILoginPolicyModel extends mongoose.Model<ILoginPolicy> {
  getPolicy(): Promise<ILoginPolicy>;
}

export const LoginPolicy = mongoose.model<ILoginPolicy, ILoginPolicyModel>('LoginPolicy', LoginPolicySchema);

// ============= TYPES FOR POLICY EVALUATION =============

export interface PolicyContext {
  agent: {
    id: string;
    email: string;
    role: string;
    telegramId?: number;
    mfaEnabled?: boolean;
    displayName?: string;
    avatar?: string;
    suspended?: boolean;
    acceptedPolicyVersion?: string;
  };
  device: {
    fingerprint?: string;
    ip: string;
    userAgent?: string;
    country?: string;
    isNewDevice?: boolean;
  };
  session: {
    createdAt?: Date;
    lastActivity?: Date;
  };
  timestamp: Date;
}

export interface PolicyResult {
  allowed: boolean;
  blocked: boolean;
  blockReason?: string;
  redirect?: string;
  warnings: string[];
  actions: {
    type: string;
    data?: Record<string, unknown>;
  }[];
  flags: {
    readOnlyMode: boolean;
    requirePolicyAcceptance: boolean;
    requireProfileCompletion: boolean;
    requireMFA: boolean;
    showGlobalAlert: boolean;
  };
  globalAlert?: IGlobalAlert;
  appliedRules: string[];
  auditData: {
    timestamp: Date;
    ip: string;
    device?: string;
    rulesApplied: string[];
    actionsTaken: string[];
    blocked: boolean;
    blockReason?: string;
  };
}

export interface ChatActionContext {
  agent: {
    id: string;
    role: string;
  };
  chat: {
    id: string;
    hasNote?: boolean;
    noteLength?: number;
    tags?: string[];
    status?: string;
  };
  action: string;
  timestamp: Date;
}

export interface ChatActionResult {
  allowed: boolean;
  errorMessage?: string;
  requiresApproval?: boolean;
  approvalRoles?: string[];
  ruleId?: string;
}

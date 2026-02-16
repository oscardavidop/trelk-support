/**
 * Agent Login Policy Engine
 * Evaluates and enforces login rules for agents
 * 
 * This engine runs after successful authentication and before redirect
 * All rules are configurable from Dashboard Settings
 */

import { getRedisClient } from './redis.js';
import { logger } from './logger.js';
import { getIO } from './socket.js';
import {
  LoginPolicy,
  type ILoginPolicy,
  type PolicyContext,
  type PolicyResult,
  type ChatActionContext,
  type ChatActionResult,
  type IGlobalAlert,
} from '../database/models/LoginPolicy.js';
import { internalNotificationService } from './internal-notification.service.js';

// Re-export types for consumers
export type { PolicyContext, PolicyResult, ChatActionContext, ChatActionResult };

// ============= CONFIGURATION =============

const POLICY_CACHE_KEY = 'policy:login:main';
const POLICY_CACHE_TTL = 300; // 5 minutes

// In-memory fallback
let policyCache: ILoginPolicy | null = null;
let policyCacheTime = 0;
const MEMORY_CACHE_TTL = 60000; // 1 minute

// ============= CACHE FUNCTIONS =============

/**
 * Get cached login policy
 */
export async function getCachedPolicy(): Promise<ILoginPolicy> {
  const redis = getRedisClient();

  // Try Redis first
  if (redis) {
    try {
      const cached = await redis.get(POLICY_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        policyCache = parsed as ILoginPolicy;
        policyCacheTime = Date.now();
        return parsed as ILoginPolicy;
      }
    } catch (error) {
      logger.warn('policy-engine', { message: 'Redis cache read failed', error: String(error) });
    }
  }

  // Try memory cache
  if (policyCache && (Date.now() - policyCacheTime) < MEMORY_CACHE_TTL) {
    return policyCache;
  }

  // Load from DB
  return loadPolicyFromDB();
}

/**
 * Load policy from database and update caches
 */
async function loadPolicyFromDB(): Promise<ILoginPolicy> {
  const policy = await (LoginPolicy as any).getPolicy();

  // Update memory cache
  policyCache = policy;
  policyCacheTime = Date.now();

  // Update Redis cache
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.setex(POLICY_CACHE_KEY, POLICY_CACHE_TTL, JSON.stringify(policy));
    } catch (error) {
      logger.warn('policy-engine', { message: 'Redis cache write failed', error: String(error) });
    }
  }

  return policy;
}

/**
 * Invalidate policy cache
 */
export async function invalidatePolicyCache(): Promise<void> {
  policyCache = null;
  policyCacheTime = 0;

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(POLICY_CACHE_KEY);
    } catch (error) {
      logger.warn('policy-engine', { message: 'Redis cache delete failed', error: String(error) });
    }
  }
}

/**
 * Update login policy
 */
export async function updateLoginPolicy(
  data: Partial<ILoginPolicy>,
  updatedBy?: string
): Promise<ILoginPolicy> {
  const policy = await (LoginPolicy as any).getPolicy();

  // Deep merge the update
  const updateFields: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        // Nested object - merge fields
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          updateFields[`${key}.${subKey}`] = subValue;
        }
      } else {
        updateFields[key] = value;
      }
    }
  }

  if (updatedBy) {
    updateFields.updatedBy = updatedBy;
  }

  const updated = await LoginPolicy.findByIdAndUpdate(
    policy._id,
    { $set: updateFields },
    { new: true }
  );

  // Invalidate cache
  await invalidatePolicyCache();

  // Broadcast update
  broadcastPolicyUpdate(updated!);

  logger.info('policy-engine', {
    action: 'policy_updated',
    updatedBy,
    fields: Object.keys(data),
  });

  return updated!;
}

/**
 * Broadcast policy update to all connected clients
 */
function broadcastPolicyUpdate(policy: ILoginPolicy): void {
  try {
    const io = getIO();
    if (io) {
      io.emit('policy:updated', {
        timestamp: new Date().toISOString(),
        globalAlert: policy.globalAlert,
        maintenanceMode: policy.maintenanceMode,
      });
    }
  } catch {
    // IO might not be initialized
  }
}

// ============= POLICY ENGINE CORE =============

/**
 * Main policy evaluation function
 * Called after successful authentication
 */
export async function evaluateLoginPolicy(context: PolicyContext): Promise<PolicyResult> {
  const policy = await getCachedPolicy();
  
  // Debug logging
  console.log('[PolicyEngine] Evaluating login policy for:', {
    agentId: context.agent.id,
    email: context.agent.email,
    role: context.agent.role,
    country: context.device.country,
    ip: context.device.ip,
    isNewDevice: context.device.isNewDevice,
    locationRestrictionEnabled: policy.locationRestriction?.enabled,
    autoStatusEnabled: policy.autoStatus?.enabled,
    maintenanceModeEnabled: policy.maintenanceMode?.enabled,
  });
  
  const result: PolicyResult = {
    allowed: true,
    blocked: false,
    warnings: [],
    actions: [],
    flags: {
      readOnlyMode: false,
      requirePolicyAcceptance: false,
      requireProfileCompletion: false,
      requireMFA: false,
      showGlobalAlert: false,
    },
    appliedRules: [],
    auditData: {
      timestamp: context.timestamp,
      ip: context.device.ip,
      device: context.device.fingerprint,
      rulesApplied: [],
      actionsTaken: [],
      blocked: false,
    },
  };

  try {
    // Rule 1: Check if agent is suspended
    if (context.agent.suspended) {
      return blockLogin(result, 'agent_suspended', 'Tu cuenta ha sido suspendida. Contacta a un administrador.');
    }

    // Rule 2: Check maintenance mode
    const maintenanceResult = evaluateMaintenanceMode(policy, context);
    if (maintenanceResult.blocked) {
      return blockLogin(result, 'maintenance_mode', maintenanceResult.message!);
    }
    if (maintenanceResult.readOnly) {
      result.flags.readOnlyMode = true;
      result.warnings.push('Sistema en modo mantenimiento - Solo lectura');
      result.appliedRules.push('maintenance_read_only');
    }

    // Rule 3: Check working hours
    const workingHoursResult = evaluateWorkingHours(policy, context);
    if (workingHoursResult.blocked) {
      await notifySupervisors(policy, 'login_outside_hours', context);
      return blockLogin(result, 'outside_working_hours', workingHoursResult.message!);
    }
    if (workingHoursResult.readOnly) {
      result.flags.readOnlyMode = true;
      result.warnings.push('Fuera del horario laboral - Modo solo lectura');
      result.appliedRules.push('working_hours_read_only');
    }

    // Rule 4: Check location restrictions (IP/Country)
    const locationResult = evaluateLocationRestriction(policy, context);
    if (locationResult.blocked) {
      await notifySupervisors(policy, 'blocked_location', context);
      return blockLogin(result, 'location_restricted', locationResult.message!);
    }
    if (locationResult.requireMFA) {
      result.flags.requireMFA = true;
      result.appliedRules.push('location_mfa_required');
    }
    if (locationResult.warning) {
      result.warnings.push(locationResult.warning);
      await notifySupervisors(policy, 'suspicious_location', context);
    }

    // Rule 5: Check device trust (new device detection)
    const deviceResult = evaluateDeviceTrust(policy, context);
    if (deviceResult.isNewDevice && deviceResult.requireMFA) {
      result.flags.requireMFA = true;
      result.actions.push({ type: 'mark_new_device', data: { fingerprint: context.device.fingerprint } });
      result.appliedRules.push('new_device_mfa');
      await notifySupervisors(policy, 'new_device_login', context);
    }

    // Rule 6: Check session policy (max age, reauth required)
    const sessionResult = evaluateSessionPolicy(policy, context);
    if (sessionResult.requireReauth) {
      result.flags.requireMFA = true;
      result.appliedRules.push('session_reauth_required');
    }
    if (sessionResult.forceLogout) {
      result.actions.push({ type: 'force_logout_existing', data: { reason: 'new_login' } });
      result.appliedRules.push('force_logout_on_new_login');
    }

    // Rule 7: Check profile requirements
    const profileResult = evaluateProfileRequirements(policy, context);
    if (profileResult.incomplete && profileResult.block) {
      result.flags.requireProfileCompletion = true;
      result.redirect = policy.redirects.profileCompletionPage;
      result.appliedRules.push('profile_incomplete_block');
    } else if (profileResult.incomplete) {
      result.flags.requireProfileCompletion = true;
      result.warnings.push('Por favor completa tu perfil: ' + profileResult.missing.join(', '));
      result.appliedRules.push('profile_incomplete_warn');
    }

    // Rule 8: Check policy acceptance
    const policyAcceptResult = evaluatePolicyAcceptance(policy, context);
    if (policyAcceptResult.required) {
      result.flags.requirePolicyAcceptance = true;
      result.appliedRules.push('policy_acceptance_required');
    }

    // Rule 9: Check global alerts
    const alertResult = evaluateGlobalAlert(policy);
    if (alertResult.show) {
      result.flags.showGlobalAlert = true;
      result.globalAlert = alertResult.alert;
      result.appliedRules.push('global_alert_active');
    }

    // Rule 10: Determine redirect
    if (!result.redirect) {
      result.redirect = determineRedirect(policy, context);
      result.appliedRules.push('redirect_' + context.agent.role);
    }

    // Rule 11: Auto status assignment
    const statusResult = evaluateAutoStatus(policy, context);
    if (statusResult.status) {
      result.actions.push({ type: 'set_status', data: { status: statusResult.status } });
      result.appliedRules.push('auto_status_' + statusResult.status);
    }

    // Rule 12: Auto queue assignment
    const queueResult = evaluateAutoQueueAssignment(policy, context);
    if (queueResult.queues.length > 0) {
      result.actions.push({ type: 'assign_queues', data: { queues: queueResult.queues } });
      result.appliedRules.push('auto_queue_assignment');
    }

    // Build audit data
    result.auditData.rulesApplied = result.appliedRules;
    result.auditData.actionsTaken = result.actions.map(a => a.type);

    // Log if auditing enabled
    if (policy.audit.logAllLogins || policy.audit.logRuleEvaluations) {
      await logLoginAudit(result, context, policy);
    }

    return result;
  } catch (error) {
    logger.error('policy-engine', {
      action: 'evaluation_error',
      error: String(error),
      agentId: context.agent.id,
    });

    // On error, allow login but log it
    result.warnings.push('Error evaluando políticas - Usando valores por defecto');
    return result;
  }
}

// ============= INDIVIDUAL RULE EVALUATORS =============

function evaluateMaintenanceMode(policy: ILoginPolicy, context: PolicyContext): {
  blocked: boolean;
  readOnly: boolean;
  message?: string;
} {
  if (!policy.maintenanceMode.enabled) {
    return { blocked: false, readOnly: false };
  }

  const isAllowedRole = policy.maintenanceMode.allowedRoles.includes(context.agent.role);
  
  if (isAllowedRole) {
    return { blocked: false, readOnly: false };
  }

  if (policy.maintenanceMode.readOnlyForOthers) {
    return { blocked: false, readOnly: true, message: policy.maintenanceMode.message };
  }

  return { blocked: true, readOnly: false, message: policy.maintenanceMode.message };
}

function evaluateWorkingHours(policy: ILoginPolicy, context: PolicyContext): {
  blocked: boolean;
  readOnly: boolean;
  message?: string;
} {
  if (!policy.workingHours.enabled) {
    return { blocked: false, readOnly: false };
  }

  const now = new Date(context.timestamp);
  
  // Check day of week
  const dayOfWeek = now.getDay();
  if (!policy.workingHours.daysOfWeek.includes(dayOfWeek)) {
    if (policy.workingHours.blockOutsideHours) {
      return { blocked: true, readOnly: false, message: 'Login no permitido fuera del horario laboral' };
    }
    if (policy.workingHours.allowReadOnlyOutsideHours) {
      return { blocked: false, readOnly: true };
    }
  }

  // Check time
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: policy.workingHours.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const currentTime = formatter.format(now);
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = policy.workingHours.schedule.start.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;

    const [endHour, endMinute] = policy.workingHours.schedule.end.split(':').map(Number);
    const endMinutes = endHour * 60 + endMinute;

    const isWithinHours = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

    if (!isWithinHours) {
      if (policy.workingHours.blockOutsideHours) {
        return { 
          blocked: true, 
          readOnly: false, 
          message: `Login permitido solo entre ${policy.workingHours.schedule.start} y ${policy.workingHours.schedule.end}` 
        };
      }
      if (policy.workingHours.allowReadOnlyOutsideHours) {
        return { blocked: false, readOnly: true };
      }
    }
  } catch (error) {
    logger.warn('policy-engine', { message: 'Error checking working hours', error: String(error) });
  }

  return { blocked: false, readOnly: false };
}

function evaluateLocationRestriction(policy: ILoginPolicy, context: PolicyContext): {
  blocked: boolean;
  requireMFA: boolean;
  warning?: string;
  message?: string;
} {
  if (!policy.locationRestriction.enabled) {
    console.log('[PolicyEngine] Location restriction disabled');
    return { blocked: false, requireMFA: false };
  }

  const { ip, country } = context.device;
  
  console.log('[PolicyEngine] Evaluating location restriction:', {
    ip,
    country,
    allowedCountries: policy.locationRestriction.allowedCountries,
    allowedIpRanges: policy.locationRestriction.allowedIpRanges,
    blockAction: policy.locationRestriction.blockAction,
  });

  // Check IP ranges
  if (policy.locationRestriction.allowedIpRanges.length > 0) {
    const isIpAllowed = policy.locationRestriction.allowedIpRanges.some(range => {
      // Simple IP check - for CIDR you'd need a proper library
      if (range.includes('/')) {
        return isIpInRange(ip, range);
      }
      return ip === range || ip.startsWith(range.replace('*', ''));
    });

    if (!isIpAllowed) {
      switch (policy.locationRestriction.blockAction) {
        case 'block':
          return { blocked: true, requireMFA: false, message: 'Acceso denegado desde esta IP' };
        case 'mfa':
          return { blocked: false, requireMFA: true, warning: 'IP no reconocida - Verificación adicional requerida' };
        case 'alert':
          return { blocked: false, requireMFA: false, warning: 'Login desde IP no habitual' };
      }
    }
  }

  // Check countries
  if (policy.locationRestriction.allowedCountries.length > 0 && country) {
    const isCountryAllowed = policy.locationRestriction.allowedCountries.includes(country.toUpperCase());
    
    console.log('[PolicyEngine] Country check:', {
      userCountry: country,
      upperCaseCountry: country.toUpperCase(),
      allowedCountries: policy.locationRestriction.allowedCountries,
      isCountryAllowed,
    });
    
    if (!isCountryAllowed) {
      console.log('[PolicyEngine] BLOCKED - Country not allowed');
      switch (policy.locationRestriction.blockAction) {
        case 'block':
          return { blocked: true, requireMFA: false, message: `Acceso denegado desde ${country}` };
        case 'mfa':
          return { blocked: false, requireMFA: true, warning: 'País no habitual - Verificación adicional requerida' };
        case 'alert':
          return { blocked: false, requireMFA: false, warning: 'Login desde país no habitual' };
      }
    }
  }

  return { blocked: false, requireMFA: false };
}

function evaluateDeviceTrust(policy: ILoginPolicy, context: PolicyContext): {
  isNewDevice: boolean;
  requireMFA: boolean;
} {
  if (!policy.deviceTrust.enabled) {
    return { isNewDevice: false, requireMFA: false };
  }

  // New device is indicated by context
  if (context.device.isNewDevice) {
    return {
      isNewDevice: true,
      requireMFA: policy.deviceTrust.requireMFAOnNewDevice,
    };
  }

  return { isNewDevice: false, requireMFA: false };
}

function evaluateSessionPolicy(policy: ILoginPolicy, context: PolicyContext): {
  requireReauth: boolean;
  forceLogout: boolean;
} {
  let requireReauth = false;
  const forceLogout = policy.sessionPolicy.forceLogoutOnNewLogin;

  // Check if session is too old
  if (context.session.createdAt && policy.sessionPolicy.requireReauthAfterHours > 0) {
    const sessionAge = (context.timestamp.getTime() - context.session.createdAt.getTime()) / (1000 * 60 * 60);
    if (sessionAge > policy.sessionPolicy.requireReauthAfterHours) {
      requireReauth = true;
    }
  }

  return { requireReauth, forceLogout };
}

function evaluateProfileRequirements(policy: ILoginPolicy, context: PolicyContext): {
  incomplete: boolean;
  missing: string[];
  block: boolean;
} {
  const missing: string[] = [];
  const req = policy.profileRequirements;

  if (req.requireTelegramLink && !context.agent.telegramId) {
    missing.push('Telegram');
  }
  if (req.requireMFAEnabled && !context.agent.mfaEnabled) {
    missing.push('MFA');
  }
  if (req.requireDisplayName && !context.agent.displayName) {
    missing.push('Nombre');
  }
  if (req.requireAvatar && !context.agent.avatar) {
    missing.push('Avatar');
  }

  return {
    incomplete: missing.length > 0,
    missing,
    block: missing.length > 0 && req.blockUntilComplete,
  };
}

function evaluatePolicyAcceptance(policy: ILoginPolicy, context: PolicyContext): {
  required: boolean;
} {
  if (!policy.policyAcceptance.enabled) {
    return { required: false };
  }

  // Check if agent has accepted current version
  if (context.agent.acceptedPolicyVersion !== policy.policyAcceptance.version) {
    return { required: true };
  }

  return { required: false };
}

function evaluateGlobalAlert(policy: ILoginPolicy): {
  show: boolean;
  alert?: IGlobalAlert;
} {
  if (!policy.globalAlert.enabled) {
    return { show: false };
  }

  // Check if alert has expired
  if (policy.globalAlert.expiresAt && new Date(policy.globalAlert.expiresAt) < new Date()) {
    return { show: false };
  }

  return { show: true, alert: policy.globalAlert };
}

function determineRedirect(policy: ILoginPolicy, context: PolicyContext): string {
  // Check role-based redirects first
  const roleRedirect = policy.redirects.roleBasedRedirects.find(r => r.role === context.agent.role);
  if (roleRedirect) {
    return roleRedirect.redirectTo;
  }

  // Default landing page
  return policy.redirects.defaultLandingPage;
}

function evaluateAutoStatus(policy: ILoginPolicy, context: PolicyContext): {
  status: string | null;
} {
  console.log('[PolicyEngine] Evaluating auto status:', {
    enabled: policy.autoStatus.enabled,
    defaultStatusOnLogin: policy.autoStatus.defaultStatusOnLogin,
    statusOutsideHours: policy.autoStatus.statusOutsideHours,
  });
  
  if (!policy.autoStatus.enabled) {
    console.log('[PolicyEngine] Auto status disabled');
    return { status: null };
  }

  // Check if outside working hours
  if (policy.workingHours.enabled) {
    const workingHoursResult = evaluateWorkingHours(policy, context);
    if (workingHoursResult.readOnly) {
      console.log('[PolicyEngine] Outside working hours, using statusOutsideHours:', policy.autoStatus.statusOutsideHours);
      return { status: policy.autoStatus.statusOutsideHours };
    }
  }

  console.log('[PolicyEngine] Using defaultStatusOnLogin:', policy.autoStatus.defaultStatusOnLogin);
  return { status: policy.autoStatus.defaultStatusOnLogin };
}

function evaluateAutoQueueAssignment(policy: ILoginPolicy, context: PolicyContext): {
  queues: string[];
} {
  if (!policy.autoQueueAssignment.enabled) {
    return { queues: [] };
  }

  // Check role-based assignment first
  const roleAssignment = policy.autoQueueAssignment.byRole.find(r => r.role === context.agent.role);
  if (roleAssignment) {
    return { queues: roleAssignment.queues };
  }

  // Default queues
  return { queues: policy.autoQueueAssignment.queues };
}

// ============= CHAT ACTION RULES =============

/**
 * Evaluate if a chat action is allowed
 */
export async function evaluateChatAction(context: ChatActionContext): Promise<ChatActionResult> {
  const policy = await getCachedPolicy();

  // Find applicable rules for this action
  const rules = policy.chatActionRules.filter(
    rule => rule.enabled && rule.action === context.action
  );

  if (rules.length === 0) {
    return { allowed: true };
  }

  for (const rule of rules) {
    // Check if agent has bypass role
    if (rule.bypassRoles.includes(context.agent.role)) {
      continue;
    }

    // Evaluate the rule condition
    const conditionResult = evaluateRuleCondition(rule, context);
    if (!conditionResult.passed) {
      return {
        allowed: false,
        errorMessage: rule.errorMessage,
        requiresApproval: conditionResult.requiresApproval,
        approvalRoles: rule.condition.approvalRoles,
        ruleId: rule.id,
      };
    }
  }

  return { allowed: true };
}

function evaluateRuleCondition(rule: ILoginPolicy['chatActionRules'][0], context: ChatActionContext): {
  passed: boolean;
  requiresApproval?: boolean;
} {
  switch (rule.condition.type) {
    case 'require_note':
      return {
        passed: context.chat.hasNote === true && 
                (context.chat.noteLength || 0) >= (rule.condition.minNoteLength || 10),
      };

    case 'require_tag':
      const requiredTags = rule.condition.requiredTags || [];
      const chatTags = context.chat.tags || [];
      return {
        passed: requiredTags.some(tag => chatTags.includes(tag)),
      };

    case 'role_restriction':
      const allowedRoles = rule.condition.roles || [];
      return {
        passed: allowedRoles.includes(context.agent.role),
      };

    case 'require_approval':
      return {
        passed: false,
        requiresApproval: true,
      };

    case 'time_restriction':
      if (!rule.condition.allowedHours) {
        return { passed: true };
      }
      const now = new Date(context.timestamp);
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [startH, startM] = rule.condition.allowedHours.start.split(':').map(Number);
      const [endH, endM] = rule.condition.allowedHours.end.split(':').map(Number);
      return {
        passed: currentMinutes >= (startH * 60 + startM) && currentMinutes <= (endH * 60 + endM),
      };

    default:
      return { passed: true };
  }
}

// ============= HELPER FUNCTIONS =============

function blockLogin(result: PolicyResult, reason: string, message: string): PolicyResult {
  result.allowed = false;
  result.blocked = true;
  result.blockReason = message;
  result.appliedRules.push(reason);
  result.auditData.blocked = true;
  result.auditData.blockReason = reason;
  return result;
}

function isIpInRange(ip: string, cidr: string): boolean {
  // Simple CIDR check - for production use a proper library like ip-range-check
  const [range, bits] = cidr.split('/');
  const mask = parseInt(bits, 10);
  
  const ipParts = ip.split('.').map(Number);
  const rangeParts = range.split('.').map(Number);
  
  const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
  const rangeNum = (rangeParts[0] << 24) | (rangeParts[1] << 16) | (rangeParts[2] << 8) | rangeParts[3];
  const maskNum = ~((1 << (32 - mask)) - 1);
  
  return (ipNum & maskNum) === (rangeNum & maskNum);
}

async function notifySupervisors(policy: ILoginPolicy, event: string, context: PolicyContext): Promise<void> {
  const alerts = policy.supervisorAlerts;
  
  let shouldNotify = false;
  let title = '';
  let message = '';

  switch (event) {
    case 'login_outside_hours':
      shouldNotify = alerts.onLoginOutsideHours;
      title = '⚠️ Login fuera de horario';
      message = `${context.agent.email} intentó login fuera del horario laboral`;
      break;
    case 'new_device_login':
      shouldNotify = alerts.onNewDeviceLogin;
      title = '🆕 Nuevo dispositivo';
      message = `${context.agent.email} inició sesión desde un dispositivo nuevo`;
      break;
    case 'blocked_location':
      shouldNotify = alerts.onBlockedLogin;
      title = '🚫 Login bloqueado';
      message = `${context.agent.email} fue bloqueado por restricción de ubicación`;
      break;
    case 'suspicious_location':
      shouldNotify = alerts.onSuspiciousActivity;
      title = '⚠️ Actividad sospechosa';
      message = `${context.agent.email} login desde ubicación no habitual: ${context.device.ip}`;
      break;
  }

  if (shouldNotify) {
    try {
      // Find supervisors and admins to notify
      const { Agent } = await import('../database/models/Agent.js');
      const supervisors = await Agent.find({ 
        role: { $in: ['supervisor', 'admin'] },
        isActive: true
      }).select('_id').lean();

      // Send to each supervisor (use system as sender)
      for (const supervisor of supervisors) {
        await internalNotificationService.sendNotification({
          toAgentId: supervisor._id.toString(),
          fromAdminId: context.agent.id, // From the agent who triggered
          type: 'alert',
          title,
          message,
          priority: 'urgent',
          metadata: {
            event,
            agentId: context.agent.id,
            agentEmail: context.agent.email,
            ip: context.device.ip,
            timestamp: context.timestamp,
          },
        });
      }
    } catch (error) {
      logger.error('policy-engine', { message: 'Failed to notify supervisors', error: String(error) });
    }
  }
}

async function logLoginAudit(result: PolicyResult, context: PolicyContext, policy: ILoginPolicy): Promise<void> {
  if (!policy.audit.logAllLogins && !policy.audit.logRuleEvaluations) {
    return;
  }

  try {
    // Import dynamically to avoid circular deps
    const { AuditLog } = await import('../database/models/AuditLog.js');
    
    await AuditLog.create({
      action: result.blocked ? 'login_blocked' : 'login_policy_evaluated',
      category: 'auth',
      agentId: context.agent.id,
      details: {
        ip: context.device.ip,
        userAgent: context.device.userAgent,
        deviceFingerprint: context.device.fingerprint,
        country: context.device.country,
        rulesApplied: result.appliedRules,
        actionsTaken: result.auditData.actionsTaken,
        blocked: result.blocked,
        blockReason: result.blockReason,
        warnings: result.warnings,
        flags: result.flags,
        redirect: result.redirect,
      },
      ip: context.device.ip,
    });
  } catch (error) {
    logger.error('policy-engine', { message: 'Failed to log audit', error: String(error) });
  }
}

// ============= SCHEDULED TASKS =============

/**
 * Check for forced logout time
 * Should be called periodically by a worker
 */
export async function checkForceLogoutTime(): Promise<void> {
  const policy = await getCachedPolicy();
  
  if (!policy.sessionPolicy.forceLogoutAtTime) {
    return;
  }

  const now = new Date();
  const [hour, minute] = policy.sessionPolicy.forceLogoutAtTime.split(':').map(Number);
  
  if (now.getHours() === hour && now.getMinutes() === minute) {
    // Broadcast force logout to all agents
    try {
      const io = getIO();
      if (io) {
        io.emit('force_logout', {
          reason: 'scheduled_logout',
          time: policy.sessionPolicy.forceLogoutAtTime,
          message: 'Sesión cerrada automáticamente por política de horario',
        });
      }
      
      logger.info('policy-engine', { action: 'force_logout_broadcast', time: policy.sessionPolicy.forceLogoutAtTime });
    } catch (error) {
      logger.error('policy-engine', { message: 'Failed to broadcast force logout', error: String(error) });
    }
  }
}

// ============= WARMUP =============

/**
 * Warm up policy cache on server start
 */
export async function warmupPolicyCache(): Promise<void> {
  try {
    await loadPolicyFromDB();
    logger.info('policy-engine', { message: 'Policy cache warmed up' });
  } catch (error) {
    logger.error('policy-engine', { message: 'Failed to warm up policy cache', error: String(error) });
  }
}

// ============= EXPORTS =============

export {
  getCachedPolicy as getLoginPolicy,
  updateLoginPolicy as updatePolicy,
};

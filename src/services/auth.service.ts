/**
 * Authentication Service
 * JWT-based authentication for dashboard agents
 * Includes permission-aware login responses and session management
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";
import { ENV } from "../config/index.js";
import {
  findAgentByEmail,
  findAgentById,
  updateLastLogin,
  updateAgentStatus,
} from "./agent.service.js";
import {
  getEffectivePermissions,
  getAgentPermissionsSummary,
} from "./permission.service.js";
import { getSecuritySettings } from "./settings-cache.service.js";
import {
  createSession,
  enforceSessionLimit,
} from "../database/models/AgentSession.js";
import { logger } from "./logger.js";
import type { IAgent } from "../database/index.js";
import {
  evaluateLoginPolicy,
  type PolicyContext,
  type PolicyResult,
} from "./policy-engine.service.js";

export interface TokenPayload {
  agentId: string;
  email: string;
  role: string;
  permissionVersion?: number;
}

export interface AuthResult {
  success: boolean;
  agent?: IAgent;
  token?: string;
  permissions?: string[];
  error?: string;
  sessionsInvalidated?: number;
  forcePasswordChange?: boolean;
  telegramLinkRequired?: boolean;
  mfaSetupRequired?: boolean;
  // MFA fields
  mfaRequired?: boolean;
  mfaLoginToken?: string;
  mfaError?: string;
  mfaExpiresIn?: number;
  // Multi-method MFA fields
  mfaAvailableMethods?: ("telegram" | "totp")[];
  mfaPreferredMethod?: "telegram" | "totp";
  mfaSelectedMethod?: "telegram" | "totp";
  mfaPendingMethodSelection?: boolean;
  // Policy Engine fields
  policyResult?: PolicyResult;
  redirect?: string;
  readOnlyMode?: boolean;
  globalAlert?: {
    enabled: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'critical';
    requireAcknowledge: boolean;
    showFullScreen: boolean;
  };
  policyAcceptanceRequired?: boolean;
  profileIncomplete?: boolean;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  warnings?: string[];
}

/**
 * Generate a hash from a JWT token for session tracking
 */
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Check if agent requires Telegram linking
 * MANDATORY for all agents except system accounts
 *
 * Exclusions:
 * - System users (email contains 'system' or 'bot')
 * - Users with role 'system'
 */
function requiresTelegramLink(agent: IAgent): boolean {
  // Already has Telegram linked
  if (agent.telegramId) {
    return false;
  }

  // System accounts exclusion
  // const isSystemAccount =
  //   agent.email.toLowerCase().includes("system") ||
  //   agent.email.toLowerCase().includes("bot") ||
  //   agent.email.toLowerCase().includes("noreply") ||
  //   (agent.role as string) === "system";

  // if (isSystemAccount) {
  //   return false;
  // }

  // All other agents MUST have Telegram linked
  return true;
}

/**
 * Check if MFA setup is required
 * Returns true if MFA policy requires it but agent has no methods configured
 */
async function requiresMFASetup(agent: IAgent): Promise<boolean> {
  // Get security settings
  const securitySettings = await getSecuritySettings();

  // Check if MFA is globally required
  const globalMFARequired = securitySettings.mfaRequiredForAll ?? false;

  // Check if MFA is required for this agent's role
  const roleRequiresMFA =
    securitySettings.mfaRequiredRoles?.includes(agent.role) ?? false;

  // MFA not required by policy
  if (!globalMFARequired && !roleRequiresMFA) {
    return false;
  }

  // System accounts exclusion
  const isSystemAccount =
    agent.email.toLowerCase().includes("system") ||
    agent.email.toLowerCase().includes("bot") ||
    agent.email.toLowerCase().includes("noreply") ||
    (agent.role as string) === "system";

  if (isSystemAccount) {
    return false;
  }
  // Check if MFA is already enabled with at least one method
  const mfaEnabled = agent.security?.mfa?.enabled;
  const hasTelegramMethod = agent.security?.mfa?.methods?.telegram;
  const hasTotpMethod = agent.security?.mfa?.methods?.totp;


  // MFA is required but not enabled or no methods active
  if (!mfaEnabled || (!hasTelegramMethod && !hasTotpMethod)) {
    return true;
  }
  return false;
}

/**
 * Login agent with email and password
 */
export async function loginAgent(
  email: string,
  password: string,
  deviceInfo?: {
    deviceType?: string;
    browser?: string;
    os?: string;
    ip: string;
    country?: string;
  },
  options?: {
    skipMFA?: boolean; // For internal calls after MFA verification
    deviceFingerprint?: string;
    preferredMethod?: "telegram" | "totp"; // Preferred MFA method
  },
): Promise<AuthResult> {
  try {
    // Find agent by email (include password field)
    const agent = await findAgentByEmail(email);

    if (!agent) {
      return { success: false, error: "Invalid credentials" };
    }

    // Check if agent is active
    if (agent.isActive === false) {
      return {
        success: false,
        error: "Account is deactivated. Contact an administrator.",
      };
    }

    // Verify password
    const isValidPassword = await agent.comparePassword(password);

    if (!isValidPassword) {
      return { success: false, error: "Invalid credentials" };
    }

    // Check if MFA is required (unless explicitly skipped after verification)
    if (!options?.skipMFA) {
      const { initiateMFA } = await import("./mfa.service.js");
      const mfaResult = await initiateMFA(agent, {
        ip: deviceInfo?.ip,
        userAgent: deviceInfo?.browser,
        deviceFingerprint: options?.deviceFingerprint,
        preferredMethod: options?.preferredMethod,
      });

      if (mfaResult.required) {
        // MFA is required - return pending state with method info
        return {
          success: true,
          mfaRequired: true,
          mfaLoginToken: mfaResult.loginToken,
          mfaError: mfaResult.error,
          mfaExpiresIn: mfaResult.expiresIn,
          mfaAvailableMethods: mfaResult.availableMethods,
          mfaPreferredMethod: mfaResult.preferredMethod,
          mfaSelectedMethod: mfaResult.selectedMethod,
          mfaPendingMethodSelection: mfaResult.pendingMethodSelection,
        };
      }
    }

    // Get security settings for session limit
    const securitySettings = await getSecuritySettings();
    const maxSessions = securitySettings.maxSessionsPerAgent ?? 3;

    // Enforce session limit - invalidate oldest sessions if needed
    let sessionsInvalidated = 0;
    if (maxSessions > 0) {
      sessionsInvalidated = await enforceSessionLimit(
        agent._id.toString(),
        maxSessions,
      );
      if (sessionsInvalidated > 0) {
        logger.info("admin", {
          action: "sessions_invalidated",
          agentId: agent._id.toString(),
          count: sessionsInvalidated,
          reason: "session_limit_exceeded",
          maxSessions,
        });
      }
    }

    // Generate JWT token
    const token = generateToken(agent);
    const tokenHash = hashToken(token);

    // Create session record
    if (deviceInfo) {
      await createSession(agent._id.toString(), tokenHash, deviceInfo);
    } else {
      await createSession(agent._id.toString(), tokenHash, { ip: "unknown" });
    }

    // Update last login (status will be set by policy engine)
    await updateLastLogin(agent._id.toString());

    // Return agent without password
    const agentData = await findAgentById(agent._id.toString());

    // Get effective permissions for the response
    const permissions = await getEffectivePermissions(agent._id.toString());

    // Check if password change is required
    const forcePasswordChange = agent.security.password.forceChange === true;

    // Check if Telegram linking is required (mandatory for all non-system users)
    const telegramLinkRequired = requiresTelegramLink(agentData!);

    // Check if MFA setup is required by policy but not configured
    const mfaSetupRequired = await requiresMFASetup(agentData!);

    // ============= POLICY ENGINE EVALUATION =============
    // Evaluate login policies after successful authentication
    const policyContext: PolicyContext = {
      agent: {
        id: agent._id.toString(),
        email: agent.email,
        role: agent.role,
        telegramId: agent.telegramId,
        mfaEnabled: agent.security?.mfa?.enabled,
        displayName: agent.name,
        avatar: agent.avatar,
        suspended: !agent.isActive,
      },
      device: {
        fingerprint: options?.deviceFingerprint,
        ip: deviceInfo?.ip || 'unknown',
        userAgent: deviceInfo?.browser,
        country: deviceInfo?.country || 'unknown',
        isNewDevice: false, // Will be determined by TrustedDevice check
      },
      session: {
        createdAt: new Date(),
      },
      timestamp: new Date(),
    };

    // Check if this is a new device
    if (options?.deviceFingerprint) {
      try {
        const { TrustedDevice } = await import('../database/models/TrustedDevice.js');
        const existingDevice = await TrustedDevice.findOne({
          agentId: agent._id,
          deviceFingerprint: options.deviceFingerprint,
          isActive: true,
        });
        policyContext.device.isNewDevice = !existingDevice;
      } catch {
        // TrustedDevice model might not exist yet
        policyContext.device.isNewDevice = false;
      }
    }

    const policyResult = await evaluateLoginPolicy(policyContext);

    // Check if login is blocked by policy
    if (policyResult.blocked) {
      logger.warn('auth', {
        action: 'login_blocked_by_policy',
        agentId: agent._id.toString(),
        reason: policyResult.blockReason,
        rules: policyResult.appliedRules,
      });
      return {
        success: false,
        error: policyResult.blockReason || 'Acceso denegado por política de seguridad',
      };
    }

    // Execute policy actions
    let statusSet = false;
    console.log('[Auth] Processing policy actions:', policyResult.actions);
    for (const action of policyResult.actions) {
      switch (action.type) {
        case 'set_status':
          if (action.data?.status) {
            const status = action.data.status as string;
            console.log('[Auth] Setting agent status from policy:', status);
            // Only apply valid OnlineStatus values
            if (['online', 'away', 'offline'].includes(status)) {
              await updateAgentStatus(agent._id.toString(), status as 'online' | 'away' | 'offline');
              statusSet = true;
            }
          }
          break;
        case 'force_logout_existing':
          // Already handled by session limit enforcement above
          break;
        // Other actions are handled by the frontend
      }
    }
    
    // Default to online if no status action was executed
    if (!statusSet) {
      console.log('[Auth] No status set by policy, defaulting to online');
      await updateAgentStatus(agent._id.toString(), 'online');
    }

    return {
      success: true,
      agent: agentData!,
      token,
      permissions,
      sessionsInvalidated,
      forcePasswordChange,
      telegramLinkRequired,
      mfaSetupRequired,
      // Policy results for frontend
      policyResult,
      redirect: policyResult.redirect,
      readOnlyMode: policyResult.flags.readOnlyMode,
      globalAlert: policyResult.globalAlert ? {
        enabled: true,
        title: policyResult.globalAlert.title,
        message: policyResult.globalAlert.message,
        type: policyResult.globalAlert.type,
        requireAcknowledge: policyResult.globalAlert.requireAcknowledge,
        showFullScreen: policyResult.globalAlert.showFullScreen,
      } : undefined,
      policyAcceptanceRequired: policyResult.flags.requirePolicyAcceptance,
      profileIncomplete: policyResult.flags.requireProfileCompletion,
      maintenanceMode: policyResult.flags.readOnlyMode,
      maintenanceMessage: policyResult.flags.readOnlyMode ? 'Sistema en modo mantenimiento' : undefined,
      warnings: policyResult.warnings,
    };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Authentication failed" };
  }
}

/**
 * Logout agent
 */
export async function logoutAgent(agentId: string): Promise<void> {
  await updateAgentStatus(agentId, "offline");
}

/**
 * Generate JWT token
 */
export function generateToken(agent: IAgent): string {
  const payload: TokenPayload = {
    agentId: agent._id.toString(),
    email: agent.email,
    role: agent.role,
    permissionVersion: agent.permissionVersion || 1,
  };

  return jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Get agent from token
 */
export async function getAgentFromToken(token: string): Promise<IAgent | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  return findAgentById(payload.agentId);
}

/**
 * Complete login after MFA verification
 * Called internally after successful MFA code verification
 */
export async function completeLoginAfterMFA(
  agentId: string,
  deviceInfo?: {
    deviceType?: string;
    browser?: string;
    os?: string;
    ip: string;
    country?: string;
  },
): Promise<AuthResult> {
  try {
    const agent = await findAgentById(agentId);

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }

    if (agent.isActive === false) {
      return { success: false, error: "Account is deactivated" };
    }

    // Get security settings for session limit
    const securitySettings = await getSecuritySettings();
    const maxSessions = securitySettings.maxSessionsPerAgent ?? 3;

    // Enforce session limit
    let sessionsInvalidated = 0;
    if (maxSessions > 0) {
      sessionsInvalidated = await enforceSessionLimit(agentId, maxSessions);
    }

    // Generate JWT token
    const token = generateToken(agent);
    const tokenHash = hashToken(token);

    // Create session record
    if (deviceInfo) {
      await createSession(agentId, tokenHash, deviceInfo);
    } else {
      await createSession(agentId, tokenHash, { ip: "unknown" });
    }

    // Update last login (status will be set by policy engine)
    await updateLastLogin(agentId);

    // Get effective permissions
    const permissions = await getEffectivePermissions(agentId);

    // Check if password change is required
    const forcePasswordChange = agent.security.password.forceChange === true;

    // Check if Telegram linking is required
    const telegramLinkRequired = requiresTelegramLink(agent);

    // Check if MFA setup is required by policy but not configured
    const mfaSetupRequired = await requiresMFASetup(agent);

    // ============= POLICY ENGINE EVALUATION =============
    const policyContext: PolicyContext = {
      agent: {
        id: agentId,
        email: agent.email,
        role: agent.role,
        telegramId: agent.telegramId,
        mfaEnabled: agent.security?.mfa?.enabled,
        displayName: agent.name,
        avatar: agent.avatar,
        suspended: !agent.isActive,
      },
      device: {
        ip: deviceInfo?.ip || 'unknown',
        userAgent: deviceInfo?.browser,
        country: deviceInfo?.country || 'unknown',
        isNewDevice: false,
      },
      session: {
        createdAt: new Date(),
      },
      timestamp: new Date(),
    };

    const policyResult = await evaluateLoginPolicy(policyContext);

    if (policyResult.blocked) {
      logger.warn('auth', {
        action: 'mfa_login_blocked_by_policy',
        agentId,
        reason: policyResult.blockReason,
      });
      return {
        success: false,
        error: policyResult.blockReason || 'Acceso denegado por política de seguridad',
      };
    }

    // Execute policy actions
    let statusSet = false;
    for (const action of policyResult.actions) {
      if (action.type === 'set_status' && action.data?.status) {
        const status = action.data.status as string;
        // Only apply valid OnlineStatus values
        if (['online', 'away', 'offline'].includes(status)) {
          await updateAgentStatus(agentId, status as 'online' | 'away' | 'offline');
          statusSet = true;
        }
      }
    }
    
    // Default to online if no status action was executed
    if (!statusSet) {
      await updateAgentStatus(agentId, 'online');
    }

    logger.info("auth", {
      action: "mfa_login_completed",
      agentId,
      appliedRules: policyResult.appliedRules,
    });

    return {
      success: true,
      agent,
      token,
      permissions,
      sessionsInvalidated,
      forcePasswordChange,
      telegramLinkRequired,
      mfaSetupRequired,
      policyResult,
      redirect: policyResult.redirect,
      readOnlyMode: policyResult.flags.readOnlyMode,
      globalAlert: policyResult.globalAlert ? {
        enabled: true,
        title: policyResult.globalAlert.title,
        message: policyResult.globalAlert.message,
        type: policyResult.globalAlert.type,
        requireAcknowledge: policyResult.globalAlert.requireAcknowledge,
        showFullScreen: policyResult.globalAlert.showFullScreen,
      } : undefined,
      policyAcceptanceRequired: policyResult.flags.requirePolicyAcceptance,
      profileIncomplete: policyResult.flags.requireProfileCompletion,
      maintenanceMode: policyResult.flags.readOnlyMode,
      maintenanceMessage: policyResult.flags.readOnlyMode ? 'Sistema en modo mantenimiento' : undefined,
      warnings: policyResult.warnings,
    };
  } catch (error) {
    logger.error("auth", {
      action: "mfa_login_complete_error",
      agentId,
      error: String(error),
    });
    return { success: false, error: "Login failed" };
  }
}

/**
 * Refresh token
 */
export async function refreshToken(token: string): Promise<AuthResult> {
  const agent = await getAgentFromToken(token);

  if (!agent) {
    return { success: false, error: "Invalid token" };
  }

  const newToken = generateToken(agent);
  const permissions = await getEffectivePermissions(agent._id.toString());

  // Check if password change is required
  const forcePasswordChange = agent.security.password.forceChange === true;

  // Check if Telegram linking is required
  const telegramLinkRequired = requiresTelegramLink(agent);

  // Check if MFA setup is required by policy but not configured
  const mfaSetupRequired = await requiresMFASetup(agent);

  return {
    success: true,
    agent,
    token: newToken,
    permissions,
    forcePasswordChange,
    telegramLinkRequired,
    mfaSetupRequired,
  };
}

/**
 * Check if token's permission version is current
 * Returns false if permissions have changed since token was issued
 */
export async function isTokenPermissionVersionValid(
  token: string,
): Promise<boolean> {
  const payload = verifyToken(token);
  if (!payload) return false;

  const agent = await findAgentById(payload.agentId);
  if (!agent) return false;

  const currentVersion = agent.permissionVersion || 1;
  const tokenVersion = payload.permissionVersion || 1;

  return tokenVersion >= currentVersion;
}

/**
 * Get current permissions for authenticated agent
 * Use this when frontend needs to refresh permissions without re-login
 */
export async function getCurrentPermissions(
  agentId: string,
): Promise<string[]> {
  return getEffectivePermissions(agentId);
}

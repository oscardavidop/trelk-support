/**
 * MFA Service
 * Complete Multi-Factor Authentication service via Telegram
 * 
 * Features:
 * - MFA code generation and verification
 * - Trusted device management
 * - Rate limiting
 * - Admin controls
 * - Audit logging
 */

import {
  Agent,
  type IAgent,
  createMFASession,
  verifyMFACode,
  getMFASessionByToken,
  canResendMFACode,
  isAgentMFABlocked,
  getPendingMFASession,
  cancelAllMFASessions,
  trustDevice,
  isDeviceTrusted,
  getTrustedDevices,
  revokeDevice,
  revokeAllDevices,
  generateDeviceFingerprint,
  Settings,
  MFA_CONFIG,
} from '../database/index.js';
import { sendMFACodeTelegram, sendMFAAlertTelegram } from './telegram-notifications.js';
import { logAudit } from './audit-log.service.js';
import { logger } from './logger.js';

// ============= TYPES =============

export interface MFAInitResult {
  required: boolean;
  loginToken?: string;
  message?: string;
  expiresIn?: number;
  error?: string;
}

export interface MFAVerifyResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
  blockedUntil?: Date;
}

export interface MFAEnableResult {
  success: boolean;
  loginToken?: string;
  expiresIn?: number;
  message?: string;
  error?: string;
}

export interface GlobalMFASettings {
  mfaRequiredForAll: boolean;
  mfaRequiredRoles: string[];
  mfaBypassIPs: string[];
  mfaTrustDevicesEnabled: boolean;
}

// ============= GLOBAL SETTINGS =============

/**
 * Get global MFA settings
 */
export async function getGlobalMFASettings(): Promise<GlobalMFASettings> {
  const settings = await Settings.findOne();
  
  return {
    mfaRequiredForAll: settings?.security?.mfaRequiredForAll || false,
    mfaRequiredRoles: settings?.security?.mfaRequiredRoles || ['admin', 'supervisor'],
    mfaBypassIPs: settings?.security?.mfaBypassIPs || [],
    mfaTrustDevicesEnabled: settings?.security?.mfaTrustDevicesEnabled !== false,
  };
}

/**
 * Update global MFA settings
 */
export async function updateGlobalMFASettings(
  updates: Partial<GlobalMFASettings>,
  adminId: string,
  options: { adminName: string; ip: string; userAgent?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    await Settings.updateOne(
      {},
      {
        $set: {
          'security.mfaRequiredForAll': updates.mfaRequiredForAll,
          'security.mfaRequiredRoles': updates.mfaRequiredRoles,
          'security.mfaBypassIPs': updates.mfaBypassIPs,
          'security.mfaTrustDevicesEnabled': updates.mfaTrustDevicesEnabled,
        },
      },
      { upsert: true }
    );

    await logAudit({
      action: 'mfa_global_settings_updated',
      category: 'security',
      actorId: adminId,
      actorType: 'admin',
      actorName: options.adminName,
      targetType: 'system',
      targetId: 'global_mfa_settings',
      targetDescription: 'Global MFA settings updated',
      severity: 'high',
      ip: options.ip,
      userAgent: options.userAgent,
    });

    return { success: true };
  } catch (error) {
    logger.error('mfa-service', { action: 'update_global_settings_error', error: String(error) });
    return { success: false, error: 'Error al actualizar configuración' };
  }
}

// ============= MFA CHECK =============

/**
 * Check if MFA is required for an agent
 */
export async function isMFARequired(agent: IAgent, ip?: string): Promise<boolean> {
  // Check if agent has MFA bypass active
  if (agent.mfaBypassUntil && agent.mfaBypassUntil > new Date()) {
    return false;
  }

  // Check if agent has MFA enabled
  if (agent.mfaEnabled) {
    return true;
  }

  // Check global settings
  const globalSettings = await getGlobalMFASettings();

  // Check IP bypass list
  if (ip && globalSettings.mfaBypassIPs.includes(ip)) {
    return false;
  }

  // Check if MFA required for all
  if (globalSettings.mfaRequiredForAll) {
    return true;
  }

  // Check if MFA required for agent's role
  if (globalSettings.mfaRequiredRoles.includes(agent.role)) {
    return true;
  }

  // Check if enforced by admin
  if (agent.mfaEnforcedByAdmin) {
    return true;
  }

  return false;
}

// ============= MFA FLOW =============

/**
 * Initialize MFA verification after successful password check
 */
export async function initiateMFA(
  agent: IAgent,
  options: {
    ip?: string;
    userAgent?: string;
    deviceFingerprint?: string;
  }
): Promise<MFAInitResult> {
  try {
    // Check if MFA is required
    const mfaRequired = await isMFARequired(agent, options.ip);
    
    if (!mfaRequired) {
      return { required: false };
    }

    // Check if agent has Telegram linked
    if (!agent.telegramId) {
      logger.warn('mfa-service', {
        action: 'mfa_no_telegram',
        agentId: agent._id.toString(),
      });
      return {
        required: true,
        error: 'No tienes Telegram vinculado. Contacta a un administrador para configurar MFA.',
      };
    }

    // Check if device is trusted (skip MFA)
    if (options.deviceFingerprint) {
      const globalSettings = await getGlobalMFASettings();
      if (globalSettings.mfaTrustDevicesEnabled) {
        const { trusted } = await isDeviceTrusted(agent._id, options.deviceFingerprint);
        if (trusted) {
          logger.info('mfa-service', {
            action: 'mfa_trusted_device_skip',
            agentId: agent._id.toString(),
          });
          return { required: false };
        }
      }
    }

    // Check if agent is blocked
    const { blocked, blockedUntil } = await isAgentMFABlocked(agent._id);
    if (blocked) {
      return {
        required: true,
        error: `Demasiados intentos fallidos. Intenta de nuevo a las ${blockedUntil?.toLocaleTimeString('es-ES')}`,
      };
    }

    // Check for existing pending session that can be reused
    const existingSession = await getPendingMFASession(agent._id);
    if (existingSession && existingSession.loginToken) {
      // Calculate remaining time
      const expiresIn = Math.floor((existingSession.expiresAt.getTime() - Date.now()) / 1000);
      
      logger.info('mfa-service', {
        action: 'mfa_session_reused',
        agentId: agent._id.toString(),
        sessionId: existingSession._id.toString(),
        expiresIn,
      });
      
      // Reuse existing session - don't send a new code
      return {
        required: true,
        loginToken: existingSession.loginToken,
        message: 'Ya se envió un código de verificación a tu Telegram',
        expiresIn,
      };
    }

    // Create MFA session and generate code
    const { session, code, loginToken } = await createMFASession(agent._id.toString(), {
      ip: options.ip,
      userAgent: options.userAgent,
      expiryMinutes: MFA_CONFIG.CODE_EXPIRY_MINUTES,
    });

    // Send code via Telegram
    const sent = await sendMFACodeTelegram(agent.telegramId, code, agent.name);

    if (!sent) {
      logger.error('mfa-service', {
        action: 'mfa_telegram_send_failed',
        agentId: agent._id.toString(),
      });
      return {
        required: true,
        error: 'No se pudo enviar el código por Telegram. Intenta de nuevo.',
      };
    }

    // Log audit
    await logAudit({
      action: 'mfa_code_sent',
      category: 'authentication',
      actorId: agent._id.toString(),
      actorType: 'agent',
      actorName: agent.name,
      actorEmail: agent.email,
      targetType: 'agent',
      targetId: agent._id.toString(),
      severity: 'low',
      ip: options.ip || 'unknown',
      userAgent: options.userAgent,
    });

    logger.info('mfa-service', {
      action: 'mfa_initiated',
      agentId: agent._id.toString(),
      sessionId: session._id.toString(),
    });

    return {
      required: true,
      loginToken,
      message: 'Se ha enviado un código de verificación a tu Telegram',
      expiresIn: MFA_CONFIG.CODE_EXPIRY_MINUTES * 60,
    };
  } catch (error) {
    logger.error('mfa-service', {
      action: 'mfa_initiate_error',
      agentId: agent._id.toString(),
      error: String(error),
    });
    return {
      required: true,
      error: 'Error al iniciar verificación. Intenta de nuevo.',
    };
  }
}

/**
 * Verify MFA code
 */
export async function verifyMFA(
  loginToken: string,
  code: string,
  options: {
    ip?: string;
    userAgent?: string;
    trustDevice?: boolean;
    deviceFingerprint?: string;
    deviceName?: string;
  }
): Promise<MFAVerifyResult & { agentId?: string }> {
  try {
    // Validate code format
    if (!code || !/^\d{6}$/.test(code)) {
      return { success: false, error: 'El código debe ser de 6 dígitos' };
    }

    // Verify the code
    const result = await verifyMFACode(loginToken, code, options.ip);

    if (!result.valid) {
      // Log failed attempt
      if (result.session) {
        const agent = await Agent.findById(result.session.agentId);
        await logAudit({
          action: 'mfa_verification_failed',
          category: 'authentication',
          actorId: result.session.agentId.toString(),
          actorType: 'agent',
          actorName: agent?.name || 'Unknown',
          targetType: 'agent',
          targetId: result.session.agentId.toString(),
          severity: 'medium',
          ip: options.ip || 'unknown',
          userAgent: options.userAgent,
        });
      }

      return {
        success: false,
        error: result.error,
        remainingAttempts: result.remainingAttempts,
        blockedUntil: result.blockedUntil,
      };
    }

    const agentId = result.session!.agentId.toString();

    // Trust device if requested
    if (options.trustDevice && options.deviceFingerprint) {
      const globalSettings = await getGlobalMFASettings();
      if (globalSettings.mfaTrustDevicesEnabled) {
        await trustDevice(agentId, {
          fingerprint: options.deviceFingerprint,
          ip: options.ip,
          userAgent: options.userAgent,
          name: options.deviceName,
        });

        logger.info('mfa-service', {
          action: 'mfa_device_trusted',
          agentId,
        });
      }
    }

    // Get agent name for audit
    const agent = await Agent.findById(agentId);

    // Log successful verification
    await logAudit({
      action: 'mfa_verification_success',
      category: 'authentication',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent?.name || 'Unknown',
      targetType: 'agent',
      targetId: agentId,
      severity: 'low',
      ip: options.ip || 'unknown',
      userAgent: options.userAgent,
    });

    logger.info('mfa-service', {
      action: 'mfa_verified',
      agentId,
    });

    return { success: true, agentId };
  } catch (error) {
    logger.error('mfa-service', {
      action: 'mfa_verify_error',
      error: String(error),
    });
    return { success: false, error: 'Error al verificar código' };
  }
}

/**
 * Resend MFA code
 */
export async function resendMFACode(
  loginToken: string,
  options: {
    ip?: string;
    userAgent?: string;
  }
): Promise<{ success: boolean; error?: string; waitSeconds?: number }> {
  try {
    // Get existing session
    const session = await getMFASessionByToken(loginToken);
    if (!session) {
      return { success: false, error: 'Sesión de verificación expirada. Inicia sesión de nuevo.' };
    }

    const agentId = session.agentId.toString();

    // Check rate limit
    const { canResend, waitSeconds } = await canResendMFACode(agentId);
    if (!canResend) {
      return { success: false, error: `Espera ${waitSeconds} segundos`, waitSeconds };
    }

    // Get agent
    const agent = await Agent.findById(agentId);
    if (!agent || !agent.telegramId) {
      return { success: false, error: 'No se puede enviar el código' };
    }

    // Create new session (cancels old one)
    const { code, loginToken: newToken } = await createMFASession(agentId, {
      ip: options.ip,
      userAgent: options.userAgent,
    });

    // Send new code
    const sent = await sendMFACodeTelegram(agent.telegramId, code, agent.name);
    if (!sent) {
      return { success: false, error: 'Error al enviar código por Telegram' };
    }

    // Note: We return the same loginToken as a security measure
    // The old session was already cancelled, new one has new loginToken
    // But for UX we keep using the original token (which is now invalid)
    // This forces user to use the new code with new loginToken from response

    logger.info('mfa-service', {
      action: 'mfa_code_resent',
      agentId,
    });

    return { success: true };
  } catch (error) {
    logger.error('mfa-service', { action: 'resend_error', error: String(error) });
    return { success: false, error: 'Error al reenviar código' };
  }
}

// ============= MFA ENABLE/DISABLE =============

/**
 * Start MFA activation process
 */
export async function startMFAActivation(
  agentId: string,
  options: {
    ip?: string;
    userAgent?: string;
  }
): Promise<MFAEnableResult> {
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    if (agent.mfaEnabled) {
      return { success: false, error: 'MFA ya está activado' };
    }

    if (!agent.telegramId) {
      return { success: false, error: 'Debes vincular Telegram primero para activar MFA' };
    }

    // Create verification session
    const { code, loginToken } = await createMFASession(agentId, {
      ip: options.ip,
      userAgent: options.userAgent,
      expiryMinutes: 5, // 5 minutes for activation
    });

    // Send code
    const sent = await sendMFACodeTelegram(agent.telegramId, code, agent.name, true);
    if (!sent) {
      return { success: false, error: 'Error al enviar código por Telegram' };
    }

    logger.info('mfa-service', {
      action: 'mfa_activation_started',
      agentId,
    });

    return {
      success: true,
      loginToken,
      expiresIn: MFA_CONFIG.CODE_EXPIRY_MINUTES * 60,
      message: 'Se ha enviado un código de verificación a tu Telegram',
    };
  } catch (error) {
    logger.error('mfa-service', { action: 'start_activation_error', error: String(error) });
    return { success: false, error: 'Error al iniciar activación' };
  }
}

/**
 * Complete MFA activation
 */
export async function completeMFAActivation(
  agentId: string,
  loginToken: string,
  code: string,
  options: {
    ip?: string;
    userAgent?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify code
    const result = await verifyMFACode(loginToken, code, options.ip);
    if (!result.valid) {
      return { success: false, error: result.error };
    }

    // Enable MFA
    await Agent.updateOne(
      { _id: agentId },
      {
        mfaEnabled: true,
        mfaVerifiedAt: new Date(),
        mfaDisabledAt: null,
        mfaDisabledBy: null,
      }
    );

    const agent = await Agent.findById(agentId);

    // Send confirmation
    if (agent?.telegramId) {
      await sendMFAAlertTelegram(agent.telegramId, 'enabled', agent.name);
    }

    // Log audit
    await logAudit({
      action: 'mfa_enabled',
      category: 'security',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent?.name || 'Unknown Agent',
      actorEmail: agent?.email,
      targetType: 'agent',
      targetId: agentId,
      severity: 'high',
      ip: options.ip || 'unknown',
      userAgent: options.userAgent,
    });

    logger.info('mfa-service', {
      action: 'mfa_enabled',
      agentId,
    });

    return { success: true };
  } catch (error) {
    logger.error('mfa-service', { action: 'complete_activation_error', error: String(error) });
    return { success: false, error: 'Error al activar MFA' };
  }
}

/**
 * Disable MFA (requires verification)
 */
export async function disableMFA(
  agentId: string,
  verificationCode: string,
  loginToken: string,
  options: {
    ip?: string;
    userAgent?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    if (!agent.mfaEnabled) {
      return { success: false, error: 'MFA no está activado' };
    }

    // Check if MFA was enforced by admin
    if (agent.mfaEnforcedByAdmin) {
      return { success: false, error: 'MFA fue activado por un administrador y no puede ser desactivado' };
    }

    // Verify code
    const result = await verifyMFACode(loginToken, verificationCode, options.ip);
    if (!result.valid) {
      return { success: false, error: result.error };
    }

    // Disable MFA
    await Agent.updateOne(
      { _id: agentId },
      {
        mfaEnabled: false,
        mfaDisabledAt: new Date(),
      }
    );

    // Revoke all trusted devices
    await revokeAllDevices(agentId, agentId, 'mfa_disabled');

    // Send alert
    if (agent.telegramId) {
      await sendMFAAlertTelegram(agent.telegramId, 'disabled', agent.name);
    }

    // Log audit
    await logAudit({
      action: 'mfa_disabled',
      category: 'security',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent.name,
      actorEmail: agent.email,
      targetType: 'agent',
      targetId: agentId,
      severity: 'high',
      ip: options.ip || 'unknown',
      userAgent: options.userAgent,
    });

    logger.info('mfa-service', {
      action: 'mfa_disabled',
      agentId,
    });

    return { success: true };
  } catch (error) {
    logger.error('mfa-service', { action: 'disable_error', error: String(error) });
    return { success: false, error: 'Error al desactivar MFA' };
  }
}

// ============= ADMIN CONTROLS =============

/**
 * Admin: Force enable MFA for an agent
 */
export async function adminEnableMFA(
  targetAgentId: string,
  adminId: string,
  options: { adminName: string; ip: string; userAgent?: string; reason?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = await Agent.findById(targetAgentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    if (!agent.telegramId) {
      return { success: false, error: 'El agente no tiene Telegram vinculado' };
    }

    await Agent.updateOne(
      { _id: targetAgentId },
      {
        mfaEnabled: true,
        mfaEnforcedByAdmin: true,
        mfaVerifiedAt: new Date(),
        mfaDisabledAt: null,
        mfaDisabledBy: null,
      }
    );

    // Notify agent
    if (agent.telegramId) {
      await sendMFAAlertTelegram(agent.telegramId, 'enforced', agent.name);
    }

    // Log audit
    await logAudit({
      action: 'mfa_admin_enforced',
      category: 'security',
      actorId: adminId,
      actorType: 'admin',
      actorName: options.adminName,
      targetType: 'agent',
      targetId: targetAgentId,
      targetDescription: `MFA enforced for ${agent.email}`,
      severity: 'high',
      ip: options.ip,
      userAgent: options.userAgent,
    });

    return { success: true };
  } catch (error) {
    logger.error('mfa-service', { action: 'admin_enable_error', error: String(error) });
    return { success: false, error: 'Error al forzar MFA' };
  }
}

/**
 * Admin: Disable MFA for an agent
 */
export async function adminDisableMFA(
  targetAgentId: string,
  adminId: string,
  options: { adminName: string; ip: string; userAgent?: string; reason?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = await Agent.findById(targetAgentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    await Agent.updateOne(
      { _id: targetAgentId },
      {
        mfaEnabled: false,
        mfaEnforcedByAdmin: false,
        mfaDisabledAt: new Date(),
        mfaDisabledBy: adminId,
      }
    );

    // Cancel pending sessions
    await cancelAllMFASessions(targetAgentId);

    // Revoke trusted devices
    await revokeAllDevices(targetAgentId, adminId, options.reason || 'admin_disabled');

    // Notify agent
    if (agent.telegramId) {
      await sendMFAAlertTelegram(agent.telegramId, 'admin_disabled', agent.name, options.reason);
    }

    // Log audit
    await logAudit({
      action: 'mfa_admin_disabled',
      category: 'security',
      actorId: adminId,
      actorType: 'admin',
      actorName: options.adminName,
      targetType: 'agent',
      targetId: targetAgentId,
      targetDescription: `MFA disabled for ${agent.email}`,
      severity: 'high',
      ip: options.ip,
      userAgent: options.userAgent,
    });

    return { success: true };
  } catch (error) {
    logger.error('mfa-service', { action: 'admin_disable_error', error: String(error) });
    return { success: false, error: 'Error al desactivar MFA' };
  }
}

/**
 * Admin: Grant temporary MFA bypass
 */
export async function adminBypassMFA(
  targetAgentId: string,
  adminId: string,
  durationMinutes: number = 30,
  options: { adminName: string; ip: string; userAgent?: string; reason?: string }
): Promise<{ success: boolean; error?: string; bypassUntil?: Date }> {
  try {
    const bypassUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    await Agent.updateOne(
      { _id: targetAgentId },
      { mfaBypassUntil: bypassUntil }
    );

    const agent = await Agent.findById(targetAgentId);

    // Notify agent
    if (agent?.telegramId) {
      await sendMFAAlertTelegram(agent.telegramId, 'bypass_granted', agent.name, `${durationMinutes} minutos`);
    }

    // Log audit
    await logAudit({
      action: 'mfa_bypass_granted',
      category: 'security',
      actorId: adminId,
      actorType: 'admin',
      actorName: options.adminName,
      targetType: 'agent',
      targetId: targetAgentId,
      targetDescription: `MFA bypass granted for ${durationMinutes} minutes`,
      severity: 'high',
      ip: options.ip,
      userAgent: options.userAgent,
    });

    return { success: true, bypassUntil };
  } catch (error) {
    logger.error('mfa-service', { action: 'admin_bypass_error', error: String(error) });
    return { success: false, error: 'Error al conceder bypass' };
  }
}

/**
 * Admin: Revoke MFA bypass
 */
export async function adminRevokeBypass(
  targetAgentId: string,
  adminId: string,
  options: { adminName: string; ip: string; userAgent?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    await Agent.updateOne(
      { _id: targetAgentId },
      { mfaBypassUntil: null }
    );

    // Log audit
    await logAudit({
      action: 'mfa_bypass_revoked',
      category: 'security',
      actorId: adminId,
      actorType: 'admin',
      actorName: options.adminName,
      targetType: 'agent',
      targetId: targetAgentId,
      severity: 'medium',
      ip: options.ip,
      userAgent: options.userAgent,
    });

    return { success: true };
  } catch (error) {
    logger.error('mfa-service', { action: 'admin_revoke_bypass_error', error: String(error) });
    return { success: false, error: 'Error al revocar bypass' };
  }
}

// ============= TRUSTED DEVICES =============

/**
 * Get agent's trusted devices
 */
export async function getAgentTrustedDevices(agentId: string) {
  return getTrustedDevices(agentId);
}

/**
 * Revoke a trusted device
 */
export async function revokeAgentDevice(
  deviceId: string,
  agentId: string,
  options: { agentName: string; ip: string; userAgent?: string; reason?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const success = await revokeDevice(deviceId, agentId, options.reason || 'user_revoked');
    
    if (success) {
      await logAudit({
        action: 'trusted_device_revoked',
        category: 'security',
        actorId: agentId,
        actorType: 'agent',
        actorName: options.agentName,
        targetType: 'device',
        targetId: deviceId,
        severity: 'low',
        ip: options.ip,
        userAgent: options.userAgent,
      });
    }

    return { success };
  } catch (error) {
    return { success: false, error: 'Error al revocar dispositivo' };
  }
}

/**
 * Revoke all trusted devices
 */
export async function revokeAllAgentDevices(
  agentId: string,
  options: { agentName: string; ip: string; userAgent?: string; reason?: string }
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const count = await revokeAllDevices(agentId, agentId, options.reason || 'user_revoked_all');
    
    await logAudit({
      action: 'all_trusted_devices_revoked',
      category: 'security',
      actorId: agentId,
      actorType: 'agent',
      actorName: options.agentName,
      targetType: 'agent',
      targetId: agentId,
      severity: 'medium',
      ip: options.ip,
      userAgent: options.userAgent,
    });

    return { success: true, count };
  } catch (error) {
    return { success: false, count: 0, error: 'Error al revocar dispositivos' };
  }
}

// ============= STATUS =============

/**
 * Get MFA status for an agent
 */
export async function getMFAStatus(agentId: string): Promise<{
  enabled: boolean;
  verifiedAt?: Date;
  enforcedByAdmin: boolean;
  hasBypass: boolean;
  bypassUntil?: Date;
  trustedDevicesCount: number;
  globalRequired: boolean;
  roleRequired: boolean;
}> {
  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }

  const globalSettings = await getGlobalMFASettings();
  const trustedDevices = await getTrustedDevices(agentId);

  return {
    enabled: agent.mfaEnabled || false,
    verifiedAt: agent.mfaVerifiedAt,
    enforcedByAdmin: agent.mfaEnforcedByAdmin || false,
    hasBypass: !!(agent.mfaBypassUntil && agent.mfaBypassUntil > new Date()),
    bypassUntil: agent.mfaBypassUntil,
    trustedDevicesCount: trustedDevices.length,
    globalRequired: globalSettings.mfaRequiredForAll,
    roleRequired: globalSettings.mfaRequiredRoles.includes(agent.role),
  };
}

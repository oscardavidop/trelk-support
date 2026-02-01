/**
 * MFA Service
 * Complete Multi-Factor Authentication service supporting:
 * - Telegram (code via bot)
 * - TOTP (Google Authenticator, Authy, etc.)
 * 
 * Features:
 * - Multi-method MFA
 * - Method selection by user
 * - Trusted device management
 * - Rate limiting
 * - Admin controls
 * - Audit logging
 * - Backup codes for TOTP
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
  // TOTP
  createTOTPSecret,
  getTOTPSecret,
  getTOTPDocument,
  verifyTOTPSetup,
  verifyAgentTOTP,
  useBackupCode,
  regenerateBackupCodes,
  getBackupCodesStatus,
  deleteTOTPSecret,
  hasTOTPEnabled,
} from '../database/index.js';
import { sendMFACodeTelegram, sendMFAAlertTelegram } from './telegram-notifications.js';
import { logAudit } from './audit-log.service.js';
import { logger } from './logger.js';

// ============= TYPES =============

export type MFAMethod = 'telegram' | 'totp';

export interface MFAInitResult {
  required: boolean;
  loginToken?: string;
  message?: string;
  expiresIn?: number;
  error?: string;
  // Multi-method support
  availableMethods?: MFAMethod[];
  preferredMethod?: MFAMethod;
  selectedMethod?: MFAMethod;
}

export interface MFAVerifyResult {
  success: boolean;
  agentId?: string;
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

export interface TOTPSetupResult {
  success: boolean;
  secret?: string;
  qrCodeUri?: string;
  backupCodes?: string[];
  error?: string;
}

export interface GlobalMFASettings {
  mfaRequiredForAll: boolean;
  mfaRequiredRoles: string[];
  mfaBypassIPs: string[];
  mfaTrustDevicesEnabled: boolean;
  mfaAllowedMethods: MFAMethod[];
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
    mfaAllowedMethods: settings?.security?.mfaAllowedMethods || ['telegram', 'totp'],
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
  if (agent.security.mfa.bypassUntil && agent.security.mfa.bypassUntil > new Date()) {
    return false;
  }

  // Check if agent has MFA enabled
  if (agent.security.mfa.enabled) {
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
  if (agent.security.mfa.enforcedByAdmin) {
    return true;
  }

  return false;
}

// ============= HELPER: GET AVAILABLE MFA METHODS =============

/**
 * Get available MFA methods for an agent
 */
export async function getAgentMFAMethods(agent: IAgent): Promise<MFAMethod[]> {
  const methods: MFAMethod[] = [];
  
  // Check Telegram - support both new system (mfaMethods.telegram) and legacy (mfaEnabled + telegramId)
  const hasTelegramNewSystem = agent.telegramId && agent.security.mfa.methods?.telegram;
  const hasTelegramLegacy = agent.telegramId && agent.security.mfa.enabled && !agent.security.mfa.methods?.telegram && !agent.security.mfa.methods?.totp;
  
  if (hasTelegramNewSystem || hasTelegramLegacy) {
    methods.push('telegram');
  }
  
  // Check TOTP
  if (agent.security.mfa.methods?.totp) {
    const hasTOTP = await hasTOTPEnabled(agent._id);
    if (hasTOTP) {
      methods.push('totp');
    }
  }
  
  return methods;
}

// ============= MFA FLOW =============

/**
 * Initialize MFA verification after successful password check
 * Now supports method selection for multi-method MFA
 */
export async function initiateMFA(
  agent: IAgent,
  options: {
    ip?: string;
    userAgent?: string;
    deviceFingerprint?: string;
    preferredMethod?: MFAMethod;
  }
): Promise<MFAInitResult> {
  try {
    // Check if MFA is required
    const mfaRequired = await isMFARequired(agent, options.ip);
    
    if (!mfaRequired) {
      return { required: false };
    }

    // Get available methods for this agent
    const availableMethods = await getAgentMFAMethods(agent);
    
    // If no methods configured but MFA required, return error
    if (availableMethods.length === 0) {
      return {
        required: true,
        error: 'No tienes ningún método MFA configurado. Configura uno en Ajustes → Seguridad.',
        availableMethods: [],
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

    // Determine which method to use
    const selectedMethod = options.preferredMethod && availableMethods.includes(options.preferredMethod)
      ? options.preferredMethod
      : agent.security.mfa.preferredMethod && availableMethods.includes(agent.security.mfa.preferredMethod)
        ? agent.security.mfa.preferredMethod
        : availableMethods[0];

    // If TOTP selected, no need to send code - user enters from app
    if (selectedMethod === 'totp') {
      // Create a session for TOTP verification
      const { loginToken } = await createMFASession(agent._id.toString(), {
        ip: options.ip,
        userAgent: options.userAgent,
        expiryMinutes: 5, // 5 minutes for TOTP
      });

      logger.info('mfa-service', {
        action: 'mfa_initiated',
        agentId: agent._id.toString(),
        method: 'totp',
      });

      return {
        required: true,
        loginToken,
        availableMethods,
        preferredMethod: agent.security.mfa.preferredMethod,
        selectedMethod: 'totp',
        message: 'Ingresa el código de tu app autenticadora',
        expiresIn: 5 * 60,
      };
    }

    // Telegram method
    if (selectedMethod === 'telegram') {
      // Check if agent has Telegram linked
      if (!agent.telegramId) {
        logger.warn('mfa-service', {
          action: 'mfa_no_telegram',
          agentId: agent._id.toString(),
        });
        return {
          required: true,
          error: 'No tienes Telegram vinculado.',
          availableMethods: availableMethods.filter(m => m !== 'telegram'),
        };
      }

      // Check if agent is blocked
      const { blocked, blockedUntil } = await isAgentMFABlocked(agent._id);
      if (blocked) {
        return {
          required: true,
          error: `Demasiados intentos fallidos. Intenta de nuevo a las ${blockedUntil?.toLocaleTimeString('es-ES')}`,
          availableMethods,
          selectedMethod: 'telegram',
        };
      }

      // Check for existing pending session that can be reused
      const existingSession = await getPendingMFASession(agent._id);
      if (existingSession && existingSession.loginToken) {
        const expiresIn = Math.floor((existingSession.expiresAt.getTime() - Date.now()) / 1000);
        
        logger.info('mfa-service', {
          action: 'mfa_session_reused',
          agentId: agent._id.toString(),
          sessionId: existingSession._id.toString(),
          expiresIn,
        });
        
        return {
          required: true,
          loginToken: existingSession.loginToken,
          availableMethods,
          preferredMethod: agent.security.mfa.preferredMethod,
          selectedMethod: 'telegram',
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
          availableMethods,
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
        method: 'telegram',
      });

      return {
        required: true,
        loginToken,
        availableMethods,
        preferredMethod: agent.security.mfa.preferredMethod,
        selectedMethod: 'telegram',
        message: 'Se ha enviado un código de verificación a tu Telegram',
        expiresIn: MFA_CONFIG.CODE_EXPIRY_MINUTES * 60,
      };
    }

    return {
      required: true,
      error: 'Método MFA no soportado',
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
 * Verify MFA code (supports both Telegram and TOTP)
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
    method?: MFAMethod;
    isBackupCode?: boolean;
  }
): Promise<MFAVerifyResult & { agentId?: string }> {
  try {
    // Get the MFA session first to determine agent
    const session = await getMFASessionByToken(loginToken);
    if (!session) {
      return { success: false, error: 'Sesión de verificación expirada. Inicia sesión de nuevo.' };
    }

    const agentId = session.agentId.toString();
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    let verificationSuccess = false;
    let errorMessage = '';

    // Handle backup code
    if (options.isBackupCode) {
      const backupResult = await useBackupCode(agentId, code);
      if (backupResult.success) {
        verificationSuccess = true;
        
        // Log backup code usage
        await logAudit({
          action: 'mfa_backup_code_used',
          category: 'authentication',
          actorId: agentId,
          actorType: 'agent',
          actorName: agent.name,
          targetType: 'agent',
          targetId: agentId,
          severity: 'medium',
          ip: options.ip || 'unknown',
          userAgent: options.userAgent,
          metadata: { remainingCodes: backupResult.remainingCodes },
        });
        
        // Warn if running low on backup codes
        if (backupResult.remainingCodes <= 2) {
          logger.warn('mfa-service', {
            action: 'backup_codes_low',
            agentId,
            remaining: backupResult.remainingCodes,
          });
        }
      } else {
        return { success: false, error: backupResult.error || 'Código de respaldo inválido' };
      }
    }
    // TOTP verification
    else if (options.method === 'totp' || (agent.security.mfa.methods?.totp && !agent.security.mfa.methods?.telegram)) {
      // Validate code format (6 digits)
      if (!code || !/^\d{6}$/.test(code)) {
        return { success: false, error: 'El código debe ser de 6 dígitos' };
      }

      const totpResult = await verifyAgentTOTP(agentId, code);
      if (totpResult.success) {
        verificationSuccess = true;
        
        // Mark MFA session as verified
        session.status = 'verified';
        session.verifiedAt = new Date();
        await session.save();
      } else {
        // Increment attempt counter on session
        session.attempts += 1;
        if (session.attempts >= session.maxAttempts) {
          session.status = 'blocked';
          session.blockedUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 min block
          await session.save();
          return { 
            success: false, 
            error: 'Demasiados intentos fallidos. Espera 10 minutos.',
            blockedUntil: session.blockedUntil,
          };
        }
        await session.save();
        return { 
          success: false, 
          error: 'Código incorrecto',
          remainingAttempts: session.maxAttempts - session.attempts,
        };
      }
    }
    // Telegram verification (original flow)
    else {
      // Validate code format
      if (!code || !/^\d{6}$/.test(code)) {
        return { success: false, error: 'El código debe ser de 6 dígitos' };
      }

      // Verify the code
      const result = await verifyMFACode(loginToken, code, options.ip);

      if (!result.valid) {
        // Log failed attempt
        await logAudit({
          action: 'mfa_verification_failed',
          category: 'authentication',
          actorId: agentId,
          actorType: 'agent',
          actorName: agent.name,
          targetType: 'agent',
          targetId: agentId,
          severity: 'medium',
          ip: options.ip || 'unknown',
          userAgent: options.userAgent,
        });

        return {
          success: false,
          error: result.error,
          remainingAttempts: result.remainingAttempts,
          blockedUntil: result.blockedUntil,
        };
      }
      
      verificationSuccess = true;
    }

    if (!verificationSuccess) {
      return { success: false, error: errorMessage || 'Verificación fallida' };
    }

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

    // Log successful verification
    await logAudit({
      action: 'mfa_verification_success',
      category: 'authentication',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent.name,
      targetType: 'agent',
      targetId: agentId,
      severity: 'low',
      ip: options.ip || 'unknown',
      userAgent: options.userAgent,
      metadata: { method: options.method || 'telegram' },
    });

    logger.info('mfa-service', {
      action: 'mfa_verified',
      agentId,
      method: options.method || 'telegram',
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

    if (agent.security.mfa.enabled) {
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
        'security.mfa.enabled': true,
        'security.mfa.verifiedAt': new Date(),
        'security.mfa.disabledAt': null,
        'security.mfa.disabledBy': null,
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

    if (!agent.security.mfa.enabled) {
      return { success: false, error: 'MFA no está activado' };
    }

    // Check if MFA was enforced by admin
    if (agent.security.mfa.enforcedByAdmin) {
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
        'security.mfa.enabled': false,
        'security.mfa.disabledAt': new Date(),
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
        'security.mfa.enabled': true,
        'security.mfa.enforcedByAdmin': true,
        'security.mfa.verifiedAt': new Date(),
        'security.mfa.disabledAt': null,
        'security.mfa.disabledBy': null,
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
        'security.mfa.enabled': false,
        'security.mfa.enforcedByAdmin': false,
        'security.mfa.disabledAt': new Date(),
        'security.mfa.disabledBy': adminId,
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
      { 'security.mfa.bypassUntil': bypassUntil }
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
      { 'security.mfa.bypassUntil': null }
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
  methods: { telegram: boolean; totp: boolean };
  preferredMethod?: MFAMethod;
  verifiedAt?: Date;
  enforcedByAdmin: boolean;
  hasBypass: boolean;
  bypassUntil?: Date;
  trustedDevicesCount: number;
  globalRequired: boolean;
  roleRequired: boolean;
  totpConfigured: boolean;
  backupCodesStatus?: { total: number; used: number; remaining: number };
}> {
  const agent = await Agent.findById(agentId);
  if (!agent) {
    throw new Error('Agent not found');
  }

  const globalSettings = await getGlobalMFASettings();
  const trustedDevices = await getTrustedDevices(agentId);
  const totpConfigured = await hasTOTPEnabled(agentId);
  const backupCodesStatus = totpConfigured ? await getBackupCodesStatus(agentId) : undefined;

  // Detect legacy Telegram MFA: mfaEnabled=true but mfaMethods.telegram not set
  // This happens for agents that enabled MFA before the multi-method system was implemented
  const hasTelegramLegacy = !!(agent.security.mfa.enabled && agent.telegramId && !agent.security.mfa.methods?.telegram && !agent.security.mfa.methods?.totp);
  const telegramEnabled = !!(agent.security.mfa.methods?.telegram || hasTelegramLegacy);

  return {
    enabled: agent.security.mfa.enabled || false,
    methods: {
      telegram: telegramEnabled,
      totp: agent.security.mfa.methods?.totp || false,
    },
    preferredMethod: agent.security.mfa.preferredMethod,
    verifiedAt: agent.security.mfa.verifiedAt,
    enforcedByAdmin: agent.security.mfa.enforcedByAdmin || false,
    hasBypass: !!(agent.security.mfa.bypassUntil && agent.security.mfa.bypassUntil > new Date()),
    bypassUntil: agent.security.mfa.bypassUntil,
    trustedDevicesCount: trustedDevices.length,
    globalRequired: globalSettings.mfaRequiredForAll,
    roleRequired: globalSettings.mfaRequiredRoles.includes(agent.role),
    totpConfigured,
    backupCodesStatus: backupCodesStatus || undefined,
  };
}

// ============= TOTP MANAGEMENT =============

/**
 * Start TOTP setup - Generate secret and QR code
 */
export async function startTOTPSetup(
  agentId: string,
  options: { ip: string; userAgent?: string }
): Promise<TOTPSetupResult> {
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    // Check if TOTP already configured
    const existingTOTP = await getTOTPDocument(agentId);
    if (existingTOTP?.verified) {
      return { success: false, error: 'TOTP ya está configurado. Desactívalo primero para reconfigurarlo.' };
    }

    // Generate TOTP secret and backup codes
    const { secret, backupCodes, uri } = await createTOTPSecret(agentId, agent.email);

    logger.info('mfa-service', {
      action: 'totp_setup_started',
      agentId,
    });

    return {
      success: true,
      secret,
      qrCodeUri: uri,
      backupCodes,
    };
  } catch (error) {
    logger.error('mfa-service', { action: 'totp_setup_error', error: String(error) });
    return { success: false, error: 'Error al iniciar configuración TOTP' };
  }
}

/**
 * Complete TOTP setup - Verify first code
 */
export async function completeTOTPSetup(
  agentId: string,
  code: string,
  options: { ip: string; userAgent?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    // Verify the code
    const result = await verifyTOTPSetup(agentId, code);
    if (!result.success) {
      return result;
    }

    // Update agent MFA settings
    await Agent.updateOne(
      { _id: agentId },
      {
        'security.mfa.enabled': true,
        'security.mfa.methods.totp': true,
        'security.mfa.verifiedAt': agent.security.mfa.verifiedAt || new Date(),
        // Set preferred method to TOTP if not already set
        'security.mfa.preferredMethod': agent.security.mfa.preferredMethod || 'totp',
      }
    );

    // Log audit
    await logAudit({
      action: 'mfa_method_added',
      category: 'security',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent.name,
      targetType: 'agent',
      targetId: agentId,
      severity: 'medium',
      ip: options.ip,
      userAgent: options.userAgent,
      metadata: { method: 'totp' },
    });

    logger.info('mfa-service', {
      action: 'totp_setup_completed',
      agentId,
    });

    return { success: true };
  } catch (error) {
    logger.error('mfa-service', { action: 'totp_complete_error', error: String(error) });
    return { success: false, error: 'Error al completar configuración TOTP' };
  }
}

/**
 * Disable TOTP for an agent
 */
export async function disableTOTP(
  agentId: string,
  options: { ip: string; userAgent?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    // Check if enforced by admin
    if (agent.security.mfa.enforcedByAdmin) {
      // Check if agent has another method
      if (!agent.security.mfa.methods?.telegram) {
        return { success: false, error: 'No puedes desactivar TOTP porque MFA está forzado y no tienes otro método activo.' };
      }
    }

    // Check global policy
    const globalSettings = await getGlobalMFASettings();
    if (globalSettings.mfaRequiredForAll || globalSettings.mfaRequiredRoles.includes(agent.role)) {
      if (!agent.security.mfa.methods?.telegram) {
        return { success: false, error: 'No puedes desactivar TOTP porque la política de seguridad requiere MFA.' };
      }
    }

    // Delete TOTP secret
    await deleteTOTPSecret(agentId);

    // Update agent
    const hasTelegram = agent.security.mfa.methods?.telegram || false;
    await Agent.updateOne(
      { _id: agentId },
      {
        'security.mfa.methods.totp': false,
        'security.mfa.enabled': hasTelegram, // Only keep enabled if telegram is active
        'security.mfa.preferredMethod': hasTelegram ? 'telegram' : null,
      }
    );

    // Log audit
    await logAudit({
      action: 'mfa_method_removed',
      category: 'security',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent.name,
      targetType: 'agent',
      targetId: agentId,
      severity: 'high',
      ip: options.ip,
      userAgent: options.userAgent,
      metadata: { method: 'totp' },
    });

    logger.info('mfa-service', {
      action: 'totp_disabled',
      agentId,
    });

    return { success: true };
  } catch (error) {
    logger.error('mfa-service', { action: 'totp_disable_error', error: String(error) });
    return { success: false, error: 'Error al desactivar TOTP' };
  }
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodesForAgent(
  agentId: string,
  options: { ip: string; userAgent?: string }
): Promise<{ success: boolean; codes?: string[]; error?: string }> {
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    const result = await regenerateBackupCodes(agentId);
    if (!result) {
      return { success: false, error: 'TOTP no está configurado' };
    }

    // Log audit
    await logAudit({
      action: 'mfa_backup_codes_regenerated',
      category: 'security',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent.name,
      targetType: 'agent',
      targetId: agentId,
      severity: 'medium',
      ip: options.ip,
      userAgent: options.userAgent,
    });

    logger.info('mfa-service', {
      action: 'backup_codes_regenerated',
      agentId,
    });

    return { success: true, codes: result.codes };
  } catch (error) {
    logger.error('mfa-service', { action: 'regenerate_codes_error', error: String(error) });
    return { success: false, error: 'Error al regenerar códigos' };
  }
}

/**
 * Set preferred MFA method
 */
export async function setPreferredMFAMethod(
  agentId: string,
  method: MFAMethod,
  options: { ip: string; userAgent?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    // Verify the method is enabled
    if (method === 'telegram' && !agent.security.mfa.methods?.telegram) {
      return { success: false, error: 'Telegram MFA no está activado' };
    }
    if (method === 'totp' && !agent.security.mfa.methods?.totp) {
      return { success: false, error: 'TOTP no está configurado' };
    }

    await Agent.updateOne(
      { _id: agentId },
      { 'security.mfa.preferredMethod': method }
    );

    // Log audit
    await logAudit({
      action: 'mfa_preferred_method_changed',
      category: 'security',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent.name,
      targetType: 'agent',
      targetId: agentId,
      severity: 'low',
      ip: options.ip,
      userAgent: options.userAgent,
      metadata: { method },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al cambiar método preferido' };
  }
}

/**
 * Enable Telegram MFA method (when agent links Telegram)
 */
export async function enableTelegramMFA(
  agentId: string,
  options: { ip?: string; userAgent?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, error: 'Agente no encontrado' };
    }

    if (!agent.telegramId) {
      return { success: false, error: 'Debes vincular Telegram primero' };
    }

    await Agent.updateOne(
      { _id: agentId },
      {
        'security.mfa.enabled': true,
        'security.mfa.methods.telegram': true,
        'security.mfa.verifiedAt': agent.security.mfa.verifiedAt || new Date(),
        'security.mfa.preferredMethod': agent.security.mfa.preferredMethod || 'telegram',
      }
    );

    // Log audit
    await logAudit({
      action: 'mfa_method_added',
      category: 'security',
      actorId: agentId,
      actorType: 'agent',
      actorName: agent.name,
      targetType: 'agent',
      targetId: agentId,
      severity: 'medium',
      ip: options.ip || 'system',
      userAgent: options.userAgent,
      metadata: { method: 'telegram' },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Error al activar Telegram MFA' };
  }
}

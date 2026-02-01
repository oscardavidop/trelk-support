/**
 * MFA Session Model
 * Temporary session for MFA verification during login
 * 
 * Security features:
 * - Code stored as SHA-256 hash (never plain text)
 * - Short expiration (2-5 minutes)
 * - Maximum attempts with lockout
 * - IP and UserAgent tracking
 * - Automatic cleanup via TTL
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import crypto from 'crypto';

export type MFASessionStatus = 'pending' | 'verified' | 'expired' | 'blocked' | 'cancelled';

export interface IMFASession extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  codeHash: string;              // SHA-256 hash of the 6-digit code
  expiresAt: Date;
  status: MFASessionStatus;
  attempts: number;              // Failed verification attempts
  maxAttempts: number;           // Max allowed attempts (default 3)
  verifiedAt?: Date;
  verifiedExpiresAt?: Date;      // Short window to complete login after verification
  blockedUntil?: Date;           // If blocked due to too many attempts
  ip?: string;
  userAgent?: string;
  verifiedIp?: string;           // IP that verified the code (for binding)
  verifiedUserAgent?: string;    // UA that verified (for binding)
  telegramMessageId?: number;    // To potentially delete/update the message
  loginToken?: string;           // Temporary token to complete login after MFA
  method?: 'telegram' | 'totp' | 'backup'; // Method used for verification
  createdAt: Date;
  updatedAt: Date;
}

const MFASessionSchema = new Schema<IMFASession>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'verified', 'expired', 'blocked', 'cancelled'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedExpiresAt: {
      type: Date,
      default: null,
    },
    blockedUntil: {
      type: Date,
      default: null,
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    verifiedIp: {
      type: String,
    },
    verifiedUserAgent: {
      type: String,
    },
    telegramMessageId: {
      type: Number,
    },
    loginToken: {
      type: String,
      index: true,
    },
    method: {
      type: String,
      enum: ['telegram', 'totp', 'backup'],
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: auto-delete expired sessions after 1 hour
MFASessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 3600 } // 1 hour after expiration
);

// Compound indexes for efficient queries
MFASessionSchema.index({ agentId: 1, status: 1 });
MFASessionSchema.index({ loginToken: 1, status: 1 });

// ============= CONFIGURATION =============

const MFA_CONFIG = {
  CODE_LENGTH: 6,
  CODE_EXPIRY_MINUTES: 2,
  MAX_ATTEMPTS: 3,
  BLOCK_DURATION_MINUTES: 10,
  RESEND_COOLDOWN_SECONDS: 60,
};

// ============= HELPER FUNCTIONS =============

/**
 * Generate a secure random 6-digit code
 */
export function generateMFACode(): string {
  // Generate cryptographically secure random number
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  // Ensure 6 digits (100000-999999)
  const code = 100000 + (randomNumber % 900000);
  return code.toString();
}

/**
 * Hash MFA code for storage
 */
export function hashMFACode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Generate a secure login token for post-MFA authentication
 */
export function generateLoginToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ============= STATIC METHODS =============

/**
 * Create a new MFA session
 */
export async function createMFASession(
  agentId: string | Types.ObjectId,
  options: {
    ip?: string;
    userAgent?: string;
    expiryMinutes?: number;
  } = {}
): Promise<{ session: IMFASession; code: string; loginToken: string }> {
  const code = generateMFACode();
  const codeHash = hashMFACode(code);
  const loginToken = generateLoginToken();
  const expiresAt = new Date(Date.now() + (options.expiryMinutes || MFA_CONFIG.CODE_EXPIRY_MINUTES) * 60 * 1000);

  // Cancel any existing pending sessions for this agent
  await MFASession.updateMany(
    { agentId: new Types.ObjectId(agentId.toString()), status: 'pending' },
    { status: 'cancelled' }
  );

  const session = await MFASession.create({
    agentId: new Types.ObjectId(agentId.toString()),
    codeHash,
    expiresAt,
    loginToken,
    ip: options.ip,
    userAgent: options.userAgent,
    status: 'pending',
    attempts: 0,
    maxAttempts: MFA_CONFIG.MAX_ATTEMPTS,
  });

  return { session, code, loginToken };
}

/**
 * Verify MFA code
 */
export async function verifyMFACode(
  loginToken: string,
  code: string,
  ip?: string,
  userAgent?: string
): Promise<{ 
  valid: boolean; 
  session?: IMFASession; 
  error?: string;
  remainingAttempts?: number;
  blockedUntil?: Date;
}> {
  const session = await MFASession.findOne({ loginToken, status: 'pending' });

  if (!session) {
    // Add artificial delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    return { valid: false, error: 'Sesión de verificación no encontrada o expirada' };
  }

  // Check if blocked
  if (session.blockedUntil && session.blockedUntil > new Date()) {
    return { 
      valid: false, 
      error: `Demasiados intentos. Intenta de nuevo a las ${session.blockedUntil.toLocaleTimeString('es-ES')}`,
      blockedUntil: session.blockedUntil,
    };
  }

  // Check expiration
  if (session.expiresAt < new Date()) {
    session.status = 'expired';
    await session.save();
    return { valid: false, error: 'El código ha expirado. Solicita uno nuevo.' };
  }

  // Check code (timing-safe comparison via hash)
  const providedHash = hashMFACode(code);
  const isValidCode = providedHash === session.codeHash;

  if (!isValidCode) {
    session.attempts += 1;
    
    // Check if max attempts exceeded
    if (session.attempts >= session.maxAttempts) {
      session.status = 'blocked';
      session.blockedUntil = new Date(Date.now() + MFA_CONFIG.BLOCK_DURATION_MINUTES * 60 * 1000);
      await session.save();
      
      return { 
        valid: false, 
        error: `Demasiados intentos fallidos. Bloqueado por ${MFA_CONFIG.BLOCK_DURATION_MINUTES} minutos.`,
        blockedUntil: session.blockedUntil,
        remainingAttempts: 0,
      };
    }

    await session.save();
    return { 
      valid: false, 
      error: 'Código incorrecto',
      remainingAttempts: session.maxAttempts - session.attempts,
    };
  }

  // Code is valid - mark session as verified with security metadata
  session.status = 'verified';
  session.verifiedAt = new Date();
  // Set a short window to complete login (60 seconds) - security hardening
  session.verifiedExpiresAt = new Date(Date.now() + 60 * 1000);
  session.method = 'telegram'; // Telegram code verification
  if (ip) {
    session.ip = ip;
    session.verifiedIp = ip;
  }
  if (userAgent) {
    session.userAgent = userAgent;
    session.verifiedUserAgent = userAgent;
  }
  await session.save();

  return { valid: true, session };
}

/**
 * Get pending MFA session by login token
 */
export async function getMFASessionByToken(loginToken: string): Promise<IMFASession | null> {
  return MFASession.findOne({ loginToken, status: 'pending' });
}

/**
 * Get verified MFA session by login token (for completing login)
 * Includes security checks for time window and optional IP binding
 */
export async function getVerifiedMFASession(
  loginToken: string,
  options?: { ip?: string; strictIpBinding?: boolean }
): Promise<IMFASession | null> {
  const session = await MFASession.findOne({ loginToken, status: 'verified' });
  
  if (!session) return null;
  
  // Check if verification has expired (60 second window)
  if (session.verifiedExpiresAt && session.verifiedExpiresAt < new Date()) {
    // Mark as expired for audit trail
    session.status = 'expired';
    await session.save();
    return null;
  }
  
  // Optional strict IP binding - check if IP matches
  if (options?.strictIpBinding && options.ip && session.verifiedIp) {
    if (session.verifiedIp !== options.ip) {
      // Log suspicious activity but don't block by default
      // This could be a legitimate case (mobile network change, etc.)
      // Set strictIpBinding: true only for high-security scenarios
      return null;
    }
  }
  
  return session;
}

/**
 * Consume verified MFA session (one-time use)
 */
export async function consumeVerifiedMFASession(loginToken: string): Promise<IMFASession | null> {
  // Atomically find and mark as consumed to prevent race conditions
  const session = await MFASession.findOneAndUpdate(
    { 
      loginToken, 
      status: 'verified',
      verifiedExpiresAt: { $gt: new Date() } // Must not be expired
    },
    { 
      status: 'expired', // Consume the session
      $set: { consumedAt: new Date() }
    },
    { new: false } // Return the original document before update
  );
  
  return session;
}

/**
 * Check if agent can request new MFA code (rate limiting)
 */
export async function canResendMFACode(agentId: string | Types.ObjectId): Promise<{
  canResend: boolean;
  waitSeconds?: number;
}> {
  const recentSession = await MFASession.findOne({
    agentId: new Types.ObjectId(agentId.toString()),
    createdAt: { $gte: new Date(Date.now() - MFA_CONFIG.RESEND_COOLDOWN_SECONDS * 1000) },
  }).sort({ createdAt: -1 });

  if (recentSession) {
    const waitSeconds = Math.ceil(
      (MFA_CONFIG.RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - recentSession.createdAt.getTime())) / 1000
    );
    return { canResend: false, waitSeconds };
  }

  return { canResend: true };
}

/**
 * Check if agent is blocked from MFA attempts
 */
export async function isAgentMFABlocked(agentId: string | Types.ObjectId): Promise<{
  blocked: boolean;
  blockedUntil?: Date;
}> {
  const blockedSession = await MFASession.findOne({
    agentId: new Types.ObjectId(agentId.toString()),
    status: 'blocked',
    blockedUntil: { $gt: new Date() },
  });

  if (blockedSession) {
    return { blocked: true, blockedUntil: blockedSession.blockedUntil };
  }

  return { blocked: false };
}

/**
 * Get pending valid MFA session for an agent (for reuse during login)
 */
export async function getPendingMFASession(agentId: string | Types.ObjectId): Promise<IMFASession | null> {
  return MFASession.findOne({
    agentId: new Types.ObjectId(agentId.toString()),
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
}

/**
 * Cancel all pending MFA sessions for an agent
 */
export async function cancelAllMFASessions(agentId: string | Types.ObjectId): Promise<number> {
  const result = await MFASession.updateMany(
    { agentId: new Types.ObjectId(agentId.toString()), status: 'pending' },
    { status: 'cancelled' }
  );
  return result.modifiedCount;
}

/**
 * Clean up expired sessions (can be called by cron)
 */
export async function cleanupExpiredMFASessions(): Promise<number> {
  const result = await MFASession.updateMany(
    { status: 'pending', expiresAt: { $lt: new Date() } },
    { status: 'expired' }
  );
  return result.modifiedCount;
}

export const MFASession = mongoose.model<IMFASession>('MFASession', MFASessionSchema);

export { MFA_CONFIG };

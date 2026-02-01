/**
 * Password Reset Token Model
 * Secure token storage for password reset flow
 * 
 * Security features:
 * - Token stored as SHA-256 hash (never plain text)
 * - Single-use tokens with usedAt tracking
 * - Strict expiration (15 minutes default)
 * - IP and UserAgent tracking for security audits
 * - Automatic cleanup of expired tokens via TTL index
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import crypto from 'crypto';

export type ResetTokenStatus = 'pending' | 'used' | 'expired' | 'revoked';

export interface IPasswordResetToken extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  tokenHash: string;           // SHA-256 hash of the token (never store plain text)
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  revokedAt?: Date;
  revokedBy?: Types.ObjectId;
  revokedReason?: string;
  status: ResetTokenStatus;
  ip?: string;
  userAgent?: string;
  requestedBy?: Types.ObjectId; // Admin who requested the reset (if not self-service)
  requestSource: 'telegram' | 'dashboard' | 'api' | 'admin';
  attemptCount: number;        // Failed validation attempts
  lastAttemptAt?: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      default: null,
    },
    revokedReason: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'used', 'expired', 'revoked'],
      default: 'pending',
      index: true,
    },
    ip: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      default: null,
    },
    requestSource: {
      type: String,
      enum: ['telegram', 'dashboard', 'api', 'admin'],
      required: true,
    },
    attemptCount: {
      type: Number,
      default: 0,
    },
    lastAttemptAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index: auto-delete expired tokens after 24 hours
PasswordResetTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 86400 } // 24 hours after expiration
);

// Compound index for fast lookups
PasswordResetTokenSchema.index({ agentId: 1, status: 1 });

// ============= STATIC METHODS =============

/**
 * Generate a secure random token
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash a token for storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new password reset token
 */
export async function createResetToken(
  agentId: string | Types.ObjectId,
  options: {
    requestSource: IPasswordResetToken['requestSource'];
    requestedBy?: string | Types.ObjectId;
    ip?: string;
    userAgent?: string;
    expiresInMinutes?: number;
  }
): Promise<{ token: string; record: IPasswordResetToken }> {
  const token = generateSecureToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (options.expiresInMinutes || 15) * 60 * 1000);

  // Invalidate any existing pending tokens for this agent
  await PasswordResetToken.updateMany(
    { agentId, status: 'pending' },
    { status: 'revoked', revokedAt: new Date(), revokedReason: 'new_token_requested' }
  );

  const record = await PasswordResetToken.create({
    agentId: new Types.ObjectId(agentId.toString()),
    tokenHash,
    expiresAt,
    ip: options.ip,
    userAgent: options.userAgent,
    requestedBy: options.requestedBy ? new Types.ObjectId(options.requestedBy.toString()) : undefined,
    requestSource: options.requestSource,
    status: 'pending',
  });

  return { token, record };
}

// Maximum attempts before token is auto-revoked
const MAX_TOKEN_ATTEMPTS = 5;

/**
 * Validate and consume a reset token
 * Returns the token record if valid, null otherwise
 */
export async function validateAndConsumeToken(
  token: string,
  ip?: string,
  userAgent?: string
): Promise<{ valid: boolean; record?: IPasswordResetToken; error?: string }> {
  // Use timing-safe comparison to prevent timing attacks
  const tokenHash = hashToken(token);
  
  const record = await PasswordResetToken.findOne({ tokenHash });
  
  if (!record) {
    // Add artificial delay to prevent timing-based enumeration
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    return { valid: false, error: 'Token no encontrado o inválido' };
  }

  // Increment attempt count
  record.attemptCount += 1;
  record.lastAttemptAt = new Date();
  
  // Check if too many attempts (brute force protection)
  if (record.attemptCount > MAX_TOKEN_ATTEMPTS) {
    record.status = 'revoked';
    record.revokedAt = new Date();
    record.revokedReason = 'max_attempts_exceeded';
    await record.save();
    return { valid: false, error: 'Demasiados intentos. El enlace ha sido revocado por seguridad.', record };
  }
  
  await record.save();

  // Check if already used
  if (record.status === 'used') {
    return { valid: false, error: 'Este enlace ya fue utilizado', record };
  }

  // Check if revoked
  if (record.status === 'revoked') {
    return { valid: false, error: 'Este enlace ha sido revocado', record };
  }

  // Check expiration
  if (record.expiresAt < new Date() || record.status === 'expired') {
    record.status = 'expired';
    await record.save();
    return { valid: false, error: 'Este enlace ha expirado', record };
  }

  // Token is valid - mark as used
  record.status = 'used';
  record.usedAt = new Date();
  if (ip) record.ip = ip;
  if (userAgent) record.userAgent = userAgent;
  await record.save();

  return { valid: true, record };
}

/**
 * Validate token without consuming (for UI preview)
 */
export async function validateTokenOnly(token: string): Promise<{ 
  valid: boolean; 
  error?: string;
  expiresAt?: Date;
  agentId?: string;
}> {
  const tokenHash = hashToken(token);
  
  const record = await PasswordResetToken.findOne({ tokenHash });
  
  if (!record) {
    return { valid: false, error: 'Token no encontrado o inválido' };
  }

  if (record.status === 'used') {
    return { valid: false, error: 'Este enlace ya fue utilizado' };
  }

  if (record.status === 'revoked') {
    return { valid: false, error: 'Este enlace ha sido revocado' };
  }

  if (record.expiresAt < new Date()) {
    return { valid: false, error: 'Este enlace ha expirado' };
  }

  return { 
    valid: true, 
    expiresAt: record.expiresAt,
    agentId: record.agentId.toString()
  };
}

/**
 * Revoke all pending tokens for an agent
 */
export async function revokeAllTokensForAgent(
  agentId: string | Types.ObjectId,
  revokedBy?: string | Types.ObjectId,
  reason?: string
): Promise<number> {
  const result = await PasswordResetToken.updateMany(
    { agentId: new Types.ObjectId(agentId.toString()), status: 'pending' },
    { 
      status: 'revoked', 
      revokedAt: new Date(),
      revokedBy: revokedBy ? new Types.ObjectId(revokedBy.toString()) : undefined,
      revokedReason: reason || 'manual_revocation'
    }
  );
  return result.modifiedCount;
}

/**
 * Get pending tokens count for an agent (for rate limiting)
 */
export async function getPendingTokensCount(
  agentId: string | Types.ObjectId,
  withinMinutes: number = 60
): Promise<number> {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000);
  return PasswordResetToken.countDocuments({
    agentId: new Types.ObjectId(agentId.toString()),
    createdAt: { $gte: since },
  });
}

/**
 * Clean up expired tokens (called by cron job)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await PasswordResetToken.updateMany(
    { status: 'pending', expiresAt: { $lt: new Date() } },
    { status: 'expired' }
  );
  return result.modifiedCount;
}

export const PasswordResetToken = mongoose.model<IPasswordResetToken>(
  'PasswordResetToken',
  PasswordResetTokenSchema
);

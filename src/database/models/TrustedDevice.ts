/**
 * Trusted Device Model
 * Stores trusted devices to skip MFA verification
 * 
 * Features:
 * - Device fingerprinting
 * - Configurable trust duration (default 30 days)
 * - Revocable by user or admin
 * - Audit trail
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import crypto from 'crypto';

export interface ITrustedDevice extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  fingerprint: string;           // Hashed device fingerprint
  name?: string;                 // User-friendly device name
  lastUsedAt: Date;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  isActive: boolean;
  revokedAt?: Date;
  revokedBy?: Types.ObjectId;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TrustedDeviceSchema = new Schema<ITrustedDevice>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      default: null,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    ip: String,
    userAgent: String,
    browser: String,
    os: String,
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    revokedAt: Date,
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    revokedReason: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
TrustedDeviceSchema.index({ agentId: 1, fingerprint: 1 });
TrustedDeviceSchema.index({ agentId: 1, isActive: 1 });

// TTL index for auto-cleanup of expired devices
TrustedDeviceSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 86400 * 7 } // 7 days after expiration
);

// ============= CONFIGURATION =============

const TRUSTED_DEVICE_CONFIG = {
  TRUST_DURATION_DAYS: 30,
  MAX_DEVICES_PER_USER: 10,
};

// ============= HELPER FUNCTIONS =============

/**
 * Generate device fingerprint from various client data
 * Now includes IP to bind fingerprint to network context
 */
export function generateDeviceFingerprint(data: {
  userAgent?: string;
  ip?: string;
  acceptLanguage?: string;
  screenResolution?: string;
  timezone?: string;
  clientFingerprint?: string; // From client-side fingerprinting library
}): string {
  // If no clientFingerprint provided (incognito, cookies cleared), return empty
  // The caller must handle empty fingerprints as "untrusted"
  if (!data.clientFingerprint) {
    return '';
  }

  // Combine available data for fingerprinting — now includes IP for network binding
  const fingerprintData = [
    data.userAgent || '',
    data.ip || '',
    data.acceptLanguage || '',
    data.screenResolution || '',
    data.timezone || '',
    data.clientFingerprint,
  ].join('|');

  return crypto.createHash('sha256').update(fingerprintData).digest('hex');
}

/**
 * Parse user agent to extract browser and OS info
 */
export function parseUserAgent(userAgent: string): { browser: string; os: string } {
  let browser = 'Unknown';
  let os = 'Unknown';

  // Browser detection
  if (userAgent.includes('Firefox/')) browser = 'Firefox';
  else if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Chrome/')) browser = 'Chrome';
  else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) browser = 'Safari';
  else if (userAgent.includes('Opera') || userAgent.includes('OPR/')) browser = 'Opera';

  // OS detection
  if (userAgent.includes('Windows NT 10')) os = 'Windows 10';
  else if (userAgent.includes('Windows NT 11') || userAgent.includes('Windows 11')) os = 'Windows 11';
  else if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS X')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) os = 'Android';
  else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';

  return { browser, os };
}

// ============= STATIC METHODS =============

/**
 * Trust a new device
 */
export async function trustDevice(
  agentId: string | Types.ObjectId,
  options: {
    fingerprint: string;
    ip?: string;
    userAgent?: string;
    name?: string;
    trustDays?: number;
  }
): Promise<ITrustedDevice> {
  const { browser, os } = options.userAgent ? parseUserAgent(options.userAgent) : { browser: undefined, os: undefined };
  const expiresAt = new Date(Date.now() + (options.trustDays || TRUSTED_DEVICE_CONFIG.TRUST_DURATION_DAYS) * 24 * 60 * 60 * 1000);

  // Check if device already exists
  const existingDevice = await TrustedDevice.findOne({
    agentId: new Types.ObjectId(agentId.toString()),
    fingerprint: options.fingerprint,
    isActive: true,
  });

  if (existingDevice) {
    // Update existing device
    existingDevice.lastUsedAt = new Date();
    existingDevice.expiresAt = expiresAt;
    existingDevice.ip = options.ip || existingDevice.ip;
    await existingDevice.save();
    return existingDevice;
  }

  // Check max devices limit
  const deviceCount = await TrustedDevice.countDocuments({
    agentId: new Types.ObjectId(agentId.toString()),
    isActive: true,
  });

  if (deviceCount >= TRUSTED_DEVICE_CONFIG.MAX_DEVICES_PER_USER) {
    // Remove oldest device
    await TrustedDevice.findOneAndDelete({
      agentId: new Types.ObjectId(agentId.toString()),
      isActive: true,
    }).sort({ lastUsedAt: 1 });
  }

  // Create new trusted device
  const device = await TrustedDevice.create({
    agentId: new Types.ObjectId(agentId.toString()),
    fingerprint: options.fingerprint,
    name: options.name || `${browser} on ${os}`,
    ip: options.ip,
    userAgent: options.userAgent,
    browser,
    os,
    expiresAt,
  });

  return device;
}

/**
 * Check if device is trusted for an agent
 * Rejects empty fingerprints to prevent bypass via incognito/cleared storage
 */
export async function isDeviceTrusted(
  agentId: string | Types.ObjectId,
  fingerprint: string
): Promise<{ trusted: boolean; device?: ITrustedDevice }> {
  // Empty or missing fingerprint = never trusted
  if (!fingerprint || fingerprint.length < 32) {
    return { trusted: false };
  }

  const device = await TrustedDevice.findOne({
    agentId: new Types.ObjectId(agentId.toString()),
    fingerprint,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });

  if (device) {
    // Update last used
    device.lastUsedAt = new Date();
    await device.save();
    return { trusted: true, device };
  }

  return { trusted: false };
}

/**
 * Get all trusted devices for an agent
 */
export async function getTrustedDevices(agentId: string | Types.ObjectId): Promise<ITrustedDevice[]> {
  return TrustedDevice.find({
    agentId: new Types.ObjectId(agentId.toString()),
    isActive: true,
    expiresAt: { $gt: new Date() },
  }).sort({ lastUsedAt: -1 });
}

/**
 * Revoke a specific trusted device
 */
export async function revokeDevice(
  deviceId: string | Types.ObjectId,
  revokedBy?: string | Types.ObjectId,
  reason?: string
): Promise<boolean> {
  const result = await TrustedDevice.updateOne(
    { _id: new Types.ObjectId(deviceId.toString()) },
    {
      isActive: false,
      revokedAt: new Date(),
      revokedBy: revokedBy ? new Types.ObjectId(revokedBy.toString()) : undefined,
      revokedReason: reason || 'user_revoked',
    }
  );
  return result.modifiedCount > 0;
}

/**
 * Revoke all trusted devices for an agent
 */
export async function revokeAllDevices(
  agentId: string | Types.ObjectId,
  revokedBy?: string | Types.ObjectId,
  reason?: string
): Promise<number> {
  const result = await TrustedDevice.updateMany(
    { agentId: new Types.ObjectId(agentId.toString()), isActive: true },
    {
      isActive: false,
      revokedAt: new Date(),
      revokedBy: revokedBy ? new Types.ObjectId(revokedBy.toString()) : undefined,
      revokedReason: reason || 'bulk_revocation',
    }
  );
  return result.modifiedCount;
}

export const TrustedDevice = mongoose.model<ITrustedDevice>('TrustedDevice', TrustedDeviceSchema);

export { TRUSTED_DEVICE_CONFIG };

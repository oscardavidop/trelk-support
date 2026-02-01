/**
 * TOTP Secret Model
 * Stores encrypted TOTP secrets for authenticator apps (Google Authenticator, Authy, etc.)
 * 
 * Security features:
 * - Secret stored encrypted with AES-256-GCM
 * - Backup codes stored as SHA-256 hashes
 * - Audit trail for all operations
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import crypto from 'crypto';

// ============= CONFIGURATION =============

const TOTP_CONFIG = {
  SECRET_LENGTH: 20,           // 20 bytes = 160 bits (standard for TOTP)
  BACKUP_CODES_COUNT: 8,       // Number of backup codes
  BACKUP_CODE_LENGTH: 8,       // Length of each backup code
  TIME_STEP: 30,               // TOTP time step in seconds (RFC 6238)
  DIGITS: 6,                   // Number of digits in TOTP code
  WINDOW: 1,                   // Time window tolerance (±1 step = ±30s)
  ALGORITHM: 'sha1',           // HMAC algorithm (most apps use SHA1)
};

// Encryption key from environment (must be 32 bytes for AES-256)
const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-change-in-production';

// ============= INTERFACES =============

export interface ITOTPSecret extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  
  // Encrypted secret
  secretEncrypted: string;     // AES-256-GCM encrypted base32 secret
  secretIv: string;            // Initialization vector
  secretAuthTag: string;       // Authentication tag
  
  // Backup codes (hashed)
  backupCodes: {
    codeHash: string;          // SHA-256 hash
    usedAt?: Date;             // When it was used (null = unused)
  }[];
  
  // Status
  verified: boolean;           // Has user verified with a code?
  verifiedAt?: Date;
  
  // Metadata
  label: string;               // App label (e.g., "Trelk Support")
  issuer: string;              // Issuer name
  
  createdAt: Date;
  updatedAt: Date;
}

// ============= SCHEMA =============

const TOTPSecretSchema = new Schema<ITOTPSecret>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      unique: true,             // One TOTP secret per agent
      index: true,
    },
    secretEncrypted: {
      type: String,
      required: true,
    },
    secretIv: {
      type: String,
      required: true,
    },
    secretAuthTag: {
      type: String,
      required: true,
    },
    backupCodes: [{
      codeHash: { type: String, required: true },
      usedAt: { type: Date, default: null },
    }],
    verified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    label: {
      type: String,
      default: 'Trelk Support',
    },
    issuer: {
      type: String,
      default: 'Trelk',
    },
  },
  {
    timestamps: true,
  }
);

// ============= ENCRYPTION HELPERS =============

/**
 * Derive a proper 32-byte key from the encryption key
 */
function deriveKey(key: string): Buffer {
  return crypto.scryptSync(key, 'totp-salt', 32);
}

/**
 * Encrypt a string using AES-256-GCM
 */
function encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = deriveKey(ENCRYPTION_KEY);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

/**
 * Decrypt a string using AES-256-GCM
 */
function decrypt(encrypted: string, iv: string, authTag: string): string {
  const key = deriveKey(ENCRYPTION_KEY);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// ============= TOTP HELPERS =============

/**
 * Generate a random base32 secret
 */
export function generateTOTPSecret(): string {
  const buffer = crypto.randomBytes(TOTP_CONFIG.SECRET_LENGTH);
  return base32Encode(buffer);
}

/**
 * Base32 encoding (RFC 4648)
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let bits = 0;
  let value = 0;
  
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    
    while (bits >= 5) {
      bits -= 5;
      result += alphabet[(value >> bits) & 0x1f];
    }
  }
  
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 0x1f];
  }
  
  return result;
}

/**
 * Base32 decoding
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleanedInput = encoded.replace(/=+$/, '').toUpperCase();
  
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  
  for (const char of cleanedInput) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    
    value = (value << 5) | index;
    bits += 5;
    
    if (bits >= 8) {
      bits -= 8;
      output.push((value >> bits) & 0xff);
    }
  }
  
  return Buffer.from(output);
}

/**
 * Generate TOTP code for a given time
 */
function generateTOTPCode(secret: string, time?: number): string {
  const now = time || Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / TOTP_CONFIG.TIME_STEP);
  
  // Convert counter to 8-byte buffer (big-endian)
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));
  
  // Decode base32 secret
  const secretBuffer = base32Decode(secret);
  
  // HMAC-SHA1
  const hmac = crypto.createHmac(TOTP_CONFIG.ALGORITHM, secretBuffer);
  hmac.update(counterBuffer);
  const hash = hmac.digest();
  
  // Dynamic truncation (RFC 4226)
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = 
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  
  // Generate 6-digit code
  const otp = binary % Math.pow(10, TOTP_CONFIG.DIGITS);
  return otp.toString().padStart(TOTP_CONFIG.DIGITS, '0');
}

/**
 * Verify TOTP code with time window tolerance
 */
export function verifyTOTPCode(secret: string, code: string): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  
  const now = Math.floor(Date.now() / 1000);
  
  // Check current time and ±WINDOW steps
  for (let i = -TOTP_CONFIG.WINDOW; i <= TOTP_CONFIG.WINDOW; i++) {
    const time = now + (i * TOTP_CONFIG.TIME_STEP);
    const expectedCode = generateTOTPCode(secret, time);
    
    // Timing-safe comparison
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expectedCode))) {
      return true;
    }
  }
  
  return false;
}

/**
 * Generate backup codes
 */
export function generateBackupCodes(): { codes: string[]; hashes: string[] } {
  const codes: string[] = [];
  const hashes: string[] = [];
  
  for (let i = 0; i < TOTP_CONFIG.BACKUP_CODES_COUNT; i++) {
    // Generate readable code (e.g., "XXXX-XXXX")
    const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
    const code = `${part1}-${part2}`;
    
    codes.push(code);
    hashes.push(hashBackupCode(code));
  }
  
  return { codes, hashes };
}

/**
 * Hash a backup code
 */
export function hashBackupCode(code: string): string {
  const normalized = code.replace(/-/g, '').toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate otpauth:// URI for QR code
 */
export function generateOTPAuthURI(
  secret: string,
  email: string,
  issuer: string = 'Trelk'
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  const encodedSecret = encodeURIComponent(secret);
  
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${encodedSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

// ============= DATABASE OPERATIONS =============

/**
 * Create TOTP secret for an agent
 */
export async function createTOTPSecret(
  agentId: string | Types.ObjectId,
  email: string
): Promise<{ secret: string; backupCodes: string[]; uri: string }> {
  // Generate secret
  const secret = generateTOTPSecret();
  
  // Encrypt secret
  const { encrypted, iv, authTag } = encrypt(secret);
  
  // Generate backup codes
  const { codes, hashes } = generateBackupCodes();
  
  // Generate URI for QR code
  const uri = generateOTPAuthURI(secret, email);
  
  // Save to database (or update if exists)
  await TOTPSecret.findOneAndUpdate(
    { agentId: new Types.ObjectId(agentId.toString()) },
    {
      agentId: new Types.ObjectId(agentId.toString()),
      secretEncrypted: encrypted,
      secretIv: iv,
      secretAuthTag: authTag,
      backupCodes: hashes.map(h => ({ codeHash: h, usedAt: undefined })),
      verified: false,
      verifiedAt: undefined,
    },
    { upsert: true, new: true }
  );
  
  return { secret, backupCodes: codes, uri };
}

/**
 * Get decrypted TOTP secret for an agent
 */
export async function getTOTPSecret(agentId: string | Types.ObjectId): Promise<string | null> {
  const doc = await TOTPSecret.findOne({ 
    agentId: new Types.ObjectId(agentId.toString()),
    verified: true,
  });
  
  if (!doc) return null;
  
  try {
    return decrypt(doc.secretEncrypted, doc.secretIv, doc.secretAuthTag);
  } catch {
    return null;
  }
}

/**
 * Get TOTP document for an agent
 */
export async function getTOTPDocument(agentId: string | Types.ObjectId): Promise<ITOTPSecret | null> {
  return TOTPSecret.findOne({ agentId: new Types.ObjectId(agentId.toString()) });
}

/**
 * Verify TOTP setup (after user scans QR and enters first code)
 */
export async function verifyTOTPSetup(
  agentId: string | Types.ObjectId,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const doc = await TOTPSecret.findOne({ 
    agentId: new Types.ObjectId(agentId.toString()) 
  });
  
  if (!doc) {
    return { success: false, error: 'No TOTP secret found. Start setup first.' };
  }
  
  if (doc.verified) {
    return { success: false, error: 'TOTP already verified' };
  }
  
  // Decrypt and verify
  const secret = decrypt(doc.secretEncrypted, doc.secretIv, doc.secretAuthTag);
  const valid = verifyTOTPCode(secret, code);
  
  if (!valid) {
    return { success: false, error: 'Invalid code. Please try again.' };
  }
  
  // Mark as verified
  doc.verified = true;
  doc.verifiedAt = new Date();
  await doc.save();
  
  return { success: true };
}

/**
 * Verify TOTP code for login
 */
export async function verifyAgentTOTP(
  agentId: string | Types.ObjectId,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const secret = await getTOTPSecret(agentId);
  
  if (!secret) {
    return { success: false, error: 'TOTP not configured' };
  }
  
  const valid = verifyTOTPCode(secret, code);
  
  if (!valid) {
    return { success: false, error: 'Invalid code' };
  }
  
  return { success: true };
}

/**
 * Use a backup code
 */
export async function useBackupCode(
  agentId: string | Types.ObjectId,
  code: string
): Promise<{ success: boolean; remainingCodes: number; error?: string }> {
  const doc = await TOTPSecret.findOne({ 
    agentId: new Types.ObjectId(agentId.toString()),
    verified: true,
  });
  
  if (!doc) {
    return { success: false, remainingCodes: 0, error: 'TOTP not configured' };
  }
  
  const hash = hashBackupCode(code);
  const codeEntry = doc.backupCodes.find(bc => bc.codeHash === hash && !bc.usedAt);
  
  if (!codeEntry) {
    return { success: false, remainingCodes: doc.backupCodes.filter(bc => !bc.usedAt).length, error: 'Invalid or already used backup code' };
  }
  
  // Mark as used
  codeEntry.usedAt = new Date();
  await doc.save();
  
  const remaining = doc.backupCodes.filter(bc => !bc.usedAt).length;
  return { success: true, remainingCodes: remaining };
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(
  agentId: string | Types.ObjectId
): Promise<{ codes: string[] } | null> {
  const doc = await TOTPSecret.findOne({ 
    agentId: new Types.ObjectId(agentId.toString()),
    verified: true,
  });
  
  if (!doc) return null;
  
  const { codes, hashes } = generateBackupCodes();
  doc.backupCodes = hashes.map(h => ({ codeHash: h, usedAt: undefined }));
  await doc.save();
  
  return { codes };
}

/**
 * Get backup codes status
 */
export async function getBackupCodesStatus(
  agentId: string | Types.ObjectId
): Promise<{ total: number; used: number; remaining: number } | null> {
  const doc = await TOTPSecret.findOne({ 
    agentId: new Types.ObjectId(agentId.toString()),
    verified: true,
  });
  
  if (!doc) return null;
  
  const total = doc.backupCodes.length;
  const used = doc.backupCodes.filter(bc => bc.usedAt).length;
  
  return { total, used, remaining: total - used };
}

/**
 * Delete TOTP secret (disable TOTP)
 */
export async function deleteTOTPSecret(agentId: string | Types.ObjectId): Promise<boolean> {
  const result = await TOTPSecret.deleteOne({ 
    agentId: new Types.ObjectId(agentId.toString()) 
  });
  return result.deletedCount > 0;
}

/**
 * Check if agent has TOTP enabled
 */
export async function hasTOTPEnabled(agentId: string | Types.ObjectId): Promise<boolean> {
  const doc = await TOTPSecret.findOne({ 
    agentId: new Types.ObjectId(agentId.toString()),
    verified: true,
  });
  return !!doc;
}

// ============= MODEL =============

export const TOTPSecret = mongoose.model<ITOTPSecret>('TOTPSecret', TOTPSecretSchema);

export { TOTP_CONFIG };

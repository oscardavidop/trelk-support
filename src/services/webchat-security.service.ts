/**
 * WebChat Security Service
 * Rate limiting, anti-abuse, and security measures for web chat
 */

import { Redis } from 'ioredis';
import { getRedisClient } from './redis.js';
import { logger } from './logger.js';
import { WebChatProject } from '../database/models/WebChatProject.js';

// ============= RATE LIMITING =============

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Connection rate limits
  'connect': { windowMs: 60_000, maxRequests: 10 },          // 10 connections per minute per IP
  'connect:visitor': { windowMs: 60_000, maxRequests: 5 },   // 5 reconnects per minute per visitor
  
  // Message rate limits
  'message': { windowMs: 60_000, maxRequests: 30 },          // 30 messages per minute per session
  'message:burst': { windowMs: 5_000, maxRequests: 5 },      // 5 messages per 5 seconds (anti-spam)
  
  // API rate limits
  'api:config': { windowMs: 60_000, maxRequests: 60 },       // 60 config fetches per minute
  'api:status': { windowMs: 60_000, maxRequests: 120 },      // 120 status checks per minute
  
  // Abuse detection
  'abuse:blocked': { windowMs: 3600_000, maxRequests: 0 },   // Blocked for 1 hour
};

// In-memory fallback if Redis is unavailable
const memoryStore = new Map<string, { count: number; expiresAt: number }>();

/**
 * Check rate limit using Redis or memory fallback
 */
export async function checkRateLimit(
  key: string,
  limitType: keyof typeof RATE_LIMITS
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const config = RATE_LIMITS[limitType];
  if (!config) {
    return { allowed: true, remaining: 100, resetIn: 0 };
  }

  const fullKey = `ratelimit:webchat:${limitType}:${key}`;
  
  try {
    const redis = getRedisClient();
    if (redis) {
      return await checkRateLimitRedis(redis, fullKey, config);
    }
  } catch (error) {
    logger.warn('webchat-security', {
      action: 'ratelimit_redis_error',
      error: String(error),
    });
  }

  // Fallback to memory
  return checkRateLimitMemory(fullKey, config);
}

async function checkRateLimitRedis(
  redis: Redis,
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const now = Date.now();
  const windowStart = now - config.windowMs;

  // Use Redis sorted set for sliding window
  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, windowStart);
  multi.zadd(key, now.toString(), `${now}-${Math.random()}`);
  multi.zcard(key);
  multi.pexpire(key, config.windowMs);

  const results = await multi.exec();
  const count = (results?.[2]?.[1] as number) || 0;

  const allowed = count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - count);
  const resetIn = config.windowMs;

  return { allowed, remaining, resetIn };
}

function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (existing && existing.expiresAt > now) {
    existing.count++;
    const allowed = existing.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - existing.count);
    const resetIn = existing.expiresAt - now;
    return { allowed, remaining, resetIn };
  }

  // New window
  memoryStore.set(key, {
    count: 1,
    expiresAt: now + config.windowMs,
  });

  // Cleanup old entries periodically
  if (memoryStore.size > 10000) {
    for (const [k, v] of memoryStore.entries()) {
      if (v.expiresAt <= now) {
        memoryStore.delete(k);
      }
    }
  }

  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    resetIn: config.windowMs,
  };
}

// ============= ABUSE DETECTION =============

interface AbuseScore {
  score: number;
  reasons: string[];
  blocked: boolean;
}

// Abuse patterns
const SPAM_PATTERNS = [
  /(.)\1{10,}/,                          // Repeated characters
  /(https?:\/\/\S+\s*){3,}/i,            // Multiple URLs
  /\b(viagra|cialis|casino|poker|lottery|winner|congratulations|claim\s+your|free\s+money)\b/i,
  /[A-Z\s]{20,}/,                        // All caps text
  /@everyone|@here/,                      // Discord-style mentions
];

const PROFANITY_PATTERNS = [
  // Basic profanity filter - can be extended
  /\b(f+u+c+k+|s+h+i+t+|a+s+s+h+o+l+e+|b+i+t+c+h+)\b/i,
];

/**
 * Analyze message content for abuse
 */
export function analyzeMessage(content: string): AbuseScore {
  const reasons: string[] = [];
  let score = 0;

  // Check message length
  if (content.length > 5000) {
    score += 20;
    reasons.push('excessive_length');
  }

  // Check for spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      score += 15;
      reasons.push('spam_pattern');
      break;
    }
  }

  // Check for profanity
  for (const pattern of PROFANITY_PATTERNS) {
    if (pattern.test(content)) {
      score += 10;
      reasons.push('profanity');
      break;
    }
  }

  // Check for excessive special characters
  const specialCharRatio = (content.match(/[^a-zA-Z0-9\s]/g) || []).length / content.length;
  if (specialCharRatio > 0.5 && content.length > 10) {
    score += 10;
    reasons.push('excessive_special_chars');
  }

  // Check for repeated content (exact duplicates)
  const words = content.toLowerCase().split(/\s+/);
  const uniqueWords = new Set(words);
  if (words.length > 5 && uniqueWords.size / words.length < 0.3) {
    score += 15;
    reasons.push('repetitive_content');
  }

  return {
    score,
    reasons,
    blocked: score >= 50,
  };
}

/**
 * Track visitor abuse score
 */
const visitorAbuseScores = new Map<string, { score: number; lastReset: number }>();

export async function trackAbuseScore(
  visitorId: string,
  additionalScore: number,
  reasons: string[]
): Promise<{ totalScore: number; blocked: boolean }> {
  const now = Date.now();
  const SCORE_DECAY_MS = 3600_000; // Score decays after 1 hour
  const BLOCK_THRESHOLD = 100;

  let existing = visitorAbuseScores.get(visitorId);
  
  if (!existing || now - existing.lastReset > SCORE_DECAY_MS) {
    existing = { score: 0, lastReset: now };
  }

  existing.score += additionalScore;
  visitorAbuseScores.set(visitorId, existing);

  const blocked = existing.score >= BLOCK_THRESHOLD;

  if (blocked) {
    logger.warn('webchat-security', {
      action: 'visitor_blocked',
      visitorId,
      score: existing.score,
      reasons,
    });
  }

  return { totalScore: existing.score, blocked };
}

/**
 * Check if visitor is blocked
 */
export function isVisitorBlocked(visitorId: string): boolean {
  const existing = visitorAbuseScores.get(visitorId);
  if (!existing) return false;
  
  const SCORE_DECAY_MS = 3600_000;
  const now = Date.now();
  
  if (now - existing.lastReset > SCORE_DECAY_MS) {
    visitorAbuseScores.delete(visitorId);
    return false;
  }

  return existing.score >= 100;
}

/**
 * Unblock visitor
 */
export function unblockVisitor(visitorId: string): void {
  visitorAbuseScores.delete(visitorId);
}

// ============= IP BLOCKING =============

const blockedIPs = new Set<string>();
const ipConnectionCounts = new Map<string, { count: number; firstSeen: number }>();

/**
 * Block an IP address
 */
export async function blockIP(ip: string, reason: string, durationMs: number = 3600_000): Promise<void> {
  blockedIPs.add(ip);

  // Try to persist in Redis
  try {
    const redis = getRedisClient();
    if (redis) {
      await redis.setex(`blocked:ip:${ip}`, Math.ceil(durationMs / 1000), reason);
    }
  } catch (error) {
    // Memory-only blocking
  }

  // Auto-unblock after duration
  setTimeout(() => {
    blockedIPs.delete(ip);
  }, durationMs);

  logger.warn('webchat-security', {
    action: 'ip_blocked',
    ip,
    reason,
    durationMs,
  });
}

/**
 * Check if IP is blocked
 */
export async function isIPBlocked(ip: string): Promise<boolean> {
  if (blockedIPs.has(ip)) return true;

  try {
    const redis = getRedisClient();
    if (redis) {
      const blocked = await redis.exists(`blocked:ip:${ip}`);
      return blocked === 1;
    }
  } catch (error) {
    // Continue with memory check only
  }

  return false;
}

/**
 * Track IP connections for flood detection
 */
export function trackIPConnection(ip: string): { allowed: boolean; count: number } {
  const now = Date.now();
  const WINDOW_MS = 60_000;
  const MAX_CONNECTIONS = 20;

  let existing = ipConnectionCounts.get(ip);

  if (!existing || now - existing.firstSeen > WINDOW_MS) {
    existing = { count: 0, firstSeen: now };
  }

  existing.count++;
  ipConnectionCounts.set(ip, existing);

  if (existing.count > MAX_CONNECTIONS) {
    // Auto-block for flood
    blockIP(ip, 'connection_flood', 300_000); // 5 minutes
    return { allowed: false, count: existing.count };
  }

  return { allowed: true, count: existing.count };
}

// ============= DOMAIN VALIDATION =============

/**
 * Validate request origin against project allowed domains
 */
export function validateOrigin(
  origin: string | undefined,
  allowedDomains: string[]
): { valid: boolean; reason?: string } {
  // No origin header (non-browser request)
  if (!origin) {
    return { valid: false, reason: 'no_origin_header' };
  }

  // No domain restrictions
  if (allowedDomains.length === 0) {
    return { valid: true };
  }

  // Normalize origin
  let hostname: string;
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch {
    return { valid: false, reason: 'invalid_origin_format' };
  }

  // Check against allowed domains
  for (const domain of allowedDomains) {
    const normalizedDomain = domain.toLowerCase().trim();

    // Exact match
    if (hostname === normalizedDomain) {
      return { valid: true };
    }

    // Wildcard subdomain match
    if (normalizedDomain.startsWith('*.')) {
      const baseDomain = normalizedDomain.slice(2);
      if (hostname === baseDomain || hostname.endsWith(`.${baseDomain}`)) {
        return { valid: true };
      }
    }

    // Subdomain match
    if (hostname.endsWith(`.${normalizedDomain}`)) {
      return { valid: true };
    }
  }

  return { valid: false, reason: 'domain_not_allowed' };
}

// ============= FINGERPRINT TRACKING =============

interface VisitorFingerprint {
  userAgent: string;
  language: string;
  timezone: string;
  screenResolution?: string;
  platform?: string;
}

const fingerprintMap = new Map<string, { visitorIds: Set<string>; createdAt: number }>();

/**
 * Generate fingerprint hash
 */
export function generateFingerprintHash(fp: VisitorFingerprint): string {
  const raw = `${fp.userAgent}|${fp.language}|${fp.timezone}|${fp.screenResolution || ''}|${fp.platform || ''}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `fp_${Math.abs(hash).toString(36)}`;
}

/**
 * Track fingerprint for abuse detection
 */
export function trackFingerprint(
  fingerprintHash: string,
  visitorId: string
): { suspiciousActivity: boolean; linkedVisitors: number } {
  let existing = fingerprintMap.get(fingerprintHash);
  
  if (!existing) {
    existing = { visitorIds: new Set(), createdAt: Date.now() };
    fingerprintMap.set(fingerprintHash, existing);
  }

  existing.visitorIds.add(visitorId);

  // If many different visitor IDs from same fingerprint, might be abuse
  const suspiciousActivity = existing.visitorIds.size > 10;

  if (suspiciousActivity) {
    logger.warn('webchat-security', {
      action: 'suspicious_fingerprint',
      fingerprintHash,
      linkedVisitors: existing.visitorIds.size,
    });
  }

  return {
    suspiciousActivity,
    linkedVisitors: existing.visitorIds.size,
  };
}

// ============= SECURITY EVENTS =============

interface SecurityEvent {
  type: 'rate_limit' | 'abuse' | 'ip_block' | 'domain_reject' | 'suspicious';
  visitorId?: string;
  ip?: string;
  projectId?: string;
  details: Record<string, any>;
  timestamp: Date;
}

const recentSecurityEvents: SecurityEvent[] = [];
const MAX_SECURITY_EVENTS = 1000;

/**
 * Log security event
 */
export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>): void {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date(),
  };

  recentSecurityEvents.push(fullEvent);

  // Trim old events
  while (recentSecurityEvents.length > MAX_SECURITY_EVENTS) {
    recentSecurityEvents.shift();
  }

  logger.warn('webchat-security', {
    action: 'security_event',
    ...event,
  });
}

/**
 * Get recent security events
 */
export function getRecentSecurityEvents(
  limit: number = 100,
  projectId?: string
): SecurityEvent[] {
  let events = recentSecurityEvents.slice(-limit).reverse();
  
  if (projectId) {
    events = events.filter(e => e.projectId === projectId);
  }

  return events;
}

// ============= CLEANUP =============

/**
 * Periodic cleanup of in-memory stores
 */
export function cleanupSecurityStores(): void {
  const now = Date.now();
  const ONE_HOUR = 3600_000;

  // Clean up memory rate limit store
  for (const [key, value] of memoryStore.entries()) {
    if (value.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }

  // Clean up IP connection counts
  for (const [ip, data] of ipConnectionCounts.entries()) {
    if (now - data.firstSeen > 60_000) {
      ipConnectionCounts.delete(ip);
    }
  }

  // Clean up old abuse scores
  for (const [visitorId, data] of visitorAbuseScores.entries()) {
    if (now - data.lastReset > ONE_HOUR) {
      visitorAbuseScores.delete(visitorId);
    }
  }

  // Clean up old fingerprints
  for (const [hash, data] of fingerprintMap.entries()) {
    if (now - data.createdAt > 24 * ONE_HOUR) {
      fingerprintMap.delete(hash);
    }
  }

  logger.debug('webchat-security', {
    action: 'cleanup_complete',
    memoryStoreSize: memoryStore.size,
    ipCountsSize: ipConnectionCounts.size,
    abuseScoresSize: visitorAbuseScores.size,
    fingerprintsSize: fingerprintMap.size,
  });
}

// Run cleanup every 5 minutes
setInterval(cleanupSecurityStores, 5 * 60 * 1000);

// ============= EXPORTS =============

export {
  RATE_LIMITS,
  type RateLimitConfig,
  type SecurityEvent,
};

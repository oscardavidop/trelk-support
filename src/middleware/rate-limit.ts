/**
 * IP-based Rate Limiting Middleware
 * Protects against brute force attacks on authentication endpoints
 * 
 * Uses Redis for distributed rate limiting across multiple server instances.
 * Falls back to in-memory storage if Redis is unavailable.
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import * as redis from '../services/redis.js';
import { logger } from '../services/logger.js';

// In-memory fallback for when Redis is unavailable
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_MEMORY_ENTRIES = 10000; // Cap to prevent memory exhaustion under DDoS

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryRateLimits.entries()) {
    if (value.resetAt < now) {
      memoryRateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Rate limit configurations for different route types
export const RATE_LIMIT_CONFIG = {
  // Auth endpoints (login, MFA verify, password reset)
  auth: {
    windowSeconds: 60, // 1 minute window
    maxRequests: 50, // 5 requests per window per IP (hardened from 10)
  },
  // MFA verification (stricter)
  mfaVerify: {
    windowSeconds: 60,
    maxRequests: 3, // 3 attempts per minute per IP (hardened from 5)
  },
  // Password reset (very strict)
  passwordReset: {
    windowSeconds: 3600, // 1 hour window
    maxRequests: 5, // 5 requests per hour per IP
  },
  // General API (standard protection)
  api: {
    windowSeconds: 60,
    maxRequests: 1000, // 100 requests per minute
  },
  // Export endpoints (prevent mass exfiltration)
  export: {
    windowSeconds: 60,
    maxRequests: 10, // 10 exports per minute
  },
  // Translation endpoints (prevent cost abuse)
  translation: {
    windowSeconds: 60,
    maxRequests: 30, // 30 translations per minute
  },
  // State change (prevent fraud)
  stateChange: {
    windowSeconds: 60,
    maxRequests: 10, // 10 state changes per minute
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIG;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  error?: string;
}

/**
 * Get the client IP address safely
 * Uses Fastify's request.ip which respects trustProxy configuration
 */
function getClientIp(request: FastifyRequest): string {
  // request.ip already handles X-Forwarded-For via Fastify's trustProxy
  return request.ip || 'unknown';
}

/**
 * Check rate limit using Redis (primary) or memory (fallback)
 */
async function checkRateLimit(
  key: string,
  config: { windowSeconds: number; maxRequests: number }
): Promise<RateLimitResult> {
  const resetAt = new Date(Date.now() + config.windowSeconds * 1000);

  // Try Redis first
  if (redis.isRedisConnected()) {
    try {
      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;

      if (count >= config.maxRequests) {
        // Get TTL for accurate reset time
        const ttl = await redis.getTTL(key);
        return {
          allowed: false,
          remaining: 0,
          resetAt: new Date(Date.now() + ttl * 1000),
          error: 'Demasiadas solicitudes. Por favor, espera e intenta de nuevo.',
        };
      }

      // Increment counter with TTL
      await redis.set(key, String(count + 1), config.windowSeconds);

      return {
        allowed: true,
        remaining: config.maxRequests - count - 1,
        resetAt,
      };
    } catch (error) {
      logger.error('rate-limit', {
        action: 'redis_error',
        error: String(error),
        key,
      });
      // Fall through to memory fallback
    }
  }

  // Memory fallback
  const now = Date.now();
  const entry = memoryRateLimits.get(key);

  if (entry && entry.resetAt > now) {
    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt),
        error: 'Demasiadas solicitudes. Por favor, espera e intenta de nuevo.',
      };
    }

    entry.count++;
    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetAt: new Date(entry.resetAt),
    };
  }

  // Create new entry (with memory cap)
  if (memoryRateLimits.size >= MAX_MEMORY_ENTRIES) {
    // Reject when memory is exhausted to prevent DoS
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      error: 'Demasiadas solicitudes. Por favor, espera e intenta de nuevo.',
    };
  }
  
  memoryRateLimits.set(key, {
    count: 1,
    resetAt: now + config.windowSeconds * 1000,
  });

  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    resetAt,
  };
}

/**
 * Create a rate limiting middleware for a specific type
 */
export function createRateLimitMiddleware(type: RateLimitType) {
  const config = RATE_LIMIT_CONFIG[type];
  
  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const ip = getClientIp(request);
    const key = `rate_limit:${type}:${ip}`;

    const result = await checkRateLimit(key, config);

    // Set rate limit headers
    reply.header('X-RateLimit-Limit', config.maxRequests);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000));

    if (!result.allowed) {
      // Log rate limit hit
      logger.warn('rate-limit', {
        action: 'rate_limit_exceeded',
        type,
        ip,
        path: request.url,
      });

      return reply.code(429).send({
        ok: false,
        error: result.error,
        retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
      });
    }
  };
}

/**
 * Pre-configured middleware instances
 */
export const authRateLimit = createRateLimitMiddleware('auth');
export const mfaVerifyRateLimit = createRateLimitMiddleware('mfaVerify');
export const passwordResetRateLimit = createRateLimitMiddleware('passwordReset');
export const apiRateLimit = createRateLimitMiddleware('api');
export const exportRateLimit = createRateLimitMiddleware('export');
export const translationRateLimit = createRateLimitMiddleware('translation');
export const stateChangeRateLimit = createRateLimitMiddleware('stateChange');

/**
 * Penalty: Add extra count for failed authentication attempts
 * Call this after a failed login/verification
 */
export async function applyFailurePenalty(
  type: RateLimitType,
  ip: string,
  penaltyCount = 2
): Promise<void> {
  const config = RATE_LIMIT_CONFIG[type];
  const key = `rate_limit:${type}:${ip}`;

  if (redis.isRedisConnected()) {
    try {
      const current = await redis.get(key);
      const count = current ? parseInt(current, 10) : 0;
      const ttl = await redis.getTTL(key);
      const newTtl = ttl > 0 ? ttl : config.windowSeconds;
      
      await redis.set(key, String(count + penaltyCount), newTtl);
    } catch (error) {
      logger.error('rate-limit', {
        action: 'penalty_error',
        error: String(error),
        key,
      });
    }
  } else {
    // Memory fallback
    const entry = memoryRateLimits.get(key);
    if (entry && entry.resetAt > Date.now()) {
      entry.count += penaltyCount;
    }
  }
}

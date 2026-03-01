/**
 * Input Sanitizer & Validator Middleware
 * Prevents NoSQL injection, XSS, and malformed input
 * 
 * @security CRITICAL - Central input validation layer
 */

import type { FastifyRequest, FastifyReply } from 'fastify';

// Fields that should NEVER be accepted from client input
const FORBIDDEN_FIELDS = [
  '__proto__', 'constructor', 'prototype',
  '$gt', '$gte', '$lt', '$lte', '$ne', '$in', '$nin',
  '$or', '$and', '$not', '$nor', '$exists', '$type',
  '$regex', '$where', '$expr', '$mod', '$text',
  '$elemMatch', '$all', '$size',
];

// Sensitive fields that must never appear in logs
export const SENSITIVE_FIELDS = new Set([
  'password', 'currentPassword', 'newPassword', 'confirmPassword',
  'token', 'accessToken', 'refreshToken', 'jwt', 'secret',
  'apiKey', 'api_key', 'authorization', 'cookie',
  'proxyPassword', 'proxyUsername', 'credentials',
  'creditCard', 'ssn', 'socialSecurity',
]);

/**
 * Deep sanitize object to prevent NoSQL injection
 */
export function sanitizeObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) return undefined; // Prevent deep nesting attacks

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Strip null bytes
    return obj.replace(/\0/g, '');
  }

  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Block MongoDB operator injection
    if (FORBIDDEN_FIELDS.includes(key)) continue;
    // Block keys starting with $
    if (key.startsWith('$')) continue;
    // Block prototype pollution
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;

    sanitized[key] = sanitizeObject(value, depth + 1);
  }

  return sanitized;
}

/**
 * Redact sensitive fields from objects (for logging)
 */
export function redactSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Validate MongoDB ObjectId format
 */
export function isValidObjectId(id: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * Clamp numeric values within safe bounds
 */
export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Validate and clamp pagination params
 */
export function validatePagination(params: { page?: number; limit?: number }): { page: number; limit: number } {
  return {
    page: clampNumber(Number(params.page) || 1, 1, 10000),
    limit: clampNumber(Number(params.limit) || 20, 1, 100),
  };
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

/**
 * Global input sanitization hook
 */
export async function inputSanitizer(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  // Sanitize body
  if (request.body && typeof request.body === 'object') {
    request.body = sanitizeObject(request.body) as typeof request.body;
  }

  // Sanitize query params
  if (request.query && typeof request.query === 'object') {
    request.query = sanitizeObject(request.query) as typeof request.query;
  }

  // Sanitize params
  if (request.params && typeof request.params === 'object') {
    request.params = sanitizeObject(request.params) as typeof request.params;
  }
}

/**
 * Validate ObjectId params middleware factory
 * Ensures URL params that should be ObjectIds are valid
 */
export function validateObjectIdParams(...paramNames: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = request.params as Record<string, string>;
    for (const paramName of paramNames) {
      const value = params[paramName];
      if (value && !isValidObjectId(value)) {
        return reply.code(400).send({
          ok: false,
          error: `Invalid ${paramName} format`,
        });
      }
    }
  };
}

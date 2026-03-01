/**
 * Security Headers Middleware (Helmet-like)
 * Adds essential security headers to all responses
 * 
 * @security CRITICAL - Prevents XSS, clickjacking, MIME sniffing attacks
 */

import type { FastifyInstance } from 'fastify';

export function registerSecurityHeaders(fastify: FastifyInstance): void {
  fastify.addHook('onSend', async (_request, reply) => {
    // Prevent XSS attacks
    reply.header('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    reply.header('X-Frame-Options', 'DENY');
    
    // XSS protection (legacy browsers)
    reply.header('X-XSS-Protection', '1; mode=block');
    
    // Strict Transport Security (HTTPS only)
    reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    
    // Referrer policy
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy (basic)
    reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' wss: https:");
    
    // Prevent caching of sensitive data
    reply.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    reply.header('Pragma', 'no-cache');
    
    // Remove server identification
    reply.removeHeader('X-Powered-By');
    reply.header('Server', 'Trelk');
    
    // Permissions Policy (disable unnecessary browser features)
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  });
}

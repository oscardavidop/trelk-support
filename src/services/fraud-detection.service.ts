/**
 * Fraud Detection & Anomaly Service
 * Detects suspicious patterns: rapid state changes, multi-IP sessions,
 * excessive exports, self-break abuse, and concurrent sessions.
 *
 * @security Centralized fraud / anomaly detection engine
 */

import { logger } from './logger.js';
import * as redis from './redis.js';
import { logAuditFromRequest } from './audit-log.service.js';
import type { FastifyRequest } from 'fastify';

// ============= CONFIGURATION =============

const FRAUD_CONFIG = {
  // Max state changes per agent per 5 min window
  MAX_STATE_CHANGES: 15,
  STATE_CHANGE_WINDOW_SECONDS: 300,

  // Max IPs per agent within 1 hour
  MAX_IPS_PER_AGENT: 5,
  IP_WINDOW_SECONDS: 3600,

  // Max exports per agent per hour
  MAX_EXPORTS_PER_HOUR: 20,
  EXPORT_WINDOW_SECONDS: 3600,

  // Max break entries per shift (8 hours)
  MAX_BREAKS_PER_SHIFT: 10,
  BREAK_WINDOW_SECONDS: 28800,

  // Max concurrent sessions flagged
  MAX_CONCURRENT_ALERT_THRESHOLD: 2,
} as const;

// ============= ANOMALY TRACKING =============

/**
 * Track state change and detect rapid toggling / abuse
 */
export async function trackStateChange(
  agentId: string,
  fromState: string,
  toState: string,
  ip?: string,
): Promise<{ flagged: boolean; reason?: string }> {
  if (!redis.isRedisConnected()) return { flagged: false };

  try {
    const key = `fraud:state_changes:${agentId}`;
    const count = await redis.increment(key);

    // Set TTL on first increment
    if (count === 1) {
      await redis.expire(key, FRAUD_CONFIG.STATE_CHANGE_WINDOW_SECONDS);
    }

    if (count > FRAUD_CONFIG.MAX_STATE_CHANGES) {
      logger.warn('security', {
        action: 'fraud_detected',
        type: 'rapid_state_change',
        agentId,
        fromState,
        toState,
        count,
        threshold: FRAUD_CONFIG.MAX_STATE_CHANGES,
        ip,
      });
      return {
        flagged: true,
        reason: `Rapid state changes detected: ${count} in ${FRAUD_CONFIG.STATE_CHANGE_WINDOW_SECONDS}s`,
      };
    }

    return { flagged: false };
  } catch (error) {
    logger.error('security', { action: 'fraud_check_error', type: 'state_change', error: String(error) });
    return { flagged: false };
  }
}

/**
 * Track agent IP and detect multi-IP access
 */
export async function trackAgentIP(
  agentId: string,
  ip: string,
): Promise<{ flagged: boolean; reason?: string; ips?: string[] }> {
  if (!redis.isRedisConnected()) return { flagged: false };

  try {
    const key = `fraud:agent_ips:${agentId}`;
    await redis.sadd(key, ip);
    await redis.expire(key, FRAUD_CONFIG.IP_WINDOW_SECONDS);

    const ips = await redis.smembers(key);

    if (ips.length > FRAUD_CONFIG.MAX_IPS_PER_AGENT) {
      logger.warn('security', {
        action: 'fraud_detected',
        type: 'multiple_ips',
        agentId,
        currentIp: ip,
        uniqueIps: ips.length,
        threshold: FRAUD_CONFIG.MAX_IPS_PER_AGENT,
      });
      return {
        flagged: true,
        reason: `Multiple IPs detected: ${ips.length} unique IPs in ${FRAUD_CONFIG.IP_WINDOW_SECONDS / 60} min`,
        ips,
      };
    }

    return { flagged: false };
  } catch (error) {
    logger.error('security', { action: 'fraud_check_error', type: 'multi_ip', error: String(error) });
    return { flagged: false };
  }
}

/**
 * Track export requests and detect mass exfiltration
 */
export async function trackExportRequest(
  agentId: string,
  exportType: string,
): Promise<{ flagged: boolean; reason?: string }> {
  if (!redis.isRedisConnected()) return { flagged: false };

  try {
    const key = `fraud:exports:${agentId}`;
    const count = await redis.increment(key);

    if (count === 1) {
      await redis.expire(key, FRAUD_CONFIG.EXPORT_WINDOW_SECONDS);
    }

    if (count > FRAUD_CONFIG.MAX_EXPORTS_PER_HOUR) {
      logger.warn('security', {
        action: 'fraud_detected',
        type: 'mass_export',
        agentId,
        exportType,
        count,
        threshold: FRAUD_CONFIG.MAX_EXPORTS_PER_HOUR,
      });
      return {
        flagged: true,
        reason: `Excessive exports: ${count} in the last hour`,
      };
    }

    return { flagged: false };
  } catch (error) {
    logger.error('security', { action: 'fraud_check_error', type: 'export', error: String(error) });
    return { flagged: false };
  }
}

/**
 * Track break usage and detect self-break abuse
 */
export async function trackBreakUsage(
  agentId: string,
  breakType: string,
): Promise<{ flagged: boolean; reason?: string }> {
  if (!redis.isRedisConnected()) return { flagged: false };

  try {
    const key = `fraud:breaks:${agentId}`;
    const count = await redis.increment(key);

    if (count === 1) {
      await redis.expire(key, FRAUD_CONFIG.BREAK_WINDOW_SECONDS);
    }

    if (count > FRAUD_CONFIG.MAX_BREAKS_PER_SHIFT) {
      logger.warn('security', {
        action: 'fraud_detected',
        type: 'break_abuse',
        agentId,
        breakType,
        count,
        threshold: FRAUD_CONFIG.MAX_BREAKS_PER_SHIFT,
      });
      return {
        flagged: true,
        reason: `Excessive breaks detected: ${count} in shift`,
      };
    }

    return { flagged: false };
  } catch (error) {
    logger.error('security', { action: 'fraud_check_error', type: 'break', error: String(error) });
    return { flagged: false };
  }
}

/**
 * Log a security anomaly for admin review
 */
export async function logSecurityAnomaly(
  request: FastifyRequest | null,
  anomalyType: string,
  details: Record<string, unknown>,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
): Promise<void> {
  logger.warn('security', {
    action: 'anomaly_detected',
    type: anomalyType,
    severity,
    ...details,
  });

  if (request) {
    await logAuditFromRequest({
      request,
      action: `anomaly.${anomalyType}`,
      category: 'security',
      targetType: 'setting',
      targetId: String(details.agentId || 'system'),
      targetDescription: `Anomaly: ${anomalyType}`,
      severity,
      newValue: details,
    }).catch(() => {/* best effort */});
  }
}

/**
 * Login Policy Routes
 * API endpoints for managing agent login policies and chat action rules
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requirePermission } from '../middleware/auth.js';
import {
  getCachedPolicy,
  updateLoginPolicy,
  invalidatePolicyCache,
  evaluateChatAction,
} from '../services/policy-engine.service.js';
import { LoginPolicy, type ILoginPolicy, type IChatActionRule } from '../database/index.js';
import { logger } from '../services/logger.js';

// ============= REQUEST TYPES =============

interface UpdatePolicyBody {
  workingHours?: ILoginPolicy['workingHours'];
  redirects?: ILoginPolicy['redirects'];
  locationRestriction?: ILoginPolicy['locationRestriction'];
  deviceTrust?: ILoginPolicy['deviceTrust'];
  sessionPolicy?: ILoginPolicy['sessionPolicy'];
  profileRequirements?: ILoginPolicy['profileRequirements'];
  autoStatus?: ILoginPolicy['autoStatus'];
  autoQueueAssignment?: ILoginPolicy['autoQueueAssignment'];
  globalAlert?: ILoginPolicy['globalAlert'];
  maintenanceMode?: ILoginPolicy['maintenanceMode'];
  supervisorAlerts?: ILoginPolicy['supervisorAlerts'];
  policyAcceptance?: ILoginPolicy['policyAcceptance'];
  chatActionRules?: IChatActionRule[];
  audit?: ILoginPolicy['audit'];
}

interface ChatActionRuleBody {
  id: string;
  name: string;
  enabled: boolean;
  action: string;
  condition: {
    type: string;
    roles?: string[];
    minNoteLength?: number;
    requiredTags?: string[];
    approvalRoles?: string[];
    allowedHours?: { start: string; end: string };
    customCheck?: string;
  };
  errorMessage: string;
  bypassRoles: string[];
}

interface ChatActionCheckBody {
  action: string;
  chatId: string;
  hasNote?: boolean;
  noteLength?: number;
  tags?: string[];
}

interface AcceptPolicyBody {
  version: string;
}

// ============= ROUTES =============

export async function registerPolicyRoutes(fastify: FastifyInstance): Promise<void> {

  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ============= GET POLICY =============

  /**
   * GET /api/policy
   * Get current login policy settings
   * Requires: settings:view permission
   */
  fastify.get('/policy', {
    preHandler: requirePermission('settings:view'),
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const policy = await getCachedPolicy();
      
      return reply.send({
        ok: true,
        policy: formatPolicyForClient(policy),
      });
    } catch (error) {
      logger.error('policy-routes', { action: 'get_policy_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get policy' });
    }
  });

  // ============= UPDATE POLICY =============

  /**
   * PATCH /api/policy
   * Update login policy settings
   * Requires: settings:edit permission
   */
  fastify.patch<{ Body: UpdatePolicyBody }>('/policy', {
    preHandler: requirePermission('settings:edit'),
  }, async (request, reply) => {
    try {
      const agentId = (request as any).agent?.id;
      const updateData = request.body;

      const updated = await updateLoginPolicy(updateData as Partial<ILoginPolicy>, agentId);

      logger.info('policy-routes', {
        action: 'policy_updated',
        updatedBy: agentId,
        sections: Object.keys(updateData),
      });

      return reply.send({
        ok: true,
        policy: formatPolicyForClient(updated),
      });
    } catch (error) {
      logger.error('policy-routes', { action: 'update_policy_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to update policy' });
    }
  });

  // ============= CHAT ACTION RULES =============

  /**
   * GET /api/policy/chat-rules
   * Get chat action rules
   */
  fastify.get('/policy/chat-rules', {
    preHandler: requirePermission('settings:view'),
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const policy = await getCachedPolicy();
      
      return reply.send({
        ok: true,
        rules: policy.chatActionRules || [],
      });
    } catch (error) {
      logger.error('policy-routes', { action: 'get_chat_rules_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get chat rules' });
    }
  });

  /**
   * PUT /api/policy/chat-rules
   * Update all chat action rules
   */
  fastify.put<{ Body: { rules: ChatActionRuleBody[] } }>('/policy/chat-rules', {
    preHandler: requirePermission('settings:edit'),
  }, async (request, reply) => {
    try {
      const agentId = (request as any).agent?.id;
      const { rules } = request.body;

      // Validate rules
      for (const rule of rules) {
        if (!rule.id || !rule.name || !rule.action || !rule.condition?.type) {
          return reply.status(400).send({ 
            ok: false, 
            error: 'Invalid rule format. Required: id, name, action, condition.type' 
          });
        }
      }

      await updateLoginPolicy({ chatActionRules: rules as IChatActionRule[] }, agentId);

      logger.info('policy-routes', {
        action: 'chat_rules_updated',
        updatedBy: agentId,
        ruleCount: rules.length,
      });

      return reply.send({ ok: true, rules });
    } catch (error) {
      logger.error('policy-routes', { action: 'update_chat_rules_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to update chat rules' });
    }
  });

  /**
   * POST /api/policy/chat-rules/:ruleId/toggle
   * Toggle a specific chat rule on/off
   */
  fastify.post<{ Params: { ruleId: string } }>('/policy/chat-rules/:ruleId/toggle', {
    preHandler: requirePermission('settings:edit'),
  }, async (request, reply) => {
    try {
      const agentId = (request as any).agent?.id;
      const { ruleId } = request.params;

      const policy = await getCachedPolicy();
      const rules = policy.chatActionRules || [];
      const ruleIndex = rules.findIndex(r => r.id === ruleId);

      if (ruleIndex === -1) {
        return reply.status(404).send({ ok: false, error: 'Rule not found' });
      }

      rules[ruleIndex].enabled = !rules[ruleIndex].enabled;
      await updateLoginPolicy({ chatActionRules: rules }, agentId);

      return reply.send({ 
        ok: true, 
        rule: rules[ruleIndex],
        enabled: rules[ruleIndex].enabled,
      });
    } catch (error) {
      logger.error('policy-routes', { action: 'toggle_chat_rule_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to toggle rule' });
    }
  });

  // ============= CHAT ACTION CHECK (for agents) =============

  /**
   * POST /api/policy/check-action
   * Check if a chat action is allowed for the current agent
   * Called by frontend before executing sensitive chat actions
   */
  fastify.post<{ Body: ChatActionCheckBody }>('/policy/check-action', async (request, reply) => {
    try {
      const agent = (request as any).agent;
      const { action, chatId, hasNote, noteLength, tags } = request.body;

      if (!action || !chatId) {
        return reply.status(400).send({ ok: false, error: 'action and chatId are required' });
      }

      const result = await evaluateChatAction({
        agent: {
          id: agent.id,
          role: agent.role,
        },
        chat: {
          id: chatId,
          hasNote,
          noteLength,
          tags,
        },
        action,
        timestamp: new Date(),
      });

      return reply.send({
        ok: true,
        allowed: result.allowed,
        errorMessage: result.errorMessage,
        requiresApproval: result.requiresApproval,
        approvalRoles: result.approvalRoles,
        ruleId: result.ruleId,
      });
    } catch (error) {
      logger.error('policy-routes', { action: 'check_action_failed', error: String(error) });
      // On error, allow the action but log it
      return reply.send({ ok: true, allowed: true });
    }
  });

  // ============= GLOBAL ALERT =============

  /**
   * POST /api/policy/global-alert
   * Set or update the global alert
   */
  fastify.post<{ Body: ILoginPolicy['globalAlert'] }>('/policy/global-alert', {
    preHandler: requirePermission('settings:edit'),
  }, async (request, reply) => {
    try {
      const agentId = (request as any).agent?.id;
      const alertData = request.body as ILoginPolicy['globalAlert'];

      await updateLoginPolicy({ globalAlert: alertData }, agentId);

      logger.info('policy-routes', {
        action: 'global_alert_updated',
        updatedBy: agentId,
        enabled: alertData.enabled,
      });

      return reply.send({ ok: true, alert: alertData });
    } catch (error) {
      logger.error('policy-routes', { action: 'update_global_alert_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to update global alert' });
    }
  });

  /**
   * DELETE /api/policy/global-alert
   * Disable the global alert
   */
  fastify.delete('/policy/global-alert', {
    preHandler: requirePermission('settings:edit'),
  }, async (request, reply) => {
    try {
      const agentId = (request as any).agent?.id;

      await updateLoginPolicy({
        globalAlert: {
          enabled: false,
          title: '',
          message: '',
          type: 'info',
          requireAcknowledge: false,
          showFullScreen: false,
        },
      }, agentId);

      return reply.send({ ok: true });
    } catch (error) {
      logger.error('policy-routes', { action: 'disable_global_alert_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to disable global alert' });
    }
  });

  // ============= MAINTENANCE MODE =============

  /**
   * POST /api/policy/maintenance
   * Enable maintenance mode
   */
  fastify.post<{ Body: ILoginPolicy['maintenanceMode'] }>('/policy/maintenance', {
    preHandler: requirePermission('system:maintenance'),
  }, async (request, reply) => {
    try {
      const agentId = (request as any).agent?.id;
      const maintenanceData = request.body as ILoginPolicy['maintenanceMode'];

      await updateLoginPolicy({ maintenanceMode: maintenanceData }, agentId);

      logger.info('policy-routes', {
        action: 'maintenance_mode_updated',
        updatedBy: agentId,
        enabled: maintenanceData.enabled,
      });

      return reply.send({ ok: true, maintenance: maintenanceData });
    } catch (error) {
      logger.error('policy-routes', { action: 'update_maintenance_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to update maintenance mode' });
    }
  });

  // ============= POLICY ACCEPTANCE =============

  /**
   * POST /api/policy/accept
   * Accept current policy version (for agents)
   */
  fastify.post<{ Body: AcceptPolicyBody }>('/policy/accept', async (request, reply) => {
    try {
      const agent = (request as any).agent;
      const { version } = request.body;

      // Update agent's accepted policy version
      const { Agent } = await import('../database/index.js');
      await Agent.findByIdAndUpdate(agent.id, {
        $set: { acceptedPolicyVersion: version },
      });

      logger.info('policy-routes', {
        action: 'policy_accepted',
        agentId: agent.id,
        version,
      });

      return reply.send({ ok: true });
    } catch (error) {
      logger.error('policy-routes', { action: 'accept_policy_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to accept policy' });
    }
  });

  /**
   * GET /api/policy/acceptance-content
   * Get policy acceptance content for display
   */
  fastify.get('/policy/acceptance-content', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const policy = await getCachedPolicy();
      
      return reply.send({
        ok: true,
        policyAcceptance: policy.policyAcceptance,
      });
    } catch (error) {
      logger.error('policy-routes', { action: 'get_acceptance_content_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get policy content' });
    }
  });

  // ============= RESET POLICY =============

  /**
   * POST /api/policy/reset
   * Reset policy to defaults (dangerous!)
   */
  fastify.post('/policy/reset', {
    preHandler: requirePermission('system:maintenance'),
  }, async (request, reply) => {
    try {
      const agentId = (request as any).agent?.id;

      // Delete existing policy to create fresh one
      await LoginPolicy.deleteMany({});
      await invalidatePolicyCache();
      
      const freshPolicy = await getCachedPolicy();

      logger.warn('policy-routes', {
        action: 'policy_reset',
        resetBy: agentId,
      });

      return reply.send({
        ok: true,
        policy: formatPolicyForClient(freshPolicy),
      });
    } catch (error) {
      logger.error('policy-routes', { action: 'reset_policy_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to reset policy' });
    }
  });

  // ============= CACHE MANAGEMENT =============

  /**
   * POST /api/policy/refresh-cache
   * Force refresh the policy cache
   */
  fastify.post('/policy/refresh-cache', {
    preHandler: requirePermission('settings:edit'),
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      await invalidatePolicyCache();
      const policy = await getCachedPolicy();

      return reply.send({
        ok: true,
        message: 'Cache refreshed',
        policy: formatPolicyForClient(policy),
      });
    } catch (error) {
      logger.error('policy-routes', { action: 'refresh_cache_failed', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to refresh cache' });
    }
  });
}

// ============= HELPERS =============

/**
 * Format policy for frontend consumption
 */
function formatPolicyForClient(policy: ILoginPolicy): Record<string, unknown> {
  return {
    workingHours: {
      enabled: policy.workingHours.enabled,
      schedule: policy.workingHours.schedule,
      timezone: policy.workingHours.timezone,
      daysOfWeek: policy.workingHours.daysOfWeek,
      blockOutsideHours: policy.workingHours.blockOutsideHours,
      allowReadOnlyOutsideHours: policy.workingHours.allowReadOnlyOutsideHours,
    },
    redirects: {
      defaultLandingPage: policy.redirects.defaultLandingPage,
      roleBasedRedirects: policy.redirects.roleBasedRedirects,
      forceCompleteProfile: policy.redirects.forceCompleteProfile,
      profileCompletionPage: policy.redirects.profileCompletionPage,
    },
    locationRestriction: {
      enabled: policy.locationRestriction.enabled,
      allowedCountries: policy.locationRestriction.allowedCountries,
      allowedIpRanges: policy.locationRestriction.allowedIpRanges,
      blockAction: policy.locationRestriction.blockAction,
    },
    deviceTrust: {
      enabled: policy.deviceTrust.enabled,
      requireMFAOnNewDevice: policy.deviceTrust.requireMFAOnNewDevice,
      maxTrustedDevices: policy.deviceTrust.maxTrustedDevices,
      trustDurationDays: policy.deviceTrust.trustDurationDays,
    },
    sessionPolicy: {
      maxConcurrentSessions: policy.sessionPolicy.maxConcurrentSessions,
      forceLogoutOnNewLogin: policy.sessionPolicy.forceLogoutOnNewLogin,
      maxSessionAgeHours: policy.sessionPolicy.maxSessionAgeHours,
      requireReauthAfterHours: policy.sessionPolicy.requireReauthAfterHours,
      forceLogoutAtTime: policy.sessionPolicy.forceLogoutAtTime,
    },
    profileRequirements: {
      requireTelegramLink: policy.profileRequirements.requireTelegramLink,
      requireMFAEnabled: policy.profileRequirements.requireMFAEnabled,
      requireDisplayName: policy.profileRequirements.requireDisplayName,
      requireAvatar: policy.profileRequirements.requireAvatar,
      blockUntilComplete: policy.profileRequirements.blockUntilComplete,
    },
    autoStatus: {
      enabled: policy.autoStatus.enabled,
      defaultStatusOnLogin: policy.autoStatus.defaultStatusOnLogin,
      statusOutsideHours: policy.autoStatus.statusOutsideHours,
      setOfflineOnLogout: policy.autoStatus.setOfflineOnLogout,
    },
    autoQueueAssignment: {
      enabled: policy.autoQueueAssignment.enabled,
      queues: policy.autoQueueAssignment.queues,
      byRole: policy.autoQueueAssignment.byRole,
    },
    globalAlert: {
      enabled: policy.globalAlert.enabled,
      title: policy.globalAlert.title,
      message: policy.globalAlert.message,
      type: policy.globalAlert.type,
      requireAcknowledge: policy.globalAlert.requireAcknowledge,
      showFullScreen: policy.globalAlert.showFullScreen,
      expiresAt: policy.globalAlert.expiresAt,
    },
    maintenanceMode: {
      enabled: policy.maintenanceMode.enabled,
      allowedRoles: policy.maintenanceMode.allowedRoles,
      readOnlyForOthers: policy.maintenanceMode.readOnlyForOthers,
      message: policy.maintenanceMode.message,
    },
    supervisorAlerts: {
      onLoginOutsideHours: policy.supervisorAlerts.onLoginOutsideHours,
      onNewDeviceLogin: policy.supervisorAlerts.onNewDeviceLogin,
      onBlockedLogin: policy.supervisorAlerts.onBlockedLogin,
      onSuspiciousActivity: policy.supervisorAlerts.onSuspiciousActivity,
      onMultipleFailedAttempts: policy.supervisorAlerts.onMultipleFailedAttempts,
    },
    policyAcceptance: {
      enabled: policy.policyAcceptance.enabled,
      version: policy.policyAcceptance.version,
      title: policy.policyAcceptance.title,
      content: policy.policyAcceptance.content,
      updatedAt: policy.policyAcceptance.updatedAt,
    },
    chatActionRules: policy.chatActionRules || [],
    audit: {
      logAllLogins: policy.audit.logAllLogins,
      logFailedAttempts: policy.audit.logFailedAttempts,
      logRuleEvaluations: policy.audit.logRuleEvaluations,
      retentionDays: policy.audit.retentionDays,
    },
    updatedAt: policy.updatedAt,
  };
}

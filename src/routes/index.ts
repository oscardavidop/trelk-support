/**
 * Routes Index
 * Registers all API routes
 */

import type { FastifyInstance } from 'fastify';
import { registerAuthRoutes } from './auth.routes.js';
import { registerSessionRoutes } from './sessions.routes.js';
import { registerAgentRoutes } from './agents.routes.js';
import { registerDashboardRoutes } from './dashboard.routes.js';
import { registerAdminRoutes } from './admin.routes.js';
import { registerContactRoutes } from './contact.routes.js';
import { registerUploadRoutes, registerStaticUploads } from './upload.routes.js';
import { registerEnterpriseRoutes } from './enterprise.routes.js';
import { registerMediaRoutes } from './media.routes.js';
import { supervisorRoutes } from './supervisor.routes.js';
import { copilotRoutes } from './copilot.routes.js';
import { automationRoutes } from './automation.routes.js';
import { exportRoutes } from './export.routes.js';
import { activityRoutes, auditRoutes } from './activity.routes.js';
import { surveyRoutes } from './survey.routes.js';
import { scheduledMessageRoutes } from './scheduledMessage.routes.js';
import { flowRoutes } from './flow.routes.js';
import { registerSettingsRoutes } from './settings.routes.js';
import { systemRoutes } from './system.routes.js';
import { adminControlRoutes } from './admin-control.routes.js';
import { textsRoutes } from './texts.routes.js';
import { registerContactsProRoutes } from './contacts-pro.routes.js';
import { broadcastRoutes } from './broadcast.routes.js';
import { registerPermissionRoutes } from './permissions.routes.js';
import { registerPermissionRequestRoutes } from './permissionRequest.routes.js';
import { registerPasswordResetRoutes } from './password-reset.routes.js';
import { registerMFARoutes } from './mfa.routes.js';
import { registerTelegramLinkRoutes } from './telegram-link.routes.js';
import internalNotificationsRoutes from './internal-notifications.routes.js';
import internalBroadcastRoutes from './internal-broadcast.routes.js';
import webchatRoutes from './webchat.routes.js';
import { registerPolicyRoutes } from './policy.routes.js';
import dispositionRoutes from './disposition.routes.js';
import { mediaAdminRoutes } from './media-admin.routes.js';
import { replayRoutes } from './replay.routes.js';
import { qaRoutes } from './qa.routes.js';
import { playbookRoutes } from './playbook.routes.js';
import { translationRoutes } from './translation.routes.js';
import { presenceRoutes } from './presence.routes.js';
import { agentEngineRoutes } from './agent-engine.routes.js';
import { apiRateLimit } from '../middleware/rate-limit.js';

export async function registerAPIRoutes(fastify: FastifyInstance): Promise<void> {
  // Global API rate limit (100 req/min per IP) - applied before all routes
  fastify.addHook('preHandler', apiRateLimit);

  // Static uploads (public)
  await registerStaticUploads(fastify);
  
  // Auth routes first (public routes without authentication)
  await registerAuthRoutes(fastify);
  
  // MFA routes (public + protected)
  await fastify.register(async (mfaRoutes) => {
    await registerMFARoutes(mfaRoutes);
  });
  
  // Telegram Link routes (public config + protected)
  await fastify.register(async (telegramRoutes) => {
    await registerTelegramLinkRoutes(telegramRoutes);
  });
  
  // Password Reset routes (public + admin protected)
  await fastify.register(async (passwordResetRoutes) => {
    await registerPasswordResetRoutes(passwordResetRoutes);
  });
  
  // Upload routes (requires auth)
  await fastify.register(async (uploadRoutes) => {
    await registerUploadRoutes(uploadRoutes);
  });
  
  // Protected routes - each in its own scope
  await fastify.register(async (protectedRoutes) => {
    await registerSessionRoutes(protectedRoutes);
  });
  
  await fastify.register(async (protectedRoutes) => {
    await registerAgentRoutes(protectedRoutes);
  });
  
  await fastify.register(async (protectedRoutes) => {
    await registerDashboardRoutes(protectedRoutes);
  });
  
  // Contact/sidebar routes
  await fastify.register(async (protectedRoutes) => {
    await registerContactRoutes(protectedRoutes);
  });
  
  // Admin routes (requires admin role)
  await fastify.register(async (adminRoutes) => {
    await registerAdminRoutes(adminRoutes);
  });
  
  // Enterprise routes (metrics, surveys, blocks, transfers)
  await fastify.register(async (enterpriseRoutes) => {
    await registerEnterpriseRoutes(enterpriseRoutes);
  });
  
  // Media proxy routes (hide Telegram bot token)
  await fastify.register(async (mediaRoutes) => {
    await registerMediaRoutes(mediaRoutes);
  });
  
  // Supervisor routes (supervisor/admin roles)
  await fastify.register(supervisorRoutes, { prefix: '/api/supervisor' });
  
  // AI Copilot routes
  await fastify.register(copilotRoutes, { prefix: '/api/copilot' });
  
  // Automation rules routes
  await fastify.register(automationRoutes, { prefix: '/api/automation' });
  
  // Export routes
  await fastify.register(exportRoutes, { prefix: '/api/exports' });
  
  // Activity log routes
  await fastify.register(activityRoutes, { prefix: '/api/activity' });
  
  // Audit log routes
  await fastify.register(auditRoutes, { prefix: '/api/audit' });
  
  // Survey statistics routes
  await fastify.register(surveyRoutes, { prefix: '/api/surveys' });
  
  // Scheduled messages routes
  await fastify.register(scheduledMessageRoutes);
  
  // Flow Builder routes
  await fastify.register(flowRoutes, { prefix: '/api' });
  
  // Settings routes (account, preferences, security, activity)
  await fastify.register(async (settingsRoutes) => {
    await registerSettingsRoutes(settingsRoutes);
  });

  // System monitoring routes (admin/supervisor only)
  await fastify.register(systemRoutes, { prefix: '/api/system' });

  // Admin Control Panel routes (admin only - super admin features)
  await fastify.register(adminControlRoutes, { prefix: '/api/admin-control' });

  // Text Registry / i18n routes
  await fastify.register(textsRoutes, { prefix: '/api/admin/texts' });

  // Contacts PRO routes (contact management, segments, bulk actions)
  await fastify.register(async (contactsProRoutes) => {
    await registerContactsProRoutes(contactsProRoutes);
  });

  // Broadcast / Mass messaging routes (admin/supervisor only)
  await fastify.register(broadcastRoutes, { prefix: '/api/broadcast' });

  // Permission management routes (RBAC administration)
  await fastify.register(async (permissionRoutes) => {
    await registerPermissionRoutes(permissionRoutes);
  });

  // Permission Request routes (agents request access, admins approve/reject)
  await fastify.register(async (permRequestRoutes) => {
    await registerPermissionRequestRoutes(permRequestRoutes);
  }, { prefix: '/api/permission-requests' });

  // Internal Notifications routes (supervisor/admin → agent messaging)
  await fastify.register(internalNotificationsRoutes, { prefix: '/api/notifications' });

  // Internal Broadcast routes (admin announcements)
  await fastify.register(internalBroadcastRoutes, { prefix: '/api/internal-broadcasts' });

  // WebChat / Omnichannel routes (widget config + project management)
  await fastify.register(webchatRoutes, { prefix: '/api/webchat' });

  // Login Policy / Agent Rules routes (policy engine configuration)
  await fastify.register(async (policyRoutes) => {
    await registerPolicyRoutes(policyRoutes);
  }, { prefix: '/api' });

  // Chat Disposition / Tipificación routes (enterprise feature)
  await fastify.register(dispositionRoutes);

  // Media Admin routes (enterprise storage management - admin/supervisor only)
  await fastify.register(mediaAdminRoutes, { prefix: '/api/media-admin' });

  // Chat Replay / Playback routes (enterprise QA feature - admin/supervisor only)
  await fastify.register(replayRoutes);

  // QA & Coaching routes (enterprise quality assurance system)
  await fastify.register(qaRoutes);

  // Playbook / Guided Scripts routes (enterprise agent guidance system)
  await fastify.register(playbookRoutes, { prefix: '/api' });

  // Translation System routes (multi-provider translation engine)
  await fastify.register(translationRoutes, { prefix: '/api/translation' });

  // Presence / Agent Status Management routes
  await fastify.register(presenceRoutes, { prefix: '/api/presence' });

  // Agent Engine / Config routes (Agent Rule Engine management)
  await fastify.register(agentEngineRoutes, { prefix: '/api/agent-engine' });
}

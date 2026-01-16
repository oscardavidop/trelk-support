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

export async function registerAPIRoutes(fastify: FastifyInstance): Promise<void> {
  // Static uploads (public)
  await registerStaticUploads(fastify);
  
  // Auth routes first (public routes without authentication)
  await registerAuthRoutes(fastify);
  
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
}

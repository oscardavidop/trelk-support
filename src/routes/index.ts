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
}

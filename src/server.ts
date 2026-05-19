/**
 * Trelk Support Platform - Main Server
 * Webhook-based Telegram bot with real-time agent dashboard
 * Supports both webhook and polling modes via POLLING_ENABLED config
 */

import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import path from "path";
import { fileURLToPath } from "url";
import { ENV, WEBHOOK_CONFIG, validateConfig } from "./config/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { connectDatabase, disconnectDatabase } from "./database/index.js";
import { restorePendingPolls } from "./services/survey.service.js";
import {
  processSupportBotUpdate,
  processNotificationBotUpdate,
  type NotificationBotUpdate,
} from "./services/update-handlers.service.js";
// Legacy cron worker removed - now using BullMQ workers
// import { startScheduledMessagesWorker, stopScheduledMessagesWorker } from './services/scheduledMessage.worker.js';
import { flowEngine } from "./services/flowEngine.service.js";
import {
  setWebhook,
  deleteWebhook,
  getMe,
  getWebhookInfo,
} from "./services/telegram.js";
import { initializeSocketIO } from "./services/socket.js";
import { initializeWebChatSocket, setDashboardIO } from "./services/webchat-socket.service.js";
import { initializeChannelManager } from "./channels/index.js";
import { performFullReconciliation } from "./services/reconciliation.service.js";
import { initPresenceService, stopPresenceService } from "./services/presence.service.js";
import { registerAPIRoutes } from "./routes/index.js";
import { logger } from "./services/logger.js";
import type { TelegramUpdate } from "./types/index.js";
import fs from "fs";
import { registerSecurityHeaders } from "./middleware/security-headers.js";
import { inputSanitizer } from "./middleware/input-sanitizer.js";
// Redis & BullMQ
import {
  initializeRedis,
  closeRedis,
  getRedisHealth,
  isRedisConnected,
} from "./services/redis.js";
import {
  initializeWorkers,
  shutdownWorkers,
  getAllQueueStats,
  areWorkersInitialized,
} from "./workers/index.js";
// Write-behind cache sync
import {
  startCacheSync,
  stopCacheSync,
  flushPendingWrites,
} from "./services/cache-models.service.js";
// Text Registry i18n
import {
  initializeTextRegistry,
  seedDefaultTexts,
} from "./services/text-registry.service.js";
// Polling service
import {
  startPolling,
  stopPolling,
  getPollingStatus,
  isPollingEnabled,
} from "./services/telegram-polling.service.js";

// Create Fastify instance
const fastify = Fastify({
  trustProxy: true,
  logger:
    ENV.NODE_ENV === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "yyyy-mm-dd HH:MM:ss",
              ignore: "pid,hostname",
            },
          },
        }
      : true,
  https: {
    key: fs.readFileSync(`certs/${ENV.IP_HOST}/server.key`),
    cert: fs.readFileSync(`certs/${ENV.IP_HOST}/server.crt`),
  },
});

// ============= PLUGINS =============

async function registerPlugins(): Promise<void> {
  // CORS
  await fastify.register(fastifyCors, {
    origin: ENV.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Cookies
  await fastify.register(fastifyCookie, {
    secret: ENV.JWT_SECRET,
  });

  // Security headers (Helmet equivalent)
  registerSecurityHeaders(fastify);

  // Global input sanitization (NoSQL injection prevention)
  fastify.addHook('preHandler', inputSanitizer);

  // OpenAPI / Swagger (only expose in non-production or when explicitly enabled)
  if (ENV.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') {
    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Trelk Support Platform API',
          description: 'Real-time omnichannel support platform — Telegram bot, live dashboard, and WebChat widget',
          version: '2.0.0',
          contact: { name: 'Trelk Team' },
          license: { name: 'MIT' },
        },
        servers: [{ url: ENV.DASHBOARD_PUBLIC_URL || `http://${ENV.HOST}:${ENV.PORT}` }],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
        security: [{ bearerAuth: [] }],
        tags: [
          { name: 'auth', description: 'Authentication & session management' },
          { name: 'agents', description: 'Agent management' },
          { name: 'sessions', description: 'Chat sessions' },
          { name: 'messages', description: 'Messaging' },
          { name: 'contacts', description: 'Contact management' },
          { name: 'system', description: 'System & health endpoints' },
        ],
      },
    });

    await fastify.register(fastifySwaggerUi, {
      routePrefix: '/docs',
      uiConfig: { deepLinking: true },
      staticCSP: true,
    });
  }
}

// ============= TELEGRAM WEBHOOK ENDPOINT =============

fastify.post(WEBHOOK_CONFIG.path, async (request, reply) => {
  // Validate secret token
  const secretToken = request.headers[WEBHOOK_CONFIG.secretHeader] as string;

  if (secretToken !== ENV.WEBHOOK_SECRET) {
    logger.warn('api', { action: 'webhook_invalid_secret', ip: request.ip });
    return reply.code(401).send({ ok: false, error: 'Unauthorized' });
  }

  const update = request.body as TelegramUpdate;

  // Process update asynchronously using centralized handler
  setImmediate(async () => {
    try {
      await processSupportBotUpdate(update);
    } catch (error) {
      // Error already logged in handler
    }
  });

  // Return immediately to Telegram
  return reply.code(200).send({ ok: true });
});

// ============= NOTIFICATION BOT WEBHOOK (TrelkAlertsBot) =============
// Handles QR Login callbacks and commands

fastify.post("/webhook/notifications", async (request, reply) => {
  // Validate secret token on notification webhook too
  const secretToken = request.headers[WEBHOOK_CONFIG.secretHeader] as string;
  if (secretToken !== ENV.WEBHOOK_SECRET) {
    logger.warn('api', { action: 'notification_webhook_invalid_secret', ip: request.ip });
    return reply.code(401).send({ ok: false, error: 'Unauthorized' });
  }

  const update = request.body as NotificationBotUpdate;

  // Process update asynchronously using centralized handler
  setImmediate(async () => {
    try {
      await processNotificationBotUpdate(update);
    } catch (error) {
      // Error already logged in handler
    }
  });

  return reply.code(200).send({ ok: true });
});

// ============= HEALTH & STATUS ENDPOINTS =============

fastify.get("/health", async () => {
  // Only expose minimal health info publicly
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
});

fastify.get("/", async () => {
  return { status: "ok" };
});

// ============= WEBHOOK MANAGEMENT ENDPOINTS =============

fastify.post("/api/webhook/setup", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  const webhookUrl = `${ENV.WEBHOOK_URL}${WEBHOOK_CONFIG.path}`;
  logger.info('api', { action: 'webhook_setup', url: webhookUrl });
  const result = await setWebhook(webhookUrl, ENV.WEBHOOK_SECRET);

  if (result) {
    logger.info("api", { action: "webhook_set", url: webhookUrl });
    return { ok: true, message: "Webhook configured", url: webhookUrl };
  }

  return reply.code(500).send({ ok: false, error: "Failed to set webhook" });
});

fastify.post("/webhook/delete", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  const result = await deleteWebhook();

  if (result) {
    logger.info("api", { action: "webhook_deleted" });
    return { ok: true, message: "Webhook deleted" };
  }

  return reply.code(500).send({ ok: false, error: "Failed to delete webhook" });
});

fastify.get("/api/webhook/info", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  const info = await getWebhookInfo();
  return { ok: true, webhook: info };
});

// ============= NOTIFICATION BOT WEBHOOK SETUP =============

fastify.post("/webhook/notifications/setup", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  const NOTIFICATION_BOT_TOKEN = ENV.NOTIFICATION_BOT_TOKEN;
  if (!NOTIFICATION_BOT_TOKEN) {
    return reply.code(500).send({ ok: false, error: 'NOTIFICATION_BOT_TOKEN not configured' });
  }
  const TELEGRAM_API_BASE =
    process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org";
  const webhookUrl = `${ENV.WEBHOOK_URL}/webhook/notifications`;

  try {
    const response = await fetch(
      `${TELEGRAM_API_BASE}/bot${NOTIFICATION_BOT_TOKEN}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message", "callback_query"],
        }),
      },
    );

    const data = (await response.json()) as {
      ok: boolean;
      description?: string;
    };

    if (data.ok) {
      logger.info("api", {
        action: "notification_webhook_set",
        url: webhookUrl,
      });
      return {
        ok: true,
        message: "Notification bot webhook configured",
        url: webhookUrl,
      };
    }

    return reply
      .code(500)
      .send({ ok: false, error: "Failed to set webhook" });
  } catch (error) {
    logger.error('api', { action: 'notification_webhook_setup_error', error: String(error) });
    return reply.code(500).send({ ok: false, error: 'Internal server error' });
  }
});

fastify.get("/webhook/notifications/info", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  const NOTIFICATION_BOT_TOKEN = ENV.NOTIFICATION_BOT_TOKEN;
  if (!NOTIFICATION_BOT_TOKEN) {
    return reply.code(500).send({ ok: false, error: 'NOTIFICATION_BOT_TOKEN not configured' });
  }
  const TELEGRAM_API_BASE =
    process.env.TELEGRAM_API_BASE_URL || "https://api.telegram.org";

  try {
    const response = await fetch(
      `${TELEGRAM_API_BASE}/bot${NOTIFICATION_BOT_TOKEN}/getWebhookInfo`,
    );
    const data = await response.json();
    return { ok: true, webhook: data };
  } catch (error) {
    logger.error('api', { action: 'notification_webhook_info_error', error: String(error) });
    return reply.code(500).send({ ok: false, error: 'Internal server error' });
  }
});

fastify.get("/api/widget/trelk-chat.js", async (request, reply) => {
  const filePath = path.join(__dirname, "../widget/trelk-chat.js");
  if (fs.existsSync(filePath)) {
    return reply.type("application/javascript").send(fs.createReadStream(filePath));
  } else {
    return reply.code(404).send("Not found");
  }
});
// ============= POLLING STATUS ENDPOINT =============

fastify.get("/polling/status", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  return { ok: true, ...getPollingStatus() };
});

// ============= QUEUE STATS ENDPOINT =============

fastify.get("/queues/stats", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  try {
    const stats = await getAllQueueStats();
    const redisHealth = getRedisHealth();

    return {
      ok: true,
      queues: stats,
      redis: {
        connected: isRedisConnected(),
        hitRate: redisHealth.hitRate,
        misses: redisHealth.cacheMisses,
        errors: redisHealth.errorCount,
      },
    };
  } catch (error) {
    logger.error('api', { action: 'queue_stats_error', error: String(error) });
    return reply.code(500).send({ ok: false, error: 'Internal server error' });
  }
});

// ============= SERVER STARTUP =============

async function start(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    // Connect to MongoDB
    await connectDatabase();

    // Initialize Redis (optional - will fallback to DB if unavailable)
    const redisConnected = await initializeRedis();
    if (redisConnected) {
      startCacheSync();
      await initializeWorkers();
    } else {
      logger.warn('api', { action: 'redis_unavailable', fallback: 'db-only' });
    }


    // Register plugins
    await registerPlugins();

    // Register API routes
    await registerAPIRoutes(fastify);

    // Verify bot token
    const botInfo = await getMe();
    if (!botInfo) {
      throw new Error(
        "Failed to connect to Telegram API. Check your bot token.",
      );
    }

    logger.info("api", {
      action: "bot_connected",
      botId: botInfo.id,
      username: botInfo.username,
    });

    // Start Fastify server first
    await fastify.listen({ port: ENV.PORT, host: ENV.HOST });

    // Initialize Socket.IO with Fastify's server (Dashboard)
    const dashboardIO = initializeSocketIO(fastify.server);

    // Initialize Presence Service (agent status engine + anti-fraud)
    initPresenceService(dashboardIO);

    // Initialize WebChat Socket.IO (Widget)
    const webChatIO = initializeWebChatSocket(fastify.server);
    
    // Set dashboard IO reference for webchat notifications
    setDashboardIO(dashboardIO);
    
    // Initialize channel manager with socket references
    initializeChannelManager(webChatIO);

    // Perform full reconciliation after crash/restart
    // This marks all agents offline and requeues their chats
    const reconciliationResult = await performFullReconciliation();
    logger.info("api", {
      action: "reconciliation_complete",
      ...reconciliationResult,
    });

    // Restore pending survey polls from database
    await restorePendingPolls();

    // Initialize Text Registry (i18n) cache
    await initializeTextRegistry();
    await seedDefaultTexts();

    // Queued session timers are now persisted in Redis via BullMQ
    // No need to restore - jobs survive server restarts

    // BullMQ workers are started in initializeWorkers() above
    // The old cron-based worker is replaced by BullMQ scheduled-messages queue

    // Start Flow Engine (processes waiting/paused flow executions)
    flowEngine.start(5000); // Check every 5 seconds

    // Initialize Policy Engine cache
    const { warmupPolicyCache } = await import('./services/policy-engine.service.js');
    await warmupPolicyCache();

    // Determine update mode (polling vs webhook)
    const updateMode = isPollingEnabled() ? "POLLING" : "WEBHOOK";

    logger.info('api', {
      action: 'server_ready',
      bot: botInfo.username,
      port: ENV.PORT,
      mode: updateMode,
      env: ENV.NODE_ENV,
    });

    // Start polling or configure webhook based on config
    if (isPollingEnabled()) {
      await startPolling();
      logger.info('api', { action: 'polling_started' });
    } else if (ENV.WEBHOOK_URL) {
      const webhookUrl = `${ENV.WEBHOOK_URL}${WEBHOOK_CONFIG.path}`;
      logger.info('api', { action: 'webhook_mode', url: webhookUrl });
    }
  } catch (error) {
    logger.error('api', { action: 'startup_failed', error: String(error) });
    process.exit(1);
  }
}

// Handle graceful shutdown
async function shutdown(): Promise<void> {
  logger.info('api', { action: 'shutdown_started' });

  try {
    if (isPollingEnabled()) await stopPolling();
    flowEngine.stop();
    stopPresenceService();
    stopCacheSync();
    const flushed = await flushPendingWrites();
    logger.info('api', { action: 'cache_flushed', ...flushed });
    await shutdownWorkers();
    await closeRedis();
    await fastify.close();
    await disconnectDatabase();
    logger.info('api', { action: 'shutdown_complete' });
    process.exit(0);
  } catch (error) {
    logger.error('api', { action: 'shutdown_error', error: String(error) });
    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start the server
start();

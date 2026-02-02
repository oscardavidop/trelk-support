/**
 * Trelk Support Platform - Main Server
 * Webhook-based Telegram bot with real-time agent dashboard
 */

import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyCookie from "@fastify/cookie";
import { ENV, WEBHOOK_CONFIG, validateConfig } from "./config/index.js";
import { connectDatabase, disconnectDatabase } from "./database/index.js";
import { handleMessage, handleCallbackQuery } from "./services/bot.handlers.js";
import {
  handlePollAnswer,
  restorePendingPolls,
} from "./services/survey.service.js";
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
import { performFullReconciliation } from "./services/reconciliation.service.js";
import { registerAPIRoutes } from "./routes/index.js";
import { logger } from "./services/logger.js";
import type { TelegramUpdate } from "./types/index.js";
import fs from "fs";
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
    key: fs.readFileSync("certs/webhook.key"),
    cert: fs.readFileSync("certs/webhook.crt"),
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
}

// ============= TELEGRAM WEBHOOK ENDPOINT =============

fastify.post(WEBHOOK_CONFIG.path, async (request, reply) => {
  console.log("Received webhook update");
  // Validate secret token
  const secretToken = request.headers[WEBHOOK_CONFIG.secretHeader] as string;

  if (secretToken !== ENV.WEBHOOK_SECRET) {
    // logger.warn('api', { error: 'Invalid webhook secret' });
  }

  const update = request.body as TelegramUpdate;

  // Process update asynchronously
  setImmediate(async () => {
    try {
      if (update.message) {
        await handleMessage(update.message);
      } else if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
      } else if (update.poll_answer) {
        // Handle survey poll answers
        await handlePollAnswer(
          update.poll_answer.poll_id,
          update.poll_answer.option_ids,
          update.poll_answer.user.id,
        );
      }
    } catch (error) {
      logger.error("api", { error: String(error), updateId: update.update_id });
    }
  });

  // Return immediately to Telegram
  return reply.code(200).send({ ok: true });
});

// ============= HEALTH & STATUS ENDPOINTS =============

fastify.get("/health", async () => {
  const redisHealth = getRedisHealth();
  const queuesInitialized = areWorkersInitialized();

  return {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "2.0.0",
    redis: {
      connected: isRedisConnected(),
      hitRate: redisHealth.hitRate,
      errors: redisHealth.errorCount,
    },
    queues: {
      initialized: queuesInitialized,
    },
  };
});

fastify.get("/", async () => {
  return {
    name: "Trelk Support Platform",
    version: "2.0.0",
    status: "running",
  };
});

// ============= WEBHOOK MANAGEMENT ENDPOINTS =============

fastify.post("/webhook/setup", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  const webhookUrl = `${ENV.WEBHOOK_URL}${WEBHOOK_CONFIG.path}`;
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

fastify.get("/webhook/info", async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  const info = await getWebhookInfo();
  return { ok: true, webhook: info };
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
    return reply.code(500).send({ ok: false, error: String(error) });
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
      console.log("   ✅ Redis Connected");

      // Start write-behind cache sync jobs
      startCacheSync();
      console.log("   ✅ Cache Sync Started");

      // Initialize BullMQ workers
      const workersStarted = await initializeWorkers();
      if (workersStarted) {
        console.log("   ✅ BullMQ Workers Started");
      }
    } else {
      console.log("   ⚠️  Redis unavailable - using DB fallback");
    }

    fastify.addHook("onRequest", async (request) => {
      // console.log('ip address:', request.ip);
      // const customIp =
      //   request.headers["x-real-ip"] ||
      //   request.headers["cf-connecting-ip"] ||
      //   request.headers["x-forwarded-for"];

      // if (customIp) {
      //   request.ip = Array.isArray(customIp)
      //     ? customIp[0]
      //     : customIp.split(",")[0].trim();
      // }
    });

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

    // Initialize Socket.IO with Fastify's server
    initializeSocketIO(fastify.server);

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
    console.log("   ✅ Text Registry Initialized");

    // Queued session timers are now persisted in Redis via BullMQ
    // No need to restore - jobs survive server restarts

    // BullMQ workers are started in initializeWorkers() above
    // The old cron-based worker is replaced by BullMQ scheduled-messages queue

    // Start Flow Engine (processes waiting/paused flow executions)
    flowEngine.start(5000); // Check every 5 seconds

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🤖 Trelk Support Platform v2.0                             ║
║                                                              ║
║   Bot: @${(botInfo.username || "TrelkSupportBot").padEnd(44)}║
║   API: http://${ENV.HOST}:${String(ENV.PORT).padEnd(38)}║
║   Webhook: ${WEBHOOK_CONFIG.path.padEnd(40)}║
║   Environment: ${ENV.NODE_ENV.padEnd(36)}║
║                                                              ║
║   ✅ MongoDB Connected                                       ║
║   ✅ Socket.IO Ready                                         ║
║   ✅ API Routes Registered                                   ║
║   ✅ Flow Engine Started                                     ║
║   ✅ Redis & BullMQ Ready                                    ║
║                                                              ║
║   Ready for support operations!                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);

    // Auto-setup webhook
    if (ENV.WEBHOOK_URL) {
      const webhookUrl = `${ENV.WEBHOOK_URL}${WEBHOOK_CONFIG.path}`;
      // const result = await setWebhook(webhookUrl, ENV.WEBHOOK_SECRET);
      // if (result) {
      //   logger.info('api', { action: 'webhook_auto_configured', url: webhookUrl });
      //   console.log(`   📡 Webhook configured: ${webhookUrl}\n`);
      // }
    }
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Handle graceful shutdown
async function shutdown(): Promise<void> {
  console.log("\n🛑 Shutting down gracefully...");

  try {
    // Stop Flow Engine
    flowEngine.stop();

    // Stop cache sync and flush pending writes to MongoDB
    stopCacheSync();
    console.log("   ⏳ Flushing pending cache writes...");
    const flushed = await flushPendingWrites();
    console.log(
      `   ✅ Flushed ${flushed.executions} executions, ${flushed.userFields} user fields`,
    );

    // Shutdown BullMQ workers (handles scheduled messages now)
    await shutdownWorkers();

    // Close Redis connection
    await closeRedis();

    await fastify.close();
    await disconnectDatabase();
    console.log("✅ Server closed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start the server
start();

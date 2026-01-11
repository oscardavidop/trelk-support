/**
 * Trelk Support Platform - Main Server
 * Webhook-based Telegram bot with real-time agent dashboard
 */

import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import { ENV, WEBHOOK_CONFIG, validateConfig } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './database/index.js';
import { handleMessage, handleCallbackQuery } from './services/bot.handlers.js';
import { handlePollAnswer, restorePendingPolls } from './services/survey.service.js';
import { restoreQueuedTimers } from './services/inactivity.service.js';
import { startScheduledMessagesWorker, stopScheduledMessagesWorker } from './services/scheduledMessage.worker.js';
import { setWebhook, deleteWebhook, getMe, getWebhookInfo } from './services/telegram.js';
import { initializeSocketIO } from './services/socket.js';
import { performFullReconciliation } from './services/reconciliation.service.js';
import { registerAPIRoutes } from './routes/index.js';
import { logger } from './services/logger.js';
import type { TelegramUpdate } from './types/index.js';
import fs from 'fs';

// Create Fastify instance
const fastify = Fastify({
  logger: ENV.NODE_ENV === 'development'
    ? {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    }
    : true,
  https: {
    key: fs.readFileSync('certs/webhook.key'),
    cert: fs.readFileSync('certs/webhook.crt'),
  },
});


// ============= PLUGINS =============

async function registerPlugins(): Promise<void> {
  // CORS
  await fastify.register(fastifyCors, {
    origin: ENV.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Cookies
  await fastify.register(fastifyCookie, {
    secret: ENV.JWT_SECRET,
  });
}

// ============= TELEGRAM WEBHOOK ENDPOINT =============

fastify.post(WEBHOOK_CONFIG.path, async (request, reply) => {
  console.log('Received webhook update');
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
          update.poll_answer.user.id
        );
      }
    } catch (error) {
      logger.error('api', { error: String(error), updateId: update.update_id });
    }
  });

  // Return immediately to Telegram
  return reply.code(200).send({ ok: true });
});

// ============= HEALTH & STATUS ENDPOINTS =============

fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '2.0.0',
  };
});

fastify.get('/', async () => {
  return {
    name: 'Trelk Support Platform',
    version: '2.0.0',
    status: 'running',
  };
});

// ============= WEBHOOK MANAGEMENT ENDPOINTS =============

fastify.post('/webhook/setup', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  const webhookUrl = `${ENV.WEBHOOK_URL}${WEBHOOK_CONFIG.path}`;
  const result = await setWebhook(webhookUrl, ENV.WEBHOOK_SECRET);

  if (result) {
    logger.info('api', { action: 'webhook_set', url: webhookUrl });
    return { ok: true, message: 'Webhook configured', url: webhookUrl };
  }

  return reply.code(500).send({ ok: false, error: 'Failed to set webhook' });
});

fastify.post('/webhook/delete', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  const result = await deleteWebhook();

  if (result) {
    logger.info('api', { action: 'webhook_deleted' });
    return { ok: true, message: 'Webhook deleted' };
  }

  return reply.code(500).send({ ok: false, error: 'Failed to delete webhook' });
});

fastify.get('/webhook/info', async (request, reply) => {
  const authHeader = request.headers.authorization;
  if (authHeader !== `Bearer ${ENV.WEBHOOK_SECRET}`) {
    return reply.code(401).send({ ok: false });
  }

  const info = await getWebhookInfo();
  return { ok: true, webhook: info };
});

// ============= SERVER STARTUP =============

async function start(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();

    // Connect to MongoDB
    await connectDatabase();

    // Register plugins
    await registerPlugins();

    // Register API routes
    await registerAPIRoutes(fastify);

    // Verify bot token
    const botInfo = await getMe();
    if (!botInfo) {
      throw new Error('Failed to connect to Telegram API. Check your bot token.');
    }

    logger.info('api', {
      action: 'bot_connected',
      botId: botInfo.id,
      username: botInfo.username
    });

    // Start Fastify server first
    await fastify.listen({ port: ENV.PORT, host: ENV.HOST });

    // Initialize Socket.IO with Fastify's server
    initializeSocketIO(fastify.server);

    // Perform full reconciliation after crash/restart
    // This marks all agents offline and requeues their chats
    const reconciliationResult = await performFullReconciliation();
    logger.info('api', {
      action: 'reconciliation_complete',
      ...reconciliationResult
    });

    // Restore pending survey polls from database
    await restorePendingPolls();
    
    // Restore queued session timers
    await restoreQueuedTimers();
    
    // Start scheduled messages worker
    startScheduledMessagesWorker();

    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🤖 Trelk Support Platform v2.0                             ║
║                                                              ║
║   Bot: @${(botInfo.username || 'TrelkSupportBot').padEnd(44)}║
║   API: http://${ENV.HOST}:${String(ENV.PORT).padEnd(38)}║
║   Webhook: ${WEBHOOK_CONFIG.path.padEnd(40)}║
║   Environment: ${ENV.NODE_ENV.padEnd(36)}║
║                                                              ║
║   ✅ MongoDB Connected                                       ║
║   ✅ Socket.IO Ready                                         ║
║   ✅ API Routes Registered                                   ║
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
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
async function shutdown(): Promise<void> {
  console.log('\n🛑 Shutting down gracefully...');

  try {
    // Stop scheduled messages worker first
    stopScheduledMessagesWorker();
    
    await fastify.close();
    await disconnectDatabase();
    console.log('✅ Server closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
start();

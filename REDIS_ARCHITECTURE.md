# Redis + BullMQ Architecture

## Overview

This document describes the Redis caching and BullMQ job processing infrastructure implemented for the Trelk Support Platform.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Trelk Support Platform                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│  │   Fastify   │────▶│   MongoDB   │◀────│   Workers   │       │
│  │   Server    │     │  (Source of │     │  (BullMQ)   │       │
│  └──────┬──────┘     │    Truth)   │     └──────┬──────┘       │
│         │            └─────────────┘            │               │
│         │                   ▲                   │               │
│         ▼                   │                   ▼               │
│  ┌──────────────────────────┴───────────────────────┐          │
│  │                    Redis                          │          │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │          │
│  │  │    Cache     │  │   BullMQ     │  │ Pub/Sub │ │          │
│  │  │ (Flows, etc) │  │   Queues     │  │         │ │          │
│  │  └──────────────┘  └──────────────┘  └─────────┘ │          │
│  └──────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Files Created

### Services

| File | Description |
|------|-------------|
| `src/services/redis.ts` | Redis connection management, GET/SET, Pub/Sub, distributed locking |
| `src/services/cache.ts` | High-level cache with key builders, TTLs, invalidation patterns |
| `src/services/queue.ts` | BullMQ queue definitions and job management |

### Workers

| File | Description |
|------|-------------|
| `src/workers/index.ts` | Worker initialization and exports |
| `src/workers/scheduledMessages.worker.ts` | Processes scheduled messages delivery |
| `src/workers/flowExecution.worker.ts` | Processes flow triggers asynchronously |
| `src/workers/cleanup.worker.ts` | Periodic maintenance tasks |

## Cache Strategy

### Key Prefix
All keys use prefix: `trelk:support:`

### Cache Keys

```typescript
CacheKeys = {
  flow: (flowId) => `flow:${flowId}`,
  flowPublished: (flowId) => `flow:${flowId}:published`,
  flowByTrigger: (triggerType) => `flow:trigger:${triggerType}`,
  session: (sessionId) => `session:${sessionId}`,
  agent: (agentId) => `agent:${agentId}`,
  botSettings: () => `settings:bot`,
  user: (telegramId) => `user:${telegramId}`,
  // ...more in cache.ts
}
```

### TTLs

| Type | TTL | Use Case |
|------|-----|----------|
| SHORT | 60s | Stats, frequently changing data |
| MEDIUM | 5min | Sessions, semi-stable data |
| LONG | 1hr | Settings, stable data |
| FLOW | 30min | Flow definitions |
| USER | 30min | User profiles |

### Invalidation

```typescript
// Invalidate single flow
await FlowCache.invalidateFlow(flowId);

// Invalidate all flows
await FlowCache.invalidateAllFlows();

// Pattern-based invalidation
await invalidatePattern('flow:trigger:*');
```

## Queue System

### Queues

| Queue | Purpose | Concurrency |
|-------|---------|-------------|
| `scheduled-messages` | Delayed message delivery | 10 |
| `flow-execution` | Async flow processing | 20 |
| `cleanup` | Maintenance tasks | 1 |
| `notifications` | Push/email notifications | 5 |

### Job Options

```typescript
defaultJobOptions: {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
  removeOnComplete: { count: 1000, age: 24h },
  removeOnFail: { count: 5000, age: 7d },
}
```

### Scheduling a Message

```typescript
import { scheduleMessage } from './workers/index.js';

const jobId = await scheduleMessage(
  messageId,
  sessionId,
  chatId,
  new Date('2024-12-25T10:00:00Z')
);

// Cancel
await cancelScheduledMessage(messageId);
```

## Distributed Locking

```typescript
import { acquireLock, releaseLock } from './services/redis.js';

const lockValue = await acquireLock('my-resource', 30); // 30s TTL
if (lockValue) {
  try {
    // Critical section
  } finally {
    await releaseLock('my-resource', lockValue);
  }
}
```

## Health & Metrics

### Endpoints

- `GET /health` - Includes Redis status and queue info
- `GET /queues/stats` - Detailed queue statistics (requires auth)

### Response Example

```json
{
  "status": "ok",
  "redis": {
    "connected": true,
    "hitRate": 85.5,
    "errors": 0
  },
  "queues": {
    "initialized": true
  }
}
```

## Graceful Degradation

The system is designed to work without Redis:

1. **Redis unavailable**: Falls back to DB-only mode
2. **Cache miss**: Always fetches from MongoDB
3. **Write-through**: DB writes always succeed, cache updates are best-effort

```typescript
// Cache-aside pattern
const flow = await getOrFetch(
  CacheKeys.flow(flowId),
  () => Flow.findById(flowId),  // DB fetcher
  { ttl: CacheTTL.FLOW }
);
```

## Environment Variables

```bash
# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

## Migration

To migrate existing scheduled messages to BullMQ:

```typescript
import { migrateExistingScheduledMessages } from './workers/scheduledMessages.worker.js';

const stats = await migrateExistingScheduledMessages();
console.log(`Migrated: ${stats.migrated}, Skipped: ${stats.skipped}`);
```

## Cleanup Jobs Schedule

| Task | Schedule | Description |
|------|----------|-------------|
| expired_sessions | Daily 3 AM | Archive old closed sessions |
| old_messages | Weekly Sunday 4 AM | Delete messages from archived sessions |
| stale_locks | Every 30 min | Clean up orphaned locks |

## Development Notes

1. **BullMQ Dashboard**: Consider adding [Bull Board](https://github.com/felixmosh/bull-board) for queue monitoring
2. **Redis Cluster**: Current setup uses single instance; for production scale, consider Redis Cluster
3. **Metrics**: Prometheus metrics can be added using BullMQ's built-in metrics support

/**
 * Admin Control Service
 * Handles all administrative control operations with real impact
 * All actions are logged to AdminAuditLog
 */

import mongoose from 'mongoose';
import { AdminAuditLog, type IAdminAuditLog } from '../database/models/AdminAuditLog.js';
import { ChatSession } from '../database/models/ChatSession.js';
import { Message } from '../database/models/Message.js';
import { Flow } from '../database/models/Flow.js';
import { ScheduledMessage } from '../database/models/ScheduledMessage.js';
import { Agent } from '../database/models/Agent.js';
import { getRedisClient } from './redis.js';
import { getQueue, QUEUE_NAMES } from './queue.js';
import { logger } from './logger.js';
import { getIO, agentSockets } from './socket.js';
import os from 'os';

// ============= TYPES =============

interface AdminContext {
  adminId: string;
  adminEmail: string;
  adminName: string;
  ip: string;
  userAgent?: string;
}

interface ActionResult {
  success: boolean;
  message: string;
  affectedCount?: number;
  details?: Record<string, unknown>;
  error?: string;
}

type AuditSeverity = 'info' | 'warning' | 'critical' | 'destructive';
type AuditCategory = 'chat' | 'flow' | 'database' | 'logs' | 'cache' | 'session' | 'system';

// ============= AUDIT LOGGING =============

async function logAction(
  ctx: AdminContext,
  action: string,
  category: AuditCategory,
  severity: AuditSeverity,
  target: string,
  result: ActionResult,
  details: Record<string, unknown> = {},
  executionTimeMs?: number
): Promise<void> {
  try {
    await AdminAuditLog.create({
      adminId: new mongoose.Types.ObjectId(ctx.adminId),
      adminEmail: ctx.adminEmail,
      adminName: ctx.adminName,
      action,
      category,
      severity,
      target,
      details,
      affectedCount: result.affectedCount,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      result: result.success ? 'success' : 'failure',
      errorMessage: result.error,
      executionTimeMs,
      requiresReview: severity === 'destructive',
    });

    logger.info('admin', {
      action: `ADMIN_ACTION: ${action}`,
      admin: ctx.adminEmail,
      target,
      result: result.success ? 'success' : 'failure',
      affected: result.affectedCount,
    });
  } catch (error) {
    logger.error('admin', { error, action: 'audit_log_failed' });
  }
}

// ============= RATE LIMITING =============

const actionLocks = new Map<string, number>();
const LOCK_DURATION = 5000;

function checkAndSetLock(key: string): boolean {
  const now = Date.now();
  const lastAction = actionLocks.get(key);
  
  if (lastAction && now - lastAction < LOCK_DURATION) {
    return false;
  }
  
  actionLocks.set(key, now);
  return true;
}

// ============= CHAT CONTROL =============

export async function closeAllActiveChats(ctx: AdminContext, reason: string = 'Admin force close'): Promise<ActionResult> {
  const startTime = Date.now();
  const lockKey = `close_all_chats_${ctx.adminId}`;
  
  if (!checkAndSetLock(lockKey)) {
    return { success: false, message: 'Acción bloqueada. Espera unos segundos.', error: 'rate_limited' };
  }

  try {
    const result = await ChatSession.updateMany(
      { status: { $in: ['human', 'waiting', 'queued', 'bot'] } },
      { 
        $set: { 
          status: 'closed',
          closeReason: 'admin_force',
          closedAt: new Date(),
          closedBy: new mongoose.Types.ObjectId(ctx.adminId),
          closedByType: 'admin'
        }
      }
    );

    const io = getIO();
    if (io) {
      io.emit('system:chats_force_closed', { 
        reason,
        closedBy: ctx.adminName,
        count: result.modifiedCount 
      });
    }

    const redis = getRedisClient();
    if (redis) {
      const keys = await redis.keys('chat:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    const actionResult: ActionResult = {
      success: true,
      message: `${result.modifiedCount} chats cerrados exitosamente`,
      affectedCount: result.modifiedCount,
    };

    await logAction(ctx, 'CLOSE_ALL_CHATS', 'chat', 'critical', 'all_active_chats', actionResult, { reason }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: 'Error al cerrar chats',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'CLOSE_ALL_CHATS', 'chat', 'critical', 'all_active_chats', actionResult, { reason }, Date.now() - startTime);
    return actionResult;
  }
}

export async function closeChatsByAgent(ctx: AdminContext, agentId: string): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const agent = await Agent.findById(agentId);
    if (!agent) {
      return { success: false, message: 'Agente no encontrado', error: 'agent_not_found' };
    }

    const result = await ChatSession.updateMany(
      { assignedAgent: new mongoose.Types.ObjectId(agentId), status: { $in: ['human', 'waiting'] } },
      { 
        $set: { 
          status: 'closed',
          closeReason: 'admin_force',
          closedAt: new Date(),
          closedBy: new mongoose.Types.ObjectId(ctx.adminId),
          closedByType: 'admin'
        }
      }
    );

    const agentSocket = agentSockets.get(agentId);
    if (agentSocket) {
      agentSocket.emit('system:your_chats_closed', { 
        reason: 'Admin cerró tus chats',
        closedBy: ctx.adminName,
        count: result.modifiedCount 
      });
    }

    const actionResult: ActionResult = {
      success: true,
      message: `${result.modifiedCount} chats del agente ${agent.name} cerrados`,
      affectedCount: result.modifiedCount,
    };

    await logAction(ctx, 'CLOSE_CHATS_BY_AGENT', 'chat', 'warning', agentId, actionResult, { agentName: agent.name }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: 'Error al cerrar chats',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'CLOSE_CHATS_BY_AGENT', 'chat', 'warning', agentId, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function closeChatsByStatus(ctx: AdminContext, status: string): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const result = await ChatSession.updateMany(
      { status },
      { 
        $set: { 
          status: 'closed',
          closeReason: 'admin_force',
          closedAt: new Date(),
          closedBy: new mongoose.Types.ObjectId(ctx.adminId),
          closedByType: 'admin'
        }
      }
    );

    const io = getIO();
    if (io) {
      io.emit('system:chats_force_closed', { 
        reason: `Chats con estado ${status} cerrados`,
        closedBy: ctx.adminName,
        count: result.modifiedCount 
      });
    }

    const actionResult: ActionResult = {
      success: true,
      message: `${result.modifiedCount} chats con estado '${status}' cerrados`,
      affectedCount: result.modifiedCount,
    };

    await logAction(ctx, 'CLOSE_CHATS_BY_STATUS', 'chat', 'warning', status, actionResult, { status }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: 'Error al cerrar chats',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'CLOSE_CHATS_BY_STATUS', 'chat', 'warning', status, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function deleteMessageHistory(ctx: AdminContext, period: '24h' | '7d' | 'all'): Promise<ActionResult> {
  const startTime = Date.now();
  const lockKey = `delete_messages_${ctx.adminId}`;
  
  if (!checkAndSetLock(lockKey)) {
    return { success: false, message: 'Acción bloqueada. Espera unos segundos.', error: 'rate_limited' };
  }

  try {
    let dateFilter: Date | null = null;
    if (period === '24h') {
      dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (period === '7d') {
      dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const query = dateFilter ? { createdAt: { $lt: dateFilter } } : {};
    const count = await Message.countDocuments(query);
    const result = await Message.deleteMany(query);

    const actionResult: ActionResult = {
      success: true,
      message: `${result.deletedCount} mensajes eliminados (período: ${period})`,
      affectedCount: result.deletedCount,
    };

    await logAction(ctx, 'DELETE_MESSAGE_HISTORY', 'chat', 'destructive', 'messages', actionResult, { period, countBefore: count }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: 'Error al eliminar mensajes',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'DELETE_MESSAGE_HISTORY', 'chat', 'destructive', 'messages', actionResult, { period }, Date.now() - startTime);
    return actionResult;
  }
}

export async function deleteOrphanChats(ctx: AdminContext): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const agentIds = await Agent.find({}).distinct('_id');
    
    const orphanChats = await ChatSession.find({
      $or: [
        { assignedAgent: { $nin: [...agentIds, null, undefined] } },
        { status: 'bot', updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      ]
    });

    const orphanIds = orphanChats.map(c => c._id);
    await Message.deleteMany({ sessionId: { $in: orphanChats.map(c => c.sessionId) } });
    const result = await ChatSession.deleteMany({ _id: { $in: orphanIds } });

    const actionResult: ActionResult = {
      success: true,
      message: `${result.deletedCount} chats huérfanos eliminados`,
      affectedCount: result.deletedCount,
    };

    await logAction(ctx, 'DELETE_ORPHAN_CHATS', 'chat', 'warning', 'orphan_chats', actionResult, {}, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: 'Error al eliminar chats huérfanos',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'DELETE_ORPHAN_CHATS', 'chat', 'warning', 'orphan_chats', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function reassignChatsFromAgent(ctx: AdminContext, fromAgentId: string, toAgentId: string): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const [fromAgent, toAgent] = await Promise.all([
      Agent.findById(fromAgentId),
      Agent.findById(toAgentId)
    ]);

    if (!fromAgent || !toAgent) {
      return { success: false, message: 'Agente no encontrado', error: 'agent_not_found' };
    }

    const result = await ChatSession.updateMany(
      { assignedAgent: new mongoose.Types.ObjectId(fromAgentId), status: { $in: ['human', 'waiting'] } },
      { 
        $set: { 
          assignedAgent: new mongoose.Types.ObjectId(toAgentId),
        },
        $push: {
          transferHistory: {
            from: fromAgentId,
            to: toAgentId,
            at: new Date(),
            reason: 'admin_reassign'
          }
        }
      }
    );

    const io = getIO();
    if (io) {
      const fromSocket = agentSockets.get(fromAgentId);
      const toSocket = agentSockets.get(toAgentId);
      
      if (fromSocket) {
        fromSocket.emit('chats:reassigned_away', { count: result.modifiedCount, toAgent: toAgent.name });
      }
      if (toSocket) {
        toSocket.emit('chats:reassigned_to_you', { count: result.modifiedCount, fromAgent: fromAgent.name });
      }
    }

    const actionResult: ActionResult = {
      success: true,
      message: `${result.modifiedCount} chats reasignados de ${fromAgent.name} a ${toAgent.name}`,
      affectedCount: result.modifiedCount,
    };

    await logAction(ctx, 'REASSIGN_CHATS', 'chat', 'warning', 'chat_reassign', actionResult, { fromAgent: fromAgent.name, toAgent: toAgent.name }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: 'Error al reasignar chats',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'REASSIGN_CHATS', 'chat', 'warning', 'chat_reassign', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

// ============= FLOW CONTROL =============

export async function disableAllFlows(ctx: AdminContext): Promise<ActionResult> {
  const startTime = Date.now();
  const lockKey = `disable_flows_${ctx.adminId}`;
  
  if (!checkAndSetLock(lockKey)) {
    return { success: false, message: 'Acción bloqueada. Espera unos segundos.', error: 'rate_limited' };
  }

  try {
    const result = await Flow.updateMany(
      { enabled: true },
      { $set: { enabled: false, disabledBy: ctx.adminId, disabledAt: new Date() } }
    );

    const redis = getRedisClient();
    if (redis) {
      const keys = await redis.keys('flow:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    const io = getIO();
    if (io) {
      io.emit('system:flows_disabled', { 
        disabledBy: ctx.adminName,
        count: result.modifiedCount 
      });
    }

    const actionResult: ActionResult = {
      success: true,
      message: `${result.modifiedCount} flows desactivados`,
      affectedCount: result.modifiedCount,
    };

    await logAction(ctx, 'DISABLE_ALL_FLOWS', 'flow', 'critical', 'all_flows', actionResult, {}, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: 'Error al desactivar flows',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'DISABLE_ALL_FLOWS', 'flow', 'critical', 'all_flows', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function enableFlows(ctx: AdminContext, flowIds: string[]): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const result = await Flow.updateMany(
      { _id: { $in: flowIds.map(id => new mongoose.Types.ObjectId(id)) } },
      { $set: { enabled: true }, $unset: { disabledBy: 1, disabledAt: 1 } }
    );

    const redis = getRedisClient();
    if (redis) {
      for (const id of flowIds) {
        await redis.del(`flow:${id}`);
      }
    }

    const actionResult: ActionResult = {
      success: true,
      message: `${result.modifiedCount} flows activados`,
      affectedCount: result.modifiedCount,
    };

    await logAction(ctx, 'ENABLE_FLOWS', 'flow', 'info', 'selected_flows', actionResult, { flowIds }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: 'Error al activar flows',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'ENABLE_FLOWS', 'flow', 'info', 'selected_flows', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function reloadFlowsFromDB(ctx: AdminContext): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const redis = getRedisClient();
    if (redis) {
      const keys = await redis.keys('flow:*');
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }

    const flowCount = await Flow.countDocuments();

    const actionResult: ActionResult = {
      success: true,
      message: `Cache de ${flowCount} flows limpiado. Se recargarán en próximo uso.`,
      affectedCount: flowCount,
    };

    await logAction(ctx, 'RELOAD_FLOWS', 'flow', 'info', 'flow_cache', actionResult, {}, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: 'Error al recargar flows',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'RELOAD_FLOWS', 'flow', 'info', 'flow_cache', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function deleteInactiveFlows(ctx: AdminContext, inactiveDays: number = 90): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);
    
    const result = await Flow.deleteMany({
      enabled: false,
      updatedAt: { $lt: cutoffDate }
    });

    const actionResult: ActionResult = {
      success: true,
      message: `${result.deletedCount} flows inactivos eliminados (>= ${inactiveDays} días)`,
      affectedCount: result.deletedCount,
    };

    await logAction(ctx, 'DELETE_INACTIVE_FLOWS', 'flow', 'warning', 'inactive_flows', actionResult, { inactiveDays }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: 'Error al eliminar flows inactivos',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'DELETE_INACTIVE_FLOWS', 'flow', 'warning', 'inactive_flows', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function getFlowStats(_ctx: AdminContext): Promise<{
  total: number;
  active: number;
  inactive: number;
  flows: Array<{ _id: string; name: string; enabled: boolean; executionCount: number; updatedAt: Date }>;
}> {
  const flows = await Flow.find({})
    .select('name enabled executionCount updatedAt')
    .sort({ updatedAt: -1 })
    .lean();

  return {
    total: flows.length,
    active: flows.filter(f => f.enabled).length,
    inactive: flows.filter(f => !f.enabled).length,
    flows: flows.map(f => ({
      _id: f._id.toString(),
      name: f.name,
      enabled: f.enabled,
      executionCount: f.executionCount || 0,
      updatedAt: f.updatedAt
    }))
  };
}

// ============= DATABASE CONTROL =============

export async function getCollectionStats(): Promise<Array<{ name: string; count: number; size: string }>> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');

  const collections = await db.listCollections().toArray();
  const stats: Array<{ name: string; count: number; size: string }> = [];

  for (const col of collections) {
    try {
      const collection = db.collection(col.name);
      const count = await collection.countDocuments();
      const colStats = await db.command({ collStats: col.name });
      const sizeBytes = colStats.size || 0;
      const sizeStr = sizeBytes > 1024 * 1024 
        ? `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`
        : sizeBytes > 1024 
          ? `${(sizeBytes / 1024).toFixed(2)} KB`
          : `${sizeBytes} B`;
      
      stats.push({ name: col.name, count, size: sizeStr });
    } catch {
      stats.push({ name: col.name, count: 0, size: 'N/A' });
    }
  }

  return stats.sort((a, b) => b.count - a.count);
}

export async function dropCollection(ctx: AdminContext, collectionName: string, confirmPhrase: string): Promise<ActionResult> {
  const startTime = Date.now();
  const lockKey = `drop_collection_${ctx.adminId}`;
  
  if (!checkAndSetLock(lockKey)) {
    return { success: false, message: 'Acción bloqueada. Espera unos segundos.', error: 'rate_limited' };
  }

  if (confirmPhrase !== `DELETE ${collectionName.toUpperCase()}`) {
    return { 
      success: false, 
      message: `Frase de confirmación incorrecta. Esperado: "DELETE ${collectionName.toUpperCase()}"`,
      error: 'confirmation_failed'
    };
  }

  const protectedCollections = ['agents', 'adminauditlogs'];
  if (protectedCollections.includes(collectionName.toLowerCase())) {
    return { 
      success: false, 
      message: `La colección "${collectionName}" está protegida y no puede ser eliminada`,
      error: 'protected_collection'
    };
  }

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const collection = db.collection(collectionName);
    const countBefore = await collection.countDocuments();
    await collection.drop();

    const actionResult: ActionResult = {
      success: true,
      message: `Colección "${collectionName}" eliminada (${countBefore} documentos)`,
      affectedCount: countBefore,
    };

    await logAction(ctx, 'DROP_COLLECTION', 'database', 'destructive', collectionName, actionResult, { countBefore }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al eliminar colección: ${error instanceof Error ? error.message : 'Unknown'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'DROP_COLLECTION', 'database', 'destructive', collectionName, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function clearCollection(ctx: AdminContext, collectionName: string, confirmPhrase: string): Promise<ActionResult> {
  const startTime = Date.now();

  if (confirmPhrase !== `CLEAR ${collectionName.toUpperCase()}`) {
    return { 
      success: false, 
      message: `Frase de confirmación incorrecta. Esperado: "CLEAR ${collectionName.toUpperCase()}"`,
      error: 'confirmation_failed'
    };
  }

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const collection = db.collection(collectionName);
    const countBefore = await collection.countDocuments();
    await collection.deleteMany({});

    const actionResult: ActionResult = {
      success: true,
      message: `${countBefore} documentos eliminados de "${collectionName}"`,
      affectedCount: countBefore,
    };

    await logAction(ctx, 'CLEAR_COLLECTION', 'database', 'destructive', collectionName, actionResult, { countBefore }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al limpiar colección`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'CLEAR_COLLECTION', 'database', 'destructive', collectionName, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function rebuildIndexes(ctx: AdminContext, collectionName: string): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('Database not connected');

    const collection = db.collection(collectionName);
    await collection.dropIndexes();
    // await db.command({ reIndex: collectionName });

    const actionResult: ActionResult = {
      success: true,
      message: `Índices de "${collectionName}" reconstruidos`,
    };

    await logAction(ctx, 'REBUILD_INDEXES', 'database', 'warning', collectionName, actionResult, {}, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al reconstruir índices`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'REBUILD_INDEXES', 'database', 'warning', collectionName, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

// ============= CACHE & QUEUE CONTROL =============

export async function getCacheStats(): Promise<{
  dbSize: number;
  usedMemory: string;
  keys: number;
  keysByPrefix: Record<string, number>;
}> {
  const redis = getRedisClient();
  if (!redis) throw new Error('Redis not connected');

  const info = await redis.info('memory');
  const dbSize = await redis.dbsize();
  
  const usedMemoryMatch = info.match(/used_memory_human:(\S+)/);
  const usedMemory = usedMemoryMatch ? usedMemoryMatch[1] : 'N/A';

  const prefixes = ['chat:', 'flow:', 'user:', 'session:', 'agent:', 'cache:', 'queue:'];
  const keysByPrefix: Record<string, number> = {};

  for (const prefix of prefixes) {
    const keys = await redis.keys(`${prefix}*`);
    keysByPrefix[prefix.replace(':', '')] = keys.length;
  }

  return { dbSize, usedMemory, keys: dbSize, keysByPrefix };
}

export async function clearCacheByPrefix(ctx: AdminContext, prefix: string): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const redis = getRedisClient();
    if (!redis) throw new Error('Redis not connected');

    const keys = await redis.keys(`${prefix}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }

    const actionResult: ActionResult = {
      success: true,
      message: `${keys.length} keys con prefijo "${prefix}" eliminadas`,
      affectedCount: keys.length,
    };

    await logAction(ctx, 'CLEAR_CACHE_PREFIX', 'cache', 'warning', prefix, actionResult, {}, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al limpiar cache`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'CLEAR_CACHE_PREFIX', 'cache', 'warning', prefix, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function flushAllCache(ctx: AdminContext, confirmPhrase: string): Promise<ActionResult> {
  const startTime = Date.now();
  const lockKey = `flush_cache_${ctx.adminId}`;
  
  if (!checkAndSetLock(lockKey)) {
    return { success: false, message: 'Acción bloqueada. Espera unos segundos.', error: 'rate_limited' };
  }

  if (confirmPhrase !== 'FLUSH ALL CACHE') {
    return { 
      success: false, 
      message: 'Frase de confirmación incorrecta. Esperado: "FLUSH ALL CACHE"',
      error: 'confirmation_failed'
    };
  }

  try {
    const redis = getRedisClient();
    if (!redis) throw new Error('Redis not connected');

    const keysBefore = await redis.dbsize();
    await redis.flushdb();

    const actionResult: ActionResult = {
      success: true,
      message: `Redis flushed. ${keysBefore} keys eliminadas`,
      affectedCount: keysBefore,
    };

    await logAction(ctx, 'FLUSH_ALL_CACHE', 'cache', 'destructive', 'redis', actionResult, { keysBefore }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al flush Redis`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'FLUSH_ALL_CACHE', 'cache', 'destructive', 'redis', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function getQueueStats(): Promise<{
  scheduledQueue: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  inactivityQueue: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  flowQueue: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  cleanupQueue: { waiting: number; active: number; completed: number; failed: number; delayed: number };
  notificationsQueue: { waiting: number; active: number; completed: number; failed: number; delayed: number };
}> {
  const getStats = async (queueName: typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES]) => {
    try {
      const queue = getQueue(queueName);
      if (!queue) return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
      return {
        waiting: await queue.getWaitingCount(),
        active: await queue.getActiveCount(),
        completed: await queue.getCompletedCount(),
        failed: await queue.getFailedCount(),
        delayed: await queue.getDelayedCount(),
      };
    } catch {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    }
  };

  return {
    scheduledQueue: await getStats(QUEUE_NAMES.SCHEDULED_MESSAGES),
    inactivityQueue: await getStats(QUEUE_NAMES.INACTIVITY),
    flowQueue: await getStats(QUEUE_NAMES.FLOW_EXECUTION),
    cleanupQueue: await getStats(QUEUE_NAMES.CLEANUP),
    notificationsQueue: await getStats(QUEUE_NAMES.NOTIFICATIONS),
  };
}

export async function pauseQueue(ctx: AdminContext, queueName: 'scheduled' | 'inactivity' | 'flow' | 'cleanup' | 'notifications'): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const queueMap = {
      scheduled: QUEUE_NAMES.SCHEDULED_MESSAGES,
      inactivity: QUEUE_NAMES.INACTIVITY,
      flow: QUEUE_NAMES.FLOW_EXECUTION,
      cleanup: QUEUE_NAMES.CLEANUP,
      notifications: QUEUE_NAMES.NOTIFICATIONS,
    } as const;
    
    const queue = getQueue(queueMap[queueName]);
    if (!queue) throw new Error('Queue not found');

    await queue.pause();

    const actionResult: ActionResult = {
      success: true,
      message: `Cola "${queueName}" pausada`,
    };

    await logAction(ctx, 'PAUSE_QUEUE', 'cache', 'warning', queueName, actionResult, {}, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al pausar cola`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'PAUSE_QUEUE', 'cache', 'warning', queueName, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function resumeQueue(ctx: AdminContext, queueName: 'scheduled' | 'inactivity' | 'flow' | 'cleanup' | 'notifications'): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const queueMap = {
      scheduled: QUEUE_NAMES.SCHEDULED_MESSAGES,
      inactivity: QUEUE_NAMES.INACTIVITY,
      flow: QUEUE_NAMES.FLOW_EXECUTION,
      cleanup: QUEUE_NAMES.CLEANUP,
      notifications: QUEUE_NAMES.NOTIFICATIONS,
    } as const;
    
    const queue = getQueue(queueMap[queueName]);
    if (!queue) throw new Error('Queue not found');

    await queue.resume();

    const actionResult: ActionResult = {
      success: true,
      message: `Cola "${queueName}" reanudada`,
    };

    await logAction(ctx, 'RESUME_QUEUE', 'cache', 'info', queueName, actionResult, {}, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al reanudar cola`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'RESUME_QUEUE', 'cache', 'info', queueName, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function clearFailedJobs(ctx: AdminContext, queueName: 'scheduled' | 'inactivity' | 'flow' | 'cleanup' | 'notifications'): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const queueMap = {
      scheduled: QUEUE_NAMES.SCHEDULED_MESSAGES,
      inactivity: QUEUE_NAMES.INACTIVITY,
      flow: QUEUE_NAMES.FLOW_EXECUTION,
      cleanup: QUEUE_NAMES.CLEANUP,
      notifications: QUEUE_NAMES.NOTIFICATIONS,
    } as const;
    
    const queue = getQueue(queueMap[queueName]);
    if (!queue) throw new Error('Queue not found');

    const failed = await queue.getFailed();
    for (const job of failed) {
      await job.remove();
    }

    const actionResult: ActionResult = {
      success: true,
      message: `${failed.length} jobs fallidos eliminados de "${queueName}"`,
      affectedCount: failed.length,
    };

    await logAction(ctx, 'CLEAR_FAILED_JOBS', 'cache', 'warning', queueName, actionResult, {}, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al limpiar jobs fallidos`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'CLEAR_FAILED_JOBS', 'cache', 'warning', queueName, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

// ============= SESSION CONTROL =============

export async function forceLogoutAllUsers(ctx: AdminContext, confirmPhrase: string): Promise<ActionResult> {
  const startTime = Date.now();
  const lockKey = `force_logout_${ctx.adminId}`;
  
  if (!checkAndSetLock(lockKey)) {
    return { success: false, message: 'Acción bloqueada. Espera unos segundos.', error: 'rate_limited' };
  }

  if (confirmPhrase !== 'LOGOUT ALL USERS') {
    return { 
      success: false, 
      message: 'Frase de confirmación incorrecta. Esperado: "LOGOUT ALL USERS"',
      error: 'confirmation_failed'
    };
  }

  try {
    const io = getIO();
    if (!io) throw new Error('Socket.IO not available');

    const sockets = await io.fetchSockets();
    const count = sockets.length;

    io.emit('session:force_logout', { reason: 'Admin forzó cierre de sesión global' });

    setTimeout(async () => {
      const socketsToDisconnect = await io.fetchSockets();
      for (const s of socketsToDisconnect) {
        s.disconnect(true);
      }
    }, 1000);

    const redis = getRedisClient();
    if (redis) {
      const sessionKeys = await redis.keys('session:*');
      if (sessionKeys.length > 0) {
        await redis.del(...sessionKeys);
      }
    }

    agentSockets.clear();

    const actionResult: ActionResult = {
      success: true,
      message: `${count} sesiones cerradas forzosamente`,
      affectedCount: count,
    };

    await logAction(ctx, 'FORCE_LOGOUT_ALL', 'session', 'destructive', 'all_sessions', actionResult, {}, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al cerrar sesiones`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'FORCE_LOGOUT_ALL', 'session', 'destructive', 'all_sessions', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function forceLogoutByRole(ctx: AdminContext, role: 'agent' | 'supervisor' | 'admin'): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const agents = await Agent.find({ role }).select('_id');
    const agentIds = agents.map(a => a._id.toString());
    
    let disconnected = 0;
    for (const agentId of agentIds) {
      const socket = agentSockets.get(agentId);
      if (socket) {
        socket.emit('session:force_logout', { reason: `Admin cerró sesiones de rol ${role}` });
        setTimeout(() => socket.disconnect(true), 500);
        agentSockets.delete(agentId);
        disconnected++;
      }
    }

    const actionResult: ActionResult = {
      success: true,
      message: `${disconnected} sesiones de rol "${role}" cerradas`,
      affectedCount: disconnected,
    };

    await logAction(ctx, 'FORCE_LOGOUT_BY_ROLE', 'session', 'warning', role, actionResult, { role }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al cerrar sesiones`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'FORCE_LOGOUT_BY_ROLE', 'session', 'warning', role, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function blockUser(ctx: AdminContext, agentId: string, reason: string): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const agent = await Agent.findByIdAndUpdate(
      agentId,
      { 
        $set: { 
          isActive: false,
        }
      },
      { new: true }
    );

    if (!agent) {
      return { success: false, message: 'Usuario no encontrado', error: 'not_found' };
    }

    const socket = agentSockets.get(agentId);
    if (socket) {
      socket.emit('session:force_logout', { reason: `Tu cuenta ha sido desactivada: ${reason}` });
      setTimeout(() => socket.disconnect(true), 500);
      agentSockets.delete(agentId);
    }

    const actionResult: ActionResult = {
      success: true,
      message: `Usuario "${agent.name}" desactivado`,
    };

    await logAction(ctx, 'BLOCK_USER', 'session', 'warning', agentId, actionResult, { agentName: agent.name, reason }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al desactivar usuario`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'BLOCK_USER', 'session', 'warning', agentId, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function unblockUser(ctx: AdminContext, agentId: string): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const agent = await Agent.findByIdAndUpdate(
      agentId,
      { 
        $set: { isActive: true },
      },
      { new: true }
    );

    if (!agent) {
      return { success: false, message: 'Usuario no encontrado', error: 'not_found' };
    }

    const actionResult: ActionResult = {
      success: true,
      message: `Usuario "${agent.name}" reactivado`,
    };

    await logAction(ctx, 'UNBLOCK_USER', 'session', 'info', agentId, actionResult, { agentName: agent.name }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al reactivar usuario`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'UNBLOCK_USER', 'session', 'info', agentId, actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function getSessionStats(): Promise<{
  connectedAgents: number;
  byRole: Record<string, number>;
  agents: Array<{ id: string; name: string; email: string; role: string; connected: boolean; isActive?: boolean }>;
}> {
  const agents = await Agent.find({}).select('name email role isActive').lean();
  
  const connectedIds = new Set(agentSockets.keys());
  
  const byRole: Record<string, number> = {};
  for (const agent of agents) {
    if (connectedIds.has(agent._id.toString())) {
      byRole[agent.role] = (byRole[agent.role] || 0) + 1;
    }
  }

  return {
    connectedAgents: connectedIds.size,
    byRole,
    agents: agents.map(a => ({
      id: a._id.toString(),
      name: a.name,
      email: a.email,
      role: a.role,
      connected: connectedIds.has(a._id.toString()),
      isActive: a.isActive
    }))
  };
}

// ============= SYSTEM CONTROL =============

export async function getSystemStats(): Promise<{
  cpu: { usage: number; cores: number };
  memory: { total: string; used: string; free: string; usagePercent: number };
  uptime: string;
  nodeVersion: string;
  mongoConnected: boolean;
  redisConnected: boolean;
  websocketConnections: number;
}> {
  const cpus = os.cpus();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;

  const formatBytes = (bytes: number) => {
    if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    return `${(bytes / 1024).toFixed(2)} KB`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const cpuUsage = cpus.reduce((acc, cpu) => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
    const idle = cpu.times.idle;
    return acc + ((total - idle) / total) * 100;
  }, 0) / cpus.length;

  const io = getIO();
  const websocketConnections = io ? (await io.fetchSockets()).length : 0;

  const redis = getRedisClient();
  let redisConnected = false;
  try {
    if (redis) {
      await redis.ping();
      redisConnected = true;
    }
  } catch {
    redisConnected = false;
  }

  return {
    cpu: { usage: Math.round(cpuUsage), cores: cpus.length },
    memory: {
      total: formatBytes(totalMemory),
      used: formatBytes(usedMemory),
      free: formatBytes(freeMemory),
      usagePercent: Math.round((usedMemory / totalMemory) * 100)
    },
    uptime: formatUptime(os.uptime()),
    nodeVersion: process.version,
    mongoConnected: mongoose.connection.readyState === 1,
    redisConnected,
    websocketConnections
  };
}

export async function enableMaintenanceMode(ctx: AdminContext, message: string): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const redis = getRedisClient();
    if (!redis) throw new Error('Redis not connected');

    await redis.set('system:maintenance', JSON.stringify({
      enabled: true,
      message,
      enabledBy: ctx.adminName,
      enabledAt: new Date().toISOString()
    }));

    const io = getIO();
    if (io) {
      io.emit('system:maintenance_mode', { enabled: true, message });
    }

    const actionResult: ActionResult = {
      success: true,
      message: 'Modo mantenimiento activado',
    };

    await logAction(ctx, 'ENABLE_MAINTENANCE', 'system', 'critical', 'maintenance_mode', actionResult, { message }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al activar modo mantenimiento`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'ENABLE_MAINTENANCE', 'system', 'critical', 'maintenance_mode', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function disableMaintenanceMode(ctx: AdminContext): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    const redis = getRedisClient();
    if (!redis) throw new Error('Redis not connected');

    await redis.del('system:maintenance');

    const io = getIO();
    if (io) {
      io.emit('system:maintenance_mode', { enabled: false });
    }

    const actionResult: ActionResult = {
      success: true,
      message: 'Modo mantenimiento desactivado',
    };

    await logAction(ctx, 'DISABLE_MAINTENANCE', 'system', 'info', 'maintenance_mode', actionResult, {}, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al desactivar modo mantenimiento`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'DISABLE_MAINTENANCE', 'system', 'info', 'maintenance_mode', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

export async function getMaintenanceStatus(): Promise<{ enabled: boolean; message?: string; enabledBy?: string; enabledAt?: string }> {
  const redis = getRedisClient();
  if (!redis) return { enabled: false };

  const data = await redis.get('system:maintenance');
  if (!data) return { enabled: false };

  try {
    return JSON.parse(data);
  } catch {
    return { enabled: false };
  }
}

// ============= AUDIT LOGS =============

export async function getAuditLogs(
  filters: {
    adminId?: string;
    category?: string;
    severity?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
  },
  page: number = 1,
  limit: number = 50
): Promise<{ logs: IAdminAuditLog[]; total: number; pages: number }> {
  const query: Record<string, unknown> = {};

  if (filters.adminId) query.adminId = new mongoose.Types.ObjectId(filters.adminId);
  if (filters.category) query.category = filters.category;
  if (filters.severity) query.severity = filters.severity;
  if (filters.action) query.action = { $regex: filters.action, $options: 'i' };
  if (filters.startDate || filters.endDate) {
    query.createdAt = {};
    if (filters.startDate) (query.createdAt as Record<string, Date>).$gte = filters.startDate;
    if (filters.endDate) (query.createdAt as Record<string, Date>).$lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    AdminAuditLog.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AdminAuditLog.countDocuments(query)
  ]);

  return {
    logs: logs as unknown as IAdminAuditLog[],
    total,
    pages: Math.ceil(total / limit)
  };
}

export async function clearAuditLogs(ctx: AdminContext, olderThanDays: number, confirmPhrase: string): Promise<ActionResult> {
  const startTime = Date.now();

  if (confirmPhrase !== `CLEAR LOGS OLDER THAN ${olderThanDays} DAYS`) {
    return { 
      success: false, 
      message: `Frase de confirmación incorrecta`,
      error: 'confirmation_failed'
    };
  }

  try {
    const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await AdminAuditLog.deleteMany({ createdAt: { $lt: cutoffDate } });

    const actionResult: ActionResult = {
      success: true,
      message: `${result.deletedCount} logs eliminados (> ${olderThanDays} días)`,
      affectedCount: result.deletedCount,
    };

    await logAction(ctx, 'CLEAR_AUDIT_LOGS', 'logs', 'warning', 'audit_logs', actionResult, { olderThanDays }, Date.now() - startTime);
    return actionResult;
  } catch (error) {
    const actionResult: ActionResult = {
      success: false,
      message: `Error al limpiar logs`,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    await logAction(ctx, 'CLEAR_AUDIT_LOGS', 'logs', 'warning', 'audit_logs', actionResult, {}, Date.now() - startTime);
    return actionResult;
  }
}

// ============= CHAT STATS =============

export async function getChatStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byAgent: Array<{ agentId: string; agentName: string; count: number }>;
  orphan: number;
}> {
  const [statusStats, agentStats, orphanCount] = await Promise.all([
    ChatSession.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    ChatSession.aggregate([
      { $match: { assignedAgent: { $exists: true, $ne: null } } },
      { $group: { _id: '$assignedAgent', count: { $sum: 1 } } },
      { $lookup: { from: 'agents', localField: '_id', foreignField: '_id', as: 'agent' } },
      { $unwind: '$agent' },
      { $project: { agentId: '$_id', agentName: '$agent.name', count: 1 } }
    ]),
    ChatSession.countDocuments({
      $or: [
        { status: 'bot', updatedAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      ]
    })
  ]);

  const byStatus: Record<string, number> = {};
  for (const s of statusStats) {
    byStatus[s._id] = s.count;
  }

  return {
    total: Object.values(byStatus).reduce((a, b) => a + b, 0),
    byStatus,
    byAgent: agentStats.map(a => ({
      agentId: a.agentId.toString(),
      agentName: a.agentName,
      count: a.count
    })),
    orphan: orphanCount
  };
}

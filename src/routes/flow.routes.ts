/**
 * Flow Routes - API endpoints for flow management
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Types } from 'mongoose';
import {
  createFlow,
  getFlowById,
  getFlows,
  updateFlow,
  deleteFlow,
  duplicateFlow,
  publishFlow,
  unpublishFlow,
  getFlowVersions,
  rollbackFlow,
  validateFlow,
  getFlowExecutionStats,
  getOverallFlowStats,
} from '../services/flow.service.js';
import FlowExecution from '../database/models/FlowExecution.js';
import Flow from '../database/models/Flow.js';
import { flowEngine, TriggerEvent } from '../services/flowEngine.service.js';
import { logger } from '../services/logger.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { emitFlowUpdated } from '../services/socket.js';

// ============= TYPES =============

interface FlowParams {
  flowId: string;
}

interface VersionParams {
  flowId: string;
  version: string;
}

interface ExecutionParams {
  executionId: string;
}

// ============= ROUTES =============

export async function flowRoutes(fastify: FastifyInstance): Promise<void> {
  // Apply auth middleware to all routes
  fastify.addHook('preHandler', authMiddleware);

  // ============= FLOW CRUD =============

  // Create flow
  fastify.post('/flows', async (request: FastifyRequest, reply: FastifyReply) => {
    const agentId = (request as any).agent._id;
    const role = (request as any).agent.role;

    // Only admins and supervisors can create flows
    if (!['admin', 'supervisor'].includes(role)) {
      return reply.status(403).send({ ok: false, error: 'Permission denied' });
    }

    const body = request.body as {
      name: string;
      description?: string;
      nodes?: any[];
      edges?: any[];
      tags?: string[];
      priority?: number;
    };

    if (!body.name) {
      return reply.status(400).send({ ok: false, error: 'Name is required' });
    }

    try {
      const flow = await createFlow({
        name: body.name,
        description: body.description,
        nodes: body.nodes,
        edges: body.edges,
        tags: body.tags,
        priority: body.priority,
        createdBy: new Types.ObjectId(agentId),
      });

      return { ok: true, flow };
    } catch (error) {
      logger.error('api', { action: 'create_flow_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to create flow' });
    }
  });

  // Get all flows
  fastify.get('/flows', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      status?: string;
      enabled?: string;
      trigger?: string;
      tags?: string;
      search?: string;
      page?: string;
      limit?: string;
      sortBy?: string;
      sortOrder?: string;
    };

    try {
      const { flows, total } = await getFlows({
        status: query.status as any,
        enabled: query.enabled === 'true' ? true : query.enabled === 'false' ? false : undefined,
        trigger: query.trigger as any,
        tags: query.tags ? query.tags.split(',') : undefined,
        search: query.search,
        page: query.page ? parseInt(query.page) : undefined,
        limit: query.limit ? parseInt(query.limit) : undefined,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder as any,
      });

      return { 
        ok: true, 
        flows: flows.map(f => ({
          _id: f._id.toString(),
          name: f.name,
          description: f.description,
          status: f.status,
          enabled: f.enabled,
          triggers: f.triggers,
          executionCount: f.executionCount,
          errorCount: f.errorCount,
          lastExecutedAt: f.lastExecutedAt,
          tags: f.tags,
          priority: f.priority,
          currentVersion: f.currentVersion,
          createdBy: f.createdBy,
          updatedBy: f.updatedBy,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        })),
        total,
      };
    } catch (error) {
      logger.error('api', { action: 'get_flows_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get flows' });
    }
  });

  // Get single flow
  fastify.get<{ Params: FlowParams }>('/flows/:flowId', async (request, reply) => {
    try {
      const flow = await getFlowById(request.params.flowId);
      
      if (!flow) {
        return reply.status(404).send({ ok: false, error: 'Flow not found' });
      }

      return { ok: true, flow };
    } catch (error) {
      logger.error('api', { action: 'get_flow_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get flow' });
    }
  });

  // Update flow
  fastify.put<{ Params: FlowParams }>('/flows/:flowId', async (request, reply) => {
    const agentId = (request as any).agent._id;
    const role = (request as any).agent.role;

    if (!['admin', 'supervisor'].includes(role)) {
      return reply.status(403).send({ ok: false, error: 'Permission denied' });
    }

    const body = request.body as {
      name?: string;
      description?: string;
      nodes?: any[];
      edges?: any[];
      tags?: string[];
      priority?: number;
      enabled?: boolean;
      createVersion?: boolean;
    };

    try {
      const flow = await updateFlow(
        request.params.flowId,
        {
          ...body,
          updatedBy: new Types.ObjectId(agentId),
        },
        body.createVersion !== false
      );

      if (!flow) {
        return reply.status(404).send({ ok: false, error: 'Flow not found' });
      }

      return { ok: true, flow };
    } catch (error) {
      logger.error('api', { action: 'update_flow_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to update flow' });
    }
  });

  // Delete flow
  fastify.delete<{ Params: FlowParams }>('/flows/:flowId', async (request, reply) => {
    const role = (request as any).agent.role;

    if (role !== 'admin') {
      return reply.status(403).send({ ok: false, error: 'Only admins can delete flows' });
    }

    try {
      const deleted = await deleteFlow(request.params.flowId);

      if (!deleted) {
        return reply.status(404).send({ ok: false, error: 'Flow not found' });
      }

      // Emit socket event for hot-reload
      emitFlowUpdated(request.params.flowId, 'deleted');

      return { ok: true };
    } catch (error) {
      logger.error('api', { action: 'delete_flow_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to delete flow' });
    }
  });

  // Duplicate flow
  fastify.post<{ Params: FlowParams }>('/flows/:flowId/duplicate', async (request, reply) => {
    const agentId = (request as any).agent._id;
    const role = (request as any).agent.role;

    if (!['admin', 'supervisor'].includes(role)) {
      return reply.status(403).send({ ok: false, error: 'Permission denied' });
    }

    try {
      const flow = await duplicateFlow(
        request.params.flowId,
        new Types.ObjectId(agentId)
      );

      if (!flow) {
        return reply.status(404).send({ ok: false, error: 'Flow not found' });
      }

      return { ok: true, flow };
    } catch (error) {
      logger.error('api', { action: 'duplicate_flow_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to duplicate flow' });
    }
  });

  // ============= PUBLISHING =============

  // Publish flow
  fastify.post<{ Params: FlowParams }>('/flows/:flowId/publish', async (request, reply) => {
    const agentId = (request as any).agent._id;
    const role = (request as any).agent.role;

    if (role !== 'admin') {
      return reply.status(403).send({ ok: false, error: 'Only admins can publish flows' });
    }

    try {
      const result = await publishFlow(
        request.params.flowId,
        new Types.ObjectId(agentId)
      );

      if (!result.success) {
        return reply.status(400).send({ ok: false, error: result.error });
      }

      // Emit socket event for hot-reload
      emitFlowUpdated(
        request.params.flowId,
        'published',
        result.flow?.currentVersion,
        result.flow?.name
      );

      return { ok: true, flow: result.flow };
    } catch (error) {
      logger.error('api', { action: 'publish_flow_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to publish flow' });
    }
  });

  // Unpublish flow
  fastify.post<{ Params: FlowParams }>('/flows/:flowId/unpublish', async (request, reply) => {
    const agentId = (request as any).agent._id;
    const role = (request as any).agent.role;

    if (role !== 'admin') {
      return reply.status(403).send({ ok: false, error: 'Only admins can unpublish flows' });
    }

    try {
      const flow = await unpublishFlow(
        request.params.flowId,
        new Types.ObjectId(agentId)
      );

      if (!flow) {
        return reply.status(404).send({ ok: false, error: 'Flow not found' });
      }

      // Emit socket event for hot-reload
      emitFlowUpdated(
        request.params.flowId,
        'unpublished',
        flow.currentVersion,
        flow.name
      );

      return { ok: true, flow };
    } catch (error) {
      logger.error('api', { action: 'unpublish_flow_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to unpublish flow' });
    }
  });

  // ============= VALIDATION =============

  // Validate flow
  fastify.post<{ Params: FlowParams }>('/flows/:flowId/validate', async (request, reply) => {
    try {
      const flow = await getFlowById(request.params.flowId);

      if (!flow) {
        return reply.status(404).send({ ok: false, error: 'Flow not found' });
      }

      const validation = validateFlow(flow);

      return { ok: true, validation };
    } catch (error) {
      logger.error('api', { action: 'validate_flow_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to validate flow' });
    }
  });

  // ============= VERSIONING =============

  // Get versions
  fastify.get<{ Params: FlowParams }>('/flows/:flowId/versions', async (request, reply) => {
    try {
      const versions = await getFlowVersions(request.params.flowId);

      if (!versions) {
        return reply.status(404).send({ ok: false, error: 'Flow not found' });
      }

      return { ok: true, ...versions };
    } catch (error) {
      logger.error('api', { action: 'get_versions_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get versions' });
    }
  });

  // Rollback to version
  fastify.post<{ Params: VersionParams }>('/flows/:flowId/rollback/:version', async (request, reply) => {
    const agentId = (request as any).agent._id;
    const role = (request as any).agent.role;

    if (!['admin', 'supervisor'].includes(role)) {
      return reply.status(403).send({ ok: false, error: 'Permission denied' });
    }

    try {
      const result = await rollbackFlow(
        request.params.flowId,
        parseInt(request.params.version),
        new Types.ObjectId(agentId)
      );

      if (!result.success) {
        return reply.status(400).send({ ok: false, error: result.error });
      }

      return { ok: true, flow: result.flow };
    } catch (error) {
      logger.error('api', { action: 'rollback_flow_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to rollback flow' });
    }
  });

  // ============= EXECUTIONS =============

  // Get all executions (with filters)
  fastify.get('/flows/executions', async (request, reply) => {
    const query = request.query as {
      flowId?: string;
      sessionId?: string;
      status?: string;
      page?: string;
      limit?: string;
    };

    try {
      const filter: any = {};
      
      if (query.flowId) {
        filter.flowId = new Types.ObjectId(query.flowId);
      }
      if (query.sessionId) {
        filter.sessionId = query.sessionId;
      }
      if (query.status) {
        filter.status = query.status;
      }

      const page = query.page ? parseInt(query.page) : 1;
      const limit = Math.min(query.limit ? parseInt(query.limit) : 50, 100);

      const [executions, total] = await Promise.all([
        FlowExecution.find(filter)
          .sort({ startedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('flowId', 'name'),
        FlowExecution.countDocuments(filter),
      ]);

      // Transform the data to include flowName
      const formattedExecutions = executions.map(exec => {
        const execObj = exec.toObject();
        return {
          ...execObj,
          flowName: (execObj.flowId as any)?.name || 'Unknown Flow',
          flowId: (execObj.flowId as any)?._id || execObj.flowId,
        };
      });

      return { 
        ok: true, 
        executions: formattedExecutions, 
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('api', { action: 'get_all_executions_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get executions' });
    }
  });

  // Get flow executions
  fastify.get<{ Params: FlowParams }>('/flows/:flowId/executions', async (request, reply) => {
    const query = request.query as {
      status?: string;
      page?: string;
      limit?: string;
    };

    try {
      const filter: any = { flowId: new Types.ObjectId(request.params.flowId) };
      
      if (query.status) {
        filter.status = query.status;
      }

      const page = query.page ? parseInt(query.page) : 1;
      const limit = query.limit ? parseInt(query.limit) : 20;

      const [executions, total] = await Promise.all([
        FlowExecution.find(filter)
          .sort({ startedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit),
        FlowExecution.countDocuments(filter),
      ]);

      return { ok: true, executions, total };
    } catch (error) {
      logger.error('api', { action: 'get_executions_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get executions' });
    }
  });

  // Get execution details
  fastify.get<{ Params: ExecutionParams }>('/flows/executions/:executionId', async (request, reply) => {
    try {
      const execution = await FlowExecution.findById(request.params.executionId);

      if (!execution) {
        return reply.status(404).send({ ok: false, error: 'Execution not found' });
      }

      return { ok: true, execution };
    } catch (error) {
      logger.error('api', { action: 'get_execution_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get execution' });
    }
  });

  // Cancel execution
  fastify.post<{ Params: ExecutionParams }>('/flows/executions/:executionId/cancel', async (request, reply) => {
    try {
      const execution = await FlowExecution.findById(request.params.executionId);

      if (!execution) {
        return reply.status(404).send({ ok: false, error: 'Execution not found' });
      }

      if (!['pending', 'running', 'paused'].includes(execution.status)) {
        return reply.status(400).send({ ok: false, error: 'Execution cannot be cancelled' });
      }

      execution.cancel('Cancelled by user');
      await execution.save();

      return { ok: true, execution };
    } catch (error) {
      logger.error('api', { action: 'cancel_execution_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to cancel execution' });
    }
  });

  // ============= STATISTICS =============

  // Get flow stats
  fastify.get<{ Params: FlowParams }>('/flows/:flowId/stats', async (request, reply) => {
    try {
      const stats = await getFlowExecutionStats(request.params.flowId);
      return { ok: true, stats };
    } catch (error) {
      logger.error('api', { action: 'get_flow_stats_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get stats' });
    }
  });

  // Get overall stats
  fastify.get('/flows/stats/overview', async (request, reply) => {
    try {
      const stats = await getOverallFlowStats();
      return { ok: true, stats };
    } catch (error) {
      logger.error('api', { action: 'get_overall_stats_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to get stats' });
    }
  });

  // ============= SIMULATION =============

  // Simulate flow execution (dry run)
  fastify.post<{ Params: FlowParams }>('/flows/:flowId/simulate', async (request, reply) => {
    const body = request.body as {
      triggerType: string;
      context?: {
        triggerData?: Record<string, any>;
        sessionId?: string;
        chatId?: number;
        userId?: number;
        user?: {
          firstName?: string;
          lastName?: string;
          username?: string;
          language?: string;
        };
        message?: {
          content?: string;
          type?: string;
        };
        variables?: Record<string, any>;
      };
    };

    try {
      const flow = await getFlowById(request.params.flowId);

      if (!flow) {
        return reply.status(404).send({ ok: false, error: 'Flow not found' });
      }

      // Validate flow first
      const validation = validateFlow(flow);
      
      // Build simulation context
      const simulationContext = {
        triggerType: body.triggerType as any,
        triggerData: body.context?.triggerData || {},
        sessionId: body.context?.sessionId,
        chatId: body.context?.chatId,
        userId: body.context?.userId,
        user: body.context?.user ? {
          id: body.context.userId || 123456789,
          firstName: body.context.user.firstName || 'Test',
          lastName: body.context.user.lastName,
          username: body.context.user.username,
          language: body.context.user.language || 'es',
        } : undefined,
        message: body.context?.message ? {
          id: 'sim_msg_001',
          content: body.context.message.content || '',
          type: body.context.message.type || 'text',
        } : undefined,
        variables: body.context?.variables || {},
      };

      // Run simulation
      const simulation = await flowEngine.simulateFlow(flow, simulationContext);

      return { 
        ok: true, 
        simulation: {
          flow: { 
            id: flow._id.toString(), 
            name: flow.name,
            version: flow.currentVersion,
          },
          triggerType: body.triggerType,
          validation,
          ...simulation,
        },
      };
    } catch (error) {
      logger.error('api', { action: 'simulate_flow_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: 'Failed to simulate flow' });
    }
  });

  // ============= API CALL TESTING =============

  // Test API call from playground
  fastify.post('/flows/test-api-call', async (request, reply) => {
    const body = request.body as {
      method: string;
      url: string;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    };

    if (!body.url) {
      return reply.status(400).send({ ok: false, error: 'URL is required' });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), body.timeout || 30000);

      const fetchOptions: RequestInit = {
        method: body.method || 'GET',
        headers: body.headers || {},
        signal: controller.signal,
      };

      // Add body for non-GET requests
      if (body.body && body.method !== 'GET') {
        fetchOptions.body = body.body;
      }

      const startTime = Date.now();
      const response = await fetch(body.url, fetchOptions);
      clearTimeout(timeoutId);

      // Read response body
      let responseBody: any;
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      // Get response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        ok: true,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        time: Date.now() - startTime,
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return reply.status(408).send({ ok: false, error: 'Request timeout' });
      }
      logger.error('api', { action: 'test_api_call_error', error: String(error) });
      return reply.status(500).send({ ok: false, error: error.message || 'Request failed' });
    }
  });

  // ============= TRIGGERS =============

  // Get available triggers
  fastify.get('/flows/triggers', async () => {
    return {
      ok: true,
      triggers: [
        { type: 'chat_created', label: 'Chat Created', description: 'When a new chat session starts' },
        { type: 'message_received', label: 'Message Received', description: 'When a message is received from user' },
        { type: 'chat_assigned', label: 'Chat Assigned', description: 'When chat is assigned to an agent' },
        { type: 'chat_closed', label: 'Chat Closed', description: 'When a chat session is closed' },
        { type: 'user_inactive', label: 'User Inactive', description: 'When user has been inactive for X minutes' },
        { type: 'survey_answered', label: 'Survey Answered', description: 'When user answers a satisfaction survey' },
        { type: 'category_changed', label: 'Category Changed', description: 'When chat category is changed' },
        { type: 'tag_added', label: 'Tag Added', description: 'When a tag is added to the chat' },
        { type: 'file_received', label: 'File Received', description: 'When user sends a file/image/audio' },
        { type: 'keyword_detected', label: 'Keyword Detected', description: 'When specific keyword is detected in message' },
        { type: 'chat_reopened', label: 'Chat Reopened', description: 'When a closed chat is reopened' },
        { type: 'agent_online', label: 'Agent Online', description: 'When an agent comes online' },
        { type: 'sla_warning', label: 'SLA Warning', description: 'When SLA is about to be breached' },
      ],
    };
  });

  // Get available actions
  fastify.get('/flows/actions', async () => {
    return {
      ok: true,
      actions: [
        { type: 'send_message', label: 'Send Message', description: 'Send a text message to user' },
        { type: 'schedule_message', label: 'Schedule Message', description: 'Schedule a message for later' },
        { type: 'transfer_chat', label: 'Transfer Chat', description: 'Transfer chat to another agent' },
        { type: 'assign_agent', label: 'Assign Agent', description: 'Assign chat to specific agent' },
        { type: 'change_category', label: 'Change Category', description: 'Change chat category' },
        { type: 'add_tag', label: 'Add Tag', description: 'Add a tag to the chat' },
        { type: 'remove_tag', label: 'Remove Tag', description: 'Remove a tag from the chat' },
        { type: 'create_note', label: 'Create Note', description: 'Add internal note to chat' },
        { type: 'block_user', label: 'Block User', description: 'Block the user' },
        { type: 'call_webhook', label: 'Call Webhook', description: 'Make HTTP request to external service' },
        { type: 'set_custom_field', label: 'Set Custom Field', description: 'Set a custom variable' },
        { type: 'close_chat', label: 'Close Chat', description: 'Close the chat session' },
        { type: 'send_survey', label: 'Send Survey', description: 'Send satisfaction survey' },
        { type: 'add_to_queue', label: 'Add to Queue', description: 'Add chat to agent queue' },
      ],
    };
  });

  // Get condition operators
  fastify.get('/flows/operators', async () => {
    return {
      ok: true,
      operators: [
        { value: 'equals', label: 'Equals', types: ['string', 'number'] },
        { value: 'not_equals', label: 'Not Equals', types: ['string', 'number'] },
        { value: 'contains', label: 'Contains', types: ['string'] },
        { value: 'not_contains', label: 'Does Not Contain', types: ['string'] },
        { value: 'regex', label: 'Matches Regex', types: ['string'] },
        { value: 'greater_than', label: 'Greater Than', types: ['number'] },
        { value: 'less_than', label: 'Less Than', types: ['number'] },
        { value: 'greater_or_equal', label: 'Greater or Equal', types: ['number'] },
        { value: 'less_or_equal', label: 'Less or Equal', types: ['number'] },
        { value: 'exists', label: 'Exists', types: ['any'] },
        { value: 'not_exists', label: 'Does Not Exist', types: ['any'] },
        { value: 'is_empty', label: 'Is Empty', types: ['string', 'array'] },
        { value: 'is_not_empty', label: 'Is Not Empty', types: ['string', 'array'] },
        { value: 'starts_with', label: 'Starts With', types: ['string'] },
        { value: 'ends_with', label: 'Ends With', types: ['string'] },
      ],
    };
  });

  // Get available fields for conditions
  fastify.get('/flows/fields', async () => {
    return {
      ok: true,
      fields: [
        // User fields
        { path: 'user.firstName', label: 'User First Name', type: 'string' },
        { path: 'user.lastName', label: 'User Last Name', type: 'string' },
        { path: 'user.username', label: 'User Username', type: 'string' },
        { path: 'user.language', label: 'User Language', type: 'string' },
        { path: 'user.id', label: 'User ID', type: 'number' },
        // Message fields
        { path: 'message.content', label: 'Message Content', type: 'string' },
        { path: 'message.type', label: 'Message Type', type: 'string' },
        // Agent fields
        { path: 'agent.name', label: 'Agent Name', type: 'string' },
        { path: 'agent.id', label: 'Agent ID', type: 'string' },
        // Trigger data
        { path: 'triggerData.rating', label: 'Survey Rating', type: 'number' },
        { path: 'triggerData.category', label: 'Category', type: 'string' },
        { path: 'triggerData.tag', label: 'Tag', type: 'string' },
        { path: 'triggerData.fileType', label: 'File Type', type: 'string' },
        // Variables
        { path: 'variables', label: 'Custom Variables', type: 'object' },
      ],
    };
  });
}

export default flowRoutes;

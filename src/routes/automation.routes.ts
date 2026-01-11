/**
 * Automation Routes - Manage automation and routing rules
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Types } from 'mongoose';
import { AutomationRule, type IAutomationRule } from '../database/models/AutomationRule.js';
import { RoutingRule, type IRoutingRule } from '../database/models/RoutingRule.js';
import { RuleExecution } from '../database/models/RuleExecution.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { logAuditFromRequest, AuditActions } from '../services/audit-log.service.js';

interface RuleParams {
  ruleId: string;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
}

export async function automationRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  // ============================================================================
  // Automation Rules
  // ============================================================================

  /**
   * GET /api/automation/rules
   * List all automation rules
   */
  fastify.get<{ Querystring: PaginationQuery }>(
    '/rules',
    async (request: FastifyRequest<{ Querystring: PaginationQuery }>, reply: FastifyReply) => {
      try {
        const { page = 1, limit = 50 } = request.query;
        const skip = (page - 1) * limit;

        const [rules, total] = await Promise.all([
          AutomationRule.find()
            .sort({ priority: 1, createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('createdBy', 'name')
            .lean(),
          AutomationRule.countDocuments(),
        ]);

        return {
          success: true,
          data: rules,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get rules',
        });
      }
    }
  );

  /**
   * GET /api/automation/rules/:ruleId
   * Get a specific automation rule
   */
  fastify.get<{ Params: RuleParams }>(
    '/rules/:ruleId',
    async (request: FastifyRequest<{ Params: RuleParams }>, reply: FastifyReply) => {
      try {
        const { ruleId } = request.params;

        const rule = await AutomationRule.findById(ruleId)
          .populate('createdBy', 'name email')
          .populate('updatedBy', 'name email')
          .lean();

        if (!rule) {
          return reply.status(404).send({
            success: false,
            error: 'Rule not found',
          });
        }

        return { success: true, data: rule };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get rule',
        });
      }
    }
  );

  /**
   * POST /api/automation/rules
   * Create a new automation rule (admin only)
   */
  fastify.post<{ Body: Partial<IAutomationRule> }>(
    '/rules',
    { preHandler: requireRole(['admin']) },
    async (request: FastifyRequest<{ Body: Partial<IAutomationRule> }>, reply: FastifyReply) => {
      try {
        const agent = (request as any).agent;
        const { name, description, trigger, conditions, conditionLogic, actions, limits, priority } = request.body;

        if (!name || !trigger || !actions?.length) {
          return reply.status(400).send({
            success: false,
            error: 'name, trigger, and actions are required',
          });
        }

        const rule = await AutomationRule.create({
          name,
          description,
          isActive: true,
          priority: priority || 100,
          trigger,
          conditions: conditions || [],
          conditionLogic: conditionLogic || 'AND',
          actions,
          limits: limits || {},
          executionCount: 0,
          failureCount: 0,
          createdBy: agent._id,
        });

        // Audit log
        await logAuditFromRequest({
          request,
          action: AuditActions.RULE_CREATE,
          category: 'rule',
          targetType: 'rule',
          targetId: rule._id.toString(),
          targetDescription: rule.name,
          newValue: { name, trigger, actions: actions.length },
          severity: 'medium',
        });

        return reply.status(201).send({
          success: true,
          data: rule,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create rule',
        });
      }
    }
  );

  /**
   * PUT /api/automation/rules/:ruleId
   * Update an automation rule (admin only)
   */
  fastify.put<{ Params: RuleParams; Body: Partial<IAutomationRule> }>(
    '/rules/:ruleId',
    { preHandler: requireRole(['admin']) },
    async (
      request: FastifyRequest<{ Params: RuleParams; Body: Partial<IAutomationRule> }>,
      reply: FastifyReply
    ) => {
      try {
        const { ruleId } = request.params;
        const agent = (request as any).agent;
        const updates = request.body;

        const existingRule = await AutomationRule.findById(ruleId).lean();
        if (!existingRule) {
          return reply.status(404).send({
            success: false,
            error: 'Rule not found',
          });
        }

        const rule = await AutomationRule.findByIdAndUpdate(
          ruleId,
          {
            ...updates,
            updatedBy: agent._id,
          },
          { new: true }
        );

        // Audit log
        await logAuditFromRequest({
          request,
          action: AuditActions.RULE_UPDATE,
          category: 'rule',
          targetType: 'rule',
          targetId: ruleId,
          targetDescription: existingRule.name,
          previousValue: { name: existingRule.name, isActive: existingRule.isActive },
          newValue: { name: updates.name || existingRule.name, isActive: updates.isActive ?? existingRule.isActive },
          severity: 'medium',
        });

        return { success: true, data: rule };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update rule',
        });
      }
    }
  );

  /**
   * DELETE /api/automation/rules/:ruleId
   * Delete an automation rule (admin only)
   */
  fastify.delete<{ Params: RuleParams }>(
    '/rules/:ruleId',
    { preHandler: requireRole(['admin']) },
    async (request: FastifyRequest<{ Params: RuleParams }>, reply: FastifyReply) => {
      try {
        const { ruleId } = request.params;

        const rule = await AutomationRule.findByIdAndDelete(ruleId);
        if (!rule) {
          return reply.status(404).send({
            success: false,
            error: 'Rule not found',
          });
        }

        // Audit log
        await logAuditFromRequest({
          request,
          action: AuditActions.RULE_DELETE,
          category: 'rule',
          targetType: 'rule',
          targetId: ruleId,
          targetDescription: rule.name,
          previousValue: { name: rule.name },
          severity: 'high',
        });

        return { success: true, message: 'Rule deleted' };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete rule',
        });
      }
    }
  );

  /**
   * POST /api/automation/rules/:ruleId/toggle
   * Toggle a rule active/inactive (admin only)
   */
  fastify.post<{ Params: RuleParams }>(
    '/rules/:ruleId/toggle',
    { preHandler: requireRole(['admin']) },
    async (request: FastifyRequest<{ Params: RuleParams }>, reply: FastifyReply) => {
      try {
        const { ruleId } = request.params;
        const agent = (request as any).agent;

        const existingRule = await AutomationRule.findById(ruleId);
        if (!existingRule) {
          return reply.status(404).send({
            success: false,
            error: 'Rule not found',
          });
        }

        const newIsActive = !existingRule.isActive;
        const rule = await AutomationRule.findByIdAndUpdate(
          ruleId,
          {
            isActive: newIsActive,
            updatedBy: agent._id,
          },
          { new: true }
        );

        // Audit log
        await logAuditFromRequest({
          request,
          action: AuditActions.RULE_TOGGLE,
          category: 'rule',
          targetType: 'rule',
          targetId: ruleId,
          targetDescription: existingRule.name,
          previousValue: { isActive: existingRule.isActive },
          newValue: { isActive: newIsActive },
          severity: 'low',
        });

        return {
          success: true,
          data: rule,
          message: `Rule ${newIsActive ? 'activated' : 'deactivated'}`,
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to toggle rule',
        });
      }
    }
  );

  /**
   * GET /api/automation/rules/:ruleId/executions
   * Get execution history for a rule
   */
  fastify.get<{ Params: RuleParams; Querystring: PaginationQuery }>(
    '/rules/:ruleId/executions',
    async (
      request: FastifyRequest<{ Params: RuleParams; Querystring: PaginationQuery }>,
      reply: FastifyReply
    ) => {
      try {
        const { ruleId } = request.params;
        const { page = 1, limit = 50 } = request.query;
        const skip = (page - 1) * limit;

        const [executions, total] = await Promise.all([
          RuleExecution.find({ ruleId: new Types.ObjectId(ruleId) })
            .sort({ executedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          RuleExecution.countDocuments({ ruleId: new Types.ObjectId(ruleId) }),
        ]);

        return {
          success: true,
          data: executions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get executions',
        });
      }
    }
  );

  // ============================================================================
  // Routing Rules
  // ============================================================================

  /**
   * GET /api/automation/routing
   * List all routing rules
   */
  fastify.get('/routing', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rules = await RoutingRule.find()
        .sort({ priority: 1 })
        .populate('createdBy', 'name')
        .lean();

      return { success: true, data: rules };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get routing rules',
      });
    }
  });

  /**
   * POST /api/automation/routing
   * Create a new routing rule (admin only)
   */
  fastify.post<{ Body: Partial<IRoutingRule> }>(
    '/routing',
    { preHandler: requireRole(['admin']) },
    async (request: FastifyRequest<{ Body: Partial<IRoutingRule> }>, reply: FastifyReply) => {
      try {
        const agent = (request as any).agent;
        const { name, description, conditions, conditionLogic, action, scoring, priority } = request.body;

        if (!name || !conditions?.length || !action) {
          return reply.status(400).send({
            success: false,
            error: 'name, conditions, and action are required',
          });
        }

        const rule = await RoutingRule.create({
          name,
          description,
          isActive: true,
          priority: priority || 100,
          conditions,
          conditionLogic: conditionLogic || 'AND',
          action,
          scoring,
          matchCount: 0,
          createdBy: agent._id,
        });

        return reply.status(201).send({
          success: true,
          data: rule,
        });
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create routing rule',
        });
      }
    }
  );

  /**
   * PUT /api/automation/routing/:ruleId
   * Update a routing rule (admin only)
   */
  fastify.put<{ Params: RuleParams; Body: Partial<IRoutingRule> }>(
    '/routing/:ruleId',
    { preHandler: requireRole(['admin']) },
    async (
      request: FastifyRequest<{ Params: RuleParams; Body: Partial<IRoutingRule> }>,
      reply: FastifyReply
    ) => {
      try {
        const { ruleId } = request.params;
        const agent = (request as any).agent;
        const updates = request.body;

        const rule = await RoutingRule.findByIdAndUpdate(
          ruleId,
          {
            ...updates,
            updatedBy: agent._id,
          },
          { new: true }
        );

        if (!rule) {
          return reply.status(404).send({
            success: false,
            error: 'Routing rule not found',
          });
        }

        return { success: true, data: rule };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update routing rule',
        });
      }
    }
  );

  /**
   * DELETE /api/automation/routing/:ruleId
   * Delete a routing rule (admin only)
   */
  fastify.delete<{ Params: RuleParams }>(
    '/routing/:ruleId',
    { preHandler: requireRole(['admin']) },
    async (request: FastifyRequest<{ Params: RuleParams }>, reply: FastifyReply) => {
      try {
        const { ruleId } = request.params;

        const rule = await RoutingRule.findByIdAndDelete(ruleId);
        if (!rule) {
          return reply.status(404).send({
            success: false,
            error: 'Routing rule not found',
          });
        }

        return { success: true, message: 'Routing rule deleted' };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete routing rule',
        });
      }
    }
  );
}

export default automationRoutes;

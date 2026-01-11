/**
 * Survey Routes
 * API endpoints for post-chat satisfaction survey statistics
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getSurveyStats, type SurveyStatsFilters } from '../services/survey.service.js';
import { ChatSession } from '../database/models/ChatSession.js';
import { Agent } from '../database/models/Agent.js';

interface SurveyStatsQuery {
  startDate?: string;
  endDate?: string;
  agentId?: string;
}

export async function surveyRoutes(fastify: FastifyInstance): Promise<void> {
  // Get survey statistics
  fastify.get('/stats', async (request: FastifyRequest<{ Querystring: SurveyStatsQuery }>, reply: FastifyReply) => {
    try {
      const { startDate, endDate, agentId } = request.query;
      
      const filters: SurveyStatsFilters = {};
      
      if (startDate) {
        filters.startDate = new Date(startDate);
      }
      if (endDate) {
        filters.endDate = new Date(endDate);
      }
      if (agentId) {
        filters.agentId = agentId;
      }
      
      const stats = await getSurveyStats(filters);
      
      return reply.send({
        success: true,
        data: stats,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      fastify.log.error(`Error getting survey stats: ${error}`);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch survey statistics',
      });
    }
  });
  
  // Get recent survey responses
  fastify.get('/responses', async (request: FastifyRequest<{ Querystring: SurveyStatsQuery & { limit?: string } }>, reply: FastifyReply) => {
    try {
      const { startDate, endDate, agentId, limit = '50' } = request.query;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: any = {
        'postChatSurvey.answered': true,
      };
      
      if (startDate || endDate) {
        query['postChatSurvey.answer.answeredAt'] = {};
        if (startDate) {
          query['postChatSurvey.answer.answeredAt'].$gte = new Date(startDate);
        }
        if (endDate) {
          query['postChatSurvey.answer.answeredAt'].$lte = new Date(endDate);
        }
      }
      
      if (agentId) {
        query.assignedAgent = agentId;
      }
      
      const responses = await ChatSession.find(query)
        .select({
          sessionId: 1,
          user: 1,
          assignedAgent: 1,
          'postChatSurvey.answer': 1,
          satisfaction: 1,
          closedAt: 1,
        })
        .populate('user', 'username firstName lastName')
        .populate('assignedAgent', 'name email avatar')
        .sort({ 'postChatSurvey.answer.answeredAt': -1 })
        .limit(parseInt(limit, 10))
        .lean()
        .exec();
      
      return reply.send({
        success: true,
        data: responses,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      fastify.log.error(`Error getting survey responses: ${error}`);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch survey responses',
      });
    }
  });
  
  // Get agent satisfaction rankings
  fastify.get('/rankings', async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
    try {
      const { limit = '10' } = request.query;
      
      const agents = await Agent.find({
        'metrics.totalRatings': { $gt: 0 },
      })
        .select({
          name: 1,
          email: 1,
          avatar: 1,
          metrics: 1,
        })
        .sort({ 'metrics.averageRating': -1 })
        .limit(parseInt(limit, 10))
        .lean()
        .exec();
      
      const rankings = agents.map((agent, index) => ({
        rank: index + 1,
        agent: {
          id: agent._id,
          name: agent.name,
          email: agent.email,
          avatar: agent.avatar,
        },
        metrics: agent.metrics || {
          averageRating: 0,
          totalRatings: 0,
          satisfactionPositive: 0,
          satisfactionNeutral: 0,
          satisfactionNegative: 0,
        },
      }));
      
      return reply.send({
        success: true,
        data: rankings,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      fastify.log.error(`Error getting agent rankings: ${error}`);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch agent rankings',
      });
    }
  });
  
  // Get survey details for a specific session
  fastify.get('/session/:sessionId', async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    try {
      const { sessionId } = request.params;
      
      const session = await ChatSession.findOne({ sessionId })
        .select({
          sessionId: 1,
          user: 1,
          assignedAgent: 1,
          postChatSurvey: 1,
          satisfaction: 1,
          closedAt: 1,
        })
        .populate('user', 'username firstName lastName')
        .populate('assignedAgent', 'name email avatar')
        .lean()
        .exec();
      
      if (!session) {
        return reply.status(404).send({
          success: false,
          error: 'Session not found',
        });
      }
      
      return reply.send({
        success: true,
        data: {
          sessionId: session.sessionId,
          user: session.user,
          agent: session.assignedAgent,
          survey: session.postChatSurvey || null,
          satisfaction: session.satisfaction || null,
          closedAt: session.closedAt,
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      fastify.log.error(`Error getting session survey: ${error}`);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch session survey',
      });
    }
  });
  
  // Get pending surveys (sent but not answered, within open period)
  fastify.get('/pending', async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      
      const pending = await ChatSession.find({
        'postChatSurvey.sent': true,
        'postChatSurvey.answered': false,
        'postChatSurvey.failed': { $ne: true },
        'postChatSurvey.sentAt': { $gte: tenMinutesAgo },
      })
        .select({
          sessionId: 1,
          user: 1,
          assignedAgent: 1,
          'postChatSurvey.pollId': 1,
          'postChatSurvey.sentAt': 1,
        })
        .populate('user', 'username firstName')
        .populate('assignedAgent', 'name')
        .lean()
        .exec();
      
      return reply.send({
        success: true,
        data: pending,
        count: pending.length,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      fastify.log.error(`Error getting pending surveys: ${error}`);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch pending surveys',
      });
    }
  });
}

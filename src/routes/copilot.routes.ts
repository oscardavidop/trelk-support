/**
 * Copilot Routes - AI-powered suggestions for agents
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  summarizeSession,
  suggestResponse,
  categorizeSession,
  checkCloseReady,
  getSentiment,
  recordFeedback,
  getLatestSuggestions,
  getCopilotAnalytics,
} from '../services/copilot.service.js';
import { authMiddleware } from '../middleware/auth.js';
import { SuggestionType } from '../database/models/CopilotSuggestion.js';

interface SessionParams {
  sessionId: string;
}

interface SuggestionParams {
  suggestionId: string;
}

interface FeedbackBody {
  feedback: 'helpful' | 'notHelpful' | 'wrong' | 'inappropriate';
  comment?: string;
  modifiedContent?: string;
}

interface AnalyticsQuery {
  dateFrom?: string;
  dateTo?: string;
}

export async function copilotRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  /**
   * POST /api/copilot/summarize/:sessionId
   * Generate a conversation summary
   */
  fastify.post<{ Params: SessionParams }>(
    '/summarize/:sessionId',
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;
        const agent = (request as any).agent;

        const suggestion = await summarizeSession(sessionId, agent._id);
        return {
          success: true,
          data: {
            id: suggestion._id.toString(),
            type: suggestion.type,
            summary: suggestion.content.summary,
            keyPoints: suggestion.content.keyPoints,
            generationTimeMs: suggestion.generationTimeMs,
          },
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate summary',
        });
      }
    }
  );

  /**
   * POST /api/copilot/suggest-response/:sessionId
   * Get a suggested response
   */
  fastify.post<{ Params: SessionParams }>(
    '/suggest-response/:sessionId',
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;
        const agent = (request as any).agent;

        const suggestion = await suggestResponse(sessionId, agent._id);
        return {
          success: true,
          data: {
            id: suggestion._id.toString(),
            type: suggestion.type,
            suggestedResponse: suggestion.content.suggestedResponse,
            tone: suggestion.content.tone,
            generationTimeMs: suggestion.generationTimeMs,
          },
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate response suggestion',
        });
      }
    }
  );

  /**
   * POST /api/copilot/categorize/:sessionId
   * Get category suggestions
   */
  fastify.post<{ Params: SessionParams }>(
    '/categorize/:sessionId',
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;
        const agent = (request as any).agent;

        const suggestion = await categorizeSession(sessionId, agent._id);
        return {
          success: true,
          data: {
            id: suggestion._id.toString(),
            type: suggestion.type,
            categories: suggestion.content.categories,
            generationTimeMs: suggestion.generationTimeMs,
          },
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to categorize session',
        });
      }
    }
  );

  /**
   * POST /api/copilot/close-readiness/:sessionId
   * Check if session is ready to close
   */
  fastify.post<{ Params: SessionParams }>(
    '/close-readiness/:sessionId',
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;
        const agent = (request as any).agent;

        const suggestion = await checkCloseReady(sessionId, agent._id);
        return {
          success: true,
          data: {
            id: suggestion._id.toString(),
            type: suggestion.type,
            readyToClose: suggestion.content.readyToClose,
            indicators: suggestion.content.indicators,
            generationTimeMs: suggestion.generationTimeMs,
          },
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to check close readiness',
        });
      }
    }
  );

  /**
   * POST /api/copilot/sentiment/:sessionId
   * Get sentiment analysis
   */
  fastify.post<{ Params: SessionParams }>(
    '/sentiment/:sessionId',
    async (request: FastifyRequest<{ Params: SessionParams }>, reply: FastifyReply) => {
      try {
        const { sessionId } = request.params;
        const agent = (request as any).agent;

        const suggestion = await getSentiment(sessionId, agent._id);
        return {
          success: true,
          data: {
            id: suggestion._id.toString(),
            type: suggestion.type,
            sentiment: suggestion.content.sentiment,
            sentimentScore: suggestion.content.sentimentScore,
            generationTimeMs: suggestion.generationTimeMs,
          },
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to analyze sentiment',
        });
      }
    }
  );

  /**
   * GET /api/copilot/suggestions/:sessionId
   * Get latest suggestions for a session
   */
  fastify.get<{ Params: SessionParams; Querystring: { types?: string } }>(
    '/suggestions/:sessionId',
    async (
      request: FastifyRequest<{ Params: SessionParams; Querystring: { types?: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { sessionId } = request.params;
        const types = request.query.types?.split(',') as SuggestionType[] | undefined;

        const suggestions = await getLatestSuggestions(sessionId, types);
        return {
          success: true,
          data: suggestions.map(s => ({
            id: s._id.toString(),
            type: s.type,
            content: s.content,
            status: s.status,
            createdAt: s.createdAt,
          })),
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get suggestions',
        });
      }
    }
  );

  /**
   * POST /api/copilot/feedback/:suggestionId
   * Record feedback on a suggestion
   */
  fastify.post<{ Params: SuggestionParams; Body: FeedbackBody }>(
    '/feedback/:suggestionId',
    async (
      request: FastifyRequest<{ Params: SuggestionParams; Body: FeedbackBody }>,
      reply: FastifyReply
    ) => {
      try {
        const { suggestionId } = request.params;
        const { feedback, comment, modifiedContent } = request.body;
        const agent = (request as any).agent;

        if (!feedback || !['helpful', 'notHelpful', 'wrong', 'inappropriate'].includes(feedback)) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid feedback value',
          });
        }

        await recordFeedback(suggestionId, agent._id, feedback, comment, modifiedContent);
        return { success: true, message: 'Feedback recorded' };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to record feedback',
        });
      }
    }
  );

  /**
   * GET /api/copilot/analytics
   * Get Copilot usage analytics (admin only)
   */
  fastify.get<{ Querystring: AnalyticsQuery }>(
    '/analytics',
    async (request: FastifyRequest<{ Querystring: AnalyticsQuery }>, reply: FastifyReply) => {
      try {
        const agent = (request as any).agent;
        if (!['admin', 'supervisor'].includes(agent.role)) {
          return reply.status(403).send({
            success: false,
            error: 'Insufficient permissions',
          });
        }

        const { dateFrom, dateTo } = request.query;
        const analytics = await getCopilotAnalytics(
          dateFrom ? new Date(dateFrom) : undefined,
          dateTo ? new Date(dateTo) : undefined
        );

        return { success: true, data: analytics };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get analytics',
        });
      }
    }
  );
}

export default copilotRoutes;

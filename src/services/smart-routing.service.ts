/**
 * Smart Routing Service - Intelligent chat assignment to agents
 */

import { Types } from 'mongoose';
import { RoutingRule, type IRoutingRule, type IRoutingCondition } from '../database/models/RoutingRule.js';
import { AgentSkills, type IAgentSkills, type ILanguageSkill, type ISpecialization } from '../database/models/AgentSkills.js';
import { Agent, type IAgent, MAX_CONCURRENT_CHATS } from '../database/models/Agent.js';
import { ChatSession, type IChatSession } from '../database/models/ChatSession.js';
import { User } from '../database/models/User.js';
import { ActivityHelpers } from './activity-log.service.js';
import { io } from './socket.js';

// Language detection keywords (simplified - in production use a proper library)
const LANGUAGE_KEYWORDS: Record<string, string[]> = {
  es: ['hola', 'gracias', 'ayuda', 'necesito', 'problema', 'buenas', 'buenos'],
  en: ['hello', 'thanks', 'help', 'need', 'problem', 'hi', 'good'],
  pt: ['olá', 'obrigado', 'ajuda', 'preciso', 'problema', 'oi', 'bom'],
};

// Category keywords
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  billing: ['payment', 'invoice', 'charge', 'refund', 'pago', 'factura', 'reembolso', 'cobro'],
  technical: ['bug', 'error', 'crash', 'not working', 'doesn\'t work', 'funciona', 'falla'],
  shipping: ['delivery', 'shipping', 'order', 'package', 'envío', 'pedido', 'paquete'],
  sales: ['pricing', 'discount', 'buy', 'purchase', 'precio', 'descuento', 'comprar'],
  support: ['help', 'assist', 'question', 'ayuda', 'pregunta', 'problema'],
};

interface RoutingContext {
  session: IChatSession;
  user: any;
  message?: string;
  detectedLanguage?: string;
  detectedCategory?: string;
}

interface AgentScore {
  agent: IAgent;
  skills?: IAgentSkills;
  score: number;
  breakdown: {
    availability: number;
    skillMatch: number;
    currentLoad: number;
    responseTime: number;
  };
}

/**
 * Detect language from message content
 */
export function detectLanguage(text: string): string | null {
  const lowerText = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [lang, keywords] of Object.entries(LANGUAGE_KEYWORDS)) {
    scores[lang] = keywords.filter(kw => lowerText.includes(kw)).length;
  }

  const topLang = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return topLang && topLang[1] > 0 ? topLang[0] : null;
}

/**
 * Detect category from message content
 */
export function detectCategory(text: string): string | null {
  const lowerText = text.toLowerCase();
  const scores: Record<string, number> = {};

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[cat] = keywords.filter(kw => lowerText.includes(kw)).length;
  }

  const topCat = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return topCat && topCat[1] > 0 ? topCat[0] : null;
}

/**
 * Calculate agent score based on routing weights
 */
async function calculateAgentScore(
  agent: IAgent,
  context: RoutingContext,
  weights: {
    availabilityWeight: number;
    skillMatchWeight: number;
    currentLoadWeight: number;
    responseTimeWeight: number;
  }
): Promise<AgentScore> {
  const skills = await AgentSkills.findOne({ agentId: agent._id }).lean();

  // Availability score (0-1)
  let availability = 0;
  if (agent.onlineStatus === 'online') {
    availability = 1;
  } else if (agent.onlineStatus === 'away') {
    availability = 0.3;
  }

  // Skill match score (0-1)
  let skillMatch = 0.5; // Default score
  if (skills) {
    // Language match
    if (context.detectedLanguage) {
      const langSkill = skills.languages.find(l => l.code === context.detectedLanguage);
      if (langSkill) {
        const proficiencyScores = { basic: 0.4, intermediate: 0.6, fluent: 0.8, native: 1 };
        skillMatch += (proficiencyScores[langSkill.proficiency] || 0.5) * 0.5;
      }
    }

    // Category match
    if (context.detectedCategory) {
      const catSkill = skills.specializations.find(s => s.category === context.detectedCategory);
      if (catSkill) {
        const levelScores = { junior: 0.6, senior: 0.8, specialist: 1 };
        skillMatch += (levelScores[catSkill.level] || 0.5) * 0.5;
      }
    }
  }

  // Current load score (0-1) - lower load = higher score
  const maxChats = skills?.maxConcurrentChats || MAX_CONCURRENT_CHATS;
  const currentLoad = 1 - (agent.activeChats / maxChats);

  // Response time score (0-1) - faster = higher score
  let responseTime = 0.5; // Default
  if (skills?.metrics?.avgResponseTime) {
    // Score based on response time (under 60s = 1, over 300s = 0)
    const rt = skills.metrics.avgResponseTime;
    responseTime = Math.max(0, Math.min(1, 1 - (rt - 60) / 240));
  }

  // Calculate weighted score
  const score =
    availability * weights.availabilityWeight +
    skillMatch * weights.skillMatchWeight +
    currentLoad * weights.currentLoadWeight +
    responseTime * weights.responseTimeWeight;

  return {
    agent,
    skills: skills as unknown as IAgentSkills | undefined,
    score,
    breakdown: {
      availability,
      skillMatch,
      currentLoad,
      responseTime,
    },
  };
}

/**
 * Evaluate routing rule conditions
 */
function evaluateRoutingConditions(rule: unknown, context: RoutingContext): boolean {
  const routingRule = rule as IRoutingRule;
  const { conditions, conditionLogic } = routingRule;

  const results = conditions.map((condition: IRoutingCondition) => {
    switch (condition.field) {
      case 'category':
        if (condition.operator === 'equals') {
          return context.session.category === condition.value;
        }
        if (condition.operator === 'in' && Array.isArray(condition.value)) {
          return (condition.value as string[]).includes(context.session.category as string);
        }
        break;

      case 'language':
        if (condition.operator === 'equals') {
          return context.detectedLanguage === condition.value;
        }
        if (condition.operator === 'in' && Array.isArray(condition.value)) {
          return (condition.value as string[]).includes(context.detectedLanguage || '');
        }
        break;

      case 'keywords':
        if (context.message && Array.isArray(condition.value)) {
          const lowerMessage = context.message.toLowerCase();
          if (condition.operator === 'contains') {
            return (condition.value as string[]).some(kw => lowerMessage.includes(kw.toLowerCase()));
          }
          if (condition.operator === 'notContains') {
            return !(condition.value as string[]).some(kw => lowerMessage.includes(kw.toLowerCase()));
          }
        }
        break;

      case 'userTags':
        if (Array.isArray(condition.value)) {
          const userTags = context.user?.tags || [];
          if (condition.operator === 'in') {
            return (condition.value as string[]).some(t => userTags.includes(t));
          }
        }
        break;

      case 'priority':
        if (condition.operator === 'equals') {
          return context.session.priority === condition.value;
        }
        if (condition.operator === 'in' && Array.isArray(condition.value)) {
          return (condition.value as string[]).includes(context.session.priority || '');
        }
        break;

      case 'time':
        // Time-based conditions (e.g., business hours)
        if (condition.operator === 'between' && Array.isArray(condition.value)) {
          const now = new Date();
          const hour = now.getHours();
          const [start, end] = condition.value as number[];
          return hour >= start && hour < end;
        }
        break;
    }
    return false;
  });

  return conditionLogic === 'AND' 
    ? results.every(r => r) 
    : results.some(r => r);
}

/**
 * Find the best agent using routing rules
 */
export async function findBestAgent(
  sessionId: string,
  firstMessage?: string
): Promise<{ agent: IAgent | null; reason: string }> {
  // Get session with user
  const session = await ChatSession.findOne({ sessionId }).populate('user').lean();
  if (!session) {
    return { agent: null, reason: 'Session not found' };
  }

  // Build context
  const detectedLanguage = firstMessage ? detectLanguage(firstMessage) : null;
  const detectedCategory = firstMessage ? detectCategory(firstMessage) : null;

  const context: RoutingContext = {
    session: session as unknown as IChatSession,
    user: session.user,
    message: firstMessage,
    detectedLanguage: detectedLanguage || undefined,
    detectedCategory: detectedCategory || undefined,
  };

  // Update session with detected category if not already set
  if (detectedCategory && !session.category) {
    await ChatSession.findByIdAndUpdate(session._id, { category: detectedCategory });
  }

  // Get active routing rules, ordered by priority
  const rules = await RoutingRule.find({ isActive: true }).sort({ priority: 1 }).lean();

  // Try each rule in priority order
  for (const rule of rules) {
    if (evaluateRoutingConditions(rule, context)) {
      // Rule matched!
      await RoutingRule.findByIdAndUpdate(rule._id, {
        $inc: { matchCount: 1 },
        lastMatchedAt: new Date(),
      });

      const { action, scoring } = rule;
      const weights = scoring || {
        availabilityWeight: 0.4,
        skillMatchWeight: 0.3,
        currentLoadWeight: 0.2,
        responseTimeWeight: 0.1,
      };

      switch (action.type) {
        case 'assignToAgent':
          if (action.targetAgentId) {
            const agent = await Agent.findById(action.targetAgentId);
            if (agent && agent.onlineStatus === 'online' && agent.isActive) {
              const skills = await AgentSkills.findOne({ agentId: agent._id });
              const maxChats = skills?.maxConcurrentChats || MAX_CONCURRENT_CHATS;
              if (agent.activeChats < maxChats) {
                return { agent, reason: `Matched rule: ${rule.name}` };
              }
            }
          }
          break;

        case 'roundRobin':
        case 'assignToTeam':
          // Get available agents (optionally filtered by team)
          const agentQuery: Record<string, unknown> = {
            isActive: true,
            onlineStatus: 'online',
          };
          
          if (action.targetTeamId) {
            agentQuery.teamId = action.targetTeamId;
          }

          const availableAgents = await Agent.find(agentQuery).lean();
          
          if (availableAgents.length === 0) {
            continue; // Try next rule
          }

          // Score all agents
          const scores = await Promise.all(
            availableAgents.map((a: unknown) => calculateAgentScore(a as IAgent, context, weights))
          );

          // Filter agents at capacity
          const eligibleAgents = scores.filter((s: { agent: IAgent; skills?: IAgentSkills; score: number }) => {
            const maxChats = s.skills?.maxConcurrentChats || MAX_CONCURRENT_CHATS;
            return s.agent.activeChats < maxChats;
          });

          if (eligibleAgents.length === 0) {
            continue; // Try next rule
          }

          // Sort by score (highest first)
          eligibleAgents.sort((a: { score: number }, b: { score: number }) => b.score - a.score);

          const bestAgent = await Agent.findById(eligibleAgents[0].agent._id);
          if (bestAgent) {
            return { 
              agent: bestAgent, 
              reason: `Matched rule: ${(rule as unknown as IRoutingRule).name} (score: ${eligibleAgents[0].score.toFixed(2)})` 
            };
          }
          break;

        case 'addToQueue':
          // Don't assign, just set priority
          await ChatSession.findByIdAndUpdate(session._id, {
            status: 'queued',
            priority: action.queuePriority || 'normal',
          });
          return { agent: null, reason: `Queued with priority: ${action.queuePriority}` };

        case 'escalate':
          await ChatSession.findByIdAndUpdate(session._id, {
            status: 'queued',
            priority: 'urgent',
          });
          io.emit('escalation:new', {
            sessionId,
            reason: 'Routing rule escalation',
          });
          return { agent: null, reason: 'Escalated to supervisors' };
      }
    }
  }

  // No rule matched - fall back to round-robin
  const fallbackAgents = await Agent.find({
    isActive: true,
    onlineStatus: 'online',
  }).lean();

  for (const agent of fallbackAgents) {
    const skills = await AgentSkills.findOne({ agentId: agent._id });
    const maxChats = skills?.maxConcurrentChats || MAX_CONCURRENT_CHATS;
    if (agent.activeChats < maxChats) {
      const fullAgent = await Agent.findById(agent._id);
      if (fullAgent) {
        return { agent: fullAgent, reason: 'Default round-robin (no rules matched)' };
      }
    }
  }

  return { agent: null, reason: 'No available agents' };
}

/**
 * Assign chat to best available agent
 */
export async function assignChatToAgent(
  sessionId: string,
  firstMessage?: string
): Promise<{ success: boolean; agentId?: string; agentName?: string; reason: string }> {
  const { agent, reason } = await findBestAgent(sessionId, firstMessage);

  if (!agent) {
    // Add to queue
    await ChatSession.findOneAndUpdate(
      { sessionId },
      { status: 'queued' }
    );
    return { success: false, reason };
  }

  // Assign to agent
  await ChatSession.findOneAndUpdate(
    { sessionId },
    {
      assignedAgent: agent._id,
      status: 'human',
    }
  );

  // Increment agent's active chats
  await Agent.findByIdAndUpdate(agent._id, {
    $inc: { activeChats: 1 },
  });

  // Log activity
  await ActivityHelpers.sessionAssigned(sessionId, agent._id, agent.name);

  // Notify agent via session:assigned event
  if (agent.socketId) {
    io.to(agent.socketId).emit('session:assigned', {
      sessionId,
      agentId: agent._id.toString(),
      agentName: agent.name,
    });
  }

  return {
    success: true,
    agentId: agent._id.toString(),
    agentName: agent.name,
    reason,
  };
}

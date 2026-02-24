/**
 * AI Copilot Service - Intelligent suggestions for support agents
 * Provides conversation summaries, response suggestions, and categorization
 */

import { Types } from 'mongoose';
import { CopilotSuggestion, type ICopilotSuggestion, type SuggestionType } from '../database/models/CopilotSuggestion.js';
import { Message, type IMessage } from '../database/models/Message.js';
import { ChatSession } from '../database/models/ChatSession.js';

// In production, this would be an actual LLM client (OpenAI, Anthropic, etc.)
// For now, we'll use placeholder implementations

interface CopilotConfig {
  model: string;
  apiKey?: string;
  maxContextMessages: number;
  maxTokens: number;
  temperature: number;
}

const DEFAULT_CONFIG: CopilotConfig = {
  model: 'gpt-4-turbo-preview',
  maxContextMessages: 20,
  maxTokens: 500,
  temperature: 0.7,
};

interface ConversationContext {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  category?: string;
  userInfo?: {
    name: string;
    language?: string;
    previousInteractions?: number;
  };
}

/**
 * Build conversation context from session
 */
async function buildContext(sessionId: string, limit = 20): Promise<ConversationContext> {
  const session = await ChatSession.findOne({ sessionId })
    .populate('user', 'firstName lastName language')
    .lean();

  if (!session) {
    throw new Error('Session not found');
  }

  const messages = await Message.find({ sessionId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Reverse to get chronological order
  messages.reverse();

  return {
    sessionId,
    messages: messages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.content,
      timestamp: m.createdAt,
    })),
    category: session.category,
    userInfo: {
      name: `${(session.user as any)?.firstName || ''} ${(session.user as any)?.lastName || ''}`.trim() || 'User',
      language: (session.user as any)?.language,
    },
  };
}

/**
 * Summarize conversation (placeholder - would use LLM in production)
 */
async function generateSummary(context: ConversationContext): Promise<{
  summary: string;
  keyPoints: string[];
  tokensUsed: number;
  durationMs: number;
}> {
  const startTime = Date.now();

  // Placeholder implementation - in production, call OpenAI/Anthropic
  const messageCount = context.messages.length;
  const userMessages = context.messages.filter(m => m.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || '';

  // Simple extractive summary
  const summary = `Chat with ${messageCount} messages. User's main concern: "${lastUserMessage.slice(0, 100)}${lastUserMessage.length > 100 ? '...' : ''}"`;
  
  // Extract key points from user messages
  const keyPoints = userMessages
    .slice(-3)
    .map(m => m.content.slice(0, 80))
    .filter(content => content.length > 10);

  return {
    summary,
    keyPoints,
    tokensUsed: Math.ceil(summary.length / 4), // Rough token estimate
    durationMs: Date.now() - startTime,
  };
}

/**
 * Suggest a response (placeholder - would use LLM in production)
 */
async function generateResponseSuggestion(context: ConversationContext): Promise<{
  suggestedResponse: string;
  tone: 'formal' | 'friendly' | 'empathetic' | 'apologetic';
  tokensUsed: number;
  durationMs: number;
}> {
  const startTime = Date.now();

  const lastUserMessage = context.messages.filter(m => m.role === 'user').pop()?.content || '';
  
  // Detect sentiment and suggest appropriate tone
  const lowerMessage = lastUserMessage.toLowerCase();
  let tone: 'formal' | 'friendly' | 'empathetic' | 'apologetic' = 'friendly';
  let response = '';

  if (lowerMessage.includes('frustrat') || lowerMessage.includes('angry') || lowerMessage.includes('upset')) {
    tone = 'empathetic';
    response = `I completely understand your frustration, ${context.userInfo?.name}. Let me help you resolve this issue right away. `;
  } else if (lowerMessage.includes('sorry') || lowerMessage.includes('apologize') || lowerMessage.includes('refund')) {
    tone = 'apologetic';
    response = `I sincerely apologize for the inconvenience you've experienced. I'll make sure we address this for you. `;
  } else if (lowerMessage.includes('thank') || lowerMessage.includes('great') || lowerMessage.includes('awesome')) {
    tone = 'friendly';
    response = `You're very welcome! I'm glad I could help. `;
  } else {
    response = `Thank you for reaching out, ${context.userInfo?.name}. I'd be happy to assist you with this. `;
  }

  // Add category-specific suggestions
  if (context.category === 'billing') {
    response += 'Let me look into your billing details right away.';
  } else if (context.category === 'technical') {
    response += 'Could you please provide more details about the issue you\'re experiencing?';
  } else if (context.category === 'shipping') {
    response += 'I\'ll check the status of your order immediately.';
  } else {
    response += 'How can I assist you further?';
  }

  return {
    suggestedResponse: response,
    tone,
    tokensUsed: Math.ceil(response.length / 4),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Categorize conversation (placeholder - would use LLM in production)
 */
async function categorizeConversation(context: ConversationContext): Promise<{
  categories: Array<{ name: string; confidence: number }>;
  tokensUsed: number;
  durationMs: number;
}> {
  const startTime = Date.now();

  // Simple keyword-based categorization
  const allText = context.messages.map(m => m.content).join(' ').toLowerCase();
  
  const categoryScores: Record<string, number> = {
    billing: 0,
    technical: 0,
    shipping: 0,
    support: 0,
    feedback: 0,
    other: 0,
  };

  // Billing keywords
  if (allText.includes('payment') || allText.includes('invoice') || allText.includes('refund') || allText.includes('charge') || allText.includes('pago')) {
    categoryScores.billing += 3;
  }

  // Technical keywords
  if (allText.includes('error') || allText.includes('bug') || allText.includes('crash') || allText.includes('not working') || allText.includes('broken')) {
    categoryScores.technical += 3;
  }

  // Shipping keywords
  if (allText.includes('delivery') || allText.includes('shipping') || allText.includes('order') || allText.includes('package') || allText.includes('tracking')) {
    categoryScores.shipping += 3;
  }

  // Feedback keywords
  if (allText.includes('suggestion') || allText.includes('feedback') || allText.includes('feature') || allText.includes('improve')) {
    categoryScores.feedback += 3;
  }

  // Support default
  categoryScores.support += 1;

  // Calculate confidence scores
  const totalScore = Object.values(categoryScores).reduce((a, b) => a + b, 0);
  const categories = Object.entries(categoryScores)
    .map(([name, score]) => ({
      name,
      confidence: score / totalScore,
    }))
    .filter(c => c.confidence > 0.1)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  return {
    categories,
    tokensUsed: Math.ceil(allText.length / 10),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Check if conversation is ready to close (placeholder - would use LLM in production)
 */
async function checkCloseReadiness(context: ConversationContext): Promise<{
  readyToClose: boolean;
  indicators: string[];
  tokensUsed: number;
  durationMs: number;
}> {
  const startTime = Date.now();

  const lastMessages = context.messages.slice(-5);
  const lastUserMessage = lastMessages.filter(m => m.role === 'user').pop()?.content.toLowerCase() || '';
  
  const indicators: string[] = [];
  let readyToClose = false;

  // Check for satisfaction indicators
  if (lastUserMessage.includes('thank') || lastUserMessage.includes('gracias') || lastUserMessage.includes('perfect')) {
    indicators.push('User expressed gratitude');
  }

  if (lastUserMessage.includes('resolved') || lastUserMessage.includes('solved') || lastUserMessage.includes('fixed')) {
    indicators.push('User confirmed issue is resolved');
  }

  if (lastUserMessage.includes('that\'s all') || lastUserMessage.includes('nothing else') || lastUserMessage.includes('eso es todo')) {
    indicators.push('User indicated no more questions');
  }

  // Check for negative indicators
  const hasMoreQuestions = lastUserMessage.includes('?') || 
    lastUserMessage.includes('also') || 
    lastUserMessage.includes('another');
  
  if (hasMoreQuestions) {
    indicators.push('User may have additional questions');
  }

  // Determine readiness
  if (indicators.length >= 2 && !hasMoreQuestions) {
    readyToClose = true;
  }

  return {
    readyToClose,
    indicators,
    tokensUsed: 50,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Analyze sentiment (placeholder - would use LLM in production)
 */
async function analyzeSentiment(context: ConversationContext): Promise<{
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'angry';
  sentimentScore: number;
  tokensUsed: number;
  durationMs: number;
}> {
  const startTime = Date.now();

  const recentUserMessages = context.messages
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content.toLowerCase())
    .join(' ');

  // Simple sentiment analysis
  let score = 0;
  
  // Positive words
  const positiveWords = ['thank', 'great', 'excellent', 'awesome', 'love', 'amazing', 'helpful', 'perfect'];
  positiveWords.forEach(word => {
    if (recentUserMessages.includes(word)) score += 0.3;
  });

  // Negative words
  const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'disappointed', 'useless'];
  negativeWords.forEach(word => {
    if (recentUserMessages.includes(word)) score -= 0.3;
  });

  // Frustrated words
  const frustratedWords = ['frustrated', 'annoyed', 'irritated', 'waiting', 'still', 'again'];
  frustratedWords.forEach(word => {
    if (recentUserMessages.includes(word)) score -= 0.4;
  });

  // Angry words
  const angryWords = ['angry', 'furious', 'unacceptable', 'ridiculous', 'scam', 'sue'];
  angryWords.forEach(word => {
    if (recentUserMessages.includes(word)) score -= 0.6;
  });

  // Clamp score
  score = Math.max(-1, Math.min(1, score));

  let sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'angry';
  if (score >= 0.3) sentiment = 'positive';
  else if (score >= -0.2) sentiment = 'neutral';
  else if (score >= -0.5) sentiment = 'negative';
  else if (score >= -0.8) sentiment = 'frustrated';
  else sentiment = 'angry';

  return {
    sentiment,
    sentimentScore: score,
    tokensUsed: 30,
    durationMs: Date.now() - startTime,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a summary for a session
 */
export async function summarizeSession(
  sessionId: string,
  agentId?: Types.ObjectId | string
): Promise<ICopilotSuggestion> {
  const context = await buildContext(sessionId);
  const result = await generateSummary(context);

  const suggestion = await CopilotSuggestion.create({
    sessionId,
    type: 'summary',
    content: {
      summary: result.summary,
      keyPoints: result.keyPoints,
    },
    status: 'pending',
    agentId: agentId ? new Types.ObjectId(agentId.toString()) : undefined,
    aiModel: DEFAULT_CONFIG.model,
    model: DEFAULT_CONFIG.model,
    promptTokens: Math.ceil(result.tokensUsed * 0.8),
    completionTokens: Math.ceil(result.tokensUsed * 0.2),
    totalTokens: result.tokensUsed,
    generationTimeMs: result.durationMs,
    contextMessages: context.messages.length,
    contextTokens: context.messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  return suggestion;
}

/**
 * Get response suggestion for a session
 */
export async function suggestResponse(
  sessionId: string,
  agentId?: Types.ObjectId | string
): Promise<ICopilotSuggestion> {
  const context = await buildContext(sessionId);
  const result = await generateResponseSuggestion(context);

  const suggestion = await CopilotSuggestion.create({
    sessionId,
    type: 'response',
    content: {
      suggestedResponse: result.suggestedResponse,
      tone: result.tone,
    },
    status: 'pending',
    agentId: agentId ? new Types.ObjectId(agentId.toString()) : undefined,
    aiModel: DEFAULT_CONFIG.model,
    promptTokens: Math.ceil(result.tokensUsed * 0.8),
    completionTokens: Math.ceil(result.tokensUsed * 0.2),
    totalTokens: result.tokensUsed,
    generationTimeMs: result.durationMs,
    contextMessages: context.messages.length,
    contextTokens: context.messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  });

  return suggestion;
}

/**
 * Get category suggestions for a session
 */
export async function categorizeSession(
  sessionId: string,
  agentId?: Types.ObjectId | string
): Promise<ICopilotSuggestion> {
  const context = await buildContext(sessionId);
  const result = await categorizeConversation(context);

  const suggestion = await CopilotSuggestion.create({
    sessionId,
    type: 'category',
    content: {
      categories: result.categories,
    },
    status: 'pending',
    agentId: agentId ? new Types.ObjectId(agentId.toString()) : undefined,
    model: DEFAULT_CONFIG.model,
    promptTokens: Math.ceil(result.tokensUsed * 0.8),
    completionTokens: Math.ceil(result.tokensUsed * 0.2),
    totalTokens: result.tokensUsed,
    generationTimeMs: result.durationMs,
    contextMessages: context.messages.length,
    contextTokens: context.messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0),
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
  });

  return suggestion;
}

/**
 * Check if session is ready to close
 */
export async function checkCloseReady(
  sessionId: string,
  agentId?: Types.ObjectId | string
): Promise<ICopilotSuggestion> {
  const context = await buildContext(sessionId);
  const result = await checkCloseReadiness(context);

  const suggestion = await CopilotSuggestion.create({
    sessionId,
    type: 'closeReady',
    content: {
      readyToClose: result.readyToClose,
      indicators: result.indicators,
    },
    status: 'pending',
    agentId: agentId ? new Types.ObjectId(agentId.toString()) : undefined,
    model: DEFAULT_CONFIG.model,
    promptTokens: Math.ceil(result.tokensUsed * 0.8),
    completionTokens: Math.ceil(result.tokensUsed * 0.2),
    totalTokens: result.tokensUsed,
    generationTimeMs: result.durationMs,
    contextMessages: context.messages.length,
    contextTokens: context.messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
  });

  return suggestion;
}

/**
 * Get sentiment analysis for a session
 */
export async function getSentiment(
  sessionId: string,
  agentId?: Types.ObjectId | string
): Promise<ICopilotSuggestion> {
  const context = await buildContext(sessionId);
  const result = await analyzeSentiment(context);

  const suggestion = await CopilotSuggestion.create({
    sessionId,
    type: 'sentiment',
    content: {
      sentiment: result.sentiment,
      sentimentScore: result.sentimentScore,
    },
    status: 'pending',
    agentId: agentId ? new Types.ObjectId(agentId.toString()) : undefined,
    model: DEFAULT_CONFIG.model,
    promptTokens: Math.ceil(result.tokensUsed * 0.8),
    completionTokens: Math.ceil(result.tokensUsed * 0.2),
    totalTokens: result.tokensUsed,
    generationTimeMs: result.durationMs,
    contextMessages: context.messages.length,
    contextTokens: context.messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  });

  return suggestion;
}

/**
 * Record agent feedback on a suggestion
 */
export async function recordFeedback(
  suggestionId: Types.ObjectId | string,
  agentId: Types.ObjectId | string,
  feedback: 'helpful' | 'notHelpful' | 'wrong' | 'inappropriate',
  comment?: string,
  modifiedContent?: string
): Promise<void> {
  const status = feedback === 'helpful' ? 'accepted' : 'rejected';

  await CopilotSuggestion.findByIdAndUpdate(suggestionId, {
    status: modifiedContent ? 'modified' : status,
    agentId: new Types.ObjectId(agentId.toString()),
    agentFeedback: feedback,
    feedbackComment: comment,
    modifiedContent,
    respondedAt: new Date(),
  });
}

/**
 * Get latest suggestions for a session
 */
export async function getLatestSuggestions(
  sessionId: string,
  types?: SuggestionType[]
): Promise<ICopilotSuggestion[]> {
  const query: Record<string, unknown> = {
    sessionId,
    expiresAt: { $gt: new Date() },
  };

  if (types?.length) {
    query.type = { $in: types };
  }

  // Get the latest of each type
  const pipeline = [
    { $match: query },
    { $sort: { createdAt: -1 as const } },
    {
      $group: {
        _id: '$type',
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
  ];

  return CopilotSuggestion.aggregate(pipeline);
}

/**
 * Get Copilot analytics
 */
export async function getCopilotAnalytics(
  dateFrom?: Date,
  dateTo?: Date
): Promise<{
  totalSuggestions: number;
  byType: Record<SuggestionType, number>;
  acceptanceRate: number;
  avgGenerationTime: number;
  totalTokensUsed: number;
}> {
  const match: Record<string, unknown> = {};
  
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) (match.createdAt as any).$gte = dateFrom;
    if (dateTo) (match.createdAt as any).$lte = dateTo;
  }

  const [stats, byType] = await Promise.all([
    CopilotSuggestion.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
          avgGenTime: { $avg: '$generationTimeMs' },
          totalTokens: { $sum: '$totalTokens' },
        },
      },
    ]),
    CopilotSuggestion.aggregate([
      { $match: match },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ]);

  const s = stats[0] || { total: 0, accepted: 0, avgGenTime: 0, totalTokens: 0 };

  return {
    totalSuggestions: s.total,
    byType: byType.reduce((acc, item) => {
      acc[item._id as SuggestionType] = item.count;
      return acc;
    }, {} as Record<SuggestionType, number>),
    acceptanceRate: s.total > 0 ? s.accepted / s.total : 0,
    avgGenerationTime: s.avgGenTime || 0,
    totalTokensUsed: s.totalTokens,
  };
}

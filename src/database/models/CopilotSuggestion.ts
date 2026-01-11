/**
 * CopilotSuggestion Model - AI-powered suggestions for agents
 * Stores conversation summaries, response suggestions, and categorization
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type SuggestionType = 'summary' | 'category' | 'response' | 'closeReady' | 'escalation' | 'sentiment';
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'modified' | 'expired';
export type FeedbackType = 'helpful' | 'notHelpful' | 'wrong' | 'inappropriate';

export interface ICategoryPrediction {
  name: string;
  confidence: number;
}

export interface ISuggestionContent {
  // For summary
  summary?: string;
  keyPoints?: string[];
  
  // For category
  categories?: ICategoryPrediction[];
  
  // For response
  suggestedResponse?: string;
  tone?: 'formal' | 'friendly' | 'empathetic' | 'apologetic';
  
  // For close ready
  readyToClose?: boolean;
  indicators?: string[];
  
  // For escalation
  shouldEscalate?: boolean;
  escalationReason?: string;
  urgency?: 'low' | 'medium' | 'high';
  
  // For sentiment
  sentiment?: 'positive' | 'neutral' | 'negative' | 'frustrated' | 'angry';
  sentimentScore?: number;  // -1 to 1
}

export interface ICopilotSuggestion extends Document {
  _id: Types.ObjectId;
  sessionId: string;
  
  type: SuggestionType;
  content: ISuggestionContent;
  
  // Agent interaction
  status: SuggestionStatus;
  agentId?: Types.ObjectId;
  agentFeedback?: FeedbackType;
  feedbackComment?: string;
  modifiedContent?: string;
  
  // Model info
  aiModel: string;
  aiModelVersion?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  
  // Performance
  generationTimeMs: number;
  
  // Context used
  contextMessages: number;
  contextTokens: number;
  
  // Timing
  createdAt: Date;
  respondedAt?: Date;
  expiresAt?: Date;
}

const CopilotSuggestionSchema = new Schema<ICopilotSuggestion>(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['summary', 'category', 'response', 'closeReady', 'escalation', 'sentiment'],
      required: true,
      index: true,
    },
    content: {
      summary: String,
      keyPoints: [String],
      categories: [{
        name: String,
        confidence: Number,
      }],
      suggestedResponse: String,
      tone: {
        type: String,
        enum: ['formal', 'friendly', 'empathetic', 'apologetic'],
      },
      readyToClose: Boolean,
      indicators: [String],
      shouldEscalate: Boolean,
      escalationReason: String,
      urgency: {
        type: String,
        enum: ['low', 'medium', 'high'],
      },
      sentiment: {
        type: String,
        enum: ['positive', 'neutral', 'negative', 'frustrated', 'angry'],
      },
      sentimentScore: Number,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'modified', 'expired'],
      default: 'pending',
      index: true,
    },
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      index: true,
    },
    agentFeedback: {
      type: String,
      enum: ['helpful', 'notHelpful', 'wrong', 'inappropriate'],
    },
    feedbackComment: String,
    modifiedContent: String,
    aiModel: {
      type: String,
      required: true,
    },
    aiModelVersion: String,
    promptTokens: {
      type: Number,
      default: 0,
    },
    completionTokens: {
      type: Number,
      default: 0,
    },
    totalTokens: {
      type: Number,
      default: 0,
    },
    generationTimeMs: {
      type: Number,
      default: 0,
    },
    contextMessages: {
      type: Number,
      default: 0,
    },
    contextTokens: {
      type: Number,
      default: 0,
    },
    respondedAt: Date,
    expiresAt: {
      type: Date,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// TTL index - delete expired suggestions
CopilotSuggestionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for finding latest suggestions per session
CopilotSuggestionSchema.index({ sessionId: 1, type: 1, createdAt: -1 });

// Analytics index
CopilotSuggestionSchema.index({ type: 1, status: 1, createdAt: -1 });

export const CopilotSuggestion = mongoose.model<ICopilotSuggestion>('CopilotSuggestion', CopilotSuggestionSchema);

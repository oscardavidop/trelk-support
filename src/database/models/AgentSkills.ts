/**
 * AgentSkills Model - Agent capabilities, languages, and performance metrics
 * Used for intelligent routing and workload distribution
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type LanguageProficiency = 'basic' | 'intermediate' | 'fluent' | 'native';
export type SkillLevel = 'junior' | 'senior' | 'specialist';

export interface ILanguageSkill {
  code: string;                     // ISO 639-1 code (es, en, pt, etc.)
  proficiency: LanguageProficiency;
}

export interface ISpecialization {
  category: string;                 // billing, technical, sales, etc.
  level: SkillLevel;
}

export interface IAgentMetrics {
  avgResponseTime: number;          // seconds
  avgResolutionTime: number;        // seconds
  satisfactionScore: number;        // 1-5
  totalResolved: number;
  totalRatings: number;
  todayResolved: number;
  todayFirstResponseAvg: number;
  weeklyResolved: number;
}

export interface IAgentSkills extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  
  // Language skills
  languages: ILanguageSkill[];
  
  // Category specializations
  specializations: ISpecialization[];
  
  // Capacity overrides
  maxConcurrentChats: number;
  
  // Auto-updated performance metrics
  metrics: IAgentMetrics;
  
  // Schedule availability (optional)
  schedule?: {
    timezone: string;
    shifts: {
      dayOfWeek: number;            // 0=Sunday, 6=Saturday
      startTime: string;            // "09:00"
      endTime: string;              // "17:00"
    }[];
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const AgentSkillsSchema = new Schema<IAgentSkills>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      unique: true,
      index: true,
    },
    languages: [{
      code: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      proficiency: {
        type: String,
        enum: ['basic', 'intermediate', 'fluent', 'native'],
        default: 'fluent',
      },
    }],
    specializations: [{
      category: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
      },
      level: {
        type: String,
        enum: ['junior', 'senior', 'specialist'],
        default: 'junior',
      },
    }],
    maxConcurrentChats: {
      type: Number,
      default: 5,
      min: 1,
      max: 20,
    },
    metrics: {
      avgResponseTime: { type: Number, default: 0 },
      avgResolutionTime: { type: Number, default: 0 },
      satisfactionScore: { type: Number, default: 0, min: 0, max: 5 },
      totalResolved: { type: Number, default: 0 },
      totalRatings: { type: Number, default: 0 },
      todayResolved: { type: Number, default: 0 },
      todayFirstResponseAvg: { type: Number, default: 0 },
      weeklyResolved: { type: Number, default: 0 },
    },
    schedule: {
      timezone: String,
      shifts: [{
        dayOfWeek: { type: Number, min: 0, max: 6 },
        startTime: String,
        endTime: String,
      }],
    },
  },
  {
    timestamps: true,
  }
);

// Index for routing queries
AgentSkillsSchema.index({ 'languages.code': 1 });
AgentSkillsSchema.index({ 'specializations.category': 1 });

export const AgentSkills = mongoose.model<IAgentSkills>('AgentSkills', AgentSkillsSchema);

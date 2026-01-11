/**
 * Team Model - Agent teams for routing and organization
 * Enables team-based assignment and management
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITeamSchedule {
  timezone: string;
  shifts: {
    dayOfWeek: number;              // 0=Sunday, 6=Saturday
    startTime: string;              // "09:00"
    endTime: string;                // "17:00"
  }[];
}

export interface ITeam extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  color?: string;                   // For UI display
  icon?: string;
  
  // Team lead
  leadAgentId?: Types.ObjectId;
  
  // Members
  members: Types.ObjectId[];
  
  // Specializations
  specializations: string[];        // Categories this team handles
  languages: string[];              // Languages this team supports
  
  // Capacity
  maxConcurrentChats?: number;      // Team-level limit
  
  // Schedule (optional)
  schedule?: ITeamSchedule;
  
  // Status
  isActive: boolean;
  
  // Stats
  totalChatsHandled: number;
  avgResponseTime: number;
  avgSatisfactionScore: number;
  
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      maxlength: 50,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    color: {
      type: String,
      match: /^#[0-9A-Fa-f]{6}$/,
    },
    icon: String,
    leadAgentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    },
    members: [{
      type: Schema.Types.ObjectId,
      ref: 'Agent',
    }],
    specializations: [String],
    languages: [String],
    maxConcurrentChats: {
      type: Number,
      min: 1,
    },
    schedule: {
      timezone: String,
      shifts: [{
        dayOfWeek: { type: Number, min: 0, max: 6 },
        startTime: String,
        endTime: String,
      }],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    totalChatsHandled: {
      type: Number,
      default: 0,
    },
    avgResponseTime: {
      type: Number,
      default: 0,
    },
    avgSatisfactionScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for routing queries
TeamSchema.index({ isActive: 1, specializations: 1 });
TeamSchema.index({ isActive: 1, languages: 1 });
TeamSchema.index({ members: 1 });

export const Team = mongoose.model<ITeam>('Team', TeamSchema);

/**
 * Agent Session Model
 * Tracks active and historical login sessions for security
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAgentSession extends Document {
  _id: Types.ObjectId;
  agentId: Types.ObjectId;
  
  // Session info
  token: string; // JWT token hash (for invalidation)
  
  // Device & Location
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  ip: string;
  location?: string; // City, Country (from IP geolocation)
  
  // Status
  isActive: boolean;
  isCurrent: boolean; // Flag for the current session
  
  // Timestamps
  loginAt: Date;
  lastSeenAt: Date;
  logoutAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

const AgentSessionSchema = new Schema<IAgentSession>(
  {
    agentId: {
      type: Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    
    token: {
      type: String,
      required: true,
      index: true,
    },
    
    // Device & Location
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },
    browser: {
      type: String,
      default: 'Unknown',
    },
    os: {
      type: String,
      default: 'Unknown',
    },
    ip: {
      type: String,
      required: true,
    },
    location: String,
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isCurrent: {
      type: Boolean,
      default: false,
    },
    
    // Timestamps
    loginAt: {
      type: Date,
      default: Date.now,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
    logoutAt: Date,
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient queries
AgentSessionSchema.index({ agentId: 1, isActive: 1 });
AgentSessionSchema.index({ token: 1, isActive: 1 });

// Auto-cleanup old inactive sessions (older than 30 days)
AgentSessionSchema.index({ logoutAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const AgentSession = mongoose.model<IAgentSession>('AgentSession', AgentSessionSchema);

/**
 * Create a new session for an agent
 */
export async function createSession(
  agentId: string,
  tokenHash: string,
  deviceInfo: {
    deviceType?: string;
    browser?: string;
    os?: string;
    ip: string;
    location?: string;
  }
): Promise<IAgentSession> {
  const session = await AgentSession.create({
    agentId,
    token: tokenHash,
    deviceType: deviceInfo.deviceType || 'unknown',
    browser: deviceInfo.browser || 'Unknown',
    os: deviceInfo.os || 'Unknown',
    ip: deviceInfo.ip,
    location: deviceInfo.location,
    isActive: true,
    loginAt: new Date(),
    lastSeenAt: new Date(),
  });
  
  return session;
}

/**
 * Get active sessions for an agent
 */
export async function getActiveSessions(agentId: string) {
  return AgentSession.find({ agentId, isActive: true })
    .sort({ lastSeenAt: -1 })
    .lean();
}

/**
 * Invalidate a specific session
 */
export async function invalidateSession(sessionId: string, agentId: string): Promise<boolean> {
  const result = await AgentSession.updateOne(
    { _id: sessionId, agentId },
    { 
      $set: { 
        isActive: false, 
        logoutAt: new Date() 
      } 
    }
  );
  return result.modifiedCount > 0;
}

/**
 * Invalidate all sessions for an agent except current
 */
export async function invalidateAllSessionsExcept(
  agentId: string, 
  currentTokenHash: string
): Promise<number> {
  const result = await AgentSession.updateMany(
    { agentId, isActive: true, token: { $ne: currentTokenHash } },
    { 
      $set: { 
        isActive: false, 
        logoutAt: new Date() 
      } 
    }
  );
  return result.modifiedCount;
}

/**
 * Update session last seen
 */
export async function updateSessionLastSeen(tokenHash: string): Promise<void> {
  await AgentSession.updateOne(
    { token: tokenHash, isActive: true },
    { $set: { lastSeenAt: new Date() } }
  );
}

/**
 * Check if a token is valid (session is active)
 */
export async function isSessionActive(tokenHash: string): Promise<boolean> {
  const session = await AgentSession.findOne({ token: tokenHash, isActive: true });
  return !!session;
}

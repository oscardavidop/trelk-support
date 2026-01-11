/**
 * Authentication Service
 * JWT-based authentication for dashboard agents
 */

import jwt from 'jsonwebtoken';
import { ENV } from '../config/index.js';
import { findAgentByEmail, findAgentById, updateLastLogin, updateAgentStatus } from './agent.service.js';
import type { IAgent } from '../database/index.js';

export interface TokenPayload {
  agentId: string;
  email: string;
  role: string;
}

export interface AuthResult {
  success: boolean;
  agent?: IAgent;
  token?: string;
  error?: string;
}

/**
 * Login agent with email and password
 */
export async function loginAgent(email: string, password: string): Promise<AuthResult> {
  try {
    // Find agent by email (include password field)
    const agent = await findAgentByEmail(email);
    
    if (!agent) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    // Check if agent is active
    if (agent.isActive === false) {
      return { success: false, error: 'Account is deactivated. Contact an administrator.' };
    }
    
    // Verify password
    const isValidPassword = await agent.comparePassword(password);
    
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    // Generate JWT token
    const token = generateToken(agent);
    
    // Update last login and set online
    await updateLastLogin(agent._id.toString());
    await updateAgentStatus(agent._id.toString(), 'online');
    
    // Return agent without password
    const agentData = await findAgentById(agent._id.toString());
    
    return {
      success: true,
      agent: agentData!,
      token,
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Logout agent
 */
export async function logoutAgent(agentId: string): Promise<void> {
  await updateAgentStatus(agentId, 'offline');
}

/**
 * Generate JWT token
 */
export function generateToken(agent: IAgent): string {
  const payload: TokenPayload = {
    agentId: agent._id.toString(),
    email: agent.email,
    role: agent.role,
  };
  
  return jwt.sign(payload, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as TokenPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Get agent from token
 */
export async function getAgentFromToken(token: string): Promise<IAgent | null> {
  const payload = verifyToken(token);
  if (!payload) return null;
  
  return findAgentById(payload.agentId);
}

/**
 * Refresh token
 */
export async function refreshToken(token: string): Promise<AuthResult> {
  const agent = await getAgentFromToken(token);
  
  if (!agent) {
    return { success: false, error: 'Invalid token' };
  }
  
  const newToken = generateToken(agent);
  
  return {
    success: true,
    agent,
    token: newToken,
  };
}

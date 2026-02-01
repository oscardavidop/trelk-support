/**
 * Database Models Export
 */

export { User, type IUser } from './models/User.js';
export { Agent, type IAgent, type AgentRole, type OnlineStatus, type IAgentMetrics, type IPermissionsOverride } from './models/Agent.js';
export { Role, type IRole, initializeSystemRoles, ALL_PERMISSIONS, PERMISSION_CATEGORIES, DEFAULT_ROLE_PERMISSIONS } from './models/Role.js';
export { AgentPreferences, type IAgentPreferences, getOrCreatePreferences } from './models/AgentPreferences.js';
export { AgentSession, type IAgentSession, createSession, getActiveSessions, invalidateSession, invalidateAllSessionsExcept, invalidateAllAgentSessions } from './models/AgentSession.js';
export { AgentActivity, type IAgentActivity, type ActivityType, logActivity, getRecentActivities } from './models/AgentActivity.js';
export { ChatSession, type IChatSession, type SessionStatus, type SatisfactionLevel, type IPostChatSurvey, type ClosedByType } from './models/ChatSession.js';
export { Message, type IMessage, type MessageSender, type MessageType } from './models/Message.js';
export { Settings, type ISettings, type IBotSettings, type IChatSettings, type IAgentRules, type ISecuritySettings, type INotificationSettings } from './models/Settings.js';
export { SavedReply, type ISavedReply } from './models/SavedReply.js';
export { Note, type INote } from './models/Note.js';
export { Tag, type ITag } from './models/Tag.js';
export { UserTag, type IUserTag } from './models/UserTag.js';
export { Transfer, type ITransfer } from './models/Transfer.js';
export { UserBlock, type IUserBlock, type BlockType } from './models/UserBlock.js';
export { Survey, type ISurvey } from './models/Survey.js';
export { 
  TextRegistry, 
  type ITextRegistry, 
  type ITextTranslation, 
  type ITextVersion, 
  type ITextUsage 
} from './models/TextRegistry.js';
export { 
  CustomFieldDefinition, 
  UserCustomField, 
  type ICustomFieldDefinition, 
  type IUserCustomField,
  type CustomFieldType 
} from './models/CustomField.js';
export { AuditLog, type IAuditLog, type AuditCategory, type AuditSeverity } from './models/AuditLog.js';
export { 
  PasswordResetToken, 
  type IPasswordResetToken, 
  type ResetTokenStatus,
  generateSecureToken,
  hashToken,
  createResetToken,
  validateAndConsumeToken,
  validateTokenOnly,
  revokeAllTokensForAgent,
  getPendingTokensCount,
  cleanupExpiredTokens,
} from './models/PasswordResetToken.js';
export {
  MFASession,
  type IMFASession,
  type MFASessionStatus,
  MFA_CONFIG,
  generateMFACode,
  hashMFACode,
  generateLoginToken,
  createMFASession,
  verifyMFACode,
  getMFASessionByToken,
  canResendMFACode,
  isAgentMFABlocked,
  cancelAllMFASessions,
  cleanupExpiredMFASessions,
} from './models/MFASession.js';
export {
  TrustedDevice,
  type ITrustedDevice,
  TRUSTED_DEVICE_CONFIG,
  generateDeviceFingerprint,
  parseUserAgent,
  trustDevice,
  isDeviceTrusted,
  getTrustedDevices,
  revokeDevice,
  revokeAllDevices,
} from './models/TrustedDevice.js';
export { connectDatabase, disconnectDatabase } from './connection.js';

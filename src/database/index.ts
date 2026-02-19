/**
 * Database Models Export
 */

export { User, type IUser } from './models/User.js';
export { Agent, type IAgent, type AgentRole, type OnlineStatus, type IAgentMetrics, type IPermissionsOverride } from './models/Agent.js';
export { Role, type IRole, initializeSystemRoles, ALL_PERMISSIONS, PERMISSION_CATEGORIES, DEFAULT_ROLE_PERMISSIONS } from './models/Role.js';
export { AgentPreferences, type IAgentPreferences, getOrCreatePreferences } from './models/AgentPreferences.js';
export { AgentSession, type IAgentSession, createSession, getActiveSessions, invalidateSession, invalidateAllSessionsExcept, invalidateAllAgentSessions } from './models/AgentSession.js';
export { AgentActivity, type IAgentActivity, type ActivityType, logActivity, getRecentActivities } from './models/AgentActivity.js';
export { ChatSession, type IChatSession, type SessionStatus, type SatisfactionLevel, type IPostChatSurvey, type ClosedByType, type IChatDisposition } from './models/ChatSession.js';
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
  getVerifiedMFASession,
  consumeVerifiedMFASession,
  canResendMFACode,
  isAgentMFABlocked,
  getPendingMFASession,
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
export {
  TOTPSecret,
  type ITOTPSecret,
  TOTP_CONFIG,
  generateTOTPSecret,
  verifyTOTPCode,
  verifyTOTPCodeWithCounter,
  generateBackupCodes,
  hashBackupCode,
  generateOTPAuthURI,
  createTOTPSecret,
  getTOTPSecret,
  getTOTPDocument,
  verifyTOTPSetup,
  verifyAgentTOTP,
  useBackupCode,
  regenerateBackupCodes,
  getBackupCodesStatus,
  deleteTOTPSecret,
  hasTOTPEnabled,
} from './models/TOTPSecret.js';
export { WebVisitor, type IWebVisitor } from './models/WebVisitor.js';

// Chat Dispositions (Tipificaciones)
export {
  DispositionCategory,
  DispositionTag,
  DispositionSettings,
  type IDispositionCategory,
  type IDispositionSubcategory,
  type IDispositionTag,
  type IDispositionSettings,
  getActiveCategories,
  getActiveTags,
  getDispositionSettings,
  clearDispositionCache,
  validateDisposition,
  incrementCategoryUsage,
  incrementTagUsage,
  initializeDefaultCategories,
} from './models/ChatDisposition.js';

// Login Policy & Rules Engine
export {
  LoginPolicy,
  type ILoginPolicy,
  type PolicyContext,
  type PolicyResult,
  type ChatActionContext,
  type ChatActionResult,
  type IChatActionRule,
  type IGlobalAlert,
  type ITimeRange,
  type IRoleRedirect,
  type ILocationRestriction,
  type IDeviceTrust,
  type ISessionPolicy,
  type IProfileRequirements,
  type IAutoStatus,
  type IAutoQueueAssignment,
  type IMaintenanceMode,
  type ISupervisorAlerts,
  type IPolicyAcceptance,
} from './models/LoginPolicy.js';

// QA & Coaching System
export {
  QACheckItem,
  QASettings,
  type IQACheckItem,
  type IQASettings,
  type QACheckCategory,
} from './models/QAConfig.js';
export {
  QAReview,
  type IQAReview,
  type IQACheckEval,
  type IQAEditLog,
  type QACheckResult,
  type QAReviewStatus,
  type CoachingStatus,
  type CoachingTag,
} from './models/QAReview.js';

// Playbooks / Guided Scripts
export { Playbook, type IPlaybook, type IPlaybookStep, type IPlaybookTrigger, type PlaybookStepType, type PlaybookStepAction, type PlaybookTriggerType } from './models/Playbook.js';
export { PlaybookProgress, type IPlaybookProgress, type IStepProgress, type StepStatus } from './models/PlaybookProgress.js';

// Translation System
export {
  TranslationSettings,
  type ITranslationSettings,
  type IProviderConfig,
  type ITranslationRule,
  type IProxyConfig,
  type ProxyProtocol,
  type IAgentTranslationPrefs,
  type AgentTranslateOverride,
  type TranslationProvider,
  type TranslationMode,
  type OutgoingDeliveryMode,
  type TargetLangStrategy,
  type IOutgoingTranslateConfig,
  type IIncomingTranslateConfig,
  getTranslationSettings,
  updateTranslationSettings,
  SUPPORTED_LANGUAGES,
} from './models/TranslationSettings.js';
export {
  TranslationLog,
  type ITranslationLog,
  logTranslation,
  getTranslationLogs,
  getTranslationStats,
} from './models/TranslationLog.js';

export { connectDatabase, disconnectDatabase } from './connection.js';

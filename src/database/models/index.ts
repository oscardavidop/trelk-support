/**
 * Database Models Index
 * Export all Mongoose models from a single file
 */

// Core models
export { Agent, type IAgent, type AgentRole, MAX_CONCURRENT_CHATS, ROLE_PERMISSIONS, ROLE_HIERARCHY } from './Agent.js';
export { ChatSession, type IChatSession, type ChannelType, type IChannelMetadata, type IWebSurvey } from './ChatSession.js';
export { Message, type IMessage, type IMediaContent, type ChannelType as MessageChannelType } from './Message.js';
export { User, type IUser, type UserBlockReason } from './User.js';
export { Note, type INote } from './Note.js';
export { Tag, type ITag } from './Tag.js';
export { Transfer, type ITransfer } from './Transfer.js';
export { Survey, type ISurvey } from './Survey.js';
export { SavedReply, type ISavedReply } from './SavedReply.js';
export { Settings, type ISettings } from './Settings.js';
export { UserBlock, type IUserBlock } from './UserBlock.js';
export { UserTag, type IUserTag } from './UserTag.js';
export { CustomFieldDefinition, UserCustomField, type ICustomFieldDefinition, type IUserCustomField } from './CustomField.js';

// Omnichannel models
export { WebChatProject, type IWebChatProject } from './WebChatProject.js';
export { WebVisitor, type IWebVisitor } from './WebVisitor.js';

// Enterprise models - Supervisor
export { Whisper, type IWhisper } from './Whisper.js';

// Enterprise models - Automation
export { AutomationRule, type IAutomationRule, type IRuleTrigger, type IRuleCondition, type IRuleAction } from './AutomationRule.js';
export { RuleExecution, type IRuleExecution } from './RuleExecution.js';
export { RoutingRule, type IRoutingRule, type IRoutingCondition } from './RoutingRule.js';
export { ScheduledMessage, type IScheduledMessage } from './ScheduledMessage.js';

// Enterprise models - Agent Management
export { AgentSkills, type IAgentSkills, type ILanguageSkill, type ISpecialization } from './AgentSkills.js';
export { Team, type ITeam } from './Team.js';
export { AgentSessionState, type IAgentSessionState } from './AgentSessionState.js';

// Enterprise models - Logging & Audit
export { ActivityLog, type IActivityLog, type ActivityAction } from './ActivityLog.js';
export { AuditLog, type IAuditLog, type AuditCategory, type AuditSeverity } from './AuditLog.js';
export { AdminAuditLog, type IAdminAuditLog } from './AdminAuditLog.js';

// Enterprise models - Security
export { UserRateLimit, type IUserRateLimit, type ViolationType } from './UserRateLimit.js';
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
} from './PasswordResetToken.js';

// Enterprise models - Export
export { ExportJob, type IExportJob, type ExportFormat, type ExportStatus } from './ExportJob.js';

// Enterprise models - AI Copilot
export { CopilotSuggestion, type ICopilotSuggestion, type SuggestionType } from './CopilotSuggestion.js';

// Contact Management PRO
export { Segment, type ISegment, type IFilterRule, type IFilterGroup, type FilterOperator, type FilterField } from './Segment.js';
export { ContactActivity, type IContactActivity, type ContactActivityType, type ActivityActor, ActivityTypes } from './ContactActivity.js';
export { SavedView, type ISavedView, type IColumnConfig } from './SavedView.js';

// Broadcast / Mass Messaging
export { 
  Broadcast, 
  BroadcastRecipient,
  type IBroadcast, 
  type IBroadcastRecipientDoc,
  type BroadcastStatus, 
  type BroadcastTargetType, 
  type BroadcastMessageType,
  type DeliveryStatus 
} from './Broadcast.js';

// Permission Request System
export { 
  PermissionRequest, 
  type IPermissionRequest, 
  type IPermissionItem, 
  type RequestStatus 
} from './PermissionRequest.js';

// Internal Communications (Staff → Staff)
export {
  InternalNotification,
  type IInternalNotification,
  type NotificationPriority,
  type NotificationType,
} from './InternalNotification.js';

export {
  InternalBroadcast,
  type IInternalBroadcast,
  type BroadcastLevel,
  type BroadcastTarget,
} from './InternalBroadcast.js';

export {
  BroadcastReceipt as InternalBroadcastReceipt,
  type IBroadcastReceipt as IInternalBroadcastReceipt,
} from './BroadcastReceipt.js';

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
} from './LoginPolicy.js';

// Enterprise models - Media Admin
export { MediaFile, type IMediaFile, type MediaSource, type MediaType, type MediaStatus } from './MediaFile.js';

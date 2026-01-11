/**
 * Database Models Index
 * Export all Mongoose models from a single file
 */

// Core models
export { Agent, type IAgent, type AgentRole, MAX_CONCURRENT_CHATS, ROLE_PERMISSIONS, ROLE_HIERARCHY } from './Agent.js';
export { ChatSession, type IChatSession } from './ChatSession.js';
export { Message, type IMessage } from './Message.js';
export { User, type IUser } from './User.js';
export { Note, type INote } from './Note.js';
export { Tag, type ITag } from './Tag.js';
export { Transfer, type ITransfer } from './Transfer.js';
export { Survey, type ISurvey } from './Survey.js';
export { SavedReply, type ISavedReply } from './SavedReply.js';
export { Settings, type ISettings } from './Settings.js';
export { UserBlock, type IUserBlock } from './UserBlock.js';
export { UserTag, type IUserTag } from './UserTag.js';
export { CustomFieldDefinition, UserCustomField, type ICustomFieldDefinition, type IUserCustomField } from './CustomField.js';

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

// Enterprise models - Security
export { UserRateLimit, type IUserRateLimit, type ViolationType } from './UserRateLimit.js';

// Enterprise models - Export
export { ExportJob, type IExportJob, type ExportFormat, type ExportStatus } from './ExportJob.js';

// Enterprise models - AI Copilot
export { CopilotSuggestion, type ICopilotSuggestion, type SuggestionType } from './CopilotSuggestion.js';

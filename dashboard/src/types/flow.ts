/**
 * Flow Types for Frontend
 * Visual Flow Builder type definitions
 */

// ============= ENUMS =============

export type TriggerType = 
  | 'chat_created'
  | 'message_received'
  | 'chat_assigned'
  | 'chat_closed'
  | 'user_inactive'
  | 'survey_answered'
  | 'category_changed'
  | 'tag_added'
  | 'file_received'
  | 'keyword_detected'
  | 'chat_reopened'
  | 'agent_online'
  | 'sla_warning';

export type ConditionOperator = 
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'regex'
  | 'greater_than'
  | 'less_than'
  | 'greater_or_equal'
  | 'less_or_equal'
  | 'exists'
  | 'not_exists'
  | 'is_empty'
  | 'is_not_empty'
  | 'starts_with'
  | 'ends_with';

export type ActionType = 
  | 'send_message'
  | 'schedule_message'
  | 'transfer_chat'
  | 'assign_agent'
  | 'change_category'
  | 'add_tag'
  | 'remove_tag'
  | 'create_note'
  | 'block_user'
  | 'call_webhook'
  | 'set_custom_field'
  | 'close_chat'
  | 'reopen_chat'
  | 'send_survey'
  | 'escalate'
  | 'wait_for_response'
  | 'add_to_queue';

export type DelayType = 
  | 'fixed_time'
  | 'until_response'
  | 'until_agent_online'
  | 'until_business_hours'
  | 'until_condition';

export type NodeType = 'trigger' | 'condition' | 'action' | 'delay' | 'branch' | 'end';
export type FlowStatus = 'draft' | 'published' | 'archived' | 'disabled';
export type ExecutionStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

// ============= NODE CONFIGS =============

export interface TriggerConfig {
  triggerType: TriggerType;
  keywords?: string[];
  keywordMatchType?: 'exact' | 'contains' | 'regex';
  inactivityMinutes?: number;
  surveyRatingFilter?: 'any' | 'positive' | 'negative';
  categoryFilter?: string[];
  tagFilter?: string[];
  fileTypeFilter?: ('image' | 'document' | 'audio' | 'video')[];
}

export interface ConditionRule {
  id: string;
  field: string;
  operator: ConditionOperator;
  value: any;
}

export interface ConditionGroup {
  id: string;
  operator: 'AND' | 'OR';
  rules: ConditionRule[];
}

export interface ConditionConfig {
  groups: ConditionGroup[];
  groupOperator: 'AND' | 'OR';
}

export interface ActionConfig {
  actionType: ActionType;
  messageContent?: string;
  messageType?: 'text' | 'image' | 'document';
  mediaUrl?: string;
  scheduleDelay?: number;
  scheduleType?: 'fixed_time' | 'after_inactivity';
  targetAgentId?: string;
  targetTeamId?: string;
  transferReason?: string;
  categoryName?: string;
  tagName?: string;
  tagColor?: string;
  noteContent?: string;
  blockDurationHours?: number;
  blockReason?: string;
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT';
  webhookHeaders?: Record<string, string>;
  webhookBody?: string;
  customFieldName?: string;
  customFieldValue?: string;
  surveyType?: 'csat' | 'nps';
  queuePriority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface DelayConfig {
  delayType: DelayType;
  delayMinutes?: number;
  maxWaitMinutes?: number;
  waitCondition?: ConditionConfig;
  cancelOnChatClose?: boolean;
  cancelOnUserResponse?: boolean;
}

// ============= NODE & EDGE =============

export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  config: TriggerConfig | ConditionConfig | ActionConfig | DelayConfig | Record<string, any>;
  position: FlowNodePosition;
  metadata?: {
    color?: string;
    icon?: string;
    description?: string;
  };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  animated?: boolean;
}

// ============= FLOW =============

export interface FlowVersion {
  version: number;
  createdAt: string;
  createdBy: { id: string; name: string } | null;
  changeDescription?: string;
}

export interface Flow {
  _id: string;
  name: string;
  description?: string;
  status: FlowStatus;
  enabled: boolean;
  currentVersion: number;
  nodes: FlowNode[];
  edges: FlowEdge[];
  triggers: TriggerType[];
  executionCount: number;
  lastExecutedAt?: string;
  errorCount: number;
  avgExecutionTime?: number;
  tags?: string[];
  priority: number;
  createdBy: { _id: string; name: string };
  updatedBy: { _id: string; name: string };
  publishedBy?: { _id: string; name: string };
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlowListItem {
  _id: string;
  name: string;
  description?: string;
  status: FlowStatus;
  enabled: boolean;
  triggers: TriggerType[];
  executionCount: number;
  errorCount: number;
  lastExecutedAt?: string;
  tags?: string[];
  priority: number;
  currentVersion: number;
  createdBy: { _id: string; name: string };
  updatedBy: { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

// ============= EXECUTION =============

export interface ExecutionStep {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  duration?: number;
  input?: Record<string, any>;
  output?: Record<string, any>;
  error?: string;
  retryCount: number;
}

export interface FlowExecution {
  _id: string;
  flowId: string;
  flowVersion: number;
  sessionId: string;
  chatId: number;
  status: ExecutionStatus;
  currentNodeId: string | null;
  nextNodeId: string | null;
  context: {
    triggerType: string;
    triggerData: Record<string, any>;
    sessionId: string;
    chatId: number;
    userId: number;
    user: {
      id: number;
      firstName: string;
      lastName?: string;
      username?: string;
    };
    agent?: {
      id: string;
      name: string;
    };
    variables: Record<string, any>;
    startedAt: string;
    lastActiveAt: string;
  };
  steps: ExecutionStep[];
  waitingUntil?: string;
  waitingFor?: string;
  retryCount: number;
  lastError?: string;
  startedAt: string;
  completedAt?: string;
  totalDuration?: number;
  createdAt: string;
  updatedAt: string;
}

// ============= VALIDATION =============

export interface FlowValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============= STATISTICS =============

export interface FlowStats {
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  running: number;
  avgDuration: number;
  last24Hours: number;
  last7Days: number;
}

export interface OverallFlowStats {
  totalFlows: number;
  publishedFlows: number;
  draftFlows: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgExecutionTime: number;
}

// ============= SIMULATION =============

export interface SimulationStep {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  wouldExecute: boolean;
  conditionResult?: boolean;
  output?: any;
}

export interface SimulationResult {
  flow: { id: string; name: string };
  triggerType: string;
  steps: SimulationStep[];
  wouldComplete: boolean;
}

// ============= METADATA =============

export interface TriggerMeta {
  type: TriggerType;
  label: string;
  description: string;
  icon?: string;
  color?: string;
}

export interface ActionMeta {
  type: ActionType;
  label: string;
  description: string;
  icon?: string;
  color?: string;
}

export interface OperatorMeta {
  value: ConditionOperator;
  label: string;
  types: string[];
}

export interface FieldMeta {
  path: string;
  label: string;
  type: string;
}

// ============= INPUTS =============

export interface CreateFlowInput {
  name: string;
  description?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  tags?: string[];
  priority?: number;
}

export interface UpdateFlowInput {
  name?: string;
  description?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  tags?: string[];
  priority?: number;
  enabled?: boolean;
  createVersion?: boolean;
}

// ============= NODE DEFAULTS =============

export const NODE_COLORS: Record<NodeType, string> = {
  trigger: '#10B981', // green
  condition: '#F59E0B', // amber
  action: '#3B82F6', // blue
  delay: '#8B5CF6', // purple
  branch: '#EC4899', // pink
  end: '#6B7280', // gray
};

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  chat_created: 'Chat creado',
  message_received: 'Mensaje recibido',
  chat_assigned: 'Chat asignado',
  chat_closed: 'Chat cerrado',
  user_inactive: 'Usuario inactivo',
  survey_answered: 'Encuesta respondida',
  category_changed: 'Categoría cambiada',
  tag_added: 'Tag añadido',
  file_received: 'Archivo recibido',
  keyword_detected: 'Keyword detectada',
  chat_reopened: 'Chat reabierto',
  agent_online: 'Agente online',
  sla_warning: 'Alerta SLA',
};

export const ACTION_LABELS: Record<ActionType, string> = {
  send_message: 'Enviar mensaje',
  schedule_message: 'Programar mensaje',
  transfer_chat: 'Transferir chat',
  assign_agent: 'Asignar agente',
  change_category: 'Cambiar categoría',
  add_tag: 'Añadir tag',
  remove_tag: 'Remover tag',
  create_note: 'Crear nota',
  block_user: 'Bloquear usuario',
  call_webhook: 'Llamar webhook',
  set_custom_field: 'Guardar variable',
  close_chat: 'Cerrar chat',
  reopen_chat: 'Reabrir chat',
  send_survey: 'Enviar encuesta',
  escalate: 'Escalar',
  wait_for_response: 'Esperar respuesta',
  add_to_queue: 'Añadir a cola',
};

export const DELAY_LABELS: Record<DelayType, string> = {
  fixed_time: 'Tiempo fijo',
  until_response: 'Hasta respuesta',
  until_agent_online: 'Hasta agente online',
  until_business_hours: 'Hasta horario laboral',
  until_condition: 'Hasta condición',
};

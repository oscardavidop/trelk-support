/**
 * Flow Types for Frontend
 * Visual Flow Builder type definitions
 */

// ============= ENUMS =============

export type TriggerType = 
  | 'chat_created'
  | 'message_received'
  | 'command_received'
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
  | 'sla_warning'
  | 'button_clicked';  // Flow button pressed

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
  | 'api_call'
  | 'set_custom_field'
  | 'close_chat'
  | 'reopen_chat'
  | 'send_survey'
  | 'escalate'
  | 'wait_for_response'
  | 'add_to_queue'
  // === NEW TELEGRAM ACTIONS ===
  | 'edit_message'        // editMessageText
  | 'delete_message'      // deleteMessage
  | 'edit_keyboard'       // editMessageReplyMarkup
  | 'remove_keyboard'     // remove inline keyboard
  | 'send_reply_keyboard' // ReplyKeyboardMarkup
  | 'remove_reply_keyboard' // ReplyKeyboardRemove
  | 'send_chat_action'    // sendChatAction (typing, upload_photo, etc.)
  | 'pin_message'         // pinChatMessage
  | 'unpin_message'       // unpinChatMessage
  | 'save_message_id'     // Save last bot message ID to variable
  | 'delay_action'        // Wait X seconds without pausing flow execution
  | 'send_location'       // sendLocation
  | 'send_contact'        // sendContact
  | 'send_sticker'        // sendSticker
  | 'copy_message'        // copyMessage
  | 'run_subflow';        // Execute another flow

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
  // Command trigger (e.g., /start, /help)
  command?: string;  // e.g., 'start', 'help' (without /)
  commandParamMatch?: 'any' | 'exact' | 'contains' | 'regex';  // How to match deep link param
  commandParam?: string;  // Expected param value (for t.me/bot?start=PARAM)
  saveCommandTo?: string;  // Variable name to save the command name to
  saveParamTo?: string;  // Variable name to save the param to
  // Keyword trigger
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
  customFieldName?: string; // For customFields type
  variableName?: string;    // For variables type
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

// ============= MESSAGE CONTENT BLOCKS =============

export type MessageBlockType = 'text' | 'image' | 'document' | 'audio' | 'video' | 'delay';

// Forward declaration for keyboard in blocks
export type KeyboardType = 'inline' | 'reply' | 'remove';

// Button onClick action modes
export type ButtonActionMode = 'continue' | 'goto_node' | 'goto_flow' | 'url' | 'none';

// Message send mode when executing button action
export type ButtonMessageMode = 'send_new' | 'edit_message';

export interface ButtonOnClick {
  mode: ButtonActionMode;
  messageMode?: ButtonMessageMode;  // 'send_new' (default) or 'edit_message'
  targetNodeId?: string;  // For 'goto_node'
  targetFlowId?: string;  // For 'goto_flow'
  url?: string;           // For 'url' mode
}

export interface KeyboardButton {
  id: string;
  text: string;
  // For inline keyboard - auto-generated or custom
  callbackData?: string;
  // Button action configuration
  onClick?: ButtonOnClick;
  // Legacy (deprecated, use onClick.url instead)
  url?: string;
  // Legacy (deprecated, use onClick.targetNodeId instead)
  targetNodeId?: string;
  targetFlowId?: string;
}

export interface KeyboardRow {
  id: string;
  buttons: KeyboardButton[];
}

export interface KeyboardConfig {
  type: KeyboardType;
  rows: KeyboardRow[];
  oneTimeKeyboard?: boolean; // For reply keyboard
  resizeKeyboard?: boolean; // For reply keyboard
  placeholder?: string; // Input field placeholder
}

// Parse mode for Telegram messages
export type ParseMode = 'Markdown' | 'MarkdownV2' | 'HTML' | undefined;

// Message blocks - each can have its own keyboard
export interface TextBlock {
  id: string;
  type: 'text';
  content: string; // Supports {{variables}}
  parseMode?: ParseMode; // Markdown formatting mode
  keyboard?: KeyboardConfig; // Optional keyboard for this block
}

export interface ImageBlock {
  id: string;
  type: 'image';
  url: string;
  caption?: string; // Supports {{variables}}
  parseMode?: ParseMode; // Markdown formatting mode for caption
  keyboard?: KeyboardConfig; // Optional keyboard for this block
}

export interface DocumentBlock {
  id: string;
  type: 'document';
  url: string;
  filename?: string;
  caption?: string;
  parseMode?: ParseMode; // Markdown formatting mode for caption
  keyboard?: KeyboardConfig; // Optional keyboard for this block
}

export interface AudioBlock {
  id: string;
  type: 'audio';
  url: string;
  isVoiceNote?: boolean;
  keyboard?: KeyboardConfig; // Optional keyboard for this block
}

export interface VideoBlock {
  id: string;
  type: 'video';
  url: string;
  caption?: string;
  parseMode?: ParseMode; // Markdown formatting mode for caption
  keyboard?: KeyboardConfig; // Optional keyboard for this block
}

export interface DelayBlock {
  id: string;
  type: 'delay';
  seconds: number;
  // No keyboard for delay blocks
}

export type MessageBlock = TextBlock | ImageBlock | DocumentBlock | AudioBlock | VideoBlock | DelayBlock;

// ============= DATA COLLECTION =============

export type DataCollectionType = 'text' | 'email' | 'phone' | 'number' | 'url' | 'date' | 'choice';

export interface DataCollectionValidation {
  type: DataCollectionType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string; // Regex
  errorMessage?: string;
}

export interface DataCollectionChoice {
  id: string;
  label: string;
  value: string;
}

export interface DataCollectionConfig {
  question: string; // Supports {{variables}}
  variableName: string; // Where to store the response
  validationType: DataCollectionType;
  validation?: DataCollectionValidation;
  choices?: DataCollectionChoice[]; // For 'choice' type
  expiresInMinutes?: number;
  maxRetries?: number;
  onExpireAction?: 'continue' | 'goto_node' | 'end_flow';
  onExpireNodeId?: string;
  errorMessage?: string;
}

// ============= ENHANCED ACTION CONFIG =============

export interface ActionConfig {
  actionType: ActionType;
  // Legacy text content (backward compatible)
  messageContent?: string;
  messageType?: 'text' | 'image' | 'document';
  mediaUrl?: string;
  // New: Message blocks (ordered content)
  messageBlocks?: MessageBlock[];
  // New: Keyboard
  keyboard?: KeyboardConfig;
  // New: Data collection
  dataCollection?: DataCollectionConfig;
  // Existing configs...
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
  // API Call (advanced HTTP)
  apiCallConfig?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    url?: string;
    headers?: Array<{ id: string; key: string; value: string; enabled: boolean }>;
    queryParams?: Array<{ id: string; key: string; value: string; enabled: boolean }>;
    bodyType?: 'none' | 'json' | 'form-data' | 'x-www-form-urlencoded' | 'raw';
    body?: string;
    authType?: 'none' | 'bearer' | 'basic' | 'api-key';
    authConfig?: {
      bearerToken?: string;
      basicUsername?: string;
      basicPassword?: string;
      apiKeyName?: string;
      apiKeyValue?: string;
      apiKeyLocation?: 'header' | 'query';
    };
    timeout?: number;
    retryCount?: number;
    retryDelay?: number;
    successCodes?: number[];
    extractVariables?: Array<{ id: string; variableName: string; jsonPath: string; defaultValue?: string }>;
    onError?: 'continue' | 'stop' | 'goto_node';
    errorNodeId?: string;
    saveErrorTo?: string;
    saveResponseTo?: string;
    saveStatusCodeTo?: string;
  };
  customFieldName?: string;
  customFieldValue?: string;
  surveyType?: 'csat' | 'nps';
  queuePriority?: 'low' | 'normal' | 'high' | 'urgent';
  
  // === NEW TELEGRAM ACTION CONFIGS ===
  
  // edit_message: Edit text of a previously sent message
  editMessageConfig?: {
    targetType: 'last_bot_message' | 'variable' | 'specific_id';
    messageIdVariable?: string;  // Variable containing message_id
    specificMessageId?: number;
    newText: string;  // New text content (supports placeholders)
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    updateKeyboard?: boolean;  // Whether to also update the inline keyboard
    newKeyboard?: KeyboardConfig;
  };
  
  // delete_message: Delete a message
  deleteMessageConfig?: {
    targetType: 'last_bot_message' | 'last_user_message' | 'variable' | 'specific_id';
    messageIdVariable?: string;
    specificMessageId?: number;
  };
  
  // edit_keyboard: Modify inline keyboard of a message
  editKeyboardConfig?: {
    targetType: 'last_bot_message' | 'variable' | 'specific_id';
    messageIdVariable?: string;
    specificMessageId?: number;
    operation: 'replace' | 'add_row' | 'remove_row' | 'disable_button' | 'remove';
    newKeyboard?: KeyboardConfig;
    buttonToDisable?: string;  // callback_data of button to disable
  };
  
  // send_reply_keyboard: Send a reply keyboard (persistent menu)
  replyKeyboardConfig?: {
    rows: Array<{
      id: string;
      buttons: Array<{
        id: string;
        text: string;
        type: 'text' | 'contact' | 'location' | 'poll';
        pollType?: 'quiz' | 'regular';
      }>;
    }>;
    resizeKeyboard?: boolean;
    oneTimeKeyboard?: boolean;
    inputPlaceholder?: string;
    isPersistent?: boolean;
    messageText?: string;  // Message to send with the keyboard
  };
  
  // send_chat_action: Show typing, uploading, etc.
  chatActionConfig?: {
    action: 'typing' | 'upload_photo' | 'record_video' | 'upload_video' | 
            'record_voice' | 'upload_voice' | 'upload_document' | 'find_location';
    simulateDuration?: number;  // Duration in seconds to simulate the action
  };
  
  // pin/unpin message
  pinMessageConfig?: {
    targetType: 'last_bot_message' | 'variable' | 'specific_id';
    messageIdVariable?: string;
    specificMessageId?: number;
    disableNotification?: boolean;
  };
  
  // save_message_id: Store the last sent message ID in a variable
  saveMessageIdConfig?: {
    variableName: string;
    messageSource: 'last_bot_message' | 'last_user_message';
  };
  
  // delay_action: Wait without pausing flow
  delayActionConfig?: {
    delaySeconds: number;
    showTyping?: boolean;  // Show typing indicator during delay
  };
  
  // send_location
  locationConfig?: {
    latitude: string;  // Can be placeholder
    longitude: string;
    livePeriod?: number;  // For live location (60-86400 seconds)
  };
  
  // send_contact
  contactConfig?: {
    phoneNumber: string;
    firstName: string;
    lastName?: string;
  };
  
  // send_sticker
  stickerConfig?: {
    stickerSource: 'file_id' | 'url';
    stickerId?: string;
    stickerUrl?: string;
  };
  
  // run_subflow
  subflowConfig?: {
    flowId: string;
    passVariables?: boolean;  // Pass current variables to subflow
    waitForCompletion?: boolean;  // Wait for subflow to complete
    variablesToPass?: string[];  // Specific variables to pass
  };
  
  // i18n Text Configuration - Determines which language to use for {{TEXT.KEY}} placeholders
  i18nConfig?: {
    source: 'user_language' | 'custom_field' | 'variable' | 'fixed';
    customFieldName?: string;  // When source is 'custom_field', use this field to get language
    variableName?: string;     // When source is 'variable', use this variable to get language
    fixedLanguage?: string;    // When source is 'fixed', use this specific language (e.g., 'es', 'en')
  };
  
  // schedule_message: Enhanced scheduled message configuration
  scheduleMessageConfig?: {
    type: 'fixed_time' | 'after_inactivity' | 'on_event';
    // For fixed_time: specific date/time or relative time
    scheduledAt?: string;  // ISO date or placeholder like {{date.tomorrow}}
    // For after_inactivity: minutes of inactivity before sending
    delayMinutes?: number;
    // For on_event: trigger on specific events
    triggerEvent?: 'agent_online' | 'chat_assigned' | 'chat_reopened' | 'sla_warning' | 'chat_transferred';
    // Message content (same as send_message)
    messageContent?: string;
    messageBlocks?: MessageBlock[];
    keyboard?: KeyboardConfig;
    // Cancellation options
    cancelOnUserResponse?: boolean;  // Cancel if user responds before scheduled time
    cancelOnChatClose?: boolean;     // Cancel if chat is closed
    // Expiration
    expiresInHours?: number;  // Message expires after X hours if not sent
  };
}

export interface DelayConfig {
  delayType: DelayType;
  delayMinutes?: number;
  delaySeconds?: number;  // More granular delay
  maxWaitMinutes?: number;
  waitCondition?: ConditionConfig;
  cancelOnChatClose?: boolean;
  cancelOnUserResponse?: boolean;
  showTypingDuringWait?: boolean;  // Show typing indicator while waiting
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
  publishedAt: string;
  createdBy: { id: string; name: string } | null;
  publishedBy?: { id: string; name: string } | null;
  changeDescription?: string;
  nodes?: FlowNode[];
  edges?: FlowEdge[];
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
  output?: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

export interface SimulationResult {
  flow: { id: string; name: string };
  triggerType: string;
  steps: SimulationStep[];
  wouldComplete: boolean;
  success: boolean;
  stepsExecuted: number;
  totalDuration: number;
  warnings?: string[];
  error?: string;
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
  command_received: 'Comando recibido',
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
  button_clicked: 'Botón presionado',
};

export const ACTION_LABELS: Record<ActionType, string> = {
  // === MENSAJES ===
  send_message: 'Enviar mensaje',
  schedule_message: 'Programar mensaje',
  edit_message: 'Editar mensaje',
  delete_message: 'Eliminar mensaje',
  copy_message: 'Copiar mensaje',
  
  // === TECLADOS ===
  edit_keyboard: 'Editar teclado inline',
  remove_keyboard: 'Eliminar teclado inline',
  send_reply_keyboard: 'Enviar teclado reply',
  remove_reply_keyboard: 'Eliminar teclado reply',
  
  // === ACCIONES DE CHAT ===
  send_chat_action: 'Mostrar acción (typing...)',
  pin_message: 'Fijar mensaje',
  unpin_message: 'Desfijar mensaje',
  
  // === GESTIÓN ===
  transfer_chat: 'Transferir chat',
  assign_agent: 'Asignar agente',
  change_category: 'Cambiar categoría',
  add_tag: 'Añadir tag',
  remove_tag: 'Remover tag',
  create_note: 'Crear nota',
  block_user: 'Bloquear usuario',
  close_chat: 'Cerrar chat',
  reopen_chat: 'Reabrir chat',
  add_to_queue: 'Añadir a cola',
  escalate: 'Escalar',
  
  // === DATOS ===
  set_custom_field: 'Guardar en campo',
  save_message_id: 'Guardar ID mensaje',
  wait_for_response: 'Esperar respuesta',
  
  // === MULTIMEDIA ===
  send_location: 'Enviar ubicación',
  send_contact: 'Enviar contacto',
  send_sticker: 'Enviar sticker',
  
  // === INTEGRACIONES ===
  call_webhook: 'Llamar webhook',
  api_call: 'Llamar API',
  send_survey: 'Enviar encuesta',
  
  // === CONTROL DE FLUJO ===
  delay_action: 'Esperar (delay)',
  run_subflow: 'Ejecutar sub-flow',
};

// Action categories for UI grouping
export const ACTION_CATEGORIES = {
  messages: {
    label: '💬 Mensajes',
    actions: ['send_message', 'schedule_message', 'edit_message', 'delete_message', 'copy_message'],
  },
  keyboards: {
    label: '⌨️ Teclados',
    actions: ['edit_keyboard', 'remove_keyboard', 'send_reply_keyboard', 'remove_reply_keyboard'],
  },
  chatActions: {
    label: '💭 Acciones de Chat',
    actions: ['send_chat_action', 'pin_message', 'unpin_message'],
  },
  management: {
    label: '👤 Gestión',
    actions: ['transfer_chat', 'assign_agent', 'change_category', 'add_tag', 'remove_tag', 'create_note', 'block_user', 'close_chat', 'reopen_chat', 'add_to_queue', 'escalate'],
  },
  data: {
    label: '📊 Datos',
    actions: ['set_custom_field', 'save_message_id', 'wait_for_response'],
  },
  media: {
    label: '📍 Multimedia',
    actions: ['send_location', 'send_contact', 'send_sticker'],
  },
  integrations: {
    label: '🔗 Integraciones',
    actions: ['call_webhook', 'api_call', 'send_survey'],
  },
  flowControl: {
    label: '🔄 Control de Flujo',
    actions: ['delay_action', 'run_subflow'],
  },
} as const;

export const DELAY_LABELS: Record<DelayType, string> = {
  fixed_time: 'Tiempo fijo',
  until_response: 'Hasta respuesta',
  until_agent_online: 'Hasta agente online',
  until_business_hours: 'Hasta horario laboral',
  until_condition: 'Hasta condición',
};

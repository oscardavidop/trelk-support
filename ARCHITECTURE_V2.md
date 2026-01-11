# 🏢 Arquitectura Enterprise - Plataforma de Soporte en Tiempo Real v2.0

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Modo Supervisor](#1️⃣-modo-supervisor)
3. [Flujos y Automatización](#2️⃣-flujos-y-automatización-avanzada)
4. [Exportación Avanzada](#3️⃣-exportación-avanzada)
5. [UX/UI Premium](#4️⃣-uxui-premium)
6. [Seguridad y Control](#5️⃣-seguridad-y-control)
7. [Resiliencia](#6️⃣-resiliencia--edge-cases)
8. [AI Copilot](#7️⃣-bonus--copilot-de-soporte)
9. [Modelos de Base de Datos](#modelos-de-base-de-datos)
10. [API Endpoints](#api-endpoints)
11. [Eventos WebSocket](#eventos-websocket)
12. [Plan de Implementación](#plan-de-implementación)

---

## Visión General

### Stack Tecnológico
```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                       │
├─────────────────────────────────────────────────────────────────┤
│  Zustand (State)  │  Socket.IO Client  │  TailwindCSS 4        │
│  React Router     │  React Query       │  Framer Motion        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND (Fastify v5 + Node.js)               │
├─────────────────────────────────────────────────────────────────┤
│  Socket.IO Server  │  JWT Auth  │  Rate Limiter  │  Bull Queue │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────────┐
        │ MongoDB  │   │  Redis   │   │ Telegram Bot │
        │ (Data)   │   │ (Cache/  │   │    API       │
        │          │   │  Queues) │   │              │
        └──────────┘   └──────────┘   └──────────────┘
```

### Roles del Sistema
```
┌─────────────────────────────────────────────────────────────────┐
│                          ROLES                                   │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│    admin     │  supervisor  │   support    │     junior        │
├──────────────┼──────────────┼──────────────┼───────────────────┤
│ Full access  │ Live monitor │ Handle chats │ Limited access    │
│ Manage rules │ Whisper      │ Basic actions│ Supervised        │
│ View logs    │ View all     │ Own chats    │ Training mode     │
│ Config       │ Intervene    │ Transfer     │ Cannot close      │
└──────────────┴──────────────┴──────────────┴───────────────────┘
```

---

## 1️⃣ Modo Supervisor

### Arquitectura de Supervisión

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPERVISOR DASHBOARD                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Live Chats  │  │ Queue       │  │ SLA Alerts  │             │
│  │ 🟢 12 active│  │ 🟡 5 waiting│  │ 🔴 3 at risk│             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ AGENT GRID VIEW                                          │   │
│  │ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │   │
│  │ │ Maria       │ │ Carlos      │ │ Ana         │         │   │
│  │ │ 🟢 3 chats  │ │ 🟡 5 chats  │ │ 🔴 Offline  │         │   │
│  │ │ Avg: 2.5min │ │ Avg: 4.1min │ │ Last: 10min │         │   │
│  │ └─────────────┘ └─────────────┘ └─────────────┘         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LIVE CHAT PREVIEW (Read-only)                            │   │
│  │ ┌────────────────────────────┬────────────────────────┐ │   │
│  │ │ Chat: User #4521           │ [Whisper] [Take Over]  │ │   │
│  │ ├────────────────────────────┴────────────────────────┤ │   │
│  │ │ User: "Necesito un reembolso urgente"               │ │   │
│  │ │ Agent: "Permítame verificar su cuenta..."           │ │   │
│  │ │ ─────────────────────────────────────────────────── │ │   │
│  │ │ 💬 Whisper Box:                                     │ │   │
│  │ │ [Recuerda ofrecer crédito de tienda como opción]    │ │   │
│  │ └─────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Modelo: SupervisorSession
```typescript
interface SupervisorSession {
  _id: ObjectId;
  supervisorId: ObjectId;        // Agent with supervisor role
  watchingSessions: string[];    // Array of sessionIds being watched
  activeWhispers: {
    sessionId: string;
    agentId: ObjectId;
    createdAt: Date;
  }[];
  connectedAt: Date;
  lastActivity: Date;
}
```

### Modelo: Whisper (Susurros)
```typescript
interface Whisper {
  _id: ObjectId;
  sessionId: string;             // Chat session
  fromSupervisor: ObjectId;      // Who sent it
  toAgent: ObjectId;             // Target agent
  content: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}
```

### Flujo de Whisper
```
┌────────────┐      ┌────────────┐      ┌────────────┐
│ Supervisor │      │   Server   │      │   Agent    │
└─────┬──────┘      └─────┬──────┘      └─────┬──────┘
      │                   │                   │
      │ whisper:send      │                   │
      │──────────────────>│                   │
      │                   │ Save to DB        │
      │                   │───────┐           │
      │                   │<──────┘           │
      │                   │                   │
      │                   │ whisper:received  │
      │                   │──────────────────>│
      │                   │                   │
      │                   │                   │ Show in UI
      │                   │                   │ (private badge)
      │                   │                   │
      │                   │ whisper:read      │
      │                   │<──────────────────│
      │ whisper:status    │                   │
      │<──────────────────│                   │
```

### UI del Whisper en Dashboard del Agente
```
┌────────────────────────────────────────────────────────────────┐
│ Chat with User #4521                                            │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│ User: "Necesito un reembolso por mi pedido cancelado"          │
│                                                                  │
│ ┌──────────────────────────────────────────────────────────┐   │
│ │ 👁️ WHISPER from Supervisor Maria          [Private]     │   │
│ │ ──────────────────────────────────────────────────────── │   │
│ │ "Ofrece primero crédito de tienda. Si insiste, procesa   │   │
│ │  el reembolso pero menciona que tarda 5-7 días hábiles"  │   │
│ └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│ You: "Entiendo su situación. Tengo algunas opciones..."        │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

---

## 2️⃣ Flujos y Automatización Avanzada

### 🧠 Auto-Routing Inteligente

#### Arquitectura del Router
```
┌─────────────────────────────────────────────────────────────────┐
│                      SMART ROUTER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐                                                │
│  │ New Chat     │                                                │
│  │ Arrives      │                                                │
│  └──────┬───────┘                                                │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 1. LANGUAGE DETECTION                                    │   │
│  │    • Detect from message content                         │   │
│  │    • Check user's Telegram language                      │   │
│  │    • Match to agent language skills                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 2. CATEGORY DETECTION                                    │   │
│  │    • Keyword matching (refund, bug, billing, etc.)       │   │
│  │    • AI classification (optional)                        │   │
│  │    • User-selected category                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 3. AGENT SCORING                                         │   │
│  │    Score = (availability × 0.4) +                        │   │
│  │            (skill_match × 0.3) +                         │   │
│  │            (current_load × 0.2) +                        │   │
│  │            (response_time × 0.1)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 4. ASSIGNMENT                                            │   │
│  │    • Assign to highest scoring available agent           │   │
│  │    • If no match → Queue with priority                   │   │
│  │    • Notify agent via WebSocket                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Modelo: RoutingRule
```typescript
interface RoutingRule {
  _id: ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;                    // Lower = higher priority
  
  conditions: {
    field: 'category' | 'language' | 'keywords' | 'userTags' | 'time';
    operator: 'equals' | 'contains' | 'notContains' | 'in' | 'between';
    value: string | string[] | number[];
  }[];
  
  conditionLogic: 'AND' | 'OR';
  
  action: {
    type: 'assignToAgent' | 'assignToTeam' | 'addToQueue' | 'escalate';
    targetId?: ObjectId;               // Agent or Team ID
    queuePriority?: 'low' | 'normal' | 'high' | 'urgent';
  };
  
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Modelo: AgentSkills
```typescript
interface AgentSkills {
  _id: ObjectId;
  agentId: ObjectId;
  
  // Languages (ISO 639-1 codes)
  languages: {
    code: string;           // 'es', 'en', 'pt', etc.
    proficiency: 'basic' | 'intermediate' | 'fluent' | 'native';
  }[];
  
  // Categories/Specializations
  specializations: {
    category: string;       // 'billing', 'technical', 'sales', etc.
    level: 'junior' | 'senior' | 'specialist';
  }[];
  
  // Limits
  maxConcurrentChats: number;  // Override global default
  
  // Performance metrics (auto-updated)
  metrics: {
    avgResponseTime: number;    // seconds
    avgResolutionTime: number;  // seconds
    satisfactionScore: number;  // 1-5
    totalResolved: number;
  };
}
```

### ⚙️ Sistema de Reglas Automáticas

#### Arquitectura de Reglas
```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTOMATION RULES ENGINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ TRIGGERS                                                   │  │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │
│  │ │ Timer   │ │ Message │ │ State   │ │ Rating  │          │  │
│  │ │ Events  │ │ Events  │ │ Change  │ │ Events  │          │  │
│  │ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │  │
│  └──────┼───────────┼───────────┼───────────┼────────────────┘  │
│         │           │           │           │                    │
│         └───────────┴─────┬─────┴───────────┘                    │
│                           ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ CONDITION EVALUATOR                                        │  │
│  │                                                            │  │
│  │ IF (condition1 AND condition2) OR condition3               │  │
│  │    └─ Field: user.inactiveMinutes >= 10                   │  │
│  │    └─ Field: session.status == 'waiting'                  │  │
│  │    └─ Field: message.contains('refund')                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                           ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ACTIONS                                                    │  │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │  │
│  │ │ Close Chat   │ │ Send Message │ │ Alert        │        │  │
│  │ │ Auto-assign  │ │ Add Tag      │ │ Escalate     │        │  │
│  │ │ Transfer     │ │ Block User   │ │ Log Event    │        │  │
│  │ └──────────────┘ └──────────────┘ └──────────────┘        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                           │                                       │
│                           ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ AUDIT LOG                                                  │  │
│  │ • Rule ID, Trigger, Actions, Timestamp, Session           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

#### Modelo: AutomationRule
```typescript
interface AutomationRule {
  _id: ObjectId;
  name: string;
  description?: string;
  isActive: boolean;
  priority: number;
  
  // Trigger type
  trigger: {
    type: 'timer' | 'message' | 'stateChange' | 'rating' | 'connection' | 'manual';
    config: {
      // For timer
      intervalMinutes?: number;
      
      // For message
      keywords?: string[];
      regex?: string;
      sender?: 'user' | 'agent' | 'any';
      
      // For stateChange
      fromStatus?: string[];
      toStatus?: string[];
      
      // For rating
      ratingThreshold?: number;
      comparison?: 'lte' | 'gte' | 'eq';
    };
  };
  
  // Conditions (all must be true)
  conditions: {
    field: string;                 // 'session.status', 'user.tags', etc.
    operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'in';
    value: unknown;
  }[];
  
  // Actions to execute
  actions: {
    type: 'closeSession' | 'sendMessage' | 'transfer' | 'escalate' | 
          'addTag' | 'alert' | 'block' | 'assignAgent' | 'setCategory';
    config: Record<string, unknown>;
    delay?: number;                // Delay in seconds before executing
  }[];
  
  // Execution limits
  limits: {
    maxExecutionsPerSession?: number;
    cooldownMinutes?: number;
  };
  
  // Audit
  lastExecutedAt?: Date;
  executionCount: number;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

#### Modelo: RuleExecution (Audit Log)
```typescript
interface RuleExecution {
  _id: ObjectId;
  ruleId: ObjectId;
  ruleName: string;
  sessionId: string;
  userId?: ObjectId;
  agentId?: ObjectId;
  
  trigger: {
    type: string;
    data: Record<string, unknown>;
  };
  
  conditionsEvaluated: {
    field: string;
    expected: unknown;
    actual: unknown;
    passed: boolean;
  }[];
  
  actionsExecuted: {
    type: string;
    success: boolean;
    error?: string;
    result?: Record<string, unknown>;
  }[];
  
  executedAt: Date;
}
```

### ⏱️ Mensajes Programados Inteligentes

#### Modelo: ScheduledMessage
```typescript
interface ScheduledMessage {
  _id: ObjectId;
  sessionId?: string;              // Optional: specific session
  userId?: ObjectId;               // Optional: specific user
  
  // When to send
  schedule: {
    type: 'immediate' | 'delayed' | 'conditional';
    
    // For delayed
    sendAt?: Date;
    
    // For conditional
    condition?: {
      event: 'userInactive' | 'agentConnected' | 'chatInQueue' | 'custom';
      thresholdMinutes?: number;
      customCondition?: string;    // Expression to evaluate
    };
  };
  
  // Message content
  message: {
    content: string;
    sender: 'bot' | 'system';
    messageType: 'text' | 'image' | 'document';
    mediaUrl?: string;
  };
  
  // Status
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  sentAt?: Date;
  error?: string;
  
  // Meta
  createdBy: ObjectId;
  createdAt: Date;
}
```

---

## 3️⃣ Exportación Avanzada

### Formatos de Exportación
```
┌─────────────────────────────────────────────────────────────────┐
│                    EXPORT SYSTEM                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ EXPORT OPTIONS                                              │ │
│  │                                                             │ │
│  │ Content:                                                    │ │
│  │ ☑ Conversation messages                                    │ │
│  │ ☑ Internal notes                                           │ │
│  │ ☐ System logs                                              │ │
│  │ ☐ Agent actions                                            │ │
│  │                                                             │ │
│  │ Format:                                                     │ │
│  │ ○ PDF (Presentable, with branding)                         │ │
│  │ ○ JSON (Full data, for integrations)                       │ │
│  │ ○ CSV (Tabular, for analytics)                             │ │
│  │                                                             │ │
│  │ Filters:                                                    │ │
│  │ Date: [From: ____] [To: ____]                              │ │
│  │ Agent: [All ▼]                                              │ │
│  │ Category: [All ▼]                                           │ │
│  │ Status: [All ▼]                                             │ │
│  │                                                             │ │
│  │                               [Cancel] [Export]             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Modelo: ExportJob
```typescript
interface ExportJob {
  _id: ObjectId;
  
  // What to export
  type: 'session' | 'sessions' | 'analytics' | 'audit';
  
  // For single session
  sessionId?: string;
  
  // For multiple sessions
  filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    agentIds?: ObjectId[];
    categories?: string[];
    statuses?: string[];
    userIds?: ObjectId[];
  };
  
  // What to include
  include: {
    messages: boolean;
    notes: boolean;
    systemLogs: boolean;
    agentActions: boolean;
    transfers: boolean;
    ratings: boolean;
  };
  
  // Output format
  format: 'pdf' | 'json' | 'csv';
  
  // PDF options
  pdfOptions?: {
    includeBranding: boolean;
    logoUrl?: string;
    companyName?: string;
  };
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;              // 0-100
  fileUrl?: string;              // Download URL when ready
  fileSize?: number;
  error?: string;
  
  // Meta
  requestedBy: ObjectId;
  requestedAt: Date;
  completedAt?: Date;
  expiresAt?: Date;              // Auto-delete after this
}
```

---

## 4️⃣ UX/UI Premium

### 🌗 Modo Focus

```
┌─────────────────────────────────────────────────────────────────┐
│ NORMAL MODE                                                      │
├───────────────────┬─────────────────────────────────────────────┤
│                   │                                              │
│ ┌───────────────┐ │ ┌─────────────────────────────────────────┐ │
│ │ Session List  │ │ │ Chat Window                             │ │
│ │               │ │ │                                         │ │
│ │ • User 1      │ │ │                                         │ │
│ │ • User 2 🔴   │ │ │                                         │ │
│ │ • User 3      │ │ │                                         │ │
│ │               │ │ │                                         │ │
│ └───────────────┘ │ └─────────────────────────────────────────┘ │
│                   │                                              │
└───────────────────┴─────────────────────────────────────────────┘

                            ↓ [F11 or Toggle]

┌─────────────────────────────────────────────────────────────────┐
│ FOCUS MODE                                            [Exit ✕]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │                    CHAT WINDOW                             │ │
│  │                   (Maximized)                              │ │
│  │                                                            │ │
│  │  User: "Necesito ayuda con mi pedido"                     │ │
│  │                                                            │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │ Message input... (/ for quick replies)              │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Quick Actions: [Close Alt+C] [Transfer Alt+T] [Tag Alt+G] │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### ⌨️ Keyboard Shortcuts

```typescript
const KEYBOARD_SHORTCUTS = {
  // Message actions
  'Ctrl+Enter': 'Send message',
  '/': 'Open quick replies',
  'Escape': 'Close modal / Cancel',
  
  // Chat actions
  'Alt+C': 'Close current chat',
  'Alt+T': 'Transfer chat',
  'Alt+N': 'Add internal note',
  'Alt+G': 'Add/remove tags',
  'Alt+P': 'Pin message',
  
  // Navigation
  'Alt+↑': 'Previous chat',
  'Alt+↓': 'Next chat',
  'Alt+1-9': 'Switch to chat 1-9',
  
  // View modes
  'F11': 'Toggle Focus mode',
  'Ctrl+B': 'Toggle sidebar',
  'Ctrl+I': 'Toggle info panel',
  
  // Quick access
  'Ctrl+K': 'Command palette',
  'Ctrl+F': 'Search in chat',
  'Ctrl+Shift+F': 'Global search',
  
  // Help
  '?': 'Show shortcuts help',
};
```

### 📜 Sidebar con Logs

```
┌─────────────────────────────────────────────────────────────────┐
│ CHAT INFO SIDEBAR                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ [User Info] [Notes] [Tags] [History] [Logs]                     │
│                                    ─────                         │
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ ACTIVITY LOG                                                  ││
│ ├──────────────────────────────────────────────────────────────┤│
│ │                                                               ││
│ │ 🕐 14:32 • Chat created                                      ││
│ │           Category: Billing                                   ││
│ │                                                               ││
│ │ 🟢 14:32 • Assigned to Maria                                 ││
│ │           Auto-routing: Language match                        ││
│ │                                                               ││
│ │ 💬 14:35 • First response sent                               ││
│ │           Response time: 3 min                                ││
│ │                                                               ││
│ │ 👁️ 14:40 • Supervisor viewing                                ││
│ │           Carlos (Supervisor)                                 ││
│ │                                                               ││
│ │ 💬 14:41 • Whisper received                                  ││
│ │           From: Carlos                                        ││
│ │                                                               ││
│ │ 🔄 14:45 • Transferred to Juan                               ││
│ │           Reason: Escalation to senior                        ││
│ │                                                               ││
│ │ ✏️ 14:50 • Message edited                                    ││
│ │           By: Juan                                            ││
│ │                                                               ││
│ │ ⭐ 15:00 • Rating received: 5/5                              ││
│ │           Comment: "Excelente atención"                       ││
│ │                                                               ││
│ │ ✅ 15:01 • Chat closed                                       ││
│ │           By: Juan • Reason: Resolved                         ││
│ │                                                               ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Modelo: ActivityLog
```typescript
interface ActivityLog {
  _id: ObjectId;
  sessionId: string;
  
  // What happened
  action: 
    | 'session_created'
    | 'session_assigned'
    | 'session_transferred'
    | 'session_closed'
    | 'session_reopened'
    | 'message_sent'
    | 'message_edited'
    | 'message_deleted'
    | 'message_pinned'
    | 'note_added'
    | 'tag_added'
    | 'tag_removed'
    | 'category_changed'
    | 'whisper_sent'
    | 'whisper_read'
    | 'supervisor_viewing'
    | 'supervisor_stopped'
    | 'rating_received'
    | 'rule_triggered'
    | 'user_blocked'
    | 'first_response';
  
  // Who did it
  actor: {
    type: 'user' | 'agent' | 'supervisor' | 'system' | 'rule';
    id?: ObjectId;
    name?: string;
  };
  
  // Additional context
  metadata: Record<string, unknown>;
  
  // Human-readable description
  description: string;
  
  createdAt: Date;
}
```

---

## 5️⃣ Seguridad y Control

### 🔐 Sistema de Auditoría

```typescript
interface AuditLog {
  _id: ObjectId;
  
  // What was done
  action: string;                // 'message.delete', 'rule.create', etc.
  category: 'message' | 'session' | 'agent' | 'rule' | 'settings' | 'export' | 'security';
  
  // Who did it
  actorId: ObjectId;
  actorType: 'agent' | 'admin' | 'system';
  actorName: string;
  actorIp: string;
  actorUserAgent: string;
  
  // What was affected
  targetType: 'message' | 'session' | 'user' | 'agent' | 'rule' | 'setting';
  targetId: string;
  
  // Changes
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  
  // Context
  sessionId?: string;
  requestId?: string;
  
  // Risk level
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  createdAt: Date;
}
```

### 🚨 Detección de Abuso

```typescript
interface AbuseDetection {
  // Rate limits per user
  rateLimits: {
    messagesPerMinute: number;      // Default: 10
    filesPerHour: number;           // Default: 20
    maxFileSizeMB: number;          // Default: 25
    maxMessageLength: number;       // Default: 4000
  };
  
  // Detection patterns
  patterns: {
    spamKeywords: string[];
    blockedDomains: string[];
    blockedFileTypes: string[];
  };
  
  // Actions
  actions: {
    onSpamDetected: 'warn' | 'tempBlock' | 'permBlock';
    tempBlockDurationMinutes: number;
    alertSupervisor: boolean;
  };
}

interface UserRateLimit {
  _id: ObjectId;
  telegramId: number;
  
  // Counters (reset periodically)
  messageCount: number;
  messageWindowStart: Date;
  
  fileCount: number;
  fileWindowStart: Date;
  
  // Violations
  violations: {
    type: 'rateLimit' | 'spam' | 'largeFile' | 'blockedContent';
    count: number;
    lastOccurrence: Date;
  }[];
  
  // Current status
  isTemporarilyBlocked: boolean;
  blockExpiresAt?: Date;
  
  updatedAt: Date;
}
```

---

## 6️⃣ Resiliencia & Edge Cases

### 🔁 Reasignación Automática

```
┌─────────────────────────────────────────────────────────────────┐
│                  AGENT DISCONNECT FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Agent Disconnects                                                │
│        │                                                          │
│        ▼                                                          │
│  ┌──────────────────┐                                            │
│  │ Start Grace      │  (5 minutes by default)                    │
│  │ Period Timer     │                                            │
│  └────────┬─────────┘                                            │
│           │                                                       │
│           ├──────────────────────────────────┐                   │
│           │                                  │                   │
│           ▼                                  ▼                   │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │ Agent Reconnects │              │ Timer Expires    │         │
│  │ within grace     │              │ (still offline)  │         │
│  └────────┬─────────┘              └────────┬─────────┘         │
│           │                                  │                   │
│           ▼                                  ▼                   │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │ Restore all      │              │ For each active  │         │
│  │ active chats     │              │ chat:            │         │
│  │ • Same position  │              │ 1. Add to queue  │         │
│  │ • Same drafts    │              │ 2. Mark priority │         │
│  │ • No interruption│              │ 3. Notify team   │         │
│  └──────────────────┘              │ 4. Log event     │         │
│                                    └──────────────────┘         │
│                                             │                    │
│                                             ▼                    │
│                                    ┌──────────────────┐         │
│                                    │ Auto-assign to   │         │
│                                    │ next available   │         │
│                                    │ agent            │         │
│                                    └──────────────────┘         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### ♻️ Recuperación de Sesión

```typescript
interface AgentSessionState {
  _id: ObjectId;
  agentId: ObjectId;
  
  // Active chats state
  activeChats: {
    sessionId: string;
    scrollPosition?: number;
    draft?: string;
    lastViewedMessageId?: string;
    openedAt: Date;
  }[];
  
  // UI state
  uiState: {
    activeTab: string;
    sidebarOpen: boolean;
    focusModeEnabled: boolean;
    selectedSessionId?: string;
  };
  
  // Drafts (auto-saved)
  drafts: {
    sessionId: string;
    content: string;
    savedAt: Date;
  }[];
  
  // Last known state
  lastSyncAt: Date;
  lastDisconnectAt?: Date;
  
  updatedAt: Date;
}
```

---

## 7️⃣ BONUS — Copilot de Soporte

### Arquitectura del AI Copilot

```
┌─────────────────────────────────────────────────────────────────┐
│                       AI COPILOT                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ COPILOT SIDEBAR (Collapsible)                              │ │
│  │                                                             │ │
│  │ ┌──────────────────────────────────────────────────────┐  │ │
│  │ │ 📝 CONVERSATION SUMMARY                              │  │ │
│  │ │ ─────────────────────────────────────────────────── │  │ │
│  │ │ User requested refund for order #12345 due to       │  │ │
│  │ │ delayed delivery. Agent offered store credit but    │  │ │
│  │ │ user insists on full refund. Conversation ongoing.  │  │ │
│  │ │                                   [Refresh] [Copy]  │  │ │
│  │ └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │ ┌──────────────────────────────────────────────────────┐  │ │
│  │ │ 🏷️ SUGGESTED CATEGORY                                │  │ │
│  │ │ ─────────────────────────────────────────────────── │  │ │
│  │ │ 🔹 Refunds (85% confidence)                         │  │ │
│  │ │ 🔸 Shipping Issues (12%)                            │  │ │
│  │ │ 🔸 Order Problems (3%)                              │  │ │
│  │ │                                            [Apply]  │  │ │
│  │ └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │ ┌──────────────────────────────────────────────────────┐  │ │
│  │ │ ✍️ SUGGESTED RESPONSE                                │  │ │
│  │ │ ─────────────────────────────────────────────────── │  │ │
│  │ │ "Entiendo su frustración con el retraso. He         │  │ │
│  │ │  procesado su reembolso completo de $XX.XX que      │  │ │
│  │ │  verá reflejado en 3-5 días hábiles. ¿Hay algo      │  │ │
│  │ │  más en lo que pueda ayudarle?"                     │  │ │
│  │ │                                                      │  │ │
│  │ │                    [Insert] [Edit & Insert] [Skip]  │  │ │
│  │ └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │ ┌──────────────────────────────────────────────────────┐  │ │
│  │ │ ✅ RESOLUTION READINESS                              │  │ │
│  │ │ ─────────────────────────────────────────────────── │  │ │
│  │ │ 🟢 Chat appears ready to close                      │  │ │
│  │ │                                                      │  │ │
│  │ │ Indicators:                                          │  │ │
│  │ │ • User confirmed satisfaction ✓                     │  │ │
│  │ │ • Issue addressed ✓                                 │  │ │
│  │ │ • No pending questions ✓                            │  │ │
│  │ │                                                      │  │ │
│  │ │                          [Close Chat with Summary]  │  │ │
│  │ └──────────────────────────────────────────────────────┘  │ │
│  │                                                             │ │
│  │ ⚙️ Copilot Settings                                        │ │
│  │ ☑ Auto-suggest responses                                   │ │
│  │ ☑ Show category suggestions                                │ │
│  │ ☐ Auto-summarize on assignment                             │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Modelo: CopilotSuggestion
```typescript
interface CopilotSuggestion {
  _id: ObjectId;
  sessionId: string;
  
  type: 'summary' | 'category' | 'response' | 'closeReady' | 'escalation';
  
  content: {
    // For summary
    summary?: string;
    
    // For category
    categories?: {
      name: string;
      confidence: number;
    }[];
    
    // For response
    suggestedResponse?: string;
    
    // For close ready
    readyToClose?: boolean;
    indicators?: string[];
    
    // For escalation
    shouldEscalate?: boolean;
    reason?: string;
  };
  
  // Agent interaction
  status: 'pending' | 'accepted' | 'rejected' | 'modified';
  agentFeedback?: 'helpful' | 'notHelpful' | 'wrong';
  modifiedContent?: string;
  
  // Performance
  generationTimeMs: number;
  model: string;
  tokens: number;
  
  createdAt: Date;
  respondedAt?: Date;
}
```

---

## Modelos de Base de Datos (Nuevos)

### Resumen de Modelos Nuevos

| Modelo | Propósito |
|--------|-----------|
| `Whisper` | Mensajes privados supervisor → agente |
| `SupervisorSession` | Estado de supervisión en vivo |
| `RoutingRule` | Reglas de auto-routing |
| `AgentSkills` | Habilidades y métricas del agente |
| `AutomationRule` | Reglas IF/THEN automáticas |
| `RuleExecution` | Log de ejecución de reglas |
| `ScheduledMessage` | Mensajes programados |
| `ExportJob` | Trabajos de exportación |
| `ActivityLog` | Log de actividad del chat |
| `AuditLog` | Auditoría de seguridad |
| `UserRateLimit` | Control de rate limiting |
| `AgentSessionState` | Estado de sesión del agente |
| `CopilotSuggestion` | Sugerencias del AI Copilot |

---

## API Endpoints (Nuevos)

### Supervisor
```
GET    /api/supervisor/live                    # Vista en vivo de chats
GET    /api/supervisor/agents                  # Estado de agentes
POST   /api/supervisor/whisper                 # Enviar whisper
GET    /api/supervisor/sessions/:id/logs       # Logs del chat
POST   /api/supervisor/sessions/:id/takeover   # Tomar control
```

### Automation
```
GET    /api/rules                              # Listar reglas
POST   /api/rules                              # Crear regla
PUT    /api/rules/:id                          # Actualizar regla
DELETE /api/rules/:id                          # Eliminar regla
POST   /api/rules/:id/toggle                   # Activar/desactivar
GET    /api/rules/:id/executions               # Log de ejecuciones

GET    /api/routing                            # Reglas de routing
POST   /api/routing                            # Crear regla routing
```

### Export
```
POST   /api/export/session/:id                 # Exportar sesión
POST   /api/export/batch                       # Exportar múltiples
GET    /api/export/jobs                        # Listar trabajos
GET    /api/export/jobs/:id                    # Estado del trabajo
GET    /api/export/jobs/:id/download           # Descargar archivo
```

### Copilot
```
POST   /api/copilot/summarize                  # Resumir conversación
POST   /api/copilot/suggest-response           # Sugerir respuesta
POST   /api/copilot/categorize                 # Categorizar chat
POST   /api/copilot/close-readiness            # Evaluar cierre
POST   /api/copilot/feedback                   # Feedback del agente
```

---

## Eventos WebSocket (Nuevos)

### Supervisor
```typescript
// Server → Client
'supervisor:chatUpdate'          // Actualización de chat en vivo
'supervisor:agentStatus'         // Cambio de estado de agente
'supervisor:slaAlert'            // Alerta de SLA en riesgo

// Client → Server
'supervisor:watch'               // Empezar a observar chat
'supervisor:unwatch'             // Dejar de observar
'supervisor:whisper'             // Enviar whisper

// Whisper
'whisper:received'               // Nuevo whisper (para agente)
'whisper:read'                   // Whisper leído
```

### Automation
```typescript
'rule:triggered'                 // Regla ejecutada
'rule:action'                    // Acción de regla aplicada
'scheduled:sent'                 // Mensaje programado enviado
```

### Agent State
```typescript
'state:sync'                     // Sincronizar estado
'state:draft'                    // Guardar draft
'state:recovered'                // Sesión recuperada
```

---

## Plan de Implementación

### Fase 1: Fundamentos (2 semanas) ✅ COMPLETADO
- [x] Actualizar modelo Agent con roles (supervisor, junior)
- [x] Implementar ActivityLog
- [x] Implementar AuditLog
- [x] Crear UI de logs en sidebar (ActivityTimeline)

### Fase 2: Supervisor (2 semanas) ✅ COMPLETADO
- [x] Modelo Whisper
- [x] SupervisorService
- [x] Dashboard de supervisor (SupervisorPanel)
- [x] Vista en vivo de chats
- [x] Sistema de whispers (WhisperNotifications)
- [x] Rutas API supervisor

### Fase 3: Automatización (3 semanas) ✅ COMPLETADO (Backend)
- [x] Modelo AutomationRule
- [x] Modelo RuleExecution
- [x] Motor de reglas (automation-engine.service)
- [x] Modelo RoutingRule
- [x] Smart routing (smart-routing.service)
- [x] Modelo ScheduledMessage
- [x] Rutas API automatización
- [ ] UI para crear/editar reglas (pendiente)
- [ ] Procesador de mensajes programados (cron job)

### Fase 4: UX Premium (2 semanas) ✅ COMPLETADO
- [x] Modo Focus (useFocusMode hook + FocusModeIndicator)
- [x] Keyboard shortcuts (useKeyboardShortcuts hook)
- [x] Ayuda de atajos (KeyboardShortcutsHelp modal)
- [ ] Command palette (pendiente)
- [x] UI refinements

### Fase 5: Seguridad (1 semana) ✅ COMPLETADO (Backend)
- [x] Rate limiting por usuario (UserRateLimit model)
- [x] AuditLog con detección de anomalías
- [x] checkForAnomalies() en audit-log.service
- [ ] Panel de audit logs en admin (pendiente)

### Fase 6: Resiliencia (1 semana) ✅ COMPLETADO
- [x] AgentSessionState modelo
- [x] Stores persistidos con Zustand
- [ ] Recuperación de drafts (parcial - en composer)
- [ ] Reasignación automática en desconexión (pendiente)

### Fase 7: Exportación (1 semana) ✅ COMPLETADO (Backend)
- [x] ExportJob modelo
- [x] Generador HTML/PDF (export.service)
- [x] Generador CSV/JSON
- [x] Rutas API exportación
- [ ] UI para exportar (modal pendiente)

### Fase 8: AI Copilot (2 semanas) ✅ COMPLETADO (Backend + Frontend)
- [x] copilot.service (implementación placeholder)
- [x] CopilotSuggestion modelo
- [x] Rutas API copilot
- [x] CopilotPanel componente frontend
- [x] copilotStore para estado
- [ ] Integración LLM real (pendiente - placeholder implementado)

### Resumen de Progreso

| Componente | Backend | Frontend | Estado |
|------------|---------|----------|--------|
| Modelos de datos | ✅ 13+ modelos | N/A | Completo |
| Roles y permisos | ✅ | ✅ Tipos actualizados | Completo |
| Supervisor | ✅ Service + Routes | ✅ Panel + Whispers | Completo |
| Automatización | ✅ Engine + Routes | ⏳ UI pendiente | 80% |
| Exportación | ✅ Service + Routes | ⏳ Modal pendiente | 80% |
| UX Premium | N/A | ✅ Focus + Shortcuts | Completo |
| AI Copilot | ✅ Service + Routes | ✅ Panel | Completo (placeholder) |
| Socket Events | ✅ Eventos añadidos | ✅ Handlers | Completo |

---

## Métricas de Éxito

| Métrica | Target |
|---------|--------|
| Tiempo de respuesta inicial | < 2 minutos |
| Tiempo de resolución | < 15 minutos |
| Satisfacción del cliente | > 4.5/5 |
| Uptime del sistema | 99.9% |
| Recuperación de sesión | < 5 segundos |
| Precisión del routing | > 90% |
| Adopción del Copilot | > 60% |

---

*Documento de arquitectura v2.0 - Plataforma Enterprise de Soporte en Tiempo Real*

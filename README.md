# 🤖 Trelk Support Platform v2.0

Plataforma de soporte oficial para **@TrelkBot** con bot de Telegram, dashboard para agentes y comunicación en tiempo real.

**Bot Username:** @TrelkSupportBot  
**About:** Official TrelkBot support 🤖 @TrelkBot

## 📋 Descripción

Plataforma de soporte completa que incluye:
- **Bot de Telegram** con FAQ automatizadas y sistema de tickets
- **Dashboard Web** para agentes de soporte con chat en tiempo real
- **Persistencia en MongoDB** para historial de conversaciones
- **Socket.IO** para comunicación bidireccional en tiempo real

## ✨ Características

### Bot de Telegram
- **FAQ Automatizadas**: Respuestas instantáneas a preguntas frecuentes
- **Sistema de Tickets**: Recolección estructurada de problemas
- **Escalado a Humano**: Transferencia a agentes en tiempo real
- **Bilingüe**: Soporte completo en inglés y español
- **Anti-Spam**: Protección contra abuso y rate limiting

### Dashboard de Agentes
- **Chat en Tiempo Real**: Responde a usuarios directamente desde el navegador
- **Gestión de Sesiones**: Ver sesiones en espera, activas y cerradas
- **Autenticación JWT**: Login seguro para agentes
- **Estadísticas**: Dashboard con métricas en tiempo real
- **Roles**: Admin y Support con permisos diferenciados

## 🏗️ Arquitectura

```
src/
├── config/              # Configuración del sistema
│   └── index.ts
├── database/            # MongoDB + Mongoose
│   ├── connection.ts    # Conexión a MongoDB
│   ├── index.ts         # Exports
│   └── models/          # Modelos de datos
│       ├── User.ts      # Usuarios de Telegram
│       ├── Agent.ts     # Agentes del dashboard
│       ├── ChatSession.ts # Sesiones de chat
│       └── Message.ts   # Mensajes
├── types/               # Definiciones TypeScript
│   └── index.ts
├── messages/            # Templates de mensajes i18n
│   └── index.ts
├── services/            # Lógica de negocio
│   ├── telegram.ts      # API de Telegram
│   ├── bot.handlers.ts  # Handlers del bot
│   ├── user.service.ts  # Servicio de usuarios
│   ├── chat.service.ts  # Servicio de sesiones
│   ├── agent.service.ts # Servicio de agentes
│   ├── auth.service.ts  # Autenticación JWT
│   ├── socket.ts        # Socket.IO server
│   └── logger.ts        # Logging
├── routes/              # API REST
│   ├── auth.routes.ts   # /api/auth/*
│   ├── sessions.routes.ts
│   ├── agents.routes.ts
│   └── dashboard.routes.ts
├── middleware/          # Middleware
│   └── auth.ts          # JWT auth middleware
└── server.ts            # Servidor principal
```

## 🚀 Instalación

### Requisitos
- Node.js >= 18
- MongoDB >= 6.0
- Bot de Telegram (token de @BotFather)

### Instalación

```bash
# Clonar repositorio
cd /home/quinton/support

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Iniciar en desarrollo
npm run dev

# Compilar y producción
npm run build
npm start
```

### Variables de Entorno

```env
# Bot
SUPPORT_BOT_TOKEN=tu_token_de_telegram
WEBHOOK_SECRET=tu_secret_aleatorio
WEBHOOK_URL=https://tu-dominio.com

# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/trelk_support

# JWT
JWT_SECRET=tu_jwt_secret_cambiar_en_produccion
JWT_EXPIRES_IN=7d

# Dashboard
DASHBOARD_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173,http://localhost:3001
```

## 📱 Comandos del Bot

| Comando | Descripción |
|---------|-------------|
| `/start` | Iniciar bot y mostrar menú principal |
| `/help` | Ver todos los comandos disponibles |
| `/faq` | Ver preguntas frecuentes |
| `/ticket` | Crear un ticket de soporte |
| `/human` | Conectar con un agente humano |
| `/language` | Cambiar idioma (EN/ES) |
| `/cancel` | Cancelar operación actual |

## 🔌 API Endpoints

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login de agente |
| POST | `/api/auth/logout` | Logout de agente |
| POST | `/api/auth/refresh` | Refrescar token |
| POST | `/api/auth/register` | Registrar agente (admin) |
| POST | `/api/auth/setup` | Setup inicial |

### Sesiones
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/sessions` | Listar todas las sesiones |
| GET | `/api/sessions/waiting` | Sesiones en espera |
| GET | `/api/sessions/mine` | Mis sesiones asignadas |
| POST | `/api/sessions/:id/accept` | Aceptar sesión |
| POST | `/api/sessions/:id/close` | Cerrar sesión |
| GET | `/api/sessions/:id/messages` | Obtener mensajes |

### Agentes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/agents` | Listar agentes |
| GET | `/api/agents/online` | Agentes en línea |
| PATCH | `/api/agents/me/status` | Cambiar mi estado |

### Dashboard
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/dashboard/stats` | Estadísticas |
| GET | `/health` | Estado del servidor |

## 🔄 Socket.IO Events

### Server → Client
- `session:new` - Nueva sesión en espera
- `session:updated` - Sesión actualizada
- `session:closed` - Sesión cerrada
- `message:new` - Nuevo mensaje
- `agent:online` - Agente conectado
- `agent:offline` - Agente desconectado
- `stats:update` - Estadísticas actualizadas

### Client → Server
- `session:accept` - Aceptar sesión
- `session:close` - Cerrar sesión
- `message:send` - Enviar mensaje
- `message:read` - Marcar como leído
- `agent:status` - Cambiar estado

## 🔄 Flujo de Soporte Humano

```
1. Usuario en Telegram envía /human o presiona "👤 Soporte Humano"
2. Bot confirma la solicitud y crea sesión "waiting"
3. Socket.IO emite session:new a todos los agentes
4. Agente en dashboard acepta la sesión
5. Sesión cambia a "human", agente asignado
6. Usuario y agente chatean en tiempo real:
   - Mensajes del usuario → Bot → Socket.IO → Dashboard
   - Mensajes del agente → Socket.IO → Bot → Usuario
7. Agente cierra sesión cuando termina
8. Bot envía mensaje de despedida al usuario
```

## 📊 Modelos de Datos

### User (Usuarios de Telegram)
```typescript
{
  telegramId: number,
  username?: string,
  firstName: string,
  lastName?: string,
  language: 'en' | 'es',
  isSubscriber: boolean,
  lastActivity: Date
}
```

### Agent (Agentes del Dashboard)
```typescript
{
  name: string,
  email: string,
  password: string (hashed),
  role: 'admin' | 'support',
  onlineStatus: 'online' | 'away' | 'offline',
  telegramId?: number
}
```

### ChatSession (Sesiones de Chat)
```typescript
{
  sessionId: string,
  user: ObjectId,
  telegramChatId: number,
  status: 'bot' | 'waiting' | 'human' | 'closed',
  assignedAgent?: ObjectId,
  closedBy?: ObjectId,
  closeReason?: string
}
```

### Message (Mensajes)
```typescript
{
  session: ObjectId,
  sender: 'user' | 'bot' | 'agent',
  senderAgent?: ObjectId,
  content: string,
  messageType: 'text' | 'image' | 'system',
  telegramMessageId?: number,
  isRead: boolean
}
```

## 🛠️ Scripts

```bash
npm run dev          # Desarrollo con hot reload
npm run build        # Compilar TypeScript
npm start            # Producción
npm run typecheck    # Verificar tipos
npm run lint         # Linting
```

## 📁 Estructura del Proyecto

```
/home/quinton/support/
├── src/
│   ├── config/
│   ├── database/
│   ├── messages/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── types/
│   └── server.ts
├── dashboard/        # (Próximamente) Frontend React
├── dist/             # Código compilado
├── package.json
├── tsconfig.json
├── .env
└── README.md
```

## 📝 Licencia

MIT © Trelk Team

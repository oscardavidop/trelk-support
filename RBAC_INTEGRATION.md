# Sistema de Control de Acceso (RBAC)

## Arquitectura General

El sistema implementa un control de acceso basado en roles (RBAC) con soporte para permisos granulares por usuario.

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │ PermContext │  │ ProtectedRoute│  │ usePermissions() hook │  │
│  │ (permisos)  │  │ (rutas)       │  │ (helper functions)    │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API                                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │ authMiddleware │  │ requirePermission │  │ can()/canAll() │  │
│  │ (JWT verify)   │  │ (middleware)      │  │ (helpers)       │  │
│  └────────────────┘  └──────────────────┘  └─────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              permission.service.ts                         │  │
│  │  - getEffectivePermissions()                              │  │
│  │  - checkAgentPermission()                                 │  │
│  │  - hasPermission() / hasAnyPermission()                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │  Agent  │  │  Role   │  │ AuditLog │  │ Redis (cache)    │   │
│  │ + role  │  │ + perms │  │ + events │  │ + permissions    │   │
│  └─────────┘  └─────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Modelo de Datos

### Role
```typescript
interface Role {
  _id: ObjectId;
  name: string;                    // 'admin', 'supervisor', 'support', 'custom-role'
  displayName: string;             // 'Administrator'
  description?: string;
  permissions: string[];           // ['contacts.read', 'chats.respond', ...]
  isSystem: boolean;               // System roles can't be deleted
  isActive: boolean;
  priority: number;                // Higher = more permissions
  color?: string;                  // For UI
  icon?: string;
}
```

### Agent (campos de permisos)
```typescript
interface Agent {
  // ... existing fields
  role: 'admin' | 'supervisor' | 'support' | 'junior';
  roleId?: ObjectId;               // Custom role reference
  permissionsOverride?: {
    allow: string[];               // Additional permissions
    deny: string[];                // Explicitly denied
  };
  permissionVersion?: number;      // For cache invalidation
}
```

## Permisos Disponibles

### Categorías

| Categoría | Permisos |
|-----------|----------|
| **chats** | `chats.read`, `chats.read_all`, `chats.respond`, `chats.close`, `chats.reopen`, `chats.transfer`, `chats.takeover`, `chats.delete`, `chats.delete_all`, `chats.monitor`, `chats.export` |
| **contacts** | `contacts.read`, `contacts.write`, `contacts.delete`, `contacts.export`, `contacts.import`, `contacts.block`, `contacts.merge` |
| **agents** | `agents.read`, `agents.write`, `agents.delete`, `agents.permissions`, `agents.status`, `agents.teams` |
| **flows** | `flows.read`, `flows.write`, `flows.delete`, `flows.publish`, `flows.test` |
| **automation** | `automation.read`, `automation.write`, `automation.delete`, `automation.toggle` |
| **analytics** | `analytics.read`, `analytics.export`, `analytics.advanced` |
| **settings** | `settings.read`, `settings.write`, `settings.security`, `settings.integrations` |
| **system** | `system.read`, `system.manage`, `system.logs`, `system.audit`, `system.destructive`, `system.backup` |
| **supervisor** | `supervisor.monitor`, `supervisor.whisper`, `supervisor.intervene`, `supervisor.reports` |

### Roles por Defecto

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **admin** | Full access | `*` (todos) |
| **supervisor** | Monitoreo y gestión | Chats completo, agentes read, analytics, supervisor |
| **support** | Agente estándar | Chats básico, contacts básico, notes, tags |
| **junior** | Acceso limitado | Solo chats.read, respond, transfer |

## API Endpoints

### Obtener permisos actuales
```http
GET /api/permissions/me
Authorization: Bearer <token>

Response:
{
  "ok": true,
  "agent": {
    "_id": "...",
    "name": "John",
    "email": "john@example.com",
    "role": "supervisor",
    "permissions": ["chats.read", "chats.respond", ...],
    "permissionsOverride": { "allow": [], "deny": [] }
  }
}
```

### Obtener categorías de permisos (para UI)
```http
GET /api/permissions/categories

Response:
{
  "ok": true,
  "categories": {
    "chats": {
      "name": "Chats",
      "permissions": [
        { "key": "chats.read", "label": "Ver chats", "description": "..." }
      ]
    }
  },
  "allPermissions": ["chats.read", "chats.write", ...]
}
```

### Listar agentes con permisos
```http
GET /api/permissions/agents
Authorization: Bearer <token>  (requires agents.permissions)

Response:
{
  "ok": true,
  "agents": [
    {
      "_id": "...",
      "name": "John",
      "role": "support",
      "permissions": ["chats.read", ...],
      "permissionsOverride": { "allow": [], "deny": [] }
    }
  ]
}
```

### Actualizar rol de agente
```http
PATCH /api/permissions/agents/:agentId/role
Content-Type: application/json
Authorization: Bearer <token>

Body:
{ "role": "supervisor" }

Response:
{
  "ok": true,
  "agent": { ... }
}
```

### Actualizar permisos de agente
```http
PATCH /api/permissions/agents/:agentId/permissions
Content-Type: application/json

Body:
{
  "allow": ["contacts.delete"],
  "deny": ["chats.delete"]
}
```

### Otorgar permisos específicos
```http
POST /api/permissions/agents/:agentId/grant
Body: { "permissions": ["analytics.read", "analytics.export"] }
```

### Revocar permisos específicos
```http
POST /api/permissions/agents/:agentId/revoke
Body: { "permissions": ["chats.delete"] }
```

### Resetear a permisos por defecto
```http
POST /api/permissions/agents/:agentId/reset
```

## Integración Frontend

### 1. Almacenar permisos al login

```typescript
// Al hacer login, guardar permisos en contexto/store
const loginResponse = await api.post('/api/auth/login', credentials);

// El response incluye:
// { success: true, agent: {...}, token: "...", permissions: ["chats.read", ...] }

setAuth({
  agent: loginResponse.agent,
  token: loginResponse.token,
  permissions: loginResponse.permissions
});
```

### 2. Context de Permisos (React)

```tsx
// contexts/PermissionContext.tsx
import { createContext, useContext, useState, useCallback } from 'react';

interface PermissionContextType {
  permissions: string[];
  can: (permission: string) => boolean;
  canAny: (permissions: string[]) => boolean;
  canAll: (permissions: string[]) => boolean;
  refreshPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export function PermissionProvider({ children }) {
  const [permissions, setPermissions] = useState<string[]>([]);
  
  const can = useCallback((permission: string) => {
    if (permissions.includes('*')) return true;
    if (permissions.includes(permission)) return true;
    const category = permission.split('.')[0];
    return permissions.includes(`${category}.*`);
  }, [permissions]);
  
  const canAny = useCallback((perms: string[]) => {
    return perms.some(p => can(p));
  }, [can]);
  
  const canAll = useCallback((perms: string[]) => {
    return perms.every(p => can(p));
  }, [can]);
  
  const refreshPermissions = useCallback(async () => {
    const response = await api.get('/api/permissions/me');
    setPermissions(response.data.agent.permissions);
  }, []);
  
  return (
    <PermissionContext.Provider value={{ 
      permissions, can, canAny, canAll, refreshPermissions 
    }}>
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionContext)!;
```

### 3. Hook usePermissions

```tsx
// hooks/usePermissions.ts
export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) throw new Error('usePermissions must be inside PermissionProvider');
  return context;
}

// Uso:
function ContactsPage() {
  const { can, canAny } = usePermissions();
  
  return (
    <div>
      {can('contacts.read') && <ContactsList />}
      {can('contacts.write') && <AddContactButton />}
      {can('contacts.delete') && <BulkDeleteButton />}
    </div>
  );
}
```

### 4. Componente ProtectedRoute

```tsx
// components/ProtectedRoute.tsx
interface ProtectedRouteProps {
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ 
  permission, 
  permissions,
  requireAll = false,
  children,
  fallback 
}: ProtectedRouteProps) {
  const { can, canAny, canAll } = usePermissions();
  
  let hasAccess = false;
  
  if (permission) {
    hasAccess = can(permission);
  } else if (permissions) {
    hasAccess = requireAll ? canAll(permissions) : canAny(permissions);
  }
  
  if (!hasAccess) {
    return fallback || <AccessDeniedPage />;
  }
  
  return <>{children}</>;
}

// Uso en rutas:
<Route 
  path="/dashboard/contacts" 
  element={
    <ProtectedRoute permission="contacts.read">
      <ContactsPage />
    </ProtectedRoute>
  } 
/>
```

### 5. Página de Acceso Denegado

```tsx
// pages/AccessDenied.tsx
export function AccessDeniedPage() {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="text-6xl mb-4">🚫</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">
        Acceso Restringido
      </h1>
      <p className="text-gray-600 mb-6">
        No tienes permiso para acceder a esta sección.
      </p>
      <button 
        onClick={() => navigate(-1)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Volver
      </button>
    </div>
  );
}
```

### 6. Menú Dinámico

```tsx
// components/Sidebar.tsx
function Sidebar() {
  const { can } = usePermissions();
  
  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: Home, permission: null },
    { path: '/dashboard/chats', label: 'Chats', icon: MessageCircle, permission: 'chats.read' },
    { path: '/dashboard/contacts', label: 'Contacts', icon: Users, permission: 'contacts.read' },
    { path: '/dashboard/agents', label: 'Agents', icon: UserCog, permission: 'agents.read' },
    { path: '/dashboard/flows', label: 'Flows', icon: GitBranch, permission: 'flows.read' },
    { path: '/dashboard/analytics', label: 'Analytics', icon: BarChart, permission: 'analytics.read' },
    { path: '/dashboard/settings', label: 'Settings', icon: Settings, permission: 'settings.read' },
  ];
  
  return (
    <nav>
      {menuItems
        .filter(item => !item.permission || can(item.permission))
        .map(item => (
          <NavLink key={item.path} to={item.path}>
            <item.icon />
            <span>{item.label}</span>
          </NavLink>
        ))
      }
    </nav>
  );
}
```

### 7. Panel de Administración de Permisos

```tsx
// pages/AgentPermissions.tsx
function AgentPermissionsPage() {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [categories, setCategories] = useState({});
  
  useEffect(() => {
    loadAgents();
    loadCategories();
  }, []);
  
  async function loadAgents() {
    const res = await api.get('/api/permissions/agents');
    setAgents(res.data.agents);
  }
  
  async function loadCategories() {
    const res = await api.get('/api/permissions/categories');
    setCategories(res.data.categories);
  }
  
  async function togglePermission(agentId, permission, enabled) {
    if (enabled) {
      await api.post(`/api/permissions/agents/${agentId}/grant`, {
        permissions: [permission]
      });
    } else {
      await api.post(`/api/permissions/agents/${agentId}/revoke`, {
        permissions: [permission]
      });
    }
    loadAgents();
  }
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Lista de agentes */}
      <div className="col-span-1">
        {agents.map(agent => (
          <AgentCard 
            key={agent._id}
            agent={agent}
            onClick={() => setSelectedAgent(agent)}
            selected={selectedAgent?._id === agent._id}
          />
        ))}
      </div>
      
      {/* Panel de permisos */}
      {selectedAgent && (
        <div className="col-span-2">
          <h2>{selectedAgent.name} - Permisos</h2>
          
          {/* Selector de rol */}
          <RoleSelector 
            value={selectedAgent.role}
            onChange={(role) => updateRole(selectedAgent._id, role)}
          />
          
          {/* Permisos por categoría */}
          {Object.entries(categories).map(([category, data]) => (
            <PermissionCategory
              key={category}
              name={data.name}
              permissions={data.permissions}
              agentPermissions={selectedAgent.permissions}
              onToggle={(perm, enabled) => 
                togglePermission(selectedAgent._id, perm, enabled)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

## Manejo de Edge Cases

### 1. Permisos revocados durante sesión

```typescript
// Interceptor de API para detectar cambio de permisos
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 403) {
      // Refrescar permisos y reintentar
      await refreshPermissions();
      
      // Mostrar notificación
      toast.warning('Tus permisos han cambiado');
    }
    return Promise.reject(error);
  }
);
```

### 2. Validación de token con versión de permisos

```typescript
// El token incluye permissionVersion
// Si cambian los permisos, el backend incrementa permissionVersion
// El frontend puede verificar si necesita refrescar

async function checkPermissionVersion() {
  const response = await api.get('/api/permissions/me');
  const serverVersion = response.data.agent.permissionVersion;
  
  if (serverVersion !== localVersion) {
    await refreshPermissions();
    setLocalVersion(serverVersion);
  }
}
```

### 3. WebSocket para actualización en tiempo real

```typescript
// El backend emite evento cuando cambian permisos
socket.on('permissions:updated', ({ agentId }) => {
  if (agentId === currentAgent._id) {
    refreshPermissions();
    toast.info('Tus permisos han sido actualizados');
  }
});
```

## Acciones Destructivas

Para acciones como `system.destructive`, `chats.delete_all`, etc.:

```typescript
// Frontend - Confirmación
async function deleteAllChats() {
  const confirmed = await showConfirmDialog({
    title: '⚠️ Acción Destructiva',
    message: 'Esta acción eliminará TODOS los chats. No se puede deshacer.',
    confirmText: 'Escribe "CONFIRM" para continuar',
    requiresInput: true,
    expectedInput: 'CONFIRM'
  });
  
  if (confirmed) {
    await api.delete('/api/chats/all', {
      data: { confirmationText: 'CONFIRM' }
    });
  }
}

// API - Validación
// El middleware requireDestructivePermission verifica:
// 1. Rol admin
// 2. Permiso específico
// 3. confirmationText === 'CONFIRM'
```

## Testing

```typescript
// Test de permisos
describe('Permission Service', () => {
  it('should deny access without permission', async () => {
    const agent = await createAgent({ role: 'junior' });
    
    const result = checkAgentPermission(agent, 'contacts.delete');
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Missing permission: contacts.delete');
  });
  
  it('should allow with override', async () => {
    const agent = await createAgent({ 
      role: 'junior',
      permissionsOverride: { allow: ['contacts.delete'], deny: [] }
    });
    
    const result = checkAgentPermission(agent, 'contacts.delete');
    
    expect(result.allowed).toBe(true);
    expect(result.source).toBe('override_allow');
  });
});
```

## Auditoría

Todas las acciones de permisos se registran en `AuditLog`:

- `agent.role.update` - Cambio de rol
- `agent.permissions.update` - Cambio de permisos
- `agent.permissions.grant` - Permisos otorgados
- `agent.permissions.revoke` - Permisos revocados
- `access.denied` - Acceso denegado
- `destructive.authorized` - Acción destructiva autorizada
- `role.create` / `role.update` / `role.delete` - Gestión de roles

## Checklist de Implementación Frontend

- [ ] Crear `PermissionContext` y `PermissionProvider`
- [ ] Implementar hook `usePermissions()`
- [ ] Crear componente `ProtectedRoute`
- [ ] Crear página `AccessDenied`
- [ ] Actualizar menú/sidebar dinámico
- [ ] Crear página de administración de permisos
- [ ] Implementar interceptor para 403
- [ ] Agregar WebSocket listener para cambios de permisos
- [ ] Implementar confirmación para acciones destructivas
- [ ] Agregar tests de permisos

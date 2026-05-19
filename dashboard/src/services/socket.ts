// Socket.IO client service
import { io, Socket } from 'socket.io-client';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { useAgentsStore } from '../stores/agentsStore';
import { useConnectionStore } from '../stores/connectionStore';
import { useSupervisorStore } from '../stores/supervisorStore';
import { useCopilotStore } from '../stores/copilotStore';
import { useSettingsStore } from '../stores/settingsStore';
import { toast } from '../stores/toastStore';
import { getBrowserSessionId, getDeviceInfo } from './sessionGuard.service';
import type { ChatSession, Message, DashboardStats, Agent, TypingEvent, TransferEvent, ReopenEvent, BlockEvent, UnblockEvent } from '../types';
import { usePlaybookStore } from '../stores/playbookStore';

let socket: Socket | null = null;
let reconnectAttempt = 0;

export function initializeSocket(): Socket {
  const token = useAuthStore.getState().token;
  
  if (socket?.connected) {
    return socket;
  }

  socket = io('/', {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity, // Keep trying forever
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000, // Cap at 10 seconds
  });

  // ============= CONNECTION LIFECYCLE =============
  
  socket.on('connect', () => {
    console.log('🔌 Socket connected');
    reconnectAttempt = 0;
    useConnectionStore.getState().setConnected();
    
    // Register browser session for single-session enforcement
    const browserSessionId = getBrowserSessionId();
    const device = getDeviceInfo();
    socket?.emit('session:register', { browserSessionId, device }, (result: { ok: boolean; data?: { replaced: boolean } }) => {
      if (result.ok && result.data?.replaced) {
        console.log('⚠️ Session replaced another active session');
      }
    });
    
    // Don't request sessions here - wait for sync:state event
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
    useConnectionStore.getState().setDisconnected();
  });

  socket.on('connect_error', (error) => {
    console.error('🔌 Socket connection error:', error.message);
    useConnectionStore.getState().setDisconnected();
  });
  
  // Reconnection events
  socket.io.on('reconnect_attempt', (attempt) => {
    reconnectAttempt = attempt;
    console.log('🔄 Reconnection attempt:', attempt);
    useConnectionStore.getState().setReconnecting(attempt);
  });
  
  socket.io.on('reconnect', () => {
    console.log('✅ Reconnected successfully');
    reconnectAttempt = 0;
    useConnectionStore.getState().setConnected();
    
    // Re-fetch sessions after reconnection
    requestSessions();
    
    // Re-join active session room if there is one
    const activeSession = useChatStore.getState().activeSession;
    if (activeSession) {
      console.log('🔄 Rejoining session room:', activeSession.sessionId);
      socket?.emit('session:join', activeSession.sessionId);
    }
    
    // Toast for successful reconnection
    toast.success('Reconectado', 'La conexión se ha restablecido.', { 
      groupKey: 'connection:restored',
      duration: 3000
    });
  });
  
  socket.io.on('reconnect_failed', () => {
    console.error('❌ Reconnection failed');
    useConnectionStore.getState().setDisconnected();
    
    toast.error('Error de conexión', 'No se pudo reconectar. Recarga la página.', { 
      groupKey: 'connection:failed',
      priority: 'critical'
    });
  });
  
  // ============= SYNC STATE (on connect/reconnect) =============
  
  socket.on('sync:state', (data) => {
    
    // Update connection store
    useConnectionStore.getState().setSyncState({
      mySessions: data.stats.myActive,
      queuedSessions: data.stats.queue,
      reconnected: data.reconnected,
      recoveredSessions: data.recoveredSessions,
      lastSyncAt: new Date(),
    });
    
    // Update chat store with synced sessions
    useChatStore.getState().setSessions(data.mySessions);
    useChatStore.getState().setQueueSessions(data.queuedSessions);
    
    // Update agent fields without triggering full re-render
    useAuthStore.getState().updateAgentFields({
      availability: data.agent.availability,
      activeChats: data.agent.activeChats,
    });
    
    // Show notification if sessions were recovered
    if (data.recoveredSessions > 0) {
      toast.success(
        'Sesiones recuperadas',
        `Se recuperaron ${data.recoveredSessions} chats de tu sesión anterior.`,
        { groupKey: 'session:recovered', priority: 'high' }
      );
    }
    
    // Request stats after sync
    requestStats();
  });
  
  socket.on('sync:error', (data) => {
    console.error('🔌 Sync error:', data.message);
    toast.error('Error de sincronización', data.message, { groupKey: 'sync:error' });
  });

  // ============= SESSION GUARD EVENTS =============
  
  socket.on('session:replaced', (data: { reason: string; newDevice: string; newIp: string; replacedAt: string }) => {
    console.warn('🔒 Session replaced:', data);
    toast.error(
      'Sesión cerrada',
      `Se inició sesión desde ${data.newDevice}`,
      { groupKey: 'session:replaced', priority: 'critical', duration: 0 }
    );
    // The force_logout event will handle the actual logout
  });
  
  socket.on('session:force_logout', (data: { reason: string }) => {
    console.warn('🔒 Force logout:', data.reason);
    // Clear auth state and redirect to login
    useAuthStore.getState().logout();
    window.location.href = '/login?reason=session_replaced';
  });
  
  // ============= AUTO-LOCK EVENTS =============
  
  socket.on('session:locked', (data: { reason: string; lockedBy?: string; lockedAt: string }) => {
    console.warn('🔒 Session locked:', data);
    // Dispatch custom event for AutoLockProvider to handle
    window.dispatchEvent(new CustomEvent('autolock:locked', { detail: data }));
    
    if (data.reason === 'remote' && data.lockedBy) {
      toast.warning(
        'Sesión bloqueada',
        `${data.lockedBy} ha bloqueado tu sesión remotamente`,
        { groupKey: 'session:locked', priority: 'high', duration: 0 }
      );
    }
  });
  
  socket.on('session:unlocked', (data: { unlockedBy?: string; reason: string }) => {
    console.log('🔓 Session unlocked:', data);
    // Dispatch custom event for AutoLockProvider to handle
    window.dispatchEvent(new CustomEvent('autolock:unlocked', { detail: data }));
    
    if (data.unlockedBy) {
      toast.success(
        'Sesión desbloqueada',
        `Un administrador ha desbloqueado tu sesión`,
        { groupKey: 'session:unlocked', duration: 5000 }
      );
    }
  });
  
  socket.on('account:deactivated', (data: { deactivatedAt: string }) => {
    console.warn('🚫 Account deactivated:', data);
    toast.error(
      'Cuenta desactivada',
      'Tu cuenta ha sido desactivada por un administrador',
      { groupKey: 'account:deactivated', priority: 'critical', duration: 0 }
    );
    // Force logout after showing message
    setTimeout(() => {
      useAuthStore.getState().logout();
      window.location.href = '/login?reason=account_deactivated';
    }, 3000);
  });
  
  socket.on('account:status_changed', (data: { isActive: boolean; changedBy?: string; changedAt: string }) => {
    console.log('👤 Account status changed:', data);
    if (!data.isActive) {
      // Account was deactivated
      toast.error(
        'Cuenta desactivada',
        'Tu cuenta ha sido desactivada',
        { groupKey: 'account:status', priority: 'critical', duration: 0 }
      );
      setTimeout(() => {
        useAuthStore.getState().logout();
        window.location.href = '/login?reason=account_deactivated';
      }, 3000);
    }
  });
  
  // socket.on('tab:duplicate_detected', (data: { activeTabId: string; message: string }) => {
  //   console.warn('🔒 Duplicate tab detected:', data);
  //   // This is handled by the SessionGuard service in ChatPage
  // });

  // Session events
  socket.on('session:new', (session: ChatSession) => {
    console.log('📥 New session:', session.sessionId, 'assigned to:', session.assignedAgent?._id || 'none');
    
    const currentAgent = useAuthStore.getState().agent;
    const isMySession = session.assignedAgent?._id === currentAgent?._id || 
                        session.assignedAgent?._id === currentAgent?.id;
    
    // Only add to MY sessions if it's assigned to me
    // If it has no assignedAgent or is assigned to someone else, it should be in queue
    if (session.assignedAgent && isMySession) {
      useChatStore.getState().addSession(session);
      playNotificationSound('chat');
      
      toast.info(
        'Nuevo chat',
        `${session.user?.firstName || 'Usuario'} inició una conversación`,
        { 
          groupKey: `session:new:${session.sessionId}`,
          sessionId: session.sessionId,
          priority: 'high'
        }
      );
    } else if (!session.assignedAgent) {
      // No agent assigned, this should go to queue (session:queued will handle it)
      // But some edge cases might send session:new for unassigned sessions
      useChatStore.getState().addToQueue(session);
      playNotificationSound('chat');
    }
    // If assigned to another agent, ignore - not our business
  });

  socket.on('session:updated', (session: ChatSession) => {
    console.log('📝 Session updated:', session.sessionId, 'assigned to:', session.assignedAgent?._id || 'none');
    
    // Dispatch DOM event so sidebar components can re-fetch contactInfo
    window.dispatchEvent(new CustomEvent('session:updated', { detail: { sessionId: session.sessionId, session } }));

    const currentAgent = useAuthStore.getState().agent;
    const isMySession = session.assignedAgent?._id === currentAgent?._id || 
                        session.assignedAgent?._id === currentAgent?.id;
    
    // If the session is now assigned to another agent, remove from my lists
    if (session.assignedAgent && !isMySession) {
      useChatStore.getState().removeSession(session.sessionId);
      useChatStore.getState().removeFromQueue(session.sessionId);
    } else {
      // It's still mine or unassigned (in queue), update it
      useChatStore.getState().updateSession(session);
    }
  });

  socket.on('session:closed', (sessionId: string) => {
    console.log('❌ Session closed:', sessionId);
    useChatStore.getState().removeSession(sessionId);
  });

  // Queue and assignment events
  socket.on('session:queued', (session: ChatSession) => {
    console.log('📋 Session added to queue:', session.sessionId);
    useChatStore.getState().addToQueue(session);
    playNotificationSound('chat');
    
    // Toast for queued session
    toast.info(
      'Chat en cola',
      `${session.user?.firstName || 'Usuario'} espera atención`,
      { 
        groupKey: `session:queued:${session.sessionId}`,
        sessionId: session.sessionId,
        priority: 'high'
      }
    );
  });

  socket.on('session:assigned', (data: { sessionId: string; agentId: string; agentName: string }) => {
    console.log('✋ Session assigned to you:', data.sessionId);
    // Request updated sessions to get the full session data
    requestSessions();
    
    // Toast for assigned session
    toast.success(
      'Chat asignado',
      `Se te ha asignado un nuevo chat`,
      { 
        groupKey: `session:assigned:${data.sessionId}`,
        sessionId: data.sessionId,
        priority: 'high'
      }
    );
    
    // Show notification
    const event = new CustomEvent('session:assigned', { detail: data });
    window.dispatchEvent(event);
  });

  socket.on('session:unassigned', (data: { sessionId: string }) => {
    console.log('🔓 Session unassigned (taken by other agent):', data.sessionId);
    // Remove from BOTH queue and sessions - it's no longer ours
    useChatStore.getState().removeFromQueue(data.sessionId);
    useChatStore.getState().removeSession(data.sessionId);
  });

  socket.on('session:accessDenied', (data: { sessionId: string; reason: string }) => {
    console.log('🚫 Access denied to session:', data.sessionId, data.reason);
    toast.warning('Acceso denegado', data.reason, { groupKey: `access:denied:${data.sessionId}` });
    const event = new CustomEvent('session:accessDenied', { detail: data });
    window.dispatchEvent(event);
  });

  // Message events
  socket.on('message:new', (message: Message) => {
    console.log('💬 New message:', message._id);
    useChatStore.getState().addMessage(message);
    
    // Play sound for user messages
    if (message.sender === 'user') {
      playNotificationSound('message');
    }
  });

  // Incoming auto-translation result (arrives async after message:new)
  socket.on('message:translation', (data: {
    messageId: string;
    sessionId: string;
    translatedContent: string;
    sourceLang: string;
    targetLang: string;
    provider?: string;
    latencyMs: number;
    cached: boolean;
    showOriginal: boolean;
  }) => {
    console.log('🌐 Incoming translation:', data.messageId);
    useChatStore.getState().updateMessage(data.messageId, {
      incomingTranslation: {
        translatedContent: data.translatedContent,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        provider: data.provider || 'unknown',
        latencyMs: data.latencyMs,
        cached: data.cached,
        translatedAt: new Date().toISOString(),
      },
    });
  });

  // Message updated (edit)
  socket.on('message:updated', (message: Message) => {
    console.log('✏️ Message updated:', message._id);
    useChatStore.getState().updateMessage(message._id, message);
  });

  // Message deleted
  socket.on('message:deleted', (data: { messageId: string; sessionId: string }) => {
    console.log('🗑️ Message deleted:', data.messageId);
    useChatStore.getState().deleteMessage(data.messageId);
  });

  // Message pinned
  socket.on('message:pinned', (data: { messageId: string; sessionId: string; message: Message }) => {
    console.log('📌 Message pinned:', data.messageId);
    useChatStore.getState().setPinnedMessage(data.sessionId, data.message);
  });

  // Message unpinned
  socket.on('message:unpinned', (data: { sessionId: string }) => {
    console.log('📌 Message unpinned:', data.sessionId);
    useChatStore.getState().clearPinnedMessage(data.sessionId);
  });

  // Stats events
  socket.on('stats:update', (stats: DashboardStats) => {
    useChatStore.getState().setStats(stats);
  });

  // Agent events - real-time status updates
  socket.on('agent:online', (agent: Agent) => {
    console.log('👤 Agent online:', agent.name);
    useAgentsStore.getState().setAgentOnline(agent._id);
  });

  socket.on('agent:offline', (agentId: string) => {
    console.log('👤 Agent offline:', agentId);
    useAgentsStore.getState().setAgentOffline(agentId);
  });

  socket.on('agent:status', (data: { agentId: string; status: Agent['onlineStatus'] }) => {
    console.log('👤 Agent status:', data.agentId, data.status);
    useAgentsStore.getState().updateAgentStatus(data.agentId, data.status);
    
    // If it's the current agent, update auth store too (fix UI not updating)
    const currentAgent = useAuthStore.getState().agent;
    if (currentAgent && (currentAgent._id === data.agentId || currentAgent.id === data.agentId)) {
      useAuthStore.getState().updateAgentFields({ onlineStatus: data.status });
    }
  });

  // Agent availability updates
  socket.on('agent:availability', (data: { 
    agentId: string; 
    availability: 'available' | 'busy' | 'offline';
    activeChats: number;
    maxChats: number;
  }) => {
    console.log('👤 Agent availability:', data.agentId, data.availability, `${data.activeChats}/${data.maxChats}`);
    useAgentsStore.getState().updateAgentAvailability(data.agentId, data.availability, data.activeChats);
    
    // If it's the current agent, update auth store too
    const currentAgent = useAuthStore.getState().agent;
    if (currentAgent?.id === data.agentId) {
      useAuthStore.getState().setAgent({
        ...currentAgent,
        availability: data.availability,
        activeChats: data.activeChats,
      });
    }
  });

  // Chat warning events (inactivity)
  socket.on('chat:warning', (data: { sessionId: string; message: string; minutesRemaining: number }) => {
    console.log('⚠️ Chat warning:', data.sessionId, `${data.minutesRemaining} min remaining`);
    
    toast.warning(
      'Chat inactivo',
      `El chat se cerrará en ${data.minutesRemaining} minutos por inactividad`,
      { 
        groupKey: `chat:warning:${data.sessionId}`,
        sessionId: data.sessionId,
        priority: 'high',
        duration: 10000
      }
    );
    
    const event = new CustomEvent('chat:warning', { detail: data });
    window.dispatchEvent(event);
  });

  // User blocked bot event
  socket.on('chat:user_blocked', (data: {
    sessionId: string;
    reason: string;
    message: string;
    messageEn?: string;
  }) => {
    console.log('🚫 User blocked bot:', data.sessionId, data.reason);
    
    // Show specific toast for blocked user
    const reasonLabels: Record<string, string> = {
      bot_blocked: 'El usuario bloqueó el bot',
      user_deactivated: 'La cuenta del usuario fue desactivada',
      chat_not_found: 'El chat ya no existe',
      bot_kicked: 'El bot fue expulsado del chat',
      cant_initiate: 'No se puede contactar al usuario',
    };
    
    toast.error(
      'Chat no disponible',
      reasonLabels[data.reason] || data.message,
      { 
        groupKey: `chat:blocked:${data.sessionId}`,
        sessionId: data.sessionId,
        duration: 8000
      }
    );
    
    // Remove session from active list
    useChatStore.getState().removeSession(data.sessionId);
    
    // Dispatch custom event for UI components
    const event = new CustomEvent('chat:user_blocked', { detail: data });
    window.dispatchEvent(event);
  });
  // Chat closed events
  socket.on('chat:closed', (data: { 
    sessionId: string; 
    reason: string; 
    closedBy: 'inactivity' | 'user' | 'agent' | 'system';
    closedAt?: string;
    session?: ChatSession;
  }) => {
    console.log('🔒 Chat closed:', data.sessionId, data.closedBy);
    
    // Toast notification
    const closedByLabels: Record<string, string> = {
      inactivity: 'por inactividad',
      user: 'por el usuario',
      agent: 'por el agente',
      system: 'automáticamente'
    };
    
    // For system closures (like user blocked), show a different toast
    if (data.closedBy === 'system') {
      toast.warning(
        'Chat cerrado',
        data.reason || 'Chat cerrado automáticamente',
        { 
          groupKey: `chat:closed:${data.sessionId}`,
          sessionId: data.sessionId,
          duration: 6000
        }
      );
    } else {
      toast.info(
        'Chat cerrado',
        `Chat cerrado ${closedByLabels[data.closedBy] || ''}`,
        { 
          groupKey: `chat:closed:${data.sessionId}`,
          sessionId: data.sessionId
        }
      );
    }
    
    // If we have the full session, move it to closed list
    if (data.session) {
      useChatStore.getState().moveToClosedSessions(data.sessionId, data.session);
    } else {
      // Try to find the session in local state and update it to closed
      const state = useChatStore.getState();
      const existingSession = state.sessions.find(s => s.sessionId === data.sessionId) 
        || state.queueSessions.find(s => s.sessionId === data.sessionId);
      
      if (existingSession) {
        // Move to closed with updated status
        const closedSession: ChatSession = {
          ...existingSession,
          status: 'closed',
          closedAt: data.closedAt || new Date().toISOString(),
          closedByType: data.closedBy === 'system' ? 'system' : data.closedBy === 'user' ? 'user' : 'agent',
        };
        state.moveToClosedSessions(data.sessionId, closedSession);
      } else {
        // Session not found locally, just remove it
        state.removeSession(data.sessionId);
      }
    }
    
    // Dispatch custom event for UI components
    const event = new CustomEvent('chat:closed', { detail: data });
    window.dispatchEvent(event);
  });

  // Error handling
  socket.on('error', (error: { message: string }) => {
    console.error('🔌 Socket error:', error.message);
  });

  // ============= ENTERPRISE EVENTS =============

  // Typing indicators
  socket.on('typing:start', (data: TypingEvent) => {
    console.log('⌨️ Typing start:', data.sessionId, data.userId || data.agentName);
    const event = new CustomEvent('typing:start', { detail: data });
    window.dispatchEvent(event);
  });

  socket.on('typing:stop', (data: TypingEvent) => {
    console.log('⌨️ Typing stop:', data.sessionId);
    const event = new CustomEvent('typing:stop', { detail: data });
    window.dispatchEvent(event);
  });

  // Session transferred
  socket.on('session:transferred', (data: TransferEvent) => {
    console.log('🔄 Session transferred:', data.sessionId, `${data.fromAgentName} → ${data.toAgentName}`);
    
    toast.info(
      'Chat transferido',
      `${data.fromAgentName} → ${data.toAgentName}`,
      { 
        groupKey: `session:transferred:${data.sessionId}`,
        sessionId: data.sessionId,
        priority: 'high'
      }
    );
    
    const event = new CustomEvent('session:transferred', { detail: data });
    window.dispatchEvent(event);
    // Request updated sessions
    requestSessions();
  });

  // Session reopened
  socket.on('session:reopened', (data: ReopenEvent) => {
    console.log('🔓 Session reopened:', data.sessionId, data.agentName);
    
    toast.success(
      'Chat reabierto',
      `${data.agentName} reabrió el chat`,
      { 
        groupKey: `session:reopened:${data.sessionId}`,
        sessionId: data.sessionId
      }
    );
    
    const event = new CustomEvent('session:reopened', { detail: data });
    window.dispatchEvent(event);
    // Request updated sessions
    requestSessions();
  });

  // User blocked
  socket.on('user:blocked', (data: BlockEvent) => {
    console.log('🚫 User blocked:', data.telegramId, data.blockType);
    
    toast.warning(
      'Usuario bloqueado',
      data.reason || `Tipo: ${data.blockType}`,
      { groupKey: `user:blocked:${data.telegramId}` }
    );
    
    const event = new CustomEvent('user:blocked', { detail: data });
    window.dispatchEvent(event);
  });

  // User unblocked
  socket.on('user:unblocked', (data: UnblockEvent) => {
    console.log('✅ User unblocked:', data.telegramId);
    
    toast.success(
      'Usuario desbloqueado',
      'El usuario puede contactar de nuevo',
      { groupKey: `user:unblocked:${data.telegramId}` }
    );
    
    const event = new CustomEvent('user:unblocked', { detail: data });
    window.dispatchEvent(event);
  });

  // ============= PERMISSION EVENTS (RBAC) =============
  
  // Permission overrides updated for agent
  socket.on('permissions:updated', async (data: { 
    agentId: string; 
    permissions: string[];
    role: string;
    permissionVersion: number;
    updatedBy: { id: string; name: string };
    timestamp: string;
  }) => {
    console.log('🔐 Permissions updated for:', data.agentId, 'by:', data.updatedBy.name);
    
    const currentAgent = useAuthStore.getState().agent;
    if (!currentAgent) return;
    
    // Only process if it's for the current agent
    if (data.agentId !== currentAgent._id && data.agentId !== currentAgent.id) {
      // If we're an admin viewing the PermissionsPage, dispatch event for UI update
      const event = new CustomEvent('permissions:updated:other', { detail: data });
      window.dispatchEvent(event);
      return;
    }
    
    try {
      // Import dynamically to avoid circular deps
      const { usePermissionStore } = await import('../stores/permissionStore');
      const permissionStore = usePermissionStore.getState();
      
      // Update permissions directly from event data
      permissionStore.setPermissions(data.permissions, data.permissionVersion);
      
      // Update agent role in auth store if changed
      if (currentAgent.role !== data.role) {
        useAuthStore.getState().updateAgentFields({ role: data.role as any });
      }
      
      // Show toast notification
      toast.info(
        'Permisos actualizados',
        `${data.updatedBy.name} modificó tus permisos`,
        { 
          groupKey: 'permissions:updated',
          priority: 'high',
          duration: 5000
        }
      );
      
      // Dispatch custom event for components that need to react
      const event = new CustomEvent('permissions:updated', { detail: data });
      window.dispatchEvent(event);
      
    } catch (error) {
      console.error('Error updating permissions:', error);
    }
  });

  // Role changed for agent
  socket.on('permissions:role_changed', async (data: { 
    agentId: string;
    oldRole: string;
    newRole: string;
    permissions: string[];
    permissionVersion: number;
    updatedBy: { id: string; name: string };
    timestamp: string;
  }) => {
    console.log('🔐 Role changed for:', data.agentId, `${data.oldRole} → ${data.newRole}`);
    
    const currentAgent = useAuthStore.getState().agent;
    if (!currentAgent) return;
    
    // Only process if it's for the current agent
    if (data.agentId !== currentAgent._id && data.agentId !== currentAgent.id) {
      // If we're an admin viewing the PermissionsPage, dispatch event for UI update
      const event = new CustomEvent('permissions:role_changed:other', { detail: data });
      window.dispatchEvent(event);
      return;
    }
    
    try {
      const { usePermissionStore } = await import('../stores/permissionStore');
      const permissionStore = usePermissionStore.getState();
      
      // Update permissions and role
      permissionStore.setPermissions(data.permissions, data.permissionVersion);
      useAuthStore.getState().updateAgentFields({ role: data.newRole as any });
      
      // Show prominent toast for role change
      toast.warning(
        'Rol actualizado',
        `${data.updatedBy.name} cambió tu rol de ${data.oldRole} a ${data.newRole}`,
        { 
          groupKey: 'role:changed',
          priority: 'critical',
          duration: 8000
        }
      );
      
      // Dispatch event
      const event = new CustomEvent('permissions:role_changed', { detail: data });
      window.dispatchEvent(event);
      
    } catch (error) {
      console.error('Error updating role:', error);
    }
  });

  // ============= SUPERVISOR & WHISPER EVENTS =============
  
  // Whisper received from supervisor
  socket.on('whisper:new', (data: {
    id: string;
    sessionId: string;
    supervisorId: string;
    supervisorName: string;
    content: string;
    createdAt: Date;
  }) => {
    console.log('🤫 Whisper received:', data.supervisorName, data.content);
    
    // Add to supervisor store
    useSupervisorStore.getState().addWhisper({
      ...data,
      targetAgentId: useAuthStore.getState().agent?._id || '',
      isRead: false,
    } as any);
    
    // Dispatch event
    const event = new CustomEvent('whisper:new', { detail: data });
    window.dispatchEvent(event);
  });
  
  // Session being watched by supervisor
  socket.on('session:watched', (data: {
    sessionId: string;
    supervisorId: string;
    supervisorName: string;
    action: 'start' | 'stop';
  }) => {
    console.log(`👁️ Session ${data.action === 'start' ? 'watched' : 'unwatched'}:`, data.sessionId, data.supervisorName);
    
    if (data.action === 'start') {
      toast.info(
        'Supervisor observando',
        `${data.supervisorName} está observando este chat`,
        { 
          groupKey: `session:watched:${data.sessionId}`,
          sessionId: data.sessionId,
          duration: 5000
        }
      );
    }
    
    const event = new CustomEvent('session:watched', { detail: data });
    window.dispatchEvent(event);
  });
  
  // Session taken over by supervisor
  socket.on('session:takenOver', (data: {
    sessionId: string;
    takenBy: { id: string; name: string };
    reason: string;
  }) => {
    console.log('👑 Session taken over:', data.sessionId, data.takenBy.name);
    
    toast.warning(
      'Chat transferido',
      `${data.takenBy.name} tomó control del chat`,
      { 
        groupKey: `session:takeover:${data.sessionId}`,
        sessionId: data.sessionId,
        priority: 'high'
      }
    );
    
    // Remove from current agent's list
    useChatStore.getState().removeSession(data.sessionId);
    
    const event = new CustomEvent('session:takenOver', { detail: data });
    window.dispatchEvent(event);
  });
  
  // Agent stats update (for supervisor dashboard)
  socket.on('agent:statsUpdate', (data: {
    agentId: string;
    activeChats: number;
    resolvedToday: number;
    avgResponseTime: number;
  }) => {
    console.log('📊 Agent stats update:', data.agentId);
    
    useSupervisorStore.getState().updateAgent(data.agentId, {
      activeChats: data.activeChats,
      resolvedToday: data.resolvedToday,
      avgResponseTime: data.avgResponseTime,
    });
  });
  
  // Activity log event
  socket.on('activity:new', (data: {
    sessionId: string;
    type: string;
    description: string;
    agentId?: string;
    agentName?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
  }) => {
    console.log('📝 Activity logged:', data.sessionId, data.type);
    
    useSupervisorStore.getState().addActivity({
      id: Date.now().toString(),
      ...data,
    });
  });
  
  // AI Copilot suggestion
  socket.on('copilot:suggestion', (data: {
    sessionId: string;
    id: string;
    type: 'response' | 'summary' | 'category';
    content: string;
    confidence: number;
  }) => {
    console.log('🤖 Copilot suggestion:', data.sessionId, data.type);
    
    useCopilotStore.getState().addSuggestion({
      ...data,
      createdAt: new Date(),
    });
  });
  
  // Automation rule triggered
  socket.on('automation:triggered', (data: {
    sessionId: string;
    id: string;
    name: string;
    action: string;
    result: 'success' | 'failure';
  }) => {
    console.log('🤖 Automation triggered:', data.name, data.result);
    
    if (data.result === 'failure') {
      toast.warning(
        'Automatización fallida',
        `Regla "${data.name}" falló`,
        { groupKey: `automation:${data.id}` }
      );
    }
    
    const event = new CustomEvent('automation:triggered', { detail: data });
    window.dispatchEvent(event);
  });

  // Flow updated (hot-reload notification)
  socket.on('flow:updated', (data: {
    flowId: string;
    action: 'published' | 'unpublished' | 'updated' | 'deleted';
    version?: number;
    flowName?: string;
  }) => {
    console.log('🔄 Flow updated:', data.flowId, data.action);
    
    // Dispatch custom event for Flow Builder to listen
    const event = new CustomEvent('flow:updated', { detail: data });
    window.dispatchEvent(event);
    
    // Show toast notification
    const messages: Record<string, string> = {
      published: `Flow "${data.flowName || 'Flow'}" publicado (v${data.version})`,
      unpublished: `Flow "${data.flowName || 'Flow'}" desactivado`,
      updated: `Flow "${data.flowName || 'Flow'}" actualizado`,
      deleted: `Flow "${data.flowName || 'Flow'}" eliminado`,
    };
    
    const toastType = data.action === 'published' ? 'success' : 
                      data.action === 'deleted' ? 'warning' : 'info';
    
    toast[toastType](
      'Flow actualizado',
      messages[data.action] || 'El flow ha sido modificado',
      { groupKey: `flow:${data.flowId}:${data.action}`, duration: 5000 }
    );
  });

  // ============= QA COACHING EVENTS =============

  socket.on('qa:review:new' as any, (data: { reviewId: string; totalScore: number; sessionId: string }) => {
    console.log('📋 New QA review received:', data.reviewId);
    toast.warning(
      'Nueva Evaluación QA',
      `Se ha registrado una evaluación con puntaje ${data.totalScore}. Revisa tu panel de calidad.`,
      { groupKey: `qa:review:${data.reviewId}`, duration: 8000 }
    );
    // Dispatch custom event for QACoachingModal to re-check
    window.dispatchEvent(new CustomEvent('qa:review:new', { detail: data }));
  });

  socket.on('qa:review:edited' as any, (data: { reviewId: string; totalScore: number; requiresReack: boolean }) => {
    console.log('📋 QA review edited:', data.reviewId);
    if (data.requiresReack) {
      toast.warning(
        'Evaluación QA Modificada',
        `Una evaluación ha sido editada (nuevo puntaje: ${data.totalScore}). Requiere re-confirmación.`,
        { groupKey: `qa:edit:${data.reviewId}`, duration: 8000 }
      );
    } else {
      toast.info(
        'Evaluación QA Actualizada',
        `Una evaluación ha sido actualizada. Nuevo puntaje: ${data.totalScore}`,
        { groupKey: `qa:edit:${data.reviewId}`, duration: 5000 }
      );
    }
    // Dispatch custom event for QACoachingModal to re-check
    window.dispatchEvent(new CustomEvent('qa:review:edited', { detail: data }));
  });

  // ============= PLAYBOOK EVENTS =============

  socket.on('playbook:progress' as any, (data: { sessionId: string; progress: any }) => {
    console.log('📋 Playbook progress:', data.sessionId);
    usePlaybookStore.getState().onPlaybookProgress(data.sessionId, data.progress);
  });

  socket.on('playbook:started' as any, (data: { sessionId: string; playbookName: string; agentId: string }) => {
    console.log('📋 Playbook started:', data.playbookName, 'for session', data.sessionId);
    toast.info('Playbook Iniciado', `"${data.playbookName}" se inició en el chat`, {
      groupKey: `playbook:started:${data.sessionId}`,
      sessionId: data.sessionId,
      duration: 4000,
    });
  });

  socket.on('playbook:updated' as any, (data: { playbookId: string; playbook: any }) => {
    console.log('📋 Playbook updated:', data.playbookId);
    usePlaybookStore.getState().onPlaybookUpdated(data.playbook);
  });

  socket.on('playbook:deleted' as any, (data: { playbookId: string }) => {
    console.log('📋 Playbook deleted:', data.playbookId);
    usePlaybookStore.getState().onPlaybookDeleted(data.playbookId);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket(): Socket | null {
  return socket;
}

// ============= ACTIONS =============

export function acceptSession(
  sessionId: string, 
  callback?: (result: { ok: boolean; error?: string; data?: { code?: string; reason?: string; sessionClosed?: boolean } }) => void
): void {
  socket?.emit('session:accept', sessionId, callback || (() => {}));
}

export function closeSession(
  sessionId: string, 
  reason?: string,
  disposition?: {
    categoryId: string;
    subcategoryId?: string;
    comment?: string;
    tags?: string[];
  },
  callback?: (result: { ok: boolean; error?: string; code?: string }) => void
): void {
  socket?.emit('session:close', { sessionId, reason, disposition }, callback || (() => {}));
}

export function sendMessage(
  sessionId: string, 
  content: string,
  options?: {
    replyToMessageId?: string;
    editedTranslation?: string;
  },
  callback?: (result: { ok: boolean; error?: string; data?: Message }) => void
): void {
  socket?.emit('message:send', { 
    sessionId, 
    content,
    replyToMessageId: options?.replyToMessageId,
    editedTranslation: options?.editedTranslation,
  }, callback || (() => {}));
}

export function sendImage(
  sessionId: string,
  url: string,
  caption?: string,
  callback?: (result: { ok: boolean; error?: string; data?: Message }) => void
): void {
  socket?.emit('message:sendImage', { sessionId, url, caption }, callback || (() => {}));
}

export function sendFile(
  sessionId: string,
  url: string,
  filename: string,
  caption?: string,
  callback?: (result: { ok: boolean; error?: string; data?: Message }) => void
): void {
  socket?.emit('message:sendFile', { sessionId, url, filename, caption }, callback || (() => {}));
}

export function sendVoice(
  sessionId: string,
  url: string,
  callback?: (result: { ok: boolean; error?: string; data?: Message }) => void
): void {
  socket?.emit('message:sendVoice', { sessionId, url }, callback || (() => {}));
}

export function joinSession(sessionId: string): void {
  socket?.emit('session:join', sessionId);
}

export function leaveSession(sessionId: string): void {
  socket?.emit('session:leave', sessionId);
}

export function updateAgentStatus(status: 'online' | 'away' | 'offline'): void {
  // socket?.emit('agent:status', status);
}

export function requestStats(): void {
  socket?.emit('stats:request', (stats: DashboardStats) => {
    useChatStore.getState().setStats(stats);
  });
}

export function requestSessions(): void {
  socket?.emit('sessions:request', (sessions: ChatSession[]) => {
    useChatStore.getState().setSessions(sessions);
  });
}

// ============= ENTERPRISE ACTIONS =============

export function startTyping(sessionId: string): void {
  socket?.emit('typing:start', { sessionId });
}

export function stopTyping(sessionId: string): void {
  socket?.emit('typing:stop', { sessionId });
}

export function transferSession(
  sessionId: string,
  toAgentId: string,
  reason: string
): void {
  socket?.emit('session:transfer', { sessionId, toAgentId, reason });
}

export function reopenSession(sessionId: string): void {
  socket?.emit('session:reopen', { sessionId });
}

export function setSessionCategory(
  sessionId: string,
  category: string
): void {
  socket?.emit('session:setCategory', { sessionId, category });
}

export function blockUser(
  telegramId: number,
  blockType: 'temporary' | 'permanent',
  reason: string,
  durationHours?: number
): void {
  socket?.emit('user:block', { telegramId, blockType, reason, durationHours });
}

export function unblockUser(telegramId: number): void {
  socket?.emit('user:unblock', { telegramId });
}

// ============= MESSAGE ACTIONS =============

export function editMessage(
  messageId: string,
  sessionId: string,
  newContent: string,
  callback?: (result: { ok: boolean; error?: string; data?: Message }) => void
): void {
  socket?.emit('message:edit', { messageId, sessionId, newContent }, callback || (() => {}));
}

export function deleteMessage(
  messageId: string,
  sessionId: string,
  callback?: (result: { ok: boolean; error?: string }) => void
): void {
  socket?.emit('message:delete', { messageId, sessionId }, callback || (() => {}));
}

export function pinMessage(
  messageId: string,
  sessionId: string,
  pinForUser: boolean,
  callback?: (result: { ok: boolean; error?: string }) => void
): void {
  socket?.emit('message:pin', { messageId, sessionId, pinForUser }, callback || (() => {}));
}

export function unpinMessage(
  messageId: string,
  sessionId: string,
  callback?: (result: { ok: boolean; error?: string }) => void
): void {
  socket?.emit('message:unpin', { messageId, sessionId }, callback || (() => {}));
}

export function reportSpam(
  messageId: string,
  sessionId: string,
  callback?: (result: { ok: boolean; error?: string }) => void
): void {
  socket?.emit('message:reportSpam', { messageId, sessionId }, callback || (() => {}));
}

// ============= QUEUE ACTIONS =============

export function takeFromQueue(
  sessionId: string,
  callback?: (result: { ok: boolean; error?: string; data?: ChatSession }) => void
): void {
  socket?.emit('session:takeFromQueue', { sessionId }, callback || (() => {}));
}

export function returnToQueue(
  sessionId: string,
  reason?: string,
  callback?: (result: { ok: boolean; error?: string }) => void
): void {
  socket?.emit('session:returnToQueue', { sessionId, reason }, callback || (() => {}));
}

// ============= WHISPER ACTIONS =============

export function markWhisperAsRead(
  whisperId: string,
  callback?: (result: { ok: boolean; error?: string }) => void
): void {
  socket?.emit('whisper:markRead', { whisperId }, callback || (() => {}));
}

// ============= HELPERS =============

function playNotificationSound(type: 'chat' | 'message' = 'message'): void {
  try {
    const { notifications } = useSettingsStore.getState().settings;
    
    // Check if sound is enabled based on type
    if (type === 'chat' && !notifications.newChatSound) return;
    if (type === 'message' && !notifications.newMessageSound) return;
    
    const audio = new Audio('https://cdn.pixabay.com/audio/2025/06/03/audio_e8e6c2ff70.mp3');
    audio.volume = notifications.volume ?? 0.3;
    audio.play().catch(() => {
      // Ignore autoplay errors
    });
  } catch {
    // Ignore errors
  }
}

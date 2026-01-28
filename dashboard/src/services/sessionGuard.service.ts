/**
 * Session Guard Service (Frontend)
 * Enforces single session and single tab for /chat
 * 
 * LOGIC:
 * - New tab takes control, old tab gets blocked
 * - When blocked: disconnect socket, show overlay
 * - New login on another device: old session gets kicked out
 */

import { getSocket, disconnectSocket } from './socket';

// ============= CONSTANTS =============

const CHANNEL_NAME = 'trelk-session-guard';
const STORAGE_KEY = 'trelk-active-tab';
const HEARTBEAT_INTERVAL = 5000;

// ============= TYPES =============

interface TabMessage {
  type: 'tab_claim' | 'tab_heartbeat' | 'tab_close';
  tabId: string;
  timestamp: number;
  path?: string;
}

type TabBlockedCallback = () => void;
type SessionReplacedCallback = (data: { newDevice: string; newIp: string }) => void;

// ============= STATE =============

let channel: BroadcastChannel | null = null;
let tabId: string = '';
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let serverHeartbeatInterval: ReturnType<typeof setInterval> | null = null;
let isTabBlocked = false;
let isInitialized = false;
let onTabBlocked: TabBlockedCallback | null = null;
let onSessionReplaced: SessionReplacedCallback | null = null;

// ============= TAB ID GENERATION =============

function generateTabId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============= BROWSER SESSION ID =============

/**
 * Get or create a browser session ID
 * Uses localStorage so all tabs in the same browser share the same session ID
 * This allows multiple tabs without triggering session replacement
 */
export function getBrowserSessionId(): string {
  // Use localStorage so all tabs share the same session ID
  let sessionId = localStorage.getItem('trelk-browser-session-id');
  
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
    localStorage.setItem('trelk-browser-session-id', sessionId);
  }
  
  return sessionId;
}

/**
 * Clear the browser session ID (call on logout)
 */
export function clearBrowserSessionId(): void {
  localStorage.removeItem('trelk-browser-session-id');
}

export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS Device';
  if (/Android/.test(ua)) return 'Android Device';
  if (/Windows/.test(platform)) return 'Windows';
  if (/Mac/.test(platform)) return 'macOS';
  if (/Linux/.test(platform)) return 'Linux';
  
  return 'Unknown Device';
}

// ============= BLOCK TAB =============

function blockThisTab(): void {
  if (isTabBlocked) return;
  
  console.warn('[SessionGuard] This tab is being blocked');
  isTabBlocked = true;
  stopHeartbeat();
  
  // Disconnect socket to prevent any further communication
  disconnectSocket();
  
  // Notify callback
  onTabBlocked?.();
}

// ============= BROADCAST CHANNEL =============

function initBroadcastChannel(): boolean {
  if (typeof BroadcastChannel === 'undefined') {
    console.warn('[SessionGuard] BroadcastChannel not supported');
    return false;
  }
  
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    
    channel.onmessage = (event: MessageEvent<TabMessage>) => {
      handleMessage(event.data);
    };
    
    return true;
  } catch (error) {
    console.error('[SessionGuard] Failed to create BroadcastChannel:', error);
    return false;
  }
}

function handleMessage(msg: TabMessage): void {
  // Ignore our own messages
  if (msg.tabId === tabId) return;
  
  switch (msg.type) {
    case 'tab_claim':
      // Another tab is claiming control of /chat
      // We must surrender - new tab wins
      if (msg.path === '/dashboard/chat' && !isTabBlocked) {
        console.log('[SessionGuard] Another tab claimed /chat, blocking this tab');
        blockThisTab();
      }
      break;
      
    case 'tab_close':
      // Another tab closed, if we were blocked we can try to become active
      if (isTabBlocked && msg.path === '/dashboard/chat') {
        console.log('[SessionGuard] Active tab closed, attempting to claim');
        // Don't auto-recover - user needs to refresh
      }
      break;
  }
}

function broadcast(msg: TabMessage): void {
  if (channel) {
    channel.postMessage(msg);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msg));
  }
}

// ============= LOCAL STORAGE FALLBACK =============

function initLocalStorageFallback(): void {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const msg = JSON.parse(event.newValue) as TabMessage;
        handleMessage(msg);
      } catch {
        // Ignore parse errors
      }
    }
  });
}

// ============= INITIALIZATION =============

export function initSessionGuard(
  callbacks: {
    onTabBlocked?: TabBlockedCallback;
    onSessionReplaced?: SessionReplacedCallback;
  } = {}
): void {
  if (isInitialized) return;
  
  tabId = generateTabId();
  onTabBlocked = callbacks.onTabBlocked || null;
  onSessionReplaced = callbacks.onSessionReplaced || null;
  isTabBlocked = false;
  isInitialized = true;
  
  // Initialize broadcast channel
  if (!initBroadcastChannel()) {
    initLocalStorageFallback();
  }
  
  // Listen for socket events
  const socket = getSocket();
  if (socket) {
    socket.on('session:replaced', (data: { reason: string; newDevice: string; newIp: string; replacedAt: string }) => {
      console.warn('[SessionGuard] Session replaced by another device:', data);
      onSessionReplaced?.(data);
      // Socket will be disconnected by the server
    });
    
    socket.on('session:force_logout', () => {
      console.warn('[SessionGuard] Force logout received');
      window.location.href = '/login?reason=session_replaced';
    });
    
    // socket.on('tab:duplicate_detected', () => {
    //   console.warn('[SessionGuard] Server detected duplicate tab');
    //   blockThisTab();
    // });
  }
}

// ============= TAB REGISTRATION =============

export async function registerAsActiveTab(path: string): Promise<boolean> {
  if (isTabBlocked) {
    return false;
  }
  
  // Claim this tab as active - this will block other tabs
  broadcast({
    type: 'tab_claim',
    tabId,
    timestamp: Date.now(),
    path,
  });
  
  // Small delay to let other tabs process the claim message
  await new Promise(resolve => setTimeout(resolve, 50));
  
  // If we got blocked during that time (another newer tab claimed), return false
  if (isTabBlocked) {
    return false;
  }
  
  // Register with server
  const socket = getSocket();
  if (socket?.connected) {
    return new Promise((resolve) => {
      socket.emit('tab:register', { tabId }, (result: { ok: boolean; error?: string; data?: { blocked: boolean } }) => {
        if (result.ok) {
          isTabBlocked = false;
          startHeartbeat(path);
          resolve(true);
        } else {
          // Server said we're blocked
          blockThisTab();
          resolve(false);
        }
      });
    });
  }
  
  // No socket, assume active
  startHeartbeat(path);
  return true;
}

// ============= HEARTBEAT =============

function startHeartbeat(path: string): void {
  stopHeartbeat();
  
  // Local heartbeat - just to keep broadcasting we're active
  heartbeatInterval = setInterval(() => {
    if (!isTabBlocked) {
      broadcast({
        type: 'tab_heartbeat',
        tabId,
        timestamp: Date.now(),
        path,
      });
    }
  }, HEARTBEAT_INTERVAL);
  
  // Server heartbeat
  serverHeartbeatInterval = setInterval(() => {
    const socket = getSocket();
    if (socket?.connected && !isTabBlocked) {
      socket.emit('tab:heartbeat', { tabId }, (result: { ok: boolean }) => {
        if (!result.ok) {
          blockThisTab();
        }
      });
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (serverHeartbeatInterval) {
    clearInterval(serverHeartbeatInterval);
    serverHeartbeatInterval = null;
  }
}

// ============= CLEANUP =============

export function releaseTab(): void {
  stopHeartbeat();
  
  if (!isTabBlocked) {
    broadcast({
      type: 'tab_close',
      tabId,
      timestamp: Date.now(),
      path: '/dashboard/chat',
    });
  }
  
  const socket = getSocket();
  if (socket?.connected) {
    socket.emit('tab:release', { tabId });
  }
}

export function cleanupSessionGuard(): void {
  releaseTab();
  
  if (channel) {
    channel.close();
    channel = null;
  }
  
  onTabBlocked = null;
  onSessionReplaced = null;
  isInitialized = false;
  isTabBlocked = false;
}

// ============= STATUS =============

export function isBlocked(): boolean {
  return isTabBlocked;
}

export function getTabId(): string {
  return tabId;
}

// ============= LIFECYCLE =============

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    releaseTab();
  });
}

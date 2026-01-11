/**
 * useKeyboardShortcuts - Global keyboard shortcuts for the dashboard
 * 
 * Shortcuts:
 * - Ctrl/Cmd + K: Quick search / command palette
 * - Ctrl/Cmd + /: Toggle help modal
 * - Ctrl/Cmd + Enter: Send message
 * - Ctrl/Cmd + Shift + A: Toggle availability
 * - Ctrl/Cmd + Shift + S: Toggle supervisor panel (supervisors only)
 * - Ctrl/Cmd + Shift + C: Toggle copilot panel
 * - Escape: Close modals / deselect
 * - Ctrl/Cmd + 1-9: Select session by index
 * - Ctrl/Cmd + ↑/↓: Navigate sessions
 * - Ctrl/Cmd + N: Take next from queue
 * - Ctrl/Cmd + W: Close current session
 * - Ctrl/Cmd + F: Focus mode toggle
 */

import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

export interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
  category: 'navigation' | 'actions' | 'ui' | 'chat';
  requireRole?: ('admin' | 'supervisor')[];
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts?: ShortcutAction[];
}

// Default shortcuts configuration
const defaultShortcuts: Omit<ShortcutAction, 'action'>[] = [
  // Navigation
  { key: 'k', ctrl: true, description: 'Búsqueda rápida', category: 'navigation' },
  { key: 'ArrowUp', ctrl: true, description: 'Sesión anterior', category: 'navigation' },
  { key: 'ArrowDown', ctrl: true, description: 'Sesión siguiente', category: 'navigation' },
  { key: '1', ctrl: true, description: 'Ir a sesión 1', category: 'navigation' },
  { key: '2', ctrl: true, description: 'Ir a sesión 2', category: 'navigation' },
  { key: '3', ctrl: true, description: 'Ir a sesión 3', category: 'navigation' },
  
  // Actions
  { key: 'Enter', ctrl: true, description: 'Enviar mensaje', category: 'actions' },
  { key: 'n', ctrl: true, description: 'Tomar de cola', category: 'actions' },
  { key: 'w', ctrl: true, description: 'Cerrar sesión', category: 'actions' },
  { key: 'a', ctrl: true, shift: true, description: 'Cambiar disponibilidad', category: 'actions' },
  
  // UI
  { key: '/', ctrl: true, description: 'Mostrar ayuda', category: 'ui' },
  { key: 'Escape', description: 'Cerrar modal', category: 'ui' },
  { key: 'f', ctrl: true, description: 'Modo enfoque', category: 'ui' },
  { key: 's', ctrl: true, shift: true, description: 'Panel supervisor', category: 'ui', requireRole: ['admin', 'supervisor'] },
  { key: 'c', ctrl: true, shift: true, description: 'Panel Copilot', category: 'ui' },
  
  // Chat
  { key: 'e', ctrl: true, description: 'Editar último mensaje', category: 'chat' },
  { key: 'r', ctrl: true, description: 'Respuestas rápidas', category: 'chat' },
];

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { enabled = true, shortcuts = [] } = options;
  const { agent } = useAuthStore();
  const handlersRef = useRef<Map<string, () => void>>(new Map());
  
  // Generate a unique key for a shortcut
  const getShortcutKey = useCallback((shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }) => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push('ctrl');
    if (shortcut.shift) parts.push('shift');
    if (shortcut.alt) parts.push('alt');
    if (shortcut.meta) parts.push('meta');
    parts.push(shortcut.key.toLowerCase());
    return parts.join('+');
  }, []);
  
  // Register a shortcut handler
  const registerShortcut = useCallback((shortcut: ShortcutAction) => {
    const key = getShortcutKey(shortcut);
    handlersRef.current.set(key, shortcut.action);
  }, [getShortcutKey]);
  
  // Unregister a shortcut handler
  const unregisterShortcut = useCallback((shortcut: Omit<ShortcutAction, 'action' | 'description' | 'category'>) => {
    const key = getShortcutKey(shortcut);
    handlersRef.current.delete(key);
  }, [getShortcutKey]);
  
  // Register provided shortcuts
  useEffect(() => {
    shortcuts.forEach(registerShortcut);
    return () => {
      shortcuts.forEach(s => unregisterShortcut(s));
    };
  }, [shortcuts, registerShortcut, unregisterShortcut]);
  
  // Handle keydown events
  useEffect(() => {
    if (!enabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs/textareas
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.isContentEditable;
      
      // Allow some shortcuts even when typing
      const allowWhenTyping = ['Escape', 'Enter'];
      
      if (isTyping && !allowWhenTyping.includes(e.key) && !(e.ctrlKey || e.metaKey)) {
        return;
      }
      
      // Build shortcut key
      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());
      const shortcutKey = parts.join('+');
      
      // Find and execute handler
      const handler = handlersRef.current.get(shortcutKey);
      if (handler) {
        // Check if this requires a specific role
        const shortcutDef = [...defaultShortcuts, ...shortcuts.map(s => ({
          key: s.key,
          ctrl: s.ctrl,
          shift: s.shift,
          alt: s.alt,
          meta: s.meta,
          requireRole: s.requireRole,
        }))].find(s => getShortcutKey(s) === shortcutKey);
        
        if (shortcutDef?.requireRole && agent?.role) {
          if (!shortcutDef.requireRole.includes(agent.role as 'admin' | 'supervisor')) {
            return;
          }
        }
        
        e.preventDefault();
        e.stopPropagation();
        handler();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, agent?.role, shortcuts, getShortcutKey]);
  
  return {
    registerShortcut,
    unregisterShortcut,
    shortcuts: defaultShortcuts,
  };
}

// Shortcut display helper
export function formatShortcut(shortcut: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const parts: string[] = [];
  
  if (shortcut.ctrl) parts.push(isMac ? '⌘' : 'Ctrl');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  
  // Format key display
  let keyDisplay = shortcut.key;
  if (keyDisplay === 'ArrowUp') keyDisplay = '↑';
  else if (keyDisplay === 'ArrowDown') keyDisplay = '↓';
  else if (keyDisplay === 'ArrowLeft') keyDisplay = '←';
  else if (keyDisplay === 'ArrowRight') keyDisplay = '→';
  else if (keyDisplay === 'Escape') keyDisplay = 'Esc';
  else if (keyDisplay === 'Enter') keyDisplay = '⏎';
  else keyDisplay = keyDisplay.toUpperCase();
  
  parts.push(keyDisplay);
  
  return parts.join(isMac ? '' : '+');
}

// Keyboard shortcuts help modal data
export function getShortcutsHelp(agentRole?: string) {
  const shortcuts = defaultShortcuts.filter(s => {
    if (s.requireRole && agentRole) {
      return s.requireRole.includes(agentRole as 'admin' | 'supervisor');
    }
    return !s.requireRole;
  });
  
  // Group by category
  const grouped = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);
  
  return grouped;
}

export default useKeyboardShortcuts;

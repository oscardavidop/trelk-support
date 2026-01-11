/**
 * Toast Store - Sistema de notificaciones en tiempo real
 * Maneja toasts apilables con auto-dismiss, prioridades y agrupación
 */

import { create } from 'zustand';

export type ToastType = 'info' | 'success' | 'warning' | 'error';
export type ToastPriority = 'low' | 'normal' | 'high' | 'critical';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  priority?: ToastPriority;
  duration?: number; // ms, 0 = persistent
  createdAt: Date;
  
  // Optional actions
  action?: {
    label: string;
    onClick: () => void;
  };
  
  // Link to navigate on click
  link?: string;
  
  // Grouping key for deduplication
  groupKey?: string;
  
  // Icon override
  icon?: string;
  
  // For session-related toasts
  sessionId?: string;
}

interface ToastState {
  toasts: Toast[];
  maxVisible: number;
  
  // Actions
  addToast: (toast: Omit<Toast, 'id' | 'createdAt'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
  
  // Convenience methods
  info: (title: string, message?: string, options?: Partial<Omit<Toast, 'id' | 'createdAt' | 'type'>>) => string;
  success: (title: string, message?: string, options?: Partial<Omit<Toast, 'id' | 'createdAt' | 'type'>>) => string;
  warning: (title: string, message?: string, options?: Partial<Omit<Toast, 'id' | 'createdAt' | 'type'>>) => string;
  error: (title: string, message?: string, options?: Partial<Omit<Toast, 'id' | 'createdAt' | 'type'>>) => string;
}

// Default durations by type
const DEFAULT_DURATIONS: Record<ToastType, number> = {
  info: 3000,
  success: 2000,
  warning: 5000,
  error: 0, // Persistent
};

// Priority order
const PRIORITY_ORDER: Record<ToastPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

let toastIdCounter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  maxVisible: 5,
  
  addToast: (toast) => {
    const id = `toast-${++toastIdCounter}-${Date.now()}`;
    const newToast: Toast = {
      ...toast,
      id,
      createdAt: new Date(),
      duration: toast.duration ?? DEFAULT_DURATIONS[toast.type],
      priority: toast.priority ?? 'normal',
    };
    
    set((state) => {
      // Check for duplicates using groupKey
      if (newToast.groupKey) {
        const existingIndex = state.toasts.findIndex(t => t.groupKey === newToast.groupKey);
        if (existingIndex !== -1) {
          // Update existing toast instead of adding new
          const updated = [...state.toasts];
          updated[existingIndex] = { ...updated[existingIndex], ...newToast, id: updated[existingIndex].id };
          return { toasts: updated };
        }
      }
      
      // Add new toast and sort by priority
      const newToasts = [...state.toasts, newToast]
        .sort((a, b) => PRIORITY_ORDER[b.priority || 'normal'] - PRIORITY_ORDER[a.priority || 'normal'])
        .slice(0, 20); // Max 20 in queue
      
      return { toasts: newToasts };
    });
    
    // Auto-dismiss if duration > 0
    const duration = newToast.duration ?? DEFAULT_DURATIONS[newToast.type];
    if (duration > 0) {
      setTimeout(() => {
        get().removeToast(id);
      }, duration);
    }
    
    return id;
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  },
  
  clearAll: () => {
    set({ toasts: [] });
  },
  
  // Convenience methods
  info: (title, message, options) => {
    return get().addToast({ type: 'info', title, message, ...options });
  },
  
  success: (title, message, options) => {
    return get().addToast({ type: 'success', title, message, ...options });
  },
  
  warning: (title, message, options) => {
    return get().addToast({ type: 'warning', title, message, ...options });
  },
  
  error: (title, message, options) => {
    return get().addToast({ type: 'error', title, message, ...options });
  },
}));

// Type for convenience options
type ToastOptions = Partial<Omit<Toast, 'id' | 'createdAt' | 'type'>>;

// Export convenience functions for use outside React
export const toast = {
  info: (title: string, message?: string, options?: ToastOptions) => 
    useToastStore.getState().info(title, message, options),
  success: (title: string, message?: string, options?: ToastOptions) => 
    useToastStore.getState().success(title, message, options),
  warning: (title: string, message?: string, options?: ToastOptions) => 
    useToastStore.getState().warning(title, message, options),
  error: (title: string, message?: string, options?: ToastOptions) => 
    useToastStore.getState().error(title, message, options),
  remove: (id: string) => useToastStore.getState().removeToast(id),
  clear: () => useToastStore.getState().clearAll(),
};

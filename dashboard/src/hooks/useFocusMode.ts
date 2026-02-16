/**
 * FocusMode - Premium Zinc Refactor (Draggable & Dockable)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// ============= STORE =============

interface FocusModeState {
  isEnabled: boolean;
  isForce: boolean; // Para forzar el modo enfoque sin mostrar el indicador
  hideSidebar: boolean;
  hideInfoPanel: boolean;
  hideOtherSessions: boolean;
  dimInactiveSessions: boolean;
  zenMode: boolean;

  // Nuevo: Estado para la posición y minimizado
  isDocked: boolean;
  position: { x: number; y: number };

  toggleFocusMode: () => void;
  enableFocusMode: () => void;
  disableFocusMode: () => void;
  setSettings: (settings: Partial<FocusModeState>) => void;
  setPosition: (pos: { x: number; y: number }) => void;
  toggleDock: () => void;
}

export const useFocusModeStore = create<FocusModeState>()(
  persist(
    (set) => ({
      isEnabled: false,
      isForce: false,
      hideSidebar: true,
      hideInfoPanel: true,
      hideOtherSessions: true,
      dimInactiveSessions: true,
      zenMode: false,
      isDocked: false,
      position: { x: (window.innerWidth / 2) - 150, y: 32 },
      toggleFocusMode: () => set((state) => ({ isEnabled: !state.isEnabled })),
      enableFocusMode: () => set({ isEnabled: true, isForce: true }),
      disableFocusMode: () => set({ isEnabled: false, isForce: false }),
      setSettings: (settings) => set((state) => ({ ...state, ...settings })),
      setPosition: (pos) => set({ position: pos }),
      toggleDock: () => set((state) => ({ isDocked: !state.isDocked })),
    }),
    { name: 'focus-mode-storage' }
  )
);


export default useFocusModeStore;
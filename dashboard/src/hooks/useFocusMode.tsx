/**
 * FocusMode - Hook and component for distraction-free chat mode
 * Hides sidebars and shows only the active conversation
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FocusModeState {
  isEnabled: boolean;
  hideSidebar: boolean;
  hideInfoPanel: boolean;
  hideOtherSessions: boolean;
  dimInactiveSessions: boolean;
  zenMode: boolean; // Extra minimal mode
  
  // Actions
  toggleFocusMode: () => void;
  enableFocusMode: () => void;
  disableFocusMode: () => void;
  setSettings: (settings: Partial<FocusModeState>) => void;
}

export const useFocusModeStore = create<FocusModeState>()(
  persist(
    (set) => ({
      isEnabled: false,
      hideSidebar: true,
      hideInfoPanel: true,
      hideOtherSessions: true,
      dimInactiveSessions: true,
      zenMode: false,
      
      toggleFocusMode: () => set((state) => ({ isEnabled: !state.isEnabled })),
      enableFocusMode: () => set({ isEnabled: true }),
      disableFocusMode: () => set({ isEnabled: false }),
      setSettings: (settings) => set((state) => ({ ...state, ...settings })),
    }),
    {
      name: 'focus-mode-storage',
    }
  )
);

// Focus Mode Toggle Button
interface ToggleProps {
  className?: string;
}

export function FocusModeToggle({ className = '' }: ToggleProps) {
  const { isEnabled, toggleFocusMode } = useFocusModeStore();
  
  return (
    <button
      onClick={toggleFocusMode}
      className={`p-2 rounded-lg transition-colors ${
        isEnabled 
          ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
          : 'text-gray-400 hover:text-white hover:bg-gray-800'
      } ${className}`}
      title={isEnabled ? 'Desactivar modo enfoque (Ctrl+F)' : 'Modo enfoque (Ctrl+F)'}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {isEnabled ? (
          // Focused icon (eye)
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        ) : (
          // Unfocused icon (expand)
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        )}
      </svg>
    </button>
  );
}

// Focus Mode Indicator (shows when active)
export function FocusModeIndicator() {
  const { isEnabled, disableFocusMode } = useFocusModeStore();
  
  if (!isEnabled) return null;
  
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-3 px-4 py-2 bg-blue-900/90 backdrop-blur border border-blue-500/30 rounded-full shadow-lg">
        <div className="flex items-center gap-2 text-blue-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium">Modo Enfoque</span>
        </div>
        <button
          onClick={disableFocusMode}
          className="px-2 py-1 text-xs text-blue-300 hover:text-white transition-colors"
        >
          Salir (Esc)
        </button>
      </div>
    </div>
  );
}

// Settings panel for focus mode
interface SettingsProps {
  className?: string;
}

export function FocusModeSettings({ className = '' }: SettingsProps) {
  const { 
    hideSidebar, 
    hideInfoPanel, 
    hideOtherSessions, 
    dimInactiveSessions,
    zenMode,
    setSettings 
  } = useFocusModeStore();
  
  const settings = [
    {
      key: 'hideSidebar',
      label: 'Ocultar barra lateral',
      description: 'Oculta la lista de sesiones',
      value: hideSidebar,
    },
    {
      key: 'hideInfoPanel',
      label: 'Ocultar panel de info',
      description: 'Oculta el panel derecho de contacto',
      value: hideInfoPanel,
    },
    {
      key: 'hideOtherSessions',
      label: 'Ocultar otras sesiones',
      description: 'Solo muestra la sesión activa',
      value: hideOtherSessions,
    },
    {
      key: 'dimInactiveSessions',
      label: 'Atenuar inactivas',
      description: 'Reduce opacidad de otras sesiones',
      value: dimInactiveSessions,
    },
    {
      key: 'zenMode',
      label: 'Modo Zen',
      description: 'Interfaz ultra-minimalista',
      value: zenMode,
    },
  ];
  
  return (
    <div className={`space-y-4 ${className}`}>
      <h4 className="text-sm font-semibold text-gray-300">Configuración de Modo Enfoque</h4>
      
      <div className="space-y-3">
        {settings.map(setting => (
          <label 
            key={setting.key}
            className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
          >
            <div>
              <p className="text-sm text-white">{setting.label}</p>
              <p className="text-xs text-gray-500">{setting.description}</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={setting.value}
                onChange={(e) => setSettings({ [setting.key]: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-gray-700 rounded-full peer peer-checked:bg-blue-500 transition-colors" />
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default useFocusModeStore;

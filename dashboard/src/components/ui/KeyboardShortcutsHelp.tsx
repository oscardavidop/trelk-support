/**
 * KeyboardShortcutsHelp - Modal showing available keyboard shortcuts
 */

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { getShortcutsHelp, formatShortcut } from '../../hooks/useKeyboardShortcuts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const categoryLabels: Record<string, { label: string; icon: string }> = {
  navigation: { label: 'Navegación', icon: '🧭' },
  actions: { label: 'Acciones', icon: '⚡' },
  ui: { label: 'Interfaz', icon: '🎨' },
  chat: { label: 'Chat', icon: '💬' },
};

export function KeyboardShortcutsHelp({ isOpen, onClose }: Props) {
  const { agent } = useAuthStore();
  
  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const grouped = getShortcutsHelp(agent?.role);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-50">Atajos de Teclado</h2>
              <p className="text-sm text-gray-400">Navega más rápido con atajos</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-zinc-50 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="grid grid-cols-2 gap-6">
            {Object.entries(grouped).map(([category, shortcuts]) => {
              const categoryInfo = categoryLabels[category] || { label: category, icon: '•' };
              
              return (
                <div key={category}>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercasemb-3">
                    <span>{categoryInfo.icon}</span>
                    {categoryInfo.label}
                  </h3>
                  
                  <div className="space-y-2">
                    {shortcuts.map((shortcut, i) => (
                      <div 
                        key={i}
                        className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg"
                      >
                        <span className="text-sm text-gray-300">
                          {shortcut.description}
                        </span>
                        <kbd className="px-2 py-1 bg-gray-700 text-gray-200 text-xs font-mono rounded border border-gray-600">
                          {formatShortcut(shortcut)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-800/50">
          <p className="text-xs text-gray-500 text-center">
            Presiona <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300 font-mono">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300 font-mono">/</kbd> para abrir esta ayuda en cualquier momento
          </p>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsHelp;

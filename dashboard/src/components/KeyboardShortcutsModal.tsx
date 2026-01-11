/**
 * KeyboardShortcutsModal - Display all available keyboard shortcuts
 */

import { X } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string;
    description: string;
  }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Mensajes',
    shortcuts: [
      { keys: 'Ctrl + Enter', description: 'Enviar mensaje' },
      { keys: '/', description: 'Abrir respuestas rápidas' },
      { keys: 'Escape', description: 'Cerrar modal / Cancelar' },
    ],
  },
  {
    title: 'Acciones de Chat',
    shortcuts: [
      { keys: 'Alt + C', description: 'Cerrar chat actual' },
      { keys: 'Alt + T', description: 'Transferir chat' },
      { keys: 'Alt + N', description: 'Agregar nota interna' },
      { keys: 'Alt + G', description: 'Agregar/quitar etiquetas' },
      { keys: 'Alt + P', description: 'Fijar mensaje' },
    ],
  },
  {
    title: 'Navegación',
    shortcuts: [
      { keys: 'Alt + ↑', description: 'Chat anterior' },
      { keys: 'Alt + ↓', description: 'Chat siguiente' },
      { keys: 'Alt + 1-9', description: 'Cambiar a chat 1-9' },
    ],
  },
  {
    title: 'Modos de Vista',
    shortcuts: [
      { keys: 'F11', description: 'Alternar modo Focus' },
      { keys: 'Ctrl + B', description: 'Alternar barra lateral' },
      { keys: 'Ctrl + I', description: 'Alternar panel de info' },
    ],
  },
  {
    title: 'Acceso Rápido',
    shortcuts: [
      { keys: 'Ctrl + K', description: 'Paleta de comandos' },
      { keys: 'Ctrl + F', description: 'Buscar en chat' },
      { keys: 'Ctrl + Shift + F', description: 'Búsqueda global' },
    ],
  },
  {
    title: 'Ayuda',
    shortcuts: [
      { keys: '?', description: 'Mostrar esta ayuda' },
    ],
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] overflow-auto bg-gray-900 rounded-2xl shadow-2xl border border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Atajos de Teclado</h2>
              <p className="text-sm text-gray-400">Acciones rápidas para mayor productividad</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                  {group.title}
                </h3>
                <div className="space-y-2">
                  {group.shortcuts.map((shortcut) => (
                    <div 
                      key={shortcut.keys}
                      className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg"
                    >
                      <span className="text-sm text-gray-300">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.split(' + ').map((key, idx) => (
                          <span key={idx} className="flex items-center">
                            {idx > 0 && <span className="text-gray-600 mx-0.5">+</span>}
                            <kbd className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-200 font-mono min-w-[28px] text-center">
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="border-t border-gray-700 px-6 py-4">
          <p className="text-sm text-gray-500 text-center">
            Presiona <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs font-mono">Ctrl + K</kbd> para abrir la paleta de comandos
          </p>
        </div>
      </div>
    </div>
  );
}

export default KeyboardShortcutsModal;

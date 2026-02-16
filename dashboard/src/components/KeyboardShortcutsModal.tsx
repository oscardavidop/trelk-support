/**
 * KeyboardShortcutsModal - Display all available keyboard shortcuts
 * UI Refactor: Premium Zinc Style
 */

import { X, Keyboard, Command } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Mensajería',
    shortcuts: [
      { keys: ['Ctrl', 'Enter'], description: 'Enviar mensaje' },
      { keys: ['/'], description: 'Respuestas rápidas' },
      { keys: ['Esc'], description: 'Cancelar / Cerrar' },
    ],
  },
  {
    title: 'Gestión de Chat',
    shortcuts: [
      { keys: ['Alt', 'C'], description: 'Cerrar chat actual' },
      { keys: ['Alt', 'T'], description: 'Transferir chat' },
      { keys: ['Alt', 'N'], description: 'Nota interna' },
      { keys: ['Alt', 'P'], description: 'Fijar mensaje' },
    ],
  },
  {
    title: 'Navegación',
    shortcuts: [
      { keys: ['Alt', '↑'], description: 'Chat anterior' },
      { keys: ['Alt', '↓'], description: 'Chat siguiente' },
      { keys: ['Alt', '1-9'], description: 'Ir a chat N' },
    ],
  },
  {
    title: 'Interfaz',
    shortcuts: [
      { keys: ['F11'], description: 'Modo Focus' },
      { keys: ['Ctrl', 'B'], description: 'Toggle Sidebar' },
      { keys: ['Ctrl', 'I'], description: 'Toggle Info' },
    ],
  },
  {
    title: 'Global',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Paleta Comandos' },
      { keys: ['Ctrl', 'F'], description: 'Buscar' },
      { keys: ['?'], description: 'Ayuda' },
    ],
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-3xl bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-800 bg-zinc-900">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl shadow-inner">
              <Keyboard className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-50 tracking-tight">Atajos de Teclado</h2>
              <p className="text-sm text-zinc-400">Optimiza tu flujo de trabajo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Scrollable Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <h3 className="text-xs font-bold text-zinc-500 st mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-700"></span>
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.shortcuts.map((shortcut) => (
                    <div 
                      key={shortcut.description}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                    >
                      <span className="text-sm text-zinc-300 group-hover:text-zinc-50 transition-colors font-medium">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {shortcut.keys.map((key, idx) => (
                          <span key={idx} className="flex items-center">
                            {idx > 0 && <span className="text-zinc-600 mx-1 text-xs">+</span>}
                            <KeyCap>{key}</KeyCap>
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
        <div className="border-t border-zinc-800 px-6 py-4 bg-zinc-950/50 flex justify-center">
          <div className="inline-flex items-center gap-2 text-xs text-zinc-500">
            <Command className="w-3.5 h-3.5" />
            <span>Presiona</span>
            <KeyCap small>Ctrl</KeyCap>
            <span>+</span>
            <KeyCap small>K</KeyCap>
            <span>para abrir el menú de comandos en cualquier momento</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Component for Keys
function KeyCap({ children, small }: { children: React.ReactNode, small?: boolean }) {
  return (
    <kbd className={`
      flex items-center justify-center bg-zinc-800 border-b-2 border-zinc-950 
      rounded-md text-zinc-200 font-mono font-bold shadow-sm select-none
      ${small ? 'px-1.5 py-0.5 text-[10px] min-w-[20px]' : 'px-2 py-1 text-xs min-w-[28px]'}
    `}>
      {children}
    </kbd>
  );
}

export default KeyboardShortcutsModal;
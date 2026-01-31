/**
 * CommandPalette - Ctrl+K Quick Action Palette
 * UI Refactor: Premium Zinc Style
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, MessageCircle, Users, Settings, Eye, Activity, Download,
  LayoutDashboard, MessageSquare, Keyboard, RefreshCw, Zap,
  ArrowRight, Command as CommandIcon
} from 'lucide-react';

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'navigation' | 'action' | 'settings' | 'help';
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onShowShortcuts: () => void;
}

export function CommandPalette({ isOpen, onClose, onShowShortcuts }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Define commands
  const commands: Command[] = useMemo(() => [
    // Navigation
    { id: 'nav-overview', label: 'Ir a Overview', description: 'Dashboard principal', icon: <LayoutDashboard className="w-4 h-4" />, category: 'navigation', action: () => { navigate('/dashboard'); onClose(); } },
    { id: 'nav-chat', label: 'Ir a Chat', description: 'Conversaciones activas', icon: <MessageCircle className="w-4 h-4" />, category: 'navigation', action: () => { navigate('/dashboard/chat'); onClose(); } },
    { id: 'nav-supervisor', label: 'Ir a Supervisor', description: 'Panel de supervisión', icon: <Eye className="w-4 h-4" />, category: 'navigation', action: () => { navigate('/dashboard/supervisor'); onClose(); } },
    { id: 'nav-audit', label: 'Ir a Actividad', description: 'Logs de auditoría', icon: <Activity className="w-4 h-4" />, category: 'navigation', action: () => { navigate('/dashboard/audit'); onClose(); } },
    { id: 'nav-exports', label: 'Ir a Exportar', description: 'Descargar reportes', icon: <Download className="w-4 h-4" />, category: 'navigation', action: () => { navigate('/dashboard/exports'); onClose(); } },
    { id: 'nav-replies', label: 'Respuestas Rápidas', description: 'Gestionar plantillas', icon: <MessageSquare className="w-4 h-4" />, category: 'navigation', action: () => { navigate('/dashboard/saved-replies'); onClose(); } },
    { id: 'nav-agents', label: 'Ir a Agentes', description: 'Gestión de equipo', icon: <Users className="w-4 h-4" />, category: 'navigation', action: () => { navigate('/dashboard/agents'); onClose(); } },
    { id: 'nav-settings', label: 'Configuración', description: 'Ajustes del sistema', icon: <Settings className="w-4 h-4" />, category: 'navigation', action: () => { navigate('/dashboard/settings'); onClose(); } },
    // Actions
    { id: 'action-refresh', label: 'Recargar Datos', description: 'Sincronizar interfaz', icon: <RefreshCw className="w-4 h-4" />, category: 'action', shortcut: 'F5', action: () => { window.location.reload(); } },
    // Help
    { id: 'help-shortcuts', label: 'Atajos de Teclado', description: 'Ver lista completa', icon: <Keyboard className="w-4 h-4" />, category: 'help', shortcut: '?', action: () => { onShowShortcuts(); onClose(); } },
  ], [navigate, onClose, onShowShortcuts]);

  // Filter logic
  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Grouping logic
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = { navigation: [], action: [], settings: [], help: [] };
    filteredCommands.forEach(cmd => { if (groups[cmd.category]) groups[cmd.category].push(cmd); });
    return groups;
  }, [filteredCommands]);

  useEffect(() => { setSelectedIndex(0); }, [query]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) filteredCommands[selectedIndex].action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navegación',
    action: 'Acciones Rápidas',
    settings: 'Sistema',
    help: 'Ayuda',
  };

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Palette Container */}
      <div className="relative w-full max-w-xl bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden ring-1 ring-white/10 flex flex-col max-h-[75vh] animate-in zoom-in-95 slide-in-from-top-2 duration-200">
        
        {/* Search Header */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <Search className="w-5 h-5 text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="¿Qué quieres hacer?"
            className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-lg font-medium"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-md text-[10px] text-zinc-400 font-mono font-bold tracking-wider">
            ESC
          </kbd>
        </div>
        
        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar p-2 scroll-smooth">
          {filteredCommands.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 bg-zinc-800/50 rounded-full flex items-center justify-center mx-auto mb-3">
                 <Search className="w-5 h-5 text-zinc-600" />
              </div>
              <p className="text-sm text-zinc-400 font-medium">No se encontraron resultados</p>
              <p className="text-xs text-zinc-600 mt-1">Intenta con otro término de búsqueda</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => {
              if (cmds.length === 0) return null;
              
              return (
                <div key={category} className="mb-2 last:mb-0">
                  <p className="px-3 py-2 text-[10px] font-bold text-zinc-500 r bg-zinc-900/95 backdrop-blur-sm z-10">
                    {categoryLabels[category]}
                  </p>
                  <div className="space-y-0.5">
                    {cmds.map(cmd => {
                      flatIndex++;
                      const isSelected = flatIndex === selectedIndex;
                      
                      return (
                        <button
                          key={cmd.id}
                          data-index={flatIndex}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`
                            w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-150 group relative
                            ${isSelected ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50'}
                          `}
                        >
                          {/* Selection Indicator */}
                          {isSelected && (
                             <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                          )}

                          <div className={`p-2 rounded-lg transition-colors ${isSelected ? 'bg-zinc-700 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-500'}`}>
                            {cmd.icon}
                          </div>
                          
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-2">
                                <p className={`text-sm font-medium truncate ${isSelected ? 'text-zinc-100' : 'text-zinc-300'}`}>{cmd.label}</p>
                                {isSelected && <ArrowRight className="w-3 h-3 text-indigo-400 animate-in slide-in-from-left-1 fade-in duration-300" />}
                            </div>
                            {cmd.description && (
                              <p className={`text-xs truncate ${isSelected ? 'text-zinc-400' : 'text-zinc-600'}`}>{cmd.description}</p>
                            )}
                          </div>
                          
                          {cmd.shortcut && (
                            <kbd className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${isSelected ? 'bg-zinc-700 border-zinc-600 text-zinc-300' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                              {cmd.shortcut}
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between text-[10px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <KeyIcon>↑</KeyIcon>
              <KeyIcon>↓</KeyIcon>
              <span>Navegar</span>
            </span>
            <span className="flex items-center gap-1.5">
              <KeyIcon>↵</KeyIcon>
              <span>Seleccionar</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 opacity-50">
            <CommandIcon className="w-3 h-3" />
            <span className="font-medium tracking-wide">COMMAND PALETTE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper for Footer Keys
function KeyIcon({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="min-w-[18px] h-[18px] flex items-center justify-center bg-zinc-800 border border-zinc-700 rounded text-zinc-300 font-mono shadow-sm">
            {children}
        </kbd>
    );
}

export default CommandPalette;
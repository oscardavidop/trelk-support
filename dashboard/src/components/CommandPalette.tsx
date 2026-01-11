/**
 * CommandPalette - Ctrl+K Quick Action Palette
 * Fuzzy search for actions, navigation, and commands
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search,
  MessageCircle,
  Users,
  Settings,
  Eye,
  Activity,
  Download,
  LayoutDashboard,
  MessageSquare,
  Keyboard,
  Moon,
  Sun,
  LogOut,
  RefreshCw,
  Send,
  Tag,
  Clock,
  FileText,
  Zap
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
    {
      id: 'nav-overview',
      label: 'Ir a Overview',
      description: 'Dashboard principal',
      icon: <LayoutDashboard className="w-4 h-4" />,
      category: 'navigation',
      action: () => { navigate('/dashboard'); onClose(); }
    },
    {
      id: 'nav-chat',
      label: 'Ir a Chat',
      description: 'Conversaciones activas',
      icon: <MessageCircle className="w-4 h-4" />,
      category: 'navigation',
      action: () => { navigate('/dashboard/chat'); onClose(); }
    },
    {
      id: 'nav-supervisor',
      label: 'Ir a Supervisor',
      description: 'Panel de supervisión',
      icon: <Eye className="w-4 h-4" />,
      category: 'navigation',
      action: () => { navigate('/dashboard/supervisor'); onClose(); }
    },
    {
      id: 'nav-audit',
      label: 'Ir a Actividad',
      description: 'Logs de actividad y auditoría',
      icon: <Activity className="w-4 h-4" />,
      category: 'navigation',
      action: () => { navigate('/dashboard/audit'); onClose(); }
    },
    {
      id: 'nav-exports',
      label: 'Ir a Exportar',
      description: 'Sistema de exportación',
      icon: <Download className="w-4 h-4" />,
      category: 'navigation',
      action: () => { navigate('/dashboard/exports'); onClose(); }
    },
    {
      id: 'nav-replies',
      label: 'Ir a Respuestas Guardadas',
      description: 'Respuestas rápidas',
      icon: <MessageSquare className="w-4 h-4" />,
      category: 'navigation',
      action: () => { navigate('/dashboard/saved-replies'); onClose(); }
    },
    {
      id: 'nav-agents',
      label: 'Ir a Agentes',
      description: 'Gestión de agentes',
      icon: <Users className="w-4 h-4" />,
      category: 'navigation',
      action: () => { navigate('/dashboard/agents'); onClose(); }
    },
    {
      id: 'nav-settings',
      label: 'Ir a Configuración',
      description: 'Ajustes del sistema',
      icon: <Settings className="w-4 h-4" />,
      category: 'navigation',
      action: () => { navigate('/dashboard/settings'); onClose(); }
    },
    // Actions
    {
      id: 'action-new-export',
      label: 'Nueva Exportación',
      description: 'Crear una exportación de datos',
      icon: <Download className="w-4 h-4" />,
      category: 'action',
      action: () => { navigate('/dashboard/exports'); onClose(); }
    },
    {
      id: 'action-refresh',
      label: 'Actualizar Datos',
      description: 'Recargar información actual',
      icon: <RefreshCw className="w-4 h-4" />,
      category: 'action',
      shortcut: 'F5',
      action: () => { window.location.reload(); }
    },
    // Help
    {
      id: 'help-shortcuts',
      label: 'Ver Atajos de Teclado',
      description: 'Lista de todos los atajos',
      icon: <Keyboard className="w-4 h-4" />,
      category: 'help',
      shortcut: '?',
      action: () => { onShowShortcuts(); onClose(); }
    },
  ], [navigate, onClose, onShowShortcuts]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    
    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery)
    );
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {
      navigation: [],
      action: [],
      settings: [],
      help: [],
    };
    
    filteredCommands.forEach(cmd => {
      groups[cmd.category].push(cmd);
    });
    
    return groups;
  }, [filteredCommands]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredCommands, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const categoryLabels: Record<string, string> = {
    navigation: 'Navegación',
    action: 'Acciones',
    settings: 'Configuración',
    help: 'Ayuda',
  };

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Palette */}
      <div className="relative w-full max-w-xl bg-gray-900 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-700">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un comando o busca..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-lg"
          />
          <kbd className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400 font-mono">
            ESC
          </kbd>
        </div>
        
        {/* Commands List */}
        <div ref={listRef} className="max-h-96 overflow-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No se encontraron comandos</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => {
              if (cmds.length === 0) return null;
              
              return (
                <div key={category} className="mb-4 last:mb-0">
                  <p className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {categoryLabels[category]}
                  </p>
                  <div className="space-y-1 mt-1">
                    {cmds.map(cmd => {
                      flatIndex++;
                      const isSelected = flatIndex === selectedIndex;
                      
                      return (
                        <button
                          key={cmd.id}
                          data-index={flatIndex}
                          onClick={cmd.action}
                          onMouseEnter={() => setSelectedIndex(flatIndex)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-primary/20 text-primary'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-gray-800'}`}>
                            {cmd.icon}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium">{cmd.label}</p>
                            {cmd.description && (
                              <p className="text-xs text-gray-500">{cmd.description}</p>
                            )}
                          </div>
                          {cmd.shortcut && (
                            <kbd className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400 font-mono">
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
        <div className="px-4 py-2 border-t border-gray-700 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded font-mono">↓</kbd>
              <span>navegar</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 rounded font-mono">↵</kbd>
              <span>seleccionar</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            <span>Command Palette</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;

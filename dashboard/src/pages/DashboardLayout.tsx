// Dashboard Layout - Main container with sidebar
import { useEffect, useState, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useSupervisorStore } from '../stores/supervisorStore';
import { initializeSocket, disconnectSocket, updateAgentStatus } from '../services/socket';
import Sidebar from '../components/Sidebar';
import { ConnectionBanner } from '../components/ConnectionStatus';
import { ToastContainer } from '../components/ToastContainer';
import { SupervisorPanel, WhisperNotifications } from '../components/supervisor';
import { CommandPalette } from '../components/CommandPalette';
import { KeyboardShortcutsModal } from '../components/KeyboardShortcutsModal';
import { FocusModeIndicator, useFocusModeStore } from '../hooks/useFocusMode';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, agent, checkAuth } = useAuthStore();
  const stats = useChatStore((state) => state.stats);
  const { showSupervisorPanel, toggleSupervisorPanel } = useSupervisorStore();
  const { isEnabled: isFocusMode, toggleFocusMode, disableFocusMode } = useFocusModeStore();
  
  // UI State
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  
  // Check if user can access supervisor features
  const canSupervise = agent?.role === 'admin' || agent?.role === 'supervisor';

  // Keyboard shortcuts
  const handleToggleShortcutsHelp = useCallback(() => {
    setShowShortcutsHelp(prev => !prev);
  }, []);
  
  const handleToggleCommandPalette = useCallback(() => {
    setShowCommandPalette(prev => !prev);
  }, []);
  
  const handleEscape = useCallback(() => {
    if (showCommandPalette) {
      setShowCommandPalette(false);
    } else if (showShortcutsHelp) {
      setShowShortcutsHelp(false);
    } else if (isFocusMode) {
      disableFocusMode();
    }
  }, [showCommandPalette, showShortcutsHelp, isFocusMode, disableFocusMode]);
  
  // Register keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: '/',
        ctrl: true,
        action: handleToggleShortcutsHelp,
        description: 'Mostrar atajos',
        category: 'ui',
      },
      {
        key: 'k',
        ctrl: true,
        action: handleToggleCommandPalette,
        description: 'Paleta de comandos',
        category: 'ui',
      },
      {
        key: '?',
        action: handleToggleShortcutsHelp,
        description: 'Mostrar atajos',
        category: 'ui',
      },
      {
        key: 'f',
        ctrl: true,
        action: toggleFocusMode,
        description: 'Modo enfoque',
        category: 'ui',
      },
      {
        key: 's',
        ctrl: true,
        shift: true,
        action: () => canSupervise && toggleSupervisorPanel(),
        description: 'Panel supervisor',
        category: 'ui',
        requireRole: ['admin', 'supervisor'],
      },
      {
        key: 'Escape',
        action: handleEscape,
        description: 'Cerrar/Salir',
        category: 'ui',
      },
    ],
  });

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Initialize socket once when authenticated
  // We use a ref to track initialization and avoid re-running on agent updates
  useEffect(() => {
    if (isAuthenticated && agent) {
      const socket = initializeSocket();
      
      // Set agent online when connected (only on initial connect)
      const handleConnect = () => {
        updateAgentStatus('online');
      };
      
      socket.on('connect', handleConnect);

      return () => {
        socket.off('connect', handleConnect);
        disconnectSocket();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Only depend on isAuthenticated, not agent

  // Handle visibility change - set away when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updateAgentStatus('away');
      } else {
        updateAgentStatus('online');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Connection status banner (shows when disconnected/reconnecting) */}
      <ConnectionBanner />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - hidden in focus mode if configured */}
        {!isFocusMode && (
          <Sidebar agent={agent} stats={stats} />
        )}
        
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      
      {/* Toast notifications */}
      <ToastContainer />
      
      {/* Whisper notifications (for agents receiving whispers from supervisors) */}
      <WhisperNotifications />
      
      {/* Supervisor Panel */}
      {canSupervise && (
        <SupervisorPanel 
          isOpen={showSupervisorPanel} 
          onClose={toggleSupervisorPanel} 
        />
      )}
      
      {/* Command Palette (Ctrl+K) */}
      <CommandPalette 
        isOpen={showCommandPalette} 
        onClose={() => setShowCommandPalette(false)}
        onShowShortcuts={() => setShowShortcutsHelp(true)}
      />
      
      {/* Keyboard shortcuts help modal */}
      <KeyboardShortcutsModal 
        isOpen={showShortcutsHelp} 
        onClose={() => setShowShortcutsHelp(false)} 
      />
      
      {/* Focus mode indicator */}
      <FocusModeIndicator />
    </div>
  );
}

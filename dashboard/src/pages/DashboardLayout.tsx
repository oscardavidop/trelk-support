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
import { FocusModeIndicator } from '../components/FocusModeIndicator';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { TelegramLinkRequired } from '../components/TelegramLinkRequired';
import { MFASetupRequired } from '../components/MFASetupRequired';
import AutoLockProvider from '../components/AutoLockProvider';
import BroadcastBanner from '../components/BroadcastBanner';
import QACoachingModal from '../components/QACoachingModal';
import { initNotificationSocket, cleanupNotificationSocket } from '../stores/notificationStore';
import { Loader2 } from 'lucide-react';
import useFocusModeStore from '../hooks/useFocusMode';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, agent, checkAuth, forcePasswordChange, telegramLinkRequired, mfaSetupRequired, setTelegramLinkRequired, setMfaSetupRequired } = useAuthStore();
  const stats = useChatStore((state) => state.stats);
  const { showSupervisorPanel, toggleSupervisorPanel } = useSupervisorStore();
  const { isEnabled: isFocusMode, toggleFocusMode, disableFocusMode } = useFocusModeStore();

  // UI State
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [qaGatePassed, setQaGatePassed] = useState(false);
  const [qaGateChecked, setQaGateChecked] = useState(false);

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
    // Redirect to force-change-password if required
    if (!isLoading && isAuthenticated && forcePasswordChange) {
      navigate('/force-change-password');
    }
  }, [isLoading, isAuthenticated, forcePasswordChange, navigate]);

  // Initialize socket once when authenticated
  // We use a ref to track initialization and avoid re-running on agent updates
  useEffect(() => {
    if (isAuthenticated && agent) {
      const socket = initializeSocket();

      // Initialize notification socket events
      initNotificationSocket();

      // Set agent online when connected (only on initial connect)
      const handleConnect = () => {
        updateAgentStatus('online');
      };

      socket.on('connect', handleConnect);

      return () => {
        socket.off('connect', handleConnect);
        cleanupNotificationSocket();
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

  // Re-trigger QA gate when a new review or edited review arrives via socket
  useEffect(() => {
    if (!isAuthenticated || !agent) return;
    const handleQaEvent = () => {
      // Reset the gate so modal re-checks pending reviews
      setQaGatePassed(false);
    };
    window.addEventListener('qa:review:new', handleQaEvent);
    window.addEventListener('qa:review:edited', handleQaEvent);
    return () => {
      window.removeEventListener('qa:review:new', handleQaEvent);
      window.removeEventListener('qa:review:edited', handleQaEvent);
    };
  }, [isAuthenticated, agent]);

  // Handle Telegram link completion
  const handleTelegramLinkComplete = useCallback(() => {
    setTelegramLinkRequired(false);
  }, [setTelegramLinkRequired]);

  // Handle MFA setup completion
  const handleMfaSetupComplete = useCallback(() => {
    setMfaSetupRequired(false);
  }, [setMfaSetupRequired]);

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


  // Show Telegram link required screen (blocking)
  if (telegramLinkRequired) {
    return <TelegramLinkRequired onLinkComplete={handleTelegramLinkComplete} reason="policy" />;
  }

  // Show MFA setup required screen (blocking) - takes priority over Telegram link
  if (mfaSetupRequired) {
    return <MFASetupRequired onSetupComplete={handleMfaSetupComplete} />;
  }


  return (
    <AutoLockProvider>
      <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {/* QA Coaching Gate — blocking modal for unacknowledged reviews */}
        {isAuthenticated && agent && !qaGatePassed && (
          <QACoachingModal
            agentId={agent._id}
            onAllAcknowledged={() => { setQaGatePassed(true); setQaGateChecked(true); }}
          />
        )}
        {/* Connection status banner (shows when disconnected/reconnecting) */}
        <ConnectionBanner />

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - hidden in focus mode if configured */}
          {/* {isFocusMode  && ( */}
          <Sidebar agent={agent} stats={stats} />
          {/* )} */}

          <main className="flex-1 overflow-hidden flex flex-col z-0">
            {/* Broadcast Banners (internal announcements) */}
            <BroadcastBanner />

            {/* Main content */}
            <div className="flex-1 overflow-auto">
              <Outlet />
            </div>
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
        {!canSupervise && <FocusModeIndicator />}
      </div>
    </AutoLockProvider>
  );
}

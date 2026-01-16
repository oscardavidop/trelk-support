// Chat Page - Main chat interface
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useChatStore } from '../stores/chatStore';
import SessionList from '../components/SessionList';
import ChatWindow from '../components/ChatWindow';
import EmptyState from '../components/EmptyState';
import { ChatInfoSidebar } from '../components/ChatInfoSidebar';
import { TabBlockedOverlay, SessionReplacedOverlay } from '../components/SessionGuardOverlay';
import { 
  initSessionGuard, 
  registerAsActiveTab, 
  releaseTab,
  cleanupSessionGuard,
} from '../services/sessionGuard.service';

export default function ChatPage() {
  const { activeSession, sessions, setActiveSession } = useChatStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Session guard state
  const [isTabBlocked, setIsTabBlocked] = useState(false);
  const [sessionReplaced, setSessionReplaced] = useState<{ device: string; ip: string } | null>(null);
  
  // Get target message ID from URL hash
  const targetMessageId = location.hash?.replace('#message-', '') || null;

  // Initialize session guard on mount
  useEffect(() => {
    initSessionGuard({
      onTabBlocked: () => setIsTabBlocked(true),
      onSessionReplaced: (data) => setSessionReplaced({ device: data.newDevice, ip: data.newIp }),
    });
    
    // Try to register as active tab
    registerAsActiveTab('/dashboard/chat').then((success) => {
      if (!success) {
        setIsTabBlocked(true);
      }
    });
    
    // Cleanup on unmount
    return () => {
      releaseTab();
      cleanupSessionGuard();
    };
  }, []);

  // Handle session param from URL
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (sessionParam && sessions.length > 0) {
      const targetSession = sessions.find(s => s.sessionId === sessionParam);
      if (targetSession && (!activeSession || activeSession.sessionId !== targetSession.sessionId)) {
        setActiveSession(targetSession);
      }
    }
  }, [searchParams, sessions, activeSession, setActiveSession]);

  // Clean up URL after navigating to message (remove session param and hash)
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (sessionParam && activeSession?.sessionId === sessionParam && targetMessageId) {
      // Wait a bit for the scroll animation to complete, then clean URL
      const timer = setTimeout(() => {
        navigate('/dashboard/chat', { replace: true });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeSession, searchParams, targetMessageId, navigate]);

  // Count waiting sessions for badge
  const waitingCount = sessions.filter(s => s.status === 'waiting').length;
  
  // Handle redirect from blocked tab
  const handleGoToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  return (
    <div className="h-screen flex">
      {/* Session Guard Overlays */}
      <TabBlockedOverlay 
        isBlocked={isTabBlocked} 
        onClose={handleGoToDashboard} 
      />
      <SessionReplacedOverlay 
        isShown={!!sessionReplaced} 
        device={sessionReplaced?.device}
        ip={sessionReplaced?.ip}
      />
      
      {/* Session List */}
      <div className="border-r border-gray-800 flex flex-col" style={{ width: isSidebarOpen ? 370 : 370 }}>
        <div className="p-4 border-b border-gray-800 h-[56px] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            Conversations
            {waitingCount > 0 && (
              <span className="px-2 py-0.5 bg-warning text-gray-900 text-xs font-bold rounded-full">
                {waitingCount}
              </span>
            )}
          </h2>
        </div>
        <SessionList />
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeSession ? (
          <ChatWindow 
            key={activeSession.sessionId}
            session={activeSession} 
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
            targetMessageId={targetMessageId}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Contact Info Sidebar */}
      <ChatInfoSidebar
        sessionId={activeSession?.sessionId || null}
        isOpen={isSidebarOpen && !!activeSession}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}

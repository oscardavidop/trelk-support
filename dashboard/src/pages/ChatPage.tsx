import { useState, useEffect, useCallback, useRef } from 'react';
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
import api from '../services/api';
import { MessageSquare, MessageCircle } from 'lucide-react';

export default function ChatPage() {
  const { activeSession, sessions, closedSessions, setActiveSession } = useChatStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const fetchedSessionRef = useRef<string | null>(null);

  // Session guard state
  const [isTabBlocked, setIsTabBlocked] = useState(false);
  const [sessionReplaced, setSessionReplaced] = useState<{ device: string; ip: string } | null>(null);

  // Get target message ID from URL hash — persist in ref so URL cleanup doesn't kill it
  const initialHash = location.hash?.replace('#message-', '') || null;
  const targetMessageRef = useRef<string | null>(initialHash);
  if (initialHash && !targetMessageRef.current) {
    targetMessageRef.current = initialHash;
  }
  const targetMessageId = targetMessageRef.current;

  // Initialize session guard on mount
  useEffect(() => {
    initSessionGuard({
      onTabBlocked: () => setIsTabBlocked(true),
      onSessionReplaced: (data) => setSessionReplaced({ device: data.newDevice, ip: data.newIp }),
    });

    registerAsActiveTab('/dashboard/chat').then((success) => {
      if (!success) setIsTabBlocked(true);
    });

    return () => {
      releaseTab();
      cleanupSessionGuard();
    };
  }, []);

  // Handle session param from URL — search open, closed, then fetch from API
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (!sessionParam) return;
    if (activeSession?.sessionId === sessionParam) return;

    // 1) Search in open sessions
    const inOpen = sessions.find(s => s.sessionId === sessionParam);
    if (inOpen) {
      setActiveSession(inOpen);
      return;
    }

    // 2) Search in closed sessions
    const inClosed = closedSessions.find(s => s.sessionId === sessionParam);
    if (inClosed) {
      setActiveSession(inClosed);
      return;
    }

    // 3) Not in any store — fetch directly from API (only once per session)
    if (fetchedSessionRef.current === sessionParam) return;
    fetchedSessionRef.current = sessionParam;

    (async () => {
      try {
        const res = await api.get<any>(`/api/sessions/${sessionParam}`);
        if (res.ok && res.data?.session) {
          setActiveSession(res.data.session);
        }
      } catch (err) {
        console.error('Failed to fetch session from URL param:', err);
      }
    })();
  }, [searchParams, sessions, closedSessions, activeSession, setActiveSession]);

  // Clean up URL after message has been scrolled to
  useEffect(() => {
    const sessionParam = searchParams.get('session');
    if (sessionParam && activeSession?.sessionId === sessionParam && targetMessageId) {
      const timer = setTimeout(() => {
        targetMessageRef.current = null;
        navigate('/dashboard/chat', { replace: true });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeSession, searchParams, targetMessageId, navigate]);

  const waitingCount = sessions.filter(s => s.status === 'waiting').length;

  const handleGoToDashboard = useCallback(() => {
    navigate('/dashboard');
  }, [navigate]);

  return (
    <div className="h-screen w-full flex bg-zinc-950 text-zinc-100 font-sans overflow-hidden relative selection:bg-indigo-500/30">
      
      {/* Session Guard Overlays */}
      <TabBlockedOverlay isBlocked={isTabBlocked} onClose={handleGoToDashboard} />
      <SessionReplacedOverlay isShown={!!sessionReplaced} device={sessionReplaced?.device} ip={sessionReplaced?.ip} />

      {/* COLUMN 1: Session List (Fixed Width) */}
      <div className="w-[319px] flex flex-col border-r border-zinc-800 bg-zinc-950 shrink-0 z-0">
        {/* Header */}
        <div className="h-[56px] px-4 flex items-center justify-between border-b border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20 shadow-sm shadow-indigo-500/10">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-50 tracking-tight leading-none">Conversaciones</h2>
              <p className="text-[10px] text-zinc-500 font-medium mt-0.5">Bandeja de entrada</p>
            </div>
          </div>
          
          {waitingCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-bold text-amber-500">{waitingCount}</span>
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-hidden relative">
           <SessionList />
        </div>
      </div>

      {/* COLUMN 2: Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-zinc-900/30 relative z-10">
        
        {/* Ambient Glow for Chat Area */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />

        {activeSession ? (
          <ChatWindow
            key={activeSession.sessionId}
            session={activeSession  }
            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
            targetMessageId={targetMessageId}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-[url('/assets/img/pattern.jpg')] opacity-2" />
            <EmptyState />
          </div>
        )}
      </div>

      {/* COLUMN 3: Info Sidebar (Collapsible) */}
      <ChatInfoSidebar
        sessionId={activeSession?.sessionId || null}
        isOpen={isSidebarOpen && !!activeSession}
        onClose={() => setIsSidebarOpen(false)}
      />
    </div>
  );
}
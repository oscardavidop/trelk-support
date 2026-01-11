// Chat Page - Main chat interface
import { useState } from 'react';
import { useChatStore } from '../stores/chatStore';
import SessionList from '../components/SessionList';
import ChatWindow from '../components/ChatWindow';
import EmptyState from '../components/EmptyState';
import { ChatInfoSidebar } from '../components/ChatInfoSidebar';

export default function ChatPage() {
  const { activeSession, sessions } = useChatStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Count waiting sessions for badge
  const waitingCount = sessions.filter(s => s.status === 'waiting').length;

  return (
    <div className="h-screen flex">
      {/* Session List */}
      <div className="border-r border-gray-800 flex flex-col" style={{ width: isSidebarOpen ? 450 : 450 }}>
        <div className="p-4 border-b border-gray-800">
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

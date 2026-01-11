// Dashboard Layout - Main container with sidebar
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { initializeSocket, disconnectSocket, updateAgentStatus } from '../services/socket';
import Sidebar from '../components/Sidebar';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, agent, checkAuth } = useAuthStore();
  const stats = useChatStore((state) => state.stats);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated && agent) {
      const socket = initializeSocket();
      
      // Set agent online when connected
      socket.on('connect', () => {
        updateAgentStatus('online');
      });

      return () => {
        disconnectSocket();
      };
    }
  }, [isAuthenticated, agent]);

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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <Sidebar agent={agent} stats={stats} />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

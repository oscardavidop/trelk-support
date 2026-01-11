// Empty State component
import { MessageCircle, ArrowRight } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';

export default function EmptyState() {
  const stats = useChatStore((state) => state.stats);
  const waitingCount = stats?.sessions.waiting || 0;

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-900/50">
      <div className="text-center max-w-md px-4">
        <div className="w-20 h-20 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <MessageCircle className="w-10 h-10 text-gray-600" />
        </div>
        
        <h2 className="text-xl font-semibold text-white mb-2">
          No conversation selected
        </h2>
        
        <p className="text-gray-500 mb-6">
          Select a conversation from the sidebar to start chatting with users.
        </p>

        {waitingCount > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-warning/10 text-warning rounded-lg">
            <span className="font-medium">{waitingCount}</span>
            <span>user{waitingCount !== 1 ? 's' : ''} waiting for support</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        )}
      </div>
    </div>
  );
}

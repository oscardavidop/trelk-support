/**
 * Typing Indicator Component
 * Shows when user is typing in real-time
 */

import React from 'react';

interface TypingIndicatorProps {
  name?: string;
  isAgent?: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ name, isAgent = false }) => {
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground animate-pulse">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>
        {name 
          ? `${name} está escribiendo...` 
          : isAgent 
            ? 'El agente está escribiendo...' 
            : 'El usuario está escribiendo...'}
      </span>
    </div>
  );
};

export default TypingIndicator;

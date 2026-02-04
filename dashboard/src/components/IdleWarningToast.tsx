/**
 * IdleWarningToast Component
 * Shows a warning countdown before auto-lock
 */

import { useEffect, useState } from 'react';
import { Clock, X, MousePointerClick } from 'lucide-react';

interface IdleWarningToastProps {
  secondsLeft: number;
  onDismiss: () => void;
  visible: boolean;
}

export default function IdleWarningToast({ secondsLeft, onDismiss, visible }: IdleWarningToastProps) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (!visible && !isExiting) {
      setIsExiting(true);
      const timeout = setTimeout(() => setIsExiting(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [visible, isExiting]);

  if (!visible && !isExiting) {
    return null;
  }

  const urgency = secondsLeft <= 10 ? 'urgent' : secondsLeft <= 20 ? 'warning' : 'normal';
  
  const bgColor = {
    urgent: 'from-red-600/90 to-red-700/90',
    warning: 'from-amber-600/90 to-amber-700/90',
    normal: 'from-purple-600/90 to-purple-700/90',
  }[urgency];

  const borderColor = {
    urgent: 'border-red-500/50',
    warning: 'border-amber-500/50',
    normal: 'border-purple-500/50',
  }[urgency];

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-[9998]
        transform transition-all duration-300 ease-out
        ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      `}
    >
      <div 
        className={`
          bg-gradient-to-r ${bgColor} 
          border ${borderColor}
          rounded-2xl shadow-2xl shadow-black/30
          p-4 min-w-[320px] max-w-md
          backdrop-blur-sm
        `}
      >
        <div className="flex items-start gap-3">
          {/* Animated Clock Icon */}
          <div className={`
            p-2 rounded-xl bg-white/10
            ${urgency === 'urgent' ? 'animate-pulse' : ''}
          `}>
            <Clock className="w-5 h-5 text-white" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-white text-sm">
              Sesión por bloquearse
            </h4>
            <p className="text-white/80 text-xs mt-0.5">
              Por inactividad, tu sesión se bloqueará en
            </p>
            
            {/* Countdown */}
            <div className="mt-2 flex items-center gap-2">
              <span className={`
                text-2xl font-bold tabular-nums
                ${urgency === 'urgent' ? 'text-white animate-pulse' : 'text-white'}
              `}>
                {secondsLeft}
              </span>
              <span className="text-white/70 text-sm">segundos</span>
            </div>

            {/* Action Hint */}
            <button
              onClick={onDismiss}
              className="mt-3 flex items-center gap-1.5 text-xs text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              Haz clic para continuar activo
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={onDismiss}
            className="p-1 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
          <div 
            className={`
              h-full rounded-full transition-all duration-1000 ease-linear
              ${urgency === 'urgent' ? 'bg-white' : 'bg-white/70'}
            `}
            style={{
              width: `${Math.max(0, (secondsLeft / 30) * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

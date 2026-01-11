// Custom hook for live timer that updates every second
import { useState, useEffect, useCallback } from 'react';

interface LiveTimerResult {
  elapsed: number; // seconds
  formatted: string;
  isActive: boolean;
}

export function useLiveTimer(startTime: string | Date | null | undefined): LiveTimerResult {
  const [elapsed, setElapsed] = useState(0);
  
  const calculateElapsed = useCallback(() => {
    if (!startTime) return 0;
    const start = new Date(startTime).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((now - start) / 1000));
  }, [startTime]);

  useEffect(() => {
    if (!startTime) {
      setElapsed(0);
      return;
    }

    // Initial calculation
    setElapsed(calculateElapsed());

    // Update every second
    const interval = setInterval(() => {
      setElapsed(calculateElapsed());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, calculateElapsed]);

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  };

  return {
    elapsed,
    formatted: formatDuration(elapsed),
    isActive: !!startTime,
  };
}

// Hook for countdown timer
export function useCountdownTimer(targetTime: string | Date | null | undefined): {
  remaining: number;
  formatted: string;
  isExpired: boolean;
  isActive: boolean;
} {
  const [remaining, setRemaining] = useState(0);

  const calculateRemaining = useCallback(() => {
    if (!targetTime) return 0;
    const target = new Date(targetTime).getTime();
    const now = Date.now();
    return Math.max(0, Math.floor((target - now) / 1000));
  }, [targetTime]);

  useEffect(() => {
    if (!targetTime) {
      setRemaining(0);
      return;
    }

    setRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const r = calculateRemaining();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime, calculateRemaining]);

  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts: string[] = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  };

  return {
    remaining,
    formatted: formatDuration(remaining),
    isExpired: remaining === 0 && !!targetTime,
    isActive: !!targetTime && remaining > 0,
  };
}

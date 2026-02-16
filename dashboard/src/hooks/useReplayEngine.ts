/**
 * useReplayEngine — Chat Playback / Replay engine
 * Controls play, pause, speed, seeking over a timeline of messages & events.
 * Uses real timestamps to compute delays between items.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// ============= TYPES =============

export interface ReplayTimelineItem {
  id: string;
  kind: 'message' | 'event';
  timestamp: string;
  // Message fields
  sender?: 'user' | 'bot' | 'agent' | 'system';
  senderAgent?: { name: string; avatar?: string };
  content?: string;
  messageType?: string;
  mediaUrl?: string;
  fileName?: string;
  replyToMessage?: { _id: string; sender: string; content: string; senderAgent?: { name: string } };
  isEdited?: boolean;
  isPinned?: boolean;
  // Event fields
  eventAction?: string;
  eventDescription?: string;
  eventActor?: { type: string; name?: string };
  eventColor?: string;
  eventIcon?: string;
  eventMetadata?: Record<string, unknown>;
}

export interface ReplayMetrics {
  totalDuration: number;
  totalMessages: number;
  userMessages: number;
  agentMessages: number;
  botMessages: number;
  systemEvents: number;
  avgAgentResponseTime: number;
  maxSilenceGap: number;
  firstResponseTime: number;
  transfers: number;
}

export interface ReplaySessionInfo {
  sessionId: string;
  channel: string;
  status: string;
  createdAt: string;
  closedAt?: string;
  closedByType?: string;
  closeReason?: string;
  closureReason?: string;
  assignedAgent?: { name: string; avatar?: string } | null;
  closedBy?: { name: string } | null;
  user?: { firstName: string; lastName?: string; username?: string } | null;
  tags: string[];
  category?: string;
  priority?: string;
  rating?: number;
  satisfaction?: string;
  firstResponseAt?: string;
  disposition?: Record<string, unknown>;
}

export interface ReplayData {
  session: ReplaySessionInfo;
  timeline: ReplayTimelineItem[];
  metrics: ReplayMetrics;
  totalItems: number;
}

export type PlaybackSpeed = 1 | 2 | 5 | 10;
export type PlaybackState = 'idle' | 'playing' | 'paused' | 'finished';

/** Gap threshold: silences larger than this (ms) are shown as "silence" blocks */
const SILENCE_THRESHOLD_MS = 30_000; // 30 seconds

/** Max delay between items during replay (ms). Real gaps are scaled but capped. */
const MAX_REPLAY_DELAY_MS = 4000;

/** Minimum delay between items in replay (ms) so it doesn't feel instant */
const MIN_REPLAY_DELAY_MS = 300;

// ============= HOOK =============

export function useReplayEngine() {
  // Data
  const [data, setData] = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Playback state
  const [state, setState] = useState<PlaybackState>('idle');
  const [speed, setSpeed] = useState<PlaybackSpeed>(1);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [visibleItems, setVisibleItems] = useState<ReplayTimelineItem[]>([]);

  // Internal refs
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  const speedRef = useRef(speed);
  const indexRef = useRef(currentIndex);
  const dataRef = useRef(data);

  // Keep refs in sync
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { dataRef.current = data; }, [data]);

  // Computed silence gaps between consecutive items (for timeline visualization)
  const gaps = useMemo(() => {
    if (!data) return [];
    const result: { index: number; durationMs: number }[] = [];
    for (let i = 1; i < data.timeline.length; i++) {
      const prev = new Date(data.timeline[i - 1].timestamp).getTime();
      const curr = new Date(data.timeline[i].timestamp).getTime();
      const diff = curr - prev;
      if (diff >= SILENCE_THRESHOLD_MS) {
        result.push({ index: i, durationMs: diff });
      }
    }
    return result;
  }, [data]);

  // Progress percentage (0-100) for slider
  const progress = useMemo(() => {
    if (!data || data.timeline.length === 0) return 0;
    return Math.max(0, ((currentIndex + 1) / data.timeline.length) * 100);
  }, [data, currentIndex]);

  // Elapsed replay time: time from first item to current item
  const elapsedTime = useMemo(() => {
    if (!data || currentIndex < 0) return 0;
    const first = new Date(data.timeline[0].timestamp).getTime();
    const curr = new Date(data.timeline[Math.min(currentIndex, data.timeline.length - 1)].timestamp).getTime();
    return curr - first;
  }, [data, currentIndex]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  /**
   * Calculate the delay before showing the NEXT item.
   * Uses real timestamps, scaled by speed, capped for UX.
   */
  const getDelay = useCallback((fromIdx: number): number => {
    const d = dataRef.current;
    if (!d || fromIdx >= d.timeline.length - 1) return 0;
    const curr = new Date(d.timeline[fromIdx].timestamp).getTime();
    const next = new Date(d.timeline[fromIdx + 1].timestamp).getTime();
    const realGap = next - curr;

    // Scale real gap — use log compression for large gaps
    let delay: number;
    if (realGap <= 5000) {
      // Short gaps: keep proportional feel
      delay = Math.max(MIN_REPLAY_DELAY_MS, realGap / 3);
    } else if (realGap <= 60_000) {
      // Medium gaps (5s–1m): compress
      delay = 800 + Math.log2(realGap / 5000) * 400;
    } else {
      // Large gaps (1m+): show silence block, then short delay
      delay = MAX_REPLAY_DELAY_MS;
    }

    return delay / speedRef.current;
  }, []);

  /**
   * Step to the next item in the timeline.
   * Recursively schedules itself when playing.
   */
  const stepForward = useCallback(() => {
    const d = dataRef.current;
    if (!d) return;

    const nextIdx = indexRef.current + 1;
    if (nextIdx >= d.timeline.length) {
      setState('finished');
      setCurrentIndex(d.timeline.length - 1);
      setVisibleItems([...d.timeline]);
      return;
    }

    setCurrentIndex(nextIdx);
    setVisibleItems(d.timeline.slice(0, nextIdx + 1));

    // Schedule next step if playing
    if (stateRef.current === 'playing') {
      const delay = getDelay(nextIdx);
      timerRef.current = setTimeout(stepForward, delay);
    }
  }, [getDelay]);

  // ============= PUBLIC ACTIONS =============

  const play = useCallback(() => {
    if (!dataRef.current || dataRef.current.timeline.length === 0) return;

    if (stateRef.current === 'finished') {
      // Restart from beginning
      setCurrentIndex(-1);
      setVisibleItems([]);
      setState('playing');
      timerRef.current = setTimeout(stepForward, MIN_REPLAY_DELAY_MS);
      return;
    }

    setState('playing');
    const delay = indexRef.current < 0 ? MIN_REPLAY_DELAY_MS : getDelay(indexRef.current);
    timerRef.current = setTimeout(stepForward, delay);
  }, [stepForward, getDelay]);

  const pause = useCallback(() => {
    setState('paused');
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const restart = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentIndex(-1);
    setVisibleItems([]);
    setState('idle');
  }, []);

  const seekTo = useCallback((index: number) => {
    const d = dataRef.current;
    if (!d) return;
    const clamped = Math.max(0, Math.min(index, d.timeline.length - 1));
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentIndex(clamped);
    setVisibleItems(d.timeline.slice(0, clamped + 1));

    if (clamped >= d.timeline.length - 1) {
      setState('finished');
    } else if (stateRef.current === 'playing') {
      // Continue playing from new position
      const delay = getDelay(clamped);
      timerRef.current = setTimeout(stepForward, delay);
    }
  }, [stepForward, getDelay]);

  const seekToPercent = useCallback((percent: number) => {
    const d = dataRef.current;
    if (!d) return;
    const idx = Math.round((percent / 100) * (d.timeline.length - 1));
    seekTo(idx);
  }, [seekTo]);

  const changeSpeed = useCallback((newSpeed: PlaybackSpeed) => {
    setSpeed(newSpeed);
  }, []);

  const loadReplay = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    setCurrentIndex(-1);
    setVisibleItems([]);
    setState('idle');

    try {
      const { api } = await import('../services/api');
      const res = await api.get<{ ok: boolean; data: ReplayData, error?: string }>(`/api/replay/${sessionId}`);
      if (res.ok && res.data?.data) {
        setData(res.data.data);
      } else  {
        setError(res.data?.error || 'Failed to load replay');
      }
    } catch (e) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setData(null);
    setCurrentIndex(-1);
    setVisibleItems([]);
    setState('idle');
    setSpeed(1);
    setError(null);
  }, []);

  return {
    // Data
    data,
    loading,
    error,

    // Playback
    state,
    speed,
    currentIndex,
    visibleItems,
    progress,
    elapsedTime,
    gaps,

    // Actions
    loadReplay,
    play,
    pause,
    restart,
    seekTo,
    seekToPercent,
    changeSpeed,
    cleanup,
  };
}

// ============= FORMAT HELPERS (exported for use in components) =============

export function formatDuration(ms: number): string {
  if (ms < 1000) return '< 1s';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatDurationShort(ms: number): string {
  if (ms < 1000) return '0s';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const SILENCE_THRESHOLD = SILENCE_THRESHOLD_MS;

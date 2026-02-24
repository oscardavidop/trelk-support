/**
 * AgentStatusBar - Premium Zinc Refactor
 * High-fidelity compact status selector for the Dashboard header/sidebar
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePresenceStore, formatLiveTime } from '../stores/presenceStore';
import type { AuxiliaryState } from '../services/presence.service';
import { ChevronDown, Loader2, Check, X, AlertCircle } from 'lucide-react';

interface AgentStatusBarProps {
  compact?: boolean; // Compact mode for sidebar
}

export const AgentStatusBar: React.FC<AgentStatusBarProps> = ({ compact = false }) => {
  const {
    currentState,
    availableStates,
    isChangingState,
    secondsInState,
    setMyState,
  } = usePresenceStore();

  const [isOpen, setIsOpen] = useState(false);
  const [pendingState, setPendingState] = useState<AuxiliaryState | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setPendingState(null);
        setReason('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectState = useCallback((state: AuxiliaryState) => {
    if (state.code === currentState?.code) {
      setIsOpen(false);
      return;
    }
    if (state.requiresReason) {
      setPendingState(state);
      return;
    }
    confirmChange(state.code);
  }, [currentState]);

  const confirmChange = useCallback(async (stateCode: string, selectedReason?: string) => {
    setError(null);
    const result = await setMyState(stateCode, selectedReason);
    if (!result.ok) {
      setError(result.error || 'Error al cambiar estado');
    } else {
      setIsOpen(false);
      setPendingState(null);
      setReason('');
    }
  }, [setMyState]);

  // Only show states that agents can manually set
  const manualStates = availableStates.filter(s => s.allowAgentManualSet && s.isActive !== false);

  const dotColor = currentState?.color || '#52525b'; // default zinc-600
  const liveTime = formatLiveTime(secondsInState);

  return (
    <div ref={dropdownRef} className="relative select-none">

      {/* === TRIGGER BUTTON === */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        disabled={isChangingState}
        className={`
          group relative flex items-center gap-2.5 rounded-xl border transition-all duration-300 outline-none
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isOpen ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50'}
          ${compact ? 'px-2.5 py-1.5' : 'px-3.5 py-2'}
        `}
      >
        {/* Ambient Glow (Visible on non-compact) */}
        {!compact && (
          <div
            className="absolute inset-0 rounded-xl opacity-20 blur-md pointer-events-none transition-opacity group-hover:opacity-30"
          // style={{ backgroundColor: dotColor }} 
          />
        )}

        {/* Status Dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-40"
            style={{ backgroundColor: dotColor }}
          />
          <span
            className="relative inline-flex rounded-full h-2.5 w-2.5 shadow-inner"
            style={{ backgroundColor: dotColor }}
          />
        </span>

        {/* Labels */}
        {!compact && (
          <div className="flex flex-col items-start min-w-[80px]">
            <span className="text-xs font-bold text-zinc-100 tracking-tight leading-none mb-0.5 flex items-center gap-1.5">
              {currentState?.label ?? 'Desconectado'}
            </span>
            <span className="text-[10px] font-mono text-zinc-500 leading-none">
              {liveTime}
            </span>
          </div>
        )}

        {compact && (
          <span className="text-[10px] font-mono font-medium text-zinc-400">{liveTime}</span>
        )}

        {/* Chevron / Loader */}
        <div className="ml-1 flex items-center justify-center shrink-0">
          {isChangingState ? (
            <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
          ) : (
            <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </div>
      </button>

      {/* === STATE DROPDOWN === HACIA ARRIBA */}
      {isOpen && !pendingState && (
        <div className="absolute z-50 right-0 bottom-full mb-2 w-56 rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl shadow-black ring-1 ring-white/5 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 overflow-hidden ">
          <div className="px-3 py-2 border-b border-zinc-800/50 bg-zinc-900/30">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Cambiar Estado</span>
          </div>

          <div className="p-1.5 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
            {manualStates.map(state => {
              const isActive = state.code === currentState?.code;
              return (
                <button
                  key={state.code}
                  onClick={() => handleSelectState(state)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left
                    ${isActive
                      ? 'bg-zinc-800/50 text-white shadow-sm ring-1 ring-zinc-700/50'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }
                  `}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 shadow-inner"
                    style={{ backgroundColor: state.color }}
                  />
                  <span className="truncate">{state.label}</span>
                  {isActive && <Check className="w-3.5 h-3.5 ml-auto text-zinc-500" />}
                </button>
              );
            })}
          </div>

          {error && (
            <div className="px-3 py-2.5 border-t border-zinc-800/50 bg-red-500/10 text-[10px] text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}
        </div>
      )}

      {/* === BREAK REASON PICKER === */}
      {isOpen && pendingState && (
        <div className="absolute z-50 right-0 bottom-full mb-2 w-64 rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl shadow-2xl shadow-black ring-1 ring-white/5 animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-200 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/30">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pendingState.color }} />
              <span className="text-sm font-bold text-zinc-100">{pendingState.label}</span>
            </div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Selecciona el motivo</p>
          </div>

          {/* Reason List */}
          <div className="p-1.5 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
            {pendingState.allowedReasons.map(r => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left
                  ${reason === r
                    ? 'bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/30'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                  }
                `}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${reason === r ? 'bg-indigo-500 border-indigo-500' : 'border-zinc-700'}`}>
                  {reason === r && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className="truncate">{r}</span>
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-2 border-t border-zinc-800/50 bg-red-500/10 text-[10px] text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}

          {/* Action Footer */}
          <div className="px-3 py-3 border-t border-zinc-800/50 bg-zinc-900/20 flex gap-2">
            <button
              onClick={() => { setPendingState(null); setReason(''); setError(null); }}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => reason && confirmChange(pendingState.code, reason)}
              disabled={!reason || isChangingState}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
            >
              {isChangingState ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Confirmar'}
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default AgentStatusBar;
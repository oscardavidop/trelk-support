/**
 * System Overlays - Premium Zinc Refactor
 * High-fidelity blocking screens for concurrency and session management.
 */

import { useState, useEffect } from 'react';
import { MonitorX, LogOut, MapPin, AlertCircle, Monitor } from 'lucide-react';

// ============= TAB BLOCKED OVERLAY =============

interface TabBlockedOverlayProps {
  isBlocked: boolean;
  onClose?: () => void;
}

export function TabBlockedOverlay({ isBlocked, onClose }: TabBlockedOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isBlocked) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isBlocked]);

  const handleClose = () => {
    window.close();
    // Fallback if window.close() is blocked by browser
    setTimeout(() => { window.location.href = '/dashboard'; }, 100);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-zinc-950/90 backdrop-blur-xl`}
    >
      <div className={`max-w-md w-full mx-4 flex flex-col items-center text-center transition-all duration-300 ${isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`}>
        
        {/* Animated Icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full animate-pulse" />
          <div className="relative w-24 h-24 rounded-full bg-zinc-900 border border-zinc-800 shadow-2xl flex items-center justify-center ring-1 ring-amber-500/20">
            <MonitorX className="w-10 h-10 text-amber-500" />
          </div>
        </div>

        {/* Content */}
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight mb-3">Chat abierto en otra pestaña</h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-8 max-w-sm">
          Para evitar conflictos y pérdida de mensajes, el sistema de soporte solo puede estar activo en una pestaña a la vez.
        </p>

        {/* Visual Separator */}
        <div className="w-full flex items-center justify-center gap-4 mb-8 opacity-50">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-zinc-700" />
          <AlertCircle className="w-5 h-5 text-zinc-600" />
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-zinc-700" />
        </div>

        <p className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-4">Vuelve a la pestaña activa o cierra esta</p>

        {/* Actions */}
        <button
          onClick={handleClose}
          className="w-full sm:w-auto px-8 py-3.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          Cerrar esta pestaña
        </button>

        {onClose && (
          <button 
            onClick={onClose} 
            className="mt-6 text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium border-b border-transparent hover:border-zinc-500 pb-0.5"
          >
            Volver al Dashboard
          </button>
        )}
      </div>
    </div>
  );
}

// ============= SESSION REPLACED OVERLAY =============

interface SessionReplacedOverlayProps {
  isShown: boolean;
  device?: string;
  ip?: string;
}

export function SessionReplacedOverlay({ isShown, device, ip }: SessionReplacedOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isShown) {
      setIsVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isShown]);

  const handleLogin = () => {
    window.location.href = '/login';
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'} bg-zinc-950/95 backdrop-blur-2xl`}
    >
      <div className={`max-w-md w-full mx-4 flex flex-col items-center text-center transition-all duration-300 ${isAnimating ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`}>
        
        {/* Animated Icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full animate-pulse" />
          <div className="relative w-24 h-24 rounded-full bg-zinc-900 border border-zinc-800 shadow-2xl flex items-center justify-center ring-1 ring-red-500/20">
            <LogOut className="w-10 h-10 text-red-500 translate-x-1" />
          </div>
        </div>

        {/* Content */}
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight mb-3">Sesión Finalizada</h2>
        <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-sm">
          Se ha iniciado sesión en otro dispositivo. Por motivos de seguridad, solo puedes tener una sesión activa a la vez.
        </p>

        {/* Device Info Panel */}
        {(device || ip) && (
          <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 mb-8 text-left shadow-inner">
            <p className="text-[10px] font-bold text-zinc-500 uppercase  mb-3">Detalles del nuevo inicio de sesión</p>
            <div className="space-y-2">
              {device && (
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <div className="p-1.5 bg-zinc-800 rounded-md text-zinc-400"><Monitor className="w-4 h-4" /></div>
                  <span className="font-medium truncate">{device}</span>
                </div>
              )}
              {ip && (
                <div className="flex items-center gap-3 text-sm text-zinc-300">
                  <div className="p-1.5 bg-zinc-800 rounded-md text-zinc-400"><MapPin className="w-4 h-4" /></div>
                  <span className="font-mono text-xs">{ip}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action */}
        <button
          onClick={handleLogin}
          className="w-full sm:w-auto px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          Iniciar sesión nuevamente
        </button>

        {/* Warning */}
        <p className="text-[11px] text-zinc-500 mt-6 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-zinc-600" />
          ¿No fuiste tú? Contacta a tu administrador.
        </p>
      </div>
    </div>
  );
}
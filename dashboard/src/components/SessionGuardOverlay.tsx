/**
 * TabBlockedOverlay Component
 * 
 * Full-screen overlay shown when another tab has the chat open
 * Inspired by WhatsApp Web's multi-device behavior
 */
import { useState, useEffect } from 'react';

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
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 100);
  };

  if (!isVisible) return null;

  const overlayClass = `fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`;
  const contentClass = `max-w-md mx-4 text-center transition-all duration-300 ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`;

  return (
    <div
      className={overlayClass}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div className={contentClass}>
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-800/80 border-2 border-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">Chat abierto en otra pestaña</h2>
        <p className="text-gray-300 mb-8 leading-relaxed">
          Para evitar conflictos y pérdida de mensajes, el chat solo puede estar activo en una pestaña a la vez.
        </p>

        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex-1 h-px bg-gray-700" />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        <p className="text-gray-400 text-sm mb-6">👉 Vuelve a la pestaña activa o cierra esta.</p>

        <button
          onClick={handleClose}
          className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-semibold rounded-lg shadow-lg shadow-red-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          Cerrar esta pestaña
        </button>

        {onClose && (
          <button onClick={onClose} className="block mx-auto mt-4 text-sm text-gray-500 hover:text-gray-400 transition-colors">
            Ir al Dashboard
          </button>
        )}
      </div>
    </div>
  );
}

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

  const overlayClass = `fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300 ${isAnimating ? 'opacity-100' : 'opacity-0'}`;
  const contentClass = `max-w-md mx-4 text-center transition-all duration-300 ${isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`;

  return (
    <div
      className={overlayClass}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className={contentClass}>
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-900/50 border-2 border-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white mb-3">Sesión cerrada</h2>
        <p className="text-gray-300 mb-4 leading-relaxed">
          Se ha iniciado sesión en otro dispositivo. Solo puedes tener una sesión activa a la vez.
        </p>

        {(device || ip) && (
          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
            <p className="text-gray-400 text-sm font-medium mb-2">Nuevo inicio de sesión:</p>
            {device && (
              <div className="flex items-center gap-2 text-gray-300 text-sm mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>{device}</span>
              </div>
            )}
            {ip && (
              <div className="flex items-center gap-2 text-gray-300 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span>IP: {ip}</span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleLogin}
          className="px-8 py-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
        >
          Iniciar sesión de nuevo
        </button>

        <p className="text-gray-500 text-xs mt-6">¿No fuiste tú? Cambia tu contraseña inmediatamente.</p>
      </div>
    </div>
  );
}

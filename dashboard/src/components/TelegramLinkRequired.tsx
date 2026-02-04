/**
 * TelegramLinkRequired - Premium Zinc Refactor
 * Full-page blocking screen for mandatory Telegram account linking
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldCheck, 
  MessageCircle, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  RefreshCw, 
  Lock, 
  ExternalLink 
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

// --- Types ---

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface LinkState {
  step: 'initial' | 'loading' | 'widget' | 'verifying' | 'success' | 'error';
  error?: string;
  linkToken?: string;
  botId?: string;
  botUsername?: string;
}

interface TelegramLinkRequiredProps {
  onLinkComplete?: () => void;
  reason?: 'mfa' | 'policy' | 'admin';
}

const API_URL = '/api'; // Ajusta según tu configuración

export function TelegramLinkRequired({ onLinkComplete, reason = 'policy' }: TelegramLinkRequiredProps) {
  const { updateAgentFields } = useAuthStore();
  const [state, setState] = useState<LinkState>({ step: 'initial' });

  // --- Configuration ---

  const reasonTexts = {
    mfa: {
      title: 'Seguridad Adicional Requerida',
      description: 'Para habilitar la autenticación de dos factores (2FA), necesitamos vincular tu cuenta de Telegram.',
      icon: ShieldCheck,
    },
    policy: {
      title: 'Vinculación de Telegram Requerida',
      description: 'Tu organización requiere que todos los agentes vinculen su cuenta de Telegram para recibir notificaciones críticas.',
      icon: Lock,
    },
    admin: {
      title: 'Solicitud Administrativa',
      description: 'Un administrador ha solicitado la vinculación de tu cuenta para continuar.',
      icon: AlertCircle,
    },
  };

  const currentReason = reasonTexts[reason] || reasonTexts.policy;
  const ReasonIcon = currentReason.icon;

  // --- Logic ---

  const startLinking = useCallback(async () => {
    setState({ step: 'loading' });
    try {
      const response = await fetch(`${API_URL}/telegram/link/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({reason})
      });
      
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Error al iniciar vinculación');
      }
      
      setState({
        step: 'widget',
        linkToken: data.linkToken,
        botId: data.botId,
        botUsername: data.botUsername,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Error de conexión.';
      setState({ step: 'error', error });
    }
  }, [reason]);

  const handleTelegramAuth = useCallback(async (authData: TelegramAuthData) => {
    if (!state.linkToken) return;
    
    setState(prev => ({ ...prev, step: 'verifying' }));
    
    try {
      const response = await fetch(`${API_URL}/telegram/link/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          linkToken: state.linkToken,
          authData,
        }),
      });
      
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Error de verificación');
      }
      
      updateAgentFields({ telegramId: data.telegramId });
      setState({ step: 'success' });
      
      setTimeout(() => {
        onLinkComplete?.();
      }, 2000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setState({ step: 'error', error: err.message });
    }
  }, [state.linkToken, updateAgentFields, onLinkComplete]);

  // --- Widget Script Injection ---

  useEffect(() => {
    if (state.step !== 'widget' || !state.botUsername) return;

    // 1. Define global callback
    (window as unknown as { onTelegramAuth?: (user: TelegramAuthData) => void }).onTelegramAuth = handleTelegramAuth;

    // 2. Inject script
    const scriptId = 'telegram-widget-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', 'TrelkSupportBot');
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '12'); // Rounded corners matching our UI
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-userpic', 'true'); // Cleaner look without userpic sometimes
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.async = true;
      
      const container = document.getElementById('telegram-widget-container');
      if (container) {
        container.innerHTML = ''; // Clear previous
        container.appendChild(script);
      }
    }

    return () => {
      // Cleanup
      delete (window as unknown as { onTelegramAuth?: (user: TelegramAuthData) => void }).onTelegramAuth;
    };
  }, [state.step, state.botUsername, handleTelegramAuth]);

  // --- Render ---

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Main Card */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Header */}
          <div className="p-8 pb-6 text-center border-b border-zinc-800/50">
            <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-4 border border-blue-500/20 shadow-[0_0_30px_-10px_rgba(59,130,246,0.3)]">
                <ReasonIcon className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">{currentReason.title}</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {currentReason.description}
            </p>
          </div>

          {/* Content Area */}
          <div className="p-8 pt-6 space-y-6">

            {/* Initial & Loading States */}
            {(state.step === 'initial' || state.step === 'loading') && (
              <>
                {/* Benefits List */}
                <div className="space-y-3 bg-zinc-950/50 p-4 rounded-xl border border-zinc-800">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-zinc-300">Recepción instantánea de códigos OTP</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-zinc-300">Alertas de seguridad de inicio de sesión</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-zinc-300">Soporte directo desde tu chat</span>
                  </div>
                </div>

                <button
                  onClick={startLinking}
                  disabled={state.step === 'loading'}
                  className="w-full py-3 px-4 bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold rounded-xl shadow-lg shadow-blue-500/10 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {state.step === 'loading' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <MessageCircle className="w-5 h-5 fill-current" />
                  )}
                  {state.step === 'loading' ? 'Conectando...' : 'Conectar con Telegram'}
                </button>
              </>
            )}

            {/* Widget State */}
            {state.step === 'widget' && (
              <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-2">
                <div className="text-center mb-6">
                  <p className="text-sm font-medium text-white mb-1 text-teal-400 text-[17px]">Autorizar Vinculación</p>
                  <p className="text-xs text-zinc-500">Pulsa el botón de abajo para autorizar</p>
                </div>
                
                {/* Telegram Widget Container */}
                <div 
                  id="telegram-widget-container" 
                  className="min-h-[50px] flex items-center justify-center"
                />

                <div className="mt-6 flex items-center gap-2 text-[11px] text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-800">
                  <ExternalLink className="w-3 h-3" />
                  Se abrirá una ventana de Telegram
                </div>
              </div>
            )}

            {/* Verifying State */}
            {state.step === 'verifying' && (
              <div className="text-center py-4 space-y-4 animate-in zoom-in-95">
                <div className="relative mx-auto w-12 h-12">
                  <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">Verificando cuenta...</h3>
                  <p className="text-xs text-zinc-500 mt-1">Estamos confirmando tus datos</p>
                </div>
              </div>
            )}

            {/* Success State */}
            {state.step === 'success' && (
              <div className="text-center py-2 space-y-4 animate-in zoom-in-95">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-full ring-1 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">¡Vinculación Exitosa!</h3>
                  <p className="text-sm text-zinc-400 mt-1">Tu cuenta está ahora protegida.</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {state.step === 'error' && (
              <div className="space-y-4 animate-in shake">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-red-400">Error de Vinculación</h4>
                    <p className="text-xs text-red-300/80 mt-1 leading-relaxed">
                      {state.error}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setState({ step: 'initial' })}
                  className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Intentar de nuevo
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
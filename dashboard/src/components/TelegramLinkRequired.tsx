/**
 * TelegramLinkRequired - Premium Zinc Refactor
 * High-fidelity full-page blocking screen for mandatory Telegram account linking.
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
  ExternalLink,
  ShieldAlert
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
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/20'
    },
    policy: {
      title: 'Vinculación Requerida',
      description: 'Tu organización requiere que todos los agentes vinculen su cuenta de Telegram para recibir alertas críticas.',
      icon: Lock,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20'
    },
    admin: {
      title: 'Solicitud Administrativa',
      description: 'Un administrador ha requerido la vinculación obligatoria de tu cuenta para continuar operando.',
      icon: ShieldAlert,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20'
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
      script.setAttribute('data-radius', '12'); 
      script.setAttribute('data-request-access', 'write');
      script.setAttribute('data-userpic', 'true'); 
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.async = true;
      
      const container = document.getElementById('telegram-widget-container');
      if (container) {
        container.innerHTML = ''; // Clear previous
        container.appendChild(script);
      }
    }

    return () => {
      delete (window as unknown as { onTelegramAuth?: (user: TelegramAuthData) => void }).onTelegramAuth;
    };
  }, [state.step, state.botUsername, handleTelegramAuth]);

  // --- Render ---

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Decor (Premium Glows) */}
      <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Main Card */}
        <div className="bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800/80 rounded-[2rem] overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/5">
          
          {/* Header */}
          <div className="p-8 pb-6 text-center border-b border-zinc-800/50 relative overflow-hidden">
            <div className={`mx-auto w-16 h-16 ${currentReason.bg} ${currentReason.border} rounded-2xl flex items-center justify-center mb-5 border shadow-inner ring-1 ring-white/5`}>
                <ReasonIcon className={`w-8 h-8 ${currentReason.color}`} />
            </div>
            <h2 className="text-xl font-bold text-zinc-50 tracking-tight mb-2">{currentReason.title}</h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-[280px] mx-auto">
              {currentReason.description}
            </p>
          </div>

          {/* Content Area */}
          <div className="p-8">

            {/* Initial & Loading States */}
            {(state.step === 'initial' || state.step === 'loading') && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                {/* Benefits List */}
                <div className="space-y-4 bg-zinc-950/50 p-5 rounded-2xl border border-zinc-800/80 shadow-inner">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <span className="text-sm font-medium text-zinc-300">Recepción segura de códigos OTP</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <span className="text-sm font-medium text-zinc-300">Alertas de inicio de sesión</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <span className="text-sm font-medium text-zinc-300">Notificaciones críticas del sistema</span>
                  </div>
                </div>

                <button
                  onClick={startLinking}
                  disabled={state.step === 'loading'}
                  className="w-full py-3.5 px-4 bg-[#0088cc] hover:bg-[#0077b5] text-white font-bold rounded-xl shadow-lg shadow-[#0088cc]/20 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {state.step === 'loading' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <MessageCircle className="w-5 h-5 fill-current" />
                  )}
                  {state.step === 'loading' ? 'Iniciando conexión...' : 'Conectar con Telegram'}
                </button>
              </div>
            )}

            {/* Widget State */}
            {state.step === 'widget' && (
              <div className="flex flex-col items-center animate-in fade-in slide-in-from-right-4">
                <div className="text-center mb-8">
                  <p className="text-base font-bold text-zinc-50 mb-1">Autorizar Vinculación</p>
                  <p className="text-sm text-zinc-400">Haz clic en el botón oficial para continuar</p>
                </div>
                
                {/* Telegram Widget Container */}
                <div 
                  id="telegram-widget-container" 
                  className="min-h-[80px] w-full flex items-center justify-center bg-zinc-950/50 border border-zinc-800/80 rounded-2xl p-4 shadow-inner"
                />

                <div className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-zinc-500 bg-zinc-950 px-4 py-2 rounded-full border border-zinc-800">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Se abrirá una ventana segura
                </div>
              </div>
            )}

            {/* Verifying State */}
            {state.step === 'verifying' && (
              <div className="text-center py-6 space-y-6 animate-in zoom-in-95 fade-in">
                <div className="relative mx-auto w-16 h-16">
                  <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse" />
                  <div className="absolute inset-0 border-4 border-zinc-800 rounded-full" />
                  <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-50 tracking-tight">Verificando conexión...</h3>
                  <p className="text-sm text-zinc-400 mt-1">Asegurando tu identidad</p>
                </div>
              </div>
            )}

            {/* Success State */}
            {state.step === 'success' && (
              <div className="text-center py-4 space-y-6 animate-in zoom-in-95 fade-in">
                <div className="relative mx-auto w-20 h-20">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                  <div className="relative inline-flex items-center justify-center w-full h-full bg-emerald-500/10 rounded-full ring-1 ring-emerald-500/30 shadow-inner">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-zinc-50 tracking-tight">¡Vinculación Exitosa!</h3>
                  <p className="text-sm text-zinc-400 mt-2">Tu cuenta ha sido verificada y protegida correctamente.</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {state.step === 'error' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-red-400">Error de Conexión</h4>
                    <p className="text-xs text-red-400/80 mt-1 leading-relaxed">
                      {state.error}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setState({ step: 'initial' })}
                  className="w-full py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <RefreshCw className="w-4 h-4" />
                  Intentar Nuevamente
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
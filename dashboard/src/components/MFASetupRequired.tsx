/**
 * MFASetupRequired - Premium Zinc Refactor
 * High-fidelity blocking screen for mandatory MFA configuration.
 */

import { useState, useCallback } from 'react';
import {
  Shield,
  Smartphone,
  MessageCircle,
  Lock,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { TelegramMFAModal, TOTPMFAModal } from './MFAModals';

interface MFASetupRequiredProps {
  onSetupComplete?: () => void;
}

type SelectedMethod = 'telegram' | 'totp' | null;

export function MFASetupRequired({ onSetupComplete }: MFASetupRequiredProps) {
  const { agent, checkAuth } = useAuthStore();
  const [selectedMethod, setSelectedMethod] = useState<SelectedMethod>(null);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showTOTPModal, setShowTOTPModal] = useState(false);

  // Check if user has telegram linked
  const hasTelegram = !!agent?.telegramId;

  const handleMethodSelect = (method: SelectedMethod) => {
    setSelectedMethod(method);
    
    if (method === 'telegram') {
      if (!hasTelegram) return;
      setShowTelegramModal(true);
    } else if (method === 'totp') {
      setShowTOTPModal(true);
    }
  };

  const handleSuccess = useCallback(() => {
    checkAuth();
    onSetupComplete?.();
  }, [checkAuth, onSetupComplete]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      
      {/* Premium Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
        
        {/* Brand Logo */}
        <img src="assets/img/logo-dark.png" alt="Trelk Support" className="h-8 mb-8 opacity-90" />
        
        {/* Main Card */}
        <div className="w-full bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800/80 rounded-[2rem] shadow-2xl shadow-black/80 ring-1 ring-white/5 overflow-hidden">
          
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center border-b border-zinc-800/50">
            <div className="relative mx-auto w-16 h-16 mb-5">
              <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse" />
              <div className="relative w-full h-full bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-xl ring-1 ring-purple-500/20">
                <ShieldCheck className="w-8 h-8 text-purple-400" />
              </div>
            </div>
            <h1 className="text-xl font-bold text-zinc-50 tracking-tight mb-2">Protege tu Cuenta</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Tu organización exige autenticación de dos factores (2FA). Configura un método para acceder al sistema.
            </p>
          </div>

          {/* Method Selection */}
          <div className="p-6 space-y-3">
            
            {/* Telegram Option */}
            <button
              onClick={() => handleMethodSelect('telegram')}
              disabled={!hasTelegram}
              className={`
                group relative w-full p-4 rounded-2xl border transition-all duration-300 text-left overflow-hidden
                ${!hasTelegram 
                  ? 'border-zinc-800/50 bg-zinc-900/30 opacity-60 cursor-not-allowed' 
                  : 'border-zinc-800 bg-zinc-900/50 hover:border-blue-500/40 hover:bg-blue-500/5 hover:shadow-lg hover:shadow-blue-500/5 active:scale-[0.98]'
                }
              `}
            >
              <div className="flex items-center gap-4 relative z-10">
                <div className={`p-3 rounded-xl transition-colors duration-300 ${!hasTelegram ? 'bg-zinc-800' : 'bg-zinc-800 group-hover:bg-blue-500/20'}`}>
                  <MessageCircle className={`w-6 h-6 ${!hasTelegram ? 'text-zinc-500' : 'text-blue-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="text-sm font-bold text-zinc-100">Telegram MFA</h3>
                    {hasTelegram && (
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate">
                    {hasTelegram ? 'Recibe códigos por chat al instante' : 'Requiere vincular Telegram previamente'}
                  </p>
                </div>
                {hasTelegram ? (
                  <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-blue-400 transition-colors transform group-hover:translate-x-1" />
                ) : (
                  <Lock className="w-4 h-4 text-zinc-600" />
                )}
              </div>
            </button>

            {/* TOTP Option */}
            <button
              onClick={() => handleMethodSelect('totp')}
              className="group relative w-full p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 hover:border-purple-500/40 hover:bg-purple-500/5 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300 text-left overflow-hidden active:scale-[0.98]"
            >
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 rounded-xl bg-zinc-800 group-hover:bg-purple-500/20 transition-colors duration-300">
                  <Smartphone className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-zinc-100 mb-0.5">App Autenticadora</h3>
                  <p className="text-xs text-zinc-400 truncate">
                    Google Authenticator, Authy, 1Password...
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-purple-400 transition-colors transform group-hover:translate-x-1" />
              </div>
            </button>

          </div>

          {/* Security Footer Note */}
          <div className="px-6 pb-6 text-center">
            <p className="text-[10px] text-zinc-500 flex items-center justify-center gap-1.5 uppercase tracking-wider font-medium">
              <Lock className="w-3 h-3" /> Conexión encriptada y segura
            </p>
          </div>

        </div>
      </div>

      {/* Shared Setup Modals */}
      <TelegramMFAModal
        isOpen={showTelegramModal}
        onClose={() => {
          setShowTelegramModal(false);
          setSelectedMethod(null);
        }}
        onSuccess={handleSuccess}
      />
      
      <TOTPMFAModal
        isOpen={showTOTPModal}
        onClose={() => {
          setShowTOTPModal(false);
          setSelectedMethod(null);
        }}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

export default MFASetupRequired;
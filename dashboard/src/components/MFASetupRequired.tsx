/**
 * MFASetupRequired - Full-page blocking screen when MFA is required but not configured
 * Shows when policy requires MFA but user has no methods set up
 * Uses shared MFA modals for setup flow
 */

import { useState, useCallback } from 'react';
import {
  Shield,
  Smartphone,
  MessageCircle,
  Lock,
  Sparkles
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
      if (!hasTelegram) {
        // Could show a message that Telegram needs to be linked first
        return;
      }
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-8 pb-6 text-center border-b border-zinc-800/50">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 rounded-2xl mb-4">
              <Shield className="w-8 h-8 text-purple-400" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Configuración de MFA Requerida</h1>
            <p className="text-sm text-zinc-400">
              Tu organización requiere autenticación de dos factores. Configura un método para continuar.
            </p>
          </div>

          {/* Method Selection */}
          <div className="p-6 space-y-4">
            {/* Telegram Option */}
            <button
              onClick={() => handleMethodSelect('telegram')}
              disabled={!hasTelegram}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left group
                ${!hasTelegram 
                  ? 'border-zinc-800 bg-zinc-800/30 opacity-50 cursor-not-allowed' 
                  : selectedMethod === 'telegram'
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-zinc-800 bg-zinc-800/50 hover:border-blue-500/50 hover:bg-blue-500/5'
                }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl transition-colors ${
                  selectedMethod === 'telegram' ? 'bg-blue-500/20' : 'bg-zinc-700/50 group-hover:bg-blue-500/10'
                }`}>
                  <MessageCircle className={`w-6 h-6 ${
                    selectedMethod === 'telegram' ? 'text-blue-400' : 'text-zinc-400 group-hover:text-blue-400'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">Telegram</h3>
                    {hasTelegram && (
                      <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    {hasTelegram 
                      ? 'Recibe códigos instantáneos en tu Telegram'
                      : 'Vincula tu Telegram primero para usar este método'
                    }
                  </p>
                </div>
              </div>
            </button>

            {/* TOTP Option */}
            <button
              onClick={() => handleMethodSelect('totp')}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left group
                ${selectedMethod === 'totp'
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-zinc-800 bg-zinc-800/50 hover:border-purple-500/50 hover:bg-purple-500/5'
                }`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl transition-colors ${
                  selectedMethod === 'totp' ? 'bg-purple-500/20' : 'bg-zinc-700/50 group-hover:bg-purple-500/10'
                }`}>
                  <Smartphone className={`w-6 h-6 ${
                    selectedMethod === 'totp' ? 'text-purple-400' : 'text-zinc-400 group-hover:text-purple-400'
                  }`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white">App Autenticadora</h3>
                  <p className="text-sm text-zinc-400 mt-0.5">
                    Google Authenticator, Authy, etc.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Footer info */}
          <div className="px-6 pb-6">
            <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-zinc-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-zinc-400">
                    Protección adicional para tu cuenta
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    La autenticación de dos factores añade una capa extra de seguridad, 
                    requiriendo un código adicional al iniciar sesión.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Modals */}
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

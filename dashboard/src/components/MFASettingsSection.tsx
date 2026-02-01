// MFA Settings Component for MySettingsPage
import { useState, useEffect, useRef } from 'react';
import { 
  Shield, Smartphone, Trash2, Loader2, Check, X, AlertTriangle,
  RefreshCw, Clock, ChevronRight, Send, Key, ShieldCheck, ShieldOff,
  AlertCircle
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface MFAStatus {
  enabled: boolean;
  verifiedAt?: string;
  enforcedByAdmin?: boolean;
  bypassUntil?: string;
  trustedDevices?: TrustedDevice[];
}

interface TrustedDevice {
  _id: string;
  deviceName: string;
  browser: string;
  os: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}

// Get device fingerprint
const getDeviceFingerprint = async (): Promise<string> => {
  const data = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join('|');
  
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export default function MFASettingsSection() {
  const agent = useAuthStore((s) => s.agent);
  const updateAgentFields = useAuthStore((s) => s.updateAgentFields);
  
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Activation flow
  const [activationStep, setActivationStep] = useState<'idle' | 'pending' | 'verify'>('idle');
  const [loginToken, setLoginToken] = useState('');
  const [verifyCode, setVerifyCode] = useState(['', '', '', '', '', '']);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Disable flow
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');

  // Load MFA status
  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/my-status', { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setStatus(data);
      }
    } catch (err) {
      setError('Error al cargar estado de MFA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  // Countdown timer for activation
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Focus first input when entering verify step
  useEffect(() => {
    if (activationStep === 'verify') {
      inputRefs.current[0]?.focus();
    }
  }, [activationStep]);

  // Start MFA activation
  const handleStartActivation = async () => {
    setActivating(true);
    setActivationError('');
    try {
      const res = await fetch('/api/auth/mfa/activate/start', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (data.ok) {
        setLoginToken(data.loginToken);
        setTimeLeft(data.expiresIn || 120);
        setActivationStep('verify');
      } else {
        setActivationError(data.error || 'Error al iniciar activación');
      }
    } catch {
      setActivationError('Error de conexión');
    } finally {
      setActivating(false);
    }
  };

  // Verify activation code
  const handleVerifyActivation = async (codeString?: string) => {
    const fullCode = codeString || verifyCode.join('');
    if (fullCode.length !== 6) {
      setActivationError('Ingresa el código de 6 dígitos');
      return;
    }
    
    setActivating(true);
    setActivationError('');
    
    try {
      const fingerprint = await getDeviceFingerprint();
      const res = await fetch('/api/auth/mfa/activate/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          loginToken,
          code: fullCode,
          trustDevice: true,
          deviceFingerprint: fingerprint,
        }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setActivationStep('idle');
        setVerifyCode(['', '', '', '', '', '']);
        updateAgentFields({ mfaEnabled: true });
        loadStatus();
      } else {
        setActivationError(data.error || 'Código incorrecto');
        setVerifyCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setActivationError('Error de conexión');
    } finally {
      setActivating(false);
    }
  };

  // Handle code input
  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...verifyCode];
    newCode[index] = value.slice(-1);
    setVerifyCode(newCode);
    setActivationError('');
    
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    if (newCode.every(d => d) && newCode.join('').length === 6) {
      handleVerifyActivation(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verifyCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Resend activation code
  const handleResendCode = async () => {
    setActivationError('');
    try {
      const res = await fetch('/api/auth/mfa/activate/start', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (data.ok) {
        setLoginToken(data.loginToken);
        setTimeLeft(data.expiresIn || 120);
        setVerifyCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      } else {
        setActivationError(data.error || 'Error al reenviar código');
      }
    } catch {
      setActivationError('Error de conexión');
    }
  };

  // Disable MFA
  const handleDisableMFA = async () => {
    setDisabling(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: disablePassword }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setShowDisableConfirm(false);
        setDisablePassword('');
        updateAgentFields({ mfaEnabled: false });
        loadStatus();
      } else {
        setError(data.error || 'Error al desactivar MFA');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setDisabling(false);
    }
  };

  // Revoke trusted device
  const handleRevokeDevice = async (deviceId: string) => {
    try {
      await fetch(`/api/auth/mfa/devices/${deviceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      loadStatus();
    } catch {}
  };

  // Revoke all trusted devices
  const handleRevokeAllDevices = async () => {
    try {
      await fetch('/api/auth/mfa/devices', {
        method: 'DELETE',
        credentials: 'include',
      });
      loadStatus();
    } catch {}
  };

  // Cancel activation
  const handleCancelActivation = () => {
    setActivationStep('idle');
    setVerifyCode(['', '', '', '', '', '']);
    setActivationError('');
    setLoginToken('');
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl border ${status?.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
              {status?.enabled ? <ShieldCheck className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Autenticación de Dos Factores</h3>
              <p className="text-sm text-zinc-400">
                {status?.enabled 
                  ? 'Tu cuenta está protegida con MFA vía Telegram'
                  : 'Protege tu cuenta con verificación por Telegram'
                }
              </p>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
            status?.enabled 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
          }`}>
            {status?.enabled ? 'Activado' : 'Desactivado'}
          </div>
        </div>
        
        {/* Admin Enforced Notice */}
        {status?.enforcedByAdmin && (
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-300">
              MFA fue activado por un administrador y no puede ser deshabilitado.
            </p>
          </div>
        )}
        
        {/* Bypass Notice */}
        {status?.bypassUntil && new Date(status.bypassUntil) > new Date() && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <p className="text-sm text-blue-300">
              Tienes bypass temporal de MFA hasta {new Date(status.bypassUntil).toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        
        {/* Activation Flow */}
        {!status?.enabled && activationStep === 'idle' && (
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <Key className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-white mb-1">¿Cómo funciona?</h4>
                <p className="text-xs text-zinc-400">
                  Al iniciar sesión, recibirás un código de 6 dígitos en tu Telegram vinculado. 
                  Este código expira en 2 minutos y es de un solo uso.
                </p>
              </div>
            </div>
            
            {!agent?.telegramId ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-sm text-amber-300 font-medium">Telegram no vinculado</p>
                    <p className="text-xs text-amber-400/80 mt-1">
                      Debes vincular tu cuenta de Telegram antes de activar MFA.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={handleStartActivation}
                disabled={activating}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:transform-none"
              >
                {activating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Shield className="w-5 h-5" />
                )}
                <span>Activar MFA</span>
              </button>
            )}
          </div>
        )}

        {/* Verification Step */}
        {!status?.enabled && activationStep === 'verify' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-500/20 rounded-full mb-4">
                <Send className="w-7 h-7 text-indigo-400" />
              </div>
              <h4 className="text-lg font-medium text-white mb-2">Verifica tu Telegram</h4>
              <p className="text-sm text-zinc-400">
                Hemos enviado un código de 6 dígitos a tu Telegram.
              </p>
            </div>

            {/* Timer */}
            <div className="flex items-center justify-center gap-2">
              <Clock className={`w-4 h-4 ${timeLeft < 30 ? 'text-amber-400' : 'text-zinc-400'}`} />
              <span className={`text-sm font-mono ${timeLeft < 30 ? 'text-amber-400' : 'text-zinc-400'}`}>
                {timeLeft > 0 ? `Expira en ${formatTime(timeLeft)}` : 'Código expirado'}
              </span>
            </div>

            {/* Error */}
            {activationError && (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{activationError}</span>
              </div>
            )}

            {/* Code Input */}
            <div className="flex justify-center gap-2">
              {verifyCode.map((digit, index) => (
                <input
                  key={index}
                  ref={el => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleCodeChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  disabled={activating || timeLeft === 0}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all
                    ${digit ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-800/50'}
                    ${activating || timeLeft === 0 ? 'opacity-50 cursor-not-allowed' : 'focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'}
                    text-white outline-none`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCancelActivation}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleResendCode}
                disabled={timeLeft > 90}
                className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 inline mr-2" />
                Reenviar
              </button>
            </div>
          </div>
        )}

        {/* MFA Enabled - Show Trusted Devices */}
        {status?.enabled && (
          <div className="space-y-6">
            {/* MFA Info */}
            <div className="flex items-start gap-4 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-emerald-300 font-medium">MFA activo desde</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {status.verifiedAt ? new Date(status.verifiedAt).toLocaleString() : 'Fecha desconocida'}
                </p>
              </div>
            </div>

            {/* Trusted Devices */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-white">Dispositivos de Confianza</h4>
                {(status.trustedDevices?.length ?? 0) > 0 && (
                  <button
                    onClick={handleRevokeAllDevices}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Revocar todos
                  </button>
                )}
              </div>

              {(!status.trustedDevices || status.trustedDevices.length === 0) ? (
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
                  <Smartphone className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No hay dispositivos de confianza</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Los dispositivos de confianza pueden omitir MFA por 30 días
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {status.trustedDevices.map(device => (
                    <div
                      key={device._id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                        device.isCurrent 
                          ? 'bg-indigo-500/5 border-indigo-500/20' 
                          : 'bg-zinc-950 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2.5 rounded-xl border ${
                          device.isCurrent 
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                        }`}>
                          <Smartphone className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-200">
                              {device.browser} • {device.os}
                            </span>
                            {device.isCurrent && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20">
                                Este dispositivo
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Último uso: {new Date(device.lastUsedAt).toLocaleDateString()} • 
                            Expira: {new Date(device.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeDevice(device._id)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Revocar dispositivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Disable MFA Button */}
            {!status.enforcedByAdmin && (
              <div className="pt-4 border-t border-zinc-800">
                {!showDisableConfirm ? (
                  <button
                    onClick={() => setShowDisableConfirm(true)}
                    className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    <ShieldOff className="w-4 h-4" />
                    Desactivar MFA
                  </button>
                ) : (
                  <div className="space-y-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400" />
                      <p className="text-sm text-red-300 font-medium">
                        Confirma tu contraseña para desactivar MFA
                      </p>
                    </div>
                    <input
                      type="password"
                      value={disablePassword}
                      onChange={e => setDisablePassword(e.target.value)}
                      placeholder="Tu contraseña actual"
                      className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
                    />
                    {error && (
                      <p className="text-xs text-red-400">{error}</p>
                    )}
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowDisableConfirm(false);
                          setDisablePassword('');
                          setError('');
                        }}
                        className="flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleDisableMFA}
                        disabled={disabling || !disablePassword}
                        className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                      >
                        {disabling ? (
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                        ) : (
                          'Confirmar'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

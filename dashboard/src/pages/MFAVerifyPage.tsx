import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { 
  Shield, AlertCircle, Loader2, RefreshCw, 
  ArrowLeft, CheckCircle2, Clock, Smartphone,
  Send, QrCode, Key
} from 'lucide-react';

type MFAMethod = 'telegram' | 'totp';

interface MFAVerifyState {
  loginToken: string;
  expiresIn?: number;
  email?: string;
  // Multi-method fields
  availableMethods?: MFAMethod[];
  preferredMethod?: MFAMethod;
  selectedMethod?: MFAMethod;
}

export default function MFAVerifyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  
  // Get state passed from login
  const state = location.state as MFAVerifyState | null;
  
  // Method selection
  const [currentMethod, setCurrentMethod] = useState<MFAMethod>(
    state?.selectedMethod || state?.preferredMethod || 'telegram'
  );
  const [isBackupCode, setIsBackupCode] = useState(false);
  
  // Code input state (6 digits for TOTP/Telegram, 9 for backup codes with dash)
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [backupCode, setBackupCode] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // UI state
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [trustDevice, setTrustDevice] = useState(false);
  
  // Timer state (only for Telegram)
  const [timeLeft, setTimeLeft] = useState(state?.expiresIn || 120);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Redirect if no login token
  useEffect(() => {
    if (!state?.loginToken) {
      navigate('/login', { replace: true });
    }
  }, [state, navigate]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Handle input change
  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');
    
    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all digits entered
    if (newCode.every(d => d) && newCode.join('').length === 6) {
      handleVerify(newCode.join(''));
    }
  };

  // Handle key press
  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    
    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newCode[i] = pastedData[i];
    }
    
    setCode(newCode);
    
    // Focus last filled input or submit
    if (pastedData.length >= 6) {
      handleVerify(newCode.join(''));
    } else {
      inputRefs.current[pastedData.length]?.focus();
    }
  };

  // Verify code
  const handleVerify = async (codeString?: string) => {
    const fullCode = isBackupCode ? backupCode : (codeString || code.join(''));
    
    if (!isBackupCode && fullCode.length !== 6) {
      setError('Ingresa el código de 6 dígitos');
      return;
    }
    
    if (isBackupCode && !fullCode.match(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i)) {
      setError('Formato de código de respaldo inválido (XXXX-XXXX)');
      return;
    }
    
    setIsVerifying(true);
    setError('');
    
    try {
      // First verify the MFA code
      const verifyRes = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginToken: state!.loginToken,
          code: fullCode,
          method: currentMethod,
          isBackupCode,
          trustDevice,
          deviceFingerprint: await getDeviceFingerprint(),
        }),
      });
      
      const verifyData = await verifyRes.json();
      
      if (!verifyData.ok) {
        setError(verifyData.error || 'Código incorrecto');
        setRemainingAttempts(verifyData.remainingAttempts ?? null);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }
      
      // Then complete the login
      const loginRes = await fetch('/api/auth/mfa/complete-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          loginToken: state!.loginToken,
          deviceFingerprint: await getDeviceFingerprint(),
        }),
      });
      
      const loginData = await loginRes.json();
      
      if (!loginData.ok) {
        setError(loginData.error || 'Error al completar el inicio de sesión');
        return;
      }
      
      // Success!
      setIsSuccess(true);
      
      // Update auth store
      useAuthStore.setState({
        agent: loginData.agent,
        token: loginData.token,
        isAuthenticated: true,
        forcePasswordChange: loginData.forcePasswordChange || false,
      });
      
      // Redirect
      setTimeout(() => {
        if (loginData.forcePasswordChange) {
          navigate('/force-change-password', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }, 1500);
      
    } catch (err) {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend code
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    setIsResending(true);
    setError('');
    
    try {
      const res = await fetch('/api/auth/mfa/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginToken: state!.loginToken }),
      });
      
      const data = await res.json();
      
      if (!data.ok) {
        if (data.waitSeconds) {
          setResendCooldown(data.waitSeconds);
        }
        setError(data.error || 'No se pudo reenviar el código');
        return;
      }
      
      // Reset timer and cooldown
      setTimeLeft(120);
      setResendCooldown(60);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
    } catch {
      setError('Error de conexión');
    } finally {
      setIsResending(false);
    }
  };

  // Get device fingerprint (simple implementation)
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

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!state?.loginToken) {
    return null;
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 rounded-full mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">¡Verificación Exitosa!</h1>
            <p className="text-zinc-400">Redirigiendo al dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Has multiple methods available
  const hasMultipleMethods = (state?.availableMethods?.length ?? 0) > 1;
  const availableMethods = state?.availableMethods || ['telegram'];

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/assets/img/logo-dark.png" alt="Trelk Logo" className="h-14 w-auto" />
          </div>
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-4 ${
            currentMethod === 'telegram' ? 'bg-blue-500/20' : 'bg-purple-500/20'
          }`}>
            {currentMethod === 'telegram' ? (
              <Send className="w-6 h-6 text-blue-400" />
            ) : (
              <QrCode className="w-6 h-6 text-purple-400" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Verificación de Seguridad</h1>
          <p className="text-zinc-400 text-sm">
            {isBackupCode 
              ? 'Ingresa uno de tus códigos de respaldo'
              : currentMethod === 'telegram'
                ? 'Ingresa el código de 6 dígitos enviado a tu Telegram'
                : 'Ingresa el código de tu app autenticador'
            }
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 shadow-2xl">
          
          {/* Method Selector (if multiple methods available) */}
          {hasMultipleMethods && !isBackupCode && (
            <div className="flex gap-2 mb-6">
              {availableMethods.includes('telegram') && (
                <button
                  onClick={() => { setCurrentMethod('telegram'); setCode(['', '', '', '', '', '']); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                    currentMethod === 'telegram'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-700'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Telegram</span>
                </button>
              )}
              {availableMethods.includes('totp') && (
                <button
                  onClick={() => { setCurrentMethod('totp'); setCode(['', '', '', '', '', '']); setError(''); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                    currentMethod === 'totp'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 border border-zinc-700'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>App</span>
                </button>
              )}
            </div>
          )}

          {/* Timer (only for Telegram) */}
          {currentMethod === 'telegram' && !isBackupCode && (
            <div className="flex items-center justify-center gap-2 mb-6">
              <Clock className={`w-4 h-4 ${timeLeft < 30 ? 'text-amber-400' : 'text-zinc-400'}`} />
              <span className={`text-sm font-mono ${timeLeft < 30 ? 'text-amber-400' : 'text-zinc-400'}`}>
                {timeLeft > 0 ? `Expira en ${formatTime(timeLeft)}` : 'Código expirado'}
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 p-4 mb-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <span className="font-medium">{error}</span>
                {remainingAttempts !== null && remainingAttempts > 0 && (
                  <p className="text-xs mt-1 opacity-80">
                    {remainingAttempts} intento{remainingAttempts !== 1 ? 's' : ''} restante{remainingAttempts !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Code Input - Regular */}
          {!isBackupCode && (
            <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={el => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleInputChange(index, e.target.value)}
                  onKeyDown={e => handleKeyDown(index, e)}
                  disabled={isVerifying || (currentMethod === 'telegram' && timeLeft === 0)}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all
                    ${digit 
                      ? currentMethod === 'telegram' 
                        ? 'border-blue-500 bg-blue-500/10' 
                        : 'border-purple-500 bg-purple-500/10' 
                      : 'border-zinc-700 bg-zinc-800/50'}
                    ${isVerifying || (currentMethod === 'telegram' && timeLeft === 0) 
                      ? 'opacity-50 cursor-not-allowed' 
                      : currentMethod === 'telegram'
                        ? 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                        : 'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'}
                    text-white outline-none`}
                />
              ))}
            </div>
          )}

          {/* Backup Code Input */}
          {isBackupCode && (
            <div className="mb-6">
              <input
                type="text"
                value={backupCode}
                onChange={e => {
                  const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                  if (val.length <= 9) {
                    // Auto-add dash after 4 chars
                    if (val.length === 4 && !val.includes('-')) {
                      setBackupCode(val + '-');
                    } else {
                      setBackupCode(val);
                    }
                  }
                  setError('');
                }}
                placeholder="XXXX-XXXX"
                disabled={isVerifying}
                className="w-full text-center text-2xl font-mono font-bold py-4 px-4 rounded-xl border-2 border-zinc-700 bg-zinc-800/50 text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 placeholder-zinc-600"
                autoFocus
              />
              <p className="text-xs text-zinc-500 text-center mt-2">
                Ingresa uno de tus códigos de respaldo de 8 caracteres
              </p>
            </div>
          )}

          {/* Trust Device Checkbox */}
          <label className="flex items-center gap-3 mb-6 cursor-pointer group">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={e => setTrustDevice(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-5 h-5 border-2 border-zinc-600 rounded bg-zinc-800 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all flex items-center justify-center">
                {trustDevice && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400 group-hover:text-zinc-300">
              <Smartphone className="w-4 h-4" />
              <span>Confiar en este dispositivo por 30 días</span>
            </div>
          </label>

          {/* Verify Button */}
          <button
            onClick={() => handleVerify()}
            disabled={
              isVerifying || 
              (isBackupCode ? !backupCode.match(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/i) : code.join('').length !== 6) || 
              (currentMethod === 'telegram' && !isBackupCode && timeLeft === 0)
            }
            className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 text-white font-medium rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              isBackupCode
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 shadow-amber-500/25'
                : currentMethod === 'telegram'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-500/25'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-purple-500/25'
            }`}
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verificando...</span>
              </>
            ) : (
              <span>Verificar {isBackupCode ? 'Código de Respaldo' : 'Código'}</span>
            )}
          </button>

          {/* Resend (only for Telegram) */}
          {currentMethod === 'telegram' && !isBackupCode && (
            <div className="mt-6 text-center">
              <p className="text-zinc-500 text-sm mb-2">¿No recibiste el código?</p>
              <button
                onClick={handleResend}
                disabled={isResending || resendCooldown > 0}
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isResending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {resendCooldown > 0 
                  ? `Reenviar en ${resendCooldown}s`
                  : 'Reenviar código'
                }
              </button>
            </div>
          )}

          {/* Backup Code Toggle (only for TOTP users) */}
          {availableMethods.includes('totp') && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <button
                onClick={() => {
                  setIsBackupCode(!isBackupCode);
                  setCode(['', '', '', '', '', '']);
                  setBackupCode('');
                  setError('');
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-zinc-400 hover:text-white text-sm transition-colors"
              >
                <Key className="w-4 h-4" />
                {isBackupCode ? 'Usar código de app' : 'Usar código de respaldo'}
              </button>
            </div>
          )}

          {/* Back to login */}
          <div className={`mt-6 ${!availableMethods.includes('totp') ? 'pt-6 border-t border-zinc-800' : ''}`}>
            <button
              onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-zinc-400 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio de sesión
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-xs mt-8">
          © {new Date().getFullYear()} Trelk Support Platform
        </p>
      </div>
    </div>
  );
}

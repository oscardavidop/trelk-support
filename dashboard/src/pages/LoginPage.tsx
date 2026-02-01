import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePermissionStore } from '../stores/permissionStore';
import { Lock, Mail, AlertCircle, Loader2, ArrowRight, ArrowLeft, KeyRound, CheckCircle2, Send, Shield } from 'lucide-react';

// Helper to generate device fingerprint
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

export default function LoginPage() {
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const deviceFingerprint = await getDeviceFingerprint();
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, deviceFingerprint }),
        credentials: 'include',
      });

      const data = await res.json();

      if (data.ok) {
        // Check if MFA is required
        if (data.mfaRequired) {
          // Redirect to MFA verification page with state
          navigate('/mfa-verify', {
            state: {
              loginToken: data.mfaLoginToken,
              expiresIn: data.mfaExpiresIn || 120,
              email: email,
            },
            replace: true,
          });
          return;
        }
        
        // Normal login - update auth store
        useAuthStore.setState({
          agent: data.agent,
          token: data.token,
          isAuthenticated: true,
          isLoading: false,
          forcePasswordChange: data.forcePasswordChange || false,
        });
        
        // Store permissions from login response
        if (data.permissions) {
          usePermissionStore.getState().setPermissions(
            data.permissions,
            data.agent?.permissionVersion || 1
          );
        }
        
        // Redirect based on password change requirement
        if (data.forcePasswordChange) {
          navigate('/force-change-password', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      } else {
        setError(data.error || 'Credenciales inválidas');
      }
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotLoading(true);

    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();

      if (data.ok) {
        setForgotSuccess(true);
      } else {
        setForgotError(data.error || 'Error al procesar la solicitud');
      }
    } catch {
      setForgotError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setForgotLoading(false);
    }
  };

  const resetForgotPassword = () => {
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotSuccess(false);
    setForgotError('');
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500/30">
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6">
            <img src="/assets/img/logo-dark.png" alt="Trelk Logo" className="h-20 w-auto" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Bienvenido de nuevo</h1>
          <p className="text-zinc-400 text-sm">Ingresa a tu cuenta de agente para continuar</p>
        </div>

        {/* Login Card */}
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 shadow-2xl">
          
          {/* Forgot Password View */}
          {showForgotPassword ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              {forgotSuccess ? (
                // Success State
                <div className="text-center py-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 rounded-full mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">¡Solicitud enviada!</h3>
                  <p className="text-zinc-400 text-sm mb-6">
                    Si tu correo está registrado, recibirás un enlace de recuperación en tu Telegram vinculado.
                  </p>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6">
                    <p className="text-amber-300 text-xs">
                      <strong>Nota:</strong> El enlace expirará en 15 minutos. Asegúrate de revisar tu Telegram.
                    </p>
                  </div>
                  <button
                    onClick={resetForgotPassword}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-xl transition-all"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio de sesión
                  </button>
                </div>
              ) : (
                // Request Form
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-500/20 rounded-full mb-4">
                      <KeyRound className="w-7 h-7 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">¿Olvidaste tu contraseña?</h3>
                    <p className="text-zinc-400 text-sm">
                      Ingresa tu correo y te enviaremos un enlace de recuperación a tu Telegram.
                    </p>
                  </div>

                  {/* Error Message */}
                  {forgotError && (
                    <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in slide-in-from-top-2">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      <span className="font-medium">{forgotError}</span>
                    </div>
                  )}

                  {/* Email Input */}
                  <div className="space-y-2">
                    <label htmlFor="forgot-email" className="block text-xs font-bold text-zinc-500 pl-1">
                      Correo Electrónico
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-500 transition-colors">
                        <Mail className="w-5 h-5" />
                      </div>
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="tu-correo@trelk.com"
                        required
                        autoFocus
                        className="block w-full pl-11 pr-4 py-3.5 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all sm:text-sm"
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {forgotLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Enviando...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        <span>Enviar enlace de recuperación</span>
                      </>
                    )}
                  </button>

                  {/* Back Link */}
                  <button
                    type="button"
                    onClick={resetForgotPassword}
                    className="w-full flex items-center justify-center gap-2 py-3 text-zinc-400 hover:text-white text-sm transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver al inicio de sesión
                  </button>
                </form>
              )}
            </div>
          ) : (
            // Login Form
            <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
            
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-bold text-zinc-500 uppercasepl-1">
                Correo Electrónico
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-500 transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@trelk.com"
                  required
                  className="block w-full pl-11 pr-4 py-3.5 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all sm:text-sm"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between pl-1">
                <label htmlFor="password" className="block text-xs font-bold text-zinc-500 ">
                  Contraseña
                </label>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-500 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="block w-full pl-11 pr-4 py-3.5 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all sm:text-sm"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <>
                  <span>Ingresar</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {/* Forgot Password Link */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-zinc-400 hover:text-indigo-400 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </form>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-xs mt-8">
          © {new Date().getFullYear()} Trelk Support Platform v2.4.0
        </p>
      </div>
    </div>
  );
}
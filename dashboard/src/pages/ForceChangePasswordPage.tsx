import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Lock, AlertCircle, Loader2, CheckCircle2, ArrowRight, Shield, Eye, EyeOff } from 'lucide-react';

export default function ForceChangePasswordPage() {
  const navigate = useNavigate();
  const { agent, setForcePasswordChange, logout } = useAuthStore();

  // States
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate passwords
    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (!/[a-zA-Z]/.test(newPassword)) {
      setError('La contraseña debe contener al menos una letra');
      return;
    }

    if (!/\d/.test(newPassword)) {
      setError('La contraseña debe contener al menos un número');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/password-reset/force-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setIsSuccess(true);
        setForcePasswordChange(false);
        // Redirect to dashboard after a short delay
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        setError(data.error || 'Error al cambiar la contraseña');
      }
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Success state
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-green-600/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-6">
              <img src="/assets/img/logo-dark.png" alt="Trelk Logo" className="h-20 w-auto" />
            </div>
          </div>

          <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">¡Contraseña Actualizada!</h1>
              <p className="text-zinc-400 mb-6">
                Tu contraseña ha sido cambiada exitosamente.
              </p>
              <div className="flex items-center justify-center gap-2 text-indigo-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Redirigiendo al dashboard...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-amber-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-6">
            <img src="/assets/img/logo-dark.png" alt="Trelk Logo" className="h-20 w-auto" />
          </div>
        </div>

        {/* Security Notice */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Shield className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-amber-300 font-semibold mb-1">Cambio de Contraseña Requerido</h3>
            <p className="text-amber-200/70 text-sm">
              Por razones de seguridad, debes crear una nueva contraseña antes de continuar.
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/50 rounded-2xl p-8 shadow-2xl">
          {agent && (
            <div className="text-center mb-6">
              <p className="text-zinc-400">
                Hola <span className="text-white font-medium">{agent.name}</span>
              </p>
              <p className="text-zinc-500 text-sm">{agent.email}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-2">
              <label htmlFor="newPassword" className="block text-xs font-bold text-zinc-500 uppercase pl-1">
                Nueva Contraseña
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-500 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  autoFocus
                  className="block w-full pl-11 pr-12 py-3.5 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-zinc-500 pl-1">
                Mínimo 8 caracteres, al menos una letra y un número
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="block text-xs font-bold text-zinc-500 uppercase pl-1">
                Confirmar Contraseña
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-500 transition-colors">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="block w-full pl-11 pr-12 py-3.5 bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Password match indicator */}
            {confirmPassword && (
              <div className={`flex items-center gap-2 text-sm ${
                newPassword === confirmPassword ? 'text-green-400' : 'text-amber-400'
              }`}>
                {newPassword === confirmPassword ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Las contraseñas coinciden</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <span>Las contraseñas no coinciden</span>
                  </>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !newPassword || !confirmPassword}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Actualizando...</span>
                </>
              ) : (
                <>
                  <span>Cambiar Contraseña</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          {/* Logout option */}
          <div className="mt-6 text-center border-t border-zinc-800 pt-6">
            <button
              onClick={handleLogout}
              className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
            >
              Cerrar sesión
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

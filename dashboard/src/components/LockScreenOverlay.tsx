/**
 * LockScreenOverlay - Premium Zinc Refactor (Informative UX)
 * A detailed system-level lock screen with context and security status.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Lock, Eye, EyeOff, Loader2, AlertCircle, Clock, 
  ShieldCheck, Smartphone, LogOut, User, ShieldAlert,
  Fingerprint, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import type { IdleDetectorState, IdleDetectorActions } from '../hooks/useIdleDetector';

interface LockScreenOverlayProps {
  state: IdleDetectorState;
  actions: IdleDetectorActions;
  onLogout?: () => void;
}

export default function LockScreenOverlay({ state, actions, onLogout }: LockScreenOverlayProps) {
  const agent = useAuthStore((state) => state.agent);
  
  // Form State
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [step, setStep] = useState<'password' | 'mfa'>('password');
  
  // Refs
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const mfaInputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    if (state.isLocked) {
      setTimeout(() => {
        (step === 'password' ? passwordInputRef : mfaInputRef).current?.focus();
      }, 100);
    }
  }, [state.isLocked, step]);

  useEffect(() => {
    if (state.isLocked) {
      // Reset form state when lock is activated
      return () => {
        setPassword('');
        setMfaCode('');
        setError(null);
        setRemainingAttempts(null);
        setStep('password');
      };
    }
  }, [state.isLocked]);

  // --- Logic Helpers ---
  const getLockStatusInfo = (reason: IdleDetectorState['lockReason']) => {
    switch (reason) {
      case 'inactivity': 
        return {
          title: 'Sesión Suspendida',
          desc: 'Se ha bloqueado la pantalla por inactividad para proteger tus datos.',
          icon: Clock,
          color: 'text-amber-400',
          bg: 'bg-amber-500/10 border-amber-500/20'
        };
      case 'remote': 
        return {
          title: 'Bloqueo Administrativo',
          desc: 'Un administrador ha solicitado el bloqueo temporal de esta sesión.',
          icon: ShieldAlert,
          color: 'text-red-400',
          bg: 'bg-red-500/10 border-red-500/20'
        };
      case 'security': 
        return {
          title: 'Alerta de Seguridad',
          desc: 'El sistema detectó un cambio de red o comportamiento inusual.',
          icon: ShieldCheck,
          color: 'text-indigo-400',
          bg: 'bg-indigo-500/10 border-indigo-500/20'
        };
      default: // manual
        return {
          title: 'Terminal Bloqueada',
          desc: 'Se ha bloqueado la pantalla por inactividad para proteger tus datos.',
          icon: Lock,
          color: 'text-zinc-400',
          bg: 'bg-zinc-800/50 border-zinc-700'
        };
    }
  };

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Desconocido';
    const diffMins = Math.floor((new Date().getTime() - date.getTime()) / 60000);
    if (diffMins < 1) return 'Hace un momento';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    return `Hace ${diffHours} h ${diffMins % 60} min`;
  };

  const lockInfo = getLockStatusInfo(state.lockReason);
  const StatusIcon = lockInfo.icon;

  // --- Handlers ---
  const handleUnlock = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isUnlocking) return;
    setIsUnlocking(true);
    setError(null);
    
    try {
      // Step 1: Password
      if (step === 'password' && state.settings?.requirePassword) {
        if (!password.trim()) { setError('Ingresa tu contraseña'); setIsUnlocking(false); return; }
        const result = await actions.unlock(password, undefined);
        
        if (!result.success) {
          setError(result.error || 'Credenciales incorrectas');
          setRemainingAttempts(result.remainingAttempts ?? null);
          setIsUnlocking(false);
          return;
        }
        if (state.settings?.requireMFA) { setStep('mfa'); setIsUnlocking(false); return; }
      } 
      // Step 2: MFA
      else if (step === 'mfa' && state.settings?.requireMFA) {
        if (mfaCode.length < 6) { setError('Código incompleto'); setIsUnlocking(false); return; }
        const result = await actions.unlock(undefined, mfaCode);
        if (!result.success) setError(result.error || 'Código inválido');
      } 
      else { await actions.unlock(); }
      setIsUnlocking(false);
    } catch (err) { setError('Error de conexión'); setIsUnlocking(false); }
  }, [step, password, mfaCode, state.settings, actions, isUnlocking]);

  const handleLogout = useCallback(() => {
    if (onLogout) onLogout();
  }, [onLogout]);

  if (!state.isLocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-in fade-in duration-700">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-indigo-900/20 rounded-full blur-[120px] opacity-50" />
      </div>

      <div className="relative w-full max-w-sm mx-4 flex flex-col gap-6">
        
        {/* 1. Identity & Status Card */}
        <div className="flex flex-col items-center text-center space-y-4">
          
          {/* Avatar with Status Ring */}
          <div className="relative group">
            <div className={`absolute inset-0 rounded-full blur-md opacity-40 transition-opacity duration-1000 ${lockInfo.bg.split(' ')[0].replace('/10', '/30')}`} />
            <div className="relative w-24 h-24 rounded-full p-1.5 bg-zinc-950 ring-1 ring-zinc-800 shadow-2xl">
              {agent?.avatar ? (
                <img src={agent.avatar} alt={agent.name} className="w-full h-full rounded-full object-cover grayscale-[30%]" />
              ) : (
                <div className="w-full h-full rounded-full bg-zinc-900 flex items-center justify-center text-zinc-500">
                  <User className="w-10 h-10" />
                </div>
              )}
              
              {/* Lock Icon Badge */}
              <div className="absolute bottom-0 right-0 p-1 bg-zinc-950 rounded-full ring-1 ring-zinc-800/50">
                <div className={`p-1.5 rounded-full ${lockInfo.bg} ${lockInfo.color}`}>
                  <Lock className="w-4 h-4 fill-current" />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-white tracking-tight">{agent?.name || 'Usuario'}</h2>
            <p className="text-sm text-zinc-500 font-medium">{agent?.email}</p>
          </div>

          {/* Informative Status Pill */}
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border w-full text-left ${lockInfo.bg} border-zinc-800/50`}>
            <StatusIcon className={`w-5 h-5 shrink-0 ${lockInfo.color}`} />
            <div>
              <p className={`text-xs font-bold uppercase r ${lockInfo.color}`}>
                {lockInfo.title}
              </p>
              <p className="text-xs text-zinc-400 mt-0.5 leading-snug">
                {lockInfo.desc}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Authentication Form */}
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl ring-1 ring-white/5">
          <form onSubmit={handleUnlock} className="p-5 space-y-4">
            
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 animate-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-400">Acceso Denegado</p>
                  <p className="text-xs text-red-300/70">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {step === 'password' && state.settings?.requirePassword ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-300">
                  <label className="text-xs font-medium text-zinc-500 ml-1 uppercase">Contraseña</label>
                  <div className="relative group">
                    <input
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-4 pr-10 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                      placeholder="Ingresa tu clave para desbloquear"
                      disabled={isUnlocking}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : step === 'mfa' ? (
                <div className="space-y-2 animate-in fade-in slide-in-from-right-4 duration-300">
                  <label className="text-xs font-medium text-zinc-500 ml-1 uppercase flex justify-between">
                    <span>Código 2FA</span>
                    <span className="text-indigo-400 flex items-center gap-1"><Smartphone className="w-3 h-3" /> App Auth</span>
                  </label>
                  <input
                    ref={mfaInputRef}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-center text-xl font-mono text-white tracking-[0.5em] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all placeholder-zinc-700"
                    placeholder="000000"
                    disabled={isUnlocking}
                  />
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isUnlocking}
                className="w-full group relative py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
              >
                <div className="relative z-10 flex items-center justify-center gap-2">
                  {isUnlocking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validando...</span>
                    </>
                  ) : (
                    <>
                      {step === 'mfa' ? <ShieldCheck className="w-4 h-4" /> : <Fingerprint className="w-4 h-4" />}
                      <span>{step === 'mfa' ? 'Verificar Seguridad' : 'Desbloquear Sesión'}</span>
                      <ChevronRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </button>
            </div>
          </form>

          {/* Footer Actions */}
          <div className="px-5 py-3 bg-zinc-900/50 border-t border-zinc-800 rounded-b-xl flex items-center justify-between">
            {step === 'mfa' ? (
              <button 
                onClick={() => { setStep('password'); setMfaCode(''); setError(null); }}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
              >
                ← Volver a contraseña
              </button>
            ) : (
              <span className="text-[10px] text-zinc-600 flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Inactivo: <span className="text-zinc-400">{formatTimeAgo(state.lastActivity)}</span>
              </span>
            )}

            {onLogout && (
              <button
                onClick={handleLogout}
                className="text-xs font-medium text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Cerrar Sesión
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
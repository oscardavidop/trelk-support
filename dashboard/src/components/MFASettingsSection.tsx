// MFA Settings Component for MySettingsPage - Multi-Method Support with Modals
import { useState, useEffect, useRef } from 'react';
import { 
  Shield, Smartphone, Trash2, Loader2, Check, AlertTriangle,
  RefreshCw, Clock, Send, Key, ShieldCheck, ShieldOff,
  AlertCircle, QrCode, Copy, Eye, EyeOff, Star, Plus, Download
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

type MFAMethod = 'telegram' | 'totp';

interface MFAStatus {
  enabled: boolean;
  verifiedAt?: string;
  enforcedByAdmin?: boolean;
  bypassUntil?: string;
  trustedDevices?: TrustedDevice[];
  methods?: {
    telegram: boolean;
    totp: boolean;
  };
  preferredMethod?: MFAMethod;
  totpConfigured?: boolean;
  backupCodesStatus?: {
    total: number;
    used: number;
    remaining: number;
  };
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

interface TOTPSetupData {
  secret: string;
  qrCodeUri: string;
  backupCodes: string[];
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

// Modal wrapper component
function Modal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        {children}
      </div>
    </div>
  );
}

// Step indicator component
function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-4 border-b border-zinc-800">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
            i < currentStep 
              ? 'bg-emerald-500 text-white' 
              : i === currentStep 
                ? 'bg-indigo-500 text-white' 
                : 'bg-zinc-800 text-zinc-500'
          }`}>
            {i < currentStep ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div className={`w-8 h-0.5 ${i < currentStep ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function MFASettingsSection() {
  const agent = useAuthStore((s) => s.agent);
  const updateAgentFields = useAuthStore((s) => s.updateAgentFields);
  
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Modal states
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [showTOTPModal, setShowTOTPModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  
  // Telegram activation
  const [telegramStep, setTelegramStep] = useState(0); // 0: info, 1: verify
  const [loginToken, setLoginToken] = useState('');
  const [telegramCode, setTelegramCode] = useState(['', '', '', '', '', '']);
  const [telegramError, setTelegramError] = useState('');
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const telegramInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // TOTP activation
  const [totpStep, setTotpStep] = useState(0); // 0: info, 1: qr, 2: verify, 3: backup
  const [totpSetupData, setTotpSetupData] = useState<TOTPSetupData | null>(null);
  const [totpCode, setTotpCode] = useState(['', '', '', '', '', '']);
  const [totpError, setTotpError] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [secretCopied, setSecretCopied] = useState(false);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);
  const totpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Disable flow
  const [disableMethod, setDisableMethod] = useState<MFAMethod | null>(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState('');
  
  // Backup codes regeneration
  const [regeneratedCodes, setRegeneratedCodes] = useState<string[] | null>(null);
  const [regeneratePassword, setRegeneratePassword] = useState('');
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [regenerateError, setRegenerateError] = useState('');

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

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Focus inputs when step changes
  useEffect(() => {
    if (telegramStep === 1 && showTelegramModal) {
      setTimeout(() => telegramInputRefs.current[0]?.focus(), 100);
    }
  }, [telegramStep, showTelegramModal]);

  useEffect(() => {
    if (totpStep === 2 && showTOTPModal) {
      setTimeout(() => totpInputRefs.current[0]?.focus(), 100);
    }
  }, [totpStep, showTOTPModal]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ==================== TELEGRAM FUNCTIONS ====================
  
  const openTelegramModal = () => {
    setTelegramStep(0);
    setTelegramCode(['', '', '', '', '', '']);
    setTelegramError('');
    setLoginToken('');
    setShowTelegramModal(true);
  };

  const closeTelegramModal = () => {
    setShowTelegramModal(false);
    setTelegramStep(0);
    setTelegramCode(['', '', '', '', '', '']);
    setTelegramError('');
  };

  const startTelegramActivation = async () => {
    setTelegramLoading(true);
    setTelegramError('');
    try {
      const res = await fetch('/api/auth/mfa/activate/start', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (data.ok) {
        setLoginToken(data.loginToken);
        setTimeLeft(data.expiresIn || 120);
        setTelegramStep(1);
      } else {
        setTelegramError(data.error || 'Error al iniciar activación');
      }
    } catch {
      setTelegramError('Error de conexión');
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleTelegramCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...telegramCode];
    newCode[index] = value.slice(-1);
    setTelegramCode(newCode);
    setTelegramError('');
    
    if (value && index < 5) {
      telegramInputRefs.current[index + 1]?.focus();
    }
    
    if (newCode.every(d => d) && newCode.join('').length === 6) {
      verifyTelegramCode(newCode.join(''));
    }
  };

  const handleTelegramKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !telegramCode[index] && index > 0) {
      telegramInputRefs.current[index - 1]?.focus();
    }
  };

  const verifyTelegramCode = async (codeString?: string) => {
    const fullCode = codeString || telegramCode.join('');
    if (fullCode.length !== 6) return;
    
    setTelegramLoading(true);
    setTelegramError('');
    
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
        updateAgentFields({ mfaEnabled: true });
        closeTelegramModal();
        loadStatus();
      } else {
        setTelegramError(data.error || 'Código incorrecto');
        setTelegramCode(['', '', '', '', '', '']);
        telegramInputRefs.current[0]?.focus();
      }
    } catch {
      setTelegramError('Error de conexión');
    } finally {
      setTelegramLoading(false);
    }
  };

  const resendTelegramCode = async () => {
    setTelegramError('');
    setTelegramLoading(true);
    try {
      const res = await fetch('/api/auth/mfa/activate/start', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (data.ok) {
        setLoginToken(data.loginToken);
        setTimeLeft(data.expiresIn || 120);
        setTelegramCode(['', '', '', '', '', '']);
        telegramInputRefs.current[0]?.focus();
      } else {
        setTelegramError(data.error || 'Error al reenviar');
      }
    } catch {
      setTelegramError('Error de conexión');
    } finally {
      setTelegramLoading(false);
    }
  };

  // ==================== TOTP FUNCTIONS ====================
  
  const openTOTPModal = () => {
    setTotpStep(0);
    setTotpCode(['', '', '', '', '', '']);
    setTotpError('');
    setTotpSetupData(null);
    setShowSecret(false);
    setSecretCopied(false);
    setBackupCodesCopied(false);
    setShowTOTPModal(true);
  };

  const closeTOTPModal = () => {
    setShowTOTPModal(false);
    setTotpStep(0);
    setTotpSetupData(null);
  };

  const startTOTPSetup = async () => {
    setTotpLoading(true);
    setTotpError('');
    try {
      const res = await fetch('/api/auth/mfa/totp/setup', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      
      if (data.ok) {
        setTotpSetupData({
          secret: data.secret,
          qrCodeUri: data.qrCodeUri,
          backupCodes: data.backupCodes,
        });
        setTotpStep(1);
      } else {
        setTotpError(data.error || 'Error al iniciar configuración');
      }
    } catch {
      setTotpError('Error de conexión');
    } finally {
      setTotpLoading(false);
    }
  };

  const handleTOTPCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newCode = [...totpCode];
    newCode[index] = value.slice(-1);
    setTotpCode(newCode);
    setTotpError('');
    
    if (value && index < 5) {
      totpInputRefs.current[index + 1]?.focus();
    }
    
    if (newCode.every(d => d) && newCode.join('').length === 6) {
      verifyTOTPCode(newCode.join(''));
    }
  };

  const handleTOTPKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !totpCode[index] && index > 0) {
      totpInputRefs.current[index - 1]?.focus();
    }
  };

  const verifyTOTPCode = async (codeString?: string) => {
    const fullCode = codeString || totpCode.join('');
    if (fullCode.length !== 6) return;
    
    setTotpLoading(true);
    setTotpError('');
    
    try {
      const res = await fetch('/api/auth/mfa/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: fullCode }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        updateAgentFields({ mfaEnabled: true });
        setTotpStep(3); // Show backup codes
      } else {
        setTotpError(data.error || 'Código incorrecto');
        setTotpCode(['', '', '', '', '', '']);
        totpInputRefs.current[0]?.focus();
      }
    } catch {
      setTotpError('Error de conexión');
    } finally {
      setTotpLoading(false);
    }
  };

  const finishTOTPSetup = () => {
    closeTOTPModal();
    loadStatus();
  };

  const copySecret = async () => {
    if (!totpSetupData?.secret) return;
    try {
      await navigator.clipboard.writeText(totpSetupData.secret);
      setSecretCopied(true);
      setTimeout(() => setSecretCopied(false), 2000);
    } catch {}
  };

  const copyBackupCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setBackupCodesCopied(true);
      setTimeout(() => setBackupCodesCopied(false), 2000);
    } catch {}
  };

  const downloadBackupCodes = (codes: string[]) => {
    const content = [
      '===========================================',
      '  CÓDIGOS DE RESPALDO - MFA',
      '  Generados: ' + new Date().toLocaleString(),
      '===========================================',
      '',
      'Guarda estos códigos en un lugar seguro.',
      'Cada código solo puede usarse UNA vez.',
      '',
      '-------------------------------------------',
      ...codes.map((code, i) => `  ${i + 1}. ${code}`),
      '-------------------------------------------',
      '',
      '⚠️ Si pierdes acceso a tu app autenticador,',
      'necesitarás estos códigos para ingresar.',
    ].join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-codes-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ==================== DISABLE FUNCTIONS ====================
  
  const openDisableModal = (method: MFAMethod) => {
    setDisableMethod(method);
    setDisablePassword('');
    setDisableError('');
    setShowDisableModal(true);
  };

  const closeDisableModal = () => {
    setShowDisableModal(false);
    setDisableMethod(null);
    setDisablePassword('');
    setDisableError('');
  };

  const handleDisable = async () => {
    if (!disableMethod) return;
    
    setDisableLoading(true);
    setDisableError('');
    
    try {
      const endpoint = disableMethod === 'totp' 
        ? '/api/auth/mfa/totp' 
        : '/api/auth/mfa/disable';
      
      const res = await fetch(endpoint, {
        method: disableMethod === 'totp' ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: disablePassword }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        closeDisableModal();
        loadStatus();
      } else {
        setDisableError(data.error || 'Error al desactivar');
      }
    } catch {
      setDisableError('Error de conexión');
    } finally {
      setDisableLoading(false);
    }
  };

  // ==================== BACKUP CODES FUNCTIONS ====================
  
  const openBackupCodesModal = () => {
    setRegeneratedCodes(null);
    setRegeneratePassword('');
    setRegenerateError('');
    setBackupCodesCopied(false);
    setShowBackupCodesModal(true);
  };

  const closeBackupCodesModal = () => {
    setShowBackupCodesModal(false);
    setRegeneratedCodes(null);
    setRegeneratePassword('');
    loadStatus();
  };

  const regenerateBackupCodes = async () => {
    setRegenerateLoading(true);
    setRegenerateError('');
    
    try {
      const res = await fetch('/api/auth/mfa/totp/backup-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: regeneratePassword }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setRegeneratedCodes(data.backupCodes);
      } else {
        setRegenerateError(data.error || 'Error al regenerar códigos');
      }
    } catch {
      setRegenerateError('Error de conexión');
    } finally {
      setRegenerateLoading(false);
    }
  };

  // ==================== OTHER FUNCTIONS ====================
  
  const setPreferredMethod = async (method: MFAMethod) => {
    try {
      const res = await fetch('/api/auth/mfa/preferred-method', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ method }),
      });
      
      const data = await res.json();
      if (data.ok) {
        loadStatus();
      }
    } catch {}
  };

  const revokeDevice = async (deviceId: string) => {
    try {
      await fetch(`/api/auth/mfa/devices/${deviceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      loadStatus();
    } catch {}
  };

  const revokeAllDevices = async () => {
    try {
      await fetch('/api/auth/mfa/devices', {
        method: 'DELETE',
        credentials: 'include',
      });
      loadStatus();
    } catch {}
  };

  // ==================== RENDER ====================

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      </div>
    );
  }

  // Use the backend's methods object for consistent detection
  // methods.telegram includes both new system and legacy (mfaEnabled + telegramId without mfaMethods)
  const hasTelegram = status?.methods?.telegram ?? false;
  // Use totpConfigured which actually checks if TOTP is verified in the database
  const hasTOTP = status?.totpConfigured ?? false;
  const hasAnyMFA = hasTelegram || hasTOTP || status?.enabled;
  const canDisableTelegram = hasTOTP || !status?.enforcedByAdmin;
  const canDisableTOTP = hasTelegram || !status?.enforcedByAdmin;

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl border ${hasAnyMFA ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                {hasAnyMFA ? <ShieldCheck className="w-6 h-6" /> : <Shield className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Autenticación de Dos Factores</h3>
                <p className="text-sm text-zinc-400">
                  {hasAnyMFA 
                    ? `Protegido con ${hasTelegram && hasTOTP ? 'Telegram y App' : hasTelegram ? 'Telegram' : 'App Autenticador'}`
                    : 'Agrega una capa extra de seguridad a tu cuenta'
                  }
                </p>
              </div>
            </div>
            
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              hasAnyMFA 
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' 
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}>
              {hasAnyMFA ? 'Activado' : 'Desactivado'}
            </div>
          </div>
          
          {status?.enforcedByAdmin && (
            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-300">
                MFA es requerido por tu organización. Debes tener al menos un método activo.
              </p>
            </div>
          )}
          
          {status?.bypassUntil && new Date(status.bypassUntil) > new Date() && (
            <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
              <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <p className="text-sm text-blue-300">
                Bypass temporal hasta {new Date(status.bypassUntil).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Methods List */}
        <div className="p-6 space-y-4">
          {/* Telegram Method Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            hasTelegram 
              ? 'bg-blue-500/5 border-blue-500/20' 
              : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${hasTelegram ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">Telegram</span>
                    {hasTelegram && status?.preferredMethod === 'telegram' && (
                      <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                        <Star className="w-3 h-3" />
                        Preferido
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {hasTelegram 
                      ? 'Recibe códigos en tu Telegram vinculado'
                      : 'Recibe códigos de verificación en Telegram'
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {hasTelegram ? (
                  <>
                    {hasTOTP && status?.preferredMethod !== 'telegram' && (
                      <button
                        onClick={() => setPreferredMethod('telegram')}
                        className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                      >
                        Preferir
                      </button>
                    )}
                    {canDisableTelegram && (
                      <button
                        onClick={() => openDisableModal('telegram')}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                      >
                        Desactivar
                      </button>
                    )}
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </>
                ) : (
                  <button
                    onClick={openTelegramModal}
                    disabled={!agent?.telegramId}
                    className="flex items-center gap-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Configurar
                  </button>
                )}
              </div>
            </div>
            
            {!hasTelegram && !agent?.telegramId && (
              <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs text-amber-400">
                  Debes vincular tu Telegram primero para usar este método.
                </p>
              </div>
            )}
          </div>

          {/* TOTP Method Card */}
          <div className={`p-4 rounded-xl border transition-all ${
            hasTOTP 
              ? 'bg-purple-500/5 border-purple-500/20' 
              : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${hasTOTP ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-400'}`}>
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">App Autenticador</span>
                    {hasTOTP && status?.preferredMethod === 'totp' && (
                      <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                        <Star className="w-3 h-3" />
                        Preferido
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {hasTOTP 
                      ? `${status?.backupCodesStatus?.remaining ?? 0} códigos de respaldo restantes`
                      : 'Google Authenticator, Authy, 1Password, etc.'
                    }
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {hasTOTP ? (
                  <>
                    <button
                      onClick={openBackupCodesModal}
                      className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                    >
                      Códigos
                    </button>
                    {hasTelegram && status?.preferredMethod !== 'totp' && (
                      <button
                        onClick={() => setPreferredMethod('totp')}
                        className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                      >
                        Preferir
                      </button>
                    )}
                    {canDisableTOTP && (
                      <button
                        onClick={() => openDisableModal('totp')}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                      >
                        Desactivar
                      </button>
                    )}
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </>
                ) : (
                  <button
                    onClick={openTOTPModal}
                    className="flex items-center gap-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Configurar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Trusted Devices */}
          {hasAnyMFA && (
            <div className="mt-6 pt-6 border-t border-zinc-800">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-medium text-white">Dispositivos de Confianza</h4>
                {(status?.trustedDevices?.length ?? 0) > 0 && (
                  <button
                    onClick={revokeAllDevices}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Revocar todos
                  </button>
                )}
              </div>

              {(!status?.trustedDevices || status.trustedDevices.length === 0) ? (
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
                  <Smartphone className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No hay dispositivos de confianza</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Puedes marcar dispositivos como confiables al iniciar sesión
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {status.trustedDevices.map(device => (
                    <div
                      key={device._id}
                      className={`flex items-center justify-between p-3 rounded-xl border ${
                        device.isCurrent 
                          ? 'bg-indigo-500/5 border-indigo-500/20' 
                          : 'bg-zinc-950 border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Smartphone className={`w-4 h-4 ${device.isCurrent ? 'text-indigo-400' : 'text-zinc-500'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-zinc-300">{device.browser} • {device.os}</span>
                            {device.isCurrent && (
                              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">
                                Actual
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">
                            Expira: {new Date(device.expiresAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => revokeDevice(device._id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================== TELEGRAM MODAL ==================== */}
      <Modal isOpen={showTelegramModal} onClose={closeTelegramModal}>
        <StepIndicator currentStep={telegramStep} totalSteps={2} />
        
        <div className="p-6">
          {telegramStep === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
                  <Send className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Configurar Telegram MFA</h3>
                <p className="text-sm text-zinc-400">
                  Recibirás un código de 6 dígitos en tu Telegram cada vez que inicies sesión
                </p>
              </div>
              
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                <h4 className="text-sm font-medium text-white mb-2">¿Cómo funciona?</h4>
                <ul className="text-xs text-zinc-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center text-[10px] mt-0.5">1</span>
                    <span>Al iniciar sesión, enviaremos un código a tu Telegram</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center text-[10px] mt-0.5">2</span>
                    <span>El código expira en 2 minutos</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-zinc-800 rounded-full flex items-center justify-center text-[10px] mt-0.5">3</span>
                    <span>Cada código solo puede usarse una vez</span>
                  </li>
                </ul>
              </div>
              
              {telegramError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {telegramError}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={closeTelegramModal}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={startTelegramActivation}
                  disabled={telegramLoading}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {telegramLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Enviar Código'}
                </button>
              </div>
            </div>
          )}
          
          {telegramStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500/20 rounded-full mb-4">
                  <Key className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Ingresa el Código</h3>
                <p className="text-sm text-zinc-400">
                  Te hemos enviado un código de 6 dígitos a tu Telegram
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-2">
                <Clock className={`w-4 h-4 ${timeLeft < 30 ? 'text-amber-400' : 'text-zinc-400'}`} />
                <span className={`text-sm font-mono ${timeLeft < 30 ? 'text-amber-400' : 'text-zinc-400'}`}>
                  {timeLeft > 0 ? formatTime(timeLeft) : 'Expirado'}
                </span>
              </div>
              
              {telegramError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {telegramError}
                </div>
              )}
              
              <div className="flex justify-center gap-2">
                {telegramCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => { telegramInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleTelegramCodeChange(index, e.target.value)}
                    onKeyDown={e => handleTelegramKeyDown(index, e)}
                    disabled={telegramLoading || timeLeft === 0}
                    className={`w-11 h-13 text-center text-xl font-bold rounded-lg border-2 transition-all
                      ${digit ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-700 bg-zinc-800'}
                      ${telegramLoading || timeLeft === 0 ? 'opacity-50' : 'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'}
                      text-white outline-none`}
                  />
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={closeTelegramModal}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={resendTelegramCode}
                  disabled={telegramLoading || timeLeft > 90}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-4 h-4 inline mr-2" />
                  Reenviar
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ==================== TOTP MODAL ==================== */}
      <Modal isOpen={showTOTPModal} onClose={totpStep === 3 ? finishTOTPSetup : closeTOTPModal}>
        <StepIndicator currentStep={totpStep} totalSteps={4} />
        
        <div className="p-6">
          {totpStep === 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
                  <QrCode className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Configurar App Autenticador</h3>
                <p className="text-sm text-zinc-400">
                  Usa Google Authenticator, Authy, 1Password u otra app compatible
                </p>
              </div>
              
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                <h4 className="text-sm font-medium text-white mb-2">Ventajas</h4>
                <ul className="text-xs text-zinc-400 space-y-2">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Funciona sin conexión a internet</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Códigos de respaldo para emergencias</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Compatible con múltiples apps</span>
                  </li>
                </ul>
              </div>
              
              {totpError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {totpError}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={closeTOTPModal}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={startTOTPSetup}
                  disabled={totpLoading}
                  className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {totpLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Continuar'}
                </button>
              </div>
            </div>
          )}
          
          {totpStep === 1 && totpSetupData && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-2">Escanea el Código QR</h3>
                <p className="text-sm text-zinc-400">
                  Abre tu app autenticador y escanea este código
                </p>
              </div>
              
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-xl">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpSetupData.qrCodeUri)}`} 
                    alt="QR Code"
                    className="w-44 h-44"
                  />
                </div>
              </div>
              
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl">
                <p className="text-xs text-zinc-500 mb-2">¿No puedes escanear? Ingresa manualmente:</p>
                <div className="flex items-center gap-2">
                  <code className={`flex-1 px-2 py-1.5 bg-zinc-800 rounded text-xs font-mono ${showSecret ? 'text-white' : 'text-transparent'}`} style={{ textShadow: showSecret ? 'none' : '0 0 8px rgba(255,255,255,0.5)' }}>
                    {totpSetupData.secret}
                  </code>
                  <button onClick={() => setShowSecret(!showSecret)} className="p-1.5 text-zinc-400 hover:text-white rounded">
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={copySecret} className="p-1.5 text-zinc-400 hover:text-white rounded">
                    {secretCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={closeTOTPModal}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => setTotpStep(2)}
                  className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors"
                >
                  Ya lo escaneé
                </button>
              </div>
            </div>
          )}
          
          {totpStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 rounded-full mb-4">
                  <Key className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Verifica la Configuración</h3>
                <p className="text-sm text-zinc-400">
                  Ingresa el código de 6 dígitos de tu app
                </p>
              </div>
              
              {totpError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {totpError}
                </div>
              )}
              
              <div className="flex justify-center gap-2">
                {totpCode.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => { totpInputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleTOTPCodeChange(index, e.target.value)}
                    onKeyDown={e => handleTOTPKeyDown(index, e)}
                    disabled={totpLoading}
                    className={`w-11 h-13 text-center text-xl font-bold rounded-lg border-2 transition-all
                      ${digit ? 'border-purple-500 bg-purple-500/10' : 'border-zinc-700 bg-zinc-800'}
                      ${totpLoading ? 'opacity-50' : 'focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20'}
                      text-white outline-none`}
                  />
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setTotpStep(1)}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
                >
                  Atrás
                </button>
                <button
                  onClick={() => verifyTOTPCode()}
                  disabled={totpLoading || totpCode.join('').length !== 6}
                  className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {totpLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Verificar'}
                </button>
              </div>
            </div>
          )}
          
          {totpStep === 3 && totpSetupData && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/20 rounded-full mb-4">
                  <ShieldCheck className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">¡Configuración Exitosa!</h3>
                <p className="text-sm text-zinc-400">
                  Guarda estos códigos de respaldo en un lugar seguro
                </p>
              </div>
              
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-400">
                    Si pierdes acceso a tu app, necesitarás estos códigos. Cada uno solo puede usarse una vez.
                  </p>
                </div>
              </div>
              
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-500">Códigos de respaldo</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadBackupCodes(totpSetupData.backupCodes)}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      <Download className="w-3 h-3" />
                      Descargar
                    </button>
                    <button
                      onClick={() => copyBackupCodes(totpSetupData.backupCodes)}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {backupCodesCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {backupCodesCopied ? 'Copiados' : 'Copiar'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {totpSetupData.backupCodes.map((code, i) => (
                    <code key={i} className="px-2 py-1.5 bg-zinc-800 rounded text-xs font-mono text-zinc-300 text-center">
                      {code}
                    </code>
                  ))}
                </div>
              </div>
              
              <button
                onClick={finishTOTPSetup}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
              >
                He guardado mis códigos
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* ==================== DISABLE MODAL ==================== */}
      <Modal isOpen={showDisableModal} onClose={closeDisableModal}>
        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
              <ShieldOff className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Desactivar {disableMethod === 'telegram' ? 'Telegram' : 'App Autenticador'}
            </h3>
            <p className="text-sm text-zinc-400">
              Confirma tu contraseña para desactivar este método de MFA
            </p>
          </div>
          
          {disableError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {disableError}
            </div>
          )}
          
          <input
            type="password"
            value={disablePassword}
            onChange={e => setDisablePassword(e.target.value)}
            placeholder="Tu contraseña"
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
            autoFocus
          />
          
          <div className="flex gap-3">
            <button
              onClick={closeDisableModal}
              className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleDisable}
              disabled={disableLoading || !disablePassword}
              className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {disableLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Desactivar'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== BACKUP CODES MODAL ==================== */}
      <Modal isOpen={showBackupCodesModal} onClose={closeBackupCodesModal}>
        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/20 rounded-full mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Códigos de Respaldo</h3>
            <p className="text-sm text-zinc-400">
              {regeneratedCodes 
                ? 'Guarda estos nuevos códigos en un lugar seguro'
                : 'Regenerar códigos invalidará los anteriores'
              }
            </p>
          </div>
          
          {!regeneratedCodes ? (
            <>
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl text-center">
                <p className="text-sm text-zinc-400 mb-1">Códigos restantes</p>
                <p className="text-3xl font-bold text-white">{status?.backupCodesStatus?.remaining ?? 0}</p>
                <p className="text-xs text-zinc-500 mt-1">de 8 códigos</p>
              </div>
              
              {regenerateError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {regenerateError}
                </div>
              )}
              
              <input
                type="password"
                value={regeneratePassword}
                onChange={e => setRegeneratePassword(e.target.value)}
                placeholder="Tu contraseña para regenerar"
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
              />
              
              <div className="flex gap-3">
                <button
                  onClick={closeBackupCodesModal}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
                >
                  Cerrar
                </button>
                <button
                  onClick={regenerateBackupCodes}
                  disabled={regenerateLoading || !regeneratePassword}
                  className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
                >
                  {regenerateLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Regenerar'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-zinc-500">Nuevos códigos</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadBackupCodes(regeneratedCodes)}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
                    >
                      <Download className="w-3 h-3" />
                      Descargar
                    </button>
                    <button
                      onClick={() => copyBackupCodes(regeneratedCodes)}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                    >
                      {backupCodesCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {backupCodesCopied ? 'Copiados' : 'Copiar'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {regeneratedCodes.map((code, i) => (
                    <code key={i} className="px-2 py-1.5 bg-zinc-800 rounded text-xs font-mono text-zinc-300 text-center">
                      {code}
                    </code>
                  ))}
                </div>
              </div>
              
              <button
                onClick={closeBackupCodesModal}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors"
              >
                He guardado mis códigos
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

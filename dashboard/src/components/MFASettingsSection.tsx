// MFA Settings Component for MySettingsPage - Multi-Method Support with Modals
import { useState, useEffect } from 'react';
import { 
  Shield, Smartphone, Trash2, Loader2, Check, AlertTriangle, Clock,
  ShieldCheck, ShieldOff, AlertCircle, QrCode, Copy, Star, Plus, Download, Send, Key
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { TelegramMFAModal, TOTPMFAModal, Modal } from './MFAModals';

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

// Download backup codes
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
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);

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

  // Handler when MFA setup completes (from shared modals)
  const handleMFASetupSuccess = () => {
    loadStatus();
  };

  const copyBackupCodes = async (codes: string[]) => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setBackupCodesCopied(true);
      setTimeout(() => setBackupCodesCopied(false), 2000);
    } catch {}
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
      // Both methods use DELETE with password
      const endpoint = disableMethod === 'totp' 
        ? '/api/auth/mfa/totp' 
        : '/api/auth/mfa/telegram';
      
      const res = await fetch(endpoint, {
        method: 'DELETE',
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
    } catch {
      
    }
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
                <h3 className="text-lg font-semibold text-zinc-50">Autenticación de Dos Factores</h3>
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
                    <span className="text-sm font-medium text-zinc-50">Telegram</span>
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
                        className="text-xs text-zinc-400 hover:text-zinc-50 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
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
                    onClick={() => setShowTelegramModal(true)}
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
                    <span className="text-sm font-medium text-zinc-50">App Autenticador</span>
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
                      className="text-xs text-zinc-400 hover:text-zinc-50 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                    >
                      Códigos
                    </button>
                    {hasTelegram && status?.preferredMethod !== 'totp' && (
                      <button
                        onClick={() => setPreferredMethod('totp')}
                        className="text-xs text-zinc-400 hover:text-zinc-50 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
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
                    onClick={() => setShowTOTPModal(true)}
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
                <h4 className="text-sm font-medium text-zinc-50">Dispositivos de Confianza</h4>
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

      {/* ==================== SHARED MFA MODALS ==================== */}
      <TelegramMFAModal
        isOpen={showTelegramModal}
        onClose={() => setShowTelegramModal(false)}
        onSuccess={handleMFASetupSuccess}
      />
      
      <TOTPMFAModal
        isOpen={showTOTPModal}
        onClose={() => setShowTOTPModal(false)}
        onSuccess={handleMFASetupSuccess}
      />

      {/* ==================== DISABLE MODAL ==================== */}
      <Modal isOpen={showDisableModal} onClose={closeDisableModal}>
        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
              <ShieldOff className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-50 mb-2">
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
            className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500"
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
              className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-zinc-50 font-medium rounded-xl transition-colors disabled:opacity-50"
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
            <h3 className="text-xl font-semibold text-zinc-50 mb-2">Códigos de Respaldo</h3>
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
                <p className="text-3xl font-bold text-zinc-50">{status?.backupCodesStatus?.remaining ?? 0}</p>
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
                className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500"
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
                  className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-zinc-50 font-medium rounded-xl transition-colors disabled:opacity-50"
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
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-zinc-50 font-medium rounded-xl transition-colors"
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

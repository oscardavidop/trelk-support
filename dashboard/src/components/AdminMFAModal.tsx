// Admin MFA Management Modal Component
import { useState, useEffect } from 'react';
import { 
  X, Shield, ShieldCheck, ShieldOff, Loader2, AlertTriangle, 
  CheckCircle2, Clock, Smartphone, RefreshCw, Send, QrCode, Star
} from 'lucide-react';
import type { Agent } from '../types';

type MFAMethod = 'telegram' | 'totp';

interface Props {
  agent: Agent;
  onClose: () => void;
  onUpdate: (updatedFields: Partial<Agent>) => void;
  token: string | null;
}

interface MFAAdminStatus {
  enabled: boolean;
  methods: { telegram: boolean; totp: boolean };
  preferredMethod?: MFAMethod;
  verifiedAt?: string;
  enforcedByAdmin?: boolean;
  bypassUntil?: string;
  disabledAt?: string;
  disabledBy?: { name: string };
  trustedDevicesCount: number;
  totpConfigured?: boolean;
  backupCodesStatus?: { total: number; used: number; remaining: number };
}

export default function AdminMFAModal({ agent, onClose, onUpdate, token }: Props) {
  const [status, setStatus] = useState<MFAAdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Bypass form
  const [showBypassForm, setShowBypassForm] = useState(false);
  const [bypassDays, setBypassDays] = useState(7);
  const [bypassReason, setBypassReason] = useState('');

  // Load agent's MFA status
  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        // The endpoint returns { ok, mfa: {...} }
        setStatus(data.mfa);
      } else {
        setError(data.error || 'Error al cargar estado MFA');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, [agent._id]);

  // Force Enable MFA
  const handleForceEnable = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/enable`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Activado por administrador' }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('MFA forzado exitosamente. El agente deberá verificar en su próximo login.');
        onUpdate({ mfaEnabled: true, mfaEnforcedByAdmin: true });
        loadStatus();
      } else {
        setError(data.error || 'Error al forzar MFA');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  // Disable MFA
  const handleDisable = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/disable`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Desactivado por administrador' }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('MFA desactivado exitosamente');
        onUpdate({ mfaEnabled: false, mfaEnforcedByAdmin: false });
        loadStatus();
      } else {
        setError(data.error || 'Error al desactivar MFA');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  // Grant Bypass
  const handleGrantBypass = async () => {
    if (!bypassReason.trim()) {
      setError('Debes proporcionar una razón para el bypass');
      return;
    }
    
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/bypass`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ days: bypassDays, reason: bypassReason }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Bypass concedido por ${bypassDays} días`);
        setShowBypassForm(false);
        setBypassReason('');
        loadStatus();
      } else {
        setError(data.error || 'Error al conceder bypass');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  // Set Preferred Method
  const handleSetPreferredMethod = async (method: MFAMethod) => {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/preferred-method`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ method }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Método preferido establecido: ${method === 'telegram' ? 'Telegram' : 'App Autenticador'}`);
        loadStatus();
      } else {
        setError(data.error || 'Error al establecer método preferido');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke All Trusted Devices
  const handleRevokeTrustedDevices = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/devices`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('Dispositivos de confianza revocados');
        loadStatus();
      } else {
        setError(data.error || 'Error al revocar dispositivos');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${status?.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
              {status?.enabled ? <ShieldCheck className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Gestión MFA</h2>
              <p className="text-xs text-zinc-400">{agent.name} &lt;{agent.email}&gt;</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Status Overview */}
              <div className={`p-4 rounded-xl border ${status?.enabled ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-800/50 border-zinc-700'}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-zinc-300 font-medium">Estado Actual</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    status?.enabled 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : 'bg-zinc-700 text-zinc-400 border border-zinc-600'
                  }`}>
                    {status?.enabled ? 'Activado' : 'Desactivado'}
                  </span>
                </div>
                
                {status?.enabled && (
                  <div className="space-y-2 text-xs text-zinc-400">
                    <p>
                      <span className="text-zinc-500">Activado desde:</span>{' '}
                      {status.verifiedAt ? new Date(status.verifiedAt).toLocaleString() : 'Fecha desconocida'}
                    </p>
                    {status.enforcedByAdmin && (
                      <p className="text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Forzado por administrador
                      </p>
                    )}
                    <p>
                      <span className="text-zinc-500">Dispositivos confianza:</span>{' '}
                      {status.trustedDevicesCount || 0}
                    </p>
                  </div>
                )}
                
                {!status?.enabled && status?.disabledAt && (
                  <div className="text-xs text-zinc-400 space-y-1">
                    <p>
                      <span className="text-zinc-500">Desactivado:</span>{' '}
                      {new Date(status.disabledAt).toLocaleString()}
                    </p>
                    {status.disabledBy && (
                      <p>
                        <span className="text-zinc-500">Por:</span>{' '}
                        {status.disabledBy.name}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* MFA Methods */}
              {status?.enabled && (status?.methods?.telegram || status?.methods?.totp || status?.totpConfigured) && (
                <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium mb-3">Métodos Configurados</p>
                  <div className="space-y-2">
                    {/* Telegram Method */}
                    {status.methods?.telegram && (
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${
                        status.preferredMethod === 'telegram' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-zinc-900/50 border-zinc-700'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${status.preferredMethod === 'telegram' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-400'}`}>
                            <Send className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-sm text-zinc-200">Telegram</span>
                            {status.preferredMethod === 'telegram' && (
                              <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                <Star className="w-3 h-3" /> Preferido
                              </span>
                            )}
                          </div>
                        </div>
                        {status.preferredMethod !== 'telegram' && status.methods?.totp && (
                          <button
                            onClick={() => handleSetPreferredMethod('telegram')}
                            disabled={actionLoading}
                            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
                          >
                            Hacer preferido
                          </button>
                        )}
                      </div>
                    )}
                    
                    {/* TOTP Method */}
                    {(status.methods?.totp || status.totpConfigured) && (
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${
                        status.preferredMethod === 'totp' ? 'bg-purple-500/10 border-purple-500/30' : 'bg-zinc-900/50 border-zinc-700'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${status.preferredMethod === 'totp' ? 'bg-purple-500/20 text-purple-400' : 'bg-zinc-800 text-zinc-400'}`}>
                            <QrCode className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-sm text-zinc-200">App Autenticador</span>
                            {status.preferredMethod === 'totp' && (
                              <span className="ml-2 text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                                <Star className="w-3 h-3" /> Preferido
                              </span>
                            )}
                            {status.backupCodesStatus && (
                              <span className="ml-2 text-[10px] text-zinc-500">
                                {status.backupCodesStatus.remaining}/{status.backupCodesStatus.total} códigos respaldo
                              </span>
                            )}
                          </div>
                        </div>
                        {status.preferredMethod !== 'totp' && status.methods?.telegram && (
                          <button
                            onClick={() => handleSetPreferredMethod('totp')}
                            disabled={actionLoading}
                            className="text-xs text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
                          >
                            Hacer preferido
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bypass Status */}
              {status?.bypassUntil && new Date(status.bypassUntil) > new Date() && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-300 font-medium">Bypass Activo</p>
                    <p className="text-xs text-blue-400/80">
                      Hasta: {new Date(status.bypassUntil).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Error/Success Messages */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  {success}
                </div>
              )}

              {/* Bypass Form */}
              {showBypassForm && (
                <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl space-y-4">
                  <h4 className="text-sm font-medium text-white">Conceder Bypass Temporal</h4>
                  
                  <div>
                    <label className="text-xs text-zinc-400 mb-2 block">Duración (días)</label>
                    <select
                      value={bypassDays}
                      onChange={e => setBypassDays(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value={1}>1 día</option>
                      <option value={3}>3 días</option>
                      <option value={7}>7 días</option>
                      <option value={14}>14 días</option>
                      <option value={30}>30 días</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-zinc-400 mb-2 block">Razón del bypass *</label>
                    <input
                      type="text"
                      value={bypassReason}
                      onChange={e => setBypassReason(e.target.value)}
                      placeholder="Ej: Teléfono perdido, problema con Telegram..."
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 text-sm placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setShowBypassForm(false); setBypassReason(''); }}
                      className="flex-1 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleGrantBypass}
                      disabled={actionLoading || !bypassReason.trim()}
                      className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Conceder'}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              {!showBypassForm && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Acciones Administrativas</p>
                  
                  {!agent.telegramId ? (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-amber-400 text-sm">
                      <AlertTriangle className="w-4 h-4" />
                      El agente no tiene Telegram vinculado
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {!status?.enabled ? (
                        <button
                          onClick={handleForceEnable}
                          disabled={actionLoading}
                          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ShieldCheck className="w-4 h-4" />
                          )}
                          Forzar MFA
                        </button>
                      ) : (
                        <button
                          onClick={handleDisable}
                          disabled={actionLoading}
                          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                          {actionLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ShieldOff className="w-4 h-4" />
                          )}
                          Desactivar
                        </button>
                      )}
                      
                      <button
                        onClick={() => setShowBypassForm(true)}
                        disabled={actionLoading || !status?.enabled}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <Clock className="w-4 h-4" />
                        Bypass
                      </button>
                      
                      {status?.enabled && status.trustedDevicesCount > 0 && (
                        <button
                          onClick={handleRevokeTrustedDevices}
                          disabled={actionLoading}
                          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 col-span-2"
                        >
                          <Smartphone className="w-4 h-4" />
                          Revocar dispositivos ({status.trustedDevicesCount})
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
          <button
            onClick={loadStatus}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

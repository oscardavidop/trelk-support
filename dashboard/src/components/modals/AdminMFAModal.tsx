/* eslint-disable react-hooks/exhaustive-deps */
/**
 * AdminMFAModal - Premium Zinc Refactor
 * Administrative panel for managing user MFA settings
 */

import { useState, useEffect } from 'react';
import { 
  X, Shield, ShieldCheck, ShieldOff, Loader2, AlertTriangle, 
  CheckCircle2, Clock, Smartphone, RefreshCw, Send, QrCode, Star,
  History, Lock, Unlock, Calendar
} from 'lucide-react';
import type { Agent } from '../../types';

// --- Types ---

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

// --- Component ---

export default function AdminMFAModal({ agent, onClose, onUpdate, token }: Props) {
  const [status, setStatus] = useState<MFAAdminStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Bypass form state
  const [showBypassForm, setShowBypassForm] = useState(false);
  const [bypassDays, setBypassDays] = useState(7);
  const [bypassReason, setBypassReason] = useState('');

  // --- Logic ---

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
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

  // Actions
  const handleForceEnable = async () => {
    setActionLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Activado por administrador' }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('MFA forzado exitosamente.');
        onUpdate({ mfaEnabled: true, mfaEnforcedByAdmin: true });
        loadStatus();
      } else setError(data.error);
    } catch { setError('Error de conexión'); } finally { setActionLoading(false); }
  };

  const handleDisable = async () => {
    setActionLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Desactivado por administrador' }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess('MFA desactivado exitosamente.');
        onUpdate({ mfaEnabled: false, mfaEnforcedByAdmin: false });
        loadStatus();
      } else setError(data.error);
    } catch { setError('Error de conexión'); } finally { setActionLoading(false); }
  };

  const handleGrantBypass = async () => {
    if (!bypassReason.trim()) return setError('Razón requerida para el bypass');
    setActionLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/bypass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ days: bypassDays, reason: bypassReason }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(`Bypass concedido por ${bypassDays} días.`);
        setShowBypassForm(false); setBypassReason('');
        loadStatus();
      } else setError(data.error);
    } catch { setError('Error de conexión'); } finally { setActionLoading(false); }
  };

  const handleRevokeTrustedDevices = async () => {
    setActionLoading(true); setError('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/devices`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if ((await res.json()).ok) {
        setSuccess('Dispositivos revocados.');
        loadStatus();
      } else setError('Error al revocar dispositivos');
    } catch { setError('Error de conexión'); } finally { setActionLoading(false); }
  };

  // --- Render ---

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${status?.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
              {status?.enabled ? <ShieldCheck className="w-5 h-5" /> : <ShieldOff className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Gestión de Seguridad MFA</h2>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="font-medium text-zinc-300">{agent.name}</span>
                <span>•</span>
                <span className="font-mono">{agent.email}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => loadStatus()}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
              title="Recargar datos"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={onClose} 
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Scrollable Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-sm text-zinc-500">Obteniendo estado de seguridad...</p>
            </div>
          ) : (
            <>
              {/* Messages */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm animate-in slide-in-from-top-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}
              {success && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-sm animate-in slide-in-from-top-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
                </div>
              )}

              {/* Main Status Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Current Status Card */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-zinc-500 uppercase r">Estado de la cuenta</p>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${status?.enabled ? 'text-emerald-400' : 'text-zinc-400'}`}>
                      {status?.enabled ? 'Autenticación Activada' : 'No configurado'}
                    </span>
                    {status?.enabled && (
                      <span className="p-1 bg-emerald-500/10 rounded-full">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      </span>
                    )}
                  </div>

                  {/* Metadata List */}
                  <div className="space-y-2 pt-2 border-t border-zinc-800/50">
                    {status?.enabled ? (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">Activado:</span>
                          <span className="text-zinc-300 font-mono">
                            {status.verifiedAt ? new Date(status.verifiedAt).toLocaleDateString() : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">Dispositivos:</span>
                          <span className="text-zinc-300">{status.trustedDevicesCount} confiables</span>
                        </div>
                        {status.enforcedByAdmin && (
                          <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/5 p-1.5 rounded-lg mt-1">
                            <Lock className="w-3 h-3" /> Forzado por política admin
                          </div>
                        )}
                      </>
                    ) : (
                      status?.disabledAt && (
                        <div className="flex justify-between text-xs">
                          <span className="text-zinc-500">Desactivado:</span>
                          <span className="text-zinc-400">
                            {new Date(status.disabledAt).toLocaleDateString()}
                            {status.disabledBy && ` por ${status.disabledBy.name}`}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Methods Card */}
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-zinc-500 uppercase r">Métodos Disponibles</p>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Send className={`w-3.5 h-3.5 ${status?.methods?.telegram ? 'text-blue-400' : 'text-zinc-600'}`} />
                        <span className={status?.methods?.telegram ? 'text-zinc-200' : 'text-zinc-600'}>Telegram</span>
                      </div>
                      {status?.methods?.telegram && (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          {status.preferredMethod === 'telegram' && <Star className="w-3 h-3 text-amber-400 fill-current" />}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <QrCode className={`w-3.5 h-3.5 ${status?.methods?.totp ? 'text-purple-400' : 'text-zinc-600'}`} />
                        <span className={status?.methods?.totp ? 'text-zinc-200' : 'text-zinc-600'}>App Autenticador</span>
                      </div>
                      {status?.methods?.totp && (
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          {status.preferredMethod === 'totp' && <Star className="w-3 h-3 text-amber-400 fill-current" />}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bypass Alert/Status */}
              {status?.bypassUntil && new Date(status.bypassUntil) > new Date() && (
                <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                    <Unlock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-100">Bypass de Seguridad Activo</h4>
                    <p className="text-xs text-blue-300/70 mt-1">
                      El usuario puede iniciar sesión sin MFA hasta el <span className="text-blue-200">{new Date(status.bypassUntil).toLocaleString()}</span>.
                    </p>
                  </div>
                </div>
              )}

              {/* --- Actions Area --- */}
              <div className="space-y-4 pt-2">
                
                {/* Bypass Form (Toggleable) */}
                {showBypassForm ? (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                    <h4 className="text-sm font-bold text-zinc-200 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" /> Configurar Bypass Temporal
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                      <div className="sm:col-span-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1.5 block">Duración</label>
                        <select
                          value={bypassDays}
                          onChange={e => setBypassDays(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:border-indigo-500 outline-none"
                        >
                          <option value={1}>24 Horas</option>
                          <option value={3}>3 Días</option>
                          <option value={7}>1 Semana</option>
                          <option value={14}>2 Semanas</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase mb-1.5 block">Motivo (Auditoría)</label>
                        <input
                          type="text"
                          value={bypassReason}
                          onChange={e => setBypassReason(e.target.value)}
                          placeholder="Ej: Pérdida de dispositivo"
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setShowBypassForm(false)}
                        className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleGrantBypass}
                        disabled={actionLoading || !bypassReason.trim()}
                        className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        {actionLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                        Confirmar Bypass
                      </button>
                    </div>
                  </div>
                ) : (
                  // Action Buttons Toolbar
                  <div className="flex flex-wrap gap-2">
                    {!status?.enabled ? (
                      <button
                        onClick={handleForceEnable}
                        disabled={actionLoading || !agent.telegramId}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase  transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Forzar Activación
                      </button>
                    ) : (
                      <button
                        onClick={handleDisable}
                        disabled={actionLoading}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold uppercase  transition-all disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                        Desactivar MFA
                      </button>
                    )}

                    <button
                      onClick={() => setShowBypassForm(true)}
                      disabled={actionLoading || !status?.enabled}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-bold uppercase  transition-all disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" />
                      Otorgar Bypass
                    </button>

                    {status?.enabled && status.trustedDevicesCount > 0 && (
                      <button
                        onClick={handleRevokeTrustedDevices}
                        disabled={actionLoading}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-bold uppercase  transition-all disabled:opacity-50"
                      >
                        <Smartphone className="w-4 h-4" />
                        Revocar Dispositivos
                      </button>
                    )}
                  </div>
                )}
                
                {!agent.telegramId && (
                  <p className="text-center text-xs text-amber-500 mt-2">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    El usuario debe vincular su Telegram antes de poder forzar MFA.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
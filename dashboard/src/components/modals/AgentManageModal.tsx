
import React, { useCallback, useEffect, useState } from 'react';
import { Eye, Edit3, Key, Shield, Monitor, Settings, Users, MessageSquare, Star, Clock, Activity, ShieldCheck, Lock, CheckCircle, AlertCircle, Smartphone, Tablet, 
    Loader2,
    X,
    Send,
    AlertTriangle,
    ShieldOff,
    Globe,
    Unlock,
    UserX,
    UserCheck,
    LogOut,
    Trash2, 
 } from 'lucide-react';
import { roleLabels, type Agent, type OnlineStatus } from "../../types";
import { useAuthStore } from '../../stores/authStore';
// Agent Management Modal - Comprehensive modal with vertical tabs
type ManageTab = 'overview' | 'edit' | 'password' | 'mfa' | 'sessions' | 'actions';

interface AgentSession {
  _id: string;
  deviceType: string;
  browser: string;
  os: string;
  ip: string;
  location?: string;
  loginAt: string;
  lastSeenAt: string;
  isCurrent: boolean;
}

interface AgentManageModalProps {
  agent: any;
  currentTab: ManageTab;
  isCurrentUser: boolean;
  isLocked: boolean;
  sessions: AgentSession[];
  sessionsLoading: boolean;
  isOnline: boolean;
  onTabChange: (tab: ManageTab) => void;
  onClose: () => void;
  onSaveAgent: (data: any) => Promise<void>;
  onResetPassword: () => Promise<void>;
  onToggleActive: () => void;
  onLock: () => void;
  onUnlock: () => void;
  onDelete: () => void;
  onViewSessions: () => void;
  onInvalidateSession: (sessionId: string) => void;
  onInvalidateAll: () => void;
  onForceLogout: () => void;
  onAgentUpdated: () => void;
  onSendNotification?: () => void;
}

const roleColors: Record<string, string> = {
  support: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  junior: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  supervisor: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  admin: "bg-amber-500/20 text-amber-400 border-amber-500/30",
};

const statusColors: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-yellow-500",
  away: "bg-orange-500",
  offline: "bg-gray-500",
};

const statusLabels: Record<string, string> = {
  available: "Disponible",
  busy: "Ocupado",
  away: "Ausente",
  offline: "Desconectado",
};

export function AgentManageModal({
  agent,
  currentTab,
  isCurrentUser,
  isLocked,
  sessions,
  sessionsLoading,
  isOnline,
  onTabChange,
  onClose,
  onSaveAgent,
  onResetPassword,
  onToggleActive,
  onLock,
  onUnlock,
  onDelete,
  onViewSessions,
  onInvalidateSession,
  onInvalidateAll,
  onForceLogout,
  onAgentUpdated,
  onSendNotification,
}: AgentManageModalProps) {
  const token = useAuthStore.getState().token;
  const isActive = agent.isActive !== false;
  const status: OnlineStatus = (agent.onlineStatus as OnlineStatus) || "offline";
  
  // Edit form state
  const [editForm, setEditForm] = useState({
    name: agent.name || '',
    email: agent.email || '',
    role: agent.role || 'support',
    maxConcurrentChats: agent.maxConcurrentChats || 5,
    skills: agent.skills || [],
    department: agent.department || '',
  });
  const [skillInput, setSkillInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Password reset state
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'link' | 'generate'>('link');
  const [passwordResult, setPasswordResult] = useState<{ success: boolean; message: string } | null>(null);

  // MFA state
  const [mfaStatus, setMfaStatus] = useState<any>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaActionLoading, setMfaActionLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');
  const [showBypassForm, setShowBypassForm] = useState(false);
  const [bypassDays, setBypassDays] = useState(7);
  const [bypassReason, setBypassReason] = useState('');

  // Telegram linking state
  const [telegramInput, setTelegramInput] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<'idle' | 'linking' | 'unlinking' | 'success' | 'error'>('idle');
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [currentTelegramId, setCurrentTelegramId] = useState<string | null>(agent.telegramId || null);
  const [currentTelegramUsername, setCurrentTelegramUsername] = useState<string | null>(agent.telegramUsername || null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'deactivate' | 'delete' | 'lock' | 'unlock' | null; open: boolean }>({ type: null, open: false });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const tabs: { id: ManageTab; label: string; icon: React.ElementType; danger?: boolean; hideForCurrentUser?: boolean }[] = [
    { id: 'overview', label: 'General', icon: Eye },
    { id: 'edit', label: 'Editar', icon: Edit3 },
    { id: 'password', label: 'Contraseña', icon: Key },
    { id: 'mfa', label: 'MFA', icon: Shield },
    { id: 'sessions', label: 'Sesiones', icon: Monitor, hideForCurrentUser: true },
    { id: 'actions', label: 'Acciones', icon: Settings, hideForCurrentUser: true },
  ];

  const visibleTabs = tabs.filter(tab => !tab.hideForCurrentUser || !isCurrentUser);
  const loadMfaStatus = useCallback(async () => {
    setMfaLoading(true);
    setMfaError('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setMfaStatus(data.mfa);
      } else {
        setMfaError(data.error || 'Error al cargar estado MFA');
      }
    } catch {
      setMfaError('Error de conexión');
    } finally {
      setMfaLoading(false);
    }
  }, [agent._id, token]);
  // Load MFA status when tab changes
  useEffect(() => {
    if (currentTab === 'mfa') {
      loadMfaStatus();
    }
  }, [currentTab, loadMfaStatus]);

  // Load sessions when tab changes
  useEffect(() => {
    if (currentTab === 'sessions') {
      onViewSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  // Sync telegram state
  useEffect(() => {
    setCurrentTelegramId(agent.telegramId || null);
    setCurrentTelegramUsername(agent.telegramUsername || null);
  }, [agent]);

  // MFA Actions
  const handleMfaForceEnable = async () => {
    setMfaActionLoading(true);
    setMfaError('');
    setMfaSuccess('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/enable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Activado por administrador' }),
      });
      const data = await res.json();
      if (data.ok) {
        setMfaSuccess('MFA forzado exitosamente.');
        loadMfaStatus();
        onAgentUpdated();
      } else {
        setMfaError(data.error || 'Error al activar MFA');
      }
    } catch {
      setMfaError('Error de conexión');
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleMfaDisable = async () => {
    setMfaActionLoading(true);
    setMfaError('');
    setMfaSuccess('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: 'Desactivado por administrador' }),
      });
      const data = await res.json();
      if (data.ok) {
        setMfaSuccess('MFA desactivado exitosamente.');
        loadMfaStatus();
        onAgentUpdated();
      } else {
        setMfaError(data.error || 'Error al desactivar MFA');
      }
    } catch {
      setMfaError('Error de conexión');
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleMfaGrantBypass = async () => {
    if (!bypassReason.trim()) {
      setMfaError('Motivo requerido para el bypass');
      return;
    }
    setMfaActionLoading(true);
    setMfaError('');
    setMfaSuccess('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/bypass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ days: bypassDays, reason: bypassReason }),
      });
      const data = await res.json();
      if (data.ok) {
        setMfaSuccess(`Bypass concedido por ${bypassDays} días.`);
        setShowBypassForm(false);
        setBypassReason('');
        loadMfaStatus();
      } else {
        setMfaError(data.error || 'Error al conceder bypass');
      }
    } catch {
      setMfaError('Error de conexión');
    } finally {
      setMfaActionLoading(false);
    }
  };

  const handleMfaRevokeTrustedDevices = async () => {
    setMfaActionLoading(true);
    setMfaError('');
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/mfa/devices`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setMfaSuccess('Dispositivos revocados.');
        loadMfaStatus();
      } else {
        setMfaError('Error al revocar dispositivos');
      }
    } catch {
      setMfaError('Error de conexión');
    } finally {
      setMfaActionLoading(false);
    }
  };

  // Telegram actions
  const handleLinkTelegram = async () => {
    if (!telegramInput.trim()) return;
    const telegramIdNum = parseInt(telegramInput.trim(), 10);
    if (isNaN(telegramIdNum) || telegramIdNum <= 0) {
      setTelegramError('El ID de Telegram debe ser un número válido');
      return;
    }
    setTelegramStatus('linking');
    setTelegramError(null);
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ telegramId: telegramIdNum }),
      });
      const data = await res.json();
      if (data.ok) {
        setTelegramStatus('success');
        setCurrentTelegramId(telegramInput.trim());
        setTelegramInput('');
        onAgentUpdated();
        setTimeout(() => setTelegramStatus('idle'), 2000);
      } else {
        setTelegramStatus('error');
        setTelegramError(data.error || 'Error al vincular Telegram');
      }
    } catch {
      setTelegramStatus('error');
      setTelegramError('Error de conexión');
    }
  };

  const handleUnlinkTelegram = async () => {
    setTelegramStatus('unlinking');
    setTelegramError(null);
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/telegram`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setTelegramStatus('success');
        setCurrentTelegramId(null);
        setCurrentTelegramUsername(null);
        onAgentUpdated();
        setTimeout(() => setTelegramStatus('idle'), 2000);
      } else {
        setTelegramStatus('error');
        setTelegramError(data.error || 'Error al desvincular');
      }
    } catch {
      setTelegramStatus('error');
      setTelegramError('Error de conexión');
    }
  };

  // Save edit form
  const handleSaveEdit = async () => {
    if (!editForm.name.trim() || !editForm.email.trim()) return;
    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await onSaveAgent(editForm);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      setSaveError(error.message || 'Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset password - Generate temporary
  const handleResetPassword = async () => {
    setPasswordResetLoading(true);
    setPasswordResult(null);
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setPasswordResult({
          success: true,
          message: 'Contraseña temporal generada y enviada por Telegram',
        });
      } else {
        setPasswordResult({
          success: false,
          message: data.error || 'Error al generar contraseña',
        });
      }
    } catch (error) {
      setPasswordResult({ success: false, message: 'Error de conexión' });
    } finally {
      setPasswordResetLoading(false);
    }
  };

  // Reset password - Send link
  const handleSendResetLink = async () => {
    setPasswordResetLoading(true);
    setPasswordResult(null);
    try {
      const res = await fetch(`/api/admin/agents/${agent._id}/send-password-reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.ok) {
        setPasswordResult({
          success: true,
          message: data.message || 'Enlace enviado por Telegram',
        });
      } else {
        setPasswordResult({
          success: false,
          message: data.error || 'Error al enviar enlace',
        });
      }
    } catch {
      setPasswordResult({ success: false, message: 'Error de conexión' });
    } finally {
      setPasswordResetLoading(false);
    }
  };

  // Add/remove skill
  const addSkill = () => {
    if (skillInput.trim() && !editForm.skills.includes(skillInput.trim())) {
      setEditForm({ ...editForm, skills: [...editForm.skills, skillInput.trim()] });
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setEditForm({ ...editForm, skills: editForm.skills.filter((s: string) => s !== skill) });
  };

  // Device icon helper
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile': return Smartphone;
      case 'tablet': return Tablet;
      default: return Monitor;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  // Confirm action handler
  const handleConfirmAction = async () => {
    setConfirmLoading(true);
    try {
      switch (confirmDialog.type) {
        case 'deactivate':
          onToggleActive();
          break;
        case 'delete':
          onDelete();
          break;
        case 'lock':
          onLock();
          break;
        case 'unlock':
          onUnlock();
          break;
      }
      setConfirmDialog({ type: null, open: false });
    } finally {
      setConfirmLoading(false);
    }
  };

  const renderTabContent = () => {
    switch (currentTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Agent Info Card */}
            <div className="flex items-center gap-4 p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
              <div className="relative shrink-0">
                {agent.avatar ? (
                  <img src={agent.avatar} alt={agent.name} className="w-16 h-16 rounded-full bg-zinc-800 object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-600/50 flex items-center justify-center text-xl font-bold text-white">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-zinc-900 ${statusColors[status]}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white truncate">{agent.name}</h3>
                  {isCurrentUser && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/30 font-medium">TÚ</span>
                  )}
                </div>
                <p className="text-sm text-zinc-400 truncate">{agent.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium uppercase ${roleColors[agent.role]}`}>
                    {roleLabels[agent.role] || agent.role}
                  </span>
                  {agent.department && (
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      <Users className="w-3 h-3 text-zinc-500" />
                      {agent.department}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50 text-center">
                <MessageSquare className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{agent.activeChats || 0}</div>
                <div className="text-xs text-zinc-500">Chats Activos</div>
              </div>
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50 text-center">
                <Star className="w-5 h-5 text-amber-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{agent.metrics?.averageRating?.toFixed(1) || '-'}</div>
                <div className="text-xs text-zinc-500">Rating</div>
              </div>
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50 text-center">
                <Clock className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <div className="text-2xl font-bold text-white">{agent.avgResponseTime || '-'}</div>
                <div className="text-xs text-zinc-500">Tiempo Resp.</div>
              </div>
            </div>

            {/* Status Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
                  <Activity className="w-4 h-4" />
                  Estado de conexión
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusColors[status]}`}></div>
                  <span className="text-white font-medium capitalize">{statusLabels[status]}</span>
                </div>
              </div>
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                <div className="flex items-center gap-2 text-sm text-zinc-400 mb-1">
                  <Shield className="w-4 h-4" />
                  Seguridad
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {agent.security?.mfa?.enabled ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1 text-sm">
                      <ShieldCheck className="w-4 h-4" />
                      MFA Activo
                    </span>
                  ) : (
                    <span className="text-zinc-500 font-medium text-sm">MFA Deshabilitado</span>
                  )}
                  {isLocked && (
                    <span className="text-amber-400 font-medium flex items-center gap-1 text-sm">
                      <Lock className="w-4 h-4" />
                      Bloqueado
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Skills */}
            {agent.skills?.length > 0 && (
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                <div className="text-sm text-zinc-400 mb-2">Habilidades</div>
                <div className="flex flex-wrap gap-2">
                  {agent.skills.map((skill: string) => (
                    <span key={skill} className="px-2 py-1 bg-zinc-700/50 border border-zinc-600/50 text-zinc-300 rounded-lg text-xs">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'edit':
        return (
          <div className="space-y-5">
            {saveSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle className="w-4 h-4" />
                Cambios guardados exitosamente
              </div>
            )}
            {saveError && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                {saveError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Nombre</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  placeholder="Nombre completo"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Rol</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                >
                  <option value="junior">Junior</option>
                  <option value="support">Agente</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Departamento</label>
                <input
                  type="text"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  placeholder="Departamento"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Chats Máximos Concurrentes</label>
              <input
                type="number"
                value={editForm.maxConcurrentChats}
                onChange={(e) => setEditForm({ ...editForm, maxConcurrentChats: parseInt(e.target.value) || 5 })}
                className="w-32 px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                min={1}
                max={20}
              />
            </div>

            {/* Skills */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-2">Habilidades</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                  placeholder="Agregar habilidad..."
                />
                <button
                  onClick={addSkill}
                  className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl text-sm transition-colors"
                >
                  Agregar
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {editForm.skills.map((skill: string) => (
                  <span key={skill} className="flex items-center gap-1 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-300">
                    {skill}
                    <button onClick={() => removeSkill(skill)} className="text-zinc-500 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Telegram Integration */}
            <div className="border-t border-zinc-800 pt-5">
              <label className="block text-xs font-medium text-zinc-400 mb-2">Telegram</label>
              {currentTelegramId ? (
                <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-zinc-300">
                      ID: {currentTelegramId}
                      {currentTelegramUsername && <span className="text-zinc-500 ml-2">@{currentTelegramUsername}</span>}
                    </span>
                  </div>
                  <button
                    onClick={handleUnlinkTelegram}
                    disabled={telegramStatus === 'unlinking'}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-colors"
                  >
                    {telegramStatus === 'unlinking' ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Desvincular'}
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={telegramInput}
                    onChange={(e) => setTelegramInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50"
                    placeholder="ID de Telegram..."
                  />
                  <button
                    onClick={handleLinkTelegram}
                    disabled={telegramStatus === 'linking' || !telegramInput.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm transition-colors disabled:opacity-50"
                  >
                    {telegramStatus === 'linking' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vincular'}
                  </button>
                </div>
              )}
              {telegramError && <p className="text-xs text-red-400 mt-2">{telegramError}</p>}
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-4 border-t border-zinc-800">
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Guardar cambios
              </button>
            </div>
          </div>
        );

      case 'password': {
        const hasTelegram = !!agent.telegramId;
        return (
          <div className="space-y-5">
            {/* Header */}
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
                <Key className="w-8 h-8 text-indigo-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Restablecer Contraseña</h3>
              <p className="text-zinc-400 text-sm">
                <span className="text-white font-medium">{agent.name}</span>
                {hasTelegram ? (
                  <span className="ml-2 text-emerald-400 text-xs">✓ Telegram vinculado</span>
                ) : (
                  <span className="ml-2 text-amber-400 text-xs">⚠ Sin Telegram</span>
                )}
              </p>
            </div>

            {!passwordResult ? (
              <>
                {/* Mode Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPasswordMode('link')}
                    disabled={!hasTelegram}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      passwordMode === 'link'
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800'
                    } ${!hasTelegram && 'opacity-50 cursor-not-allowed'}`}
                  >
                    <MessageSquare className={`w-5 h-5 mb-2 ${passwordMode === 'link' ? 'text-indigo-400' : 'text-zinc-500'}`} />
                    <p className={`font-medium ${passwordMode === 'link' ? 'text-white' : 'text-zinc-300'}`}>
                      Enviar enlace
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">El agente elige su contraseña</p>
                  </button>
                  <button
                    onClick={() => setPasswordMode('generate')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      passwordMode === 'generate'
                        ? 'border-amber-500 bg-amber-500/10'
                        : 'border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800'
                    }`}
                  >
                    <Key className={`w-5 h-5 mb-2 ${passwordMode === 'generate' ? 'text-amber-400' : 'text-zinc-500'}`} />
                    <p className={`font-medium ${passwordMode === 'generate' ? 'text-white' : 'text-zinc-300'}`}>
                      Generar temporal
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">Contraseña aleatoria</p>
                  </button>
                </div>

                {/* Info Box */}
                <div className="bg-zinc-800/50 rounded-lg p-3 text-sm text-zinc-400">
                  {passwordMode === 'link' ? (
                    <p>Se enviará un enlace seguro por Telegram. El enlace expira en 15 minutos.</p>
                  ) : (
                    <p>Se generará una contraseña temporal y se enviará por Telegram. El agente deberá cambiarla.</p>
                  )}
                </div>

                {/* Action Button */}
                <button
                  onClick={passwordMode === 'link' ? handleSendResetLink : handleResetPassword}
                  disabled={passwordResetLoading || (passwordMode === 'link' && !hasTelegram)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all font-medium shadow-lg ${
                    passwordMode === 'link'
                      ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'
                      : 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                  } text-white disabled:opacity-50`}
                >
                  {passwordResetLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : passwordMode === 'link' ? (
                    <MessageSquare className="w-4 h-4" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  <span>{passwordMode === 'link' ? 'Enviar Enlace' : 'Generar Contraseña'}</span>
                </button>
              </>
            ) : (
              /* Result View */
              <div className="flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in-95 duration-200">
                <div className={`
                  relative w-16 h-16 rounded-full flex items-center justify-center mb-5
                  ${passwordResult.success
                    ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)]'
                    : 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20 shadow-[0_0_30px_rgba(239,68,68,0.15)]'
                  }
                `}>
                  {passwordResult.success ? (
                    <CheckCircle className="w-8 h-8 animate-in zoom-in duration-300" />
                  ) : (
                    <AlertCircle className="w-8 h-8 animate-in zoom-in duration-300" />
                  )}
                </div>

                <h4 className="text-lg font-bold text-white mb-2 tracking-tight">
                  {passwordResult.success ? '¡Operación Exitosa!' : 'Algo salió mal'}
                </h4>

                <p className={`text-sm mb-6 max-w-[260px] leading-relaxed ${
                  passwordResult.success ? 'text-zinc-400' : 'text-red-300/80'
                }`}>
                  {passwordResult.message}
                </p>

                <button
                  onClick={() => setPasswordResult(null)}
                  className="w-full px-6 py-2.5 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-white rounded-xl transition-all font-medium text-xs uppercase"
                >
                  Realizar otra operación
                </button>
              </div>
            )}
          </div>
        );
      }

      case 'mfa':
        return (
          <div className="space-y-4">
            {mfaLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            ) : (
              <>
                {mfaError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {mfaError}
                  </div>
                )}
                {mfaSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    {mfaSuccess}
                  </div>
                )}

                {/* MFA Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                    <p className="text-xs font-bold text-zinc-500 uppercase mb-3">Estado de la cuenta</p>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${mfaStatus?.enabled ? 'text-emerald-400' : 'text-zinc-400'}`}>
                        {mfaStatus?.enabled ? 'MFA Activado' : 'No configurado'}
                      </span>
                      {mfaStatus?.enabled && (
                        <div className="p-1 bg-emerald-500/10 rounded-full">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                        </div>
                      )}
                    </div>
                    {mfaStatus?.enabled && mfaStatus.verifiedAt && (
                      <p className="text-xs text-zinc-500 mt-2">
                        Activado: {new Date(mfaStatus.verifiedAt).toLocaleDateString()}
                      </p>
                    )}
                    {mfaStatus?.enforcedByAdmin && (
                      <div className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 p-1.5 rounded-lg mt-2">
                        <Lock className="w-3 h-3" />
                        Forzado por admin
                      </div>
                    )}
                  </div>

                  <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                    <p className="text-xs font-bold text-zinc-500 uppercase mb-3">Métodos</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Send className={`w-3.5 h-3.5 ${mfaStatus?.methods?.telegram ? 'text-blue-400' : 'text-zinc-600'}`} />
                          <span className={mfaStatus?.methods?.telegram ? 'text-zinc-200' : 'text-zinc-600'}>Telegram</span>
                        </div>
                        {mfaStatus?.methods?.telegram && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Shield className={`w-3.5 h-3.5 ${mfaStatus?.methods?.totp ? 'text-purple-400' : 'text-zinc-600'}`} />
                          <span className={mfaStatus?.methods?.totp ? 'text-zinc-200' : 'text-zinc-600'}>App Auth (TOTP)</span>
                        </div>
                        {mfaStatus?.methods?.totp && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bypass Alert */}
                {mfaStatus?.bypassUntil && new Date(mfaStatus.bypassUntil) > new Date() && (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
                    <Unlock className="w-5 h-5 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-100">Bypass Activo</p>
                      <p className="text-xs text-blue-300/70">
                        Hasta: {new Date(mfaStatus.bypassUntil).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Bypass Form */}
                {showBypassForm ? (
                  <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50 space-y-3">
                    <p className="text-sm font-medium text-zinc-200">Configurar Bypass Temporal</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Duración</label>
                        <select
                          value={bypassDays}
                          onChange={(e) => setBypassDays(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white"
                        >
                          <option value={1}>24 Horas</option>
                          <option value={3}>3 Días</option>
                          <option value={7}>1 Semana</option>
                          <option value={14}>2 Semanas</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-zinc-500 uppercase block mb-1">Motivo</label>
                        <input
                          type="text"
                          value={bypassReason}
                          onChange={(e) => setBypassReason(e.target.value)}
                          placeholder="Ej: Pérdida de dispositivo"
                          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setShowBypassForm(false)} className="px-3 py-1.5 text-zinc-400 hover:text-white text-sm">
                        Cancelar
                      </button>
                      <button
                        onClick={handleMfaGrantBypass}
                        disabled={mfaActionLoading || !bypassReason.trim()}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm disabled:opacity-50"
                      >
                        {mfaActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action Buttons */
                  <div className="flex flex-wrap gap-2">
                    {!mfaStatus?.enabled ? (
                      <button
                        onClick={handleMfaForceEnable}
                        disabled={mfaActionLoading || !agent.telegramId}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                      >
                        {mfaActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        Forzar Activación
                      </button>
                    ) : (
                      <button
                        onClick={handleMfaDisable}
                        disabled={mfaActionLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-sm font-medium disabled:opacity-50"
                      >
                        {mfaActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
                        Desactivar MFA
                      </button>
                    )}
                    <button
                      onClick={() => setShowBypassForm(true)}
                      disabled={mfaActionLoading || !mfaStatus?.enabled}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" />
                      Otorgar Bypass
                    </button>
                    {mfaStatus?.enabled && mfaStatus.trustedDevicesCount > 0 && (
                      <button
                        onClick={handleMfaRevokeTrustedDevices}
                        disabled={mfaActionLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                      >
                        <Smartphone className="w-4 h-4" />
                        Revocar Dispositivos ({mfaStatus.trustedDevicesCount})
                      </button>
                    )}
                  </div>
                )}

                {!agent.telegramId && !mfaStatus?.enabled && (
                  <p className="text-center text-xs text-amber-500">
                    <AlertTriangle className="w-3 h-3 inline mr-1" />
                    El usuario debe vincular Telegram para forzar MFA.
                  </p>
                )}
              </>
            )}
          </div>
        );

      case 'sessions':
        return (
          <div className="space-y-4">
            {/* Online status */}
            <div className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-xl">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'}`} />
                <span className="text-sm text-zinc-300">{isOnline ? 'Agente en línea' : 'Agente desconectado'}</span>
              </div>
              <span className="text-xs text-zinc-500">{sessions.length} sesiones</span>
            </div>

            {/* Sessions list */}
            <div className="max-h-[350px] overflow-y-auto space-y-2">
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8">
                  <Monitor className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No hay sesiones activas</p>
                </div>
              ) : (
                sessions.map((session) => {
                  const DeviceIcon = getDeviceIcon(session.deviceType);
                  return (
                    <div key={session._id} className="flex items-center justify-between p-3 bg-zinc-800/30 border border-zinc-700/50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-zinc-700/50 rounded-lg">
                          <DeviceIcon className="w-4 h-4 text-zinc-300" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white truncate">{session.browser} • {session.os}</span>
                            {session.isCurrent && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-green-500/20 text-green-400 rounded border border-green-500/30">Actual</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Globe className="w-3 h-3" />
                            {session.ip}
                            <span className="mx-1">•</span>
                            {formatDate(session.lastSeenAt)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onInvalidateSession(session._id)}
                        className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Cerrar sesión"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t border-zinc-800">
              {isOnline && (
                <button
                  onClick={onForceLogout}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Forzar cierre
                </button>
              )}
              {sessions.length > 0 && (
                <button
                  onClick={onInvalidateAll}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Cerrar todas
                </button>
              )}
            </div>
          </div>
        );

      case 'actions':
        return (
          <div className="space-y-6">
            {/* Lock/Unlock Session */}
            <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
              <div className="flex items-start gap-3">
                {isLocked ? (
                  <div className="p-2 bg-amber-500/10 rounded-lg">
                    <Lock className="w-5 h-5 text-amber-400" />
                  </div>
                ) : (
                  <div className="p-2 bg-zinc-700/50 rounded-lg">
                    <Unlock className="w-5 h-5 text-zinc-400" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{isLocked ? 'Sesión Bloqueada' : 'Bloquear Sesión'}</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {isLocked 
                      ? 'La sesión del agente está bloqueada. No puede operar hasta que se desbloquee.'
                      : 'Bloquear la sesión mostrará una pantalla de bloqueo al agente.'
                    }
                  </p>
                  <button
                    onClick={() => setConfirmDialog({ type: isLocked ? 'unlock' : 'lock', open: true })}
                    className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isLocked 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                    }`}
                  >
                    {isLocked ? 'Desbloquear sesión' : 'Bloquear sesión'}
                  </button>
                </div>
              </div>
            </div>

            {/* Deactivate Account */}
            <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
              <div className="flex items-start gap-3">
                {isActive ? (
                  <div className="p-2 bg-zinc-700/50 rounded-lg">
                    <UserX className="w-5 h-5 text-zinc-400" />
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-500/10 rounded-lg">
                    <UserCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{isActive ? 'Desactivar Cuenta' : 'Cuenta Desactivada'}</p>
                  <p className="text-xs text-zinc-400 mt-1">
                    {isActive 
                      ? 'El agente no podrá acceder al sistema mientras la cuenta esté desactivada.'
                      : 'La cuenta está desactivada. El agente no puede acceder al sistema.'
                    }
                  </p>
                  <button
                    onClick={() => setConfirmDialog({ type: 'deactivate', open: true })}
                    className={`mt-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isActive ? 'Desactivar cuenta' : 'Activar cuenta'}
                  </button>
                </div>
              </div>
            </div>

            {/* Send Notification */}
            {onSendNotification && (
              <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Send className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">Enviar Notificación</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      Envía un mensaje directo al agente. Se mostrará en su panel de notificaciones.
                    </p>
                    <button
                      onClick={onSendNotification}
                      className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Enviar notificación
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete Account - Danger Zone */}
            <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-300">Eliminar Agente</p>
                  <p className="text-xs text-red-400/70 mt-1">
                    Esta acción es permanente y no se puede deshacer. Se eliminarán todos los datos del agente.
                  </p>
                  <button
                    onClick={() => setConfirmDialog({ type: 'delete', open: true })}
                    className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Eliminar agente
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
        <div className="w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex">
          {/* Vertical Tabs Sidebar */}
          <div className="w-52 bg-zinc-950 border-r border-zinc-800 flex flex-col shrink-0">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 h-[66px]">
              <div className="flex items-center gap-3">
                {agent.avatar ? (
                  <img src={agent.avatar} alt={agent.name} className="w-10 h-10 rounded-full bg-zinc-800 object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-sm font-bold text-white">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{agent.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{agent.email}</p>
                </div>
              </div>
            </div>

            {/* Tab List */}
            <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? tab.danger
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : tab.danger
                          ? 'text-zinc-500 hover:text-red-400 hover:bg-red-500/5'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* Close Button */}
            <div className="p-3 border-t border-zinc-800">
              <button
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl text-sm transition-colors"
              >
                <X className="w-4 h-4" />
                Cerrar
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Content Header */}
            <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 shrink-0 h-[66px]">
              <h2 className="text-lg font-semibold text-white">
                {visibleTabs.find(t => t.id === currentTab)?.label || 'Gestión'}
              </h2>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${
                confirmDialog.type === 'delete' ? 'bg-red-500/10' :
                confirmDialog.type === 'deactivate' ? (isActive ? 'bg-red-500/10' : 'bg-emerald-500/10') :
                confirmDialog.type === 'lock' ? 'bg-amber-500/10' : 'bg-emerald-500/10'
              }`}>
                {confirmDialog.type === 'delete' && <Trash2 className="w-6 h-6 text-red-400" />}
                {confirmDialog.type === 'deactivate' && (isActive ? <UserX className="w-6 h-6 text-red-400" /> : <UserCheck className="w-6 h-6 text-emerald-400" />)}
                {confirmDialog.type === 'lock' && <Lock className="w-6 h-6 text-amber-400" />}
                {confirmDialog.type === 'unlock' && <Unlock className="w-6 h-6 text-emerald-400" />}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">
                  {confirmDialog.type === 'delete' && '¿Eliminar agente?'}
                  {confirmDialog.type === 'deactivate' && (isActive ? '¿Desactivar cuenta?' : '¿Activar cuenta?')}
                  {confirmDialog.type === 'lock' && '¿Bloquear sesión?'}
                  {confirmDialog.type === 'unlock' && '¿Desbloquear sesión?'}
                </h3>
                <p className="text-sm text-zinc-400 mt-2">
                  {confirmDialog.type === 'delete' && `Esta acción eliminará permanentemente la cuenta de ${agent.name} y todos sus datos.`}
                  {confirmDialog.type === 'deactivate' && (isActive 
                    ? `${agent.name} no podrá acceder al sistema mientras la cuenta esté desactivada.`
                    : `${agent.name} podrá volver a acceder al sistema.`
                  )}
                  {confirmDialog.type === 'lock' && `${agent.name} verá una pantalla de bloqueo y no podrá operar.`}
                  {confirmDialog.type === 'unlock' && `${agent.name} podrá continuar trabajando normalmente.`}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setConfirmDialog({ type: null, open: false })}
                className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={confirmLoading}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  confirmDialog.type === 'delete' || (confirmDialog.type === 'deactivate' && isActive) || confirmDialog.type === 'lock'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {confirmLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

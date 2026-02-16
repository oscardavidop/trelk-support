/**
 * SendNotificationModal - Premium Zinc Refactor
 * Modal for supervisors to send high-fidelity notifications to agents
 */

import React, { useState, useEffect } from 'react';
import {
  X, Send, MessageSquare, UserPlus, Clock, AlertTriangle, 
  Star, ArrowUpRight, Loader2, Link, User
} from 'lucide-react';
import api from '../services/api';

// ============= TYPES =============

interface Agent {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  status?: string;
}

interface SendNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  preselectedAgentId?: string;
  preselectedChatId?: string;
}

type NotificationType = 'message' | 'assignment' | 'reminder' | 'alert' | 'vip' | 'escalation';
type Priority = 'normal' | 'urgent';

const NOTIFICATION_TYPES: { value: NotificationType; label: string; icon: React.ElementType }[] = [
  { value: 'message', label: 'Mensaje', icon: MessageSquare },
  { value: 'assignment', label: 'Asignación', icon: UserPlus },
  { value: 'reminder', label: 'Recordatorio', icon: Clock },
  { value: 'alert', label: 'Alerta', icon: AlertTriangle },
  { value: 'vip', label: 'VIP', icon: Star },
  { value: 'escalation', label: 'Escalación', icon: ArrowUpRight },
];

// ============= COMPONENT =============

export const SendNotificationModal: React.FC<SendNotificationModalProps> = ({
  isOpen,
  onClose,
  agents,
  preselectedAgentId,
  preselectedChatId,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [selectedAgentId, setSelectedAgentId] = useState(preselectedAgentId || '');
  const [type, setType] = useState<NotificationType>('message');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [sendTelegram, setSendTelegram] = useState(false);

  // Sync with preselectedAgentId when modal opens or agent changes
  useEffect(() => {
    if (preselectedAgentId) {
      setSelectedAgentId(preselectedAgentId);
    }
  }, [preselectedAgentId, isOpen]);

  // Reset
  const resetForm = () => {
    setSelectedAgentId(preselectedAgentId || '');
    setType('message');
    setTitle('');
    setMessage('');
    setPriority('normal');
    setActionUrl('');
    setActionLabel('');
    setSendTelegram(false);
    setError(null);
    setSuccess(false);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) return setError('Debes seleccionar un agente');
    if (!message.trim()) return setError('El mensaje es obligatorio');

    setLoading(true); setError(null);

    try {
      const { data } = await api.post<{ ok: boolean; error?: string }>('/api/notifications/send', {
        toAgentId: selectedAgentId,
        type,
        title: title.trim() || undefined,
        message: message.trim(),
        priority,
        actionUrl: actionUrl.trim() || undefined,
        actionLabel: actionLabel.trim() || undefined,
        relatedChatId: preselectedChatId,
        sendTelegram,
      });

      if (data.ok) {
        setSuccess(true);
        setTimeout(() => { resetForm(); onClose(); }, 1500);
      } else setError(data.error || 'Error al enviar');
    } catch { setError('Error de conexión'); } 
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Enviar Notificación</h2>
              {preselectedAgentId && agents.find(a => a._id === preselectedAgentId) && (
                <p className="text-xs text-zinc-500">
                  Para: <span className="text-indigo-400 font-medium">{agents.find(a => a._id === preselectedAgentId)?.name}</span>
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6scrollbar-thumb-zinc-700 scrollbar-track-transparent">
          
          {/* Success State */}
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 animate-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mb-4 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <Send className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-zinc-50 mb-1">¡Enviado!</h3>
              <p className="text-zinc-400">El agente recibirá la notificación al instante.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Agent Select */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase r">Destinatario</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-50 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 outline-none appearance-none transition-all"
                  >
                    <option value="">Seleccionar agente...</option>
                    {agents.map((agent) => (
                      <option key={agent._id} value={agent._id}>
                        {agent.name} {agent.email ? `(${agent.email})` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-600">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
              </div>

              {/* Type Grid */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500 uppercase r">Tipo de Aviso</label>
                <div className="grid grid-cols-3 gap-2">
                  {NOTIFICATION_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setType(value)}
                      className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                        type === value 
                          ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300 ring-1 ring-inset ring-indigo-500/20' 
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Content */}
              <div className="space-y-4 pt-2 border-t border-zinc-800">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase r">Contenido</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título (Opcional)"
                    className="w-full px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-50 placeholder-zinc-600 focus:border-indigo-500 outline-none transition-all"
                  />
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escribe el mensaje aquí..."
                    rows={4}
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-zinc-50 placeholder-zinc-600 focus:border-indigo-500 outline-none resize-none transition-all"
                  />
                </div>
              </div>

              {/* Advanced Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
                {/* Priority */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase r">Prioridad</label>
                  <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    {(['normal', 'urgent'] as const).map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        className={`flex-1 py-1.5 text-xs font-bold uppercase rounded-md transition-all ${
                          priority === p 
                            ? p === 'urgent' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'bg-zinc-800 text-zinc-50 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {p === 'normal' ? 'Normal' : 'Urgente'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Telegram Toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase r">Canales</label>
                  <label className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${sendTelegram ? 'bg-blue-500/10 border-blue-500/30' : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}>
                    <input type="checkbox" checked={sendTelegram} onChange={e => setSendTelegram(e.target.checked)} className="hidden" />
                    <div className={`p-1 rounded ${sendTelegram ? 'bg-blue-500 text-zinc-50' : 'bg-zinc-800 text-zinc-600'}`}>
                      <Send className="w-3.5 h-3.5 rotate-45" />
                    </div>
                    <div className="flex-1">
                      <span className={`text-xs font-bold block ${sendTelegram ? 'text-blue-300' : 'text-zinc-400'}`}>Enviar a Telegram</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Link (Optional) */}
              <div className="space-y-2">
                <button type="button" onClick={() => setActionUrl(p => p ? '' : 'https://')} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium">
                  {actionUrl ? '- Quitar botón de acción' : '+ Añadir botón de acción'}
                </button>
                
                {actionUrl !== '' && (
                  <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="relative group">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                        value={actionUrl}
                        onChange={e => setActionUrl(e.target.value)}
                        placeholder="URL (/chat/123)"
                        className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-50 focus:border-indigo-500 outline-none"
                      />
                    </div>
                    <input
                      value={actionLabel}
                      onChange={e => setActionLabel(e.target.value)}
                      placeholder="Texto del botón"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-50 focus:border-indigo-500 outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-400 text-xs font-medium animate-in slide-in-from-top-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-2 flex justify-end gap-3 border-t border-zinc-800">
                <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800 rounded-xl transition-colors uppercase ">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-zinc-50 text-xs font-bold uppercase  rounded-xl shadow-lg shadow-indigo-500/20 transition-all hover:translate-y-[-1px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar Ahora
                </button>
              </div>

            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SendNotificationModal;
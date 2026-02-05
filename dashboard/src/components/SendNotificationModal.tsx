/**
 * SendNotificationModal Component
 * Modal for supervisors to send notifications to agents
 */

import React, { useState } from 'react';
import {
  X,
  Send,
  MessageSquare,
  UserPlus,
  Clock,
  AlertTriangle,
  Star,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import api from '../services/api';

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

const notificationTypes: { value: NotificationType; label: string; icon: React.ElementType }[] = [
  { value: 'message', label: 'Mensaje', icon: MessageSquare },
  { value: 'assignment', label: 'Asignación', icon: UserPlus },
  { value: 'reminder', label: 'Recordatorio', icon: Clock },
  { value: 'alert', label: 'Alerta', icon: AlertTriangle },
  { value: 'vip', label: 'VIP', icon: Star },
  { value: 'escalation', label: 'Escalación', icon: ArrowUpRight },
];

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

  // Form state
  const [selectedAgentId, setSelectedAgentId] = useState(preselectedAgentId || '');
  const [type, setType] = useState<NotificationType>('message');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [actionUrl, setActionUrl] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [sendTelegram, setSendTelegram] = useState(false);

  // Reset form
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

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAgentId) {
      setError('Selecciona un agente');
      return;
    }
    if (!message.trim()) {
      setError('El mensaje es requerido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      interface SendResponse {
        ok: boolean;
        error?: string;
      }
      
      const { data } = await api.post<SendResponse>('/api/notifications/send', {
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
        setTimeout(() => {
          resetForm();
          onClose();
        }, 1500);
      } else {
        setError(data.error || 'Error al enviar notificación');
      }
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-xl shadow-2xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Enviar Notificación a Agente
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Send className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              ¡Notificación enviada!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Agent selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agente
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Seleccionar agente...</option>
                  {agents.map((agent) => (
                    <option key={agent._id} value={agent._id}>
                      {agent.name} {agent.email ? `(${agent.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {notificationTypes.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setType(value)}
                      className={`
                        flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors
                        ${type === value
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title (optional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Título <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título de la notificación"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={100}
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mensaje
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe el mensaje..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  required
                  maxLength={500}
                />
                <p className="mt-1 text-xs text-gray-400">{message.length}/500</p>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Prioridad
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="normal"
                      checked={priority === 'normal'}
                      onChange={() => setPriority('normal')}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Normal</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priority"
                      value="urgent"
                      checked={priority === 'urgent'}
                      onChange={() => setPriority('urgent')}
                      className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                    />
                    <span className="text-sm text-red-600 dark:text-red-400 font-medium">Urgente</span>
                  </label>
                </div>
              </div>

              {/* Action URL (optional) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL de acción <span className="text-gray-400 font-normal">(opc.)</span>
                  </label>
                  <input
                    type="text"
                    value={actionUrl}
                    onChange={(e) => setActionUrl(e.target.value)}
                    placeholder="/chat/123"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Etiqueta <span className="text-gray-400 font-normal">(opc.)</span>
                  </label>
                  <input
                    type="text"
                    value={actionLabel}
                    onChange={(e) => setActionLabel(e.target.value)}
                    placeholder="Ver chat"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {/* Telegram option */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendTelegram}
                    onChange={(e) => setSendTelegram(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enviar también por Telegram
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Notifica al agente en su cuenta de Telegram
                  </p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SendNotificationModal;

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Clock, Calendar, UserX, Zap, Send, Loader2, AlertCircle, Check, Eye
} from 'lucide-react';
import { createScheduledMessage } from '../../services/scheduledMessage.service';
import type { ScheduleType, TriggerEvent, CreateScheduledMessageInput } from '../../types/scheduledMessage';
import { toast } from '../../stores/toastStore';

interface Props {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
  defaultText?: string;
}

const SCHEDULE_TYPES = [
  { value: 'fixed_time', label: 'Hora Específica', icon: Calendar, desc: 'Programar para una fecha exacta.' },
  { value: 'after_inactivity', label: 'Por Inactividad', icon: UserX, desc: 'Si el usuario no responde en X tiempo.' },
  { value: 'on_event', label: 'Por Evento', icon: Zap, desc: 'Al ocurrir un evento del sistema.' },
];

const TRIGGER_EVENTS = [
  { value: 'agent_online', label: 'Cuando el agente esté online' },
  { value: 'chat_assigned', label: 'Al asignar el chat' },
  { value: 'chat_reopened', label: 'Al reabrir el chat' },
  { value: 'sla_warning', label: 'Alerta de SLA próximo' },
];

const QUICK_DELAYS = [5, 10, 15, 30, 60];

export function ScheduleMessageModal({ sessionId, isOpen, onClose, onCreated, defaultText = '' }: Props) {
  const [type, setType] = useState<ScheduleType>('fixed_time');
  const [messageText, setMessageText] = useState(defaultText);
  const [scheduledAt, setScheduledAt] = useState('');
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [triggerEvent, setTriggerEvent] = useState<TriggerEvent>('agent_online');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMessageText(defaultText);
      setError(null);
      const defaultTime = new Date(Date.now() + 3600000); // +1 hora
      setScheduledAt(formatDateTimeLocal(defaultTime));
    }
  }, [isOpen, defaultText]);

  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const handleSubmit = async () => {
    if (!messageText.trim()) return setError('El mensaje es requerido');
    
    setIsSubmitting(true);
    setError(null);

    try {
      const input: CreateScheduledMessageInput = {
        sessionId,
        type,
        message: { text: messageText },
      };

      if (type === 'fixed_time') {
        const date = new Date(scheduledAt);
        if (date <= new Date()) throw new Error('La fecha debe ser futura');
        input.scheduledAt = date.toISOString();
      } else if (type === 'after_inactivity') {
        if (delayMinutes < 1) throw new Error('Mínimo 1 minuto');
        input.delayMinutes = delayMinutes;
      } else if (type === 'on_event') {
        input.triggerEvent = triggerEvent;
      }

      const result = await createScheduledMessage(input);
      if (result.ok) {
        toast.success('Mensaje programado correctamente');
        onCreated?.();
        onClose();
      } else throw new Error(result.error);
    } catch (err: any) {
      setError(err.message || 'Error al programar');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 ring-1 ring-white/10">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900 shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl shadow-inner">
              <Clock className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Programar Mensaje</h2>
              <p className="text-xs text-zinc-400">Automatiza el envío de respuestas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          
          {/* Type Selector */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-zinc-500">Tipo de Programación</label>
            <div className="grid grid-cols-1 gap-2">
              {SCHEDULE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value as any)}
                  className={`flex items-center gap-4 p-3 rounded-xl border transition-all text-left group ${
                    type === t.value 
                      ? 'bg-zinc-800 border-indigo-500 shadow-md ring-1 ring-indigo-500/20' 
                      : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${type === t.value ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:text-zinc-200'}`}>
                    <t.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${type === t.value ? 'text-white' : 'text-zinc-300'}`}>{t.label}</p>
                    <p className="text-xs text-zinc-500">{t.desc}</p>
                  </div>
                  {type === t.value && <Check className="w-4 h-4 text-indigo-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional Inputs */}
          <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl animate-in slide-in-from-top-2">
            {type === 'fixed_time' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500">Fecha y Hora</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:border-indigo-500 focus:outline-none transition-all text-sm"
                />
              </div>
            )}

            {type === 'after_inactivity' && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-zinc-500">Tiempo de Espera</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {QUICK_DELAYS.map(m => (
                    <button key={m} onClick={() => setDelayMinutes(m)} className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${delayMinutes === m ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}>
                      {m} min
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <input type="number" min="1" value={delayMinutes} onChange={(e) => setDelayMinutes(parseInt(e.target.value))} className="w-24 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-xl text-white text-center focus:border-indigo-500 outline-none" />
                  <span className="text-sm text-zinc-400">minutos de inactividad</span>
                </div>
              </div>
            )}

            {type === 'on_event' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-500">Evento Disparador</label>
                <select value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value as any)} className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:border-indigo-500 outline-none text-sm">
                  {TRIGGER_EVENTS.map(ev => <option key={ev.value} value={ev.value}>{ev.label}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Message Input & Preview */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500">Contenido del Mensaje</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                rows={3}
                placeholder="Escribe el mensaje aquí..."
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-white placeholder-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none text-sm transition-all"
              />
              <p className="text-[10px] text-zinc-500 text-right">{messageText.length}/4096 caracteres</p>
            </div>

            {/* PREVIEW RESTORED */}
            <div className="space-y-2">
               <label className="text-xs font-bold text-zinc-500 flex items-center gap-1.5">
                  <Eye className="w-3 h-3"/> Vista Previa
               </label>
               <div className="p-4 bg-zinc-950/50 border border-zinc-800/50 border-dashed rounded-xl">
                  {messageText ? (
                    <div className="flex justify-end">
                       <div className="bg-indigo-600 text-white px-4 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[90%] shadow-lg shadow-indigo-900/10">
                          <p className="whitespace-pre-wrap break-words">{messageText}</p>
                       </div>
                    </div>
                  ) : (
                    <div className="text-center text-zinc-600 text-xs italic py-2">
                       El mensaje aparecerá aquí como lo verá el usuario
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500">
                     <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">{"{userName}"}</span>
                     <span className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">{"{agentName}"}</span>
                     <span>Variables disponibles</span>
                  </div>
               </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in slide-in-from-bottom-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-800 bg-zinc-900 rounded-b-2xl shrink-0">
          <button onClick={onClose} disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-all">Cancelar</button>
          <button onClick={handleSubmit} disabled={isSubmitting || !messageText.trim()} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]">
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {isSubmitting ? 'Procesando...' : 'Programar Envío'}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
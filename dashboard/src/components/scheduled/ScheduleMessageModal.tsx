/**
 * ScheduleMessageModal - Modal for scheduling messages
 * Supports: fixed time, inactivity-based, and event-based scheduling
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // <--- Importante: Agrega esto arriba
import {
    X,
    Clock,
    Calendar,
    UserX,
    Zap,
    Send,
    Image,
    FileText,
    Loader2,
    AlertCircle,
    Check
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

const SCHEDULE_TYPES: { value: ScheduleType; label: string; icon: typeof Clock; description: string }[] = [
    {
        value: 'fixed_time',
        label: 'Hora específica',
        icon: Calendar,
        description: 'Enviar en una fecha y hora exacta'
    },
    {
        value: 'after_inactivity',
        label: 'Por inactividad',
        icon: UserX,
        description: 'Enviar si el usuario no responde en X minutos'
    },
    {
        value: 'on_event',
        label: 'Por evento',
        icon: Zap,
        description: 'Enviar cuando ocurra un evento específico'
    },
];

const TRIGGER_EVENTS: { value: TriggerEvent; label: string }[] = [
    { value: 'agent_online', label: 'Cuando el agente vuelva a estar online' },
    { value: 'chat_assigned', label: 'Cuando el chat sea asignado' },
    { value: 'chat_reopened', label: 'Cuando el chat sea reabierto' },
    { value: 'sla_warning', label: 'Cuando SLA esté por vencer' },
    { value: 'chat_transferred', label: 'Cuando el chat sea transferido' },
];

const QUICK_DELAYS = [
    { value: 5, label: '5 min' },
    { value: 10, label: '10 min' },
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hora' },
];

export function ScheduleMessageModal({ sessionId, isOpen, onClose, onCreated, defaultText = '' }: Props) {
    const [type, setType] = useState<ScheduleType>('fixed_time');
    const [messageText, setMessageText] = useState(defaultText);
    const [scheduledAt, setScheduledAt] = useState('');
    const [delayMinutes, setDelayMinutes] = useState(10);
    const [triggerEvent, setTriggerEvent] = useState<TriggerEvent>('agent_online');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form when opened
    useEffect(() => {
        if (isOpen) {
            setMessageText(defaultText);
            setError(null);

            // Set default scheduled time to 1 hour from now
            const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
            setScheduledAt(formatDateTimeLocal(defaultTime));
        }
    }, [isOpen, defaultText]);

    const formatDateTimeLocal = (date: Date): string => {
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const handleSubmit = async () => {
        // Validation
        if (!messageText.trim()) {
            setError('El mensaje no puede estar vacío');
            return;
        }

        if (type === 'fixed_time') {
            const selectedDate = new Date(scheduledAt);
            if (selectedDate <= new Date()) {
                setError('La fecha debe ser en el futuro');
                return;
            }
        }

        if (type === 'after_inactivity' && delayMinutes < 1) {
            setError('El tiempo de espera debe ser al menos 1 minuto');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const input: CreateScheduledMessageInput = {
                sessionId,
                type,
                message: {
                    text: messageText,
                },
            };

            if (type === 'fixed_time') {
                input.scheduledAt = new Date(scheduledAt).toISOString();
            } else if (type === 'after_inactivity') {
                input.delayMinutes = delayMinutes;
            } else if (type === 'on_event') {
                input.triggerEvent = triggerEvent;
            }

            const result = await createScheduledMessage(input);

            if (result.ok) {
                toast.success('Mensaje programado', 'El mensaje se enviará según lo configurado');
                onCreated?.();
                onClose();
            } else {
                setError(result.error || 'Error al programar el mensaje');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;
    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">

            {/* Contenedor del Modal */}
            <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">

                {/* Header (Fijo) */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/20 rounded-lg">
                            <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Programar mensaje</h2>
                            <p className="text-xs text-gray-400">Envío automático bajo condiciones</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content (Scrollable) */}
                <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">

                    {/* Selección de Tipo */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Tipo de programación</label>
                        <div className="grid grid-cols-1 gap-2">
                            {SCHEDULE_TYPES.map((option) => {
                                const Icon = option.icon;
                                const isSelected = type === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => setType(option.value)}
                                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isSelected
                                                ? 'border-primary bg-primary/10 text-white'
                                                : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary/20' : 'bg-gray-700'}`}>
                                            <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-gray-400'}`} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-medium">{option.label}</p>
                                            <p className="text-xs text-gray-500">{option.description}</p>
                                        </div>
                                        {isSelected && <Check className="w-5 h-5 text-primary" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Opciones Específicas según Tipo */}
                    {type === 'fixed_time' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-sm font-medium text-gray-300">Fecha y hora</label>
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                min={formatDateTimeLocal(new Date())}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                        </div>
                    )}

                    {type === 'after_inactivity' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-sm font-medium text-gray-300">
                                Enviar si no hay respuesta en:
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {QUICK_DELAYS.map((delay) => (
                                    <button
                                        key={delay.value}
                                        onClick={() => setDelayMinutes(delay.value)}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${delayMinutes === delay.value
                                                ? 'bg-primary text-white'
                                                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                            }`}
                                    >
                                        {delay.label}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                                <input
                                    type="number"
                                    value={delayMinutes}
                                    onChange={(e) => setDelayMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                                    min="1"
                                    max="1440"
                                    className="w-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-center focus:outline-none focus:border-primary"
                                />
                                <span className="text-gray-400 text-sm">minutos</span>
                            </div>
                        </div>
                    )}

                    {type === 'on_event' && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-sm font-medium text-gray-300">Evento disparador</label>
                            <select
                                value={triggerEvent}
                                onChange={(e) => setTriggerEvent(e.target.value as TriggerEvent)}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-primary"
                            >
                                {TRIGGER_EVENTS.map((event) => (
                                    <option key={event.value} value={event.value}>
                                        {event.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Contenido del Mensaje */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Mensaje</label>
                        <textarea
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            placeholder="Escribe el mensaje a enviar..."
                            rows={4}
                            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                        />
                        <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Soporta: {'{userName}'}, {'{agentName}'}</span>
                            <span className={messageText.length > 4000 ? 'text-red-400' : ''}>
                                {messageText.length}/4096
                            </span>
                        </div>
                    </div>

                    {/* Mensaje de Error */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 animate-in fade-in slide-in-from-bottom-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {/* Vista Previa */}
                    <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                        <p className="text-xs text-gray-500 mb-2">Vista previa:</p>
                        <div className="flex justify-end">
                            <div className="max-w-[85%] bg-primary/20 border border-primary/30 rounded-xl rounded-tr-none px-4 py-2">
                                <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                                    {messageText || 'Tu mensaje aparecerá aquí...'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer (Fijo) */}
                <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800 shrink-0 bg-gray-900 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !messageText.trim()}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-primary/20"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        <span>{isSubmitting ? 'Programando...' : 'Programar'}</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );

}

export default ScheduleMessageModal;

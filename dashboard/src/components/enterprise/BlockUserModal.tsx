/**
 * BlockUserModal - Premium Zinc Refactor
 * High-fidelity destructive action modal for user management.
 */

import React, { useState } from 'react';
import { Dialog, DialogContent } from '../ui/dialog';
import { useSocket } from '../../hooks/useSocket';
import { Ban, Loader2, AlertTriangle, Clock, ShieldAlert, Info } from 'lucide-react';

interface BlockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramId: number;
  username?: string;
  firstName?: string;
  onBlockSuccess?: () => void;
}

export const BlockUserModal: React.FC<BlockUserModalProps> = ({
  isOpen,
  onClose,
  telegramId,
  username,
  firstName,
  onBlockSuccess,
}) => {
  const { socket } = useSocket();
  const [blockType, setBlockType] = useState<'temporary' | 'permanent'>('temporary');
  const [duration, setDuration] = useState<number>(24); // hours
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBlock = async () => {
    if (!reason.trim()) {
      setError('Debes proporcionar una razón para el bloqueo');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      socket?.emit('user:block', {
        telegramId,
        blockType,
        reason: reason.trim(),
        durationHours: blockType === 'temporary' ? duration : undefined,
      }, (response: { ok: boolean; error?: string }) => {
        if (response.ok) {
          setIsLoading(false)
          onClose();
          setReason('');
          setBlockType('temporary');
          setDuration(24);
          onBlockSuccess?.();
        } else {
          setError(response.error || 'Error al bloquear usuario');
          // setIsLoading(false);
        }
      });

      setTimeout(() => {
        setIsLoading(false);
        onClose();
        setReason('');
        setBlockType('temporary');
        setDuration(24);
      }, 500);
    } catch (err) {
      setError('Error al bloquear usuario');
      setIsLoading(false);
    }
  };

  const displayName = firstName || username || `Usuario ${telegramId}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 bg-zinc-950 border-zinc-800 shadow-2xl overflow-hidden gap-0">
        
        {/* === HEADER === */}
        <div className="relative px-6 py-5 border-b border-zinc-800/50 bg-gradient-to-b from-red-500/10 to-transparent">
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500/50" />
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-500/10 text-red-500 rounded-xl ring-1 ring-red-500/20 shadow-inner">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100 tracking-tight">Bloquear Usuario</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Restringir acceso a <span className="font-bold text-zinc-300">{displayName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* === BODY === */}
        <div className="px-6 py-5 space-y-5">
          
          {/* Warning Banner */}
          <div className="flex items-start gap-3 p-3.5 bg-red-500/5 border border-red-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-400/90 leading-relaxed">
              El usuario será desconectado inmediatamente y no podrá enviar ni recibir mensajes mientras el bloqueo esté activo.
            </p>
          </div>

          {/* Block Type Segmented Control */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase ">Tipo de Bloqueo</label>
            <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              <button
                onClick={() => setBlockType('temporary')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                  blockType === 'temporary'
                    ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Clock className="w-3.5 h-3.5" /> Temporal
              </button>
              <button
                onClick={() => setBlockType('permanent')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                  blockType === 'permanent'
                    ? 'bg-red-500/10 text-red-400 ring-1 ring-red-500/30 shadow-sm'
                    : 'text-zinc-500 hover:text-red-400/70'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" /> Permanente
              </button>
            </div>
          </div>

          {/* Duration Input (Conditional) */}
          {blockType === 'temporary' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-500 uppercase ">Duración</label>
                <span className="text-[10px] text-zinc-500 font-mono">
                  {duration >= 24 ? `≈ ${Math.round(duration / 24)} días` : `${duration} horas`}
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={8760}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 24)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-4 pr-12 text-sm text-zinc-200 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 outline-none transition-all"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                  HRS
                </div>
              </div>
            </div>
          )}

          {/* Reason Textarea */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-500 uppercase  flex items-center gap-1.5">
              Motivo del Bloqueo <span className="text-red-500">*</span>
            </label>
            <textarea
              placeholder="Ej: Spam repetitivo, lenguaje inapropiado..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 outline-none resize-none transition-all"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-xs font-medium text-red-400 animate-in fade-in">
              <Info className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* === FOOTER === */}
        <div className="px-6 py-4 bg-zinc-900/50 border-t border-zinc-800 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleBlock}
            disabled={isLoading || !reason.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
            Confirmar Bloqueo
          </button>
        </div>

      </DialogContent>
    </Dialog>
  );
};

export default BlockUserModal;
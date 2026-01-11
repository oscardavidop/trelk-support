/**
 * Block User Modal Component
 * Modal to block/unblock users (temporary or permanent)
 */

import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/Button';
import { Label } from '../ui/label';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select-advanced';
import { useSocket } from '../../hooks/useSocket';
import { Ban, Loader2, AlertTriangle } from 'lucide-react';

interface BlockUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  telegramId: number;
  username?: string;
  firstName?: string;
}

export const BlockUserModal: React.FC<BlockUserModalProps> = ({
  isOpen,
  onClose,
  telegramId,
  username,
  firstName,
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="w-5 h-5" />
            Bloquear Usuario
          </DialogTitle>
          <DialogDescription>
            Bloquear a <strong>{displayName}</strong> del sistema de soporte.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <p className="text-sm text-destructive">
              El usuario no podrá enviar mensajes al bot mientras esté bloqueado.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Tipo de bloqueo</Label>
            <Select value={blockType} onValueChange={(v) => setBlockType(v as 'temporary' | 'permanent')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="temporary">
                  ⏱️ Temporal (con expiración)
                </SelectItem>
                <SelectItem value="permanent">
                  🚫 Permanente
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {blockType === 'temporary' && (
            <div className="grid gap-2">
              <Label htmlFor="duration">Duración (horas)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                max={8760} // 1 year
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 24)}
              />
              <p className="text-xs text-muted-foreground">
                {duration >= 24 
                  ? `≈ ${Math.round(duration / 24)} días`
                  : `${duration} horas`
                }
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="reason">Razón del bloqueo *</Label>
            <Textarea
              id="reason"
              placeholder="Ej: Comportamiento inapropiado, spam repetitivo..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleBlock} 
            disabled={isLoading || !reason.trim()}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Bloquear Usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BlockUserModal;

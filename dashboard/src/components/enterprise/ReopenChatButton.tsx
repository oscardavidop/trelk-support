/**
 * Reopen Chat Button Component
 * Button to reopen a closed chat (admin only)
 */

import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import { RotateCcw, Loader2, ShieldAlert } from 'lucide-react';

interface ReopenChatButtonProps {
  sessionId: string;
  reopenCount?: number;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const ReopenChatButton: React.FC<ReopenChatButtonProps> = ({
  sessionId,
  reopenCount = 0,
  disabled = false,
  variant = 'outline',
  size = 'sm',
}) => {
  const { socket } = useSocket();
  const { agent } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Only admin can reopen chats
  const isAdmin = agent?.role === 'admin';

  const handleReopen = () => {
    setIsLoading(true);
    socket?.emit('session:reopen', { sessionId });
    
    setTimeout(() => {
      setIsLoading(false);
      setIsDialogOpen(false);
    }, 500);
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsDialogOpen(true)}
        disabled={disabled}
        title="Reabrir chat"
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Reabrir
        {reopenCount > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">({reopenCount})</span>
        )}
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5" />
              Reabrir Chat
            </DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas reabrir este chat?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted">
              <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Acción de administrador</p>
                <p className="text-muted-foreground">
                  El chat pasará a estado "en espera" y el usuario recibirá una notificación.
                </p>
              </div>
            </div>

            {reopenCount > 0 && (
              <p className="text-sm text-muted-foreground">
                Este chat ha sido reabierto {reopenCount} {reopenCount === 1 ? 'vez' : 'veces'} anteriormente.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button onClick={handleReopen} disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Reapertura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReopenChatButton;

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
import { RotateCcw, Loader2, ShieldAlert, History, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import usePermissions from '../../hooks/usePermissions';

interface ReopenChatButtonProps {
  sessionId: string;
  reopenCount?: number;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const ReopenChatButton: React.FC<ReopenChatButtonProps> = ({
  sessionId,
  reopenCount = 0,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  className,
}) => {
  const { socket } = useSocket();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { can } = usePermissions();

  // Permiso Check
  if (!can('chats.reopen')) return null;

  const handleReopen = async () => {
    if (!socket) return;
    setIsLoading(true);

    try {
      // Simulación de latencia para UX
      await new Promise<void>((resolve) => {
        socket.emit('session:reopen', { sessionId });
        setTimeout(resolve, 600);
      });

      toast.success('Chat reactivado', { description: 'La sesión está abierta nuevamente.' });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error reopening chat:', error);
      toast.error('Error', { description: 'No se pudo reactivar el chat.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* --- TRIGGER BUTTON --- */}
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsDialogOpen(true)}
        disabled={disabled || isLoading}
        className={`relative group border-zinc-700 hover:bg-zinc-800 hover:text-white transition-all ${className}`}
        title="Reactivar conversación"
      >
        <RotateCcw className={`w-4 h-4 ${reopenCount > 0 && size !== 'icon' ? 'mr-2' : ''} group-hover:-rotate-90 transition-transform duration-300`} />

        {size !== 'icon' && <span>Reabrir</span>}

        {/* Badge Counter */}
        {reopenCount > 0 && (
          <span className={`
            absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center 
            rounded-full bg-zinc-800 border border-zinc-700 text-[9px] font-bold text-zinc-400
            shadow-sm
          `}>
            {reopenCount}
          </span>
        )}
      </Button>

      {/* --- CONFIRMATION MODAL --- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[420px] bg-zinc-950 border-zinc-800 shadow-2xl p-0 overflow-hidden gap-0 ring-1 ring-white/5">
          
          {/* Header Visual */}
          <div className="bg-zinc-900/50 p-6 flex flex-col items-center border-b border-zinc-800/50">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 mb-4 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
               <RotateCcw className="w-6 h-6 text-emerald-500" />
            </div>
            
            <DialogTitle className="text-lg font-bold text-white text-center">
              Reactivar Conversación
            </DialogTitle>
            
            <DialogDescription className="text-center text-zinc-400 text-sm mt-1 max-w-[280px]">
              El estado pasará de <span className="text-zinc-300 font-medium">Cerrado</span> a <span className="text-emerald-400 font-medium">Activo</span> inmediatamente.
            </DialogDescription>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            
            {/* Warning Card */}
            <div className="flex items-start gap-3 p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl">
               <div className="p-1 bg-amber-500/10 rounded-md shrink-0">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
               </div>
               <div>
                  <h4 className="text-xs font-bold text-amber-500  mb-0.5">Acción Administrativa</h4>
                  <p className="text-xs text-amber-200/60 leading-relaxed">
                    Esto generará un evento en el historial visible para el usuario y reiniciará el contador de SLA.
                  </p>
               </div>
            </div>

            {/* History Info */}
            {reopenCount > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                 <div className="flex items-center gap-2 text-zinc-400">
                    <History className="w-4 h-4" />
                    <span className="text-xs font-medium">Reaperturas previas</span>
                 </div>
                 <span className="text-xs font-mono font-bold text-zinc-200 bg-zinc-800 px-2 py-0.5 rounded">
                    {reopenCount}
                 </span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <DialogFooter className="p-6 pt-0 sm:justify-between gap-3">
            <Button
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
              className="w-full sm:w-auto text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              Cancelar
            </Button>

            <Button
              onClick={handleReopen}
              disabled={isLoading}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-lg shadow-emerald-900/20"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmar Reactivación
                </>
              )}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReopenChatButton;
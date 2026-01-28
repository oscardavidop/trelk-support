// /**
//  * Reopen Chat Button Component
//  * Button to reopen a closed chat (admin only)
//  */

// import React, { useState } from 'react';
// import { Button } from '../ui/Button';
// import { 
//   Dialog, 
//   DialogContent, 
//   DialogHeader, 
//   DialogTitle,
//   DialogFooter,
//   DialogDescription,
// } from '../ui/dialog';
// import { useSocket } from '../../hooks/useSocket';
// import { useAuth } from '../../hooks/useAuth';
// import { RotateCcw, Loader2, ShieldAlert } from 'lucide-react';

// interface ReopenChatButtonProps {
//   sessionId: string;
//   reopenCount?: number;
//   disabled?: boolean;
//   variant?: 'default' | 'outline' | 'ghost';
//   size?: 'default' | 'sm' | 'lg' | 'icon';
// }

// export const ReopenChatButton: React.FC<ReopenChatButtonProps> = ({
//   sessionId,
//   reopenCount = 0,
//   disabled = false,
//   variant = 'outline',
//   size = 'sm',
// }) => {
//   const { socket } = useSocket();
//   const { agent } = useAuth();
//   const [isDialogOpen, setIsDialogOpen] = useState(false);
//   const [isLoading, setIsLoading] = useState(false);

//   // Only admin can reopen chats
//   const isAdmin = agent?.role === 'admin';

//   const handleReopen = () => {
//     setIsLoading(true);
//     socket?.emit('session:reopen', { sessionId });

//     setTimeout(() => {
//       setIsLoading(false);
//       setIsDialogOpen(false);
//     }, 500);
//   };

//   if (!isAdmin) {
//     return null;
//   }

//   return (
//     <>
//       <Button
//         variant={variant}
//         size={size}
//         onClick={() => setIsDialogOpen(true)}
//         disabled={disabled}
//         title="Reabrir chat"
//       >
//         <RotateCcw className="w-4 h-4 mr-2" />
//         Reabrir
//         {reopenCount > 0 && (
//           <span className="ml-1 text-xs text-muted-foreground">({reopenCount})</span>
//         )}
//       </Button>

//       <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
//         <DialogContent className="sm:max-w-[400px]">
//           <DialogHeader>
//             <DialogTitle className="flex items-center gap-2">
//               <RotateCcw className="w-5 h-5" />
//               Reabrir Chat
//             </DialogTitle>
//             <DialogDescription>
//               ¿Estás seguro de que deseas reabrir este chat?
//             </DialogDescription>
//           </DialogHeader>

//           <div className="py-4 space-y-3">
//             <div className="flex items-start gap-2 p-3 rounded-lg bg-muted">
//               <ShieldAlert className="w-5 h-5 text-amber-500 mt-0.5" />
//               <div className="text-sm">
//                 <p className="font-medium">Acción de administrador</p>
//                 <p className="text-muted-foreground">
//                   El chat pasará a estado "en espera" y el usuario recibirá una notificación.
//                 </p>
//               </div>
//             </div>

//             {reopenCount > 0 && (
//               <p className="text-sm text-muted-foreground">
//                 Este chat ha sido reabierto {reopenCount} {reopenCount === 1 ? 'vez' : 'veces'} anteriormente.
//               </p>
//             )}
//           </div>

//           <DialogFooter>
//             <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
//               Cancelar
//             </Button>
//             <Button onClick={handleReopen} disabled={isLoading}>
//               {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
//               Confirmar Reapertura
//             </Button>
//           </DialogFooter>
//         </DialogContent>
//       </Dialog>
//     </>
//   );
// };

// export default ReopenChatButton;

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
import { RotateCcw, Loader2, ShieldAlert, History, CheckCircle2 } from 'lucide-react';
// Si tienes toast, úsalo, si no, puedes quitarlo
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
  const { agent } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Solo admin puede reabrir
  const { can } = usePermissions();

  if (!can('chats.reopen')) return null;

  const handleReopen = async () => {
    if (!socket) return;

    setIsLoading(true);

    try {
      // Promesa simulada para dar tiempo a la UI
      await new Promise<void>((resolve) => {
        socket.emit('session:reopen', { sessionId });
        setTimeout(resolve, 800);
      });

      if (typeof toast !== 'undefined') toast.success('Chat reactivado correctamente');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error reopening chat:', error);
      if (typeof toast !== 'undefined') toast.error('No se pudo reactivar el chat');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* --- BOTÓN TRIGGER --- */}
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsDialogOpen(true)}
        disabled={disabled || isLoading}
        className={`relative ${className}`}
        title="Reactivar conversación"
      >
        <RotateCcw className={`w-4 h-4 ${reopenCount > 0 && size !== 'icon' ? 'mr-2' : ''}`} />

        {size !== 'icon' && <span>Reabrir</span>}

        {/* Badge contador estilo notificación */}
        {reopenCount > 0 && (
          <span className={`
            flex items-center justify-center bg-gray-700 text-gray-300 text-[10px] font-medium h-5 min-w-[20px] rounded-full px-1.5
            ${size !== 'icon' ? 'ml-2' : 'absolute -top-1 -right-1 border border-gray-900'}
          `}>
            {reopenCount}
          </span>
        )}
      </Button>

      {/* --- MODAL OSCURO --- */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        {/* Nota: DialogContent ya tiene bg-gray-900 por defecto en tu componente */}
        <DialogContent className="sm:max-w-[440px] border-gray-800">

          <DialogHeader className="gap-2">
            {/* Icono decorativo centrado */}
            <div className="mx-auto bg-emerald-500/10 p-3 rounded-full w-fit mb-1 border border-emerald-500/20">
              <RotateCcw className="w-6 h-6 text-emerald-400" />
            </div>

            <DialogTitle className="text-xl text-center">
              ¿Reactivar conversación?
            </DialogTitle>

            <DialogDescription className="text-center text-gray-400">
              Esta acción moverá el chat de "Cerrado" a "Activo" o "En Espera".
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Caja de Advertencia - Diseño Dark Mode */}
            <div className="relative overflow-hidden rounded-lg bg-amber-950/30 border border-amber-500/20 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-400">Acción Administrativa</p>
                  <p className="text-xs text-amber-200/70 leading-relaxed">
                    El usuario recibirá una notificación indicando que un administrador ha retomado la conversación.
                  </p>
                </div>
              </div>
              {/* Decoración de fondo */}
              <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-amber-500/5 rounded-full blur-xl" />
            </div>

            {/* Información de Historial */}
            {reopenCount > 0 && (
              <div className="flex items-center justify-center gap-2 text-xs text-gray-500 bg-gray-800/50 py-2 rounded-md border border-gray-800">
                <History className="w-3.5 h-3.5" />
                <span>
                  Historial: Reabierto <strong>{reopenCount}</strong> {reopenCount === 1 ? 'vez' : 'veces'} previamente.
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-3 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
              className="hover:bg-gray-800 hover:text-white text-gray-400"
            >
              Cancelar
            </Button>

            <Button
              onClick={handleReopen}
              disabled={isLoading}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 ring-0 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Confirmar
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
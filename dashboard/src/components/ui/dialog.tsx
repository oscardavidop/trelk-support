import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// ==================== INTERFACES ====================

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

// ==================== CONTEXT ====================

const DialogContext = React.createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>({ open: false, onOpenChange: () => {} });

// ==================== COMPONENT: ROOT ====================

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  const handleOpenChange = React.useCallback((newOpen: boolean) => {
    onOpenChange?.(newOpen);
  }, [onOpenChange]);

  return (
    <DialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </DialogContext.Provider>
  );
}

// ==================== COMPONENT: CONTENT (PORTAL) ====================

export function DialogContent({ children, className = '', showCloseButton = true }: DialogContentProps) {
  const { open, onOpenChange } = React.useContext(DialogContext);
  const [mounted, setMounted] = React.useState(false);

  // Evitar problemas de hidratación en SSR (Next.js/Remix)
  React.useEffect(() => {
    setMounted(true);
    // Bloquear scroll del body cuando está abierto
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop con Blur */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Modal Panel */}
      <div 
        className={`
          relative z-[101] w-full max-w-lg
          bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl 
          animate-in fade-in zoom-in-95 duration-200 slide-in-from-bottom-2
          ring-1 ring-white/10
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        {showCloseButton && (
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-700"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </button>
        )}
        
        {children}
      </div>
    </div>,
    document.body
  );
}

// ==================== COMPONENT: HEADER ====================

export function DialogHeader({ children, className = '' }: DialogHeaderProps) {
  return (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left mb-4 ${className}`}>
      {children}
    </div>
  );
}

// ==================== COMPONENT: TITLE ====================

export function DialogTitle({ children, className = '' }: DialogTitleProps) {
  return (
    <h2 className={`text-lg font-bold leading-none tracking-tight text-white ${className}`}>
      {children}
    </h2>
  );
}

// ==================== COMPONENT: DESCRIPTION ====================

export function DialogDescription({ children, className = '' }: DialogDescriptionProps) {
  return (
    <p className={`text-sm text-zinc-400 leading-relaxed ${className}`}>
      {children}
    </p>
  );
}

// ==================== COMPONENT: FOOTER ====================

export function DialogFooter({ children, className = '' }: DialogFooterProps) {
  return (
    <div className={`flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 gap-2 mt-6 ${className}`}>
      {children}
    </div>
  );
}